import { describe, expect, it } from 'vitest'
import { addDays, agingBuckets, countBy, filterRows, importValue, isExampleRow, parseCell, sortRows, summarizeTasks, topDebtors } from './lib'

describe('parseCell', () => {
  it('empty -> null', () => expect(parseCell('text', '  ')).toBeNull())
  it('parses money with commas', () => expect(parseCell('money', '1,50,000')).toBe(150000))
  it('rejects non-numbers', () => expect(parseCell('number', 'abc')).toBeNull())
})

describe('filter/sort', () => {
  const rows = [
    { client: 'GP Kendrapada', status: 'Open', amt: 5 },
    { client: 'Zilla', status: 'Closed', amt: null },
    { client: 'Alpha', status: 'Open', amt: 20 },
  ]
  it('filters by search and status', () => {
    expect(filterRows(rows, 'kend', ['client'])).toHaveLength(1)
    expect(filterRows(rows, '', ['client'], 'status', 'Open')).toHaveLength(2)
    expect(filterRows(rows, '', ['client'], 'status', 'All')).toHaveLength(3)
  })
  it('sorts numbers with empties last in both directions', () => {
    expect(sortRows(rows, 'amt', 'asc').map(r => r.amt)).toEqual([5, 20, null])
    expect(sortRows(rows, 'amt', 'desc').map(r => r.amt)).toEqual([20, 5, null])
  })
  it('sorts text naturally', () => expect(sortRows(rows, 'client', 'asc')[0].client).toBe('Alpha'))
})

describe('aggregations', () => {
  it('buckets aging and ignores settled/unaged rows', () => {
    const b = agingBuckets([
      { balance: 100, aging: '0-30' }, { balance: 50, aging: '0-30' },
      { balance: 70, aging: '90+' }, { balance: 0, aging: '31-60' }, { balance: 9, aging: null },
    ])
    expect(b).toEqual({ '0-30': 150, '31-60': 0, '61-90': 0, '90+': 70 })
  })
  it('ranks debtors', () => {
    expect(topDebtors([{ client: 'A', balance: 5 }, { client: 'B', balance: 9 }, { client: 'A', balance: 6 }], 1)).toEqual([['A', 11]])
  })
  it('counts and summarizes tasks', () => {
    expect(countBy([{ s: 'x' }, { s: 'x' }, { s: 'y' }], r => r.s)).toEqual({ x: 2, y: 1 })
    expect(summarizeTasks([{ team: 'T', status: 'Done' }, { team: 'T', status: 'Pending' }, { team: 'U', status: 'Done' }]))
      .toEqual([{ team: 'T', total: 2, done: 1, pending: 1, pct: 50 }, { team: 'U', total: 1, done: 1, pending: 0, pct: 100 }])
  })
})

describe('import helpers', () => {
  it('formats dates in UTC without shifting the day', () =>
    expect(importValue('date', new Date(Date.UTC(2026, 8, 1)))).toBe('2026-09-01'))
  it('matches select options case-insensitively and nulls unknowns', () => {
    expect(importValue('select', 'gem', ['GeM', 'Other'])).toBe('GeM')
    expect(importValue('select', 'Zzz', ['GeM'])).toBeNull()
  })
  it('detects placeholder rows from the workbook', () => {
    expect(isExampleRow([1, 'EXAMPLE-101'])).toBe(true)
    expect(isExampleRow([1, 'DELETE this example row'])).toBe(true)
    expect(isExampleRow([1, 'PO/2026/7'])).toBe(false)
  })
  it('adds days across month ends', () => expect(addDays('2026-10-30', 3)).toBe('2026-11-02'))
})
