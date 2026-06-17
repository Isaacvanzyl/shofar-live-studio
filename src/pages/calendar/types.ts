export interface CalendarFeed {
  id: string
  name: string
  icsUrl: string
  color: string
}

export interface CalEvent {
  id: string
  calendarId: string
  title: string
  start: Date
  end: Date
  description?: string
  location?: string
  color: string
}

export type ViewMode = 'day' | 'week'
