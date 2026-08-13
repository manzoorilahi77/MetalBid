/* ---------------------------------------------------------------------------
   Sub Admin — Approvals, all roles.

   One inbox of everything any operational role has done that a Sub Admin may
   want to confirm, question or reverse.

   Read the next sentence before changing anything on this screen, because it is
   the whole design: **this is not a gate on daily work.** The Field Executive,
   the Operation Manager and the Auction Manager act first and their action
   takes effect immediately. This is the supervisory review afterwards. Nothing
   here is holding anybody up, no queue here delays a sale, and a verdict does
   not rewind what was done — the roles that hold the levers do that.

   The screen this replaces had it backwards: a hardcoded list of things
   "awaiting approval", and a permission grid showing this role as a narrower
   one, locked out of the Control Tower and master data. Both were wrong. Every
   Sub Admin account is identical, with the same full menu and the same powers,
   and the three genuine limits — a void, a permanent ban, a money movement —
   are handed on at the bottom of this page rather than shown as a table of
   padlocks.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight, Ban, CheckCircle2, Gavel, HelpCircle, Inbox, Landmark, RotateCcw, Undo2,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, EmptyState, Field, Modal, PageHeader, Segmented, Select, Stat, Textarea, cx,
} from '../../components/ui'
import { ROLE_LABEL, useStore } from '../../store/store'
import { fmtDateTime, inr, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { useReviewFeed } from './shared'
import type { ActionVerdict, AuditEvent } from '../../types'

type Tab = 'unreviewed' | 'reviewed' | 'escalated'

const VERDICT_LABEL: Record<ActionVerdict, string> = {
  confirmed: 'Confirmed — this stands',
  questioned: 'Questioned — asked them about it',
  reversed: 'Sent back — this should not stand',
}

const VERDICT_TONE: Record<ActionVerdict, 'success' | 'warning' | 'danger'> = {
  confirmed: 'success', questioned: 'warning', reversed: 'danger',
}

/** Plain English for an audit action key. The desk reviewing this should not
 *  have to read `lot.send_back` and translate it. */
const ACTION_LABEL: Record<string, string> = {
  'lot.approved': 'Approved a lot into a catalogue',
  'lot.rejected': 'Rejected a lot',
  'lot.send_back': 'Sent a lot back for re-inspection',
  // Older keys still on the seeded record — see OPERATIONAL_ACTIONS.
  'lot.approve': 'Approved a lot into a catalogue',
  'lot.flag': 'Flagged a lot at inspection',
  'kyc.review': 'Looked at a seller\'s documents',
  'settlement.approve': 'Approved a settlement',
  'inspection.bypass': 'Bypassed the yard visit',
  'inspection.submit': 'Filed an inspection report',
  'catalogue.publish': 'Published a catalogue',
  'catalogue.assign': 'Assigned a catalogue to a field executive',
  'catalogue.override': 'Overrode a catalogue detail',
  'auction.pause': 'Paused a live auction',
  'auction.resume': 'Resumed a live auction',
  'auction.extend': 'Extended a live auction',
  'auction.reschedule': 'Rescheduled an auction',
  'auction.results_confirm': 'Confirmed the results',
  'auction.return_to_ops': 'Sent a catalogue back to Operations',
  'auction.sta_refer': 'Referred a below-reserve lot to the seller',
  'auction.cancel_request': 'Asked for an auction to be cancelled',
  'emd_exemption.approve': 'Let a buyer in after the EMD deadline',
  'emd_exemption.reject': 'Refused an EMD exemption',
  'kyc.approve': 'Verified a seller',
  'kyc.reject': 'Rejected a seller',
  'delivery.handover': 'Closed a handover',
  'do.complete': 'Completed a lifting',
  'bid.flag': 'Flagged a bid',
  'bid.void': 'Voided a bid',
  'bid.void_request': 'Asked for a bid to be voided',
  'announcement.send': 'Broadcast an announcement',
  'user.standing': 'Changed an account\'s standing',
  'account.status': 'Changed an account\'s status',
}

/** The handful of actions worth a second look by default — an auction that went
 *  public, material that skipped the yard, a buyer let in late. Not a rule, a
 *  starting point: the filter is right there. */
const NOTABLE = new Set([
  'inspection.bypass', 'catalogue.publish', 'auction.cancel_request', 'auction.extend',
  'emd_exemption.approve', 'lot.rejected', 'bid.void', 'account.status',
])

