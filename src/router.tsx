import { useEffect, useState, type ReactNode } from 'react'

// Tiny hash router. We avoid react-router's HashRouter because Supabase's magic link
// lands on "#access_token=…", which a hash router would misread as a route.
const read = () => (location.hash.startsWith('#/') ? location.hash.slice(1) : '/today')

export function useRoute() {
  const [path, setPath] = useState(read)
  useEffect(() => {
    const on = () => setPath(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return path
}

export function Link({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  return <a href={`#${to}`} className={className}>{children}</a>
}
