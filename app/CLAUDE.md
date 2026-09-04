# CLAUDE.md — Mail Tracker

Project context for every Claude Code session in this repo. **Read before editing.**

## What this is
Self-hosted **Next.js 15 (App Router, TypeScript, React 19)** app that measures
**open rate** and **per-link click-through rate** for **HTML emails** sent from
**Carbonio**. Flow: user uploads/pastes HTML → server injects a 1×1 tracking pixel
and rewrites every `http(s)` link through a redirect → user downloads the tracked
HTML and pastes it into Carbonio's **HTML** composer → opens/clicks log to the DB →
dashboard shows the rates. There is **no plain-text path** — HTML only.

## Stack (use current stable)
- Next.js **15.x**, React **19**, TypeScript, App Router.
- **Prisma** ORM → **Neon Postgres** (provider `postgresql`, `DATABASE_URL` only).
- **cheerio** for HTML parsing; **nanoid** for tokens.
- Styling: **plain CSS with the brand tokens below in `globals.css`** + a small set
  of shared React primitives (defined in Phase 1). No Tailwind config, no CSS-in-JS
  — this keeps parallel terminals from fighting over shared style config.

## CRITICAL rules (do not violate)
- **Next 15 async params:** in EVERY route handler and page, `params`/`searchParams`
  are Promises. Type them `{ params: Promise<{ id: string }> }` and `await` them.
- **File ownership:** only touch files in your assigned lane (see each phase prompt).
  Do NOT edit `prisma/schema.prisma`, `src/lib/**`, `globals.css`, or shared
  components after Phase 1 — they are frozen contracts. If you think a contract is
  wrong, STOP and leave a `// TODO(contract):` note instead of changing it.
- Never invent env vars beyond `DATABASE_URL` and `NEXT_PUBLIC_BASE_URL`.

## Environment
```
DATABASE_URL="postgresql://…neon…?sslmode=require"   # Neon pooled URL
NEXT_PUBLIC_BASE_URL="https://track.example.com"      # public https host recipients reach
```
`NEXT_PUBLIC_BASE_URL` is what mail clients fetch the pixel/redirect from. Must be
real HTTPS in production; `http://localhost:3000` only for local dev.

## Data model (Prisma — FROZEN after Phase 1)
- `Campaign(id cuid, name, openToken @unique, sentCount Int @default(0), createdAt, processedHtml String?)` → links[], opens[], clicks[]
- `Link(id cuid, token @unique, originalUrl, label String?, campaignId)` → campaign, clicks[]  ← each link has its OWN token, so each link counts separately
- `OpenEvent(id, campaignId, recipientRef String?, ip String?, userAgent String?, createdAt)` @@index([campaignId])
- `ClickEvent(id, linkId, campaignId, recipientRef String?, ip String?, userAgent String?, createdAt)` @@index([campaignId]) @@index([linkId])

## Library contracts (in `src/lib/**` — FROZEN after Phase 1)
```ts
// src/lib/db.ts
export const prisma: PrismaClient            // singleton

// src/lib/transform.ts
export function transformHtml(html: string, opts: { baseUrl: string; openToken: string }):
  { html: string; links: { token: string; originalUrl: string; label: string | null }[] };
export const newOpenToken: () => string;     // nanoid(14)

// src/lib/stats.ts
export interface CampaignStats { sent; totalOpens; totalClicks }   // raw totals only, no rates
export function computeStats(input): CampaignStats;

// src/lib/query.ts
export async function loadCampaign(id: string): Promise<{
  id; name; openToken; sentCount; createdAt; processedHtml;
  stats: CampaignStats;
  perLink: { id; label; originalUrl; totalClicks }[];
} | null>;
```
No dedup / "unique" concept, and **no rate/percentage calculations anywhere** — every
logged `OpenEvent`/`ClickEvent` row counts, and the dashboard only ever shows raw
totals (total opens, total clicks per link). This was a deliberate call: with one
shared HTML blob sent to every recipient, unique-actor attribution and %-based CTR
both read as more precise than the data actually supports. Don't reintroduce rate
math without being asked.

