import axios from 'axios'
import * as cheerio from 'cheerio'
import AdmZip from 'adm-zip'
import { Impianto } from './repositories/IImpiantiRepository'

const MIMIT_URL =
  'https://www.mimit.gov.it/it/open-data/elenco-dataset/carburanti-prezzi-praticati-e-anagrafica-degli-impianti'

async function fetchDataUrl(): Promise<string> {
  const { data: html } = await axios.get(MIMIT_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    timeout: 30000,
  })
  const $ = cheerio.load(html)
  const link = $('a')
    .filter((_, el) => $(el).text().includes('Anagrafica degli impianti attivi'))
    .first()
    .attr('href')
  if (!link) throw new Error('Download link not found for "Anagrafica degli impianti attivi"')
  return new URL(link, MIMIT_URL).href
}

function parsePipeCsv(text: string): Impianto[] {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)

  // Line 0 is the extraction date (skip), line 1 is the header
  if (lines.length < 2) throw new Error('CSV file is empty or missing header')

  const header = lines[1].split('|').map((h) => h.trim())
  const idIdx = header.indexOf('idImpianto')
  const gestoreIdx = header.indexOf('Gestore')
  const bandieraIdx = header.indexOf('Bandiera')
  const comuneIdx = header.indexOf('Comune')
  const provinciaIdx = header.indexOf('Provincia')
  const indirizzoIdx = header.indexOf('Indirizzo')

  if (provinciaIdx === -1) throw new Error('Provincia column not found in CSV header')

  const results: Impianto[] = []
  for (let i = 2; i < lines.length; i++) {
    const parts = lines[i].split('|')
    if (parts[provinciaIdx]?.trim() !== 'TO') continue

    results.push({
      id: (idIdx !== -1 ? parts[idIdx] : undefined) ?? String(results.length),
      Gestore: (gestoreIdx !== -1 ? parts[gestoreIdx] : undefined) ?? '',
      Bandiera: (bandieraIdx !== -1 ? parts[bandieraIdx] : undefined) ?? '',
      Comune: (comuneIdx !== -1 ? parts[comuneIdx] : undefined) ?? '',
      Provincia: 'TO',
      Indirizzo: (indirizzoIdx !== -1 ? parts[indirizzoIdx] : undefined) ?? '',
    })
  }
  return results
}

function bufferToString(buffer: Buffer | Uint8Array): string {
  const buf = Buffer.from(buffer)
  const utf8 = buf.toString('utf-8')
  return utf8.includes('\uFFFD') ? buf.toString('latin1') : utf8
}

export async function scrapeMimit(): Promise<Impianto[]> {
  const dataUrl = await fetchDataUrl()
  const { data: buffer } = await axios.get(dataUrl, { responseType: 'arraybuffer', timeout: 30000 })

  if (dataUrl.endsWith('.zip')) {
    const zip = new AdmZip(buffer)
    const entry = zip.getEntries().find((e) => e.entryName.endsWith('.csv'))
    if (!entry) throw new Error('No CSV file found in ZIP archive')
    return parsePipeCsv(bufferToString(entry.getData()))
  }

  return parsePipeCsv(bufferToString(buffer))
}

// CLI entry point
const isMainModule = require.main === module
if (isMainModule) {
  ;(async () => {
    try {
      const impianti = await scrapeMimit()
      const { JsonImpiantiRepository } = await import('./repositories/JsonImpiantiRepository')
      const repo = new JsonImpiantiRepository()
      await repo.upsertMany(impianti)
      console.error(`Saved ${impianti.length} impianti in TO to database.json`)
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })()
}
