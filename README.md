# Mail Tracker

Self-hosted app that tracks **total opens** and **per-link click counts** for HTML
emails sent from Carbonio. User pastes/uploads HTML, the backend injects a tracking
pixel + rewrites links, user pastes the tracked HTML back into Carbonio, opens and
clicks log to Postgres, the dashboard shows raw totals (no rate/percentage math —
one shared HTML blob per campaign makes that read as more precise than it is).

Two services, two directories:

```
mail-tracker/
  frontend/   Next.js 15 UI. No DB access, no secrets beyond a JWT verify key.
  backend/    Node + Express + Prisma API. Owns the DB, the tracking endpoints,
              and auth (JWT access token + rotating refresh token).
```

Root has no `package.json` — always run commands from `frontend/` or `backend/`.

## Stack
- **Frontend**: Next.js 15 (App Router, TypeScript, React 19), `jose` for JWT
  verification in middleware.
- **Backend**: Node ≥20, TypeScript, Express, Prisma → Postgres (built for Neon,
  any Postgres works — just a connection string), `bcryptjs` for password hashing,
  `jose` for JWT.
- **Auth**: named accounts (email + bcrypt-hashed password), not a shared password.
  Access token = short-lived JWT in an httpOnly cookie (15 min). Refresh token =
  opaque random value in a separate httpOnly cookie (30 days), stored **hashed** in
  the DB, **rotated on every use** — replaying an already-rotated token revokes
  every session for that user (theft detection).

## Required environment variables

**`backend/.env`** (template at `backend/.env.example`):

| Var | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` | Postgres connection string (Neon: use the **pooled** string). |
| `PUBLIC_TRACK_BASE_URL` | `https://api.illumiasolutions.com` | The backend's own public host — baked into every tracked email's pixel/link URLs. Must be real HTTPS before any email is sent. |
| `FRONTEND_ORIGIN` | `https://app.illumiasolutions.com` | Frontend's origin(s), comma-separated if more than one. Drives CORS for credentialed requests. |
| `JWT_ACCESS_SECRET` | (long random string) | Signs access-token JWTs. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `COOKIE_DOMAIN` | `.illumiasolutions.com` (prod) / empty (local dev) | See "Cookie domain" below. |
| `PORT` | `4000` | |
| `NODE_ENV` | `production` | Controls `Secure` cookie flag. |

**`frontend/.env`** (template at `frontend/.env.example`):

| Var | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.illumiasolutions.com` | Backend's public base URL. Exposed to the browser — client components call it directly. |
| `JWT_ACCESS_SECRET` | (same value as backend's) | **Must match the backend exactly.** Used only to verify (never sign) the access token, for redirect UX in `middleware.ts` — the backend is still the real enforcement point. |

No other env vars in either service — don't invent any.

## Cookie domain — read this before deploying

Login sets two httpOnly cookies (`mt_access`, `mt_refresh`) on the **backend's**
response. For the frontend's own server-side requests and the browser's direct
calls to the backend to both see them, frontend and backend need to share a
registrable domain:

- **Local dev**: backend on `localhost:4000`, frontend on `localhost:3000` — same
  host (`localhost`), different ports. Cookies aren't port-scoped, so leave
  `COOKIE_DOMAIN` empty and it just works.
- **Production**: use two **subdomains of one domain** — e.g.
  `app.illumiasolutions.com` (frontend) + `api.illumiasolutions.com` (backend) —
  and set `COOKIE_DOMAIN=".illumiasolutions.com"`. Subdomains of the same domain
  are "same-site", so `SameSite=Lax` cookies work across them with no CORS-cookie
  drama.
- **Avoid** putting frontend and backend on two *unrelated* top-level domains
  (`mailtracker.app` + `mailtracker-api.io`) — that's genuinely cross-site, forces
  `SameSite=None`, and some browsers (Safari by default, Chrome incrementally)
  block that kind of third-party cookie outright. Don't fight this; use subdomains.

## Creating a user account

There is **no self-registration and no in-app user-management UI** — that was a
deliberate scope decision (single small team, internal tool). The only way to
create or reset an account is the backend's CLI script:

```bash
cd backend
npm run create-user -- --email you@illumiasolutions.com --password "a strong password"
```

Run it again with the same email to reset that account's password. Requires
`DATABASE_URL` to be set (reads `backend/.env`).

## Local dev

```bash
# terminal 1 — backend
cd backend
npm install
npx prisma db push        # first run + any schema change
npm run create-user -- --email you@example.com --password "a strong password"
npm run dev                # http://localhost:4000

