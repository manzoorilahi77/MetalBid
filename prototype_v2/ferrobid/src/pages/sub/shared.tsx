/* ---------------------------------------------------------------------------
   Sub Admin workspace — shared derivations and primitives.

   This role is the head of operations, not a narrower version of one. It runs
   the whole pre-auction pipeline, runs the auction, verifies sellers, manages
   the field team, administers every account and handles support — and it
   watches the money without ever moving it.

   Three things are assembled here rather than on the screens, so that they
   cannot drift apart:

   · **The board** — every piece of work waiting on this desk, whatever it is,
     ranked by how close it is to its SLA. The ops console shows the top of it
     and the work queue shows all of it; both read `useWorkBoard()`, so a count
     on the dashboard and the list you land on after clicking it are the same
     list, derived once.
   · **Claims** — every Sub Admin account is identical, with the same full menu
     and the same powers. What divides the work is who has picked each item up,
     which is why claiming is a first-class thing here and a permission template
     is not.
   · **The review feed** — everything the operational roles have already done,
     which is what the Approvals inbox reviews. Supervisory, after the fact:
     they act first and it takes effect immediately.
--------------------------------------------------------------------------- */
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2, ClipboardCheck, Flag, GanttChartSquare, Gavel, KeyRound, Landmark,
  MessageSquareWarning, PackageSearch, Receipt, ShieldQuestion, Ticket, UserCheck, Wallet,
} from 'lucide-react'
import { Avatar, Button, Chip, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type {
  ActionReview, AuditEvent, BankAccount, BidVoidRequest, Catalogue, CommissionSettlement,
  DepositClaim, Dispute, EmdExemptionRequest, Lot, PasswordReset, User, WithdrawalRequest,
} from '../../types'

/* ============================== the board ================================= */

export type WorkKind =
  | 'flag' | 'kyc' | 'dispute' | 'sta' | 'bid_flag' | 'emd_exemption'
  | 'password_reset' | 'deposit_claim' | 'withdrawal_request' | 'bank_account'
  // The pre-auction hand-offs this board used to miss entirely: a lot waiting
  // on the yard, a filed report waiting on a decision, a closed sale waiting on
  // its results, and a commission the seller says they have paid.
  | 'unassigned_lot' | 'lot_decision' | 'result_confirm' | 'commission'

export interface WorkItem {
  id: string
  kind: WorkKind
  title: string
  sub: string
  /** Where it is actually resolved. Nothing on a dashboard is edited in place. */
  href: string
  dueH: number
  leftMs: number
  overdue: boolean
  amber: boolean
  dueLabel: string
  /** True when this desk decides it. False when this desk only watches it —
   *  money is Finance's, a void is the Super Admin's. */
  mine: boolean
  claimedBy?: User
  claimedAt?: string
  lot?: Lot
  user?: User
  dispute?: Dispute
  depositClaim?: DepositClaim
  withdrawalRequest?: WithdrawalRequest
  bankAccount?: BankAccount
  exemption?: EmdExemptionRequest
  bidFlag?: BidVoidRequest
  reset?: PasswordReset
  catalogue?: Catalogue
  settlement?: CommissionSettlement
}

export const WORK_ICON: Record<WorkKind, typeof Flag> = {
  flag: Flag, kyc: UserCheck, dispute: MessageSquareWarning, sta: ShieldQuestion,
  bid_flag: Gavel, emd_exemption: Ticket, password_reset: KeyRound,
  deposit_claim: Landmark, withdrawal_request: Wallet, bank_account: Building2,
  unassigned_lot: PackageSearch, lot_decision: ClipboardCheck,
  result_confirm: GanttChartSquare, commission: Receipt,
}

export const WORK_LABEL: Record<WorkKind, string> = {
  flag: 'Flagged lot', kyc: 'Seller verification', dispute: 'Dispute', sta: 'STA chase',
  bid_flag: 'Flagged bid', emd_exemption: 'EMD exemption', password_reset: 'Password reset',
  deposit_claim: 'Deposit claim', withdrawal_request: 'Withdrawal', bank_account: 'Bank account',
  unassigned_lot: 'Lot to catalogue', lot_decision: 'Lot decision',
  result_confirm: 'Results to confirm', commission: 'Commission',
}

/** Tailwind tint per kind, so the same class of work reads the same way on the
 *  console as it does on the queue. */
export const WORK_TINT: Record<WorkKind, string> = {
  flag: 'bg-warning-soft text-warning',
  kyc: 'bg-steel-soft text-steel-strong',
  dispute: 'bg-danger-soft text-danger',
  sta: 'bg-surface-2 text-ink-muted',
  bid_flag: 'bg-warning-soft text-warning',
  emd_exemption: 'bg-steel-soft text-steel-strong',
  password_reset: 'bg-surface-2 text-ink-muted',
  deposit_claim: 'bg-ember-soft text-ember-strong',
  withdrawal_request: 'bg-ember-soft text-ember-strong',
  bank_account: 'bg-ember-soft text-ember-strong',
  unassigned_lot: 'bg-steel-soft text-steel-strong',
  lot_decision: 'bg-steel-soft text-steel-strong',
  result_confirm: 'bg-warning-soft text-warning',
  commission: 'bg-ember-soft text-ember-strong',
}

/** Deterministic hash → the same item always shows the same SLA countdown, so
 *  the board does not reshuffle itself on every render. */
const hashOf = (s: string) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

const leftLabel = (ms: number) => {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return `${h}h ${String(m).padStart(2, '0')}m left`
}

/** Everything waiting on this desk, ranked by SLA — the single list the ops
 *  console and the work queue both render. */
export function useWorkBoard(): WorkItem[] {
  const lots = useStore((s) => s.lots)
  const users = useStore((s) => s.users)
  const disputes = useStore((s) => s.disputes)
  const catalogues = useStore((s) => s.catalogues)
  const depositClaims = useStore((s) => s.depositClaims)
  const withdrawalRequests = useStore((s) => s.withdrawalRequests)
  const bankAccounts = useStore((s) => s.bankAccounts)
  const exemptions = useStore((s) => s.emdExemptionRequests)
  const bidVoidRequests = useStore((s) => s.bidVoidRequests)
  const passwordResets = useStore((s) => s.passwordResets)
  const resultConfirmations = useStore((s) => s.resultConfirmations)
  const commissionSettlements = useStore((s) => s.commissionSettlements)
  const claims = useStore((s) => s.workClaims)

  return useMemo<WorkItem[]>(() => {
    const userBy = (id: string) => users.find((u) => u.id === id)
    const firmOf = (id: string) => userBy(id)?.firm ?? 'Account'
    const closedCatIds = new Set(catalogues.filter((c) => c.status === 'closed').map((c) => c.id))
    const lotBy = (id: string) => lots.find((l) => l.id === id)

    type Raw = Omit<WorkItem, 'leftMs' | 'overdue' | 'amber' | 'dueLabel' | 'claimedBy' | 'claimedAt'>
    const raw: Raw[] = [
      /* --- the pre-auction gate: this desk decides these outright --- */
      /* A submitted lot with no catalogue behind it cannot reach an inspector at
         all — the field queue is driven by catalogue assignment — so it is the
         first thing that has to be picked up, and it used to be on no board. */
      ...lots.filter((l) => l.status === 'pending_inspection' && !l.catalogueId).map<Raw>((l) => ({
        id: `wq-uncat-${l.id}`, kind: 'unassigned_lot',
        title: `Catalogue ${l.lotNo} and book the yard visit`,
        sub: `${l.metal} ${l.grade} · ${num(l.indicativeQty)} ${l.uom} · ${l.yard || 'yard not given'}`,
        href: '/exec/catalogue-builder', dueH: 12, mine: true, lot: l,
      })),
      /* A filed report waiting on a decision — the single busiest hand-off in
         the pre-auction chain, and previously invisible here. */
      ...lots.filter((l) => l.status === 'inspected').map<Raw>((l) => ({
        id: `wq-decide-${l.id}`, kind: 'lot_decision',
        title: `Decide ${l.lotNo} — inspection filed`,
        sub: `${l.metal} ${l.grade} · ${num(l.indicativeQty)} ${l.uom} · ${l.yard}`,
        href: '/exec/approvals', dueH: 8, mine: true, lot: l,
      })),
      ...lots.filter((l) => l.status === 'flagged').map<Raw>((l) => ({
        id: `wq-flag-${l.id}`, kind: 'flag',
        title: `Review flagged lot ${l.lotNo}`,
        sub: `${l.metal} ${l.grade} · ${num(l.indicativeQty)} ${l.uom} · ${l.yard}`,
        href: '/exec/approvals', dueH: 4, mine: true, lot: l,
      })),
      ...users.filter((u) => u.kycStatus === 'pending').map<Raw>((u) => ({
        id: `wq-kyc-${u.id}`, kind: 'kyc',
        title: `Verify seller — ${u.firm}`,
        sub: `${u.name} · ${u.city}`,
        href: '/sub/seller-verification', dueH: 24, mine: true, user: u,
      })),
      ...disputes.filter((d) => d.status !== 'resolved').map<Raw>((d) => ({
        id: `wq-dsp-${d.id}`, kind: 'dispute',
        title: `Dispute: ${d.subject}`,
        sub: `${firmOf(d.userId)} · ${d.category}${d.refundId ? ' · refund with Finance' : ''}`,
        href: '/sub/disputes', dueH: 8, mine: true, dispute: d,
      })),
      ...lots.filter((l) => l.status === 'sta' && closedCatIds.has(l.catalogueId)).map<Raw>((l) => ({
        id: `wq-sta-${l.id}`, kind: 'sta',
        title: `Chase STA decision — ${l.lotNo}`,
        sub: `H1 ${inr(l.resultH1Rate ?? l.currentRate ?? 0)}/${l.uom} below reserve · ${catalogues.find((c) => c.id === l.catalogueId)?.code ?? ''}`,
        href: '/exec/settlement', dueH: 48, mine: true, lot: l,
      })),

      /* --- the auction floor --- */
      ...exemptions.filter((e) => e.status === 'pending').map<Raw>((e) => ({
        id: `wq-emd-${e.id}`, kind: 'emd_exemption',
        title: `EMD exemption — ${firmOf(e.buyerId)}`,
        sub: `${catalogues.find((c) => c.id === e.catalogueId)?.code ?? ''} · ${e.reason}`,
        href: '/auction/emd-eligibility', dueH: 6, mine: true, exemption: e,
      })),
      // Flagging a bid is this desk's; voiding one never is. A flag still on
      // `flagged` is ours to judge; once it has been raised as a void request
      // it is the Super Admin's, and we are only watching it.
      ...bidVoidRequests.filter((r) => r.status === 'pending').map<Raw>((r) => {
        const bidLot = lotBy(r.lotId)
        return {
          id: `wq-bidflag-${r.id}`, kind: 'bid_flag',
          title: `Flagged bid — ${bidLot?.lotNo ?? r.lotId}`,
          sub: `${r.reason}${r.stage === 'requested' ? ' · void requested, with Super Admin' : ' · decide whether to request a void'}`,
          href: '/sub/bid-monitor', dueH: 2, mine: r.stage === 'flagged', bidFlag: r,
        }
      }),

      /* A closed sale sits still until someone confirms its results — and the
         seller's whole settlement waits behind that one action. */
      ...catalogues
        .filter((c) => c.status === 'closed' && !resultConfirmations.some((r) => r.catalogueId === c.id))
        .map<Raw>((c) => ({
          id: `wq-results-${c.id}`, kind: 'result_confirm',
          title: `Confirm results — ${c.code}`,
          sub: `${lots.filter((l) => l.catalogueId === c.id && l.status === 'sold').length} sold · ${c.title} — the seller cannot settle until this is done`,
          href: '/auction/results', dueH: 12, mine: true, catalogue: c,
        })),

      /* --- accounts --- */
      ...passwordResets.filter((r) => !r.consumed).map<Raw>((r) => ({
        id: `wq-pwd-${r.id}`, kind: 'password_reset',
        title: `Password issued — ${firmOf(r.userId)}`,
        sub: `${userBy(r.userId)?.name ?? r.userId} has not signed in with it yet`,
        href: '/admin/users', dueH: 4, mine: true, reset: r,
      })),

      /* --- money: seen here, decided by Finance --- */
      ...depositClaims.filter((c) => c.status === 'submitted').map<Raw>((c) => ({
        id: `wq-dep-${c.id}`, kind: 'deposit_claim',
        title: `Deposit claim — ${inr(c.amount)}`,
        sub: `${firmOf(c.userId)} · UTR ${c.utr}`,
        href: '/finance/deposits', dueH: 24, mine: false, depositClaim: c,
      })),
      ...bankAccounts.filter((a) => a.status === 'pending').map<Raw>((a) => ({
        id: `wq-bank-${a.id}`, kind: 'bank_account',
        title: `Payout account — ${a.bankName} •••• ${a.last4}`,
        sub: `${firmOf(a.userId)} · ${a.accountHolderName}`,
        href: '/finance/bank-accounts', dueH: 24, mine: false, bankAccount: a,
      })),
      ...withdrawalRequests.filter((r) => r.status === 'requested' || r.status === 'under_review').map<Raw>((r) => ({
        id: `wq-wdr-${r.id}`, kind: 'withdrawal_request',
        title: `Withdrawal — ${inr(r.amount)}`,
        sub: `${firmOf(r.userId)} · ${r.status === 'requested' ? 'awaiting Finance review' : 'awaiting Finance processing'}`,
        href: '/finance/withdrawals', dueH: 24, mine: false, withdrawalRequest: r,
      })),
      // A commission the seller says they have paid. Finance confirms it against
      // the bank; this desk watches it, because an auction is not finished until
      // it clears.
      ...commissionSettlements.filter((r) => r.status === 'recorded' || r.status === 'queried').map<Raw>((r) => ({
        id: `wq-comm-${r.id}`, kind: 'commission',
        title: `Commission — ${inr(r.amount)}`,
        sub: `${firmOf(r.sellerId)} · ${catalogues.find((c) => c.id === r.catalogueId)?.code ?? ''} · ${r.status === 'queried' ? 'queried with the seller' : 'awaiting Finance confirmation'}`,
        href: '/finance/commission', dueH: 24, mine: false, settlement: r,
      })),
    ]

    const withSla = raw.map((r) => {
      const dueMs = r.dueH * 3_600_000
      const fraction = ((hashOf(r.id) % 90) + 5) / 100 // deterministic 5–94% of SLA left
      const leftMs = Math.round(dueMs * fraction)
      const claim = claims[r.id]
      return {
        ...r,
        leftMs,
        overdue: false,
        amber: fraction < 0.25,
        dueLabel: leftLabel(leftMs),
        claimedBy: claim ? users.find((u) => u.id === claim.byId) : undefined,
        claimedAt: claim?.at,
      }
    })
    // The tightest item on the board has already blown its SLA — a queue that
    // never shows a breach teaches the desk that the colour means nothing.
    const owned = withSla.filter((i) => i.mine)
    if (owned.length > 0) {
      const worst = owned.reduce((a, b) =>
        (a.leftMs / (a.dueH * 3_600_000) <= b.leftMs / (b.dueH * 3_600_000) ? a : b))
      worst.overdue = true
      worst.amber = false
      worst.dueLabel = 'Overdue'
    }
    return withSla.sort((a, b) =>
      Number(b.overdue) - Number(a.overdue)
      || Number(b.mine) - Number(a.mine)
      || a.leftMs - b.leftMs)
  }, [lots, users, disputes, catalogues, depositClaims, bankAccounts, withdrawalRequests, exemptions, bidVoidRequests, passwordResets, resultConfirmations, commissionSettlements, claims])
}

/* ============================ the review feed ============================== */

/** Actions by an operational role that a Sub Admin may want to confirm,
 *  question or reverse. Deliberately not everything on the audit trail: this
 *  desk supervises the operational roles, not the customers and not itself. */
const OPERATIONAL_ACTIONS = [
  'lot.approved', 'lot.rejected', 'lot.send_back', 'inspection.bypass', 'inspection.submit',
  // Older keys still on the seeded record. The store writes the ones above now,
  // but history does not get rewritten to match a rename — an inbox that only
  // understood today's vocabulary would open on an empty list against a
  // platform with months of activity behind it.
  'lot.approve', 'lot.flag', 'kyc.review', 'settlement.approve',
  'catalogue.publish', 'catalogue.assign', 'catalogue.override',
  'auction.pause', 'auction.resume', 'auction.extend', 'auction.reschedule',
  'auction.results_confirm', 'auction.return_to_ops', 'auction.sta_refer', 'auction.cancel_request',
  'emd_exemption.approve', 'emd_exemption.reject',
  'kyc.approve', 'kyc.reject',
  'delivery.handover', 'do.complete',
  'bid.flag', 'bid.void', 'bid.void_request',
  'announcement.send',
  'user.standing', 'account.status',
]

/** Roles this desk supervises. Its own work, and the customers', are not in
 *  scope: a Sub Admin reviewing their own decision is not a review. */
const SUPERVISED_ROLES = new Set(['field_exec', 'exec_manager', 'auction_manager'])

export interface ReviewRow {
  event: AuditEvent
  actor?: User
  /** Set once this desk has recorded a verdict on it. */
  review?: ActionReview
}

/** The Approvals inbox, in one place: what the operational roles did, and what
 *  this desk has already said about it. */
export function useReviewFeed() {
  const auditEvents = useStore((s) => s.auditEvents)
  const users = useStore((s) => s.users)
  const reviews = useStore((s) => s.actionReviews)

  return useMemo(() => {
    const roleOf = (id: string) => users.find((u) => u.id === id)?.role
    return auditEvents
      .filter((e) => OPERATIONAL_ACTIONS.includes(e.action))
      .filter((e) => {
        const r = roleOf(e.actorId)
        // System-generated entries have no author to answer for them; a
        // Sub Admin's own entries are not theirs to sign off.
        return r ? SUPERVISED_ROLES.has(r) : e.actorId === 'system'
      })
      .map((event) => ({
        event,
        actor: users.find((u) => u.id === event.actorId),
        review: reviews.find((r) => r.eventId === event.id),
      }))
  }, [auditEvents, users, reviews])
}

/* ============================== primitives ================================ */

/** A link that reads as a button. Half of this workspace's rows resolve
 *  somewhere else — nothing on a dashboard is edited in place — so they need to
 *  navigate, and a `<button>` inside an `<a>` is not a link. */
export function LinkButton({ to, children, variant = 'secondary' }: {
  to: string; children: ReactNode; variant?: 'secondary' | 'ghost'
}) {
  return (
    <Link
      to={to}
      className={cx('inline-flex items-center justify-center font-semibold transition-colors select-none whitespace-nowrap',
        'h-8 px-3 text-[13px] rounded-lg gap-1.5',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember',
        variant === 'secondary'
          ? 'bg-surface text-ink border border-line-strong hover:border-ink/40 hover:bg-surface-2'
          : 'bg-transparent text-ink-muted hover:text-ink hover:bg-surface-2 border border-transparent')}>
      {children}
    </Link>
  )
}

/** Shown at the top of a screen this desk watches but does not execute. One
 *  sentence, once, beats each button explaining itself. */
export function WatchOnlyBanner({ children }: { children: ReactNode }) {
  return (
    <div className="card bg-warning-soft/50 border-0 p-4 mb-6 text-sm text-ink-muted">
      {children}
    </div>
  )
}

/** The SLA pill. One component so amber and red mean the same thing on the
 *  console as they do on the queue. */
export function SlaChip({ item }: { item: WorkItem }) {
  return (
    <Chip tone={item.overdue ? 'danger' : item.amber ? 'warning' : 'neutral'} className="num">
      {item.dueLabel}
    </Chip>
  )
}

/** Claim, release, or see who already has it. Every account may act on every
 *  item — this only stops two people answering the same customer. */
export function ClaimControl({ item, compact }: { item: WorkItem; compact?: boolean }) {
  const me = useStore((s) => s.currentUser)
  const claimWorkItem = useStore((s) => s.claimWorkItem)
  const releaseWorkItem = useStore((s) => s.releaseWorkItem)
  const pushToast = useStore((s) => s.pushToast)
  const now = useNow()

  if (!item.mine) return null

  if (item.claimedBy) {
    const isMine = item.claimedBy.id === me?.id
    return (
      <div className="flex items-center gap-2">
        <span title={`${isMine ? 'You took this' : `${item.claimedBy.name} is on this`} ${item.claimedAt ? relTime(item.claimedAt, now) : ''}`}>
          <Avatar name={item.claimedBy.name} hue={item.claimedBy.avatarHue} size={26} />
        </span>
        {!compact && (
          isMine
            ? <Button variant="ghost" size="sm" onClick={() => releaseWorkItem(item.id)}>Put back</Button>
            : <Chip tone="steel">{item.claimedBy.name.split(' ')[0]}</Chip>
        )}
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        const r = claimWorkItem(item.id)
        if (!r.ok) pushToast({ kind: 'warning', title: 'Not claimed', body: r.error })
      }}>
      Claim
    </Button>
  )
}

