import { useState, useEffect, useCallback } from 'react'
import { getState, setState as setSupabaseState, subscribeToState, supabase } from '../lib/supabase'

export function useBroadcastState<T>(channel: string, defaultState: T) {
  const [state, setLocalState] = useState<T>(defaultState)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    getState(channel).then((data) => {
      if (mounted && data) {
        setLocalState(data as T)
      }
      if (mounted) setLoading(false)
    })

    const sub = subscribeToState(channel, (newState) => {
      if (mounted) {
        setLocalState(newState as T)
        setConnected(true)
      }
    })

    sub.on('system' as Parameters<typeof sub.on>[0], {} as Parameters<typeof sub.on>[1], (status: unknown) => {
      if (mounted) setConnected((status as { event?: string }).event === 'SUBSCRIBED')
    })

    return () => {
      mounted = false
      supabase.removeChannel(sub)
    }
  }, [channel])

  const pushState = useCallback(
    async (newState: T) => {
      setLocalState(newState)
      await setSupabaseState(channel, newState as object)
    },
    [channel]
  )

  return { state, pushState, connected, loading }
}
