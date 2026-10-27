import { useCallback, useEffect, useState } from 'react'
import { Link } from './router'
import { supabase } from './supabase'
import { useToast } from './toast'
import { addDays, inr, today } from './lib'

interface Source {
  label: string; path: string; view: string; table: string
  select: string; open: (q: any) => any
  title: (r: any) => string; sub: (r: any) => string
}

const SOURCES: Source[] = [
  { label: 'Outstanding payments', path: '/outstanding', view: 'outstanding_v', table: 'outstanding',
    select: 'id,client,po_no,balance,days_overdue,next_followup', open: q => q.gt('balance', 0),
    title: r => r.client, sub: r => `PO ${r.po_no ?? '-'} · ₹${inr(r.balance)} due · ${r.days_overdue ?? 0} days` },
  { label: 'Tenders', path: '/tenders', view: 'tenders', table: 'tenders',
    select: 'id,bid_no,client,status,bid_open_date,next_followup', open: q => q.in('status', ['To Quote', 'Quoted']),
    title: r => `${r.bid_no} — ${r.client ?? ''}`, sub: r => `${r.status}${r.bid_open_date ? ` · opens ${r.bid_open_date}` : ''}` },
  { label: 'Deliveries', path: '/logistics', view: 'logistics_v', table: 'logistics',
    select: 'id,po_no,client,item,delivery_status,next_followup', open: q => q.neq('delivery_status', 'Delivered'),
    title: r => `${r.po_no} — ${r.client ?? ''}`, sub: r => `${r.item ?? ''} · ${r.delivery_status}` },
  { label: 'Sourcing', path: '/sourcing', view: 'sourcing', table: 'sourcing',
    select: 'id,item_spec,status,required_by,next_followup', open: q => q.neq('status', 'Closed'),
    title: r => r.item_spec, sub: r => `${r.status}${r.required_by ? ` · needed by ${r.required_by}` : ''}` },
]

export default function Followups() {
  const toast = useToast()
  const [data, setData] = useState<Record<string, any[]>>({})
  const [unscheduled, setUnscheduled] = useState(0)
  const [next, setNext] = useState<Record<string, string>>({})
  const t = today()

  const load = useCallback(async () => {
    const out: Record<string, any[]> = {}
    await Promise.all(SOURCES.map(async s => {
      const { data: rows, error } = await s.open(supabase.from(s.view).select(s.select)).lte('next_followup', t).order('next_followup').limit(200)
      if (error) toast(error.message, 'error')
      out[s.view] = rows ?? []
    }))
    setData(out)
    const { count } = await supabase.from('outstanding').select('id', { count: 'exact', head: true }).gt('balance', 0).is('next_followup', null)
    setUnscheduled(count ?? 0)
  }, [t, toast])

  useEffect(() => { load() }, [load])

  async function log(s: Source, r: any) {
    const key = `${s.view}-${r.id}`
    const patch: Record<string, string> = { next_followup: next[key] || addDays(t, 3) }
    if (s.table !== 'tenders' && s.table !== 'sourcing') patch.last_followup = t
    const { error } = await supabase.from(s.table).update(patch).eq('id', r.id)
    if (error) toast(error.message, 'error')
    else { toast('Follow-up logged'); load() }
  }

  const total = SOURCES.reduce((n, s) => n + (data[s.view]?.length ?? 0), 0)
  if (total === 0 && unscheduled === 0) return null

  return (
    <section className="mb-6 rounded border border-amber-300 bg-amber-50 p-3">
      <h2 className="mb-2 font-semibold">Follow-ups due ({total})</h2>
      {unscheduled > 0 && (
        <p className="mb-2 text-sm">
          <Link to="/outstanding" className="underline">{unscheduled} outstanding payment(s)</Link> have a balance but no next follow-up date.
        </p>
      )}
      {SOURCES.filter(s => data[s.view]?.length).map(s => (
        <div key={s.view} className="mb-3">
          <Link to={s.path} className="text-sm font-medium underline">{s.label} ({data[s.view].length})</Link>
          <ul className="mt-1 flex flex-col gap-1">
            {data[s.view].map(r => {
              const key = `${s.view}-${r.id}`
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-white p-2 text-sm">
                  <span>
                    <b>{s.title(r)}</b>
                    <span className="block text-xs text-slate-500">{s.sub(r)} · due {r.next_followup}{r.next_followup < t ? ' (overdue)' : ''}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <input type="date" value={next[key] ?? addDays(t, 3)} onChange={e => setNext(n => ({ ...n, [key]: e.target.value }))} className="rounded border p-0.5 text-xs" aria-label="Next follow-up date" />
                    <button onClick={() => log(s, r)} className="rounded bg-slate-800 px-2 py-0.5 text-white">Done</button>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
