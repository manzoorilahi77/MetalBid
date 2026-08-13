/* ---------------------------------------------------------------------------
   CEO / MD — money at risk. The third question: **is anything at risk?**

   Four kinds of money sit on this page and they are not the same kind of thing,
   so they are never added into a single total:

   · **Money we are holding** — customer deposits. It is in our bank account and
     it is not ours. Drawn in steel, never in a profit colour.
   · **Money owed to us** — buyers who won and have not paid, sellers whose
     commission has not arrived. Shown with its age, because a debt's age is
     what tells you whether it is a debt or a loss.
   · **Money in transit** — debited from a wallet and not yet paid out, and
     refunds approved but not yet sent. A customer is waiting on every rupee.
   · **Money in dispute or taken** — what a customer is contesting, and what we
     have kept from customers who defaulted.

   The CEO signs a forfeiture or a large refund; everything else on this page is
   Finance's to work. So the page reads, and points.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Banknote, LifeBuoy, ShieldAlert, Signature } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Chip, EmptyState, PageHeader, Segmented } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, inrCompact, num, relTime } from '../../lib/format'
import { PERIOD_LABEL, type PeriodKey } from '../../lib/money'
import { Headline, NotMyDecision, PlainStat, Question, useRisk, useSignatureQueue, type AgeingRow } from './shared'

/** Who owes what, and for how long. Ageing is the whole point of the table, so
 *  it is the first column rather than a detail at the end of the row. */
function AgeingTable({ rows, empty, now }: { rows: AgeingRow[]; empty: string; now: number }) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-[13px] text-ink-muted text-center">{empty}</p>
  }
  return (
    <div className="divide-y divide-line">
      {rows.slice(0, 8).map((r) => {
        const tone = r.bucket === '30+' ? 'danger' : r.bucket === '16–30' ? 'warning' : r.bucket === '8–15' ? 'steel' : 'neutral'
        return (
          <Link key={r.key} to={r.to} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2 transition-colors">
            <Chip tone={tone} className="num shrink-0 mt-0.5">{r.bucket} days</Chip>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold truncate">{r.party}</div>
              <div className="text-[12px] text-ink-muted truncate">{r.what}</div>
              <div className="text-[11px] text-ink-faint mt-0.5">since {relTime(r.since, now)}</div>
            </div>
            <span className="num text-sm font-bold tabular-nums shrink-0 self-center">{inr(r.amount)}</span>
          </Link>
        )
      })}
    </div>
  )
}

