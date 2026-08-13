/* ---------------------------------------------------------------------------
   Sub Admin — Content management.

   The authoring half of the CMS. A Sub Admin writes the copy; a Super Admin
   publishes it, and the CEO signs off anything about pricing or legal terms.
   Nothing typed here is public until someone presses Publish.

   One rule is enforced rather than explained, in `submitContentDraft`: **no
   figure may be typed into copy.** Auction numbers come from the auction
   system, money numbers come from finance, and words come from here. A content
   editor who can type a lot count or a fee into a page is how the public site
   ends up contradicting the books.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CornerDownLeft, FileText, PenLine, Send, ShieldAlert } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, EmptyState, Field, Input, Modal, PageHeader, Segmented, Select, Stat, Textarea, Toggle,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { ContentDraft, ContentStatus } from '../../types'

type Tab = ContentStatus

/** The pages this desk may draft against. A fixed list rather than free text:
 *  a draft against a page that does not exist is a draft nobody can publish. */
const PAGES = [
  'Home', 'Browse auctions', 'How it works', 'Pricing', 'For buyers', 'For sellers',
  'About us', 'FAQs', 'Help', 'Grievance', 'Noticeboard', 'Terms & privacy',
]

const TAB_LABEL: Record<Tab, string> = {
  submitted: 'With Super Admin',
  published: 'Live',
  returned: 'Returned to you',
}