# terminal 2 — frontend
cd frontend
npm install
npm run dev                # http://localhost:3000
```

Visit `http://localhost:3000` → redirects to `/login` → sign in with the account
you created.

- `npm run lint` (frontend) — eslint.
- `npm test` (backend) — runs `scripts/test-transform.mjs`, a unit test for the
  HTML transform logic (no DB needed).
- `npm run build` in either dir builds it; backend also needs `npm start` (runs
  compiled `dist/server.js`) vs frontend's `next start`.
- No DB migration history (`prisma db push`, not `migrate`) — fine at this size;
  check the diff output before confirming on prod, a push can drop columns.

## Deploying

Both services need a persistent Node process (not static hosting). Point a reverse
proxy (nginx/Caddy) or your PaaS's routing at each:

- `api.yourdomain.com` → `backend` (`npm start`, respects `PORT`)
- `app.yourdomain.com` → `frontend` (`npm start`, respects `PORT`)

**Backend**
```bash
cd backend
npm ci
npm run build     # runs `prisma generate` via postinstall, then tsc
npx prisma db push
npm run create-user -- --email you@example.com --password "..."   # first deploy only
npm start
```

**Frontend**
```bash
cd frontend
npm ci
npm run build
npm start
```

Run each persistently (pm2/systemd/your PaaS's process manager) — same pattern
either way, just two processes instead of one.

## Post-deploy checklist
1. Backend env vars set (`DATABASE_URL`, `PUBLIC_TRACK_BASE_URL` = backend's real
   HTTPS domain, `FRONTEND_ORIGIN` = frontend's real HTTPS domain,
   `JWT_ACCESS_SECRET`, `COOKIE_DOMAIN` = shared parent domain, `NODE_ENV=production`).
2. Frontend env vars set (`NEXT_PUBLIC_API_URL` = backend's real domain,
   `JWT_ACCESS_SECRET` = **exact same value** as the backend's).
3. `npx prisma db push` run against the production `DATABASE_URL`.
4. At least one user created via `npm run create-user`.
5. Visit the frontend domain → redirects to `/login` → sign in works, session
   persists across a reload.
6. Create a test campaign, confirm the tracked HTML's pixel/link URLs use the
   backend's real domain (not localhost) before it's pasted into Carbonio and sent
   to real recipients.
7. `{backend}/api/track/open/*` and `{backend}/api/track/click/*` must stay
   reachable **without** auth (mail clients hit them directly) — don't put them
   behind anything that requires a login cookie or IP allowlisting recipients
   wouldn't have. They already skip the backend's `authenticate` middleware by
   design; don't add auth to them.

## Notes for whoever runs this long-term
- No file storage/uploads — everything (processed HTML, stats, accounts) lives in
  Postgres.
- No background jobs/cron — all work happens synchronously on request.
- No plain-text email path — only HTML campaigns are supported by design.
- `sentCount` is entered manually in the UI (neither service can see actual sends
  from Carbonio), so totals are only as accurate as that number.
- Numbers shown are raw totals, not unique/deduplicated — see `backend/CLAUDE.md`
  for why that was a deliberate call.
- Refresh-token reuse (a replayed/stolen cookie) revokes every session for that
  user, forcing a fresh login everywhere — this is intentional, not a bug.
