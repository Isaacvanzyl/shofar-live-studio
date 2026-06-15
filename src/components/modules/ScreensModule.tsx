import { useState, useEffect, useRef, useCallback } from 'react'
import type React from 'react'
import type { LottieSettings, LottieTextLayer, LottieBarSettings, ScreenPresetEntry, LogoLayer } from '../../types'
import { useControl } from '../../pages/control/ControlContext'
import { PillTabs, Section, ColorRow, FontRow, WeightRow, SliderRow, ToggleRow, TextareaRow } from './PropPanel'

const PRESETS_KEY = 'shofar_screen_presets_v2'

function nameToId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function loadPresets(): ScreenPresetEntry[] {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]') } catch { return [] }
}
function savePresets(list: ScreenPresetEntry[]) {
  try { localStorage.setItem(PRESETS_KEY, JSON.stringify(list)) } catch { /* noop */ }
}

const LAYER_DEFAULTS: Record<string, { x: number; y: number }> = {
  headline:  { x: 124, y: 353 },
  eventDesc: { x: 124, y: 605 },
  eventName: { x: 131, y: 959 },
  moreInfo:  { x: 1812, y: 75 },
}

const LAYER_TABS = [
  { key: 'headline',  label: 'Headline' },
  { key: 'eventName', label: 'Event' },
  { key: 'eventDesc', label: 'Desc' },
  { key: 'moreInfo',  label: 'More' },
  { key: '_bar',      label: 'Bar' },
  { key: '_logo',     label: 'Logo' },
]

// ── Welcome editor ────────────────────────────────────────────────────────────

interface WelcomeEditorProps {
  settings: LottieSettings
  onPush: (s: LottieSettings) => void
}

const LOGO_DEFAULTS = {
  tl: { x: 54,   y: 38, w: 130, h: 80 },
  tr: { x: 1736, y: 38, w: 130, h: 80 },
}

function LogoUploadSlot({ label, side, value, onChange }: { label: string; side: 'tl' | 'tr'; value?: LogoLayer | null; onChange: (v: LogoLayer | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const read = (files: FileList | null) => {
    if (!files?.[0]) return
    const reader = new FileReader()
    reader.onload = e => {
      const src = e.target?.result as string
      const def = LOGO_DEFAULTS[side]
      onChange({ src, x: def.x, y: def.y, w: def.w, h: def.h })
    }
    reader.readAsDataURL(files[0])
  }
  const update = (patch: Partial<LogoLayer>) => value && onChange({ ...value, ...patch })
  return (
    <>
      <div className="rp-row">
        <span className="rp-label">{label}</span>
        <div className="rp-control">
          <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => read(e.target.files)} />
          {value ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <img src={value.src} alt="" style={{ height: 28, maxWidth: 80, objectFit: 'contain', borderRadius: 3, border: '1px solid var(--line)' }} />
              <button onClick={() => ref.current?.click()} className="rp-btn-sm">Change</button>
              <button onClick={() => onChange(null)} className="rp-btn-sm">Remove</button>
            </div>
          ) : (
            <button onClick={() => ref.current?.click()} className="rp-btn-sm">Upload</button>
          )}
        </div>
      </div>
      {value && (
        <>
          <SliderRow label="X" min={0} max={1820} value={value.x} onChange={v => update({ x: v })} />
          <SliderRow label="Y" min={0} max={1000} value={value.y} onChange={v => update({ y: v })} />
          <SliderRow label="Width"  min={20} max={600} value={value.w} onChange={v => update({ w: v })} />
          <SliderRow label="Height" min={20} max={400} value={value.h} onChange={v => update({ h: v })} />
        </>
      )}
    </>
  )
}

