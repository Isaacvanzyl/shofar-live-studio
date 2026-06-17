import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { url } = req.query
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url query parameter required' })

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only http and https URLs are allowed' })
  }

  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': 'ShofarCalendarProxy/1.0' },
    })
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch ICS feed' })
  }

  if (!response.ok) {
    return res.status(502).json({ error: `Upstream returned ${response.status}` })
  }

  const text = await response.text()

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300')
  return res.status(200).send(text)
}
