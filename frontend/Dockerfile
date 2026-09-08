# syntax=docker/dockerfile:1

# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Manifests first — this layer is only invalidated when the lock file changes.
COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY . .
ENV NODE_ENV=production
RUN npm run build

# NOTE: devDependencies are kept, not pruned — next.config.ts is TypeScript,
# and `next start` needs the `typescript` package installed to load it.

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Deterministic non-root user — never run app code as root.
RUN addgroup -S -g 1001 appgroup && \
    adduser  -S -u 1001 -G appgroup appuser

WORKDIR /app

COPY --from=build --chown=appuser:appgroup /app/package.json ./package.json
COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/.next ./.next
COPY --from=build --chown=appuser:appgroup /app/next.config.ts ./next.config.ts

USER appuser

EXPOSE 3000

# /login is public (no auth) — safe to hit unauthenticated for liveness.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["wget", "-qO", "/dev/null", "http://localhost:3000/login"]

CMD ["npm", "start"]
