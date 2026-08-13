/* ---------------------------------------------------------------------------
   Super Admin — Change history & rollback.

   The undo. Every structural change in time order, with what it looked like
   before and after, and three ways back: undo one change, restore the whole
   structure to a point in time, or compare two points before deciding.

   The line this screen will not cross is the reason it can be this fast:
   **business data is never rolled back.** Auctions, bids, payments, invoices
   and audit entries are outside the snapshot entirely. What rolls back is the
   shape of the platform — roles, menus, the vocabularies catalogues are built
   from and the copy on the public site — which is exactly the set of things
   that otherwise needs an emergency release.

   Three kinds are recorded here but deliberately not reversible from here, and
   each says so on its own row: a password cannot be un-issued, a suspension is
   lifted on the account itself, and a rate is put back where rates are set —
   through the CEO's signature, which is the whole reason it moved.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, GitCompare, History, RotateCcw, Undo2 } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, EmptyState, Modal, PageHeader, Segmented, Select, Stat, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import { fmtDateTime, relTime } from '../../lib/format'
import { useNow } from '../../lib/useTick'
import type { StructuralChange, StructuralChangeKind } from '../../types'

const KIND_LABEL: Record<StructuralChangeKind, string> = {
  'role.add': 'Role added', 'role.remove': 'Role removed', 'role.duplicate': 'Role duplicated', 'role.restore': 'Role restored',
  'page.rename': 'Page renamed', 'page.visibility': 'Page shown / hidden', 'page.reorder': 'Menu reordered',
  'page.attach': 'Page attached', 'page.detach': 'Page detached', 'page.add': 'Sub-page added',
  'account.create': 'Account created', 'account.status': 'Account status', 'account.password_reset': 'Password reset',
  'account.edit': 'Account details edited', 'config.update': 'Financial configuration',
  'content.publish': 'Content published', 'content.return': 'Content returned',
  'master.add': 'Master data added', 'master.edit': 'Master data edited', 'master.deactivate': 'Master data retired',
  'master.terms_version': 'New terms version',
  'structure.rollback': 'Rolled back',
}

/** Why a given row has no undo button. Saying "nothing to roll back" to
 *  someone looking at a password reset is technically true and useless; each of
 *  these says where the correction is actually made instead. */
const NOT_REVERSIBLE: Partial<Record<StructuralChangeKind, string>> = {
  'account.password_reset': 'A password cannot be un-issued — reset it again from the account',
  'account.create': 'An account is never deleted — disable it from Sub Admin accounts',
  'account.status': 'Lifted on the account itself, so the reason is recorded with it',
  'account.edit': 'Correct it again on the account — each correction is its own entry',
  'config.update': 'A rate is put back where rates are set, and the fee half needs the CEO again',
  'master.terms_version': 'A version a buyer accepted cannot be un-issued — supersede it with another',
}

const groupOf = (k: StructuralChangeKind): 'structure' | 'people' | 'content' | 'data' =>
  k.startsWith('role.') || k.startsWith('page.') || k === 'structure.rollback' ? 'structure'
    : k.startsWith('account.') ? 'people'
      : k.startsWith('content.') ? 'content' : 'data'

const groupTone = { structure: 'ember', people: 'steel', content: 'success', data: 'neutral' } as const

type Filter = 'all' | 'structure' | 'people' | 'content' | 'data'

