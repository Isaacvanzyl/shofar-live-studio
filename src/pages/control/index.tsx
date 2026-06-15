import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ControlProvider, useControl } from './ControlContext'
import { useAuth } from '../../contexts/AuthContext'
import PreviewCanvas from '../../components/canvas/PreviewCanvas'
import WelcomeLottie from '../../components/WelcomeLottie'
import LowerThirdPreview from '../../components/canvas/LowerThirdPreview'
import TickerStrip from '../../components/canvas/TickerStrip'
import { ScreensLeft, ScreensRight } from '../../components/modules/ScreensModule'
import { LTControls } from '../../components/modules/LowerThirdModule'
import { TickerLeft } from '../../components/modules/TickerModule'
import { getState } from '../../lib/supabase'
import { useOBSStats } from '../../hooks/useOBSStats'
import type { ModuleId, LowerThirdState } from '../../types'
import StreamHealth from '../stream-health/index'
import shofarLogo from '../../assets/ShofarLogo_SonWhite.png'
import Onboarding, { type ChurchProfile } from '../../components/Onboarding'
import ProfilePanel from '../../components/ProfilePanel'

const PROFILE_KEY = 'shofar-church-profile'
const ONBOARDED_KEY = 'shofar-onboarded'

// ── Drag-to-resize right panel ────────────────────────────────────────────────

function usePanelResize(defaultWidth: number, storageKey: string) {
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(storageKey)
    return saved ? +saved : defaultWidth
  })
  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    startX.current = e.clientX
    startW.current = width
    e.preventDefault()
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const delta = startX.current - ev.clientX
      const next = Math.max(140, Math.min(500, startW.current + delta))
      setWidth(next)
    }
    const onUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setWidth(w => { localStorage.setItem(storageKey, String(w)); return w })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [width, storageKey])

  return { width, onMouseDown }
}

function PanelDragHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: 4, flexShrink: 0, cursor: 'col-resize', background: 'var(--line)',
        transition: 'background .15s', position: 'relative', zIndex: 10,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--line)')}
    />
  )
}

function loadProfile(): ChurchProfile {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}') } catch { return { churchName: '', city: '', logo: null } }
}
function saveProfile(p: ChurchProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
}

function WelcomeThumbnail({ lottie }: { lottie: import('../../types').LottieSettings }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [thumbScale, setThumbScale] = useState(0.2)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setThumbScale(el.clientWidth / 1920)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div className="screen-thumb" ref={containerRef}>
      <div className="screen-thumb-inner" style={{ transform: `scale(${thumbScale})` }}>
        <WelcomeLottie settings={lottie} staticFrame={350} />
      </div>
    </div>
  )
}

const SCREEN_PRESETS_KEY = 'shofar_screen_presets_v2'
function readScreenPresets(): import('../../types').ScreenPresetEntry[] {
  try { return JSON.parse(localStorage.getItem(SCREEN_PRESETS_KEY) ?? '[]') } catch { return [] }
}

