import { writeFile, rename } from 'fs/promises'

export async function atomicWrite(filePath: string, data: string): Promise<void> {
  const tmpPath = filePath + '.tmp'
  await writeFile(tmpPath, data, 'utf-8')
  await rename(tmpPath, filePath)
}
