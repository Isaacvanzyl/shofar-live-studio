import type { CalEvent } from './types'

type RawEvent = Omit<CalEvent, 'calendarId' | 'color'>

function parseIcsDate(value: string, param: string): Date {
  // value is the date string, param contains optional TZID=... prefix from the property params
  const isUtc = value.endsWith('Z')

  if (isUtc) {
    // e.g. 20241014T100000Z
    const y = parseInt(value.slice(0, 4), 10)
    const mo = parseInt(value.slice(4, 6), 10) - 1
    const d = parseInt(value.slice(6, 8), 10)
    if (value.length === 8) return new Date(Date.UTC(y, mo, d))
    const h = parseInt(value.slice(9, 11), 10)
    const mi = parseInt(value.slice(11, 13), 10)
    const s = parseInt(value.slice(13, 15), 10)
    return new Date(Date.UTC(y, mo, d, h, mi, s))
  }

  // Local time (TZID specified or no suffix) — treat as local
  if (value.length === 8) {
    // DATE only: 20241014
    const y = parseInt(value.slice(0, 4), 10)
    const mo = parseInt(value.slice(4, 6), 10) - 1
    const d = parseInt(value.slice(6, 8), 10)
    return new Date(y, mo, d)
  }

  // e.g. 20241014T100000
  const y = parseInt(value.slice(0, 4), 10)
  const mo = parseInt(value.slice(4, 6), 10) - 1
  const d = parseInt(value.slice(6, 8), 10)
  const h = parseInt(value.slice(9, 11), 10)
  const mi = parseInt(value.slice(11, 13), 10)
  const s = parseInt(value.slice(13, 15), 10)

  const tzidMatch = param.match(/TZID=([^;]+)/)
  if (tzidMatch) {
    // Try to construct via Intl if available, otherwise fall back to local
    try {
      const tzid = tzidMatch[1]
      // Build an ISO string in the target timezone by using Date and toLocaleString trick
      const isoLike = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}`
      // Use Temporal-style workaround: create date as if UTC, then adjust offset
      const naive = new Date(`${isoLike}Z`)
      const utcStr = naive.toLocaleString('en-US', { timeZone: tzid, hour12: false })
      const localStr = naive.toLocaleString('en-US', { hour12: false })
      const utcDate = new Date(utcStr)
      const localDate = new Date(localStr)
      const offsetMs = localDate.getTime() - utcDate.getTime()
      return new Date(naive.getTime() - offsetMs)
    } catch {
      // Fall through to local
    }
  }

  return new Date(y, mo, d, h, mi, s)
}

function unfoldLines(raw: string): string {
  // ICS lines can be folded with CRLF + whitespace
  return raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
}

export function parseIcs(raw: string): RawEvent[] {
  const text = unfoldLines(raw)
  const lines = text.split(/\r\n|\n/)

  const events: RawEvent[] = []
  let inEvent = false
  let current: Partial<Record<string, string>> = {}

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      inEvent = false

      const uid = current['UID'] ?? Math.random().toString(36)
      const title = current['SUMMARY'] ?? '(No title)'
      const description = current['DESCRIPTION']
      const location = current['LOCATION']

      const dtStartRaw = current['DTSTART_VAL']
      const dtStartParam = current['DTSTART_PARAM'] ?? ''
      const dtEndRaw = current['DTEND_VAL']
      const dtEndParam = current['DTEND_PARAM'] ?? ''

      if (!dtStartRaw) continue

      const start = parseIcsDate(dtStartRaw, dtStartParam)
      const end = dtEndRaw ? parseIcsDate(dtEndRaw, dtEndParam) : new Date(start.getTime() + 60 * 60 * 1000)

      const event: RawEvent = { id: uid, title, start, end }
      if (description) event.description = description
      if (location) event.location = location

      events.push(event)
      continue
    }

    if (!inEvent) continue

    // Parse property name (and params) vs value
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const propFull = line.slice(0, colonIdx)
    const value = line.slice(colonIdx + 1)

    const semicolonIdx = propFull.indexOf(';')
    const propName = semicolonIdx !== -1 ? propFull.slice(0, semicolonIdx) : propFull
    const propParam = semicolonIdx !== -1 ? propFull.slice(semicolonIdx + 1) : ''

    switch (propName) {
      case 'UID':
        current['UID'] = value
        break
      case 'SUMMARY':
        current['SUMMARY'] = value
        break
      case 'DESCRIPTION':
        current['DESCRIPTION'] = value.replace(/\\n/g, '\n').replace(/\\,/g, ',')
        break
      case 'LOCATION':
        current['LOCATION'] = value
        break
      case 'DTSTART':
        current['DTSTART_VAL'] = value
        current['DTSTART_PARAM'] = propParam
        break
      case 'DTEND':
        current['DTEND_VAL'] = value
        current['DTEND_PARAM'] = propParam
        break
    }
  }

  return events
}
