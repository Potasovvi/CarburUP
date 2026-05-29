export interface Impianto {
  id: string
  Gestore: string
  Bandiera: string
  Comune: string
  Provincia: string
  Indirizzo: string
  [key: string]: unknown
}

export interface IImpiantiRepository {
  findAll(): Promise<Impianto[]>
  upsertMany(impianti: Impianto[]): Promise<void>
}
