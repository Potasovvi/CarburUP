import express from 'express'
import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { JsonImpiantiRepository } from './repositories/JsonImpiantiRepository'
import { JsonPrezzoRepository } from './repositories/JsonPrezzoRepository'
import { SupabaseImpiantiRepository } from './repositories/SupabaseImpiantiRepository'
import { SupabasePrezzoRepository } from './repositories/SupabasePrezzoRepository'

const app = express()
const port = Number(process.env.PORT) || 3001

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const useSupabase = !!(supabaseUrl && supabaseKey)
let supabase: SupabaseClient | null = null
if (useSupabase) {
  supabase = createClient(supabaseUrl, supabaseKey)
}

const impiantiRepo = useSupabase
  ? new SupabaseImpiantiRepository(supabase!)
  : new JsonImpiantiRepository()
const prezziRepo = useSupabase
  ? new SupabasePrezzoRepository(supabase!)
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

    // Se Supabase è configurato, salva anche lì
    if (supabase) {
      const { error } = await supabase.from('reports').insert({
        id: report.id,
        id_impianto: report.idImpianto,
        gestore: report.gestore,
        bandiera: report.bandiera,
        comune: report.comune,
        indirizzo: report.indirizzo,
        messaggio: report.messaggio,
        created_at: report.createdAt,
      })
      if (error) console.error('Errore salvataggio su Supabase:', error)
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
