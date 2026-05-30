import 'dotenv/config'
import express from 'express'
import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { Pool } from 'pg'
import { JsonImpiantiRepository } from './repositories/JsonImpiantiRepository'
import { JsonPrezzoRepository } from './repositories/JsonPrezzoRepository'
import { PostgresImpiantiRepository } from './repositories/PostgresImpiantiRepository'
import { PostgresPrezzoRepository } from './repositories/PostgresPrezzoRepository'

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

app.post('/api/segnala', async (req, res) => {
  try {
    const { idImpianto, gestore, bandiera, comune, indirizzo, messaggio } = req.body
    if (!messaggio?.trim()) {
      res.status(400).json({ error: 'Il messaggio è obbligatorio' })
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
    // Salva sempre su JSON (locale)
    const filePath = join(__dirname, '..', 'reports.json')
    let reports: unknown[] = []
    try {
      const raw = await readFile(filePath, 'utf-8')
      reports = JSON.parse(raw)
    } catch { /* file non esiste ancora */ }
    reports.push(report)
    await writeFile(filePath, JSON.stringify(reports, null, 2), 'utf-8')

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
  res.sendFile(join(__dirname, '..', '..', 'frontend', 'infoutili.html'))
})

app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'))
})

app.listen(port, () => {
  console.log(`CarburUP server listening on http://localhost:${port}`)
})
