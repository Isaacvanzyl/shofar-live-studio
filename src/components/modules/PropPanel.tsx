// Shared property-panel row primitives (rp-* CSS class system)

export const FONT_OPTIONS = [
  { group: 'Trade Gothic', options: [
    { label: 'TG Regular',                value: 'TG Regular' },
    { label: 'TG Oblique',                value: 'TG Oblique' },
    { label: 'TG Light',                  value: 'TG Light' },
    { label: 'TG Light Oblique',          value: 'TG Light Oblique' },
    { label: 'TG Bold',                   value: 'TG Bold' },
    { label: 'TG Bold Oblique',           value: 'TG Bold Oblique' },
    { label: 'TG Bold Two',               value: 'TG Bold Two' },
    { label: 'TG Bold Two Oblique',       value: 'TG Bold Two Oblique' },
    { label: 'TG Condensed',              value: 'TG Condensed' },
    { label: 'TG Condensed Oblique',      value: 'TG Condensed Oblique' },
    { label: 'TG Bold Condensed',         value: 'TG Bold Condensed' },
    { label: 'TG Bold Condensed Oblique', value: 'TG Bold Condensed Oblique' },
    { label: 'TG Extended',               value: 'TG Extended' },
    { label: 'TG Bold Extended',          value: 'TG Bold Extended' },
  ]},
  { group: 'Barlow', options: [
    { label: 'Barlow Condensed', value: "'Barlow Condensed', sans-serif" },
    { label: 'Barlow',           value: "'Barlow', sans-serif" },
  ]},
]

// ── Pill tabs ──────────────────────────────────────────────────────────────

interface Tab { key: string; label: string }
export function PillTabs({ tabs, active, onChange }: { tabs: Tab[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="rp-tabs">
      {tabs.map(t => (
        <button key={t.key} className={`rp-tab${active === t.key ? ' on' : ''}`} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────

export function Section({ title }: { title: string }) {
  return <div className="rp-section">{title}</div>
}

// ── Base row ───────────────────────────────────────────────────────────────

export function Row({ label, children, tall }: { label: string; children: React.ReactNode; tall?: boolean }) {
  return (
    <div className={`rp-row${tall ? ' tall' : ''}`}>
      <span className="rp-label">{label}</span>
      <div className="rp-control">{children}</div>
    </div>
  )
}

// ── Textarea row ───────────────────────────────────────────────────────────

export function TextareaRow({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <Row label={label} tall>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        {hint && <span className="rp-hint">{hint}</span>}
        <textarea className="rp-textarea" value={value} onChange={e => onChange(e.target.value)} rows={2} />
      </div>
    </Row>
  )
}

// ── Text input row ─────────────────────────────────────────────────────────

export function TextRow({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Row label={label}>
      <input className="rp-input" type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </Row>
  )
}

// ── Color row ──────────────────────────────────────────────────────────────

export function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Row label={label}>
      <label className="rp-swatch" style={{ background: value }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)} />
      </label>
      <input
        className="rp-hex"
        type="text"
        value={value}
        onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onChange(e.target.value) }}
      />
    </Row>
  )
}

// ── Font select row ────────────────────────────────────────────────────────

export function FontRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Row label={label}>
      <select className="rp-select" style={{ fontFamily: value }} value={value} onChange={e => onChange(e.target.value)}>
        {FONT_OPTIONS.map(g => (
          <optgroup key={g.group} label={g.group}>
            {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
        ))}
      </select>
    </Row>
  )
}

// ── Weight select row ──────────────────────────────────────────────────────

export function WeightRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Row label={label}>
      <select className="rp-select" value={value} onChange={e => onChange(+e.target.value)}>
        {[100,200,300,400,500,600,700,800,900].map(w => <option key={w} value={w}>{w}</option>)}
      </select>
    </Row>
  )
}

// ── Slider + number row ────────────────────────────────────────────────────

export function SliderRow({ label, min, max, value, onChange, step = 1 }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <Row label={label}>
      <input className="rp-slider" type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} />
      <input className="rp-num" type="number" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} />
    </Row>
  )
}

// ── Toggle row ─────────────────────────────────────────────────────────────

export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row label={label}>
      <label className="rp-toggle">
        <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />
        <span className="rp-track" />
        <span className="rp-thumb" />
      </label>
    </Row>
  )
}
