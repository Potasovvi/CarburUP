# CarburUP — Agent Instructions

Monorepo (backend + frontend) for monitoring fuel prices in Turin, Italy. Data is scraped from the MIMIT Open Data portal.

## Architecture

```
backend/       Express API (:3001) — serves /api/impianti + /api/prezzi + static frontend dist
frontend/      Vite + React (:5173) — proxies /api → :3001 in dev
```

- **Repository pattern**: `IImpiantiRepository` and `IPrezzoRepository` have two implementations:
  - `JsonImpiantiRepository` / `JsonPrezzoRepository` — UPSERT into JSON files (`database.json`, `prezzo.json`)
  - `SupabaseImpiantiRepository` / `SupabasePrezzoRepository` — UPSERT into Supabase PostgreSQL (when `SUPABASE_URL` + `SUPABASE_KEY` are set)
  - Selection happens in `server.ts`: if both env vars are present, Supabase repos are used; otherwise JSON fallback
- **Scraper (impianti)**: fetches `anagrafica_impianti_attivi.csv` from MIMIT, filters rows where `Provincia === "TO"`, upserts by `idImpianto`
- **Scraper (prezzi)**: fetches `prezzo_alle_8.csv` from MIMIT, cross-references `database.json` to filter only TO stations, upserts by `idImpianto|descCarburante|isSelf`
- **Sync**: `npm run sync` reads JSON files and upserts into Supabase (bridge for GitHub Actions → Supabase)
- **Reports**: `POST /api/segnala` saves to `reports.json` always, plus Supabase if configured
- **No test framework** set up (both packages)

## Commands

```sh
# Backend (from backend/)
npm run dev        # tsx watch src/server.ts — hot-reload Express on :3001
npm run typecheck  # tsc --noEmit
npm run scrape         # tsx src/scraperMimit.ts — fetches, filters TO, saves to database.json
npm run scrape:prezzo  # tsx src/scraperPrezzo.ts — fetches, cross-ref, saves to prezzo.json
npm run sync           # tsx src/syncToSupabase.ts — reads JSON, upserts into Supabase
npm run build          # tsc → dist/

# Frontend (from frontend/)
npm run dev        # Vite dev :5173, proxies /api → localhost:3001
npm run typecheck  # tsc --noEmit
npm run build      # tsc -b && vite build → dist/
```

Set `PORT` env to change backend port (default `3001`).

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

- Frontend tsconfig: `noEmit: true`, `strict`, `noUnusedLocals`, `noUnusedParameters`
- `database.json` is gitignored, auto-created on first scrape
- `prezzo.json` is gitignored, auto-created on first prezzo scrape
- `reports.json` is gitignored, auto-created on first segnala
- Backend serves `frontend/dist/` as static in production; Vite proxies in dev

## Supabase (ibrido)

- **Tables** (schema in `backend/supabase-schema.sql`):
  - `impianti` — `id TEXT PK, gestore, bandiera, comune, provincia, indirizzo`
  - `prezzi` — `id TEXT PK, id_impianto TEXT FK, desc_carburante, prezzo NUMERIC, is_self BOOLEAN, dt_comu`
  - `reports` — `id TEXT PK, id_impianto, gestore, bandiera, comune, indirizzo, messaggio, created_at TIMESTAMPTZ`
- **Hybrid logic**: set `SUPABASE_URL` + `SUPABASE_KEY` env vars → server reads/writes Supabase instead of JSON
- **Sync**: `npm run sync` (in `backend/`) reads JSON files, upserts into Supabase — used by GitHub Actions
- Scrapers always write to JSON files first (work offline). `npm run sync` is the bridge to Supabase.

## GitHub Actions

File: `.github/workflows/scrape.yml`

- **Trigger**: `cron: '0 8 * * *'` (08:00 UTC = 10:00 CET / 09:00 CEST) + `workflow_dispatch` (manual)
- **Job steps**: `npm ci` → `npm run scrape` → `npm run scrape:prezzo` → `npm run sync`
- **Secrets required**: `SUPABASE_URL`, `SUPABASE_KEY`
