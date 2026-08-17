/* ---------------------------------------------------------------------------
   The guest gate — the ONE place "Browse as Guest" is enforced.

   The public homepage's "Browse as Guest" button drops a visitor into the
   buyer's real marketplace (`/buyermarketplace`) under the `guest_buyer` role.
   They get the genuine product: the live catalogue grid, the filters, every
   catalogue's lot annexure, terms, inspection details and documents. What they
   do not get is anything that would make them a participant in a sale —
   shortlisting, EMD, bidding, the wallet, their own dashboard — because that is
   what the subscription buys.

   Rather than scatter `role === 'guest_buyer'` checks (and half-disabled
   buttons) across a dozen pages, every blocked surface funnels through here:

     · a locked nav tab            → Chrome asks `block()` before navigating
     · a locked action (shortlist) → the page asks `block()` before acting
     · a URL typed by hand         → GuestRouteGuard sends them back

   All three end in the same small prompt, so the answer to "why can't I do
   this?" is identical wherever it is asked.
--------------------------------------------------------------------------- */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Eye, Gavel, Lock, LogIn } from 'lucide-react'
import { Button, Modal, cx } from './ui'
import { useStore } from '../store/store'

/** Where a guest is allowed to go. Everything else on the platform belongs to
 *  somebody with an account. Prefix match, so `/catalogue/cat-3` is covered by
 *  `/catalogue`. */
const GUEST_ALLOWED_PREFIXES = [
  '/buyermarketplace', // the tour itself
  '/catalogue', // a catalogue's lots, terms, inspection window, documents
  '/noticeboard', // public announcements
  '/help', // how the platform works
  '/legal', // terms & privacy
  '/login', // the way out of the preview
]

/** Which sentence the prompt opens with. Each names the thing they just reached
 *  for, so the prompt reads as an answer rather than a wall. */
export type GuestAction =
  | 'shortlist'
  | 'emd'
  | 'bid'
  | 'bids'
  | 'wallet'
  | 'dashboard'
  | 'auction-status'
  | 'terms'
  | 'inspection'
  | 'sell'
  | 'page'

const COPY: Record<GuestAction, { title: string; body: string }> = {
  shortlist: {
    title: 'Shortlisting is for subscribed bidders',
    body: 'Shortlisting a catalogue is the first step of taking part in its sale — it is what opens EMD funding and, after that, the bidding room. Subscribe to start shortlisting.',
  },
  emd: {
    title: 'EMD & payments is for subscribed bidders',
    body: 'Pre-bid EMD is the deposit that admits you to a sale. Funding one needs a bidder account with a wallet behind it.',
  },
  bid: {
    title: 'Bidding is for subscribed bidders',
    body: 'The bidding room is open only to bidders who have shortlisted the catalogue and funded its pre-bid EMD. Subscribe to take part.',
  },
  bids: {
    title: 'My bids is for subscribed bidders',
    body: 'This is where your own bids and results live. Subscribe to start bidding and this page fills up with your record.',
  },
  wallet: {
    title: 'The wallet is for subscribed bidders',
    body: 'Your wallet holds the balance EMD is locked from and refunded to. It comes with a bidder account.',
  },
  dashboard: {
    title: 'The buyer dashboard is for subscribed bidders',
    body: 'Your dashboard tracks the catalogues you shortlisted, the EMD you have locked and the auctions you are in. Subscribe to get one.',
  },
  'auction-status': {
    title: 'Auction status is for subscribed bidders',
    body: 'This follows the sales you are taking part in, live and after the hammer. Subscribe to take part in one.',
  },
  terms: {
    title: 'Accepting terms is for subscribed bidders',
    body: 'Accepting a catalogue’s terms is a commitment made on behalf of your firm, so it needs a verified bidder account. You can read every clause here in the meantime.',
  },
  inspection: {
    title: 'Booking an inspection is for subscribed bidders',
    body: 'A yard visit is booked against your firm and issues a gate pass in its name. Subscribe first — the inspection window and contacts stay readable here.',
  },
  sell: {
    title: 'Selling needs an account',
    body: 'Listing material for auction starts with a verified seller account. Register to begin.',
  },
  page: {
    title: 'This page is for subscribed bidders',
    body: 'You are browsing as a guest, so the marketplace and every catalogue inside it are read only. Subscribe to take part in a sale.',
  },
}

/** What a guest gets for subscribing, in the order it happens in a sale. */
const UNLOCKS = [
  'Shortlist catalogues and pick the lots you want',
  'Fund pre-bid EMD from your own wallet',
  'Enter the bidding room and bid live',
  'Track your bids, results and delivery orders',
]

interface GuestGateApi {
  /** True while the visitor is on the public "Browse as Guest" tour. */
  isGuest: boolean
  /** Ask before acting. Returns true when the action was intercepted and the
   *  prompt was shown, so the caller must stop. False for everybody else. */
  block: (action?: GuestAction) => boolean
  /** Show the prompt outright — for a surface that is *only* ever a prompt. */
  open: (action?: GuestAction) => void
  /** Leave the preview and go back to the public homepage. */
  exit: () => void
}

const Ctx = createContext<GuestGateApi | null>(null)

/** Every gated surface calls this. Never returns null, so callers stay
 *  branch-free — outside the preview `block()` simply answers false. */
export function useGuestGate(): GuestGateApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useGuestGate must be used inside <GuestGateProvider>')
  return ctx
}

/** The action behind a path a guest tried to reach directly. Keeps a typed URL
 *  and a clicked tab landing on the same sentence. */
