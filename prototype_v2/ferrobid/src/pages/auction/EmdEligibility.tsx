/* ---------------------------------------------------------------------------
   Auction Manager — EMD eligibility.

   A buyer who missed the pre-bid EMD cut-off asks to be let into the sale
   anyway. Buyers can already raise this request from five places in the app and
   until this screen existed nobody could answer one — every request was a dead
   end and a lost bidder.

   This is an eligibility call, not a payment one: Finance sees the money behind
   it and never decides it. Shared with the Operation Manager, Sub Admin and
   Super Admin so a sale never waits on one person being at their desk.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Clock, Gavel, ShieldQuestion, ThumbsDown, ThumbsUp, Wallet as WalletIcon } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, EmptyState, ProgressBar, PageHeader, Segmented, Stat, cx,
} from '../../components/ui'
import { selectionSummary, useStore } from '../../store/store'
import { fmtDateTime, inr, inrCompact, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { ReasonModal, ScopeNote } from './shared'
import type { EmdExemptionRequest, Standing } from '../../types'

const STANDING_TONE: Record<Standing, 'success' | 'warning' | 'danger'> = {
  good: 'success', watchlist: 'warning', defaulter: 'danger',
}
const STANDING_LABEL: Record<Standing, string> = {
  good: 'Good standing', watchlist: 'On the watchlist', defaulter: 'Defaulter',
}

export default function EmdEligibility() {
  const now = useNow()
  const requests = useStore((s) => s.emdExemptionRequests)
  const catalogues = useStore((s) => s.catalogues)
  const users = useStore((s) => s.users)
  const wallets = useStore((s) => s.wallets)
  const bids = useStore((s) => s.bids)
  const lots = useStore((s) => s.lots)
  const selections = useStore((s) => s.selections)
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const approve = useStore((s) => s.approveEmdExemption)
  const reject = useStore((s) => s.rejectEmdExemption)
  const pushToast = useStore((s) => s.pushToast)

  const [tab, setTab] = useState<'pending' | 'decided'>('pending')
  const [rejecting, setRejecting] = useState<EmdExemptionRequest | null>(null)

  const pending = requests.filter((r) => r.status === 'pending')
  const decided = requests.filter((r) => r.status !== 'pending')
  const shown = tab === 'pending' ? pending : decided

  const exposure = pending.reduce((sum, r) => sum + selectionSummary({ selections, lots }, r.buyerId, r.catalogueId).required, 0)

  return (
    <Page>
      <PageHeader
        title="EMD eligibility"
        sub="Buyers who missed the pre-bid EMD cut-off and asked to be let in anyway. Approving reopens funding for that buyer on that one auction — nothing else."
        actions={
          <Segmented value={tab} onChange={setTab} options={[
            { key: 'pending', label: `Awaiting a decision${pending.length ? ` · ${pending.length}` : ''}` },
            { key: 'decided', label: `Decided${decided.length ? ` · ${decided.length}` : ''}` },
          ]} />
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Waiting on you" value={num(pending.length)} tone={pending.length ? 'warning' : 'success'} sub="Each one is a bidder standing still" />
        <Stat label="Bidding value at stake" value={inrCompact(exposure)} tone="steel" sub="EMD these buyers want to lock" />
        <Stat label="Approved" value={num(requests.filter((r) => r.status === 'approved').length)} tone="success" sub="Let into the sale" />
        <Stat label="Rejected" value={num(requests.filter((r) => r.status === 'rejected').length)} sub="Told why, on the spot" />
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={tab === 'pending' ? <CheckCircle2 size={32} strokeWidth={1.5} /> : <ShieldQuestion size={32} strokeWidth={1.5} />}
          title={tab === 'pending' ? 'Nobody is waiting to be let in' : 'Nothing decided yet'}
          body={tab === 'pending'
            ? 'Requests land here the moment a buyer misses an EMD cut-off and asks for an exemption.'
            : 'Approved and rejected requests keep their reason and the name of whoever decided them.'}
        />
      ) : (
        <div className="space-y-3">
          {shown.map((r, i) => {
            const buyer = users.find((u) => u.id === r.buyerId)
            const cat = catalogues.find((c) => c.id === r.catalogueId)
            const wallet = wallets.find((w) => w.userId === r.buyerId)
            const sel = selectionSummary({ selections, lots }, r.buyerId, r.catalogueId)
            const available = wallet?.balance ?? 0
            const canCover = available >= sel.required
            const history = {
              bids: bids.filter((b) => b.bidderId === r.buyerId && b.status === 'valid').length,
              won: deliveryOrders.filter((d) => d.buyerId === r.buyerId).length,
            }
            const decider = r.decidedBy ? users.find((u) => u.id === r.decidedBy) : undefined

            return (
              <div key={r.id} className="card overflow-hidden animate-fade-up" style={{ animationDelay: `${i * 45}ms` }}>
                {/* who is asking, and for what */}
                <div className="p-4 flex flex-wrap items-start gap-4">
                  <Avatar name={buyer?.name ?? '??'} hue={buyer?.avatarHue ?? 200} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold text-base">{buyer?.firm ?? 'Unknown firm'}</span>
                      {buyer && <Chip tone={STANDING_TONE[buyer.standing]}>{STANDING_LABEL[buyer.standing]}</Chip>}
                      {buyer?.bidderId && <Chip tone="steel" className="num">{buyer.bidderId}</Chip>}
                    </div>
                    <div className="text-[13px] text-ink-muted mt-0.5">
                      {buyer?.name} · {buyer?.city} · joined {buyer ? fmtDateTime(buyer.joinedAt) : '—'}
                    </div>
                    <div className="text-[13px] mt-1.5">
                      wants into <span className="num font-bold text-ember">{cat?.code ?? 'an auction'}</span>
                      <span className="text-ink-muted"> — {cat?.title}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Cut-off passed</div>
                    <div className="num text-sm font-bold text-warning mt-0.5">
                      {cat ? relTime(cat.emdDeadline, now) : '—'}
                    </div>
                    <div className="text-[11px] text-ink-faint mt-0.5">asked {relTime(r.createdAt, now)}</div>
                  </div>
                </div>

                {/* their words, verbatim */}
                <div className="px-4 pb-4">
                  <div className="rounded-xl bg-surface-2 border border-line px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint mb-1">What they told us</div>
                    <p className="text-[13px] text-ink italic">“{r.reason}”</p>
                  </div>
                </div>

                {/* the facts behind the decision */}
                <div className="px-4 pb-4 grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2 rounded-xl border border-line p-3.5">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint flex items-center gap-1.5">
                        <WalletIcon size={12} /> Can they actually fund it?
                      </span>
                      <Chip tone={canCover ? 'success' : 'danger'}>
                        {canCover ? 'Wallet covers the EMD' : `Short by ${inrCompact(sel.required - available)}`}
                      </Chip>
                    </div>
                    <ProgressBar value={Math.min(available, sel.required)} max={Math.max(sel.required, 1)} tone={canCover ? 'success' : 'warning'} />
                    <div className="flex items-center justify-between mt-2 text-[13px]">
                      <span className="text-ink-muted">Available <span className="num font-semibold text-ink">{inr(available)}</span></span>
                      <span className="text-ink-muted">EMD required <span className="num font-semibold text-ink">{inr(sel.required)}</span></span>
                    </div>
                    <div className="text-[11px] text-ink-faint mt-1.5">
                      {num(sel.count)} lot{sel.count === 1 ? '' : 's'} shortlisted on this auction
                      {sel.funded > 0 && <> · {inr(sel.funded)} already locked</>}
                    </div>
                  </div>

                  <div className="rounded-xl border border-line p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint mb-2 flex items-center gap-1.5">
                      <Gavel size={12} /> Track record
                    </div>
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="text-ink-muted">Valid bids placed</span>
                      <span className="num font-bold">{num(history.bids)}</span>
                    </div>
                    <div className="flex items-baseline justify-between text-[13px] mt-1">
                      <span className="text-ink-muted">Lots won</span>
                      <span className="num font-bold">{num(history.won)}</span>
                    </div>
                    <div className="flex items-baseline justify-between text-[13px] mt-1">
                      <span className="text-ink-muted">KYC</span>
                      <span className="font-semibold capitalize">{buyer?.kycStatus ?? '—'}</span>
                    </div>
                  </div>
                </div>

                {/* the decision */}
                {r.status === 'pending' ? (
                  <div className="px-4 py-3 border-t border-line bg-surface-2/50 flex flex-wrap items-center gap-2">
                    <span className="text-[13px] text-ink-muted mr-auto">
                      Approving reopens EMD funding for {buyer?.firm ?? 'this buyer'} on {cat?.code ?? 'this auction'} only.
                    </span>
                    <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setRejecting(r)}>
                      <ThumbsDown size={14} /> Reject
                    </Button>
                    <Button variant="success" size="sm"
                      onClick={() => {
                        approve(r.id)
                        pushToast({ kind: 'success', title: 'Exemption approved', body: `${buyer?.firm ?? 'The buyer'} can fund EMD on ${cat?.code ?? 'this auction'} and join the sale.` })
                      }}>
                      <ThumbsUp size={14} /> Approve — let them in
                    </Button>
                  </div>
                ) : (
                  <div className={cx('px-4 py-3 border-t flex flex-wrap items-center gap-2 text-[13px]',
                    r.status === 'approved' ? 'border-success/20 bg-success-soft/40' : 'border-danger/20 bg-danger-soft/40')}>
                    <Chip tone={r.status === 'approved' ? 'success' : 'danger'}>
                      {r.status === 'approved' ? 'Approved' : 'Rejected'}
                    </Chip>
                    <span className="text-ink-muted">
                      by {decider?.name ?? 'the auction desk'}
                      {r.decidedAt && <> · {fmtDateTime(r.decidedAt)}</>}
                      {r.rejectionReason && <> — “{r.rejectionReason}”</>}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6">
        <ScopeNote>
          This decides <em>eligibility</em>, never money. Approving does not credit a wallet, waive an EMD or move a rupee —
          it reopens the funding window for one buyer on one auction, and they still have to fund it themselves before the
          sale opens. Finance reads every one of these on the{' '}
          <Link to="/finance/emd" className="text-ember font-semibold hover:underline">EMD ledger</Link> and decides none
          of them; equally, this desk can never release or forfeit the EMD it lets a buyer put down.
        </ScopeNote>
      </div>

      <ReasonModal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject this exemption"
        intent="danger"
        confirmLabel="Reject and tell them why"
        summary={
          <>
            <b>{users.find((u) => u.id === rejecting?.buyerId)?.firm ?? 'This buyer'}</b> will not be able to join{' '}
            <b className="num">{catalogues.find((c) => c.id === rejecting?.catalogueId)?.code ?? 'this auction'}</b>.
            They are told immediately, and told why — a refusal is never a dead end.
          </>
        }
        placeholder="e.g. The cut-off is published on the catalogue and passed 26 hours ago; the next sale of this material opens Friday."
        presets={['Cut-off passed too long ago', 'Wallet cannot cover the EMD', 'Account is on the watchlist', 'Reason not supported by evidence']}
        onConfirm={(reason) => {
          if (!rejecting) return
          reject(rejecting.id, reason)
          pushToast({ kind: 'info', title: 'Exemption rejected', body: 'The buyer has been told, with your reason.' })
          setRejecting(null)
        }}
      />

      {pending.length > 0 && (
        <p className="mt-4 text-xs text-ink-faint flex items-center gap-1.5">
          <Clock size={12} /> Every decision here is written to the audit trail at warning severity, with your reason and your name.
        </p>
      )}
    </Page>
  )
}
