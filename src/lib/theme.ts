import type { ThemeState } from '../types'

export function applyThemeVars(theme: ThemeState) {
  const root = document.documentElement
  root.style.setProperty('--accent', theme.accentCol)
  root.style.setProperty('--accent2', adjustColor(theme.accentCol, -30))

  const i = theme.orangeIntensity / 100
  const orb3 = document.getElementById('orb3')
  const orb4 = document.getElementById('orb4')
  const orb1 = document.getElementById('orb1')
  if (orb3) orb3.style.opacity = String(0.25 + i * 0.75)
  if (orb4) orb4.style.opacity = String(0.18 + i * 0.65)
  if (orb1) orb1.style.opacity = String(0.45 + i * 0.55)

  const v = theme.animSpeed / 100
  const durations = [
    Math.round(80 - v * 72),
    Math.round(92 - v * 82),
    Math.round(62 - v * 54),
    Math.round(104 - v * 94),
  ]
  ;['orb1', 'orb2', 'orb3', 'orb4'].forEach((id, idx) => {
    const el = document.getElementById(id)
    if (el) el.style.animationDuration = `${durations[idx]}s`
  })

  const bgL = Math.round(8 + (100 - theme.darkness) * 0.12)
  const bgEl = document.getElementById('bg-layer')
  if (bgEl) {
    bgEl.style.background = `rgb(${bgL},${Math.round(bgL * 0.6)},${Math.round(bgL * 0.25)})`
  }
}

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, Math.min(255, (num >> 16) + amount))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount))
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount))
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
}

export function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}
