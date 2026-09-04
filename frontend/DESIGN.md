---
name: Mail Tracker
description: Self-hosted HTML email open/click tracker for Illumia Solutions
colors:
  crimson: "#B41F3C"
  crimson-hover: "#9E1B35"
  crimson-active: "#7F162A"
  surface-bg: "#FFFFFF"
  surface-page: "#F5F5F5"
  surface-alt: "#E3E3E3"
  ink: "#15161A"
  ink-secondary: "#555555"
  ink-muted: "#888888"
  ink-inverse: "#FFFFFF"
  accent-light: "#DD4C68"
  accent-muted: "#D6A6A7"
  accent-dark: "#B74E4E"
  border: "#E3E3E3"
  border-strong: "#C1C1C1"
  success: "#2E7D32"
  warning: "#ED6C02"
  error: "#D32F2F"
typography:
  headline:
    fontFamily: "Inter, SF Pro Display, Segoe UI, Roboto, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "Inter, SF Pro Display, Segoe UI, Roboto, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter, SF Pro Display, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, SF Pro Display, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.08em"
  data:
    fontFamily: "JetBrains Mono, Fira Code, monospace"
    fontSize: "14px"
    fontWeight: 600
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  1: "4px"
  2: "8px"
  3: "16px"
  4: "24px"
  5: "32px"
  6: "48px"
  7: "64px"
components:
  button-primary:
    backgroundColor: "{colors.crimson}"
    textColor: "{colors.ink-inverse}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.crimson-hover}"
    textColor: "{colors.ink-inverse}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  button-secondary:
    backgroundColor: "{colors.surface-bg}"
    textColor: "{colors.crimson}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  card:
    backgroundColor: "{colors.surface-bg}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: Mail Tracker

## 1. Overview

**Creative North Star: "The Ops Room Ledger"**

Mail Tracker reads like a well-run internal instrument panel, not a marketing site:
a single crimson accent against tinted-neutral surfaces, numbers set in monospace
so they read as data rather than decoration, and just enough structure (a masthead,
a card, a table) to keep a small, competent workflow legible. It rejects the
generic AI-SaaS template look by name: no purple/blue gradient glow, no
Inter-everywhere sameness (the mono face for every number is what breaks that),
no identical 3-card feature grids, no glassmorphism used decoratively, no
hero-metric cliches, no gradient text, no colored side-stripe borders.

**Key Characteristics:**
- One accent color (crimson), used for actions and the single headline metric only
- Tabular monospace numbers everywhere data is reported
- Flat-by-default surfaces; elevation only appears as a response to hierarchy or state
- Static masthead (page-level, not sticky/fixed) with a fading brand rule, not a hard bar

## 2. Colors

Tinted neutrals dominate; crimson is rationed to under ~15% of any given screen.

