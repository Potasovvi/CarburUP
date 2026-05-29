import axios from 'axios'
import * as cheerio from 'cheerio'
import AdmZip from 'adm-zip'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { Prezzo } from './repositories/IPrezzoRepository'
import { Impianto } from './repositories/IImpiantiRepository'

const MIMIT_URL =
  'https://www.mimit.gov.it/it/open-data/elenco-dataset/carburanti-prezzi-praticati-e-anagrafica-degli-impianti'

async function fetchPrezzoDataUrl(): Promise<string> {
  const { data: html } = await axios.get(MIMIT_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })
  const $ = cheerio.load(html)
  const link = $('a')
    .filter((_, el) => $(el).text().includes('Prezzo alle 8 di mattina'))
    .first()
    .attr('href')
  if (!link) throw new Error('Download link not found for "Prezzo alle 8 di mattina"')
  return new URL(link, MIMIT_URL).href
}

async function loadImpiantiTOIds(): Promise<Set<string>> {
  const filePath = join(__dirname, '..', 'database.json')
  let impianti: Impianto[]
  try {
    const data = await readFile(filePath, 'utf-8')
    impianti = JSON.parse(data)
  } catch {
    throw new Error(
      'database.json not found or empty. Run "npm run scrape" first to download impianti data.'
    )
  }
  const ids = new Set<string>()
  for (const i of impianti) {
    if (i.Provincia === 'TO') ids.add(i.id)
  }
  return ids
}

function parsePrezzoCsv(text: string, toIds: Set<string>): Prezzo[] {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)

  if (lines.length < 2) throw new Error('CSV file is empty or missing header')

  const header = lines[1].split('|').map((h) => h.trim())
  const idIdx = header.indexOf('idImpianto')
  const descIdx = header.indexOf('descCarburante')
  const prezzoIdx = header.indexOf('prezzo')
  const isSelfIdx = header.indexOf('isSelf')
  const dtComuIdx = header.indexOf('dtComu')

  if (idIdx === -1) throw new Error('idImpianto column not found in CSV header')

  const results: Prezzo[] = []
  for (let i = 2; i < lines.length; i++) {
    const parts = lines[i].split('|')
    const idImpianto = parts[idIdx]?.trim()
    if (!idImpianto || !toIds.has(idImpianto)) continue

    results.push({
      idImpianto,
      descCarburante: (descIdx !== -1 ? parts[descIdx] : undefined)?.trim() ?? '',
      prezzo: prezzoIdx !== -1 ? parseFloat(parts[prezzoIdx]?.trim() ?? '0') : 0,
      isSelf: isSelfIdx !== -1 ? parts[isSelfIdx]?.trim() === '1' : false,
      dtComu: (dtComuIdx !== -1 ? parts[dtComuIdx] : undefined)?.trim() ?? '',
    })
  }
  return results
}

function bufferToString(buffer: Buffer | Uint8Array): string {
  return Buffer.from(buffer).toString('utf-8')
}

export async function scrapePrezzo(): Promise<Prezzo[]> {
  const dataUrl = await fetchPrezzoDataUrl()
  const toIds = await loadImpiantiTOIds()
  const { data: buffer } = await axios.get(dataUrl, { responseType: 'arraybuffer' })

  if (dataUrl.endsWith('.zip')) {
    const zip = new AdmZip(buffer)
    const entry = zip.getEntries().find((e) => e.entryName.endsWith('.csv'))
    if (!entry) throw new Error('No CSV file found in ZIP archive')
    return parsePrezzoCsv(bufferToString(entry.getData()), toIds)
  }

  return parsePrezzoCsv(bufferToString(buffer), toIds)
}

const isMainModule = require.main === module
if (isMainModule) {
  ;(async () => {
    try {
      const prezzi = await scrapePrezzo()
      const { JsonPrezzoRepository } = await import('./repositories/JsonPrezzoRepository')
      const repo = new JsonPrezzoRepository()
      await repo.upsertMany(prezzi)
      console.error(`Saved ${prezzi.length} prezzi in TO to prezzo.json`)
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })()
}
