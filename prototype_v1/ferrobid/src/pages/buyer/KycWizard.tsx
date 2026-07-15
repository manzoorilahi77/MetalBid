import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Btn, Field, inputCls, FileDrop, Badge, Toggle } from '../../components/ui';
import { cx } from '../../utils';
import type { KycDocType } from '../../types';

const STEP_LABELS = ['Account', 'Profile', 'Documents', 'Review'];

const DOC_CONFIG: { type: KycDocType; label: string; why: string; requiredWhen: 'always' | 'business' | 'optional' }[] = [
  { type: 'pan', label: 'PAN Card', why: 'Mandatory identity & tax proof for every bidder on ferroBid.', requiredWhen: 'always' },
  { type: 'aadhar', label: 'Aadhar Card', why: 'Government-issued ID used to verify your identity, per KYC norms.', requiredWhen: 'always' },
  { type: 'photo', label: 'Passport-size Photo', why: "Shown on your verified bidder profile to other participants.", requiredWhen: 'always' },
  { type: 'address_proof', label: 'Address Proof', why: 'Confirms your registered address for settlement & logistics.', requiredWhen: 'always' },
  { type: 'cancelled_cheque', label: 'Cancelled Cheque', why: 'Verifies your bank account for EMD refunds and payouts.', requiredWhen: 'always' },
  { type: 'gst', label: 'GST Certificate', why: 'Required when bidding as a registered business.', requiredWhen: 'business' },
  { type: 'itr', label: 'ITR (latest year)', why: 'Helps raise your bidding & EMD limit for high-value lots.', requiredWhen: 'optional' },
  { type: 'pcb', label: 'Pollution Control Board Certificate', why: 'Required for regulated categories such as lead-acid battery scrap.', requiredWhen: 'optional' },
];

/** Whether a document is mandatory — GST/ITR/PCB thresholds are Super-Admin configurable (System Config). */
function isDocRequired(d: (typeof DOC_CONFIG)[number], isBusiness: boolean, kycPolicy: { requireGSTForBusiness: boolean; requireITR: boolean; requirePCB: boolean }): boolean {
  if (d.requiredWhen === 'always') return true;
  if (d.type === 'gst') return isBusiness && kycPolicy.requireGSTForBusiness;
  if (d.type === 'itr') return kycPolicy.requireITR;
  if (d.type === 'pcb') return kycPolicy.requirePCB;
  return false;
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="mb-7 flex items-start">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <div className={cx(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
              i < step ? 'bg-steel-700 text-white' : i === step ? 'bg-ember-500 text-white shadow-[0_0_0_4px_rgba(254,97,16,0.16)]' : 'bg-surface-3 text-faint'
            )}>
              {i < step ? <Check size={14} strokeWidth={3} /> : i + 1}
            </div>
            <span className={cx('text-center text-[10px] font-bold uppercase tracking-wide', i === step ? 'text-ember-600 dark:text-ember-400' : i < step ? 'text-steel-700 dark:text-steel-300' : 'text-faint')}>{label}</span>
          </div>
          {i < STEP_LABELS.length - 1 && <div className={cx('mx-2 mt-4 h-0.5 flex-1', i < step ? 'bg-steel-600' : 'bg-line')} />}
        </div>
      ))}
    </div>
  );
}

