import type { Competition, Result } from '../types'
export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
export const localDay = (offset = 0) => {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offset)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
export const formatDate = (
  date: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', options)
export const sportImage = (sport: string) =>
  `/images/${({ Athletics: 'track', Swimming: 'swimming', Football: 'football', Basketball: 'basketball', Cycling: 'cycling', Tennis: 'tennis' } as Record<string, string>)[sport] || 'track'}.jpg`
export const sportIcon = (sport: string) =>
  (
    ({
      Athletics: 'run',
      Swimming: 'swim',
      Football: 'ball',
      Basketball: 'basketball',
      Cycling: 'bike',
      Tennis: 'tennis',
    }) as Record<string, string>
  )[sport] || 'trophy'
export function performance(result: Result, event?: Competition) {
  const [whole, fraction = ''] = String(result.performance).split('.')
  const mark =
    event?.unit === 'pts' ? String(result.performance) : `${whole}.${fraction.padEnd(2, '0')}`
  return `${mark} ${event?.unit || ''}`
}
// Competition ranking: ties share a place (1, 1, 3); provisional marks stay separate.
export function rank(result: Result, results: Result[], event?: Competition) {
  return (
    1 +
    results.filter(
      (other) =>
        other.eventId === result.eventId &&
        other.status === result.status &&
        (event?.ranking === 'desc'
          ? other.performance > result.performance
          : other.performance < result.performance),
    ).length
  )
}
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    let text = String(value)
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }
  const url = URL.createObjectURL(
    new Blob(['\uFEFF' + rows.map((row) => row.map(escape).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
