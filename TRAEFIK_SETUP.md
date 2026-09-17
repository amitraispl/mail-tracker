# Traefik setup — single VM, self-signed cert (test)

Testing the `docker-compose.yml` + Traefik setup described in `README.md`'s
"Running with Docker" section — `traefik`, `mysql`, `backend`, `frontend` all
in that one file, same shape as illumiasolutions.com's own docker-compose.yml
(all four services, one host). This is **one VM**, not three — see "Why one
VM, not three" below.

The `ispl-website` network name is kept as-is (not renamed to something
mail-tracker-specific) because this VM is meant to eventually be the same box
that runs the real isplwebsite + Traefik in production — using the same name
now means no relabeling later when they actually get consolidated.

## Why one VM, not three

`ispl-website` is a plain Docker bridge network — it only exists inside one
Docker daemon. Traefik discovers containers by talking to the local Docker
socket (`--providers.docker=true`, `/var/run/docker.sock` mounted in), so it
can only route to containers running on the **same host** it's on. There's no
way to point it at a container on a different VM without a different
networking model entirely (Swarm overlay network, Kubernetes, or Traefik's
own cross-host provider config) — none of which this setup uses. So: traefik
+ mysql + backend + frontend all live on this one VM, one `docker compose up`.

(This replaces the separate `VM_DEPLOYMENT.md` 3-VM split for this test —
that doc's `docker run`-per-VM approach doesn't use Traefik or Docker networks
at all, so it's a different, incompatible setup. Don't mix the two.)

## 1. Install Docker (Ubuntu 24.04)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

## 2. Create the shared network

```bash
docker network create ispl-website
```

`docker-compose.yml` declares this network `external: true` — compose won't
create it for you, `up` just fails with "network not found" if you skip this.

## 3. Clone mail-tracker, generate a self-signed cert

```bash
git clone <your-repo-url> mail-tracker
cd mail-tracker

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout traefik/certs/local.key \
  -out traefik/certs/local.crt \
  -days 365 \
  -subj "/CN=tracker.illumiasolutions.com" \
  -addext "subjectAltName=DNS:tracker.illumiasolutions.com,DNS:trackerapi.illumiasolutions.com,DNS:traefik.illumiasolutions.com"
```

Self-signed = browsers/curl will warn "not trusted" (expected — there's no
real CA behind it). That's fine for confirming the routing/TLS-termination
plumbing works; swap in a real cert (or point Traefik at Let's Encrypt) before
this is ever internet-facing for real.

## 4. Fill in the env files

```bash
cp backend/.env.example backend/.env
```
Edit `backend/.env` — same-VM values, since `mysql`/`backend`/`frontend` all
resolve each other by service name on `ispl-website`:
```
DATABASE_URL="mysql://mailtracker:change_me_db_password@mysql:3306/mailtracker"
MARIADB_ROOT_PASSWORD=change_me_root_password
MARIADB_DATABASE=mailtracker
MARIADB_USER=mailtracker
MARIADB_PASSWORD=change_me_db_password
PUBLIC_TRACK_BASE_URL="https://trackerapi.illumiasolutions.com"
FRONTEND_ORIGIN="https://tracker.illumiasolutions.com"
JWT_ACCESS_SECRET="<generate: docker run --rm node:20-alpine node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\">"
NODE_ENV="production"
PORT=4000
```

```bash
cp frontend/.env.example frontend/.env
```
Edit `frontend/.env`:
```
NEXT_PUBLIC_API_URL="http://backend:4000"
JWT_ACCESS_SECRET="<EXACT same value as backend's>"
```

## 5. Bring the whole stack up

```bash
docker compose up -d --build
docker compose ps                 # all four healthy?
docker compose logs -f traefik    # Ctrl+C once it's listening on :80/:443
```

First run only — push the schema and create your login:
```bash
docker exec -it mail-tracker-backend npx prisma db push
docker exec -it mail-tracker-backend node dist/scripts/create-user.js --email you@illumiasolutions.com --password "a strong password"
```

## 6. Point your browser/test machine at it

The hostnames (`tracker.illumiasolutions.com`, `trackerapi.illumiasolutions.com`,
`traefik.illumiasolutions.com`) are placeholders and won't resolve via real
DNS to a test VM. On the machine you're testing *from* (not the VM), add to
`/etc/hosts` (`C:\Windows\System32\drivers\etc\hosts` on Windows):
```
<VM's IP>   tracker.illumiasolutions.com
<VM's IP>   trackerapi.illumiasolutions.com
<VM's IP>   traefik.illumiasolutions.com
```

Then:
```bash
curl -k https://trackerapi.illumiasolutions.com/healthz
curl -k https://tracker.illumiasolutions.com/login
```
`-k` skips the self-signed-cert trust check (curl only — a real browser will
show an "unsafe" click-through warning instead, same reason). Traefik
dashboard: `https://traefik.illumiasolutions.com` (also self-signed, and
currently has **no auth in front of it** — fine for a private test VM, not
for anything internet-facing; add a Traefik `basicauth` middleware label
before this setup goes further than a test).

## Redeploy after code changes

```bash
git pull
docker compose up -d --build
```
