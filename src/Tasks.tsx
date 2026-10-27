import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, type Status } from './supabase'
import { useProfile } from './profile'
import { useToast } from './toast'
import { addDays, today } from './lib'
import Followups from './Followups'

const STATUSES: Status[] = ['Pending', 'In Progress', 'Done']

interface Item {
  id: number; due_date: string; status: Status; remarks: string | null; done_at: string | null
  task_templates: { team: string; title: string; freq_text: string; res1: string | null; res2: string | null; final_res: string | null }
}

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

  const name = profile?.name.toLowerCase() ?? ''
  const teams = useMemo(() => ['All', ...new Set(rows.map(r => r.task_templates.team))], [rows])
  const shown = rows.filter(r => {
    const tt = r.task_templates
    const owners = `${tt.res1 ?? ''} ${tt.res2 ?? ''} ${tt.final_res ?? ''}`.toLowerCase()
    if (team !== 'All' && tt.team !== team) return false
    if (status !== 'All' && r.status !== status) return false
    if (person && !owners.includes(person.toLowerCase())) return false
    if (mine && profile?.role !== 'member' && name && !`${tt.res1 ?? ''} ${tt.res2 ?? ''}`.toLowerCase().includes(name)) return false
    return true
  })
  const open = shown.filter(r => r.status !== 'Done')
  const done = shown.length - open.length

  return (
    <div>
      {mode === 'today' && <Followups />}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {mode === 'board' && (
          <>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded border p-1" aria-label="From" />
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded border p-1" aria-label="To" />
            <button className="rounded bg-slate-100 px-2 py-1 text-sm" onClick={() => { setFrom(addDays(t, -7)); setTo(t) }}>Last 7 days</button>
            <select value={status} onChange={e => setStatus(e.target.value)} className="rounded border p-1">
              {['All', ...STATUSES].map(s => <option key={s}>{s}</option>)}
            </select>
          </>
        )}
        <select value={team} onChange={e => setTeam(e.target.value)} className="rounded border p-1">
          {teams.map(x => <option key={x}>{x}</option>)}
        </select>
        <input value={person} onChange={e => setPerson(e.target.value)} placeholder="Person…" className="w-32 rounded border p-1" />
        {profile?.role !== 'member' && (
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> Only mine</label>
        )}
        {picked.size > 0 && <button onClick={bulkDone} className="ml-auto rounded bg-green-700 px-3 py-1 text-white">Mark {picked.size} done</button>}
      </div>
      <p className="mb-2 text-sm text-slate-500">{open.length} open{mode === 'board' ? ` · ${done} done` : ''}</p>
      {loading && <p className="text-slate-500">Loading…</p>}
      {!loading && shown.length === 0 && <p className="text-slate-500">{mode === 'today' ? 'All caught up 🎉' : 'Nothing in this range.'}</p>}
      <ul className="flex flex-col gap-2">
        {shown.map(r => (
          <li key={r.id} className={`rounded border p-3 ${r.status === 'Done' ? 'bg-green-50' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <label className="flex gap-2">
                {r.status !== 'Done' && (
                  <input type="checkbox" checked={picked.has(r.id)} aria-label="Select task"
                    onChange={e => setPicked(p => { const n = new Set(p); e.target.checked ? n.add(r.id) : n.delete(r.id); return n })} />
                )}
                <span>
                  <span className="font-medium">{r.task_templates.title}</span>
                  <span className="block text-xs text-slate-500">
                    {r.task_templates.team} · {r.task_templates.freq_text} · due {r.due_date}
                    {r.due_date < t && r.status !== 'Done' && <span className="ml-1 text-red-600">overdue {Math.round((Date.parse(t) - Date.parse(r.due_date)) / 864e5)}d</span>}
                    {r.done_at && <span className="ml-1 text-green-700">done {new Date(r.done_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {[r.task_templates.res1, r.task_templates.res2, r.task_templates.final_res].filter(Boolean).join(' → ')}
                  </span>
                </span>
              </label>
              <select value={r.status} onChange={e => update(r.id, { status: e.target.value as Status })} className="rounded border p-1 text-sm">
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <input defaultValue={r.remarks ?? ''} placeholder="Remarks"
              onBlur={e => e.target.value !== (r.remarks ?? '') && update(r.id, { remarks: e.target.value })}
              className="mt-2 w-full rounded border p-1 text-sm" />
          </li>
        ))}
      </ul>
    </div>
  )
}
