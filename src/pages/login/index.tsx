import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import shofarLogo from '../../assets/ShofarLogo_SonWhite.png'
import { useAuth } from '../../contexts/AuthContext'
import { VERSION } from '../../version'

export default function LoginPage() {
  useEffect(() => { document.title = 'Shofar Live Studio' }, [])
  const { signIn, user, profile, loading } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user && profile) {
      navigate(profile.role === 'admin' ? '/admin' : '/control/screens', { replace: true })
    }
  }, [user, profile, loading, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: err } = await signIn(email, password)
    setSubmitting(false)
    if (err) {
      setError(err === 'Invalid login credentials'
        ? 'Incorrect email or password.'
        : err)
    }
    // Navigation happens via the useEffect above once profile loads
  }

  return (
    <div className="login-shell">
      {/* ── Left branded panel ── */}
      <div className="login-left">
        <div className="login-left-inner">
          <div className="login-brand">
            <img src={shofarLogo} alt="Shofar" className="login-logo" />
            <div className="login-wordmark">
              SHOFAR <span>LIVE STUDIO</span>
            </div>
          </div>

          <div className="login-hero">
            <h1 className="login-hero-title">
              Broadcast<br />with confidence.
            </h1>
            <p className="login-hero-sub">
              Professional live production tools for your Sunday service —
              lower thirds, ticker, screens and stream health, all in one place.
            </p>
          </div>

          <div className="login-left-footer">
            © {new Date().getFullYear()} Shofar Online. All rights reserved.
          </div>
        </div>

        {/* Decorative orbs */}
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
      </div>

      {/* ── Right form panel ── */}
      <div className="login-right">
        <div className="login-form-wrap">
          <div className="login-form-header">
            <h2 className="login-form-title">Welcome back</h2>
            <p className="login-form-sub">Sign in to your studio account</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label">Email address</label>
              <div className="login-input-wrap">
                <span className="msym login-input-icon">mail</span>
                <input
                  className="login-input"
                  type="email"
                  placeholder="you@yourchurch.org"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label">Password</label>
              <div className="login-input-wrap">
                <span className="msym login-input-icon">lock</span>
                <input
                  className="login-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="login-eye"
                  onClick={() => setShowPass(!showPass)}
                  tabIndex={-1}
                >
                  <span className="msym">{showPass ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error">
                <span className="msym" style={{ fontSize: 16 }}>error</span>
                {error}
              </div>
            )}

            <button type="submit" className="login-btn" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign In'}
              {!submitting && <span className="msym" style={{ fontSize: 18 }}>arrow_forward</span>}
            </button>
          </form>
        </div>
      </div>
      <div className="app-version-tag">v{VERSION}</div>
    </div>
  )
}
