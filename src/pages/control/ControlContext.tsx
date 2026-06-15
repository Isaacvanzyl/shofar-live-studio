import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react'
import type {
  ScreenId,
  ResId,
  ModuleId,
  ScreenElement,
  LowerThirdState,
  TickerState,
  ThemeState,
  LottieSettings,
} from '../../types'
import { setState as setSupabaseState, getState as getSupabaseState } from '../../lib/supabase'

// ── Default element sets ──────────────────────────────────────────────────────

const LOGO_TL: ScreenElement = { id: 'logo-tl', type: 'logo', slot: 'tl', x: 54, y: 38, w: 130, h: 80, visible: true }
const LOGO_TR: ScreenElement = { id: 'logo-tr', type: 'logo', slot: 'tr', x: 1736, y: 38, w: 130, h: 80, visible: true }

export const DEFAULT_ELEMENTS: Record<ScreenId, ScreenElement[]> = {
  welcome: [
    LOGO_TL, LOGO_TR,
    { id: 'eyebrow', type: 'text', cls: 'el-eyebrow', text: 'WELCOME', x: 0, y: 278, fontSize: 32, visible: true },
    { id: 'title1', type: 'text', cls: 'el-title1', text: 'STAFF', x: 0, y: 308, fontSize: 168, visible: true },
    { id: 'title2', type: 'text', cls: 'el-title2', text: 'DEVOTION', x: 0, y: 460, fontSize: 168, visible: true },
    { id: 'subtitle', type: 'text', cls: 'el-subtitle', text: "We're glad you're here.", x: 0, y: 648, fontSize: 34, visible: true },
    { id: 'meta', type: 'meta', text1: 'shofar.net', text2: "Somerset West '26", x: 534, y: 706, fontSize: 28, visible: true },
  ],
}

export const DEFAULT_LT_STATE: LowerThirdState = {
  visible: false,
  name: 'Isaac de Villiers',
  title: 'Media Production',
  accentCol: '#E84F0E',
  nameCol: '#f4ede6',
  titleCol: '#E84F0E',
  bgOp: 94,
  barWidth: 10,
  nameSz: 52,
  titleSz: 26,
  xOff: 80,
  yOff: 90,
  pad: 18,
  panelBg: '#120d09',
  uppercase: 'none',
  logo: null,
  nameFont: "'Barlow Condensed', sans-serif",
  titleFont: "'Barlow', sans-serif",
}

export const DEFAULT_TICKER_STATE: TickerState = {
  visible: true,
  items: ['shofar.net', "Somerset West '26", 'Staff Devotion — Weekly gathering'],
  badge: 'SHOFAR SW',
  speed: 32,
  fontSize: 13,
  bgOp: 90,
  textCol: '#f0ede8',
  badgeCol: '#E84F0E',
  height: 44,
  uppercase: false,
}

export const DEFAULT_THEME_STATE: ThemeState = {
  accentCol: '#E84F0E',
  orangeIntensity: 55,
  darkness: 70,
  animSpeed: 50,
  ltDarkness: 88,
  tickerDarkness: 90,
}

export const DEFAULT_LOTTIE_SETTINGS: LottieSettings = {
  headline:  { text: 'THE BROADCAST\rWILL START SOON', color: '#3d3d3d', size: 110 },
  eventName: { text: 'Staff Devotion',                  color: '#474747', size: 35 },
  eventDesc: { text: 'Info about Staff devotion or stream', color: '#3d3d3d', size: 35 },
  moreInfo:  { text: 'More info about stream',          color: '#474747', size: 35 },
  bar: { visible: true, x: 309, y: 495, width: 592, height: 6, color: '#F15C22', opacity: 1, radius: 3 },
}

// ── Context type ─────────────────────────────────────────────────────────────

interface ControlContextType {
  curScreen: ScreenId
  curRes: ResId
  curMod: ModuleId
  scState: Record<string, ScreenElement[]>
  selId: string | null
  logos: Record<string, string | null>
  ltState: LowerThirdState
  tickerState: TickerState
  themeState: ThemeState
  scale: number
  gridOn: boolean
  toastMsg: string

