import { useState, useRef } from 'react'
import type { LowerThirdState, LTPresetData } from '../../types'
import { useControl } from '../../pages/control/ControlContext'
import { Section, TextRow, ColorRow, FontRow, SliderRow, ToggleRow } from './PropPanel'
import PackBrowser from '../PackBrowser'
import type { PackItem } from '../../hooks/useAssignedPacks'

// ── Preset helpers ──────────────────────────────────────────────────────────

function loadPresets(key: string): Record<string, LTPresetData> {
  try { return JSON.parse(localStorage.getItem(`shofar_preset_${key}`) ?? '{}') } catch { return {} }
}
function savePresets(key: string, data: Record<string, LTPresetData>) {
  try { localStorage.setItem(`shofar_preset_${key}`, JSON.stringify(data)) } catch { /* noop */ }
}

// ── Accordion ───────────────────────────────────────────────────────────────

function Accordion({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button className={`rp-accordion-hd${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
        {title}
        <span className="rp-acc-arrow">▾</span>
      </button>
      {open && <div className="rp-accordion-body">{children}</div>}
    </div>
  )
}

// ── Main controls component ─────────────────────────────────────────────────

export function LTControls() {
  const ctrl = useControl()
  const { ltState, setLtState, pushLtState, setLogo, logos, showToast } = ctrl
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presets, setPresets] = useState(() => loadPresets('lt'))
  const [loadedPreset, setLoadedPreset] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const update = (patch: Partial<LowerThirdState>) => {
    const next = { ...ltState, ...patch }
    setLtState(next); pushLtState(next)
  }

  const savePreset = () => {
    if (!presetName.trim()) return
    const data = loadPresets('lt')
    data[presetName] = {
      name: ltState.name, title: ltState.title,
      nameSz: ltState.nameSz, titleSz: ltState.titleSz,
      nameCol: ltState.nameCol, titleCol: ltState.titleCol,
      accentCol: ltState.accentCol, bgOp: ltState.bgOp,
      barWidth: ltState.barWidth, xOff: ltState.xOff,
      yOff: ltState.yOff, pad: ltState.pad,
      panelBg: ltState.panelBg, uppercase: ltState.uppercase,
      nameFont: ltState.nameFont, titleFont: ltState.titleFont,
    }
    savePresets('lt', data)
    setPresets(data)
    setPresetName('')
    showToast(`Saved: ${presetName}`)
  }

  const loadPreset = (name: string) => {
    const data = loadPresets('lt')
    const p = data[name]
    if (!p) return
    const next = { ...ltState, ...p }
    setLtState(next); pushLtState(next)
    setLoadedPreset(name)
    showToast(`Loaded: ${name}`)
  }

  const deletePreset = (name: string) => {
    const data = loadPresets('lt')
    delete data[name]
    savePresets('lt', data)
    setPresets(data)
    if (loadedPreset === name) setLoadedPreset('')
  }

  const handleLogoUpload = (files: FileList | null) => {
    if (!files?.[0]) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setLogo('lt', result); update({ logo: result })
    }
    reader.readAsDataURL(files[0])
  }

  const presetNames = Object.keys(presets)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>

      {/* Presets — dropdown */}
      <div>
        <button className={`rp-accordion-hd${presetsOpen ? ' open' : ''}`} onClick={() => setPresetsOpen(o => !o)}>
          <span>Presets{loadedPreset ? <span style={{ fontWeight: 400, opacity: .7, marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>— {loadedPreset}</span> : null}</span>
          <span className="rp-acc-arrow">▾</span>
        </button>

        {presetsOpen && (
          <div className="rp-accordion-body">
            {presetNames.length > 0 && (
              <div style={{ padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {presetNames.map(name => (
                  <div key={name} style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    background: loadedPreset === name ? 'var(--accent)' : 'var(--card)',
                    color: loadedPreset === name ? '#fff' : 'var(--text)',
                    border: `1px solid ${loadedPreset === name ? 'var(--accent)' : 'var(--line-2)'}`,
                    borderRadius: 6, padding: '4px 7px 4px 9px', fontSize: 11, cursor: 'pointer',
                  }} onClick={() => loadPreset(name)}>
                    {name}
                    <button onClick={e => { e.stopPropagation(); deletePreset(name) }}
                      style={{ background: 'none', border: 'none', color: 'inherit', opacity: .5, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px', marginLeft: 2 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="rp-row">
              <span className="rp-label">Save as</span>
              <div className="rp-control" style={{ gap: 5 }}>
                <input className="rp-input" type="text" placeholder="Preset name…" value={presetName}
                  onChange={e => setPresetName(e.target.value)} onKeyDown={e => e.key === 'Enter' && savePreset()} style={{ flex: 1 }} />
                <button onClick={savePreset} className="rp-btn-primary">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pack Browser */}
      <div style={{ padding: '8px 8px 0' }}>
        <PackBrowser
          type="lowerthird"
          onAddToMyPresets={(item: PackItem, packName: string) => {
            const data = loadPresets('lt')
            const key = `[Pack] ${packName} — ${item.name}`
            data[key] = item.data as unknown as LTPresetData
            savePresets('lt', data)
            setPresets({ ...data })
            showToast(`Added: ${key}`)
          }}
        />
      </div>

      <Accordion title="Name">
        <TextRow label="Name" value={ltState.name} onChange={v => update({ name: v })} placeholder="Speaker name" />
        <ToggleRow label="Uppercase" value={ltState.uppercase === 'uppercase'} onChange={v => update({ uppercase: v ? 'uppercase' : 'none' })} />
        <FontRow label="Font" value={ltState.nameFont ?? "'Barlow Condensed', sans-serif"} onChange={v => update({ nameFont: v })} />
        <SliderRow label="Size" min={24} max={120} value={ltState.nameSz} onChange={v => update({ nameSz: v })} />
        <ColorRow label="Colour" value={ltState.nameCol} onChange={v => update({ nameCol: v })} />
      </Accordion>

      <Accordion title="Title">
        <TextRow label="Title" value={ltState.title} onChange={v => update({ title: v })} placeholder="Role or title" />
        <FontRow label="Font" value={ltState.titleFont ?? "'Barlow', sans-serif"} onChange={v => update({ titleFont: v })} />
        <SliderRow label="Size" min={14} max={80} value={ltState.titleSz} onChange={v => update({ titleSz: v })} />
        <ColorRow label="Colour" value={ltState.titleCol} onChange={v => update({ titleCol: v })} />
      </Accordion>

      <Accordion title="Panel" defaultOpen={false}>
        {/* Style presets */}
        {(() => {
          const isDark = ltState.panelBg !== '#ffffff'
          return (
            <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
              <button className="ctrl-style-btn" style={{ flex: 1, background: '#120d09', color: '#f4ede6', borderColor: isDark ? '#E84F0E' : 'rgba(255,255,255,0.15)', boxShadow: isDark ? '0 0 0 1.5px #E84F0E' : 'none' }}
                onClick={() => update({ panelBg: '#120d09', bgOp: 94, nameCol: '#f4ede6', titleCol: '#E84F0E', accentCol: '#E84F0E' })}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#E84F0E', display: 'inline-block', flexShrink: 0 }} /> Dark {isDark && '✓'}
              </button>
              <button className="ctrl-style-btn" style={{ flex: 1, background: '#ffffff', color: '#1a1a1a', borderColor: !isDark ? '#E84F0E' : 'rgba(0,0,0,0.15)', boxShadow: !isDark ? '0 0 0 1.5px #E84F0E' : 'none' }}
                onClick={() => update({ panelBg: '#ffffff', bgOp: 96, nameCol: '#1a1a1a', titleCol: '#E84F0E', accentCol: '#E84F0E' })}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#E84F0E', display: 'inline-block', flexShrink: 0 }} /> Light {!isDark && '✓'}
              </button>
            </div>
          )
        })()}
        <ColorRow label="BG" value={ltState.panelBg} onChange={v => update({ panelBg: v })} />
        <SliderRow label="Opacity" min={50} max={100} value={ltState.bgOp} onChange={v => update({ bgOp: v })} />
        <SliderRow label="Padding" min={8} max={48} value={ltState.pad} onChange={v => update({ pad: v })} />
        <Section title="Accent bar" />
        <ColorRow label="Colour" value={ltState.accentCol} onChange={v => update({ accentCol: v })} />
        <SliderRow label="Width" min={4} max={24} value={ltState.barWidth} onChange={v => update({ barWidth: v })} />
        <Section title="Logo" />
        <div className="rp-row">
          <span className="rp-label">Image</span>
          <div className="rp-control">
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleLogoUpload(e.target.files)} />
            {logos.lt ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <img src={logos.lt} alt="" style={{ height: 28, maxWidth: 80, objectFit: 'contain', borderRadius: 3, border: '1px solid var(--line)' }} />
                <button onClick={() => { setLogo('lt', null); update({ logo: null }) }} className="rp-btn-sm">Remove</button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} className="rp-btn-sm">Upload</button>
            )}
          </div>
        </div>
      </Accordion>

      <Accordion title="Position" defaultOpen={false}>
        <SliderRow label="Left" min={0} max={400} value={ltState.xOff} onChange={v => update({ xOff: v })} />
        <SliderRow label="Bottom" min={-200} max={400} value={ltState.yOff} onChange={v => update({ yOff: v })} />
      </Accordion>

    </div>
  )
}

export const LowerThirdLeft = LTControls
export function LowerThirdRight() { return null }
