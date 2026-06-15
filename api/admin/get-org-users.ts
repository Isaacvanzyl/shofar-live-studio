import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'Server misconfigured' })

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user: caller }, error: authErr } = await adminClient.auth.getUser(token)
  if (authErr || !caller) return res.status(401).json({ error: 'Invalid token' })

  const { data: callerProfile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()
  if (callerProfile?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })

  const { orgId } = req.query
  if (!orgId || typeof orgId !== 'string') return res.status(400).json({ error: 'orgId required' })

  const { data: profiles, error: profErr } = await adminClient
    .from('profiles')
    .select('id, display_name, role')
    .eq('org_id', orgId)

  if (profErr) return res.status(500).json({ error: profErr.message })

  // Fetch auth emails for each profile
  const users = await Promise.all(
    (profiles ?? []).map(async p => {
      const { data } = await adminClient.auth.admin.getUserById(p.id)
      return { ...p, email: data?.user?.email ?? null }
    })
  )

  return res.status(200).json({ users })
}
