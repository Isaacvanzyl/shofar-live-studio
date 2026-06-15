import { useState, useEffect, useRef } from 'react'
import { getState, subscribeToState, supabase } from '../../lib/supabase'
import type { TickerState } from '../../types'

const DEFAULT: TickerState = {
  visible: true,
  items: ['shofar.net', "Somerset West '26", 'Staff Devotion — Weekly gathering'],
  badge: 'SHOFAR SW',
  speed: 32,
  fontSize: 13,
  bgOp: 90,
  textCol: '#f0ede8',
  badgeCol: '#E84F0E',
  height: 44,
  uppercase: false,
}

export default function TickerOutput() {
  const [state, setState] = useState<TickerState>(DEFAULT)
  const [connected, setConnected] = useState(false)
  const [slideIn, setSlideIn] = useState(false)
  const prevVisible = useRef(false)

  const params = new URLSearchParams(window.location.search)
  // Support ?scale=2 for 4K OBS sources
  const scale = Number(params.get('scale') ?? '1')
  const orgId = params.get('org')
  const channelKey = orgId ? `${orgId}:ticker` : 'ticker'
  const W = 1920 * scale
  const H = 1080 * scale

  useEffect(() => {
    if (state.visible && !prevVisible.current) {
      requestAnimationFrame(() => requestAnimationFrame(() => setSlideIn(true)))
    } else if (!state.visible) {
      setSlideIn(false)
    }
    prevVisible.current = state.visible
  }, [state.visible])

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
    getState(channelKey).then((data) => {
      if (mounted && data) setState(data as TickerState)
      if (mounted) setConnected(true)
    })
    const sub = subscribeToState(channelKey, (data) => {
      if (mounted) { setState(data as TickerState); setConnected(true) }
    })
    return () => {
      mounted = false
      supabase.removeChannel(sub)
    }
  }, [])

  const dur = Math.round(68 - (state.speed / 80) * 60)
  const items = state.items.length ? state.items : []
  const doubled = [...items, ...items]

  return (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', background: 'transparent' }}>
      <style>{`
        .ticker-out-inner {
          animation: tscroll-out ${dur}s linear infinite;
        }
        @keyframes tscroll-out {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>

      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: state.height * scale,
        transform: slideIn ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.55s cubic-bezier(0.16,1,0.3,1)',
        background: state.textCol === '#1a1a1a'
          ? `rgba(255,255,255,${state.bgOp / 100})`
          : `rgba(10,8,6,${state.bgOp / 100})`,
        borderTop: '1.5px solid rgba(232,79,14,0.2)',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{
          flexShrink: 0,
          padding: `0 ${18 * scale}px`,
          fontFamily: state.badgeFont ?? "'Barlow Condensed', sans-serif",
          fontWeight: 900,
          fontSize: (state.badgeFontSize ?? 13) * scale,
          letterSpacing: '.14em',
          textTransform: state.uppercase ? 'uppercase' : 'none',
          color: state.badgeCol,
          borderLeft: `${4 * scale}px solid ${state.badgeCol}`,
          borderRight: '1px solid rgba(232,79,14,.3)',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          background: state.textCol === '#1a1a1a' ? 'rgba(0,0,0,0.06)' : 'rgba(10,6,3,.7)',
        }}>
          {state.badge}
        </div>
        <div style={{ flex: 1, overflow: 'hidden', height: '100%', display: 'flex', alignItems: 'center' }}>
          <div className="ticker-out-inner" style={{
            display: 'flex',
            whiteSpace: 'nowrap',
            fontFamily: state.itemFont ?? "'Barlow', sans-serif",
            fontSize: state.fontSize * scale,
            color: state.textCol,
            textTransform: state.uppercase ? 'uppercase' : 'none',
            letterSpacing: state.letterSpacing ? `${state.letterSpacing}em` : undefined,
            willChange: 'transform',
          }}>
            {doubled.map((item, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                {i > 0 && <span style={{ color: state.badgeCol, margin: `0 ${14 * scale}px`, fontSize: 8 * scale, opacity: 0.85 }}>●</span>}
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