function ScreensGallery({ onEdit }: { onEdit: (id: string | null) => void }) {
  const { lottieSettings } = useControl()
  const [presets, setPresets] = useState(readScreenPresets)

  useEffect(() => { setPresets(readScreenPresets()) }, [])

  return (
    <div className="gallery-page">
      <div className="gallery-header">
        <h2>Screens</h2>
        <p>Edit your welcome screens and save custom versions for different services.</p>
      </div>
      <div className="gallery-grid">
        {/* Default welcome */}
        <div className="screen-card current">
          <WelcomeThumbnail lottie={lottieSettings} />
          <div className="screen-card-info">
            <div className="screen-card-name">Welcome (Default)</div>
            <div className="screen-card-desc">Live-editable welcome screen</div>
          </div>
          <div className="screen-card-footer">
            <button className="screen-card-edit-btn" onClick={() => onEdit(null)}>
              <span className="msym" style={{ fontSize: 15 }}>edit</span>
              Edit
            </button>
          </div>
        </div>

        {/* Saved presets */}
        {presets.map(p => (
          <div key={p.id} className="screen-card">
            <WelcomeThumbnail lottie={p.lottie} />
            <div className="screen-card-info">
              <div className="screen-card-name">{p.name}</div>
              <div className="screen-card-desc" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 10 }}>
                /output/screen/{p.id}
              </div>
            </div>
            <div className="screen-card-footer">
              <button className="screen-card-edit-btn" onClick={() => onEdit(p.id)}>
                <span className="msym" style={{ fontSize: 15 }}>edit</span>
                Edit
              </button>
            </div>
          </div>
        ))}

        {/* Add new */}
        <div className="screen-card" style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => onEdit(null)}>
          <div className="screen-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surf2)' }}>
            <span className="msym" style={{ fontSize: 36, color: 'var(--text-3)' }}>add</span>
          </div>
          <div className="screen-card-info">
            <div className="screen-card-name">New screen</div>
            <div className="screen-card-desc">Save current content as a new version</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Screens Editor (full 3-column canvas editor) ──────────────────────────────

function ScreensEditor({ onBack, initialPresetId }: { onBack: () => void; initialPresetId: string | null }) {
  return (
    <>
      <div className="editor-breadcrumb">
        <button className="breadcrumb-back" onClick={onBack}>
          <span className="msym" style={{ fontSize: 15 }}>arrow_back</span>
          Screens
        </button>
        <span style={{ color: 'var(--text-3)' }}>/</span>
        <span className="breadcrumb-screen">Welcome</span>
      </div>

      <div className="editor-body" style={{ gridTemplateColumns: '1fr 264px' }}>
        <PreviewCanvas />
        <div className="editor-right"><ScreensRight initialPresetId={initialPresetId} /></div>
      </div>
    </>
  )
}

// ── Lower Third Page ──────────────────────────────────────────────────────────

// Scaled preview box that uses ResizeObserver
function ScaledLTPreview({ state, show }: { state: LowerThirdState; show: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setScale(el.clientWidth / 1920)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="lt-preview-box checker-bg" ref={containerRef}>
      <div className="lt-preview-box-inner" style={{ transform: `scale(${scale})` }}>
        <LowerThirdPreview state={state} show={show} />
      </div>
    </div>
  )
}

