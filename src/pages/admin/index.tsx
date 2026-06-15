import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import shofarLogo from '../../assets/ShofarLogo_SonWhite.png'

// ── Types ─────────────────────────────────────────────────────

interface OrgRow {
  id: string
  name: string
  slug: string
  created_at: string
}

interface ProfileRow {
  id: string
  org_id: string | null
  role: 'admin' | 'operator'
  display_name: string | null
  email?: string
}

// ── Shared helpers ────────────────────────────────────────────

function obsUrl(orgId: string, type: 'lower-third' | 'ticker' | 'screen' | 'speaker') {
  const base = window.location.origin
  if (type === 'screen') return `${base}/output/welcome?org=${orgId}`
  if (type === 'speaker') return `${base}/output/screen/speaker?org=${orgId}`
  return `${base}/output/${type}?org=${orgId}`
}

function StatusDot({ online }: { online?: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 7, height: 7,
      borderRadius: '50%',
      background: online ? '#22c55e' : 'rgba(255,255,255,.18)',
      flexShrink: 0,
    }} />
  )
}

function CopyBtn({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button className="adm-copy-btn" onClick={copy} title={`Copy ${label}`}>
      <span className="msym" style={{ fontSize: 13 }}>{copied ? 'check' : 'content_copy'}</span>
      {copied ? 'Copied' : label}
    </button>
  )
}

// ── Dashboard ─────────────────────────────────────────────────

