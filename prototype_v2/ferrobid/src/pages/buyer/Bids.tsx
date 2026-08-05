/* My Bids & Results — active positions, wins, losses/STA and full history. */
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Gavel, Trophy, UserRound } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, Countdown, EmptyState, PageHeader, PhotoThumb, Tabs, cx } from '../../components/ui'
import { myLotResult, useStore } from '../../store/store'
import { fmtDateTime, inr, inrCompact, num } from '../../lib/format'

type TabKey = 'active' | 'won' | 'results' | 'all'

const TAB_KEYS: TabKey[] = ['active', 'won', 'results', 'all']
const isTabKey = (v: string | null): v is TabKey => !!v && (TAB_KEYS as string[]).includes(v)

const OUTCOME_CHIP: Record<'won' | 'lost' | 'sta' | 'unsold', { tone: 'success' | 'neutral' | 'warning'; label: string }> = {
  won: { tone: 'success', label: 'Won' },
  lost: { tone: 'neutral', label: 'Lost' },
  sta: { tone: 'warning', label: 'Subject to approval' },
  unsold: { tone: 'neutral', label: 'Unsold' },
}

export default function Bids() {
  const me = useStore((s) => s.currentUser)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const bids = useStore((s) => s.bids)
  // Tab lives in the URL so other pages can deep-link into one — e.g. the buyer
  // dashboard's "Active Auctions" tile. Active is the default, so it stays bare.
  const [params, setParams] = useSearchParams()
  const urlTab = params.get('tab')
  const tab: TabKey = isTabKey(urlTab) ? urlTab : 'active'
  const selectTab = (key: TabKey) => setParams(key === 'active' ? {} : { tab: key }, { replace: true })

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

  const myBestOn = (lotId: string) =>
    Math.max(...myValidBids.filter((b) => b.lotId === lotId).map((b) => b.rate), 0)

  // Active: live lots I hold valid bids on
  const activeLots = bidLotIds
    .map((id) => lotById.get(id))
    .filter((l): l is NonNullable<typeof l> => !!l && l.status === 'live')
    .sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))

  // Won: sold + I'm H1 (all time)
  const wonLots = lots.filter((l) => l.status === 'sold' && l.leadingBidderId === me.id)

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

  const allMine = [...myBids].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

  return (
    <Page>
      <PageHeader
        title="My bids & results"
        sub="Every rate you've quoted — live positions first, then confirmed wins and your outcome/rank on every closed lot."
      />

      <Tabs<TabKey>
        tabs={[
          { key: 'active', label: 'Active', count: activeLots.length },
          { key: 'won', label: 'Won', count: wonLots.length },
          { key: 'results', label: 'Results', count: resultsCount },
          { key: 'all', label: 'All history', count: allMine.length },
        ]}
        value={tab}
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
        ) : (
          <div className="space-y-3">
            {activeLots.map((lot) => {
              const cat = catById.get(lot.catalogueId)
              const mine = myBestOn(lot.id)
              const leading = lot.leadingBidderId === me.id
              return (
                <div key={lot.id} className="card p-4 flex flex-wrap items-center gap-3">
                  <PhotoThumb hue={lot.photos[0]?.hue ?? 24} category={lot.category} className="w-16 h-12" />
                  <div className="min-w-0 flex-1 basis-52">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="num text-sm font-bold">{lot.lotNo}</span>
                      <span className="num text-xs text-ink-faint">{cat?.code}</span>
                      {leading
                        ? <Chip tone="success">Leading H1</Chip>
                        : <Chip tone="danger" pulse>Outbid</Chip>}
                    </div>
                    <div className="text-sm text-ink-muted mt-0.5 line-clamp-1">{lot.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wider text-ink-faint">My best</div>
                    <div className="num text-sm font-semibold">{inr(mine)}<span className="text-xs text-ink-faint">/{lot.uom}</span></div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wider text-ink-faint">Current H1</div>
                    <div className={`num text-sm font-bold ${leading ? 'text-success' : 'text-danger'}`}>
                      {inr(lot.currentRate ?? lot.startRate)}<span className="text-xs text-ink-faint">/{lot.uom}</span>
                    </div>
                  </div>
                  <Countdown endsAt={lot.endsAt} size="sm" />
                  <Link to={`/bidding/${lot.catalogueId}?lot=${lot.id}`}>
                    <Button size="sm" variant={leading ? 'secondary' : 'primary'}>
                      Go to bidding room <ArrowRight size={14} />
                    </Button>
                  </Link>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* -------------------------------- Won --------------------------------- */}
      {tab === 'won' && (
        wonLots.length === 0 ? (
          <EmptyState
            icon={<Trophy size={32} strokeWidth={1.5} />}
            title="No wins yet"
            body="When you finish as confirmed H1 on a lot, it lands here with a link to fulfilment."
          />
        ) : (
          <div className="space-y-3">
            {wonLots.map((lot) => {
              const cat = catById.get(lot.catalogueId)
              const rate = lot.resultH1Rate ?? lot.currentRate ?? 0
              return (
                <div key={lot.id} className="card p-4 flex flex-wrap items-center gap-3 border-l-4 border-l-success">
                  <PhotoThumb hue={lot.photos[0]?.hue ?? 24} category={lot.category} className="w-16 h-12" />
                  <div className="min-w-0 flex-1 basis-52">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="num text-sm font-bold">{lot.lotNo}</span>
                      <span className="num text-xs text-ink-faint">{cat?.code}</span>
                      <Chip tone="success">Won · H1</Chip>
                    </div>
                    <div className="text-sm text-ink-muted mt-0.5 line-clamp-1">{lot.description}</div>
                    <div className="text-xs text-ink-faint mt-0.5">
                      <span className="num">{num(lot.indicativeQty)} {lot.uom}</span> · indicative — final on weighment
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wider text-ink-faint">H1 rate</div>
                    <div className="num text-sm font-bold text-success">{inr(rate)}<span className="text-xs text-ink-faint">/{lot.uom}</span></div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wider text-ink-faint">Est. value</div>
                    <div className="num text-sm font-bold">{inrCompact(rate * lot.indicativeQty)}</div>
                  </div>
                  <Link to="/buyer/fulfilment">
                    <Button size="sm" variant="success">Track fulfilment <ArrowRight size={14} /></Button>
                  </Link>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ------------------------------- Results ------------------------------ */}
      {tab === 'results' && (
        resultCatalogues.length === 0 ? (
          <EmptyState
            title="No results yet"
            body="Once a catalogue you bid in closes, your outcome, rank and closing H1 on every lot appear here — win or lose."
          />
        ) : (
          <div className="space-y-6">
            {resultCatalogues.map(({ cat, rows }) => {
              const wonCount = rows.filter((r) => r.result.outcome === 'won').length
              return (
                <div key={cat.id}>
                  <div className="flex items-center justify-between gap-2 mb-2 px-1">
                    <div>
                      <span className="num text-sm font-bold">{cat.code}</span>
                      <span className="text-sm text-ink-muted ml-2">{cat.title}</span>
                    </div>
                    <span className="text-xs font-semibold text-ink-muted">
                      You won {wonCount} of {rows.length} lot{rows.length > 1 ? 's' : ''} you bid on
                    </span>
                  </div>
                  <div className="space-y-3">
                    {rows.map(({ lot, result }) => {
                      const chip = OUTCOME_CHIP[result.outcome]
                      return (
                        <div key={lot.id} className={cx('card p-4 flex flex-wrap items-center gap-3', result.outcome === 'won' && 'border-l-4 border-l-success')}>
                          <PhotoThumb hue={lot.photos[0]?.hue ?? 24} category={lot.category} className="w-16 h-12" />
                          <span className={cx('rounded-lg grid place-items-center font-bold shrink-0 size-7 text-[10px]',
                            result.rank === 1 ? 'bg-ember text-white' : 'bg-surface-2 text-ink-faint')}>
                            H{result.rank}
                          </span>
                          <div className="min-w-0 flex-1 basis-52">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="num text-sm font-bold">{lot.lotNo}</span>
                              <Chip tone={chip.tone}>{chip.label}</Chip>
                            </div>
                            <div className="text-sm text-ink-muted mt-0.5 line-clamp-1">{lot.description}</div>
                            {result.outcome === 'sta' && (
                              <div className="text-xs text-ink-faint mt-0.5">
                                Your H1 was below reserve — the seller has {cat.bidValidityDays} days to accept or decline.
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] uppercase tracking-wider text-ink-faint">Your bid</div>
                            <div className="num text-sm font-semibold">{inr(result.myBestRate)}<span className="text-xs text-ink-faint">/{lot.uom}</span></div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] uppercase tracking-wider text-ink-faint">Closing H1</div>
                            <div className="num text-sm font-semibold">
                              {result.closingH1 != null ? inr(result.closingH1) : '—'}
                              <span className="text-xs text-ink-faint">/{lot.uom}</span>
                            </div>
                          </div>
                          {result.outcome === 'won' ? (
                            <Link to="/buyer/fulfilment">
                              <Button size="sm" variant="success">Track fulfilment <ArrowRight size={14} /></Button>
                            </Link>
                          ) : (
                            <Link to={`/catalogue/${lot.catalogueId}`}>
                              <Button size="sm" variant="ghost">View lot</Button>
                            </Link>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ----------------------------- All history ---------------------------- */}
      {tab === 'all' && (
        allMine.length === 0 ? (
          <EmptyState title="No bids yet" body="Every bid you place — manual or auto-proxy — is recorded here." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-ink-faint border-b border-line">
                  <th className="px-4 py-3 font-semibold">Lot</th>
                  <th className="px-4 py-3 font-semibold text-right">Rate</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Placed at</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {allMine.map((b) => {
                  const lot = lotById.get(b.lotId)
                  return (
                    <tr key={b.id} className="hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-2.5">
                        <Link to={`/catalogue/${b.catalogueId}`} className="hover:text-ember">
                          <span className="num font-semibold">{lot?.lotNo ?? b.lotId}</span>
                          <span className="text-xs text-ink-faint ml-2 num">{catById.get(b.catalogueId)?.code}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right num font-semibold">{inr(b.rate)}<span className="text-xs text-ink-faint">/{lot?.uom ?? ''}</span></td>
                      <td className="px-4 py-2.5">
                        {b.type === 'auto' ? <Chip tone="steel">Auto</Chip> : <Chip tone="neutral">Manual</Chip>}
                      </td>
                      <td className="px-4 py-2.5 num text-ink-muted whitespace-nowrap">{fmtDateTime(b.at)}</td>
                      <td className="px-4 py-2.5">
                        {b.status === 'valid' ? <Chip tone="success">Valid</Chip> : <Chip tone="danger">Void</Chip>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </Page>
  )
}
