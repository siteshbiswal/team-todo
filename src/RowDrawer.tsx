import { useRef, useState } from 'react'
import { supabase } from './supabase'
import { useToast } from './toast'
import { inr, today, type Row } from './lib'
import { Badge, Drawer } from './ui'
import type { Column, TrackerConfig } from './trackers/types'

interface Props {
  cfg: TrackerConfig
  row: Row
  cols: Column[]
  canEdit: boolean
  isAdmin: boolean
  onSave: (row: Row, col: Column, raw: string) => void
  onDelete: (row: Row) => Promise<boolean>
  onChanged: () => void
  onClose: () => void
}

export default function RowDrawer({ cfg, row, cols, canEdit, isAdmin, onSave, onDelete, onChanged, onClose }: Props) {
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false) // blocks a second tap before React re-renders
  const title = String(row[cfg.cardFields[0]] ?? 'Details')

  async function recordPayment() {
    const n = Number(amount.replace(/,/g, ''))
    if (!(n > 0)) return toast('Enter a payment amount greater than zero', 'error')
    if (inFlight.current) return
    inFlight.current = true; setBusy(true)
    try {
      const { error } = await supabase.rpc('record_payment', { p_id: row.id, p_amount: n })
      if (error) return toast(error.message, 'error')
      toast(`Recorded ₹${inr(n)}`)
      setAmount('')
      onChanged()
    } finally { inFlight.current = false; setBusy(false) }
  }

  async function createLogistics() {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true)
    try { await createLogisticsEntry() } finally { inFlight.current = false; setBusy(false) }
  }

  async function createLogisticsEntry() {
    const po_no = String(row.po_no)
    const { data: existing } = await supabase.from('logistics').select('id').eq('po_no', po_no).limit(1)
    if (existing?.length) return toast('This PO already has a logistics entry', 'error')
    const { error } = await supabase.from('logistics').insert({ po_no, vendor_delivery_date: row.vendor_delivery_date ?? null })
    if (error) return toast(error.message, 'error')
    toast('Logistics entry created')
    location.hash = `#/logistics?q=${encodeURIComponent(po_no)}`
  }

  async function del() {
    if (!confirm('Delete this row? This cannot be undone.')) return
    if (await onDelete(row)) onClose()
  }

  return (
    <Drawer title={title} onClose={onClose}
      footer={isAdmin ? <button className="btn btn-danger" onClick={del}>Delete row</button> : undefined}>
      <div className="flex flex-col gap-4">
        {cfg.actions?.includes('payment') && canEdit && (
          <div className="rounded-lg border border-line bg-hover p-3">
            <p className="mb-2 text-sm font-medium">Record a payment</p>
            <div className="flex gap-2">
              <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="Amount received (₹)" className="field min-w-0 flex-1"
                onKeyDown={e => e.key === 'Enter' && recordPayment()} />
              <button className="btn btn-primary" onClick={recordPayment} disabled={busy}>{busy ? 'Saving…' : 'Add'}</button>
            </div>
            <p className="mt-1 text-xs text-muted">Adds to “Received”, reduces the balance and sets last follow-up to {today()}.</p>
          </div>
        )}
        {cfg.actions?.includes('logistics') && canEdit && (
          <button className="btn self-start" onClick={createLogistics} disabled={busy}>＋ Create logistics entry for this PO</button>
        )}
        <dl className="grid gap-3 sm:grid-cols-2">
          {cols.map(c => {
            const v = row[c.key]
            const editable = canEdit && !c.computed && !c.poPicker
            return (
              <div key={c.key} className={`min-w-0 ${c.key === 'remarks' || c.key === 'complaint' || c.key === 'item_spec' ? 'sm:col-span-2' : ''}`}>
                <dt className="mb-0.5 text-xs font-medium text-muted">{c.label}{c.computed && ' · calculated'}{c.cost && ' · restricted'}</dt>
                <dd>
                  {!editable ? (
                    <span className="block min-h-9 py-1.5 text-sm font-medium [overflow-wrap:anywhere]">
                      {c.key === 'status' || c.key.endsWith('_status') || c.key === 'under_warranty'
                        ? <Badge value={v} /> : c.type === 'money' ? inr(v) : c.key === 'margin_pct' && v != null ? `${v}%` : String(v ?? '—')}
                    </span>
                  ) : c.type === 'select' ? (
                    <select value={String(v ?? '')} aria-label={c.label} className="field w-full" onChange={e => onSave(row, c, e.target.value)}>
                      <option value="" />
                      {c.options!.map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input key={`${row.id}-${c.key}-${String(v ?? '')}`} defaultValue={String(v ?? '')} aria-label={c.label} className="field w-full"
                      type={c.type === 'date' ? 'date' : 'text'} inputMode={c.type === 'number' || c.type === 'money' ? 'decimal' : undefined}
                      onBlur={e => onSave(row, c, e.target.value)} />
                  )}
                </dd>
              </div>
            )
          })}
        </dl>
        {typeof row.updated_at === 'string' && (
          <p className="text-xs text-muted">Last updated {new Date(row.updated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        )}
      </div>
    </Drawer>
  )
}