export default function KycWizard() {
  const nav = useNavigate();
  const { kycStatus, kycProfile, kycDocs, config, updateKycProfile, uploadKycDoc, submitKycWizard, resetKycDemo } = useApp();
  const [step, setStep] = useState(0);

  const requiredDocs = DOC_CONFIG.filter((d) => isDocRequired(d, kycProfile.isBusiness, config.kycPolicy));
  const docsDone = requiredDocs.every((d) => kycDocs[d.type] === 'uploaded' || kycDocs[d.type] === 'verified');
  const accountValid = kycProfile.fullName.trim().length > 2
    && /^[A-Z]{5}\d{4}[A-Z]$/.test(kycProfile.panNumber)
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(kycProfile.email);
  const profileValid = kycProfile.address.trim().length > 4
    && kycProfile.city.trim().length > 1 && kycProfile.state.trim().length > 1
    && /^\d{6}$/.test(kycProfile.pincode)
    && (!kycProfile.isBusiness || (kycProfile.businessName.trim().length > 2 && kycProfile.gstin.trim().length >= 10));

  if (kycStatus === 'pending') {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400">
          <ClipboardCheck size={28} />
        </div>
        <h2 className="mt-4 text-lg font-extrabold text-ink">KYC under review</h2>
        <p className="mt-1 text-sm text-muted">Our team is verifying your account details and documents — this is simulated and approves in a few seconds.</p>
        <Btn variant="outline" className="mt-5" onClick={() => nav('/buyer')}>Back to dashboard</Btn>
      </Card>
    );
  }

  if (kycStatus === 'verified') {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400">
          <ShieldCheck size={28} />
        </div>
        <h2 className="mt-4 text-lg font-extrabold text-ink">KYC verified ✓</h2>
        <p className="mt-1 text-sm text-muted">You're cleared to lock EMD and bid in live auctions as <b>{kycProfile.fullName}</b>.</p>
        <div className="mx-auto mt-5 max-w-xs space-y-1.5 text-left text-sm">
          {DOC_CONFIG.filter((d) => kycDocs[d.type] === 'verified').map((d) => (
            <div key={d.type} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-1.5">
              <span className="text-muted">{d.label}</span>
              <Badge tone="tone-emerald"><Check size={11} /> Verified</Badge>
            </div>
          ))}
        </div>
        <Btn variant="outline" className="mt-5" onClick={() => nav('/buyer')}>Back to dashboard</Btn>
        <button onClick={resetKycDemo} className="mt-3 block w-full text-center text-[11px] font-semibold text-faint hover:text-muted cursor-pointer">
          Redo KYC (demo)
        </button>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <SectionTitle title="Complete your KYC" sub="Mandatory before you can lock EMD and bid in live auctions" />
      <Stepper step={step} />

      {step === 0 && (
        <Card className="p-6">
          <h2 className="font-bold text-ink">Account details</h2>
          <p className="mt-1 text-sm text-muted">Confirm your identity basics — this is how you'll appear to sellers and admins.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Full legal name">
              <input className={inputCls} value={kycProfile.fullName} onChange={(e) => updateKycProfile({ fullName: e.target.value })} />
            </Field>
            <Field label="PAN number" hint="10 characters, e.g. ABCDE1234F">
              <input className={inputCls} value={kycProfile.panNumber} maxLength={10} onChange={(e) => updateKycProfile({ panNumber: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Email address">
              <input className={inputCls} type="email" value={kycProfile.email} onChange={(e) => updateKycProfile({ email: e.target.value })} />
            </Field>
            <Field label="Mobile number" hint="Registered at login">
              <input className={inputCls} value={kycProfile.phone} disabled />
            </Field>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="p-6">
          <h2 className="font-bold text-ink">Business profile</h2>
          <p className="mt-1 text-sm text-muted">Your registered address is used for settlement, invoicing and logistics.</p>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3 ring-1 ring-line">
            <div>
              <div className="text-sm font-semibold text-ink">Bidding as a registered business</div>
              <div className="text-[11px] text-faint">Adds a GST certificate requirement in the next step.</div>
            </div>
            <Toggle on={kycProfile.isBusiness} onChange={() => updateKycProfile({ isBusiness: !kycProfile.isBusiness })} />
          </div>
          {kycProfile.isBusiness && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Business name">
                <input className={inputCls} value={kycProfile.businessName} onChange={(e) => updateKycProfile({ businessName: e.target.value })} />
              </Field>
              <Field label="GSTIN">
                <input className={inputCls} value={kycProfile.gstin} onChange={(e) => updateKycProfile({ gstin: e.target.value.toUpperCase() })} />
              </Field>
            </div>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Address">
                <input className={inputCls} value={kycProfile.address} onChange={(e) => updateKycProfile({ address: e.target.value })} />
              </Field>
            </div>
            <Field label="City">
              <input className={inputCls} value={kycProfile.city} onChange={(e) => updateKycProfile({ city: e.target.value })} />
            </Field>
            <Field label="State">
              <input className={inputCls} value={kycProfile.state} onChange={(e) => updateKycProfile({ state: e.target.value })} />
            </Field>
            <Field label="Pincode">
              <input className={inputCls} value={kycProfile.pincode} maxLength={6} onChange={(e) => updateKycProfile({ pincode: e.target.value.replace(/\D/g, '') })} />
            </Field>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6">
          <h2 className="font-bold text-ink">Upload documents</h2>
          <p className="mt-1 text-sm text-muted">Uploads are simulated in this prototype — click a tile to mark it uploaded.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {DOC_CONFIG.map((d) => {
              const required = isDocRequired(d, kycProfile.isBusiness, config.kycPolicy);
              const status = kycDocs[d.type];
              return (
                <div key={d.type}>
                  <FileDrop label={d.label} done={status === 'uploaded' || status === 'verified'} onUpload={() => uploadKycDoc(d.type)} />
                  <p className="mt-1.5 text-[11px] text-faint">{d.why} {!required && <span className="italic">(optional)</span>}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-6">
          <h2 className="font-bold text-ink">Review &amp; submit</h2>
          <p className="mt-1 text-sm text-muted">Double-check your details — you can go back to edit anything before submitting.</p>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div><span className="text-faint">Full name</span><div className="font-semibold text-ink">{kycProfile.fullName}</div></div>
            <div><span className="text-faint">PAN</span><div className="font-semibold text-ink">{kycProfile.panNumber}</div></div>
            <div><span className="text-faint">Email</span><div className="font-semibold text-ink">{kycProfile.email}</div></div>
            <div><span className="text-faint">Mobile</span><div className="font-semibold text-ink">{kycProfile.phone}</div></div>
            <div className="sm:col-span-2"><span className="text-faint">Address</span><div className="font-semibold text-ink">{kycProfile.address}, {kycProfile.city}, {kycProfile.state} {kycProfile.pincode}</div></div>
            {kycProfile.isBusiness && (
              <div className="sm:col-span-2"><span className="text-faint">Business</span><div className="font-semibold text-ink">{kycProfile.businessName} · {kycProfile.gstin}</div></div>
            )}
          </div>
          <div className="mt-5 space-y-2">
            {DOC_CONFIG.filter((d) => {
              const required = isDocRequired(d, kycProfile.isBusiness, config.kycPolicy);
              return required || kycDocs[d.type] !== 'pending';
            }).map((d) => {
              const uploaded = kycDocs[d.type] === 'uploaded' || kycDocs[d.type] === 'verified';
              return (
                <div key={d.type} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
                  <span className="text-ink">{d.label}</span>
                  <Badge tone={uploaded ? 'tone-emerald' : 'tone-amber'}>{uploaded ? 'Uploaded' : 'Not uploaded'}</Badge>
                </div>
              );
            })}
          </div>
          <Btn variant="accent" size="lg" className="mt-6 w-full" disabled={!docsDone} onClick={() => { submitKycWizard(); nav('/buyer'); }}>
            Submit for verification <ArrowRight size={16} />
          </Btn>
          {!docsDone && <p className="mt-2 text-center text-[11px] text-faint">Upload all required documents to continue.</p>}
        </Card>
      )}

      <div className="mt-5 flex items-center justify-between">
        <Btn variant="ghost" onClick={() => (step === 0 ? nav('/buyer') : setStep(step - 1))}><ArrowLeft size={15} /> Back</Btn>
        {step < 3 && (
          <Btn
            variant="accent"
            disabled={(step === 0 && !accountValid) || (step === 1 && !profileValid)}
            onClick={() => setStep(step + 1)}
          >
            Continue <ArrowRight size={15} />
          </Btn>
        )}
      </div>
    </div>
  );
}
