import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPool } from '../lib/db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

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

    await getPool().query(
      `INSERT INTO reports (id, id_impianto, gestore, bandiera, comune, indirizzo, messaggio, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [report.id, report.idImpianto, report.gestore, report.bandiera, report.comune, report.indirizzo, report.messaggio, report.createdAt]
    )

    res.json({ success: true, id: report.id })
  } catch (err) {
    console.error('Errore salvataggio segnalazione:', err)
    res.status(500).json({ error: 'Errore durante il salvataggio della segnalazione' })
  }
}
