import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useProfile } from './profile'
import { useToast } from './toast'
import { filterRows, importValue, inr, isExampleRow, parseCell, sortRows, today, type Row } from './lib'
import type { Column, TrackerConfig } from './trackers/types'

const PAGE = 50

export default function TrackerTable({ cfg }: { cfg: TrackerConfig }) {
  const { profile } = useProfile()
  const toast = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [sort, setSort] = useState(cfg.defaultSort)
  const [page, setPage] = useState(0)
  const [adding, setAdding] = useState(false)
  const [poNos, setPoNos] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const role = profile?.role ?? 'member'
  const isAdmin = role === 'admin'
  const canEdit = role !== 'member' || cfg.editTeams.includes(profile?.team ?? '')
  const cols = useMemo(() => cfg.columns.filter(c => !c.cost || role !== 'member'), [cfg, role])
  const poPickerCol = cfg.columns.find(c => c.poPicker)
  const t = today()

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from(cfg.view).select('*').limit(5000)
    if (error) toast(error.message, 'error')
    else setRows((data as Row[]) ?? [])
    setLoading(false)
  }, [cfg.view, toast])

  useEffect(() => { setSearch(''); setStatus('All'); setSort(cfg.defaultSort); setPage(0); setAdding(false); load() }, [cfg, load])

  useEffect(() => {
    if (!poPickerCol) return
    supabase.from('po_tracker').select('po_no').order('po_no').then(({ data }) => setPoNos((data ?? []).map(r => r.po_no as string)))
  }, [poPickerCol])

  const statusOptions = useMemo(() => {
    const col = cfg.columns.find(c => c.key === cfg.statusKey)
    return col?.options ?? []
  }, [cfg])

  const shown = useMemo(
    () => sortRows(filterRows(rows, search, cfg.searchKeys, cfg.statusKey, status), sort.key, sort.dir),
    [rows, search, status, sort, cfg],
  )
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const visible = shown.slice(page * PAGE, page * PAGE + PAGE)

  async function refreshRow(id: unknown) {
    const { data } = await supabase.from(cfg.view).select('*').eq('id', id).maybeSingle()
    if (data) setRows(rs => rs.map(r => (r.id === id ? (data as Row) : r)))
  }

  async function save(row: Row, col: Column, raw: string) {
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
      toast(res.error.code === '23505' ? `${col.label} already exists` : res.error.message, 'error')
    } else refreshRow(row.id)
  }

  async function remove(row: Row) {
    if (!confirm('Delete this row? This cannot be undone.')) return
    const { error } = await supabase.from(cfg.table).delete().eq('id', row.id)
    if (error) toast(error.message, 'error')
    else setRows(rs => rs.filter(r => r.id !== row.id))
  }

  async function add(values: Record<string, string>) {
    const payload: Row = {}
    for (const c of cfg.columns.filter(c => c.required)) {
      const v = parseCell(c.type, values[c.key] ?? '')
      if (v === null) { toast(`${c.label} is required`, 'error'); return }
      payload[c.key] = v
    }
    const { error } = await supabase.from(cfg.table).insert(payload)
    if (error) { toast(error.code === '23505' ? 'That number already exists' : error.message, 'error'); return }
    setAdding(false)
    toast('Row added')
    load()
  }

  async function exportXlsx() {
    const { default: writeXlsxFile } = await import('write-excel-file/browser')
    const header = cols.map(c => ({ value: c.label, fontWeight: 'bold' as const }))
    const body = shown.map(r => cols.map(c => {
      const v = r[c.key]
      if (v === null || v === undefined || v === '') return null
      if (c.type === 'number' || c.type === 'money') return { value: Number(v), type: Number }
      if (c.type === 'date') return { value: new Date(String(v) + 'T00:00:00'), type: Date, format: 'dd-mm-yyyy' }
      return { value: String(v), type: String }
    }))
    await writeXlsxFile([header, ...body] as never).toFile(`${cfg.title}-${t}.xlsx`)
  }

  async function importXlsx(file: File) {
    try {
      const { readSheet } = await import('read-excel-file/browser')
      const data = (await readSheet(file, cfg.sheet)) as unknown[][]
      const [head, ...body] = data
      const byLabel = new Map(cfg.columns.map(c => [c.label.toLowerCase(), c]))
      const map = (head as unknown[]).map(h => byLabel.get(String(h ?? '').trim().toLowerCase()))
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
        const required = cfg.columns.filter(c => c.required && !c.computed).find(c => base[c.key] === undefined)
        if (required) { skipped++; continue }
        const { data: ins, error } = await supabase.from(cfg.table).insert(base).select('id').single()
        if (error) { failures.push(`${base[cfg.columns[0].key] ?? '?'}: ${error.message}`); continue }
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
  }

  function cell(row: Row, c: Column) {
    const v = row[c.key]
    if (c.computed || !canEdit) {
      const shownVal = c.type === 'money' ? inr(v) : c.type === 'number' && c.key === 'margin_pct' && v != null ? `${v}%` : String(v ?? '')
      return <span className={`block min-w-[4rem] px-1 ${c.computed ? 'font-medium' : ''}`}>{shownVal}</span>
    }
    const common = 'w-full min-w-[6rem] rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-slate-300 focus:border-slate-500 focus:bg-white'
    if (c.type === 'select') {
      return (
        <select value={String(v ?? '')} className={common} onChange={e => save(row, c, e.target.value)}>
          <option value="" />
          {c.options!.map(o => <option key={o}>{o}</option>)}
        </select>
      )
    }
    if (c.poPicker) {
      return <span className="block px-1 font-medium">{String(v ?? '')}</span>
    }
    return (
      <input key={`${row.id}-${c.key}-${String(v ?? '')}`} defaultValue={c.type === 'money' && v != null ? String(v) : String(v ?? '')}
        type={c.type === 'date' ? 'date' : 'text'} inputMode={c.type === 'number' || c.type === 'money' ? 'decimal' : undefined}
        className={common} onBlur={e => save(row, c, e.target.value)}
        onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
    )
  }

  const arrow = (k: string) => (sort.key === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-lg font-semibold">{cfg.title}</h2>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Search…" className="min-w-[10rem] flex-1 rounded border p-1" />
        {statusOptions.length > 0 && (
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(0) }} className="rounded border p-1">
            <option>All</option>
            {statusOptions.map(s => <option key={s}>{s}</option>)}
          </select>
        )}
        {canEdit && <button onClick={() => setAdding(a => !a)} className="rounded bg-slate-800 px-3 py-1 text-white">+ Add</button>}
        <button onClick={exportXlsx} className="rounded bg-slate-100 px-3 py-1">Export Excel</button>
        {isAdmin && (
          <>
            <button onClick={() => fileRef.current?.click()} className="rounded bg-slate-100 px-3 py-1">Import Excel</button>
            <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importXlsx(f); e.target.value = '' }} />
          </>
        )}
      </div>
      {!canEdit && <p className="mb-2 text-sm text-slate-500">View only — your team ({profile?.team ?? 'no team set'}) doesn't maintain this tracker.</p>}
      {adding && <AddForm cfg={cfg} poNos={poNos} onSubmit={add} onCancel={() => setAdding(false)} />}
      <div className="overflow-auto rounded border" style={{ maxHeight: '70vh' }}>
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100">
            <tr>
              {cols.map((c, i) => (
                <th key={c.key} onClick={() => setSort(s => ({ key: c.key, dir: s.key === c.key && s.dir === 'asc' ? 'desc' : 'asc' }))}
                  className={`cursor-pointer whitespace-nowrap border-b px-2 py-1 font-medium ${i === 0 ? 'sticky left-0 bg-slate-100' : ''}`}>
                  {c.label}{arrow(c.key)}
                </th>
              ))}
              {isAdmin && <th className="border-b px-2" />}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={cols.length + 1} className="p-4 text-slate-500">Loading…</td></tr>}
            {!loading && visible.length === 0 && <tr><td colSpan={cols.length + 1} className="p-4 text-slate-500">No rows.</td></tr>}
            {visible.map(r => (
              <tr key={String(r.id)} className={`border-b ${cfg.rowClass?.(r, t) ?? ''}`}>
                {cols.map((c, i) => (
                  <td key={c.key} className={`px-1 py-0.5 align-top ${i === 0 ? 'sticky left-0 bg-inherit' : ''}`}>{cell(r, c)}</td>
                ))}
                {isAdmin && <td className="px-2"><button onClick={() => remove(r)} className="text-red-600" aria-label="Delete row">✕</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
        <span>{shown.length} of {rows.length} rows</span>
        <span className="flex items-center gap-2">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded bg-slate-100 px-2 disabled:opacity-40">Prev</button>
          {page + 1} / {pages}
          <button disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)} className="rounded bg-slate-100 px-2 disabled:opacity-40">Next</button>
        </span>
      </div>
    </div>
  )
}

