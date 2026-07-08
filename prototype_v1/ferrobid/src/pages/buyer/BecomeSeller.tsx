import { useState } from 'react';
import { Store, CheckCircle2, Clock, ShieldCheck, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp, DEMO_USER_ID } from '../../store';
import { SectionTitle, Card, Btn, Field, inputCls, FileDrop, Badge } from '../../components/ui';

const REQUIRED_DOCS = [
  { key: 'gst', label: 'GST Registration Certificate', type: 'GST' },
  { key: 'pan', label: 'Business PAN Card', type: 'PAN' },
  { key: 'bank', label: 'Cancelled Cheque / Bank Proof', type: 'Bank' },
  { key: 'msme', label: 'Udyam / MSME Certificate (optional)', type: 'MSME' },
];

export default function BecomeSeller() {
  const nav = useNavigate();
  const { buyerUpgrade, submitEntityRequest, entityRequests, switchRole } = useApp();
  const [businessName, setBusinessName] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [uploaded, setUploaded] = useState<Record<string, boolean>>({});

  const myReq = entityRequests.find((r) => r.userId === DEMO_USER_ID);
  const requiredDone = uploaded.gst && uploaded.pan && uploaded.bank;
  const canSubmit = businessName && gstin.length >= 10 && pan.length >= 8 && requiredDone;

  const steps = [
    { label: 'Submit entity documents', done: buyerUpgrade !== 'none' },
    { label: 'Executive Admin review', done: buyerUpgrade === 'approved', active: buyerUpgrade === 'submitted' },
    { label: 'Seller capability unlocked', done: buyerUpgrade === 'approved' },
  ];

  return (
    <div>
      <SectionTitle title="Become a Seller" sub="Seller is a capability unlocked on your verified Buyer account — not a separate login" />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {buyerUpgrade === 'none' && (
            <Card className="p-6">
              <h2 className="font-bold text-ink">Entity verification documents</h2>
              <p className="mt-1 text-sm text-muted">All documents are reviewed by an Executive Admin (SLA: 48 hours). Uploads are simulated.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Registered business name">
                  <input className={inputCls} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Mehta Metal Trading Co" />
                </Field>
                <Field label="GSTIN">
                  <input className={inputCls} value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="27ABCDE1234F1Z5" />
                </Field>
                <Field label="Business PAN">
                  <input className={inputCls} value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" />
                </Field>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {REQUIRED_DOCS.map((d) => (
                  <FileDrop key={d.key} label={d.label} done={!!uploaded[d.key]} onUpload={() => setUploaded((u) => ({ ...u, [d.key]: true }))} />
                ))}
              </div>
              <Btn
                variant="accent" size="lg" className="mt-6 w-full" disabled={!canSubmit}
                onClick={() => submitEntityRequest(businessName, gstin, pan, REQUIRED_DOCS.filter((d) => uploaded[d.key]).map((d) => ({ name: d.label, type: d.type })))}
              >
                Submit for entity verification <ArrowRight size={16} />
              </Btn>
              {!canSubmit && <p className="mt-2 text-center text-[11px] text-faint">Fill business details and upload GST, PAN & bank proof to continue.</p>}
            </Card>
          )}

          {buyerUpgrade === 'submitted' && (
            <Card className="p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-400/15 text-amber-600 dark:text-amber-400"><Clock size={28} /></div>
              <h2 className="mt-4 text-lg font-extrabold text-ink">Documents under review</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                Your request <b>{myReq?.id}</b> for <b>{myReq?.businessName}</b> is with the Executive Admin.
                In this prototype, switch to the <b>Executive Admin</b> role and approve it from the Entity Verification queue to see the hand-off.
              </p>
              <Badge tone="bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-400/25" className="mt-4">Status: Pending review</Badge>
            </Card>
          )}

          {buyerUpgrade === 'approved' && (
            <Card className="p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-400/15 text-emerald-600 dark:text-emerald-400"><ShieldCheck size={28} /></div>
              <h2 className="mt-4 text-lg font-extrabold text-ink">You're a verified Seller! 🎉</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                Listing tools are now unlocked on your account. You keep every Buyer ability — bid and sell from the same login.
              </p>
              <Btn variant="accent" size="lg" className="mt-5" onClick={() => { switchRole('seller'); nav('/seller'); }}>
                <Store size={16} /> Open Seller workspace
              </Btn>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-bold text-ink">How it works</h3>
            <div className="mt-4 space-y-4">
              {steps.map((s, i) => (
                <div key={s.label} className="flex items-start gap-3">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.done ? 'bg-emerald-500 text-white' : s.active ? 'bg-amber-400 text-white animate-pulse' : 'bg-surface-3 text-faint'}`}>
                    {s.done ? <CheckCircle2 size={15} /> : i + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-ink">{s.label}</div>
                    <div className="text-[11px] text-faint">
                      {i === 0 && 'Business name, GSTIN, PAN and document uploads'}
                      {i === 1 && 'Document review with approve / reject / return'}
                      {i === 2 && 'List lots, monitor auctions, download reports'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5 text-xs leading-relaxed text-muted">
            <b className="text-ink">Why verify?</b> Only verified entities can list lots on ferroBid.
            This keeps the marketplace trustworthy for every bidder — each lot is also physically inspected before auction.
          </Card>
        </div>
      </div>
    </div>
  );
}
