import { Pool } from 'pg'

let pool = null
function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
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
    const result = await getPool().query("SELECT value FROM last_update WHERE key = 'last_scrape'")
    const lastUpdate = result.rows.length > 0 ? result.rows[0].value : null
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ lastUpdate }))
  } catch (err) {
    console.error("Errore last-update:", err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: "Failed to load last update" }))
  }
}