function actionForPath(pathname: string): GuestAction {
  if (pathname.startsWith('/bidding')) return 'bid'
  if (pathname.startsWith('/buyer/wallet')) return 'wallet'
  if (pathname.startsWith('/buyer/bids')) return 'bids'
  if (pathname.startsWith('/buyer/auction-status')) return 'auction-status'
  if (pathname.startsWith('/buyer/kyc') || pathname.startsWith('/seller')) return 'sell'
  if (pathname.startsWith('/buyer/shortlist') || pathname.startsWith('/buyer/emd')) return 'emd'
  if (pathname === '/buyer') return 'dashboard'
  return 'page'
}

export function GuestGateProvider({ children }: { children: ReactNode }) {
  const role = useStore((s) => s.role)
  const switchRole = useStore((s) => s.switchRole)
  const [action, setAction] = useState<GuestAction | null>(null)
  const isGuest = role === 'guest_buyer'

  const open = useCallback<GuestGateApi['open']>((next = 'page') => setAction(next), [])

  const block = useCallback<GuestGateApi['block']>((next = 'page') => {
    if (useStore.getState().role !== 'guest_buyer') return false
    setAction(next)
    return true
  }, [])

  const exit = useCallback(() => {
    setAction(null)
    switchRole('guest1')
    window.location.hash = '/home'
  }, [switchRole])

  /* Signing in (or otherwise leaving the preview) must not leave a stale prompt
     floating over the app it no longer applies to. */
  useEffect(() => {
    if (!isGuest) setAction(null)
  }, [isGuest])

  const api = useMemo<GuestGateApi>(() => ({ isGuest, block, open, exit }), [isGuest, block, open, exit])

  return (
    <Ctx.Provider value={api}>
      {children}
      <SubscribePrompt action={action} onClose={() => setAction(null)} onExit={exit} />
    </Ctx.Provider>
  )
}

/* ---------------------------------------------------------------------------
   The prompt itself — one small dialog, whatever was reached for.
--------------------------------------------------------------------------- */
function SubscribePrompt({ action, onClose, onExit }: {
  action: GuestAction | null; onClose: () => void; onExit: () => void
}) {
  const copy = COPY[action ?? 'page']
  return (
    <Modal open={action !== null} onClose={onClose} title={copy.title}>
      <p className="text-sm text-ink-muted">{copy.body}</p>

      <div className="card bg-surface-2 border-0 mt-4 p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">A bidder subscription unlocks</div>
        <ul className="mt-2.5 space-y-2">
          {UNLOCKS.map((u) => (
            <li key={u} className="flex items-start gap-2 text-sm text-ink">
              <Check size={15} className="text-success shrink-0 mt-0.5" />
              <span>{u}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mt-5">
        {/* The plans live on the public site, which runs its own router outside
            this app (see guest1/Guest1Gate.tsx) — a hash link, not a <Link>. */}
        <a href="#/home/pricing" className="flex-[2]" onClick={onClose}>
          <Button className="w-full"><Gavel size={15} /> View plans & subscribe</Button>
        </a>
        <a href="#/home/auth" className="flex-1" onClick={onClose}>
          <Button variant="secondary" className="w-full"><LogIn size={15} /> Sign in</Button>
        </a>
      </div>

      <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-line">
        <button onClick={onClose} className="text-[13px] font-semibold text-steel hover:underline inline-flex items-center gap-1.5">
          <Eye size={14} /> Keep browsing as a guest
        </button>
        <button onClick={onExit} className="text-[13px] font-semibold text-ink-faint hover:text-ink">
          Leave preview
        </button>
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------------------------------
   The route guard — the backstop behind the locked tabs.

   A locked tab already refuses to navigate, but a bookmark, a deep link inside
   a page, or a hand-typed hash would otherwise walk a guest straight into a
   signed-in buyer's screens (rendering them empty, since a guest has no
   account). This sends them back to the marketplace with the same prompt.
--------------------------------------------------------------------------- */
export function GuestRouteGuard() {
  const { isGuest, open } = useGuestGate()
  const { pathname } = useLocation()
  const nav = useNavigate()

  useEffect(() => {
    if (!isGuest) return
    const allowed = GUEST_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
    if (allowed) return
    nav('/buyermarketplace', { replace: true })
    open(actionForPath(pathname))
  }, [isGuest, pathname, nav, open])

  return null
}

/* ---------------------------------------------------------------------------
   The preview banner — says what this is, on every page of the tour.
--------------------------------------------------------------------------- */
export function GuestPreviewBanner() {
  const { isGuest, open, exit } = useGuestGate()
  if (!isGuest) return null
  return (
    <div className="border-b border-ember/25 bg-ember-soft/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ember-strong">
          <Eye size={14} /> Guest preview
        </span>
        <span className="text-[13px] text-ink-muted">
          Read only — browse every catalogue and its lots. Shortlisting, EMD and bidding need a subscription.
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={() => open('page')}>
            Subscribe to bid <ArrowRight size={14} />
          </Button>
          <button onClick={exit} className="text-[13px] font-semibold text-ink-muted hover:text-ink whitespace-nowrap">
            Exit
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   The wallet slot, for a visitor who has no wallet.

   The header's wallet chip carries a balance and locked EMD. A guest has
   neither, and showing zeroes would state something false about their account,
   so this holds the same slot with the figures struck out entirely.
--------------------------------------------------------------------------- */
export function GuestWalletChip({ className }: { className?: string }) {
  const { open } = useGuestGate()
  return (
    <button
      type="button"
      onClick={() => open('wallet')}
      title="Wallet & EMD — subscribe to open an account"
      className={cx('inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-surface-2 border border-dashed border-line-strong',
        'text-ink-faint hover:text-ink hover:border-ink/30 whitespace-nowrap shrink-0', className)}
    >
      <Lock size={13} />
      <span className="text-[13px] font-bold">Wallet —</span>
      <span className="text-[11px] hidden xl:inline">·&nbsp;EMD —</span>
    </button>
  )
}
