/* ---------------------------------------------------------------------------
   Guest 2 — Exit-intent "Join the WhatsApp community" modal.

   Fires once when a visitor signals they're about to leave the public site:
   desktop = cursor exits through the top of the viewport, touch = a fast
   upward flick after they've read some of the page. Everything is local to
   pages/guest2/ so the role stays a deletable module.

   Product rules (deliberate, not decoration):
   · Dwell grace before arming — never interrupts someone who just landed.
   · Frequency is one switch: SHOW_EVERY_RELOAD. On (current) = re-arms every
     page reload for demos. Off = once per session, 21-day dismiss cooldown,
     never again once joined.
   · Suppressed on /g2/contact (they're already converting there).
   · Reduced-motion safe, focus-trapped, ESC-closable, scroll-locked.

   The only non-token colours are WhatsApp's brand greens — brand recognition
   is the whole point of the card, so they're used literally and nowhere else.
--------------------------------------------------------------------------- */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ShieldCheck, BellRing, Gavel, Check, X, ArrowRight, Lock } from 'lucide-react'
import { cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { registerExitInterstitial } from '../../lib/exitInterstitial'

/** Swap for the real invite link at launch. */
const COMMUNITY_INVITE = 'https://chat.whatsapp.com/ferrobid-verified-traders'

/**
 * Frequency switch.
 *
 * `true`  — demo/review mode: the invite is armed again on every page reload.
 *           Nothing is remembered, so dismissing or joining doesn't stop it
 *           coming back next load. Still fires at most once per page load.
 * `false` — launch mode: once per browser session, 21-day cooldown after a
 *           dismiss, never again once they've joined.
 *
 * Flip this to `false` before going live.
 */
const SHOW_EVERY_RELOAD = true

const SEEN_SESSION_KEY = 'fb.g2.wa.seen'
const STATE_KEY = 'fb.g2.wa.state'
/** Dwell grace before exit intent is armed — short in demo mode so a reviewer
 *  isn't waiting 12s per reload; the full 12s "don't interrupt someone who just
 *  landed" grace applies at launch. */
const DWELL_MS = SHOW_EVERY_RELOAD ? 3_000 : 12_000
const DISMISS_COOLDOWN_MS = 21 * 24 * 60 * 60 * 1000

/* ------------------------------- persistence ------------------------------- */

type Persisted = { status: 'joined' | 'dismissed'; at: number }

function readState(): Persisted | null {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    return raw ? (JSON.parse(raw) as Persisted) : null
  } catch {
    return null
  }
}

function writeState(status: Persisted['status']) {
  if (SHOW_EVERY_RELOAD) return
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({ status, at: Date.now() }))
  } catch {
    /* private mode — degrade to session-only suppression */
  }
}

function markSeen() {
  if (SHOW_EVERY_RELOAD) return
  try {
    sessionStorage.setItem(SEEN_SESSION_KEY, '1')
  } catch {
    /* ignore */
  }
}

/** True when the visitor is still eligible to see the invite. */
function isEligible(): boolean {
  if (SHOW_EVERY_RELOAD) return true
  try {
    if (sessionStorage.getItem(SEEN_SESSION_KEY)) return false
  } catch {
    /* ignore */
  }
  const s = readState()
  if (!s) return true
  if (s.status === 'joined') return false
  return Date.now() - s.at > DISMISS_COOLDOWN_MS
}

/* -------------------------------- the hook --------------------------------- */

/**
 * useExitIntent — resolves "this visitor is leaving" from the signals each
 * platform actually gives us, then fires `onExit` exactly once.
 *
 * Desktop: pointer crosses the top edge (clientY <= 0 with no relatedTarget),
 * which is the tab bar / address bar / close button — a real leave signal, not
 * a stray move off the side of the window.
 *
 * Touch: there is no mouseout, so we read the equivalent gesture — a hard
 * upward flick (> 22px between frames) once they've scrolled past a quarter of
 * the page. That's the "swipe back up to the address bar" motion.
 */
