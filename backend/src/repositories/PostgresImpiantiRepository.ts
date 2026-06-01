import { Pool } from 'pg'
import { Impianto, IImpiantiRepository } from './IImpiantiRepository'

export class PostgresImpiantiRepository implements IImpiantiRepository {
  private pool: Pool

  constructor(pool: Pool) {
    this.pool = pool
  }

  async findAll(): Promise<Impianto[]> {
    const result = await this.pool.query('SELECT * FROM impianti ORDER BY gestore')
    return result.rows.map(row => ({
      id: row.id,
      Gestore: row.gestore,
      Bandiera: row.bandiera ?? '',
      Comune: row.comune ?? '',
      Provincia: row.provincia ?? '',
      Indirizzo: row.indirizzo ?? '',
    }))
  }

  async upsertMany(impianti: Impianto[]): Promise<void> {
    if (impianti.length === 0) return

    // Build multi-row upsert
    const cols = ['id', 'gestore', 'bandiera', 'comune', 'provincia', 'indirizzo']
    const values: string[] = []
    const params: unknown[] = []
    let i = 1
    for (const imp of impianti) {
      values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`)
      params.push(imp.id, imp.Gestore, imp.Bandiera, imp.Comune, imp.Provincia, imp.Indirizzo)
    }
    const sql = `INSERT INTO impianti (${cols.join(', ')}) VALUES ${values.join(', ')} ON CONFLICT (id) DO UPDATE SET gestore = COALESCE(NULLIF(EXCLUDED.gestore, ''), impianti.gestore), bandiera = COALESCE(NULLIF(EXCLUDED.bandiera, ''), impianti.bandiera), comune = COALESCE(NULLIF(EXCLUDED.comune, ''), impianti.comune), provincia = COALESCE(NULLIF(EXCLUDED.provincia, ''), impianti.provincia), indirizzo = COALESCE(NULLIF(EXCLUDED.indirizzo, ''), impianti.indirizzo`

    await this.pool.query(sql, params)
  }
}
