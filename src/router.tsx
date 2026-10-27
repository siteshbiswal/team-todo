import { useEffect, useState, type ReactNode } from 'react'
import { parseHash } from './lib'

// Tiny hash router. We avoid react-router's HashRouter because Supabase's magic link
// lands on "#access_token=…", which a hash router would misread as a route.
export function useRoute() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return { ...parseHash(hash), hash }
}

export function Link({ to, className, children, onClick }: { to: string; className?: string; children: ReactNode; onClick?: () => void }) {
  return <a href={`#${to}`} className={className} onClick={onClick}>{children}</a>
}

export const trackerLink = (path: string, params: Record<string, string> = {}) => {
  const q = new URLSearchParams(params).toString()
  return `/${path}${q ? `?${q}` : ''}`
}