function Dashboard() {
  const { org, user } = useAuth()
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])

  useEffect(() => {
    supabase.from('orgs').select('*').order('created_at').then(({ data }) => setOrgs(data ?? []))
    supabase.from('profiles').select('id, org_id, role, display_name').then(({ data }) => setProfiles(data ?? []))
  }, [])

  const countForOrg = (orgId: string) => profiles.filter(p => p.org_id === orgId).length

  return (
    <div className="adm-section">
      <div className="adm-section-header">
        <div>
          <h2 className="adm-section-title">Dashboard</h2>
          <p className="adm-section-sub">Overview of all church accounts</p>
        </div>
      </div>

      <div className="adm-stat-row">
        <div className="adm-stat-card">
          <span className="msym adm-stat-icon">corporate_fare</span>
          <div className="adm-stat-val">{orgs.length}</div>
          <div className="adm-stat-label">Churches</div>
        </div>
        <div className="adm-stat-card">
          <span className="msym adm-stat-icon">people</span>
          <div className="adm-stat-val">{profiles.filter(p => p.role === 'operator').length}</div>
          <div className="adm-stat-label">Operators</div>
        </div>
        <div className="adm-stat-card">
          <span className="msym adm-stat-icon">admin_panel_settings</span>
          <div className="adm-stat-val">{profiles.filter(p => p.role === 'admin').length}</div>
          <div className="adm-stat-label">Admins</div>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-header">All Churches</div>
        {orgs.length === 0 ? (
          <div className="adm-empty">No churches yet — create one in Church Accounts.</div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Church</th>
                <th>Slug</th>
                <th>Users</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(o => (
                <tr key={o.id}>
                  <td><strong>{o.name}</strong></td>
                  <td><code className="adm-code">{o.slug}</code></td>
                  <td>{countForOrg(o.id)}</td>
                  <td>{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Church Accounts ───────────────────────────────────────────

function CreateChurchModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { session } = useAuth()
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

  const handleOrgName = (v: string) => {
    setOrgName(v)
    if (!orgSlug || orgSlug === slugify(orgName)) setOrgSlug(slugify(v))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ orgName, orgSlug, email, password, displayName, role: 'operator' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Unknown error')
      onCreated()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <div className="adm-modal" onClick={e => e.stopPropagation()}>
        <div className="adm-modal-header">
          <h3>Create Church Account</h3>
          <button className="adm-modal-close" onClick={onClose}><span className="msym">close</span></button>
        </div>

        <form onSubmit={submit} className="adm-modal-form">
          <div className="adm-field-group">
            <label>Church name</label>
            <input value={orgName} onChange={e => handleOrgName(e.target.value)} placeholder="Shofar Somerset West" required />
          </div>
          <div className="adm-field-group">
            <label>Slug <span className="adm-hint">(used in OBS URLs — lowercase, hyphens only)</span></label>
            <input value={orgSlug} onChange={e => setOrgSlug(slugify(e.target.value))} placeholder="shofar-somerset-west" required />
          </div>
          <div className="adm-divider" />
          <div className="adm-field-group">
            <label>Operator display name</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Isaac de Villiers" />
          </div>
          <div className="adm-field-group">
            <label>Operator email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="operator@church.org" required />
          </div>
          <div className="adm-field-group">
            <label>Temporary password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" minLength={8} required />
          </div>

          {error && <div className="adm-form-error"><span className="msym" style={{ fontSize: 15 }}>error</span>{error}</div>}

          <div className="adm-modal-footer">
            <button type="button" className="adm-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="adm-btn-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create Church'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Edit Church Modal ─────────────────────────────────────────

interface OrgUser {
  id: string
  display_name: string | null
  role: string
  email: string | null
}

function EditChurchModal({ org, onClose, onSaved }: { org: OrgRow; onClose: () => void; onSaved: () => void }) {
  const { session } = useAuth()
  const [orgName, setOrgName] = useState(org.name)
  const [orgSlug, setOrgSlug] = useState(org.slug)
  const [users, setUsers] = useState<OrgUser[]>([])
  const [edits, setEdits] = useState<Record<string, { displayName: string; email: string }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

  useEffect(() => {
    fetch(`/api/admin/get-org-users?orgId=${org.id}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
      .then(r => r.json())
      .then(({ users: u }: { users: OrgUser[] }) => {
        setUsers(u ?? [])
        const init: typeof edits = {}
        ;(u ?? []).forEach((usr: OrgUser) => {
          init[usr.id] = { displayName: usr.display_name ?? '', email: usr.email ?? '' }
        })
        setEdits(init)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [org.id, session?.access_token])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // Update org
    const { error: orgErr } = await supabase
      .from('orgs')
      .update({ name: orgName, slug: slugify(orgSlug) })
      .eq('id', org.id)
    if (orgErr) { setError(orgErr.message); setSaving(false); return }

    // Update each user (email + display name via service-role API)
    for (const usr of users) {
      const edit = edits[usr.id]
      if (!edit) continue
      const emailChanged = edit.email !== (usr.email ?? '')
      const nameChanged = edit.displayName !== (usr.display_name ?? '')
      if (!emailChanged && !nameChanged) continue

      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          userId: usr.id,
          ...(emailChanged ? { email: edit.email } : {}),
          ...(nameChanged ? { displayName: edit.displayName } : {}),
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Update failed')
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <div className="adm-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="adm-modal-header">
          <h3>Edit Church — {org.name}</h3>
          <button className="adm-modal-close" onClick={onClose}><span className="msym">close</span></button>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,.4)' }}>Loading…</div>
        ) : (
          <form onSubmit={save} className="adm-modal-form">
            {/* Org details */}
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 10 }}>
              Church Details
            </div>
            <div className="adm-field-group">
              <label>Church name</label>
              <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Shofar Somerset West" required />
            </div>
            <div className="adm-field-group">
              <label>Slug <span className="adm-hint">(used in OBS URLs)</span></label>
              <input value={orgSlug} onChange={e => setOrgSlug(slugify(e.target.value))} placeholder="shofar-somerset-west" required />
            </div>

            {users.length > 0 && (
              <>
                <div className="adm-divider" />
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 10 }}>
                  Users
                </div>
                {users.map(usr => (
                  <div key={usr.id} style={{ marginBottom: 16, padding: '12px 14px', background: 'rgba(255,255,255,.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span className="msym" style={{ fontSize: 15, color: 'var(--accent)' }}>person</span>
                      <span className={`adm-role-badge ${usr.role}`}>{usr.role}</span>
                    </div>
                    <div className="adm-field-group" style={{ marginBottom: 8 }}>
                      <label>Display name</label>
                      <input
                        value={edits[usr.id]?.displayName ?? ''}
                        onChange={e => setEdits(prev => ({ ...prev, [usr.id]: { ...prev[usr.id], displayName: e.target.value } }))}
                        placeholder="Full name"
                      />
                    </div>
                    <div className="adm-field-group" style={{ marginBottom: 0 }}>
                      <label>Email address</label>
                      <input
                        type="email"
                        value={edits[usr.id]?.email ?? ''}
                        onChange={e => setEdits(prev => ({ ...prev, [usr.id]: { ...prev[usr.id], email: e.target.value } }))}
                        placeholder="operator@church.org"
                        required
                      />
                    </div>
                  </div>
                ))}
              </>
            )}

            {error && <div className="adm-form-error"><span className="msym" style={{ fontSize: 15 }}>error</span>{error}</div>}

            <div className="adm-modal-footer">
              <button type="button" className="adm-btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="adm-btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function OBSUrlsModal({ org, onClose }: { org: OrgRow; onClose: () => void }) {
  const urls = [
    { label: 'Lower Third', url: obsUrl(org.id, 'lower-third') },
    { label: 'Ticker', url: obsUrl(org.id, 'ticker') },
    { label: 'Screen / Welcome', url: obsUrl(org.id, 'screen') },
    { label: 'Slide W/Pastor', url: obsUrl(org.id, 'speaker') },
  ]
  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <div className="adm-modal" onClick={e => e.stopPropagation()}>
        <div className="adm-modal-header">
          <h3>OBS Source URLs — {org.name}</h3>
          <button className="adm-modal-close" onClick={onClose}><span className="msym">close</span></button>
        </div>
        <div style={{ padding: '0 24px 24px' }}>
          <p className="adm-section-sub" style={{ marginBottom: 20 }}>
            Add these as Browser Sources in OBS. Each URL is unique to this church.
          </p>
          {urls.map(u => (
            <div key={u.label} className="adm-obs-row">
              <div className="adm-obs-label">{u.label}</div>
              <code className="adm-obs-url">{u.url}</code>
              <CopyBtn value={u.url} label="Copy" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChurchAccounts() {
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [obsOrg, setObsOrg] = useState<OrgRow | null>(null)
  const [editOrg, setEditOrg] = useState<OrgRow | null>(null)
  const [resetting, setResetting] = useState<string | null>(null)
  const [resetMsg, setResetMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    supabase.from('orgs').select('*').order('name').then(({ data }) => setOrgs(data ?? []))
    supabase.from('profiles').select('id, org_id, role, display_name').then(({ data }) => setProfiles(data ?? []))
  }, [])

  useEffect(() => { load() }, [load])

  const sendResetEmail = async (email: string) => {
    setResetting(email)
    setResetMsg(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/account/reset-password`,
    })
    setResetting(null)
    setResetMsg(error ? `Error: ${error.message}` : `Reset email sent to ${email}`)
    setTimeout(() => setResetMsg(null), 4000)
  }

  const orgUsers = (orgId: string) => profiles.filter(p => p.org_id === orgId)

  return (
    <div className="adm-section">
      <div className="adm-section-header">
        <div>
          <h2 className="adm-section-title">Church Accounts</h2>
          <p className="adm-section-sub">Manage church organisations and their operators</p>
        </div>
        <button className="adm-btn-primary" onClick={() => setShowCreate(true)}>
          <span className="msym" style={{ fontSize: 16 }}>add</span>
          New Church
        </button>
      </div>

      {resetMsg && (
        <div className="adm-toast">{resetMsg}</div>
      )}

      {orgs.length === 0 ? (
        <div className="adm-card adm-empty-card">
          <span className="msym" style={{ fontSize: 36, color: 'rgba(255,255,255,.2)' }}>corporate_fare</span>
          <p>No church accounts yet.</p>
          <button className="adm-btn-primary" onClick={() => setShowCreate(true)}>Create first church</button>
        </div>
      ) : (
        orgs.map(o => (
          <div key={o.id} className="adm-card adm-church-card">
            <div className="adm-church-header">
              <div className="adm-church-info">
                <span className="msym" style={{ fontSize: 18, color: 'var(--accent)' }}>corporate_fare</span>
                <div>
                  <div className="adm-church-name">{o.name}</div>
                  <div className="adm-church-meta">
                    <code className="adm-code">{o.slug}</code>
                    <span style={{ color: 'rgba(255,255,255,.3)' }}>·</span>
                    <span>{orgUsers(o.id).length} user{orgUsers(o.id).length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="adm-btn-ghost adm-btn-sm" onClick={() => setEditOrg(o)}>
                  <span className="msym" style={{ fontSize: 14 }}>edit</span>
                  Edit
                </button>
                <button className="adm-btn-ghost adm-btn-sm" onClick={() => setObsOrg(o)}>
                  <span className="msym" style={{ fontSize: 14 }}>link</span>
                  OBS URLs
                </button>
              </div>
            </div>

            {orgUsers(o.id).length > 0 ? (
              <table className="adm-table adm-table-compact">
                <thead>
                  <tr><th>Name</th><th>Role</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {orgUsers(o.id).map(p => (
                    <tr key={p.id}>
                      <td>{p.display_name ?? <span style={{ opacity: .4 }}>—</span>}</td>
                      <td>
                        <span className={`adm-role-badge ${p.role}`}>{p.role}</span>
                      </td>
                      <td>
                        {p.email ? (
                          <button
                            className="adm-btn-ghost adm-btn-xs"
                            disabled={resetting === p.email}
                            onClick={() => sendResetEmail(p.email!)}
                          >
                            <span className="msym" style={{ fontSize: 12 }}>lock_reset</span>
                            {resetting === p.email ? 'Sending…' : 'Reset password'}
                          </button>
                        ) : (
                          <span style={{ opacity: .4, fontSize: 11 }}>No email on record</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="adm-no-users">No users in this church yet.</div>
            )}
          </div>
        ))
      )}

      {showCreate && (
        <CreateChurchModal onClose={() => setShowCreate(false)} onCreated={load} />
      )}
      {editOrg && (
        <EditChurchModal org={editOrg} onClose={() => setEditOrg(null)} onSaved={load} />
      )}
      {obsOrg && (
        <OBSUrlsModal org={obsOrg} onClose={() => setObsOrg(null)} />
      )}
    </div>
  )
}

// ── Your Account ─────────────────────────────────────────────

function YourAccount() {
  const { user, org, profile, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('profiles').update({ display_name: displayName }).eq('id', user!.id)
    await refreshProfile()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="adm-section">
      <div className="adm-section-header">
        <div>
          <h2 className="adm-section-title">Your Account</h2>
          <p className="adm-section-sub">Admin profile and workspace</p>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-header">Profile</div>
        <form onSubmit={saveProfile} className="adm-profile-form">
          <div className="adm-profile-row">
            <div className="adm-avatar">
              {(profile?.display_name ?? user?.email ?? '?')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div className="adm-field-group">
                <label>Display name</label>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="adm-field-group">
                <label>Email</label>
                <input value={user?.email ?? ''} disabled style={{ opacity: .55 }} />
              </div>
              <div className="adm-field-group">
                <label>Role</label>
                <input value={profile?.role ?? ''} disabled style={{ opacity: .55, textTransform: 'capitalize' }} />
              </div>
              {org && (
                <div className="adm-field-group">
                  <label>Organisation</label>
                  <input value={org.name} disabled style={{ opacity: .55 }} />
                </div>
              )}
            </div>
          </div>
          <div className="adm-modal-footer" style={{ paddingTop: 16 }}>
            <button type="submit" className="adm-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>

      {org && (
        <div className="adm-card" style={{ marginTop: 16 }}>
          <div className="adm-card-header">Your OBS Source URLs</div>
          <div style={{ padding: '12px 0' }}>
            {(['lower-third', 'ticker', 'screen', 'speaker'] as const).map(type => ({
              label: type === 'lower-third' ? 'Lower Third' : type === 'ticker' ? 'Ticker' : type === 'screen' ? 'Screen / Welcome' : 'Slide W/Pastor',
              url: obsUrl(org.id, type),
            })).map(u => (
              <div key={u.label} className="adm-obs-row">
                <div className="adm-obs-label">{u.label}</div>
                <code className="adm-obs-url">{u.url}</code>
                <CopyBtn value={u.url} label="Copy" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Password Self-Service ─────────────────────────────────────

function PasswordSelfService() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next !== confirm) { setMsg({ text: 'Passwords do not match.', ok: false }); return }
    if (next.length < 8) { setMsg({ text: 'Password must be at least 8 characters.', ok: false }); return }
    setLoading(true)
    setMsg(null)
    const { error } = await supabase.auth.updateUser({ password: next })
    setLoading(false)
    if (error) {
      setMsg({ text: error.message, ok: false })
    } else {
      setMsg({ text: 'Password updated successfully.', ok: true })
      setCurrent(''); setNext(''); setConfirm('')
    }
  }

  return (
    <div className="adm-section">
      <div className="adm-section-header">
        <div>
          <h2 className="adm-section-title">Change Password</h2>
          <p className="adm-section-sub">Update your login password</p>
        </div>
      </div>

      <div className="adm-card" style={{ maxWidth: 480 }}>
        <form onSubmit={submit} className="adm-modal-form">
          <div className="adm-field-group">
            <label>New password</label>
            <input type="password" value={next} onChange={e => setNext(e.target.value)} placeholder="Min. 8 characters" minLength={8} required />
          </div>
          <div className="adm-field-group">
            <label>Confirm new password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" required />
          </div>

          {msg && (
            <div className={msg.ok ? 'adm-form-success' : 'adm-form-error'}>
              <span className="msym" style={{ fontSize: 15 }}>{msg.ok ? 'check_circle' : 'error'}</span>
              {msg.text}
            </div>
          )}

          <div className="adm-modal-footer" style={{ paddingTop: 8 }}>
            <button type="submit" className="adm-btn-primary" disabled={loading}>
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Preset Packs ──────────────────────────────────────────────

interface PackRow {
  id: string
  name: string
  description: string | null
  created_at: string
}

interface PackItemRow {
  id: string
  pack_id: string
  type: 'lowerthird' | 'screen' | 'ticker'
  name: string
  data: Record<string, unknown>
  created_at: string
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  lowerthird: 'Lower Third',
  screen: 'Screen',
  ticker: 'Ticker',
}

function AddItemModal({ packId, onClose, onAdded }: { packId: string; onClose: () => void; onAdded: () => void }) {
  const [type, setType] = useState<'lowerthird' | 'screen' | 'ticker'>('lowerthird')
  const [name, setName] = useState('')
  const [json, setJson] = useState('{}')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    let data: Record<string, unknown>
    try { data = JSON.parse(json) } catch { setError('Invalid JSON'); return }
    setLoading(true)
    const { error: err } = await supabase.from('preset_items').insert({ pack_id: packId, type, name, data })
    setLoading(false)
    if (err) { setError(err.message); return }
    onAdded()
    onClose()
  }

  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <div className="adm-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="adm-modal-header">
          <h3>Add Preset Item</h3>
          <button className="adm-modal-close" onClick={onClose}><span className="msym">close</span></button>
        </div>
        <form onSubmit={submit} className="adm-modal-form">
          <div className="adm-field-group">
            <label>Type</label>
            <select value={type} onChange={e => setType(e.target.value as typeof type)} className="adm-select">
              <option value="lowerthird">Lower Third</option>
              <option value="screen">Screen</option>
              <option value="ticker">Ticker</option>
            </select>
          </div>
          <div className="adm-field-group">
            <label>Preset name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sunday Service" required />
          </div>
          <div className="adm-field-group">
            <label>Data (JSON) <span className="adm-hint">— paste the preset settings object</span></label>
            <textarea
              className="adm-textarea"
              rows={8}
              value={json}
              onChange={e => setJson(e.target.value)}
              spellCheck={false}
              placeholder='{"title":"...", "subtitle":"..."}'
            />
          </div>
          {error && <div className="adm-form-error"><span className="msym" style={{ fontSize: 15 }}>error</span>{error}</div>}
          <div className="adm-modal-footer">
            <button type="button" className="adm-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="adm-btn-primary" disabled={loading || !name}>
              {loading ? 'Adding…' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PackDetail({ pack, orgs, onDeleted }: { pack: PackRow; orgs: OrgRow[]; onDeleted: () => void }) {
  const [items, setItems] = useState<PackItemRow[]>([])
  const [assignments, setAssignments] = useState<string[]>([])
  const [showAddItem, setShowAddItem] = useState(false)
  const [deletingItem, setDeletingItem] = useState<string | null>(null)
  const [togglingOrg, setTogglingOrg] = useState<string | null>(null)

  const loadItems = useCallback(() => {
    supabase.from('preset_items').select('*').eq('pack_id', pack.id).order('created_at').then(({ data }) => setItems(data ?? []))
  }, [pack.id])

  const loadAssignments = useCallback(() => {
    supabase.from('org_pack_assignments').select('org_id').eq('pack_id', pack.id).then(({ data }) => setAssignments((data ?? []).map(r => r.org_id)))
  }, [pack.id])

  useEffect(() => { loadItems(); loadAssignments() }, [loadItems, loadAssignments])

  const deleteItem = async (id: string) => {
    setDeletingItem(id)
    await supabase.from('preset_items').delete().eq('id', id)
    setDeletingItem(null)
    loadItems()
  }

  const toggleOrg = async (orgId: string) => {
    setTogglingOrg(orgId)
    if (assignments.includes(orgId)) {
      await supabase.from('org_pack_assignments').delete().eq('org_id', orgId).eq('pack_id', pack.id)
      setAssignments(prev => prev.filter(id => id !== orgId))
    } else {
      await supabase.from('org_pack_assignments').insert({ org_id: orgId, pack_id: pack.id })
      setAssignments(prev => [...prev, orgId])
    }
    setTogglingOrg(null)
  }

  const deletePack = async () => {
    if (!confirm(`Delete pack "${pack.name}"? This removes all its items and assignments.`)) return
    await supabase.from('preset_items').delete().eq('pack_id', pack.id)
    await supabase.from('org_pack_assignments').delete().eq('pack_id', pack.id)
    await supabase.from('preset_packs').delete().eq('id', pack.id)
    onDeleted()
  }

  const typeGroups = ['lowerthird', 'screen', 'ticker'] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="adm-card">
        <div className="adm-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Preset Items ({items.length})</span>
          <button className="adm-btn-primary adm-btn-sm" onClick={() => setShowAddItem(true)}>
            <span className="msym" style={{ fontSize: 14 }}>add</span>
            Add item
          </button>
        </div>
        {items.length === 0 ? (
          <div className="adm-empty" style={{ padding: '20px 0' }}>No items yet — add lower thirds, screens, or ticker presets.</div>
        ) : (
          typeGroups.map(t => {
            const group = items.filter(i => i.type === t)
            if (group.length === 0) return null
            return (
              <div key={t} style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '12px 0 4px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', padding: '0 16px 8px' }}>
                  {ITEM_TYPE_LABELS[t]}
                </div>
                {group.map(item => (
                  <div key={item.id} className="adm-pack-item-row">
                    <span className="msym" style={{ fontSize: 16, color: 'var(--accent)', flexShrink: 0 }}>
                      {t === 'lowerthird' ? 'subtitles' : t === 'screen' ? 'crop_landscape' : 'horizontal_rule'}
                    </span>
                    <span style={{ flex: 1 }}>{item.name}</span>
                    <button
                      className="adm-btn-ghost adm-btn-xs"
                      style={{ color: '#ef4444' }}
                      disabled={deletingItem === item.id}
                      onClick={() => deleteItem(item.id)}
                    >
                      <span className="msym" style={{ fontSize: 12 }}>delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>

      <div className="adm-card">
        <div className="adm-card-header">Assigned to Churches</div>
        {orgs.length === 0 ? (
          <div className="adm-empty" style={{ padding: '20px 0' }}>No churches yet.</div>
        ) : (
          <div style={{ padding: '4px 0' }}>
            {orgs.map(org => {
              const assigned = assignments.includes(org.id)
              const toggling = togglingOrg === org.id
              return (
                <div key={org.id} className="adm-pack-org-row">
                  <span style={{ flex: 1 }}>{org.name}</span>
                  <button
                    className={`adm-toggle${assigned ? ' on' : ''}`}
                    onClick={() => toggleOrg(org.id)}
                    disabled={toggling}
                    title={assigned ? 'Remove from church' : 'Assign to church'}
                  >
                    <span className="adm-toggle-knob" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="adm-card" style={{ borderColor: 'rgba(239,68,68,.2)' }}>
        <div className="adm-card-header" style={{ color: '#ef4444' }}>Danger Zone</div>
        <div style={{ padding: '8px 0' }}>
          <button className="adm-btn-ghost adm-btn-sm" style={{ color: '#ef4444' }} onClick={deletePack}>
            <span className="msym" style={{ fontSize: 14 }}>delete_forever</span>
            Delete this pack
          </button>
        </div>
      </div>

      {showAddItem && (
        <AddItemModal packId={pack.id} onClose={() => setShowAddItem(false)} onAdded={loadItems} />
      )}
    </div>
  )
}

function PresetPacks() {
  const { user } = useAuth()
  const [packs, setPacks] = useState<PackRow[]>([])
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [selectedPack, setSelectedPack] = useState<PackRow | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    supabase.from('preset_packs').select('*').order('created_at').then(({ data }) => {
      const loaded = data ?? []
      setPacks(loaded)
      setSelectedPack(prev => prev ? (loaded.find(p => p.id === prev.id) ?? loaded[0] ?? null) : (loaded[0] ?? null))
    })
    supabase.from('orgs').select('*').order('name').then(({ data }) => setOrgs(data ?? []))
  }, [])

  useEffect(() => { load() }, [load])

  const createPack = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    const { data, error } = await supabase.from('preset_packs').insert({
      name: newName,
      description: newDesc || null,
      created_by: user!.id,
    }).select().single()
    setCreating(false)
    if (!error && data) {
      setShowCreate(false)
      setNewName('')
      setNewDesc('')
      load()
      setSelectedPack(data as PackRow)
    }
  }

  return (
    <div className="adm-section">
      <div className="adm-section-header">
        <div>
          <h2 className="adm-section-title">Preset Packs</h2>
          <p className="adm-section-sub">Create DLC-style packs of lower thirds, screens, and tickers — assign to churches</p>
        </div>
        <button className="adm-btn-primary" onClick={() => setShowCreate(true)}>
          <span className="msym" style={{ fontSize: 16 }}>add</span>
          New Pack
        </button>
      </div>

      <div className="adm-packs-layout">
        <div className="adm-packs-sidebar">
          {packs.length === 0 ? (
            <div className="adm-empty" style={{ padding: 24, textAlign: 'center' }}>
              <span className="msym" style={{ fontSize: 32, color: 'rgba(255,255,255,.15)', display: 'block', marginBottom: 8 }}>category</span>
              No packs yet
            </div>
          ) : (
            packs.map(p => (
              <button
                key={p.id}
                className={`adm-pack-row${selectedPack?.id === p.id ? ' active' : ''}`}
                onClick={() => setSelectedPack(p)}
              >
                <span className="msym" style={{ fontSize: 18, color: 'var(--accent)', flexShrink: 0 }}>inventory_2</span>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  {p.description && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.description}</div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="adm-packs-main">
          {selectedPack ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{selectedPack.name}</h3>
                {selectedPack.description && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,.5)' }}>{selectedPack.description}</p>}
              </div>
              <PackDetail key={selectedPack.id} pack={selectedPack} orgs={orgs} onDeleted={() => { load(); setSelectedPack(null) }} />
            </>
          ) : (
            <div className="adm-empty" style={{ padding: 48, textAlign: 'center' }}>
              <span className="msym" style={{ fontSize: 40, color: 'rgba(255,255,255,.1)', display: 'block', marginBottom: 12 }}>inventory_2</span>
              {packs.length === 0 ? 'Create your first preset pack' : 'Select a pack to manage it'}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="adm-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()}>
            <div className="adm-modal-header">
              <h3>New Preset Pack</h3>
              <button className="adm-modal-close" onClick={() => setShowCreate(false)}><span className="msym">close</span></button>
            </div>
            <form onSubmit={createPack} className="adm-modal-form">
              <div className="adm-field-group">
                <label>Pack name</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Sunday Morning Pack" required autoFocus />
              </div>
              <div className="adm-field-group">
                <label>Description <span className="adm-hint">(optional)</span></label>
                <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="A short description of what's in this pack" />
              </div>
              <div className="adm-modal-footer">
                <button type="button" className="adm-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="adm-btn-primary" disabled={creating || !newName}>
                  {creating ? 'Creating…' : 'Create Pack'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shell / Layout ────────────────────────────────────────────

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: 'grid_view', end: true },
  { to: '/admin/churches', label: 'Church Accounts', icon: 'corporate_fare', end: false },
  { to: '/admin/packs', label: 'Preset Packs', icon: 'inventory_2', end: false },
  { to: '/admin/account', label: 'Your Account', icon: 'manage_accounts', end: false },
  { to: '/admin/password', label: 'Change Password', icon: 'lock', end: false },
]

export default function AdminPage() {
  const { user, profile, org, signOut } = useAuth()
  const navigate = useNavigate()
  useEffect(() => { document.title = 'Shofar — Admin' }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="adm-shell">
      {/* ── Sidebar ── */}
      <aside className="adm-sidebar">
        <div className="adm-sidebar-brand">
          <img src={shofarLogo} alt="Shofar" style={{ height: 24, opacity: .9 }} />
          <span className="adm-sidebar-title">Admin</span>
        </div>

        <nav className="adm-nav">
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `adm-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="msym adm-nav-icon">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="adm-sidebar-footer">
          <div className="adm-sidebar-user">
            <div className="adm-avatar adm-avatar-sm">
              {(profile?.display_name ?? user?.email ?? '?')[0].toUpperCase()}
            </div>
            <div className="adm-sidebar-user-info">
              <div className="adm-sidebar-user-name">{profile?.display_name ?? 'Admin'}</div>
              <div className="adm-sidebar-user-email">{user?.email}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="adm-btn-ghost adm-btn-sm" style={{ flex: 1 }} onClick={() => navigate('/control')}>
              <span className="msym" style={{ fontSize: 13 }}>videocam</span>
              Studio
            </button>
            <button className="adm-btn-ghost adm-btn-sm" onClick={handleSignOut} title="Sign out">
              <span className="msym" style={{ fontSize: 13 }}>logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="adm-main">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="churches" element={<ChurchAccounts />} />
          <Route path="packs" element={<PresetPacks />} />
          <Route path="account" element={<YourAccount />} />
          <Route path="password" element={<PasswordSelfService />} />
        </Routes>
      </main>
    </div>
  )
}
