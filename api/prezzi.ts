import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPool } from '../backend/src/db'
import { PostgresPrezzoRepository } from '../backend/src/repositories/PostgresPrezzoRepository'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const repo = new PostgresPrezzoRepository(getPool())
    const prezzi = await repo.findAll()
    res.json(prezzi)
  } catch (err) {
    console.error('Errore prezzi:', err)
    res.status(500).json({ error: 'Failed to load prezzi' })
  }
}
