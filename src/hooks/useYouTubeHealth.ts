import { useState, useEffect, useRef, useCallback } from 'react'
import { getBroadcastById, getLiveBroadcastByChannel, getLiveStream, getMyActiveBroadcast, getMyLiveStream, type LiveBroadcast, type LiveStreamHealth } from '../lib/youtube'
import { getValidYouTubeToken } from '../lib/youtubeAuth'

interface YouTubeHealthData {
  broadcast: LiveBroadcast | null
  stream: LiveStreamHealth | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  authMode: 'oauth' | 'apikey' | 'none'
}

export function useYouTubeHealth(channelOrVideoId: string, pollIntervalMs = 15000) {
  const [data, setData] = useState<YouTubeHealthData>({
    broadcast: null,
    stream: null,
    loading: false,
    error: null,
    lastUpdated: null,
    authMode: 'none',
  })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined

  const doFetch = useCallback(async () => {
    setData((d) => ({ ...d, loading: true, error: null }))

    // Try OAuth first (per-church Google account)
    const accessToken = await getValidYouTubeToken()

    try {
      if (accessToken) {
        // OAuth mode: auto-find active broadcast, no video/channel ID needed
        const broadcast = await getMyActiveBroadcast(accessToken)
        let stream: LiveStreamHealth | null = null
        if (broadcast?.streamId) {
          stream = await getMyLiveStream(broadcast.streamId, accessToken)
        }
        setData({ broadcast, stream, loading: false, error: null, lastUpdated: new Date(), authMode: 'oauth' })
        return
      }

      // Fallback: API key mode (public streams)
      if (!apiKey) {
        setData((d) => ({ ...d, loading: false, error: 'no_auth', authMode: 'none' }))
        return
      }

      let broadcast: LiveBroadcast | null = null
      let stream: LiveStreamHealth | null = null
      const id = channelOrVideoId.trim()

      if (id.startsWith('UC')) {
        broadcast = await getLiveBroadcastByChannel(id, apiKey)
      } else if (id) {
        broadcast = await getBroadcastById(id, apiKey)
      }

      if (broadcast?.streamId) {
        stream = await getLiveStream(broadcast.streamId, apiKey)
      }

      setData({ broadcast, stream, loading: false, error: null, lastUpdated: new Date(), authMode: 'apikey' })
    } catch {
      setData((d) => ({ ...d, loading: false, error: 'fetch_error', lastUpdated: new Date() }))
    }
  }, [apiKey, channelOrVideoId])

  useEffect(() => {
    doFetch()
    timerRef.current = setInterval(doFetch, pollIntervalMs)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [doFetch, pollIntervalMs])

  return { ...data, refetch: doFetch }
}
