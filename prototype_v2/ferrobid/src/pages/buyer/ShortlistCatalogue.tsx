/* Shortlist — catalogue detail. Opened from /buyer/shortlist: shows the
   lots you've shortlisted in this catalogue (with EMD funded/pending
   status) alongside the full lot list so you can add more. */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, Lock, Star, Trash2, UserRound } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, Countdown, EmptyState, Modal, MockOtpModal, MockPayModal, PageHeader, PhotoThumb, StatusChip, Tabs, cx,
} from '../../components/ui'
import { useStore, selectionSummary, catalogueUiStatus } from '../../store/store'
import { emdBlockedMessage, emdWindowClosed } from '../../lib/emd'
import { inr, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'

type LotsTab = 'shortlisted' | 'all'

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
  const [tab, setTab] = useState<LotsTab>('all')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [otpOpen, setOtpOpen] = useState(false)
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
  // Missed the pre-bid EMD cut-off while the catalogue is still upcoming — the
  // whole catalogue freezes here: no more shortlisting, unshortlisting, or
  // funding until it either goes live (funding reopens per lot) or closes out.
  const deadlinePassed = emdWindowClosed(cat, now)

  // Full-catalogue funded state (every lot, not just what's shortlisted) — used
  // only for the "read only" badge below.
  const allRequired = catLots.reduce((sum, l) => sum + l.preBidEmd, 0)
  const allShortfall = allRequired - summary.funded
  const readOnly = catLots.length > 0 && allShortfall <= 0

  // The strip and the pay button always reflect the buyer's current shortlist —
  // specifically whatever's still pending EMD — regardless of which tab is
  // open. Paying never reaches outside the shortlist; "Select all N lots"
  // brings the whole catalogue in first if that's what's wanted.
  const hasSelection = summary.count > 0
  const scopeCount = summary.unfundedLotIds.length
  const scopeRequired = summary.shortfall
  const scopeShortfall = summary.shortfall

  // Bulk select/clear on the All lots tab — funded lots are excluded from both,
  // same as the individual star (they're locked until the lot closes). Once the
  // catalogue is truly read-only, or the EMD deadline has passed, this naturally
  // comes out empty anyway.
  const selectableLotIds = deadlinePassed ? [] : catLots.filter((l) => !summary.lotIds.includes(l.id) && !summary.fundedLotIds.includes(l.id)).map((l) => l.id)
  const clearableLotIds = deadlinePassed ? [] : catLots.filter((l) => summary.lotIds.includes(l.id) && !summary.fundedLotIds.includes(l.id)).map((l) => l.id)
  const selectAllLots = () => {
    selectableLotIds.forEach((id) => toggleShortlist(cat.id, id))
    pushToast({ kind: 'info', title: `Added ${selectableLotIds.length} lot${selectableLotIds.length === 1 ? '' : 's'} to shortlist` })
  }
  const clearAllLots = () => {
    clearableLotIds.forEach((id) => toggleShortlist(cat.id, id))
    pushToast({ kind: 'info', title: 'Cleared shortlist selection' })
  }

  return (
    <Page>
      <Link to="/buyer/shortlist" className="inline-block mb-3">
        <Button variant="secondary" size="sm"><ArrowLeft size={15} /> Back to EMD & payments</Button>
      </Link>

      <PageHeader
        title={cat.title}
        sub={cat.code}
        actions={
          <div className="flex items-center gap-2">
            <StatusChip status={ui} />
            {readOnly && <Chip tone="success"><Lock size={12} /> EMD funded — read only</Chip>}
            {!readOnly && deadlinePassed && <Chip tone="danger"><AlertTriangle size={12} /> EMD deadline passed</Chip>}
            {canBid && <Countdown endsAt={cat.endsAt} prefix="ends" size="sm" />}
            {ui === 'upcoming' && <Chip tone="steel" className="num">starts {relTime(cat.startsAt, now)}</Chip>}
          </div>
        }
      />

      {/* ---------------------------- summary strip ---------------------------- */}
      <div className="card flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5">
        <span className="text-sm">
          <span className="num font-bold">{scopeCount}</span>
          <span className="text-ink-muted"> lot{scopeCount === 1 ? '' : 's'} pending EMD</span>
        </span>
        <span className="text-sm text-ink-muted">Pre-bid EMD <span className="num font-bold text-ink">{inr(scopeRequired)}</span></span>
        <span className="text-sm text-ink-muted">Funded <span className="num font-bold text-success">{inr(summary.funded)}</span></span>
        <span className="text-sm text-ink-muted">Shortfall <span className={cx('num font-bold', scopeShortfall > 0 ? 'text-warning' : 'text-ink')}>{inr(scopeShortfall)}</span></span>
        <span className="ml-auto">
          {!hasSelection ? null : scopeShortfall > 0 ? (
            deadlinePassed ? (
              <Chip tone="danger"><Lock size={12} /> EMD deadline passed</Chip>
            ) : (
              <Button size="sm" onClick={() => setConfirmOpen(true)}>
                Pay EMD for shortlisted lots {inr(scopeShortfall)}
              </Button>
            )
          ) : (
            <Chip tone="success">All selected lots funded</Chip>
          )}
        </span>
      </div>
      {deadlinePassed && scopeShortfall > 0 && (
        <p className="text-xs text-danger font-semibold mt-2">{emdBlockedMessage(cat)}</p>
      )}

      {/* ------------------------------ lots tabs -------------------------------- */}
      <Tabs<LotsTab> className="mt-8" value={tab} onChange={setTab} tabs={[
        { key: 'all', label: 'All lots', count: catLots.length },
        { key: 'shortlisted', label: 'Shortlisted lots', count: shortlisted.length },
      ]} />

      {tab === 'shortlisted' ? (
        shortlisted.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title="Nothing shortlisted in this catalogue yet"
              body="Switch to the All lots tab and star lots to add them to your shortlist."
            />
          </div>
        ) : (
        <div className="card divide-y divide-line overflow-hidden mt-5">
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
                  <div className="text-xs text-ink-faint mt-0.5">indicative — final on weighment</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-ink-faint">Indicative qty</div>
                  <div className="num text-sm font-semibold">{num(lot.indicativeQty)} {lot.uom}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-ink-faint">Start rate</div>
                  <div className="num text-sm font-semibold">
                    {inr(lot.startRate)}
                    <span className="text-ink-faint text-xs"> /{lot.uom}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-ink-faint">Pre-bid EMD</div>
                  <div className="num text-sm font-semibold">{inr(lot.preBidEmd)}</div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  {funded
                    ? <Chip tone="success">EMD funded</Chip>
                    : <Chip tone="warning">EMD pending</Chip>}
                  <button
                    onClick={() => {
                      if (funded || deadlinePassed) return
                      toggleShortlist(cat.id, lot.id)
                      pushToast({ kind: 'info', title: `${lot.lotNo} removed from shortlist` })
                    }}
                    disabled={funded || deadlinePassed}
                    title={
                      funded ? 'EMD is locked — stays on shortlist until the lot closes'
                        : deadlinePassed ? 'EMD deadline passed — this catalogue is frozen'
                        : 'Remove from shortlist'
                    }
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
        )
      ) : (
      <>
      <div className="flex items-center justify-between gap-3 mt-5 mb-2">
        <span className="text-xs text-ink-faint">
          <span className="num font-semibold text-ink-muted">{shortlisted.length}</span> of <span className="num font-semibold text-ink-muted">{catLots.length}</span> lots selected
        </span>
        <div className="flex items-center gap-3">
          {selectableLotIds.length > 0 && (
            <button onClick={selectAllLots} className="text-[13px] font-semibold text-ember hover:underline">
              Select all {catLots.length} lots
            </button>
          )}
          {clearableLotIds.length > 0 && (
            <button onClick={clearAllLots} className="text-[13px] font-semibold text-ink-faint hover:underline">
              Clear selection
            </button>
          )}
        </div>
      </div>
      <div className="card divide-y divide-line overflow-hidden">
        {catLots.map((lot) => {
          const selected = summary.lotIds.includes(lot.id)
          const funded = summary.fundedLotIds.includes(lot.id)
          return (
            <div key={lot.id} className={cx('flex flex-wrap items-center gap-3 px-5 py-3.5', selected && 'bg-ember-soft/20')}>
              <button
                aria-label={selected ? 'Remove from shortlist' : 'Add to shortlist'}
                onClick={() => toggleShortlist(cat.id, lot.id)}
                disabled={funded || deadlinePassed}
                title={
                  funded ? 'EMD is locked — stays on shortlist until the lot closes'
                    : deadlinePassed ? 'EMD deadline passed — this catalogue is frozen'
                    : selected ? 'Remove from shortlist' : 'Add to shortlist'
                }
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
                <div className="text-[11px] uppercase tracking-wider text-ink-faint">Indicative qty</div>
                <div className="num text-sm font-semibold">{num(lot.indicativeQty)} {lot.uom}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-ink-faint">Start rate</div>
                <div className="num text-sm font-semibold">
                  {inr(lot.startRate)}
                  <span className="text-ink-faint text-xs"> /{lot.uom}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-ink-faint">Pre-bid EMD</div>
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
      {shortlisted.length > 0 && (
        <div className="flex justify-center mt-5">
          <Button variant="secondary" onClick={() => setTab('shortlisted')}>
            Go to shortlisted lots ({shortlisted.length}) <ArrowRight size={15} />
          </Button>
        </div>
      )}
      </>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm EMD for shortlisted lots">
        <p className="text-sm text-ink-muted">
          You're confirming <b className="num text-ink">{scopeCount}</b> lot{scopeCount === 1 ? '' : 's'} shortlisted in{' '}
          <b className="text-ink">{cat.code}</b>. Total pre-bid EMD for these lots is{' '}
          <b className="num text-ink">{inr(scopeRequired)}</b>.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={() => { setConfirmOpen(false); setOtpOpen(true) }}>Confirm</Button>
        </div>
      </Modal>

      <MockOtpModal
        open={otpOpen}
        onClose={() => setOtpOpen(false)}
        onVerified={() => setPayOpen(true)}
        phone={me.phone}
      />

      <MockPayModal
        open={payOpen && scopeShortfall > 0}
        onClose={() => setPayOpen(false)}
        title={`Fund pre-bid EMD — ${cat.code}`}
        amount={scopeShortfall}
        onSuccess={(method) => {
          const ok = fundEmd(cat.id, summary.unfundedLotIds, method)
          if (!ok) {
            pushToast({
              kind: 'danger',
              title: 'Insufficient wallet balance — top up first',
              body: `You need ${inr(scopeShortfall)} available. Add funds from Wallet & ledger.`,
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
