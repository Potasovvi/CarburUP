# CarburUP — Agent Instructions

Monorepo (backend + frontend) for monitoring fuel prices in Turin, Italy. Data scraped from MIMIT Open Data portal.

## Commands

```sh
# Backend (from backend/)
npm run dev        # tsx watch src/server.ts — hot-reload Express on :3001
npm run typecheck  # tsc --noEmit
npm run scrape         # tsx src/scraperMimit.ts — fetches impianti CSV, filters TO, saves to database.json
npm run scrape:prezzo  # tsx src/scraperPrezzo.ts — fetches prezzi CSV, cross-refs database.json, saves to prezzo.json
npm run sync           # tsx src/syncToPostgres.ts — reads JSON, upserts into PostgreSQL, saves last_update
npm run build          # tsc → dist/

# Frontend / Vercel (from root)
npm run dev        # Vite dev :5173, proxies /api → localhost:3001
npm run typecheck  # tsc --noEmit
npm run build      # tsc -b && vite build → dist/
```

Set `PORT` env to change backend port (default `3001`).
Set `DATABASE_URL` env to switch from JSON files to PostgreSQL.

## Architecture

```
backend/       Express API (:3001)
api/           Vercel Serverless Functions (.js) — production
src/           Vite + React (:5173)
frontend/      Legacy dir (not used — everything at root src/)
```

- **Repository pattern**: `IImpiantiRepository` / `IPrezzoRepository` with JSON (default) or Postgres (when `DATABASE_URL` set) implementations
- In local dev: if `DATABASE_URL` present → Postgres repos; otherwise JSON fallback
- In Vercel (production): always Postgres via `DATABASE_URL`
- **Scrapers** always write to JSON files first. `npm run sync` is the bridge to PostgreSQL.
- **No test framework** set up (both packages)

## Scraper quirks

- MIMIT CSV format: line 1 = extraction date (ignored), line 2 = pipe-delimited header, rest = pipe-delimited data
- Link found by anchor text `"Anagrafica degli impianti attivi"` / `"Prezzo alle 8 di mattina"` — fragile to MIMIT layout changes
- May serve `.csv` or `.zip` (containing CSV); both handled
- CSV uses `|` delimiter, Italian locale (comma as decimal separator — handled by `.replace(',', '.')`)
- CSV encoding is ISO-8859-1 (Latin-1) — `bufferToString` detects UTF-8 validity and falls back to latin1
- Prezzo scraper needs `database.json` to exist (run `npm run scrape` first)
- All axios GET calls have `timeout: 30000`

## Key config

| Layer | Module | Runner |
|-------|--------|--------|
| Backend | CommonJS | tsx |
| Frontend/Root | ESM | Vite + tsc -b |
| API (Vercel) | JavaScript (.js) | Node.js native |

- Root tsconfig: `noEmit: true`, `strict`, `noUnusedLocals`, `noUnusedParameters`
- `database.json`, `prezzo.json`, `reports.json` are gitignored, auto-created
- JSON writes use atomic write (temp file + rename) to prevent corruption
- Backend serves `frontend/dist/` as static in dev; Vercel serves it in production

## PostgreSQL

- **Tables** (schema in `backend/supabase-schema.sql`):
  - `impianti` — `id TEXT PK, gestore, bandiera, comune, provincia, indirizzo`
  - `prezzi` — `id TEXT PK, id_impianto TEXT FK, desc_carburante, prezzo NUMERIC, is_self BOOLEAN, dt_comu`
  - `reports` — `id TEXT PK, id_impianto, gestore, bandiera, comune, indirizzo, messaggio, created_at TIMESTAMPTZ`
  - `last_update` — `key TEXT PK, value TEXT, updated_at TIMESTAMPTZ`
- `syncToPostgres.ts` and `api/last-update.js` call `CREATE TABLE IF NOT EXISTS`; **`api/impianti.js`, `api/prezzi.js`, `api/segnala.js` do NOT** — tables must exist or first request returns 500

## Vercel (production)

- **4 serverless functions** in `api/` at root (plain `.js` files):
  - `api/impianti.js` → GET /api/impianti
  - `api/prezzi.js` → GET /api/prezzi
  - `api/segnala.js` → POST /api/segnala (no body size limit — consider adding one)
  - `api/last-update.js` → GET /api/last-update
- Pool configs: `last-update.js` uses `max: 2`, others use default `max: 10` — inconsistent
- Static file: `public/infoutili.html` at `/infoutili`
- Required env: `DATABASE_URL`

## GitHub Actions

- File: `.github/workflows/scrape.yml`
- **Trigger**: `cron: '0 12 * * *'` (12:00 UTC = 14:00 CET / 15:00 CEST) + `workflow_dispatch`
- **Secrets**: `DATABASE_URL`
- **Steps**: `npm ci` → `npm run scrape` → `npm run scrape:prezzo` → `npm run sync`
- No dependency caching — each run does full `npm ci`

## Frontend (last_update display)

- `src/App.tsx` fetches `/api/last-update` on mount alongside impianti/prezzi
- Displayed in header as `Ultimo aggiornamento: <data>` (`.meta-badge`)
- If `lastUpdate` is null, nothing is shown

## Obsolescenze note

- `csv-parser` in `backend/package.json` — mai importato, rimuovere
- `@types/express-rate-limit` — deprecato (express-rate-limit v6+ include i propri tipi)
- `@vercel/node` in `backend/devDependencies` — non usato (le API Vercel sono `.js`)
