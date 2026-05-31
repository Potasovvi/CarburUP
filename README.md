# CarburUP ⛽

Monitoraggio prezzi carburanti nella provincia di Torino. Dati provenienti dall'Open Data MIMIT, aggiornati quotidianamente.

Copiato con affetto da [BenzUP](https://benzup.netlify.app/).

---

## Prerequisiti

- **Node.js** >= 18 (consigliato 22)
- **npm**
- (Opzionale per locale con DB) Un database PostgreSQL come [Neon](https://neon.tech/) (free tier)

---

## Esecuzione in locale (solo JSON, nessun DB necessario)

```bash
# 1. Clona il repository
git clone https://github.com/tuo-utente/carburup.git
cd carburup

# 2. Installa dipendenze frontend (radice)
npm install

# 3. Installa dipendenze backend
cd backend
npm install
cd ..

# 4. (Opzionale) Scarica i dati — altrimenti l'app parte vuota
cd backend
npm run scrape        # Scarica e filtra gli impianti in provincia di TO
npm run scrape:prezzo # Scarica e incrocia i prezzi con gli impianti TO
cd ..

# 5. Avvia il backend (Express su :3001)
cd backend
npm run dev

# 6. In un altro terminale, avvia il frontend (Vite su :5173)
npm run dev           # dalla radice del progetto
```

Apri `http://localhost:5173` nel browser.

### Con PostgreSQL in locale

Se hai un database PostgreSQL (es. Neon), imposta la variabile d'ambiente e il backend lo utilizzerà al posto dei file JSON:

```bash
# Terminale 1: backend
cd backend
$env:DATABASE_URL="postgresql://user:password@host:5432/dbname"
npm run dev

# Terminale 2: frontend (dalla radice)
npm run dev
```

Per popolare il database con i dati correnti:

```bash
cd backend
$env:DATABASE_URL="postgresql://user:password@host:5432/dbname"
npm run scrape
npm run scrape:prezzo
npm run sync          # Legge i JSON e li carica su PostgreSQL + salva il timestamp
```

---

## Deploy su Vercel

### 1. Database PostgreSQL (Neon — free tier)

1. Vai su [neon.tech](https://neon.tech/) e registrati
2. Crea un nuovo project
3. Dalla dashboard, copia la **connection string** (`postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`)
4. Apri pgAdmin, DBeaver, o usa lo **SQL Editor** di Neon per eseguire lo schema:

```sql
-- Esegui questo sul tuo database Neon
CREATE TABLE IF NOT EXISTS impianti (
  id TEXT PRIMARY KEY,
  gestore TEXT NOT NULL,
  bandiera TEXT,
  comune TEXT,
  provincia TEXT,
  indirizzo TEXT
);

CREATE TABLE IF NOT EXISTS prezzi (
  id TEXT PRIMARY KEY,
  id_impianto TEXT NOT NULL REFERENCES impianti(id),
  desc_carburante TEXT NOT NULL,
  prezzo NUMERIC NOT NULL,
  is_self BOOLEAN NOT NULL,
  dt_comu TEXT
);

CREATE INDEX IF NOT EXISTS idx_prezzi_id_impianto ON prezzi(id_impianto);
CREATE INDEX IF NOT EXISTS idx_prezzi_desc_carburante ON prezzi(desc_carburante);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  id_impianto TEXT,
  gestore TEXT,
  bandiera TEXT,
  comune TEXT,
  indirizzo TEXT,
  messaggio TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS last_update (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Deploy del progetto su Vercel

```bash
# 1. Installa Vercel CLI (una tantum)
npm i -g vercel

# 2. Dalla radice del progetto, esegui il deploy
vercel

# 3. Segui il wizard:
#    - Set up and deploy → "CarburUP"
#    - Framework → Vite
#    - Root directory → ./
#    - Build command → npm run build
#    - Output directory → dist
#    - Aggiungi la variabile d'ambiente: DATABASE_URL = la connection string di Neon
```

### 3. Imposta la variabile d'ambiente su Vercel

Dalla dashboard Vercel:
1. Vai su progetto → **Settings** → **Environment Variables**
2. Aggiungi:
   - **Name**: `DATABASE_URL`
   - **Value**: la connection string di Neon
   - **Environments**: Production + Preview + Development
3. **Redeploy** il progetto (Deployments → ⋮ → Redeploy)

### 4. Configura GitHub Actions (aggiornamento automatico)

1. Vai su **GitHub** → repository → **Settings** → **Secrets and variables** → **Actions**
2. Aggiungi un **New repository secret**:
   - **Name**: `DATABASE_URL`
   - **Value**: la connection string di Neon
3. Il workflow `.github/workflows/scrape.yml` eseguirà automaticamente ogni giorno alle 08:00 UTC lo scraping e il sync su PostgreSQL

### 5. Popola il database per la prima volta

Puoi triggerare manualmente il workflow:
1. GitHub → repository → **Actions**
2. Seleziona **Scrape giornaliero**
3. Clicca **Run workflow** → **Run workflow**

Oppure esegui localmente:

```bash
cd backend
$env:DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"
npm run scrape
npm run scrape:prezzo
npm run sync
```

### 6. Visita il sito

Vai su `https://iltuo-progetto.vercel.app` — vedrai la classifica dei prezzi aggiornata.

---

## Struttura del progetto

```
carburup/
├── api/                    # Vercel Serverless Functions (.js)
│   ├── impianti.js         # GET /api/impianti
│   ├── prezzi.js           # GET /api/prezzi
│   ├── last-update.js      # GET /api/last-update
│   └── segnala.js          # POST /api/segnala
├── backend/
│   ├── src/
│   │   ├── server.ts       # Express server (tutti gli endpoint)
│   │   ├── db.ts           # Pool PostgreSQL singleton
│   │   ├── scraperMimit.ts # Scraper impianti
│   │   ├── scraperPrezzo.ts# Scraper prezzi
│   │   ├── syncToPostgres.ts # Bridge JSON → PostgreSQL
│   │   └── repositories/   # Repository pattern
│   ├── supabase-schema.sql # Schema PostgreSQL
│   └── package.json
├── src/                    # Frontend React (Vite)
│   ├── App.tsx             # Componente principale
│   ├── App.css             # Stili
│   └── main.tsx            # Entry point
├── public/
│   └── infoutili.html      # Pagina informativa
├── .github/workflows/
│   └── scrape.yml          # GitHub Actions daily scrape
├── vercel.json
├── vite.config.ts
└── package.json
```

---

## API endpoints

| Endpoint | Metodo | Descrizione |
|---|---|---|
| `/api/impianti` | GET | Elenco di tutti gli impianti in provincia di TO |
| `/api/prezzi` | GET | Elenco di tutti i prezzi per gli impianti TO |
| `/api/last-update` | GET | Timestamp ISO dell'ultimo aggiornamento (`last_scrape`) |
| `/api/segnala` | POST | Invia una segnalazione per un impianto |

---

## License

MIT
