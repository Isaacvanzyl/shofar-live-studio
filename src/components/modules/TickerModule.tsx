import { useState } from 'react'
import type { TickerState, TickerPresetData } from '../../types'
import { useControl } from '../../pages/control/ControlContext'
import { Section, TextareaRow, ColorRow, FontRow, SliderRow, ToggleRow, TextRow } from './PropPanel'

// ── Preset helpers ──────────────────────────────────────────────────────────

function loadPresets(key: string): Record<string, TickerPresetData> {
  try { return JSON.parse(localStorage.getItem(`shofar_preset_${key}`) ?? '{}') } catch { return {} }
}
function savePresets(key: string, data: Record<string, TickerPresetData>) {
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

export function TickerControls() {
  const ctrl = useControl()
  const { tickerState, setTickerState, pushTickerState, showToast } = ctrl

  const [presetsOpen, setPresetsOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presets, setPresets] = useState(() => loadPresets('ticker'))
  const [loadedPreset, setLoadedPreset] = useState('')

  const update = (patch: Partial<TickerState>) => {
    const next = { ...tickerState, ...patch }
    setTickerState(next); pushTickerState(next)
  }

  const savePreset = () => {
    if (!presetName.trim()) return
    const data = loadPresets('ticker')
    data[presetName] = {
      items: tickerState.items,
      badge: tickerState.badge,
      speed: tickerState.speed,
      fontSize: tickerState.fontSize,
      bgOp: tickerState.bgOp,
      textCol: tickerState.textCol,
      badgeCol: tickerState.badgeCol,
      height: tickerState.height,
    }
    savePresets('ticker', data)
    setPresets(data)
    setPresetName('')
    showToast(`Saved: ${presetName}`)
  }

  const loadPreset = (name: string) => {
    const data = loadPresets('ticker')
    const p = data[name]
    if (!p) return
    const next = { ...tickerState, ...p }
    setTickerState(next); pushTickerState(next)
    setLoadedPreset(name)
    showToast(`Loaded: ${name}`)
  }

  const deletePreset = (name: string) => {
    const data = loadPresets('ticker')
    delete data[name]
    savePresets('ticker', data)
    setPresets(data)
    if (loadedPreset === name) setLoadedPreset('')
  }

  const presetNames = Object.keys(presets)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>

      {/* Items */}
      <Accordion title="Items">
        <ToggleRow label="Visible" value={tickerState.visible} onChange={v => update({ visible: v })} />
        <TextareaRow label="Items" value={tickerState.items.join('\n')} onChange={v => update({ items: v.split('\n').filter(Boolean) })} hint="One item per line" />
      </Accordion>

      {/* Badge (left label) */}
      <Accordion title="Badge">
        <TextRow label="Text" value={tickerState.badge} onChange={v => update({ badge: v })} placeholder="LIVE" />
        <FontRow label="Font" value={tickerState.badgeFont ?? "'Barlow Condensed', sans-serif"} onChange={v => update({ badgeFont: v })} />
        <SliderRow label="Size" min={8} max={28} value={tickerState.badgeFontSize ?? 13} onChange={v => update({ badgeFontSize: v })} />
        <ColorRow label="Colour" value={tickerState.badgeCol} onChange={v => update({ badgeCol: v })} />
      </Accordion>

      {/* Item text */}
      <Accordion title="Text">
        <FontRow label="Font" value={tickerState.itemFont ?? "'Barlow', sans-serif"} onChange={v => update({ itemFont: v })} />
        <SliderRow label="Size" min={8} max={28} value={tickerState.fontSize} onChange={v => update({ fontSize: v })} />
        <SliderRow label="Spacing" min={-5} max={30} value={Math.round((tickerState.letterSpacing ?? 0) * 100)} onChange={v => update({ letterSpacing: v / 100 })} />
        <ColorRow label="Colour" value={tickerState.textCol} onChange={v => update({ textCol: v })} />
        <ToggleRow label="Uppercase" value={tickerState.uppercase ?? false} onChange={v => update({ uppercase: v })} />
      </Accordion>

      {/* Bar */}
      <Accordion title="Bar" defaultOpen={false}>
        {/* Style presets */}
        {(() => {
          const isLight = tickerState.textCol === '#1a1a1a'
          return (
            <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderBottom: '1px solid var(--line)' }}>
              <button className="ctrl-style-btn" style={{ flex: 1, background: '#0a0806', color: '#f0ede8', borderColor: !isLight ? '#E84F0E' : 'rgba(255,255,255,0.15)', boxShadow: !isLight ? '0 0 0 1.5px #E84F0E' : 'none' }}
                onClick={() => update({ bgOp: 90, textCol: '#f0ede8', badgeCol: '#E84F0E' })}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#E84F0E', display: 'inline-block', flexShrink: 0 }} /> Dark {!isLight && '✓'}
              </button>
              <button className="ctrl-style-btn" style={{ flex: 1, background: '#ffffff', color: '#1a1a1a', borderColor: isLight ? '#E84F0E' : 'rgba(0,0,0,0.15)', boxShadow: isLight ? '0 0 0 1.5px #E84F0E' : 'none' }}
                onClick={() => update({ bgOp: 96, textCol: '#1a1a1a', badgeCol: '#E84F0E' })}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#E84F0E', display: 'inline-block', flexShrink: 0 }} /> Light {isLight && '✓'}
              </button>
            </div>
          )
        })()}
        <ColorRow label="BG colour" value={tickerState.textCol === '#1a1a1a' ? '#ffffff' : '#0a0806'} onChange={() => {}} />
        <SliderRow label="Opacity" min={50} max={100} value={tickerState.bgOp} onChange={v => update({ bgOp: v })} />
        <SliderRow label="Height" min={28} max={80} value={tickerState.height} onChange={v => update({ height: v })} />
        <SliderRow label="Speed" min={10} max={80} value={tickerState.speed} onChange={v => update({ speed: v })} />
      </Accordion>

      {/* Presets */}
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

    </div>
  )
}

export const TickerLeft = TickerControls
export function TickerRight() { return null }
