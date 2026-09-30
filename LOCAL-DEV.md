# Family Dashbox — local dev + screenshot setup

Working recipe for running this fork locally on macOS (Colima) for design work.
Demo data only; nothing exposed to the internet. Secrets stay in gitignored `.env` files.

## Stack up (once per boot)
```bash
colima start --cpu 4 --memory 8 --disk 60           # container runtime (no Docker Desktop)
cd webapp/docker
export CF="-f docker-compose.yml -f docker-compose.image.yml -f docker-compose.demo.yml"
docker-compose $CF up -d                              # Supabase + webapp (prebuilt arm64 image) + mocks
./start.sh seed-demo                                  # demo family, join code DEMO01
docker stop kinboard-cron                             # stop hourly demo-reset so DB tweaks below persist
```

Host ports: Kong/Supabase `:8100`, dockerized webapp `:3002`, Postgres `:5432`.

## Dev server on :3001 (design work — hot reload, shows restyle)
```bash
cd webapp && npm install
npm run dev -- -p 3001
```
The **:3002** container is the *unmodified upstream image* — restyle changes only show on the
**:3001 dev server**.

### Fixes that were required to make :3001 fully render (all in gitignored files)
- `webapp/.env.local` needs **`JWT_SECRET`** (copied from `webapp/docker/.env`) — without it
  `/api/session/token` 500s and the app bounces to /join.
- `webapp/.env.local` weather: `OPENWEATHERMAP_API_KEY=demo-not-real` +
  `OPENWEATHERMAP_BASE_URL=http://localhost:8125`.
- Mock servers are docker-internal; published to host in `docker-compose.demo.yml`
  (added `ports:` — weather `8125`, HA `8123`, tesla `8124`).
- Repoint the demo's HA/Tesla URLs at the host (they point at docker hostnames):
  ```bash
  docker exec kinboard-db psql -U postgres -d postgres -c \
    "UPDATE public.settings SET value=regexp_replace(value::text,'mock-ha:8123','localhost:8123','g')::jsonb WHERE value::text LIKE '%mock-ha:8123%';"
  ```
  (Re-run after any `seed-demo`. Cron is stopped so it won't auto-revert.)

## Screenshots
Harness: `../screenshots/shoot.mjs` (outside the repo, keeps git clean). Run from `webapp/`:
```bash
SHOT_DIR=../../screenshots/baseline node ../../screenshots/shoot.mjs   # before
SHOT_DIR=../../screenshots/after    node ../../screenshots/shoot.mjs   # after
```
Captures dashboard/calendar/shopping/weather-modal × light/dark × phone/tablet/wall-landscape/wall-portrait.
Key gotchas baked in: session via `/api/session/join` API (not the flaky UI join);
`reducedMotion:"reduce"` (a global `animation:0s` override makes Framer-Motion widgets invisible);
wait for real `<main>` content before shooting.
