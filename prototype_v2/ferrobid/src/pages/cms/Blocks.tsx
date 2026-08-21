/* ---------------------------------------------------------------------------
   CMS — the block editor.

   One screen serves every CMS page: the route decides which page's blocks it
   loads. That is why the nav can carry thirteen CMS entries without thirteen
   near-identical files behind them.

   The editor shows the words as they are next to the words as they would be,
   which is the same before/after the Sub Admin's content screen already used —
   a reviewer needs to see the change, not only the result.

   Two server rules surface here rather than being hidden:

   * A **figure typed into copy** is refused, and the refusal says what to use
     instead. Auction numbers come from the auction system and money from
     finance; a page that types "12,400 lots sold" is how the public site ends
     up contradicting the books.

   * **Pricing and legal do not publish** — they leave for the CEO's signature,
     and the page keeps serving the previous version until it is signed.
--------------------------------------------------------------------------- */
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, Clock, CornerUpLeft, Send } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, Field, PageHeader, Select, Textarea } from '../../components/ui'
import { useStore } from '../../store/store'
import {
  listBlocks, saveBlock, publishBlock, cmsErrorMessage, pageKeyFor, routeFor,
} from '../../api/cmsAdmin'
import type { AdminBlock, BlockStatus } from '../../api/cmsAdmin'

/** The pages the CMS category lists, in the order content is made. */
export const CMS_PAGE_KEYS: { key: string; label: string }[] = [
  { key: 'home', label: 'Home page' },
  { key: 'pricing', label: 'Pricing & plans' },
  { key: 'about', label: 'About us' },
  { key: 'contact', label: 'Contact us' },
  { key: 'terms', label: 'Terms & conditions' },
  { key: 'privacy', label: 'Privacy policy' },
  { key: 'grievance', label: 'Grievance redressal' },
  { key: 'help', label: 'Help centre' },
  { key: 'faqs', label: 'Help & FAQs' },
  { key: 'knowledge', label: 'Knowledge centre' },
  { key: 'blog', label: 'Blog' },
]

const STATUS: Record<BlockStatus, { label: string; tone: 'success' | 'ember' | 'warning' | 'steel' | undefined }> = {
  published:   { label: 'Live', tone: 'success' },
  draft:       { label: 'Draft', tone: 'ember' },
  in_review:   { label: 'With a second reader', tone: 'warning' },
  ceo_pending: { label: 'Awaiting signature', tone: 'warning' },
  returned:    { label: 'Returned', tone: 'steel' },
}

