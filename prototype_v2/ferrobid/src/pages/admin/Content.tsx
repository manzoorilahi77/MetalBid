/* ---------------------------------------------------------------------------
   Super Admin — Content publishing.

   A Sub Admin writes the words; we put them in public. That split is the whole
   point of the screen: **nothing is public until someone deliberately presses
   Publish**, and the person who wrote it is not that someone.

   Two rules the reviewer is holding, stated on the screen rather than assumed:
   · Pricing and legal copy also needs the CEO — those two categories commit the
     company in public, so they leave here as a signature request.
   · No number is ever typed into a page. Auction figures come from the auction
     system, money figures from finance, words from here. A draft that types one
     in is returned, not published.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CornerUpLeft, Globe, Send, Signature } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, EmptyState, Field, Modal, PageHeader, Segmented, Stat, Textarea, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { ContentDraft } from '../../types'

type Tab = 'waiting' | 'ceo' | 'returned' | 'published'

/** The words as they are, next to the words as they would be. A reviewer needs
 *  to see the change, not just the proposal. */
function BeforeAfter({ draft }: { draft: ContentDraft }) {
  return (
    <div className="grid md:grid-cols-2 gap-3 mt-3">
      <div className="card bg-surface-2 border-0 p-3.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5">Live on the site now</div>
        <p className="text-[13px] text-ink-muted leading-relaxed">{draft.before}</p>
      </div>
      <div className="card border-success/40 bg-success-soft/40 p-3.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-success mb-1.5">Proposed</div>
        <p className="text-[13px] leading-relaxed">{draft.after}</p>
      </div>
    </div>
  )
}

