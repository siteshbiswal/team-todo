import { createClient } from '@supabase/supabase-js'
import { encodeName, getKey, getUserName } from './access'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      // every request carries the shared-link key and (if set) who is making the change
      fetch: (input, init) => {
        const headers = new Headers(init?.headers)
        const key = getKey(), name = getUserName()
        if (key) headers.set('x-team-key', key)
        if (name) headers.set('x-user-name', encodeName(name))
        return fetch(input, { ...init, headers })
      },
    },
  },
)

export type Status = 'Pending' | 'In Progress' | 'Done'
export interface Instance {
  id: number
  due_date: string
  status: Status
  remarks: string | null
  task_templates: { team: string; title: string; freq_text: string; res1: string | null; res2: string | null; final_res: string | null }
}