function LowerThirdPage() {
  const { ltState, setLtState, pushLtState, ltTimerDuration, setLtTimerDuration } = useControl()
  const [liveState, setLiveState] = useState<LowerThirdState | null>(null)
  const [hasUnpublished, setHasUnpublished] = useState(false)
  const { width: rpWidth, onMouseDown: rpDrag } = usePanelResize(200, 'shofar-lt-rp-width')
  const [countdown, setCountdown] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll Supabase every 2s for actual OBS state
  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const s = await getState('lower-third')
        if (!cancelled && s) setLiveState(s as LowerThirdState)
      } catch { /* ignore */ }
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Edits are staged locally — call pushLive() to push to OBS
  const update = useCallback((patch: Partial<LowerThirdState>) => {
    setLtState({ ...ltState, ...patch })
    setHasUnpublished(true)
  }, [setLtState])

  const pushLive = useCallback(() => {
    pushLtState(ltState)
    setHasUnpublished(false)
  }, [ltState, pushLtState])

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    setCountdown(null)
  }, [])

  // Animate buttons push immediately regardless of staged state
  const animateIn = useCallback(() => {
    const next = { ...ltState, visible: true }
    setLtState(next); pushLtState(next); setHasUnpublished(false)
    clearTimer()
    if (ltTimerDuration) {
      setCountdown(ltTimerDuration)
      tickRef.current = setInterval(() => setCountdown(c => c !== null && c > 1 ? c - 1 : null), 1000)
      timerRef.current = setTimeout(() => {
        clearTimer()
        const off = { ...ltState, visible: false }
        setLtState(off); pushLtState(off)
      }, ltTimerDuration * 1000)
    }
  }, [ltState, setLtState, pushLtState, ltTimerDuration, clearTimer])

  const animateOut = useCallback(() => {
    clearTimer()
    const next = { ...ltState, visible: false }
    setLtState(next); pushLtState(next); setHasUnpublished(false)
  }, [ltState, setLtState, pushLtState, clearTimer])

  const liveVisible = liveState?.visible
  const liveConnected = liveState !== null

  return (
    <div className="lt-page-v2">
      {/* Left: preview area */}
      <div className="lt-left-v2">
        <div className="lt-preview-area-v2">
          <div className="lt-dual-preview">
            {/* Local preview — always visible */}
            <div className="lt-preview-panel">
              <div className="lt-panel-badge">
                <span className="live-dot" />
                PREVIEW
              </div>
              <ScaledLTPreview state={{ ...ltState, visible: true }} show={true} />
            </div>

            {/* Live preview — from Supabase */}
            <div className={`lt-preview-panel${liveConnected && liveVisible ? ' on-air' : ''}`}>
              <div className="lt-panel-badge">
                <span className={`live-dot${liveConnected && liveVisible ? ' on' : ''}`} />
                LIVE
                {liveConnected ? (
                  <span className={`lt-status-tag ${liveVisible ? 'on' : 'off'}`}>
                    {liveVisible ? 'ON AIR' : 'OFF AIR'}
                  </span>
                ) : (
                  <span className="lt-status-tag off">CONNECTING…</span>
                )}
              </div>
              <ScaledLTPreview
                state={liveState ?? ltState}
                show={liveConnected ? (liveVisible ?? false) : false}
              />
            </div>
          </div>
        </div>

        {/* Push live + animate controls */}
        <div className="ctrl-anim-row" style={{ flexDirection: 'column', gap: 8 }}>
          <button
            className="lt-push-live-btn"
            style={{ opacity: hasUnpublished ? 1 : 0.4, pointerEvents: hasUnpublished ? 'auto' : 'none' }}
            onClick={pushLive}
          >
            <span className="msym">upload</span>
            {hasUnpublished ? 'Push Live — Unpublished changes' : 'Push Live'}
          </button>
          {/* Timer presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ font: '500 11px Roboto, sans-serif', color: 'var(--text-3)', flexShrink: 0 }}>Auto-hide</span>
            <div style={{ display: 'flex', gap: 4, flex: 1 }}>
              {([null, 5, 7, 10] as (number | null)[]).map(sec => (
                <button key={String(sec)} onClick={() => setLtTimerDuration(sec)} style={{
                  flex: 1, padding: '4px 2px', borderRadius: 6, border: '1px solid',
                  borderColor: ltTimerDuration === sec ? 'var(--accent)' : 'var(--line-2)',
                  background: ltTimerDuration === sec ? 'var(--accent)' : 'var(--card)',
                  color: ltTimerDuration === sec ? '#fff' : 'var(--text)',
                  font: '600 11px Roboto, sans-serif', cursor: 'pointer',
                }}>{sec === null ? 'Off' : `${sec}s`}</button>
              ))}
              {(() => {
                const isCustom = ltTimerDuration !== null && ![5,7,10].includes(ltTimerDuration)
                return isCustom ? (
                  <input type="number" min={1} max={120} autoFocus
                    value={ltTimerDuration ?? ''}
                    onChange={e => { const v = +e.target.value; if (v > 0) setLtTimerDuration(v) }}
                    onBlur={e => { if (!+e.target.value) setLtTimerDuration(null) }}
                    style={{
                      width: 52, padding: '4px 4px', borderRadius: 6, textAlign: 'center',
                      border: '1px solid var(--accent)',
                      background: 'var(--accent)', color: '#fff',
                      font: '600 11px Roboto, sans-serif', outline: 'none',
                    }}
                  />
                ) : (
                  <button onClick={() => setLtTimerDuration(15)} style={{
                    flex: 1, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--line-2)',
                    background: 'var(--card)', color: 'var(--text-3)',
                    font: '600 11px Roboto, sans-serif', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>Custom</button>
                )
              })()}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ctrl-anim-in" style={{ flex: 1, position: 'relative', boxShadow: ltState.visible ? '0 0 0 2px var(--accent)' : 'none', opacity: ltState.visible ? 1 : 0.7 }} onClick={animateIn}>
              <span className="msym">play_arrow</span> Animate In {ltState.visible && '✓'}
              {countdown !== null && (
                <span style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  font: '700 13px Roboto Mono, monospace',
                  background: 'rgba(0,0,0,.35)', borderRadius: 4, padding: '1px 6px',
                }}>{countdown}s</span>
              )}
            </button>
            <button className="ctrl-anim-out" style={{ flex: 1, boxShadow: !ltState.visible ? '0 0 0 2px var(--accent)' : 'none', opacity: !ltState.visible ? 1 : 0.7 }} onClick={animateOut}>
              <span className="msym">stop</span> Animate Out {!ltState.visible && '✓'}
            </button>
          </div>
        </div>
      </div>

      {/* Right: controls */}
      <PanelDragHandle onMouseDown={rpDrag} />
      <div className="lt-right-v2" style={{ width: rpWidth }}>
        <LTControls />
      </div>
    </div>
  )
}

