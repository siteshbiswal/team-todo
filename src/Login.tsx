import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import ThemeToggle from './ThemeToggle'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const id = setTimeout(() => setWait(w => w - 1), 1000)
    return () => clearTimeout(id)
  }, [wait])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL } })
    setBusy(false)
    if (error) { setError(/rate|seconds/i.test(error.message) ? 'Too many requests — wait a minute and try again.' : error.message); return }
    setSent(true); setWait(30)
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="card w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg text-brand-ink" aria-hidden>✓</span>
          <div><h1 className="text-lg font-semibold leading-tight">Team To-Do</h1><p className="text-sm text-muted">Sign in with your work email</p></div>
        </div>
        {sent ? (
          <div role="status">
            <p className="mb-1 font-medium">Check your email</p>
            <p className="mb-4 text-sm text-muted">We sent a sign-in link to <b className="text-ink">{email}</b>. Open it on this device. Check spam if it doesn't arrive.</p>
            <div className="flex gap-2">
              <button className="btn flex-1" disabled={wait > 0 || busy} onClick={submit}>{wait > 0 ? `Resend in ${wait}s` : 'Resend link'}</button>
              <button className="btn btn-ghost" onClick={() => setSent(false)}>Change email</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="text-sm font-medium">Email
              <input type="email" required autoFocus autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="field mt-1 w-full" />
            </label>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
            {error && <p className="text-sm text-bad" role="alert">{error}</p>}
            <p className="text-xs text-muted">No password needed. New accounts must be approved by an admin before they can see any data.</p>
          </form>
        )}
      </div>
    </main>
  )
}
