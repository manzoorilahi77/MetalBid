/* Shortlist — catalogue detail. Opened from /buyer/shortlist: shows the
   lots you've shortlisted in this catalogue (with EMD funded/pending
   status) alongside the full lot list so you can add more. */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Gavel, Star, Trash2, UserRound } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, Countdown, EmptyState, MockPayModal, PageHeader, PhotoThumb, StatusChip, cx,
} from '../../components/ui'
import { useStore, selectionSummary, catalogueUiStatus } from '../../store/store'
import { inr, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'

export default function ShortlistCatalogue() {
  const { catalogueId } = useParams()
  const me = useStore((s) => s.currentUser)
  const selections = useStore((s) => s.selections)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const fundEmd = useStore((s) => s.fundEmd)
  const toggleShortlist = useStore((s) => s.toggleShortlist)
  const pushToast = useStore((s) => s.pushToast)
  const now = useNow()
  const [payOpen, setPayOpen] = useState(false)

  if (!me) {
    return (
      <Page>
        <EmptyState
          icon={<UserRound size={32} strokeWidth={1.5} />}
          title="Sign in to manage your shortlist"
          body="Shortlisted lots and pre-bid EMD funding are tied to your account."
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
          title="Catalogue not found"
          action={<Link to="/buyer/shortlist"><Button variant="secondary">Back to shortlist</Button></Link>}
        />
      </Page>
    )
  }

  const catLots = lots.filter((l) => l.catalogueId === cat.id)
  const ui = catalogueUiStatus(cat, now, catLots)
  const summary = selectionSummary({ selections, lots }, me.id, cat.id)
  const shortlisted = catLots.filter((l) => summary.lotIds.includes(l.id))
  const canBid = ui === 'live' || ui === 'closing'

  return (
    <Page>
      <Link to="/buyer/shortlist" className="text-xs text-ink-faint hover:text-ink inline-flex items-center gap-1 mb-2">
        <ArrowLeft size={13} /> Back to shortlist
      </Link>

      <PageHeader
        title={cat.title}
        sub={cat.code}
        actions={
          <div className="flex items-center gap-2">
            <StatusChip status={ui} />
            {canBid && <Countdown endsAt={cat.endsAt} prefix="ends" size="sm" />}
            {ui === 'upcoming' && <Chip tone="steel" className="num">starts {relTime(cat.startsAt, now)}</Chip>}
          </div>
        }
      />

      {/* ---------------------------- summary strip ---------------------------- */}
      <div className="card flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5">
        <span className="text-sm">
          <span className="num font-bold">{summary.count}</span>
          <span className="text-ink-muted"> lot{summary.count === 1 ? '' : 's'} selected</span>
        </span>
        <span className="text-sm text-ink-muted">Pre-bid EMD <span className="num font-bold text-ink">{inr(summary.required)}</span></span>
        <span className="text-sm text-ink-muted">Funded <span className="num font-bold text-success">{inr(summary.funded)}</span></span>
        <span className="text-sm text-ink-muted">Shortfall <span className={cx('num font-bold', summary.shortfall > 0 ? 'text-warning' : 'text-ink')}>{inr(summary.shortfall)}</span></span>
        <span className="ml-auto">
          {summary.count === 0 ? null : summary.shortfall > 0 ? (
            <Button size="sm" onClick={() => setPayOpen(true)}>Fund EMD for selected lots</Button>
          ) : (
            <Chip tone="success">All selected lots funded</Chip>
          )}
        </span>
      </div>

      {/* -------------------------- shortlisted lots --------------------------- */}
      <h2 className="font-display font-bold text-lg mt-8 mb-3">Shortlisted lots</h2>
      {shortlisted.length === 0 ? (
        <EmptyState
          title="Nothing shortlisted in this catalogue yet"
          body="Star lots below to add them to your shortlist."
        />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {shortlisted.map((lot) => {
            const funded = summary.fundedLotIds.includes(lot.id)
            return (
              <div key={lot.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <PhotoThumb hue={lot.photos[0]?.hue ?? 24} category={lot.category} label={lot.photos[0]?.label} className="w-16 h-12" />
                <div className="min-w-0 flex-1 basis-56">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="num text-sm font-bold">{lot.lotNo}</span>
                    <Chip tone="neutral">{lot.metal}</Chip>
                    {lot.grade && <Chip tone="steel">{lot.grade}</Chip>}
                  </div>
                  <div className="text-sm text-ink-muted mt-0.5 line-clamp-1">{lot.description}</div>
                  <div className="text-xs text-ink-faint mt-0.5">
                    <span className="num font-semibold text-ink-muted">{num(lot.indicativeQty)} {lot.uom}</span>
                    {' '}· indicative — final on weighment
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-ink-faint">Start rate</div>
                  <div className="num text-sm font-semibold">
                    {inr(lot.startRate)}
                    <span className="text-ink-faint text-xs"> /{lot.uom}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-ink-faint">Lot EMD</div>
                  <div className="num text-sm font-semibold">{inr(lot.preBidEmd)}</div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  {funded
                    ? <Chip tone="success">EMD funded</Chip>
                    : <Chip tone="warning">EMD pending</Chip>}
                  {funded && canBid ? (
                    <Link to={`/bidding/${cat.id}?lot=${lot.id}`}>
                      <Button size="sm"><Gavel size={14} /> Bid</Button>
                    </Link>
                  ) : (
                    <span title={funded ? 'This catalogue is not open for bidding yet' : 'Fund the pre-bid EMD for this lot to unlock bidding'}>
                      <Button size="sm" disabled><Gavel size={14} /> Bid</Button>
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (funded) return
                      toggleShortlist(cat.id, lot.id)
                      pushToast({ kind: 'info', title: `${lot.lotNo} removed from shortlist` })
                    }}
                    disabled={funded}
                    title={funded ? 'EMD is locked — stays on shortlist until the lot closes' : 'Remove from shortlist'}
                    aria-label={`Remove ${lot.lotNo} from shortlist`}
                    className="p-2 rounded-lg text-ink-faint hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ------------------------------- all lots ------------------------------- */}
      <h2 className="font-display font-bold text-lg mt-8 mb-3">All lots in {cat.code}</h2>
      <div className="card divide-y divide-line overflow-hidden">
        {catLots.map((lot) => {
          const selected = summary.lotIds.includes(lot.id)
          const funded = summary.fundedLotIds.includes(lot.id)
          return (
            <div key={lot.id} className={cx('flex flex-wrap items-center gap-3 px-5 py-3.5', selected && 'bg-ember-soft/20')}>
              <button
                aria-label={selected ? 'Remove from shortlist' : 'Add to shortlist'}
                onClick={() => toggleShortlist(cat.id, lot.id)}
                disabled={funded}
                title={funded ? 'EMD is locked — stays on shortlist until the lot closes' : selected ? 'Remove from shortlist' : 'Add to shortlist'}
                className={cx('size-9 rounded-xl border grid place-items-center shrink-0 transition-colors',
                  selected ? 'bg-ember text-white border-ember' : 'border-line-strong text-ink-faint hover:text-ember hover:border-ember/50',
                  'disabled:opacity-60 disabled:pointer-events-none')}
              >
                <Star size={16} fill={selected ? 'currentColor' : 'none'} />
              </button>
              <PhotoThumb hue={lot.photos[0]?.hue ?? 24} category={lot.category} label={lot.photos[0]?.label} className="w-16 h-12" />
              <div className="min-w-0 flex-1 basis-56">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="num text-sm font-bold">{lot.lotNo}</span>
                  <Chip tone="neutral">{lot.metal}</Chip>
                  {lot.grade && <Chip tone="steel">{lot.grade}</Chip>}
                  <StatusChip status={lot.status} />
                </div>
                <div className="text-sm text-ink-muted mt-0.5 line-clamp-1">{lot.description}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-ink-faint">Start rate</div>
                <div className="num text-sm font-semibold">
                  {inr(lot.startRate)}
                  <span className="text-ink-faint text-xs"> /{lot.uom}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-ink-faint">Lot EMD</div>
                <div className="num text-sm font-semibold">{inr(lot.preBidEmd)}</div>
              </div>
              <div className="ml-auto">
                {selected
                  ? (funded ? <Chip tone="success">EMD funded</Chip> : <Chip tone="warning">EMD pending</Chip>)
                  : <Chip tone="neutral">Not shortlisted</Chip>}
              </div>
            </div>
          )
        })}
      </div>

      <MockPayModal
        open={payOpen && summary.shortfall > 0}
        onClose={() => setPayOpen(false)}
        title={`Fund pre-bid EMD — ${cat.code}`}
        amount={summary.shortfall}
        onSuccess={(method) => {
          const ok = fundEmd(cat.id, summary.unfundedLotIds, method)
          if (!ok) {
            pushToast({
              kind: 'danger',
              title: 'Insufficient wallet balance — top up first',
              body: `You need ${inr(summary.shortfall)} available. Add funds from Wallet & ledger.`,
            })
          } else {
            pushToast({
              kind: 'success',
              title: `EMD funded for ${summary.unfundedLotIds.length} lot${summary.unfundedLotIds.length > 1 ? 's' : ''}`,
              body: 'You can now bid on these lots in the bidding room.',
            })
          }
          setPayOpen(false)
        }}
      />
    </Page>
  )
}