// ── Ticker Page ───────────────────────────────────────────────────────────────

function TickerPage() {
  const { tickerState, setTickerState, pushTickerState } = useControl()
  const containerRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(0.5)
  const { width: rpWidth, onMouseDown: rpDrag } = usePanelResize(200, 'shofar-ticker-rp-width')

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setPreviewScale(el.clientWidth / 1920)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const update = useCallback((patch: Partial<typeof tickerState>) => {
    const next = { ...tickerState, ...patch }
    setTickerState(next); pushTickerState(next)
  }, [tickerState, setTickerState, pushTickerState])

  return (
    <div className="ticker-page-v2">
      <div className="ticker-left-v2">
        <div className="ticker-preview-box-v2 checker-bg" ref={containerRef}>
          <div style={{ position: 'absolute', width: 1920, height: 1080, transformOrigin: '0 0', transform: `scale(${previewScale})` }}>
            <TickerStrip state={tickerState} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
          <button
            className={`ticker-toggle-compact${tickerState.visible ? ' visible' : ''}`}
            onClick={() => update({ visible: !tickerState.visible })}
          >
            <span className="msym" style={{ fontSize: 15 }}>{tickerState.visible ? 'visibility_off' : 'visibility'}</span>
            {tickerState.visible ? 'Hide' : 'Show'}
          </button>
          <button
            className={`ticker-toggle-compact${tickerState.uppercase ? ' visible' : ''}`}
            style={{ letterSpacing: '.06em' }}
            onClick={() => update({ uppercase: !tickerState.uppercase })}
          >
            <span className="msym" style={{ fontSize: 15 }}>format_letter_spacing_wider</span>
            ALL CAPS
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
          <span className="msym" style={{ fontSize: 16, color: 'var(--text-3)', flexShrink: 0 }}>format_size</span>
          <input
            type="range" className="ctrl-slider" min={10} max={28}
            value={tickerState.fontSize}
            onChange={e => update({ fontSize: +e.target.value })}
            style={{ flex: 1 }}
          />
          <span style={{ font: '500 12px Roboto Mono,monospace', color: 'var(--text-2)', minWidth: 28, textAlign: 'right' }}>{tickerState.fontSize}px</span>
        </div>
        <p style={{ font: '400 11px Roboto,sans-serif', color: 'var(--text-3)' }}>OBS browser source · 1920 × 60</p>
      </div>
      <PanelDragHandle onMouseDown={rpDrag} />
      <div className="ticker-right-v2" style={{ flex: 'none', width: rpWidth }}>
        <TickerLeft />
      </div>
    </div>
  )
}

