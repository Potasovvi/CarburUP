# CarburUP — Agent Instructions

Monorepo (backend + frontend) for monitoring fuel prices in Turin, Italy. Data is scraped from the MIMIT Open Data portal.

## Architecture

```
backend/       Express API (:3001) — serves /api/impianti + /api/prezzi (local dev only)
frontend/      Vite + React (:5173) — proxies /api → :3001 in dev, served by Vercel in production
frontend/lib/  Shared code (db.ts, repos) — imported by Vercel functions and usable by backend
frontend/api/  Vercel Serverless Functions — GET /api/impianti, GET /api/prezzi, POST /api/segnala (production)
```

- **Repository pattern**: `IImpiantiRepository` and `IPrezzoRepository` have two implementations:
  - `JsonImpiantiRepository` / `JsonPrezzoRepository` — UPSERT into JSON files (`database.json`, `prezzo.json`)
  - `PostgresImpiantiRepository` / `PostgresPrezzoRepository` — UPSERT into PostgreSQL (when `DATABASE_URL` is set)
  - In local dev (`server.ts`): if `DATABASE_URL` is present, Postgres repos are used; otherwise JSON fallback
  - In production (Vercel `api/` functions): always use Postgres repos via `DATABASE_URL`
- **Scraper (impianti)**: fetches `anagrafica_impianti_attivi.csv` from MIMIT, filters rows where `Provincia === "TO"`, upserts by `idImpianto`
- **Scraper (prezzi)**: fetches `prezzo_alle_8.csv` from MIMIT, cross-references `database.json` to filter only TO stations, upserts by `idImpianto|descCarburante|isSelf`
- **Sync**: `npm run sync` reads JSON files and upserts into PostgreSQL (bridge for GitHub Actions → PostgreSQL)
- **Reports**: `POST /api/segnala` saves to PostgreSQL only (production Vercel); saves to `reports.json` + PostgreSQL (local dev)
- **No test framework** set up (both packages)

## Commands

```sh
# Backend (from backend/)
npm run dev        # tsx watch src/server.ts — hot-reload Express on :3001
npm run typecheck  # tsc --noEmit
npm run scrape         # tsx src/scraperMimit.ts — fetches, filters TO, saves to database.json
npm run scrape:prezzo  # tsx src/scraperPrezzo.ts — fetches, cross-ref, saves to prezzo.json
npm run sync           # tsx src/syncToPostgres.ts — reads JSON, upserts into PostgreSQL
npm run build          # tsc → dist/

# Frontend (from frontend/)
npm run dev        # Vite dev :5173, proxies /api → localhost:3001
npm run typecheck  # tsc --noEmit
npm run build      # tsc -b && vite build → dist/
```

Set `PORT` env to change backend port (default `3001`).  
Set `DATABASE_URL` env to use PostgreSQL instead of JSON files (e.g. `postgresql://user:password@host:5432/dbname`).

## Scraper quirks

- MIMIT CSV format: first line is extraction date (ignored), line 2 is pipe-delimited header, rest is pipe-delimited data
- Link is found by anchor text `"Anagrafica degli impianti attivi"` — may break if MIMIT changes layout
- May serve direct `.csv` or `.zip` (containing CSV); both handled
- Requires internet; CSV uses `|` delimiter (not `;`)
- All domain text is Italian (Gestore, Bandiera, Comune, Provincia, Indirizzo)
- Prezzo scraper needs `database.json` to exist (run `npm run scrape` first)

## Key config

| Layer    | Module system | Runner        |
|----------|---------------|---------------|
| Backend  | CommonJS      | tsx (not ts-node) |
| Frontend | ESM           | Vite + tsc -b |
| API (Vercel) | TypeScript | @vercel/node (esbuild) |

- Frontend tsconfig: `noEmit: true`, `strict`, `noUnusedLocals`, `noUnusedParameters`
- `database.json` is gitignored, auto-created on first scrape
- `prezzo.json` is gitignored, auto-created on first prezzo scrape
- `reports.json` is gitignored, auto-created on first segnala (local dev only)
- Backend serves `frontend/dist/` as static in development; Vercel serves it in production

## PostgreSQL

- **Tables** (schema in `backend/supabase-schema.sql`):
  - `impianti` — `id TEXT PK, gestore, bandiera, comune, provincia, indirizzo`
  - `prezzi` — `id TEXT PK, id_impianto TEXT FK, desc_carburante, prezzo NUMERIC, is_self BOOLEAN, dt_comu`
  - `reports` — `id TEXT PK, id_impianto, gestore, bandiera, comune, indirizzo, messaggio, created_at TIMESTAMPTZ`
- **Hybrid logic**: set `DATABASE_URL` env var → server reads/writes PostgreSQL instead of JSON
- **Sync**: `npm run sync` (in `backend/`) reads JSON files, upserts into PostgreSQL — used by GitHub Actions
- Scrapers always write to JSON files first (work offline). `npm run sync` is the bridge to PostgreSQL.

## Vercel (production)

- **Frontend**: deployed as static site (Vite build → `frontend/dist/`)
- **API**: 3 serverless functions in `frontend/api/`:
  - `frontend/api/impianti.ts` → GET /api/impianti
  - `frontend/api/prezzi.ts` → GET /api/prezzi
  - `frontend/api/segnala.ts` → POST /api/segnala
- **Shared code**: `frontend/lib/` mirrors `backend/src/db.ts` + repositories (Vercel can't access `backend/` with root dir `/frontend`)
- **Static file**: `frontend/public/infoutili.html` served at `/infoutili`
- **Config**: `frontend/vercel.json` (build command, routes, function runtime)
- **Required env var**: `DATABASE_URL` (Neon or other PostgreSQL connection string)
- `infoutili.html` lives in `frontend/public/` so Vite copies it to `dist/` during build

## GitHub Actions

File: `.github/workflows/scrape.yml`

- **Trigger**: `cron: '0 8 * * *'` (08:00 UTC = 10:00 CET / 09:00 CEST) + `workflow_dispatch` (manual)
- **Job steps**: `npm ci` → `npm run scrape` → `npm run scrape:prezzo` → `npm run sync`
- **Secrets required**: `DATABASE_URL`

## Cost-sensitive development policy

- Always prefer free tiers or very low-cost solutions.
- When a proposed service, dependency, or infrastructure choice involves any cost (even $1/month), proactively flag it to the user before implementing.
- Keep total monthly cost at $0 whenever possible.
