/* My Bids & Results — active positions, wins, losses/STA and full history. */
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Gavel, Printer, Trophy, UserRound } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, Countdown, EmptyState, PageHeader, PhotoThumb, Tabs, cx } from '../../components/ui'
import { useBidroomGate } from '../../components/BidroomGate'
import { myLotResult, useStore } from '../../store/store'
import { fmtDate, inr, inrCompact } from '../../lib/format'

type TabKey = 'active' | 'won' | 'all'

const TAB_KEYS: TabKey[] = ['active', 'won', 'all']
const isTabKey = (v: string | null): v is TabKey => !!v && (TAB_KEYS as string[]).includes(v)

const OUTCOME_CHIP: Record<'won' | 'lost' | 'sta' | 'unsold', { tone: 'success' | 'neutral' | 'warning'; label: string }> = {
  won: { tone: 'success', label: 'Won' },
  lost: { tone: 'neutral', label: 'Lost' },
  sta: { tone: 'warning', label: 'Subject to approval' },
  unsold: { tone: 'neutral', label: 'Unsold' },
}
// Sealed tender has no H1/leading-bidder concept — results read as offer accepted/not, not "won"/"lost".
const TENDER_OUTCOME_CHIP: typeof OUTCOME_CHIP = {
  won: { tone: 'success', label: 'Offer accepted' },
  lost: { tone: 'neutral', label: 'Offer not accepted' },
  sta: { tone: 'warning', label: 'Subject to approval' },
  unsold: { tone: 'neutral', label: 'Unsold' },
}

