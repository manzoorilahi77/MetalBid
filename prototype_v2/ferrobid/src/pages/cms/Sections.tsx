/* ---------------------------------------------------------------------------
   CMS — Portal sections.

   The enable/disable screen, and the reason the section registry exists. Pick a
   surface, see every section on it, switch off the ones this company does not
   want. Not just the home page: every page of every portal.

   Two things this screen is careful about, because both were decisions:

   * A section that cannot be switched off shows a **locked** chip with the
     reason beside it, not a missing control. A switch that is simply absent
     reads as a bug; a switch that is absent and explains itself reads as a
     rule.

   * A refusal is shown verbatim from the server. When a section holds
     unpublished words, the API says so and says what to do about it — that
     sentence is more useful than anything this screen could invent.
--------------------------------------------------------------------------- */
import { useEffect, useMemo, useState } from 'react'
import { Lock, RefreshCw } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Chip, EmptyState, PageHeader, Select, Toggle, cx } from '../../components/ui'
import { useStore } from '../../store/store'
import { listSections, setSectionEnabled, cmsErrorMessage } from '../../api/cmsAdmin'
import type { AdminSection } from '../../api/cmsAdmin'

/** How each source class reads on screen. Same five classes as the Atlas. */
/* `warning` stands in for the Atlas's gold: Chip has no gold tone, and adding
   one would change the shared component for every screen that uses it. */
const SOURCE: Record<AdminSection['source'], { label: string; tone: 'ember' | 'steel' | 'warning' | 'success' | 'neutral' }> = {
  cms:    { label: 'CMS',     tone: 'ember' },
  portal: { label: 'Portal',  tone: 'steel' },
  api:    { label: 'API',     tone: 'warning' },
  live:   { label: 'Live',    tone: 'success' },
  own:    { label: 'Product', tone: 'neutral' },
}

export default function CmsSections() {
  const pushToast = useStore((s) => s.pushToast)
  const [sections, setSections] = useState<AdminSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [route, setRoute] = useState<string>('all')
  const [busy, setBusy] = useState<string | null>(null)

  const reload = () => {
    setLoading(true)
    listSections()
      .then((rows) => { setSections(rows); setError(null) })
      .catch((err) => setError(cmsErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(reload, [])

  const routes = useMemo(
    () => [...new Set(sections.map((s) => s.route))].sort(),
    [sections])

  const shown = route === 'all' ? sections : sections.filter((s) => s.route === route)
  const off = sections.filter((s) => !s.enabled).length

  const toggle = async (section: AdminSection, next: boolean) => {
    const id = `${section.route}|${section.key}|${section.role}`
    setBusy(id)
    /* Optimistic, then corrected: the switch has to feel immediate, and a
       refusal puts it straight back where it was. */
    setSections((rows) => rows.map((r) => (keyOf(r) === id ? { ...r, enabled: next } : r)))
    try {
      await setSectionEnabled(section, next)
      pushToast({
        kind: 'success',
        title: next ? 'Section switched on' : 'Section switched off',
        body: `${section.title} — ${section.route}`,
      })
    } catch (err) {
      setSections((rows) => rows.map((r) => (keyOf(r) === id ? { ...r, enabled: !next } : r)))
      pushToast({ kind: 'danger', title: 'Not changed', body: cmsErrorMessage(err) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Page>
      <PageHeader
        crumbs={[{ label: 'Content', to: '/cms' }]}
        title="Portal sections"
        sub="Every section on every page, and whether it is switched on. Sections that carry another role's record stay visible; sections that carry ours can be turned off without a release."
        actions={
          <button onClick={reload} className="text-sm font-semibold text-steel hover:underline inline-flex items-center gap-1.5">
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Select value={route} onChange={(e) => setRoute(e.target.value)} className="w-72">
          <option value="all">Every surface ({sections.length} sections)</option>
          {routes.map((r) => (
            <option key={r} value={r}>{r} ({sections.filter((s) => s.route === r).length})</option>
          ))}
        </Select>
        {off > 0 && <Chip tone="warning">{off} switched off</Chip>}
      </div>

      {error && (
        <div className="card p-3 mb-4 text-sm text-danger border-danger/40 bg-danger-soft/30">{error}</div>
      )}

      {loading && <div className="card p-8 text-sm text-ink-muted">Loading sections…</div>}

      {!loading && shown.length === 0 && (
        <EmptyState
          title="No sections registered"
          body="Run npm run db:seed-cms on the server to load the inventory."
        />
      )}

      {!loading && shown.length > 0 && (
        <div className="card divide-y divide-line overflow-hidden">
          {shown.map((section) => {
            const id = keyOf(section)
            const source = SOURCE[section.source]
            return (
              <div key={id} className="p-4 flex flex-wrap items-start gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cx('font-semibold', !section.enabled && 'text-ink-muted')}>
                      {section.title}
                    </span>
                    <Chip tone={source.tone}>{source.label}</Chip>
                    {section.role !== '*' && <Chip tone="steel">{section.role}</Chip>}
                    {section.reviewRequired && <Chip tone="warning">needs a second reader</Chip>}
                  </div>
                  {section.description && (
                    <p className="text-[13px] text-ink-muted mt-1">{section.description}</p>
                  )}
                  <p className="num text-[11px] text-ink-faint mt-1">
                    {section.route} · {section.key}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-3">
                  {section.toggleable ? (
                    <Toggle
                      checked={section.enabled}
                      onChange={(next) => { if (!busy) void toggle(section, next) }}
                      label={section.enabled ? 'On' : 'Off'}
                    />
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 text-[12px] text-ink-faint max-w-72 text-right"
                      title={section.lockedReason ?? undefined}
                    >
                      <Lock size={12} className="shrink-0" />
                      <span>{section.lockedReason}</span>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-ink-faint mt-5 max-w-2xl">
        Switching a section off stops it being rendered <em>and</em> stops its data being fetched.
        Every change here is recorded with who made it and when, and can be read back on the CMS overview.
      </p>
    </Page>
  )
}

const keyOf = (s: AdminSection) => `${s.route}|${s.key}|${s.role}`
