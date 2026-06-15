import { useState, useRef } from 'react'
import shofarLogo from '../assets/ShofarLogo_SonWhite.png'
import type { LTPresetData } from '../types'
import { OBSClient } from '../lib/obs'
import { buildGoogleAuthUrl } from '../lib/youtubeAuth'
import { useAuth } from '../contexts/AuthContext'

export interface ChurchProfile {
  churchName: string
  city: string
  logo: string | null
}

export interface Pastor {
  id: string
  name: string
  title: string
}

interface Props {
  onComplete: (profile: ChurchProfile) => void
}

function createLTPresetsFromPastors(pastors: Pastor[], churchName: string) {
  const existing: Record<string, LTPresetData> = (() => {
    try { return JSON.parse(localStorage.getItem('shofar_preset_lt') ?? '{}') } catch { return {} }
  })()
  const defaults: Omit<LTPresetData, 'name' | 'title'> = {
    nameSz: 52, titleSz: 26,
    nameCol: '#FFFFFF', titleCol: '#E84F0E',
    accentCol: '#E84F0E', bgOp: 92, barWidth: 10,
    xOff: 80, yOff: 90, pad: 18,
    panelBg: '#000000', uppercase: 'none',
  }
  pastors.forEach(p => {
    if (!p.name.trim()) return
    existing[p.name.trim()] = { ...defaults, name: p.name.trim(), title: p.title.trim() || churchName }
  })
  localStorage.setItem('shofar_preset_lt', JSON.stringify(existing))
}

// ── Step components ───────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="ob-step">
      <div className="ob-icon">
        <span className="msym" style={{ fontSize: 40, color: 'var(--accent)' }}>church</span>
      </div>
      <h2 className="ob-title">Welcome to Shofar Live Studio</h2>
      <p className="ob-sub">Let's take 2 minutes to set up your studio so you're ready for Sunday. We'll walk through your church details, OBS connection, and stream settings.</p>
      <button className="ob-btn-primary" onClick={onNext}>
        Get started
        <span className="msym" style={{ fontSize: 18 }}>arrow_forward</span>
      </button>
    </div>
  )
}

function StepChurchDetails({ churchName, city, setChurchName, setCity, onBack, onNext }: {
  churchName: string; city: string
  setChurchName: (v: string) => void; setCity: (v: string) => void
  onBack: () => void; onNext: () => void
}) {
  return (
    <div className="ob-step" key="details">
      <div className="ob-step-num">Step 1 of 4</div>
      <h2 className="ob-title">Your church details</h2>
      <p className="ob-sub">This personalises your lower thirds, ticker, and studio.</p>
      <div className="ob-fields">
        <div className="ob-field">
          <label className="ob-label">Church name</label>
          <input className="ob-input" type="text" placeholder="e.g. Shofar Somerset West"
            value={churchName} onChange={e => setChurchName(e.target.value)} autoFocus />
        </div>
        <div className="ob-field">
          <label className="ob-label">City / Location</label>
          <input className="ob-input" type="text" placeholder="e.g. Somerset West"
            value={city} onChange={e => setCity(e.target.value)} />
        </div>
      </div>
      <div className="ob-actions">
        <button className="ob-btn-ghost" onClick={onBack}>Back</button>
        <button className="ob-btn-primary" onClick={onNext} disabled={!churchName.trim()}>
          Continue <span className="msym" style={{ fontSize: 18 }}>arrow_forward</span>
        </button>
      </div>
    </div>
  )
}

