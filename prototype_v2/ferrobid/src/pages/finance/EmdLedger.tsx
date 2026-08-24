/* ---------------------------------------------------------------------------
   Finance Administrator — EMD ledger & forfeiture.

   Every rupee the platform is holding on someone else's behalf, and the one
   screen that can decide to keep it. Forfeiture is configured everywhere in this
   build and no code path ever created one — which means the platform cannot
   enforce its own payment terms.

   Two things shape the page.

   EMD is drawn in steel and never in a profit colour. It is a customer's money
   sitting in our account: a liability, not income, and the day it starts looking
   like revenue is the day someone spends it.

   Releasing EMD is automatic; taking it never is. Forfeiture needs a person, a
   typed reason and — above the configured threshold — the CEO's signature before
   it takes effect. Which is why the primary action on an overdue buyer is
   "chase", and forfeit sits behind it.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, Ban, CheckCircle2, Lock, Search, ShieldAlert, Signature, Undo2, Wallet as WalletIcon,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Avatar, Button, Chip, EmptyState, Input, PageHeader, StatusChip, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, inrCompact, num, fmtDateTime, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { daysOverdue, doOutstanding } from '../../lib/money'
import { MoneyReasonModal, MoneyStat, QueueStrip, ScopeNote, SectionTitle, ThresholdNote } from '../shared/finance'

type Tab = 'held' | 'forfeitable' | 'decided'

interface HoldingRow {
  buyerId: string
  firm: string
  name: string
  hue: number
  standing: string
  emdLocked: number
  balance: number
  /** Lots this buyer currently has EMD funded against. */
  lots: { lotId: string; lotNo: string; catalogueCode: string; catalogueId: string; emd: number; status: string }[]
}

