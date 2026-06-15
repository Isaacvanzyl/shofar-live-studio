import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useYouTubeHealth } from '../../hooks/useYouTubeHealth'
import { useOBSStats } from '../../hooks/useOBSStats'
import { getSessions, getActiveSession, startSession, snapshotSession, endSession, clearSession, type StreamSession } from '../../lib/streamHistory'
import { subscribeToState } from '../../lib/supabase'

interface GPUStats {
  model: string
  vendor: string
  vram: number | null
  vramLabel: string | null
  vramUsed: number | null
  usage: number | null
  temperature: number | null
  platform: string
}

// ── History ───────────────────────────────────────────────────────────────────

type HistoryPoint = {
  t: number
  cpu: number | null
  gpu: number | null
  bitrate: number | null
  fps: number | null
  droppedPct: number | null
  viewers: number | null
}

const MAX_HISTORY = 360 // 30 min at 5s intervals

const SERIES_DEFS = [
  { key: 'cpu',        label: 'CPU %',    color: '#4CAF50', unit: '%' },
  { key: 'gpu',        label: 'GPU %',    color: '#a78bfa', unit: '%' },
  { key: 'bitrate',    label: 'Bitrate',  color: '#E84F0E', unit: ' kbps' },
  { key: 'fps',        label: 'FPS',      color: '#7dd3fc', unit: ' fps' },
  { key: 'droppedPct', label: 'Dropped',  color: '#FFA726', unit: '%' },
  { key: 'viewers',    label: 'Viewers',  color: '#a78bfa', unit: '' },
] as const

type SeriesKey = typeof SERIES_DEFS[number]['key']

// ── Performance Graph ─────────────────────────────────────────────────────────

function formatVal(key: SeriesKey, v: number | null): string {
  if (v == null) return '—'
  if (key === 'cpu' || key === 'droppedPct') return `${v.toFixed(1)}%`
  if (key === 'bitrate') return `${Math.round(v)} kbps`
  if (key === 'fps') return `${v.toFixed(1)} fps`
  return `${Math.round(v)}`
}

function PerformanceGraph({ history, enabled }: { history: HistoryPoint[]; enabled: Set<SeriesKey> }) {
  const W = 900, H = 150
  const PAD = { l: 36, r: 12, t: 10, b: 24 }
  const GW = W - PAD.l - PAD.r
  const GH = H - PAD.t - PAD.b
  const [hover, setHover] = useState<{ svgX: number; idx: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const hasData = history.length >= 2
  const minT = hasData ? history[0].t : 0
  const maxT = hasData ? history[history.length - 1].t : 1
  const tRange = Math.max(maxT - minT, 1)

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg || history.length === 0) return
    const rect = svg.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    const frac = Math.max(0, Math.min(1, (svgX - PAD.l) / GW))
    const t = minT + frac * tRange
    let closest = 0, bestDist = Infinity
    history.forEach((p, i) => { const d = Math.abs(p.t - t); if (d < bestDist) { bestDist = d; closest = i } })
    setHover({ svgX, idx: closest })
  }, [history, minT, tRange])

  if (!hasData) return (
    <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted2)', fontSize: 12 }}>
      Waiting for data…
    </div>
  )

  const seriesMax: Record<SeriesKey, number> = {
    cpu: 100,
    gpu: 100,
    fps: Math.max(...history.map(p => p.fps ?? 0), 30),
    bitrate: Math.max(...history.map(p => p.bitrate ?? 0), 1000),
    droppedPct: Math.max(...history.map(p => p.droppedPct ?? 0), 1),
    viewers: Math.max(...history.map(p => p.viewers ?? 0), 10),
  }

  const tx = (t: number) => PAD.l + ((t - minT) / tRange) * GW
  const ty = (val: number, key: SeriesKey) => PAD.t + GH - (Math.min(val, seriesMax[key]) / seriesMax[key]) * GH

  const buildPath = (key: SeriesKey) => {
    const pts: string[] = []
    for (const p of history) {
      const v = p[key]
      if (v == null) continue
      pts.push(`${tx(p.t).toFixed(1)},${ty(v, key).toFixed(1)}`)
    }
    return pts.length > 1 ? `M ${pts.join(' L ')}` : ''
  }

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map(f => ({ y: PAD.t + GH * (1 - f), label: `${Math.round(f * 100)}` }))
  const timeTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    x: tx(minT + tRange * f),
    label: new Date(minT + tRange * f).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
  }))

  const hoverPt = hover !== null ? history[hover.idx] : null
  const hoverX = hoverPt ? tx(hoverPt.t) : null

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHover(null)}
    >
      {/* Horizontal grid lines + Y labels */}
      {gridYs.map(({ y, label }, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={PAD.l + GW} y1={y} y2={y}
            stroke={i === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'}
            strokeWidth={1} />
          <text x={PAD.l - 6} y={y + 3.5} fontSize={8} fill="rgba(255,255,255,0.25)"
            fontFamily="Roboto Mono, monospace" textAnchor="end">{label}</text>
        </g>
      ))}

      {/* Series lines only — no area fill */}
      {SERIES_DEFS.map(({ key, color }) => {
        if (!enabled.has(key)) return null
        const path = buildPath(key)
        if (!path) return null
        return <path key={key} d={path} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.85} strokeLinejoin="round" strokeLinecap="round" />
      })}

      {/* Crosshair — thin, low contrast */}
      {hoverX !== null && (
        <line x1={hoverX} x2={hoverX} y1={PAD.t} y2={PAD.t + GH}
          stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
      )}

      {/* Hover dots */}
      {hoverPt && SERIES_DEFS.map(({ key, color }) => {
        if (!enabled.has(key)) return null
        const v = hoverPt[key]
        if (v == null) return null
        return <circle key={key} cx={tx(hoverPt.t)} cy={ty(v, key)} r={2.5} fill={color} />
      })}

      {/* Tooltip — minimal, left-aligned */}
      {hoverPt && hover && (() => {
        const enabledSeries = SERIES_DEFS.filter(s => enabled.has(s.key))
        const tipW = 148, tipH = 14 + enabledSeries.length * 15 + 6
        const tipX = hover.svgX + 14 > W - tipW ? hover.svgX - tipW - 6 : hover.svgX + 8
        const tipY = PAD.t + 2
        return (
          <g>
            <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={4}
              fill="rgba(15,17,23,0.92)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
            <text x={tipX + 8} y={tipY + 11} fontSize={8} fill="rgba(255,255,255,0.35)"
              fontFamily="Roboto Mono, monospace">
              {new Date(hoverPt.t).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </text>
            {enabledSeries.map(({ key, label, color }, i) => (
              <g key={key}>
                <line x1={tipX + 8} x2={tipX + 14} y1={tipY + 18 + i * 15} y2={tipY + 18 + i * 15}
                  stroke={color} strokeWidth={1.5} />
                <text x={tipX + 19} y={tipY + 21.5 + i * 15} fontSize={9.5}
                  fill="rgba(255,255,255,0.55)" fontFamily="Roboto, sans-serif">{label}</text>
                <text x={tipX + tipW - 8} y={tipY + 21.5 + i * 15} fontSize={9.5}
                  fill="rgba(255,255,255,0.9)" fontFamily="Roboto Mono, monospace" textAnchor="end">
                  {formatVal(key, hoverPt[key])}
                </text>
              </g>
            ))}
          </g>
        )
      })()}

      {/* X-axis time labels */}
      {timeTicks.map(({ x, label }, i) => (
        <text key={i} x={x} y={H - 4} fontSize={8} fill="rgba(255,255,255,0.25)"
          fontFamily="Roboto Mono, monospace" textAnchor="middle">{label}</text>
      ))}
    </svg>
  )
}

