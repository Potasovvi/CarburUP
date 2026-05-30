export default async function handler(_req: any, res: any) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ ok: true, message: 'Hello from Vercel' }))
}
