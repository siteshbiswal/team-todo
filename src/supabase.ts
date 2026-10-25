import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

export type Status = 'Pending' | 'In Progress' | 'Done'
export interface Instance {
  id: number
  due_date: string
  status: Status
  remarks: string | null
  task_templates: { team: string; title: string; freq_text: string; res1: string | null; res2: string | null; final_res: string | null }
}
