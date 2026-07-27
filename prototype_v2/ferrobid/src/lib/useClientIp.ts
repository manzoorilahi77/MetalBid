/* ---------------------------------------------------------------------------
   useClientIp — resolves the visitor's public IP for the chrome's session chip.

   Browser JS cannot read a machine's LAN address (192.168.x.x): mDNS
   obfuscation closed the old WebRTC trick, so the public egress IP is the only
   thing available client-side. A LAN address would need a server endpoint
   echoing REMOTE_ADDR.

   The endpoint only reflects the caller's own IP back — no payload is sent, and
   nothing about the session is disclosed beyond the request itself. Resolved
   once per browser session and cached, so route changes and remounts don't
   re-request. Fails quietly: the chip renders a dash rather than an error.
--------------------------------------------------------------------------- */
import { useEffect, useState } from 'react'

const CACHE_KEY = 'fb.session.ip'
const ENDPOINT = 'https://api.ipify.org?format=json'
const TIMEOUT_MS = 4_000

export type ClientIpState = 'loading' | 'ready' | 'unavailable'

function cached(): string | null {
  try {
    return sessionStorage.getItem(CACHE_KEY)
  } catch {
    return null
  }
}

/** Shared in-flight request. The chip renders in both the desktop bar and the
 *  mobile menu, so two instances can mount at once on a narrow viewport —
 *  without this they'd each hit the endpoint. */
let inFlight: Promise<string> | null = null

function resolveIp(): Promise<string> {
  if (inFlight) return inFlight
  const ac = new AbortController()
  // Never leave the chip spinning on a hung request.
  const timer = window.setTimeout(() => ac.abort(), TIMEOUT_MS)

  inFlight = fetch(ENDPOINT, { signal: ac.signal, cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d: unknown) => {
      const value = (d as { ip?: unknown } | null)?.ip
      if (typeof value !== 'string' || !value) throw new Error('malformed')
      try { sessionStorage.setItem(CACHE_KEY, value) } catch { /* private mode */ }
      return value
    })
    .finally(() => {
      window.clearTimeout(timer)
      inFlight = null // let a later mount retry after a failure
    })

  return inFlight
}

export function useClientIp(): { ip: string | null; state: ClientIpState } {
  const [ip, setIp] = useState<string | null>(cached)
  const [state, setState] = useState<ClientIpState>(() => (cached() ? 'ready' : 'loading'))

  useEffect(() => {
    if (ip) return
    let alive = true
    resolveIp().then(
      (value) => { if (alive) { setIp(value); setState('ready') } },
      () => { if (alive) setState('unavailable') },
    )
    return () => { alive = false }
  }, [ip])

  return { ip, state }
}
