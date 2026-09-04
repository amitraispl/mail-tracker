# Product

## Register

product

## Users

Illumia Solutions staff who send HTML email campaigns (via Carbonio webmail) and
need to know if anyone opened or clicked them. Named accounts (email + password,
JWT session), no multi-tenant concerns — internal ops tool, not a customer-facing
product. Accounts are created via a CLI script on the backend, not self-serve.

## Product Purpose

Mail Tracker takes an HTML email, injects a tracking pixel and rewrites every link
through a redirect, then reports open rate and per-link click-through once the user
has pasted the tracked HTML into Carbonio and sent it. Success = a user can create a
campaign, get the tracked HTML in under a minute, and later read accurate-enough
opens/clicks numbers without confusion.

## Brand Personality

Precise, trustworthy, quiet-confidence enterprise SaaS. Feels like a well-made
internal tool a small, competent team built for itself, not a startup marketing
site. Reference lane: Linear / Stripe dashboard, not consumer-playful.

## Anti-references

Generic AI-SaaS template look: purple/blue gradient glow, Inter-everywhere sameness,
identical 3-card feature grids, glassmorphism used decoratively, hero-metric
cliches (big number + small label + gradient accent), gradient text, side-stripe
colored borders on cards/alerts.

## Design Principles

- Clarity over decoration: every visual element earns its place by helping someone
  read a rate, find a campaign, or complete the tracked-HTML workflow faster.
- Restrained color: crimson is the one accent, reserved for actions and the single
  headline metric; everything else is neutral structure.
- Data reads as data: monospace tabular numbers, real hierarchy through scale and
  weight, not boxes and gradients.
- No decoration for its own sake: patterns, textures, or motion only where they
  reinforce structure or feedback, never just to look busy.

## Accessibility & Inclusion

WCAG AA contrast, visible keyboard focus everywhere, never color-alone signaling,
respects `prefers-reduced-motion`, responsive down to mobile (this is used from
phones to check a campaign quickly).
