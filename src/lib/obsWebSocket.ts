import { useState, useRef, useCallback, useEffect } from 'react'

type Status = 'disconnected' | 'connecting' | 'connected' | 'error'

interface Scene {
  sceneName: string
  sceneIndex: number
}

interface OBSWebSocketHook {
  host: string
  setHost: (s: string) => void
  port: string
  setPort: (s: string) => void
  password: string
  setPassword: (s: string) => void
  status: Status
  errorMsg: string
  connect: () => void
  disconnect: () => void
  scenes: Scene[]
  currentScene: string
  switchScene: (name: string) => void
  studioMode: boolean
  toggleStudioMode: () => void
  previewScene: string
  transitionToProgram: () => void
}

async function sha256Base64(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
}

async function computeAuthentication(password: string, salt: string, challenge: string): Promise<string> {
  const secret = await sha256Base64(password + salt)
  return sha256Base64(secret + challenge)
}

export function useOBSWebSocket(): OBSWebSocketHook {
  const [host, setHost] = useState('localhost')
  const [port, setPort] = useState('4455')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<Status>('disconnected')
  const [errorMsg, setErrorMsg] = useState('')
  const [scenes, setScenes] = useState<Scene[]>([])
  const [currentScene, setCurrentScene] = useState('')
  const [studioMode, setStudioMode] = useState(false)
  const [previewScene, setPreviewScene] = useState('')

  const wsRef = useRef<WebSocket | null>(null)
  const reqIdRef = useRef(1)
  const studioModeRef = useRef(false)

  useEffect(() => {
    studioModeRef.current = studioMode
  }, [studioMode])

  const sendRequest = useCallback((requestType: string, requestData?: Record<string, unknown>): string => {
    const requestId = String(reqIdRef.current++)
    const message: Record<string, unknown> = { op: 6, d: { requestType, requestId } }
    if (requestData !== undefined) {
      (message.d as Record<string, unknown>).requestData = requestData
    }
    wsRef.current?.send(JSON.stringify(message))
    return requestId
  }, [])

  const fetchInitialState = useCallback(async (ws: WebSocket) => {
    const sendMsg = (requestType: string, requestData?: Record<string, unknown>) => {
      const requestId = String(reqIdRef.current++)
      const message: Record<string, unknown> = { op: 6, d: { requestType, requestId } }
      if (requestData !== undefined) {
        (message.d as Record<string, unknown>).requestData = requestData
      }
      ws.send(JSON.stringify(message))
    }
    sendMsg('GetSceneList')
    sendMsg('GetStudioModeEnabled')
  }, [])

  const handleMessage = useCallback(async (event: MessageEvent) => {
    let msg: { op: number; d: Record<string, unknown> }
    try {
      msg = JSON.parse(event.data as string)
    } catch {
      return
    }

    const { op, d } = msg

    if (op === 0) {
      // Hello
      const auth = d.authentication as { salt: string; challenge: string } | undefined
      let authentication: string | undefined
      if (auth) {
        try {
          authentication = await computeAuthentication(password, auth.salt, auth.challenge)
        } catch {
          setStatus('error')
          setErrorMsg('Failed to compute authentication')
          wsRef.current?.close()
          return
        }
      }
      const identifyPayload: Record<string, unknown> = { rpcVersion: 1 }
      if (authentication) identifyPayload.authentication = authentication
      wsRef.current?.send(JSON.stringify({ op: 1, d: identifyPayload }))
    } else if (op === 2) {
      // Identified
      setStatus('connected')
      setErrorMsg('')
      if (wsRef.current) fetchInitialState(wsRef.current)
    } else if (op === 7) {
      // RequestResponse
      const { requestType, responseData, requestStatus } = d as {
        requestType: string
        requestId: string
        requestStatus: { result: boolean; code: number }
        responseData?: Record<string, unknown>
      }

      if (!requestStatus.result) return

      if (requestType === 'GetSceneList' && responseData) {
        const rawScenes = responseData.scenes as { sceneName: string; sceneIndex: number }[]
        setScenes(rawScenes.map(s => ({ sceneName: s.sceneName, sceneIndex: s.sceneIndex })))
        setCurrentScene(responseData.currentProgramSceneName as string)
      } else if (requestType === 'GetStudioModeEnabled' && responseData) {
        const enabled = responseData.studioModeEnabled as boolean
        setStudioMode(enabled)
        studioModeRef.current = enabled
        if (enabled) {
          sendRequest('GetCurrentPreviewScene')
        }
      } else if (requestType === 'GetCurrentPreviewScene' && responseData) {
        setPreviewScene(responseData.currentPreviewSceneName as string)
      }
    } else if (op === 5) {
      // Event
      const { eventType, eventData } = d as {
        eventType: string
        eventData?: Record<string, unknown>
      }

      if (eventType === 'CurrentProgramSceneChanged' && eventData) {
        setCurrentScene(eventData.sceneName as string)
      } else if (eventType === 'CurrentPreviewSceneChanged' && eventData) {
        setPreviewScene(eventData.sceneName as string)
      } else if (eventType === 'StudioModeStateChanged' && eventData) {
        const enabled = eventData.studioModeEnabled as boolean
        setStudioMode(enabled)
        studioModeRef.current = enabled
        if (enabled) {
          sendRequest('GetCurrentPreviewScene')
        } else {
          setPreviewScene('')
        }
      } else if (eventType === 'SceneListChanged' && eventData) {
        const rawScenes = eventData.scenes as { sceneName: string; sceneIndex: number }[]
        setScenes(rawScenes.map(s => ({ sceneName: s.sceneName, sceneIndex: s.sceneIndex })))
      }
    }
  }, [password, fetchInitialState, sendRequest])

  const disconnect = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    setStatus('disconnected')
    setErrorMsg('')
    setScenes([])
    setCurrentScene('')
    setStudioMode(false)
    setPreviewScene('')
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setStatus('connecting')
    setErrorMsg('')

    const url = `ws://${host}:${port}`
    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create WebSocket')
      return
    }

    wsRef.current = ws

    ws.onmessage = handleMessage

    ws.onerror = () => {
      setStatus('error')
      setErrorMsg(`Could not connect to OBS at ${url}`)
    }

    ws.onclose = (event) => {
      if (wsRef.current === ws) {
        wsRef.current = null
        if (event.wasClean) {
          setStatus('disconnected')
        } else {
          setStatus('error')
          setErrorMsg(`Connection closed unexpectedly (code ${event.code})`)
        }
      }
    }
  }, [host, port, handleMessage])

  const switchScene = useCallback((name: string) => {
    sendRequest('SetCurrentProgramScene', { sceneName: name })
  }, [sendRequest])

  const toggleStudioMode = useCallback(() => {
    sendRequest('SetStudioModeEnabled', { studioModeEnabled: !studioModeRef.current })
  }, [sendRequest])

  const transitionToProgram = useCallback(() => {
    sendRequest('TriggerStudioModeTransition')
  }, [sendRequest])

  useEffect(() => {
    return () => {
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [])

  return {
    host, setHost,
    port, setPort,
    password, setPassword,
    status,
    errorMsg,
    connect,
    disconnect,
    scenes,
    currentScene,
    switchScene,
    studioMode,
    toggleStudioMode,
    previewScene,
    transitionToProgram,
  }
}
