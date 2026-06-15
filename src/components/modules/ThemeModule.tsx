import { useState, useEffect } from 'react'
import type { ThemeState, ThemePresetData } from '../../types'
import { useControl } from '../../pages/control/ControlContext'
import { applyThemeVars } from '../../lib/theme'

// ── Shared helpers ──────────────────────────────────────────────────────────

function CtrlCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ctrl-card">
      <div className="ctrl-card-head">{title}</div>
      {children}
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="ctrl-field">
      <span className="ctrl-label">{label}</span>
      <label className="ctrl-swatch" style={{ background: value }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)} />
      </label>
      <span className="ctrl-hex">{value.toUpperCase()}</span>
    </div>
  )
}

function SliderField({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <div className="ctrl-field">
      <span className="ctrl-label">{label}</span>
      <div className="ctrl-slider-wrap">
        <input type="range" className="ctrl-slider" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)} />
        <span className="ctrl-val">{value}</span>
      </div>
    </div>
  )
}

// ── Preset helpers ──────────────────────────────────────────────────────────

function loadPresets(key: string): Record<string, ThemePresetData> {
  try { return JSON.parse(localStorage.getItem(`shofar_preset_${key}`) ?? '{}') } catch { return {} }
}
function savePresets(key: string, data: Record<string, ThemePresetData>) {
  try { localStorage.setItem(`shofar_preset_${key}`, JSON.stringify(data)) } catch { /* noop */ }
}

// ── Main controls component ─────────────────────────────────────────────────

export function ThemeControls() {
  const ctrl = useControl()
  const { themeState, setThemeState, pushThemeState, showToast } = ctrl

  const [presetName, setPresetName] = useState('')
  const [presets, setPresets] = useState(() => loadPresets('theme'))
  const [loadedPreset, setLoadedPreset] = useState('')

  const update = (patch: Partial<ThemeState>) => {
    const next = { ...themeState, ...patch }
    setThemeState(next)
    pushThemeState(next)
    applyThemeVars(next)
  }

  useEffect(() => {
    applyThemeVars(themeState)
  }, [])

  const savePreset = () => {
    if (!presetName.trim()) return
    const data = loadPresets('theme')
    data[presetName] = { ...themeState }
    savePresets('theme', data)
    setPresets(data)
    setPresetName('')
    showToast(`Saved: ${presetName}`)
  }

  const loadPreset = (name: string) => {
    const data = loadPresets('theme')
    const p = data[name]
    if (!p) return
    const next = { ...themeState, ...p }
    setThemeState(next)
    pushThemeState(next)
    applyThemeVars(next)
    setLoadedPreset(name)
    showToast(`Loaded: ${name}`)
  }

  const deletePreset = (name: string) => {
    const data = loadPresets('theme')
    delete data[name]
    savePresets('theme', data)
    setPresets(data)
    if (loadedPreset === name) setLoadedPreset('')
  }

  const bgL = Math.round(8 + (100 - themeState.darkness) * 0.12)
  const swatches = [
    { label: 'Accent',      color: themeState.accentCol },
    { label: 'Background',  color: `rgb(${bgL},${Math.round(bgL * 0.6)},${Math.round(bgL * 0.25)})` },
    { label: 'Lower third', color: `rgba(10,8,6,${themeState.ltDarkness / 100})` },
    { label: 'Ticker',      color: `rgba(10,8,6,${themeState.tickerDarkness / 100})` },
  ]

  return (
    <div className="ctrl-cards">
      {/* Screen theme */}
      <CtrlCard title="Screen Theme">
        <SliderField label="Orange intensity" min={0} max={100} value={themeState.orangeIntensity} onChange={v => update({ orangeIntensity: v })} />
        <SliderField label="Darkness" min={0} max={100} value={themeState.darkness} onChange={v => update({ darkness: v })} />
        <SliderField label="Anim speed" min={5} max={100} value={themeState.animSpeed} onChange={v => update({ animSpeed: v })} />
        <ColorField label="Accent colour" value={themeState.accentCol} onChange={v => update({ accentCol: v })} />
      </CtrlCard>

      {/* Overlay */}
      <CtrlCard title="Overlay Opacity">
        <SliderField label="LT darkness" min={0} max={100} value={themeState.ltDarkness} onChange={v => update({ ltDarkness: v })} />
        <SliderField label="Ticker darkness" min={0} max={100} value={themeState.tickerDarkness} onChange={v => update({ tickerDarkness: v })} />
      </CtrlCard>

      {/* Colour preview */}
      <CtrlCard title="Colour Preview">
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {swatches.map(({ label, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 20, borderRadius: 4, background: color, border: '1px solid var(--line-2)', flexShrink: 0 }} />
              <span style={{ font: '400 12px Roboto, sans-serif', color: 'var(--text-2)' }}>{label}</span>
            </div>
          ))}
        </div>
      </CtrlCard>

      {/* Presets */}
      <CtrlCard title="Presets">
        {Object.keys(presets).length > 0 && (
          <div className="ctrl-preset-row">
            {Object.keys(presets).map(name => (
              <button
                key={name}
                className={`ctrl-preset-chip${loadedPreset === name ? ' active' : ''}`}
                onClick={() => loadPreset(name)}
              >
                {name}
                <button className="ctrl-preset-del" onClick={e => { e.stopPropagation(); deletePreset(name) }}>×</button>
              </button>
            ))}
          </div>
        )}
        <div className="ctrl-preset-save">
          <input
            className="ctrl-text-input"
            type="text"
            placeholder="Theme name…"
            value={presetName}
            onChange={e => setPresetName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && savePreset()}
          />
          <button className="ctrl-save-btn" onClick={savePreset}>Save</button>
        </div>
      </CtrlCard>
    </div>
  )
}

// Backward-compat aliases
export const ThemeLeft = ThemeControls
export function ThemeRight() { return null }