function StepPastors({ pastors, setPastors, fullChurchName, onBack, onNext }: {
  pastors: Pastor[]; setPastors: (p: Pastor[]) => void
  fullChurchName: string; onBack: () => void; onNext: () => void
}) {
  const add = () => setPastors([...pastors, { id: Date.now().toString(), name: '', title: '' }])
  const update = (id: string, field: 'name' | 'title', value: string) =>
    setPastors(pastors.map(x => x.id === id ? { ...x, [field]: value } : x))
  const remove = (id: string) => setPastors(pastors.filter(x => x.id !== id))

  return (
    <div className="ob-step">
      <div className="ob-step-num">Step 2 of 4</div>
      <h2 className="ob-title">Pastors &amp; speakers</h2>
      <p className="ob-sub">We'll create lower third presets for each person. Title defaults to <strong style={{ color: 'var(--accent)' }}>{fullChurchName || 'your church'}</strong>.</p>
      <div className="ob-pastor-list">
        {pastors.map((p, i) => (
          <div className="ob-pastor-row" key={p.id}>
            <div className="ob-pastor-fields">
              <input className="ob-input ob-input-sm" type="text" placeholder="Full name"
                value={p.name} onChange={e => update(p.id, 'name', e.target.value)}
                autoFocus={i === pastors.length - 1 && i > 0} />
              <input className="ob-input ob-input-sm" type="text"
                placeholder={`Title (default: ${fullChurchName || 'church name'})`}
                value={p.title} onChange={e => update(p.id, 'title', e.target.value)} />
            </div>
            {pastors.length > 1 && (
              <button className="ob-pastor-del" onClick={() => remove(p.id)}>
                <span className="msym" style={{ fontSize: 16 }}>close</span>
              </button>
            )}
          </div>
        ))}
        <button className="ob-add-pastor" onClick={add}>
          <span className="msym" style={{ fontSize: 16 }}>add</span> Add another person
        </button>
      </div>
      <div className="ob-actions">
        <button className="ob-btn-ghost" onClick={onBack}>Back</button>
        <button className="ob-btn-primary" onClick={onNext}>
          Continue <span className="msym" style={{ fontSize: 18 }}>arrow_forward</span>
        </button>
      </div>
      <button className="ob-skip" onClick={onNext}>Skip for now</button>
    </div>
  )
}

type TestState = 'idle' | 'testing' | 'ok' | 'fail'

