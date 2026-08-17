/* Bid Now — full-page lot picker. Star the lots you want to bid on in this
   live, shortlisted auction, then continue into the shared bidding-room gate
   (pending EMD → terms → bidding room). Built for the last-seconds path: the
   clock and the "Enter bidding room" action stay on screen the whole time
   (header countdown + a sticky bottom bar), and each lot is one big tap
   target instead of a small star hitbox, since this page is often used with
   very little time to spare. */
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Gavel, Lock, Star, UserRound } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, Countdown, EmptyState, PageHeader, StatusChip, cx } from '../../components/ui'
import { EmdExemptionControl } from '../../components/EmdExemption'
import { useBidroomGate } from '../../components/BidroomGate'
import { useStore, catalogueUiStatus, latestEmdExemptionRequest, selectionSummary } from '../../store/store'
import { emdWindowClosed } from '../../lib/emd'
import { inr, num } from '../../lib/format'
import { useNow } from '../../lib/useTick'

export default function BidNowLots() {
  const { catalogueId } = useParams()
  const me = useStore((s) => s.currentUser)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const selections = useStore((s) => s.selections)
  const emdExemptionRequests = useStore((s) => s.emdExemptionRequests)
  const toggleShortlist = useStore((s) => s.toggleShortlist)
  const pushToast = useStore((s) => s.pushToast)
  const { enterBidroom } = useBidroomGate()
  const now = useNow()

  if (!me) {
    return (
      <Page>
        <EmptyState
          icon={<UserRound size={32} strokeWidth={1.5} />}
          title="Sign in to bid"
          body="Use the demo role switcher or the login screen."
          action={<Link to="/login"><Button>Sign in</Button></Link>}
        />
      </Page>
    )
  }

  const cat = catalogues.find((c) => c.id === catalogueId)
  if (!cat) {
    return (
      <Page>
        <EmptyState
          title="Auction not found"
          action={<Link to="/buyer/bid-now"><Button variant="secondary"><ArrowLeft size={15} /> Auctions</Button></Link>}
        />
      </Page>
    )
  }

  const catLots = lots.filter((l) => l.catalogueId === cat.id)
  const summary = selectionSummary({ selections, lots }, me.id, cat.id)
  const exemption = latestEmdExemptionRequest({ emdExemptionRequests }, me.id, cat.id)
  const deadlinePassed = emdWindowClosed(cat, now) && exemption?.status !== 'approved'
  // Every lot in the catalogue is covered by what's already been funded — the
  // deadline-passed warning and exemption request are for buyers who still
  // have something outstanding, not for a fully-paid shortlist. Same rule
  // ShortlistCatalogue.tsx uses for its "read only" badge.
  const totalRequired = catLots.reduce((sum, l) => sum + l.preBidEmd, 0)
  const readOnly = catLots.length > 0 && totalRequired - summary.funded <= 0

  const selectableLotIds = deadlinePassed ? [] : catLots.filter((l) => !summary.lotIds.includes(l.id) && !summary.fundedLotIds.includes(l.id)).map((l) => l.id)
  const starAll = () => {
    selectableLotIds.forEach((id) => toggleShortlist(cat.id, id))
    pushToast({ kind: 'info', title: `Starred ${selectableLotIds.length} lot${selectableLotIds.length === 1 ? '' : 's'}` })
  }

  return (
    <>
      <Page className={summary.count > 0 ? 'pb-28' : undefined}>
        <Link to="/buyer/bid-now" className="inline-block mb-3">
          <Button variant="secondary" size="sm"><ArrowLeft size={15} /> Auctions</Button>
        </Link>

        <PageHeader
          title={<span className="flex items-center gap-2 flex-wrap"><span className="num text-ember">{cat.code}</span> {cat.title}</span>}
          sub="Star the lots you want to bid on — pre-bid EMD is locked per lot, only starred lots enter the room with you."
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <StatusChip status={catalogueUiStatus(cat, now, catLots)} />
              {readOnly && <Chip tone="success"><Lock size={12} /> EMD funded</Chip>}
              <Countdown endsAt={cat.endsAt} prefix="ends" size="md" />
            </div>
          }
        />

        {!readOnly && deadlinePassed && (
          <div className="card border-danger/40 bg-danger-soft p-3 flex flex-wrap items-center gap-3 mb-4">
            <AlertTriangle size={18} className="text-danger shrink-0" />
            <p className="text-sm text-danger font-semibold flex-1 min-w-0">
              EMD deadline passed — this catalogue is frozen. Existing stars stay as-is; request an exemption to shortlist more.
            </p>
            <EmdExemptionControl catalogueId={cat.id} />
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-xs text-ink-faint">
            <b className="num font-semibold text-ink-muted">{summary.count}</b> of <b className="num font-semibold text-ink-muted">{catLots.length}</b> lots starred
          </span>
          {selectableLotIds.length > 0 && (
            <button onClick={starAll} className="text-[13px] font-semibold text-ember hover:underline">
              Star all {catLots.length} lots
            </button>
          )}
        </div>

        <div className="card bg-surface-2 border-0 divide-y divide-line overflow-hidden">
          {catLots.map((l, i) => {
            const shortlisted = summary.lotIds.includes(l.id)
            const funded = summary.fundedLotIds.includes(l.id)
            const locked = funded || deadlinePassed

            return (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  if (funded) {
                    pushToast({ kind: 'info', title: `${l.lotNo} stays shortlisted`, body: 'EMD is locked on this lot until the auction closes.' })
                    return
                  }
                  if (deadlinePassed) {
                    pushToast({ kind: 'warning', title: 'EMD deadline passed', body: 'Request an exemption to shortlist more lots in this catalogue.' })
                    return
                  }
                  toggleShortlist(cat.id, l.id)
                }}
                aria-pressed={shortlisted}
                title={deadlinePassed && !funded ? 'EMD deadline passed — this catalogue is frozen' : undefined}
                style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                className={cx('w-full flex items-center gap-3 px-3.5 py-3.5 text-left transition-colors animate-fade-up',
                  shortlisted && !funded && 'bg-ember-soft/25',
                  funded && 'bg-success-soft/15',
                  !locked && 'hover:bg-surface active:bg-surface-2/70',
                  locked ? 'cursor-default' : 'cursor-pointer')}
              >
                <span className={cx('shrink-0 grid place-items-center size-10 rounded-xl border transition-colors',
                  shortlisted ? 'bg-ember text-white border-ember' : 'border-line-strong text-ink-faint')}>
                  <Star size={17} fill={shortlisted ? 'currentColor' : 'none'} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="num text-sm font-bold">{l.lotNo}</span>
                    <Chip tone="neutral">{l.metal}</Chip>
                  </div>
                  <div className="text-xs font-semibold text-ink line-clamp-1 mt-0.5">{l.description}</div>
                  <div className="text-[11px] text-ink-faint mt-0.5 num">
                    {num(l.indicativeQty)} {l.uom} · start {inr(l.startRate)}/{l.uom} · EMD {inr(l.preBidEmd)}
                  </div>
                </div>
                <div className="shrink-0">
                  {funded
                    ? <Chip tone="success">EMD paid</Chip>
                    : shortlisted
                      ? <Chip tone="warning">EMD pending</Chip>
                      : <Chip tone="neutral">Not shortlisted</Chip>}
                </div>
              </button>
            )
          })}
        </div>

        {summary.count === 0 && (
          <p className="text-xs font-semibold text-ink-faint mt-3 text-center">Star at least one lot to enter the bidding room.</p>
        )}
      </Page>

      {/* Sticky action bar — always on screen once something's starred, so the
          bid-now path never needs a scroll to find the way in. */}
      {summary.count > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/95 backdrop-blur shadow-[0_-8px_30px_-16px_rgb(0_0_0/0.3)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="num text-sm">
              <b>{summary.count}</b> lot{summary.count === 1 ? '' : 's'} starred
              {summary.shortfall > 0 && <><span className="text-ink-faint"> · </span>EMD due <b className="text-warning">{inr(summary.shortfall)}</b></>}
            </div>
            <Countdown endsAt={cat.endsAt} prefix="ends" size="sm" />
            <Button size="lg" className="ml-auto" style={{ boxShadow: '0 10px 28px -10px color-mix(in srgb, var(--ember) 55%, transparent)' }}
              onClick={() => enterBidroom(cat.id, { fromBidNow: true })}>
              <Gavel size={17} /> Enter bidding room
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
