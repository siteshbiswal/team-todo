import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import Login from './Login'
import Tasks from './Tasks'
import Summary from './Summary'
import Admin from './Admin'

type Tab = 'today' | 'board' | 'summary' | 'admin'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [tab, setTab] = useState<Tab>('today')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return setIsAdmin(false)
    supabase.from('profiles').select('role').eq('id', session.user.id).single()
      .then(({ data }) => setIsAdmin(data?.role === 'admin'))
  }, [session])

  if (session === undefined) return null
  if (!session) return <Login />

  return (
    <div className="mx-auto max-w-4xl p-4">
      <header className="mb-4 flex items-center justify-between">
        <nav className="flex gap-2">
          {((isAdmin ? ['today', 'board', 'summary', 'admin'] : ['today', 'board', 'summary']) as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded px-3 py-1 capitalize ${tab === t ? 'bg-slate-800 text-white' : 'bg-slate-100'}`}>{t}</button>
          ))}
        </nav>
        <button className="text-sm text-slate-500" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>
      {tab === 'summary' ? <Summary /> : tab === 'admin' ? <Admin /> : <Tasks mode={tab} />}
    </div>
  )
}
