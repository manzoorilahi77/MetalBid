/* ---------------------------------------------------------------------------
   Finance Administrator — deposits.

   Moved here from the Sub-Admin work queue, where it sat beside flagged lots and
   KYC as though crediting a wallet were the same kind of job as approving a
   photograph. It is not: this is the front door for every rupee that enters the
   platform.

   The screen is built around one control that did not exist before. A deposit
   used to be approved on a buyer-typed UTR with nothing behind it — the weakest
   point in the whole money flow. Here, approving is gated on picking the actual
   credit off the company bank statement, and the two commonest ways a claim goes
   wrong (a UTR already used, and a credit that arrived short) are surfaced
   before the operator can press anything.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, Building2, Check, CheckCircle2, Copy, FileText, Landmark, Search, X,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, EmptyState, Field, Input, Modal, PageHeader, Textarea, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { inr, fmtDate, fmtDateTime, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { Ageing, MoneyStat, QueueStrip, ScopeNote, SectionTitle, useFinanceScope, useStatementCandidates } from './shared'
import type { BankStatementLine, DepositClaim } from '../../types'

type Tab = 'submitted' | 'approved' | 'rejected'

/* ----------------------------- verify dialog ------------------------------- */
/** Approving a deposit means saying "this money is in our account". The dialog
 *  therefore leads with the statement, not with the buyer's claim. */