// ── OBS Sources Page ──────────────────────────────────────────────────────────

function OBSPage() {
  const base = window.location.origin
  const hasSupabase = !!(import.meta.env.VITE_SUPABASE_URL && !import.meta.env.VITE_SUPABASE_URL.includes('placeholder'))
  const { profile } = useAuth()
  const orgId = profile?.org_id
  const [res, setRes] = useState<'1080' | '4k'>('1080')
  const scale = res === '4k' ? 2 : 1

  // Build URL with org + optional scale params
  const src = (path: string) => {
    const params = new URLSearchParams()
    if (orgId) params.set('org', orgId)
    if (scale > 1) params.set('scale', String(scale))
    const qs = params.toString()
    return `${base}${path}${qs ? '?' + qs : ''}`
  }

  const savedPresets = readScreenPresets()
  const screenSources = [
    { label: 'Welcome (Default)', url: src('/output/welcome'), w: 1920 * scale, h: 1080 * scale },
    ...savedPresets.map(p => ({ label: p.name, url: src(`/output/screen/${p.id}`), w: 1920 * scale, h: 1080 * scale })),
  ]
  const overlaySources = [
    { label: 'Lower Third', url: src('/output/lower-third'), w: 1920 * scale, h: 1080 * scale },
    { label: 'Ticker',      url: src('/output/ticker'),      w: 1920 * scale, h: 1080 * scale },
  ]
  const sources = [...screenSources, ...overlaySources]

  const copy = (url: string) => navigator.clipboard.writeText(url).catch(() => {})

  return (
    <div className="obs-page module-page">
      <div className="obs-page-main">
        {!hasSupabase && (
          <div style={{ margin: '0 0 16px', padding: '14px 16px', background: 'rgba(232,79,14,.08)', border: '1px solid rgba(232,79,14,.3)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontFamily: 'Roboto', fontWeight: 600, fontSize: 12, color: 'var(--accent)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              <span className="msym" style={{ fontSize: 16 }}>warning</span>
              Supabase not configured — OBS sync is inactive
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.8, fontFamily: 'Roboto' }}>
              <b>To connect OBS browser sources:</b><br />
              1. Create a free project at <b>supabase.com</b><br />
              2. In your project, go to <b>SQL Editor</b> and run:<br />
              <code style={{ display: 'block', margin: '6px 0', padding: '8px 12px', background: 'var(--surf2)', borderRadius: 8, fontSize: 11, color: 'var(--text-1)', whiteSpace: 'pre' }}>{`create table broadcast_state (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz default now()
);
alter table broadcast_state enable row level security;
create policy "allow all" on broadcast_state
  for all using (true) with check (true);`}</code>
              3. Enable Realtime for <b>broadcast_state</b> in Table Editor<br />
              4. Copy <b>Project URL</b> + <b>anon key</b> from Settings → API<br />
              5. Create a <code style={{ color: 'var(--accent)' }}>.env</code> file next to <code style={{ color: 'var(--accent)' }}>package.json</code>:<br />
              <code style={{ display: 'block', margin: '6px 0', padding: '8px 12px', background: 'var(--surf2)', borderRadius: 8, fontSize: 11, color: 'var(--text-1)', whiteSpace: 'pre' }}>{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}</code>
              6. Restart the dev server (<code style={{ color: 'var(--accent)' }}>npm run dev</code>)
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="obs-page-header" style={{ margin: 0 }}>Browser source URLs</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['1080', '4k'] as const).map(r => (
              <button key={r} onClick={() => setRes(r)} style={{
                padding: '4px 14px', borderRadius: 20, border: '1px solid var(--line)',
                background: res === r ? 'var(--accent)' : 'var(--surf2)',
                color: res === r ? '#fff' : 'var(--text-2)',
                font: '600 11px Roboto, sans-serif', cursor: 'pointer', letterSpacing: '.04em',
              }}>{r === '4k' ? '4K' : '1080p'}</button>
            ))}
          </div>
        </div>

        {sources.map(({ label, url, w, h }) => (
          <div key={label} className="obs-row">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, width: 100, flexShrink: 0 }}>
              <span className="obs-label">{label}</span>
              <span style={{ font: '400 10px Roboto Mono,monospace', color: 'var(--text-3)' }}>{w} × {h}</span>
            </div>
            <input className="obs-url" readOnly value={url} />
            <button className="obs-copy" onClick={() => copy(url)}>Copy</button>
          </div>
        ))}
        <div style={{ padding: '12px 14px', font: '11px Roboto Mono,monospace', color: 'var(--text-3)', lineHeight: 1.8, borderTop: '1px solid var(--line)', marginTop: 4 }}>
          OBS Custom CSS (paste into browser source settings):<br />
          body {'{'}background-color: rgba(0,0,0,0) !important; margin: 0 !important; overflow: hidden !important;{'}'}
        </div>
      </div>

      <div className="obs-page-side">
        <div className="obs-info-card">
          <div className="obs-info-title">
            <span className="msym" style={{ fontSize: 18, color: 'var(--text-2)' }}>tv</span>
            Scene setup
          </div>
          <div className="obs-info-body">
            Each welcome screen version (Default + any saved custom screens) goes into its own OBS scene as a Browser Source.
            Lower Third and Ticker are overlay sources — add them on top of every scene where you want them.
          </div>
        </div>
        <div className="obs-info-card">
          <div className="obs-info-title">
            <span className="msym" style={{ fontSize: 18, color: 'var(--text-2)' }}>aspect_ratio</span>
            4K sources
          </div>
          <div className="obs-info-body">
            Switch to 4K above to get URLs sized for 3840 × 2160. The Lower Third and Ticker URLs include <code style={{ color: 'var(--accent)', fontSize: 10 }}>?scale=2</code> which doubles all sizes. Set your OBS browser source dimensions to match the numbers shown.
          </div>
        </div>
        <div className="obs-info-card">
          <div className="obs-info-title">
            <span className="msym" style={{ fontSize: 18, color: 'var(--text-2)' }}>sync</span>
            Realtime sync
          </div>
          <div className="obs-info-body">
            All state syncs live via Supabase Realtime. Changes you make on the control page appear
            instantly in OBS browser sources without needing to refresh.
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Top Bar ───────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: ModuleId; label: string; icon: string }[] = [
  { id: 'screens',      label: 'Screens',       icon: 'tv'             },
  { id: 'lowerthird',   label: 'Lower Third',   icon: 'subtitles'      },
  { id: 'ticker',       label: 'Ticker',        icon: 'rss_feed'       },
  { id: 'health',       label: 'OBS Sources',   icon: 'cast'           },
  { id: 'streamhealth', label: 'Stream Health', icon: 'monitor_heart'  },
]

