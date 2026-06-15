import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server misconfigured — missing Supabase env vars' })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verify the calling user is an admin
  const { data: { user: caller }, error: authErr } = await adminClient.auth.getUser(token)
  if (authErr || !caller) return res.status(401).json({ error: 'Invalid token' })

  const { data: callerProfile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (callerProfile?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })

  const { orgName, orgSlug, orgId: existingOrgId, email, password, displayName, role = 'operator' } = req.body

  // Create or reuse org
  let targetOrgId = existingOrgId as string | null
  if (!targetOrgId) {
    if (!orgName || !orgSlug) return res.status(400).json({ error: 'orgName and orgSlug are required' })
    const { data: newOrg, error: orgErr } = await adminClient
      .from('orgs')
      .insert({ name: orgName, slug: orgSlug })
      .select()
      .single()
    if (orgErr) return res.status(400).json({ error: orgErr.message })
    targetOrgId = newOrg.id
  }

  // Create the auth user
  const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createErr) return res.status(400).json({ error: createErr.message })

  // Create or update the profile
  await adminClient.from('profiles').upsert({
    id: newUser.user.id,
    org_id: targetOrgId,
    role,
    display_name: displayName ?? null,
  })

  return res.status(200).json({ userId: newUser.user.id, orgId: targetOrgId })
}
