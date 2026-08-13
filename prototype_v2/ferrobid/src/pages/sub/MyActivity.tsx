/* ---------------------------------------------------------------------------
   Sub Admin — My activity.

   Everything this account has done, in time order. A page a role must keep: the
   Page manager may rename it or move it, and may not hide or detach it.

   It exists because of what the role can do. A Sub Admin approves lots,
   publishes auctions, verifies sellers, resolves disputes and resets other
   people's passwords — powers that are only safe if the person holding them can
   see their own trail as plainly as anyone reviewing it can. The full platform
   audit belongs to the Super Admin; this is the same record, scoped to you.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, History, Search } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, EmptyState, Field, Input, PageHeader, Segmented, Select, Stat,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDateTime, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { AuditEvent } from '../../types'

type Scope = 'me' | 'desk'

const SEVERITY_TONE: Record<AuditEvent['severity'], 'neutral' | 'warning' | 'danger'> = {
  info: 'neutral', warning: 'warning', critical: 'danger',
}

/** The action prefixes this desk touches, grouped the way the menu is — so the
 *  filter reads as "which part of my job" rather than as a list of event keys. */
const AREAS: { key: string; label: string; match: (a: string) => boolean }[] = [
  { key: 'all', label: 'Everything', match: () => true },
  { key: 'pipeline', label: 'Pipeline', match: (a) => a.startsWith('lot.') || a.startsWith('inspection.') || a.startsWith('catalogue.') },
  { key: 'auction', label: 'Auction', match: (a) => a.startsWith('auction.') || a.startsWith('bid.') || a.startsWith('emd_exemption.') || a.startsWith('announcement.') },
  { key: 'sellers', label: 'Sellers & support', match: (a) => a.startsWith('kyc.') || a.startsWith('dispute.') },
  { key: 'accounts', label: 'Accounts', match: (a) => a.startsWith('account.') || a.startsWith('user.') },
  { key: 'review', label: 'Reviews', match: (a) => a.startsWith('review.') || a.startsWith('finance.recommend') },
  { key: 'content', label: 'Content & shift', match: (a) => a.startsWith('content.') || a.startsWith('shift.') },
]

export default function MyActivity() {
  const now = useNow()
  const auditEvents = useStore((s) => s.auditEvents)
  const users = useStore((s) => s.users)
  const me = useStore((s) => s.currentUser)
  const pushToast = useStore((s) => s.pushToast)

  const [scope, setScope] = useState<Scope>('me')
  const [area, setArea] = useState('all')
  const [q, setQ] = useState('')

  const subAdminIds = new Set(users.filter((u) => u.role === 'sub_admin').map((u) => u.id))
  const matcher = AREAS.find((a) => a.key === area) ?? AREAS[0]

  const rows = auditEvents
    .filter((e) => (scope === 'me' ? e.actorId === me?.id : subAdminIds.has(e.actorId)))
    .filter((e) => matcher.match(e.action))
    .filter((e) => !q || `${e.action} ${e.target} ${e.detail}`.toLowerCase().includes(q.toLowerCase()))

  const mine = auditEvents.filter((e) => e.actorId === me?.id)
  const today = mine.filter((e) => now - Date.parse(e.at) < 24 * 3_600_000)
  const critical = mine.filter((e) => e.severity === 'critical')

  return (
    <Page>
      <PageHeader
        title="My activity"
        sub="Everything you have done, in time order. The same record anyone reviewing your work reads — which is the point of being able to read it yourself."
        actions={
          <Button
            variant="secondary"
            onClick={() => pushToast({
              kind: 'info',
              title: 'Activity export prepared',
              body: `${num(rows.length)} entries — in the prototype this is where the CSV downloads.`,
            })}>
            <Download size={15} /> Export
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Your entries" value={num(mine.length)} sub="All time" />
        <Stat label="In the last day" value={num(today.length)} tone="steel" sub="This shift and the one before" />
        <Stat label="At critical severity" value={num(critical.length)} tone={critical.length ? 'warning' : undefined} sub="Password resets and the like" />
        <Stat label="Across the desk" value={num(auditEvents.filter((e) => subAdminIds.has(e.actorId)).length)} sub="Every Sub Admin" />
      </div>

      <div className="card p-4 mb-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <Segmented<Scope>
          options={[{ key: 'me', label: 'Just me' }, { key: 'desk', label: 'The whole desk' }]}
          value={scope}
          onChange={setScope}
        />
        <Field label="Area" className="w-52">
          <Select value={area} onChange={(e) => setArea(e.target.value)}>
            {AREAS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </Select>
        </Field>
        <Field label="Search" className="flex-1 min-w-52">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lot number, firm, catalogue code…" />
        </Field>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Search size={26} />}
          title="Nothing on the record for this view"
          body={scope === 'me' && area === 'all' && !q
            ? 'Anything you approve, publish, verify, resolve or reset appears here the moment you do it.'
            : 'Widen the area filter or clear the search.'}
        />
      ) : (
        <div className="card overflow-hidden">
          <ul>
            {rows.map((e) => {
              const actor = users.find((u) => u.id === e.actorId)
              return (
                <li key={e.id} className="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-4 sm:px-5 py-3.5 border-b border-line last:border-0">
                  <span className="mt-0.5"><Chip tone={SEVERITY_TONE[e.severity]}>{e.severity}</Chip></span>
                  <span className="num text-xs text-ink-faint w-32 mt-1">{e.action}</span>
                  <div className="flex-1 min-w-52">
                    <div className="text-sm font-semibold">{e.target}</div>
                    <div className="text-sm text-ink-muted mt-0.5">{e.detail}</div>
                  </div>
                  <div className="text-right">
                    {scope === 'desk' && actor && (
                      <div className="flex items-center justify-end gap-1.5 mb-0.5">
                        <Avatar name={actor.name} hue={actor.avatarHue} size={20} />
                        <span className="text-xs font-semibold">{actor.name}</span>
                      </div>
                    )}
                    <div className="text-xs text-ink-faint whitespace-nowrap" title={fmtDateTime(e.at)}>
                      {relTime(e.at, now)}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs text-ink-muted flex flex-wrap items-center gap-2">
            <History size={13} />
            {num(rows.length)} entr{rows.length === 1 ? 'y' : 'ies'}. Nothing here can be edited or removed — the
            platform-wide trail is the Super Admin's{' '}
            <Link to="/admin/audit" className="font-semibold text-ember hover:underline">audit trail</Link>.
          </div>
        </div>
      )}
    </Page>
  )
}
