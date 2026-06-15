import { supabase } from './supabase'

export interface YouTubeTokens {
  accessToken: string
  expiry: string
  hasRefreshToken: boolean
}

// Build the Google OAuth redirect URL
export function buildGoogleAuthUrl(userId: string): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const redirectUri = `${window.location.origin}/auth/google/callback`
  const state = btoa(userId)
  const scope = [
    'https://www.googleapis.com/auth/youtube.readonly',
  ].join(' ')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// Get a valid access token — refreshes automatically if expired
export async function getValidYouTubeToken(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('google_access_token, google_token_expiry, google_refresh_token')
    .eq('id', user.id)
    .single()

  if (!profile?.google_access_token) return null

  // Token still valid (with 2 min buffer)
  const expiry = profile.google_token_expiry ? new Date(profile.google_token_expiry).getTime() : 0
  if (expiry - Date.now() > 2 * 60 * 1000) {
    return profile.google_access_token
  }

  // Expired — refresh via API route
  if (!profile.google_refresh_token) return null

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const res = await fetch('/api/auth/google-refresh', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (!res.ok) return null
  const { access_token } = await res.json()
  return access_token ?? null
}

// Check if YouTube is connected for the current user
export async function getYouTubeConnectionStatus(): Promise<'connected' | 'disconnected' | 'loading'> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('google_access_token, google_refresh_token')
    .single()

  if (!profile) return 'loading'
  return profile.google_refresh_token ? 'connected' : 'disconnected'
}

// Disconnect YouTube (clear tokens)
export async function disconnectYouTube(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('profiles').update({
    google_access_token: null,
    google_refresh_token: null,
    google_token_expiry: null,
  }).eq('id', user.id)
}
