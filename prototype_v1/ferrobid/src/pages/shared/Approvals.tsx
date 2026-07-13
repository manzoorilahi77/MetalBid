import { useState, type ReactNode } from 'react';
import {
  ShieldQuestion, CheckCircle2, XCircle, Hourglass, Banknote, PauseCircle,
  BadgeCheck, ClipboardX, Flag, CalendarClock, Building2,
} from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Badge, Btn, Modal, Field, inputCls, Tabs, Empty } from '../../components/ui';
import type { ApprovalRequest, ApprovalType } from '../../types';
import { inr, cx } from '../../utils';

const TYPE_META: Record<ApprovalType, { label: string; icon: ReactNode }> = {
  entity_approve: { label: 'Entity approval', icon: <Building2 size={16} /> },
  entity_reject: { label: 'Entity rejection', icon: <BadgeCheck size={16} /> },
  lot_reject: { label: 'Lot rejection', icon: <ClipboardX size={16} /> },
  emd_forfeit: { label: 'EMD forfeiture', icon: <Banknote size={16} /> },
  auction_publish: { label: 'Auction publish (over ceiling)', icon: <CalendarClock size={16} /> },
  auction_pause: { label: 'Auction pause', icon: <PauseCircle size={16} /> },
  bid_flag: { label: 'Suspicious bid — void request', icon: <Flag size={16} /> },
};

const STATUS_TONE: Record<ApprovalRequest['status'], string> = {
  pending: 'bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-400/25',
  approved: 'bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-400/25',
  rejected: 'bg-red-50 dark:bg-red-400/10 text-red-700 dark:text-red-300 ring-red-200 dark:ring-red-400/25',
};

function ApprovalCard({ a, checker, onDecide }: { a: ApprovalRequest; checker: boolean; onDecide?: (a: ApprovalRequest) => void }) {
  const meta = TYPE_META[a.type];
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          a.status === 'pending' ? 'bg-amber-50 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400' : 'bg-steel-500/10 text-steel-700 dark:text-steel-300')}>
          {meta.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold text-faint">{a.id} · {meta.label} · ref {a.refId}</div>
          <div className="text-sm font-bold text-ink">{a.title}</div>
          <p className="mt-0.5 text-xs text-muted leading-snug">{a.detail}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-faint">
            <span>Raised by <b className="text-muted">{a.requestedBy}</b> ({a.requestedRole})</span>
            <span>· {a.at}</span>
            {a.amount != null && <Badge tone="bg-surface-3 text-muted ring-line-strong">{inr(a.amount)}</Badge>}
          </div>
          {a.status !== 'pending' && (
            <div className={cx('mt-2 rounded-lg px-3 py-2 text-xs ring-1',
              a.status === 'approved'
                ? 'bg-emerald-50/70 dark:bg-emerald-400/10 text-emerald-800 dark:text-emerald-200 ring-emerald-200 dark:ring-emerald-400/25'
                : 'bg-red-50/70 dark:bg-red-400/10 text-red-800 dark:text-red-200 ring-red-200 dark:ring-red-400/25')}>
              <b className="capitalize">{a.status}</b> by {a.decidedBy} · {a.decidedAt}
              {a.decisionNote && <> — “{a.decisionNote}”</>}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={STATUS_TONE[a.status]} className="capitalize">
            {a.status === 'pending' && <Hourglass size={11} />} {a.status}
          </Badge>
          {checker && a.status === 'pending' && onDecide && (
            <Btn size="sm" variant="primary" onClick={() => onDecide(a)}>Review</Btn>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Maker-checker approvals — Sub-Admin sees their outbox; Exec/Super Admin see the decision queue. */
export default function Approvals() {
  const { role, approvals, decideApproval } = useApp();
  const checker = role === 'exec' || role === 'superadmin';
  const [tab, setTab] = useState('pending');
  const [target, setTarget] = useState<ApprovalRequest | null>(null);
  const [note, setNote] = useState('');

  const pending = approvals.filter((a) => a.status === 'pending');
  const done = approvals.filter((a) => a.status !== 'pending');
  const rows = tab === 'pending' ? pending : done;

  const decide = (decision: 'approved' | 'rejected') => {
    if (!target) return;
    decideApproval(target.id, decision, note);
    setTarget(null);
    setNote('');
  };

  return (
    <div>
      <SectionTitle
        title={checker ? 'Approvals Queue' : 'My Approval Requests'}
        sub={checker
          ? 'Maker-checker: risky Sub-Admin actions land here for a decision with a mandatory reason'
          : 'Actions outside your grant are sent here — Executive/Super Admin decide, you get notified'}
        right={<Badge tone="tone-violet"><ShieldQuestion size={12} /> {pending.length} pending</Badge>}
      />
      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'pending', label: `Pending (${pending.length})` },
        { key: 'done', label: `Decided (${done.length})` },
      ]} />

      <div className="mt-4 space-y-3">
        {rows.length === 0 && (
          <Empty title={tab === 'pending' ? 'Nothing awaiting a decision' : 'No decided requests yet'}
            sub={checker ? 'Requests raised by Sub-Admins will appear here.' : 'Gated actions you trigger will appear here with live status.'} />
        )}
        {rows.map((a) => <ApprovalCard key={a.id} a={a} checker={checker} onDecide={setTarget} />)}
      </div>

      <Modal open={!!target} onClose={() => setTarget(null)} title={`Decide — ${target ? TYPE_META[target.type].label : ''}`}>
        {target && (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-2 px-4 py-3">
              <div className="text-sm font-bold text-ink">{target.title}</div>
              <p className="mt-1 text-xs text-muted">{target.detail}</p>
              <div className="mt-1.5 text-[11px] text-faint">Ref {target.refId} · by {target.requestedBy}{target.amount != null && <> · {inr(target.amount)}</>}</div>
            </div>
            <Field label="Decision note (mandatory — recorded in the audit trail)">
              <textarea className={inputCls} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Cross-checked the payment ledger; forfeiture is correct." />
            </Field>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Btn variant="success" disabled={!note.trim()} onClick={() => decide('approved')}><CheckCircle2 size={14} /> Approve & execute</Btn>
              <Btn variant="danger" disabled={!note.trim()} onClick={() => decide('rejected')}><XCircle size={14} /> Reject</Btn>
            </div>
            <p className="text-[11px] text-faint">Approving immediately executes the underlying action (pause, forfeit, rejection…) and notifies the requester.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
