import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, type Status } from './supabase'
import { useProfile } from './profile'
import { useToast } from './toast'
import { addDays, today, trackerForTask } from './lib'
import { trackerById } from './trackers/configs'
import { EmptyState, Segmented, Skeleton, StatTile } from './ui'
import { Link } from './router'
import Followups from './Followups'

const STATUSES = ['Pending', 'In Progress', 'Done'] as const

interface Item {
  id: number; due_date: string; status: Status; remarks: string | null; done_at: string | null
  task_templates: { team: string; title: string; freq_text: string; res1: string | null; res2: string | null; final_res: string | null }
}

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
const daysBetween = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5)

export default function Tasks({ mode }: { mode: 'today' | 'board' }) {
  const { profile } = useProfile()
  const toast = useToast()
  const t = today()
  const [rows, setRows] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState('All')
  const [status, setStatus] = useState('All')
  const [person, setPerson] = useState('')
  const [mine, setMine] = useState(mode === 'today')
  const [from, setFrom] = useState(t)
  const [to, setTo] = useState(t)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [doneToday, setDoneToday] = useState(0)
  const [followups, setFollowups] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('task_instances')
      .select('id,due_date,status,remarks,done_at,task_templates(team,title,freq_text,res1,res2,final_res)')
      .order('due_date', { ascending: false }).limit(1000)
    q = mode === 'today' ? q.lte('due_date', t).neq('status', 'Done') : q.gte('due_date', from).lte('due_date', to)
    const { data, error } = await q
    if (error) toast(error.message, 'error')
    else setRows(data as unknown as Item[])
    setPicked(new Set())
    setLoading(false)
    if (mode === 'today') {
      const { count } = await supabase.from('task_instances').select('id', { count: 'exact', head: true }).eq('due_date', t).eq('status', 'Done')
      setDoneToday(count ?? 0)
    }
  }, [mode, t, from, to, toast])

  useEffect(() => { load() }, [load])

  async function update(id: number, patch: { status?: Status; remarks?: string }) {
    const prev = rows
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)))
    const { error } = await supabase.from('task_instances').update(patch).eq('id', id)
    if (error) { setRows(prev); toast(error.message, 'error') }
    else if (patch.status) load()
  }

  async function bulkDone() {
    const ids = [...picked]
    const { error } = await supabase.from('task_instances').update({ status: 'Done' }).in('id', ids)
    if (error) toast(error.message, 'error')
    else { toast(`${ids.length} task(s) marked done`); load() }
  }

  async function exportXlsx() {
    const { default: writeXlsxFile } = await import('write-excel-file/browser')
    const head = ['Due', 'Team', 'Task', 'Frequency', '1st Res.', '2nd Res.', 'Final Res.', 'Status', 'Date Done', 'Remarks'].map(v => ({ value: v, fontWeight: 'bold' as const }))
    const s = (v: unknown) => (v ? { value: String(v), type: String } : null)
    const body = shown.map(r => [s(r.due_date), s(r.task_templates.team), s(r.task_templates.title), s(r.task_templates.freq_text), s(r.task_templates.res1),
      s(r.task_templates.res2), s(r.task_templates.final_res), s(r.status), s(r.done_at && new Date(r.done_at).toLocaleString('en-IN')), s(r.remarks)])
    await writeXlsxFile([head, ...body] as never, { sheet: 'Team To-Do' }).toFile(`Tasks-${from}-to-${to}.xlsx`)
  }

  const name = profile?.name.toLowerCase() ?? ''
  const isMine = (r: Item) => `${r.task_templates.res1 ?? ''} ${r.task_templates.res2 ?? ''}`.toLowerCase().includes(name)
  const [mineChecked, setMineChecked] = useState(false)
  useEffect(() => {
    // admins whose name appears in no task would otherwise see an empty list on first load
    if (loading || mineChecked || mode !== 'today') return
    setMineChecked(true)
    if (profile?.role !== 'member' && !rows.some(isMine)) setMine(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, rows])
  const teams = useMemo(() => ['All', ...new Set(rows.map(r => r.task_templates.team))], [rows])
  const shown = rows.filter(r => {
    const tt = r.task_templates
    const owners = `${tt.res1 ?? ''} ${tt.res2 ?? ''} ${tt.final_res ?? ''}`.toLowerCase()
    if (team !== 'All' && tt.team !== team) return false
    if (status !== 'All' && r.status !== status) return false
    if (person && !owners.includes(person.toLowerCase())) return false
    if (mine && profile?.role !== 'member' && name && !isMine(r)) return false
    return true
  })
  const open = shown.filter(r => r.status !== 'Done')
  const hiddenByMine = mine && profile?.role !== 'member' ? rows.filter(r => !isMine(r) && (status === 'All' || r.status === status)).length : 0
  const overdue = open.filter(r => r.due_date < t).length
  const groups = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const r of shown) m.set(r.task_templates.team, [...(m.get(r.task_templates.team) ?? []), r])
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [shown])

  return (
    <div className="pb-16">
      {mode === 'today' ? (
        <>
          <div className="mb-4">
            <h1 className="text-xl font-semibold">{greeting()}{profile ? `, ${profile.name.split(' ')[0]}` : ''}</h1>
            <p className="text-sm text-muted">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              {profile?.role === 'member' && <> · showing tasks where you're “{profile.name}”</>}</p>
          </div>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Open today" value={open.filter(r => r.due_date === t).length} />
            <StatTile label="Overdue" value={overdue} tone={overdue ? 'bad' : undefined} />
            <StatTile label="Follow-ups due" value={followups} tone={followups ? 'warn' : undefined} />
            <StatTile label="Done today" value={doneToday} tone={doneToday ? 'good' : undefined} />
          </div>
          <Followups onCount={setFollowups} />
        </>
      ) : <h1 className="mb-3 text-xl font-semibold">Board</h1>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {mode === 'board' && (
          <>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="field" aria-label="From" />
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="field" aria-label="To" />
            <button className="btn" onClick={() => { setFrom(t); setTo(t) }}>Today</button>
            <button className="btn" onClick={() => { setFrom(addDays(t, -7)); setTo(t) }}>Last 7 days</button>
            <select value={status} onChange={e => setStatus(e.target.value)} className="field" aria-label="Status">
              {['All', ...STATUSES].map(s => <option key={s}>{s}</option>)}
            </select>
          </>
        )}
        <select value={team} onChange={e => setTeam(e.target.value)} className="field" aria-label="Team">{teams.map(x => <option key={x}>{x}</option>)}</select>
        <input value={person} onChange={e => setPerson(e.target.value)} placeholder="Person…" className="field w-32" aria-label="Person" />
        {profile?.role !== 'member' && (
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> Only mine</label>
        )}
        {mode === 'board' && <button className="btn ml-auto" onClick={exportXlsx} disabled={!shown.length}>Export</button>}
      </div>

      {hiddenByMine > 0 && !loading && (
        <p className="mb-3 rounded-lg bg-info-soft px-3 py-2 text-sm text-info">
          {hiddenByMine} task{hiddenByMine > 1 ? 's' : ''} assigned to others {hiddenByMine > 1 ? 'are' : 'is'} hidden by “Only mine”. <button className="font-medium underline" onClick={() => setMine(false)}>Show all</button>
        </p>
      )}
      {loading ? <Skeleton /> : shown.length === 0 ? (
        <EmptyState icon={mode === 'today' ? '🎉' : '📭'} title={mode === 'today' ? 'All caught up' : 'Nothing in this range'}
          hint={mode === 'today' ? 'No open tasks. If you expected some, ask an admin to check that your name matches the task owners.' : 'Try a wider date range or another team.'} />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([g, items]) => (
            <details key={g} open className="group">
              <summary className="mb-2 flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
                <span className="text-muted transition-transform group-open:rotate-90" aria-hidden>›</span>
                {g} <span className="badge tone-neutral">{items.filter(i => i.status !== 'Done').length} open</span>
              </summary>
              <ul className="flex flex-col gap-2">
                {items.map(r => <TaskCard key={r.id} r={r} today={t} picked={picked.has(r.id)}
                  onPick={on => setPicked(p => { const n = new Set(p); if (on) n.add(r.id); else n.delete(r.id); return n })} onUpdate={update} />)}
              </ul>
            </details>
          ))}
        </div>
      )}

      {picked.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-center gap-3 border-t border-line bg-card px-4 py-3 shadow-lg">
          <span className="text-sm">{picked.size} selected</span>
          <button onClick={bulkDone} className="btn btn-primary">Mark done</button>
          <button onClick={() => setPicked(new Set())} className="btn btn-ghost">Clear</button>
        </div>
      )}
    </div>
  )
}

