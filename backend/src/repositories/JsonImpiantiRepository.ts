import { readFile } from 'fs/promises'
import { join } from 'path'
import { Impianto, IImpiantiRepository } from './IImpiantiRepository'
import { atomicWrite } from '../atomicWrite'

export class JsonImpiantiRepository implements IImpiantiRepository {
  private filePath: string

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(__dirname, '..', '..', 'database.json')
  }

  async findAll(): Promise<Impianto[]> {
    try {
      const data = await readFile(this.filePath, 'utf-8')
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  async upsertMany(impianti: Impianto[]): Promise<void> {
    const existing = await this.findAll()
    const map = new Map<string, Impianto>()
    for (const i of existing) map.set(i.id, i)
    for (const i of impianti) map.set(i.id, i)
    await atomicWrite(this.filePath, JSON.stringify([...map.values()], null, 2))
  }
}
