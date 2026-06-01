import { Pool } from 'pg'

let pool = null
function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 5000 })
  }
  return pool
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: "Method not allowed" }))
    return
  }

  const MAX_BODY_BYTES = 102400 // 100 KB
  try {
    let body = ''
    for await (const chunk of req) {
      body += chunk
      if (body.length > MAX_BODY_BYTES) {
        res.statusCode = 413
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Body troppo grande' }))
        return
      }
    }
    const { idImpianto, gestore, bandiera, comune, indirizzo, messaggio } = JSON.parse(body)

    if (!messaggio?.trim()) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: "Il messaggio è obbligatorio" }))
      return
    }
    if (typeof messaggio !== 'string' || messaggio.length > 1000) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: "Il messaggio non può superare i 1000 caratteri" }))
      return
    }
    if (typeof idImpianto !== 'string' || idImpianto.length > 50) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: "Parametri non validi" }))
      return
    }
    if (gestore !== undefined && (typeof gestore !== 'string' || gestore.length > 100)) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: "Parametri non validi" }))
      return
    }
    if (bandiera !== undefined && (typeof bandiera !== 'string' || bandiera.length > 100)) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: "Parametri non validi" }))
      return
    }
    if (comune !== undefined && (typeof comune !== 'string' || comune.length > 100)) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: "Parametri non validi" }))
      return
    }
    if (indirizzo !== undefined && (typeof indirizzo !== 'string' || indirizzo.length > 200)) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: "Parametri non validi" }))
      return
    }

    const report = {
      id: `${Date.now()}`,
      idImpianto: idImpianto ?? "",
      gestore: gestore ?? "",
      bandiera: bandiera ?? "",
      comune: comune ?? "",
      indirizzo: indirizzo ?? "",
      messaggio: messaggio.trim(),
      createdAt: new Date().toISOString(),
    }

    await getPool().query(
      `INSERT INTO reports (id, id_impianto, gestore, bandiera, comune, indirizzo, messaggio, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [report.id, report.idImpianto, report.gestore, report.bandiera, report.comune, report.indirizzo, report.messaggio, report.createdAt],
    )

    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ success: true, id: report.id }))
  } catch (err) {
    console.error("Errore salvataggio segnalazione:", err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: "Errore durante il salvataggio della segnalazione" }))
  }
}