export default function ContentManagement() {
  const now = useNow()
  const drafts = useStore((s) => s.contentDrafts)
  const users = useStore((s) => s.users)
  const me = useStore((s) => s.currentUser)
  const submitContentDraft = useStore((s) => s.submitContentDraft)
  const pushToast = useStore((s) => s.pushToast)

  const [tab, setTab] = useState<Tab>('submitted')
  const [writing, setWriting] = useState(false)
  const [page, setPage] = useState(PAGES[0])
  const [section, setSection] = useState('')
  const [before, setBefore] = useState('')
  const [after, setAfter] = useState('')
  const [needsCeo, setNeedsCeo] = useState(false)
  const [reading, setReading] = useState<ContentDraft | null>(null)

  const submitted = drafts.filter((d) => d.status === 'submitted')
  const published = drafts.filter((d) => d.status === 'published')
  const returned = drafts.filter((d) => d.status === 'returned')
  const list = tab === 'submitted' ? submitted : tab === 'published' ? published : returned

  const authorOf = (id: string) => users.find((u) => u.id === id)

  const startNew = () => {
    setPage(PAGES[0]); setSection(''); setBefore(''); setAfter(''); setNeedsCeo(false)
    setWriting(true)
  }

  /** Reopening a returned draft with the comments attached — that is the whole
   *  point of returning one rather than rejecting it. */
  const revise = (d: ContentDraft) => {
    setPage(d.page); setSection(d.section); setBefore(d.before); setAfter(d.after); setNeedsCeo(d.needsCeo)
    setReading(null)
    setWriting(true)
  }

  const submit = () => {
    const r = submitContentDraft({ page, section, before, after, needsCeo })
    if (!r.ok) { pushToast({ kind: 'danger', title: 'Not submitted', body: r.error }); return }
    setWriting(false)
    setTab('submitted')
    pushToast({
      kind: 'success',
      title: 'Sent for publishing',
      body: needsCeo
        ? 'A Super Admin publishes it, and the CEO signs pricing and legal copy.'
        : 'A Super Admin publishes it. Nothing is public until they do.',
    })
  }

  return (
    <Page>
      <PageHeader
        title="Content management"
        sub="Write the words on the public site. A Super Admin publishes them — nothing here is live until they do."
        actions={<Button onClick={startNew}><PenLine size={15} /> Draft a change</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="With Super Admin" value={num(submitted.length)} tone={submitted.length ? 'ember' : undefined} sub="Waiting to be published" />
        <Stat label="Returned to you" value={num(returned.length)} tone={returned.length ? 'warning' : undefined} sub="Comments to act on" />
        <Stat label="Live" value={num(published.length)} tone="steel" sub="Published copy" />
        <Stat label="Needs the CEO too" value={num(drafts.filter((d) => d.needsCeo && d.status === 'submitted').length)} sub="Pricing and legal" />
      </div>

      <div className="mb-4">
        <Segmented<Tab>
          options={(['submitted', 'returned', 'published'] as Tab[]).map((k) => ({
            key: k,
            label: `${TAB_LABEL[k]} (${k === 'submitted' ? submitted.length : k === 'returned' ? returned.length : published.length})`,
          }))}
          value={tab}
          onChange={setTab}
        />
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<FileText size={26} />}
          title={tab === 'returned' ? 'Nothing has come back' : tab === 'submitted' ? 'Nothing waiting to publish' : 'Nothing published yet'}
          body="Draft a change to any page on the public site and it goes to a Super Admin to publish."
          action={<Button variant="secondary" onClick={startNew}>Draft a change</Button>}
        />
      ) : (
        <div className="space-y-3">
          {list.map((d) => {
            const author = authorOf(d.authorId)
            return (
              <article key={d.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-line">
                  <div className="flex-1 min-w-52">
                    <div className="font-semibold text-sm">{d.page} · {d.section}</div>
                    <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-1.5">
                      {author && <Avatar name={author.name} hue={author.avatarHue} size={18} />}
                      {author?.id === me?.id ? 'You' : author?.name ?? 'A Sub Admin'} · {relTime(d.submittedAt, now)}
                    </div>
                  </div>
                  {d.needsCeo && <Chip tone="warning"><ShieldAlert size={11} /> CEO signs this</Chip>}
                  <Chip tone={d.status === 'published' ? 'success' : d.status === 'returned' ? 'danger' : 'steel'}>
                    {TAB_LABEL[d.status]}
                  </Chip>
                  <Button variant="ghost" size="sm" onClick={() => setReading(d)}>Read it</Button>
                  {d.status === 'returned' && (
                    <Button variant="secondary" size="sm" onClick={() => revise(d)}>
                      <CornerDownLeft size={13} /> Revise
                    </Button>
                  )}
                </div>
                {d.status === 'returned' && d.note && (
                  <div className="px-5 py-3 bg-danger-soft/40 text-sm">
                    <span className="font-semibold">Returned:</span> <span className="text-ink-muted">{d.note}</span>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      <div className="card bg-surface-2 p-4 mt-6 text-sm text-ink-muted">
        <b className="text-ink">Words come from here; every number comes from the system that owns it.</b> Lot counts
        and auction figures are read from the auction system, and rates, fees and totals from finance — so a figure
        typed into copy is refused rather than published and later contradicted. Published copy is managed on{' '}
        <Link to="/admin/content" className="font-semibold text-ember hover:underline">Content publishing</Link>.
      </div>

      {/* ------------------------------- read it ------------------------------ */}
      <Modal open={!!reading} onClose={() => setReading(null)} title={reading ? `${reading.page} · ${reading.section}` : ''} wide>
        {reading && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="card bg-surface-2 p-4">
                <div className="text-xs uppercase tracking-wider font-semibold text-ink-faint mb-1.5">What is live now</div>
                <p className="text-sm leading-relaxed text-ink-muted">{reading.before || <em>Nothing — this is new copy.</em>}</p>
              </div>
              <div className="card bg-success-soft/40 border-0 p-4">
                <div className="text-xs uppercase tracking-wider font-semibold text-ink-faint mb-1.5">What you wrote</div>
                <p className="text-sm leading-relaxed">{reading.after}</p>
              </div>
            </div>
            {reading.note && (
              <div className="card bg-danger-soft/40 border-0 p-3.5 text-sm">
                <span className="font-semibold">Comments from the Super Admin:</span>{' '}
                <span className="text-ink-muted">{reading.note}</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReading(null)}>Close</Button>
              {reading.status === 'returned' && <Button onClick={() => revise(reading)}>Revise it</Button>}
            </div>
          </div>
        )}
      </Modal>

      {/* -------------------------------- write ------------------------------ */}
      <Modal open={writing} onClose={() => setWriting(false)} title="Draft a change" wide>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Page">
              <Select value={page} onChange={(e) => setPage(e.target.value)}>
                {PAGES.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Section" hint="Which block on that page.">
              <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. Hero subheading" />
            </Field>
          </div>
          <Field label="What is there now" hint="Optional — paste it so the reviewer can see the change.">
            <Textarea value={before} onChange={(e) => setBefore(e.target.value)} rows={3} placeholder="Paste the copy you are replacing…" />
          </Field>
          <Field label="What it should say">
            <Textarea value={after} onChange={(e) => setAfter(e.target.value)} rows={4} placeholder="Write the new copy…" />
          </Field>
          <div className="card bg-surface-2 p-3.5">
            <Toggle
              checked={needsCeo}
              onChange={setNeedsCeo}
              label="This is pricing or legal copy — the CEO signs it as well"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setWriting(false)}>Cancel</Button>
            <Button onClick={submit}><Send size={14} /> Send for publishing</Button>
          </div>
        </div>
      </Modal>
    </Page>
  )
}
