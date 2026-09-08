# Mail Tracker

Self-hosted, internal tool for **Illumia Solutions**. Tracks **total opens** and
**per-link click counts** for HTML emails sent manually through Carbonio webmail.
There is no send integration — this app never sends mail itself. The flow is:

1. Paste or upload your campaign HTML into the app.
2. The backend injects a 1×1 tracking pixel and rewrites every `<a href>` to go
   through a redirect endpoint first.
3. You download the tracked HTML and paste it as the message source in
   Carbonio's HTML compose mode, then send it yourself.
4. As recipients open the mail / click links, hits land on the backend and get
   logged.
5. The dashboard shows raw totals — no unique/dedup counting, no rate or
   percentage math anywhere (see "Why no rates?" below).

---

## Table of contents

- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Required environment variables](#required-environment-variables)
- [Cookie domain — read this before deploying](#cookie-domain--read-this-before-deploying)
- [Running locally](#running-locally)
- [Creating a user account](#creating-a-user-account)
- [Disabling / removing a user account](#disabling--removing-a-user-account)
- [API reference](#api-reference)
- [Database schema](#database-schema)
- [Prisma workflow](#prisma-workflow)
- [Scripts reference](#scripts-reference)
- [Running in production](#running-in-production)
- [Post-deploy checklist](#post-deploy-checklist)
- [Troubleshooting](#troubleshooting)
- [Why no rates?](#why-no-rates)
- [Security notes](#security-notes)
- [Operational notes](#operational-notes)

---

## Architecture

Two independent services, two directories, no shared code:

```
mail-tracker/
  frontend/   Next.js 15 UI. Zero DB access, zero business logic. Talks to
              the backend over HTTP only.
  backend/    Node + Express + Prisma API (MySQL). Owns the database, the
              public tracking endpoints, campaign CRUD, and auth.
```

```
                         ┌─────────────────────┐
  recipient's mail app ─▶│  backend  (:4000)   │  public tracking endpoints
                         │  /api/track/open/*   │  (no auth, hit directly by
                         │  /api/track/click/*  │   mail clients)
                         └─────────┬────────────┘
                                   │
                          Prisma / MySQL
                                   │
                         ┌─────────┴────────────┐
     browser (you) ─────▶│  frontend  (:3000)   │  dashboard, campaign
        logs in via      │  Next.js App Router   │  create/edit/delete,
        /login           └─────────┬────────────┘  profile
                                   │
                    relative fetch("/api/...", { credentials: "include" })
                                   │
                    next.config.ts rewrites() proxies /api/* to the backend
                    (Set-Cookie lands as first-party on the frontend's own
                     domain — see "Cookie domain" below)
                                   ▼
                         backend's /api/auth/*, /api/campaigns/*, /api/process
```

The frontend has **no database access** — every read/write goes through the
backend's HTTP API. Server Components/Actions (`lib/backend.ts`) call the
backend's real origin directly and forward the visitor's cookies by hand for
SSR reads; client components never call the backend's origin directly — they
fetch relative `/api/...` paths on the frontend's own domain, which
`next.config.ts` proxies to the backend server-side (see
[Cookie domain](#cookie-domain--read-this-before-deploying) for why). The
root directory has **no `package.json`** — always run commands from inside
`frontend/` or `backend/`.

## Tech stack

**Frontend**
- Next.js 15 (App Router, TypeScript, React 19)
- `jose` — verifies (never signs) the access-token JWT in `middleware.ts`,
  purely for redirect UX
- Plain CSS with design tokens (no Tailwind, no CSS-in-JS)

**Backend**
- Node ≥ 20, TypeScript (ESM, `NodeNext` resolution)
- Express 4 + `express-async-errors`
- Prisma ORM → MySQL (built against/tested on Aiven's managed MySQL; any
  MySQL 8+/MariaDB works via a connection string). Long-content columns
  (`processedHtml`, `originalUrl`, `userAgent`) use `@db.LongText`/`@db.Text`
  — MySQL's default `String` maps to `VARCHAR(191)`, which would silently
  truncate campaign HTML.
- `bcryptjs` — password hashing (12 salt rounds)
- `jose` — signs and verifies JWT access tokens
- `cheerio` — parses/rewrites campaign HTML
- `nanoid` — generates link/open tokens
- `cookie-parser`, `cors`

**Auth model**
- Named accounts (email + bcrypt-hashed password) — **not** a shared app
  password.
- **Access token**: short-lived JWT (HS256, 15 min), httpOnly cookie
  `mt_access`, path `/`. Stateless — verified on every protected request, no
  DB hit.
- **Refresh token**: opaque random value (30 days), httpOnly cookie
  `mt_refresh`, path `/api/auth` only. Stored **hashed** (SHA-256) in the DB,
  never in plaintext. **Rotates on every use.** Replaying an already-rotated
  (i.e. stolen/replayed) refresh token revokes **every** active session for
  that user — this is intentional theft detection, not a bug.

## Project structure

```
mail-tracker/
├── README.md                     ← you are here
├── backend/
│   ├── prisma/
│   │   └── schema.prisma         ← single source of truth for the DB shape
│   ├── src/
│   │   ├── app.ts                ← Express app factory (CORS, JSON body limit,
│   │   │                           cookie parser, route mounting, error handler)
│   │   ├── server.ts             ← entrypoint, loads .env, starts listening
│   │   ├── db.ts                 ← Prisma client singleton
│   │   ├── routes/
│   │   │   ├── auth.ts           ← login / refresh / logout / me / patch-me
│   │   │   ├── campaigns.ts      ← process (create), list, get, patch, delete, sent
│   │   │   └── track.ts          ← public pixel + click-redirect endpoints
│   │   ├── middleware/
│   │   │   └── auth.ts           ← `authenticate` — verifies mt_access, sets req.userId
│   │   ├── lib/
│   │   │   ├── tokens.ts         ← JWT + refresh-token issue/rotate/revoke logic
│   │   │   ├── cookies.ts        ← cookie names, set/clear helpers
│   │   │   ├── passwords.ts      ← bcrypt hash/verify
│   │   │   ├── transform.ts      ← HTML parsing: inject pixel, rewrite links
│   │   │   ├── stats.ts          ← raw-totals aggregation (no rate math)
│   │   │   └── query.ts          ← Prisma read helpers for campaign detail/list
│   │   └── scripts/
│   │       └── create-user.ts    ← CLI: create or reset a user's password
│   ├── scripts/test-transform.mjs← plain-Node unit test for lib/transform.ts
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── middleware.ts         ← route guard + silent token refresh
    │   ├── lib/
    │   │   ├── api.ts            ← client-side fetch wrapper (auto refresh+retry on 401)
    │   │   └── backend.ts        ← server-side fetch wrapper (forwards cookies for SSR)
    │   ├── components/           ← shared UI primitives (Card, Button, Field, PageHeader…)
    │   └── app/
    │       ├── login/            ← /login
    │       ├── profile/          ← /profile (change email/password)
    │       ├── campaigns/
    │       │   ├── new/          ← /campaigns/new (create)
    │       │   └── [id]/         ← /campaigns/:id (detail, edit, delete)
    │       ├── page.tsx          ← / (dashboard)
    │       └── SignOutButton.tsx
    ├── .env.example
    └── package.json
```

## Prerequisites

- Node.js ≥ 20 and npm
- A reachable MySQL 8+ (or MariaDB) database (Aiven, RDS, self-hosted —
  anything speaking the MySQL protocol)
- Two free local ports for dev: `3000` (frontend) and `4000` (backend)

## Required environment variables

Copy each service's `.env.example` to `.env` and fill it in. **No other env
vars exist in either service — don't invent new ones without updating this
README and the corresponding `CLAUDE.md`.**

### `backend/.env`

| Var | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `mysql://user:pass@host:port/db?ssl-mode=REQUIRED` | MySQL connection string. On Aiven, copy the **Service URI** shown on the service's Overview page — it's already in this exact format. |
| `PUBLIC_TRACK_BASE_URL` | `http://localhost:4000` (dev) / `https://api.illumiasolutions.com` (prod) | The backend's own public host. Baked directly into every tracked email's pixel and link URLs — **must be real, reachable HTTPS before any campaign HTML is actually sent to recipients.** |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | Frontend origin(s), comma-separated if more than one. Drives CORS for credentialed (cookie-carrying) requests. |
| `JWT_ACCESS_SECRET` | long random string | Signs access-token JWTs. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. **Must match the frontend's value exactly.** |
| `COOKIE_DOMAIN` | `""` (dev) / `.illumiasolutions.com` (prod) | See [Cookie domain](#cookie-domain--read-this-before-deploying). |
| `PORT` | `4000` | |
| `NODE_ENV` | `development` / `production` | Controls the cookie `Secure` flag — cookies won't set correctly over plain HTTP if this is `production`. |

### `frontend/.env`

| Var | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` (dev) / backend's real prod origin | Backend's base URL. Used server-side by `next.config.ts`'s `rewrites()` (proxies `/api/*` to this) and by `lib/backend.ts` for SSR fetches. Browser code never calls this directly — it fetches relative `/api/...` paths so the proxy can turn `Set-Cookie` into a first-party cookie; see [Cookie domain](#cookie-domain--read-this-before-deploying). |
| `JWT_ACCESS_SECRET` | same value as backend | **Must be byte-for-byte identical to the backend's.** Used only to verify (never sign) the access token for redirect UX in `middleware.ts` — the backend independently re-verifies every request regardless, so this middleware check is a UX optimization, not the real enforcement point. |

## Cookie domain — read this before deploying

Login sets two httpOnly cookies (`mt_access`, `mt_refresh`) on the
**backend's** response. The browser only ever sends cookies back to the
domain that set them, so the frontend needs a way to see a cookie the
backend issued. This repo handles that with a **same-domain proxy**, not
with a shared cookie domain — that's the default and recommended setup.

### Default / recommended: proxy through the frontend (unrelated domains OK)

`frontend/next.config.ts` rewrites every `/api/*` request on the frontend's
own domain through to the backend (`NEXT_PUBLIC_API_URL`):

```ts
// frontend/next.config.ts
async rewrites() {
  return [{ source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` }];
}
```

Because of this, **all browser-side code calls relative `/api/...` paths**
(see `frontend/src/lib/api.ts`), never the backend's origin directly. The
request leaves the browser for the frontend's own domain, Next.js proxies it
to the backend server-side, and the backend's `Set-Cookie` comes back
looking like a same-origin response to the browser — so it's stored as a
**first-party cookie on the frontend's domain**, and `frontend/src/middleware.ts`
(which reads cookies off its own incoming requests) can see the session.

This is what makes it fine to run, e.g., the **frontend on Vercel** and the
**backend on Render/Railway/a VPS** on two completely unrelated domains —
the exact setup this app is built for in production. With this proxy in
place:

- `COOKIE_DOMAIN` stays `""` (host-only) in **both** local dev and
  production — you almost never need to set it.
- `FRONTEND_ORIGIN` on the backend still matters for CORS on any
  non-proxied/credentialed call, but the cookie itself no longer depends on
  CORS or `SameSite` working across origins.
- Don't try to "fix" cross-domain auth by loosening `SameSite` to `None` on
  the backend's cookies — that was tried, doesn't solve the real problem (a
  cross-site `Set-Cookie` is invisible to the frontend's own server-side
  cookie reads no matter what `SameSite`/CORS says), and was reverted. Keep
  the proxy.
- Server Components / Server Actions (`frontend/src/lib/backend.ts`) talk to
  the backend's real origin directly and forward the incoming request's
  cookies by hand — they don't go through the rewrite, but they don't need
  to, since they run on the frontend's own server, not in the browser.

### Alternative: shared parent domain, no proxy needed

If you'd rather put both services on **subdomains of one domain** — e.g.
`app.illumiasolutions.com` (frontend) + `api.illumiasolutions.com`
(backend) — you can skip the proxy story entirely: set
`COOKIE_DOMAIN=".illumiasolutions.com"` on the backend, and the cookie is
readable on both subdomains directly (they're same-site, so plain
`SameSite=Lax` works). `NEXT_PUBLIC_API_URL` can then point straight at the
backend's origin. This repo doesn't require this setup, but it works too.

**Local dev** either way: backend on `localhost:4000`, frontend on
`localhost:3000` — same host, different ports, cookies aren't port-scoped —
leave `COOKIE_DOMAIN=""` and it just works, proxy or no proxy.

## Running locally

```bash
# terminal 1 — backend
cd backend
npm install
cp .env.example .env              # then fill in DATABASE_URL etc.
npx prisma db push                # creates/updates tables from schema.prisma
npm run create-user -- --email you@example.com --password "a strong password"
npm run dev                       # http://localhost:4000

# terminal 2 — frontend
cd frontend
npm install
cp .env.example .env              # NEXT_PUBLIC_API_URL + JWT_ACCESS_SECRET
npm run dev                       # http://localhost:3000
```

Visit `http://localhost:3000` → you'll be redirected to `/login` → sign in
with the account you just created. From there: **New campaign** to
paste/upload HTML and get back tracked HTML + a download button, click into
any campaign card to see its stats, edit its name/HTML, or delete it, and
**Profile** (top right) to change your own email/password.

> **Windows note**: if you ever run `npm run build` in `frontend/` while
> `npm run dev` is *also* running against the same directory, it can corrupt
> the dev server's `.next` build cache and you'll see intermittent 503s /
> `ChunkLoadError` on navigation that look like an app bug but aren't. Fix:
> stop the dev server, delete `frontend/.next`, restart `npm run dev`. See
> [Troubleshooting](#troubleshooting).

## Creating a user account

There is **no self-registration and no in-app user-management UI** — this
was a deliberate scope decision (small internal team). The only way to
create or reset an account is the backend's CLI script.

**Step-by-step, from a clean checkout:**

```bash
cd backend
npm install                        # installs deps, also runs `prisma generate`
```

Make sure `backend/.env` exists and `DATABASE_URL` points at your MySQL
instance (see [Required environment variables](#required-environment-variables)
— on Aiven, paste the **Service URI** from the service's Overview page
exactly as shown, including `?ssl-mode=REQUIRED`). If `.env` doesn't exist
yet:

```bash
cp .env.example .env
# then edit .env and fill in DATABASE_URL (and the other vars) with a text editor
```

Push the schema so the tables actually exist in that database (safe to
re-run any time — it's idempotent, only applies what's missing/changed):

```bash
npx prisma db push
```

Now create the account:

```bash
npm run create-user -- --email you@illumiasolutions.com --password "a strong password"
```

- Password must be **at least 8 characters** — the script rejects anything
  shorter.
- Email is lowercased/trimmed automatically.
- Running it again with an **existing** email resets that account's
  password (it's an upsert — create if new, update the password hash if the
  email already exists). It does **not** touch the account's `id`,
  campaigns, or anything else.
- On success it prints `User ready: <email> (id: <id>)`.

Internally this hashes the password with `bcryptjs` (12 salt rounds) and
writes straight to the `User` table via Prisma — there's no separate
"insert hashed password into SQL by hand" step needed, the script does both
the hashing and the insert for you.

**Then start the backend and log in** (see [Running locally](#running-locally)
for the full two-terminal setup) — visit the frontend, you'll land on
`/login`, sign in with the email/password you just created.

## Disabling / removing a user account

There's no `is_active` flag in this schema (unlike a system with a soft-
disable column) — accounts are simply present or absent. To remove access:

```bash
cd backend
npx prisma studio
```

Open the `User` table and delete the row, **or** run the following one-off
via `node` from inside `backend/` (this also cascades and revokes every
refresh token that account has issued, so existing sessions die too):

```js
// backend/  — run with: node -e "..."  or drop into a throwaway .mjs file
import { prisma } from "./src/db.js";
await prisma.user.delete({ where: { email: "someone@illumiasolutions.com" } });
await prisma.$disconnect();
```

To force a re-login without deleting the account (e.g. suspected token
theft), it's simpler to just reset the password with `create-user` again —
that doesn't revoke existing sessions by itself, but changing the password
via the **Profile** page in the UI *does* revoke every other session
automatically (see `PATCH /api/auth/me` in the [API reference](#api-reference)).

## API reference

All routes are mounted on the backend (`http://localhost:4000` in dev). Auth
uses the `mt_access` / `mt_refresh` httpOnly cookies — there's no API-key or
bearer-token mode.

### Public (no auth — recipients' mail clients hit these directly)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/healthz` | Liveness check. Returns 200 if the process is up. |
| `GET` | `/api/track/open/:openToken` | 1×1 transparent GIF. Logs an `OpenEvent`. Always returns the pixel, even on an unknown token or DB error — never breaks the recipient's rendered email. |
| `GET` | `/api/track/click/:linkToken?u=<encoded original URL>` | 302 redirect to the original link. Logs a `ClickEvent` if the token is known. Falls back to the `u=` query param (validated to be `http`/`https` only) if the token is unknown/regenerated, so old emails never dead-end — see the security note in [Security notes](#security-notes) about this fallback. |

### Auth

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/login` | — | `{ email, password }` → sets `mt_access` + `mt_refresh` cookies, returns `{ ok, user: { id, email } }`. 401 on bad credentials. |
| `POST` | `/api/auth/refresh` | refresh cookie | Rotates the refresh token, issues a new access token, sets fresh cookies. 401 (and clears cookies) if the refresh token is invalid, expired, or was already used (reuse ⇒ every session for that user is revoked). |
| `POST` | `/api/auth/logout` | access cookie | Revokes the current refresh token, clears both cookies. |
| `GET` | `/api/auth/me` | access cookie | Returns `{ id, email }` for the current session. |
| `PATCH` | `/api/auth/me` | access cookie | `{ currentPassword, email?, newPassword? }` — changes email and/or password. `currentPassword` is always required and re-verified against the stored hash. On a password change, every *other* refresh token for that user is revoked (all other devices/sessions signed out) while the current session gets a fresh token pair. |

### Campaigns (all require the access cookie)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/process` | `{ name, html, sentCount? }` → injects the tracking pixel, rewrites every `<a href>` (skips `mailto:`, `tel:`, `#`, relative URLs, and anything with `data-no-track`), creates the `Campaign` + `Link` rows. Returns `{ id, processedHtml, linkCount }`. |
| `GET` | `/api/campaigns` | Lists all campaigns, newest first, with `_count.{opens,clicks,links}`. |
| `GET` | `/api/campaigns/:id` | Full detail: stats, per-link click breakdown, stored `processedHtml`. 404 if not found. |
| `PATCH` | `/api/campaigns/:id` | `{ name?, html? }`. Renaming just updates the name. Replacing `html` keeps the same open-pixel token (open history stays valid) but **deletes and recreates every `Link`**, which cascades away that campaign's click history and issues new link tokens. |
| `DELETE` | `/api/campaigns/:id` | Deletes the campaign and cascades every link, open, and click logged against it. Irreversible. |
| `POST` | `/api/campaigns/:id/sent` | `{ sentCount }` — manually record how many emails Carbonio actually sent (this app has no visibility into Carbonio's send count itself). |

## Database schema

Defined in `backend/prisma/schema.prisma`, applied with `prisma db push`
(no migration history — appropriate at this size; **always check the diff
output before confirming a push against production**, since `db push` can
silently drop columns/tables that no longer exist in the schema file).

| Model | Key fields | Notes |
|---|---|---|
| `Campaign` | `id`, `name`, `openToken` (unique), `sentCount`, `createdAt`, `processedHtml` | One row per campaign. `processedHtml` stores the full tracked HTML so it can be re-downloaded later. |
| `Link` | `id`, `token` (unique), `originalUrl`, `label`, `campaignId` | One row per rewritten link in a campaign. Deleted/recreated on HTML replace. |
| `OpenEvent` | `id`, `campaignId`, `recipientRef?`, `ip?`, `userAgent?`, `createdAt` | One row per pixel hit. No dedup — every hit is logged. |
| `ClickEvent` | `id`, `linkId`, `campaignId`, `recipientRef?`, `ip?`, `userAgent?`, `createdAt` | One row per link click. No dedup. |
| `User` | `id`, `email` (unique), `passwordHash`, `createdAt` | Operator accounts. Created only via `create-user`. |
| `RefreshToken` | `id`, `userId`, `tokenHash` (unique), `expiresAt`, `revokedAt?`, `replacedByTokenId?`, `userAgent?`, `ip?` | The raw refresh token is never stored — only its SHA-256 hash. |

All child rows cascade-delete with their parent (`Campaign` → `Link` /
`OpenEvent` / `ClickEvent`; `Link` → `ClickEvent`; `User` → `RefreshToken`).

## Prisma workflow

`backend/prisma/schema.prisma` is the **single source of truth** for the
database shape — don't hand-edit tables in MySQL, don't add columns via a
raw `ALTER TABLE`. Change the schema file, then push it.

### The core loop

```bash
cd backend
# 1. edit backend/prisma/schema.prisma
# 2. push the new shape to whatever DATABASE_URL points at
npx prisma db push
# (equivalent: npm run db:push)
```

`db push` **introspects the live database, diffs it against the schema
file, and applies the difference** — it creates new tables/columns, alters
changed ones, and (this is the part to watch) **drops** columns/tables that
exist in the DB but no longer exist in the schema. Prisma prints the exact
diff and asks for confirmation before applying anything destructive — always
read that diff, especially against a production database. There's no
migration history file in this repo (no `prisma/migrations/`) — that's a
deliberate choice at this project's size, not an oversight, so there's
nothing to "roll back to" if a push goes wrong. Take a DB snapshot/backup
before pushing a schema change you're unsure about in production.

### Prisma Client — keep it in sync after every schema change

Editing `schema.prisma` changes the *shape* of the database, but the
generated TypeScript types/client (`@prisma/client`) only update when you
regenerate them:

```bash
npx prisma generate
```

You rarely need to run this by hand — it's wired into `postinstall`
(`npm install` runs it automatically) and `npm run build` triggers it
transitively via that same `postinstall`. You **do** need to run it by hand
if you edit `schema.prisma` and immediately try to use the new field from a
running `npm run dev` session without reinstalling — restart `tsx watch`
after running `npx prisma generate` so the new types actually load. The
single Prisma client instance for the whole backend lives in `src/db.ts`
(`backend/src/db.ts`) — import `prisma` from there, never instantiate
`new PrismaClient()` anywhere else (each instance opens its own connection
pool).

### Inspecting/editing data directly — Prisma Studio

```bash
cd backend
npx prisma studio
```

Opens a local web GUI (`http://localhost:5555`) against whatever
`DATABASE_URL` your `.env` currently points at — browse/edit/delete rows in
any table without writing SQL. This is genuinely useful for one-off admin
tasks (see [Disabling / removing a user account](#disabling--removing-a-user-account)
for a concrete example), but it talks to the **real** database `.env`
points at, prod included if that's what's configured — double-check which
`DATABASE_URL` is active before deleting anything.

### Gotchas specific to this project

- **`@db.LongText` / `@db.Text` annotations are load-bearing.** MySQL's
  default Prisma `String` maps to `VARCHAR(191)`. `Campaign.processedHtml`,
  `Link.originalUrl`, and the `userAgent` fields are annotated
  `@db.LongText`/`@db.Text` specifically so a full HTML email or a long URL
  doesn't get silently truncated on insert. Don't remove these annotations
  when touching the schema.
- **Cascades are defined in the schema, not assumed.** `Campaign → Link /
  OpenEvent / ClickEvent`, `Link → ClickEvent`, and `User → RefreshToken`
  all use `onDelete: Cascade` — deleting a `Campaign` really does wipe every
  associated link/open/click row, and it's irreversible (see the
  [API reference](#api-reference) note on `DELETE /api/campaigns/:id`).
- **Unique tokens are enforced at the DB level.** `Campaign.openToken` and
  `Link.token` are `@unique` — token collisions from `nanoid` fail at the
  database, not silently.
- **New required column?** `db push` will refuse (or prompt to reset data)
  if you add a non-nullable column to a table that already has rows and
  don't give it a `@default(...)`. Either add a default or make the field
  optional (`Type?`) when adding a column to a table you expect already has
  production data — this repo does this for e.g. `sentCount Int @default(0)`.
- **Connection string SSL mode matters.** Aiven (and most managed MySQL)
  require `?ssl-mode=REQUIRED` in `DATABASE_URL` — omitting it is a common
  cause of a `db push` or app-boot connection failure that has nothing to do
  with the schema itself.

## Scripts reference

**`backend/`**

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API with hot-reload (`tsx watch src/server.ts`), `http://localhost:4000`. |
| `npm run build` | Compiles TypeScript to `dist/` (`tsc`). Runs `prisma generate` automatically first via `postinstall`. |
| `npm start` | Runs the compiled build: `node dist/server.js`. Use in production. |
| `npm run create-user -- --email <e> --password <p>` | Create or reset a user's password. |
| `npm run db:push` | Pushes `prisma/schema.prisma` to the database (create/alter tables). |
| `npm test` | Runs `scripts/test-transform.mjs` — unit tests for the HTML pixel-injection/link-rewrite logic. No DB needed. |

**`frontend/`**

| Command | What it does |
|---|---|
| `npm run dev` | Starts Next.js dev server, `http://localhost:3000`. |
| `npm run build` | Production build. **Never run this while `npm run dev` is active in the same directory** — see [Troubleshooting](#troubleshooting). |
| `npm start` | Serves the production build. Use in production, after `npm run build`. |
| `npm run lint` | ESLint. |

## Running in production

The two services deploy independently and don't need to share a host,
platform, or domain — see [Cookie domain](#cookie-domain--read-this-before-deploying)
for why unrelated domains are fine. The setup below (Vercel for the
frontend, any persistent-Node host for the backend) is what this app is
built for; swap the backend host for whatever you actually use, the steps
don't change.

### Backend — needs a persistent Node process

Next.js's serverless model doesn't apply here: the backend is a long-lived
Express server (it also owns the Prisma connection pool), so it needs a host
that keeps a Node **process** alive — Render, Railway, Fly.io, a plain VPS
with `pm2`/`systemd`, or Docker. Static/serverless-only hosting won't work
for this service.

```bash
cd backend
npm ci
npm run build              # runs `prisma generate` first (postinstall), then tsc → dist/
npx prisma db push         # apply schema.prisma to the production DATABASE_URL — read the diff before confirming
npm run create-user -- --email you@illumiasolutions.com --password "..."   # first deploy only, creates the first login
npm start                  # node dist/server.js
```

Set every var from [`backend/.env`](#backendenv) in the host's environment/secret
config — real `DATABASE_URL`, `PUBLIC_TRACK_BASE_URL` set to the backend's
own real HTTPS domain, `FRONTEND_ORIGIN` set to the frontend's real HTTPS
domain, a strong `JWT_ACCESS_SECRET`, `NODE_ENV=production` (this flips
cookies to `Secure`, so it must be set correctly), `COOKIE_DOMAIN=""` unless
you're on the shared-parent-domain setup.

### Frontend — deploy to Vercel

```bash
cd frontend
npm ci
npm run build
npm start          # or let the platform run this for you
```

On Vercel specifically: point a Vercel project at `frontend/` (set its
**root directory** to `frontend` since the repo root has no `package.json`),
let it run its default `next build` / `next start` — no custom build command
needed. Set `NEXT_PUBLIC_API_URL` (backend's real origin) and
`JWT_ACCESS_SECRET` (same value as the backend's) as **Environment
Variables** in the Vercel project settings for the Production environment.
The `rewrites()` proxy in `next.config.ts` reads `NEXT_PUBLIC_API_URL` at
request time, so it automatically proxies `/api/*` to whatever backend host
you set there — no extra Vercel config (no `vercel.json` needed for this).

Any other Next.js-capable host works the same way — it just needs to run
`next build && next start` (or the platform's equivalent) with the same two
env vars set.

## Post-deploy checklist

1. Backend env vars set: `DATABASE_URL`, `PUBLIC_TRACK_BASE_URL` (backend's
   real HTTPS domain), `FRONTEND_ORIGIN` (frontend's real HTTPS domain),
   `JWT_ACCESS_SECRET`, `COOKIE_DOMAIN` (leave `""` unless frontend/backend
   share a parent domain — see [Cookie domain](#cookie-domain--read-this-before-deploying)),
   `NODE_ENV=production`.
2. Frontend env vars set: `NEXT_PUBLIC_API_URL` (backend's real domain),
   `JWT_ACCESS_SECRET` (**exact same value** as the backend's).
3. `npx prisma db push` run against the production `DATABASE_URL`.
4. At least one user created via `npm run create-user`.
5. Visit the frontend domain → redirects to `/login` → sign-in works →
   session persists across a page reload.
6. Create a real test campaign and confirm the tracked HTML's pixel/link
   URLs point at the **backend's real production domain**, not
   `localhost` — check this before pasting anything into Carbonio and
   sending to real recipients.
7. Confirm `{backend}/api/track/open/*` and `{backend}/api/track/click/*`
   are reachable **without** authentication and **without** any IP
   allowlist — mail clients hit these directly and won't have a login
   cookie or a known IP. They already skip the `authenticate` middleware by
   design; don't add auth or IP restrictions to them.
8. Confirm HTTPS is actually terminated in front of both services — cookies
   are marked `Secure` when `NODE_ENV=production`, so they silently won't
   be set over plain HTTP.

## Troubleshooting

**Login seems to hang on "Signing in…" / dashboard won't load / random 503s
after a deploy or during local dev.**
Almost always a stale/corrupted Next.js `.next` build cache, most commonly
caused by running `npm run build` in `frontend/` while `npm run dev` is
already running there — both processes write to `.next` and can corrupt
each other's webpack chunk manifest. Fix:
```bash
cd frontend
# stop the dev server first
rm -rf .next
npm run dev
```
This is a dev-tooling artifact, not an application bug — the login/session
code itself doesn't touch `.next`.

**`401 Unauthorized` on every campaign/API call from the frontend.**
Check that `JWT_ACCESS_SECRET` is byte-for-byte identical in both
`backend/.env` and `frontend/.env`. A mismatch makes the frontend's
middleware and/or the backend's `authenticate` middleware reject a
perfectly valid token.

**Cookies never seem to get set / session doesn't persist.**
Re-read [Cookie domain](#cookie-domain--read-this-before-deploying). Almost
always one of: the frontend's `next.config.ts` `rewrites()` isn't actually
proxying `/api/*` (check `NEXT_PUBLIC_API_URL` is set at build/runtime on
the frontend), some browser-side code is calling the backend's origin
directly instead of a relative `/api/...` path, or `NODE_ENV` isn't
`production` on the backend so `Secure` cookies silently fail to set over
plain HTTP.

**CORS errors in the browser console.**
`FRONTEND_ORIGIN` on the backend must exactly match the frontend's actual
origin (scheme + host + port), comma-separated if there's more than one.
`credentials: true` CORS never works with a wildcard `*` origin — that's
enforced by browsers, not a bug here.

**`prisma db push` wants to drop a column/table you didn't expect.**
That means `schema.prisma` and the live database have diverged (someone
edited the DB directly, or an old field was removed from the schema without
a corresponding cleanup). Read the diff Prisma prints carefully before
confirming — there's no migration history to roll back to.

**Relative-import errors when editing backend TypeScript
(`Cannot find module '../db'`).**
The backend uses `NodeNext` module resolution — every relative import needs
an explicit `.js` extension even though the source file is `.ts`, e.g.
`import { prisma } from "../db.js"` for a file named `db.ts`. This is
required by the ESM/NodeNext setup, not a typo.

## Why no rates?

Earlier iterations of this app computed "unique opens," "unique clicks,"
open rate, and click-through rate. That was deliberately removed. One
identical HTML blob gets pasted into Carbonio and sent to every recipient
in a campaign — there's no per-recipient identifier baked in, so
"unique open" can only ever be an approximation (IP+User-Agent
fingerprinting, which collides constantly on shared networks/browsers), and
a computed percentage on top of an approximation reads as far more precise
than the underlying data actually supports. The dashboard now shows **raw
totals only**: total opens, total clicks per link, total clicks overall,
and the manually-entered send count. Nothing here is deduplicated or
rate-computed, on purpose.

## Security notes

- **No self-registration, no in-app user admin.** Accounts exist only via
  `npm run create-user`, run by whoever has server/DB access. This is a
  small, trusted, internal tool — treat `DATABASE_URL` and
  `JWT_ACCESS_SECRET` as the real secrets they are.
- **Refresh-token reuse detection**: presenting an already-rotated (i.e.
  replayed/stolen) `mt_refresh` cookie immediately revokes *every* active
  session for that user, forcing a fresh login everywhere. This is
  intentional and will look alarming the first time you trigger it by
  accident (e.g. two tabs racing a refresh) — don't "fix" it into silently
  accepting reuse.
- **Click-redirect open-fallback**: `GET /api/track/click/:token?u=<url>`
  redirects to the stored link if the token is known, but falls back to the
  `u=` query parameter (validated as `http`/`https` only, no
  `javascript:`/`data:`) if the token is unknown — e.g. after a campaign's
  HTML has been replaced and its old link tokens regenerated. This keeps
  old, already-sent emails from ever dead-ending on a broken link, but it
  does mean `u=` is technically attacker-suppliable and such a click won't
  be logged/counted. It's a mild open-redirect surface scoped to this
  domain's tracking route — low risk for an internal tool, but worth
  knowing it's there by design if you're doing a security review.
- **Tracking endpoints are intentionally public.** `/api/track/open/*` and
  `/api/track/click/*` must never be put behind auth or an IP allowlist —
  see the [post-deploy checklist](#post-deploy-checklist).

## Operational notes

- No file storage/uploads — everything (processed HTML, stats, accounts)
  lives in MySQL. No S3/blob storage dependency.
- No background jobs, queues, or cron — all work happens synchronously on
  request.
- No plain-text email path — only HTML campaigns are supported, by design.
- `sentCount` is entered manually in the UI; neither service has visibility
  into Carbonio's actual send count, so totals are only as accurate as that
  manually-entered number.
- Database migrations use `prisma db push`, not `prisma migrate` — there is
  no migration history file. Fine at this project's size; just always
  review the diff Prisma prints before confirming against production.