export default function ChangeHistory() {
  const now = useNow()
  const changes = useStore((s) => s.structuralChanges)
  const users = useStore((s) => s.users)
  const roles = useStore((s) => s.roleRegistry)
  const pages = useStore((s) => s.pageRegistry)
  const undoStructuralChange = useStore((s) => s.undoStructuralChange)
  const restoreStructureTo = useStore((s) => s.restoreStructureTo)
  const pushToast = useStore((s) => s.pushToast)

  const [filter, setFilter] = useState<Filter>('all')
  const [restoring, setRestoring] = useState<StructuralChange | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [pointA, setPointA] = useState('')
  const [pointB, setPointB] = useState('')

  const list = changes.filter((c) => filter === 'all' || groupOf(c.kind) === filter)
  const reversible = changes.filter((c) => c.snapshot && !c.undoneAt)
  const points = changes.filter((c) => c.snapshot)

  const who = (id: string) => users.find((u) => u.id === id)?.name ?? id

  /* Two points in time, and what is different between them — roles that came or
     went, and menu entries that were added, dropped, renamed or hidden. */
  const diff = useMemo(() => {
    const a = points.find((c) => c.id === pointA)?.snapshot
    const b = pointB === 'now'
      ? { roles, pages }
      : points.find((c) => c.id === pointB)?.snapshot
    if (!a || !b) return null
    const aRoles = new Set(a.roles.filter((r) => r.status === 'active').map((r) => r.key))
    const bRoles = new Set(b.roles.filter((r) => r.status === 'active').map((r) => r.key))
    const aPages = new Map(a.pages.map((p) => [p.id, p]))
    const bPages = new Map(b.pages.map((p) => [p.id, p]))
    const label = (k: string) => b.roles.find((r) => r.key === k)?.label ?? a.roles.find((r) => r.key === k)?.label ?? k
    return {
      rolesGained: [...bRoles].filter((k) => !aRoles.has(k)).map(label),
      rolesLost: [...aRoles].filter((k) => !bRoles.has(k)).map(label),
      pagesAdded: [...bPages.values()].filter((p) => !aPages.has(p.id)).map((p) => `${label(p.roleKey)} · ${p.label}`),
      pagesRemoved: [...aPages.values()].filter((p) => !bPages.has(p.id)).map((p) => `${label(p.roleKey)} · ${p.label}`),
      pagesChanged: [...bPages.values()]
        .filter((p) => {
          const before = aPages.get(p.id)
          return before && (before.label !== p.label || before.hidden !== p.hidden || before.order !== p.order)
        })
        .map((p) => {
          const before = aPages.get(p.id)!
          const bits = [
            before.label !== p.label ? `"${before.label}" → "${p.label}"` : null,
            before.hidden !== p.hidden ? (p.hidden ? 'hidden' : 'shown') : null,
            before.order !== p.order ? `moved to position ${p.order + 1}` : null,
          ].filter(Boolean)
          return `${label(p.roleKey)} · ${bits.join(', ')}`
        }),
    }
  }, [pointA, pointB, points, roles, pages])

  const say = (r: { ok: boolean; error?: string }, title: string, body?: string) => {
    if (!r.ok) pushToast({ kind: 'danger', title: 'Not rolled back', body: r.error })
    else pushToast({ kind: 'success', title, body })
    return r.ok
  }

  return (
    <Page>
      <PageHeader
        title="Change history & rollback"
        sub="Every structural change in time order, with what it looked like before and after. Undo one, or put the whole structure back to a point in time."
        actions={<Button variant="secondary" onClick={() => { setPointA(points[Math.min(1, points.length - 1)]?.id ?? ''); setPointB('now'); setCompareOpen(true) }}>
          <GitCompare size={15} /> Compare two points
        </Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Changes recorded" value={changes.length} />
        <Stat label="Reversible right now" value={reversible.length} tone="ember" sub="roles · menus · vocabularies · copy" />
        <Stat label="Already undone" value={changes.filter((c) => c.undoneAt).length} />
        <Stat label="Restore points" value={points.length} tone="steel" />
      </div>

      <Segmented<Filter> value={filter} onChange={setFilter} options={[
        { key: 'all', label: `All ${changes.length}` },
        { key: 'structure', label: `Roles & pages ${changes.filter((c) => groupOf(c.kind) === 'structure').length}` },
        { key: 'people', label: `Accounts ${changes.filter((c) => groupOf(c.kind) === 'people').length}` },
        { key: 'content', label: `Content ${changes.filter((c) => groupOf(c.kind) === 'content').length}` },
        { key: 'data', label: `Master data ${changes.filter((c) => groupOf(c.kind) === 'data').length}` },
      ]} />

      <div className="mt-5">
        {list.length === 0 && <EmptyState icon={<History size={28} />} title="Nothing changed yet" body="Anything you change in Roles, Page manager, accounts, content or master data is recorded here." />}
        <ol className="relative border-l-2 border-line ml-2">
          {list.map((c) => {
            const g = groupOf(c.kind)
            return (
              <li key={c.id} className="relative pl-6 pb-6 last:pb-0">
                <span className={cx('absolute -left-[7px] top-1.5 size-3 rounded-full ring-4 ring-canvas',
                  c.undoneAt ? 'bg-ink-faint' : g === 'structure' ? 'bg-ember' : g === 'people' ? 'bg-steel' : 'bg-success')} />
                <div className={cx('card p-4', c.undoneAt && 'opacity-60')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={groupTone[g]}>{KIND_LABEL[c.kind]}</Chip>
                    <span className="font-semibold text-sm">{c.target}</span>
                    {c.undoneAt && <Chip tone="neutral">Undone {relTime(c.undoneAt, now)}</Chip>}
                    <span className="num text-xs text-ink-faint ml-auto">{fmtDateTime(c.at)}</span>
                  </div>
                  <p className="text-[13px] text-ink-muted mt-1.5">{c.summary}</p>

                  {(c.before || c.after) && (
                    <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[13px]">
                      <span className="num px-2 py-1 rounded-lg bg-surface-2 text-ink-muted line-through decoration-ink-faint">{c.before ?? '—'}</span>
                      <ArrowRight size={13} className="text-ink-faint" />
                      <span className="num px-2 py-1 rounded-lg bg-success-soft text-ink font-semibold">{c.after ?? '—'}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-line">
                    <span className="text-xs text-ink-faint">by <span className="font-semibold text-ink-muted">{who(c.byId)}</span></span>
                    {c.snapshot && !c.undoneAt && (
                      <>
                        <Button variant="ghost" size="sm" className="ml-auto"
                          onClick={() => say(undoStructuralChange(c.id), 'Undone', `${c.target} is back as it was.`)}>
                          <Undo2 size={14} /> Undo this change
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRestoring(c)}>
                          <RotateCcw size={14} /> Restore to here
                        </Button>
                      </>
                    )}
                    {!c.snapshot && (
                      <span className="text-xs text-ink-faint ml-auto text-right">{NOT_REVERSIBLE[c.kind] ?? 'On the record — corrected on its own screen rather than reversed from here'}</span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="card border-l-4 border-l-danger p-4 mt-8 text-[13px] text-ink-muted">
        <strong className="text-ink">What rollback never touches.</strong> Auctions, bids, payments, invoices and the{' '}
        <Link to="/admin/audit" className="text-ember font-semibold hover:underline">audit trail</Link> are outside every snapshot on
        this page. Undoing a change puts a role, a menu, a vocabulary or a page of copy back; it does not un-sell a lot, un-take a
        payment or erase the record that any of it happened — the undo itself is written to the audit trail as a further entry.
        Passwords, account status and financial configuration are listed here for the history and corrected where they were set;
        each row says which.
      </div>

      {/* ------------------------- restore to a point ------------------------- */}
      <Modal open={!!restoring} onClose={() => setRestoring(null)} title="Restore the structure to this point?">
        {restoring && (
          <div className="space-y-4">
            <div className="card bg-warning-soft border-0 p-4 text-sm">
              Roles and menus go back to how they stood at <b>{fmtDateTime(restoring.at)}</b>, immediately before "{restoring.summary}".
              Every structural change made since is marked undone. <b>No auction, bid, payment or audit entry is touched.</b>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRestoring(null)}>Cancel</Button>
              <Button variant="danger"
                onClick={() => { if (say(restoreStructureTo(restoring.id), 'Structure restored', 'The menus you are looking at have already moved.')) setRestoring(null) }}>
                Restore
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ------------------------------ compare ------------------------------ */}
      <Modal open={compareOpen} onClose={() => setCompareOpen(false)} title="Compare two points" wide>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-1.5">From</div>
              <Select value={pointA} onChange={(e) => setPointA(e.target.value)}>
                <option value="">Pick a point…</option>
                {points.map((c) => <option key={c.id} value={c.id}>{fmtDateTime(c.at)} — before {KIND_LABEL[c.kind].toLowerCase()}</option>)}
              </Select>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-1.5">To</div>
              <Select value={pointB} onChange={(e) => setPointB(e.target.value)}>
                <option value="now">Now</option>
                {points.map((c) => <option key={c.id} value={c.id}>{fmtDateTime(c.at)} — before {KIND_LABEL[c.kind].toLowerCase()}</option>)}
              </Select>
            </div>
          </div>

          {!diff && <p className="text-sm text-ink-faint">Pick two points to see what moved between them.</p>}
          {diff && (
            <div className="space-y-3 text-sm">
              {([
                ['Roles added', diff.rolesGained, 'success'],
                ['Roles removed', diff.rolesLost, 'danger'],
                ['Menu entries added', diff.pagesAdded, 'success'],
                ['Menu entries removed', diff.pagesRemoved, 'danger'],
                ['Menu entries changed', diff.pagesChanged, 'warning'],
              ] as const).map(([title, rows, tone]) => (
                <div key={title} className="card bg-surface-2 border-0 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-bold text-[13px]">{title}</span>
                    <Chip tone={rows.length ? tone : 'neutral'} className="num">{rows.length}</Chip>
                  </div>
                  {rows.length === 0
                    ? <p className="text-[13px] text-ink-faint">Nothing.</p>
                    : <ul className="text-[13px] text-ink-muted list-disc pl-5 space-y-1">{rows.map((r, i) => <li key={i}>{r}</li>)}</ul>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </Page>
  )
}
