/* ---------------------------------------------------------------------------
   Finance Administrator — reconciliation.

   The platform ledger against the company bank accounts. This is the control
   that makes every other money screen trustworthy: a deposit approved on a
   buyer-typed reference with no bank credit behind it is the weakest point in
   the whole flow, and this is where that shows up.

   The page is deliberately statement-first. It lists what the *bank* says
   happened and asks which platform record each line belongs to — not the other
   way round. A screen that starts from our own records can only ever confirm
   what we already believe; starting from the statement is what surfaces the
   credit nobody claimed and the debit nobody authorised.

   Three outcomes per line, and no fourth: matched, a break with a written
   explanation, or escalated because it needs someone above this desk.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, Check, CheckCircle2, Flag, Scale, Search, Undo2,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, Field, Input, Modal, PageHeader, Textarea, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, inrCompact, num, fmtDateTime, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { Ageing, MoneyStat, QueueStrip, ScopeNote, SectionTitle } from '../shared/finance'
import type { BankStatementLine } from '../../types'

type Tab = 'unmatched' | 'breaks' | 'matched'

/* --------------------------- match a statement line ------------------------- */
/** Candidates come from the platform's own records of the same direction and a
 *  similar amount — a credit is matched against a deposit or a commission, a
 *  debit against a withdrawal or a refund. */
