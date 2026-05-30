import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPool } from '../lib/db'
import { PostgresImpiantiRepository } from '../lib/repositories/PostgresImpiantiRepository'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const repo = new PostgresImpiantiRepository(getPool())
    const impianti = await repo.findAll()
    res.json(impianti)
  } catch (err) {
    console.error('Errore impianti:', err)
    res.status(500).json({ error: 'Failed to load impianti' })
  }
}
