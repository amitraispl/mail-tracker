# Mail Tracker

Self-hosted Next.js 15 app that tracks **open rate** and **per-link click-through
rate** for HTML emails sent from Carbonio. User pastes/uploads HTML, app injects a
tracking pixel + rewrites links, user pastes tracked HTML back into Carbonio, opens
and clicks log to Postgres, dashboard shows rates.

App code lives in **`app/`** (root has no `package.json` — always run commands from
`app/`).

## Stack
- Next.js 15 (App Router, TypeScript, React 19), run as a **Node server** (not
  static export) — has API routes + middleware.
- Postgres via Prisma (`app/prisma/schema.prisma`). Built for Neon but any Postgres
  works — only a connection string is needed.
- Single shared-password auth (cookie session, see `src/lib/auth.ts` +
  `src/middleware.ts`). No user accounts, no OAuth.

## Required environment variables

| Var | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` | Postgres connection string. If using Neon, use the **pooled** connection string. |
| `NEXT_PUBLIC_BASE_URL` | `https://track.illumiasolutions.com` | Public HTTPS origin. Baked into the pixel/redirect URLs written into every tracked email — **must be the real public domain before any email is sent**, not `localhost`. |
| `APP_PASSWORD` | (pick a strong secret) | Shared password gating the whole app except `/api/track/*`, `/login`, `/api/auth/*`. If unset, app fails closed (503) rather than opening up — see `src/middleware.ts`. |

No other env vars — don't invent any. Template at `app/.env.example`.

## Build & run

```bash
cd app
npm ci
npm run build     # runs `prisma generate` via postinstall
npx prisma db push   # push schema.prisma to the target DB (first deploy + any schema change)
npm start          # next start, defaults to port 3000
```

- `npm run dev` — local dev only.
- `npm run lint` — eslint.
- `npm test` — runs `scripts/test-transform.mjs` (unit test for the HTML transform logic, no DB needed).
- There is no separate DB migration history (`prisma db push`, not `migrate`) —
  schema changes are applied directly. Fine for this app's size; just know a push
  can be destructive if a column is dropped/renamed, so check `prisma db push`'s
  diff output before confirming on prod.

## Deploying

Any host that runs a persistent Node process works (this is **not** a static
site — it needs a live Node server for API routes + middleware). Two common paths:

**Option A — plain Node / PM2 / systemd on a VM**
```bash
cd app
npm ci
npm run build
npx prisma db push
# then run persistently, e.g.:
pm2 start npm --name mail-tracker -- start
# or a systemd unit that runs: npm start   (working dir = app/, env vars above set)
```
Put a reverse proxy (nginx/Caddy) in front for TLS, pointing at `127.0.0.1:3000`
(or whatever `PORT` you set — Next respects `PORT` env var).

**Option B — Docker**
No Dockerfile is checked in yet. If containerizing, standard Next.js 15
standalone-output Dockerfile works — ask the dev to add
`output: "standalone"` to `next.config.ts` first (currently not set), then:
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY app/package*.json ./
RUN npm ci
COPY app/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
```
Run `npx prisma db push` once against the target DB before first start (from a
machine/container with the same `DATABASE_URL` and `app/node_modules` present —
migrations are not run automatically on boot).

**Option C — Vercel / similar PaaS**
Works out of the box (it's a stock Next.js app) — set the three env vars above in
the platform's dashboard, set root directory to `app/`, and it'll run
`npm ci && npm run build` automatically. Run `npx prisma db push` once from your
own machine pointed at the same `DATABASE_URL` (or add it as a build step).

## Post-deploy checklist
1. `DATABASE_URL`, `NEXT_PUBLIC_BASE_URL` (real HTTPS domain), `APP_PASSWORD` set.
2. `npx prisma db push` run against that `DATABASE_URL`.
3. Visit the domain → should redirect to `/login` → log in with `APP_PASSWORD`.
4. Create a test campaign, confirm the tracked HTML's pixel/link URLs use the real
   domain (not localhost) before it's pasted into Carbonio and sent to real
   recipients.
5. `/api/track/open/*` and `/api/track/click/*` must stay reachable **without**
   auth (mail clients hit them directly) — don't put them behind anything that
   requires the login cookie or IP allowlisting recipients wouldn't have.

## Notes for whoever runs this long-term
- No file storage / uploads — everything (processed HTML, stats) lives in Postgres.
- No background jobs / cron — all work happens synchronously on request.
- No plain-text email path — only HTML campaigns are supported by design.
- `sentCount` is entered manually in the UI (app can't see actual sends from
  Carbonio), so open/click rates are only as accurate as that number.
