import { Pool } from 'pg'

let pool = null
function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 5000 })
  }
  return pool
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: "Method not allowed" }))
    return
  }
  try {
    await getPool().query(`CREATE TABLE IF NOT EXISTS impianti (
      id TEXT PRIMARY KEY, gestore TEXT NOT NULL, bandiera TEXT,
      comune TEXT, provincia TEXT, indirizzo TEXT
    )`)
    const result = await getPool().query('SELECT id, gestore, bandiera, comune, provincia, indirizzo FROM impianti ORDER BY gestore')
    const impianti = result.rows.map(row => ({
      id: row.id,
      Gestore: row.gestore,
      Bandiera: row.bandiera ?? '',
      Comune: row.comune ?? '',
      Provincia: row.provincia ?? '',
      Indirizzo: row.indirizzo ?? '',
    }))
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(impianti))
  } catch (err) {
    console.error("Errore impianti:", err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: "Failed to load impianti" }))
  }
}