function WelcomeEditor({ settings, onPush }: WelcomeEditorProps) {
  const [activeTab, setActiveTab] = useState<string>('headline')

  type TextLayerKey = 'headline' | 'eventName' | 'eventDesc' | 'moreInfo'
  const updateLayer = (key: TextLayerKey, patch: Partial<LottieTextLayer>) => {
    onPush({ ...settings, [key]: { ...settings[key], ...patch } })
  }
  const updateBar = (patch: Partial<LottieBarSettings>) =>
    onPush({ ...settings, bar: { ...settings.bar, ...patch } })

  const bar = settings.bar
  const isTextTab = activeTab !== '_bar' && activeTab !== '_logo'
  const isBarTab = activeTab === '_bar'
  const isLogoTab = activeTab === '_logo'
  const layerKey = activeTab as TextLayerKey
  const layer = isTextTab ? settings[layerKey] as LottieTextLayer : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <PillTabs tabs={LAYER_TABS} active={activeTab} onChange={setActiveTab} />

      {isTextTab && layer && (
        <>
          <Section title="Content" />
          <TextareaRow
            label="Text"
            value={layer.text.replace(/\r/g, '\n')}
            onChange={v => updateLayer(layerKey, { text: v.replace(/\n/g, '\r') })}
            hint={layerKey === 'headline' ? 'Enter = new line' : undefined}
          />
          <Section title="Typography" />
          <FontRow label="Font" value={layer.fontFamily ?? (layerKey === 'headline' ? "'Barlow Condensed', sans-serif" : "'Barlow', sans-serif")} onChange={v => updateLayer(layerKey, { fontFamily: v })} />
          <WeightRow label="Weight" value={layer.fontWeight ?? (layerKey === 'headline' ? 900 : layerKey === 'eventDesc' ? 300 : 800)} onChange={v => updateLayer(layerKey, { fontWeight: v })} />
          <SliderRow label="Size" min={8} max={300} value={layer.size} onChange={v => updateLayer(layerKey, { size: v })} />
          <SliderRow label="Spacing" min={-5} max={30} value={layer.letterSpacing ?? 0} onChange={v => updateLayer(layerKey, { letterSpacing: v })} />
          <ColorRow label="Colour" value={layer.color} onChange={v => updateLayer(layerKey, { color: v })} />
          <ToggleRow label="All caps" value={layer.uppercase ?? false} onChange={v => updateLayer(layerKey, { uppercase: v })} />
          <Section title="Position" />
          <SliderRow label="X" min={0} max={1900} value={layer.x ?? LAYER_DEFAULTS[activeTab]?.x ?? 0} onChange={v => updateLayer(layerKey, { x: v })} />
          <SliderRow label="Y" min={0} max={1070} value={layer.y ?? LAYER_DEFAULTS[activeTab]?.y ?? 0} onChange={v => updateLayer(layerKey, { y: v })} />
        </>
      )}

      {isBarTab && (
        <>
          <Section title="Appearance" />
          <ToggleRow label="Visible" value={bar.visible} onChange={v => updateBar({ visible: v })} />
          <ColorRow label="Colour" value={bar.color} onChange={v => updateBar({ color: v })} />
          <SliderRow label="Opacity" min={0} max={100} value={Math.round(bar.opacity * 100)} onChange={v => updateBar({ opacity: v / 100 })} />
          <Section title="Size" />
          <SliderRow label="Width" min={10} max={1820} value={bar.width} onChange={v => updateBar({ width: v })} />
          <SliderRow label="Height" min={1} max={120} value={bar.height} onChange={v => updateBar({ height: v })} />
          <SliderRow label="Radius" min={0} max={60} value={bar.radius} onChange={v => updateBar({ radius: v })} />
          <Section title="Position" />
          <SliderRow label="X" min={0} max={1910} value={bar.x} onChange={v => updateBar({ x: v })} />
          <SliderRow label="Y" min={0} max={1070} value={bar.y} onChange={v => updateBar({ y: v })} />
        </>
      )}

      {isLogoTab && (
        <>
          <Section title="Left Logo" />
          <LogoUploadSlot label="Image" side="tl" value={settings.logoTl} onChange={v => onPush({ ...settings, logoTl: v })} />
          <Section title="Right Logo" />
          <LogoUploadSlot label="Image" side="tr" value={settings.logoTr} onChange={v => onPush({ ...settings, logoTr: v })} />
        </>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ScreensLeft() { return null }

export function ScreensRight({ initialPresetId = null, onDirtyChange, onSaveRef }: { initialPresetId?: string | null; onDirtyChange?: (dirty: boolean) => void; onSaveRef?: React.MutableRefObject<(() => void) | null> }) {
  const { lottieSettings, setLottieSettings, pushLottieSettings, pushScreenPreset, showToast } = useControl()

  const [presets, setPresets] = useState<ScreenPresetEntry[]>(loadPresets)
  const [activeId, setActiveId] = useState<string | null>(initialPresetId)
  const [dirty, setDirty] = useState(false)

  // For custom screens, keep edits in local state so they don't bleed into Welcome
  const [customSettings, setCustomSettings] = useState<LottieSettings | null>(() => {
    if (initialPresetId === null) return null
    return loadPresets().find(x => x.id === initialPresetId)?.lottie ?? null
  })

  // The settings actually being edited right now
  const activeSettings = activeId === null ? lottieSettings : (customSettings ?? lottieSettings)

  const markDirty = useCallback((v: boolean) => { setDirty(v); onDirtyChange?.(v) }, [onDirtyChange])

  // On mount, load the initial preset's content if one was specified
  useEffect(() => {
    if (initialPresetId !== null) {
      const p = loadPresets().find(x => x.id === initialPresetId)
      if (p) {
        setCustomSettings(p.lottie)
        pushScreenPreset(p.id, p.lottie)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [newName, setNewName] = useState('')
  const [presetsOpen, setPresetsOpen] = useState(true)

  const activeName = activeId === null ? 'Welcome (Default)' : (presets.find(p => p.id === activeId)?.name ?? activeId)

  // Edits push live to Supabase and update context so PreviewCanvas reflects changes
  const handlePush = (s: LottieSettings) => {
    markDirty(true)
    if (activeId === null) {
      setLottieSettings(s)
      pushLottieSettings(s)
    } else {
      setCustomSettings(s)
      setLottieSettings(s)   // drive PreviewCanvas live
      pushScreenPreset(activeId, s)
    }
  }

  const loadPreset = (p: ScreenPresetEntry) => {
    setActiveId(p.id)
    setCustomSettings(p.lottie)
    pushScreenPreset(p.id, p.lottie)
    markDirty(false)
    showToast(`Loaded: ${p.name}`)
  }

  const loadDefault = () => {
    setActiveId(null)
    setCustomSettings(null)
    pushLottieSettings(lottieSettings)
    markDirty(false)
    showToast('Editing default welcome')
  }

  // Save = update current preset in localStorage
  const saveCurrent = () => {
    if (activeId === null) {
      markDirty(false)
      showToast('Default welcome saved')
      return
    }
    const updated = presets.map(p => p.id === activeId ? { ...p, lottie: activeSettings } : p)
    setPresets(updated)
    savePresets(updated)
    markDirty(false)
    showToast(`Saved: ${activeName}`)
  }

  // Keep parent editor's saveRef in sync
  useEffect(() => { if (onSaveRef) onSaveRef.current = saveCurrent })

  // Save as = create new preset from current content
  const saveAsNew = () => {
    if (!newName.trim()) return
    const id = nameToId(newName)
    if (presets.find(p => p.id === id)) { showToast('Name already exists'); return }
    const entry: ScreenPresetEntry = { id, name: newName.trim(), lottie: activeSettings }
    const updated = [...presets, entry]
    setPresets(updated)
    savePresets(updated)
    setActiveId(id)
    pushScreenPreset(id, activeSettings)
    markDirty(false)
    setNewName('')
    showToast(`Saved as: ${newName.trim()}`)
  }

  const deletePreset = (id: string) => {
    const updated = presets.filter(p => p.id !== id)
    setPresets(updated)
    savePresets(updated)
    if (activeId === id) { setActiveId(null); markDirty(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>

      {/* Screens / presets section */}
      <div>
        <button
          className={`rp-accordion-hd${presetsOpen ? ' open' : ''}`}
          onClick={() => setPresetsOpen(o => !o)}
        >
          <span>
            Screens
            <span style={{ fontWeight: 400, opacity: .7, marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
              — {activeName}{dirty ? ' •' : ''}
            </span>
          </span>
          <span className="rp-acc-arrow">▾</span>
        </button>

        {presetsOpen && (
          <div className="rp-accordion-body">
            {/* Screen chips */}
            <div style={{ padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  background: activeId === null ? 'var(--accent)' : 'var(--card)',
                  color: activeId === null ? '#fff' : 'var(--text)',
                  border: `1px solid ${activeId === null ? 'var(--accent)' : 'var(--line-2)'}`,
                  borderRadius: 6, padding: '4px 9px', fontSize: 11, cursor: 'pointer',
                }}
                onClick={loadDefault}
              >
                Welcome (Default)
              </div>
              {presets.map(p => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    background: activeId === p.id ? 'var(--accent)' : 'var(--card)',
                    color: activeId === p.id ? '#fff' : 'var(--text)',
                    border: `1px solid ${activeId === p.id ? 'var(--accent)' : 'var(--line-2)'}`,
                    borderRadius: 6, padding: '4px 7px 4px 9px', fontSize: 11, cursor: 'pointer',
                  }}
                  onClick={() => loadPreset(p)}
                >
                  {p.name}
                  <button
                    onClick={e => { e.stopPropagation(); deletePreset(p.id) }}
                    style={{ background: 'none', border: 'none', color: 'inherit', opacity: .5, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px', marginLeft: 2 }}
                  >×</button>
                </div>
              ))}
            </div>

            {/* Save current */}
            {dirty && (
              <div className="rp-row" style={{ borderTop: '1px solid var(--line)' }}>
                <span className="rp-label" style={{ color: 'var(--accent)' }}>Unsaved</span>
                <div className="rp-control" style={{ gap: 5 }}>
                  <button onClick={saveCurrent} className="rp-btn-primary" style={{ flex: 1 }}>
                    Save "{activeName}"
                  </button>
                </div>
              </div>
            )}

            {/* Save as new */}
            <div className="rp-row">
              <span className="rp-label">Save as</span>
              <div className="rp-control" style={{ gap: 5 }}>
                <input
                  className="rp-input"
                  type="text"
                  placeholder="New screen name…"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveAsNew()}
                  style={{ flex: 1 }}
                />
                <button onClick={saveAsNew} className="rp-btn-primary">Save as</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Welcome editor */}
      <WelcomeEditor settings={activeSettings} onPush={handlePush} />

    </div>
  )
}
