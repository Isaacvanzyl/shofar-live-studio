import { useState, useEffect, useRef } from 'react'
import { getState, subscribeToState, supabase } from '../../lib/supabase'
import type { LowerThirdState } from '../../types'
import { hexToRgb } from '../../lib/theme'

const DEFAULT: LowerThirdState = {
  visible: false,
  name: 'Speaker Name',
  title: 'Role / Title',
  accentCol: '#E84F0E',
  nameCol: '#f4ede6',
  titleCol: '#E84F0E',
  bgOp: 94,
  barWidth: 10,
  nameSz: 52,
  titleSz: 26,
  xOff: 80,
  yOff: 90,
  pad: 18,
  panelBg: '#120d09',
  uppercase: 'none',
  logo: null,
  nameFont: "'Barlow Condensed', sans-serif",
  titleFont: "'Barlow', sans-serif",
}

export default function LowerThirdOutput() {
  const [state, setState] = useState<LowerThirdState>(DEFAULT)
  const [connected, setConnected] = useState(false)
  const unitRef = useRef<HTMLDivElement>(null)

  const params = new URLSearchParams(window.location.search)
  // Support ?scale=2 for 4K OBS sources
  const scale = Number(params.get('scale') ?? '1')
  const orgId = params.get('org')
  const channelKey = orgId ? `${orgId}:lower-third` : 'lower-third'
  const W = 1920 * scale
  const H = 1080 * scale

  useEffect(() => {
    document.documentElement.style.width = `${W}px`
    document.documentElement.style.height = `${H}px`
    document.documentElement.style.background = 'transparent'
    document.body.style.width = `${W}px`
    document.body.style.height = `${H}px`
    document.body.style.overflow = 'hidden'
    document.body.style.margin = '0'
    document.body.style.background = 'transparent'
    const root = document.getElementById('root')
    if (root) root.style.background = 'transparent'
  }, [W, H])

  useEffect(() => {
    let mounted = true

    // Realtime subscription (requires Realtime enabled in Supabase table settings)
    const sub = subscribeToState(channelKey, (data) => {
      if (mounted) { setState(data as LowerThirdState); setConnected(true) }
    }, () => { if (mounted) setConnected(true) })

    // Polling fallback — works even without Realtime enabled
    const poll = async () => {
      const data = await getState(channelKey)
      if (mounted && data) { setState(data as LowerThirdState); setConnected(true) }
    }
    poll()
    const interval = setInterval(poll, 1500)

    return () => {
      mounted = false
      clearInterval(interval)
      supabase.removeChannel(sub)
    }
  }, [])

  useEffect(() => {
    const unit = unitRef.current
    if (!unit) return
    if (state.visible) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          unit.classList.add('lt-in')
        })
      })
    } else {
      unit.classList.remove('lt-in')
    }
  }, [state.visible])

  const nameLen = state.name.length
  const titleLen = state.title.length
  const nf = Math.min(1, 18 / Math.max(nameLen, 1))
  const tf = Math.min(1, 32 / Math.max(titleLen, 1))
  const scaledNsz = Math.max(28, Math.round(state.nameSz * Math.sqrt(nf))) * scale
  const scaledTsz = Math.max(15, Math.round(state.titleSz * Math.sqrt(tf))) * scale

  const panelBg = `rgba(${hexToRgb(state.panelBg)},${state.bgOp / 100})`
  const accentRgb = hexToRgb(state.accentCol)
  const borderCol = `rgba(${accentRgb},.35)`
  const padding = `${state.pad * scale}px ${Math.round(state.pad * 2.4 * scale)}px ${state.pad * scale}px ${Math.round(state.pad * 1.3 * scale)}px`

  return (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', background: 'transparent' }}>
      <style>{`
        .lt-unit { display: flex; align-items: stretch; transform: translateX(calc(-100% - 200px)); transition: transform 0.75s cubic-bezier(0.16, 1, 0.3, 1); will-change: transform; }
        .lt-unit.lt-in { transform: translateX(0); }
      `}</style>

      <div style={{
        position: 'absolute',
        bottom: state.yOff * scale,
        left: state.xOff * scale,
        zIndex: 15,
        pointerEvents: 'none',
      }}>
        <div className="lt-unit" ref={unitRef}>
          <div style={{
            width: state.barWidth * scale,
            background: state.accentCol,
            borderRadius: `${5 * scale}px 0 0 ${5 * scale}px`,
            flexShrink: 0,
          }} />
          <div style={{
            background: panelBg,
            padding,
            borderRadius: `0 ${8 * scale}px ${8 * scale}px 0`,
            borderTop: `1.5px solid ${borderCol}`,
            borderRight: `1.5px solid ${borderCol}`,
            borderBottom: `1.5px solid ${borderCol}`,
            position: 'relative',
            minWidth: 300 * scale,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 4 * scale,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}>
            <span style={{
              fontFamily: state.nameFont ?? "'Barlow Condensed', sans-serif",
              fontWeight: 900,
              fontSize: scaledNsz,
              lineHeight: 1.05,
              letterSpacing: '-.01em',
              color: state.nameCol,
              whiteSpace: 'nowrap',
              display: 'block',
              textTransform: state.uppercase,
            }}>
              {state.name}
            </span>
            <span style={{
              fontFamily: state.titleFont ?? "'Barlow', sans-serif",
              fontWeight: 300,
              fontSize: scaledTsz,
              color: state.titleCol,
              letterSpacing: '.01em',
              whiteSpace: 'nowrap',
              display: 'block',
              marginTop: 2 * scale,
            }}>
              {state.title}
            </span>
            {state.logo && (
              <div style={{ display: 'flex', alignItems: 'center', padding: `0 0 0 ${28 * scale}px`, flexShrink: 0 }}>
                <img src={state.logo} alt="" style={{ maxHeight: 52 * scale, maxWidth: 120 * scale, objectFit: 'contain', opacity: .85 }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {!connected && (
        <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,.5)', borderRadius: 3, padding: '2px 8px', fontSize: 9, color: 'rgba(255,255,255,.3)', fontFamily: 'monospace', zIndex: 50 }}>
          CONNECTING TO SUPABASE…
        </div>
      )}
    </div>
  )
}
