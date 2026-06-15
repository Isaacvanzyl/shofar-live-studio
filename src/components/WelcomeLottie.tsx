import { useEffect, useRef } from 'react'
import lottie from 'lottie-web'
import type { AnimationItem } from 'lottie-web'
import type { LottieSettings, LottieTextLayer } from '../types'
import animationData from '../assets/Welcome.json'
import shofarLogo from '../assets/ShofarLogo_SonWhite.png'

// Background instance only — text, orange bar, and circle are hidden
function patchBackground(): object {
  const data = JSON.parse(JSON.stringify(animationData))
  const imgAsset = data.assets?.find((a: { id: string }) => a.id === 'image_0')
  if (imgAsset) { imgAsset.u = ''; imgAsset.p = shofarLogo }
  for (const layer of data.layers ?? []) {
    if (layer.ty === 5 || ['Circle Elem', 'NULL Line', 'Line'].includes(layer.nm)) {
      layer.ks.o = { a: 0, k: 0 }
    }
  }
  return data
}

function layerStyle(layer: LottieTextLayer, defaults: { x: number; y: number; fontFamily: string; fontWeight: number; rotate?: number }): React.CSSProperties {
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
    ...(defaults.rotate != null ? { transform: `rotate(${defaults.rotate}deg)`, transformOrigin: '0 0' } : {}),
  }
}

interface Props {
  settings: LottieSettings
  staticFrame?: number
}

export default function WelcomeLottie({ settings, staticFrame }: Props) {
  const bgRef = useRef<HTMLDivElement>(null)
  const bgAnimRef = useRef<AnimationItem | null>(null)

  useEffect(() => {
    bgAnimRef.current?.destroy()
    const isLive = staticFrame == null
    let fired = false
    const anim = lottie.loadAnimation({
      container: bgRef.current!,
      renderer: 'svg',
      loop: isLive,
      autoplay: false,
      animationData: patchBackground(),
    })
    anim.setSubframe(false)
    const onReady = () => {
      fired = true
      if (staticFrame != null) anim.goToAndStop(staticFrame, true)
      else { anim.goToAndStop(350, true); anim.play() }
    }
    anim.addEventListener('DOMLoaded', onReady)
    if (!fired && anim.isLoaded) onReady()
    bgAnimRef.current = anim
    return () => { bgAnimRef.current?.destroy() }
  }, [staticFrame])

  const { headline, eventDesc, eventName, moreInfo, bar, logoTl, logoTr } = settings

  return (
    <div style={{ position: 'absolute', inset: 0, width: 1920, height: 1080 }}>
      {/* Layer 1 — background shapes, logo, blobs */}
      <div ref={bgRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Layer 2 — frosted glass panel */}
      <div style={{
        position: 'absolute', left: 50, top: 50, width: 1820, height: 980,
        borderRadius: 25,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        background: 'rgba(244, 244, 244, 0.25)',
        pointerEvents: 'none',
      }} />

      {/* Layer 3 — custom divider bar */}
      {bar.visible && (
        <div style={{
          position: 'absolute',
          left: bar.x, top: bar.y,
          width: bar.width, height: bar.height,
          background: bar.color, opacity: bar.opacity,
          borderRadius: bar.radius,
          pointerEvents: 'none',
        }} />
      )}

      {/* Layer 4 — HTML text (full web font, all characters supported) */}
      <div style={layerStyle(headline, { x: 124, y: 353, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 })}>
        {headline.text.replace(/\r/g, '\n')}
      </div>

      <div style={layerStyle(eventDesc, { x: 124, y: 605, fontFamily: "'Barlow', sans-serif", fontWeight: 300 })}>
        {eventDesc.text.replace(/\r/g, '\n')}
      </div>

      <div style={layerStyle(eventName, { x: 131, y: 959, fontFamily: "'Barlow', sans-serif", fontWeight: 800 })}>
        {eventName.text.replace(/\r/g, '\n')}
      </div>

      <div style={layerStyle(moreInfo, { x: 1812, y: 75, fontFamily: "'Barlow', sans-serif", fontWeight: 800, rotate: 90 })}>
        {moreInfo.text.replace(/\r/g, '\n')}
      </div>

      {/* Layer 5 — uploaded logos */}
      {logoTl && (
        <img src={logoTl.src} alt="" style={{ position: 'absolute', left: logoTl.x, top: logoTl.y, width: logoTl.w, height: logoTl.h, objectFit: 'contain', pointerEvents: 'none' }} />
      )}
      {logoTr && (
        <img src={logoTr.src} alt="" style={{ position: 'absolute', left: logoTr.x, top: logoTr.y, width: logoTr.w, height: logoTr.h, objectFit: 'contain', pointerEvents: 'none' }} />
      )}
    </div>
  )
}