export default function Approvals() {
  const now = useNow()
  const users = useStore((s) => s.users)
  const bidVoidRequests = useStore((s) => s.bidVoidRequests)
  const cancellationRequests = useStore((s) => s.cancellationRequests)
  const refundRequests = useStore((s) => s.refundRequests)
  const contentDrafts = useStore((s) => s.contentDrafts)
  const reviewAction = useStore((s) => s.reviewAction)
  const setUserStanding = useStore((s) => s.setUserStanding)
  const pushToast = useStore((s) => s.pushToast)

  const feed = useReviewFeed()

  const [tab, setTab] = useState<Tab>('unreviewed')
  const [who, setWho] = useState('all')
  const [notableOnly, setNotableOnly] = useState(false)
  const [deciding, setDeciding] = useState<AuditEvent | null>(null)
  const [verdict, setVerdict] = useState<ActionVerdict>('confirmed')
  const [note, setNote] = useState('')

  const unreviewed = feed.filter((r) => !r.review)
  const reviewed = feed.filter((r) => r.review)
  const escalated = feed.filter((r) => r.review?.escalatedTo)

  const base = tab === 'unreviewed' ? unreviewed : tab === 'reviewed' ? reviewed : escalated
  const rows = base
    .filter((r) => who === 'all' || r.actor?.role === who)
    .filter((r) => !notableOnly || NOTABLE.has(r.event.action))

  const rolesInFeed = Array.from(new Set(feed.map((r) => r.actor?.role).filter(Boolean))) as string[]

  /* --- what genuinely is not this desk's to do, and where it went --------- */
  const voidsWithSuper = bidVoidRequests.filter((r) => r.stage === 'requested' && r.status === 'pending')
  const cancelsWithSuper = cancellationRequests.filter((r) => r.status === 'pending')
  const refundsWithFinance = refundRequests.filter((r) => r.status === 'pending' || r.status === 'awaiting_ceo')
  const contentWithSuper = contentDrafts.filter((d) => d.status === 'submitted')
  const banCandidates = users.filter((u) => u.standing === 'watchlist')

  const submit = () => {
    if (!deciding) return
    const r = reviewAction(deciding.id, verdict, note)
    if (!r.ok) { pushToast({ kind: 'danger', title: 'Not recorded', body: r.error }); return }
    setDeciding(null)
    pushToast({
      kind: verdict === 'confirmed' ? 'success' : 'info',
      title: VERDICT_LABEL[verdict],
      body: r.escalatedTo
        ? 'Recorded, and handed to the Super Admin — reversing this one is their lever, not ours.'
        : 'Recorded against the entry, and the person who did it has been told.',
    })
  }

  const propose = (userId: string, firm: string) => {
    // A Sub Admin proposes a ban; a Super Admin executes it and the CEO
    // approves it. What this desk can do on its own is move the account to
    // defaulter standing, which is reversible.
    const r = setUserStanding(userId, 'defaulter', 'Proposed for permanent ban by a Sub Admin — repeated failures on the operational side')
    pushToast({
      kind: 'info',
      title: 'Proposed to Super Admin',
      body: `${firm} moved to defaulter and put forward for a permanent ban. A ban is executed by a Super Admin and approved by the CEO.`,
    })
    return r
  }

  return (
    <Page>
      <PageHeader
        title="Approvals — all roles"
        sub="Everything the operational roles have done, in one place. They act first and it takes effect immediately — this is the review afterwards."
        actions={
          <Segmented<Tab>
            options={[
              { key: 'unreviewed', label: `To review (${unreviewed.length})` },
              { key: 'reviewed', label: `Reviewed (${reviewed.length})` },
              { key: 'escalated', label: `Handed on (${escalated.length})` },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      />

      <div className="card bg-steel-soft/40 border-0 p-4 mb-6 text-sm text-ink-muted">
        <strong className="text-ink">Nothing here is waiting on you to happen.</strong> A lot approved by the Operation
        Manager is already in a catalogue; an auction the Auction Manager published is already public. Confirming an
        entry says it stands, questioning it asks the person about it, and sending one back says it should not stand —
        which, for a bid, a ban or a live auction, means handing it to the Super Admin who holds that lever.
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Waiting for a look" value={num(unreviewed.length)} tone={unreviewed.length ? 'ember' : undefined} sub="Across every operational role" />
        <Stat label="Confirmed" value={num(reviewed.filter((r) => r.review?.verdict === 'confirmed').length)} tone="success" sub="Reviewed and left standing" />
        <Stat label="Questioned or sent back" value={num(reviewed.filter((r) => r.review?.verdict !== 'confirmed').length)} tone="warning" sub="Someone was asked about it" />
        <Stat label="With the Super Admin" value={num(voidsWithSuper.length + cancelsWithSuper.length + contentWithSuper.length)} sub="Voids, cancellations, content" to="/admin/control-tower" />
      </div>

      {/* -------------------------------- filters ---------------------------- */}
      <div className="card p-4 mb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <Field label="Who did it" className="w-56">
          <Select value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="all">Every operational role</option>
            {rolesInFeed.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r as keyof typeof ROLE_LABEL] ?? r}</option>
            ))}
          </Select>
        </Field>
        <div className="pb-2.5">
          <Button
            variant={notableOnly ? 'steel' : 'ghost'}
            size="sm"
            onClick={() => setNotableOnly(!notableOnly)}>
            Worth a second look
          </Button>
        </div>
      </div>

      {/* --------------------------------- feed ------------------------------ */}
      {rows.length === 0 ? (
        <EmptyState
          icon={<Inbox size={26} />}
          title={tab === 'unreviewed' ? 'Everything has been looked at' : 'Nothing here'}
          body={tab === 'unreviewed'
            ? 'Every operational action on the record has a verdict against it. New ones appear the moment they happen.'
            : 'Change the filters above, or switch tab.'}
        />
      ) : (
        <div className="card overflow-hidden mb-8">
          <ul>
            {rows.map(({ event, actor, review }) => (
              <li key={event.id} className={cx('px-4 sm:px-5 py-4 border-b border-line last:border-0',
                NOTABLE.has(event.action) && !review && 'bg-warning-soft/20')}>
                <div className="flex flex-wrap items-start gap-3">
                  {actor
                    ? <Avatar name={actor.name} hue={actor.avatarHue} size={34} />
                    : <span className="size-[34px] rounded-full bg-surface-2 border border-line grid place-items-center text-xs font-bold text-ink-faint">SYS</span>}
                  <div className="flex-1 min-w-52">
                    <div className="font-semibold text-sm">
                      {ACTION_LABEL[event.action] ?? event.action} — <span className="num">{event.target}</span>
                    </div>
                    <div className="text-sm text-ink-muted mt-0.5">{event.detail}</div>
                    <div className="text-xs text-ink-faint mt-1">
                      {actor ? `${actor.name} · ${ROLE_LABEL[actor.role as keyof typeof ROLE_LABEL] ?? actor.role}` : 'System'}
                      {' · '}<span title={fmtDateTime(event.at)}>{relTime(event.at, now)}</span>
                    </div>
                  </div>
                  {review ? (
                    <div className="text-right">
                      <Chip tone={VERDICT_TONE[review.verdict]}>{review.verdict}</Chip>
                      {review.escalatedTo && (
                        <div className="text-xs text-ink-faint mt-1">
                          with {ROLE_LABEL[review.escalatedTo as keyof typeof ROLE_LABEL] ?? review.escalatedTo}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setDeciding(event); setVerdict('questioned'); setNote('') }}>
                        <HelpCircle size={13} /> Question
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => { setDeciding(event); setVerdict('reversed'); setNote('') }}>
                        <Undo2 size={13} /> Send back
                      </Button>
                      <Button variant="success" size="sm" onClick={() => { setDeciding(event); setVerdict('confirmed'); setNote('') }}>
                        <CheckCircle2 size={13} /> Confirm
                      </Button>
                    </div>
                  )}
                </div>
                {review?.note && (
                  <p className="text-sm text-ink-muted mt-2.5 pl-[46px] border-l-2 border-line ml-[16px]">
                    <span className="font-semibold text-ink">Your note:</span> {review.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --------------------- what this desk hands on ------------------------ */}
      <h2 className="font-display font-bold text-lg mb-1">Things this desk hands on</h2>
      <p className="text-sm text-ink-muted mb-3">
        Three levers a Sub Admin does not hold, and where each one went. Not a permission grid — every Sub Admin
        account is identical, and these are the same three for all of them.
      </p>
      <div className="grid md:grid-cols-3 gap-3 mb-8">
        <section className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <Gavel size={18} className="text-warning" />
            <Chip tone={voidsWithSuper.length ? 'warning' : 'neutral'} className="num">{num(voidsWithSuper.length)}</Chip>
          </div>
          <div className="font-semibold text-sm">Voiding a bid</div>
          <p className="text-xs text-ink-muted mt-1 leading-relaxed">
            This desk flags a bid and asks for the void with the evidence; the Super Admin decides. A cancellation is
            the same shape{cancelsWithSuper.length > 0 && <> — {num(cancelsWithSuper.length)} waiting</>}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/sub/bid-monitor" className="text-xs font-semibold text-ember hover:underline">Bid monitor →</Link>
            <Link to="/admin/control-tower" className="text-xs font-semibold text-ink-faint hover:underline">
              Where it lands <ArrowUpRight size={11} className="inline" />
            </Link>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <Landmark size={18} className="text-ember" />
            <Chip tone={refundsWithFinance.length ? 'warning' : 'neutral'} className="num">{num(refundsWithFinance.length)}</Chip>
          </div>
          <div className="font-semibold text-sm">Moving money</div>
          <p className="text-xs text-ink-muted mt-1 leading-relaxed">
            Every deposit, withdrawal, payment and commission is visible here and decided by Finance. Refunds this desk
            raised from a dispute sit in their queue
            {refundsWithFinance.length > 0 && <> — {inr(refundsWithFinance.reduce((t, r) => t + r.amount, 0))} in total</>}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/sub/payments" className="text-xs font-semibold text-ember hover:underline">Payment activity →</Link>
            <Link to="/finance/refunds" className="text-xs font-semibold text-ink-faint hover:underline">
              Finance refunds <ArrowUpRight size={11} className="inline" />
            </Link>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <Ban size={18} className="text-danger" />
            <Chip tone={banCandidates.length ? 'warning' : 'neutral'} className="num">{num(banCandidates.length)}</Chip>
          </div>
          <div className="font-semibold text-sm">Banning an account permanently</div>
          <p className="text-xs text-ink-muted mt-1 leading-relaxed">
            This desk can move an account to defaulter, which is reversible. A permanent ban is executed by a Super
            Admin and approved by the CEO — an account is never deleted.
          </p>
          {banCandidates.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {banCandidates.slice(0, 2).map((u) => (
                <li key={u.id} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate">{u.firm}</span>
                  <Button variant="ghost" size="sm" onClick={() => propose(u.id, u.firm)}>Propose</Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3">
              <Link to="/admin/users" className="text-xs font-semibold text-ember hover:underline">User accounts →</Link>
            </div>
          )}
        </section>
      </div>

      {/* ------------------------------ the verdict --------------------------- */}
      <Modal open={!!deciding} onClose={() => setDeciding(null)} title="Review this action">
        {deciding && (
          <div className="space-y-4">
            <div className="card bg-surface-2 p-3.5 text-sm">
              <div className="font-semibold">{ACTION_LABEL[deciding.action] ?? deciding.action}</div>
              <div className="text-ink-muted mt-1">
                <span className="num font-semibold">{deciding.target}</span> — {deciding.detail}
              </div>
              <div className="text-xs text-ink-faint mt-1.5">
                {users.find((u) => u.id === deciding.actorId)?.name ?? 'System'} · {fmtDateTime(deciding.at)}
              </div>
            </div>

            <Field label="Your verdict">
              <Select value={verdict} onChange={(e) => setVerdict(e.target.value as ActionVerdict)}>
                {(Object.keys(VERDICT_LABEL) as ActionVerdict[]).map((k) => (
                  <option key={k} value={k}>{VERDICT_LABEL[k]}</option>
                ))}
              </Select>
            </Field>

            {verdict === 'reversed' && (
              <div className="card bg-warning-soft/50 border-0 p-3.5 text-sm text-ink-muted">
                <RotateCcw size={14} className="inline mr-1.5 -mt-0.5" />
                Sending it back records your finding and tells the person who did it. It does not itself undo the
                action — a bid, a ban or a live auction is the Super Admin's lever, and this hands it to them with your
                note attached.
              </div>
            )}

            <Field
              label={verdict === 'confirmed' ? 'Note' : 'What is wrong with it'}
              hint={verdict === 'confirmed'
                ? 'Optional — say why you looked, if it is worth saying.'
                : 'Required. The person who did it is shown this word for word.'}>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={verdict === 'confirmed'
                  ? 'e.g. checked against the inspection photos — the grade call is right.'
                  : 'e.g. this lot was bypassed for a seller who is not on the trusted list…'}
              />
            </Field>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeciding(null)}>Cancel</Button>
              <Button variant={verdict === 'confirmed' ? 'success' : 'primary'} onClick={submit}>
                Record this
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
