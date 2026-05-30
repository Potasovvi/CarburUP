import { Pool } from 'pg'
import { Prezzo, IPrezzoRepository } from './IPrezzoRepository'

export class PostgresPrezzoRepository implements IPrezzoRepository {
  private pool: Pool

  constructor(pool: Pool) {
    this.pool = pool
  }

  async findAll(): Promise<Prezzo[]> {
    const result = await this.pool.query('SELECT * FROM prezzi')
    return result.rows.map(row => ({
      idImpianto: row.id_impianto,
      descCarburante: row.desc_carburante,
      prezzo: row.prezzo,
      isSelf: row.is_self,
      dtComu: row.dt_comu ?? '',
    }))
  }

  async upsertMany(prezzi: Prezzo[]): Promise<void> {
    if (prezzi.length === 0) return
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      for (const p of prezzi) {
        const id = `${p.idImpianto}|${p.descCarburante}|${p.isSelf}`
        await client.query(
          `INSERT INTO prezzi (id, id_impianto, desc_carburante, prezzo, is_self, dt_comu)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             id_impianto = EXCLUDED.id_impianto,
             desc_carburante = EXCLUDED.desc_carburante,
             prezzo = EXCLUDED.prezzo,
             is_self = EXCLUDED.is_self,
             dt_comu = EXCLUDED.dt_comu`,
          [id, p.idImpianto, p.descCarburante, p.prezzo, p.isSelf, p.dtComu]
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