function MatchModal({ line, onClose }: { line: BankStatementLine | null; onClose: () => void }) {
  const claims = useStore((s) => s.depositClaims)
  const withdrawals = useStore((s) => s.withdrawalRequests)
  const settlements = useStore((s) => s.commissionSettlements)
  const refunds = useStore((s) => s.refundRequests)
  const users = useStore((s) => s.users)
  const catalogues = useStore((s) => s.catalogues)
  const matchBankLine = useStore((s) => s.matchBankLine)
  const pushToast = useStore((s) => s.pushToast)

  const [picked, setPicked] = useState<{ id: string; kind: BankStatementLine['matchedKind']; label: string } | null>(null)

  const candidates = useMemo(() => {
    if (!line) return []
    const near = (amount: number) => Math.abs(amount - line.amount) <= Math.max(1000, line.amount * 0.03)
    const firm = (id: string) => users.find((u) => u.id === id)?.firm ?? id
    if (line.direction === 'credit') {
      return [
        ...claims.filter((c) => c.status !== 'rejected' && near(c.amount)).map((c) => ({
          id: c.id, kind: 'deposit' as const, amount: c.amount, ref: c.utr,
          label: `Deposit claim — ${firm(c.userId)}`, sub: `UTR ${c.utr} · ${c.status}`,
        })),
        ...settlements.filter((s) => near(s.amount)).map((s) => ({
          id: s.id, kind: 'commission' as const, amount: s.amount, ref: s.reference ?? '',
          label: `Commission — ${firm(s.sellerId)}`, sub: `${catalogues.find((c) => c.id === s.catalogueId)?.code ?? ''} · ${s.status ?? 'recorded'}`,
        })),
      ]
    }
    return [
      ...withdrawals.filter((w) => near(w.amount)).map((w) => ({
        id: w.id, kind: 'withdrawal' as const, amount: w.amount, ref: w.ref,
        label: `Withdrawal — ${firm(w.userId)}`, sub: `${w.ref} · ${w.status}`,
      })),
      ...refunds.filter((r) => near(r.amount)).map((r) => ({
        id: r.id, kind: 'payment' as const, amount: r.amount, ref: r.id,
        label: `Refund — ${firm(r.userId)}`, sub: `${r.source} · ${r.status}`,
      })),
    ]
  }, [line, claims, withdrawals, settlements, refunds, users, catalogues])

  if (!line) return null

  const submit = () => {
    if (!picked) return
    matchBankLine(line.id, picked.id, picked.kind)
    pushToast({ kind: 'success', title: 'Line matched', body: `${inr(line.amount)} tied to ${picked.label}.` })
    setPicked(null); onClose()
  }

  return (
    <Modal open onClose={() => { setPicked(null); onClose() }} title="Match this statement line" wide>
      <div className="space-y-4">
        <div className="card bg-surface-2 border-0 p-4">
          <div className="flex items-start gap-3">
            <span className={cx('size-9 rounded-xl grid place-items-center shrink-0',
              line.direction === 'credit' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>
              {line.direction === 'credit' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="num font-bold text-sm">{line.ref}</div>
              <div className="text-[12px] text-ink-muted mt-0.5">{line.narration}</div>
              <div className="text-[11px] text-ink-faint mt-0.5">{fmtDateTime(line.at)}</div>
            </div>
            <div className="num text-xl font-bold shrink-0">{inr(line.amount)}</div>
          </div>
        </div>

        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">
            Which of our records is this
          </div>
          {candidates.length === 0 ? (
            <div className="card border-dashed p-4 text-[13px] text-ink-muted text-center">
              No platform record of a similar amount and direction. That itself is the finding: either a record is
              missing, or this money does not belong to us. Flag it as a break with what you think it is.
            </div>
          ) : (
            <div className="card divide-y divide-line overflow-hidden max-h-72 overflow-y-auto">
              {candidates.map((c) => (
                <button key={`${c.kind}-${c.id}`} type="button"
                  onClick={() => setPicked(picked?.id === c.id ? null : { id: c.id, kind: c.kind, label: c.label })}
                  className={cx('w-full text-left px-3.5 py-2.5 flex items-center gap-3 transition-colors',
                    picked?.id === c.id ? 'bg-ember-soft' : 'hover:bg-surface-2')}>
                  <span className={cx('size-4 rounded-full border grid place-items-center shrink-0',
                    picked?.id === c.id ? 'bg-ember border-ember text-white' : 'border-line-strong')}>
                    {picked?.id === c.id && <Check size={11} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold">{c.label}</span>
                      {c.ref === line.ref && <Chip tone="success">Reference matches</Chip>}
                      {c.amount !== line.amount && <Chip tone="warning" className="num">{inr(Math.abs(c.amount - line.amount))} out</Chip>}
                    </span>
                    <span className="block text-[11px] text-ink-muted truncate mt-0.5 num">{c.sub}</span>
                  </span>
                  <span className="num text-[13px] font-bold tabular-nums shrink-0">{inr(c.amount)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { setPicked(null); onClose() }}>Cancel</Button>
          <Button variant="success" disabled={!picked} onClick={submit}><Check size={15} /> Match</Button>
        </div>
      </div>
    </Modal>
  )
}

/* --------------------------------- page ------------------------------------ */
export default function Reconciliation() {
  const now = useNow()
  const lines = useStore((s) => s.bankStatementLines)
  const companyAccounts = useStore((s) => s.companyBankAccounts)
  const flagBreak = useStore((s) => s.flagBankBreak)
  const escalate = useStore((s) => s.escalateBankBreak)
  const unmatch = useStore((s) => s.unmatchBankLine)
  const pushToast = useStore((s) => s.pushToast)

  const [tab, setTab] = useState<Tab>('unmatched')
  const [q, setQ] = useState('')
  const [accountId, setAccountId] = useState<string>('all')
  const [matching, setMatching] = useState<BankStatementLine | null>(null)
  const [flagging, setFlagging] = useState<BankStatementLine | null>(null)
  const [note, setNote] = useState('')

  const unmatched = lines.filter((l) => l.status === 'unmatched')
  const breaks = lines.filter((l) => l.status === 'break')
  const matched = lines.filter((l) => l.status === 'matched')

  const shown = useMemo(() => {
    const base = tab === 'unmatched' ? unmatched : tab === 'breaks' ? breaks : matched
    const query = q.trim().toLowerCase()
    return base
      .filter((l) => accountId === 'all' || l.accountId === accountId)
      .filter((l) => !query || l.ref.toLowerCase().includes(query) || l.narration.toLowerCase().includes(query))
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  }, [tab, unmatched, breaks, matched, q, accountId])

  /* The single number this screen exists to move: what the bank says we hold,
     against what our own records say we hold. */
  const bankCredits = lines.filter((l) => l.direction === 'credit').reduce((s, l) => s + l.amount, 0)
  const bankDebits = lines.filter((l) => l.direction === 'debit').reduce((s, l) => s + l.amount, 0)
  const bankPosition = bankCredits - bankDebits
  const unexplained = [...unmatched, ...breaks].reduce((s, l) => s + (l.direction === 'credit' ? l.amount : -l.amount), 0)
  const clean = unmatched.length === 0 && breaks.length === 0

  const doFlag = () => {
    if (!flagging) return
    flagBreak(flagging.id, note.trim())
    pushToast({ kind: 'info', title: 'Break recorded', body: 'It stays on the list with your explanation until it is resolved or escalated.' })
    setFlagging(null); setNote('')
  }

  return (
    <Page>
      <PageHeader
        title="Reconciliation"
        sub="What the bank says happened, against what the platform recorded. Every line ends up matched, explained, or escalated."
        actions={
          clean
            ? <Chip tone="success"><CheckCircle2 size={12} /> Fully reconciled</Chip>
            : <Chip tone="danger"><AlertTriangle size={12} /> {num(unmatched.length + breaks.length)} line{unmatched.length + breaks.length === 1 ? '' : 's'} unexplained</Chip>
        }
      />

      <QueueStrip steps={[
        { label: 'Unmatched', count: unmatched.length, urgent: true, onClick: () => setTab('unmatched'), active: tab === 'unmatched' },
        { label: 'Breaks', count: breaks.length, urgent: breaks.length > 0, onClick: () => setTab('breaks'), active: tab === 'breaks' },
        { label: 'Matched', count: matched.length, onClick: () => setTab('matched'), active: tab === 'matched' },
        { label: 'Escalated', count: lines.filter((l) => l.escalated).length },
      ]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MoneyStat label="Bank position" amount={bankPosition} tone="plain" exact sub="credits less debits on the statement" />
        <MoneyStat label="Credits in" amount={bankCredits} tone="in" sub={`${num(lines.filter((l) => l.direction === 'credit').length)} lines`} />
        <MoneyStat label="Debits out" amount={bankDebits} tone="out" sub={`${num(lines.filter((l) => l.direction === 'debit').length)} lines`} />
        <MoneyStat label="Unexplained" amount={unexplained} tone={clean ? 'plain' : 'risk'} exact sub={clean ? 'nothing outstanding' : 'net of unmatched and breaks'} />
      </div>

      {!clean && (
        <div className="card border-l-4 border-l-danger p-4 mt-6 flex items-start gap-3">
          <Scale size={16} className="text-danger shrink-0 mt-0.5" />
          <div className="text-[13px] text-ink-muted">
            <strong className="text-ink">Every unexplained line is either a record we are missing or a record that is wrong.</strong>{' '}
            An unmatched credit means money arrived that nobody claimed — often a buyer who transferred without raising a
            deposit claim. An unmatched debit means money left without a platform record behind it, which is the more
            serious of the two.
          </div>
        </div>
      )}

      <SectionTitle
        title={tab === 'unmatched' ? 'Unmatched' : tab === 'breaks' ? 'Breaks' : 'Matched'}
        count={shown.length}
        sub={tab === 'unmatched' ? 'On the statement, with no platform record tied to it yet.'
          : tab === 'breaks' ? 'Explained but not matchable — bank charges, interest, or a genuine discrepancy someone has to own.'
            : 'Tied to a deposit, withdrawal, commission or refund. Reversible if the match turns out to be wrong.'}
        action={
          <div className="flex items-center gap-2">
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
              className="h-9 px-3 rounded-xl bg-surface border border-line-strong text-[13px] font-semibold">
              <option value="all">All accounts</option>
              {companyAccounts.map((a) => <option key={a.id} value={a.id}>{a.bank} — {a.purpose}</option>)}
            </select>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <Input className="h-9 w-52 pl-9" placeholder="Reference or narration…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
        }
      />

      {shown.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={32} strokeWidth={1.5} />}
          title={tab === 'unmatched' ? 'Nothing unmatched' : tab === 'breaks' ? 'No open breaks' : q ? 'Nothing matches that search' : 'Nothing matched yet'}
          body={tab === 'unmatched'
            ? 'Every line on the company statement is tied to a platform record. That is the state this screen exists to reach.'
            : tab === 'breaks' ? 'A break is a line you have explained but cannot match — bank charges, interest, or a genuine discrepancy.'
              : 'Matching happens here, and automatically when a deposit or commission is confirmed against a specific credit.'}
        />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {shown.map((l) => {
            const account = companyAccounts.find((a) => a.id === l.accountId)
            return (
              <div key={l.id} className={cx('flex flex-wrap items-center gap-3 px-4 py-3.5 hover:bg-surface-2 transition-colors',
                l.escalated && 'bg-danger-soft/30')}>
                <span className={cx('size-9 rounded-xl grid place-items-center shrink-0',
                  l.direction === 'credit' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>
                  {l.direction === 'credit' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="num font-bold text-sm">{l.ref}</span>
                    <Chip tone="neutral">{account?.bank ?? 'Company account'}</Chip>
                    {l.status === 'matched' && <Chip tone="success"><CheckCircle2 size={11} /> Matched</Chip>}
                    {l.status === 'break' && <Chip tone="warning"><Flag size={11} /> Break</Chip>}
                    {l.escalated && <Chip tone="danger">Escalated</Chip>}
                  </div>
                  <div className="text-[12px] text-ink-muted mt-0.5 truncate">{l.narration}</div>
                  <div className="text-[11px] text-ink-faint mt-0.5">
                    {fmtDateTime(l.at)}
                    {l.matchedTo && <> · tied to <span className="num">{l.matchedTo}</span> ({l.matchedKind})</>}
                    {l.matchedAt && ` · matched ${relTime(l.matchedAt, now)}`}
                  </div>
                  {l.breakNote && <div className="text-[12px] text-warning mt-0.5">{l.breakNote}</div>}
                </div>
                {l.status !== 'matched' && <Ageing since={l.at} now={now} warnDays={2} dangerDays={7} />}
                <div className={cx('num text-base font-bold tabular-nums shrink-0 w-32 text-right',
                  l.direction === 'credit' ? 'text-success' : 'text-danger')}>
                  {l.direction === 'credit' ? '+' : '−'} {inr(l.amount)}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {l.status === 'matched' ? (
                    <Button size="sm" variant="ghost" onClick={() => unmatch(l.id)} title="Reverse this match"><Undo2 size={13} /> Unmatch</Button>
                  ) : (
                    <>
                      {l.status === 'break' && !l.escalated && (
                        <Button size="sm" variant="danger" onClick={() => {
                          escalate(l.id)
                          pushToast({ kind: 'warning', title: 'Break escalated', body: 'The Super Admin has been notified and it is on the audit trail at critical severity.' })
                        }}>
                          Escalate
                        </Button>
                      )}
                      {l.status === 'unmatched' && (
                        <Button size="sm" variant="secondary" onClick={() => setFlagging(l)}><Flag size={13} /> Flag a break</Button>
                      )}
                      <Button size="sm" onClick={() => setMatching(l)}>Match</Button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <SectionTitle title="What we hold, per account" sub="The company accounts the statement lines belong to." />
      <div className="grid sm:grid-cols-2 gap-3">
        {companyAccounts.map((a) => {
          const own = lines.filter((l) => l.accountId === a.id)
          const bal = own.reduce((s, l) => s + (l.direction === 'credit' ? l.amount : -l.amount), 0)
          const open = own.filter((l) => l.status !== 'matched').length
          return (
            <div key={a.id} className="card p-4">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-sm">{a.bank}</div>
                  <div className="num text-[12px] text-ink-muted mt-0.5">{a.accountNumberMasked} · {a.ifsc}</div>
                </div>
                <div className="num text-lg font-bold tabular-nums shrink-0">{inrCompact(bal)}</div>
              </div>
              <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-line">
                <Chip tone="neutral">{a.purpose}</Chip>
                <Chip tone={open === 0 ? 'success' : 'warning'}>{open === 0 ? 'Reconciled' : `${num(open)} open`}</Chip>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-8">
        <ScopeNote>
          Reconciliation is Finance's alone — not even the Sub Admin can open it, because it is the check on Finance's own
          work rather than part of the operation. An escalated break goes to the Super Admin and appears on the{' '}
          <Link to="/admin/audit" className="text-ember font-semibold hover:underline">audit trail</Link> at critical
          severity. Matching a line here also settles it on{' '}
          <Link to="/finance/deposits" className="text-ember font-semibold hover:underline">Deposits</Link> and{' '}
          <Link to="/finance/commission" className="text-ember font-semibold hover:underline">Commission settlements</Link>,
          because it is the same record seen from the other side.
        </ScopeNote>
      </div>

      <MatchModal line={matching} onClose={() => setMatching(null)} />

      <Modal open={!!flagging} onClose={() => { setFlagging(null); setNote('') }} title="Flag this as a break">
        <div className="space-y-4">
          <div className="card bg-warning-soft border-0 p-4 text-sm">
            <span className="num font-bold">{inr(flagging?.amount ?? 0)}</span> stays on the list with your explanation
            attached. Use this for lines that are real but not matchable — bank charges, interest, or a discrepancy that
            needs chasing outside the platform.
          </div>
          <Field label="What this line actually is" hint="Recorded against your name. Escalating it later sends this note to the Super Admin.">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Quarterly account maintenance charges — no platform record exists, book to costs…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setFlagging(null); setNote('') }}>Cancel</Button>
            <Button variant="steel" disabled={note.trim().length < 4} onClick={doFlag}>Record the break</Button>
          </div>
        </div>
      </Modal>
    </Page>
  )
}
