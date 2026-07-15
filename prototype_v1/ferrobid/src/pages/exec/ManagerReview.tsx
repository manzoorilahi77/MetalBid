import { useState } from 'react';
import { ClipboardCheck, CheckCircle2, XCircle, UserCheck2 } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Btn, Modal, Field, inputCls, CheckItem, StatusBadge, Empty, LotImage, Badge } from '../../components/ui';
import { GatedBtn, ScopeBadge } from '../../components/gate';
import { inrCompact } from '../../utils';

export default function ManagerReview() {
  const { lots, users, approveLot, rejectLot } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const queue = lots.filter((l) => l.status === 'pending_manager_approval');
  const lot = lots.find((l) => l.id === openId);
  const v = lot?.verification;
  const checklistEntries = v ? Object.entries(v.checklist) : [];
  const passCount = checklistEntries.filter(([, ok]) => ok).length;

  const open = (id: string) => { setOpenId(id); setNote(''); };
  const approve = () => { if (!openId) return; approveLot(openId, note); setOpenId(null); };
  const reject = () => { if (!openId) return; rejectLot(openId, note); setOpenId(null); };

  return (
    <div>
      <SectionTitle title="Manager Review" sub="Final sign-off on field-verified lots before they can be auctioned" right={<ScopeBadge module="manager_review" />} />
      {queue.length === 0 && <Empty title="Nothing awaiting approval" sub="Lots the Field Executive Officer has inspected land here." />}
      <div className="space-y-3">
        {queue.map((l) => {
          const seller = users.find((u) => u.id === l.sellerId);
          return (
            <Card key={l.id} className="flex flex-wrap items-center gap-4 p-4">
              <LotImage hues={l.imageHues} label={l.metal} className="h-14 w-20 rounded-lg shrink-0" />
              <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                <div className="text-[11px] font-bold text-faint">{l.id} · {seller?.businessName ?? seller?.name}</div>
                <div className="truncate text-sm font-bold text-ink">{l.title}</div>
                <div className="text-xs text-faint">{l.quantity} · {l.grade} · {l.location} · base {inrCompact(l.basePrice)} · inspected by {l.verification?.submittedBy ?? '—'}</div>
              </div>
              <StatusBadge status={l.status} />
              <Btn size="sm" variant="accent" onClick={() => open(l.id)}><ClipboardCheck size={13} /> Review</Btn>
            </Card>
          );
        })}
      </div>

      <Modal open={!!lot} onClose={() => setOpenId(null)} title={`Manager review — ${lot?.id ?? ''}`} wide>
        {lot && v && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <LotImage hues={lot.imageHues} label={lot.metal} className="h-36 w-full rounded-xl" />
              <div className="mt-3 text-sm font-bold text-ink">{lot.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted">{lot.description}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {[['Quantity', lot.quantity], ['Grade', lot.grade], ['Base', inrCompact(lot.basePrice)], ['Reserve', inrCompact(lot.reservePrice)]].map(([k, val]) => (
                  <div key={k} className="rounded-lg bg-surface-2 px-3 py-2"><span className="text-faint">{k}:</span> <b className="text-ink">{val}</b></div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                <UserCheck2 size={14} className="text-steel-600 dark:text-steel-300" />
                Submitted by <b className="text-ink">{v.submittedBy ?? '—'}</b> · {v.submittedAt ?? '—'}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className={`rounded-xl border-2 border-dashed px-4 py-3 text-center text-xs font-semibold ${v.reportUploaded ? 'border-emerald-300 dark:border-emerald-400/30 bg-emerald-50/60 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300' : 'border-line-strong text-faint'}`}>
                  {v.reportUploaded ? 'Report on file ✓' : 'Report missing'}
                </div>
                <div className={`rounded-xl border-2 border-dashed px-4 py-3 text-center text-xs font-semibold ${v.photosUploaded ? 'border-emerald-300 dark:border-emerald-400/30 bg-emerald-50/60 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300' : 'border-line-strong text-faint'}`}>
                  {v.photosUploaded ? 'Photos on file ✓' : 'Photos missing'}
                </div>
              </div>
            </div>
            <div>
              <h4 className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-faint">
                Inspection checklist <Badge tone={passCount === checklistEntries.length ? 'tone-emerald' : 'tone-amber'}>{passCount}/{checklistEntries.length} passed</Badge>
              </h4>
              <div className="space-y-2">
                {checklistEntries.map(([c, ok]) => (
                  <CheckItem key={c} label={c} checked={ok} />
                ))}
              </div>
              {v.note && (
                <div className="mt-4 rounded-xl bg-surface-2 p-3 text-xs text-muted">
                  <div className="mb-1 font-bold uppercase tracking-wide text-faint">Inspector note</div>
                  {v.note}
                </div>
              )}
              <div className="mt-4">
                <Field label="Manager note" hint="Required if rejecting">
                  <textarea className={inputCls} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Approval remarks, or the reason for rejection…" />
                </Field>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <GatedBtn module="manager_review" value={lot.basePrice} variant="success" size="sm" onAllowed={approve}>
                  <CheckCircle2 size={13} /> Approve
                </GatedBtn>
                <GatedBtn module="manager_review" risky value={lot.basePrice} variant="danger" size="sm" disabled={!note} onAllowed={reject}
                  approval={{ type: 'lot_reject', title: `Lot rejection — ${lot.id}`, detail: note || `${lot.title} failed manager review.`, refId: lot.id }}>
                  <XCircle size={13} /> Reject
                </GatedBtn>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
