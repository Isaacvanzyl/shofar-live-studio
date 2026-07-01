import { useEffect, useRef, useState } from 'react'
import lottie from 'lottie-web'
import animationData from '../assets/LogoIntro.json'

const SESSION_KEY = 'shofar_intro_seen'
const FR = (animationData as { fr: number }).fr
const FADE_FRAME = 100
const FADE_START_MS = (FADE_FRAME / FR) * 1000   // 1666ms
const DONE_MS = FADE_START_MS + 900

export default function IntroScreen() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'playing' | 'fading' | 'done'>(
    sessionStorage.getItem(SESSION_KEY) ? 'done' : 'playing'
  )

  useEffect(() => {
    if (phase === 'done' || !containerRef.current) return

    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: 'svg',
      loop: false,
      autoplay: true,
      animationData: JSON.parse(JSON.stringify(animationData)),
    })

    const fadeTimer = setTimeout(() => setPhase('fading'), FADE_START_MS)
    const doneTimer = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, '1')
      setPhase('done')
    }, DONE_MS)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
      anim.destroy()
    }
  }, [])

  if (phase === 'done') return null

  return (
    <div className={`intro-overlay${phase === 'fading' ? ' intro-overlay--fade' : ''}`}>
      <div className="intro-orb intro-orb-1" />
      <div className="intro-orb intro-orb-2" />
      <div className="intro-lottie" ref={containerRef} />
    </div>
  )
}
