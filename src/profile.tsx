import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

export interface Profile { id: string; name: string; role: 'member' | 'admin'; team: string | null; active: boolean; email?: string | null }

const Ctx = createContext<{ profile: Profile | null; loading: boolean }>({ profile: null, loading: true })
export const useProfile = () => useContext(Ctx)

export function ProfileProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle().then(({ data }) => {
      setProfile((data as Profile) ?? null)
      setLoading(false)
    })
  }, [userId])

  return <Ctx.Provider value={{ profile, loading }}>{children}</Ctx.Provider>
}
