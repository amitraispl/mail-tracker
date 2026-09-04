# Mail Tracker — Claude Code build, run in parallel

A self-hosted **Next.js 15** app that tracks **open rates** and **per-link
click-through rates** for **HTML** email you send from **Carbonio**. Upload/paste
the HTML → the app injects a tracking pixel and rewrites each link → download the
tracked HTML → paste it into Carbonio's HTML composer → watch the dashboard.

DB: **Neon Postgres** (you only supply a connection URL). Design: **Illumia
Solutions brand, light theme only** (tokens are baked into `CLAUDE.md`).

---

## The parallelization model (git worktrees)

Claude Code works one repo per terminal. To run terminals **in parallel without
merge conflicts**, give each its own **git worktree + branch**, and split work so
**no two terminals write the same files**. Phase 1 builds every shared contract
(schema, lib functions, design system) first; the parallel phase only adds *leaf*
files (route handlers, pages) that import those contracts.

```
Phase 1  (SOLO — must finish first)      foundation: scaffold, schema, lib, design system
   │
   ├─ Phase 2A  (parallel)   tracking endpoints      → src/app/api/track/**
   ├─ Phase 2B  (parallel)   campaign + process APIs → src/app/api/campaigns/**, /process/**
   └─ Phase 2C  (parallel)   frontend pages          → src/app/(pages) + components
   │
Phase 3  (SOLO)                          merge, push schema to Neon, build, smoke-test, harden
```

### Setup

```bash
# 1) Phase 1 in your FIRST terminal (creates the repo). Paste phase-1-foundation.md.
#    When it's done and committed on main:
git add -A && git commit -m "phase 1: foundation" 

# 2) Create three worktrees for the parallel phase (from the repo root):
git worktree add ../mail-tracker-2a -b feat/tracking
git worktree add ../mail-tracker-2b -b feat/apis
git worktree add ../mail-tracker-2c -b feat/frontend

# 3) Open a new Claude Code terminal in EACH worktree dir and paste the matching
#    phase-2X prompt. They run at the same time.
#    (Each worktree already contains the committed Phase 1 code, so all contracts exist.)

# 4) When all three report done + committed, go to Phase 3 in your main terminal.
```

### Merge (Phase 3)

```bash
git checkout main
git merge feat/tracking feat/apis feat/frontend   # conflict-free by design (disjoint files)
git worktree remove ../mail-tracker-2a && git branch -d feat/tracking
git worktree remove ../mail-tracker-2b && git branch -d feat/apis
git worktree remove ../mail-tracker-2c && git branch -d feat/frontend
```

---

## Order & gates

1. **Phase 1** — run alone, verify it builds (`npm run build` may skip DB; at least
   `npx tsc --noEmit` should pass and `npx prisma validate` should pass). Commit.
2. **Phase 2A / 2B / 2C** — run together in the three worktrees. Each has its own
   "Definition of done" and verify step. Commit on each branch.
3. **Phase 3** — merge, point at Neon, `npx prisma db push`, `npm run build`, smoke test.

## Files in this pack
- `CLAUDE.md` — drop at repo root **before Phase 1** (Claude Code auto-reads it; it
  pins every shared contract + the brand system so parallel terminals agree).
- `phase-1-foundation.md` … `phase-3-integrate.md` — paste one per terminal.
- `brand-assets/` — Illumia logo (dark wordmark for light bg) + diamond mark.
  Copy into `public/brand/` during Phase 1.

## Two correctness notes Claude Code must not miss (also in CLAUDE.md)
- **Next.js 15:** `params` and `searchParams` are **async** — `await` them in every
  route handler and page (`const { id } = await params;`). This is the #1 Next 15 break.
- **Neon:** the app runs as a Node server, so a normal pooled `postgresql://…` URL
  works. Append `?sslmode=require` (Neon URLs include it). `prisma db push` is enough.
