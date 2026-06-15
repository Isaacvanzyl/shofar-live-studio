import { useState, useEffect } from 'react'
import type { ChurchProfile } from './Onboarding'
import { supabase } from '../lib/supabase'

interface Props {
  open: boolean
  onClose: () => void
  profile: ChurchProfile
  onSave: (profile: ChurchProfile) => void
}

export default function ProfilePanel({ open, onClose, profile, onSave }: Props) {
  const [churchName, setChurchName] = useState(profile.churchName)
  const [city, setCity] = useState(profile.city)
  const [saved, setSaved] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwStatus, setPwStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [pwError, setPwError] = useState('')

  useEffect(() => {
    setChurchName(profile.churchName)
    setCity(profile.city)
  }, [profile])

  const handleSave = () => {
    onSave({ churchName, city, logo: null })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleChangePassword = async () => {
    if (!newPassword) return
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return }
    if (newPassword.length < 8) { setPwError('Password must be at least 8 characters'); return }
    setPwStatus('saving')
    setPwError('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPwError(error.message)
      setPwStatus('error')
    } else {
      setPwStatus('ok')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPwStatus('idle'), 3000)
    }
  }

  return (
    <>
      <div className={`panel-backdrop${open ? ' open' : ''}`} onClick={onClose} />

      <div className={`profile-panel${open ? ' open' : ''}`}>
        <div className="pp-header">
          <div className="pp-title">
            <span className="msym" style={{ fontSize: 20, color: 'var(--accent)' }}>manage_accounts</span>
            Church Profile
          </div>
          <button className="pp-close" onClick={onClose}>
            <span className="msym">close</span>
          </button>
        </div>

        <div className="pp-body">
          {/* Church details */}
          <div className="pp-section">
            <div className="pp-section-title">Church Details</div>
            <div className="pp-field">
              <label className="pp-label">Church name</label>
              <input
                className="pp-input"
                type="text"
                placeholder="e.g. Shofar Somerset West"
                value={churchName}
                onChange={e => setChurchName(e.target.value)}
              />
            </div>
            <div className="pp-field">
              <label className="pp-label">City / Location</label>
              <input
                className="pp-input"
                type="text"
                placeholder="e.g. Somerset West"
                value={city}
                onChange={e => setCity(e.target.value)}
              />
            </div>
          </div>

          {/* Change password */}
          <div className="pp-section">
            <div className="pp-section-title">Change Password</div>
            <div className="pp-field">
              <label className="pp-label">New password</label>
              <input
                className="pp-input"
                type="password"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPwStatus('idle'); setPwError('') }}
              />
            </div>
            <div className="pp-field">
              <label className="pp-label">Confirm password</label>
              <input
                className="pp-input"
                type="password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPwStatus('idle'); setPwError('') }}
              />
            </div>
            {pwError && (
              <div className="pp-pw-error">
                <span className="msym" style={{ fontSize: 14 }}>error</span>
                {pwError}
              </div>
            )}
            <button
              className={`pp-pw-btn${pwStatus === 'ok' ? ' ok' : ''}`}
              onClick={handleChangePassword}
              disabled={pwStatus === 'saving' || !newPassword}
            >
              {pwStatus === 'saving' && <span className="msym spin" style={{ fontSize: 16 }}>refresh</span>}
              {pwStatus === 'ok' && <span className="msym" style={{ fontSize: 16 }}>check_circle</span>}
              {pwStatus !== 'saving' && pwStatus !== 'ok' && <span className="msym" style={{ fontSize: 16 }}>lock_reset</span>}
              {pwStatus === 'saving' ? 'Updating…' : pwStatus === 'ok' ? 'Password updated!' : 'Update password'}
            </button>
          </div>
        </div>

        <div className="pp-footer">
          <button className="pp-save-btn" onClick={handleSave}>
            {saved ? (
              <><span className="msym" style={{ fontSize: 18 }}>check</span> Saved!</>
            ) : (
              <><span className="msym" style={{ fontSize: 18 }}>save</span> Save changes</>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
