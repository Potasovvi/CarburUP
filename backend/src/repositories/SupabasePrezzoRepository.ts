import { SupabaseClient } from '@supabase/supabase-js'
import { Prezzo, IPrezzoRepository } from './IPrezzoRepository'

export class SupabasePrezzoRepository implements IPrezzoRepository {
  private client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async findAll(): Promise<Prezzo[]> {
    const { data, error } = await this.client
      .from('prezzi')
      .select('*')
    if (error) throw error
    return (data ?? []).map(row => ({
      idImpianto: row.id_impianto,
      descCarburante: row.desc_carburante,
      prezzo: row.prezzo,
      isSelf: row.is_self,
      dtComu: row.dt_comu ?? '',
    }))
  }

  async upsertMany(prezzi: Prezzo[]): Promise<void> {
    const rows = prezzi.map(p => ({
      id: `${p.idImpianto}|${p.descCarburante}|${p.isSelf}`,
      id_impianto: p.idImpianto,
      desc_carburante: p.descCarburante,
      prezzo: p.prezzo,
      is_self: p.isSelf,
      dt_comu: p.dtComu,
    }))
    const { error } = await this.client.from('prezzi').upsert(rows, {
      onConflict: 'id',
      ignoreDuplicates: false,
    })
    if (error) throw error
  }
}
