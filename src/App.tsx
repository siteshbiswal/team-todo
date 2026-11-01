import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { getKey } from './access'
import { IdentityProvider } from './identity'
import { ToastProvider } from './toast'
import ErrorBoundary from './ErrorBoundary'
import { Link, useRoute } from './router'
import { TRACKERS } from './trackers/configs'
import { Skeleton } from './ui'
import AccessGate from './AccessGate'
import NamePill from './NamePill'
import ThemeToggle from './ThemeToggle'
import Tasks from './Tasks'

const Summary = lazy(() => import('./Summary'))
const Manage = lazy(() => import('./Admin'))
const TrackerTable = lazy(() => import('./TrackerTable'))

function Shell() {
  const { path, params } = useRoute()
  const tracker = TRACKERS.find(t => path === `/${t.path}`)
  const label = path === '/board' ? 'Board' : path === '/summary' ? 'Summary' : path === '/admin' ? 'Manage' : tracker?.title ?? 'Today'
  useEffect(() => { document.title = `${label} · Team To-Do` }, [label])

  const pill = (to: string, text: string) => (
    <Link key={to} to={to} className={`pill ${path === to ? 'pill-on' : ''}`}>{text}</Link>
  )

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-[110rem] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
          <Link to="/today" ariaLabel="Team To-Do, go to Today" className="flex min-h-9 items-center gap-2 font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-sm text-brand-ink" aria-hidden>✓</span>
            <span className="hidden sm:inline">Team To-Do</span>
          </Link>
          <nav aria-label="Main" className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 pb-1 md:order-none md:w-auto md:flex-1 md:pb-0">
            {pill('/today', 'Today')}{pill('/board', 'Board')}{pill('/summary', 'Summary')}
            <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />
            {TRACKERS.map(t => pill(`/${t.path}`, t.title))}
            <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />
            {pill('/admin', 'Manage')}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <NamePill />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[110rem] p-4">
        <Suspense fallback={<Skeleton />}>
          {path === '/board' ? <Tasks mode="board" />
            : path === '/summary' ? <Summary />
            : path === '/admin' ? <Manage />
            : tracker ? <TrackerTable cfg={tracker} initial={{ q: params.get('q') ?? '', status: params.get('status') ?? '' }} />
            : <Tasks mode="today" />}
        </Suspense>
      </main>
    </>
  )
}

type Access = 'checking' | 'ok' | 'missing' | 'invalid' | 'offline'

export default function App() {
  const [access, setAccess] = useState<Access>('checking')

  const check = useCallback(async () => {
    if (!getKey()) return setAccess('missing')
    setAccess('checking')
    const { data, error } = await supabase.rpc('check_access')
    setAccess(error ? 'offline' : data === true ? 'ok' : 'invalid')
  }, [])

  useEffect(() => { check() }, [check])

  if (access === 'checking') return <div className="mx-auto max-w-3xl p-4"><Skeleton /></div>
  if (access !== 'ok') return <AccessGate reason={access} onRetry={check} />

  return (
    <ErrorBoundary>
      <ToastProvider>
        <IdentityProvider>
          <Shell />
        </IdentityProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
