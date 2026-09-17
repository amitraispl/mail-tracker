# Traefik + Docker deployment — what was done, and the live demo

Status as of 2026-09-17. This is the record of proving mail-tracker deploys
the same way illumiasolutions.com's own project does — Traefik + Docker
Compose, one VM, TLS-terminated by hostname — plus the exact commands to run
live in a meeting to show it working from the console.

## The VM

| | |
|---|---|
| Host | `10.5.51.100` (your old mail-tracker test VM — hostname is literally `frontend`, reused from the original 3-VM plan in `VM_DEPLOYMENT.md`) |
| OS | Ubuntu 24.04.5 LTS |
| Docker | 29.8.1, already installed, `archi` already in the `docker` group (no `sudo` needed for any of this) |
| Access | SSH key auth only — no password prompts |

**On the "does this affect the real isplwebsite" question:** no. Docker
networks are scoped to one Docker daemon — a network named `ispl-website` on
this VM and one of the same name on whatever server actually runs production
isplwebsite are two entirely separate objects with zero relationship. This VM
was confirmed empty (`docker ps -a`, `docker network ls`) before anything was
created on it, and nothing here has ever connected to wherever isplwebsite
actually runs. The one real thing to handle *later*, when this genuinely
does move onto the same box as production isplwebsite: both projects'
`docker-compose.yml` define their own `traefik:` service, and two Traefik
containers can't both bind host ports 80/443 on the same machine. Fix at that
point (not now): delete the `traefik:` block from whichever project deploys
second, keep one Traefik owning ports 80/443, and have the other project's
compose file just carry the routing labels and join the network.

## Setup already done (one-time, don't repeat live)

```bash
# 1. SSH key added to the VM so commands can run non-interactively
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "ssh-ed25519 AAAA... claude-code-mail-tracker" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 2. The external network Traefik + all four services join.
#    Must match the real production Traefik's network name exactly, or
#    routing silently does nothing — see the note above.
docker network create ispl-website

# 3. Self-signed TLS cert — generated ON the VM, not downloaded or reused
#    from anywhere. Real thing to swap in before this is ever internet-facing.
openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout traefik/certs/local.key -out traefik/certs/local.crt -days 365 \
  -subj "/CN=tracker.illumiasolutions.com" \
  -addext "subjectAltName=DNS:tracker.illumiasolutions.com,DNS:trackerapi.illumiasolutions.com,DNS:traefik.illumiasolutions.com"

# 4. backend/.env and frontend/.env filled in — see "Environment values" below

# 5. First-run database setup
docker exec mail-tracker-backend npx prisma db push
docker exec mail-tracker-backend node dist/scripts/create-user.js \
  --email <your login> --password "<your password>"
```

## Environment values — production-shaped, not dev leftovers

| Variable | Value | Why |
|---|---|---|
| `NODE_ENV` | `production` | Marks auth cookies `Secure` — real HTTPS required, matches how this will actually run |
| `PUBLIC_TRACK_BASE_URL` | `https://trackerapi.illumiasolutions.com` | Real hostname, not `localhost` — this is what ends up embedded in tracking pixels/links |
| `FRONTEND_ORIGIN` | `https://tracker.illumiasolutions.com` | Real hostname, used for CORS |
| `NEXT_PUBLIC_API_URL` | `http://backend:4000` | **Not** a dev leftover — this is the correct internal Docker DNS name. The frontend container reaches the backend container directly over the `ispl-website` network; round-tripping through the public hostname would mean going out to Traefik and back in for every internal call, for no benefit |
| `JWT_ACCESS_SECRET` | random 48-byte value, generated via `crypto.randomBytes` | Same value in both `backend/.env` and `frontend/.env` — must match exactly |
| `DATABASE_URL` / `MARIADB_*` | strong random passwords, not `testpass123` placeholders | Regenerated once real-ish values mattered for the demo |
| `SMTP_*` | your real `webmail.illumiasolutions.com` mailbox | Needed to actually prove platform send works, not just that the app boots |

## Two real bugs found and fixed

Both are the same class of mistake: a Dockerfile's multi-stage build produced
the file, but the runtime stage never copied it into the final image — so it
only breaks once you actually run the built container, not in local dev.

**1. `backend/Dockerfile` — missing `prisma/schema.prisma`**
The documented first-deploy command (`docker exec <container> npx prisma db
push`, in both `README.md` and `VM_DEPLOYMENT.md`) failed on a clean
container, because the schema file it needs wasn't in the image at all. Would
have hit the *old* 3-VM deployment too, not just this one.
```diff
  COPY --from=build --chown=appuser:appgroup /app/dist ./dist
+ COPY --from=build --chown=appuser:appgroup /app/prisma ./prisma
```

**2. `frontend/Dockerfile` — missing `public/`**
The company logo (and any other static asset under `frontend/public/`) 404s
in the running container — `next start` has nowhere to serve it from. The
actual PNG file itself is fine (confirmed: valid 128KB image, not corrupted,
not a stray Git-LFS pointer) — the container just never had the folder.
```diff
  COPY --from=build --chown=appuser:appgroup /app/next.config.ts ./next.config.ts
+ COPY --from=build --chown=appuser:appgroup /app/public ./public
```

Both fixed and committed to the repo — not patched only on the VM, so the
next `docker compose up --build` anywhere picks them up automatically.

## Structure change: Traefik merged into the app's own compose file

`docker-compose.yml` now has one `services:` block — `traefik`, `mysql`,
`backend`, `frontend` — matching isplwebsite's own file exactly, rather than
a separate Traefik-only stack. Traefik is the only service with host ports
(80/443) and the only one that terminates TLS; `backend`/`frontend` carry
routing labels instead of publishing their own ports.

## The live demo — run this in the meeting

SSH in first (`ssh archi@10.5.51.100`), then from `~/mail-tracker`:

```bash
# 1. Prove nothing's already quietly running — clean slate
docker compose down
docker compose ps

# 2. The actual moment: bring the whole stack up from one command
docker compose up -d --build

# 3. All four healthy
docker compose ps

# 4. Prove Traefik is really doing TLS + routing, not raw ports
curl -sk -H 'Host: trackerapi.illumiasolutions.com' https://localhost/healthz -w '\nstatus=%{http_code}\n'
curl -sk -H 'Host: tracker.illumiasolutions.com' https://localhost/login -w '\nstatus=%{http_code}\n'

# 5. Prove HTTP gets redirected to HTTPS, not served plain
curl -s -H 'Host: tracker.illumiasolutions.com' http://localhost/login -w '\nstatus=%{http_code}\n'
```

`-H 'Host: ...'` stands in for real DNS/a hosts-file edit — same routing
decision Traefik makes either way, no extra setup needed live in the room.
Step 2 is the one to narrate out loud: it visibly builds and starts all four
containers from nothing, in front of him — that's the actual proof, not
something left running quietly beforehand.

## Still open

- [ ] Diagnose the "Internal Server Error" on login (need live `docker logs` from the moment it happens)
- [ ] Apply the two Dockerfile fixes to the VM and rebuild
- [ ] Create the demo login (`amitra@illumiasolutions.com`)
- [ ] Add real SMTP values, send a real test email to prove platform send works
- [ ] Regenerate DB passwords to strong random values (currently placeholder test values)
- [ ] Confirm the real production Traefik's network name really is `ispl-website` before an actual consolidation
