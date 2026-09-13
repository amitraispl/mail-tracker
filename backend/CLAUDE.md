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
- `nodemailer` for platform-send (`src/lib/mailer.ts`) — one pooled transport off
  a single shared mailbox (env-configured, see Environment), not per-user
  credentials. Every user's campaign send goes through the same connection pool.
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
- `Campaign(id, name, subject?, openToken @unique, sentCount, createdAt, processedHtml?, firstSentAt?)` → links[], opens[], clicks[], recipients[].
  `subject` is the platform-send email subject; null falls back to `name` (`routes/sending.ts` `subjectFor()`).
- `Link(id, token @unique, originalUrl, label?, campaignId)` → campaign, clicks[] — each link has its own token
- `Recipient(id, campaignId, email, status, error?, isTest, sentAt?, createdAt)` — one row per email a campaign was (or will be) platform-sent to.
  `id` **is** the `?r=` value embedded in that recipient's personalized tracking
  URLs (`lib/personalize.ts`). `isTest` rows are send-test-to-self copies —
  excluded from every analytics query by default, verified in isolation instead.
  `@@unique([campaignId, email, isTest])` — `isTest` is part of the key so a
  test-send to an address that's also a real recipient never merges into (or
  flips `isTest` off on) that real row.
- `OpenEvent`/`ClickEvent(id, campaignId, recipientId?, ip?, userAgent?, createdAt)` — every hit logged, no dedup. `recipientId` is a real FK to `Recipient`, nullable (stays null for manual-paste-into-Carbonio campaigns, which never create `Recipient` rows) — `routes/track.ts` validates a candidate `?r=` id belongs to the hit campaign before trusting it.
- `User(id, email @unique, passwordHash, createdAt)` → refreshTokens[]
- `RefreshToken(id, userId, tokenHash @unique, expiresAt, revokedAt?, replacedByTokenId?, userAgent?, ip?)`
  — the raw refresh token is **never stored**, only its SHA-256 hash.

Schema changes: `npm run db:push` (no migration history — this app's size doesn't
warrant it; check the diff output before confirming on prod, a push can drop
columns).

## Stats — no rates, ever
`lib/stats.ts` / `lib/query.ts` return raw totals: `{ sent, rawOpens,
totalClicks }` and per-link `{ totalClicks }`. **No %-based CTR/open-rate math
anywhere** — that's still a deliberate product call (one shared HTML blob sent to
every recipient makes %-based rates read as more precise than the data supports).
`uniqueOpens`/`uniqueClicks` (added 2026-09) are the one intentional exception to
"no dedup": a per-recipient headcount (`lib/query.ts` `loadCampaign`, distinct
`recipientId` on `OpenEvent`/`ClickEvent`, `isTest` and null-`recipientId` rows
excluded) — a recipient counts once toward `uniqueClicks` no matter how many
links or how many times they clicked. Requested explicitly by the user; don't
extend this into rate math without being asked again. `rawOpens` is the
unmodified `OpenEvent` count, shown
as-is — no send-load correction of any kind (there used to be a client-side
`rawOpens - sent` subtraction; removed, it undercounted whenever the send-time
pixel load didn't actually happen). `sent` is `Campaign.sentCount`, which only
`routes/sending.ts`' `runSendLoop` ever writes now (`increment: 1` per successful
platform send) — there is no manual-entry path for it anymore.

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
- `POST /api/process {name, subject?, html}` → `{ id, processedHtml, linkCount }`. Always
  creates with `sentCount: 0` — that field is server-only from here on (see Stats above).
  Blank/omitted `subject` stores `null` (falls back to `name` at send time). Auth required.
- `GET /api/campaigns` → newest-first, `_count {opens,clicks,links}`. Auth required.
- `GET /api/campaigns/{id}` → `CampaignDetail` or 404. Auth required.
- `PATCH /api/campaigns/{id} {name?, subject?, html?}` → `{ ok, linkCount }`. `html` keeps the
  same `openToken` (pixel URL stays valid) but wipes that campaign's `OpenEvent`s,
  and deletes+recreates every `Link`, cascading away its `ClickEvent`s — an HTML
  replace is treated as a fresh send. `subject: ""` clears the override back to the
  `name` fallback. Auth required.
- `DELETE /api/campaigns/{id}` → `{ ok }`. Cascades everything. Auth required.
- `POST /api/campaigns/{id}/recipients {emails}` → `{ ok, created, skipped, invalid }`. `emails` is
  newline/comma-separated; dedups case-insensitively, skips malformed addresses. Auth required.
- `GET /api/campaigns/{id}/recipients` → `{ recipients: [...], summary: {pending,sending,sent,failed} }`.
  `summary` excludes `isTest` rows; `recipients` includes them (frontend splits real vs. test).
  Auth required.
- `GET /api/campaigns/{id}/recipients/{recipientId}` → full detail incl. the actual open/click
  event timeline (`{createdAt}[]` / `{createdAt,linkLabel,linkUrl}[]`), not just aggregate counts
  — backs the frontend's recipient-detail modal. Auth required.
- `DELETE /api/campaigns/{id}/recipients/{recipientId}` → `{ ok }`. Auth required.
- `POST /api/campaigns/{id}/send-test` → sends one personalized copy to the caller's own account
  email, upserts an `isTest` `Recipient` row. Auth required.
- `POST /api/campaigns/{id}/send` → `202 { ok, queued }`. Bulk: kicks off an async, sequential send
  loop over every `pending`/non-test recipient (`routes/sending.ts` `runSendLoop`) — one failure
  never aborts the batch, each row's `status`/`error`/`sentAt` updates independently, and
  `Campaign.sentCount` increments per successful send (see Stats above). Sets `Campaign.firstSentAt`
  on first use. Poll `GET .../recipients` for live progress. Auth required.
- `POST /api/campaigns/{id}/recipients/{recipientId}/send` → `{ ok }`. Single-address counterpart —
  sends to exactly that one pending recipient without touching the rest of the list. Shares
  `sendToOne()` with the bulk loop, so behaves identically (status/error/sentAt/sentCount). Auth
  required.
- `GET /api/campaigns/{id}/activity?limit=20` → `{ feed: [{type, email, linkLabel, createdAt}] }`,
  merged opens+clicks, newest first, `isTest` excluded. Auth required.

`lib/query.ts`'s `loadCampaign` orders `perLink` by click count descending (`orderBy: [{clicks:
{_count:"desc"}}, {id:"asc"}]`) — the frontend's Links table relies on index 0 being the
most-clicked link, no client-side re-sort.

Rewritten link href = `${PUBLIC_TRACK_BASE_URL}/api/track/click/${token}?u=${encodeURIComponent(originalHref)}`.
Pixel `<img>` appended before `</body>`, hidden, 1×1. Skip `mailto:`/`tel:`/`#`/relative/`data-no-track`.
Platform-send personalizes per recipient by appending `&r=${recipientId}` to every tracking URL in the
already-processed HTML (`lib/personalize.ts` `renderForRecipient`) — same link/pixel token for everyone,
only `r` differs, which is what lets `routes/track.ts` attribute an open/click to a specific `Recipient`.

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

Platform-send (`lib/mailer.ts`): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`,
`SMTP_PASSWORD`, `SMTP_USE_TLS`, `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS`. One
shared mailbox for every user's campaigns — this was a deliberate call (see
`SEND_VIA_PLATFORM_PLAN.md` at the repo root): everyone sends from the same
organization/domain, so per-user SMTP credentials would add real setup friction
for no attribution benefit the `Recipient`-level tracking doesn't already give.
Don't add per-user SMTP config without being asked.
