import { createClient } from '@supabase/supabase-js'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { Impianto } from './repositories/IImpiantiRepository'
import { Prezzo } from './repositories/IPrezzoRepository'
import { SupabaseImpiantiRepository } from './repositories/SupabaseImpiantiRepository'
import { SupabasePrezzoRepository } from './repositories/SupabasePrezzoRepository'

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('ERRORE: SUPABASE_URL e SUPABASE_KEY devono essere impostati')
    process.exit(1)
  }

  const client = createClient(supabaseUrl, supabaseKey)
  const impiantiRepo = new SupabaseImpiantiRepository(client)
  const prezziRepo = new SupabasePrezzoRepository(client)

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

  console.log('Sincronizzazione completata con successo')
}

main()
