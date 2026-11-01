import { useState } from 'react'
import { parseKey, setKey } from './access'
import ThemeToggle from './ThemeToggle'

/** Shown when the device has no valid key. Not a login: just "use the full link you were given". */
export default function AccessGate({ reason, onRetry }: { reason: 'missing' | 'invalid' | 'offline'; onRetry: () => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const k = parseKey(text)
    if (!k) return setError('That doesn’t look like a team link. It should end with ?k= followed by a long code.')
    setKey(k); setError(''); onRetry()
  }

  const copy = {
    missing: ['Private team app', 'This app is set to private. Open the full link you were given — it ends with ?k=… — or paste it below.'],
    invalid: ['This link no longer works', 'It may have been replaced with a new one. Ask for the latest link and paste it below.'],
    offline: ['Can’t reach the server', 'Check your internet connection and try again.'],
  }[reason]

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="card w-full max-w-sm p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg text-brand-ink" aria-hidden>{reason === 'offline' ? '⚠' : '🔒'}</span>
          <div><h1 className="text-lg font-semibold leading-tight">{copy[0]}</h1><p className="text-sm text-muted">Team To-Do</p></div>
        </div>
        <p className="mb-4 text-sm text-muted" role="status">{copy[1]}</p>
        {reason === 'offline' ? (
          <button className="btn btn-primary w-full" onClick={onRetry}>Try again</button>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="text-sm font-medium">Team link
              <input value={text} onChange={e => setText(e.target.value)} placeholder="https://…/?k=…" autoComplete="off" spellCheck={false} className="field mt-1 w-full" />
            </label>
            <button className="btn btn-primary" disabled={!text.trim()}>Open</button>
            {error && <p className="text-sm text-bad" role="alert">{error}</p>}
          </form>
        )}
      </div>
    </main>
  )
}
