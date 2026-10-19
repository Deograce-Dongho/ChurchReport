// Period presets and date helpers shared by Statistics and Members.

export const PERIODS = [
  {
    id: '3m',
    label: 'Last 3 months',
    range: () => {
      const now = new Date()
      return [new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()), now]
    },
  },
  {
    id: '6m',
    label: 'Last 6 months',
    range: () => {
      const now = new Date()
      return [new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()), now]
    },
  },
  {
    id: 'quarter',
    label: 'This quarter',
    range: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      return [start, now]
    },
  },
  {
    id: 'semester',
    label: 'This semester',
    range: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1)
      return [start, now]
    },
  },
  {
    id: 'year',
    label: 'This year',
    range: () => {
      const now = new Date()
      return [new Date(now.getFullYear(), 0, 1), now]
    },
  },
  {
    id: 'last-year',
    label: 'Last year',
    range: () => {
      const year = new Date().getFullYear() - 1
      return [new Date(year, 0, 1), new Date(year, 11, 31)]
    },
  },
]

// YYYY-MM-DD in local time, as used by <input type="date">
export function toInputDate(date) {
  return date.toLocaleDateString('en-CA')
}

export function parseInputDate(value) {
  if (!value) return null

  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null

  return new Date(year, month - 1, day)
}

export function formatShortDate(value) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// Services held between two local dates (both included), oldest first.
export function servicesInRange(services, start, end) {
  const endExclusive = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate() + 1
  )

  return services
    .filter((service) => {
      const date = new Date(service.service_date)
      return date >= start && date < endExclusive
    })
    .sort((a, b) => new Date(a.service_date) - new Date(b.service_date))
}