import { useState } from 'react'
import { supabase } from './supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL } })
    setMsg(error ? error.message : 'Check your email for the sign-in link.')
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-24 flex max-w-sm flex-col gap-3 p-4">
      <h1 className="text-xl font-semibold">Team To-Do</h1>
      <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
        placeholder="you@company.com" className="rounded border p-2" />
      <button className="rounded bg-slate-800 p-2 text-white">Email me a sign-in link</button>
      {msg && <p className="text-sm text-slate-600">{msg}</p>}
    </form>
  )
}