function StepOBS({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [host, setHost] = useState(() => localStorage.getItem('obs_host') ?? 'localhost')
  const [port, setPort] = useState(() => localStorage.getItem('obs_port') ?? '4455')
  const [password, setPassword] = useState(() => localStorage.getItem('obs_password') ?? '')
  const [testState, setTestState] = useState<TestState>('idle')
  const clientRef = useRef<OBSClient | null>(null)

  const save = () => {
    localStorage.setItem('obs_host', host)
    localStorage.setItem('obs_port', port)
    localStorage.setItem('obs_password', password)
    localStorage.setItem('obs_enabled', '1')
  }

  const test = async () => {
    setTestState('testing')
    clientRef.current?.disconnect()
    const client = new OBSClient(host.trim() || 'localhost', Number(port) || 4455, password)
    clientRef.current = client
    let resolved = false
    const unsub = client.subscribe(s => {
      if (resolved) return
      if (s.connected) { resolved = true; setTestState('ok'); unsub(); client.disconnect() }
      if (s.error) { resolved = true; setTestState('fail'); unsub(); client.disconnect() }
    })
    client.connect()
    setTimeout(() => { if (!resolved) { resolved = true; setTestState('fail'); unsub(); client.disconnect() } }, 5000)
  }

  const handleNext = () => { save(); onNext() }

  return (
    <div className="ob-step">
      <div className="ob-step-num">Step 3 of 4</div>
      <div className="ob-step-icon-row">
        <span className="msym ob-step-icon">settings_input_hdmi</span>
      </div>
      <h2 className="ob-title">Connect OBS Studio</h2>
      <p className="ob-sub">The studio uses OBS WebSocket to show your stream health stats in real time — FPS, bitrate, CPU, and dropped frames right in the top bar.</p>

      <div className="ob-obs-how">
        <div className="ob-obs-how-title">How to enable WebSocket in OBS</div>
        <ol className="ob-obs-steps">
          <li>Open OBS → <strong>Tools</strong> → <strong>WebSocket Server Settings</strong></li>
          <li>Tick <strong>Enable WebSocket server</strong></li>
          <li>Set a password if you want (recommended)</li>
          <li>Default port is <strong>4455</strong></li>
        </ol>
      </div>

      <div className="ob-fields">
        <div className="ob-field-row">
          <div className="ob-field" style={{ flex: 2 }}>
            <label className="ob-label">OBS Host</label>
            <input className="ob-input" value={host} onChange={e => setHost(e.target.value)} placeholder="localhost" />
          </div>
          <div className="ob-field" style={{ flex: 1 }}>
            <label className="ob-label">Port</label>
            <input className="ob-input" value={port} onChange={e => setPort(e.target.value)} placeholder="4455" />
          </div>
        </div>
        <div className="ob-field">
          <label className="ob-label">Password <span style={{ color: 'rgba(255,255,255,.3)', fontWeight: 400 }}>(optional)</span></label>
          <input className="ob-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
      </div>

      <button className={`ob-test-btn ${testState}`} onClick={test} disabled={testState === 'testing'}>
        {testState === 'idle'    && <><span className="msym" style={{ fontSize: 16 }}>bolt</span>Test connection</>}
        {testState === 'testing' && <><span className="msym spin" style={{ fontSize: 16 }}>refresh</span>Testing…</>}
        {testState === 'ok'      && <><span className="msym" style={{ fontSize: 16 }}>check_circle</span>Connected successfully</>}
        {testState === 'fail'    && <><span className="msym" style={{ fontSize: 16 }}>error</span>Could not connect — check settings</>}
      </button>

      <div className="ob-actions">
        <button className="ob-btn-ghost" onClick={onBack}>Back</button>
        <button className="ob-btn-primary" onClick={handleNext}>
          {testState === 'ok' ? 'Save & continue' : 'Continue'}
          <span className="msym" style={{ fontSize: 18 }}>arrow_forward</span>
        </button>
      </div>
      <button className="ob-skip" onClick={onNext}>Skip — set up later</button>
    </div>
  )
}

function StepYouTube({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { user } = useAuth()

  const handleGoogleSignIn = () => {
    if (!user) return
    const url = buildGoogleAuthUrl(user.id)
    window.location.href = url
  }

  return (
    <div className="ob-step">
      <div className="ob-step-num">Step 4 of 4</div>
      <div className="ob-step-icon-row">
        <span className="msym ob-step-icon" style={{ color: '#ff4444' }}>smart_display</span>
      </div>
      <h2 className="ob-title">Connect YouTube</h2>
      <p className="ob-sub">Sign in with your church's Google account so the studio can monitor your live stream health — viewer counts, bitrate, and any issues — automatically.</p>

      <div className="ob-yt-connect">
        <button className="ob-google-btn" onClick={handleGoogleSignIn}>
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>
        <p className="ob-yt-note">You'll be redirected to Google to sign in with your church's YouTube account. We only request read access to your live streams.</p>
      </div>

      <div className="ob-actions">
        <button className="ob-btn-ghost" onClick={onBack}>Back</button>
        <button className="ob-btn-primary" onClick={onNext}>
          Finish
          <span className="msym" style={{ fontSize: 18 }}>check</span>
        </button>
      </div>
      <button className="ob-skip" onClick={onNext}>Skip — I'll connect later</button>
    </div>
  )
}

// ── Main Onboarding shell ─────────────────────────────────────

const TOTAL_STEPS = 5 // 0=welcome, 1=church, 2=pastors, 3=obs, 4=youtube

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [churchName, setChurchName] = useState('')
  const [city, setCity] = useState('')
  const [pastors, setPastors] = useState<Pastor[]>([{ id: '1', name: '', title: '' }])

  const fullChurchName = `${churchName}${city ? ` ${city}` : ''}`

  const finish = () => {
    const validPastors = pastors.filter(p => p.name.trim())
    createLTPresetsFromPastors(validPastors, fullChurchName)
    onComplete({ churchName, city, logo: null })
  }

  const next = () => {
    if (step < TOTAL_STEPS - 1) setStep(s => s + 1)
    else finish()
  }
  const back = () => setStep(s => Math.max(0, s - 1))

  const progressSteps = TOTAL_STEPS - 1 // exclude welcome from dots

  return (
    <div className="ob-overlay">
      <div className="ob-modal">
        <div className="ob-modal-header">
          <div className="ob-modal-brand">
            <img src={shofarLogo} alt="Shofar" style={{ height: 20 }} />
            <span className="ob-modal-wordmark">SHOFAR <span>LIVE STUDIO</span></span>
          </div>
          {step > 0 && (
            <div className="ob-dots">
              {Array.from({ length: progressSteps }, (_, i) => (
                <div key={i} className={`ob-dot${step === i + 1 ? ' active' : step > i + 1 ? ' done' : ''}`} />
              ))}
            </div>
          )}
        </div>

        {step === 0 && <StepWelcome onNext={next} />}
        {step === 1 && <StepChurchDetails churchName={churchName} city={city} setChurchName={setChurchName} setCity={setCity} onBack={back} onNext={next} />}
        {step === 2 && <StepPastors pastors={pastors} setPastors={setPastors} fullChurchName={fullChurchName} onBack={back} onNext={next} />}
        {step === 3 && <StepOBS onBack={back} onNext={next} />}
        {step === 4 && <StepYouTube onBack={back} onNext={finish} />}
      </div>
    </div>
  )
}
