import { useState, useRef, useEffect } from 'react'
import type { ChurchProfile } from './Onboarding'

interface Props {
  open: boolean
  onClose: () => void
  profile: ChurchProfile
  onSave: (profile: ChurchProfile) => void
}

export default function ProfilePanel({ open, onClose, profile, onSave }: Props) {
  const [churchName, setChurchName] = useState(profile.churchName)
  const [city, setCity] = useState(profile.city)
  const [logo, setLogo] = useState<string | null>(profile.logo)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setChurchName(profile.churchName)
    setCity(profile.city)
    setLogo(profile.logo)
  }, [profile])

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setLogo(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    onSave({ churchName, city, logo })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      {/* Backdrop */}
      <div className={`panel-backdrop${open ? ' open' : ''}`} onClick={onClose} />

      {/* Slide-out panel */}
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
          {/* Church logo */}
          <div className="pp-section">
            <div className="pp-section-title">Church Logo</div>
            <div className="pp-logo-zone" onClick={() => fileRef.current?.click()}>
              {logo ? (
                <img src={logo} alt="Church logo" className="pp-logo-preview" />
              ) : (
                <>
                  <span className="msym" style={{ fontSize: 28, color: 'var(--text-3)' }}>add_photo_alternate</span>
                  <span className="pp-logo-hint">Click to upload</span>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogo} />
            {logo && (
              <button className="pp-remove-logo" onClick={() => setLogo(null)}>
                <span className="msym" style={{ fontSize: 14 }}>delete</span>
                Remove logo
              </button>
            )}
          </div>

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

          {/* Account — placeholder for Phase 2 */}
          <div className="pp-section">
            <div className="pp-section-title">Account</div>
            <div className="pp-placeholder">
              <span className="msym" style={{ fontSize: 18, color: 'var(--text-3)' }}>lock</span>
              Password management available after login is set up.
            </div>
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
