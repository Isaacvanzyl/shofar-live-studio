import { useState, useEffect } from 'react'
import { getState, subscribeToState, supabase } from '../../lib/supabase'
import type { LottieSettings, SpeakerSettings } from '../../types'
import WelcomeLottie from '../../components/WelcomeLottie'
import SpeakerLottie from '../../components/SpeakerLottie'
import { DEFAULT_LOTTIE_SETTINGS, DEFAULT_SPEAKER_SETTINGS } from '../control/ControlContext'

function baseKey(screen: string) {
  if (screen === 'welcome') return 'welcome_lottie'
  if (screen === 'speaker') return 'speaker_slide'
  return `screen_${screen}`
}

export default function ScreenOutput({ screen }: { screen: string }) {
  const isSpeaker = screen === 'speaker'
  const [lottie, setLottie] = useState<LottieSettings>(DEFAULT_LOTTIE_SETTINGS)
  const [speaker, setSpeaker] = useState<SpeakerSettings>(DEFAULT_SPEAKER_SETTINGS)
  const [connected, setConnected] = useState(false)

  const orgId = new URLSearchParams(window.location.search).get('org')

  useEffect(() => {
    const scale = () => {
      const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
      document.body.style.transform = `scale(${s})`
      document.body.style.transformOrigin = 'top left'
    }
    document.documentElement.style.width = '100%'
    document.documentElement.style.height = '100%'
    document.body.style.width = '1920px'
    document.body.style.height = '1080px'
    document.body.style.overflow = 'hidden'
    document.body.style.margin = '0'
    document.body.style.background = 'transparent'
    scale()
    window.addEventListener('resize', scale)
    return () => window.removeEventListener('resize', scale)
  }, [])

  useEffect(() => {
    let mounted = true
    const raw = baseKey(screen)
    const key = orgId ? `${orgId}:${raw}` : raw

    if (isSpeaker) {
      getState(key).then((data) => { if (mounted && data) setSpeaker(data as SpeakerSettings) })
      const sub = subscribeToState(key, (data) => { if (mounted) setSpeaker(data as SpeakerSettings) }, () => setConnected(true))
      return () => { mounted = false; supabase.removeChannel(sub) }
    } else {
      getState(key).then((data) => { if (mounted && data) setLottie(data as LottieSettings) })
      const sub = subscribeToState(key, (data) => { if (mounted) setLottie(data as LottieSettings) }, () => setConnected(true))
      return () => { mounted = false; supabase.removeChannel(sub) }
    }
  }, [screen, isSpeaker])

  return (
    <div style={{ position: 'relative', width: 1920, height: 1080, overflow: 'hidden', background: 'transparent' }}>
      <div style={{ position: 'absolute', inset: 0, background: '#f4f4f4', zIndex: 0 }} />
      {isSpeaker
        ? <SpeakerLottie settings={speaker} />
        : <WelcomeLottie settings={lottie} />
      }
      {!connected && (
        <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,80,0,.15)', border: '1px solid rgba(255,80,0,.3)', borderRadius: 3, padding: '3px 10px', fontSize: 10, color: 'rgba(255,80,0,.7)', fontFamily: 'monospace', zIndex: 50, opacity: 0.7 }}>
          CONNECTING…
        </div>
      )}
    </div>
  )
}