function TaskCard({ r, today: t, picked, onPick, onUpdate }: {
  r: Item; today: string; picked: boolean; onPick: (on: boolean) => void
  onUpdate: (id: number, patch: { status?: Status; remarks?: string }) => void
}) {
  const tt = r.task_templates
  const done = r.status === 'Done'
  const [note, setNote] = useState(Boolean(r.remarks))
  const tracker = trackerForTask(tt.title, tt.team)
  const late = !done && r.due_date < t ? daysBetween(t, r.due_date) : 0
  const owners = [tt.res1, tt.res2, tt.final_res].filter(Boolean)

  return (
    <li className={`card p-3 ${done ? 'bg-good-soft/30' : late ? 'border-bad/40' : ''}`}>
      <div className="flex items-start gap-3">
        <button onClick={() => onUpdate(r.id, { status: done ? 'Pending' : 'Done' })} aria-label={done ? 'Mark as pending' : 'Mark as done'}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm ${done ? 'border-good bg-good text-brand-ink' : 'border-line hover:border-good'}`}>{done ? '✓' : ''}</button>
        <div className="min-w-0 flex-1">
          <p className={`font-medium [overflow-wrap:anywhere] ${done ? 'text-muted line-through' : ''}`}>{tt.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span>{tt.freq_text}</span><span>· due {r.due_date}</span>
            {late > 0 && <span className="badge tone-bad">Overdue {late}d</span>}
            {r.done_at && <span className="text-good">done {new Date(r.done_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>}
            {owners.length > 0 && <span>· {owners.join(' → ')}</span>}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Segmented label="Status" value={r.status} options={STATUSES} onChange={s => onUpdate(r.id, { status: s })} />
            {tracker && <Link to={`/${trackerById(tracker).path}`} className="badge tone-info hover:underline">Open {trackerById(tracker).title} ↗</Link>}
            {!note && <button className="text-xs text-muted underline" onClick={() => setNote(true)}>＋ note</button>}
            {!done && <label className="ml-auto flex items-center gap-1 text-xs text-muted"><input type="checkbox" checked={picked} onChange={e => onPick(e.target.checked)} aria-label="Select for bulk action" /> select</label>}
          </div>
          {note && (
            <input defaultValue={r.remarks ?? ''} placeholder="Remarks" aria-label="Remarks" autoFocus={!r.remarks}
              onBlur={e => e.target.value !== (r.remarks ?? '') && onUpdate(r.id, { remarks: e.target.value })} className="field mt-2 w-full" />
          )}
        </div>
      </div>
    </li>
  )
}
