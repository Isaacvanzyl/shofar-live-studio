import { useState, useEffect } from 'react'
import { getState, subscribeToState, supabase } from '../../lib/supabase'
import type { LottieSettings } from '../../types'
import WelcomeLottie from '../../components/WelcomeLottie'

const DEFAULT_LOTTIE: LottieSettings = {
  headline:  { text: 'THE BROADCAST\rWILL START SOON', color: '#3d3d3d', size: 110 },
  eventName: { text: 'Staff Devotion',                  color: '#474747', size: 35 },
  eventDesc: { text: 'Info about Staff devotion or stream', color: '#3d3d3d', size: 35 },
  moreInfo:  { text: 'More info about stream',          color: '#474747', size: 35 },
  bar: { visible: true, x: 309, y: 495, width: 592, height: 6, color: '#F15C22', opacity: 1, radius: 3 },
}

function baseKey(screen: string) {
  return screen === 'welcome' ? 'welcome_lottie' : `screen_${screen}`
}

export default function ScreenOutput({ screen }: { screen: string }) {
  const [lottie, setLottie] = useState<LottieSettings>(DEFAULT_LOTTIE)
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

    getState(key).then((data) => { if (mounted && data) setLottie(data as LottieSettings) })

    const sub = subscribeToState(key, (data) => {
      if (mounted) setLottie(data as LottieSettings)
    }, () => setConnected(true))

    return () => {
      mounted = false
      supabase.removeChannel(sub)
    }
  }, [screen])

  return (
    <div style={{
      position: 'relative',
      width: 1920,
      height: 1080,
      overflow: 'hidden',
      background: 'transparent',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: '#f4f4f4', zIndex: 0 }} />
      <WelcomeLottie settings={lottie} />

      {!connected && (
        <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,80,0,.15)', border: '1px solid rgba(255,80,0,.3)', borderRadius: 3, padding: '3px 10px', fontSize: 10, color: 'rgba(255,80,0,.7)', fontFamily: 'monospace', zIndex: 50, opacity: 0.7 }}>
          CONNECTING…
        </div>
      )}
    </div>
  )
}
