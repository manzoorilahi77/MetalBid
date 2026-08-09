/* EMD & payments — catalogue-level pre-bid EMD funding for shortlisted lots.
   No lot-level detail and no Bid CTA live here — that's Browse & Shortlist and
   the bidding room (via BidroomGate). Cards sort by EMD fund-by urgency. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Clock, Lock, UserRound, Wallet } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, Countdown, EmptyState, MockPayModal, PageHeader, StatusChip } from '../../components/ui'
import { useStore, selectionSummary, catalogueUiStatus } from '../../store/store'
import { emdBlockedMessage, emdDeadlineMs, emdDeadlineSoon, emdWindowClosed } from '../../lib/emd'
import { countdown, inr } from '../../lib/format'
import { useNow } from '../../lib/useTick'

export default function Shortlist() {
  const me = useStore((s) => s.currentUser)
  const selections = useStore((s) => s.selections)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const wallets = useStore((s) => s.wallets)
  const fundEmd = useStore((s) => s.fundEmd)
  const pushToast = useStore((s) => s.pushToast)
  const now = useNow()
  const [payCatId, setPayCatId] = useState<string | null>(null)

  if (!me) {
    return (
      <Page>
        <EmptyState
          icon={<UserRound size={32} strokeWidth={1.5} />}
          title="Sign in to manage EMD"
          body="Pre-bid EMD funding for your shortlisted catalogues is tied to your account."
          action={<Link to="/login"><Button>Sign in</Button></Link>}
        />
      </Page>
    )
  }

  const wallet = wallets.find((w) => w.userId === me.id)

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

  const payCat = catalogues.find((c) => c.id === payCatId)
  const paySummary = payCatId ? selectionSummary({ selections, lots }, me.id, payCatId) : null

  return (
    <Page>
      <PageHeader
        title="EMD & payments"
        sub="Pre-bid EMD is locked per lot from your wallet. Fund the shortfall on each shortlisted catalogue before its deadline to keep bidding open."
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
          body="Star lots in Browse & Shortlist — they'll collect here so you can fund EMD in one go."
          action={<Link to="/buyermarketplace"><Button>Browse & Shortlist</Button></Link>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map(({ cat, summary, ui, deadline }) => {
            const closed = emdWindowClosed(cat, now)
            const needsAttention = emdDeadlineSoon(cat, now) && summary.shortfall > 0
            return (
              <div key={cat.id} className={`card p-4 flex flex-col gap-3 ${needsAttention ? 'border-l-4 border-l-warning' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="num text-[11px] font-semibold text-ink-faint">{cat.code}</span>
                  <StatusChip status={ui} />
                  {needsAttention && (
                    <Chip tone="warning"><AlertTriangle size={12} /> Closing soon</Chip>
                  )}
                </div>
                <Link to={`/catalogue/${cat.id}`} className="font-display font-bold leading-snug hover:text-ember transition-colors">
                  {cat.title}
                </Link>
                {ui === 'live' || ui === 'closing' ? (
                  <Countdown endsAt={cat.endsAt} prefix="closes" size="sm" />
                ) : ui === 'upcoming' && !closed && needsAttention ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-warning num whitespace-nowrap">
                    <Clock size={13} /> {countdown(deadline - now)} left to fund
                  </span>
                ) : ui === 'upcoming' && !closed ? (
                  <Countdown endsAt={new Date(deadline).toISOString()} prefix="fund EMD by" size="sm" />
                ) : null}
                <div className="card bg-surface-2 border-0 p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-ink-muted">Lots selected</span><span className="num font-semibold">{summary.count}</span></div>
                  <div className="flex justify-between"><span className="text-ink-muted">Required</span><span className="num font-semibold">{inr(summary.required)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-muted">Funded</span><span className="num font-semibold text-success">{inr(summary.funded)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-muted">Shortfall</span><span className={`num font-semibold ${summary.shortfall > 0 ? 'text-warning' : 'text-ink'}`}>{inr(summary.shortfall)}</span></div>
                </div>
                <div className="flex items-center gap-2 mt-auto">
                  {summary.shortfall > 0 ? (
                    closed ? (
                      <Chip tone="danger">EMD deadline passed</Chip>
                    ) : (
                      <Button className="flex-1" onClick={() => setPayCatId(cat.id)}><Lock size={14} /> Fund EMD</Button>
                    )
                  ) : (
                    <Chip tone="success">All selected lots funded</Chip>
                  )}
                  <Link to={`/catalogue/${cat.id}`}><Button variant="ghost" size="sm">View catalogue</Button></Link>
                </div>
              </div>
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
          if (payCat && emdWindowClosed(payCat, now)) {
            pushToast({ kind: 'danger', title: 'EMD funding has closed', body: emdBlockedMessage(payCat) })
            setPayCatId(null)
            return
          }
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
