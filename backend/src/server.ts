import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { join } from 'path'
import { readFile, stat } from 'fs/promises'
import { Pool } from 'pg'
import { JsonImpiantiRepository } from './repositories/JsonImpiantiRepository'
import { JsonPrezzoRepository } from './repositories/JsonPrezzoRepository'
import { PostgresImpiantiRepository } from './repositories/PostgresImpiantiRepository'
import { PostgresPrezzoRepository } from './repositories/PostgresPrezzoRepository'
import { atomicWrite } from './atomicWrite'

const app = express()
const port = Number(process.env.PORT) || 3001

const databaseUrl = process.env.DATABASE_URL
const usePostgres = !!databaseUrl
let pool: Pool | null = null
if (usePostgres) {
  pool = new Pool({ connectionString: databaseUrl })
}

const impiantiRepo = usePostgres
  ? new PostgresImpiantiRepository(pool!)
  : new JsonImpiantiRepository()
const prezziRepo = usePostgres
  ? new PostgresPrezzoRepository(pool!)
  : new JsonPrezzoRepository()

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
}))
app.use(express.json())
app.use(express.static(join(__dirname, '..', '..', 'frontend', 'dist')))

app.get('/api/impianti', async (_req, res) => {
  try {
    const impianti = await impiantiRepo.findAll()
    res.json(impianti)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load impianti' })
  }
})

app.get('/api/prezzi', async (_req, res) => {
  try {
    const prezzi = await prezziRepo.findAll()
    res.json(prezzi)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load prezzi' })
  }
})

app.get('/api/last-update', async (_req, res) => {
  try {
    if (pool) {
      await pool.query(`CREATE TABLE IF NOT EXISTS last_update (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`)
      const result = await pool.query("SELECT value FROM last_update WHERE key = 'last_scrape'")
      if (result.rows.length > 0) {
        res.json({ lastUpdate: result.rows[0].value })
        return
      }
    }
    const filePath = join(__dirname, '..', 'database.json')
    const stats = await stat(filePath)
    res.json({ lastUpdate: stats.mtime.toISOString() })
  } catch (err) {
    console.error('Errore last-update:', err)
    res.json({ lastUpdate: null })
  }
})

const segnalaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Troppe richieste, riprova tra un minuto' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.post('/api/segnala', segnalaLimiter, async (req, res) => {
  try {
    const { idImpianto, gestore, bandiera, comune, indirizzo, messaggio } = req.body
    if (!messaggio?.trim()) {
      res.status(400).json({ error: 'Il messaggio è obbligatorio' })
      return
    }
    if (messaggio.length > 1000) {
      res.status(400).json({ error: 'Il messaggio non può superare i 1000 caratteri' })
      return
    }
    if (typeof idImpianto !== 'string' || idImpianto.length > 50) {
      res.status(400).json({ error: 'Parametri non validi' })
      return
    }
    if (gestore !== undefined && (typeof gestore !== 'string' || gestore.length > 100)) {
      res.status(400).json({ error: 'Parametri non validi' })
      return
    }
    if (bandiera !== undefined && (typeof bandiera !== 'string' || bandiera.length > 100)) {
      res.status(400).json({ error: 'Parametri non validi' })
      return
    }
    if (comune !== undefined && (typeof comune !== 'string' || comune.length > 100)) {
      res.status(400).json({ error: 'Parametri non validi' })
      return
    }
    if (indirizzo !== undefined && (typeof indirizzo !== 'string' || indirizzo.length > 200)) {
      res.status(400).json({ error: 'Parametri non validi' })
      return
    }
    const report = {
      id: `${Date.now()}`,
      idImpianto: idImpianto ?? '',
      gestore: gestore ?? '',
      bandiera: bandiera ?? '',
      comune: comune ?? '',
      indirizzo: indirizzo ?? '',
      messaggio: messaggio.trim(),
      createdAt: new Date().toISOString(),
    }
    // Salva sempre su JSON (locale) — con scrittura atomica
    const filePath = join(__dirname, '..', 'reports.json')
    let reports: unknown[] = []
    try {
      const raw = await readFile(filePath, 'utf-8')
      reports = JSON.parse(raw)
      if (!Array.isArray(reports)) reports = []
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        // file non esiste, si parte da array vuoto
      } else {
        throw err
      }
    }
    reports.push(report)
    await atomicWrite(filePath, JSON.stringify(reports, null, 2))

    // Se PostgreSQL è configurato, salva anche lì
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO reports (id, id_impianto, gestore, bandiera, comune, indirizzo, messaggio, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [report.id, report.idImpianto, report.gestore, report.bandiera, report.comune, report.indirizzo, report.messaggio, report.createdAt]
        )
      } catch (err) {
        console.error('Errore salvataggio su PostgreSQL:', err)
      }
    }

    res.json({ success: true, id: report.id })
  } catch (err) {
    console.error('Errore salvataggio segnalazione:', err)
    res.status(500).json({ error: 'Errore durante il salvataggio della segnalazione' })
  }
})

app.get('/infoutili', (_req, res) => {
  res.sendFile(join(__dirname, '..', '..', 'frontend', 'public', 'infoutili.html'))
})

app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'))
})

app.listen(port, () => {
  console.log(`CarburUP server listening on http://localhost:${port}`)
})
