import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'Server misconfigured' })

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verify caller is admin
  const { data: { user: caller }, error: authErr } = await adminClient.auth.getUser(token)
  if (authErr || !caller) return res.status(401).json({ error: 'Invalid token' })

  const { data: callerProfile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()
  if (callerProfile?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })

  const { userId, email, displayName, orgName, orgSlug, orgId } = req.body

  const errors: string[] = []

  // Update auth email if provided
  if (userId && email) {
    const { error } = await adminClient.auth.admin.updateUserById(userId, { email })
    if (error) errors.push(`Email: ${error.message}`)
  }

  // Update profile display_name if provided
  if (userId && displayName !== undefined) {
    const { error } = await adminClient
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', userId)
    if (error) errors.push(`Display name: ${error.message}`)
  }

  // Update org name/slug if provided
  if (orgId && (orgName || orgSlug)) {
    const patch: Record<string, string> = {}
    if (orgName) patch.name = orgName
    if (orgSlug) patch.slug = orgSlug
    const { error } = await adminClient.from('orgs').update(patch).eq('id', orgId)
    if (error) errors.push(`Org: ${error.message}`)
  }

  if (errors.length) return res.status(400).json({ error: errors.join('; ') })
  return res.status(200).json({ ok: true })
}
