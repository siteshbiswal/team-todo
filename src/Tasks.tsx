import { useCallback, useEffect, useState } from 'react'
import { supabase, type Instance, type Status } from './supabase'

const STATUSES: Status[] = ['Pending', 'In Progress', 'Done']

export default function Tasks({ mode }: { mode: 'today' | 'board' }) {
  const [rows, setRows] = useState<Instance[]>([])
  const [team, setTeam] = useState('All')
  const [error, setError] = useState('')
  const today = new Date().toLocaleDateString('en-CA')

  const load = useCallback(async () => {
    let q = supabase.from('task_instances')
      .select('id,due_date,status,remarks,task_templates(team,title,freq_text,res1,res2,final_res)')
      .order('due_date', { ascending: false }).limit(500)
    q = mode === 'today' ? q.lte('due_date', today).neq('status', 'Done') : q.gte('due_date', today)
    const { data, error } = await q
    if (error) setError(error.message)
    else setRows(data as unknown as Instance[])
  }, [mode, today])

  useEffect(() => { load() }, [load])

  async function update(id: number, patch: Partial<Pick<Instance, 'status' | 'remarks'>>) {
    const extra = patch.status ? { done_at: patch.status === 'Done' ? new Date().toISOString() : null } : {}
    const { error } = await supabase.from('task_instances').update({ ...patch, ...extra }).eq('id', id)
    if (error) setError(error.message)
    else setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  const teams = ['All', ...new Set(rows.map(r => r.task_templates.team))]
  const shown = rows.filter(r => team === 'All' || r.task_templates.team === team)

  return (
    <div>
      {mode === 'board' && (
        <select value={team} onChange={e => setTeam(e.target.value)} className="mb-3 rounded border p-1">
          {teams.map(t => <option key={t}>{t}</option>)}
        </select>
      )}
      {error && <p className="mb-2 text-red-600">{error}</p>}
      {shown.length === 0 && <p className="text-slate-500">Nothing here.</p>}
      <ul className="flex flex-col gap-2">
        {shown.map(r => (
          <li key={r.id} className="rounded border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{r.task_templates.title}</p>
                <p className="text-xs text-slate-500">
                  {r.task_templates.team} · {r.task_templates.freq_text} · due {r.due_date}
                  {r.due_date < today && <span className="ml-1 text-red-600">overdue</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {[r.task_templates.res1, r.task_templates.res2, r.task_templates.final_res].filter(Boolean).join(' → ')}
                </p>
              </div>
              <select value={r.status} onChange={e => update(r.id, { status: e.target.value as Status })}
                className="rounded border p-1 text-sm">
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
