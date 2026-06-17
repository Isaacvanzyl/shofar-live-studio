import React, { useState, useEffect, useCallback, useRef } from 'react'
import './calendar.css'
import type { CalendarFeed, CalEvent, ViewMode } from './types'
import { parseIcs } from './icsParser'

// ── Constants ──────────────────────────────────────────────────────────────
const HOUR_START = 8
const HOUR_END = 22
const SLOT_COUNT = (HOUR_END - HOUR_START) * 2 // 28 half-hour slots
const SLOT_HEIGHT = 40 // px per slot
const GRID_HEIGHT = SLOT_COUNT * SLOT_HEIGHT // 1120px
const COL_HEADER_HEIGHT = 48 // px

const PASSWORD = import.meta.env.VITE_CALENDAR_PASSWORD ?? 'shofar2024'
const SESSION_KEY = 'cal_unlocked'
const STORAGE_KEY = 'cal_feeds'
const REFRESH_MS = 5 * 60 * 1000

const DEFAULT_COLORS = [
  '#5b6af0', '#e05c7a', '#38c99e', '#f0a030', '#a46af0',
  '#3ab5d8', '#e07850', '#70c060',
]

function randomColor(): string {
  return DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]
}

function uid(): string {
  return Math.random().toString(36).slice(2)
}