// ── Gauge bar ──────────────────────────────────────────────────────────────────

function GaugeBar({ value, max = 100, color }: { value: number | null; max?: number; color: string }) {
  const pct = value != null ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ height: 4, background: 'var(--surf3)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width .4s ease' }} />
    </div>
  )
}

function HealthScore({ status }: { status: string }) {
  const scores: Record<string, { label: string; color: string; bars: number }> = {
    good:   { label: 'Good',    color: '#4CAF50', bars: 4 },
    ok:     { label: 'OK',      color: '#FFA726', bars: 3 },
    bad:    { label: 'Fair',    color: '#E84F0E', bars: 2 },
    noData: { label: 'No Data', color: 'var(--muted2)', bars: 1 },
  }
  const s = scores[status] ?? scores.noData
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
        {[1, 2, 3, 4].map((b) => (
          <div key={b} style={{
            width: 7,
            height: 8 + b * 5,
            borderRadius: 3,
            background: b <= s.bars ? s.color : 'var(--surf3)',
            transition: 'background .3s',
          }} />
        ))}
      </div>
      <span style={{ fontFamily: 'Roboto', fontWeight: 500, fontSize: 20, color: s.color }}>{s.label}</span>
    </div>
  )
}

function Duration({ since }: { since: string | undefined }) {
  if (!since) return <span style={{ color: 'var(--muted2)' }}>—</span>
  const start = new Date(since)
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  const h = Math.floor(diffMs / 3600000)
  const m = Math.floor((diffMs % 3600000) / 60000)
  const s = Math.floor((diffMs % 60000) / 1000)
  return <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 11 }}>{h}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}</span>
}

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="msym" style={style}>{name}</span>
}

