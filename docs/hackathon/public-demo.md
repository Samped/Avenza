# Public demo hosting

Judges need a URL — not localhost.

## Fast path (recommended)

```bash
# 1. Ensure .env has JWT_SECRET, DATABASE, TapeOut vars
cp .env.example .env   # then edit

# 2. Build & run
docker compose -f docker-compose.demo.yml up --build -d

# 3. Migrate + seed (one-shot)
docker compose -f docker-compose.demo.yml exec api \
  sh -c "npm run db:push -w @avenza/api && npm run db:seed -w @avenza/api"
```

Expose with your host / reverse proxy, or tunnel:

```bash
# example
npx localtunnel --port 3000
# also tunnel API :3001 and set NEXT_PUBLIC_API_URL to the public API URL, rebuild web
```

## Vercel + Railway pattern

- **Web:** Vercel → `apps/web`, env `NEXT_PUBLIC_API_URL`
- **API + Postgres + Redis:** Railway/Fly → `apps/api`
- Set TapeOut env vars on API; keep `ALLOW_SIMULATED_SETTLEMENT=true` until contracts are funded on X Layer

## Smoke

Open `/tapeout` — must show live `eval` pass/fail without login.  
Open `/` → Create account → workspace → `/app/hack` for settlement mode + processor links.
