# syntax=docker/dockerfile:1

# ── Stage 1: Build ───────────────────────────────────────────────────────────
# alpine both here and in the runtime stage so the Prisma engine binary
# `npm ci`'s postinstall (`prisma generate`) downloads matches the runtime libc.
FROM node:20-alpine AS build

RUN apk add --no-cache openssl

WORKDIR /app

# Manifests + schema first — `prisma generate` (postinstall) needs schema.prisma
# to exist at ./prisma/schema.prisma, and this layer is only invalidated when
# either changes.
COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Drop devDependencies (typescript, tsx, @types/*) now that the client is
# generated and dist/ is compiled — keeps the runtime copy lean. `prisma` (the
# CLI, not just @prisma/client) is a regular dependency on purpose, not dev —
# it has to survive this prune so `docker exec <container> npx prisma db push`
# works against the running container without pulling in tsx/typescript too.
RUN npm prune --omit=dev

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Prisma's query engine binary is dynamically linked against OpenSSL.
RUN apk add --no-cache openssl

# Deterministic non-root user — never run app code as root.
RUN addgroup -S -g 1001 appgroup && \
    adduser  -S -u 1001 -G appgroup appuser

WORKDIR /app

# package.json is needed only for its "type": "module" field (ESM resolution).
# prisma/schema.prisma has to be here too — not for the app itself (the
# generated client already lives in node_modules/.prisma from the build
# stage), but because `docker exec <container> npx prisma db push` (see
# README/VM_DEPLOYMENT.md) needs the schema file present to know what to push.
COPY --from=build --chown=appuser:appgroup /app/package.json ./package.json
COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --from=build --chown=appuser:appgroup /app/prisma ./prisma

USER appuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=5 \
    CMD ["wget", "-qO", "/dev/null", "http://localhost:4000/healthz"]

CMD ["node", "dist/server.js"]