function TopBar({ theme, onThemeToggle }: { theme: 'dark' | 'light'; onThemeToggle: () => void }) {
  const obsHost     = localStorage.getItem('obs_host') ?? 'localhost'
  const obsPort     = Number(localStorage.getItem('obs_port') ?? 4455)
  const obsPassword = localStorage.getItem('obs_password') ?? ''
  const obsEnabled  = !!localStorage.getItem('obs_enabled')

  const obs = useOBSStats(obsHost, obsPort, obsPassword, obsEnabled)

  const isLive       = obs.streamStatus?.outputActive ?? false
  const droppedPct   = obs.stats ? (obs.stats.outputSkippedFrames / Math.max(obs.stats.outputTotalFrames, 1)) * 100 : null
  const cpu          = obs.stats?.cpuUsage ?? null
  const prevBytes = useRef<{ bytes: number; t: number } | null>(null)
  const [kbps, setKbps] = useState<number | null>(null)
  useEffect(() => {
    const bytes = obs.streamStatus?.outputBytes ?? null
    if (bytes == null) { prevBytes.current = null; setKbps(null); return }
    const now = Date.now()
    if (prevBytes.current) {
      const dt = (now - prevBytes.current.t) / 1000
      if (dt > 0) setKbps(Math.round(((bytes - prevBytes.current.bytes) * 8) / 1000 / dt))
    }
    prevBytes.current = { bytes, t: now }
  }, [obs.streamStatus?.outputBytes])
  const fps          = obs.stats?.activeFps ?? null

  const dropColor = droppedPct == null ? 'rgba(255,255,255,.3)'
    : droppedPct < 1  ? '#22c55e'
    : droppedPct < 5  ? '#f59e0b'
    : '#ef4444'

  return (
    <div className="app-topbar">
      <div className="wordmark">
        <img src={shofarLogo} alt="Shofar" style={{ height: 22, width: 'auto', marginRight: 8, verticalAlign: 'middle' }} />
        SHOFAR <span>LIVE STUDIO</span>
      </div>

      {/* ── Live status strip ── */}
      {obs.connected && (
        <div className="tb-stats">
          {/* LIVE / OFFLINE pill */}
          <div className={`tb-live-pill ${isLive ? 'live' : 'offline'}`}>
            <span className="tb-live-dot" />
            {isLive ? 'LIVE' : 'OFFLINE'}
          </div>

          {fps != null && (
            <div className="tb-stat">
              <span className="tb-stat-label">FPS</span>
              <span className="tb-stat-val">{Math.round(fps)}</span>
            </div>
          )}

          {kbps != null && kbps > 0 && (
            <div className="tb-stat">
              <span className="tb-stat-label">KBPS</span>
              <span className="tb-stat-val">{kbps.toLocaleString()}</span>
            </div>
          )}

          {cpu != null && (
            <div className="tb-stat">
              <span className="tb-stat-label">CPU</span>
              <span className="tb-stat-val" style={{ color: cpu > 80 ? '#ef4444' : cpu > 60 ? '#f59e0b' : undefined }}>
                {cpu.toFixed(1)}%
              </span>
            </div>
          )}

          {droppedPct != null && (
            <div className="tb-stat">
              <span className="tb-stat-label">DROPPED</span>
              <span className="tb-stat-val" style={{ color: dropColor }}>
                {droppedPct < 0.1 ? '0%' : droppedPct.toFixed(1) + '%'}
              </span>
            </div>
          )}
        </div>
      )}

      {!obs.connected && obsEnabled && (
        <div className="tb-obs-disconnected">
          <span className="msym" style={{ fontSize: 13 }}>warning</span>
          OBS disconnected
        </div>
      )}

      <div className="tbgap" />
    </div>
  )
}

