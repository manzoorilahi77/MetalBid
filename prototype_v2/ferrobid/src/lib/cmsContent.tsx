/* ---------------------------------------------------------------------------
   Shared CMS content rendering — the one place that turns a block's raw JSON
   value into on-screen output.

   Used by two callers that must never drift apart: the public page
   (pages/CmsPage.tsx) and the editor's live preview (pages/cms/Blocks.tsx).
   Before this existed, the editor could only guess what a save would look
   like; now it renders through the exact same code the visitor's browser
   does, so "what you see" really is "what you get."

   Dispatch is by VALUE SHAPE, not by the block's `kind` column — the public
   `/api/cms/page` payload never sends `kind` (see getPageContent in
   server/src/cms/service.mjs), only `{ blockKey: value }`, so a renderer that
   needed `kind` could never actually run on the site a visitor sees. This
   matches how the block already distinguished a link `{label,to}` and a list
   `Array` before richtext or image existed; richtext and image are added the
   same way — a small, recognisable object shape — rather than by threading a
   `kind` prop through a payload that does not carry one.

   Rich text is a small, deliberately safe markup subset — **bold**, *italic*,
   [label](url) links and "- " bullet lines — parsed into React elements
   directly. Nothing here ever touches innerHTML: there is no sanitizer
   dependency to keep current because there is no HTML to sanitize.
--------------------------------------------------------------------------- */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, ImageOff } from 'lucide-react'
import { Button } from '../components/ui'
import { API_BASE } from '../api/client'

/* ------------------------------ value shapes ------------------------------ */

export interface LinkValue { label: string; to: string }
export interface ImageValue { url: string; alt: string; width?: number; height?: number }
export interface RichTextValue { format: 'richtext'; text: string }
export interface QaItem { question: string; answer: string }

export const isLinkValue = (v: unknown): v is LinkValue =>
  !!v && typeof v === 'object' && typeof (v as Record<string, unknown>).to === 'string'
  && typeof (v as Record<string, unknown>).label === 'string'

export const isImageValue = (v: unknown): v is ImageValue =>
  !!v && typeof v === 'object' && typeof (v as Record<string, unknown>).url === 'string'
  && !isLinkValue(v)

export const isRichTextValue = (v: unknown): v is RichTextValue =>
  !!v && typeof v === 'object' && (v as Record<string, unknown>).format === 'richtext'
  && typeof (v as Record<string, unknown>).text === 'string'

export const emptyImageValue = (): ImageValue => ({ url: '', alt: '' })
export const emptyRichTextValue = (text = ''): RichTextValue => ({ format: 'richtext', text })

/** A "list" or "faq" block shaped as simple question/answer (or title/body)
 *  pairs — the shape the row editor in Blocks.tsx produces and understands.
 *  A list built by hand with a richer shape (icons, nested steps, …) fails
 *  this check on purpose and falls back to the raw-JSON editor rather than
 *  being silently truncated to just its title and body. */
export const isQaListValue = (v: unknown): v is QaItem[] =>
  Array.isArray(v) && v.every((row) =>
    !!row && typeof row === 'object' && !Array.isArray(row)
    && Object.keys(row as object).every((k) => ['question', 'answer', 'title', 'body'].includes(k))
    && typeof pickString(row as Record<string, unknown>, ['question', 'title']) === 'string')

export const asQaItems = (v: unknown): QaItem[] =>
  isQaListValue(v)
    ? v.map((row) => ({
        question: pickString(row as unknown as Record<string, unknown>, ['question', 'title']) ?? '',
        answer: pickString(row as unknown as Record<string, unknown>, ['answer', 'body']) ?? '',
      }))
    : []

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) if (typeof row[k] === 'string' && row[k]) return row[k] as string
  return null
}

/* -------------------------------- rich text -------------------------------- */

/** Inline markup: **bold**, *italic*, [label](url). Order matters — bold's
 *  double asterisk is matched before italic's single one, so `**x**` never
 *  parses as an italic run of a single leftover asterisk. */
