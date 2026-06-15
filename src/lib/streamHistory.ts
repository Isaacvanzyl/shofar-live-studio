export interface ViewerSnap { t: number; viewers: number }

export interface StreamSession {
  id: string
  title: string
  thumbnail?: string
  videoId?: string
  startedAt: number
  endedAt?: number
  peakViewers: number
  viewerHistory: ViewerSnap[]
  droppedFramesPct?: number
  avgCpu?: number
  avgFps?: number
}

const KEY = 'shofar_stream_history'
const ACTIVE = 'shofar_active_session'

export function getSessions(): StreamSession[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}
function save(sessions: StreamSession[]) {
  try { localStorage.setItem(KEY, JSON.stringify(sessions.slice(0, 30))) } catch { /* noop */ }
}
export function getActiveSession(): StreamSession | null {
  try { return JSON.parse(localStorage.getItem(ACTIVE) ?? 'null') } catch { return null }
}
export function startSession(data: Pick<StreamSession, 'title' | 'thumbnail' | 'videoId'>): StreamSession {
  const s: StreamSession = { id: crypto.randomUUID(), ...data, startedAt: Date.now(), peakViewers: 0, viewerHistory: [] }
  localStorage.setItem(ACTIVE, JSON.stringify(s))
  return s
}
export function snapshotSession(viewers: number, droppedPct?: number, cpu?: number, fps?: number) {
  const s = getActiveSession()
  if (!s) return
  s.viewerHistory.push({ t: Date.now(), viewers })
  if (viewers > s.peakViewers) s.peakViewers = viewers
  if (droppedPct !== undefined) s.droppedFramesPct = droppedPct
  if (cpu !== undefined) s.avgCpu = cpu
  if (fps !== undefined) s.avgFps = fps
  localStorage.setItem(ACTIVE, JSON.stringify(s))
}
export function endSession(): StreamSession | null {
  const s = getActiveSession()
  if (!s) return null
  s.endedAt = Date.now()
  const all = getSessions()
  all.unshift(s)
  save(all)
  localStorage.removeItem(ACTIVE)
  return s
}
export function clearSession(id: string) {
  save(getSessions().filter(s => s.id !== id))
}
