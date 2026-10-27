import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useToast } from './toast'
import { importValue, isExampleRow, parseCell, type Row } from './lib'
import type { Column, TrackerConfig } from './trackers/types'

/** Data access for one tracker: load, inline save (with rollback), add, delete, Excel import. */
export function useTracker(cfg: TrackerConfig) {
  const toast = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from(cfg.view).select('*').limit(5000)
    if (error) toast(error.message, 'error')
    else setRows((data as Row[]) ?? [])
    setLoading(false)
  }, [cfg.view, toast])

  useEffect(() => { setRows([]); load() }, [load])

  const refreshRow = useCallback(async (id: unknown) => {
    const { data } = await supabase.from(cfg.view).select('*').eq('id', id).maybeSingle()
    if (data) setRows(rs => rs.map(r => (r.id === id ? (data as Row) : r)))
  }, [cfg.view])

  const save = useCallback(async (row: Row, col: Column, raw: string) => {
    const value = parseCell(col.type, raw)
    if ((row[col.key] ?? null) === value) return
    if (col.required && value === null) { toast(`${col.label} is required`, 'error'); return }
    const before = row[col.key]
    setRows(rs => rs.map(r => (r.id === row.id ? { ...r, [col.key]: value } : r)))
    const res = col.cost && cfg.costTable
      ? await supabase.from(cfg.costTable.table).upsert({ [cfg.costTable.fk]: row.id, [col.key]: value }, { onConflict: cfg.costTable.fk })
      : await supabase.from(cfg.table).update({ [col.key]: value }).eq('id', row.id)
    if (res.error) {
      setRows(rs => rs.map(r => (r.id === row.id ? { ...r, [col.key]: before } : r)))
      toast(res.error.code === '23505' ? `${col.label} already exists` : res.error.code === '23514' ? `${col.label} can't be negative` : res.error.message, 'error')
    } else refreshRow(row.id)
  }, [cfg, refreshRow, toast])

  const remove = useCallback(async (row: Row) => {
    const { error } = await supabase.from(cfg.table).delete().eq('id', row.id)
    if (error) { toast(error.message, 'error'); return false }
    setRows(rs => rs.filter(r => r.id !== row.id))
    toast('Row deleted')
    return true
  }, [cfg.table, toast])

  const add = useCallback(async (values: Record<string, string>) => {
    const payload: Row = {}
    for (const c of cfg.columns.filter(c => c.required)) {
      const v = parseCell(c.type, values[c.key] ?? '')
      if (v === null) { toast(`${c.label} is required`, 'error'); return null }
      payload[c.key] = v
    }
    const { data, error } = await supabase.from(cfg.table).insert(payload).select('id').single()
    if (error) { toast(error.code === '23505' ? 'That number already exists' : error.message, 'error'); return null }
    toast('Row added')
    await load()
    return data.id as number
  }, [cfg, load, toast])

  const importXlsx = useCallback(async (file: File) => {
    try {
      const { readSheet } = await import('read-excel-file/browser')
      const [head, ...body] = (await readSheet(file, cfg.sheet)) as unknown[][]
      const byLabel = new Map(cfg.columns.map(c => [c.label.toLowerCase(), c]))
      const map = head.map(h => byLabel.get(String(h ?? '').trim().toLowerCase()))
      let ok = 0, skipped = 0
      const failures: string[] = []
      for (const line of body) {
        if (line.every(v => v === null || v === '') || isExampleRow(line)) { skipped++; continue }
        const base: Row = {}, cost: Row = {}
        map.forEach((c, i) => {
          if (!c || c.computed) return
          const v = importValue(c.type, line[i], c.options)
          if (v !== null) (c.cost ? cost : base)[c.key] = v
        })
        if (cfg.columns.some(c => c.required && !c.computed && base[c.key] === undefined)) { skipped++; continue }
        const { data: ins, error } = await supabase.from(cfg.table).insert(base).select('id').single()
        if (error) { failures.push(`${String(Object.values(base)[0] ?? '?')}: ${error.message}`); continue }
        if (cfg.costTable && Object.keys(cost).length) {
          const r = await supabase.from(cfg.costTable.table).insert({ [cfg.costTable.fk]: ins.id, ...cost })
          if (r.error) failures.push(`costs: ${r.error.message}`)
        }
        ok++
      }
      toast(`Imported ${ok} row(s), skipped ${skipped}${failures.length ? `, ${failures.length} failed: ${failures.slice(0, 2).join('; ')}` : ''}`, failures.length ? 'error' : 'ok')
      load()
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}`, 'error')
    }
  }, [cfg, load, toast])

  return { rows, loading, load, save, remove, add, importXlsx, refreshRow }
}