export default function ContentPublishing() {
  const now = useNow()
  const drafts = useStore((s) => s.contentDrafts)
  const users = useStore((s) => s.users)
  const ceoApprovals = useStore((s) => s.ceoApprovals)
  const publishContent = useStore((s) => s.publishContent)
  const returnContent = useStore((s) => s.returnContent)
  const requestCeoSignoff = useStore((s) => s.requestCeoSignoff)
  const pushToast = useStore((s) => s.pushToast)

  const [tab, setTab] = useState<Tab>('waiting')
  const [returning, setReturning] = useState<ContentDraft | null>(null)
  const [note, setNote] = useState('')

  const signatureFor = (d: ContentDraft) => ceoApprovals.find((a) => a.kind === 'content_publish' && a.refId === d.id)
  const submitted = drafts.filter((d) => d.status === 'submitted')
  const waiting = submitted.filter((d) => !d.needsCeo || signatureFor(d)?.status === 'approved')
  const withCeo = submitted.filter((d) => d.needsCeo && signatureFor(d)?.status !== 'approved')
  const returned = drafts.filter((d) => d.status === 'returned')
  const published = drafts.filter((d) => d.status === 'published')

  const list = tab === 'waiting' ? waiting : tab === 'ceo' ? withCeo : tab === 'returned' ? returned : published
  const author = (id: string) => users.find((u) => u.id === id)

  const say = (r: { ok: boolean; error?: string }, title: string, body?: string) => {
    if (!r.ok) pushToast({ kind: 'danger', title: 'Not done', body: r.error })
    else pushToast({ kind: 'success', title, body })
    return r.ok
  }

  return (
    <Page>
      <PageHeader
        title="Content publishing"
        sub="Copy drafted by a Sub Admin, before and after. Nothing reaches the public site until it is published from here — and pricing and legal copy needs the CEO as well."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Waiting on us" value={waiting.length} tone={waiting.length ? 'ember' : undefined} />
        <Stat label="With the CEO" value={withCeo.length} tone={withCeo.length ? 'warning' : undefined} sub="pricing & legal" />
        <Stat label="Returned to the author" value={returned.length} />
        <Stat label="Published" value={published.length} tone="success" />
      </div>

      <Segmented<Tab> value={tab} onChange={setTab} options={[
        { key: 'waiting', label: `Waiting on us ${waiting.length}` },
        { key: 'ceo', label: `With the CEO ${withCeo.length}` },
        { key: 'returned', label: `Returned ${returned.length}` },
        { key: 'published', label: `Published ${published.length}` },
      ]} />

      <div className="space-y-3 mt-5">
        {list.length === 0 && (
          <EmptyState
            title={tab === 'waiting' ? 'Nothing waiting on us' : tab === 'ceo' ? 'Nothing with the CEO' : tab === 'returned' ? 'Nothing returned' : 'Nothing published yet'}
            body={tab === 'waiting' ? 'Copy a Sub Admin submits for review lands here.' : undefined}
          />
        )}
        {list.map((d) => {
          const u = author(d.authorId)
          const sig = signatureFor(d)
          return (
            <div key={d.id} className={cx('card p-5', d.status === 'returned' && 'border-warning/40')}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Chip tone="steel">{d.page}</Chip>
                    <span className="font-bold">{d.section}</span>
                    {d.needsCeo && <Chip tone="warning"><Signature size={11} /> CEO signs this one</Chip>}
                    {d.status === 'published' && <Chip tone="success"><Globe size={11} /> Live</Chip>}
                    {d.status === 'returned' && <Chip tone="warning">Returned</Chip>}
                  </div>
                  <div className="text-xs text-ink-faint mt-1 flex items-center gap-1.5">
                    {u && <Avatar name={u.name} hue={u.avatarHue} size={18} />}
                    drafted by {u?.name ?? 'a Sub Admin'} · {relTime(d.submittedAt, now)}
                  </div>
                </div>
              </div>

              <BeforeAfter draft={d} />

              {d.status === 'returned' && d.note && (
                <blockquote className="mt-3 text-[13px] text-warning bg-warning-soft rounded-xl px-3.5 py-2 border-l-2 border-warning">
                  Returned: {d.note}
                </blockquote>
              )}
              {sig && sig.status !== 'approved' && (
                <div className="mt-3 text-[13px] text-ink-muted card bg-steel-soft/50 border-0 p-3">
                  <strong className="text-ink">With the CEO for signature</strong> — raised {relTime(sig.requestedAt, now)}.
                  The page stays exactly as it is until it is signed.{' '}
                  <Link to="/ceo/approvals" className="text-ember font-semibold hover:underline">Their queue</Link>.
                </div>
              )}

              {d.status !== 'published' && (
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-line">
                  {d.needsCeo && !sig && (
                    <Button variant="secondary" size="sm"
                      onClick={() => {
                        requestCeoSignoff({
                          kind: 'content_publish', refId: d.id, amount: 0,
                          summary: `${d.page} — ${d.section}`,
                          reason: `Public copy on ${d.page.toLowerCase()}. Proposed: "${d.after}"`,
                        })
                        pushToast({ kind: 'info', title: 'Sent to the CEO', body: 'The page is unchanged until it is signed.' })
                      }}>
                      <Send size={14} /> Send for signature
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { setReturning(d); setNote(d.note ?? '') }}>
                    <CornerUpLeft size={14} /> Return with comments
                  </Button>
                  <Button size="sm" className="ml-auto"
                    onClick={() => say(publishContent(d.id), 'Published', `${d.page} — ${d.section} is live.`)}>
                    <Globe size={14} /> Publish
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="card border-l-4 border-l-steel p-4 mt-8 text-[13px] text-ink-muted">
        <strong className="text-ink">No number is ever typed into a page.</strong> Auction counts come from the auction system, money
        figures from{' '}
        <Link to="/finance/pnl" className="text-ember font-semibold hover:underline">finance</Link>, fees from{' '}
        <Link to="/admin/finance" className="text-ember font-semibold hover:underline">financial configuration</Link> — words come from
        here. A draft that hard-codes a lot count, a price or a growth statistic is returned, not published: the moment a fact is typed
        into copy it is a second version of that fact, and one of the two will be wrong.
      </div>

      <Modal open={!!returning} onClose={() => setReturning(null)} title="Return with comments">
        {returning && (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              It goes back to {author(returning.authorId)?.name ?? 'the author'} with your comment attached, and the live page does not
              change. A return without a comment is a dead end, so the comment is required.
            </p>
            <Field label="What needs changing">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="The second sentence states a fee. Link to the pricing page instead of repeating the number…" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReturning(null)}>Cancel</Button>
              <Button variant="danger" disabled={note.trim().length < 4}
                onClick={() => { if (say(returnContent(returning.id, note), 'Returned to the author')) setReturning(null) }}>
                Return
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
