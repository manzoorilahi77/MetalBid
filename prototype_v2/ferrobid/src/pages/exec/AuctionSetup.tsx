/* Executive Manager — auction scheduling board for upcoming & live catalogues. */
import { useState } from 'react'
import { Megaphone, CalendarClock } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  PageHeader, Button, Chip, StatusChip, Countdown, Modal, Field, Input, Textarea, EmptyState,
} from '../../components/ui'
import { useStore, catalogueUiStatus } from '../../store/store'
import { fmtDateTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { Catalogue } from '../../types'

const pad2 = (n: number) => String(n).padStart(2, '0')
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export default function AuctionSetup() {
  const now = useNow()
  const catalogues = useStore((s) => s.catalogues)
  const users = useStore((s) => s.users)
  const lots = useStore((s) => s.lots)
  const extendCatalogue = useStore((s) => s.extendCatalogue)
  const notify = useStore((s) => s.notify)
  const pushToast = useStore((s) => s.pushToast)

  const active = catalogues.filter((c) => c.status === 'upcoming' || c.status === 'live')
  const rest = catalogues.filter((c) => c.status === 'draft' || c.status === 'closed')

  const [editCat, setEditCat] = useState<Catalogue | null>(null)
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [annCat, setAnnCat] = useState<Catalogue | null>(null)
  const [annTitle, setAnnTitle] = useState('')
  const [annBody, setAnnBody] = useState('')

  const firm = (id: string) => users.find((u) => u.id === id)?.firm ?? '—'
  const lotCount = (c: Catalogue) => (c.lotIds.length || lots.filter((l) => l.catalogueId === c.id).length)

  const openEdit = (c: Catalogue) => {
    setEditCat(c)
    setEditStart(toLocalInput(c.startsAt))
    setEditEnd(toLocalInput(c.endsAt))
  }

  const saveSchedule = () => {
    if (!editCat) return
    if (editCat.status === 'live') {
      const deltaMin = Math.round((new Date(editEnd).getTime() - Date.parse(editCat.endsAt)) / 60_000)
      if (deltaMin !== 0) extendCatalogue(editCat.id, deltaMin)
      pushToast({
        kind: 'success', title: `${editCat.code} schedule updated`,
        body: deltaMin === 0 ? 'End time unchanged.' : `Close ${deltaMin > 0 ? 'extended' : 'advanced'} by ${Math.abs(deltaMin)} min — bidders notified.`,
      })
    } else {
      pushToast({ kind: 'success', title: 'Schedule updated (demo)', body: `${editCat.code} will run ${fmtDateTime(new Date(editStart).toISOString())} → ${fmtDateTime(new Date(editEnd).toISOString())}.` })
    }
    setEditCat(null)
  }

  const sendAnnouncement = () => {
    if (!annCat || !annTitle.trim()) return
    notify({ userId: null, kind: 'lifecycle', title: `${annCat.code} — ${annTitle.trim()}`, body: annBody.trim() || annTitle.trim(), href: `/catalogue/${annCat.id}` })
    pushToast({ kind: 'success', title: 'Announcement broadcast', body: `All participants of ${annCat.code} have been notified.` })
    setAnnCat(null); setAnnTitle(''); setAnnBody('')
  }

  return (
    <Page>
      <PageHeader title="Auction setup" sub="Schedules, anti-snipe windows and broadcast announcements for every catalogue on the calendar." />

      {active.length === 0 ? (
        <EmptyState title="No auctions scheduled" body="Publish a catalogue from the builder to see it on the calendar." />
      ) : (
        <div className="card divide-y divide-line overflow-hidden mb-8">
          {active.map((c) => {
            const ui = catalogueUiStatus(c, now)
            return (
              <div key={c.id} className="p-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                <div className="min-w-56 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="num text-xs font-bold text-ink-muted">{c.code}</span>
                    <StatusChip status={ui} />
                    {ui !== 'upcoming' && <Countdown endsAt={c.endsAt} prefix="ends" size="sm" />}
                  </div>
                  <div className="font-semibold mt-1">{c.title}</div>
                  <div className="text-xs text-ink-muted mt-0.5">{firm(c.sellerId)} · {c.region}</div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-ink-faint">Schedule</div>
                  <div className="num font-semibold">{fmtDateTime(c.startsAt)} → {fmtDateTime(c.endsAt)}</div>
                </div>
                <div className="flex gap-4 text-sm">
                  <div><div className="text-xs text-ink-faint">Anti-snipe</div><div className="num font-semibold">{c.antiSnipeMinutes} min</div></div>
                  <div><div className="text-xs text-ink-faint">Validity</div><div className="num font-semibold">{c.bidValidityDays} d</div></div>
                  <div><div className="text-xs text-ink-faint">Lots</div><div className="num font-semibold">{lotCount(c)}</div></div>
                </div>
                <div className="flex gap-2 ml-auto">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(c)}><CalendarClock size={14} /> Edit schedule</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAnnCat(c)}><Megaphone size={14} /> Announcement</Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <h2 className="font-display text-lg font-bold mb-3">Drafts & closed</h2>
      {rest.length === 0 ? (
        <EmptyState title="Nothing archived yet" />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {rest.map((c) => (
            <div key={c.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
              <span className="num text-xs font-bold text-ink-muted w-20">{c.code}</span>
              <span className="text-sm font-semibold flex-1 min-w-40 truncate">{c.title}</span>
              <span className="text-xs text-ink-faint hidden sm:block">{firm(c.sellerId)}</span>
              <span className="num text-xs text-ink-faint">{lotCount(c)} lots</span>
              <span className="num text-xs text-ink-faint hidden md:block">ended {fmtDateTime(c.endsAt)}</span>
              <StatusChip status={c.status} />
            </div>
          ))}
        </div>
      )}

      {/* edit schedule */}
      <Modal open={!!editCat} onClose={() => setEditCat(null)} title={`Edit schedule — ${editCat?.code ?? ''}`}>
        <div className="space-y-4">
          {editCat?.status === 'live' && (
            <Chip tone="warning" className="w-full justify-center h-auto py-1.5">Live auction — moving the end time extends every open lot</Chip>
          )}
          <Field label="Starts at">
            <Input type="datetime-local" value={editStart} onChange={(e) => setEditStart(e.target.value)} disabled={editCat?.status === 'live'} />
          </Field>
          <Field label="Ends at">
            <Input type="datetime-local" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditCat(null)}>Cancel</Button>
            <Button onClick={saveSchedule}>Save schedule</Button>
          </div>
        </div>
      </Modal>

      {/* announcement */}
      <Modal open={!!annCat} onClose={() => setAnnCat(null)} title={`Announcement — ${annCat?.code ?? ''}`}>
        <div className="space-y-4">
          <Field label="Title">
            <Input placeholder="e.g. Inspection hours extended on Saturday" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
          </Field>
          <Field label="Message">
            <Textarea placeholder="Details visible to all registered participants…" value={annBody} onChange={(e) => setAnnBody(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAnnCat(null)}>Cancel</Button>
            <Button variant="steel" onClick={sendAnnouncement} disabled={!annTitle.trim()}>Broadcast</Button>
          </div>
        </div>
      </Modal>
    </Page>
  )
}
