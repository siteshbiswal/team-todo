import { useEffect, useState } from 'react'
import { supabase } from './supabase'

interface Row { team: string; total: number; done: number; pending: number }

export default function Summary() {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    supabase.from('team_summary').select('*').then(({ data }) => setRows((data as Row[]) ?? []))
  }, [])

  return (
    <table className="w-full text-left">
      <thead><tr className="border-b"><th>Team</th><th>Total</th><th>Done</th><th>Pending</th><th>% Done</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.team} className="border-b">
            <td className="py-1">{r.team}</td><td>{r.total}</td><td>{r.done}</td><td>{r.pending}</td>
            <td>{r.total ? Math.round((r.done / r.total) * 100) : 0}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
