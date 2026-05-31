import 'dotenv/config'
import { Pool } from 'pg'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { Impianto } from './repositories/IImpiantiRepository'
import { Prezzo } from './repositories/IPrezzoRepository'
import { PostgresImpiantiRepository } from './repositories/PostgresImpiantiRepository'
import { PostgresPrezzoRepository } from './repositories/PostgresPrezzoRepository'

async function main() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    console.error('ERRORE: DATABASE_URL deve essere impostato')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const impiantiRepo = new PostgresImpiantiRepository(pool)
  const prezziRepo = new PostgresPrezzoRepository(pool)

  const dbPath = join(__dirname, '..', 'database.json')
  const prezzoPath = join(__dirname, '..', 'prezzo.json')

  // Sync impianti
  try {
    const impiantiRaw = await readFile(dbPath, 'utf-8')
    const impianti: Impianto[] = JSON.parse(impiantiRaw)
    if (impianti.length > 0) {
      await impiantiRepo.upsertMany(impianti)
      console.log(`✓ Sincronizzati ${impianti.length} impianti`)
    } else {
      console.log('! Nessun impianto da sincronizzare')
    }
  } catch (err) {
    console.error('ERRORE lettura database.json:', err)
    process.exit(1)
  }

  // Sync prezzi
  try {
    const prezziRaw = await readFile(prezzoPath, 'utf-8')
    const prezzi: Prezzo[] = JSON.parse(prezziRaw)
    if (prezzi.length > 0) {
      await prezziRepo.upsertMany(prezzi)
      console.log(`✓ Sincronizzati ${prezzi.length} prezzi`)
    } else {
      console.log('! Nessun prezzo da sincronizzare')
    }
  } catch (err) {
    console.error('ERRORE lettura prezzo.json:', err)
    process.exit(1)
  }

  // Salva timestamp ultimo aggiornamento
  try {
    const now = new Date().toISOString()
    await pool.query(
      `INSERT INTO last_update (key, value, updated_at) VALUES ('last_scrape', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [now]
    )
  } catch (err) {
    console.error('ERRORE salvataggio last_update:', err)
  }

  await pool.end()
  console.log('Sincronizzazione completata con successo')
}

main()
