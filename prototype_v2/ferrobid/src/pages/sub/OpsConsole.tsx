/* Sub-admin ops console — shift overview: live auctions, work items, audit feed. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Radio, ScrollText, PhoneCall } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, Countdown, Field, LockChip, PageHeader, Stat, StatusChip, Textarea } from '../../components/ui'
import { useStore, catalogueUiStatus } from '../../store/store'
import { num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
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
  const disputes = useStore((s) => s.disputes)
  const auditEvents = useStore((s) => s.auditEvents)
  const paused = useStore((s) => s.paused)
  const pushToast = useStore((s) => s.pushToast)

  const [notes, setNotes] = useState('')

  const liveCats = catalogues.filter((c) => c.status === 'live')
  const bidsLastHour = bids.filter((b) => b.status === 'valid' && now - Date.parse(b.at) <= 3_600_000).length
  const flaggedLots = lots.filter((l) => l.status === 'flagged')
  const pendingKyc = users.filter((u) => u.kycStatus === 'pending')
  const openDisputes = disputes.filter((d) => d.status === 'open')
  const openWorkItems = flaggedLots.length + pendingKyc.length + openDisputes.length
  const slaBreaches = flaggedLots.length // flagged lots have blown their 4h review SLA

  const escalation = users.find((u) => u.id === 'u-exec-1')
  const recentAudit = auditEvents.slice(0, 8)

  const saveHandover = () => {
    pushToast({ kind: 'success', title: 'Handover notes saved', body: 'Next shift will see these on sign-in.' })
  }

  return (
    <Page>
      <PageHeader
        title="Ops console"
        sub="Your shift at a glance — live auctions, open work and the audit trail. Scoped access: monitoring and triage only."
        actions={<Chip tone="success" pulse>On duty · 08:00–16:00 IST</Chip>}
      />

      {/* ----------------------------- stat row ----------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Live catalogues" value={num(liveCats.length)} tone="ember" sub="Running right now" />
        <Stat label="Bids in last hour" value={num(bidsLastHour)} tone="steel" sub="Valid bids, all live lots" />
        <Stat label="Open work items" value={num(openWorkItems)} sub={`${flaggedLots.length} flagged · ${pendingKyc.length} KYC · ${openDisputes.length} disputes`} />
        <Stat label="SLA breaches" value={num(slaBreaches)} tone="danger" sub="Work items past due" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* --------------------------- live right now ------------------------ */}
        <section className="lg:col-span-2 card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-line">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <Radio size={18} className="text-ember" /> Live right now
            </h2>
            <LockChip label="Control Tower access required" />
          </div>
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
                          <span className="num text-xs text-ink-faint mr-2">{c.code}</span>
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
          <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs text-ink-muted">
            View-only feed. Pause, extend and cancel controls live in the Control Tower — Super Admin only.
          </div>
        </section>

        {/* ------------------------------ my shift --------------------------- */}
        <section className="card p-5 space-y-4 self-start">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg">My shift</h2>
            <Chip tone="success" pulse>On duty</Chip>
          </div>
          <div className="card bg-surface-2 p-3.5 flex items-start gap-3">
            <PhoneCall size={16} className="text-steel mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-semibold">Escalation contact</div>
              <div className="text-ink-muted">{escalation?.name ?? 'Exec Manager'} · Executive Manager</div>
              <div className="num text-xs text-ink-faint mt-0.5">{escalation?.phone ?? '+91 98xxx xxxxx'}</div>
            </div>
          </div>
          <Field label="Handover notes" hint="Visible to the next shift and the Exec Manager.">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. AUC-2418 closing under 30 min — watch LOT-04 for rapid-fire bids; 1 flagged lot pending exec review…"
            />
          </Field>
          <Button className="w-full" onClick={saveHandover}>Save handover notes</Button>
        </section>
      </div>

      {/* ---------------------------- audit feed ----------------------------- */}
      <section className="card overflow-hidden mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-line">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <ScrollText size={18} className="text-steel" /> Recent audit events
          </h2>
          <LockChip label="Read-only" />
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
      </section>
    </Page>
  )
}
