/* My Bids & Results — active positions, wins, losses/STA and full history. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Gavel, Trophy, UserRound } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, Countdown, EmptyState, PageHeader, PhotoThumb, Tabs } from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDateTime, inr, inrCompact, num } from '../../lib/format'

type TabKey = 'active' | 'won' | 'lost' | 'all'

export default function Bids() {
  const me = useStore((s) => s.currentUser)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const bids = useStore((s) => s.bids)
  const [tab, setTab] = useState<TabKey>('active')

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

  // Lost & STA: closed lots I bid on but didn't win, plus STA lots where I'm H1
  const staMine = lots.filter((l) => l.status === 'sta' && l.leadingBidderId === me.id)
  const lostLots = bidLotIds
    .map((id) => lotById.get(id))
    .filter((l): l is NonNullable<typeof l> =>
      !!l &&
      ['sold', 'sta', 'unsold'].includes(l.status) &&
      !(l.status === 'sold' && l.leadingBidderId === me.id) &&
      !(l.status === 'sta' && l.leadingBidderId === me.id),
    )
  const lostAndSta = [...staMine, ...lostLots]

  const allMine = [...myBids].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

  return (
    <Page>
      <PageHeader
        title="My bids & results"
        sub="Every rate you've quoted — live positions first, then confirmed wins, losses and lots pending seller approval (STA)."
      />

      <Tabs<TabKey>
        tabs={[
          { key: 'active', label: 'Active', count: activeLots.length },
          { key: 'won', label: 'Won', count: wonLots.length },
          { key: 'lost', label: 'Lost & STA', count: lostAndSta.length },
          { key: 'all', label: 'All history', count: allMine.length },
        ]}
        value={tab}
        onChange={setTab}
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
                  <PhotoThumb hue={lot.photos[0]?.hue ?? 24} className="w-16 h-12" />
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
                  <PhotoThumb hue={lot.photos[0]?.hue ?? 24} className="w-16 h-12" />
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

      {/* ----------------------------- Lost & STA ----------------------------- */}
      {tab === 'lost' && (
        lostAndSta.length === 0 ? (
          <EmptyState
            title="No lost or STA lots"
            body="Lots you bid on but didn't win, and lots where your H1 is subject to seller approval, appear here."
          />
        ) : (
          <div className="space-y-3">
            {lostAndSta.map((lot) => {
              const cat = catById.get(lot.catalogueId)
              const isSta = lot.status === 'sta' && lot.leadingBidderId === me.id
              const mine = myBestOn(lot.id)
              return (
                <div key={lot.id} className="card p-4 flex flex-wrap items-center gap-3">
                  <PhotoThumb hue={lot.photos[0]?.hue ?? 24} className="w-16 h-12" />
                  <div className="min-w-0 flex-1 basis-52">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="num text-sm font-bold">{lot.lotNo}</span>
                      <span className="num text-xs text-ink-faint">{cat?.code}</span>
                      {isSta
                        ? <Chip tone="warning">Subject to approval</Chip>
                        : <Chip tone="neutral">Lost</Chip>}
                    </div>
                    <div className="text-sm text-ink-muted mt-0.5 line-clamp-1">{lot.description}</div>
                    {isSta && (
                      <div className="text-xs text-ink-faint mt-0.5">
                        Your H1 was below reserve — the seller has {cat?.bidValidityDays ?? 7} days to accept or decline.
                      </div>
                    )}
                  </div>
                  {mine > 0 && (
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-wider text-ink-faint">My best</div>
                      <div className="num text-sm font-semibold">{inr(mine)}<span className="text-xs text-ink-faint">/{lot.uom}</span></div>
                    </div>
                  )}
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wider text-ink-faint">Closing H1</div>
                    <div className="num text-sm font-semibold">
                      {lot.resultH1Rate ?? lot.currentRate ? inr((lot.resultH1Rate ?? lot.currentRate)!) : '—'}
                      <span className="text-xs text-ink-faint">/{lot.uom}</span>
                    </div>
                  </div>
                  <Link to={`/catalogue/${lot.catalogueId}`}>
                    <Button size="sm" variant="ghost">View lot</Button>
                  </Link>
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
