export type ElementType = 'logo' | 'text' | 'meta'
export type ScreenId = 'welcome'

export interface ScreenPresetEntry {
  id: string
  name: string
  lottie: LottieSettings
}
export type ResId = '1080' | '4k'
export type ModuleId = 'screens' | 'speaker' | 'lowerthird' | 'ticker' | 'health' | 'streamhealth'

export interface ScreenElement {
  id: string
  type: ElementType
  cls?: string
  x: number
  y: number
  w?: number
  h?: number
  visible: boolean
  text?: string
  text1?: string
  text2?: string
  fontSize?: number
  color?: string
  opacity?: number
  letterSpacing?: number
  slot?: 'tl' | 'tr'
}

export interface LowerThirdState {
  visible: boolean
  name: string
  title: string
  accentCol: string
  nameCol: string
  titleCol: string
  bgOp: number
  barWidth: number
  nameSz: number
  titleSz: number
  xOff: number
  yOff: number
  pad: number
  panelBg: string
  uppercase: 'none' | 'uppercase'
  logo?: string | null
  nameFont?: string
  titleFont?: string
}

export interface TickerState {
  visible: boolean
  items: string[]
  badge: string
  speed: number
  fontSize: number
  bgOp: number
  textCol: string
  badgeCol: string
  height: number
  uppercase: boolean
  itemFont?: string
  badgeFont?: string
  badgeFontSize?: number
  letterSpacing?: number
}

export interface ThemeState {
  accentCol: string
  orangeIntensity: number
  darkness: number
  animSpeed: number
  ltDarkness: number
  tickerDarkness: number
}

export interface ScreenPresetData {
  elements: ScreenElement[]
  logoTl?: string | null
  logoTr?: string | null
  screen: ScreenId
  res: ResId
}

export interface LTPresetData {
  name: string
  title: string
  nameSz: number
  titleSz: number
  nameCol: string
  titleCol: string
  accentCol: string
  bgOp: number
  barWidth: number
  xOff: number
  yOff: number
  pad: number
  panelBg: string
  uppercase: 'none' | 'uppercase'
  nameFont?: string
  titleFont?: string
}

export interface TickerPresetData {
  items: string[]
  badge: string
  speed: number
  fontSize: number
  bgOp: number
  textCol: string
  badgeCol: string
  height: number
}

export interface ThemePresetData extends ThemeState {
  name?: string
}

export interface LottieTextLayer {
  text: string
  color: string
  size: number
  fontFamily?: string
  fontWeight?: number
  letterSpacing?: number
  uppercase?: boolean
  x?: number
  y?: number
}

export interface LottieBarSettings {
  visible: boolean
  x: number
  y: number
  width: number
  height: number
  color: string
  opacity: number
  radius: number
}

export interface LogoLayer {
  src: string
  x: number
  y: number
  w: number
  h: number
}

export interface LottieSettings {
  headline: LottieTextLayer
  eventName: LottieTextLayer
  eventDesc: LottieTextLayer
  moreInfo: LottieTextLayer
  bar: LottieBarSettings
  logoTl?: LogoLayer | null
  logoTr?: LogoLayer | null
}

export interface SpeakerSettings {
  title: string       // event/sermon title
  speaker: string     // speaker name
  location: string    // church/location
  logo?: string | null
}
