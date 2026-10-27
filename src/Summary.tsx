import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { useProfile } from './profile'
import { addDays, agingBuckets, countBy, inr, summarizeTasks, today, topDebtors } from './lib'
import { PO_STATUSES } from './trackers/configs'

type R = Record<string, any>

export default function Summary() {
  const { profile } = useProfile()
  const t = today()
  const [from, setFrom] = useState(t)
  const [to, setTo] = useState(t)
  const [person, setPerson] = useState('')
  const [tasks, setTasks] = useState<R[]>([])
  const [out, setOut] = useState<R[]>([])
  const [tenders, setTenders] = useState<R[]>([])
  const [pos, setPos] = useState<R[]>([])
  const [svc, setSvc] = useState<R[]>([])
  const [src, setSrc] = useState<R[]>([])
  const seeMargin = profile?.role !== 'member'

  useEffect(() => {
    supabase.from('task_instances').select('status,task_templates(team,res1,res2)').gte('due_date', from).lte('due_date', to).limit(5000)
      .then(({ data }) => setTasks((data ?? []) as R[]))
  }, [from, to])

  useEffect(() => {
    const get = (view: string, cols: string, set: (r: R[]) => void) =>
      supabase.from(view).select(cols).limit(5000).then(({ data }) => set((data ?? []) as unknown as R[]))
    get('outstanding_v', 'client,balance,aging,days_overdue', setOut)
    get('tenders', 'status,emd_amt,emd_status', setTenders)
    get('po_v', seeMargin ? 'status,po_value,margin,client_delivery_due' : 'status,po_value,client_delivery_due', setPos)
    get('service_v', 'status,warranty_ends,under_warranty', setSvc)
    get('sourcing', 'status', setSrc)
  }, [seeMargin])

  const teamRows = useMemo(() => summarizeTasks(
    tasks
      .filter(r => !person || `${r.task_templates?.res1 ?? ''} ${r.task_templates?.res2 ?? ''}`.toLowerCase().includes(person.toLowerCase()))
      .map(r => ({ status: r.status, team: r.task_templates?.team ?? '—' })),
  ), [tasks, person])
  const totals = teamRows.reduce((a, r) => ({ total: a.total + r.total, done: a.done + r.done }), { total: 0, done: 0 })

  const owed = out.reduce((n, r) => n + Math.max(Number(r.balance), 0), 0)
  const aging = agingBuckets(out as never)
  const debtors = topDebtors(out as never)
  const tenderCounts = countBy(tenders, r => r.status)
  const emdPending = tenders.filter(r => r.emd_status === 'Pending').reduce((n, r) => n + Number(r.emd_amt ?? 0), 0)
  const poCounts = countBy(pos, r => r.status)
  const lateDeliveries = pos.filter(r => r.client_delivery_due && r.client_delivery_due < t && !['Delivered', 'Commissioned', 'Closed'].includes(r.status)).length
  const margin = pos.reduce((n, r) => n + Number(r.margin ?? 0), 0)
  const openCalls = svc.filter(r => r.status !== 'Closed').length
  const expiring = svc.filter(r => r.warranty_ends && r.warranty_ends >= t && r.warranty_ends <= addDays(t, 30)).length
  const awaiting = src.filter(r => r.status === 'Enquiry Sent').length

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 font-semibold">To-do completion</h2>
        <div className="mb-2 flex flex-wrap gap-2">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded border p-1" aria-label="From" />
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded border p-1" aria-label="To" />
          <button className="rounded bg-slate-100 px-2 text-sm" onClick={() => { setFrom(addDays(t, -6)); setTo(t) }}>Last 7 days</button>
          <button className="rounded bg-slate-100 px-2 text-sm" onClick={() => { setFrom(addDays(t, -29)); setTo(t) }}>Last 30 days</button>
          <input value={person} onChange={e => setPerson(e.target.value)} placeholder="Person…" className="w-32 rounded border p-1" />
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead><tr className="border-b"><th>Team</th><th>Total</th><th>Done</th><th>Pending</th><th>% Done</th></tr></thead>
            <tbody>
              {teamRows.map(r => (
                <tr key={r.team} className="border-b">
                  <td className="py-1">{r.team}</td><td>{r.total}</td><td>{r.done}</td><td>{r.pending}</td>
                  <td><span className="mr-2 inline-block h-2 w-16 rounded bg-slate-200 align-middle"><span className="block h-2 rounded bg-green-600" style={{ width: `${r.pct}%` }} /></span>{r.pct}%</td>
                </tr>
              ))}
              <tr className="font-semibold"><td className="py-1">Total</td><td>{totals.total}</td><td>{totals.done}</td><td>{totals.total - totals.done}</td>
                <td>{totals.total ? Math.round((totals.done / totals.total) * 100) : 0}%</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card title="Outstanding payments">
          <Big label="Total balance due" value={`₹${inr(owed)}`} />
          <Rows rows={Object.entries(aging).map(([k, v]) => [`${k} days`, `₹${inr(v)}`])} />
          <p className="mt-2 text-xs font-medium text-slate-500">Top debtors</p>
          <Rows rows={debtors.map(([c, v]) => [c, `₹${inr(v)}`])} />
        </Card>
        <Card title="Tenders">
          <Rows rows={['To Quote', 'Quoted', 'Won', 'Lost', 'Cancelled'].map(s => [s, String(tenderCounts[s] ?? 0)])} />
          <Big label="EMD pending" value={`₹${inr(emdPending)}`} />
        </Card>
        <Card title="Purchase orders">
          <Rows rows={PO_STATUSES.map(s => [s, String(poCounts[s] ?? 0)])} />
          <Big label="Past client delivery date" value={String(lateDeliveries)} warn={lateDeliveries > 0} />
          {seeMargin && <Big label="Total margin" value={`₹${inr(margin)}`} />}
        </Card>
        <Card title="Service & sourcing">
          <Big label="Open complaints" value={String(openCalls)} warn={openCalls > 0} />
          <Big label="Warranties ending in 30 days" value={String(expiring)} />
          <Big label="Sourcing awaiting quotes" value={String(awaiting)} />
        </Card>
      </section>
    </div>
  )
}

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded border p-3"><h3 className="mb-2 font-semibold">{title}</h3>{children}</div>
)
const Big = ({ label, value, warn }: { label: string; value: string; warn?: boolean }) => (
  <p className="my-1 flex items-baseline justify-between text-sm"><span className="text-slate-600">{label}</span><b className={`text-lg ${warn ? 'text-red-600' : ''}`}>{value}</b></p>
)
const Rows = ({ rows }: { rows: [string, string][] }) => (
  <ul className="text-sm">{rows.map(([k, v]) => <li key={k} className="flex justify-between border-b py-0.5"><span>{k}</span><span>{v}</span></li>)}</ul>
)
