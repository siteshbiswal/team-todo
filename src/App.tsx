import { lazy, Suspense, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { ProfileProvider, useProfile } from './profile'
import { ToastProvider } from './toast'
import ErrorBoundary from './ErrorBoundary'
import { Link, useRoute } from './router'
import { TRACKERS } from './trackers/configs'
import { Skeleton } from './ui'
import ThemeToggle from './ThemeToggle'
import Login from './Login'
import Tasks from './Tasks'

const Summary = lazy(() => import('./Summary'))
const Admin = lazy(() => import('./Admin'))
const TrackerTable = lazy(() => import('./TrackerTable'))

const ROLE_LABEL = { admin: 'Admin', head: 'Head', member: 'Member' } as const

function Shell() {
  const { profile, loading } = useProfile()
  const { path, params } = useRoute()
  const tracker = TRACKERS.find(t => path === `/${t.path}`)
  const label = path === '/board' ? 'Board' : path === '/summary' ? 'Summary' : path === '/admin' ? 'Admin' : tracker?.title ?? 'Today'

  useEffect(() => { document.title = `${label} · Team To-Do` }, [label])

  if (loading) return <div className="mx-auto max-w-3xl p-4"><Skeleton /></div>
  if (!profile) {
    return (
      <div className="mx-auto mt-20 max-w-md p-4 text-center">
        <p className="mb-3">Your account has no profile yet. Ask an admin to check your access.</p>
        <button className="btn btn-primary" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    )
  }

  if (!profile.active) {
    return (
      <main className="relative flex min-h-screen items-center justify-center p-4">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="card w-full max-w-sm p-6 text-center" role="status">
          <span className="text-3xl" aria-hidden>⏳</span>
          <h1 className="mt-2 text-lg font-semibold">Waiting for approval</h1>
          <p className="mt-1 text-sm text-muted">You're signed in as <b className="text-ink">{profile.email ?? 'your account'}</b>. An admin needs to approve your account before you can see any data.</p>
          <div className="mt-4 flex justify-center gap-2">
            <button className="btn" onClick={() => location.reload()}>Check again</button>
            <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        </div>
      </main>
    )
  }

  const pill = (to: string, text: string) => (
    <Link key={to} to={to} className={`pill ${path === to ? 'pill-on' : ''}`}>{text}</Link>
  )

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-[110rem] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
          <Link to="/today" className="flex items-center gap-2 font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-sm text-brand-ink" aria-hidden>✓</span>
            <span className="hidden sm:inline">Team To-Do</span>
          </Link>
          <nav aria-label="Main" className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 pb-1 md:order-none md:w-auto md:flex-1 md:pb-0">
            {pill('/today', 'Today')}{pill('/board', 'Board')}{pill('/summary', 'Summary')}
            <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />
            {TRACKERS.map(t => pill(`/${t.path}`, t.title))}
            {profile.role === 'admin' && (<><span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden />{pill('/admin', 'Admin')}</>)}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm md:ml-0">
            <span className="hidden text-right leading-tight sm:block">
              <span className="block font-medium">{profile.name}</span>
              <span className="block text-xs text-muted">{ROLE_LABEL[profile.role]}{profile.team ? ` · ${profile.team}` : ''}</span>
            </span>
            <ThemeToggle />
            <button className="btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[110rem] p-4">
        <Suspense fallback={<Skeleton />}>
          {path === '/board' ? <Tasks mode="board" />
            : path === '/summary' ? <Summary />
            : path === '/admin' && profile.role === 'admin' ? <Admin />
            : tracker ? <TrackerTable cfg={tracker} initial={{ q: params.get('q') ?? '', status: params.get('status') ?? '' }} />
            : <Tasks mode="today" />}
        </Suspense>
      </main>
    </>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <Login />

  return (
    <ErrorBoundary>
      <ToastProvider>
        <ProfileProvider key={session.user.id} userId={session.user.id}>
          <Shell />
        </ProfileProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
