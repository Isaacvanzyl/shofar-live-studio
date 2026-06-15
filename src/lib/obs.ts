export interface OBSStats {
  cpuUsage: number
  memoryUsage: number
  availableDiskSpace: number
  activeFps: number
  renderSkippedFrames: number
  renderTotalFrames: number
  outputSkippedFrames: number
  outputTotalFrames: number
}

export interface OBSVideoSettings {
  baseWidth: number
  baseHeight: number
  outputWidth: number
  outputHeight: number
  fpsNumerator: number
  fpsDenominator: number
}

export interface OBSStreamStatus {
  outputActive: boolean
  outputReconnecting: boolean
  outputTimecode: string
  outputDuration: number
  outputBytes: number
  outputSkippedFrames: number
  outputTotalFrames: number
}

export interface OBSConnectionState {
  connected: boolean
  connecting: boolean
  error: string | null
  stats: OBSStats | null
  streamStatus: OBSStreamStatus | null
  videoSettings: OBSVideoSettings | null
}

type Listener = (state: OBSConnectionState) => void

async function hashBase64(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

async function makeAuth(password: string, salt: string, challenge: string): Promise<string> {
  const step1 = await hashBase64(password + salt)
  return hashBase64(step1 + challenge)
}

export class OBSClient {
  private ws: WebSocket | null = null
  private listeners: Set<Listener> = new Set()
  private state: OBSConnectionState = { connected: false, connecting: false, error: null, stats: null, streamStatus: null, videoSettings: null }
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private reqId = 0
  private pending = new Map<string, (d: unknown) => void>()

  constructor(
    public host: string = 'localhost',
    public port: number = 4455,
    public password: string = ''
  ) {}

  connect() {
    if (this.ws) this.disconnect()
    this.setState({ connecting: true, error: null })
    try {
      this.ws = new WebSocket(`ws://${this.host}:${this.port}`)
      this.ws.onmessage = (e) => this.handleMsg(JSON.parse(e.data as string) as { op: number; d: Record<string, unknown> })
      this.ws.onclose = () => {
        this.setState({ connected: false, connecting: false })
        this.stopPoll()
      }
      this.ws.onerror = () => {
        this.setState({ connected: false, connecting: false, error: `Cannot connect to OBS at ${this.host}:${this.port}` })
        this.stopPoll()
      }
    } catch (err) {
      this.setState({ connecting: false, error: String(err) })
    }
  }

  disconnect() {
    this.stopPoll()
    if (this.ws) { try { this.ws.close() } catch { /* noop */ } this.ws = null }
    this.setState({ connected: false, connecting: false, error: null })
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    fn(this.state)
    return () => this.listeners.delete(fn)
  }

  getState() { return this.state }

  private setState(patch: Partial<OBSConnectionState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach(fn => fn(this.state))
  }

  private send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(data))
  }

  private async handleMsg(msg: { op: number; d: Record<string, unknown> }) {
    if (msg.op === 0) {
      const auth = msg.d.authentication as { challenge: string; salt: string } | undefined
      let authStr: string | undefined
      if (auth && this.password) authStr = await makeAuth(this.password, auth.salt, auth.challenge)
      this.send({ op: 1, d: { rpcVersion: 1, ...(authStr ? { authentication: authStr } : {}), eventSubscriptions: 0 } })
    }
    if (msg.op === 2) {
      this.setState({ connected: true, connecting: false, error: null })
      this.startPoll()
    }
    if (msg.op === 4) {
      this.setState({ connected: false, connecting: false, error: 'Authentication failed — check your OBS WebSocket password' })
    }
    if (msg.op === 7) {
      const d = msg.d as { requestId: string; requestStatus: { result: boolean }; responseData?: unknown }
      const resolve = this.pending.get(d.requestId)
      if (resolve) { this.pending.delete(d.requestId); if (d.requestStatus.result) resolve(d.responseData ?? null); else resolve(null) }
    }
  }

  private request<T>(type: string): Promise<T | null> {
    return new Promise(resolve => {
      const id = String(++this.reqId)
      this.pending.set(id, resolve as (d: unknown) => void)
      this.send({ op: 6, d: { requestType: type, requestId: id } })
      setTimeout(() => { this.pending.delete(id); resolve(null) }, 5000)
    })
  }

  private async poll() {
    const [stats, streamStatus, videoSettings] = await Promise.all([
      this.request<OBSStats>('GetStats'),
      this.request<OBSStreamStatus>('GetStreamStatus'),
      this.request<OBSVideoSettings>('GetVideoSettings'),
    ])
    this.setState({
      stats: stats ?? this.state.stats,
      streamStatus: streamStatus ?? this.state.streamStatus,
      videoSettings: videoSettings ?? this.state.videoSettings,
    })
  }

  private startPoll() { this.poll(); this.pollTimer = setInterval(() => this.poll(), 5000) }
  private stopPoll() { if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null } }
}
