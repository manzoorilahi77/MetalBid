import { useState } from 'react';
import { ClipboardCheck, CheckCircle2, XCircle, Flag, PlayCircle } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Btn, Modal, Field, inputCls, CheckItem, FileDrop, StatusBadge, Empty, LotImage, Badge } from '../../components/ui';
import { inrCompact } from '../../utils';

const CHECKS = ['Quality matches description', 'Quantity verified on site', 'Condition acceptable', 'Images authentic'];

export default function LotVerification() {
  const { lots, users, startVerification, decideLot } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');
  const [report, setReport] = useState(false);
  const [photos, setPhotos] = useState(false);

  const queue = lots.filter((l) => ['submitted', 'under_verification'].includes(l.status));
  const lot = lots.find((l) => l.id === openId);
  const allChecked = CHECKS.every((c) => checks[c]);

  const open = (id: string) => {
    setOpenId(id);
    setChecks({});
    setNote('');
    setReport(false);
    setPhotos(false);
  };
  const decide = (d: 'verified' | 'flagged' | 'rejected') => {
    if (!openId) return;
    decideLot(openId, d, checks, note);
    setOpenId(null);
  };

  return (
    <div>
      <SectionTitle title="Lot Verification" sub="Inspect submitted lots before they can be auctioned" />
      {queue.length === 0 && <Empty title="No lots awaiting verification" sub="Seller submissions land here." />}
      <div className="space-y-3">
        {queue.map((l) => {
          const seller = users.find((u) => u.id === l.sellerId);
          return (
            <Card key={l.id} className="flex flex-wrap items-center gap-4 p-4">
              <LotImage hues={l.imageHues} label={l.metal} className="h-14 w-20 rounded-lg shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-faint">{l.id} · {seller?.businessName ?? seller?.name}</div>
                <div className="truncate text-sm font-bold text-ink">{l.title}</div>
                <div className="text-xs text-faint">{l.quantity} · {l.grade} · {l.location} · base {inrCompact(l.basePrice)}</div>
              </div>
              <StatusBadge status={l.status} />
              {l.status === 'submitted'
                ? <Btn size="sm" variant="primary" onClick={() => { startVerification(l.id); open(l.id); }}><PlayCircle size={13} /> Start inspection</Btn>
                : <Btn size="sm" variant="accent" onClick={() => open(l.id)}><ClipboardCheck size={13} /> Continue inspection</Btn>}
            </Card>
          );
        })}
      </div>

      <Modal open={!!lot} onClose={() => setOpenId(null)} title={`Inspection — ${lot?.id ?? ''}`} wide>
        {lot && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <LotImage hues={lot.imageHues} label={lot.metal} className="h-36 w-full rounded-xl" />
              <div className="mt-3 text-sm font-bold text-ink">{lot.title}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted">{lot.description}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {[['Quantity', lot.quantity], ['Grade', lot.grade], ['Base', inrCompact(lot.basePrice)], ['Reserve', inrCompact(lot.reservePrice)]].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-surface-2 px-3 py-2"><span className="text-faint">{k}:</span> <b className="text-ink">{v}</b></div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <FileDrop label="Verification report" done={report} onUpload={() => setReport(true)} />
                <FileDrop label="Inspection photos" done={photos} onUpload={() => setPhotos(true)} />
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">Inspection checklist</h4>
              <div className="space-y-2">
                {CHECKS.map((c) => (
                  <CheckItem key={c} label={c} checked={!!checks[c]} onToggle={() => setChecks((s) => ({ ...s, [c]: !s[c] }))} />
                ))}
              </div>
              <div className="mt-4">
                <Field label="Inspector note">
                  <textarea className={inputCls} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Findings, weighbridge refs, remarks…" />
                </Field>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Btn variant="success" size="sm" disabled={!allChecked || !report} onClick={() => decide('verified')}><CheckCircle2 size={13} /> Verify</Btn>
                <Btn variant="outline" size="sm" onClick={() => decide('flagged')}><Flag size={13} /> Flag</Btn>
                <Btn variant="danger" size="sm" onClick={() => decide('rejected')}><XCircle size={13} /> Reject</Btn>
              </div>
              {(!allChecked || !report) && <p className="mt-2 text-[11px] text-faint">To verify: pass all 4 checks and upload the report. Flag keeps it in the queue; reject returns it to the seller.</p>}
              <Badge tone="bg-emerald-50 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-400/25" className="mt-3">Verified lots move straight to Auction Setup</Badge>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