function useExitIntent(enabled: boolean, onExit: () => void) {
  const fired = useRef(false)
  const armed = useRef(false)

  useEffect(() => {
    if (!enabled) return
    const grace = window.setTimeout(() => { armed.current = true }, DWELL_MS)

    const fire = () => {
      if (fired.current || !armed.current) return
      fired.current = true
      onExit()
    }

    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) fire()
    }

    let lastY = window.scrollY
    let lastT = 0
    const onScroll = () => {
      const y = window.scrollY
      const now = performance.now()
      const scrolledEnough =
        y > (document.documentElement.scrollHeight - window.innerHeight) * 0.25
      // upward flick, sampled per frame-ish so a slow scroll-up never triggers
      if (scrolledEnough && lastY - y > 22 && now - lastT < 90) fire()
      lastY = y
      lastT = now
    }

    document.addEventListener('mouseout', onMouseOut)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.clearTimeout(grace)
      document.removeEventListener('mouseout', onMouseOut)
      window.removeEventListener('scroll', onScroll)
    }
  }, [enabled, onExit])
}

/* ------------------------------ presentation ------------------------------- */

function WhatsAppGlyph({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.174.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.174-.297-.019-.458.13-.606.134-.133.347-.347.52-.52.174-.174.232-.298.347-.497.115-.198.058-.371-.058-.52-.116-.174-.66-1.59-.9-2.16-.24-.57-.48-.49-.66-.5h-.57c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.695.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.375a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
    </svg>
  )
}

const VALUE_PROPS = [
  { icon: <BellRing size={15} />, title: 'Auction calendar, first', body: 'Lot lists and catalogue drops before they hit the public browser.' },
  { icon: <Gavel size={15} />, title: 'Closing-price benchmarks', body: 'Weekly settled ₹/MT prints across scrap, flats, longs and ferro-alloys.' },
  { icon: <ShieldCheck size={15} />, title: 'Verified members only', body: 'GST-checked traders and mills. No brokers, no forwards, no spam.' },
]

/** Static preview of the community feed — shows the value instead of claiming it. */
function ChatPreview() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-white/12 backdrop-blur-sm px-3.5 py-2.5 ring-1 ring-inset ring-white/15">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#a7f3c4]">ferroBid Desk</div>
        <div className="text-[12.5px] text-white/90 leading-snug mt-1">
          Catalogue <span className="num font-semibold">FB-2291</span> live in 30 min — 640 MT HR coils, Raigad. Reserve undisclosed.
        </div>
      </div>
      <div className="max-w-[80%] ml-auto rounded-2xl rounded-tr-md bg-[#0b4a34] px-3.5 py-2.5 ring-1 ring-inset ring-white/10">
        <div className="text-[12.5px] text-white/90 leading-snug">
          Benchmark last week: <span className="num font-semibold">₹42,850/MT</span> ↑ 1.8%
        </div>
      </div>
    </div>
  )
}

/* -------------------------------- the modal -------------------------------- */