function SideNav({ onModChange, onEditProfile, theme, onThemeToggle }: { onModChange: () => void; onEditProfile: () => void; theme: 'dark' | 'light'; onThemeToggle: () => void }) {
  const { curMod, setCurMod } = useControl()
  const { isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const select = (id: ModuleId) => { setCurMod(id); onModChange() }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <nav className="app-sidebar">
      <div className="snav-section">Broadcast</div>
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          className={`snav-item${curMod === item.id ? ' active' : ''}`}
          onClick={() => select(item.id)}
        >
          <span className="msym" style={{ fontSize: 18 }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <div className="snav-sep" />
      <div className="snav-section">Account</div>
      {isAdmin && (
        <button className="snav-item" onClick={() => navigate('/admin')}>
          <span className="msym" style={{ fontSize: 18 }}>admin_panel_settings</span>
          Admin Panel
        </button>
      )}
      <button className="snav-item" onClick={onEditProfile}>
        <span className="msym" style={{ fontSize: 18 }}>manage_accounts</span>
        Edit Profile
      </button>
      <button className="snav-item snav-danger" onClick={handleSignOut}>
        <span className="msym" style={{ fontSize: 18 }}>logout</span>
        Sign Out
      </button>
      <div className="snav-sep" />
      <button className="snav-item snav-theme" onClick={onThemeToggle} title="Toggle theme">
        <span className="msym" style={{ fontSize: 18 }}>{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
      </button>
    </nav>
  )
}

function StatusBar() {
  const { curScreen, curRes, scale, curMod } = useControl()
  const screenName = 'Welcome'
  return (
    <div className="app-statusbar">
      <div className="sb-dot" />
      {curMod === 'screens'
        ? <><span style={{ color: 'var(--text)' }}>{screenName}</span><span>·</span><span style={{ color: 'var(--accent)' }}>{curRes === '4k' ? '3840 × 2160' : '1920 × 1080'}</span><span>·</span><span>{Math.round(scale * 100)}%</span></>
        : <span style={{ color: 'var(--text)' }}>{NAV_ITEMS.find(t => t.id === curMod)?.label}</span>
      }
      <div style={{ flex: 1 }} />
      {curMod === 'screens' && <span>Arrow keys nudge · Shift = 10px · Esc deselect · Ctrl+Z undo</span>}
    </div>
  )
}

function Toast() {
  const { toastMsg } = useControl()
  return <div className={`toast${toastMsg ? ' show' : ''}`}>{toastMsg}</div>
}

// ── Main layout switcher ──────────────────────────────────────────────────────

function ControlInner() {
  const { curMod } = useControl()
  const [editScreen, setEditScreen] = useState<string | null | false>(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('shofar-theme') as 'dark' | 'light') ?? 'dark')
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(ONBOARDED_KEY))
  const [profile, setProfile] = useState<ChurchProfile>(loadProfile)
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : '')
    localStorage.setItem('shofar-theme', theme)
  }, [theme])

  useEffect(() => {
    const label = NAV_ITEMS.find(n => n.id === curMod)?.label ?? 'Hub'
    document.title = `Shofar — ${label}`
  }, [curMod])

  // Show toast if redirected back from Google OAuth
  const { showToast } = useControl()
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('yt_connected') === '1') {
      showToast('YouTube connected successfully!')
      window.history.replaceState({}, '', '/control')
    } else if (params.get('yt_error')) {
      showToast('YouTube connection failed: ' + decodeURIComponent(params.get('yt_error')!))
      window.history.replaceState({}, '', '/control')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty('--mx', `${e.clientX}px`)
      document.documentElement.style.setProperty('--my', `${e.clientY}px`)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  const handleOnboardingComplete = (p: ChurchProfile) => {
    saveProfile(p)
    setProfile(p)
    localStorage.setItem(ONBOARDED_KEY, '1')
    setShowOnboarding(false)
  }

  const handleProfileSave = (p: ChurchProfile) => {
    saveProfile(p)
    setProfile(p)
  }

  const resetToGallery = () => setEditScreen(false)
  const inEditor = curMod === 'screens' && editScreen !== false

  return (
    <div className="app-shell">
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      <ProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} profile={profile} onSave={handleProfileSave} />
      <TopBar theme={theme} onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
      <div className="app-body">
        <SideNav onModChange={resetToGallery} onEditProfile={() => setProfileOpen(true)} theme={theme} onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
        <div className="app-content">
          {curMod === 'screens' && !inEditor && <ScreensGallery onEdit={(id) => setEditScreen(id)} />}
          {inEditor && <ScreensEditor onBack={resetToGallery} initialPresetId={editScreen as string | null} />}
          {curMod === 'lowerthird'   && <LowerThirdPage />}
          {curMod === 'ticker'       && <TickerPage />}
          {curMod === 'health'       && <OBSPage />}
          {curMod === 'streamhealth' && <div className="embedded-health"><StreamHealth /></div>}
        </div>
      </div>
      <StatusBar />
      <Toast />
    </div>
  )
}

export default function ControlPage() {
  const { profile } = useAuth()
  return (
    <ControlProvider orgId={profile?.org_id}>
      <ControlInner />
    </ControlProvider>
  )
}
