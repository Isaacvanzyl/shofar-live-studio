import { useEffect, useRef, useCallback } from 'react'
import type { ScreenElement } from '../../types'
import { useControl } from '../../pages/control/ControlContext'
import BackgroundOrbs from './BackgroundOrbs'
import WelcomeLottie from '../WelcomeLottie'

const CW = 1920
const CH = 1080
const SNAP_THRESHOLD = 14
const DOT_COLORS: Record<string, string> = {
  eyebrow: '#E84F0E', warn: '#E84F0E', 'logo-tl': '#E84F0E', 'logo-tr': '#E84F0E',
  title1: '#f4ede6', title2: '#E84F0E',
  subtitle: 'rgba(240,235,228,.5)', meta: 'rgba(240,235,228,.38)',
}

export default function PreviewCanvas() {
  const ctrl = useControl()
  const {
    curMod, curScreen, selId, logos, lottieSettings,
    getElements, setSelId, updateElement, pushUndo, setScale, gridOn,
  } = ctrl

  const canvasAreaRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(1)
  const drag = useRef<{ elId: string; ox: number; oy: number } | null>(null)
  const resize = useRef<{ elId: string; startY: number; startSz: number } | null>(null)
  const snapVRef = useRef<HTMLDivElement>(null)
  const snapHRef = useRef<HTMLDivElement>(null)
  const snapBadgeRef = useRef<HTMLDivElement>(null)
  const coordsRef = useRef<HTMLDivElement>(null)
  const outerRef = useRef<HTMLDivElement>(null)

  // ── Scale ────────────────────────────────────────────────────────────────
  const updateScale = useCallback(() => {
    const area = canvasAreaRef.current
    if (!area) return
    const aw = area.clientWidth - 24
    const ah = area.clientHeight - 24
    const s = Math.min(aw / CW, ah / CH, 1)
    scaleRef.current = s
    setScale(s)
    if (outerRef.current) {
      outerRef.current.style.width = `${CW * s}px`
      outerRef.current.style.height = `${CH * s}px`
    }
    if (previewRef.current) {
      previewRef.current.style.transform = `scale(${s})`
    }
  }, [setScale])

  useEffect(() => {
    updateScale()
    const ro = new ResizeObserver(updateScale)
    if (canvasAreaRef.current) ro.observe(canvasAreaRef.current)
    return () => ro.disconnect()
  }, [updateScale])

  // ── Drag ─────────────────────────────────────────────────────────────────
  const onMouseMove = useCallback((e: MouseEvent) => {
    const s = scaleRef.current
    if (drag.current) {
      const preview = previewRef.current
      if (!preview) return
      const rect = preview.getBoundingClientRect()
      let x = (e.clientX - rect.left) / s - drag.current.ox
      let y = (e.clientY - rect.top) / s - drag.current.oy
      const el = document.getElementById(`el_${drag.current.elId}`)
      if (!el) return
      const w = el.offsetWidth
      const h = el.offsetHeight
      const sv = snapVRef.current
      const sh = snapHRef.current
      const sb = snapBadgeRef.current
      let snapped = ''

      if (Math.abs((x + w / 2) - 960) < SNAP_THRESHOLD) {
        x = 960 - w / 2
        if (sv) { sv.style.left = `${960 * s}px`; sv.classList.add('on') }
        snapped = 'CENTER H'
      } else {
        if (sv) sv.classList.remove('on')
      }
      if (Math.abs((y + h / 2) - 540) < SNAP_THRESHOLD) {
        y = 540 - h / 2
        if (sh) { sh.style.top = `${540 * s}px`; sh.classList.add('on') }
        if (!snapped) snapped = 'CENTER V'
      } else {
        if (sh) sh.classList.remove('on')
      }
      if (!snapped && Math.abs(x) < SNAP_THRESHOLD) { x = 0; if (sv) { sv.style.left = '0px'; sv.classList.add('on') } }
      if (!snapped && Math.abs(x + w - 1920) < SNAP_THRESHOLD) { x = 1920 - w; if (sv) { sv.style.left = `${1920 * s}px`; sv.classList.add('on') } }
      if (sb) { if (snapped) { sb.textContent = snapped; sb.classList.add('on') } else sb.classList.remove('on') }

      x = Math.round(x); y = Math.round(y)
      el.style.left = `${x}px`; el.style.top = `${y}px`
      updateElement(drag.current.elId, { x, y })
      if (coordsRef.current) coordsRef.current.textContent = `X:${x}  Y:${y}`
    }

    if (resize.current) {
      const d = (e.clientY - resize.current.startY) / s
      const ns = Math.max(10, Math.round(resize.current.startSz + d * 0.4))
      const el = document.getElementById(`el_${resize.current.elId}`)
      if (el) el.style.fontSize = `${ns}px`
      updateElement(resize.current.elId, { fontSize: ns })
    }
  }, [updateElement])

  const onMouseUp = useCallback(() => {
    if (snapVRef.current) snapVRef.current.classList.remove('on')
    if (snapHRef.current) snapHRef.current.classList.remove('on')
    if (snapBadgeRef.current) snapBadgeRef.current.classList.remove('on')
    if (coordsRef.current) coordsRef.current.style.opacity = '0'
    if (drag.current) {
      const el = document.getElementById(`el_${drag.current.elId}`)
      if (el) el.classList.remove('dragging')
    }
    drag.current = null
    resize.current = null
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') { ctrl.undo(); return }
      if (!selId) return
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'Escape') { setSelId(null); return }
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
      e.preventDefault()
      const step = e.shiftKey ? 10 : 1
      const elems = getElements()
      const em = elems.find((x) => x.id === selId)
      if (!em) return
      let { x, y } = em
      if (e.key === 'ArrowLeft') x -= step
      if (e.key === 'ArrowRight') x += step
      if (e.key === 'ArrowUp') y -= step
      if (e.key === 'ArrowDown') y += step
      const d = document.getElementById(`el_${selId}`)
      if (d) { d.style.left = `${x}px`; d.style.top = `${y}px` }
      updateElement(selId, { x, y })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selId, getElements, updateElement, setSelId, ctrl])

  // ── Render canvas elements ────────────────────────────────────────────────
  const elements = getElements()

  const renderElement = (elem: ScreenElement) => {
    if (!elem.visible) return null

    const isSelected = elem.id === selId

    const onMouseDown = (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).classList.contains('rh')) return
      e.preventDefault()
      pushUndo()
      setSelId(elem.id)
      const el = document.getElementById(`el_${elem.id}`)
      if (!el) return
      el.classList.add('dragging')
      const rect = el.getBoundingClientRect()
      const s = scaleRef.current
      drag.current = {
        elId: elem.id,
        ox: (e.clientX - rect.left) / s,
        oy: (e.clientY - rect.top) / s,
      }
      if (coordsRef.current) coordsRef.current.style.opacity = '1'
    }

    const onResizeDown = (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      pushUndo()
      const sz = elem.fontSize ?? 100
      resize.current = { elId: elem.id, startY: e.clientY, startSz: sz }
    }

    const style: React.CSSProperties = {
      left: elem.x,
      top: elem.y,
    }

    const textStyle: React.CSSProperties = {
      left: 0,
      top: elem.y,
      width: 1920,
      textAlign: 'center',
    }

    if (elem.type === 'logo') {
      const src = logos[elem.slot ?? 'tl']
      return (
        <div
          key={elem.id}
          id={`el_${elem.id}`}
          className={`el el-logo${isSelected ? ' sel' : ''}`}
          style={{ ...style, width: elem.w ?? 130, height: elem.h ?? 80 }}
          data-id={elem.id}
          onMouseDown={onMouseDown}
        >
          {src ? <img src={src} alt="" /> : (
            <div className="logo-ph">{elem.slot === 'tl' ? 'LOGO LEFT' : 'LOGO RIGHT'}</div>
          )}
          {isSelected && <div className="rh" onMouseDown={onResizeDown} />}
        </div>
      )
    }

    if (elem.type === 'meta') {
      return (
        <div
          key={elem.id}
          id={`el_${elem.id}`}
          className={`el el-meta${isSelected ? ' sel' : ''}`}
          style={{ ...style, fontSize: elem.fontSize ?? 28 }}
          data-id={elem.id}
          onMouseDown={onMouseDown}
        >
          <span className="mdot">•</span>
          {elem.text1}
          <span className="mdiv" />
          <span className="mdot">•</span>
          {elem.text2}
          {isSelected && <div className="rh" onMouseDown={onResizeDown} />}
        </div>
      )
    }

    return (
      <div
        key={elem.id}
        id={`el_${elem.id}`}
        className={`el ${elem.cls ?? ''}${isSelected ? ' sel' : ''}`}
        style={{
          ...textStyle,
          fontSize: elem.fontSize ?? 100,
          ...(elem.color ? { color: elem.color } : {}),
          ...(elem.opacity != null ? { opacity: elem.opacity } : {}),
          ...(elem.letterSpacing != null ? { letterSpacing: `${elem.letterSpacing}px` } : {}),
        }}
        data-id={elem.id}
        onMouseDown={onMouseDown}
      >
        {elem.text}
        {isSelected && <div className="rh" onMouseDown={onResizeDown} />}
      </div>
    )
  }

  const onPreviewClick = (e: React.MouseEvent) => {
    const ids = ['preview', 'bg-layer', 'orb1', 'orb2', 'orb3', 'orb4', 'noise-layer']
    if (ids.includes((e.target as HTMLElement).id)) setSelId(null)
  }

  return (
    <div className="app-canvas" ref={canvasAreaRef}>
      <div className="canvas-outer" ref={outerRef}>
        <div className="snap-badge" ref={snapBadgeRef} />
        <div className="snap-v" ref={snapVRef} />
        <div className="snap-h" ref={snapHRef} />
        <div className="coords-hud" ref={coordsRef} style={{ opacity: 0 }}>X:0 Y:0</div>
        <div
          id="preview"
          ref={previewRef}
          onClick={onPreviewClick}
          style={{
            backgroundImage: gridOn
              ? 'radial-gradient(circle,rgba(255,255,255,.055) 1px,transparent 1px)'
              : undefined,
            backgroundSize: gridOn ? '80px 80px' : undefined,
          }}
        >
          {curScreen === 'welcome' ? (
            <WelcomeLottie settings={lottieSettings} staticFrame={350} />
          ) : (
            <BackgroundOrbs />
          )}
          {curScreen !== 'welcome' && elements.map(renderElement)}
        </div>
      </div>
    </div>
  )
}
