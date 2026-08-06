/* My Shortlist & EMD — the §9 showcase: per-catalogue selections with
   scoped pre-bid EMD funding. Fund the shortfall, then bid. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Gavel, Trash2, UserRound, Wallet } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, Countdown, EmptyState, MockPayModal, PageHeader, PhotoThumb, Segmented, StatusChip,
} from '../../components/ui'
import { useStore, selectionSummary, catalogueUiStatus } from '../../store/store'
import { inr, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'

export default function Shortlist() {
  const me = useStore((s) => s.currentUser)
  const selections = useStore((s) => s.selections)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const wallets = useStore((s) => s.wallets)
  const fundEmd = useStore((s) => s.fundEmd)
  const toggleShortlist = useStore((s) => s.toggleShortlist)
  const pushToast = useStore((s) => s.pushToast)
  const now = useNow()
  const [payCatId, setPayCatId] = useState<string | null>(null)
  const [view, setView] = useState<'live' | 'upcoming'>('live')

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

  const mySelections = selections.filter((x) => x.buyerId === me.id && x.lotIds.length > 0)
  const wallet = wallets.find((w) => w.userId === me.id)

  /* Live = EMD-funded, i.e. biddable now · Upcoming = EMD still pending. */
  const inView = (sel: { lotIds: string[]; emdFundedLotIds: string[] }, v: 'live' | 'upcoming') =>
    sel.lotIds.filter((id) => sel.emdFundedLotIds.includes(id) === (v === 'live'))
  const viewCount = (v: 'live' | 'upcoming') => mySelections.reduce((n, s) => n + inView(s, v).length, 0)
  const shownCount = viewCount(view)

  const payCat = catalogues.find((c) => c.id === payCatId)
  const paySummary = payCatId ? selectionSummary({ selections, lots }, me.id, payCatId) : null

  return (
    <Page>
      <PageHeader
        title="My shortlist & EMD"
        sub="Pre-bid EMD is locked per lot from your wallet. Only EMD-funded lots are biddable — unfunded ones stay locked out of the bidding room."
        actions={
          <div className="card px-4 py-2 flex items-center gap-2 text-sm">
            <Wallet size={15} className="text-ink-muted" />
            <span className="text-ink-muted">Wallet</span>
            <span className="num font-bold">{inr(wallet?.balance ?? 0)}</span>
          </div>
        }
      />

      {mySelections.length === 0 ? (
        <EmptyState
          title="Nothing shortlisted yet"
          body="Browse live catalogues and tap the star on lots you're interested in — they'll collect here so you can fund EMD in one go."
          action={<Link to="/browse"><Button>Browse auctions</Button></Link>}
        />
      ) : (
        <div className="space-y-8">
          <Segmented
            options={[
              { key: 'live', label: <>Live <span className="num opacity-70">{viewCount('live')}</span></> },
              { key: 'upcoming', label: <>Upcoming <span className="num opacity-70">{viewCount('upcoming')}</span></> },
            ]}
            value={view}
            onChange={setView}
          />

          {shownCount === 0 && (
            <EmptyState
              title={view === 'live' ? 'No EMD-funded lots yet' : 'Nothing waiting on EMD'}
              body={view === 'live'
                ? 'Lots appear here once their pre-bid EMD is funded — switch to Upcoming to fund the ones still pending.'
                : 'Every shortlisted lot has its pre-bid EMD funded. Switch to Live to bid on them.'}
              action={<Button variant="secondary" onClick={() => setView(view === 'live' ? 'upcoming' : 'live')}>
                Show {view === 'live' ? 'upcoming' : 'live'} lots
              </Button>}
            />
          )}

          {mySelections.map((sel) => {
            const cat = catalogues.find((c) => c.id === sel.catalogueId)
            if (!cat) return null
            const ui = catalogueUiStatus(cat, now, lots.filter((l) => l.catalogueId === cat.id))
            const summary = selectionSummary({ selections, lots }, me.id, cat.id)
            const visibleIds = inView(sel, view)
            if (visibleIds.length === 0) return null
            const selLots = lots.filter((l) => visibleIds.includes(l.id))
            return (
              <section key={cat.id} className="card overflow-hidden">
                {/* --------------------- catalogue header --------------------- */}
                <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3">
                  <div className="min-w-0 flex-1">
                    <div className="num text-[11px] font-semibold text-ink-faint">{cat.code}</div>
                    <Link to={`/catalogue/${cat.id}`} className="font-display font-bold text-lg leading-snug hover:text-ember transition-colors">
                      {cat.title}
                    </Link>
                  </div>
                  <StatusChip status={ui} />
                  {(ui === 'live' || ui === 'closing') && <Countdown endsAt={cat.endsAt} prefix="ends" size="sm" />}
                  {ui === 'upcoming' && <Chip tone="steel" className="num">starts {relTime(cat.startsAt, now)}</Chip>}
                </div>

                {/* ---------------------- summary strip ----------------------- */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 bg-surface-2 border-y border-line">
                  <span className="text-sm">
                    <span className="num font-bold">{summary.count}</span>
                    <span className="text-ink-muted"> lot{summary.count > 1 ? 's' : ''} selected</span>
                  </span>
                  <span className="text-sm text-ink-muted">Pre-bid EMD <span className="num font-bold text-ink">{inr(summary.required)}</span></span>
                  <span className="text-sm text-ink-muted">Funded <span className="num font-bold text-success">{inr(summary.funded)}</span></span>
                  <span className="text-sm text-ink-muted">Shortfall <span className={`num font-bold ${summary.shortfall > 0 ? 'text-warning' : 'text-ink'}`}>{inr(summary.shortfall)}</span></span>
                  <span className="ml-auto">
                    {summary.shortfall > 0 ? (
                      <Button size="sm" onClick={() => setPayCatId(cat.id)}>
                        Fund EMD for selected lots
                      </Button>
                    ) : (
                      <Chip tone="success">All selected lots funded</Chip>
                    )}
                  </span>
                </div>

                {/* ------------------------- lot rows ------------------------- */}
                <div className="divide-y divide-line">
                  {selLots.map((lot) => {
                    const funded = sel.emdFundedLotIds.includes(lot.id)
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
                          {funded ? (
                            <Link to={`/bidding/${cat.id}?lot=${lot.id}`}>
                              <Button size="sm"><Gavel size={14} /> Bid</Button>
                            </Link>
                          ) : (
                            <span title="Fund the pre-bid EMD for this lot to unlock bidding">
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
              </section>
            )
          })}
        </div>
      )}

      <MockPayModal
        open={!!payCatId && !!paySummary && paySummary.shortfall > 0}
        onClose={() => setPayCatId(null)}
        title={`Fund pre-bid EMD — ${payCat?.code ?? ''}`}
        amount={paySummary?.shortfall ?? 0}
        onSuccess={(method) => {
          if (!payCatId || !paySummary) return
          const ok = fundEmd(payCatId, paySummary.unfundedLotIds, method)
          if (!ok) {
            pushToast({
              kind: 'danger',
              title: 'Insufficient wallet balance — top up first',
              body: `You need ${inr(paySummary.shortfall)} available. Add funds from Wallet & ledger.`,
            })
          } else {
            pushToast({
              kind: 'success',
              title: `EMD funded for ${paySummary.unfundedLotIds.length} lot${paySummary.unfundedLotIds.length > 1 ? 's' : ''}`,
              body: 'You can now bid on these lots in the bidding room.',
            })
          }
          setPayCatId(null)
        }}
      />
    </Page>
  )
}
