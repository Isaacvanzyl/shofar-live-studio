import { Fragment, useEffect, useRef, useState } from 'react'
import type { TickerState } from '../../types'

interface Props {
  state: TickerState
}

export default function TickerStrip({ state }: Props) {
  const styleRef = useRef<HTMLStyleElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (state.visible) {
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
    }
  }, [state.visible])

  useEffect(() => {
    if (!styleRef.current) {
      styleRef.current = document.createElement('style')
      styleRef.current.id = 'ticker-anim-style'
      document.head.appendChild(styleRef.current)
    }
    const dur = Math.round(68 - (state.speed / 80) * 60)
    styleRef.current.textContent = `
      .ticker-dynamic .t-inner {
        animation: tscroll ${dur}s linear infinite;
      }
      .ticker-dynamic .t-dot { color: ${state.badgeCol}; margin: 0 12px; opacity: 0.8; font-size: 8px; vertical-align: middle; }
      .ticker-dynamic .t-item { }
    `
    return () => {
      if (styleRef.current && !document.querySelector('.ticker-dynamic')) {
        styleRef.current.remove()
        styleRef.current = null
      }
    }
  }, [state.speed])

  const items = state.items.length ? state.items : ['']
  const doubled = [...items, ...items]

  return (
    <div
      className="ticker-strip ticker-dynamic"
      style={{
        height: `${state.height}px`,
        background: state.textCol === '#1a1a1a'
          ? `rgba(255,255,255,${state.bgOp / 100})`
          : `rgba(10,8,6,${state.bgOp / 100})`,
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1)',
        pointerEvents: state.visible ? 'auto' : 'none',
      }}
    >
      <div className="t-badge" style={{
        color: state.badgeCol,
        borderLeftColor: state.badgeCol,
        background: state.textCol === '#1a1a1a' ? 'rgba(0,0,0,0.06)' : 'rgba(10,6,3,.7)',
        textTransform: state.uppercase ? 'uppercase' : 'none',
        fontFamily: state.badgeFont ?? "'Barlow Condensed', sans-serif",
        fontSize: state.badgeFontSize ? `${state.badgeFontSize}px` : undefined,
      }}>
        {state.badge}
      </div>
      <div className="t-track">
        <div
          className="t-inner"
          style={{
            fontSize: `${state.fontSize}px`,
            color: state.textCol,
            textTransform: state.uppercase ? 'uppercase' : 'none',
            fontFamily: state.itemFont ?? "'Barlow', sans-serif",
            letterSpacing: state.letterSpacing ? `${state.letterSpacing}em` : undefined,
          }}
        >
          {doubled.map((item, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="t-dot">●</span>}
              <span className="t-item">{item}</span>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
