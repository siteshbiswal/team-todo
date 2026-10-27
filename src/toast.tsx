import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Kind = 'error' | 'ok'
const Ctx = createContext<(msg: string, kind?: Kind) => void>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: Kind }[]>([])

  const push = useCallback((msg: string, kind: Kind = 'ok') => {
    const id = Date.now() + Math.random()
    setItems(xs => [...xs, { id, msg, kind }])
    setTimeout(() => setItems(xs => xs.filter(x => x.id !== id)), 5000)
  }, [])

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2" role="status">
        {items.map(t => (
          <div key={t.id} className={`rounded px-3 py-2 text-sm text-white shadow ${t.kind === 'error' ? 'bg-red-600' : 'bg-slate-800'}`}>{t.msg}</div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
