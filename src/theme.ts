import { useEffect, useState } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'
const KEY = 'theme'
const query = () => window.matchMedia('(prefers-color-scheme: dark)')

export function readPref(): ThemePref {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system' } catch { return 'system' }
}

export const resolve = (pref: ThemePref): 'light' | 'dark' => (pref === 'system' ? (query().matches ? 'dark' : 'light') : pref)

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolve(pref) === 'dark' ? '#0b1120' : '#1e293b')
}

export function useTheme() {
  const [pref, setPrefState] = useState<ThemePref>(readPref)
  const [resolved, setResolved] = useState(() => resolve(readPref()))

  useEffect(() => {
    applyTheme(pref)
    setResolved(resolve(pref))
    const mq = query()
    const onSystem = () => { if (pref === 'system') { applyTheme('system'); setResolved(resolve('system')) } }
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setPrefState(readPref()) } // keep other tabs in sync
    mq.addEventListener('change', onSystem)
    window.addEventListener('storage', onStorage)
    return () => { mq.removeEventListener('change', onSystem); window.removeEventListener('storage', onStorage) }
  }, [pref])

  const setPref = (next: ThemePref) => {
    try { next === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, next) } catch { /* private mode: still works for this visit */ }
    setPrefState(next)
  }
  return { pref, resolved, setPref }
}
