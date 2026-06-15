import { useEffect, useRef } from 'react'
import lottie from 'lottie-web'
import type { AnimationItem } from 'lottie-web'
import type { SlideSettings, SpeakerBarSettings, LottieTextLayer } from '../types'
import animationData from '../assets/Slide.json'
import logoData from '../assets/Logo.json'

const DEFAULT_BAR: SpeakerBarSettings = { x: 960, y: 175, scaleX: 552.2, scaleY: 60.69 }

function buildData(): object {
  const data = JSON.parse(JSON.stringify(animationData)) as { layers: Record<string, unknown>[]; assets: Record<string, unknown>[] }
  // Fix screen precomp solid to bright green (chroma key colour) — source JSON has near-black
  for (const asset of data.assets) {
    const layers = asset.layers as Record<string, unknown>[] | undefined
    if (!layers) continue
    for (const l of layers) {
      if (typeof l.sc === 'string' && l.sc.toLowerCase() === '#030f00') l.sc = '#00ff00'
    }
  }
  for (const nm of ['LogoRect', 'LogoRect 2', '_Logo Holder']) {
    for (const layer of data.layers.filter(l => l.nm === nm)) {
      (layer.ks as Record<string, unknown>).o = { a: 0, k: 0 }
    }
  }
  for (const nm of ['Staff Devotion', 'Phillip Boshoff', '22 March, 2021']) {
    for (const layer of data.layers.filter(l => l.nm === nm)) {
      (layer.ks as Record<string, unknown>).o = { a: 0, k: 0 }
    }
  }
  const circle = data.layers.find(l => l.nm === 'Circle Elem 6')
  if (circle) (circle.ks as Record<string, unknown>).o = { a: 0, k: 0 }
  const txtLine = data.layers.find(l => l.nm === 'TXT_LINE') as Record<string, unknown> | undefined
  if (txtLine) (txtLine.ks as Record<string, unknown>).o = { a: 0, k: 0 }
  return data
}

function layerStyle(layer: LottieTextLayer, defaults: { x: number; y: number; fontFamily: string; fontWeight: number }): React.CSSProperties {
  return {
    position: 'absolute',
    left: layer.x ?? defaults.x,
    top: layer.y ?? defaults.y,
    fontSize: layer.size,
    color: layer.color,
    fontFamily: layer.fontFamily ?? defaults.fontFamily,
    fontWeight: layer.fontWeight ?? defaults.fontWeight,
    letterSpacing: layer.letterSpacing != null ? `${layer.letterSpacing}px` : undefined,
    textTransform: layer.uppercase ? 'uppercase' : undefined,
    whiteSpace: 'pre',
    lineHeight: 1.05,
    pointerEvents: 'none',
  }
}

function normalizeLayer(raw: unknown, fallback: LottieTextLayer): LottieTextLayer {
  if (raw && typeof raw === 'object' && 'text' in raw) return raw as LottieTextLayer
  return { ...fallback, text: typeof raw === 'string' ? raw : fallback.text }
}

function normalizeSettings(s: SlideSettings): SlideSettings {
  const def = {
    title:   { text: 'STAFF DEVOTION', size: 120, color: '#3d3d3d', fontFamily: 'TG Bold Condensed', fontWeight: 700, uppercase: true,  x: 960,  y: 50   },
    speaker: { text: 'PHILLIP BOSHOFF', size: 35,  color: '#3d3d3d', fontFamily: 'TG Bold',           fontWeight: 700, uppercase: true,  x: 75,   y: 1025 },
    date:    { text: '22 March, 2021',  size: 35,  color: '#3d3d3d', fontFamily: 'TG Bold',           fontWeight: 700, uppercase: false, x: 1837, y: 85   },
  }
  const r = s as unknown as Record<string, unknown>
  return {
    title:   normalizeLayer(r.title,   def.title),
    speaker: normalizeLayer(r.speaker, def.speaker),
    date:    normalizeLayer(r.date,    def.date),
    bar:     (r.bar && typeof r.bar === 'object') ? r.bar as SpeakerBarSettings : undefined,
  }
}

interface Props {
  settings: SlideSettings
  staticFrame?: number
}

