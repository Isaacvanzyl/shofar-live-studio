import { useEffect, useRef } from 'react'
import lottie from 'lottie-web'
import type { AnimationItem } from 'lottie-web'
import type { SpeakerSettings, SpeakerBarSettings, LottieTextLayer } from '../types'
import animationData from '../assets/SpeakerSlide.json'
import logoData from '../assets/Logo.json'

const DEFAULT_BAR: SpeakerBarSettings = { x: 960, y: 105, scaleX: 552.2, scaleY: 60.69 }

function buildData(): object {
  const data = JSON.parse(JSON.stringify(animationData)) as { layers: Record<string, unknown>[]; assets: Record<string, unknown>[] }
  // Hide the top-left logo box and logo layers
  for (const nm of ['LogoRect', 'LogoRect 2', '_Logo Holder']) {
    for (const layer of data.layers.filter(l => l.nm === nm)) {
      (layer.ks as Record<string, unknown>).o = { a: 0, k: 0 }
    }
  }
  // Hide the 3 Lottie text layers — text is now rendered as HTML overlays
  for (const nm of ['Staff Devotion', 'Phillip Boshoff', '- Somerset West ‘26']) {
    for (const layer of data.layers.filter(l => l.nm === nm)) {
      (layer.ks as Record<string, unknown>).o = { a: 0, k: 0 }
    }
  }
  // Hide the decorative circle element in the bottom-right corner
  const circle = data.layers.find(l => l.nm === 'Circle Elem 6')
  if (circle) (circle.ks as Record<string, unknown>).o = { a: 0, k: 0 }
  // Centre the TXT_LINE bar between top of canvas and screen area
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

function normalizeSettings(s: SpeakerSettings): SpeakerSettings {
  const def = {
    title:    { text: 'STAFF DEVOTION',     size: 100, color: '#1a1a1a', fontFamily: 'TG Bold Condensed', fontWeight: 700, uppercase: true,  x: 200,  y: 55   },
    speaker:  { text: 'PHILLIP BOSHOFF',    size: 36,  color: '#1a1a1a', fontFamily: 'TG Bold',           fontWeight: 700, uppercase: true,  x: 1600, y: 55   },
    location: { text: "- SOMERSET WEST '26",size: 30,  color: '#1a1a1a', fontFamily: 'TG Regular',        fontWeight: 400, uppercase: false, x: 51,   y: 1042 },
  }
  return {
    title:    normalizeLayer((s as unknown as Record<string, unknown>).title,    def.title),
    speaker:  normalizeLayer((s as unknown as Record<string, unknown>).speaker,  def.speaker),
    location: normalizeLayer((s as unknown as Record<string, unknown>).location, def.location),
  }
}

interface Props {
  settings: SpeakerSettings
  staticFrame?: number
}

export default function SpeakerLottie({ settings: rawSettings, staticFrame }: Props) {
  const settings = normalizeSettings(rawSettings)
  const bar = rawSettings.bar ?? DEFAULT_BAR
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<AnimationItem | null>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const logoAnimRef = useRef<AnimationItem | null>(null)

  useEffect(() => {
    logoAnimRef.current?.destroy()
    const isLiveLogo = staticFrame == null
    let firedLogo = false
    const logoAnim = lottie.loadAnimation({
      container: logoRef.current!,
      renderer: 'svg',
      loop: isLiveLogo,
      autoplay: false,
      animationData: JSON.parse(JSON.stringify(logoData)),
    })
    logoAnim.setSubframe(false)
    const onLogoReady = () => {
      if (firedLogo) return
      firedLogo = true
      if (staticFrame != null) logoAnim.goToAndStop(staticFrame, true)
      else { logoAnim.goToAndStop(200, true); logoAnim.play() }
    }
    logoAnim.addEventListener('DOMLoaded', onLogoReady)
    setTimeout(onLogoReady, 0)
    logoAnimRef.current = logoAnim
    return () => { logoAnim.destroy() }
  }, [staticFrame])

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
    // Fallback: if DOMLoaded already fired synchronously
    setTimeout(onReady, 0)

    animRef.current = anim
    return () => { anim.destroy() }
  }, [staticFrame])

  const barW = bar.scaleX
  const barH = 29 * bar.scaleY / 100

  return (
    <div style={{ position: 'absolute', inset: 0, width: 1920, height: 1080 }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <div ref={logoRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transform: `translate(${rawSettings.logoX ?? 0}px, ${rawSettings.logoY ?? 0}px)` }} />
      <div style={{
        position: 'absolute',
        left: bar.x - barW / 2,
        top: bar.y - barH / 2,
        width: barW,
        height: barH,
        background: '#F15C22',
        pointerEvents: 'none',
      }} />

<div style={layerStyle(settings.title, { x: 200, y: 55, fontFamily: 'TG Bold Condensed', fontWeight: 700 })}>
        {settings.title.text.replace(/\r/g, '\n')}
      </div>
      <div style={layerStyle(settings.speaker, { x: 1600, y: 55, fontFamily: 'TG Bold', fontWeight: 700 })}>
        {settings.speaker.text.replace(/\r/g, '\n')}
      </div>
      <div style={layerStyle(settings.location, { x: 51, y: 1042, fontFamily: 'TG Regular', fontWeight: 400 })}>
        {settings.location.text.replace(/\r/g, '\n')}
      </div>
    </div>
  )
}
