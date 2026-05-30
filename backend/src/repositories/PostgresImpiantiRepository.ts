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
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      for (const i of impianti) {
        await client.query(
          `INSERT INTO impianti (id, gestore, bandiera, comune, provincia, indirizzo)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             gestore = EXCLUDED.gestore,
             bandiera = EXCLUDED.bandiera,
             comune = EXCLUDED.comune,
             provincia = EXCLUDED.provincia,
             indirizzo = EXCLUDED.indirizzo`,
          [i.id, i.Gestore, i.Bandiera, i.Comune, i.Provincia, i.Indirizzo]
        )
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
}
