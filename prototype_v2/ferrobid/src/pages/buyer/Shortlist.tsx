/* My Shortlist & EMD — the §9 showcase: per-catalogue selections with
   scoped pre-bid EMD funding. This page lists the catalogues you have
   shortlisted lots in, soonest EMD deadline first; open one to fund EMD
   and manage its lots. */
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight, Clock, UserRound, Wallet } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, Countdown, EmptyState, PageHeader, StatusChip } from '../../components/ui'
import { useStore, selectionSummary, catalogueUiStatus } from '../../store/store'
import { emdDeadlineMs, emdDeadlineSoon, emdWindowClosed } from '../../lib/emd'
import { countdown, inr, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'

export default function Shortlist() {
  const me = useStore((s) => s.currentUser)
  const selections = useStore((s) => s.selections)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const wallets = useStore((s) => s.wallets)
  const now = useNow()

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

  const wallet = wallets.find((w) => w.userId === me.id)

  // Catalogues with at least one shortlisted lot, soonest EMD deadline first —
  // the ones that need attention surface at the top instead of getting lost
  // in selection order.
  const cards = selections
    .filter((x) => x.buyerId === me.id && x.lotIds.length > 0)
    .map((sel) => catalogues.find((c) => c.id === sel.catalogueId))
    .filter((cat): cat is NonNullable<typeof cat> => !!cat)
    .map((cat) => ({
      cat,
      summary: selectionSummary({ selections, lots }, me.id, cat.id),
      ui: catalogueUiStatus(cat, now, lots.filter((l) => l.catalogueId === cat.id)),
      deadline: emdDeadlineMs(cat),
    }))
    .sort((a, b) => a.deadline - b.deadline)

  return (
    <Page>
      <PageHeader
        title="My shortlist & EMD"
        sub="Pre-bid EMD is locked per lot from your wallet. Open a catalogue to fund EMD and bid on the lots you've shortlisted."
        actions={
          <div className="card px-4 py-2 flex items-center gap-2 text-sm">
            <Wallet size={15} className="text-ink-muted" />
            <span className="text-ink-muted">Wallet</span>
            <span className="num font-bold">{inr(wallet?.balance ?? 0)}</span>
          </div>
        }
      />

      {cards.length === 0 ? (
        <EmptyState
          title="Nothing shortlisted yet"
          body="Browse live catalogues and tap the star on lots you're interested in — they'll collect here so you can fund EMD in one go."
          action={<Link to="/buyermarketplace"><Button>Browse auctions</Button></Link>}
        />
      ) : (
        <div className="space-y-3">
          {cards.map(({ cat, summary, ui, deadline }) => {
            const closed = emdWindowClosed(cat, now)
            const needsAttention = emdDeadlineSoon(cat, now) && summary.shortfall > 0
            return (
              <Link
                key={cat.id}
                to={`/buyer/shortlist/${cat.id}`}
                className={`card card-hover flex flex-wrap items-center gap-4 px-5 py-4 ${needsAttention ? 'border-l-4 border-l-warning' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="num text-[11px] font-semibold text-ink-faint">{cat.code}</span>
                    <StatusChip status={ui} />
                    {needsAttention && (
                      <Chip tone="warning"><AlertTriangle size={12} /> Closing soon</Chip>
                    )}
                  </div>
                  <div className="font-display font-bold text-lg leading-snug mt-0.5">{cat.title}</div>
                </div>

                {ui === 'live' || ui === 'closing' ? (
                  <Countdown endsAt={cat.endsAt} prefix="ends" size="sm" />
                ) : ui === 'upcoming' && !closed && needsAttention ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-warning num whitespace-nowrap">
                    <Clock size={13} /> {countdown(deadline - now)} left to fund
                  </span>
                ) : ui === 'upcoming' && !closed ? (
                  <Countdown endsAt={new Date(deadline).toISOString()} prefix="fund EMD by" size="sm" />
                ) : ui === 'upcoming' ? (
                  <Chip tone="steel" className="num">starts {relTime(cat.startsAt, now)}</Chip>
                ) : null}

                <div className="flex items-center gap-x-5 gap-y-1 text-sm flex-wrap">
                  <span>
                    <span className="num font-bold">{summary.count}</span>
                    <span className="text-ink-muted"> lot{summary.count === 1 ? '' : 's'} shortlisted</span>
                  </span>
                  {summary.shortfall > 0 ? (
                    closed ? (
                      <Chip tone="danger">EMD deadline passed</Chip>
                    ) : (
                      <Chip tone="warning">Shortfall {inr(summary.shortfall)}</Chip>
                    )
                  ) : (
                    <Chip tone="success">EMD fully funded</Chip>
                  )}
                </div>

                <ChevronRight size={18} className="text-ink-faint shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </Page>
  )
}
