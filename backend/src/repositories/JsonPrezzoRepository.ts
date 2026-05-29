import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { Prezzo, IPrezzoRepository } from './IPrezzoRepository'

export class JsonPrezzoRepository implements IPrezzoRepository {
  private filePath: string

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(__dirname, '..', '..', 'prezzo.json')
  }

  async findAll(): Promise<Prezzo[]> {
    try {
      const data = await readFile(this.filePath, 'utf-8')
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  async upsertMany(prezzi: Prezzo[]): Promise<void> {
    const existing = await this.findAll()
    const map = new Map<string, Prezzo>()
    for (const p of existing) map.set(`${p.idImpianto}|${p.descCarburante}|${p.isSelf}`, p)
    for (const p of prezzi) map.set(`${p.idImpianto}|${p.descCarburante}|${p.isSelf}`, p)
    await writeFile(this.filePath, JSON.stringify([...map.values()], null, 2), 'utf-8')
  }
}
