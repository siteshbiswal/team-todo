import { useRef, type KeyboardEvent } from 'react'
import { useTheme, type ThemePref } from './theme'

const Icon = ({ d }: { d: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)
const OPTIONS: { value: ThemePref; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
  { value: 'system', label: 'System', icon: 'M3 5h18v11H3zM8 21h8M12 16v5' },
  { value: 'dark', label: 'Dark', icon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z' },
]

/** Three-way Light / System / Dark switch (radio group: arrow keys move between options). */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { pref, resolved, setPref } = useTheme()
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKey(e: KeyboardEvent, i: number) {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const n = (i + d + OPTIONS.length) % OPTIONS.length
    setPref(OPTIONS[n].value)
    refs.current[n]?.focus()
  }

  return (
    <div role="radiogroup" aria-label="Colour theme" title={`Theme: ${pref === 'system' ? `System (${resolved})` : pref}`}
      className={`inline-flex rounded-full border border-line bg-card p-0.5 ${className}`}>
      {OPTIONS.map((o, i) => {
        const on = pref === o.value
        return (
          <button key={o.value} ref={el => { refs.current[i] = el }} role="radio" aria-checked={on} aria-label={o.label}
            tabIndex={on ? 0 : -1} onClick={() => setPref(o.value)} onKeyDown={e => onKey(e, i)} data-theme-option={o.value}
            className={`flex h-7 min-w-7 items-center justify-center gap-1 rounded-full px-2 text-sm transition-colors ${on ? 'bg-brand text-brand-ink' : 'text-muted hover:bg-hover'}`}>
            <Icon d={o.icon} />
            {on && <span className="hidden text-xs font-medium 2xl:inline">{o.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