function InviteDialog({ onClose, onJoined, leaving }: {
  onClose: (reason: 'dismiss' | 'join') => void
  onJoined: () => void
  /** True when closing will complete a held-back navigation (role switch), so
   *  the dismiss copy doesn't promise to keep them on the page. */
  leaving?: boolean
}) {
  const pushToast = useStore((s) => s.pushToast)
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)
  const reduce =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /* scroll lock (compensating for the scrollbar so the page doesn't jump) */
  useEffect(() => {
    const { body, documentElement: html } = document
    const gap = window.innerWidth - html.clientWidth
    const prev = { overflow: body.style.overflow, pad: body.style.paddingRight }
    body.style.overflow = 'hidden'
    if (gap > 0) body.style.paddingRight = `${gap}px`
    return () => { body.style.overflow = prev.overflow; body.style.paddingRight = prev.pad }
  }, [])

  /* focus management: remember the trigger, focus the field, trap Tab, restore */
  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null
    const t = window.setTimeout(() => {
      if (window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus()
      else panelRef.current?.focus()
    }, 60)
    return () => {
      window.clearTimeout(t)
      restoreTo.current?.focus?.()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose('dismiss'); return }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (digits.length !== 10 || !/^[6-9]/.test(digits)) {
      setError('Enter a 10-digit Indian mobile number.')
      inputRef.current?.focus()
      return
    }
    setError(null)
    setJoined(true)
    onJoined()
    pushToast({
      kind: 'success',
      title: 'You’re on the list',
      body: `Invite sent to +91 ${digits.slice(0, 5)} ${digits.slice(5)} on WhatsApp.`,
    })
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-invite-title"
      aria-describedby="wa-invite-sub"
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => onClose('dismiss')}
        className="absolute inset-0 bg-black/55 backdrop-blur-[3px] cursor-default"
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={cx(
          'relative w-full sm:max-w-4xl bg-surface border border-line-strong shadow-[0_40px_100px_-30px_rgba(0,0,0,0.55)]',
          'rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[94vh] overflow-y-auto outline-none',
          !reduce && 'animate-toast-in',
        )}
      >
        <button
          type="button"
          onClick={() => onClose('dismiss')}
          aria-label="Close"
          className="absolute top-3.5 right-3.5 z-20 size-9 grid place-items-center rounded-full bg-surface/80 sm:bg-black/20 text-ink-muted sm:text-white/80 backdrop-blur-md hover:bg-surface-2 sm:hover:bg-black/35 hover:text-ink sm:hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
        >
          <X size={17} />
        </button>

        <div className="grid lg:grid-cols-12">
          {/* ---------------- brand rail ---------------- */}
          <div className="relative lg:col-span-5 overflow-hidden bg-[linear-gradient(160deg,#0f3d2e_0%,#075E54_48%,#0b6b4f_100%)] px-6 py-8 sm:px-8 sm:py-10 text-white">
            <div className={cx('absolute -top-16 -right-14 size-72 rounded-full bg-[#25D366]/25 blur-3xl pointer-events-none', !reduce && 'animate-breathe')} />
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:22px_22px] opacity-40 pointer-events-none" />

            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="size-11 rounded-2xl bg-[#25D366] text-[#04352a] grid place-items-center shadow-lg shadow-black/25">
                  <WhatsAppGlyph size={24} />
                </span>
                <div>
                  <div className="font-display font-bold text-[15px] leading-tight">ferroBid Trade Desk</div>
                  <div className="text-[11px] text-[#a7f3c4] flex items-center gap-1.5 mt-0.5">
                    <span className={cx('size-1.5 rounded-full bg-[#25D366]', !reduce && 'animate-live-pulse')} />
                    WhatsApp community · online
                  </div>
                </div>
              </div>

              <div className="mt-7">
                <ChatPreview />
              </div>

              <div className="mt-7 pt-6 border-t border-white/15 flex items-center gap-3">
                <div className="flex -space-x-2" aria-hidden="true">
                  {['MS', 'RK', 'AP', 'JV'].map((i, n) => (
                    <span
                      key={i}
                      className="size-8 rounded-full grid place-items-center text-[10px] font-bold text-white ring-2 ring-[#0b4a34] bg-white/15 backdrop-blur-sm"
                      style={{ zIndex: 4 - n }}
                    >
                      {i}
                    </span>
                  ))}
                </div>
                <div className="text-[12px] leading-tight text-white/85">
                  <span className="num font-bold text-white">1,438</span> verified traders
                  <br />
                  <span className="text-white/60">across 14 states &amp; 4 export desks</span>
                </div>
              </div>
            </div>
          </div>

          {/* ---------------- offer / form ---------------- */}
          <div className="lg:col-span-7 px-6 py-8 sm:px-9 sm:py-10">
            {!joined ? (
              <>
                <div className="inline-flex items-center gap-2 rounded-full bg-ember-soft border border-ember/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-ember-strong">
                  <span className={cx('size-1.5 rounded-full bg-ember', !reduce && 'animate-pulse')} />
                  Before you go
                </div>

                <h2
                  id="wa-invite-title"
                  className="font-display text-2xl sm:text-[2rem] font-extrabold tracking-tight leading-[1.15] text-ink mt-4 text-balance"
                >
                  Don’t miss the next catalogue drop.
                </h2>
                <p id="wa-invite-sub" className="text-sm sm:text-[15px] text-ink-muted leading-relaxed mt-3 max-w-md">
                  Join the ferroBid trade desk on WhatsApp — auction calendars, lot lists and
                  settled price benchmarks, sent before they’re public.
                </p>

                <ul className="mt-6 space-y-3.5">
                  {VALUE_PROPS.map((v) => (
                    <li key={v.title} className="flex items-start gap-3">
                      <span aria-hidden="true" className="mt-0.5 size-7 shrink-0 rounded-lg bg-success-soft text-success grid place-items-center">
                        {v.icon}
                      </span>
                      <span className="text-sm leading-snug">
                        <span className="font-bold text-ink">{v.title}</span>
                        <span className="text-ink-muted"> — {v.body}</span>
                      </span>
                    </li>
                  ))}
                </ul>

                <form onSubmit={submit} noValidate className="mt-7">
                  <label htmlFor="wa-phone" className="block text-xs font-bold uppercase tracking-wider text-ink-faint mb-2">
                    WhatsApp number
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <div
                      className={cx(
                        'flex items-center rounded-xl border bg-surface-2 overflow-hidden flex-1 transition-colors focus-within:border-ember',
                        error ? 'border-danger' : 'border-line-strong',
                      )}
                    >
                      <span className="num text-sm font-semibold text-ink-muted pl-3.5 pr-2.5 border-r border-line select-none">
                        +91
                      </span>
                      <input
                        ref={inputRef}
                        id="wa-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        maxLength={11}
                        placeholder="98765 43210"
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value); if (error) setError(null) }}
                        aria-invalid={!!error}
                        aria-describedby={error ? 'wa-phone-error' : undefined}
                        className="num flex-1 h-12 px-3 bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="h-12 px-6 rounded-xl bg-[#25D366] hover:bg-[#1fbe5a] text-[#04352a] font-bold text-sm inline-flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/25 hover:shadow-[#25D366]/40 transition-all duration-200 hover:-translate-y-0.5 select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#128C7E] shrink-0"
                    >
                      <WhatsAppGlyph size={17} /> Join community
                    </button>
                  </div>
                  {error && (
                    <p id="wa-phone-error" role="alert" className="text-xs font-semibold text-danger mt-2">
                      {error}
                    </p>
                  )}
                </form>

                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold text-ink-faint">
                  <span className="inline-flex items-center gap-1.5"><Lock size={12} /> Number never shared or sold</span>
                  <span className="inline-flex items-center gap-1.5"><Check size={12} /> 2–3 broadcasts a week</span>
                  <span className="inline-flex items-center gap-1.5"><Check size={12} /> Leave any time</span>
                </div>

                <button
                  type="button"
                  onClick={() => onClose('dismiss')}
                  className="mt-6 text-xs font-semibold text-ink-faint hover:text-ink-muted underline underline-offset-4 decoration-line-strong transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember rounded"
                >
                  {leaving ? 'No thanks, continue' : 'No thanks, keep browsing'}
                </button>
              </>
            ) : (
              /* ---------------- confirmed ---------------- */
              <div role="status" aria-live="polite" className={cx('py-2', !reduce && 'animate-fade-up')}>
                <span className="size-14 rounded-2xl bg-success-soft text-success grid place-items-center">
                  <Check size={30} strokeWidth={2.5} />
                </span>
                <h2 id="wa-invite-title" className="font-display text-2xl sm:text-[1.75rem] font-extrabold tracking-tight text-ink mt-5">
                  You’re in.
                </h2>
                <p id="wa-invite-sub" className="text-sm text-ink-muted leading-relaxed mt-3 max-w-md">
                  We’ve sent your invite to <span className="num font-semibold text-ink">+91 {phone}</span>.
                  Tap below to open the group now, or accept from WhatsApp when it arrives.
                </p>

                <ol className="mt-6 space-y-2.5 text-sm text-ink-muted">
                  {['Accept the invite in WhatsApp', 'Reply with your GSTIN so the desk can verify you', 'Next catalogue drop lands in your feed'].map((s, i) => (
                    <li key={s} className="flex items-start gap-3">
                      <span aria-hidden="true" className="num mt-px size-5 shrink-0 rounded-full bg-surface-2 border border-line-strong grid place-items-center text-[10px] font-bold text-ink">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>

                <div className="mt-7 flex flex-col sm:flex-row gap-2.5">
                  <a
                    href={COMMUNITY_INVITE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-12 px-6 rounded-xl bg-[#25D366] hover:bg-[#1fbe5a] text-[#04352a] font-bold text-sm inline-flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/25 transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#128C7E]"
                  >
                    <WhatsAppGlyph size={17} /> Open in WhatsApp <ArrowRight size={15} />
                  </a>
                  <button
                    type="button"
                    onClick={() => onClose('join')}
                    className="h-12 px-6 rounded-xl bg-surface hover:bg-surface-2 border border-line-strong text-ink font-bold text-sm inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
                  >
                    {leaving ? 'Continue' : 'Back to the site'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------- mounted at layout level ------------------- */

/**
 * ExitIntentWhatsApp — mount once inside the Guest 2 layout. Renders nothing
 * until exit intent fires, so it costs one timer and two listeners.
 */
export default function ExitIntentWhatsApp() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [eligible, setEligible] = useState(() => isEligible())
  /** Navigation held back while the invite is on screen (role-switch path). */
  const deferred = useRef<(() => void) | null>(null)

  // Already-converting pages don't need the interstitial.
  const enabled = eligible && !open && pathname !== '/g2/contact'

  const onExit = useCallback(() => {
    markSeen()
    setOpen(true)
  }, [])

  useExitIntent(enabled, onExit)

  /* Claim the chrome-level exit slot, so a chrome-driven role switch shows the
     invite before it leaves the public site. An explicit role switch is a
     definitive leave signal, so it skips the dwell timer entirely — but not
     the eligibility rules, and it never queues behind an already-open invite. */
  useEffect(() => {
    return registerExitInterstitial((proceed) => {
      if (!eligible || open || pathname === '/g2/contact') return false
      deferred.current = proceed
      markSeen()
      setOpen(true)
      return true
    })
  }, [eligible, open, pathname])

  /* Demo/QA escape hatch — `__fbInvite()` in the console opens it instantly,
     bypassing the dwell timer and every suppression rule. Dev builds only. */
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as typeof window & { __fbInvite?: () => void }
    w.__fbInvite = () => { setEligible(true); setOpen(true) }
    return () => { delete w.__fbInvite }
  }, [])

  const close = useCallback((reason: 'dismiss' | 'join') => {
    if (reason === 'dismiss') writeState('dismissed')
    setOpen(false)
    setEligible(false)
    // Release a held-back role switch — whether they joined or dismissed, they
    // asked to go somewhere and we only borrowed the moment.
    const proceed = deferred.current
    deferred.current = null
    proceed?.()
  }, [])

  const onJoined = useCallback(() => writeState('joined'), [])

  if (!open) return null
  return <InviteDialog onClose={close} onJoined={onJoined} leaving={!!deferred.current} />
}
