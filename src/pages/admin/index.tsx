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

function obsUrl(orgId: string, type: 'lower-third' | 'ticker' | 'screen') {
  const base = window.location.origin
  if (type === 'screen') return `${base}/output/welcome?org=${orgId}`
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

function OBSUrlsModal({ org, onClose }: { org: OrgRow; onClose: () => void }) {
  const urls = [
    { label: 'Lower Third', url: obsUrl(org.id, 'lower-third') },
    { label: 'Ticker', url: obsUrl(org.id, 'ticker') },
    { label: 'Screen / Welcome', url: obsUrl(org.id, 'screen') },
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
              <button className="adm-btn-ghost adm-btn-sm" onClick={() => setObsOrg(o)}>
                <span className="msym" style={{ fontSize: 14 }}>link</span>
                OBS URLs
              </button>
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
            {(['lower-third', 'ticker', 'screen'] as const).map(type => ({
              label: type === 'lower-third' ? 'Lower Third' : type === 'ticker' ? 'Ticker' : 'Screen / Welcome',
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

// ── Shell / Layout ────────────────────────────────────────────

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: 'grid_view', end: true },
  { to: '/admin/churches', label: 'Church Accounts', icon: 'corporate_fare', end: false },
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
          <Route path="account" element={<YourAccount />} />
          <Route path="password" element={<PasswordSelfService />} />
        </Routes>
      </main>
    </div>
  )
}
