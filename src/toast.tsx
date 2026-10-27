import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Kind = 'error' | 'ok'
const Ctx = createContext<(msg: string, kind?: Kind) => void>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: Kind }[]>([])

  const push = useCallback((msg: string, kind: Kind = 'ok') => {
    const id = Date.now() + Math.random()
    setItems(xs => [...xs.slice(-3), { id, msg, kind }])
    setTimeout(() => setItems(xs => xs.filter(x => x.id !== id)), kind === 'error' ? 8000 : 3500)
  }, [])

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:max-w-sm" aria-live="polite">
        {items.map(t => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
            className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-sm shadow-lg ${t.kind === 'error' ? 'bg-bad text-brand-ink' : 'bg-brand text-brand-ink'}`}>
            <span className="flex-1">{t.msg}</span>
            <button onClick={() => setItems(xs => xs.filter(x => x.id !== t.id))} aria-label="Dismiss" className="opacity-70 hover:opacity-100">✕</button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
