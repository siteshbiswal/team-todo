import { lazy, Suspense, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { ProfileProvider, useProfile } from './profile'
import { ToastProvider } from './toast'
import ErrorBoundary from './ErrorBoundary'
import { Link, useRoute } from './router'
import { TRACKERS } from './trackers/configs'
import Login from './Login'
import Tasks from './Tasks'

const Summary = lazy(() => import('./Summary'))
const Admin = lazy(() => import('./Admin'))
const TrackerTable = lazy(() => import('./TrackerTable'))

function Shell() {
  const { profile, loading } = useProfile()
  const path = useRoute()

  if (loading) return <p className="p-4 text-slate-500">Loading…</p>
  if (!profile) {
    return (
      <div className="mx-auto mt-20 max-w-md p-4 text-center">
        <p className="mb-3">Your account has no profile yet. Ask an admin to check your access.</p>
        <button className="rounded bg-slate-800 px-3 py-1 text-white" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    )
  }

  const nav = [
    { to: '/today', label: 'Today' }, { to: '/board', label: 'Board' }, { to: '/summary', label: 'Summary' },
    ...TRACKERS.map(t => ({ to: `/${t.path}`, label: t.title })),
    ...(profile.role === 'admin' ? [{ to: '/admin', label: 'Admin' }] : []),
  ]
  const tracker = TRACKERS.find(t => path === `/${t.path}`)

  return (
    <div className="mx-auto max-w-[110rem] p-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <nav className="flex gap-1 overflow-x-auto pb-1" aria-label="Main">
          {nav.map(n => (
            <Link key={n.to} to={n.to} className={`whitespace-nowrap rounded px-3 py-1 ${path === n.to ? 'bg-slate-800 text-white' : 'bg-slate-100'}`}>{n.label}</Link>
          ))}
        </nav>
        <span className="flex items-center gap-3 whitespace-nowrap text-sm text-slate-500">
          {profile.name}
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </span>
      </header>
      <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
        {path === '/board' ? <Tasks mode="board" />
          : path === '/summary' ? <Summary />
          : path === '/admin' && profile.role === 'admin' ? <Admin />
          : tracker ? <TrackerTable cfg={tracker} />
          : <Tasks mode="today" />}
      </Suspense>
    </div>
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