function VerifyModal({ claim, onClose }: { claim: DepositClaim | null; onClose: () => void }) {
  const users = useStore((s) => s.users)
  const claims = useStore((s) => s.depositClaims)
  const companyAccounts = useStore((s) => s.companyBankAccounts)
  const approve = useStore((s) => s.approveDepositClaim)
  const reject = useStore((s) => s.rejectDepositClaim)
  const matchBankLine = useStore((s) => s.matchBankLine)
  const pushToast = useStore((s) => s.pushToast)
  const { canExecute } = useFinanceScope()

  const [picked, setPicked] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const amount = claim?.amount ?? 0
  const { exactRef, nearAmount, rest } = useStatementCandidates('credit', amount, claim?.utr)
  const candidates = [...exactRef, ...nearAmount, ...rest].slice(0, 8)

  if (!claim) return null
  const buyer = users.find((u) => u.id === claim.userId)
  const line = candidates.find((l) => l.id === picked)
  const short = line ? claim.amount - line.amount : 0
  const duplicateUtr = claims.filter((c) => c.utr === claim.utr && c.id !== claim.id)
  const alreadyCredited = duplicateUtr.some((c) => c.status === 'approved')

  const close = () => { setPicked(null); setRejecting(false); setReason(''); onClose() }

  const doApprove = () => {
    if (!line) return
    if (!canExecute) { pushToast({ kind: 'warning', title: 'Read-only', body: 'Only the Finance Administrator can credit a wallet.' }); return }
    matchBankLine(line.id, claim.id, 'deposit')
    approve(claim.id)
    pushToast({ kind: 'success', title: 'Deposit credited', body: `${inr(claim.amount)} added to ${buyer?.firm ?? 'the buyer'}'s wallet and matched to ${line.ref}.` })
    close()
  }

  const doReject = () => {
    if (!canExecute) { pushToast({ kind: 'warning', title: 'Read-only', body: 'Only the Finance Administrator can decide a deposit claim.' }); return }
    reject(claim.id, reason.trim())
    pushToast({ kind: 'info', title: 'Deposit claim rejected', body: 'The buyer has been told why and can resubmit with better proof.' })
    close()
  }

  return (
    <Modal open onClose={close} title={rejecting ? 'Reject this deposit claim' : 'Verify against the bank'} wide>
      {rejecting ? (
        <div className="space-y-4">
          <div className="card bg-warning-soft border-0 p-4 text-sm">
            {buyer?.firm ?? 'The buyer'} claimed <span className="num font-bold">{inr(claim.amount)}</span> under UTR{' '}
            <span className="num font-bold">{claim.utr}</span>. Nothing will be credited, and the reason below is what they see.
          </div>
          <Field label="Reason" hint="Shown to the buyer, and recorded in the audit trail against your name.">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="The UTR quoted does not appear on our statement for that date…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(false)}>Back</Button>
            <Button variant="danger" disabled={reason.trim().length < 4} onClick={doReject}>Reject claim</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* --------------------------- the claim --------------------------- */}
          <div className="card bg-surface-2 border-0 p-4">
            <div className="flex items-start gap-3">
              <Avatar name={buyer?.name ?? '?'} hue={buyer?.avatarHue ?? 200} size={38} />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm">{buyer?.firm ?? claim.userId}</div>
                <div className="text-xs text-ink-muted">{buyer?.name} · claimed {relTime(claim.createdAt, Date.now())}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="num text-xl font-bold">{inr(claim.amount)}</div>
                <div className="text-[11px] text-ink-faint">transferred {fmtDate(claim.transferDate)}</div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 mt-3 pt-3 border-t border-line text-[12px]">
              <div><span className="text-ink-faint">UTR quoted</span> <span className="num font-bold text-ink ml-1">{claim.utr}</span></div>
              {claim.proofFilename && (
                <div className="flex items-center gap-1.5 text-ink-muted"><FileText size={12} /> {claim.proofFilename}</div>
              )}
            </div>
          </div>

          {alreadyCredited && (
            <div className="card border-l-4 border-l-danger bg-danger-soft/50 p-3.5 flex items-start gap-2.5 text-[13px]">
              <AlertTriangle size={15} className="text-danger shrink-0 mt-0.5" />
              <div>
                <strong className="text-ink">This UTR has already been credited.</strong> An identical reference was approved on an
                earlier claim from the same buyer. Crediting it again would pay the same money twice.
              </div>
            </div>
          )}

          {/* ------------------------- the statement -------------------------- */}
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Pick the credit on our statement</div>
              <span className="text-[11px] text-ink-faint">{companyAccounts.map((a) => a.bank).join(' · ')}</span>
            </div>
            {candidates.length === 0 ? (
              <div className="card border-dashed p-4 text-[13px] text-ink-muted text-center">
                No unmatched credit on any company account. Until the money is visibly in the bank, this claim cannot be approved.
              </div>
            ) : (
              <div className="card divide-y divide-line overflow-hidden max-h-64 overflow-y-auto">
                {candidates.map((l) => {
                  const isExact = l.ref === claim.utr
                  return (
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
                          {isExact && <Chip tone="success">UTR matches</Chip>}
                          {l.amount !== claim.amount && <Chip tone="warning" className="num">{inr(claim.amount - l.amount)} short</Chip>}
                        </span>
                        <span className="block text-[11px] text-ink-muted truncate mt-0.5">{l.narration} · {fmtDateTime(l.at)}</span>
                      </span>
                      <span className="num text-[13px] font-bold tabular-nums shrink-0">{inr(l.amount)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {line && short !== 0 && (
            <div className="card border-l-4 border-l-warning bg-warning-soft/40 p-3.5 text-[13px]">
              The credit is <span className="num font-bold">{inr(Math.abs(short))}</span> {short > 0 ? 'short of' : 'above'} the claim.
              Approving credits the buyer the <strong>claimed</strong> {inr(claim.amount)} — if that is not what arrived, reject and
              ask them to resubmit for the amount actually transferred.
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button variant="secondary" onClick={() => setRejecting(true)}><X size={15} /> Reject</Button>
            <Button variant="success" disabled={!line || alreadyCredited} onClick={doApprove}>
              <Check size={15} /> Credit {inr(claim.amount)}
            </Button>
          </div>
          {!line && !alreadyCredited && (
            <p className="text-[12px] text-ink-faint text-right">
              A deposit is never approved on a typed reference alone — pick the matching credit first.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

/* --------------------------------- page ------------------------------------ */
export default function Deposits() {
  const now = useNow()
  const claims = useStore((s) => s.depositClaims)
  const users = useStore((s) => s.users)
  const companyAccounts = useStore((s) => s.companyBankAccounts)
  const bankLines = useStore((s) => s.bankStatementLines)
  const pushToast = useStore((s) => s.pushToast)

  const [tab, setTab] = useState<Tab>('submitted')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<DepositClaim | null>(null)

  const firmOf = (id: string) => users.find((u) => u.id === id)?.firm ?? id

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()
    return claims
      .filter((c) => c.status === tab)
      .filter((c) => !query || c.utr.toLowerCase().includes(query) || firmOf(c.userId).toLowerCase().includes(query))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }, [claims, tab, q, users])

  const submitted = claims.filter((c) => c.status === 'submitted')
  const approvedToday = claims.filter((c) => c.status === 'approved' && c.decidedAt && now - Date.parse(c.decidedAt) < 86_400_000)
  const unmatchedCredits = bankLines.filter((l) => l.direction === 'credit' && l.status !== 'matched')
  const utrCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of claims) m.set(c.utr, (m.get(c.utr) ?? 0) + 1)
    return m
  }, [claims])

  const copyAccounts = async () => {
    const text = companyAccounts.map((a) => `${a.bank} · ${a.accountNumberMasked} · ${a.ifsc} (${a.purpose})`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      pushToast({ kind: 'success', title: 'Copied', body: 'Company account details are on your clipboard.' })
    } catch {
      pushToast({ kind: 'warning', title: 'Could not copy', body: 'Clipboard access was blocked by the browser.' })
    }
  }

  return (
    <Page>
      <PageHeader
        title="Deposits"
        sub="Every rupee entering the platform arrives here first. Nothing is credited until it can be seen on our own bank statement."
        actions={<Button variant="secondary" size="sm" onClick={copyAccounts}><Copy size={14} /> Company accounts</Button>}
      />

      <QueueStrip steps={[
        { label: 'Awaiting verification', count: submitted.length, urgent: true, onClick: () => setTab('submitted'), active: tab === 'submitted' },
        { label: 'Approved', count: claims.filter((c) => c.status === 'approved').length, onClick: () => setTab('approved'), active: tab === 'approved' },
        { label: 'Rejected', count: claims.filter((c) => c.status === 'rejected').length, onClick: () => setTab('rejected'), active: tab === 'rejected' },
        { label: 'Unmatched credits in the bank', count: unmatchedCredits.length, to: '/finance/reconciliation', urgent: unmatchedCredits.length > 0 },
      ]} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MoneyStat label="Waiting to be verified" amount={submitted.reduce((s, c) => s + c.amount, 0)} tone="risk" sub={`${num(submitted.length)} claim${submitted.length === 1 ? '' : 's'}`} />
        <MoneyStat label="Credited today" amount={approvedToday.reduce((s, c) => s + c.amount, 0)} tone="in" sub={`${num(approvedToday.length)} approved`} />
        <MoneyStat label="Unmatched in the bank" amount={unmatchedCredits.reduce((s, l) => s + l.amount, 0)} tone="risk" sub="credits with no claim against them" to="/finance/reconciliation" />
        <MoneyStat label="Credited all time" amount={claims.filter((c) => c.status === 'approved').reduce((s, c) => s + c.amount, 0)} tone="plain" sub="into buyer wallets" />
      </div>

      <SectionTitle
        title={tab === 'submitted' ? 'On the desk' : tab === 'approved' ? 'Credited' : 'Rejected'}
        count={rows.length}
        sub={tab === 'submitted'
          ? 'Oldest first is not the order here — a buyer whose EMD deadline is closing needs their money before one who is browsing.'
          : 'Decided claims, newest first. Nothing is ever deleted from this list.'}
        action={
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <Input className="h-9 w-56 pl-9" placeholder="Firm or UTR…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Landmark size={32} strokeWidth={1.5} />}
          title={tab === 'submitted' ? 'No deposit is waiting' : q ? 'Nothing matches that search' : `No ${tab} claims`}
          body={tab === 'submitted'
            ? 'Buyers transfer to a company account and raise a claim from their wallet. New claims land here for verification.'
            : 'Decided claims appear here with the reason and who decided them.'}
        />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {rows.map((c) => {
            const buyer = users.find((u) => u.id === c.userId)
            const dup = (utrCounts.get(c.utr) ?? 0) > 1
            const decider = users.find((u) => u.id === c.decidedBy)
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 hover:bg-surface-2 transition-colors">
                <Avatar name={buyer?.name ?? '?'} hue={buyer?.avatarHue ?? 200} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{buyer?.firm ?? c.userId}</span>
                    {dup && <Chip tone="danger"><AlertTriangle size={11} /> UTR used twice</Chip>}
                    {c.status === 'approved' && <Chip tone="success"><CheckCircle2 size={11} /> Credited</Chip>}
                    {c.status === 'rejected' && <Chip tone="danger">Rejected</Chip>}
                  </div>
                  <div className="text-[12px] text-ink-muted mt-0.5 truncate">
                    <span className="num">{c.utr}</span> · transferred {fmtDate(c.transferDate)}
                    {c.proofFilename ? ` · ${c.proofFilename}` : ' · no proof attached'}
                  </div>
                  {c.rejectionReason && <div className="text-[12px] text-danger mt-0.5">{c.rejectionReason}</div>}
                  {c.status !== 'submitted' && c.decidedAt && (
                    <div className="text-[11px] text-ink-faint mt-0.5">
                      {c.status === 'approved' ? 'Credited' : 'Rejected'} by {decider?.name ?? 'Finance'} · {relTime(c.decidedAt, now)}
                    </div>
                  )}
                </div>
                {c.status === 'submitted' && <Ageing since={c.createdAt} now={now} warnDays={1} dangerDays={2} />}
                <div className="num text-base font-bold tabular-nums shrink-0 w-28 text-right">{inr(c.amount)}</div>
                {c.status === 'submitted' && (
                  <Button size="sm" onClick={() => setOpen(c)}>Verify <ArrowRight size={13} /></Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <SectionTitle title="Where the money should land" sub="What buyers are told to transfer to. Editable by the Super Admin on Financial config." />
      <div className="grid sm:grid-cols-2 gap-3">
        {companyAccounts.map((a) => (
          <div key={a.id} className="card p-4 flex items-start gap-3">
            <span className="size-9 rounded-xl bg-steel-soft text-steel grid place-items-center shrink-0"><Building2 size={16} /></span>
            <div className="min-w-0">
              <div className="font-bold text-sm">{a.bank}</div>
              <div className="num text-[12px] text-ink-muted mt-0.5">{a.accountNumberMasked} · {a.ifsc}</div>
              <Chip tone="neutral" className="mt-1.5">{a.purpose}</Chip>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <ScopeNote>
          Approving a deposit credits a buyer's wallet, which is what lets them lock EMD and bid — so it is
          Finance's decision and only Finance's. The Sub Admin sees every claim on their{' '}
          <Link to="/sub/queue" className="text-ember font-semibold hover:underline">work queue</Link> and can chase
          one, but cannot credit it. Together with withdrawals this is the pair of controls that stops any single
          person holding a complete round trip on customer money.
        </ScopeNote>
      </div>

      <VerifyModal claim={open} onClose={() => setOpen(null)} />
    </Page>
  )
}

/* Kept alongside the page so a future "match from the statement side" flow on
   Reconciliation can reuse the same shape rather than re-deriving it. */
export type { BankStatementLine }
