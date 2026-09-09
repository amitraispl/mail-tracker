# CLAUDE.md — Mail Tracker (backend)

Project context for every Claude Code session in this directory. **Read before editing.**

## What this is
The **API + data + auth** half of Mail Tracker — a Node + TypeScript + Express
service backing the sibling **`../frontend`** Next.js UI. Owns the MySQL DB
(Prisma), the tracking pixel/redirect endpoints recipients hit directly, campaign
CRUD, and JWT-based auth. The frontend has zero DB access — everything goes through
this service's HTTP API.

## Stack
- Node ≥20, TypeScript (ESM, `NodeNext` module resolution — relative imports need
  `.js` extensions even though the source files are `.ts`), Express 4.
- Prisma ORM → MySQL (built for/tested on Aiven's managed MySQL; any MySQL
  8+/MariaDB works via `DATABASE_URL`). Long-content fields (`processedHtml`,
  `originalUrl`, `userAgent`) use `@db.LongText`/`@db.Text` in schema.prisma —
  MySQL's default `String` is `VARCHAR(191)` and would silently truncate
  campaign HTML otherwise. Don't remove those annotations.
- `cheerio` for HTML parsing, `nanoid` for tokens (in `src/lib/transform.ts`).
- `bcryptjs` for password hashing, `jose` for JWT, raw `crypto` for opaque refresh
  tokens.
- Dev: `tsx watch`. Build: `tsc`. No test framework beyond
  `scripts/test-transform.mjs` (plain Node, run via `npm test`).

## CRITICAL rules
- **No `APP_PASSWORD`, ever.** Auth is per-user, bcrypt-hashed, DB-backed. See "Auth
  model" below.
- **Accounts are created only via `npm run create-user`** (see root `README.md` for
  the exact command). No self-registration route, no in-app user-management UI —
  that was an explicit scope decision, don't add one without being asked.
- Relative imports between `src/**` files need a `.js` extension (NodeNext ESM
  resolution resolves against the *compiled* output, not the `.ts` source) — e.g.
  `import { prisma } from "../db.js"` even though the file is `db.ts`.
- Never invent env vars beyond the ones in `.env.example`.

## Data model (Prisma — `prisma/schema.prisma`)
- `Campaign(id, name, openToken @unique, sentCount, createdAt, processedHtml?)` → links[], opens[], clicks[]
- `Link(id, token @unique, originalUrl, label?, campaignId)` → campaign, clicks[] — each link has its own token
- `OpenEvent`/`ClickEvent(id, campaignId, recipientRef?, ip?, userAgent?, createdAt)` — every hit logged, no dedup
- `User(id, email @unique, passwordHash, createdAt)` → refreshTokens[]
- `RefreshToken(id, userId, tokenHash @unique, expiresAt, revokedAt?, replacedByTokenId?, userAgent?, ip?)`
  — the raw refresh token is **never stored**, only its SHA-256 hash.

Schema changes: `npm run db:push` (no migration history — this app's size doesn't
warrant it; check the diff output before confirming on prod, a push can drop
columns).

## Stats — no rates, ever
`lib/stats.ts` / `lib/query.ts` return raw totals only: `{ sent, rawOpens,
totalClicks }` and per-link `{ totalClicks }`. **No unique/dedup counting, no
%-based CTR/open-rate math anywhere.** This was a deliberate product call (one
shared HTML blob sent to every recipient makes both unique-actor attribution and
%-based rates read as more precise than the data supports) — don't reintroduce rate
math without being asked. `rawOpens` is the unmodified `OpenEvent` count — the
send-load noise correction (subtracting `sent`) happens client-side
(`frontend/src/lib/stats.ts`), not here, so a `sentCount` edit is reflected on
next render without this response's shape changing.

## Auth model
Named accounts, bcrypt-hashed passwords (`lib/passwords.ts`). Two-token session:
- **Access token** — JWT (HS256, `JWT_ACCESS_SECRET`), 15 min, httpOnly cookie
  `mt_access`, `Path=/`. Stateless — verified in `middleware/auth.ts` on every
  protected route, no DB hit.
