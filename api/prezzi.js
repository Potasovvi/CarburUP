import { Pool } from 'pg'

let pool = null
function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
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
    const result = await getPool().query('SELECT id_impianto, desc_carburante, prezzo, is_self, dt_comu FROM prezzi')
    const prezzi = result.rows.map(row => ({
      idImpianto: row.id_impianto,
      descCarburante: row.desc_carburante,
      prezzo: row.prezzo,
      isSelf: row.is_self,
      dtComu: row.dt_comu ?? '',
    }))
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(prezzi))
  } catch (err) {
    console.error("Errore prezzi:", err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: "Failed to load prezzi" }))
  }
}
