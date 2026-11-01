// The app has no accounts. Access is a secret key carried in the shared link (…/team-todo/?k=KEY).
// The key is kept on the device, removed from the address bar, and sent with every request;
// the database checks it. A display name (optional) is stored the same way, for "Only mine" and change history.
const KEY = 'teamKey'
const NAME = 'userName'

let memKey: string | null = null // fallback when the browser blocks storage (e.g. some private modes)
let memName: string | null = null

const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* ignore */ } }

export const getKey = () => read(KEY) ?? memKey
export function setKey(k: string) { memKey = k; write(KEY, k) }
export const getUserName = () => read(NAME) ?? memName ?? ''
export function setUserName(n: string) { memName = n || null; write(NAME, n || null) }

/** Pulls ?k=… out of a full link (or a bare key) typed/pasted by the user. */
export function parseKey(input: string): string | null {
  const t = input.trim()
  if (!t) return null
  try { const k = new URL(t).searchParams.get('k'); if (k) return k } catch { /* not a URL */ }
  const m = /[?&]k=([^&#\s]+)/.exec(t)
  if (m) return decodeURIComponent(m[1])
  return /^[A-Za-z0-9_-]{24,}$/.test(t) ? t : null
}

/** Call once at startup: saves the key from the link and cleans the address bar. */
export function captureKeyFromUrl() {
  const u = new URL(location.href)
  const k = u.searchParams.get('k')
  if (!k) return
  setKey(k)
  u.searchParams.delete('k')
  history.replaceState(null, '', u.pathname + u.search + u.hash)
}

export const shareLink = () => `${location.origin}${import.meta.env.BASE_URL}?k=${getKey() ?? ''}`

export const newKey = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('')

/** base64 of the UTF-8 name, so any alphabet survives an HTTP header */
export const encodeName = (n: string) => btoa(String.fromCharCode(...new TextEncoder().encode(n)))
