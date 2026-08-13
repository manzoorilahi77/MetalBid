/* ---------------------------------------------------------------------------
   Super Admin — Audit trail.

   Every recorded action, newest first, searchable by severity, action, actor
   and text. The export used to be a toast; it now writes the filtered rows to a
   real CSV, because an audit log you cannot take out of the product is not
   evidence — it is a screen.

   Nothing on this page can be edited or removed by anyone, including us. That
   is the point of it: rolling back a role or a menu is a click away in Change
   history, and none of it touches a line of this.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Search } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, Input, PageHeader, Segmented, Select, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDateTime } from '../../lib/format'
import type { AuditEvent, User } from '../../types'

type Sev = 'all' | 'info' | 'warning' | 'critical'
const sevDot: Record<string, string> = { info: 'bg-steel', warning: 'bg-warning', critical: 'bg-danger' }
const sevTone = { info: 'steel', warning: 'warning', critical: 'danger' } as const

/** RFC-4180 quoting: a detail line containing a comma, a quote or a newline
 *  would otherwise shift every column after it in the exported file. */
const csvCell = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`

function exportCsv(rows: AuditEvent[], users: User[]) {
  const header = ['Timestamp (ISO)', 'Severity', 'Action', 'Target', 'Actor', 'Actor ID', 'Detail']
  const body = rows.map((e) => {
    const u = users.find((x) => x.id === e.actorId)
    return [e.at, e.severity, e.action, e.target, u ? `${u.name} · ${u.firm}` : e.actorId, e.actorId, e.detail].map(csvCell).join(',')
  })
  const csv = [header.map(csvCell).join(','), ...body].join('\r\n')
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `ferrobid_audit_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function Audit() {
  const auditEvents = useStore((s) => s.auditEvents)
  const users = useStore((s) => s.users)
  const pushToast = useStore((s) => s.pushToast)
  /* "View activity" on an account has to land on that person's actions, not on
     everyone's with their name still to be found in a dropdown. The filter is
     held in the URL so the link is shareable and the back button works. */
  const [params, setParams] = useSearchParams()

  const [sev, setSev] = useState<Sev>('all')
  const [prefix, setPrefix] = useState('all')
  const actor = params.get('actor') ?? 'all'
  const setActor = (v: string) => setParams(v === 'all' ? {} : { actor: v }, { replace: true })
  const [q, setQ] = useState('')

  const prefixes = useMemo(() => [...new Set(auditEvents.map((e) => e.action.split('.')[0]))].sort(), [auditEvents])
  const actors = useMemo(() => [...new Set(auditEvents.map((e) => e.actorId))], [auditEvents])

  const list = auditEvents.filter((e) => {
    if (sev !== 'all' && e.severity !== sev) return false
    if (prefix !== 'all' && !e.action.startsWith(prefix + '.')) return false
    if (actor !== 'all' && e.actorId !== actor) return false
    if (q && !`${e.action} ${e.target} ${e.detail}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  const counts = {
    info: auditEvents.filter((e) => e.severity === 'info').length,
    warning: auditEvents.filter((e) => e.severity === 'warning').length,
    critical: auditEvents.filter((e) => e.severity === 'critical').length,
  }

  return (
    <Page>
      <PageHeader title="Audit trail" sub="Every admin, ops and engine action — newest first. Live actions from this session appear at the top instantly. Nobody, including a Super Admin, can edit or remove a line of it."
        actions={
          <Button variant="secondary" disabled={list.length === 0}
            onClick={() => {
              exportCsv(list, users)
              pushToast({ kind: 'success', title: 'Audit log exported', body: `${list.length} event${list.length === 1 ? '' : 's'} — exactly what the filters above are showing.` })
            }}>
            <Download size={14} /> Export {list.length === auditEvents.length ? 'all' : `these ${list.length}`} as CSV
          </Button>
        } />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Segmented<Sev> value={sev} onChange={setSev} options={[
          { key: 'all', label: `All ${auditEvents.length}` },
          { key: 'info', label: `Info ${counts.info}` },
          { key: 'warning', label: `Warning ${counts.warning}` },
          { key: 'critical', label: `Critical ${counts.critical}` },
        ]} />
        <Select className="h-9 w-40 text-[13px]" value={prefix} onChange={(e) => setPrefix(e.target.value)}>
          <option value="all">Action: all</option>
          {prefixes.map((p) => <option key={p} value={p}>{p}.*</option>)}
        </Select>
        <Select className="h-9 w-48 text-[13px]" value={actor} onChange={(e) => setActor(e.target.value)}>
          <option value="all">Actor: all</option>
          {actors.map((a) => <option key={a} value={a}>{users.find((u) => u.id === a)?.name ?? a}</option>)}
        </Select>
        {actor !== 'all' && (
          <button onClick={() => setActor('all')} className="text-[13px] font-semibold text-ember hover:underline">
            Showing only {users.find((u) => u.id === actor)?.name ?? actor} — show everyone
          </button>
        )}
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input className="h-9 w-56 pl-8 text-[13px]" placeholder="Search detail…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {list.length === 0 && <EmptyState title="No events match" />}
      <ol className="relative border-l-2 border-line ml-2 space-y-0">
        {list.map((e) => {
          const u = users.find((x) => x.id === e.actorId)
          return (
            <li key={e.id} className="relative pl-6 pb-6 last:pb-0">
              <span className={cx('absolute -left-[7px] top-1.5 size-3 rounded-full ring-4 ring-canvas', sevDot[e.severity])} />
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="neutral" className="num">{e.action}</Chip>
                <span className="num text-sm font-bold">{e.target}</span>
                <Chip tone={sevTone[e.severity]}>{e.severity}</Chip>
                <span className="num text-xs text-ink-faint ml-auto">{fmtDateTime(e.at)}</span>
              </div>
              <p className="text-sm text-ink-muted mt-1">{e.detail}</p>
              <p className="text-xs text-ink-faint mt-0.5">
                by <span className="font-semibold text-ink-muted">{u ? `${u.name} · ${u.firm}` : e.actorId}</span>
              </p>
            </li>
          )
        })}
      </ol>

      <div className="card border-l-4 border-l-steel p-4 mt-8 text-[13px] text-ink-muted">
        <strong className="text-ink">This is the record; Change history is the undo.</strong> Structural changes — roles, menus,
        accounts, content, master data — appear in both: here as evidence that cannot be altered, and in{' '}
        <Link to="/admin/change-history" className="text-ember font-semibold hover:underline">Change history</Link> with the snapshot
        that reverses them. Rolling a change back writes another line here rather than erasing the first.
      </div>
    </Page>
  )
}