const INLINE_RE = /(\*\*[^*]+?\*\*|\*[^*]+?\*|\[[^\]]+?\]\([^)]+?\))/g

function renderInline(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(INLINE_RE).filter((p) => p !== '')
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>
    const link = part.match(/^\[([^\]]+?)\]\(([^)]+?)\)$/)
    if (link) {
      const [, label, href] = link
      return href.startsWith('http') ? (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="text-steel font-semibold hover:underline">
          {label}
        </a>
      ) : (
        <Link key={key} to={href} className="text-steel font-semibold hover:underline">{label}</Link>
      )
    }
    return part
  })
}

/** Blank-line-separated paragraphs; a block whose every line starts with
 *  "- " renders as a bullet list instead. Single newlines inside a paragraph
 *  become soft breaks, matching how the textarea shows them while editing. */
export function RichText({ value, className }: { value: string; className?: string }) {
  const blocks = value.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  if (!blocks.length) return null
  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter(Boolean)
        const isList = lines.length > 0 && lines.every((l) => l.trimStart().startsWith('- '))
        if (isList) {
          return (
            <ul key={bi} className="list-disc pl-5 space-y-1">
              {lines.map((line, li) => (
                <li key={li} className="text-[15px] text-ink-muted leading-relaxed">
                  {renderInline(line.trimStart().slice(2), `${bi}-${li}`)}
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={bi} className="text-[15px] text-ink-muted leading-relaxed">
            {lines.map((line, li) => (
              <span key={li}>
                {renderInline(line, `${bi}-${li}`)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

/* --------------------------------- image ----------------------------------- */

/** `/api/uploads/:id` is the server's own path, not this app's — it has to
 *  resolve against the API origin, not wherever the SPA is being served
 *  from. A pasted external URL is already absolute and passes through. */
export const resolveImageSrc = (url: string): string => (url.startsWith('/') ? `${API_BASE}${url}` : url)

export function CmsImage({ value, className }: { value: ImageValue; className?: string }) {
  if (!value.url) {
    return (
      <div className={`flex items-center justify-center gap-2 rounded-xl bg-surface-2 text-ink-faint text-xs py-10 ${className ?? ''}`}>
        <ImageOff size={16} /> No image set
      </div>
    )
  }
  return (
    <img
      src={resolveImageSrc(value.url)}
      alt={value.alt}
      loading="lazy"
      className={className ?? 'w-full rounded-xl object-cover'}
      onError={(e) => { e.currentTarget.style.display = 'none' }}
    />
  )
}

/* ----------------------------- one block, any kind -------------------------- */

/** Render one block's value the way a visitor sees it, given only what the
 *  public payload carries — the raw JSON value, no `kind`. Anything
 *  unrecognised renders nothing: a page that dumps raw JSON at a visitor
 *  because an editor saved an unusual shape is worse than a page with a gap. */
export function CmsBlockValue({ value, blockKey }: { value: unknown; blockKey?: string }) {
  if (value === null || value === undefined) return null

  if (isRichTextValue(value)) return <RichText value={value.text} />

  if (isImageValue(value)) return <CmsImage value={value} />

  if (typeof value === 'string') {
    if (blockKey === 'heading' || blockKey?.endsWith('_heading')) return <h3 className="font-bold text-base">{value}</h3>
    return <p className="text-[15px] text-ink-muted leading-relaxed whitespace-pre-line">{value}</p>
  }

  if (isLinkValue(value)) {
    /* Internal links render as a real button — this is a call to action, not
       inline prose — external ones as a plain text link with the tell that
       says "you are about to leave," matching Legal.tsx's own convention. */
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
        {value.map((item, i) => <ListItemValue key={i} item={item} />)}
      </div>
    )
  }

  return null
}

function ListItemValue({ item }: { item: unknown }) {
  if (typeof item === 'string') return <p className="text-[15px] text-ink-muted leading-relaxed">{item}</p>
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