## URL / API contracts (FROZEN after Phase 1, extended since)
- Pixel:    `GET /api/track/open/{openToken}?r={recipientId?}` → 1×1 gif, no-store; logs OpenEvent.
- Click:    `GET /api/track/click/{linkToken}?u={encodedOriginal}&r={recipientId?}` → 302 to Link.originalUrl (fallback `u=` only if token unknown); logs ClickEvent.
- Process:  `POST /api/process {name, html, sentCount}` → `{ id, processedHtml, linkCount }`.
- List:     `GET /api/campaigns` → campaigns newest-first with `_count {opens,clicks,links}`.
- Get:      `GET /api/campaigns/{id}` → `CampaignDetail` (via `loadCampaign`) or 404.
- Sent:     `POST /api/campaigns/{id}/sent {sentCount}` → `{ ok: true }`.
- Update:   `PATCH /api/campaigns/{id} {name?, html?}` → `{ ok: true, linkCount }`. `html`
  reprocesses through `transformHtml` with the *same* `openToken` (open history stays
  valid) but deletes+recreates every `Link` row, cascading away that campaign's
  `ClickEvent`s — old link tokens no longer exist in the new HTML, so their click
  history can't be kept. Documented in the UI, not silent.
- Delete:   `DELETE /api/campaigns/{id}` → `{ ok: true }`. Cascades to links/opens/clicks.

Rewritten link href = `${baseUrl}/api/track/click/${token}?u=${encodeURIComponent(originalHref)}`.
Pixel `<img>` appended before `</body>`, hidden, 1×1. Skip `mailto:`/`tel:`/`#`/relative/`data-no-track`.

## Design system — LIGHT THEME ONLY (source of truth: `design-system.md`)
Modern, sleek, minimal, professional — enterprise SaaS. The full spec (palette,
type scale, spacing, shadows, radii, component rules, principles) lives in
**`design-system.md`**; treat it as authoritative and copy its exact values.
Visual balance target: **~80% neutral, ~15% structure, ~5% primary** — primary
crimson only for CTAs, links, and active states (keep it under ~15% of the UI).
Brand mark: the Illumia dark wordmark on the white masthead + a thin crimson rule;
favicon = the diamond mark. (Same crimson `#B41F3C`, so logo and theme agree.)

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
- **Fonts via `next/font`:** Inter (sans, weights 400/500/600/700) and JetBrains Mono
  (mono — use for tokens, URLs, and the big metric numbers). No Calibri.
- Body line-height ~1.5; **avoid pure black for large text blocks** — use
  `--color-text-secondary` for body copy, `--color-text-primary` for headings/short labels.
- Weights: 500 for UI labels, 600 for headings.
- **Cards:** white fill, 1px `--color-border`, `--radius-lg`, `--shadow-sm`, padding `--space-4`.
- **Buttons:** primary = `--color-primary` fill / inverse text, `--radius-md`, padding 12px 20px,
  hover `--color-primary-hover`, active `--color-primary-active`; secondary = white fill,
  1px `--color-border`, primary-colored text.
- **Inputs:** 1px `--color-border`, `--radius-md`, padding 12px; focus → border `--color-primary`, no default outline (keep a visible focus ring for a11y).
- **Metrics readout:** big JetBrains-Mono tabular-nums; the ONE headline metric
  (open rate) uses `--color-primary`, the rest stay text-primary.
- Section spacing 32–64px (`--space-5`–`--space-7`); component padding 16–24px.
- Accessibility: WCAG AA contrast, visible keyboard focus, never rely on color alone, responsive to mobile, respect reduced motion.

## Sending instructions to surface in the UI (Carbonio, HTML only)
"Download the tracked HTML, open Carbonio webmail → Compose → switch the body to
**HTML** mode, paste the tracked HTML as the message source, then send." Open rate
is approximate (image-blocking hides opens; Apple Mail Privacy pre-loads pixels and
inflates them) — treat per-link click-through as the reliable signal.