export default function SlideLottie({ settings: rawSettings, staticFrame }: Props) {
  const settings = normalizeSettings(rawSettings)
  const bar = rawSettings.bar ?? DEFAULT_BAR
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<AnimationItem | null>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const logoAnimRef = useRef<AnimationItem | null>(null)

  useEffect(() => {
    animRef.current?.destroy()
    const isLive = staticFrame == null
    let fired = false
    const anim = lottie.loadAnimation({
      container: containerRef.current!,
      renderer: 'svg',
      loop: isLive,
      autoplay: false,
      animationData: buildData(),
    })
    anim.setSubframe(false)
    const onReady = () => {
      if (fired) return
      fired = true
      if (staticFrame != null) {
        anim.goToAndStop(staticFrame, true)
      } else {
        anim.goToAndStop(200, true)
        anim.play()
      }
    }
    anim.addEventListener('DOMLoaded', onReady)
    setTimeout(onReady, 0)
    animRef.current = anim
    return () => { anim.destroy() }
  }, [staticFrame])

  useEffect(() => {
    logoAnimRef.current?.destroy()
    const isLive = staticFrame == null
    let fired = false
    const anim = lottie.loadAnimation({
      container: logoRef.current!,
      renderer: 'svg',
      loop: isLive,
      autoplay: false,
      animationData: JSON.parse(JSON.stringify(logoData)),
    })
    anim.setSubframe(false)
    const onReady = () => {
      if (fired) return
      fired = true
      if (staticFrame != null) {
        anim.goToAndStop(staticFrame, true)
      } else {
        anim.goToAndStop(200, true)
        anim.play()
      }
    }
    anim.addEventListener('DOMLoaded', onReady)
    setTimeout(onReady, 0)
    logoAnimRef.current = anim
    return () => { anim.destroy() }
  }, [staticFrame])

  const barW = bar.scaleX
  const barH = 29 * bar.scaleY / 100
  const barTop = bar.y - barH / 2

  const titleStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 1080 - barTop,
    textAlign: 'center',
    fontSize: settings.title.size,
    color: settings.title.color,
    fontFamily: settings.title.fontFamily ?? 'TG Bold Condensed',
    fontWeight: settings.title.fontWeight ?? 700,
    letterSpacing: settings.title.letterSpacing != null ? `${settings.title.letterSpacing}px` : undefined,
    textTransform: settings.title.uppercase ? 'uppercase' : undefined,
    whiteSpace: 'pre',
    lineHeight: 1.05,
    pointerEvents: 'none',
  }

  return (
    <div style={{ position: 'absolute', inset: 0, width: 1920, height: 1080 }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <div ref={logoRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transform: `translate(${rawSettings.logoX ?? 0}px, ${rawSettings.logoY ?? 0}px)` }} />
      <div style={{
        position: 'absolute',
        left: bar.x - barW / 2,
        top: barTop,
        width: barW,
        height: barH,
        background: '#F15C22',
        pointerEvents: 'none',
      }} />
      <div style={titleStyle}>
        {settings.title.text.replace(/\r/g, '\n')}
      </div>
      <div style={{
        position: 'absolute',
        left: settings.speaker.x ?? 75,
        top: 985,
        height: 1080 - 985,
        display: 'flex',
        alignItems: 'center',
        fontSize: settings.speaker.size,
        color: settings.speaker.color,
        fontFamily: settings.speaker.fontFamily ?? 'TG Bold',
        fontWeight: settings.speaker.fontWeight ?? 700,
        letterSpacing: settings.speaker.letterSpacing != null ? `${settings.speaker.letterSpacing}px` : undefined,
        textTransform: settings.speaker.uppercase ? 'uppercase' : undefined,
        whiteSpace: 'pre',
        lineHeight: 1.05,
        pointerEvents: 'none',
      }}>
        {settings.speaker.text.replace(/\r/g, '\n')}
      </div>
      <div style={layerStyle(settings.date, { x: 1837, y: 85, fontFamily: 'TG Bold', fontWeight: 700 })}>
        {settings.date.text.replace(/\r/g, '\n')}
      </div>
    </div>
  )
}
