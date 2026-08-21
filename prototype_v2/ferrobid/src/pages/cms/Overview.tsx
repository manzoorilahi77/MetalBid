/* ---------------------------------------------------------------------------
   CMS — Overview.

   Where the CMS opens: what is unpublished, what is waiting on the CEO, what
   has been switched off, and what changed recently. Four questions an editor
   arrives with, answered before they pick a page.

   The change log is the interesting one. Every publish, every toggle and every
   rollback lands in `content_change_log` with the actor and the before/after,
   so "who turned that off" is answerable — which is the difference between a
   switch an operator trusts and one they are afraid of.
--------------------------------------------------------------------------- */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, EyeOff, FileText, History, MessageSquareQuote, X } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, PageHeader, Stat } from '../../components/ui'
import { useStore } from '../../store/store'
import { relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { listBlocks, listChanges, listSections, cmsErrorMessage } from '../../api/cmsAdmin'
import type { AdminBlock, AdminSection, ChangeEntry } from '../../api/cmsAdmin'
import { CMS_PAGE_KEYS } from './Blocks'

export default function CmsOverview() {
  const now = useNow()
  const [sections, setSections] = useState<AdminSection[]>([])
  const [blocks, setBlocks] = useState<AdminBlock[]>([])
  const [changes, setChanges] = useState<ChangeEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  /* Testimonials moderation lives in the store, not the CMS block API — a
     testimonial is a customer's own submission, not an editor's draft, so it
     goes through the same /api/mutate path as the rest of the app rather than
     through cms.mjs. It belongs on this screen anyway: it is exactly the
     "written by someone else, not public until approved" queue the CMS
     Overview already answers for CEO-pending copy. */
  const testimonials = useStore((s) => s.testimonials)
  const users = useStore((s) => s.users)
  const moderateTestimonial = useStore((s) => s.moderateTestimonial)
  const pushToast = useStore((s) => s.pushToast)
  const pendingTestimonials = testimonials.filter((t) => t.status === 'pending')
  const [moderating, setModerating] = useState<string | null>(null)

  const decide = (id: string, approve: boolean) => {
    setModerating(id)
    const result = moderateTestimonial(id, approve)
    setModerating(null)
    pushToast(result.ok
      ? { kind: 'success', title: approve ? 'Testimonial approved' : 'Testimonial declined',
          body: approve ? 'It is now live on the Home page.' : 'It stays on record, but will not be shown.' }
      : { kind: 'danger', title: 'Not changed', body: result.error })
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([listSections(), listBlocks(), listChanges(40)])
      .then(([s, b, c]) => {
        if (cancelled) return
        setSections(s); setBlocks(b); setChanges(c); setError(null)
      })
      .catch((err) => { if (!cancelled) setError(cmsErrorMessage(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const unpublished = blocks.filter((b) => b.status === 'draft' || b.status === 'in_review')
  const awaitingCeo = blocks.filter((b) => b.status === 'ceo_pending')
  const switchedOff = sections.filter((s) => !s.enabled)

  return (
    <Page>
      <PageHeader
        title="Content"
        sub="The words on the public site and the sections inside every portal. You write them, you publish them — only pricing and legal copy leaves for a signature."
      />

      {error && (
        <div className="card p-3 mb-4 text-sm text-danger border-danger/40 bg-danger-soft/30">{error}</div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <Stat label="Live blocks" value={String(blocks.filter((b) => b.status === 'published').length)}
              sub="published on the site" />
        <Stat label="Unpublished" value={String(unpublished.length)}
              tone={unpublished.length ? 'ember' : undefined} sub="drafts not yet public" />
        <Stat label="Awaiting signature" value={String(awaitingCeo.length)}
              tone={awaitingCeo.length ? 'warning' : undefined} sub="with the CEO" />
        <Stat label="Sections off" value={String(switchedOff.length)}
              sub={`of ${sections.length} registered`} to="/cms/sections" />
        <Stat label="Testimonials waiting" value={String(pendingTestimonials.length)}
              tone={pendingTestimonials.length ? 'ember' : undefined} sub="submitted, not yet reviewed" />
      </div>

      {/* ------------------------- testimonials ----------------------------- */}
      {pendingTestimonials.length > 0 && (
        <>
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-faint mb-3">
            Testimonials awaiting review
          </h2>
          <div className="card divide-y divide-line overflow-hidden mb-8">
            {pendingTestimonials.map((t) => {
              const author = users.find((u) => u.id === t.userId)
              return (
                <div key={t.id} className="p-4 flex flex-wrap items-start gap-3">
                  <MessageSquareQuote size={16} className="text-ink-faint shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed">{t.quote}</p>
                    <p className="text-[12px] text-ink-faint mt-1">
                      {author?.name ?? t.userId} · {author?.firm ?? t.role} · {relTime(t.submittedAt, now)}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <Button size="sm" variant="secondary" disabled={moderating === t.id}
                      onClick={() => decide(t.id, false)}>
                      <X size={14} /> Decline
                    </Button>
                    <Button size="sm" disabled={moderating === t.id} loading={moderating === t.id}
                      onClick={() => decide(t.id, true)}>
                      <Check size={14} /> Approve
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ------------------------------ pages ------------------------------ */}
      <h2 className="text-sm font-bold uppercase tracking-wider text-ink-faint mb-3">Pages</h2>
      <div className="card divide-y divide-line overflow-hidden mb-8">
        {CMS_PAGE_KEYS.map((page) => {
          const own = blocks.filter((b) => b.pageKey === page.key)
          const pending = own.filter((b) => b.status !== 'published').length
          return (
            <Link key={page.key} to={`/cms/page/${page.key}`}
                  className="flex items-center gap-3 p-4 hover:bg-surface-2 group">
              <FileText size={16} className="text-ink-faint shrink-0" />
              <span className="font-semibold flex-1 min-w-0">{page.label}</span>
              {own.length === 0
                ? <span className="text-[12px] text-ink-faint">not written yet</span>
                : <span className="num text-[12px] text-ink-muted">{own.length} blocks</span>}
              {pending > 0 && <Chip tone="ember">{pending} unpublished</Chip>}
              <ArrowRight size={15} className="text-ink-faint group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )
        })}
      </div>

      {/* --------------------------- switched off -------------------------- */}
      {switchedOff.length > 0 && (
        <>
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-faint mb-3">
            Currently switched off
          </h2>
          <div className="card divide-y divide-line overflow-hidden mb-8">
            {switchedOff.slice(0, 12).map((s) => (
              <div key={`${s.route}|${s.key}|${s.role}`} className="flex items-center gap-3 p-3.5">
                <EyeOff size={15} className="text-ink-faint shrink-0" />
                <span className="font-medium text-[14px] flex-1 min-w-0">{s.title}</span>
                <span className="num text-[11px] text-ink-faint">{s.route}</span>
              </div>
            ))}
            {switchedOff.length > 12 && (
              <Link to="/cms/sections" className="block p-3 text-center text-sm font-semibold text-steel hover:underline">
                See all {switchedOff.length}
              </Link>
            )}
          </div>
        </>
      )}

      {/* ---------------------------- change log --------------------------- */}
      <h2 className="text-sm font-bold uppercase tracking-wider text-ink-faint mb-3">Recent changes</h2>
      {loading && <div className="card p-8 text-sm text-ink-muted">Loading…</div>}
      {!loading && changes.length === 0 && (
        <EmptyState
          icon={<History size={30} strokeWidth={1.5} />}
          title="Nothing has been changed yet"
          body="Every publish, toggle and rollback is recorded here with who made it."
        />
      )}
      {!loading && changes.length > 0 && (
        <div className="card divide-y divide-line overflow-hidden">
          {changes.map((c) => (
            <div key={c.id} className="p-3.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Chip tone={c.action === 'toggle' ? 'steel' : c.action === 'rollback' ? 'warning' : 'success'}>
                {c.action}
              </Chip>
              <span className="num text-[12px] text-ink-muted flex-1 min-w-0 truncate">{c.targetId}</span>
              <span className="text-[12px] text-ink-faint">
                {c.actorRole ?? 'system'} · {relTime(c.at, now)}
              </span>
              {c.reason && <span className="text-[12px] text-ink-muted basis-full">“{c.reason}”</span>}
            </div>
          ))}
        </div>
      )}
    </Page>
  )
}
