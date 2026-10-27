export type Row = Record<string, unknown>

export type ColType = 'text' | 'number' | 'money' | 'date' | 'select'

export const today = () => new Date().toLocaleDateString('en-CA')

export function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA')
}

export const inr = (n: unknown) =>
  n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })

/** Excel-style "" -> null, numbers parsed, everything else trimmed. */
export function parseCell(type: ColType, raw: string): string | number | null {
  const v = raw.trim()
  if (v === '') return null
  if (type === 'number' || type === 'money') {
    const n = Number(v.replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return v
}

export function filterRows(rows: Row[], search: string, keys: string[], statusKey?: string, status?: string) {
  const q = search.trim().toLowerCase()
  return rows.filter(r => {
    if (statusKey && status && status !== 'All' && r[statusKey] !== status) return false
    if (!q) return true
    return keys.some(k => String(r[k] ?? '').toLowerCase().includes(q))
  })
}

export function sortRows(rows: Row[], key: string, dir: 'asc' | 'desc') {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = a[key], y = b[key]
    if (x === y) return 0
    if (x === null || x === undefined || x === '') return 1 // empties always last
    if (y === null || y === undefined || y === '') return -1
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * sign
    return String(x).localeCompare(String(y), undefined, { numeric: true }) * sign
  })
}

export const AGING_BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const

export function agingBuckets(rows: { balance: number; aging: string | null }[]) {
  const out: Record<string, number> = Object.fromEntries(AGING_BUCKETS.map(b => [b, 0]))
  for (const r of rows) if (r.aging && r.balance > 0) out[r.aging] += Number(r.balance)
  return out
}

export function topDebtors(rows: { client: string; balance: number }[], n = 5) {
  const by = new Map<string, number>()
  for (const r of rows) if (r.balance > 0) by.set(r.client, (by.get(r.client) ?? 0) + Number(r.balance))
  return [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

export function countBy<T>(rows: T[], key: (r: T) => string) {
  const out: Record<string, number> = {}
  for (const r of rows) out[key(r)] = (out[key(r)] ?? 0) + 1
  return out
}

export function summarizeTasks(rows: { status: string; team: string }[]) {
  const by = new Map<string, { total: number; done: number }>()
  for (const r of rows) {
    const s = by.get(r.team) ?? { total: 0, done: 0 }
    s.total++
    if (r.status === 'Done') s.done++
    by.set(r.team, s)
  }
  return [...by.entries()].map(([team, s]) => ({ team, ...s, pending: s.total - s.done, pct: s.total ? Math.round((s.done / s.total) * 100) : 0 }))
}

/** Converts a value read from an .xlsx cell into what the DB column expects. */
export function importValue(type: ColType, v: unknown, options?: string[]): string | number | null {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`
  if (type === 'number' || type === 'money') {
    const n = Number(String(v).replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  const s = String(v).trim()
  if (type === 'select') return options?.find(o => o.toLowerCase() === s.toLowerCase()) ?? null
  return s || null
}

export const isExampleRow = (values: unknown[]) =>
  values.some(v => typeof v === 'string' && /example|delete this/i.test(v))

export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'neutral'

const TONES: Record<Tone, string[]> = {
  good: ['done', 'won', 'delivered', 'commissioned', 'closed', 'paid', 'approved', 'vendor confirmed', 'rate finalised', 'received', 'yes', 'refunded'],
  warn: ['pending', 'to quote', 'under negotiation', 'material ready', 'requested', 'quotes received', 'open', 'vendor pending', 'required', 'enquiry sent', 'partial'],
  info: ['in progress', 'quoted', 'vendor po placed', 'dispatched', 'in transit', 'po received'],
  bad: ['lost', 'cancelled', 'rejected', 'held', 'expired'],
  neutral: [],
}

/** Colour family for a status-like value; unknown values stay neutral. */
export function statusTone(value: unknown): Tone {
  const v = String(value ?? '').trim().toLowerCase()
  if (!v) return 'neutral'
  return (['good', 'warn', 'info', 'bad'] as Tone[]).find(t => TONES[t].includes(v)) ?? 'neutral'
}

/** Which tracker a to-do relates to ("P1 - OUTSTANDING PAYMENT…" etc.), so the task can link straight to it. */
export function trackerForTask(title: string, team: string): string | null {
  const p = /^P(\d)\b/.exec(title)?.[1]
  const byPrefix: Record<string, string> = { '1': 'outstanding', '2': 'tenders', '3': 'pos', '4': 'logistics', '6': 'service' }
  if (p && byPrefix[p]) return byPrefix[p]
  if (/outstanding/i.test(title)) return 'outstanding'
  return ({ Tendering: 'tenders', 'Logistics Follow-up': 'logistics', Sourcing: 'sourcing' } as Record<string, string>)[team] ?? null
}

export function sumBy(rows: Row[], key: string) {
  return rows.reduce((n, r) => n + (Number(r[key]) || 0), 0)
}

/** Parses "#/tenders?status=Won&q=abc" into path + params. */
export function parseHash(hash: string): { path: string; params: URLSearchParams } {
  if (!hash.startsWith('#/')) return { path: '/today', params: new URLSearchParams() }
  const [path, query = ''] = hash.slice(1).split('?')
  return { path, params: new URLSearchParams(query) }
}
