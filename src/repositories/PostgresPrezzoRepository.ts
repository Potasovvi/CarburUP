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
    const cols = ['id', 'id_impianto', 'desc_carburante', 'prezzo', 'is_self', 'dt_comu']
    const values: string[] = []
    const params: unknown[] = []
    let i = 1
    for (const p of prezzi) {
      values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`)
      params.push(
        `${p.idImpianto}|${p.descCarburante}|${p.isSelf}`,
        p.idImpianto,
        p.descCarburante,
        p.prezzo,
        p.isSelf,
        p.dtComu,
      )
    }
    const sql = `INSERT INTO prezzi (${cols.join(', ')}) VALUES ${values.join(', ')} ON CONFLICT (id) DO UPDATE SET id_impianto = EXCLUDED.id_impianto, desc_carburante = EXCLUDED.desc_carburante, prezzo = EXCLUDED.prezzo, is_self = EXCLUDED.is_self, dt_comu = EXCLUDED.dt_comu`
    await this.pool.query(sql, params)
  }
}
