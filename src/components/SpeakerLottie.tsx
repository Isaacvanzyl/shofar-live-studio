import { useEffect, useRef } from 'react'
import lottie from 'lottie-web'
import type { AnimationItem } from 'lottie-web'
import type { SpeakerSettings } from '../types'
import animationData from '../assets/SpeakerSlide.json'

// Patch text content into a named text layer (ty=5) in the Lottie data
function patchTextLayer(layers: unknown[], name: string, text: string) {
  for (const layer of layers as Record<string, unknown>[]) {
    if (layer.ty === 5 && layer.nm === name) {
      const kfs = (layer.t as { d: { k: Array<{ s: { t: string } }> } }).d.k
      kfs.forEach(kf => { kf.s.t = text })
    }
  }
}

function buildData(settings: SpeakerSettings): object {
  const data = JSON.parse(JSON.stringify(animationData)) as { layers: Record<string, unknown>[] }
  patchTextLayer(data.layers, 'Staff Devotion',      settings.title)
  patchTextLayer(data.layers, 'Phillip Boshoff',     settings.speaker)
  patchTextLayer(data.layers, "- Somerset West '26", settings.location)
  // Hide the decorative circle element in the bottom-right corner
  const circle = data.layers.find(l => l.nm === 'Circle Elem 6')
  if (circle) (circle.ks as Record<string, unknown>).o = { a: 0, k: 0 }
  // Centre the TXT_LINE bar horizontally, between top of canvas and screen area
  // Remove the parent null and set an absolute world position directly
  const txtLine = data.layers.find(l => l.nm === 'TXT_LINE') as Record<string, unknown> | undefined
  if (txtLine) {
    delete txtLine.parent
    const pk = (txtLine.ks as Record<string, unknown>).p as { a: number; k: number[] }
    pk.a = 0; pk.k = [960, 58, 0]
  }
  return data
}

interface Props {
  settings: SpeakerSettings
  staticFrame?: number
}

export default function SpeakerLottie({ settings, staticFrame }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<AnimationItem | null>(null)

  useEffect(() => {
    animRef.current?.destroy()
    const isLive = staticFrame == null
    let fired = false

    const anim = lottie.loadAnimation({
      container: containerRef.current!,
      renderer: 'svg',
      loop: isLive,
      autoplay: false,
      animationData: buildData(settings),
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
  }, [settings.title, settings.speaker, settings.location, staticFrame])

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, width: 1920, height: 1080 }}
    />
  )
}
