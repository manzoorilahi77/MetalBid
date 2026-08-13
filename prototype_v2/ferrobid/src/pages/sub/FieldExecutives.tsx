/* ---------------------------------------------------------------------------
   Sub Admin — Field executives.

   Managing the field team is one job with two halves that used to live nowhere:
   seeing who is carrying what, and moving a catalogue from one of them to
   another. Assignment happened inside the pipeline screen, one catalogue at a
   time, with no view of anyone's load — so the same executive kept getting the
   next one.

   Held with the Operation Manager. The unit of work is a catalogue, not a lot:
   an executive visits a yard once and inspects everything in it.
--------------------------------------------------------------------------- */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightLeft, HardHat, MapPin, Phone } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Avatar, Button, Chip, EmptyState, Field, Modal, PageHeader, ProgressBar, Select, Stat,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDate, num, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { Catalogue, User } from '../../types'

/** A catalogue is "on someone's plate" until every lot in it has been through
 *  inspection — the executive's work is done when nothing is still waiting. */
const OPEN_STATUSES = new Set(['draft', 'upcoming'])

export default function FieldExecutives() {
  const now = useNow()
  const users = useStore((s) => s.users)
  const catalogues = useStore((s) => s.catalogues)
  const lots = useStore((s) => s.lots)
  const inspectionReports = useStore((s) => s.inspectionReports)
  const assignCatalogue = useStore((s) => s.assignCatalogue)
  const pushToast = useStore((s) => s.pushToast)

  const [moving, setMoving] = useState<Catalogue | null>(null)
  const [moveTo, setMoveTo] = useState('')

  const execs = users.filter((u) => u.role === 'field_exec')
  const openCats = catalogues.filter((c) => OPEN_STATUSES.has(c.status))
  const unassigned = openCats.filter((c) => !c.assignedFieldExecId)

  /** One executive's load: the catalogues on them, and how far through each is. */
  const loadFor = (execId: string) => {
    const theirs = openCats.filter((c) => c.assignedFieldExecId === execId)
    const rows = theirs.map((c) => {
      const catLots = lots.filter((l) => l.catalogueId === c.id)
      const done = catLots.filter((l) => l.status !== 'pending_inspection').length
      return { cat: c, total: catLots.length, done }
    })
    const lastReport = inspectionReports
      .filter((r) => r.inspectorId === execId)
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0]
    return {
      rows,
      lots: rows.reduce((t, r) => t + r.total, 0),
      remaining: rows.reduce((t, r) => t + (r.total - r.done), 0),
      lastReport,
    }
  }

  const busiest = execs.length
    ? execs.map((e) => loadFor(e.id).remaining).reduce((a, b) => Math.max(a, b), 0)
    : 0

  const move = () => {
    if (!moving || !moveTo) return
    const to = users.find((u) => u.id === moveTo)
    assignCatalogue(moving.id, moveTo)
    pushToast({
      kind: 'success',
      title: `${moving.code} re-assigned`,
      body: `${to?.name ?? 'Field executive'} now has the yard visit. They have been told, and so has whoever had it before.`,
    })
    setMoving(null)
    setMoveTo('')
  }

  const openMove = (c: Catalogue) => {
    setMoving(c)
    setMoveTo('')
  }

  const execCard = (e: User) => {
    const load = loadFor(e.id)
    return (
      <section key={e.id} className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-line">
          <Avatar name={e.name} hue={e.avatarHue} size={40} />
          <div className="flex-1 min-w-40">
            <div className="font-display font-bold">{e.name}</div>
            <div className="text-xs text-ink-muted flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
              <span className="inline-flex items-center gap-1"><MapPin size={11} /> {e.city}</span>
              <span className="num inline-flex items-center gap-1"><Phone size={11} /> {e.phone}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="num font-display text-2xl font-bold">{num(load.remaining)}</div>
            <div className="text-xs text-ink-faint">lots still to inspect</div>
          </div>
        </div>

        {load.rows.length === 0 ? (
          <p className="px-5 py-5 text-sm text-ink-muted">
            Nothing on them. {unassigned.length > 0
              ? 'There are catalogues below with nobody on them.'
              : 'Every open catalogue already has someone.'}
          </p>
        ) : (
          <ul>
            {load.rows.map(({ cat, total, done }) => (
              <li key={cat.id} className="px-5 py-3.5 border-b border-line last:border-0">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-44">
                    <Link to={`/field/catalogue/${cat.id}`} className="font-semibold text-sm hover:text-ember">
                      <span className="num text-xs font-bold text-ember mr-2">{cat.code}</span>{cat.title}
                    </Link>
                    <div className="text-xs text-ink-faint mt-0.5">
                      {cat.yardName} · {cat.region} · window {fmtDate(cat.inspectionFrom)} – {fmtDate(cat.inspectionTo)}
                    </div>
                  </div>
                  <Chip tone={done === total ? 'success' : done === 0 ? 'warning' : 'steel'} className="num">
                    {num(done)}/{num(total)} inspected
                  </Chip>
                  <Button variant="ghost" size="sm" onClick={() => openMove(cat)}>
                    <ArrowRightLeft size={13} /> Re-assign
                  </Button>
                </div>
                <ProgressBar value={done} max={Math.max(total, 1)} tone={done === total ? 'success' : 'ember'} className="mt-2.5" />
              </li>
            ))}
          </ul>
        )}

        <div className="px-5 py-3 bg-surface-2 border-t border-line text-xs text-ink-muted">
          {load.lastReport
            ? <>Last report filed {relTime(load.lastReport.date, now)}.</>
            : <>No inspection report on record yet.</>}
          {load.remaining > 0 && load.remaining === busiest && execs.length > 1 && (
            <span className="text-warning font-semibold"> · carrying the most right now</span>
          )}
        </div>
      </section>
    )
  }

  return (
    <Page>
      <PageHeader
        title="Field executives"
        sub="Who is carrying what, and where the next yard visit should go. An executive visits a yard once and inspects everything in it — so the unit here is a catalogue, not a lot."
        actions={unassigned.length > 0
          ? <Chip tone="warning">{num(unassigned.length)} unassigned</Chip>
          : <Chip tone="success">Everything assigned</Chip>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Field executives" value={num(execs.length)} sub="On the roster" />
        <Stat label="Catalogues in the field" value={num(openCats.filter((c) => c.assignedFieldExecId).length)} tone="steel" sub="Assigned and open" />
        <Stat label="Unassigned" value={num(unassigned.length)} tone={unassigned.length ? 'danger' : undefined} sub="Nobody has these yet" />
        <Stat
          label="Lots awaiting inspection"
          value={num(lots.filter((l) => l.status === 'pending_inspection').length)}
          sub="Across the whole pipeline"
          to="/exec"
        />
      </div>

      {/* --------------------------- nobody on these ------------------------- */}
      {unassigned.length > 0 && (
        <section className="card overflow-hidden mb-4 border-warning/40">
          <div className="px-5 py-4 border-b border-line flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <HardHat size={18} className="text-warning" /> Nobody is on these yet
            </h2>
            <Chip tone="warning" className="num">{num(unassigned.length)}</Chip>
          </div>
          <ul>
            {unassigned.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-line last:border-0">
                <div className="flex-1 min-w-48">
                  <Link to={`/catalogue/${c.id}`} className="font-semibold text-sm hover:text-ember">
                    <span className="num text-xs font-bold text-ember mr-2">{c.code}</span>{c.title}
                  </Link>
                  <div className="text-xs text-ink-faint mt-0.5">
                    {c.yardName} · {c.region} · {num(lots.filter((l) => l.catalogueId === c.id).length)} lots
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => openMove(c)}>Assign someone</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ------------------------------ the roster ---------------------------- */}
      {execs.length === 0 ? (
        <EmptyState
          title="No field executives on the roster"
          body="Field executive accounts are created by a Super Admin. Until one exists, every lot has to be bypassed rather than inspected — and a bypass is on the record."
        />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {execs.map(execCard)}
        </div>
      )}

      {/* ----------------------------- assign modal --------------------------- */}
      <Modal open={!!moving} onClose={() => setMoving(null)} title={`Assign ${moving?.code ?? ''}`}>
        {moving && (
          <div className="space-y-4">
            <div className="card bg-surface-2 p-3.5 text-sm">
              <div className="font-semibold">{moving.title}</div>
              <div className="text-xs text-ink-muted mt-1">
                {moving.yardName} · {moving.region} · {num(lots.filter((l) => l.catalogueId === moving.id).length)} lots ·
                {' '}window {fmtDate(moving.inspectionFrom)} – {fmtDate(moving.inspectionTo)}
              </div>
              {moving.assignedFieldExecId && (
                <div className="text-xs text-ink-faint mt-1.5">
                  Currently with {users.find((u) => u.id === moving.assignedFieldExecId)?.name ?? 'someone'} —
                  re-assigning tells them both.
                </div>
              )}
            </div>
            <Field label="Field executive" hint="Their current load is shown beside each name.">
              <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                <option value="">Choose…</option>
                {execs.map((e) => {
                  const l = loadFor(e.id)
                  return (
                    <option key={e.id} value={e.id} disabled={e.id === moving.assignedFieldExecId}>
                      {e.name} — {l.rows.length} catalogue{l.rows.length === 1 ? '' : 's'}, {l.remaining} lots left
                      {e.id === moving.assignedFieldExecId ? ' (has it now)' : ''}
                    </option>
                  )
                })}
              </Select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMoving(null)}>Cancel</Button>
              <Button disabled={!moveTo} onClick={move}>
                {moving.assignedFieldExecId ? 'Re-assign' : 'Assign'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Page>
  )
}