/** One row of the board. Used whole on the work queue and, trimmed, on the
 *  console — so the two can never show a different title for the same job. */
export function WorkRow({ item, action, className }: {
  item: WorkItem; action?: ReactNode; className?: string
}) {
  const Icon = WORK_ICON[item.kind]
  return (
    <li className={cx('flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-line last:border-0', className)}>
      <span className={cx('size-9 rounded-xl border border-line flex items-center justify-center shrink-0', WORK_TINT[item.kind])}>
        <Icon size={16} />
      </span>
      <div className="flex-1 min-w-52">
        <div className="font-semibold text-sm">{item.title}</div>
        <div className="text-xs text-ink-muted mt-0.5">
          {WORK_LABEL[item.kind]} · {item.sub}
          {!item.mine && <span className="text-ink-faint"> · watching</span>}
        </div>
      </div>
      <SlaChip item={item} />
      <ClaimControl item={item} />
      {action ?? <LinkButton to={item.href}>{item.mine ? 'Open' : 'View'}</LinkButton>}
    </li>
  )
}

/** A dashboard work list: a heading, the top few rows, and the way to the rest.
 *  Nothing here is edited in place — every row is a link to where it is
 *  actually resolved. */
export function WorkList({ title, icon, items, to, toLabel, empty, limit = 5 }: {
  title: string
  icon?: ReactNode
  items: WorkItem[]
  to: string
  toLabel: string
  empty: string
  limit?: number
}) {
  const shown = items.slice(0, limit)
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-line">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">{icon}{title}</h2>
        <Chip tone={items.some((i) => i.overdue) ? 'danger' : 'neutral'} className="num">{num(items.length)}</Chip>
      </div>
      {shown.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul>
          {shown.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-line last:border-0">
              <div className="flex-1 min-w-48">
                <Link to={i.href} className="font-semibold text-sm hover:text-ember">{i.title}</Link>
                <div className="text-xs text-ink-faint mt-0.5">{WORK_LABEL[i.kind]} · {i.sub}</div>
              </div>
              <SlaChip item={i} />
              <ClaimControl item={i} compact />
            </li>
          ))}
        </ul>
      )}
      <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs">
        <Link to={to} className="font-semibold text-ember hover:underline">{toLabel} →</Link>
      </div>
    </section>
  )
}
