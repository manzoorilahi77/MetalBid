/* ---------------------------------------------------------------------------
   Auction Manager — announcements.

   Notices sent while a sale is running, which is why they live beside the live
   screens rather than after them. Today this is a modal buried in Auction setup
   that shows a toast and keeps no record; here what was said, to whom and when
   is the point of the screen.

   An extension, a pause and a cancellation each notify their bidders on their
   own — a notice is for what the system cannot infer.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { AlertTriangle, Info, Megaphone, Send, Siren, Users } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, EmptyState, Field, Input, PageHeader, Segmented, Select, Stat, Textarea, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDateTime, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import { ScopeNote, SectionTitle, useAuctionRows } from './shared'
import type { Announcement } from '../../types'

const SEVERITY: { key: Announcement['severity']; label: string; hint: string; icon: React.ReactNode }[] = [
  { key: 'info', label: 'Notice', hint: 'Housekeeping — a clarification, a reminder, a contact detail.', icon: <Info size={14} /> },
  { key: 'warning', label: 'Important', hint: 'Changes what a bidder should do — a timing change, a lot correction.', icon: <AlertTriangle size={14} /> },
  { key: 'critical', label: 'Urgent', hint: 'Affects the sale as it runs. Use sparingly or it stops meaning anything.', icon: <Siren size={14} /> },
]

const SEVERITY_TONE: Record<Announcement['severity'], 'neutral' | 'warning' | 'danger'> = {
  info: 'neutral', warning: 'warning', critical: 'danger',
}

export default function AuctionAnnouncements() {
  const now = useNow()
  const rows = useAuctionRows()
  const announcements = useStore((s) => s.announcements)
  const selections = useStore((s) => s.selections)
  const bids = useStore((s) => s.bids)
  const sendAnnouncement = useStore((s) => s.sendAnnouncement)
  const pushToast = useStore((s) => s.pushToast)

  const running = rows.filter((r) => r.ui === 'live' || r.ui === 'closing' || r.ui === 'upcoming')

  const [scope, setScope] = useState<'catalogue' | 'platform'>('catalogue')
  const [catalogueId, setCatalogueId] = useState(running[0]?.cat.id ?? '')
  const [severity, setSeverity] = useState<Announcement['severity']>('info')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  /** Exactly who this reaches: anyone who shortlisted a lot in the sale or bid on one. */
  const reach = (id: string) => new Set([
    ...bids.filter((b) => b.catalogueId === id && b.status === 'valid').map((b) => b.bidderId),
    ...selections.filter((x) => x.catalogueId === id).map((x) => x.buyerId),
  ]).size

  const target = rows.find((r) => r.cat.id === catalogueId)
  const audience = scope === 'catalogue' && catalogueId ? reach(catalogueId) : null

  const send = () => {
    const res = sendAnnouncement({ scope, catalogueId: scope === 'catalogue' ? catalogueId : undefined, title, body, severity })
    if (!res.ok) {
      pushToast({ kind: 'danger', title: 'Not sent', body: res.error })
      return
    }
    pushToast({
      kind: 'success', title: 'Notice sent',
      body: scope === 'catalogue'
        ? `${num(audience ?? 0)} bidder${audience === 1 ? '' : 's'} on ${target?.cat.code ?? 'this auction'} have it now.`
        : 'Broadcast to every user and posted to the noticeboard.',
    })
    setTitle('')
    setBody('')
    setSeverity('info')
  }

  const canSend = title.trim().length > 2 && body.trim().length > 4 && (scope === 'platform' || !!catalogueId)

  return (
    <Page>
      <PageHeader
        title="Announcements"
        sub="Say something to the bidders in one sale, or to everyone. Every notice is kept, with who sent it and when."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Sent" value={num(announcements.length)} sub="All notices on record" />
        <Stat label="Auction-scoped" value={num(announcements.filter((a) => a.scope === 'catalogue').length)} tone="steel" sub="Reached one sale's bidders" />
        <Stat label="Platform-wide" value={num(announcements.filter((a) => a.scope === 'platform').length)} sub="Everyone, plus the noticeboard" />
        <Stat label="Urgent" value={num(announcements.filter((a) => a.severity === 'critical').length)} tone={announcements.some((a) => a.severity === 'critical') ? 'danger' : undefined} sub="Keep this number low" />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-5 items-start">
        {/* ------------------------------ history ------------------------------ */}
        <div>
          <SectionTitle title="What has been sent" count={announcements.length} sub="Newest first." />
          {announcements.length === 0 ? (
            <EmptyState
              icon={<Megaphone size={32} strokeWidth={1.5} />}
              title="Nothing has been announced"
              body="Notices you send appear here with their audience and the time they went out."
            />
          ) : (
            <div className="space-y-3">
              {announcements.map((a, i) => {
                const cat = a.catalogueId ? rows.find((r) => r.cat.id === a.catalogueId) : undefined
                /* Severity is stated in words by the chip below, so the card itself
                   stays plain — only an urgent notice earns a tinted border, which
                   keeps that signal worth something. */
                return (
                  <div key={a.id}
                    className={cx('card p-4 animate-fade-up', a.severity === 'critical' && 'border-danger/40 bg-danger-soft/20')}
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Chip tone={SEVERITY_TONE[a.severity]}>
                            {SEVERITY.find((s) => s.key === a.severity)?.label}
                          </Chip>
                          {a.scope === 'catalogue' && cat
                            ? <span className="num text-xs font-bold text-ember">{cat.cat.code}</span>
                            : <Chip tone="neutral">Everyone</Chip>}
                        </div>
                        <div className="font-display font-bold text-base mt-1.5">{a.title}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="num text-[11px] text-ink-faint">{fmtDateTime(a.at)}</div>
                        <div className="text-[11px] text-ink-faint">{relTime(a.at, now)}</div>
                      </div>
                    </div>
                    <p className="text-[13px] text-ink-muted mt-1.5 whitespace-pre-line">{a.body}</p>
                    {a.scope === 'catalogue' && cat && (
                      <div className="mt-2.5 pt-2.5 border-t border-line text-[11px] text-ink-faint flex items-center gap-1.5">
                        <Users size={11} /> Sent to the bidders on {cat.cat.title}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ------------------------------ compose ------------------------------ */}
        <div className="lg:sticky lg:top-32 space-y-4">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-line bg-surface-2/60 flex items-center gap-2">
              <Megaphone size={15} className="text-ember" />
              <span className="font-bold text-sm">Write a notice</span>
            </div>
            <div className="p-4 space-y-4">
              <Segmented stretch value={scope} onChange={setScope} options={[
                { key: 'catalogue', label: 'One auction' },
                { key: 'platform', label: 'Everyone' },
              ]} />

              {scope === 'catalogue' && (
                <Field label="Auction" hint={audience !== null ? `Reaches ${num(audience)} bidder${audience === 1 ? '' : 's'} — everyone who shortlisted a lot or bid on one.` : undefined}>
                  <Select value={catalogueId} onChange={(e) => setCatalogueId(e.target.value)}>
                    <option value="">Pick an auction…</option>
                    {running.map((r) => (
                      <option key={r.cat.id} value={r.cat.id}>{r.cat.code} — {r.cat.title}</option>
                    ))}
                  </Select>
                </Field>
              )}

              <Field label="How urgent is it?">
                <div className="grid grid-cols-3 gap-2">
                  {SEVERITY.map((s) => (
                    <button key={s.key} type="button" onClick={() => setSeverity(s.key)}
                      className={cx('h-10 rounded-xl border text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors',
                        severity === s.key
                          ? s.key === 'critical' ? 'border-danger bg-danger-soft text-danger'
                            : s.key === 'warning' ? 'border-warning bg-warning-soft text-warning'
                              : 'border-steel bg-steel-soft text-steel-strong'
                          : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink')}>
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-ink-faint mt-1.5">{SEVERITY.find((s) => s.key === severity)?.hint}</p>
              </Field>

              <Field label="Headline" hint="It arrives as a notification title — make it readable at a glance.">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
                  placeholder="e.g. LOT-06 photographs corrected" />
              </Field>

              <Field label="Message">
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4}
                  placeholder="e.g. The photographs on LOT-06 showed the adjacent stack. Corrected images are on the catalogue now. Quantity and grade are unchanged." />
              </Field>

              <Button className="w-full" size="lg" disabled={!canSend} onClick={send}>
                <Send size={16} />
                {scope === 'catalogue'
                  ? `Send to ${audience !== null ? num(audience) : ''} bidder${audience === 1 ? '' : 's'}`.replace('  ', ' ')
                  : 'Broadcast to everyone'}
              </Button>
            </div>
          </div>

          <ScopeNote>
            Pausing, extending and cancelling already tell the bidders they affect, automatically and with your reason —
            you do not need to write a notice for those.
          </ScopeNote>
        </div>
      </div>
    </Page>
  )
}
