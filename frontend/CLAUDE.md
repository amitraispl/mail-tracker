# CLAUDE.md — Mail Tracker (frontend)

Project context for every Claude Code session in this directory. **Read before editing.**

## What this is
The **UI only** half of Mail Tracker — a self-hosted **Next.js 15 (App Router,
TypeScript, React 19)** app that displays open/click tracking for HTML emails sent
from Carbonio. All data access, business logic, and auth live in the sibling
**`../backend`** service (Node + Express + Prisma). This app owns **zero** database
code — no Prisma, no `DATABASE_URL`. It talks to the backend over HTTP.

Full product flow (shared with backend): user uploads/pastes HTML → backend injects
a tracking pixel and rewrites every link → user downloads the tracked HTML and
pastes it into Carbonio's HTML composer → opens/clicks log to the backend's DB →
this app's dashboard shows raw totals (no rate/percentage math — see backend's
CLAUDE.md for why).

## Stack
- Next.js 15.x, React 19, TypeScript, App Router.
- `jose` for JWT verification in `middleware.ts` (Edge-compatible).
- Styling: plain CSS with brand tokens in `globals.css` + shared React primitives
  in `src/components/`. No Tailwind, no CSS-in-JS.

## Architecture — how this talks to the backend
- **Server Components** (page.tsx files doing SSR reads) call `src/lib/backend.ts`'s
  `loadCampaign`/`loadCampaignList`, which forward the incoming request's cookies to
  the backend via `next/headers` `cookies()` — this is how a logged-in user's
  session carries over to a server-side fetch.
- **Client Components** (forms, buttons — anything mutating data) call
  `src/lib/api.ts`'s `apiFetch(path, init)`, which fetches a **relative** `/api/...`
  path — never the backend's origin directly — with `credentials: "include"", and
  transparently does one refresh-and-retry on a 401 (access token expired
  mid-session). `next.config.ts` `rewrites()` proxies that path through to the
  backend (`NEXT_PUBLIC_API_URL`) server-side. This indirection is required, not
  cosmetic: it's what makes the backend's Set-Cookie land as a first-party cookie
  on *this* domain, which is the only way `middleware.ts` (reading cookies off its
  own incoming requests) can ever see the session when frontend and backend are on
  unrelated domains (e.g. Vercel + Render) — a cross-site Set-Cookie is invisible
  to it no matter what cookie flags the backend sets. Server Components
  (`lib/backend.ts`) call the backend's real origin directly instead, since they
  forward the session cookie manually via `next/headers` rather than relying on
  the browser's cookie jar.
- **`middleware.ts`** gates every non-`/login` route: verifies the `mt_access` JWT
  (same secret as the backend, real signature check — not just a shape check) for
  fast redirect-to-login UX. If the access token is missing/expired but a refresh
  cookie is present, it does a **silent refresh** against the backend and forwards
  the new cookies to both the browser and the current request (so the page renders
  with the fresh session, no extra round trip). The backend still independently
  verifies every request — this middleware is a UX layer, not the enforcement point.

## CRITICAL rules
- **Next 15 async params:** `params`/`searchParams` are Promises — type them
  `Promise<{...}>` and `await` them.
- **No DB access here, ever.** If a page needs data, add/extend a backend route and
  call it through `lib/backend.ts` or `lib/api.ts` — don't reach for Prisma, it
  isn't installed here on purpose.
- **No secrets beyond `JWT_ACCESS_SECRET`.** It must be the *exact same value* as
  the backend's `JWT_ACCESS_SECRET` (this app only verifies, never signs).
- Never invent env vars beyond `NEXT_PUBLIC_API_URL` and `JWT_ACCESS_SECRET`.

## Environment
```
NEXT_PUBLIC_API_URL="http://localhost:4000"   # backend's public base URL
JWT_ACCESS_SECRET="..."                       # MUST match backend's exact value
```

