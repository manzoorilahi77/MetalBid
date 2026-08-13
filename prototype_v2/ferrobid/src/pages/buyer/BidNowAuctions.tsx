/* Bid Now — full-page auction picker. Reached from the header "Bid Now"
   shortcut: lists the live auctions the buyer has shortlisted lots in,
   soonest-closing first (whichever needs you fastest goes on top), so one tap
   here always jumps to the auction actually worth rushing for. */
import { Link } from 'react-router-dom'
import { ChevronRight, Gavel, UserRound } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Countdown, EmptyState, PageHeader, StatusChip, cx } from '../../components/ui'
import { useStore, catalogueUiStatus, selectionSummary } from '../../store/store'
import { inr } from '../../lib/format'
import { useNow } from '../../lib/useTick'

export default function BidNowAuctions() {
  const me = useStore((s) => s.currentUser)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const selections = useStore((s) => s.selections)
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

  // Soonest-closing first — the auction with the least time left is the one
  // worth a fast tap, so it never gets buried under calmer ones.
  const auctions = catalogues
    .filter((c) =>
      c.status === 'live' &&
      selections.some((x) => x.buyerId === me.id && x.catalogueId === c.id && x.lotIds.length > 0))
    .sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))

  return (
    <Page>
      <PageHeader
        title="Bid now"
        sub="Your live, shortlisted auctions — soonest to close first. Tap one to jump straight to its lots."
      />

      {auctions.length === 0 ? (
        <EmptyState
          icon={<Gavel size={32} strokeWidth={1.5} />}
          title="No live auctions on your shortlist"
          body="Shortlist lots in a catalogue and it shows up here the moment that auction goes live."
          action={<Link to="/buyer/shortlist"><Button variant="secondary">Go to shortlist</Button></Link>}
        />
      ) : (
        <div className="space-y-3">
          {auctions.map((c, i) => {
            const s = selectionSummary({ selections, lots }, me.id, c.id)
            const catLots = lots.filter((l) => l.catalogueId === c.id)
            const left = Date.parse(c.endsAt) - now
            const urgent = left > 0 && left < 5 * 60_000

            return (
              <Link key={c.id} to={`/buyer/bid-now/${c.id}`}
                style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                className={cx('group card card-hover flex flex-wrap items-center gap-4 p-4 sm:p-5 animate-fade-up',
                  urgent && 'border-danger/40 ring-1 ring-danger/15')}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="num text-sm font-bold text-ember">{c.code}</span>
                    <StatusChip status={catalogueUiStatus(c, now, catLots)} />
                  </div>
                  <div className="font-display font-bold text-lg sm:text-xl leading-snug truncate">{c.title}</div>
                  <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-ink-muted mt-1.5">
                    <span><b className="num text-ink font-semibold">{catLots.length}</b> lots</span>
                    <span><b className="num text-ink font-semibold">{s.count}</b> shortlisted</span>
                    {s.shortfall > 0
                      ? <span className="text-warning font-semibold">EMD pending {inr(s.shortfall)}</span>
                      : <span className="text-success font-semibold">EMD funded</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-auto">
                  <Countdown endsAt={c.endsAt} prefix="ends" size="md" />
                  <span className="inline-flex items-center gap-1 h-10 pl-4 pr-3 rounded-xl bg-ember text-white text-sm font-bold whitespace-nowrap
                    group-hover:bg-ember-strong group-hover:pr-2.5 transition-all">
                    Review lots <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </Page>
  )
}