export default function EmdLedger() {
  const now = useNow()
  const wallets = useStore((s) => s.wallets)
  const users = useStore((s) => s.users)
  const lots = useStore((s) => s.lots)
  const catalogues = useStore((s) => s.catalogues)
  const selections = useStore((s) => s.selections)
  const deliveryOrders = useStore((s) => s.deliveryOrders)
  const forfeitures = useStore((s) => s.emdForfeitures)
  const ceoApprovals = useStore((s) => s.ceoApprovals)
  const cfg = useStore((s) => s.financeConfig)
  const raiseForfeiture = useStore((s) => s.raiseEmdForfeiture)
  const waiveForfeiture = useStore((s) => s.waiveEmdForfeiture)
  const pushToast = useStore((s) => s.pushToast)

  const [tab, setTab] = useState<Tab>('held')
  const [q, setQ] = useState('')
  const [forfeit, setForfeit] = useState<{ lotId: string; buyerId: string; lotNo: string; amount: number; firm: string } | null>(null)
  const [waive, setWaive] = useState<string | null>(null)

  /* --------------------------- what is held --------------------------- */
  const holdings = useMemo<HoldingRow[]>(() => {
    const lotById = new Map(lots.map((l) => [l.id, l]))
    const catById = new Map(catalogues.map((c) => [c.id, c]))
    return wallets
      .filter((w) => w.emdLocked > 0)
      .map((w) => {
        const u = users.find((x) => x.id === w.userId)
        const funded = selections
          .filter((s) => s.buyerId === w.userId)
          .flatMap((s) => s.emdFundedLotIds.map((id) => ({ lotId: id, catalogueId: s.catalogueId })))
        return {
          buyerId: w.userId,
          firm: u?.firm ?? w.userId,
          name: u?.name ?? '—',
          hue: u?.avatarHue ?? 200,
          standing: u?.standing ?? 'good',
          emdLocked: w.emdLocked,
          balance: w.balance,
          lots: funded.map((f) => {
            const l = lotById.get(f.lotId)
            return {
              lotId: f.lotId,
              lotNo: l?.lotNo ?? f.lotId,
              catalogueId: f.catalogueId,
              catalogueCode: catById.get(f.catalogueId)?.code ?? '—',
              emd: l?.preBidEmd ?? 0,
              status: l?.status ?? 'unknown',
            }
          }),
        }
      })
      .sort((a, b) => b.emdLocked - a.emdLocked)
  }, [wallets, users, lots, catalogues, selections])

  /* -------------------- who is past the payment window ---------------- */
  const forfeitable = useMemo(() => deliveryOrders
    .map((d) => {
      const overdueBy = daysOverdue(d, cfg, now)
      const lot = lots.find((l) => l.id === d.lotId)
      const w = wallets.find((x) => x.userId === d.buyerId)
      const existing = forfeitures.find((f) => f.lotId === d.lotId && f.buyerId === d.buyerId && f.status !== 'waived')
      return {
        d, lot, overdueBy,
        buyer: users.find((u) => u.id === d.buyerId),
        outstanding: doOutstanding(d),
        emdAtRisk: Math.min(lot?.preBidEmd ?? 0, w?.emdLocked ?? 0),
        existing,
      }
    })
    .filter((r) => r.overdueBy > 0 && r.outstanding > 0 && r.emdAtRisk > 0)
    .sort((a, b) => b.overdueBy - a.overdueBy), [deliveryOrders, cfg, now, lots, wallets, users, forfeitures])

  const openForfeitures = forfeitures.filter((f) => f.status === 'awaiting_ceo')
  const applied = forfeitures.filter((f) => f.status === 'applied')
  const waived = forfeitures.filter((f) => f.status === 'waived')

  const totalHeld = holdings.reduce((s, h) => s + h.emdLocked, 0)
  const totalAtRisk = forfeitable.filter((r) => !r.existing).reduce((s, r) => s + r.emdAtRisk, 0)

  const shownHoldings = useMemo(() => {
    const query = q.trim().toLowerCase()
    return holdings.filter((h) => !query || h.firm.toLowerCase().includes(query) || h.lots.some((l) => l.lotNo.toLowerCase().includes(query)))
  }, [holdings, q])

  const doForfeit = (reason: string) => {
    if (!forfeit) return
    const res = raiseForfeiture(forfeit.lotId, forfeit.buyerId, reason)
    if (!res.ok) {
      pushToast({ kind: 'danger', title: 'Not forfeited', body: res.error })
      return
    }
    pushToast(res.awaitingCeo
      ? { kind: 'info', title: 'Sent for CEO signature', body: `${inr(forfeit.amount)} is above ${inr(cfg.ceoForfeitureFrom)}. The EMD stays held until it is signed.` }
      : { kind: 'warning', title: 'EMD forfeited', body: `${inr(forfeit.amount)} taken from ${forfeit.firm}. They have been told why.` })
    setForfeit(null)
  }

  return (
    <Page>
      <PageHeader
        title="EMD ledger &amp; forfeiture"
        sub="Money the platform is holding on customers' behalf. It is a liability, not income — and it never appears in profit."
        actions={<Chip tone="steel"><Lock size={12} /> {inrCompact(totalHeld)} held across {num(holdings.length)} buyers</Chip>}
      />

      <QueueStrip steps={[
        { label: 'Buyers holding EMD', count: holdings.length, onClick: () => setTab('held'), active: tab === 'held' },
        { label: 'Past the payment window', count: forfeitable.filter((r) => !r.existing).length, urgent: true, onClick: () => setTab('forfeitable'), active: tab === 'forfeitable' },
        { label: 'Awaiting CEO signature', count: openForfeitures.length, urgent: openForfeitures.length > 0, onClick: () => setTab('decided'), active: tab === 'decided' },
        { label: 'Forfeited or waived', count: applied.length + waived.length, onClick: () => setTab('decided'), active: tab === 'decided' },
      ]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MoneyStat label="EMD held" amount={totalHeld} tone="held" exact sub="customers' money in our account" />
        <MoneyStat label="At risk of forfeiture" amount={totalAtRisk} tone="risk" sub={`${num(forfeitable.filter((r) => !r.existing).length)} past the ${cfg.paymentWindowDays}-day window`} />
        <MoneyStat label="Forfeited all time" amount={applied.reduce((s, f) => s + f.amount, 0)} tone="out" sub={`${num(applied.length)} decision${applied.length === 1 ? '' : 's'}`} />
        <MoneyStat label="Waived" amount={waived.reduce((s, f) => s + f.amount, 0)} tone="in" sub="released back to the buyer" />
      </div>

      {/* ---------------------------- held ---------------------------- */}
      {tab === 'held' && (
        <>
          <SectionTitle
            title="Held, by buyer"
            count={shownHoldings.length}
            sub="Released automatically the moment a lot closes against them. Nobody has to press anything for that to happen."
            action={
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
                <Input className="h-9 w-56 pl-9" placeholder="Firm or lot…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            }
          />
          {shownHoldings.length === 0 ? (
            <EmptyState
              icon={<WalletIcon size={32} strokeWidth={1.5} />}
              title={q ? 'Nothing matches that search' : 'No EMD is currently held'}
              body="EMD is locked when a buyer funds a lot before the pre-bid deadline, and released the moment that lot closes against them."
            />
          ) : (
            <div className="space-y-3">
              {shownHoldings.map((h) => (
                <div key={h.buyerId} className="card p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <Avatar name={h.name} hue={h.hue} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{h.firm}</span>
                        {h.standing !== 'good' && <Chip tone={h.standing === 'defaulter' ? 'danger' : 'warning'}>{h.standing}</Chip>}
                      </div>
                      <div className="text-[12px] text-ink-muted mt-0.5">
                        {h.name} · available balance <span className="num font-semibold text-ink">{inr(h.balance)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="num text-xl font-bold text-steel tabular-nums">{inr(h.emdLocked)}</div>
                      <div className="text-[11px] text-ink-faint">held across {num(h.lots.length)} lot{h.lots.length === 1 ? '' : 's'}</div>
                    </div>
                  </div>
                  {h.lots.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-line">
                      {h.lots.map((l) => (
                        <Link key={l.lotId} to={`/catalogue/${l.catalogueId}`}
                          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-line bg-surface-2 text-[12px] hover:border-line-strong transition-colors">
                          <span className="num font-bold text-ember">{l.lotNo}</span>
                          <span className="text-ink-faint num">{l.catalogueCode}</span>
                          <span className="num font-semibold">{inrCompact(l.emd)}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ------------------------ forfeitable ------------------------- */}
      {tab === 'forfeitable' && (
        <>
          <SectionTitle
            title="Past the payment window"
            count={forfeitable.length}
            sub={`A buyer who has won and not paid within ${cfg.paymentWindowDays} days has breached the terms. Chase first — forfeiting is the last move, not the first.`}
          />
          {forfeitable.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={32} strokeWidth={1.5} />}
              title="Every buyer is inside terms"
              body={`Nobody is past the ${cfg.paymentWindowDays}-day payment window. Anything that slips will appear here with the EMD it puts at risk.`}
            />
          ) : (
            <>
              <div className="card divide-y divide-line overflow-hidden">
                {forfeitable.map((r) => (
                  <div key={r.d.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                    <Avatar name={r.buyer?.name ?? '?'} hue={r.buyer?.avatarHue ?? 200} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{r.buyer?.firm ?? r.d.buyerId}</span>
                        <span className="num text-[12px] font-bold text-ember">{r.lot?.lotNo}</span>
                        <Chip tone="danger" className="num">{r.overdueBy}d overdue</Chip>
                        {r.existing && <Chip tone="warning"><Signature size={11} /> With the CEO</Chip>}
                      </div>
                      <div className="text-[12px] text-ink-muted mt-0.5">
                        Owes <span className="num font-semibold text-ink">{inr(r.outstanding)}</span> ·
                        EMD held against this lot <span className="num font-semibold text-steel">{inr(r.emdAtRisk)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link to="/finance/payments" className="text-[12px] font-bold text-ember hover:underline">Chase instead</Link>
                      <Button size="sm" variant="danger" disabled={!!r.existing}
                        onClick={() => setForfeit({
                          lotId: r.d.lotId, buyerId: r.d.buyerId,
                          lotNo: r.lot?.lotNo ?? r.d.lotId, amount: r.emdAtRisk,
                          firm: r.buyer?.firm ?? r.d.buyerId,
                        })}>
                        <Ban size={13} /> Forfeit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <ThresholdNote amount={cfg.ceoForfeitureFrom} label="Forfeitures" />
              </div>
            </>
          )}
        </>
      )}

      {/* -------------------------- decided --------------------------- */}
      {tab === 'decided' && (
        <>
          {openForfeitures.length > 0 && (
            <>
              <SectionTitle
                title="Away for signature"
                count={openForfeitures.length}
                sub="Above the threshold, so it has not taken effect. The EMD is still held and the buyer has not been told it is gone."
              />
              <div className="card divide-y divide-line overflow-hidden">
                {openForfeitures.map((f) => {
                  const buyer = users.find((u) => u.id === f.buyerId)
                  const lot = lots.find((l) => l.id === f.lotId)
                  const approval = ceoApprovals.find((a) => a.kind === 'emd_forfeiture' && a.refId === f.id)
                  return (
                    <div key={f.id} className="flex flex-wrap items-start gap-3 px-4 py-3.5">
                      <span className="size-9 rounded-xl grid place-items-center shrink-0 bg-steel-soft text-steel mt-0.5"><Signature size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm">{buyer?.firm ?? f.buyerId} · <span className="num text-ember">{lot?.lotNo ?? f.lotId}</span></div>
                        <div className="text-[13px] text-ink-muted mt-0.5">{f.reason}</div>
                        <div className="text-[11px] text-ink-faint mt-1">
                          Raised {relTime(f.raisedAt, now)} · {approval?.status === 'pending' ? 'with the CEO' : 'decision pending'}
                        </div>
                      </div>
                      <div className="num text-base font-bold tabular-nums shrink-0">{inr(f.amount)}</div>
                      <Button size="sm" variant="secondary" onClick={() => setWaive(f.id)}><Undo2 size={13} /> Withdraw</Button>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <SectionTitle
            title="Decided"
            count={applied.length + waived.length}
            sub="Nothing is ever removed from this list. A forfeiture is the harshest thing this platform does to a customer, and it stays on the record."
          />
          {applied.length + waived.length === 0 ? (
            <EmptyState
              icon={<ShieldAlert size={32} strokeWidth={1.5} />}
              title="No EMD has ever been forfeited"
              body="That is the healthy state. Buyers who breach the payment window appear under “past the payment window” with the EMD at risk."
            />
          ) : (
            <div className="card divide-y divide-line overflow-hidden">
              {[...applied, ...waived]
                .sort((a, b) => Date.parse(b.decidedAt ?? b.raisedAt) - Date.parse(a.decidedAt ?? a.raisedAt))
                .map((f) => {
                  const buyer = users.find((u) => u.id === f.buyerId)
                  const lot = lots.find((l) => l.id === f.lotId)
                  const decider = users.find((u) => u.id === f.decidedBy)
                  return (
                    <div key={f.id} className="flex flex-wrap items-start gap-3 px-4 py-3.5">
                      <span className={cx('size-9 rounded-xl grid place-items-center shrink-0 mt-0.5',
                        f.status === 'applied' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success')}>
                        {f.status === 'applied' ? <Ban size={16} /> : <Undo2 size={16} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{buyer?.firm ?? f.buyerId}</span>
                          <span className="num text-[12px] font-bold text-ember">{lot?.lotNo ?? f.lotId}</span>
                          <Chip tone={f.status === 'applied' ? 'danger' : 'success'}>{f.status === 'applied' ? 'Forfeited' : 'Waived'}</Chip>
                        </div>
                        <div className="text-[13px] text-ink-muted mt-0.5">{f.decisionNote ?? f.reason}</div>
                        <div className="text-[11px] text-ink-faint mt-1">
                          {decider?.name ?? 'Finance'} · {f.decidedAt ? fmtDateTime(f.decidedAt) : fmtDateTime(f.raisedAt)}
                        </div>
                      </div>
                      <div className={cx('num text-base font-bold tabular-nums shrink-0', f.status === 'applied' ? 'text-danger' : 'text-success')}>
                        {f.status === 'applied' ? '−' : '+'} {inr(f.amount)}
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </>
      )}

      {/* -------------------------- lot states -------------------------- */}
      {tab === 'held' && (
        <>
          <SectionTitle title="What releases EMD automatically" sub="No human step is involved in any of these, and none of them can be overridden from this desk." />
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { status: 'unsold' as const, title: 'A lot closes against the buyer', body: 'Every unsuccessful bidder has their EMD released the moment their lot closes.' },
              { status: 'sold' as const, title: 'The buyer wins and pays', body: 'EMD is set against the delivery order and released when the payment clears.' },
              { status: 'rejected' as const, title: 'The auction is cancelled', body: 'A Super Admin approving a cancellation releases every locked EMD in that sale.' },
            ].map((c) => (
              <div key={c.title} className="card p-4">
                <StatusChip status={c.status} />
                <div className="font-semibold text-sm mt-2">{c.title}</div>
                <p className="text-[12px] text-ink-muted mt-1">{c.body}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-8">
        <ScopeNote>
          Whether a buyer is <em>eligible</em> to fund EMD after the deadline is not a money question and is not decided
          here — it is the Auction Manager's call on{' '}
          <Link to="/auction/emd-eligibility" className="text-ember font-semibold hover:underline">EMD eligibility</Link>, and
          Finance only ever sees the money side of it. This desk cannot release an EMD early, change what a lot's EMD is,
          or let a buyer into a sale.
        </ScopeNote>
      </div>

      <MoneyReasonModal
        open={!!forfeit}
        onClose={() => setForfeit(null)}
        title={`Forfeit EMD on ${forfeit?.lotNo ?? ''}`}
        intent="danger"
        confirmLabel={forfeit && forfeit.amount >= cfg.ceoForfeitureFrom ? 'Send for signature' : `Forfeit ${inr(forfeit?.amount ?? 0)}`}
        summary={
          <>
            <strong>{inr(forfeit?.amount ?? 0)}</strong> held from <strong>{forfeit?.firm}</strong> against{' '}
            <span className="num">{forfeit?.lotNo}</span> will be taken permanently, and their standing moves to watchlist.
            {forfeit && forfeit.amount >= cfg.ceoForfeitureFrom && (
              <> This is above <span className="num font-bold">{inr(cfg.ceoForfeitureFrom)}</span>, so it goes to the CEO
                for signature and nothing moves until it is signed.</>
            )}
          </>
        }
        presets={[
          `Payment window of ${cfg.paymentWindowDays} days lapsed with no transfer and no response to two chases.`,
          'Buyer confirmed in writing that they will not lift the material.',
          'Repeat non-payment — second breach in this quarter.',
        ]}
        placeholder="State exactly what the buyer failed to do, and when…"
        hint="Shown to the buyer, recorded at critical severity in the audit trail, and visible on the CEO's exceptions report."
        onConfirm={doForfeit}
      />

      <MoneyReasonModal
        open={!!waive}
        onClose={() => setWaive(null)}
        title="Withdraw this forfeiture"
        intent="success"
        confirmLabel="Release the EMD"
        summary="The EMD stays with the buyer and the request is withdrawn from the CEO's queue. Money returning to a customer never needs a signature — only taking it does."
        presets={['Buyer paid in full after the request was raised.', 'Delay was caused by a bank outage on our side.', 'Commercial goodwill — first breach, long-standing customer.']}
        placeholder="Why the money stays with them…"
        onConfirm={(reason) => {
          if (!waive) return
          waiveForfeiture(waive, reason)
          pushToast({ kind: 'success', title: 'Forfeiture withdrawn', body: 'The EMD stays with the buyer and they have been told.' })
          setWaive(null)
        }}
      />

      {totalAtRisk > 0 && tab !== 'forfeitable' && (
        <div className="card border-l-4 border-l-warning p-4 mt-4 flex flex-wrap items-center gap-3">
          <AlertTriangle size={18} className="text-warning shrink-0" />
          <p className="text-[13px] text-ink-muted flex-1 min-w-56">
            {inrCompact(totalAtRisk)} of EMD is held against buyers who are past the payment window.
          </p>
          <button onClick={() => setTab('forfeitable')} className="text-[13px] font-bold text-ember hover:underline inline-flex items-center gap-1 shrink-0">
            Review them <ArrowRight size={13} />
          </button>
        </div>
      )}
    </Page>
  )
}
