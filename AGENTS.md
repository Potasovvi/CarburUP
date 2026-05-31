# CarburUP — Agent Instructions

Monorepo (backend + frontend) for monitoring fuel prices in Turin, Italy. Data is scraped from the MIMIT Open Data portal.

## Architecture

```
backend/       Express API (:3001) — serves /api/impianti, /api/prezzi, /api/last-update, /api/segnala (local dev)
api/           Vercel Serverless Functions (.js) — GET /api/impianti, GET /api/prezzi, GET /api/last-update, POST /api/segnala (production)
src/           Vite + React (:5173) — proxies /api → :3001 in dev, served by Vercel in production
frontend/      Legacy frontend dir (not used — everything is at root src/)
```

- **Repository pattern**: `IImpiantiRepository` and `IPrezzoRepository` have two implementations:
  - `JsonImpiantiRepository` / `JsonPrezzoRepository` — UPSERT into JSON files (`database.json`, `prezzo.json`)
  - `PostgresImpiantiRepository` / `PostgresPrezzoRepository` — UPSERT into PostgreSQL (when `DATABASE_URL` is set)
  - In local dev (`server.ts`): if `DATABASE_URL` is present, Postgres repos are used; otherwise JSON fallback
  - In production (Vercel `api/` functions): always use Postgres repos via `DATABASE_URL`
- **Scraper (impianti)**: fetches `anagrafica_impianti_attivi.csv` from MIMIT, filters rows where `Provincia === "TO"`, upserts by `idImpianto`
- **Scraper (prezzi)**: fetches `prezzo_alle_8.csv` from MIMIT, cross-references `database.json` to filter only TO stations, upserts by `idImpianto|descCarburante|isSelf`
- **Sync**: `npm run sync` reads JSON files and upserts into PostgreSQL (bridge for GitHub Actions → PostgreSQL). Also saves the current timestamp in the `last_update` table.
- **Reports**: `POST /api/segnala` saves to PostgreSQL only (production Vercel); saves to `reports.json` + PostgreSQL (local dev)
- **Last update**: `GET /api/last-update` reads from the `last_update` table (key `last_scrape`). In local dev with JSON fallback, uses the `mtime` of `database.json`.
- **No test framework** set up (both packages)

## Commands

```sh
# Backend (from backend/)
npm run dev        # tsx watch src/server.ts — hot-reload Express on :3001
npm run typecheck  # tsc --noEmit
npm run scrape         # tsx src/scraperMimit.ts — fetches, filters TO, saves to database.json
npm run scrape:prezzo  # tsx src/scraperPrezzo.ts — fetches, cross-ref, saves to prezzo.json
npm run sync           # tsx src/syncToPostgres.ts — reads JSON, upserts into PostgreSQL, saves last_update
npm run build          # tsc → dist/

# Frontend / Vercel (from project root)
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
| Frontend / Root | ESM      | Vite + tsc -b |
| API (Vercel) | JavaScript (.js) | Node.js native (no transpilation needed) |

- Root tsconfig: `noEmit: true`, `strict`, `noUnusedLocals`, `noUnusedParameters`
- `database.json` is gitignored, auto-created on first scrape
- `prezzo.json` is gitignored, auto-created on first prezzo scrape
- `reports.json` is gitignored, auto-created on first segnala (local dev only)
- Backend serves `frontend/dist/` as static in development; Vercel serves it in production

## PostgreSQL

- **Tables** (schema in `backend/supabase-schema.sql`):
  - `impianti` — `id TEXT PK, gestore, bandiera, comune, provincia, indirizzo`
  - `prezzi` — `id TEXT PK, id_impianto TEXT FK, desc_carburante, prezzo NUMERIC, is_self BOOLEAN, dt_comu`
  - `reports` — `id TEXT PK, id_impianto, gestore, bandiera, comune, indirizzo, messaggio, created_at TIMESTAMPTZ`
  - `last_update` — `key TEXT PK, value TEXT, updated_at TIMESTAMPTZ`
- **Hybrid logic**: set `DATABASE_URL` env var → server reads/writes PostgreSQL instead of JSON
- **Sync**: `npm run sync` (in `backend/`) reads JSON files, upserts into PostgreSQL, and saves `last_update` — used by GitHub Actions
- **last_update**: populated by `syncToPostgres.ts` with the sync timestamp; `CREATE TABLE IF NOT EXISTS` is called before every access in all entry points
- Scrapers always write to JSON files first (work offline). `npm run sync` is the bridge to PostgreSQL.

## Vercel (production)

- **Frontend**: deployed as static site (Vite build → `dist/`)
- **API**: 4 serverless functions in `api/` at project root:
  - `api/impianti.js` → GET /api/impianti
  - `api/prezzi.js` → GET /api/prezzi
  - `api/segnala.js` → POST /api/segnala
  - `api/last-update.js` → GET /api/last-update
- **Vercel API files are plain JavaScript** (`.js`), not TypeScript — Vercel does not auto-compile `.ts` in `api/` without additional config. Each function is self-contained with inline pool creation.
- **Static file**: `public/infoutili.html` served at `/infoutili`
- **Config**: `vercel.json` at root (build command, routes)
- **Required env var**: `DATABASE_URL` (Neon or other PostgreSQL connection string)

## GitHub Actions

File: `.github/workflows/scrape.yml`

- **Trigger**: `cron: '0 8 * * *'` (08:00 UTC = 10:00 CET / 09:00 CEST) + `workflow_dispatch` (manual)
- **Job steps**: `npm ci` → `npm run scrape` → `npm run scrape:prezzo` → `npm run sync`
- **What sync does**: reads JSON files → upserts into PostgreSQL → **saves timestamp in `last_update` table** (key `last_scrape`)
- **Secrets required**: `DATABASE_URL`

## Frontend (last_update display)

- `src/App.tsx` fetches `/api/last-update` on mount alongside impianti and prezzi
- The timestamp is displayed in the **header** (right side, in `.meta-badge`) as `Ultimo aggiornamento: <data>`
- If `lastUpdate` is null, nothing is shown

## Cost-sensitive development policy

- Always prefer free tiers or very low-cost solutions.
- When a proposed service, dependency, or infrastructure choice involves any cost (even $1/month), proactively flag it to the user before implementing.
- Keep total monthly cost at $0 whenever possible.