- **Refresh token** — opaque random value, 30 days, httpOnly cookie `mt_refresh`,
  `Path=/api/auth` (never sent on ordinary API calls). Stored **hashed** in
  `RefreshToken`. **Rotates on every use** (`lib/tokens.ts`
  `rotateRefreshToken`) — the old row is marked `revokedAt` and links to its
  replacement via `replacedByTokenId`. Presenting an already-revoked token (a
  replayed/stolen cookie) revokes **every** active session for that user — see
  `checkRefreshToken`'s `"reused"` branch. This is intentional theft-detection, not
  a bug: don't "fix" it into silently accepting reuse.
- Routes: `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`,
  `GET /api/auth/me` (`routes/auth.ts`).
- `authenticate` middleware (`middleware/auth.ts`) gates `/api/campaigns/**` and
  `/api/process` — `/api/auth/**` and `/api/track/**` stay public.

## URL / API contracts
- Pixel: `GET /api/track/open/{openToken}?r={recipientId?}` → 1×1 gif, no-store; logs OpenEvent. Public.
- Click: `GET /api/track/click/{linkToken}?u={encodedOriginal}&r={recipientId?}` → 302 (fallback `u=` only if token unknown); logs ClickEvent. Public.
- `POST /api/process {name, html, sentCount}` → `{ id, processedHtml, linkCount }`. Auth required.
- `GET /api/campaigns` → newest-first, `_count {opens,clicks,links}`. Auth required.
- `GET /api/campaigns/{id}` → `CampaignDetail` or 404. Auth required.
- `PATCH /api/campaigns/{id} {name?, html?}` → `{ ok, linkCount }`. `html` keeps the
  same `openToken` (pixel URL stays valid) but wipes that campaign's `OpenEvent`s,
  and deletes+recreates every `Link`, cascading away its `ClickEvent`s — an HTML
  replace is treated as a fresh send. Auth required.
- `DELETE /api/campaigns/{id}` → `{ ok }`. Cascades everything. Auth required.
- `POST /api/campaigns/{id}/sent {sentCount}` → `{ ok }`. Auth required.

Rewritten link href = `${PUBLIC_TRACK_BASE_URL}/api/track/click/${token}?u=${encodeURIComponent(originalHref)}`.
Pixel `<img>` appended before `</body>`, hidden, 1×1. Skip `mailto:`/`tel:`/`#`/relative/`data-no-track`.

## CORS / cookies
`FRONTEND_ORIGIN` drives CORS (`credentials: true`, explicit origin — never `*`
with credentials) — mainly a safety net now; see below. `COOKIE_DOMAIN` controls
cookie scope: empty = host-only, always `SameSite=Lax`.

Current prod (Vercel frontend + Render backend, unrelated domains, no shared
parent): the frontend does **not** call this backend's origin directly from the
browser for anything cookie-authenticated. Instead `frontend/next.config.ts`
`rewrites()` proxies `/api/*` through the frontend's own domain, so Set-Cookie
always lands as a first-party cookie there — this is what lets
`frontend/src/middleware.ts` (which reads cookies from *its own* incoming
requests) ever see the session. A cross-site `Set-Cookie` is invisible to that
middleware no matter what `SameSite`/CORS is set to — that's not a config knob,
it's how browsers partition cookies by domain. Don't try to "fix" this by
loosening `SameSite` to `none` again; it doesn't solve the actual problem and
was tried and reverted (see git history if this comes up again).

If frontend and backend are ever put on subdomains of the same parent domain
instead (e.g. `app.illumiasolutions.com` + `api.illumiasolutions.com`), the
browser-direct approach becomes viable again and `COOKIE_DOMAIN` can be set to
the shared parent (`.illumiasolutions.com`) so the cookie is readable on both.

## Environment
See `.env.example` for the full list with explanations: `DATABASE_URL`,
`PUBLIC_TRACK_BASE_URL`, `FRONTEND_ORIGIN`, `JWT_ACCESS_SECRET`, `COOKIE_DOMAIN`,
`PORT`, `NODE_ENV`. Also `MARIADB_ROOT_PASSWORD`/`MARIADB_DATABASE`/`MARIADB_USER`/
`MARIADB_PASSWORD` — these four are consumed only by the bundled `mysql`
service in the root `docker-compose.yml` to initialize the MariaDB container;
this app's own code never reads them, only `DATABASE_URL`.
