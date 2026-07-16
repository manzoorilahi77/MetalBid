/* Super Admin — audit trail. */
import { useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, Input, PageHeader, Segmented, Select, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDateTime } from '../../lib/format'

type Sev = 'all' | 'info' | 'warning' | 'critical'
const sevDot: Record<string, string> = { info: 'bg-steel', warning: 'bg-warning', critical: 'bg-danger' }
const sevTone = { info: 'steel', warning: 'warning', critical: 'danger' } as const

export default function Audit() {
  const auditEvents = useStore((s) => s.auditEvents)
  const users = useStore((s) => s.users)
  const pushToast = useStore((s) => s.pushToast)

  const [sev, setSev] = useState<Sev>('all')
  const [prefix, setPrefix] = useState('all')
  const [actor, setActor] = useState('all')
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
      <PageHeader title="Audit trail" sub="Every admin, ops and engine action — newest first. Live actions from this session appear at the top instantly."
        actions={<Button variant="secondary" onClick={() => pushToast({ kind: 'info', title: 'Exporting audit log', body: 'audit_trail.csv (demo)' })}><Download size={14} /> Export CSV</Button>} />

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
    </Page>
  )
}
