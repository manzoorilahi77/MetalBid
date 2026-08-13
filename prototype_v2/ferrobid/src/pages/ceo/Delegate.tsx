/* ---------------------------------------------------------------------------
   CEO / MD — delegate my approvals.

   A signature queue with nobody to sign it is a queue that stops the business:
   a forfeiture waits, a catalogue stays private, a customer does not get their
   refund. So the CEO can hand the whole queue to one named person until a set
   date, and take it back at any time.

   Three rules make a delegation safe enough to be worth having:

   · **One person, and by name.** Not a role, not a group. Whoever holds it is
     recorded on every decision they sign — a delegate's signature never reads
     as the CEO's own.
   · **It expires by itself.** A date is mandatory, and the delegation lapses at
     the end of it without anyone having to remember to revoke it.
   · **It adds a signer, it does not remove one.** The CEO can still sign
     anything, at any time, including something the delegate has been sitting on.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, ShieldCheck, UserCheck, UserX } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Avatar, Button, Chip, Field, Input, PageHeader, Select, Textarea, cx } from '../../components/ui'
import { ROLE_LABEL, useStore } from '../../store/store'
import { inr, num, relTime } from '../../lib/format'
import { KIND_LABEL, NotMyDecision, useSignatureQueue } from './shared'
import type { Role } from '../../types'

/** Who the queue may go to. Deliberately narrow: the people who already hold
 *  platform-wide responsibility and are accountable for a money decision. A
 *  functional desk cannot be handed the signature on its own proposals. */
const ELIGIBLE_ROLES: Role[] = ['super_admin', 'sub_admin', 'finance_admin']

const todayIso = (now: number) => new Date(now).toISOString().slice(0, 10)
const addDays = (now: number, days: number) => new Date(now + days * 86_400_000).toISOString().slice(0, 10)

