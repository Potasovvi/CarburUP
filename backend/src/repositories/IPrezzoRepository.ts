export interface Prezzo {
  idImpianto: string
  descCarburante: string
  prezzo: number
  isSelf: boolean
  dtComu: string
}

export interface IPrezzoRepository {
  findAll(): Promise<Prezzo[]>
  upsertMany(prezzi: Prezzo[]): Promise<void>
}
