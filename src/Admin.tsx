import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useToast } from './toast'
import { today } from './lib'
import { useProfile } from './profile'
import { EmptyState, Segmented, Skeleton } from './ui'

interface Template {
  id: number; team: string; title: string; freq_text: string | null; freq_type: string
  freq_rule: { dow?: number; dom?: number; month?: number }
  res1: string | null; res2: string | null; final_res: string | null; remarks: string | null; active: boolean
}
interface Profile { id: string; name: string; role: 'member' | 'admin'; team: string | null; email: string | null; active: boolean }

const FREQS = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'per_event']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TEAMS = ['Sales / Pre-Sales', 'Tendering', 'Logistics Follow-up', 'Sourcing', 'Accounts', 'Admin']
const VIEWS = ['Tasks', 'Users', 'Audit log'] as const

export default function Admin() {
  const [view, setView] = useState<(typeof VIEWS)[number]>('Tasks')
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Admin</h1>
        <Segmented label="Admin section" value={view} options={VIEWS} onChange={setView} />
      </div>
      {view === 'Tasks' ? <TaskEditor /> : view === 'Users' ? <UserEditor /> : <AuditLog />}
    </div>
  )
}

function TaskEditor() {
  const toast = useToast()
  const [rows, setRows] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    supabase.from('task_templates').select('*').order('sl').then(({ data, error }) => {
      if (error) toast(error.message, 'error')
      else setRows(data as Template[])
      setLoading(false)
    })
  }, [toast])

  async function save(id: number, patch: Partial<Template>) {
    const { error } = await supabase.from('task_templates').update(patch).eq('id', id)
    if (error) toast(error.message, 'error')
    else setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  async function generate() {
    const { data, error } = await supabase.rpc('admin_generate_today')
    if (error) toast(error.message, 'error')
    else toast(`${data} new task(s) created for today`)
  }

  async function createToday(id: number) {
    const { error } = await supabase.from('task_instances').insert({ template_id: id, due_date: today() })
    if (error) toast(error.code === '23505' ? 'Already created for today' : error.message, 'error')
    else toast('Created for today')
  }

  const adding = useRef(false)
  async function add() {
    if (adding.current) return // one tap = one task
    adding.current = true
    // starts inactive so a half-filled task never lands on everyone's Today list; tick "Active" when ready
    const { data, error } = await supabase.from('task_templates')
      .insert({ team: 'Accounts', title: 'New task (edit me)', freq_type: 'daily', freq_text: 'Daily', active: false }).select().single()
    adding.current = false
    if (error) toast(error.message, 'error')
    else { setRows(rs => [data as Template, ...rs]); toast('Task added as inactive — fill it in, then tick Active') }
  }

  async function remove(r: Template) {
    if (!confirm(`Delete “${r.title}” and all its to-do history? Use Active=off to just stop it.`)) return
    const { error } = await supabase.from('task_templates').delete().eq('id', r.id)
    if (error) toast(error.message, 'error')
    else { setRows(rs => rs.filter(x => x.id !== r.id)); toast('Task deleted') }
  }

  const text = (r: Template, k: 'title' | 'res1' | 'res2' | 'final_res' | 'remarks', label: string) => (
    <label className="text-xs font-medium text-muted">{label}
      <input defaultValue={r[k] ?? ''} className="field mt-0.5 w-full" onBlur={e => e.target.value !== (r[k] ?? '') && save(r.id, { [k]: e.target.value || null })} />
    </label>
  )
  const num = (r: Template, k: 'dom' | 'month', label: string, max: number) => (
    <label className="text-xs font-medium text-muted">{label}
      <input type="number" min={1} max={max} defaultValue={r.freq_rule[k] ?? 1} className="field mt-0.5 block w-20"
        onBlur={e => save(r.id, { freq_rule: { ...r.freq_rule, [k]: +e.target.value } })} />
    </label>
  )

  const shown = rows.filter(r => (r.title + r.team + (r.res1 ?? '') + (r.res2 ?? '')).toLowerCase().includes(filter.toLowerCase()))

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search task, team or owner" aria-label="Search tasks" className="field min-w-[12rem] flex-1" />
        <button onClick={generate} className="btn" title="Creates today's task list now instead of waiting for the 6 AM run">Generate today</button>
        <button onClick={add} className="btn btn-primary">＋ Task</button>
      </div>
      {loading ? <Skeleton /> : shown.length === 0 ? <EmptyState title="No tasks match" /> : (
        <ul className="flex flex-col gap-3">
          {shown.map(r => (
            <li key={r.id} className={`card p-3 ${r.active ? '' : 'opacity-50'}`}>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="sm:col-span-2">{text(r, 'title', 'Task')}</div>
                <label className="text-xs font-medium text-muted">Team
                  <select value={r.team} className="field mt-0.5 block w-full" onChange={e => save(r.id, { team: e.target.value })}>
                    {[...new Set([...TEAMS, r.team])].map(t => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2">
                  <label className="text-xs font-medium text-muted">Repeats
                    <select value={r.freq_type} className="field mt-0.5 block" onChange={e => save(r.id, { freq_type: e.target.value, freq_text: e.target.value.replace('_', ' ') })}>
                      {FREQS.map(f => <option key={f} value={f}>{f.replace('_', ' ')}</option>)}
                    </select>
                  </label>
                  {r.freq_type === 'weekly' && (
                    <label className="text-xs font-medium text-muted">Day
                      <select value={r.freq_rule.dow ?? 6} className="field mt-0.5 block" onChange={e => save(r.id, { freq_rule: { dow: +e.target.value } })}>
                        {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                      </select>
                    </label>
                  )}
                  {(r.freq_type === 'monthly' || r.freq_type === 'yearly') && num(r, 'dom', 'Date', 31)}
                  {r.freq_type === 'yearly' && num(r, 'month', 'Month', 12)}
                </div>
                {text(r, 'res1', '1st responsible')}
                {text(r, 'res2', '2nd responsible')}
                {text(r, 'final_res', 'Final responsible')}
                {text(r, 'remarks', 'Remarks')}
              </div>
              <div className="mt-3 flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={r.active} onChange={e => save(r.id, { active: e.target.checked })} /> Active</label>
                {r.freq_type === 'per_event' && <button onClick={() => createToday(r.id)} className="btn ml-auto">Create for today</button>}
                <button onClick={() => remove(r)} className={`btn btn-ghost text-bad ${r.freq_type === 'per_event' ? '' : 'ml-auto'}`}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function UserEditor() {
  const toast = useToast()
  const { profile: me } = useProfile()
  const [rows, setRows] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('profiles').select('*').order('name').then(({ data, error }) => {
      if (error) toast(error.message, 'error')
      else setRows(data as Profile[])
      setLoading(false)
    })
  }, [toast])

  async function save(id: string, patch: Partial<Profile>) {
    const { error } = await supabase.from('profiles').update(patch).eq('id', id)
    if (error) toast(/at least one active admin/.test(error.message) ? 'There must always be at least one active admin.' : error.message, 'error')
    else setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  return (
    <div>
      <p className="mb-3 rounded-lg bg-info-soft px-3 py-2 text-sm text-info">
        Ask colleagues to open the app and sign in once — they appear here. A member sees to-dos where their <b>name</b> appears in 1st/2nd responsible (e.g. “Sutar”)
        and can edit the trackers of their <b>team</b>. Admins see every to-do, edit every tracker, see costs and margins, and manage users and tasks.
      </p>
      {rows.some(p => !p.active) && (
        <p className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
          {rows.filter(p => !p.active).length} account(s) waiting for approval. They can't see any data until you approve them.
        </p>
      )}
      {loading ? <Skeleton rows={3} /> : rows.length === 0 ? <EmptyState title="No users yet" /> : (
        <ul className="flex flex-col gap-2">
          {[...rows].sort((x, y) => Number(x.active) - Number(y.active)).map(p => (
            <li key={p.id} className={`card grid gap-2 p-3 sm:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto] sm:items-end ${p.active ? '' : 'border-warn/60'}`}>
              <label className="text-xs font-medium text-muted">Name (as in task sheet)
                <input defaultValue={p.name} className="field mt-0.5 w-full" onBlur={e => e.target.value && e.target.value !== p.name && save(p.id, { name: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-muted">Role
                <select value={p.role} disabled={p.id === me?.id} title={p.id === me?.id ? "You can't change your own role" : undefined}
                  className="field mt-0.5 block w-full" onChange={e => save(p.id, { role: e.target.value as Profile['role'] })}>
                  {['member', 'admin'].map(r => <option key={r}>{r}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-muted">Team
                <select value={p.team ?? ''} className="field mt-0.5 block w-full" onChange={e => save(p.id, { team: e.target.value || null })}>
                  <option value="">—</option>
                  {TEAMS.map(t => <option key={t}>{t}</option>)}
                </select>
              </label>
              <p className="truncate text-sm text-muted" title={p.email ?? ''}>{p.email ?? ''}</p>
              {p.active
                ? <button className="btn btn-ghost text-xs" disabled={p.id === me?.id} title={p.id === me?.id ? "You can't revoke yourself" : undefined}
                    onClick={() => confirm(`Revoke access for ${p.name}?`) && save(p.id, { active: false })}>Revoke</button>
                : <button className="btn btn-primary" onClick={() => save(p.id, { active: true })}>Approve</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface Audit { id: number; tbl: string; row_id: string | null; action: string; at: string; by_user: string | null; old_row: Record<string, unknown> | null; new_row: Record<string, unknown> | null }

function AuditLog() {
  const toast = useToast()
  const [rows, setRows] = useState<Audit[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [tbl, setTbl] = useState('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(300).then(({ data, error }) => {
      if (error) toast(error.message, 'error')
      else setRows(data as Audit[])
      setLoading(false)
    })
    supabase.from('profiles').select('id,name').then(({ data }) => setNames(Object.fromEntries((data ?? []).map(p => [p.id, p.name]))))
  }, [toast])

  const tables = ['All', ...new Set(rows.map(r => r.tbl))]
  const changed = (r: Audit) => {
    if (r.action !== 'UPDATE' || !r.old_row || !r.new_row) return r.action === 'INSERT' ? 'Created' : 'Deleted'
    return Object.keys(r.new_row).filter(k => !['updated_at', 'updated_by'].includes(k) && JSON.stringify(r.old_row![k]) !== JSON.stringify(r.new_row![k]))
      .map(k => `${k}: ${String(r.old_row![k] ?? '∅')} → ${String(r.new_row![k] ?? '∅')}`).join('; ') || 'No visible change'
  }

  return (
    <div>
      <select value={tbl} onChange={e => setTbl(e.target.value)} className="field mb-3" aria-label="Table">{tables.map(t => <option key={t}>{t}</option>)}</select>
      {loading ? <Skeleton /> : rows.length === 0 ? <EmptyState title="No changes recorded yet" hint="Every edit to trackers, tasks and users is logged here." /> : (
        <ul className="flex flex-col gap-1.5 text-sm">
          {rows.filter(r => tbl === 'All' || r.tbl === tbl).map(r => (
            <li key={r.id} className="card px-3 py-2">
              <span className="font-medium">{r.tbl}</span> <span className="text-muted">#{r.row_id} · {r.by_user ? names[r.by_user] ?? 'user' : 'system'} · {new Date(r.at).toLocaleString('en-IN')}</span>
              <span className="block break-words text-xs text-muted">{changed(r)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
