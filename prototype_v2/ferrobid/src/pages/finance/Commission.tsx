/* ---------------------------------------------------------------------------
   Finance Administrator — commission settlements.

   The other side of the seller's Settlement page, and the missing half of the
   platform's own revenue. A seller could already record that they had paid us;
   nobody could confirm it had arrived, or chase it when it had not — so the
   auction sat in "Pending settlement" forever and the income was never
   recognised.

   The screen is built around the distinction the P&L depends on:

     owed        the seller accepted a price, we have earned the commission
     recorded    the seller says they have paid it — a claim, not a receipt
     confirmed   Finance matched it against the bank. Only now is it income

   A transfer cannot be confirmed without picking the credit off the statement.
   An EMD-netted settlement never touches the bank, so it confirms on its own.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, BadgeIndianRupee, BellRing, Check, CheckCircle2, HelpCircle, Search, Wallet as WalletIcon,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, EmptyState, Field, Input, Modal, PageHeader, Textarea, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, inrCompact, num, fmtDateTime, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { clearedValue, commissionFor, reserveValue } from '../../lib/money'
import {
  Ageing, MoneyStat, QueueStrip, ScopeNote, SectionTitle, useBooks, useStatementCandidates, type CommissionRow,
} from './shared'

type Tab = 'confirm' | 'outstanding' | 'undecided' | 'confirmed'

/* ---------------------------- confirm dialog -------------------------------- */
function ConfirmModal({ row, onClose }: { row: CommissionRow | null; onClose: () => void }) {
  const cfg = useStore((s) => s.financeConfig)
  const wallets = useStore((s) => s.wallets)
  const confirm = useStore((s) => s.confirmCommissionSettlement)
  const query = useStore((s) => s.queryCommissionSettlement)
  const issueInvoice = useStore((s) => s.issueInvoice)
  const pushToast = useStore((s) => s.pushToast)

  const [picked, setPicked] = useState<string | null>(null)
  const [querying, setQuerying] = useState(false)
  const [note, setNote] = useState('')

  const settlement = row?.settlement
  const amount = settlement?.amount ?? 0
  const { exactRef, nearAmount, rest } = useStatementCandidates('credit', amount, settlement?.reference)
  const candidates = [...exactRef, ...nearAmount, ...rest].slice(0, 8)

  if (!row || !settlement) return null
  const isEmd = settlement.mode === 'emd'
  const sellerWallet = wallets.find((w) => w.userId === settlement.sellerId)
  const emdShort = isEmd && (sellerWallet?.emdLocked ?? 0) < settlement.amount

  const close = () => { setPicked(null); setQuerying(false); setNote(''); onClose() }

  const doConfirm = () => {
    const res = confirm(settlement.id, isEmd ? undefined : picked ?? undefined)
    if (!res.ok) {
      pushToast({ kind: 'danger', title: 'Not confirmed', body: res.error })
      return
    }
    issueInvoice({
      kind: 'commission_receipt', partyId: settlement.sellerId, catalogueId: row.cat.id,
      taxable: settlement.amount, gst: 0, tcs: 0,
      note: `Commission on ${row.cat.code} — ${cfg.sellerCommissionPct}% of upside over reserve, ${row.billable.length} accepted lot${row.billable.length === 1 ? '' : 's'}`,
    })
    pushToast({
      kind: 'success', title: 'Commission confirmed',
      body: `${inr(settlement.amount)} recognised as income. ${row.cat.code} moves into the seller's History.`,
    })
    close()
  }

  const doQuery = () => {
    query(settlement.id, note.trim())
    pushToast({ kind: 'info', title: 'Settlement queried', body: 'The seller has been asked for a better reference. The auction stays in Pending settlement.' })
    close()
  }

  return (
    <Modal open onClose={close} title={querying ? 'Query this settlement' : 'Confirm the commission arrived'} wide>
      {querying ? (
        <div className="space-y-4">
          <div className="card bg-warning-soft border-0 p-4 text-sm">
            {row.seller?.firm ?? 'The seller'} recorded <span className="num font-bold">{inr(settlement.amount)}</span> against{' '}
            <span className="num font-bold">{row.cat.code}</span>. Querying leaves the auction in <em>Pending settlement</em> and asks
            them to correct it — nothing is written off.
          </div>
          <Field label="What is wrong with it" hint="Shown to the seller, and recorded against your name.">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="No credit matching this reference appears on our settlement account for that date. Please confirm the UTR…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setQuerying(false)}>Back</Button>
            <Button variant="steel" disabled={note.trim().length < 4} onClick={doQuery}>Send the query</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card bg-surface-2 border-0 p-4">
            <div className="flex items-start gap-3">
              <Avatar name={row.seller?.name ?? '?'} hue={row.seller?.avatarHue ?? 200} size={38} />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm">{row.seller?.firm ?? row.cat.sellerId}</div>
                <div className="text-xs text-ink-muted"><span className="num">{row.cat.code}</span> · {row.cat.title}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="num text-xl font-bold">{inr(settlement.amount)}</div>
                <Chip tone={isEmd ? 'steel' : 'neutral'} className="mt-1">{isEmd ? 'Netted from EMD' : 'Bank transfer'}</Chip>
              </div>
            </div>
            <div className="text-[12px] text-ink-muted mt-3 pt-3 border-t border-line">
              Recorded {fmtDateTime(settlement.at)}
              {settlement.reference && <> · reference <span className="num font-semibold text-ink">{settlement.reference}</span></>}
            </div>
          </div>

          {/* --------------------- what it was charged on ------------------- */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">
              What the {cfg.sellerCommissionPct}% was charged on
            </div>
            <div className="card divide-y divide-line overflow-hidden max-h-56 overflow-y-auto">
              {row.billable.map((l) => {
                const cleared = clearedValue(l) ?? 0
                const reserve = reserveValue(l)
                return (
                  <div key={l.id} className="px-3.5 py-2.5 flex items-center gap-3 text-[12px]">
                    <span className="num font-bold text-ember shrink-0 w-16">{l.lotNo}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-muted">{l.metal} {l.grade}</span>
                    <span className="num tabular-nums text-ink-faint shrink-0 hidden sm:block">reserve {inrCompact(reserve)}</span>
                    <span className="num tabular-nums shrink-0">cleared {inrCompact(cleared)}</span>
                    <span className="num tabular-nums font-bold shrink-0 w-24 text-right text-success">+{inrCompact(cleared - reserve)}</span>
                    <span className="num tabular-nums font-bold shrink-0 w-24 text-right">{inr(commissionFor(l, cfg) ?? 0)}</span>
                  </div>
                )
              })}
            </div>
            {row.rejected.length > 0 && (
              <p className="text-[12px] text-ink-faint mt-2">
                {num(row.rejected.length)} lot{row.rejected.length === 1 ? '' : 's'} rejected by the seller — no commission is charged on{' '}
                {row.rejected.length === 1 ? 'it' : 'them'}, and what happens to the material is an Operations decision.
              </p>
            )}
          </div>

          {/* --------------------------- the match -------------------------- */}
          {isEmd ? (
            <div className={cx('card border-l-4 p-4 text-[13px]', emdShort ? 'border-l-danger bg-danger-soft/40' : 'border-l-steel bg-steel-soft/30')}>
              <div className="flex items-start gap-2.5">
                <WalletIcon size={15} className={cx('shrink-0 mt-0.5', emdShort ? 'text-danger' : 'text-steel')} />
                <div>
                  {emdShort ? (
                    <><strong className="text-ink">Not enough EMD is held.</strong> The seller holds{' '}
                      {inr(sellerWallet?.emdLocked ?? 0)} against {inr(settlement.amount)} of commission. Query it and ask them to
                      transfer the difference — netting more than is held would create a negative balance.</>
                  ) : (
                    <><strong className="text-ink">Netted against held EMD.</strong> No bank credit is involved, so there is nothing
                      to match on the statement. Confirming reduces the seller's held balance by {inr(settlement.amount)} and records
                      both sides in the ledger.</>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">Pick the credit on our statement</div>
              {candidates.length === 0 ? (
                <div className="card border-dashed p-4 text-[13px] text-ink-muted text-center">
                  No unmatched credit on any company account. A transfer is never confirmed on the seller's word alone —
                  query it and ask for the correct reference.
                </div>
              ) : (
                <div className="card divide-y divide-line overflow-hidden max-h-56 overflow-y-auto">
                  {candidates.map((l) => (
                    <button key={l.id} type="button" onClick={() => setPicked(l.id === picked ? null : l.id)}
                      className={cx('w-full text-left px-3.5 py-2.5 flex items-center gap-3 transition-colors',
                        picked === l.id ? 'bg-ember-soft' : 'hover:bg-surface-2')}>
                      <span className={cx('size-4 rounded-full border grid place-items-center shrink-0',
                        picked === l.id ? 'bg-ember border-ember text-white' : 'border-line-strong')}>
                        {picked === l.id && <Check size={11} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="num text-[13px] font-bold">{l.ref}</span>
                          {l.ref === settlement.reference && <Chip tone="success">Reference matches</Chip>}
                        </span>
                        <span className="block text-[11px] text-ink-muted truncate mt-0.5">{l.narration} · {fmtDateTime(l.at)}</span>
                      </span>
                      <span className="num text-[13px] font-bold tabular-nums shrink-0">{inr(l.amount)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button variant="secondary" onClick={() => setQuerying(true)}><HelpCircle size={15} /> Query</Button>
            <Button variant="success" disabled={(!isEmd && !picked) || emdShort} onClick={doConfirm}>
              <Check size={15} /> Confirm {inr(settlement.amount)}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* --------------------------------- page ------------------------------------ */
export default function Commission() {
  const now = useNow()
  const books = useBooks('all')
  const cfg = books.cfg
  const pushToast = useStore((s) => s.pushToast)
  const notify = useStore((s) => s.notify)
  const audit = useStore((s) => s.audit)

  const [tab, setTab] = useState<Tab>('confirm')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<CommissionRow | null>(null)

  const toConfirm = books.commissionRows.filter((r) => r.awaitingConfirmation)
  const queried = books.commissionRows.filter((r) => r.queried)
  const outstanding = books.commissionRows.filter((r) => r.outstanding)
  const undecided = books.commissionRows.filter((r) => r.undecided.length > 0)
  const confirmed = books.commissionRows.filter((r) => r.confirmed)

  const shown = useMemo(() => {
    const base = tab === 'confirm' ? [...toConfirm, ...queried]
      : tab === 'outstanding' ? outstanding
        : tab === 'undecided' ? undecided : confirmed
    const query = q.trim().toLowerCase()
    return base.filter((r) => !query
      || r.cat.code.toLowerCase().includes(query)
      || r.cat.title.toLowerCase().includes(query)
      || (r.seller?.firm ?? '').toLowerCase().includes(query))
  }, [tab, toConfirm, queried, outstanding, undecided, confirmed, q])

  const chase = (r: CommissionRow) => {
    notify({
      userId: r.cat.sellerId, kind: 'wallet',
      title: `Commission outstanding — ${r.cat.code}`,
      body: `${inr(r.commissionDue)} is due on the lots you accepted. Settle it by transfer or from your held EMD.`,
      href: '/seller/settlement',
    })
    audit('commission.chase', r.cat.code, `Chased ${inr(r.commissionDue)} outstanding from ${r.seller?.firm ?? 'seller'}`, 'warning')
    pushToast({ kind: 'info', title: 'Seller chased', body: `${r.seller?.firm ?? 'The seller'} has been reminded about ${inr(r.commissionDue)}.` })
  }

  return (
    <Page>
      <PageHeader
        title="Commission settlements"
        sub={`${cfg.sellerCommissionPct}% of the seller's upside over their own reserve, on the lots they accepted. Computed by the system — never typed, never negotiated here.`}
        actions={
          toConfirm.length > 0
            ? <Chip tone="warning">{num(toConfirm.length)} awaiting confirmation</Chip>
            : <Chip tone="success"><CheckCircle2 size={12} /> Nothing to confirm</Chip>
        }
      />

      <QueueStrip steps={[
        { label: 'To confirm', count: toConfirm.length + queried.length, urgent: true, onClick: () => setTab('confirm'), active: tab === 'confirm' },
        { label: 'Outstanding — chase', count: outstanding.length, urgent: outstanding.length > 0, onClick: () => setTab('outstanding'), active: tab === 'outstanding' },
        { label: 'Waiting on the seller', count: undecided.length, onClick: () => setTab('undecided'), active: tab === 'undecided' },
        { label: 'Confirmed', count: confirmed.length, onClick: () => setTab('confirmed'), active: tab === 'confirmed' },
      ]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MoneyStat label="Recognised as income" amount={confirmed.reduce((s, r) => s + r.commissionDue, 0)} tone="in" sub="confirmed against the bank" to="/finance/pnl" />
        <MoneyStat label="Recorded, not confirmed" amount={toConfirm.reduce((s, r) => s + r.commissionDue, 0)} tone="risk" sub="the seller says they have paid" />
        <MoneyStat label="Outstanding" amount={outstanding.reduce((s, r) => s + r.commissionDue, 0)} tone="out" sub="decided and unpaid" />
        <MoneyStat label="Not yet earned" amount={undecided.reduce((s, r) => s + r.undecided.reduce((x, l) => x + (commissionFor(l, cfg) ?? 0), 0), 0)} tone="held" sub="seller has not decided the price" />
      </div>

      <SectionTitle
        title={tab === 'confirm' ? 'Awaiting your confirmation'
          : tab === 'outstanding' ? 'Owed and unpaid'
            : tab === 'undecided' ? 'Waiting on the seller' : 'Confirmed'}
        count={shown.length}
        sub={tab === 'confirm' ? 'The seller has recorded a payment. Until it is matched against the bank it is a claim, not income.'
          : tab === 'outstanding' ? 'Every sold lot is decided and nothing has been recorded. Chase it — the older it gets, the less likely it is to arrive.'
            : tab === 'undecided' ? 'These lots cleared but the seller has not accepted or rejected the price yet, so no commission is earned. Nothing for Finance to do.'
              : 'Matched against the bank and recognised in the P&L.'}
        action={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <Input className="h-9 w-56 pl-9" placeholder="Auction or seller…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={<BadgeIndianRupee size={32} strokeWidth={1.5} />}
          title={tab === 'confirm' ? 'Nothing is waiting to be confirmed' : q ? 'Nothing matches that search' : 'Nothing here yet'}
          body={tab === 'confirm'
            ? 'When a seller settles from their Settlement page, the record lands here to be matched against the bank.'
            : 'Commission is only owed once an auction closes and the seller accepts a cleared price.'}
        />
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <div key={r.cat.id} className={cx('card p-4', r.queried && 'border-warning/50')}>
              <div className="flex flex-wrap items-start gap-3">
                <Avatar name={r.seller?.name ?? '?'} hue={r.seller?.avatarHue ?? 200} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="num text-xs font-bold text-ember">{r.cat.code}</span>
                    {r.confirmed && <Chip tone="success"><CheckCircle2 size={11} /> Confirmed</Chip>}
                    {r.awaitingConfirmation && <Chip tone="warning">Recorded — not yet confirmed</Chip>}
                    {r.queried && <Chip tone="danger"><AlertTriangle size={11} /> Queried</Chip>}
                    {r.outstanding && <Chip tone="danger">Unpaid</Chip>}
                    {r.undecided.length > 0 && <Chip tone="steel">{num(r.undecided.length)} lot{r.undecided.length === 1 ? '' : 's'} undecided</Chip>}
                  </div>
                  <div className="font-display font-bold text-base mt-1 truncate">{r.cat.title}</div>
                  <div className="text-[12px] text-ink-muted mt-0.5 truncate">
                    {r.seller?.firm ?? 'Unknown seller'} · closed {relTime(r.closedAt, now)} · {r.cat.yardName}, {r.cat.region}
                  </div>
                  {r.settlement && (
                    <div className="text-[11px] text-ink-faint mt-1">
                      {r.settlement.mode === 'emd' ? 'Netted from held EMD' : `Transfer · ${r.settlement.reference ?? 'no reference given'}`}
                      {' · recorded '}{relTime(r.settlement.at, now)}
                      {r.settlement.confirmedAt && ` · confirmed ${relTime(r.settlement.confirmedAt, now)}`}
                    </div>
                  )}
                  {r.queried && r.settlement?.queryNote && (
                    <div className="text-[12px] text-warning mt-1">Queried: {r.settlement.queryNote}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className={cx('num text-xl font-bold tabular-nums', r.confirmed ? 'text-success' : r.outstanding ? 'text-danger' : 'text-ink')}>
                    {inr(r.commissionDue)}
                  </div>
                  <div className="text-[11px] text-ink-faint">on {inrCompact(r.grossAccepted)} accepted</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3.5 pt-3.5 border-t border-line">
                <div className="flex items-center gap-3 text-[12px] text-ink-muted flex-1 min-w-48">
                  <span><span className="num font-bold text-ink">{num(r.billable.length)}</span> accepted</span>
                  {r.rejected.length > 0 && <span><span className="num font-bold text-ink">{num(r.rejected.length)}</span> rejected</span>}
                  {r.undecided.length > 0 && <span><span className="num font-bold text-ink">{num(r.undecided.length)}</span> undecided</span>}
                  {r.outstanding && <Ageing since={r.closedAt} now={now} warnDays={7} dangerDays={21} />}
                </div>
                {r.outstanding && (
                  <Button size="sm" variant="secondary" onClick={() => chase(r)}><BellRing size={13} /> Chase the seller</Button>
                )}
                {(r.awaitingConfirmation || r.queried) && (
                  <Button size="sm" onClick={() => setOpen(r)}>Confirm against the bank <ArrowRight size={13} /></Button>
                )}
                {r.undecided.length > 0 && !r.settlement && (
                  <span className="text-[12px] text-ink-faint">Nothing for Finance until the seller decides</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <ScopeNote>
          Finance confirms the money and nothing else. The commission rate is {cfg.sellerCommissionPct}% and is set on
          Financial config by the Super Admin with the CEO's approval — it cannot be changed for one seller here. Whether a
          cleared price is accepted at all is the seller's own call on their{' '}
          <Link to="/seller/settlement" className="text-ember font-semibold hover:underline">Settlement</Link> page; a rejected
          price attracts no commission and becomes an Operations decision about the material.
        </ScopeNote>
      </div>

      <ConfirmModal row={open} onClose={() => setOpen(null)} />
    </Page>
  )
}