// ── Connection Settings (clean collapsed bar) ─────────────────
function ConnectionSettings({ obs, obsEnabled, setObsEnabled, obsHostInput, setObsHostInput, obsPortInput, setObsPortInput, obsPasswordInput, setObsPasswordInput, setObsHost, setObsPort, setObsPassword, channelIdInput, setChannelIdInput, channelId, setChannelId, apiKey }: {
  obs: ReturnType<typeof import('../../hooks/useOBSStats').useOBSStats>
  obsEnabled: boolean; setObsEnabled: (v: boolean) => void
  obsHostInput: string; setObsHostInput: (v: string) => void
  obsPortInput: string; setObsPortInput: (v: string) => void
  obsPasswordInput: string; setObsPasswordInput: (v: string) => void
  setObsHost: (v: string) => void; setObsPort: (v: number) => void; setObsPassword: (v: string) => void
  channelIdInput: string; setChannelIdInput: (v: string) => void
  channelId: string; setChannelId: (v: string) => void
  apiKey: string
}) {
  const [open, setOpen] = useState(false)

  const obsStatus = !obsEnabled ? 'disabled' : obs.connected ? 'connected' : obs.connecting ? 'connecting' : 'disconnected'
  const ytStatus  = channelId ? 'configured' : 'not-set'

  const saveOBS = () => {
    const h = obsHostInput.trim() || 'localhost'
    const p = Number(obsPortInput) || 4455
    setObsHost(h); setObsPort(p); setObsPassword(obsPasswordInput)
    localStorage.setItem('obs_host', h)
    localStorage.setItem('obs_port', String(p))
    localStorage.setItem('obs_password', obsPasswordInput)
    localStorage.setItem('obs_enabled', 'true')
    setObsEnabled(true)
  }

  const saveYT = () => {
    const id = channelIdInput.trim()
    setChannelId(id)
    localStorage.setItem('yt_channel_id', id)
  }

  return (
    <div style={{ margin: '12px 24px 0' }}>
      {/* ── Status bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--surf2)', border: '1px solid var(--border)',
        borderRadius: open ? '12px 12px 0 0' : 12,
        padding: '10px 14px', cursor: 'pointer',
        transition: 'border-radius .2s',
      }} onClick={() => setOpen(o => !o)}>
        <Icon name="settings" style={{ fontSize: 15, color: 'var(--muted)', flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>Connections</span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 4 }}>
          {/* OBS chip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
            background: obsStatus === 'connected' ? 'rgba(34,197,94,.12)' : obsStatus === 'disabled' ? 'rgba(255,255,255,.05)' : 'rgba(239,68,68,.1)',
            border: `1px solid ${obsStatus === 'connected' ? 'rgba(34,197,94,.3)' : obsStatus === 'disabled' ? 'rgba(255,255,255,.1)' : 'rgba(239,68,68,.2)'}`,
            color: obsStatus === 'connected' ? '#22c55e' : obsStatus === 'disabled' ? 'rgba(255,255,255,.3)' : obsStatus === 'connecting' ? '#f59e0b' : '#ef4444',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
            OBS {obsStatus === 'connected' ? 'Connected' : obsStatus === 'connecting' ? 'Connecting…' : obsStatus === 'disabled' ? 'Disabled' : 'Disconnected'}
          </div>
          {/* YouTube chip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
            background: ytStatus === 'configured' ? 'rgba(34,197,94,.08)' : 'rgba(255,255,255,.05)',
            border: `1px solid ${ytStatus === 'configured' ? 'rgba(34,197,94,.2)' : 'rgba(255,255,255,.1)'}`,
            color: ytStatus === 'configured' ? '#86efac' : 'rgba(255,255,255,.3)',
          }}>
            <Icon name="smart_display" style={{ fontSize: 11 }} />
            YouTube {ytStatus === 'configured' ? 'Set' : 'Not configured'}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <Icon name={open ? 'expand_less' : 'expand_more'} style={{ fontSize: 18, color: 'var(--muted)' }} />
      </div>

      {/* ── Expanded settings ── */}
      {open && (
        <div style={{
          background: 'var(--surf2)', border: '1px solid var(--border)',
          borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '16px 14px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* OBS section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Icon name="settings_input_hdmi" style={{ fontSize: 15, color: 'var(--muted)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>OBS WebSocket</span>
              <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--muted)' }}>
                <input type="checkbox" checked={obsEnabled} onChange={e => {
                  setObsEnabled(e.target.checked)
                  localStorage.setItem('obs_enabled', String(e.target.checked))
                }} style={{ accentColor: '#E84F0E' }} />
                Enable
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '2 1 100px' }}>
                <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 4 }}>Host</div>
                <input value={obsHostInput} onChange={e => setObsHostInput(e.target.value)} placeholder="localhost"
                  style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, padding: '6px 10px', borderRadius: 8, fontFamily: 'Roboto Mono, monospace', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: '1 1 60px' }}>
                <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 4 }}>Port</div>
                <input type="number" value={obsPortInput} onChange={e => setObsPortInput(e.target.value)}
                  style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, padding: '6px 10px', borderRadius: 8, fontFamily: 'Roboto Mono, monospace', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: '2 1 100px' }}>
                <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 4 }}>Password</div>
                <input type="password" value={obsPasswordInput} onChange={e => setObsPasswordInput(e.target.value)} placeholder="optional"
                  style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, padding: '6px 10px', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <button className="tb-btn prim" style={{ height: 32, whiteSpace: 'nowrap' }} onClick={saveOBS}>
                <Icon name="link" /> Save &amp; Connect
              </button>
            </div>
            {obs.error && <div style={{ marginTop: 6, fontSize: 11, color: '#E84F0E' }}>{obs.error}</div>}
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* YouTube section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Icon name="smart_display" style={{ fontSize: 15, color: 'var(--muted)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>YouTube Source</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={channelIdInput} onChange={e => setChannelIdInput(e.target.value)}
                placeholder="Channel ID (UC…) or Video ID for unlisted streams"
                style={{ flex: 1, background: 'var(--card)', border: `1px solid ${channelId ? 'rgba(34,197,94,.4)' : 'var(--border)'}`, color: 'var(--text)', fontSize: 12, padding: '6px 10px', borderRadius: 8, fontFamily: 'Roboto Mono, monospace', outline: 'none' }} />
              <button className="tb-btn prim" style={{ height: 32 }} onClick={saveYT}>
                <Icon name="check" /> Save
              </button>
            </div>
            {!apiKey && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted2)', lineHeight: 1.7 }}>
                No YouTube API key configured. Add <code style={{ color: '#7dd3fc', background: 'var(--surf3)', padding: '1px 5px', borderRadius: 3 }}>VITE_YOUTUBE_API_KEY</code> to your Vercel environment variables for viewer count &amp; health data.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ViewerChart({ data }: { data: { t: number; viewers: number }[] }) {
  if (data.length < 2) return <span style={{ color: 'var(--muted2)', fontSize: 11 }}>Not enough data to chart</span>
  const W = 320, H = 70
  const minT = data[0].t, maxT = data[data.length - 1].t
  const maxV = Math.max(...data.map(d => d.viewers), 1)
  const pts = data.map(d => {
    const x = ((d.t - minT) / Math.max(maxT - minT, 1)) * W
    const y = H - (d.viewers / maxV) * H * 0.85 - 4
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="vg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#E84F0E" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#E84F0E" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts + ` ${W},${H} 0,${H}`} fill="url(#vg)" stroke="none" />
      <polyline points={pts} fill="none" stroke="#E84F0E" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => i === data.length - 1 ? (
        <circle key={i} cx={((d.t - minT) / Math.max(maxT - minT, 1)) * W} cy={H - (d.viewers / maxV) * H * 0.85 - 4} r={3} fill="#E84F0E" />
      ) : null)}
    </svg>
  )
}

function SessionCard({ session, expanded, onToggle, onDelete }: {
  session: StreamSession
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const duration = session.endedAt
    ? Math.round((session.endedAt - session.startedAt) / 1000)
    : null
  const h = duration ? Math.floor(duration / 3600) : 0
  const m = duration ? Math.floor((duration % 3600) / 60) : 0
  const durationStr = duration ? `${h}h ${m}m` : '—'
  const date = new Date(session.startedAt)
  const dateStr = date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{
      background: 'var(--surf2, var(--card))',
      border: `1px solid ${expanded ? 'rgba(232,79,14,0.3)' : 'var(--border)'}`,
      borderRadius: 14,
      overflow: 'hidden',
      transition: 'border-color .2s',
    }}>
      {/* Header row */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
        onClick={onToggle}
      >
        {session.thumbnail && (
          <img src={session.thumbnail} alt="" style={{ width: 80, height: 45, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Roboto', fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.title || '(Untitled stream)'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>{dateStr} · {timeStr}</span>
            {duration !== null && <span>Duration: {durationStr}</span>}
            <span style={{ color: '#4CAF50' }}>Peak: {session.peakViewers} viewers</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {session.droppedFramesPct !== undefined && (
            <div style={{
              padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
              background: session.droppedFramesPct < 1 ? 'rgba(76,175,80,0.1)' : session.droppedFramesPct < 5 ? 'rgba(255,167,38,0.1)' : 'rgba(232,79,14,0.1)',
              color: session.droppedFramesPct < 1 ? '#4CAF50' : session.droppedFramesPct < 5 ? '#FFA726' : '#E84F0E',
              border: `1px solid currentColor`,
            }}>
              {session.droppedFramesPct.toFixed(1)}% dropped
            </div>
          )}
          <span className="msym" style={{ fontSize: 18, color: 'var(--muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>expand_more</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, margin: '14px 0' }}>
            {[
              { label: 'Peak Viewers', value: String(session.peakViewers), color: '#4CAF50' },
              { label: 'Duration', value: durationStr },
              { label: 'Dropped Frames', value: session.droppedFramesPct !== undefined ? `${session.droppedFramesPct.toFixed(2)}%` : '—', color: session.droppedFramesPct !== undefined && session.droppedFramesPct > 1 ? '#E84F0E' : undefined },
              { label: 'Avg FPS', value: session.avgFps !== undefined ? session.avgFps.toFixed(1) : '—' },
              { label: 'Avg CPU', value: session.avgCpu !== undefined ? `${session.avgCpu.toFixed(1)}%` : '—' },
              { label: 'Snapshots', value: String(session.viewerHistory.length) },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--panel)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: color ?? 'var(--text)', fontFamily: 'Roboto Mono, monospace' }}>{value}</div>
              </div>
            ))}
          </div>
          {session.viewerHistory.length >= 2 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Viewer Count Over Time</div>
              <ViewerChart data={session.viewerHistory} />
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            style={{ fontSize: 11, color: 'var(--muted2)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Delete record
          </button>
        </div>
      )}
    </div>
  )
}

export default function StreamHealth() {
  useEffect(() => { document.title = 'Shofar — Stream Health' }, [])
  const [channelId, setChannelId] = useState(() => localStorage.getItem('yt_channel_id') ?? 'UC_zSVOE2TLLDkzov3NLx_GQ')
  const [channelIdInput, setChannelIdInput] = useState(() => localStorage.getItem('yt_channel_id') ?? 'UC_zSVOE2TLLDkzov3NLx_GQ')
  const { broadcast, stream, loading, error, lastUpdated, refetch } = useYouTubeHealth(channelId)
  const [title, setTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)

  // OBS config
  const [obsHost, setObsHost] = useState(() => localStorage.getItem('obs_host') ?? 'localhost')
  const [obsPort, setObsPort] = useState(() => Number(localStorage.getItem('obs_port') ?? '4455'))
  const [obsPassword, setObsPassword] = useState(() => localStorage.getItem('obs_password') ?? '')
  const [obsHostInput, setObsHostInput] = useState(obsHost)
  const [obsPortInput, setObsPortInput] = useState(String(obsPort))
  const [obsPasswordInput, setObsPasswordInput] = useState(obsPassword)
  const [obsEnabled, setObsEnabled] = useState(() => localStorage.getItem('obs_enabled') === 'true')

  // GPU stats from companion script
  const [gpuStats, setGpuStats] = useState<GPUStats | null>(null)
  const [gpuConnected, setGpuConnected] = useState(false)
  const gpuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unsub = subscribeToState('gpu_stats', (state) => {
      setGpuStats(state as GPUStats)
      setGpuConnected(true)
      if (gpuTimeoutRef.current) clearTimeout(gpuTimeoutRef.current)
      gpuTimeoutRef.current = setTimeout(() => setGpuConnected(false), 15000)
    })
    return () => { unsub.unsubscribe(); if (gpuTimeoutRef.current) clearTimeout(gpuTimeoutRef.current) }
  }, [])

  // History
  const [sessions, setSessions] = useState<StreamSession[]>(() => getSessions())
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY
  const isLive = broadcast?.status?.lifeCycleStatus === 'live'
  const viewerCount = broadcast?.liveStreamingDetails?.concurrentViewers ?? '—'
  const snippetTitle = broadcast?.snippet?.title ?? ''
  const thumbnailUrl = broadcast?.snippet?.thumbnails?.medium?.url

  const obs = useOBSStats(obsHost, obsPort, obsPassword, obsEnabled)

  const droppedPct = obs.stats
    ? ((obs.stats.outputSkippedFrames / Math.max(obs.stats.outputTotalFrames, 1)) * 100)
    : null
  const renderDropPct = obs.stats
    ? ((obs.stats.renderSkippedFrames / Math.max(obs.stats.renderTotalFrames, 1)) * 100)
    : null
  const bitrateKbps = obs.streamStatus
    ? Math.round((obs.streamStatus.outputBytes * 8) / Math.max(obs.streamStatus.outputDuration / 1000, 1) / 1000)
    : null

  // Health score: prefer YouTube data, fall back to OBS dropped frames
  const obsHealthStatus = droppedPct == null ? 'noData' : droppedPct < 1 ? 'good' : droppedPct < 5 ? 'ok' : 'bad'
  const healthStatus = stream?.status?.healthStatus?.status ?? (obs.connected ? obsHealthStatus : 'noData')

  // Resolution / FPS: prefer YouTube CDN data, fall back to OBS video settings
  const obsRes = obs.videoSettings ? `${obs.videoSettings.outputWidth}x${obs.videoSettings.outputHeight}` : null
  const obsFpsLabel = obs.videoSettings ? `${Math.round(obs.videoSettings.fpsNumerator / obs.videoSettings.fpsDenominator)}fps` : null
  const resolution = stream?.cdn?.resolution ?? obsRes ?? '—'
  const frameRate = stream?.cdn?.frameRate ?? obsFpsLabel ?? '—'
  const ingestionType = stream?.cdn?.ingestionType ?? (obs.streamStatus?.outputActive ? 'rtmp' : '—')

  // Performance history
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [enabledSeries, setEnabledSeries] = useState<Set<SeriesKey>>(new Set(['cpu', 'gpu', 'bitrate', 'fps', 'droppedPct']))

  const toggleSeries = (key: SeriesKey) =>
    setEnabledSeries(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })

  const snapIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wasLiveRef = useRef(false)

  // Accumulate history every 5s when OBS is connected
  useEffect(() => {
    if (!obs.connected) return
    const tick = () => {
      const s = obs.stats
      const dropped = s ? (s.outputSkippedFrames / Math.max(s.outputTotalFrames, 1)) * 100 : null
      const bps = obs.streamStatus
        ? Math.round((obs.streamStatus.outputBytes * 8) / Math.max(obs.streamStatus.outputDuration / 1000, 1) / 1000)
        : null
      const vc = broadcast?.liveStreamingDetails?.concurrentViewers
      const point: HistoryPoint = {
        t: Date.now(),
        cpu: s?.cpuUsage ?? null,
        gpu: gpuStats?.usage ?? null,
        bitrate: bps,
        fps: s?.activeFps ?? null,
        droppedPct: dropped,
        viewers: vc ? Number(vc) : null,
      }
      setHistory(prev => {
        const next = [...prev, point]
        return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
      })
    }
    tick()
    const id = setInterval(tick, 5000)
    return () => clearInterval(id)
  }, [obs.connected, obs.stats, obs.streamStatus, broadcast])

  useEffect(() => {
    const activeSession = getActiveSession()

    if (isLive) {
      if (!wasLiveRef.current) {
        // Just went live
        wasLiveRef.current = true
        if (!activeSession) {
          startSession({ title: snippetTitle || 'Live Stream', thumbnail: thumbnailUrl, videoId: channelId })
        }
      }
      // Set up snapshot interval if not running
      if (!snapIntervalRef.current) {
        snapIntervalRef.current = setInterval(() => {
          const vc = broadcast?.liveStreamingDetails?.concurrentViewers
          const viewers = vc ? Number(vc) : 0
          const s = obs.stats
          const dropped = s ? (s.outputSkippedFrames / Math.max(s.outputTotalFrames, 1)) * 100 : undefined
          snapshotSession(viewers, dropped, s?.cpuUsage, s?.activeFps)
        }, 60000) // every 60s
      }
    } else if (wasLiveRef.current) {
      // Just went offline
      wasLiveRef.current = false
      if (snapIntervalRef.current) { clearInterval(snapIntervalRef.current); snapIntervalRef.current = null }
      const finished = endSession()
      if (finished) setSessions(getSessions())
    }

    return () => { /* cleanup handled in else branch */ }
  }, [isLive, broadcast, obs.stats])

  return (
    <div className="health-page">
      {/* Top bar */}
      <div className="health-topbar">
        <div className="wordmark">SHOFAR <span>HUB</span></div>
        <div className="vsep" />
        <div className="health-section-label">
          <Icon name="monitor_heart" style={{ fontSize: 20 }} />
          Stream Health
        </div>
        <div style={{ flex: 1 }} />
        <button className="tb-btn" onClick={refetch}>
          <Icon name="refresh" />
          Refresh
        </button>
        <Link to="/control" className="tb-btn" style={{ textDecoration: 'none' }}>
          <Icon name="arrow_back" />
          Back to Hub
        </Link>
      </div>

      {/* ── Connection Settings Bar ── */}
      <ConnectionSettings
        obs={obs}
        obsEnabled={obsEnabled} setObsEnabled={setObsEnabled}
        obsHostInput={obsHostInput} setObsHostInput={setObsHostInput}
        obsPortInput={obsPortInput} setObsPortInput={setObsPortInput}
        obsPasswordInput={obsPasswordInput} setObsPasswordInput={setObsPasswordInput}
        setObsHost={setObsHost} setObsPort={setObsPort} setObsPassword={setObsPassword}
        channelIdInput={channelIdInput} setChannelIdInput={setChannelIdInput}
        channelId={channelId} setChannelId={setChannelId}
        apiKey={apiKey}
      />

      {/* Cards grid */}
      <div className="health-grid">

        {/* Stream Status */}
        <div className="health-card">
          <div className="health-card-label">
            <Icon name="live_tv" style={{ color: isLive ? '#4CAF50' : 'var(--muted2)', fontSize: 16 }} />
            Stream Status
          </div>
          <div className="health-card-value" style={{ fontSize: 32, color: isLive ? '#4CAF50' : 'var(--muted2)', fontWeight: 500 }}>
            {loading ? 'Checking…' : isLive ? 'Live' : 'Offline'}
          </div>
          {isLive && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
              <Icon name="timer" style={{ fontSize: 14 }} />
              Duration: <Duration since={broadcast?.liveStreamingDetails?.actualStartTime ?? broadcast?.snippet?.publishedAt} />
            </div>
          )}
        </div>

        {/* Viewers */}
        <div className="health-card">
          <div className="health-card-label">
            <Icon name="groups" style={{ color: 'var(--clr-screens)', fontSize: 16 }} />
            Concurrent Viewers
          </div>
          <div className="health-card-value" style={{ fontSize: 48, color: isLive ? 'var(--text)' : 'var(--muted2)' }}>
            {viewerCount}
          </div>
        </div>

        {/* Health Score */}
        <div className="health-card">
          <div className="health-card-label">
            <Icon name="signal_cellular_alt" style={{ color: 'var(--clr-health)', fontSize: 16 }} />
            Health Score
          </div>
          <div style={{ marginTop: 8 }}>
            <HealthScore status={healthStatus} />
          </div>
        </div>

        {/* Video */}
        <div className="health-card">
          <div className="health-card-label">
            <Icon name="videocam" style={{ color: 'var(--clr-ticker)', fontSize: 16 }} />
            Video
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 4 }}>
            <div className="health-row">
              <span className="health-row-label">Resolution</span>
              <span className="health-row-value">{resolution}</span>
            </div>
            <div className="health-row">
              <span className="health-row-label">Frame rate</span>
              <span className="health-row-value">{frameRate}</span>
            </div>
          </div>
        </div>

        {/* Ingestion */}
        <div className="health-card">
          <div className="health-card-label">
            <Icon name="upload" style={{ color: 'var(--clr-lowerthird)', fontSize: 16 }} />
            Ingestion
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 4 }}>
            <div className="health-row">
              <span className="health-row-label">Type</span>
              <span className="health-row-value">{ingestionType.toUpperCase()}</span>
            </div>
            <div className="health-row">
              <span className="health-row-label">Status</span>
              <span className="health-row-value" style={{ color: isLive ? '#4CAF50' : 'var(--muted2)' }}>{isLive ? 'OK' : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Polling */}
        <div className="health-card">
          <div className="health-card-label">
            <Icon name="update" style={{ color: 'var(--clr-theme)', fontSize: 16 }} />
            Polling
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 4 }}>
            {lastUpdated ? (
              <>
                <div className="health-row">
                  <span className="health-row-label">Last updated</span>
                  <span className="health-row-value">{lastUpdated.toLocaleTimeString()}</span>
                </div>
                <div className="health-row">
                  <span className="health-row-label">Interval</span>
                  <span className="health-row-value">15s</span>
                </div>
              </>
            ) : (
              <span style={{ color: 'var(--muted2)', fontSize: 13 }}>No data yet</span>
            )}
          </div>
        </div>

        {/* OBS Frames */}
        <div className="health-card">
          <div className="health-card-label">
            <Icon name="frame_inspect" style={{ color: obs.connected ? '#4CAF50' : 'var(--muted2)', fontSize: 16 }} />
            Frames (OBS)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 4 }}>
            <div className="health-row">
              <span className="health-row-label">Dropped (output)</span>
              <span className="health-row-value" style={{ color: droppedPct !== null ? (droppedPct < 1 ? '#4CAF50' : droppedPct < 5 ? '#FFA726' : '#E84F0E') : undefined }}>
                {droppedPct !== null ? `${droppedPct.toFixed(2)}%` : '—'}
              </span>
            </div>
            <div className="health-row">
              <span className="health-row-label">Dropped (render)</span>
              <span className="health-row-value" style={{ color: renderDropPct !== null ? (renderDropPct < 1 ? '#4CAF50' : '#FFA726') : undefined }}>
                {renderDropPct !== null ? `${renderDropPct.toFixed(2)}%` : '—'}
              </span>
            </div>
            <div className="health-row">
              <span className="health-row-label">Active FPS</span>
              <span className="health-row-value">{obs.stats ? obs.stats.activeFps.toFixed(1) : '—'}</span>
            </div>
          </div>
        </div>

        {/* OBS System */}
        <div className="health-card">
          <div className="health-card-label">
            <Icon name="memory" style={{ color: obs.connected ? '#4CAF50' : 'var(--muted2)', fontSize: 16 }} />
            System (OBS)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 4 }}>
            <div className="health-row">
              <span className="health-row-label">CPU</span>
              <span className="health-row-value" style={{ color: obs.stats ? (obs.stats.cpuUsage < 50 ? '#4CAF50' : obs.stats.cpuUsage < 80 ? '#FFA726' : '#E84F0E') : undefined }}>
                {obs.stats ? `${obs.stats.cpuUsage.toFixed(1)}%` : '—'}
              </span>
            </div>
            <div className="health-row">
              <span className="health-row-label">Memory</span>
              <span className="health-row-value">{obs.stats ? `${Math.round(obs.stats.memoryUsage)} MB` : '—'}</span>
            </div>
            <div className="health-row">
              <span className="health-row-label">Bitrate</span>
              <span className="health-row-value">{bitrateKbps !== null ? `${bitrateKbps} kbps` : '—'}</span>
            </div>
            {obs.stats && (
              <>
                <div style={{ marginTop: 6 }}>
                  <GaugeBar value={obs.stats.cpuUsage} max={100} color={obs.stats.cpuUsage < 50 ? '#4CAF50' : obs.stats.cpuUsage < 80 ? '#FFA726' : '#E84F0E'} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* GPU — from companion monitor script */}
        <div className="health-card">
          <div className="health-card-label">
            <Icon name="developer_board" style={{ color: gpuConnected ? '#4CAF50' : 'var(--muted2)', fontSize: 16 }} />
            GPU {gpuConnected ? `— ${gpuStats?.model ?? 'Connected'}` : '— Monitor offline'}
          </div>
          {gpuConnected && gpuStats ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 4 }}>
              <div className="health-row">
                <span className="health-row-label">Usage</span>
                <span className="health-row-value" style={{ color: gpuStats.usage != null ? (gpuStats.usage < 60 ? '#4CAF50' : gpuStats.usage < 85 ? '#FFA726' : '#E84F0E') : 'var(--muted2)' }}>
                  {gpuStats.usage != null ? `${gpuStats.usage.toFixed(1)}%` : '—'}
                </span>
              </div>
              {gpuStats.vram != null && (
                <div className="health-row">
                  <span className="health-row-label">{gpuStats.vramLabel === 'Unified' ? 'Unified Mem' : 'VRAM'}</span>
                  <span className="health-row-value">
                    {gpuStats.vramUsed != null ? `${gpuStats.vramUsed} / ${gpuStats.vram} MB` : `${gpuStats.vram} MB`}
                  </span>
                </div>
              )}
              {gpuStats.temperature != null && (
                <div className="health-row">
                  <span className="health-row-label">Temp</span>
                  <span className="health-row-value" style={{ color: gpuStats.temperature < 75 ? '#4CAF50' : gpuStats.temperature < 90 ? '#FFA726' : '#E84F0E' }}>
                    {gpuStats.temperature}°C
                  </span>
                </div>
              )}
              {gpuStats.usage != null && <GaugeBar value={gpuStats.usage} max={100} color={gpuStats.usage < 60 ? '#4CAF50' : gpuStats.usage < 85 ? '#FFA726' : '#E84F0E'} />}
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--muted2)', lineHeight: 1.7, marginBottom: 10 }}>
                Download and run the GPU Monitor on your streaming PC. Double-click to start — no setup needed.
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <a
                  href="/downloads/gpu-monitor-windows.zip"
                  download="gpu-monitor-windows.zip"
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '7px 10px', fontSize: 11, color: 'var(--text)', textDecoration: 'none',
                    cursor: 'pointer', transition: 'border-color .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <Icon name="download" style={{ fontSize: 14 }} />
                  Windows (.zip)
                </a>
                <a
                  href="/downloads/gpu-monitor-mac.zip"
                  download="gpu-monitor-mac.zip"
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '7px 10px', fontSize: 11, color: 'var(--text)', textDecoration: 'none',
                    cursor: 'pointer', transition: 'border-color .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <Icon name="download" style={{ fontSize: 14 }} />
                  macOS (.zip)
                </a>
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted2)', lineHeight: 1.6 }}>
                Unzip, then double-click <span style={{ color: 'var(--muted)', fontFamily: 'Roboto Mono, monospace' }}>start-windows.bat</span> or <span style={{ color: 'var(--muted)', fontFamily: 'Roboto Mono, monospace' }}>start-mac.command</span>. Installs itself on first run.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Performance Graph */}
      <div style={{ margin: '0 24px 20px', background: 'var(--surf2)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 10, fontFamily: 'Roboto', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Performance Over Time
          </span>
          {history.length > 0 && (
            <span style={{ fontSize: 10, color: 'var(--muted2)', marginLeft: 4 }}>
              · {Math.round((history[history.length - 1].t - history[0].t) / 60000)} min
            </span>
          )}
          <div style={{ flex: 1 }} />
          {/* Series toggles */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {SERIES_DEFS.map(({ key, label, color }) => {
              const on = enabledSeries.has(key)
              return (
                <button key={key} onClick={() => toggleSeries(key)} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '2px 0', fontSize: 11,
                  color: on ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)',
                  transition: 'color .15s',
                }}>
                  <span style={{ width: 16, height: 1.5, background: on ? color : 'rgba(255,255,255,0.15)', borderRadius: 1, display: 'inline-block', flexShrink: 0 }} />
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Stat readouts */}
        {obs.connected && history.length > 0 && (() => {
          const latest = history[history.length - 1]
          return (
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingTop: 12, paddingBottom: 12 }}>
              {SERIES_DEFS.map(({ key, label, color }) => {
                const v = latest[key]
                const display = formatVal(key, v)
                const prev = history.length > 6 ? history[history.length - 6][key] : null
                const delta = v != null && prev != null ? v - prev : null
                const up = delta != null && delta > 0
                const down = delta != null && delta < 0
                const isWarn = key === 'droppedPct' && v != null && v > 1
                return (
                  <div key={key} style={{ flex: 1, padding: '0 12px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      <span style={{ width: 10, height: 1.5, background: color, borderRadius: 1, display: 'inline-block' }} />
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.07em', fontFamily: 'Roboto, sans-serif' }}>{label}</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 500, fontFamily: 'Roboto Mono, monospace', color: isWarn ? '#FFA726' : v != null ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)', lineHeight: 1 }}>
                      {display}
                    </div>
                    {delta != null && Math.abs(delta) > 0.1 && (
                      <div style={{ fontSize: 9, color: up ? '#FFA726' : '#4CAF50', marginTop: 3, fontFamily: 'Roboto Mono, monospace' }}>
                        {up ? '↑' : '↓'} {Math.abs(key === 'bitrate' ? Math.round(delta) : parseFloat(delta.toFixed(1)))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* Graph */}
        {!obs.connected ? (
          <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted2)', fontSize: 12, flexDirection: 'column', gap: 8 }}>
            <Icon name="cable" style={{ fontSize: 24, color: 'var(--muted2)' }} />
            <span>Connect OBS WebSocket to see live performance data</span>
          </div>
        ) : (
          <PerformanceGraph history={history} enabled={enabledSeries} />
        )}
      </div>

      {/* Stream Title */}
      {broadcast && (
        <div style={{ margin: '0 24px 20px', background: 'var(--surf2)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Icon name="title" style={{ color: 'var(--muted)', fontSize: 16 }} />
            <span style={{ fontFamily: 'Roboto', fontWeight: 500, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>Stream Title</span>
          </div>
          {editingTitle ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ flex: 1, background: 'var(--surf3)', border: '1px solid var(--clr-health)', color: 'var(--text)', fontSize: 14, padding: '8px 12px', borderRadius: 8, fontFamily: 'Roboto, sans-serif', outline: 'none' }}
                autoFocus
              />
              <button className="tb-btn prim" onClick={() => setEditingTitle(false)}>Save</button>
              <button className="tb-btn" onClick={() => { setTitle(snippetTitle); setEditingTitle(false) }}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 15, color: 'var(--text)', flex: 1, fontFamily: 'Roboto' }}>{snippetTitle || '(no title)'}</span>
              <button className="tb-btn" onClick={() => { setTitle(snippetTitle); setEditingTitle(true) }}>
                <Icon name="edit" />
                Edit
              </button>
            </div>
          )}
        </div>
      )}

      {thumbnailUrl && (
        <div style={{ margin: '0 24px 24px' }}>
          <img src={thumbnailUrl} alt="Stream thumbnail" style={{ borderRadius: 12, border: '1px solid var(--border)', maxWidth: 320, display: 'block' }} />
        </div>
      )}

      {error === 'fetch_error' && (
        <div style={{ margin: '0 24px', background: 'rgba(232,79,14,.08)', border: '1px solid rgba(232,79,14,.2)', borderRadius: 12, padding: '14px 18px', fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Icon name="error" style={{ color: 'var(--accent)', fontSize: 18 }} />
          Failed to fetch YouTube data. Check your API key and internet connection.
        </div>
      )}

      {/* Stream History */}
      <div style={{ margin: '20px 24px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Icon name="history" style={{ color: 'var(--muted)', fontSize: 18 }} />
          <span style={{ fontFamily: 'Roboto', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Stream History</span>
          {sessions.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--muted2)', background: 'var(--card)', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--border)' }}>
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {sessions.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)' }}>
            <Icon name="video_library" style={{ fontSize: 32, color: 'var(--muted2)', display: 'block', margin: '0 auto 8px' }} />
            <div style={{ fontSize: 13, color: 'var(--muted2)' }}>No stream history yet. Past sessions will appear here automatically when you go live.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sessions.map(s => (
              <SessionCard
                key={s.id}
                session={s}
                expanded={expandedSession === s.id}
                onToggle={() => setExpandedSession(e => e === s.id ? null : s.id)}
                onDelete={() => { clearSession(s.id); setSessions(getSessions()) }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
