import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state, error } = req.query

  if (error) {
    return res.redirect(`/control?yt_error=${encodeURIComponent(String(error))}`)
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing code')
  }

  // Decode the user ID from state param
  const userId = state ? Buffer.from(String(state), 'base64').toString('utf8') : null
  if (!userId) return res.status(400).send('Missing state')

  const clientId     = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri  = process.env.GOOGLE_REDIRECT_URI ?? `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:5199'}/auth/google/callback`

  if (!clientId || !clientSecret) {
    return res.status(500).send('Google OAuth not configured')
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()
  if (!tokenRes.ok) {
    console.error('Token exchange failed:', tokens)
    return res.redirect(`/control?yt_error=${encodeURIComponent(tokens.error_description ?? 'Token exchange failed')}`)
  }

  const { access_token, refresh_token, expires_in } = tokens
  const expiry = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString()

  // Save tokens to Supabase profiles
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const update: Record<string, string> = {
    google_access_token: access_token,
    google_token_expiry: expiry,
  }
  if (refresh_token) update.google_refresh_token = refresh_token

  await supabase.from('profiles').update(update).eq('id', userId)

  res.redirect('/control?yt_connected=1')
}
