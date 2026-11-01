import { useState } from 'react'
import { useIdentity } from './identity'
import { Drawer } from './ui'

/** "Who are you?" — optional. Powers "Only mine" and shows who changed what. */
export default function NamePill() {
  const { name, setName, owners } = useIdentity()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(name)

  function save(e: React.FormEvent) { e.preventDefault(); setName(draft); setOpen(false) }

  return (
    <>
      <button className="btn" onClick={() => { setDraft(name); setOpen(true) }} aria-haspopup="dialog">
        <span aria-hidden>👤</span><span className="hidden sm:inline">{name || 'Set your name'}</span><span className="sr-only sm:hidden">{name || 'Set your name'}</span>
      </button>
      {open && (
        <Drawer title="Your name" onClose={() => setOpen(false)}>
          <form onSubmit={save} className="flex flex-col gap-3">
            <p className="text-sm text-muted">Optional. Your name is saved on this device only. It makes “Only mine” show your tasks and records who changed what.</p>
            <label className="text-sm font-medium">Name as it appears in the task sheet
              <input list="owner-names" value={draft} onChange={e => setDraft(e.target.value)} maxLength={60} autoComplete="off" className="field mt-1 w-full" placeholder="e.g. Sutar" />
            </label>
            <datalist id="owner-names">{owners.map(o => <option key={o} value={o} />)}</datalist>
            <div className="flex gap-2">
              <button className="btn btn-primary">Save</button>
              {name && <button type="button" className="btn" onClick={() => { setName(''); setOpen(false) }}>Clear</button>}
            </div>
          </form>
        </Drawer>
      )}
    </>
  )
}
