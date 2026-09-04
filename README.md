# Mail Tracker — Claude Code prompt pack

Prompts to build **Mail Tracker** (Next.js 15 + Neon Postgres, Illumia light-theme
UI) using Claude Code, with a **parallel** build across multiple terminals.

## Use in this order
1. Read **`00-ORCHESTRATION.md`** — the parallelization model (git worktrees) and gates.
2. Put **`CLAUDE.md`**, **`design-system.md`**, and **`brand-assets/`** in your new project folder first
   (Claude Code auto-reads `CLAUDE.md`; it pins every shared contract + the brand).
3. **`phase-1-foundation.md`** — one terminal, solo, then commit.
4. **`phase-2a-tracking.md` / `phase-2b-apis.md` / `phase-2c-frontend.md`** — three
   terminals in parallel, each in its own git worktree.
5. **`phase-3-integrate.md`** — merge, connect Neon, build, smoke-test, harden.

## Why it parallelizes cleanly
Phase 1 builds every shared contract (DB schema, `src/lib` functions, design system,
component kit). The three parallel phases only add *leaf* files in disjoint folders
(`api/track` vs `api/campaigns`+`api/process` vs pages), so they never edit the same
file and merge without conflicts.

## Key decisions baked in
- Next.js **15** (async `params`/`searchParams` — the prompts flag this).
- **Neon Postgres** via Prisma — only `DATABASE_URL` needed.
- **HTML email only**, sent from **Carbonio** (compose → HTML mode → paste → send).
- **Each link has its own token**, so click counts are per-link.
- **Illumia brand, light theme only** — tokens + logo in `CLAUDE.md` / `brand-assets/`.