export default function CeoDelegate() {
  const queue = useSignatureQueue()
  const users = useStore((s) => s.users)
  const role = useStore((s) => s.role)
  const delegation = useStore((s) => s.ceoDelegation)
  const delegateApprovals = useStore((s) => s.delegateCeoApprovals)
  const clearDelegation = useStore((s) => s.clearCeoDelegation)
  const pushToast = useStore((s) => s.pushToast)

  const candidates = useMemo(
    () => users.filter((u) => ELIGIBLE_ROLES.includes(u.role)).sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  )

  const [toUserId, setToUserId] = useState(candidates[0]?.id ?? '')
  const [until, setUntil] = useState(addDays(queue.now, 7))
  const [note, setNote] = useState('')

  const isCeo = role === 'ceo'
  const chosen = candidates.find((u) => u.id === toUserId)
  const active = !!queue.delegate

  const hand = () => {
    const res = delegateApprovals(toUserId, until, note.trim() || undefined)
    if (!res.ok) {
      pushToast({ kind: 'danger', title: 'Not delegated', body: res.error })
      return
    }
    pushToast({
      kind: 'success',
      title: `${chosen?.name ?? 'They'} can now sign for you`,
      body: `Until ${until}. Every decision they sign is recorded under their own name.`,
    })
    setNote('')
  }

  const takeBack = () => {
    clearDelegation()
    pushToast({ kind: 'info', title: 'Queue taken back', body: 'Anything already signed stands, under the name of whoever signed it.' })
  }

  return (
    <Page>
      <PageHeader
        title="Delegate my approvals"
        sub="Hand the signature queue to one named person until a set date, so nothing waits on you being at your desk."
        actions={active
          ? <Chip tone="steel"><ShieldCheck size={12} /> Delegated until {queue.delegatedUntil}</Chip>
          : <Chip tone="neutral">Nobody else can sign right now</Chip>}
      />

      {!isCeo && (
        <div className="card border-l-4 border-l-warning p-4 mb-5 text-[13px] text-ink-muted">
          <strong className="text-ink">Only the CEO can hand this queue over.</strong> You are looking at who currently
          holds it and what they may do with it — a delegation is visible to everyone it affects, never a private
          arrangement.
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ---------------------------- current state --------------------------- */}
        <div className="lg:col-span-2 space-y-4">
          {active && queue.delegate ? (
            <div className="card p-5">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar name={queue.delegate.name} hue={queue.delegate.avatarHue} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-lg font-bold">{queue.delegate.name}</div>
                  <div className="text-[13px] text-ink-muted">
                    {ROLE_LABEL[queue.delegate.role]} · {queue.delegate.firm}
                  </div>
                  <div className="text-[12px] text-ink-faint mt-1">
                    Holding your queue until <span className="num font-semibold text-ink">{queue.delegatedUntil}</span>
                    {delegation?.setAt ? ` · handed over ${relTime(delegation.setAt, queue.now)}` : ''}
                  </div>
                </div>
                {isCeo && (
                  <Button variant="secondary" onClick={takeBack}>
                    <UserX size={15} /> Take it back
                  </Button>
                )}
              </div>
              {delegation?.note && (
                <div className="card bg-surface-2/60 border-0 p-3.5 mt-4 text-[13px]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1">What you told them</div>
                  <p className="text-ink">{delegation.note}</p>
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <div className="rounded-xl border border-line px-3.5 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">They can</div>
                  <p className="text-[13px] text-ink-muted mt-1">
                    Approve, refuse or ask for more information on anything in the queue — under their own name, on the
                    audit trail, exactly as you would.
                  </p>
                </div>
                <div className="rounded-xl border border-line px-3.5 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">They cannot</div>
                  <p className="text-[13px] text-ink-muted mt-1">
                    Hand the queue on to a third person, change a threshold, or sign anything after {queue.delegatedUntil} —
                    it lapses on its own.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-5">
              <div className="flex items-start gap-3">
                <span className="size-10 rounded-xl bg-surface-2 text-ink-muted grid place-items-center shrink-0"><UserCheck size={18} /></span>
                <div>
                  <h2 className="font-display text-lg font-bold">Nobody else can sign for you</h2>
                  <p className="text-[13px] text-ink-muted mt-1 max-w-2xl">
                    Every request in your queue waits until you look at it. That is the right default — but if you will be
                    away, a forfeiture, a refund and a finished catalogue all wait with it, and a customer is on the other
                    end of two of those.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------ hand over --------------------------- */}
          {isCeo && (
            <div className="card p-5">
              <h2 className="font-display font-bold">{active ? 'Hand it to someone else' : 'Hand the queue over'}</h2>
              <p className="text-[13px] text-ink-muted mt-1">
                One person at a time. Naming a new delegate replaces the current one immediately.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <Field label="Who is holding it" hint="Only accounts with platform-wide responsibility appear here.">
                  <Select value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
                    {candidates.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} — {ROLE_LABEL[u.role]}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Until the end of" hint="Mandatory. It lapses on its own — nobody has to remember to revoke it.">
                  <Input type="date" className="num" value={until} min={todayIso(queue.now)}
                    onChange={(e) => setUntil(e.target.value)} />
                </Field>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-1 mb-3">
                {[
                  { label: 'A week', days: 7 },
                  { label: 'A fortnight', days: 14 },
                  { label: 'A month', days: 30 },
                ].map((p) => {
                  const value = addDays(queue.now, p.days)
                  return (
                    <button key={p.label} type="button" onClick={() => setUntil(value)}
                      className={cx('h-7 px-2.5 rounded-lg border text-xs font-semibold transition-colors',
                        until === value ? 'border-ember bg-ember-soft text-ember-strong' : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink')}>
                      <CalendarDays size={11} className="inline mr-1 -mt-0.5" />{p.label}
                    </button>
                  )
                })}
              </div>

              <Field label="Anything they should know" hint="Optional. Sent to them with the handover and kept on the audit trail.">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Sign the forfeitures and the refunds. Hold anything to do with what we charge until I am back." />
              </Field>

              <div className="flex flex-wrap items-center gap-3 mt-4">
                <Button onClick={hand} disabled={!toUserId || !until}>
                  <ShieldCheck size={15} /> {active ? 'Replace the delegate' : `Let ${chosen?.name.split(' ')[0] ?? 'them'} sign until ${until}`}
                </Button>
                <span className="text-[12px] text-ink-faint">
                  {num(queue.open.length)} request{queue.open.length === 1 ? '' : 's'} worth {inr(queue.open.reduce((s, a) => s + a.amount, 0))} would pass to them straight away.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ------------------------------ what passes --------------------------- */}
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-line bg-surface-2/60">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">What would pass to them</div>
            </div>
            {queue.open.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-ink-muted text-center">Your queue is empty. A delegation would cover anything that arrives while you are away.</p>
            ) : (
              <div className="divide-y divide-line">
                {queue.open.map((a) => (
                  <div key={a.id} className="px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{KIND_LABEL[a.kind]}</div>
                    <div className="text-[13px] font-semibold mt-0.5">{a.summary}</div>
                    <div className="text-[11px] text-ink-faint mt-0.5">raised {relTime(a.requestedAt, queue.now)}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="px-4 py-3 border-t border-line">
              <Link to="/ceo/approvals" className="text-[13px] font-bold text-ember hover:underline inline-flex items-center gap-1">
                Open the queue <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          <div className="card p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">Never delegated</div>
            <ul className="space-y-2 text-[13px] text-ink-muted">
              <li>Handing the queue on again — a delegate cannot appoint their own delegate.</li>
              <li>Changing the thresholds that decide what reaches you at all. That is a Super Admin edit, and it comes back to you as a request like any other.</li>
              <li>Anything you have already signed. A decision is final and is not editable by anyone, including you.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <NotMyDecision>
          A delegation is a matter of record, not a private arrangement: the person holding it is told, every desk that
          raised a request can see who may sign it, and every signature names the person who actually gave it. That is
          what makes it safe to use — the alternative, in practice, is somebody signing on your behalf without any of
          those three things being true.
        </NotMyDecision>
      </div>
    </Page>
  )
}
