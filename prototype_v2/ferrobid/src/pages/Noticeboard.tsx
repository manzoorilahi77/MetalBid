/* Noticeboard — platform & catalogue announcements, editorial list. */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Megaphone, AlertTriangle, OctagonAlert, Info, ArrowUpRight } from 'lucide-react'
import { Page } from '../layout/Chrome'
import { Chip, EmptyState, PageHeader, Segmented, cx } from '../components/ui'
import { useStore } from '../store/store'
import { relTime, fmtDateTime } from '../lib/format'
import { useNow } from '../lib/useTick'
import type { Announcement } from '../types'

type Filter = 'all' | 'platform' | 'catalogue'

function SeverityChip({ severity }: { severity: Announcement['severity'] }) {
  switch (severity) {
    case 'critical':
      return <Chip tone="danger"><OctagonAlert size={11} /> Critical</Chip>
    case 'warning':
      return <Chip tone="warning"><AlertTriangle size={11} /> Warning</Chip>
    default:
      return <Chip tone="steel"><Info size={11} /> Info</Chip>
  }
}

export default function Noticeboard() {
  const now = useNow()
  const announcements = useStore((s) => s.announcements)
  const catalogues = useStore((s) => s.catalogues)
  const [filter, setFilter] = useState<Filter>('all')

  const visible = useMemo(() => {
    const list = filter === 'all' ? announcements : announcements.filter((a) => a.scope === filter)
    return [...list].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  }, [announcements, filter])

  const counts = useMemo(() => ({
    all: announcements.length,
    platform: announcements.filter((a) => a.scope === 'platform').length,
    catalogue: announcements.filter((a) => a.scope === 'catalogue').length,
  }), [announcements])

  return (
    <Page className="max-w-4xl">
      <PageHeader
        title="Noticeboard"
        sub="Official announcements from the ferroBid auction desk — corrigenda, schedule changes and platform notices. Catalogue-specific notices are also shown on their catalogue page."
        actions={
          <Segmented<Filter>
            options={[
              { key: 'all', label: `All (${counts.all})` },
              { key: 'platform', label: `Platform (${counts.platform})` },
              { key: 'catalogue', label: `Catalogue (${counts.catalogue})` },
            ]}
            value={filter}
            onChange={setFilter}
          />
        }
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={32} strokeWidth={1.5} />}
          title="No announcements here"
          body="Nothing published under this filter yet — check back before auction days."
        />
      ) : (
        <ol className="space-y-4">
          {visible.map((a, i) => {
            const cat = a.scope === 'catalogue' ? catalogues.find((c) => c.id === a.catalogueId) : undefined
            return (
              <li key={a.id}
                className={cx('card p-5 animate-fade-up border-l-4',
                  { critical: 'border-l-danger', warning: 'border-l-warning', info: 'border-l-steel' }[a.severity])}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityChip severity={a.severity} />
                  {a.scope === 'platform'
                    ? <Chip tone="neutral">Platform</Chip>
                    : cat && (
                      <Link to={`/catalogue/${cat.id}`}
                        className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full border border-ember/25 bg-ember-soft text-ember-strong text-xs font-semibold num hover:bg-ember-soft/70">
                        {cat.code} <ArrowUpRight size={11} />
                      </Link>
                    )}
                  <span className="ml-auto text-xs text-ink-faint num" title={fmtDateTime(a.at)}>{relTime(a.at, now)}</span>
                </div>
                <h2 className="font-display font-bold text-lg mt-2.5 leading-snug">{a.title}</h2>
                <p className="text-sm text-ink-muted mt-1.5 leading-relaxed max-w-2xl">{a.body}</p>
                {cat && (
                  <div className="text-xs text-ink-faint mt-2">
                    Applies to <span className="font-semibold text-ink-muted">{cat.title}</span>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <p className="text-xs text-ink-faint mt-8 text-center">
        Announcements are binding as auction corrigenda. For lot-level queries, raise a dispute from Help &amp; disputes.
      </p>
    </Page>
  )
}
