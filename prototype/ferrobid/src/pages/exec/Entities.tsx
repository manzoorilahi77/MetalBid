import { useState } from 'react';
import { FileText, CheckCircle2, XCircle, RotateCcw, Building2 } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Badge, Btn, Modal, Field, inputCls, Tabs, Empty } from '../../components/ui';

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
  returned: 'bg-sky-50 text-sky-700 ring-sky-200',
};

export default function Entities() {
  const { entityRequests, decideEntity } = useApp();
  const [tab, setTab] = useState('pending');
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const req = entityRequests.find((r) => r.id === openId);

  const rows = entityRequests.filter((r) => (tab === 'pending' ? r.status === 'pending' : r.status !== 'pending'));

  const decide = (decision: 'approved' | 'rejected' | 'returned') => {
    if (!openId) return;
    decideEntity(openId, decision, note);
    setOpenId(null);
    setNote('');
  };

  return (
    <div>
      <SectionTitle title="Entity / Seller Verification" sub="Approve a buyer's entity to unlock their Seller capability" />
      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'pending', label: `Queue (${entityRequests.filter((r) => r.status === 'pending').length})` },
        { key: 'done', label: 'Processed' },
      ]} />

      <div className="mt-4 space-y-3">
        {rows.length === 0 && <Empty title={tab === 'pending' ? 'Queue is clear 🎉' : 'Nothing processed yet'} sub={tab === 'pending' ? 'New “Become a Seller” requests will appear here.' : undefined} />}
        {rows.map((r) => (
          <Card key={r.id} className="flex flex-wrap items-center gap-4 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-steel-50 text-steel-700"><Building2 size={20} /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-slate-400">{r.id} · submitted {r.submittedAt}</div>
              <div className="text-sm font-bold text-steel-950">{r.businessName}</div>
              <div className="text-xs text-slate-400">{r.userName} · GSTIN {r.gstin}</div>
            </div>
            <Badge tone={STATUS_TONE[r.status]} className="capitalize">{r.status}</Badge>
            <Badge tone="bg-slate-100 text-slate-500 ring-slate-300"><FileText size={11} /> {r.docs.length} docs</Badge>
            {r.status === 'pending'
              ? <Btn size="sm" variant="primary" onClick={() => setOpenId(r.id)}>Review</Btn>
              : <Btn size="sm" variant="ghost" onClick={() => setOpenId(r.id)}>View</Btn>}
          </Card>
        ))}
      </div>

      <Modal open={!!req} onClose={() => setOpenId(null)} title={`Review — ${req?.businessName ?? ''}`} wide>
        {req && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Entity details</h4>
              <div className="space-y-2 text-sm">
                {[['Applicant', req.userName], ['Business', req.businessName], ['GSTIN', req.gstin], ['PAN', req.pan], ['Submitted', req.submittedAt]].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-slate-400">{k}</span><span className="font-semibold text-steel-950 text-right">{v}</span>
                  </div>
                ))}
              </div>
              {req.note && <div className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800 ring-1 ring-sky-200"><b>Note:</b> {req.note}</div>}
            </div>
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Documents (mock viewer)</h4>
              <div className="space-y-2">
                {req.docs.map((d) => (
                  <button key={d.name} className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-steel-300 hover:bg-steel-50 cursor-pointer" onClick={() => useApp.getState().pushToast({ title: 'Opening document (mock)', body: d.name, tone: 'info' })}>
                    <FileText size={16} className="shrink-0 text-red-400" />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-steel-950">{d.name}</span>
                    <Badge tone="bg-slate-100 text-slate-500 ring-slate-300">{d.type}</Badge>
                  </button>
                ))}
              </div>
              {req.status === 'pending' && (
                <div className="mt-4">
                  <Field label="Decision note (sent to the applicant)">
                    <textarea className={inputCls} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. All documents verified." />
                  </Field>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Btn variant="success" size="sm" onClick={() => decide('approved')}><CheckCircle2 size={13} /> Approve</Btn>
                    <Btn variant="outline" size="sm" onClick={() => decide('returned')}><RotateCcw size={13} /> Return</Btn>
                    <Btn variant="danger" size="sm" onClick={() => decide('rejected')}><XCircle size={13} /> Reject</Btn>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">Approving unlocks the Seller capability on the applicant's account and notifies them.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
