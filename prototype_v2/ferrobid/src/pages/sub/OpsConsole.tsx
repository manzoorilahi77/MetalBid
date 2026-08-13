/* ---------------------------------------------------------------------------
   Sub Admin — Ops console.

   A dashboard answers exactly two questions: **is anything wrong?** and **what
   needs me today?** So this screen is the whole operation in one place — the
   pre-auction pipeline, the sale that is running, the money moving through it —
   and then the work, ranked by how close it is to its SLA.

   Nothing here is edited in place. Every row is a link to the screen where it
   is actually resolved, and every count is derived from the same board the work
   queue renders, so the number and the list can never disagree.

   This screen used to say "scoped access: monitoring and triage only" and point
   at a Control Tower it could not open. That was wrong about the role: a Sub
   Admin runs the pre-auction pipeline, runs the auction, verifies sellers,
   administers accounts and closes disputes. What they do *not* do is move
   money, void a bid or ban an account — and those three are called out where
   they arise rather than as a permission table.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ClipboardList, Inbox, NotebookPen, Radio, ScrollText, ShieldCheck, UserPlus,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, Countdown, Field, PageHeader, Select, Stat, StatusChip, Textarea,
} from '../../components/ui'
import { useStore, catalogueUiStatus } from '../../store/store'
import { inrCompact, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { useReviewFeed, useWorkBoard, WorkList } from './shared'
import type { AuditEvent } from '../../types'

const SEVERITY_TONE: Record<AuditEvent['severity'], 'neutral' | 'warning' | 'danger'> = {
  info: 'neutral',
  warning: 'warning',
  critical: 'danger',
}

export default function OpsConsole() {
  const now = useNow()
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const bids = useStore((s) => s.bids)
  const users = useStore((s) => s.users)
  const wallets = useStore((s) => s.wallets)
  const auditEvents = useStore((s) => s.auditEvents)
  const handoverNotes = useStore((s) => s.handoverNotes)
  const paused = useStore((s) => s.paused)
  const me = useStore((s) => s.currentUser)
  const assignCatalogue = useStore((s) => s.assignCatalogue)
  const saveHandoverNote = useStore((s) => s.saveHandoverNote)
  const pushToast = useStore((s) => s.pushToast)

  const board = useWorkBoard()
  const reviewFeed = useReviewFeed()

  const [notes, setNotes] = useState('')
  const [assigning, setAssigning] = useState<Record<string, string>>({})

  /* ------------------------------ is anything wrong? ---------------------- */
  const liveCats = catalogues.filter((c) => c.status === 'live')
  const bidsLastHour = bids.filter((b) => b.status === 'valid' && now - Date.parse(b.at) <= 3_600_000).length
  const emdHeld = wallets.reduce((t, w) => t + (w.emdLocked ?? 0), 0)

  const mine = board.filter((i) => i.mine)
  const overdue = mine.filter((i) => i.overdue)
  const claimedByMe = board.filter((i) => i.claimedBy?.id === me?.id)
  const unreviewed = reviewFeed.filter((r) => !r.review)

  /* --------------------------- the pre-auction pipeline ------------------- */
  const pendingInspection = lots.filter((l) => l.status === 'pending_inspection').length
  const awaitingDecision = lots.filter((l) => l.status === 'inspected' || l.status === 'flagged').length
  const readyToPublish = catalogues.filter((c) => c.status === 'draft')
  const unassigned = catalogues.filter((c) => c.status !== 'closed' && !c.assignedFieldExecId)
  const fieldExecs = users.filter((u) => u.role === 'field_exec')

  /* --------------------------------- work lists --------------------------- */
  const verifications = board.filter((i) => i.kind === 'kyc')
  const openDisputes = board.filter((i) => i.kind === 'dispute')
  const moneyItems = board.filter((i) => !i.mine)
  const flaggedBids = board.filter((i) => i.kind === 'bid_flag')
  const resets = board.filter((i) => i.kind === 'password_reset')

  const recentAudit = auditEvents.slice(0, 8)

  const assign = (catalogueId: string, code: string) => {
    const execId = assigning[catalogueId]
    if (!execId) return
    assignCatalogue(catalogueId, execId)
    setAssigning((prev) => ({ ...prev, [catalogueId]: '' }))
    pushToast({
      kind: 'success',
      title: `${code} assigned`,
      body: `${users.find((u) => u.id === execId)?.name ?? 'Field executive'} has the yard visit.`,
    })
  }

  const saveHandover = () => {
    const r = saveHandoverNote(notes)
    if (!r.ok) {
      pushToast({ kind: 'warning', title: 'Nothing saved', body: r.error })
      return
    }
    setNotes('')
    pushToast({ kind: 'success', title: 'Handover note saved', body: 'The next shift sees it on this screen.' })
  }

  return (
    <Page>
      <PageHeader
        title="Ops console"
        sub="The whole operation on one screen — the pipeline, the sale that is running, and the work waiting on this desk."
        actions={
          <div className="flex items-center gap-2">
            {overdue.length > 0 && <Chip tone="danger" pulse>{num(overdue.length)} past SLA</Chip>}
            <Chip tone="success" pulse>On duty · 08:00–16:00 IST</Chip>
          </div>
        }
      />

      {/* --------------------------- is anything wrong? ---------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <Stat label="Pending inspection" value={num(pendingInspection)} sub="Lots awaiting a yard visit" to="/exec" />
        <Stat label="Awaiting decision" value={num(awaitingDecision)} tone="steel" sub="Inspected or sent back" to="/exec/approvals" />
        <Stat label="Live catalogues" value={num(liveCats.length)} tone="ember" sub={`${num(bidsLastHour)} bids in the last hour`} to="/auction/live" />
        <Stat label="EMD held" value={inrCompact(emdHeld)} tone="steel" sub="Customers' money, not ours" to="/sub/payments" />
        <Stat label="Open work items" value={num(mine.length)} sub={`${num(claimedByMe.length)} claimed by you`} to="/sub/queue" />
        <Stat label="Past SLA" value={num(overdue.length)} tone="danger" sub="Overdue on this desk" to="/sub/queue" />
      </div>

      {/* ------------------------------ live right now ------------------------ */}
      <section className="card overflow-hidden mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-line">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <Radio size={18} className="text-ember" /> Live right now
          </h2>
          <Link to="/auction/live" className="text-xs font-semibold text-ember hover:underline">Open the floor →</Link>
        </div>
        {liveCats.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-muted">
            Nothing is running. The next sale starts when a catalogue is scheduled and published —{' '}
            <Link to="/auction/schedule" className="font-semibold text-ember hover:underline">schedule &amp; publish</Link>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-ink-faint border-b border-line">
                  <th className="px-5 py-2.5 font-semibold">Catalogue</th>
                  <th className="px-3 py-2.5 font-semibold">Ends in</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Active lots</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Bids</th>
                  <th className="px-5 py-2.5 font-semibold text-right">State</th>
                </tr>
              </thead>
              <tbody>
                {liveCats.map((c) => {
                  const activeLots = lots.filter((l) => l.catalogueId === c.id && l.status === 'live').length
                  const catBids = bids.filter((b) => b.catalogueId === c.id && b.status === 'valid').length
                  return (
                    <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                      <td className="px-5 py-3">
                        <Link to={`/catalogue/${c.id}`} className="font-semibold text-ink hover:text-ember">
                          <span className="num text-xs font-bold text-ember mr-2">{c.code}</span>
                          {c.title}
                        </Link>
                        <div className="text-xs text-ink-faint mt-0.5">{c.region}</div>
                      </td>
                      <td className="px-3 py-3"><Countdown endsAt={c.endsAt} size="sm" /></td>
                      <td className="px-3 py-3 text-right num font-semibold">{num(activeLots)}</td>
                      <td className="px-3 py-3 text-right num font-semibold">{num(catBids)}</td>
                      <td className="px-5 py-3 text-right">
                        {paused[c.id]
                          ? <Chip tone="warning" pulse>Paused</Chip>
                          : <StatusChip status={catalogueUiStatus(c, now, lots.filter((l) => l.catalogueId === c.id))} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs text-ink-muted">
          Pause, resume and extend are on the live floor and this desk holds them. A <b>void</b> and a <b>cancellation</b>{' '}
          are the Super Admin's — flag them from the <Link to="/sub/bid-monitor" className="font-semibold text-ember hover:underline">bid monitor</Link> and they go across with the evidence.
        </div>
      </section>

      {/* ------------------------------- work lists --------------------------- */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <WorkList
          title="Your queue"
          icon={<ClipboardList size={18} className="text-ember" />}
          items={mine}
          to="/sub/queue"
          toLabel="Open the work queue"
          empty="Nothing on your desk. Nice shift."
        />
        <WorkList
          title="Sellers waiting on verification"
          icon={<ShieldCheck size={18} className="text-steel" />}
          items={verifications}
          to="/sub/seller-verification"
          toLabel="Open seller verification"
          empty="Every seller who has applied has been decided."
        />
        <WorkList
          title="Open disputes"
          icon={<Inbox size={18} className="text-danger" />}
          items={openDisputes}
          to="/sub/disputes"
          toLabel="Open the support desk"
          empty="No open tickets."
        />
        <WorkList
          title="Money moving through the platform"
          icon={<NotebookPen size={18} className="text-ink-muted" />}
          items={moneyItems}
          to="/sub/payments"
          toLabel="See EMD & payment activity"
          empty="Nothing in Finance's queue right now."
        />
        {flaggedBids.length > 0 && (
          <WorkList
            title="Flagged bids"
            icon={<Radio size={18} className="text-warning" />}
            items={flaggedBids}
            to="/sub/bid-monitor"
            toLabel="Open the bid monitor"
            empty="No bids flagged."
          />
        )}
        {resets.length > 0 && (
          <WorkList
            title="Password resets not yet used"
            icon={<ShieldCheck size={18} className="text-ink-muted" />}
            items={resets}
            to="/admin/users"
            toLabel="Open user accounts"
            empty="No open resets."
          />
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ------------------------ assignment: the field team ---------------- */}
        <section className="card overflow-hidden lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-line">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <UserPlus size={18} className="text-steel" /> Catalogues without a field executive
            </h2>
            <Link to="/sub/field-executives" className="text-xs font-semibold text-ember hover:underline">The whole team →</Link>
          </div>
          {unassigned.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">
              Every open catalogue has someone on it. Re-assign from{' '}
              <Link to="/sub/field-executives" className="font-semibold text-ember hover:underline">Field executives</Link>.
            </p>
          ) : (
            <ul>
              {/* The console shows the top of this and the field team screen
                  shows all of it — a dashboard that scrolls for a page of
                  dropdowns has stopped being a dashboard. */}
              {unassigned.slice(0, 6).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-line last:border-0">
                  <div className="flex-1 min-w-48">
                    <Link to={`/catalogue/${c.id}`} className="font-semibold text-sm hover:text-ember">
                      <span className="num text-xs font-bold text-ember mr-2">{c.code}</span>{c.title}
                    </Link>
                    <div className="text-xs text-ink-faint mt-0.5">
                      {c.region} · {num(lots.filter((l) => l.catalogueId === c.id).length)} lots to inspect
                    </div>
                  </div>
                  <Select
                    className="w-44"
                    value={assigning[c.id] ?? ''}
                    onChange={(e) => setAssigning((prev) => ({ ...prev, [c.id]: e.target.value }))}>
                    <option value="">Assign to…</option>
                    {fieldExecs.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </Select>
                  <Button size="sm" disabled={!assigning[c.id]} onClick={() => assign(c.id, c.code)}>Assign</Button>
                </li>
              ))}
            </ul>
          )}
          {(unassigned.length > 6 || readyToPublish.length > 0) && (
            <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs text-ink-muted">
              {unassigned.length > 6 && (
                <>
                  {num(unassigned.length - 6)} more waiting for someone —{' '}
                  <Link to="/sub/field-executives" className="font-semibold text-ember hover:underline">assign them by workload</Link>.{' '}
                </>
              )}
              {readyToPublish.length > 0 && (
                <>
                  {num(readyToPublish.length)} catalogue{readyToPublish.length === 1 ? '' : 's'} built and still private —{' '}
                  <Link to="/auction/schedule" className="font-semibold text-ember hover:underline">schedule and publish</Link>.
                  Nothing is public until someone presses Publish.
                </>
              )}
            </div>
          )}
        </section>

        {/* -------------------------------- my shift -------------------------- */}
        <section className="card p-5 space-y-4 self-start">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg">Shift handover</h2>
            <Chip tone="success" pulse>On duty</Chip>
          </div>
          <Field label="Leave a note" hint="Read by whoever comes on next, and by the Operation Manager.">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. AUC-2418 closing under 30 min — watch LOT-04 for rapid-fire bids; Kanchan Ispat expecting a call back…"
            />
          </Field>
          <Button className="w-full" onClick={saveHandover}>Save handover note</Button>

          {handoverNotes.length > 0 && (
            <ul className="space-y-3 pt-1">
              {handoverNotes.slice(0, 4).map((n) => {
                const by = users.find((u) => u.id === n.byId)
                return (
                  <li key={n.id} className="card bg-surface-2 p-3.5 text-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      {by && <Avatar name={by.name} hue={by.avatarHue} size={22} />}
                      <span className="text-xs font-semibold">{by?.name ?? 'Sub Admin'}</span>
                      <span className="text-xs text-ink-faint">{relTime(n.at, now)}</span>
                    </div>
                    <p className="text-ink-muted leading-relaxed">{n.body}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* ----------------------------- what everyone did ---------------------- */}
      <section className="card overflow-hidden mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-line">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <ScrollText size={18} className="text-steel" /> What the operation just did
          </h2>
          <div className="flex items-center gap-2">
            {unreviewed.length > 0 && <Chip tone="warning" className="num">{num(unreviewed.length)} unreviewed</Chip>}
            <Link to="/sub/approvals" className="text-xs font-semibold text-ember hover:underline">Review it →</Link>
          </div>
        </div>
        <ul>
          {recentAudit.map((e) => {
            const actor = users.find((u) => u.id === e.actorId)
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 border-b border-line last:border-0">
                <Chip tone={SEVERITY_TONE[e.severity]}>{e.severity}</Chip>
                <span className="num text-xs text-ink-faint w-24">{e.action}</span>
                <span className="text-sm flex-1 min-w-48">
                  <span className="font-semibold">{e.target}</span>
                  <span className="text-ink-muted"> — {e.detail}</span>
                </span>
                <span className="text-xs text-ink-faint whitespace-nowrap">
                  {actor?.name ?? 'System'} · {relTime(e.at, now)}
                </span>
              </li>
            )
          })}
        </ul>
        <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs text-ink-muted">
          The operational roles act first and their action takes effect immediately. Reviewing it is supervisory, after the fact —{' '}
          <Link to="/sub/approvals" className="font-semibold text-ember hover:underline">Approvals — all roles</Link>.
        </div>
      </section>
    </Page>
  )
}
