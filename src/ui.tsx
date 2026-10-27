import { useEffect, useId, useRef, type ReactNode } from 'react'
import { statusTone } from './lib'

export const Badge = ({ value, tone }: { value: unknown; tone?: 'good' | 'warn' | 'bad' | 'info' | 'neutral' }) =>
  value ? <span className={`badge tone-${tone ?? statusTone(value)}`}>{String(value)}</span> : null

export const Skeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton h-14" />)}
  </div>
)

export const EmptyState = ({ icon = '📭', title, hint }: { icon?: string; title: string; hint?: string }) => (
  <div className="card flex flex-col items-center gap-1 px-4 py-10 text-center">
    <span className="text-3xl" aria-hidden>{icon}</span>
    <p className="font-medium">{title}</p>
    {hint && <p className="max-w-md text-sm text-muted">{hint}</p>}
  </div>
)

export const StatTile = ({ label, value, tone, href }: { label: string; value: ReactNode; tone?: 'bad' | 'warn' | 'good'; href?: string }) => {
  const inner = (
    <>
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className={`text-2xl font-semibold ${tone ? `text-${tone}` : ''}`}>{value}</span>
    </>
  )
  const cls = 'card flex flex-col gap-0.5 px-4 py-3'
  return href ? <a href={href} className={`${cls} hover:bg-hover`}>{inner}</a> : <div className={cls}>{inner}</div>
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Drawer({ title, onClose, children, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  const titleId = useId()
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const items = () => [...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(el => el.offsetParent !== null)
    items()[0]?.focus() // move focus into the dialog
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key !== 'Tab') return
      const f = items()
      if (!f.length) return
      const first = f[0], last = f[f.length - 1], active = document.activeElement
      if (!ref.current?.contains(active)) { e.preventDefault(); first.focus() }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; opener?.focus() } // give focus back
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <aside ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex h-full w-full max-w-xl flex-col bg-card shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 id={titleId} className="min-w-0 truncate font-semibold">{title}</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer && <footer className="border-t border-line px-4 py-3">{footer}</footer>}
      </aside>
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-line">
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)} aria-pressed={o === value}
          className={`px-2.5 py-1.5 text-xs font-medium ${o === value ? 'bg-brand text-brand-ink' : 'bg-card text-muted hover:bg-hover'}`}>{o}</button>
      ))}
    </div>
  )
}
