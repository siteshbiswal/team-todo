import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { getUserName, setUserName } from './access'
import { supabase } from './supabase'

interface Ctx { name: string; setName: (n: string) => void; owners: string[] }
const IdentityCtx = createContext<Ctx>({ name: '', setName: () => {}, owners: [] })
export const useIdentity = () => useContext(IdentityCtx)

/** Names that appear as task owners in the sheet — offered as suggestions so "Only mine" matches. */
export const splitOwners = (rows: { res1: string | null; res2: string | null; final_res: string | null }[]) =>
  [...new Set(rows.flatMap(r => [r.res1, r.res2, r.final_res]).flatMap(v => (v ?? '').split(/[,&/]/)).map(s => s.trim())
    .filter(s => s && !/dept|assign|team|members|leaders|^\(/i.test(s)))].sort()

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [name, setNameState] = useState(getUserName)
  const [owners, setOwners] = useState<string[]>([])

  useEffect(() => {
    supabase.from('task_templates').select('res1,res2,final_res').then(({ data }) => setOwners(splitOwners(data ?? [])))
  }, [])

  const setName = useCallback((n: string) => { const v = n.trim().slice(0, 60); setUserName(v); setNameState(v) }, [])
  return <IdentityCtx.Provider value={{ name, setName, owners }}>{children}</IdentityCtx.Provider>
}
