import { SupabaseClient } from '@supabase/supabase-js'
import { Impianto, IImpiantiRepository } from './IImpiantiRepository'

export class SupabaseImpiantiRepository implements IImpiantiRepository {
  private client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async findAll(): Promise<Impianto[]> {
    const { data, error } = await this.client
      .from('impianti')
      .select('*')
      .order('gestore')
    if (error) throw error
    return (data ?? []).map(row => ({
      id: row.id,
      Gestore: row.gestore,
      Bandiera: row.bandiera ?? '',
      Comune: row.comune ?? '',
      Provincia: row.provincia ?? '',
      Indirizzo: row.indirizzo ?? '',
    }))
  }

  async upsertMany(impianti: Impianto[]): Promise<void> {
    const rows = impianti.map(i => ({
      id: i.id,
      gestore: i.Gestore,
      bandiera: i.Bandiera,
      comune: i.Comune,
      provincia: i.Provincia,
      indirizzo: i.Indirizzo,
    }))
    const { error } = await this.client.from('impianti').upsert(rows, {
      onConflict: 'id',
      ignoreDuplicates: false,
    })
    if (error) throw error
  }
}