export default function CmsBlocks() {
  const { pageKey: fromRoute } = useParams()
  const pushToast = useStore((s) => s.pushToast)

  const [pageKey, setPageKey] = useState(fromRoute ?? 'home')
  const [blocks, setBlocks] = useState<AdminBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (fromRoute) setPageKey(fromRoute) }, [fromRoute])

  const reload = (key: string) => {
    setLoading(true)
    listBlocks(key)
      .then((rows) => { setBlocks(rows); setError(null) })
      .catch((err) => setError(cmsErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload(pageKey) }, [pageKey])

  const bySection = useMemo(() => {
    const map = new Map<string, AdminBlock[]>()
    for (const b of blocks) {
      if (!map.has(b.sectionKey)) map.set(b.sectionKey, [])
      map.get(b.sectionKey)!.push(b)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [blocks])

  const label = CMS_PAGE_KEYS.find((p) => p.key === pageKey)?.label ?? pageKey
  const drafts = blocks.filter((b) => b.status !== 'published').length

  return (
    <Page>
      <PageHeader
        title={label}
        sub={`Words, links and lists on ${routeFor(pageKey)}. Nothing here is public until you press Publish.`}
        actions={drafts > 0 ? <Chip tone="ember">{drafts} unpublished</Chip> : undefined}
      />

      <div className="mb-5">
        <Select value={pageKey} onChange={(e) => setPageKey(e.target.value)} className="w-64">
          {CMS_PAGE_KEYS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </Select>
      </div>

      {error && (
        <div className="card p-3 mb-4 text-sm text-danger border-danger/40 bg-danger-soft/30">{error}</div>
      )}

      {loading && <div className="card p-8 text-sm text-ink-muted">Loading…</div>}

      {!loading && blocks.length === 0 && (
        <EmptyState
          title="Nothing written for this page yet"
          body="Its sections are registered, but no copy has been drafted against them."
        />
      )}

      {!loading && bySection.map(([sectionKey, rows]) => (
        <section key={sectionKey} className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-faint mb-3">{sectionKey}</h2>
          <div className="space-y-3">
            {rows.map((block) => (
              <BlockEditor
                key={block.id}
                block={block}
                onSaved={() => reload(pageKey)}
                onToast={pushToast}
              />
            ))}
          </div>
        </section>
      ))}
    </Page>
  )
}

/* ------------------------------ one block -------------------------------- */

type Toast = (t: { kind: 'success' | 'danger' | 'info'; title: string; body?: string }) => void

function BlockEditor({ block, onSaved, onToast }: {
  block: AdminBlock; onSaved: () => void; onToast: Toast
}) {
  const editable = block.kind === 'text' || block.kind === 'richtext' || block.kind === 'number_label'
  const [value, setValue] = useState(() => asText(block.draft ?? block.published))
  const [busy, setBusy] = useState(false)
  const status = STATUS[block.status]

  const current = asText(block.published)
  const changed = value !== asText(block.draft ?? block.published)
  const differsFromLive = value !== current

  const save = async (thenPublish: boolean) => {
    setBusy(true)
    try {
      await saveBlock({
        pageKey: block.pageKey, sectionKey: block.sectionKey, blockKey: block.blockKey,
        kind: block.kind, value, sortOrder: block.sortOrder,
      })
      if (thenPublish) {
        const result = await publishBlock(block.id, routeFor(block.pageKey))
        onToast(result.status === 'ceo_pending'
          ? { kind: 'info', title: 'Sent for signature', body: result.message }
          : { kind: 'success', title: 'Published', body: `${block.blockKey} is live.` })
      } else {
        onToast({ kind: 'success', title: 'Draft saved', body: 'Not public until you publish it.' })
      }
      onSaved()
    } catch (err) {
      onToast({ kind: 'danger', title: 'Not saved', body: cmsErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="num font-semibold text-[13px]">{block.blockKey}</span>
        <Chip tone={status.tone}>{status.label}</Chip>
        <span className="text-[11px] text-ink-faint">{block.kind}</span>
        {block.version > 0 && <span className="num text-[11px] text-ink-faint">v{block.version}</span>}
        {block.note && <span className="text-[12px] text-ink-muted">· {block.note}</span>}
      </div>

      {!editable ? (
        /* Structured blocks — a list of tracks, a link, an image — are not
           safely editable as free text, and a textarea that mangles their shape
           would be worse than no editor. They are shown as they stand. */
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5">
            Structured content — edited in a later release
          </div>
          <pre className="num text-[12px] text-ink-muted overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(block.published ?? block.draft, null, 2)}
          </pre>
        </div>
      ) : (
        <>
          {differsFromLive && current && (
            <div className="rounded-xl bg-surface-2 p-3 mb-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5">
                Live on the site now
              </div>
              <p className="text-[13px] text-ink-muted leading-relaxed">{current}</p>
            </div>
          )}

          <Field label={block.kind === 'number_label' ? 'Caption (the figure beside it is computed)' : 'Text'}>
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={value.length > 160 ? 4 : 2}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Button size="md" variant="secondary" disabled={!changed || busy} onClick={() => void save(false)}>
              <CornerUpLeft size={15} /> Save draft
            </Button>
            <Button size="md" disabled={busy || (!differsFromLive && block.status === 'published')}
                    loading={busy} onClick={() => void save(true)}>
              {NEEDS_SIGNATURE.has(block.pageKey)
                ? <><Send size={15} /> Send for signature</>
                : <><Check size={15} /> Publish</>}
            </Button>
            {block.status === 'ceo_pending' && (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-faint">
                <Clock size={13} /> waiting on the CEO
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* Mirrors CEO_SIGNED_PAGES on the server. Shown on the button so nobody presses
   Publish expecting it to go live. */
const NEEDS_SIGNATURE = new Set(['pricing', 'terms', 'privacy', 'grievance'])

const asText = (value: unknown): string => (typeof value === 'string' ? value : '')

export { pageKeyFor }
