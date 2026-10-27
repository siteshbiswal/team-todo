import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { useProfile } from './profile'
import { addDays, agingBuckets, countBy, inr, summarizeTasks, today, topDebtors } from './lib'
import { trackerLink } from './router'
import { PO_STATUSES } from './trackers/configs'
import { StatTile } from './ui'

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
  const totalPct = totals.total ? Math.round((totals.done / totals.total) * 100) : 0

  const owed = out.reduce((n, r) => n + Math.max(Number(r.balance), 0), 0)
  const aging = agingBuckets(out as never)
  const maxAge = Math.max(...Object.values(aging), 1)
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
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Summary</h1>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key numbers">
        <StatTile label="Payments due" value={`₹${inr(owed)}`} href={`#${trackerLink('outstanding')}`} />
        <StatTile label="Past delivery date" value={lateDeliveries} tone={lateDeliveries ? 'bad' : undefined} href={`#${trackerLink('pos')}`} />
        <StatTile label="Open complaints" value={openCalls} tone={openCalls ? 'warn' : undefined} href={`#${trackerLink('service', { status: 'Open' })}`} />
        <StatTile label="EMD pending" value={`₹${inr(emdPending)}`} href={`#${trackerLink('tenders')}`} />
      </section>

      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-semibold">To-do completion <span className="badge tone-neutral">{totalPct}%</span></h2>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="field" aria-label="From" />
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="field" aria-label="To" />
          <button className="btn" onClick={() => { setFrom(addDays(t, -6)); setTo(t) }}>7 days</button>
          <button className="btn" onClick={() => { setFrom(addDays(t, -29)); setTo(t) }}>30 days</button>
          <input value={person} onChange={e => setPerson(e.target.value)} placeholder="Person…" className="field w-32" aria-label="Person" />
        </div>
        {teamRows.length === 0 ? <p className="py-6 text-center text-sm text-muted">No tasks in this range. Tasks are created each morning; use Admin → Generate today to create them now.</p> : (
          <ul className="flex flex-col gap-2.5">
            {teamRows.map(r => (
              <li key={r.team}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{r.team}</span><span className="text-muted">{r.done}/{r.total} done · {r.pending} pending</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-soft" role="progressbar" aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.team} completion`}>
                  <div className="h-full rounded-full bg-good" style={{ width: `${r.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card title="Outstanding by age" href={`#${trackerLink('outstanding')}`}>
          <ul className="flex flex-col gap-2">
            {Object.entries(aging).map(([k, v]) => (
              <li key={k}>
                <div className="mb-0.5 flex justify-between text-sm"><span>{k} days</span><span className="font-medium">₹{inr(v)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-soft"><div className={`h-full rounded-full ${k === '90+' || k === '61-90' ? 'bg-bad' : k === '31-60' ? 'bg-warn' : 'bg-good'}`} style={{ width: `${(v / maxAge) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
          <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Top debtors</p>
          <Rows rows={debtors.map(([c, v]) => [c, `₹${inr(v)}`, `#${trackerLink('outstanding', { q: c })}`])} empty="Nothing outstanding" />
        </Card>

        <Card title="Tenders" href={`#${trackerLink('tenders')}`}>
          <Rows rows={['To Quote', 'Quoted', 'Won', 'Lost', 'Cancelled'].map(s => [s, String(tenderCounts[s] ?? 0), `#${trackerLink('tenders', { status: s })}`])} />
        </Card>

        <Card title="Purchase orders" href={`#${trackerLink('pos')}`}>
          <Rows rows={PO_STATUSES.map(s => [s, String(poCounts[s] ?? 0), `#${trackerLink('pos', { status: s })}`])} />
          {seeMargin && <p className="mt-3 flex justify-between border-t border-line pt-2 text-sm"><span className="text-muted">Total margin</span><b>₹{inr(margin)}</b></p>}
        </Card>

        <Card title="Service & sourcing">
          <Rows rows={[
            ['Open complaints', String(openCalls), `#${trackerLink('service', { status: 'Open' })}`],
            ['Warranties ending in 30 days', String(expiring), `#${trackerLink('service')}`],
            ['Sourcing awaiting quotes', String(awaiting), `#${trackerLink('sourcing', { status: 'Enquiry Sent' })}`],
          ]} />
        </Card>
      </section>
    </div>
  )
}

const Card = ({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) => (
  <div className="card p-4">
    <h2 className="mb-3 flex items-center justify-between font-semibold">{title}{href && <a href={href} className="text-xs font-medium text-accent hover:underline">Open ↗</a>}</h2>
    {children}
  </div>
)
const Rows = ({ rows, empty }: { rows: [string, string, string?][]; empty?: string }) => rows.length === 0 ? <p className="text-sm text-muted">{empty}</p> : (
  <ul className="text-sm">
    {rows.map(([k, v, href]) => (
      <li key={k} className="border-b border-line last:border-0">
        {href ? <a href={href} className="flex justify-between rounded px-1 py-1.5 hover:bg-hover"><span>{k}</span><span className="font-medium">{v}</span></a>
          : <div className="flex justify-between px-1 py-1.5"><span>{k}</span><span className="font-medium">{v}</span></div>}
      </li>
    ))}
  </ul>
)