function AddForm({ cfg, poNos, onSubmit, onCancel }: { cfg: TrackerConfig; poNos: string[]; onSubmit: (v: Record<string, string>) => void; onCancel: () => void }) {
  const [v, setV] = useState<Record<string, string>>({})
  const req = cfg.columns.filter(c => c.required)
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(v) }} className="mb-3 flex flex-wrap items-end gap-3 rounded border bg-slate-50 p-3">
      {req.map(c => (
        <label key={c.key} className="text-xs text-slate-600">{c.label} *
          {c.poPicker ? (
            <select required value={v[c.key] ?? ''} onChange={e => setV({ ...v, [c.key]: e.target.value })} className="mt-0.5 block rounded border p-1 text-sm text-black">
              <option value="">Select PO…</option>
              {poNos.map(p => <option key={p}>{p}</option>)}
            </select>
          ) : (
            <input required value={v[c.key] ?? ''} onChange={e => setV({ ...v, [c.key]: e.target.value })}
              className="mt-0.5 block rounded border p-1 text-sm text-black" />
          )}
        </label>
      ))}
      <button className="rounded bg-slate-800 px-3 py-1 text-white">Create</button>
      <button type="button" onClick={onCancel} className="px-2 text-slate-500">Cancel</button>
      <span className="w-full text-xs text-slate-500">Fill the rest of the details directly in the table after creating.</span>
    </form>
  )
}