### Primary
- **Signal Crimson** (#B41F3C): the only accent. Primary buttons, active states, links,
  the single headline metric (open rate) on a campaign dashboard. Hover
  **Crimson Hover** (#9E1B35), pressed **Crimson Active** (#7F162A).

### Neutral
- **Paper White** (#FFFFFF): card and input surfaces, the masthead.
- **Ledger Gray** (#F5F5F5): the page ground everything else sits on top of, so
  white cards visibly lift off it.
- **Structure Gray** (#E3E3E3): borders, dividers, subtle fills (tags, table
  header tint).
- **Ink** (#15161A): headings and primary text. Never pure `#000` (the system's own
  earlier rule against pure black for large text blocks).
- **Ink Secondary** (#555555): body copy.
- **Ink Muted** (#888888): captions, hints, metadata.

### Named Rules
**The One Voice Rule.** Crimson appears on actions, active/current states, and the
one headline metric per screen. It never decorates a whole surface or a full card
background.

## 3. Typography

**Body Font:** Inter (with SF Pro Display, Segoe UI, Roboto, sans-serif fallback)
**Label/Mono Font:** JetBrains Mono (with Fira Code, monospace fallback)

**Character:** Inter carries every word of prose and UI chrome; JetBrains Mono is
reserved entirely for numbers, tokens, and URLs, so a glance at a screen tells you
instantly which parts are "data" versus "interface".

### Hierarchy
- **Headline** (600, 32px, 1.2): page titles ("Mail Tracker", a campaign name).
- **Title** (600, 20px, 1.3): card and section headings.
- **Body** (400, 16px, 1.5): running copy, max ~65ch line length.
- **Label** (600, 12px, letter-spacing 0.08em, uppercase): eyebrows, table column
  headers.
- **Data** (600, 14px mono, tabular-nums): every metric, count, token, and URL.

### Named Rules
**The Mono Ledger Rule.** Any number a user might scan down a list or compare
(opens, clicks, sent, rates, tokens) renders in JetBrains Mono with tabular
figures. Prose never does.

## 4. Elevation

Flat by default. Cards carry a soft diffusion shadow (not a hard drop shadow) so
they read as gently lifted off the gray page ground; elevation increases only in
response to state (hover on a clickable row, a raised primary CTA), never as
ambient decoration layered on everything.

### Shadow Vocabulary
- **Resting card** (`box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 12px 24px -18px rgba(0,0,0,.14)`):
  default card elevation.
- **Hover lift** (`box-shadow: var(--shadow-md)`, `0 4px 8px rgba(0,0,0,.08)`):
  clickable campaign rows on hover.
- **CTA lift** (`box-shadow: 0 1px 2px rgba(180,31,60,.25), 0 4px 10px -4px rgba(180,31,60,.35)`):
  the primary button, tinted toward the brand color rather than neutral gray.

### Named Rules
**The Response-Only Rule.** A shadow only appears where it communicates something
(this is elevated, this is interactive, this is the primary action). No shadow
exists purely for texture.

## 5. Components

### Buttons
- **Shape:** 8px radius.
- **Primary:** crimson fill, inverse text, 12px/20px padding, a subtle crimson-tinted
  CTA-lift shadow at rest; darker on hover/press; presses down 1px on `:active`.
- **Secondary:** white fill, 1px structure-gray border, crimson text; hover fills
  with Ledger Gray and adds a resting-card shadow.

### Cards
- **Corner Style:** 12px radius.
- **Background:** Paper White, against the Ledger Gray page.
- **Shadow Strategy:** resting-card diffusion shadow (see Elevation).
- **Border:** 1px Structure Gray.
- **Internal Padding:** 24px (16px on the rare `flush` card that wraps a table
  edge-to-edge).

### Inputs / Fields
- **Style:** 1px Structure Gray border, 8px radius, 12px padding, label above the
  field.
- **Focus:** border shifts to crimson plus a 2px crimson outline (never removed
  without replacement, for keyboard accessibility).
- **File inputs:** the native browser button is restyled via
  `::file-selector-button` to match the Secondary button, never left as raw OS
  chrome.
- **Error:** red border and outline, error text below in Ink.

### Navigation
- **Style:** a page-level masthead (part of normal document flow, explicitly NOT
  sticky or fixed on scroll), Paper White against the gray page, with a crimson
  rule along the bottom edge that fades toward transparent left-to-right rather
  than sitting as a flat, hard bar. Brand wordmark left, primary + secondary
  actions right. Logo dims slightly on hover/press for tactile feedback.
- **Mobile:** logo and bar height shrink slightly under 640px; actions wrap.

## 6. Do's and Don'ts

### Do:
- **Do** ration crimson to actions, active states, and one headline metric per
  screen (The One Voice Rule).
- **Do** set every number, token, and URL in JetBrains Mono with tabular figures
  (The Mono Ledger Rule).
- **Do** keep the page background a tinted Ledger Gray (#F5F5F5) so white cards
  visibly lift off it, not pure white-on-white.
- **Do** keep the masthead in normal document flow. Not sticky, not fixed.
- **Do** use Ink (#15161A), never pure `#000`, for headings and primary text.

### Don't:
- **Don't** use a purple/blue gradient glow, anywhere, for anything.
- **Don't** let every surface read as identical Inter-on-white; mono numbers are
  what break the sameness.
- **Don't** build identical 3-card feature grids.
- **Don't** use glassmorphism decoratively; if blur is used at all it must serve a
  real overlap (a true floating panel), never applied to a static, non-overlapping
  bar just for texture.
- **Don't** use the hero-metric cliche (big number, small label, gradient accent).
- **Don't** use gradient text.
- **Don't** use a colored side-stripe (`border-left`/`border-right` > 1px) as a
  decorative accent on cards, list items, or alerts.
