import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useProfile } from './profile'
import { useTracker } from './useTracker'
import { filterRows, inr, sortRows, statusTone, sumBy, today, type Row } from './lib'
import { Badge, EmptyState, Skeleton } from './ui'
import RowDrawer from './RowDrawer'
import type { Column, TrackerConfig } from './trackers/types'

const PAGE = 50
const WIDE = ['client', 'item', 'item_spec', 'remarks', 'complaint', 'contact', 'title', 'vendor', 'make_vendor']
const colWidth = (c: Column) =>
  WIDE.includes(c.key) ? 'min-w-[13rem]' : c.type === 'date' ? 'min-w-[9rem]' : c.type === 'money' ? 'min-w-[8rem]' : c.type === 'number' ? 'min-w-[5.5rem]' : c.type === 'select' ? 'min-w-[9rem]' : 'min-w-[9rem]'
const isStatusLike = (k: string) => k === 'status' || k.endsWith('_status') || k === 'under_warranty'

export default function TrackerTable({ cfg, initial }: { cfg: TrackerConfig; initial: { q: string; status: string } }) {
  const { profile } = useProfile()
  const { rows, loading, load, save, remove, add, importXlsx, refreshRow } = useTracker(cfg)
  const [search, setSearch] = useState(initial.q)
  const [status, setStatus] = useState(initial.status || 'All')
  const [sort, setSort] = useState(cfg.defaultSort)
  const [page, setPage] = useState(0)
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<unknown>(null)
  const [poNos, setPoNos] = useState<string[]>([])
  const [hidden, setHidden] = useState<string[]>([])
  const [colMenu, setColMenu] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const role = profile?.role ?? 'member'
  const isAdmin = role === 'admin'
  const canEdit = role !== 'member' || cfg.editTeams.includes(profile?.team ?? '')
  const allCols = useMemo(() => cfg.columns.filter(c => !c.cost || role !== 'member'), [cfg, role])
  const cols = allCols.filter(c => !hidden.includes(c.key))
  const poPickerCol = cfg.columns.find(c => c.poPicker)
  const todayStr = today()

  // reset view state when switching tracker or following a deep link (#/tenders?status=Won)
  useEffect(() => {
    setSearch(initial.q); setStatus(initial.status || 'All'); setSort(cfg.defaultSort); setPage(0); setAdding(false); setOpenId(null)
    try { setHidden(JSON.parse(localStorage.getItem(`cols:${cfg.id}`) ?? '[]')) } catch { setHidden([]) }
  }, [cfg, initial.q, initial.status])

  useEffect(() => {
    if (!poPickerCol) return
    supabase.from('po_tracker').select('po_no').order('po_no').then(({ data }) => setPoNos((data ?? []).map(r => r.po_no as string)))
  }, [poPickerCol])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === '/' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) { e.preventDefault(); searchRef.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const statusCol = cfg.columns.find(c => c.key === cfg.statusKey)
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rows) { const s = String(r[cfg.statusKey ?? ''] ?? ''); m[s] = (m[s] ?? 0) + 1 }
    return m
  }, [rows, cfg.statusKey])

  const shown = useMemo(
    () => sortRows(filterRows(rows, search, cfg.searchKeys, cfg.statusKey, status), sort.key, sort.dir),
    [rows, search, status, sort, cfg],
  )
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const visible = shown.slice(page * PAGE, page * PAGE + PAGE)
  const moneyCols = cols.filter(c => c.type === 'money')
  const openRow = rows.find(r => r.id === openId) ?? null

  function toggleCol(key: string) {
    const next = hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key]
    setHidden(next)
    try { localStorage.setItem(`cols:${cfg.id}`, JSON.stringify(next)) } catch { /* private mode */ }
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
    await writeXlsxFile([header, ...body] as never).toFile(`${cfg.title}-${todayStr}.xlsx`)
  }

  function cell(row: Row, c: Column) {
    const v = row[c.key]
    if (c.computed || !canEdit || c.poPicker) {
      if (isStatusLike(c.key)) return <span className="block px-1"><Badge value={v} /></span>
      const txt = c.type === 'money' ? inr(v) : c.key === 'margin_pct' && v != null ? `${v}%` : String(v ?? '')
      return <span className={`block min-w-[4rem] px-1 ${c.computed || c.poPicker ? 'font-medium' : ''}`}>{txt}</span>
    }
    const common = 'w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm text-ink hover:border-line focus:border-accent focus:bg-card'
    if (c.type === 'select') {
      const tone = isStatusLike(c.key) ? `tone-${statusTone(v)} font-medium` : ''
      return (
        <select value={String(v ?? '')} className={`${common} ${tone}`} aria-label={c.label} onChange={e => save(row, c, e.target.value)}>
          <option value="" />
          {c.options!.map(o => <option key={o}>{o}</option>)}
        </select>
      )
    }
    return (
      <input key={`${row.id}-${c.key}-${String(v ?? '')}`} defaultValue={String(v ?? '')} aria-label={c.label}
        type={c.type === 'date' ? 'date' : 'text'} inputMode={c.type === 'number' || c.type === 'money' ? 'decimal' : undefined}
        className={common} onBlur={e => save(row, c, e.target.value)}
        onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
    )
  }

  const arrow = (k: string) => (sort.key === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')
  const cardVal = (r: Row, key: string) => {
    const c = cfg.columns.find(x => x.key === key)!
    const v = r[key]
    if (v === null || v === undefined || v === '') return null
    if (isStatusLike(key)) return <Badge value={v} />
    const val = c.type === 'money' ? `₹${inr(v)}` : key === 'days_overdue' ? `${v} days` : String(v)
    return <span><span className="text-xs opacity-70">{c.label}: </span><span className="text-ink">{val}</span></span>
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-1 text-xl font-semibold">{cfg.title} <span className="text-sm font-normal text-muted">{loading ? '' : `${shown.length}${shown.length !== rows.length ? ` of ${rows.length}` : ''}`}</span></h1>
        <input ref={searchRef} value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Search…  ( / )" aria-label="Search"
          className="field min-w-[10rem] flex-1 sm:max-w-xs" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {canEdit && <button onClick={() => setAdding(a => !a)} className="btn btn-primary">＋ Add</button>}
          <div className="relative hidden md:block">
            <button className="btn" onClick={() => setColMenu(m => !m)} aria-expanded={colMenu}>Columns</button>
            {colMenu && (
              <div className="card absolute right-0 z-20 mt-1 max-h-80 w-56 overflow-auto p-2 shadow-lg" onMouseLeave={() => setColMenu(false)}>
                {allCols.map(c => (
                  <label key={c.key} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-hover">
                    <input type="checkbox" checked={!hidden.includes(c.key)} onChange={() => toggleCol(c.key)} /> {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button onClick={load} className="btn" aria-label="Refresh">↻</button>
          <button onClick={exportXlsx} className="btn">Export</button>
          {isAdmin && (
            <>
              <button onClick={() => fileRef.current?.click()} className="btn">Import</button>
              <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importXlsx(f); e.target.value = '' }} />
            </>
          )}
        </div>
      </div>

      {statusCol && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter by status">
          {['All', ...statusCol.options!].map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(0) }} aria-pressed={status === s} className={`pill border border-line ${status === s ? 'pill-on' : ''}`}>
              {s}{s !== 'All' && <span className="ml-1 opacity-70">{statusCounts[s] ?? 0}</span>}
            </button>
          ))}
        </div>
      )}

      {!canEdit && <p className="mb-3 rounded-lg bg-info-soft px-3 py-2 text-sm text-info">View only — your team ({profile?.team ?? 'no team set'}) doesn't maintain this tracker.</p>}
      {adding && <AddForm cfg={cfg} poNos={poNos} onSubmit={async v => { const id = await add(v); if (id) { setAdding(false); setOpenId(id) } }} onCancel={() => setAdding(false)} />}

      {loading ? <Skeleton rows={6} /> : visible.length === 0 ? (
        <EmptyState icon="🔎" title={rows.length ? 'Nothing matches your filters' : `No ${cfg.title.toLowerCase()} yet`}
          hint={rows.length ? 'Clear the search or choose “All”.' : canEdit ? 'Use ＋ Add to create the first row' + (isAdmin ? ', or Import the Excel workbook.' : '.') : undefined} />
      ) : (
        <>
          {/* desktop table */}
          <div className="card hidden overflow-auto md:block" style={{ maxHeight: '70vh' }}>
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-hover">
                <tr>
                  <th className="w-8 border-b border-line" />
                  {cols.map(c => (
                    <th key={c.key} onClick={() => setSort(s => ({ key: c.key, dir: s.key === c.key && s.dir === 'asc' ? 'desc' : 'asc' }))} aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className={`cursor-pointer whitespace-nowrap border-b border-line px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted ${colWidth(c)}`}>
                      {c.label}{arrow(c.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr key={String(r.id)} className={`border-b border-line ${cfg.rowClass?.(r, todayStr) ?? ''}`}>
                    <td className="px-1"><button className="btn btn-ghost !min-h-0 px-1.5 py-0.5" onClick={() => setOpenId(r.id)} aria-label="Open details" title="Open details">⤢</button></td>
                    {cols.map(c => <td key={c.key} className={`px-1 py-1 align-top ${colWidth(c)}`}>{cell(r, c)}</td>)}
                  </tr>
                ))}
              </tbody>
              {moneyCols.length > 0 && (
                <tfoot className="sticky bottom-0 bg-hover font-semibold">
                  <tr>
                    <td className="px-2 py-2 text-xs uppercase text-muted" colSpan={1 + cols.findIndex(c => c.type === 'money')}>Total ({shown.length})</td>
                    {cols.slice(cols.findIndex(c => c.type === 'money')).map(c => <td key={c.key} className="px-2 py-2">{c.type === 'money' ? inr(sumBy(shown, c.key)) : ''}</td>)}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* mobile cards */}
          <ul className="flex flex-col gap-2 md:hidden">
            {visible.map(r => (
              <li key={String(r.id)}>
                <button onClick={() => setOpenId(r.id)} className={`card w-full px-3 py-2.5 text-left ${cfg.rowClass?.(r, todayStr) ?? ''}`}>
                  <span className="block font-medium">{String(r[cfg.cardFields[0]] ?? '—')}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                    {cfg.cardFields.slice(1).map(k => <span key={k}>{cardVal(r, k)}</span>)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between text-sm text-muted">
            <span>{moneyCols.length > 0 && <span className="md:hidden">Total {inr(sumBy(shown, moneyCols[0].key))} · </span>}{shown.length} rows</span>
            <span className="flex items-center gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn">Prev</button>
              {page + 1} / {pages}
              <button disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)} className="btn">Next</button>
            </span>
          </div>
        </>
      )}

      {openRow && (
        <RowDrawer cfg={cfg} row={openRow} cols={allCols} canEdit={canEdit} isAdmin={isAdmin} onSave={save} onDelete={remove}
          onChanged={() => refreshRow(openRow.id)} onClose={() => setOpenId(null)} />
      )}
    </div>
  )
}

function AddForm({ cfg, poNos, onSubmit, onCancel }: { cfg: TrackerConfig; poNos: string[]; onSubmit: (v: Record<string, string>) => void; onCancel: () => void }) {
  const [v, setV] = useState<Record<string, string>>({})
  const req = cfg.columns.filter(c => c.required)
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(v) }} className="card mb-3 flex flex-wrap items-end gap-3 p-3">
      {req.map((c, i) => (
        <label key={c.key} className="text-xs font-medium text-muted">{c.label} *
          {c.poPicker ? (
            <select required value={v[c.key] ?? ''} onChange={e => setV({ ...v, [c.key]: e.target.value })} className="field mt-0.5 block">
              <option value="">Select PO…</option>
              {poNos.map(p => <option key={p}>{p}</option>)}
            </select>
          ) : (
            <input required autoFocus={i === 0} value={v[c.key] ?? ''} onChange={e => setV({ ...v, [c.key]: e.target.value })} inputMode={c.type === 'money' || c.type === 'number' ? 'decimal' : undefined} className="field mt-0.5 block" />
          )}
        </label>
      ))}
      <button className="btn btn-primary">Create &amp; open</button>
      <button type="button" onClick={onCancel} className="btn btn-ghost">Cancel</button>
    </form>
  )
}
