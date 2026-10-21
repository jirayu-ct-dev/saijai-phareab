---
name: saijai-vps-operations
description: Deploy, inspect, update, or troubleshoot the Saijai Phareab production Nuxt application on its VPS using the project's Docker Compose workflow, Supabase database, and external proxy/DNS setup.
---

# Saijai VPS operations

Use this skill for the production web application on the VPS: deployment, service health, host capacity, Docker, proxy/TLS connectivity, and safe rollback. Use `saijai-production-backup` for database backup or recovery, and `raspberry-pi-print-gateway` for the shop's LAN printer host. Follow the repository `AGENTS.md` and the user's current scope; this workflow does not independently authorize production migrations, database restores, DNS edits, or destructive cleanup.

## Project facts to verify before acting

- Saijai Phareab is one Nuxt full-stack application. The production database is external PostgreSQL on Supabase; production Compose does not create a database or seed demo data.
- `docker-compose.yml` defines the `saijai-phareab-production` stack. Its one-shot `migrate` service runs `prisma migrate deploy`; the app starts only after that job succeeds. Runtime uses `DATABASE_URL`; migrations also require `DIRECT_URL`.
- The app listens on port `3000` inside its container and publishes `${APP_PORT:-3004}` on the host. The repository Compose default does not bind to loopback; the VPS inspected on 2026-10-21 had the live app bound to `127.0.0.1:3004`. Verify `docker compose ps` and preserve loopback binding behind the proxy when deploying.
- The repository does not provide the public reverse proxy, TLS, DNS, or host firewall configuration. On 2026-10-21, Cloudflare DNS had proxied apex and `www` A records to `168.222.27.10`; Caddy was listening on ports 80/443; and the origin served a matching, unexpired Cloudflare Origin CA certificate. The zone was verified at Full (strict). Cloudflare's Always Use HTTPS was off, while Caddy returned HTTP redirects. Direct browsers do not trust the origin certificate; the proxied edge serves trusted HTTPS. The VPS now has UFW enabled with default-deny inbound: SSH port 22 is open from any address, while HTTP/HTTPS ports 80/443 allow only Cloudflare's published IPv4 and IPv6 ranges. The application remains bound to loopback on port 3004. Recheck current settings and Cloudflare's published ranges before changing proxy, certificate, firewall, or DNS. Do not assume Vercel or the VPS is serving traffic without checking.
- The production image is built from the checked-out source with Node 24 and the frozen pnpm lockfile. Public print-gateway settings are build inputs; changing them requires rebuilding the image.
- An earlier VPS inventory showed about 1.9 GiB RAM, while the Docker build sets Node's heap limit to 4 GiB. Recheck current capacity before building; if it runs out of memory, do not retry repeatedly. Build on a suitably sized trusted host or resolve the host capacity first.

## Safe deployment workflow

1. Read the root `AGENTS.md` and the production section of `README.md`. Check `git status --short`, the selected branch/commit, and the deployment directory on the VPS. If the deployment checkout is dirty, identify the changes and stop; preserve them and use a clean checkout of the reviewed commit instead of tagging a dirty tree.
2. Connect only to the intended host. Verify the SSH host key if it changed; do not bypass host-key checking. Never place passwords, tokens, private keys, or `.env` contents in commands, chat, shell tracing, or logs.
3. Inspect OS, CPU architecture, free memory/disk, Docker and Compose versions, running containers, listening ports, and the active proxy/firewall. Confirm the production `.env` exists with restricted permissions. Never print it. Before building, verify `.dockerignore` excludes `.env` and `/secrets/`; validate interpolation and required variables with:

   ```bash
   docker compose -f docker-compose.yml config --quiet
   ```

4. Before a deployment with pending production migrations, use the `saijai-production-backup` skill to confirm a recent encrypted backup and successful restore drill. Read the pending migration and its rollback boundary. Apply production migrations only when the current user explicitly authorized that production change. Never use `prisma migrate dev`, `prisma db push`, demo seeds, or `docker-compose.local.yml` against production.
5. Build and start only the production stack, tagging the reviewed checkout so the previous image remains identifiable:

   ```bash
   export IMAGE_TAG="$(git rev-parse --short=12 HEAD)"
   docker compose -f docker-compose.yml up --build -d
   ```

   This command runs `prisma migrate deploy` through the Compose dependency. Do not run another migration job in parallel or use an unspecified Compose file.
6. Verify the one-shot migration container exited with status `0`, app container is healthy, and the host-local HTTP check responds on the configured `APP_PORT` (default `3004`). Then check the public HTTPS domain and current proxy/TLS path. Review logs for errors and redact customer data or credentials before sharing them. A healthy container alone does not prove the public route works.
7. Report the deployed commit, migration result, container health, local/public HTTP result, and any unresolved proxy or firewall issue. Do not claim success until the public route works when public availability was part of the request.

## Failure and rollback

- Diagnose with the exact Compose project and service: inspect `docker compose -f docker-compose.yml ps -a`, recent `migrate`/`app` logs, host disk and memory, and proxy status before restarting anything.
- If the app release must be rolled back, use the recorded prior image tag only after checking that the old application is compatible with the current database schema. Prisma migrations are not automatically reversible; never undo them or restore a database as an application rollback.
- For data loss or an incompatible schema, stop writes and follow `saijai-production-backup` with an explicitly selected recovery target and current user approval. Preserve the original Supabase project and R2 archives until recovery is verified.
- Use the explicit production Compose file for stop/start operations. Do not run `docker compose down -v`, `docker system prune --volumes`, or delete Docker volumes/images broadly on a shared VPS. Never remove app or unrelated services to free space without identifying ownership first.

## Useful read-only checks

```bash
docker compose -f docker-compose.yml ps -a
docker compose -f docker-compose.yml logs --tail=100 migrate
docker compose -f docker-compose.yml logs --tail=100 app
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3004/
curl -fsS -o /dev/null -w '%{http_code}\n' https://saijaiphareab.shop
df -h /
free -h
```

The local check assumes the default host port `3004`; substitute the configured `APP_PORT` if it differs. Do not use commands that dump fully interpolated Compose configuration because it may contain secrets.
