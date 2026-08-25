/* ---------------------------------------------------------------------------
   CMS — the block editor.

   One screen serves every CMS page: the route decides which page's blocks it
   loads. That is why the nav can carry thirteen CMS entries without thirteen
   near-identical files behind them.

   Every block kind gets an editor shaped like its data, not a shared textarea
   pretending every kind is plain text:

   * **text / number_label** — a single line or short paragraph.
   * **richtext** — the same small **bold** / *italic* / [link](url) / "- "
     bullet markup src/lib/cmsContent.tsx renders on the live site, with a
     toolbar that inserts it and a preview that shows it rendered.
   * **link** — a label and a destination, previewed as the real button or
     text link it becomes.
   * **image** — a real upload to the server's own media store (`cms_media`,
     see server/src/api/uploads.mjs), not a fake "attached" toggle, with a
     paste-a-URL fallback for art already hosted elsewhere.
   * **list / faq** — question/answer rows with add, remove and reorder, for
     the common shape; a value shaped any other way (icons, nested steps)
     opens as validated JSON instead of being flattened or refused outright.

   Every editor renders through the exact component the public site uses
   (`CmsBlockValue`), so the preview beside the field is not a guess at what
   Publish will do — it is what Publish will do.

   Two server rules surface here rather than being hidden:

   * A **figure typed into copy** is refused, and the refusal says what to use
     instead. Auction numbers come from the auction system and money from
     finance; a page that types "12,400 lots sold" is how the public site ends
     up contradicting the books.

   * **Pricing and legal do not publish** — they leave for the CEO's signature,
     and the page keeps serving the previous version until it is signed.
--------------------------------------------------------------------------- */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Bold, Check, Clock, CornerUpLeft, EyeOff, History, Italic, Link2,
  ListPlus, Loader2, Plus, RotateCcw, Send, Trash2, Upload,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, Field, Input, PageHeader, Select, Textarea } from '../../components/ui'
import { useStore } from '../../store/store'
import {
  listBlocks, listBlockHistory, listSections, saveBlock, publishBlock, unpublishBlock, rollbackBlock,
  cmsErrorMessage, routeFor,
} from '../../api/cmsAdmin'
import type { AdminBlock, AdminSection, BlockStatus, ChangeEntry } from '../../api/cmsAdmin'
import { apiUpload } from '../../api/client'
import {
  CmsBlockValue, isImageValue, isLinkValue, isQaListValue, isRichTextValue,
  asQaItems, emptyImageValue, emptyRichTextValue, resolveImageSrc,
} from '../../lib/cmsContent'
import type { ImageValue, LinkValue, QaItem, RichTextValue } from '../../lib/cmsContent'
import { useNow } from '../../lib/useTick'
import { relTime } from '../../lib/format'

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

/* Mirrors CEO_SIGNED_PAGES on the server. Shown on the button so nobody presses
   Publish expecting it to go live. */
const NEEDS_SIGNATURE = new Set(['pricing', 'terms', 'privacy', 'grievance'])