// ── Date helpers ──────────────────────────────────────────────────────────
function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function getMonday(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay()
  const diff = day === 0 ? -6 : 1 - day
  r.setDate(r.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

// ── Time-to-pixel ─────────────────────────────────────────────────────────
function timeToY(date: Date): number {
  const h = date.getHours() + date.getMinutes() / 60
  return (h - HOUR_START) * (SLOT_HEIGHT * 2)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// ── ICS fetching ──────────────────────────────────────────────────────────
async function fetchFeedEvents(feed: CalendarFeed): Promise<CalEvent[]> {
  const proxyUrl = `/api/ics-proxy?url=${encodeURIComponent(feed.icsUrl)}`
  const res = await fetch(proxyUrl)
  if (!res.ok) return []
  const text = await res.text()
  const raw = parseIcs(text)
  return raw.map(e => ({ ...e, calendarId: feed.id, color: feed.color }))
}

// ── Password gate ─────────────────────────────────────────────────────────
function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  function attempt() {
    if (value === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1')
      onUnlock()
    } else {
      setError(true)
      setValue('')
    }
  }

  return (
    <div className="cal-gate">
      <div className="cal-gate-card">
        <div className="cal-gate-title">Venue Calendar</div>
        <input
          className="cal-gate-input"
          type="password"
          placeholder="Password"
          value={value}
          onChange={e => { setValue(e.target.value); setError(false) }}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          autoFocus
        />
        <button className="cal-gate-btn" onClick={attempt}>Unlock</button>
        {error && <div className="cal-gate-error">Incorrect password</div>}
      </div>
    </div>
  )
}

// ── Settings panel ────────────────────────────────────────────────────────
interface PanelProps {
  feeds: CalendarFeed[]
  onClose: () => void
  onChange: (feeds: CalendarFeed[]) => void
}

function SettingsPanel({ feeds, onClose, onChange }: PanelProps) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [color, setColor] = useState(randomColor())
  const [editId, setEditId] = useState<string | null>(null)

  function startEdit(feed: CalendarFeed) {
    setEditId(feed.id)
    setName(feed.name)
    setUrl(feed.icsUrl)
    setColor(feed.color)
  }

  function cancelEdit() {
    setEditId(null)
    setName('')
    setUrl('')
    setColor(randomColor())
  }

  function save() {
    if (!name.trim() || !url.trim()) return
    if (editId) {
      onChange(feeds.map(f => f.id === editId ? { ...f, name: name.trim(), icsUrl: url.trim(), color } : f))
      cancelEdit()
    } else {
      onChange([...feeds, { id: uid(), name: name.trim(), icsUrl: url.trim(), color }])
      setName('')
      setUrl('')
      setColor(randomColor())
    }
  }

  function remove(id: string) {
    onChange(feeds.filter(f => f.id !== id))
  }

  return (
    <>
      <div className="cal-panel-overlay" onClick={onClose} />
      <div className="cal-panel">
        <div className="cal-panel-header">
          <h2>Calendars</h2>
          <button className="cal-panel-close" onClick={onClose}>×</button>
        </div>
        <div className="cal-panel-body">
          {feeds.length === 0 && (
            <div className="cal-empty-state">Add your first calendar below</div>
          )}
          {feeds.map(feed => (
            <div className="cal-feed-item" key={feed.id}>
              <div className="cal-feed-swatch" style={{ background: feed.color }} />
              <div className="cal-feed-name" title={feed.name}>{feed.name}</div>
              <button className="cal-feed-action" onClick={() => startEdit(feed)}>✎</button>
              <button className="cal-feed-action danger" onClick={() => remove(feed.id)}>✕</button>
            </div>
          ))}

          <div className="cal-add-form">
            <h3>{editId ? 'Edit calendar' : 'Add calendar'}</h3>
            <input
              className="cal-form-input"
              placeholder="Name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <input
              className="cal-form-input"
              placeholder="ICS URL"
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
            <div className="cal-form-row">
              <label>Color</label>
              <input
                type="color"
                className="cal-form-color"
                value={color}
                onChange={e => setColor(e.target.value)}
              />
            </div>
            <button className="cal-submit-btn" onClick={save}>
              {editId ? 'Save changes' : 'Add calendar'}
            </button>
            {editId && (
              <button className="cal-submit-btn" onClick={cancelEdit}
                style={{ background: '#2d3048', marginTop: 4 }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Time column ───────────────────────────────────────────────────────────
function TimeColumn() {
  const labels: React.ReactNode[] = []
  // One label per slot (30 min). We show hour labels at even slots.
  for (let i = 0; i <= SLOT_COUNT; i++) {
    const totalMins = HOUR_START * 60 + i * 30
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60
    const label = m === 0
      ? `${h > 12 ? h - 12 : h === 0 ? 12 : h}${h >= 12 ? 'pm' : 'am'}`
      : ''
    labels.push(
      <div className="cal-time-label" key={i} style={{ height: i === SLOT_COUNT ? 0 : SLOT_HEIGHT }}>
        {label}
      </div>
    )
  }
  return (
    <div className="cal-time-col" style={{ paddingTop: COL_HEADER_HEIGHT }}>
      {labels}
    </div>
  )
}

// ── Event card ────────────────────────────────────────────────────────────
function EventCard({ event }: { event: CalEvent }) {
  const windowStart = new Date(event.start)
  const windowEnd = new Date(event.end)

  const gridStart = HOUR_START * 60 // minutes from midnight
  const gridEnd = HOUR_END * 60

  const evStartMins = windowStart.getHours() * 60 + windowStart.getMinutes()
  const evEndMins = windowEnd.getHours() * 60 + windowEnd.getMinutes()

  const clampedStart = clamp(evStartMins, gridStart, gridEnd)
  const clampedEnd = clamp(evEndMins, gridStart, gridEnd)

  const top = ((clampedStart - gridStart) / 30) * SLOT_HEIGHT
  const height = Math.max(((clampedEnd - clampedStart) / 30) * SLOT_HEIGHT, 20)

  return (
    <div
      className="cal-event"
      style={{
        top: top + COL_HEADER_HEIGHT,
        height,
        borderLeftColor: event.color,
      }}
      title={`${event.title}\n${formatTime(event.start)} – ${formatTime(event.end)}${event.location ? `\n${event.location}` : ''}`}
    >
      <div className="cal-event-title">{event.title}</div>
      <div className="cal-event-time">{formatTime(event.start)} – {formatTime(event.end)}</div>
    </div>
  )
}

// ── Grid column ───────────────────────────────────────────────────────────
function GridColumn({ header, subheader, events }: {
  header: string
  subheader?: string
  events: CalEvent[]
}) {
  const slots: React.ReactNode[] = []
  for (let i = 0; i < SLOT_COUNT; i++) {
    slots.push(<div className="cal-slot" key={i} />)
  }

  return (
    <div className="cal-col" style={{ height: GRID_HEIGHT + COL_HEADER_HEIGHT }}>
      <div className="cal-col-header">
        {header}
        {subheader && <div className="cal-col-day">{subheader}</div>}
      </div>
      {slots}
      <div className="cal-events-layer">
        {events.map(ev => <EventCard key={ev.id + ev.calendarId} event={ev} />)}
      </div>
    </div>
  )
}

// ── Main calendar ─────────────────────────────────────────────────────────
function CalendarMain() {
  const [feeds, setFeeds] = useState<CalendarFeed[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as CalendarFeed[]) : []
    } catch {
      return []
    }
  })
  const [events, setEvents] = useState<CalEvent[]>([])
  const [view, setView] = useState<ViewMode>('week')
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()))
  const [panelOpen, setPanelOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Persist feeds
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(feeds))
  }, [feeds])

  // Fetch events
  const fetchAll = useCallback(async () => {
    if (feeds.length === 0) { setEvents([]); return }
    const results = await Promise.all(feeds.map(fetchFeedEvents))
    setEvents(results.flat())
  }, [feeds])

  useEffect(() => {
    fetchAll()
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(fetchAll, REFRESH_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetchAll])

  // Navigation
  function navPrev() {
    setAnchor(d => view === 'day' ? addDays(d, -1) : addDays(d, -7))
  }
  function navNext() {
    setAnchor(d => view === 'day' ? addDays(d, 1) : addDays(d, 7))
  }
  function navToday() {
    setAnchor(startOfDay(new Date()))
  }

  // Date label
  let dateLabel: string
  if (view === 'day') {
    dateLabel = formatDate(anchor)
  } else {
    const mon = getMonday(anchor)
    const sun = addDays(mon, 6)
    dateLabel = `${formatDateShort(mon)} – ${formatDateShort(sun)}`
  }

  // Filter events for 8am-10pm window
  function eventsForDay(day: Date): CalEvent[] {
    const dayStart = new Date(day); dayStart.setHours(HOUR_START, 0, 0, 0)
    const dayEnd = new Date(day); dayEnd.setHours(HOUR_END, 0, 0, 0)
    return events.filter(ev =>
      sameDay(ev.start, day) &&
      ev.start < dayEnd &&
      ev.end > dayStart
    )
  }

  // Build columns
  let columns: React.ReactNode

  if (view === 'day') {
    if (feeds.length === 0) {
      columns = (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a6080', fontSize: 14 }}>
          No calendars — click ⚙ to add one
        </div>
      )
    } else {
      const dayEvs = eventsForDay(anchor)
      columns = feeds.map(feed => {
        const feedEvs = dayEvs.filter(e => e.calendarId === feed.id)
        return (
          <GridColumn
            key={feed.id}
            header={feed.name}
            events={feedEvs}
          />
        )
      })
    }
  } else {
    // Week view: Mon–Sun columns, all calendars merged per day
    const mon = getMonday(anchor)
    const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i))
    columns = days.map(day => {
      const dayEvs = eventsForDay(day)
      return (
        <GridColumn
          key={day.toISOString()}
          header={day.toLocaleDateString('en-US', { weekday: 'short' })}
          subheader={day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          events={dayEvs}
        />
      )
    })
  }

  return (
    <div className="cal-root">
      {/* Top bar */}
      <div className="cal-topbar">
        <span className="cal-topbar-title">Venue Calendar</span>
        <button className="cal-nav-btn" onClick={navPrev}>‹</button>
        <button className="cal-nav-btn" onClick={navToday}>Today</button>
        <button className="cal-nav-btn" onClick={navNext}>›</button>
        <span className="cal-date-label">{dateLabel}</span>
        <div className="cal-view-toggle">
          <button className={`cal-view-btn${view === 'day' ? ' active' : ''}`} onClick={() => setView('day')}>Day</button>
          <button className={`cal-view-btn${view === 'week' ? ' active' : ''}`} onClick={() => setView('week')}>Week</button>
        </div>
        <span className="cal-spacer" />
        <button className="cal-gear-btn" onClick={() => setPanelOpen(true)}>⚙</button>
      </div>

      {/* Grid */}
      <div className="cal-body">
        <div className="cal-grid-scroll">
          <div className="cal-grid">
            <TimeColumn />
            <div className="cal-columns">
              {columns}
            </div>
          </div>
        </div>
      </div>

      {/* Settings panel */}
      {panelOpen && (
        <SettingsPanel
          feeds={feeds}
          onClose={() => setPanelOpen(false)}
          onChange={setFeeds}
        />
      )}
    </div>
  )
}

// ── Root export ───────────────────────────────────────────────────────────
export default function CalendarPage() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />
  }

  return <CalendarMain />
}