  setCurMod: (m: ModuleId) => void
  switchScreen: (s: ScreenId) => void
  switchRes: (r: ResId) => void
  getElements: () => ScreenElement[]
  getElement: (id: string) => ScreenElement | undefined
  setSelId: (id: string | null) => void
  updateElement: (id: string, patch: Partial<ScreenElement>) => void
  toggleElementVisibility: (id: string) => void
  pushUndo: () => void
  undo: () => void
  resetScreen: () => void
  setLogo: (slot: string, data: string | null) => void
  setLtState: (s: LowerThirdState) => void
  pushLtState: (s: LowerThirdState) => void
  setTickerState: (s: TickerState) => void
  pushTickerState: (s: TickerState) => void
  setThemeState: (s: ThemeState) => void
  pushThemeState: (s: ThemeState) => void
  lottieSettings: LottieSettings
  setLottieSettings: (s: LottieSettings) => void
  pushLottieSettings: (s: LottieSettings) => void
  pushScreenPreset: (id: string, s: LottieSettings) => Promise<void>
  setScale: (s: number) => void
  setGridOn: (v: boolean) => void
  showToast: (msg: string) => void
  buildExport: () => string
  ltTimerDuration: number | null
  setLtTimerDuration: (d: number | null) => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const ControlContext = createContext<ControlContextType | null>(null)

export function useControl() {
  const ctx = useContext(ControlContext)
  if (!ctx) throw new Error('useControl must be used within ControlProvider')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ControlProvider({ children, orgId }: { children: ReactNode; orgId?: string | null }) {
  const ck = (channel: string) => orgId ? `${orgId}:${channel}` : channel
  const [curScreen, setCurScreen] = useState<ScreenId>('welcome')
  const [curRes, setCurRes] = useState<ResId>('1080')
  const [curMod, setCurMod] = useState<ModuleId>('screens')
  const [scState, setScState] = useState<Record<string, ScreenElement[]>>({})
  const [selId, setSelId] = useState<string | null>(null)
  const [logos, setLogos] = useState<Record<string, string | null>>({ tl: null, tr: null, lt: null })
  const [ltState, setLtState] = useState<LowerThirdState>(DEFAULT_LT_STATE)
  const [tickerState, setTickerState] = useState<TickerState>(DEFAULT_TICKER_STATE)
  const [themeState, setThemeState] = useState<ThemeState>(DEFAULT_THEME_STATE)
  const [lottieSettings, setLottieSettings] = useState<LottieSettings>(DEFAULT_LOTTIE_SETTINGS)
  const [scale, setScale] = useState(1)
  const [gridOn, setGridOn] = useState(false)
  const [ltTimerDuration, setLtTimerDuration] = useState<number | null>(null)
  const [toastMsg, setToastMsg] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoStack = useRef<Record<string, string[]>>({})

  // Rehydrate lottie settings from Supabase on mount
  useEffect(() => {
    getSupabaseState(ck('welcome_lottie')).then(data => {
      if (data) setLottieSettings(data as LottieSettings)
    }).catch(() => {})
  }, [])

  const sk = useCallback(() => `${curScreen}_${curRes}`, [curScreen, curRes])

  const getElements = useCallback((): ScreenElement[] => {
    const key = `${curScreen}_${curRes}`
    if (!scState[key]) return JSON.parse(JSON.stringify(DEFAULT_ELEMENTS[curScreen]))
    return scState[key]
  }, [scState, curScreen, curRes])

  const getElement = useCallback(
    (id: string) => getElements().find((e) => e.id === id),
    [getElements]
  )

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(''), 1800)
  }, [])

  const pushUndo = useCallback(() => {
    const key = sk()
    if (!undoStack.current[key]) undoStack.current[key] = []
    undoStack.current[key].push(JSON.stringify(getElements()))
    if (undoStack.current[key].length > 30) undoStack.current[key].shift()
  }, [sk, getElements])

  const undo = useCallback(() => {
    const key = sk()
    const stack = undoStack.current[key]
    if (!stack || !stack.length) return
    const prev = JSON.parse(stack.pop()!)
    setScState((s) => ({ ...s, [key]: prev }))
    setSelId(null)
  }, [sk])

  const updateElement = useCallback(
    (id: string, patch: Partial<ScreenElement>) => {
      const key = `${curScreen}_${curRes}`
      setScState((prev) => {
        const elems = prev[key] ?? JSON.parse(JSON.stringify(DEFAULT_ELEMENTS[curScreen]))
        const updated = elems.map((e: ScreenElement) => (e.id === id ? { ...e, ...patch } : e))
        return { ...prev, [key]: updated }
      })
      // Debounced Supabase sync handled externally or here inline:
      setSupabaseState(ck(curScreen), {
        screen: curScreen,
        res: curRes,
        elements: scState[key] ?? DEFAULT_ELEMENTS[curScreen],
      }).catch(() => {})
    },
    [curScreen, curRes, scState]
  )

  const toggleElementVisibility = useCallback(
    (id: string) => {
      const el = getElement(id)
      if (!el) return
      updateElement(id, { visible: !el.visible })
    },
    [getElement, updateElement]
  )

  const switchScreen = useCallback(
    (s: ScreenId) => {
      setCurScreen(s)
      setSelId(null)
    },
    []
  )

  const switchRes = useCallback((r: ResId) => {
    setCurRes(r)
    setSelId(null)
  }, [])

  const resetScreen = useCallback(() => {
    const key = sk()
    setScState((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setSelId(null)
    showToast('Reset to defaults')
  }, [sk, showToast])

  const setLogo = useCallback((slot: string, data: string | null) => {
    setLogos((prev) => ({ ...prev, [slot]: data }))
  }, [])

  const pushLtState = useCallback(
    async (s: LowerThirdState) => {
      setLtState(s)
      const { error } = await setSupabaseState(ck('lower-third'), s)
      if (error) console.error('[Supabase] lower-third push failed:', error)
    },
    []
  )

  const pushTickerState = useCallback(
    async (s: TickerState) => {
      setTickerState(s)
      const { error } = await setSupabaseState(ck('ticker'), s)
      if (error) console.error('[Supabase] ticker push failed:', error)
    },
    []
  )

  const pushThemeState = useCallback(
    async (s: ThemeState) => {
      setThemeState(s)
      const { error } = await setSupabaseState(ck('theme'), s)
      if (error) console.error('[Supabase] theme push failed:', error)
    },
    []
  )

  const pushLottieSettings = useCallback(
    async (s: LottieSettings) => {
      setLottieSettings(s)
      const { error } = await setSupabaseState(ck('welcome_lottie'), s)
      if (error) console.error('[Supabase] lottie push failed:', error)
    },
    []
  )

  const pushScreenPreset = useCallback(
    async (id: string, s: LottieSettings) => {
      const { error } = await setSupabaseState(ck(`screen_${id}`), s)
      if (error) console.error(`[Supabase] screen_${id} push failed:`, error)
    },
    []
  )

  const buildExport = useCallback((): string => {
    const r = curRes === '4k' ? { w: 3840, h: 2160, sc: 2 } : { w: 1920, h: 1080, sc: 1 }
    const s = r.sc
    const elems = getElements()
    let elHtml = ''

    elems.forEach((elem) => {
      if (!elem.visible) return
      const l = Math.round(elem.x * s)
      const t = Math.round(elem.y * s)
      if (elem.type === 'logo') {
        const src = logos[elem.slot ?? 'tl']
        if (!src) return
        const w = Math.round((elem.w ?? 130) * s)
        const h = Math.round((elem.h ?? 80) * s)
        elHtml += `  <img src="${src}" style="position:absolute;left:${l}px;top:${t}px;width:${w}px;height:${h}px;object-fit:contain">\n`
      } else if (elem.type === 'meta') {
        const fs = Math.round((elem.fontSize ?? 28) * s)
        elHtml += `  <div style="position:absolute;left:${l}px;top:${t}px;font-family:'Barlow',sans-serif;font-weight:400;font-size:${fs}px;color:rgba(240,235,228,.38);display:flex;align-items:center;gap:${Math.round(18 * s)}px;white-space:nowrap"><span style="color:#E84F0E">•</span>${elem.text1}<span style="width:1px;height:${Math.round(18 * s)}px;background:rgba(255,255,255,.18);display:inline-block"></span><span style="color:#E84F0E">•</span>${elem.text2}</div>\n`
      } else {
        const fs = Math.round((elem.fontSize ?? 100) * s)
        const col = elem.color ?? '#fff'
        elHtml += `  <div style="position:absolute;left:${l}px;top:${t}px;font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:${fs}px;color:${col};text-transform:uppercase;white-space:nowrap">${elem.text}</div>\n`
      }
    })

    const tItems = [...tickerState.items, ...tickerState.items]
      .map((item) => `<span style="padding:0 ${Math.round(36 * s)}px;border-right:1px solid rgba(255,255,255,.07)">${item}</span>`)
      .join('')
    const th = Math.round(44 * s)
    const tfs = Math.round(13 * s)
    const tickerHtml = tickerState.visible
      ? `  <div style="position:absolute;bottom:0;left:0;right:0;height:${th}px;background:rgba(10,8,6,.9);border-top:1px solid rgba(232,79,14,.14);display:flex;align-items:center;overflow:hidden;z-index:15">
    <div style="flex-shrink:0;padding:0 ${Math.round(18 * s)}px;font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:${Math.round(11 * s)}px;letter-spacing:.14em;text-transform:uppercase;color:#E84F0E;border-right:1px solid rgba(232,79,14,.2);height:100%;display:flex;align-items:center;background:rgba(10,6,3,.7)">${tickerState.badge}</div>
    <div style="flex:1;overflow:hidden;height:100%;display:flex;align-items:center"><div style="display:flex;white-space:nowrap;font-family:'Barlow',sans-serif;font-size:${tfs}px;color:rgba(240,235,228,.42);animation:tscroll 32s linear infinite">${tItems}</div></div>
  </div>`
      : ''

    const b1 = Math.round(80 * s)
    const b2 = Math.round(100 * s)
    const b3 = Math.round(64 * s)
    const b4 = Math.round(88 * s)

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Shofar — ${curScreen}</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;700;900&family=Barlow:wght@300;400&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${r.w}px;height:${r.h}px;overflow:hidden;background:#0c0804}
#w{position:relative;width:${r.w}px;height:${r.h}px;overflow:hidden}
.o{position:absolute;border-radius:50%;will-change:transform}
#o1{width:75%;height:70%;background:radial-gradient(ellipse,rgba(44,16,4,.9) 0%,transparent 68%);top:-15%;left:-12%;filter:blur(${b1}px);animation:o1 28s ease-in-out infinite alternate}
#o2{width:80%;height:68%;background:radial-gradient(ellipse,rgba(20,7,2,.95) 0%,transparent 65%);bottom:-22%;right:-18%;filter:blur(${b2}px);animation:o2 36s ease-in-out infinite alternate}
#o3{width:58%;height:56%;background:radial-gradient(ellipse,rgba(92,28,4,.2) 0%,transparent 65%);top:18%;left:22%;filter:blur(${b3}px);animation:o3 24s ease-in-out infinite alternate}
#o4{width:52%;height:46%;background:radial-gradient(ellipse,rgba(54,18,4,.22) 0%,transparent 70%);bottom:-4%;left:4%;filter:blur(${b4}px);animation:o4 42s ease-in-out infinite alternate}
@keyframes o1{0%{transform:translate(0,0) scale(1)}33%{transform:translate(9%,13%) scale(1.09)}66%{transform:translate(-6%,5%) scale(.95)}100%{transform:translate(13%,-9%) scale(1.05)}}
@keyframes o2{0%{transform:translate(0,0) scale(1)}40%{transform:translate(-11%,-9%) scale(1.11)}70%{transform:translate(6%,-13%) scale(.94)}100%{transform:translate(-9%,11%) scale(1.07)}}
@keyframes o3{0%{transform:translate(0,0) scale(1)}50%{transform:translate(7%,9%) scale(1.16)}100%{transform:translate(-9%,-6%) scale(.91)}}
@keyframes o4{0%{transform:translate(0,0)}50%{transform:translate(16%,-11%)}100%{transform:translate(-6%,9%)}}
@keyframes tscroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.noise{position:absolute;inset:0;opacity:.022;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:256px 256px;pointer-events:none}
</style>
</head>
<body>
<div id="w">
  <div class="o" id="o1"></div>
  <div class="o" id="o2"></div>
  <div class="o" id="o3"></div>
  <div class="o" id="o4"></div>
  <div class="noise"></div>
${elHtml}${tickerHtml}
</div>
</body>
</html>`
  }, [curScreen, curRes, getElements, logos, tickerState])

  const value: ControlContextType = {
    curScreen, curRes, curMod, scState, selId,
    logos, ltState, tickerState, themeState,
    scale, gridOn, toastMsg,
    setCurMod, switchScreen, switchRes,
    getElements, getElement, setSelId,
    updateElement, toggleElementVisibility,
    pushUndo, undo, resetScreen,
    setLogo,
    setLtState, pushLtState,
    setTickerState, pushTickerState,
    setThemeState, pushThemeState,
    lottieSettings, setLottieSettings, pushLottieSettings, pushScreenPreset,
    setScale, setGridOn,
    showToast, buildExport,
    ltTimerDuration, setLtTimerDuration,
  }

  return <ControlContext.Provider value={value}>{children}</ControlContext.Provider>
}