export default function CeoRisk() {
  const [period, setPeriod] = useState<PeriodKey>('month')
  const risk = useRisk(period)
  const queue = useSignatureQueue()
  const cfg = useStore((s) => s.financeConfig)

  const worstBuyer = risk.owedByBuyers[0]
  const worstSeller = risk.owedBySellers[0]
  const oldDebt = [...risk.owedByBuyers, ...risk.owedBySellers]
    .filter((r) => r.bucket === '30+')
    .reduce((s, r) => s + r.amount, 0)
  const nothingAtRisk = risk.emdHeld === 0 && risk.owedToUs === 0 && risk.inTransit === 0 && risk.disputed === 0

  return (
    <Page>
      <PageHeader
        title="Money at risk"
        sub="Money that is in our account but is not ours, money that is ours but is not in our account, and money someone is arguing about."
        actions={
          <Segmented
            options={(['month', 'quarter', 'year', 'all'] as PeriodKey[]).map((k) => ({ key: k, label: PERIOD_LABEL[k] }))}
            value={period} onChange={setPeriod}
          />
        }
      />

      {nothingAtRisk ? (
        <EmptyState
          icon={<ShieldAlert size={32} strokeWidth={1.5} />}
          title="Nothing is at risk right now"
          body="No deposits held, nothing owed to us, nothing in transit and nothing in dispute. That will change the moment the next auction opens."
        />
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            <Headline
              label="Money we are holding for customers"
              value={inr(risk.emdHeld)}
              tone="held"
              sub="Deposits buyers paid to bid. It sits in our bank account and belongs to them — most of it returns automatically the moment their lot closes. It is never part of profit."
            />
            <Headline
              label="Money owed to us"
              value={inr(risk.owedToUs)}
              tone="risk"
              sub={oldDebt > 0
                ? `${inr(oldDebt)} of it has been outstanding more than thirty days. Debt that old usually needs a decision, not another reminder.`
                : 'Nothing has been outstanding more than thirty days. This is a collections question, not yet a write-off one.'}
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <PlainStat label="Buyers who won and have not paid" value={inrCompact(risk.owedByBuyers.reduce((s, r) => s + r.amount, 0))}
              tone="risk" sub={`${num(risk.owedByBuyers.length)} delivery order${risk.owedByBuyers.length === 1 ? '' : 's'}`} />
            <PlainStat label="Commission not yet received" value={inrCompact(risk.owedBySellers.reduce((s, r) => s + r.amount, 0))}
              tone="risk" sub={`${num(risk.owedBySellers.length)} auction${risk.owedBySellers.length === 1 ? '' : 's'}`} />
            <PlainStat label="In transit" value={inrCompact(risk.inTransit)}
              sub="withdrawals and refunds a customer is waiting on" />
            <PlainStat label="In dispute" value={inrCompact(risk.disputed)}
              sub={`${num(risk.openDisputes.length)} open ticket${risk.openDisputes.length === 1 ? '' : 's'}`} to="/ceo/issues" />
          </div>

          {/* ------------------------------ ageing ------------------------------ */}
          <Question
            q="Who owes us, and how long have they owed it?"
            a="Ordered by size. A large recent debt is a collections job; a small old one is usually a decision waiting to be made."
          />
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-line bg-surface-2/60 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Buyers who won and have not paid</span>
                <span className="num text-[12px] font-bold ml-auto">{inr(risk.owedByBuyers.reduce((s, r) => s + r.amount, 0))}</span>
              </div>
              <AgeingTable rows={risk.owedByBuyers} now={risk.now} empty="Every buyer has paid for what they won." />
              {worstBuyer && worstBuyer.bucket === '30+' && (
                <div className="px-4 py-2.5 border-t border-line bg-warning-soft/50 text-[12px] text-ink-muted">
                  A buyer past the payment window can have their deposit forfeited — that is a decision Finance raises and,
                  above {inr(cfg.ceoForfeitureFrom)}, you sign.
                </div>
              )}
            </div>
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-line bg-surface-2/60 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Sellers who owe commission</span>
                <span className="num text-[12px] font-bold ml-auto">{inr(risk.owedBySellers.reduce((s, r) => s + r.amount, 0))}</span>
              </div>
              <AgeingTable rows={risk.owedBySellers} now={risk.now} empty="Every closed auction has been settled." />
              {worstSeller && (
                <div className="px-4 py-2.5 border-t border-line text-[12px] text-ink-muted">
                  Commission is only counted as earned once Finance matches it against the bank, so none of this is in the
                  profit figure yet.
                </div>
              )}
            </div>
          </div>

          {/* ------------------------------ buckets ----------------------------- */}
          <Question q="The shape of the debt" a="The same money, grouped by how old it is rather than by who owes it." />
          <div className="card p-4">
            <div className="grid grid-cols-4 gap-3">
              {risk.buckets.map((b) => {
                const total = b.buyers + b.sellers
                const worst = Math.max(1, ...risk.buckets.map((x) => x.buyers + x.sellers))
                return (
                  <div key={b.bucket}>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{b.bucket} days</div>
                    <div className={`num text-lg font-bold mt-1 ${b.bucket === '30+' && total > 0 ? 'text-danger' : 'text-ink'}`}>
                      {inrCompact(total)}
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-2 mt-2 overflow-hidden">
                      <div className={`h-full rounded-full ${b.bucket === '30+' ? 'bg-danger' : b.bucket === '16–30' ? 'bg-warning' : 'bg-steel'}`}
                        style={{ width: `${(total / worst) * 100}%` }} />
                    </div>
                    <div className="text-[11px] text-ink-faint mt-1.5">
                      buyers {inrCompact(b.buyers)} · sellers {inrCompact(b.sellers)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ---------------------------- in transit --------------------------- */}
          <Question q="Money on its way out" a="Somebody is waiting on all of this. Every day it sits is a day of somebody's working capital." />
          <div className="grid md:grid-cols-3 gap-3">
            <div className="card p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                <Banknote size={13} /> Withdrawals in flight
              </div>
              <div className="num text-xl font-bold mt-1.5">{inr(risk.withdrawalsInFlight)}</div>
              <p className="text-[12px] text-ink-muted mt-1.5">
                Debited from a wallet, not yet paid out. Two Finance users have to touch a withdrawal above{' '}
                {inr(cfg.withdrawalSecondSignatureFrom)} — the reviewer may never be the one who releases it.
              </p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                <LifeBuoy size={13} /> Refunds due
              </div>
              <div className="num text-xl font-bold mt-1.5">{inr(risk.refundsDue)}</div>
              <p className="text-[12px] text-ink-muted mt-1.5">
                Money we have agreed to return and not yet sent. Anything at or above {inr(cfg.ceoRefundFrom)} needs your
                signature first.
              </p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-warning">
                <AlertTriangle size={13} /> Deposits we kept
              </div>
              <div className="num text-xl font-bold text-warning mt-1.5">{inr(risk.forfeitedThisPeriod)}</div>
              <p className="text-[12px] text-ink-muted mt-1.5">
                Forfeited from buyers who did not pay, {PERIOD_LABEL[period].toLowerCase()}.
                {risk.forfeituresProposed > 0 && <> A further {inr(risk.forfeituresProposed)} is proposed and waiting on you.</>}
              </p>
            </div>
          </div>

          {/* ---------------------------- what needs me ------------------------ */}
          {queue.open.length > 0 && (
            <>
              <Question q="What of this needs your signature" a="Money decisions above the configured threshold stop with you before they take effect." />
              <div className="card divide-y divide-line overflow-hidden">
                {queue.open
                  .filter((a) => a.kind === 'emd_forfeiture' || a.kind === 'refund')
                  .map((a) => (
                    <Link key={a.id} to="/ceo/approvals" className="flex items-start gap-3.5 px-4 py-3.5 hover:bg-surface-2">
                      <span className="size-9 rounded-xl grid place-items-center shrink-0 mt-0.5 bg-steel-soft text-steel"><Signature size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm">{a.summary}</div>
                        <div className="text-[13px] text-ink-muted mt-0.5">{a.reason}</div>
                        <div className="text-[11px] text-ink-faint mt-1">Raised {relTime(a.requestedAt, risk.now)}</div>
                      </div>
                      <span className="num text-sm font-bold shrink-0 self-center">{inrCompact(a.amount)}</span>
                    </Link>
                  ))}
                {queue.open.every((a) => a.kind !== 'emd_forfeiture' && a.kind !== 'refund') && (
                  <p className="px-4 py-6 text-[13px] text-ink-muted text-center">
                    Nothing on this page is waiting on you. There are other decisions in your queue.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="mt-8">
            <NotMyDecision>
              Chasing a buyer, releasing a withdrawal, matching a payment to the bank and confirming a commission are all
              Finance&apos;s work, and it is deliberately not possible to do any of them from here. Two decisions on this
              page do reach you, because both take money away from a customer or give it back: a forfeiture at or above{' '}
              <span className="num font-semibold text-ink">{inr(cfg.ceoForfeitureFrom)}</span> and a refund at or above{' '}
              <span className="num font-semibold text-ink">{inr(cfg.ceoRefundFrom)}</span>. Both arrive in{' '}
              <Link to="/ceo/approvals" className="text-ember font-semibold hover:underline">your signature queue</Link>.
            </NotMyDecision>
          </div>
        </>
      )}
    </Page>
  )
}
