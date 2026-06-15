import { useState, useEffect, useRef } from 'react'
import { OBSClient, type OBSConnectionState } from '../lib/obs'

export function useOBSStats(host: string, port: number, password: string, enabled: boolean) {
  const [state, setState] = useState<OBSConnectionState>({
    connected: false, connecting: false, error: null, stats: null, streamStatus: null, videoSettings: null,
  })
  const clientRef = useRef<OBSClient | null>(null)

  useEffect(() => {
    if (!enabled) {
      clientRef.current?.disconnect()
      clientRef.current = null
      setState({ connected: false, connecting: false, error: null, stats: null, streamStatus: null, videoSettings: null })
      return
    }
    const client = new OBSClient(host, port, password)
    clientRef.current = client
    const unsub = client.subscribe(setState)
    client.connect()
    return () => { unsub(); client.disconnect() }
  }, [host, port, password, enabled])

  const reconnect = () => clientRef.current?.connect()
  return { ...state, reconnect }
}