export default function CmsBlocks() {
  const { pageKey: fromRoute } = useParams()
  const pushToast = useStore((s) => s.pushToast)

  const [pageKey, setPageKey] = useState(fromRoute ?? 'home')
  const [blocks, setBlocks] = useState<AdminBlock[]>([])
  const [sections, setSections] = useState<AdminSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (fromRoute) setPageKey(fromRoute) }, [fromRoute])

  const reload = (key: string) => {
    setLoading(true)
    Promise.all([listBlocks(key), listSections(routeFor(key))])
      .then(([rows, secs]) => { setBlocks(rows); setSections(secs); setError(null) })
      .catch((err) => setError(cmsErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload(pageKey) }, [pageKey])

  const blocksBySection = useMemo(() => {
    const map = new Map<string, AdminBlock[]>()
    for (const b of blocks) {
      if (!map.has(b.sectionKey)) map.set(b.sectionKey, [])
      map.get(b.sectionKey)!.push(b)
    }
    return map
  }, [blocks])

  /* Every registered section for this page, even the ones nobody has written a
     word against yet — the Atlas promises a section exists whether or not it
     has been drafted, so an empty one is a gap to fill, not a page to skip. */
  const orderedSections = useMemo(() => {
    const known = new Map<string, { key: string; title: string; sortOrder: number }>()
    for (const sec of sections) known.set(sec.key, { key: sec.key, title: sec.title, sortOrder: sec.sortOrder })
    for (const key of blocksBySection.keys()) {
      if (!known.has(key)) known.set(key, { key, title: key, sortOrder: 999 })
    }
    return [...known.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key))
  }, [sections, blocksBySection])

  const label = CMS_PAGE_KEYS.find((p) => p.key === pageKey)?.label ?? pageKey
  const drafts = blocks.filter((b) => b.status !== 'published').length

  return (
    <Page>
      <PageHeader
        crumbs={[{ label: 'Content', to: '/cms' }]}
        title={label}
        sub={`Words, links, images and lists on ${routeFor(pageKey)}. Nothing here is public until you press Publish.`}
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

      {!loading && orderedSections.length === 0 && (
        <EmptyState
          title="No sections registered for this page"
          body="Run npm run db:seed-cms on the server, or check the page key."
        />
      )}

      {!loading && orderedSections.map((sec) => (
        <section key={sec.key} className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-faint mb-3">{sec.title}</h2>
          <div className="space-y-3">
            {(blocksBySection.get(sec.key) ?? []).map((block) => (
              <BlockEditor
                key={block.id}
                block={block}
                onSaved={() => reload(pageKey)}
                onToast={pushToast}
              />
            ))}
            <NewBlockForm
              pageKey={pageKey}
              sectionKey={sec.key}
              existingKeys={new Set((blocksBySection.get(sec.key) ?? []).map((b) => b.blockKey))}
              onCreated={() => reload(pageKey)}
              onToast={pushToast}
            />
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
  const status = STATUS[block.status]
  const [busy, setBusy] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  /* One typed slot per kind, seeded from whatever is on the block right now.
     Only one of these is ever live for a given block — `kind` decides which —
     so keeping them as separate hooks (rather than one `unknown` blob) means
     each editor gets a real type instead of a cast at every use. */
  const [text, setText] = useState(() => asText(block.draft ?? block.published))
  const [rich, setRich] = useState<RichTextValue>(() => asRichText(block.draft ?? block.published))
  const [link, setLink] = useState<LinkValue>(() => asLink(block.draft ?? block.published))
  const [image, setImage] = useState<ImageValue>(() => asImage(block.draft ?? block.published))
  const [qa, setQa] = useState<QaItem[]>(() => asQaItems(block.draft ?? block.published))
  const [json, setJson] = useState(() => JSON.stringify(block.draft ?? block.published ?? [], null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)

  const isListLike = block.kind === 'list' || block.kind === 'faq'
  const startedAsQa = isListLike && isQaListValue(block.draft ?? block.published ?? [])

  /** What `saveBlock` would actually send right now, for this kind. Also the
     one place "does the value differ" is computed from, so the enable/disable
     state of every button agrees with what a click would do. */
  const currentValue = (): unknown => {
    switch (block.kind) {
      case 'richtext': return rich
      case 'link': return link
      case 'image': return image
      case 'list': case 'faq': return startedAsQa ? qa : safeParseJson(json)
      default: return text
    }
  }

  const draftValue = block.draft ?? block.published
  const changed = JSON.stringify(currentValue()) !== JSON.stringify(draftValue ?? (isListLike ? [] : ''))
  const differsFromLive = JSON.stringify(currentValue()) !== JSON.stringify(block.published)
  const canSave = changed && (!isListLike || startedAsQa || jsonError === null)
  /* Already live, nothing saved that differs from it, and no pending edit in
     this editor either — a Publish click here would do nothing. */
  const nothingToPublish = block.status === 'published' && !differsFromLive && !canSave

  const save = async (thenPublish: boolean) => {
    if (isListLike && !startedAsQa) {
      const parsed = safeParseJson(json)
      if (parsed === undefined) { setJsonError('Not valid JSON — fix the syntax before saving'); return }
      setJsonError(null)
    }
    setBusy(true)
    try {
      await saveBlock({
        pageKey: block.pageKey, sectionKey: block.sectionKey, blockKey: block.blockKey,
        kind: block.kind, value: currentValue(), sortOrder: block.sortOrder,
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

  const unpublish = async () => {
    setBusy(true)
    try {
      await unpublishBlock(block.id, routeFor(block.pageKey), 'Taken down from the editor')
      onToast({ kind: 'success', title: 'Taken off the site', body: `${block.blockKey} is no longer public.` })
      onSaved()
    } catch (err) {
      onToast({ kind: 'danger', title: 'Not changed', body: cmsErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const revert = async () => {
    setBusy(true)
    try {
      await rollbackBlock(block.id, routeFor(block.pageKey), block.version - 1)
      onToast({ kind: 'success', title: 'Reverted', body: 'Back to the version before this one.' })
      onSaved()
    } catch (err) {
      onToast({ kind: 'danger', title: 'Not reverted', body: cmsErrorMessage(err) })
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
        <button
          type="button" onClick={() => setShowHistory((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-ink-faint hover:text-ink"
        >
          <History size={12} /> History
        </button>
      </div>

      {showHistory && <BlockHistory blockId={block.id} />}

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5">Edit</div>
          {block.kind === 'richtext' ? (
            <RichTextEditor value={rich} onChange={setRich} />
          ) : block.kind === 'link' ? (
            <LinkEditor value={link} onChange={setLink} />
          ) : block.kind === 'image' ? (
            <ImageEditor value={image} onChange={setImage} onToast={onToast} />
          ) : isListLike ? (
            startedAsQa
              ? <QaListEditor items={qa} onChange={setQa} kind={block.kind} />
              : <JsonEditor value={json} onChange={(v) => { setJson(v); setJsonError(null) }} error={jsonError} />
          ) : (
            <TextEditor
              value={text} onChange={setText}
              label={block.kind === 'number_label' ? 'Caption (the figure beside it is computed)' : 'Text'}
            />
          )}
        </div>

        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5">Preview — as it appears on the site</div>
          <div className="rounded-xl bg-surface-2 p-4 min-h-[64px] flex items-center">
            <CmsBlockValue value={currentValue()} blockKey={block.blockKey} />
          </div>
          {differsFromLive && block.published !== null && block.published !== undefined && (
            <details className="mt-2">
              <summary className="text-[11px] text-ink-faint cursor-pointer select-none">What's live now</summary>
              <div className="rounded-xl bg-surface-2/60 p-3 mt-1.5">
                <CmsBlockValue value={block.published} blockKey={block.blockKey} />
              </div>
            </details>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-line">
        <Button size="md" variant="secondary" disabled={!canSave || busy} onClick={() => void save(false)}>
          <CornerUpLeft size={15} /> Save draft
        </Button>
        <Button size="md" disabled={busy || nothingToPublish}
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
        {block.status === 'published' && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void unpublish()} title="Take this off the site without deleting it">
            <EyeOff size={14} /> Unpublish
          </Button>
        )}
        {block.status === 'published' && block.version > 1 && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void revert()} title={`Restore v${block.version - 1}`}>
            <RotateCcw size={14} /> Revert to v{block.version - 1}
          </Button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------- new block -------------------------------- */

const KIND_OPTIONS: { value: AdminBlock['kind']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'richtext', label: 'Rich text' },
  { value: 'link', label: 'Link' },
  { value: 'image', label: 'Image' },
  { value: 'list', label: 'List' },
  { value: 'faq', label: 'FAQ' },
  { value: 'number_label', label: 'Number caption' },
]

/* Mirrors the server's id() validator (server/src/api/validate.mjs) — a block
   key is a slug, not free text, so a bad one is refused before the request. */
const BLOCK_KEY_RE = /^[A-Za-z0-9_.:-]{1,64}$/

const emptyValueFor = (kind: AdminBlock['kind']): unknown => {
  switch (kind) {
    case 'richtext': return emptyRichTextValue()
    case 'image': return emptyImageValue()
    case 'link': return { label: '', to: '' }
    case 'list': case 'faq': return []
    default: return ''
  }
}

/** Adds the first (or next) block to a section that has one, or none yet.
 *  Every CMS page ships with its sections registered before a word is
 *  written against them — see server/src/cms/inventory.mjs — so most of the
 *  CMS starts as registered-but-blank, and this is how it stops being blank. */
function NewBlockForm({ pageKey, sectionKey, existingKeys, onCreated, onToast }: {
  pageKey: string; sectionKey: string; existingKeys: Set<string>; onCreated: () => void; onToast: Toast
}) {
  const [open, setOpen] = useState(false)
  const [blockKey, setBlockKey] = useState('')
  const [kind, setKind] = useState<AdminBlock['kind']>('text')
  const [busy, setBusy] = useState(false)

  const trimmed = blockKey.trim()
  const keyError = trimmed.length === 0 ? null
    : !BLOCK_KEY_RE.test(trimmed) ? 'Letters, numbers, and _ . : - only'
    : existingKeys.has(trimmed) ? 'A block with this key already exists in this section'
    : null
  const canCreate = trimmed.length > 0 && keyError === null

  const create = async () => {
    setBusy(true)
    try {
      await saveBlock({ pageKey, sectionKey, blockKey: trimmed, kind, value: emptyValueFor(kind), sortOrder: 0 })
      onToast({ kind: 'success', title: 'Block created', body: `${trimmed} — saved as a draft, not yet public.` })
      setBlockKey('')
      setKind('text')
      setOpen(false)
      onCreated()
    } catch (err) {
      onToast({ kind: 'danger', title: 'Not created', body: cmsErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Plus size={14} /> Add block to this section
      </Button>
    )
  }

  return (
    <div className="card p-4 border-dashed">
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <Field label="Block key" hint={keyError ?? 'A short slug, e.g. intro_heading'}>
          <Input className="num" value={blockKey} onChange={(e) => setBlockKey(e.target.value)} placeholder="intro_heading" />
        </Field>
        <Field label="Kind">
          <Select value={kind} onChange={(e) => setKind(e.target.value as AdminBlock['kind'])}>
            {KIND_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </Select>
        </Field>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <Button size="sm" disabled={!canCreate || busy} loading={busy} onClick={() => void create()}>
          <Plus size={14} /> Create
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  )
}

/* ------------------------------ block history ----------------------------- */

function BlockHistory({ blockId }: { blockId: string }) {
  const now = useNow()
  const [rows, setRows] = useState<ChangeEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listBlockHistory(blockId)
      .then((r) => { if (!cancelled) setRows(r) })
      .catch((err) => { if (!cancelled) setError(cmsErrorMessage(err)) })
    return () => { cancelled = true }
  }, [blockId])

  return (
    <div className="rounded-xl bg-surface-2 p-3 mb-3 text-[12px]">
      {error && <p className="text-danger">{error}</p>}
      {!error && rows === null && <p className="text-ink-faint">Loading history…</p>}
      {rows !== null && rows.length === 0 && <p className="text-ink-faint">No changes recorded yet.</p>}
      {rows !== null && rows.length > 0 && (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <Chip tone={r.action === 'publish' ? 'success' : r.action === 'unpublish' ? 'warning' : r.action === 'rollback' ? 'steel' : 'neutral'}>
                {r.action}
              </Chip>
              <span className="text-ink-muted">{r.actorRole ?? 'system'} · {relTime(r.at, now)}</span>
              {r.reason && <span className="text-ink-faint">— {r.reason}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ----------------------------- kind editors ------------------------------- */

function TextEditor({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <Field label={label}>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={value.length > 160 ? 4 : 2} />
    </Field>
  )
}

/** **bold**, *italic*, [label](url) and "- " bullets — the exact subset
 *  src/lib/cmsContent.tsx's `RichText` renders. The toolbar wraps the current
 *  selection rather than opening a separate dialog, so formatting stays a
 *  one-click action on text already being typed. */
function RichTextEditor({ value, onChange }: { value: RichTextValue; onChange: (v: RichTextValue) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const wrap = (before: string, after: string = before) => {
    const el = ref.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e } = el
    const selected = value.text.slice(s, e) || 'text'
    const next = value.text.slice(0, s) + before + selected + after + value.text.slice(e)
    onChange({ format: 'richtext', text: next })
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + selected.length) })
  }

  const bullet = () => {
    const el = ref.current
    if (!el) return
    const { selectionStart: s } = el
    const lineStart = value.text.lastIndexOf('\n', s - 1) + 1
    const next = `${value.text.slice(0, lineStart)}- ${value.text.slice(lineStart)}`
    onChange({ format: 'richtext', text: next })
  }

  return (
    <Field label="Text">
      <div className="flex items-center gap-1 mb-1.5">
        <ToolbarButton icon={<Bold size={13} />} label="Bold" onClick={() => wrap('**')} />
        <ToolbarButton icon={<Italic size={13} />} label="Italic" onClick={() => wrap('*')} />
        <ToolbarButton icon={<Link2 size={13} />} label="Link" onClick={() => wrap('[', '](https://)')} />
        <ToolbarButton icon={<ListPlus size={13} />} label="Bullet line" onClick={bullet} />
        <span className="text-[11px] text-ink-faint ml-2">Markdown-lite: **bold**, *italic*, [text](url), "- " bullets</span>
      </div>
      <Textarea ref={ref} value={value.text} onChange={(e) => onChange({ format: 'richtext', text: e.target.value })} rows={6} />
    </Field>
  )
}

function ToolbarButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={label}
      className="size-7 rounded-lg border border-line-strong flex items-center justify-center text-ink-muted hover:bg-surface-2 hover:text-ink">
      {icon}
    </button>
  )
}

function LinkEditor({ value, onChange }: { value: LinkValue; onChange: (v: LinkValue) => void }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Label"><Input value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} placeholder="Browse live auctions" /></Field>
      <Field label="Destination" hint="An in-app path (/browse) or a full https:// URL">
        <Input className="num" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} placeholder="/browse" />
      </Field>
    </div>
  )
}

/** Uploads through the server's own `cms_media` store (see
 *  server/src/api/uploads.mjs) — the same content-sniffed, deduplicated
 *  pipeline lot photos and KYC documents use, not a client-side placeholder.
 *  A paste-a-URL fallback covers art already hosted somewhere else. */
function ImageEditor({ value, onChange, onToast }: { value: ImageValue; onChange: (v: ImageValue) => void; onToast: Toast }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const result = await apiUpload(file, { kind: 'cms_media', altText: value.alt })
      onChange({ url: result.url, alt: value.alt, width: undefined, height: undefined })
      onToast({ kind: 'success', title: 'Image uploaded', body: result.filename })
    } catch (err) {
      onToast({ kind: 'danger', title: 'Upload failed', body: cmsErrorMessage(err) })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => void pick(e.target.files?.[0])} />
        <Button type="button" variant="secondary" size="md" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Upload image
        </Button>
        <span className="text-[11px] text-ink-faint">JPEG, PNG or WebP, up to 15MB</span>
      </div>
      <Field label="or paste an image URL">
        <Input className="num" value={value.url.startsWith('/api/uploads/') ? '' : value.url}
          onChange={(e) => onChange({ ...value, url: e.target.value })}
          placeholder="https://…" />
      </Field>
      <Field label="Alt text" hint="Read aloud by screen readers, and shown if the image fails to load">
        <Input value={value.alt} onChange={(e) => onChange({ ...value, alt: e.target.value })} />
      </Field>
      {value.url && (
        <img src={resolveImageSrc(value.url)} alt={value.alt} className="max-h-40 rounded-lg border border-line object-cover" />
      )}
    </div>
  )
}

/** Question/answer rows — the shape a "list" or "faq" block almost always is.
 *  A block saved with a richer shape (icons, nested steps) never reaches this
 *  editor; see `isQaListValue`'s comment in lib/cmsContent.tsx. */
function QaListEditor({ items, onChange, kind }: { items: QaItem[]; onChange: (v: QaItem[]) => void; kind: string }) {
  const isFaq = kind === 'faq'
  const set = (i: number, patch: Partial<QaItem>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const add = () => onChange([...items, { question: '', answer: '' }])

  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-line-strong p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Input value={item.question} onChange={(e) => set(i, { question: e.target.value })}
              placeholder={isFaq ? 'Question' : 'Title'} className="flex-1" />
            <button type="button" onClick={() => remove(i)} className="text-ink-faint hover:text-danger p-1.5" title="Remove">
              <Trash2 size={15} />
            </button>
          </div>
          <Textarea value={item.answer} onChange={(e) => set(i, { answer: e.target.value })}
            placeholder={isFaq ? 'Answer' : 'Body'} rows={2} />
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={add}>
        <Plus size={14} /> Add {isFaq ? 'question' : 'item'}
      </Button>
      {items.length === 0 && <p className="text-[12px] text-ink-faint">Nothing yet — add the first one.</p>}
    </div>
  )
}

/** The fallback for any list value that is not a clean question/answer array
 *  — validated JSON rather than a read-only dump, so the value stays editable
 *  even when its shape is too specific for a generic row editor to offer. */
function JsonEditor({ value, onChange, error }: { value: string; onChange: (v: string) => void; error: string | null }) {
  return (
    <div>
      <p className="text-[11px] text-ink-faint mb-1.5">
        This block's shape is more specific than a question/answer list — edited as JSON.
      </p>
      <Textarea className="num" value={value} onChange={(e) => onChange(e.target.value)} rows={10} />
      {error && <p className="text-[12px] text-danger mt-1">{error}</p>}
    </div>
  )
}

/* -------------------------------- helpers --------------------------------- */

const asText = (value: unknown): string => (typeof value === 'string' ? value : '')

const asRichText = (value: unknown): RichTextValue =>
  isRichTextValue(value) ? value : typeof value === 'string' ? emptyRichTextValue(value) : emptyRichTextValue()

const asLink = (value: unknown): LinkValue => (isLinkValue(value) ? value : { label: '', to: '' })

const asImage = (value: unknown): ImageValue => (isImageValue(value) ? value : emptyImageValue())

function safeParseJson(text: string): unknown {
  try { return JSON.parse(text) } catch { return undefined }
}