## Auth model
Named accounts (email + bcrypt-hashed password), created only via the backend's
`create-user` CLI script — no self-registration, no in-app user admin (see
`../backend/CLAUDE.md` and root `README.md`). Session = short-lived JWT access
token (httpOnly cookie, 15 min) + rotating opaque refresh token (httpOnly cookie,
30 days, scoped to `/api/auth`). Login/refresh/logout all happen against the
backend directly (`login/page.tsx`, `lib/api.ts`) — there are no `/api/**` routes
in this app anymore.

## Design system — LIGHT THEME ONLY (source of truth: `design-system.md`)
Modern, sleek, minimal, professional — enterprise SaaS. The full spec (palette,
type scale, spacing, shadows, radii, component rules, principles) lives in
**`design-system.md`**; treat it as authoritative and copy its exact values.
Visual balance target: **~80% neutral, ~15% structure, ~5% primary** — primary
crimson only for CTAs, links, and active states (keep it under ~15% of the UI).
Brand mark: the Illumia dark wordmark on the white masthead + a thin crimson rule;
favicon = the diamond mark.

Put these tokens verbatim into `globals.css`:
```css
:root{
  /* primary */
  --color-primary:#B41F3C; --color-primary-hover:#9E1B35; --color-primary-active:#7F162A;
  /* background */
  --color-bg:#FFFFFF; --color-surface:#F5F5F5; --color-surface-alt:#E3E3E3;
  /* text */
  --color-text-primary:#000000; --color-text-secondary:#555555; --color-text-muted:#888888; --color-text-inverse:#FFFFFF;
  /* accent (sparingly: tags, badges, highlights) */
  --color-accent-light:#DD4C68; --color-accent-muted:#D6A6A7; --color-accent-dark:#B74E4E;
  /* borders */
  --color-border:#E3E3E3; --color-border-strong:#C1C1C1;
  /* states */
  --color-success:#2E7D32; --color-warning:#ED6C02; --color-error:#D32F2F;
  /* type */
  --font-sans:"Inter","SF Pro Display","Segoe UI",Roboto,sans-serif;
  --font-mono:"JetBrains Mono","Fira Code",monospace;
  --text-xs:12px; --text-sm:14px; --text-md:16px; --text-lg:20px; --text-xl:24px; --text-2xl:32px; --text-3xl:40px;
  --weight-regular:400; --weight-medium:500; --weight-semibold:600; --weight-bold:700;
  /* spacing */
  --space-1:4px; --space-2:8px; --space-3:16px; --space-4:24px; --space-5:32px; --space-6:48px; --space-7:64px;
  /* radius */
  --radius-sm:6px; --radius-md:8px; --radius-lg:12px; --radius-xl:16px;
  /* shadow */
  --shadow-sm:0 1px 2px rgba(0,0,0,.05); --shadow-md:0 4px 8px rgba(0,0,0,.08); --shadow-lg:0 10px 20px rgba(0,0,0,.12);
}
```
Rules distilled from `design-system.md`:
- **Fonts via `next/font`:** Inter (sans, weights 400/500/600/700) and JetBrains Mono.
- Body line-height ~1.5; avoid pure black for large text blocks — use
  `--color-text-secondary` for body copy, `--color-text-primary` for headings.
- Weights: 500 for UI labels, 600 for headings.
- **Cards:** white fill, 1px `--color-border`, `--radius-lg`, `--shadow-sm`, padding `--space-4`.
- **Buttons:** primary = `--color-primary` fill / inverse text; secondary = white
  fill, 1px `--color-border`, primary-colored text.
- **Metrics readout:** big JetBrains-Mono tabular-nums.
- Accessibility: WCAG AA contrast, visible keyboard focus, never rely on color
  alone, responsive to mobile, respect reduced motion.

## Sending instructions to surface in the UI (Carbonio, HTML only)
"Download the tracked HTML, open Carbonio webmail → Compose → switch the body to
**HTML** mode, paste the tracked HTML as the message source, then send." Opens are
approximate (image-blocking hides them; Apple Mail Privacy pre-loads pixels and
inflates them) — treat per-link clicks as the reliable signal. No rate/percentage
math anywhere in this app — raw totals only (see backend's CLAUDE.md).
