/* ---------------------------------------------------------------------------
   The CMS-driven public pages.

   Pricing, About, Contact, Blog, Knowledge Centre and Grievance Redressal are
   one component, not six: they differ only in which route's content they render
   and what their header says. Adding a seventh is then a row in the section
   registry rather than a file — which is the point of having a registry.

   Nothing here introduces a visual language of its own. Every element is a
   primitive the app already uses — `Page`, `PageHeader`, the `card` class, the
   same prose sizing as `Legal.tsx` — so a page rendered from the CMS sits
   beside the hand-built ones without looking like a different product.

   A section with nothing published shows what it is and says it is not written
   yet, rather than rendering as a blank strip. Somebody has to be able to look
   at the page and see the gap.
--------------------------------------------------------------------------- */
import { Link } from 'react-router-dom'
import { FileText, ExternalLink } from 'lucide-react'
import { Page } from '../layout/Chrome'
import { Button, EmptyState, PageHeader } from '../components/ui'
import { useCmsPage, useCmsSections } from '../api/useCmsPage'
import type { CmsSection } from '../api/useCmsPage'

/** The pages this component serves, and the header each one carries. Titles
 *  live here rather than in the CMS so a page always has a name, even before
 *  anybody has written a word of it. */
export const CMS_PAGES: Record<string, { title: string; sub: string }> = {
  '/pricing': {
    title: 'Pricing & plans',
    sub: 'What it costs to buy and sell on ferroBid. Rates shown are the rates charged — both come from the same place.',
  },
  '/about': {
    title: 'About us',
    sub: 'Who we are, and why every lot on this platform has been stood on by somebody from our team.',
  },
  '/contact': {
    title: 'Contact us',
    sub: 'Where to find us, and who picks up.',
  },
  '/blog': {
    title: 'Blog',
    sub: 'Notes on the metal trade, auction mechanics and what we are building.',
  },
  '/knowledge': {
    title: 'Knowledge centre',
    sub: 'Grades, categories, weighment, documentation — the reference material behind a catalogue.',
  },
  '/grievance': {
    title: 'Grievance redressal',
    sub: 'How to escalate, who it reaches, and how long we have to answer.',
  },
}

export default function CmsPage({ route }: { route: string }) {
  const meta = CMS_PAGES[route]
  const cms = useCmsPage(route)
  const sections = useCmsSections(route)

  const written = sections.filter((s) => Object.keys(s.content).length > 0)

  return (
    <Page className="max-w-4xl">
      <PageHeader title={meta?.title ?? route} sub={meta?.sub} />

      {!cms.loaded && (
        <div className="card p-8 text-sm text-ink-muted">Loading…</div>
      )}

      {cms.loaded && sections.length === 0 && (
        <EmptyState
          icon={<FileText size={32} strokeWidth={1.5} />}
          title="This page has not been set up yet"
          body="Its sections have not been registered. An administrator can add them from the CMS."
          action={<Button variant="secondary" onClick={() => window.history.back()}>Go back</Button>}
        />
      )}

      {cms.loaded && sections.length > 0 && (
        <div className="space-y-8">
          {sections.map((section) => (
            <Section key={section.key} section={section} />
          ))}
        </div>
      )}

      {cms.loaded && sections.length > 0 && written.length === 0 && (
        <p className="text-xs text-ink-faint mt-8">
          Every section on this page is waiting for its first draft.
        </p>
      )}
    </Page>
  )
}

/* -------------------------------- sections ------------------------------- */

function Section({ section }: { section: CmsSection }) {
  const blocks = Object.entries(section.content)

  if (!blocks.length) {
    return (
      <section className="card p-5 border-dashed">
        <h2 className="font-display text-lg font-bold text-ink-muted">{section.title}</h2>
        {section.description && (
          <p className="text-sm text-ink-faint mt-1">{section.description}</p>
        )}
        <p className="text-[13px] text-ink-faint mt-3">Not written yet.</p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="font-display text-xl sm:text-2xl font-bold mb-3">{section.title}</h2>
      <div className="space-y-4">
        {blocks.map(([key, value]) => <Block key={key} blockKey={key} value={value} />)}
      </div>
    </section>
  )
}

/**
 * One block.
 *
 * Rendering is decided by the shape of the value rather than by a `kind` the
 * public endpoint does not send. Anything unrecognised renders nothing — a page
 * that dumps raw JSON at a visitor because an editor saved an unusual shape is
 * worse than a page with a gap in it.
 */
function Block({ blockKey, value }: { blockKey: string; value: unknown }) {
  if (typeof value === 'string') {
    /* A heading block is a heading; everything else is prose. Same sizing as
       the clause lists in Legal.tsx, so the two read as one page style. */
    if (blockKey === 'heading' || blockKey.endsWith('_heading')) {
      return <h3 className="font-bold text-base">{value}</h3>
    }
    return <p className="text-[15px] text-ink-muted leading-relaxed whitespace-pre-line">{value}</p>
  }

  if (isLink(value)) {
    return value.to.startsWith('http') ? (
      <a href={value.to} target="_blank" rel="noopener noreferrer"
         className="inline-flex items-center gap-1.5 text-sm font-semibold text-steel hover:underline">
        {value.label} <ExternalLink size={14} />
      </a>
    ) : (
      <Link to={value.to}>
        <Button variant="secondary" size="md">{value.label}</Button>
      </Link>
    )
  }

  if (Array.isArray(value)) {
    return (
      <div className="space-y-3">
        {value.map((item, i) => <ListItem key={i} item={item} />)}
      </div>
    )
  }

  return null
}

function ListItem({ item }: { item: unknown }) {
  if (typeof item === 'string') {
    return <p className="text-[15px] text-ink-muted leading-relaxed">{item}</p>
  }
  if (item && typeof item === 'object') {
    const row = item as Record<string, unknown>
    const title = pickString(row, ['title', 'question', 'label', 'name'])
    const body = pickString(row, ['body', 'answer', 'sub', 'description'])
    if (!title && !body) return null
    return (
      <div className="card p-4">
        {title && <div className="font-bold text-[15px]">{title}</div>}
        {body && <p className="text-sm text-ink-muted mt-1 leading-relaxed whitespace-pre-line">{body}</p>}
      </div>
    )
  }
  return null
}

/* -------------------------------- helpers -------------------------------- */

const isLink = (v: unknown): v is { label: string; to: string } =>
  !!v && typeof v === 'object' && typeof (v as Record<string, unknown>).to === 'string'
  && typeof (v as Record<string, unknown>).label === 'string'

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) if (typeof row[k] === 'string' && row[k]) return row[k] as string
  return null
}
