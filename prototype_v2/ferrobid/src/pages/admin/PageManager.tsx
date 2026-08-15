/* ---------------------------------------------------------------------------
   Super Admin — Page manager.

   The most common support request and the least worth a release: rename a tab,
   hide one a role should not see, put the menu back in the order the work
   actually happens, or lend a screen to a second role.

   This screen edits the registry the whole app renders its navigation from, so
   a change here moves the top bar and the tab strip immediately — no reload, no
   deploy. What it deliberately cannot do: change what a page *does*, hide the
   only route into a live auction, or take away a record a role must retain.
--------------------------------------------------------------------------- */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Eye, EyeOff, Link2, Pencil, Plus, Unlink } from 'lucide-react'
import { Page } from '../../layout/Chrome'
import {
  Button, Chip, Field, Input, Modal, PageHeader, Select, Stat, cx,
} from '../../components/ui'
import { useStore } from '../../store/store'
import type { PageDef } from '../../types'

export default function PageManager() {
  const roles = useStore((s) => s.roleRegistry)
  const pages = useStore((s) => s.pageRegistry)
  const renamePage = useStore((s) => s.renamePage)
  const setPageHidden = useStore((s) => s.setPageHidden)
  const movePage = useStore((s) => s.movePage)
  const attachPage = useStore((s) => s.attachPage)
  const detachPage = useStore((s) => s.detachPage)
  const addSubPage = useStore((s) => s.addSubPage)
  const pushToast = useStore((s) => s.pushToast)

  const activeRoles = roles.filter((r) => r.status === 'active')
  const [roleKey, setRoleKey] = useState('super_admin')
  const [renaming, setRenaming] = useState<PageDef | null>(null)
  const [label, setLabel] = useState('')
  const [attaching, setAttaching] = useState<PageDef | null>(null)
  const [attachTo, setAttachTo] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [newPage, setNewPage] = useState({ label: '', to: '' })

  const menu = useMemo(
    () => pages.filter((p) => p.roleKey === roleKey).sort((a, b) => a.order - b.order),
    [pages, roleKey],
  )
  const role = activeRoles.find((r) => r.key === roleKey)
  const hidden = menu.filter((p) => p.hidden).length
  /** How many headings this role's tab strip renders. Zero means one flat
   *  strip — the shape every role had before the operations menus grew past
   *  what a single row of tabs can show. */
  const categories = new Set(menu.filter((p) => p.category).map((p) => p.category)).size

  const say = (r: { ok: boolean; error?: string }, title: string, body?: string) => {
    if (!r.ok) pushToast({ kind: 'danger', title: 'Not changed', body: r.error })
    else pushToast({ kind: 'success', title, body })
    return r.ok
  }

  const th = 'text-left text-[11px] uppercase tracking-wider text-ink-faint border-b border-line'

  return (
    <Page>
      <PageHeader
        title="Page manager"
        sub="Rename a tab, hide it for a role, reorder the menu, or attach a screen to a second role. Changes are live the moment you make them — the tab strip above will move."
        actions={<Button variant="secondary" onClick={() => { setNewPage({ label: '', to: '' }); setAddOpen(true) }}><Plus size={15} /> Add a sub-page</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Roles with a menu" value={new Set(pages.map((p) => p.roleKey)).size} />
        <Stat label="Menu entries" value={pages.length} tone="steel" />
        <Stat label="Hidden across the platform" value={pages.filter((p) => p.hidden).length} tone={pages.some((p) => p.hidden) ? 'warning' : undefined} />
        <Stat label="Attached from another role" value={pages.filter((p) => p.attachedFrom).length} sub="one screen, two menus" />
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-ink-muted">Menu for</span>
        <Select className="h-9 w-64 text-[13px]" value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
          {activeRoles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </Select>
        <span className="num text-xs text-ink-faint">
          {menu.length} entr{menu.length === 1 ? 'y' : 'ies'}
          {categories > 0 && ` in ${categories} categor${categories === 1 ? 'y' : 'ies'}`}
          {hidden > 0 && ` · ${hidden} hidden`}
        </span>
        <Link to="/admin/roles" className="text-[13px] font-semibold text-ember hover:underline ml-auto">Roles →</Link>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[980px]">
          <thead>
            <tr className={th}>
              <th className="px-5 py-2.5 w-10">#</th>
              <th className="px-4 py-2.5">Tab label</th>
              <th className="px-4 py-2.5">Category</th>
              <th className="px-4 py-2.5">Route</th>
              <th className="px-4 py-2.5">Where it shows</th>
              <th className="px-4 py-2.5">State</th>
              <th className="px-4 py-2.5 text-right">Order</th>
              <th className="px-4 py-2.5 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {menu.map((p, i) => (
              <tr key={p.id} className={cx('hover:bg-surface-2/60', p.hidden && 'opacity-60')}>
                <td className="px-5 py-2.5 num text-ink-faint">{i + 1}</td>
                <td className="px-4 py-2.5">
                  <div className="font-semibold">{p.label}</div>
                  {p.subLabel && p.subLabel !== p.label && <div className="text-xs text-ink-faint">tab strip: {p.subLabel}</div>}
                </td>
                <td className="px-4 py-2.5">
                  {p.category
                    ? <Chip tone="neutral">{p.category}</Chip>
                    : <span className="text-xs text-ink-faint">—</span>}
                </td>
                <td className="px-4 py-2.5 num text-ink-muted">{p.to}</td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1.5">
                    {p.inTop && <Chip tone="ember">Top bar</Chip>}
                    {p.inSub && <Chip tone="steel">Tab strip</Chip>}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1.5 flex-wrap">
                    {p.hidden ? <Chip tone="warning">Hidden</Chip> : <Chip tone="success">Visible</Chip>}
                    {p.retained && <Chip tone="neutral">Must retain</Chip>}
                    {p.locked && <Chip tone="neutral">Read-only</Chip>}
                    {p.attachedFrom && <Chip tone="steel">attached</Chip>}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" disabled={i === 0} aria-label="Move up"
                    onClick={() => say(movePage(p.id, -1), 'Menu reordered')}><ArrowUp size={14} /></Button>
                  <Button variant="ghost" size="sm" disabled={i === menu.length - 1} aria-label="Move down"
                    onClick={() => say(movePage(p.id, 1), 'Menu reordered')}><ArrowDown size={14} /></Button>
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" onClick={() => { setRenaming(p); setLabel(p.label) }}><Pencil size={14} /> Rename</Button>
                  <Button variant="ghost" size="sm"
                    onClick={() => say(setPageHidden(p.id, !p.hidden), p.hidden ? `"${p.label}" is back on the menu` : `"${p.label}" hidden for ${role?.label}`)}>
                    {p.hidden ? <><Eye size={14} /> Show</> : <><EyeOff size={14} /> Hide</>}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setAttaching(p); setAttachTo('') }}><Link2 size={14} /> Attach</Button>
                  {!p.builtIn && (
                    <Button variant="ghost" size="sm" className="text-danger"
                      onClick={() => say(detachPage(p.id), `"${p.label}" detached`)}><Unlink size={14} /></Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card border-l-4 border-l-steel p-4 mt-6 text-[13px] text-ink-muted">
        <strong className="text-ink">Rearranging a menu never changes what a page does.</strong> Hiding a tab takes it off this role's
        navigation; the screen, its data and everyone else's access are untouched. Three things are refused outright: hiding a role's
        last remaining page, hiding the route into an auction that is running right now, and taking away a record a role must retain.
        Every change lands in{' '}
        <Link to="/admin/change-history" className="text-ember font-semibold hover:underline">Change history</Link> with an undo.
      </div>

      {/* ------------------------------ rename ------------------------------ */}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Rename this tab">
        {renaming && (
          <div className="space-y-4">
            <div className="card bg-surface-2 border-0 p-3.5 text-[13px] grid grid-cols-2 gap-y-1">
              <span className="text-ink-muted">Role</span><span className="font-semibold">{role?.label}</span>
              <span className="text-ink-muted">Route</span><span className="num font-semibold">{renaming.to}</span>
            </div>
            <Field label="Tab label" hint="What the person holding this role reads on the menu. Keep it under 32 characters.">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </Field>
            <Button className="w-full" disabled={!label.trim()}
              onClick={() => { if (say(renamePage(renaming.id, label), 'Tab renamed', `"${renaming.label}" → "${label.trim()}"`)) setRenaming(null) }}>
              Rename
            </Button>
          </div>
        )}
      </Modal>

      {/* ------------------------------ attach ------------------------------ */}
      <Modal open={!!attaching} onClose={() => setAttaching(null)} title={`Attach "${attaching?.label}" to another role`}>
        {attaching && (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              One screen, two menus — not a second copy of it. Both roles work the same records, and whoever acts is still named in the
              audit entry. That is how Schedule &amp; publish is already held by Operations, the Auction Manager and a Sub Admin at once.
            </p>
            <Field label="Add it to">
              <Select value={attachTo} onChange={(e) => setAttachTo(e.target.value)}>
                <option value="">Pick a role…</option>
                {activeRoles.filter((r) => r.key !== attaching.roleKey).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </Select>
            </Field>
            <Button className="w-full" disabled={!attachTo}
              onClick={() => {
                const target = activeRoles.find((r) => r.key === attachTo)
                if (say(attachPage(attaching.id, attachTo), `Attached to ${target?.label}`, 'It appears at the end of their tab strip.')) setAttaching(null)
              }}>
              Attach
            </Button>
          </div>
        )}
      </Modal>

      {/* ---------------------------- add sub-page ---------------------------- */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={`Add a sub-page to ${role?.label}`}>
        <div className="space-y-4">
          <Field label="Tab label">
            <Input value={newPage.label} onChange={(e) => setNewPage({ ...newPage, label: e.target.value })} placeholder="e.g. Reports" />
          </Field>
          <Field label="Route" hint="An existing route in the product. This adds a way in, not a new screen.">
            <Input className="num" value={newPage.to} onChange={(e) => setNewPage({ ...newPage, to: e.target.value })} placeholder="/finance/reports" />
          </Field>
          <Button className="w-full" disabled={!newPage.label.trim() || !newPage.to.trim()}
            onClick={() => { if (say(addSubPage(roleKey, newPage.label, newPage.to), 'Sub-page added', `${role?.label} → ${newPage.label.trim()}`)) setAddOpen(false) }}>
            Add sub-page
          </Button>
        </div>
      </Modal>
    </Page>
  )
}
