import { useEffect, useState } from 'react'
import { supabase } from './supabase'

interface Template {
  id: number; team: string; title: string; freq_text: string | null; freq_type: string
  freq_rule: { dow?: number; dom?: number; month?: number }
  res1: string | null; res2: string | null; final_res: string | null; remarks: string | null; active: boolean
}
interface Profile { id: string; name: string; role: 'member' | 'head' | 'admin'; team: string | null }

const FREQS = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'per_event']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Admin() {
  const [view, setView] = useState<'tasks' | 'users' | 'audit'>('tasks')
  return (
    <div>
      <div className="mb-3 flex gap-2">
        {(['tasks', 'users', 'audit'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`rounded px-3 py-1 capitalize ${view === v ? 'bg-slate-300' : 'bg-slate-100'}`}>{v}</button>
        ))}
      </div>
      {view === 'tasks' ? <TaskEditor /> : view === 'users' ? <UserEditor /> : <AuditLog />}
    </div>
  )
}

function TaskEditor() {
  const [rows, setRows] = useState<Template[]>([])
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    supabase.from('task_templates').select('*').order('sl').then(({ data, error }) => {
      if (error) setError(error.message)
      else setRows(data as Template[])
    })
  }, [])

  async function save(id: number, patch: Partial<Template>) {
    setError('')
    const { error } = await supabase.from('task_templates').update(patch).eq('id', id)
    if (error) setError(error.message)
    else setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  async function generate() {
    setError(''); setInfo('')
    const { data, error } = await supabase.rpc('admin_generate_today')
    if (error) setError(error.message)
    else setInfo(`${data} new task(s) created for today.`)
  }

  async function createToday(id: number) {
    setError(''); setInfo('')
    const { error } = await supabase.from('task_instances')
      .insert({ template_id: id, due_date: new Date().toLocaleDateString('en-CA') })
    if (error) setError(error.code === '23505' ? 'Already created for today.' : error.message)
    else setInfo('Created for today.')
  }

  async function add() {
    const { data, error } = await supabase.from('task_templates')
      .insert({ team: 'Accounts', title: 'New task', freq_type: 'daily', freq_text: 'Daily' }).select().single()
    if (error) setError(error.message)
    else setRows(rs => [data as Template, ...rs])
  }

  const text = (r: Template, k: 'team' | 'title' | 'res1' | 'res2' | 'final_res' | 'remarks', label: string) => (
    <label className="text-xs text-slate-500">{label}
      <input defaultValue={r[k] ?? ''} className="mt-0.5 w-full rounded border p-1 text-sm text-black"
        onBlur={e => e.target.value !== (r[k] ?? '') && save(r.id, { [k]: e.target.value || null })} />
    </label>
  )

  const shown = rows.filter(r => (r.title + r.team + (r.res1 ?? '')).toLowerCase().includes(filter.toLowerCase()))

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search task, team or owner"
          className="flex-1 rounded border p-1" />
        <button onClick={generate} className="rounded bg-slate-100 px-3 text-sm">Generate today</button>
        <button onClick={add} className="rounded bg-slate-800 px-3 text-white">+ Task</button>
      </div>
      {info && <p className="mb-2 text-green-700">{info}</p>}
      {error && <p className="mb-2 text-red-600">{error}</p>}
      <ul className="flex flex-col gap-3">
        {shown.map(r => (
          <li key={r.id} className={`rounded border p-3 ${r.active ? '' : 'opacity-50'}`}>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="sm:col-span-2">{text(r, 'title', 'Task')}</div>
              {text(r, 'team', 'Team')}
              <div className="flex gap-2">
                <label className="text-xs text-slate-500">Frequency
                  <select value={r.freq_type} className="mt-0.5 block rounded border p-1 text-sm text-black"
                    onChange={e => save(r.id, { freq_type: e.target.value, freq_text: e.target.value })}>
                    {FREQS.map(f => <option key={f}>{f}</option>)}
                  </select>
                </label>
                {r.freq_type === 'weekly' && (
                  <label className="text-xs text-slate-500">Day
                    <select value={r.freq_rule.dow ?? 6} className="mt-0.5 block rounded border p-1 text-sm text-black"
                      onChange={e => save(r.id, { freq_rule: { dow: +e.target.value } })}>
                      {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                    </select>
                  </label>
                )}
                {(r.freq_type === 'monthly' || r.freq_type === 'yearly') && (
                  <label className="text-xs text-slate-500">Date
                    <input type="number" min={1} max={31} defaultValue={r.freq_rule.dom ?? 1}
                      className="mt-0.5 block w-16 rounded border p-1 text-sm text-black"
                      onBlur={e => save(r.id, { freq_rule: { ...r.freq_rule, dom: +e.target.value } })} />
                  </label>
                )}
                {r.freq_type === 'yearly' && (
                  <label className="text-xs text-slate-500">Month
                    <input type="number" min={1} max={12} defaultValue={r.freq_rule.month ?? 1}
                      className="mt-0.5 block w-16 rounded border p-1 text-sm text-black"
                      onBlur={e => save(r.id, { freq_rule: { ...r.freq_rule, month: +e.target.value } })} />
                  </label>
                )}
              </div>
              {text(r, 'res1', '1st responsible')}
              {text(r, 'res2', '2nd responsible')}
              {text(r, 'final_res', 'Final responsible')}
              {text(r, 'remarks', 'Remarks')}
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={r.active} onChange={e => save(r.id, { active: e.target.checked })} /> Active
              {r.freq_type === 'per_event' && (
                <button onClick={() => createToday(r.id)} className="ml-auto rounded bg-slate-100 px-2 py-0.5">Create for today</button>
              )}
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

function UserEditor() {
  const [rows, setRows] = useState<Profile[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('*').order('name').then(({ data, error }) => {
      if (error) setError(error.message)
      else setRows(data as Profile[])
    })
  }, [])

  async function save(id: string, patch: Partial<Profile>) {
    setError('')
    const { error } = await supabase.from('profiles').update(patch).eq('id', id)
    if (error) setError(error.message)
    else setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  return (
    <div>
      <p className="mb-2 text-sm text-slate-500">
        A member sees tasks where their <b>name</b> appears in 1st/2nd responsible (e.g. “Sutar”). Heads see their <b>team</b>. New users appear here after their first sign-in.
      </p>
      {error && <p className="mb-2 text-red-600">{error}</p>}
      <ul className="flex flex-col gap-2">
        {rows.map(p => (
          <li key={p.id} className="grid gap-2 rounded border p-3 sm:grid-cols-3">
            <input defaultValue={p.name} className="rounded border p-1" placeholder="Name as in task sheet"
              onBlur={e => e.target.value && e.target.value !== p.name && save(p.id, { name: e.target.value })} />
            <select value={p.role} className="rounded border p-1" onChange={e => save(p.id, { role: e.target.value as Profile['role'] })}>
              {['member', 'head', 'admin'].map(r => <option key={r}>{r}</option>)}
            </select>
            <input defaultValue={p.team ?? ''} className="rounded border p-1" placeholder="Team (for heads)"
              onBlur={e => e.target.value !== (p.team ?? '') && save(p.id, { team: e.target.value || null })} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function AuditLog() {
  const [rows, setRows] = useState<{ id: number; tbl: string; row_id: string | null; action: string; at: string; by_user: string | null; old_row: Record<string, unknown> | null; new_row: Record<string, unknown> | null }[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [tbl, setTbl] = useState('All')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(300).then(({ data, error }) => {
      if (error) setError(error.message)
      else setRows(data as never)
    })
    supabase.from('profiles').select('id,name').then(({ data }) => setNames(Object.fromEntries((data ?? []).map(p => [p.id, p.name]))))
  }, [])

  const tables = ['All', ...new Set(rows.map(r => r.tbl))]
  const changed = (r: (typeof rows)[number]) => {
    if (r.action !== 'UPDATE' || !r.old_row || !r.new_row) return r.action
    return Object.keys(r.new_row).filter(k => !['updated_at', 'updated_by'].includes(k) && JSON.stringify(r.old_row![k]) !== JSON.stringify(r.new_row![k]))
      .map(k => `${k}: ${String(r.old_row![k] ?? '')} → ${String(r.new_row![k] ?? '')}`).join('; ') || 'UPDATE'
  }

  return (
    <div>
      <select value={tbl} onChange={e => setTbl(e.target.value)} className="mb-3 rounded border p-1">{tables.map(t => <option key={t}>{t}</option>)}</select>
      {error && <p className="text-red-600">{error}</p>}
      <ul className="flex flex-col gap-1 text-sm">
        {rows.filter(r => tbl === 'All' || r.tbl === tbl).map(r => (
          <li key={r.id} className="rounded border p-2">
            <span className="font-medium">{r.tbl}</span> #{r.row_id} · {r.action} · {r.by_user ? names[r.by_user] ?? 'user' : 'system'} · {new Date(r.at).toLocaleString('en-IN')}
            <span className="block break-words text-xs text-slate-600">{changed(r)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