export default function Bids() {
  const me = useStore((s) => s.currentUser)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const bids = useStore((s) => s.bids)
  const { enterBidroom } = useBidroomGate()
  // Tab lives in the URL so other pages can deep-link into one — e.g. the buyer
  // dashboard's "outbid" and "active auctions" links still land on ?tab=active,
  // a view kept alive for those deep links even though it's no longer a visible tab.
  const [params, setParams] = useSearchParams()
  const urlTab = params.get('tab')
  const tab: TabKey = isTabKey(urlTab) ? urlTab : 'won'

  // Active / Results tabs: pick an auction first, then drill into its lots.
  const [openActiveCatId, setOpenActiveCatId] = useState<string | null>(null)
  const [openCatId, setOpenCatId] = useState<string | null>(null)
  // Switching top-level tabs should always land back on that tab's auction list,
  // not keep whatever auction was drilled into on the previous tab.
  const selectTab = (key: TabKey) => {
    setOpenCatId(null)
    setParams(key === 'won' ? {} : { tab: key }, { replace: true })
  }
  const [resultFilter, setResultFilter] = useState<'all' | 'won' | 'lost'>('all')

  if (!me) {
    return (
      <Page>
        <EmptyState
          icon={<UserRound size={32} strokeWidth={1.5} />}
          title="Sign in to see your bids"
          body="Your live positions, wins and bid history are tied to your account."
          action={<Link to="/login"><Button>Sign in</Button></Link>}
        />
      </Page>
    )
  }

  const lotById = new Map(lots.map((l) => [l.id, l]))
  const catById = new Map(catalogues.map((c) => [c.id, c]))

  const myBids = bids.filter((b) => b.bidderId === me.id)
  const myValidBids = myBids.filter((b) => b.status === 'valid')
  const bidLotIds = [...new Set(myValidBids.map((b) => b.lotId))]

  // Active: live lots I hold valid bids on
  const activeLots = bidLotIds
    .map((id) => lotById.get(id))
    .filter((l): l is NonNullable<typeof l> => !!l && l.status === 'live')
    .sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))

  // Grouped by auction — one card per catalogue with a live position, soonest-closing first.
  const activeCatalogues = [...new Set(activeLots.map((l) => l.catalogueId))]
    .map((catalogueId) => ({
      cat: catById.get(catalogueId)!,
      lots: activeLots.filter((l) => l.catalogueId === catalogueId),
    }))
    .filter((g) => !!g.cat)
    .sort((a, b) => Date.parse(a.lots[0].endsAt) - Date.parse(b.lots[0].endsAt))

  // Results: every closed catalogue where I placed ≥1 valid bid, grouped, with
  // my rank/outcome/best-bid/closing-H1 per lot (myLotResult reuses the same
  // ranking logic as the live bid ladder).
  const resultCatalogues = catalogues
    .filter((c) => c.status === 'closed')
    .map((cat) => {
      const rows = lots
        .filter((l) => l.catalogueId === cat.id && bidLotIds.includes(l.id))
        .map((lot) => ({ lot, result: myLotResult(bids, lot, me.id) }))
        .filter((r): r is { lot: typeof r.lot; result: NonNullable<typeof r.result> } => !!r.result)
      return { cat, rows }
    })
    .filter((g) => g.rows.length > 0)
    .sort((a, b) => Date.parse(b.cat.endsAt) - Date.parse(a.cat.endsAt))
  const resultsCount = resultCatalogues.reduce((sum, g) => sum + g.rows.length, 0)
  const wonCatalogues = resultCatalogues.filter((g) => g.rows.some((r) => r.result.outcome === 'won'))
  const wonCount = resultCatalogues.reduce((sum, g) => sum + g.rows.filter((r) => r.result.outcome === 'won').length, 0)

  return (
    <Page>
      <PageHeader
        title="Bid results"
        sub="Confirmed wins and your outcome/rank on every closed lot — grouped by auction."
      />

      <Tabs<TabKey>
        tabs={[
          { key: 'won', label: 'Won', count: wonCount },
          { key: 'all', label: 'All history', count: resultsCount },
        ]}
        value={tab === 'active' ? 'won' : tab}
        onChange={selectTab}
        className="mb-5"
      />

      {/* ------------------------------- Active ------------------------------- */}
      {tab === 'active' && (
        activeLots.length === 0 ? (
          <EmptyState
            icon={<Gavel size={32} strokeWidth={1.5} />}
            title="No active bids"
            body="Fund EMD on shortlisted lots and place a bid — your live positions will track here."
            action={<Link to="/buyer/shortlist"><Button variant="secondary">Go to shortlist</Button></Link>}
          />
        ) : (() => {
          const openActiveGroup = activeCatalogues.find((g) => g.cat.id === openActiveCatId)

          // -------- Auction list: one card per catalogue with a live position --------
          if (!openActiveGroup) {
            return (
              <div className="space-y-3">
                {activeCatalogues.map(({ cat, lots: catLots }) => {
                  const leadingCount = catLots.filter((l) => l.leadingBidderId === me.id).length
                  const soonest = catLots[0]
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setOpenActiveCatId(cat.id)}
                      className="card p-4 w-full flex flex-wrap items-center gap-3 text-left hover:border-ink/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1 basis-52">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="num text-sm font-bold text-ember">{cat.code}</span>
                          {cat.type === 'tender' && <Chip tone="steel">Tender</Chip>}
                        </div>
                        <div className="text-sm text-ink-muted mt-0.5 line-clamp-1">{cat.title}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] uppercase tracking-wider text-ink-faint">Leading</div>
                        <div className="num text-sm font-bold text-success">{leadingCount} <span className="text-ink-faint font-normal">/ {catLots.length}</span></div>
                      </div>
                      <Countdown endsAt={soonest.endsAt} size="sm" />
                      <ArrowRight size={16} className="text-ink-faint shrink-0" />
                    </button>
                  )
                })}
              </div>
            )
          }

          // -------- Auction detail: live lots for the selected auction --------
          const { cat, lots: catLots } = openActiveGroup
          const isTender = cat.type === 'tender'
          return (
            <div>
              <button onClick={() => setOpenActiveCatId(null)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink mb-4">
                <ArrowLeft size={16} /> All auctions
              </button>
              <div className="flex items-center justify-between gap-2 mb-4 px-1">
                <div>
                  <span className="num text-base font-bold text-ember">{cat.code}</span>
                  <span className="text-sm text-ink-muted ml-2">{cat.title}</span>
                </div>
              </div>
              <div className="space-y-3">
                {catLots.map((lot) => {
                  const leading = lot.leadingBidderId === me.id
                  return (
                    <div key={lot.id} className="card p-4 flex flex-wrap items-center gap-3">
                      <PhotoThumb hue={lot.photos[0]?.hue ?? 24} category={lot.category} className="w-16 h-12" />
                      <div className="min-w-0 flex-1 basis-52">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="num text-sm font-bold">{lot.lotNo}</span>
                          {isTender
                            ? <Chip tone="steel">Offer submitted</Chip>
                            : leading ? <Chip tone="success">Leading H1</Chip> : <Chip tone="danger" pulse>Outbid</Chip>}
                        </div>
                        <div className="text-sm font-semibold text-ink mt-0.5 line-clamp-1">{lot.description}</div>
                      </div>
                      <Countdown endsAt={lot.endsAt} size="sm" />
                      <Button size="sm" variant={isTender ? 'secondary' : leading ? 'secondary' : 'primary'}
                        onClick={() => enterBidroom(lot.catalogueId, { lotId: lot.id })}>
                        Go to bidding room <ArrowRight size={14} />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()
      )}

      {/* ------------------------- Won / All history ------------------------- */}
      {(tab === 'won' || tab === 'all') && (() => {
        const groups = tab === 'won' ? wonCatalogues : resultCatalogues

        if (groups.length === 0) {
          return tab === 'won' ? (
            <EmptyState
              icon={<Trophy size={32} strokeWidth={1.5} />}
              title="No wins yet"
              body="When you finish as confirmed H1 on a lot, it lands here — grouped by auction, with a link to auction status."
            />
          ) : (
            <EmptyState
              title="No history yet"
              body="Once a catalogue you bid in closes, your outcome, rank and closing H1 on every lot appear here — win or lose."
            />
          )
        }

        const openGroup = groups.find((g) => g.cat.id === openCatId)

        // -------- Auction list: one card per matching closed catalogue --------
        if (!openGroup) {
          return (
            <div className="space-y-3">
              {groups.map(({ cat, rows }) => {
                const catWonCount = rows.filter((r) => r.result.outcome === 'won').length
                const wonValue = rows
                  .filter((r) => r.result.outcome === 'won')
                  .reduce((sum, r) => sum + r.result.myBestRate * r.lot.indicativeQty, 0)
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setOpenCatId(cat.id); setResultFilter(tab === 'won' ? 'won' : 'all') }}
                    className="card p-4 w-full flex flex-wrap items-center gap-3 text-left hover:border-ink/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1 basis-52">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="num text-sm font-bold text-ember">{cat.code}</span>
                        {cat.type === 'tender' && <Chip tone="steel">Tender</Chip>}
                      </div>
                      <div className="text-sm text-ink-muted mt-0.5 line-clamp-1">{cat.title}</div>
                      <div className="text-xs text-ink-faint mt-0.5">Closed {fmtDate(cat.endsAt)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-wider text-ink-faint">Won</div>
                      <div className="num text-sm font-bold text-success">{catWonCount} <span className="text-ink-faint font-normal">/ {rows.length}</span></div>
                    </div>
                    {catWonCount > 0 && (
                      <div className="text-right">
                        <div className="text-[11px] uppercase tracking-wider text-ink-faint">Won value</div>
                        <div className="num text-sm font-bold">{inrCompact(wonValue)}</div>
                      </div>
                    )}
                    <ArrowRight size={16} className="text-ink-faint shrink-0" />
                  </button>
                )
              })}
            </div>
          )
        }

        // -------- Auction detail: won | lost lots for the selected auction --------
        const { cat, rows } = openGroup
        const isTender = cat.type === 'tender'
        const wonRows = rows.filter((r) => r.result.outcome === 'won')
        const lostRows = rows.filter((r) => r.result.outcome !== 'won')
        const shownRows = resultFilter === 'won' ? wonRows : resultFilter === 'lost' ? lostRows : rows

        return (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
                <button onClick={() => setOpenCatId(null)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink">
                  <ArrowLeft size={16} /> All auctions
                </button>
                <Button size="sm" variant="secondary" onClick={() => window.print()}>
                  <Printer size={14} /> Print
                </Button>
              </div>

              <div id="print-area">
                <div className="flex items-center justify-between gap-2 mb-1 px-1 print:px-0">
                  <div>
                    <span className="num text-base font-bold text-ember">{cat.code}</span>
                    <span className="text-sm text-ink-muted ml-2">{cat.title}</span>
                  </div>
                  <span className="text-xs text-ink-faint">Closed {fmtDate(cat.endsAt)}</span>
                </div>
                <div className="text-xs font-semibold text-ink-muted mb-3 px-1 print:px-0">
                  You won {wonRows.length} of {rows.length} lot{rows.length > 1 ? 's' : ''} you bid on
                </div>

                <Tabs<'all' | 'won' | 'lost'>
                  tabs={[
                    { key: 'all', label: 'All', count: rows.length },
                    { key: 'won', label: 'Won', count: wonRows.length },
                    { key: 'lost', label: 'Lost', count: lostRows.length },
                  ]}
                  value={resultFilter}
                  onChange={setResultFilter}
                  className="mb-4 print:hidden"
                />

                <div className="space-y-3">
                  {shownRows.map(({ lot, result }) => {
                    const chip = (isTender ? TENDER_OUTCOME_CHIP : OUTCOME_CHIP)[result.outcome]
                    return (
                      <div key={lot.id} className="card p-4 flex flex-wrap items-center gap-3 print:border print:border-line">
                        <PhotoThumb hue={lot.photos[0]?.hue ?? 24} category={lot.category} className="w-16 h-12 print:hidden" />
                        {/* Sealed tender never surfaces a rank — there's no ladder to have ranked on. */}
                        {!isTender && (
                          <span className={cx('rounded-lg grid place-items-center font-bold shrink-0 size-7 text-[10px]',
                            result.rank === 1 ? 'bg-ember text-white' : 'bg-surface-2 text-ink-faint')}>
                            H{result.rank}
                          </span>
                        )}
                        <div className="min-w-0 flex-1 basis-52">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="num text-sm font-bold">{lot.lotNo}</span>
                            <Chip tone={chip.tone}>{chip.label}</Chip>
                          </div>
                          <div className="text-sm font-semibold text-ink mt-0.5 line-clamp-1">{lot.description}</div>
                          {result.outcome === 'sta' && (
                            <div className="text-xs text-ink-faint mt-0.5">
                              Your {isTender ? 'offer' : 'H1'} was below reserve — the seller has {cat.bidValidityDays} days to accept or decline.
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] uppercase tracking-wider text-ink-faint">{isTender ? 'Your offer' : 'Your bid'}</div>
                          <div className="num text-sm font-semibold">{inr(result.myBestRate)}<span className="text-xs text-ink-faint">/{lot.uom}</span></div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] uppercase tracking-wider text-ink-faint">{isTender ? 'Closing rate' : 'Closing H1'}</div>
                          <div className="num text-sm font-semibold">
                            {result.closingH1 != null ? inr(result.closingH1) : '—'}
                            <span className="text-xs text-ink-faint">/{lot.uom}</span>
                          </div>
                        </div>
                        {result.outcome === 'won' ? (
                          <Link to={`/buyer/auction-status?auction=${cat.id}`} className="print:hidden">
                            <Button size="sm" variant="success">Track auction status <ArrowRight size={14} /></Button>
                          </Link>
                        ) : (
                          <Link to={`/catalogue/${lot.catalogueId}`} className="print:hidden">
                            <Button size="sm" variant="ghost">View lot</Button>
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })()
      }
    </Page>
  )
}
