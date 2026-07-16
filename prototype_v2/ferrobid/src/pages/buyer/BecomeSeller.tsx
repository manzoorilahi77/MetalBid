/* Become a Seller — mock KYC wizard: business details, documents, bank. */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BadgeCheck, CheckCircle2, ClipboardCheck, Clock3, FileCheck2, Percent, Upload, UserRound,
} from 'lucide-react'
import { Page } from '../../layout/Chrome'
import { Button, Chip, EmptyState, Field, Input, PageHeader, Textarea, Toggle, cx } from '../../components/ui'
import { useStore } from '../../store/store'

const DOCS = [
  { key: 'gst', label: 'GST registration certificate', hint: 'PDF or JPG, up to 5 MB' },
  { key: 'pan', label: 'PAN card (firm)', hint: 'PDF or JPG, up to 5 MB' },
  { key: 'cheque', label: 'Cancelled cheque', hint: 'For bank account verification' },
]

const STEPS = ['Business details', 'Documents', 'Bank & declaration']

export default function BecomeSeller() {
  const me = useStore((s) => s.currentUser)
  const switchRole = useStore((s) => s.switchRole)
  const submitKyc = useStore((s) => s.submitKyc)
  const pushToast = useStore((s) => s.pushToast)
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [firm, setFirm] = useState(me?.firm ?? '')
  const [gstin, setGstin] = useState(me?.gstin ?? '')
  const [pan, setPan] = useState('')
  const [address, setAddress] = useState(me?.city ?? '')
  const [attached, setAttached] = useState<Record<string, boolean>>({})
  const [account, setAccount] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [declared, setDeclared] = useState(false)

  if (!me) {
    return (
      <Page>
        <EmptyState
          icon={<UserRound size={32} strokeWidth={1.5} />}
          title="Sign in to apply as a seller"
          body="Seller KYC is linked to your existing ferroBid account."
          action={<Link to="/login"><Button>Sign in</Button></Link>}
        />
      </Page>
    )
  }

  const step1Ok = firm.trim() && gstin.trim() && pan.trim() && address.trim()
  const step2Ok = DOCS.every((d) => attached[d.key])
  const step3Ok = account.trim() && ifsc.trim() && declared

  return (
    <Page>
      <PageHeader
        title="Become a seller"
        sub="List surplus metal, scrap and idle assets to 4,000+ verified industrial buyers. One-time KYC, then our team handles the rest."
      />

      {/* -------------------------- value props band -------------------------- */}
      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        <div className="card p-4 flex items-start gap-3">
          <span className="size-9 rounded-xl bg-ember-soft text-ember-strong flex items-center justify-center shrink-0"><Percent size={17} /></span>
          <div>
            <div className="font-semibold text-sm">0% listing fee</div>
            <div className="text-xs text-ink-muted mt-0.5">Pay only a success commission when your lot sells.</div>
          </div>
        </div>
        <div className="card p-4 flex items-start gap-3">
          <span className="size-9 rounded-xl bg-success-soft text-success flex items-center justify-center shrink-0"><Clock3 size={17} /></span>
          <div>
            <div className="font-semibold text-sm">Payment within T+2</div>
            <div className="text-xs text-ink-muted mt-0.5">Settled to your bank within 2 days of buyer payment.</div>
          </div>
        </div>
        <div className="card p-4 flex items-start gap-3">
          <span className="size-9 rounded-xl bg-steel-soft text-steel-strong flex items-center justify-center shrink-0"><ClipboardCheck size={17} /></span>
          <div>
            <div className="font-semibold text-sm">We inspect & catalogue for you</div>
            <div className="text-xs text-ink-muted mt-0.5">Field executives measure, photograph and list every lot.</div>
          </div>
        </div>
      </div>

      {/* ----------------------------- states ---------------------------------- */}
      {me.sellerVerified ? (
        <div className="card p-8 max-w-xl mx-auto text-center border-l-4 border-l-success">
          <BadgeCheck size={40} className="text-success mx-auto" />
          <h2 className="font-display text-xl font-bold mt-3">You're a verified seller</h2>
          <p className="text-sm text-ink-muted mt-1.5">
            {me.firm} is KYC-verified for selling on ferroBid. Submit lots for inspection and track live auctions from your seller workspace.
          </p>
          <Button className="mt-5" onClick={() => { switchRole('seller'); navigate('/seller') }}>
            Switch to seller workspace
          </Button>
        </div>
      ) : me.kycStatus === 'pending' ? (
        <div className="card p-8 max-w-xl mx-auto text-center border-l-4 border-l-steel">
          <FileCheck2 size={40} className="text-steel mx-auto" />
          <h2 className="font-display text-xl font-bold mt-3">KYC under review</h2>
          <Chip tone="steel" className="mt-2">Verification in progress</Chip>
          <p className="text-sm text-ink-muted mt-3">
            Our compliance team is verifying your GSTIN, PAN and bank details. You'll be notified within 1 business day.
          </p>
          <p className="text-xs text-ink-faint mt-2">
            Demo note: a Sub-Admin approves seller KYC from the Ops console — switch roles from the header to try it.
          </p>
        </div>
      ) : (
        <div className="card max-w-2xl mx-auto overflow-hidden">
          {/* ------------------------- step progress -------------------------- */}
          <div className="px-6 pt-5 pb-4 border-b border-line">
            <ol className="flex items-start">
              {STEPS.map((label, i) => {
                const done = i < step
                const current = i === step
                return (
                  <li key={label} className="flex-1 flex flex-col items-center relative">
                    {i > 0 && (
                      <span className={cx('absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2', i <= step ? 'bg-ember' : 'bg-line')} />
                    )}
                    <span className={cx('relative z-10 size-8 rounded-full border-2 flex items-center justify-center text-xs font-bold num',
                      done ? 'bg-ember border-ember text-white'
                        : current ? 'bg-ember-soft border-ember text-ember-strong'
                          : 'bg-surface border-line-strong text-ink-faint')}>
                      {done ? <CheckCircle2 size={15} /> : i + 1}
                    </span>
                    <span className={cx('mt-1.5 text-[11px] font-semibold text-center leading-tight px-1',
                      current ? 'text-ember' : done ? 'text-ink' : 'text-ink-faint')}>
                      {label}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>

          <div className="p-6">
            {step === 0 && (
              <div className="space-y-4">
                <Field label="Firm / trade name">
                  <Input value={firm} onChange={(e) => setFirm(e.target.value)} placeholder="e.g. Mehta Metals & Alloys" />
                </Field>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="GSTIN" hint="15-character GST identification number">
                    <Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="27AAACM1234F1Z5" className="num" maxLength={15} />
                  </Field>
                  <Field label="PAN (firm)">
                    <Input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} placeholder="AAACM1234F" className="num" maxLength={10} />
                  </Field>
                </div>
                <Field label="Registered address" hint="Material pickup yards can be added later per lot.">
                  <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Plot, street, city, state, PIN" />
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <p className="text-sm text-ink-muted">Attach the three documents below — our team cross-verifies them against the GST portal.</p>
                {DOCS.map((d) => {
                  const done = attached[d.key]
                  return (
                    <button key={d.key} type="button"
                      onClick={() => {
                        if (done) return
                        setAttached((a) => ({ ...a, [d.key]: true }))
                        pushToast({ kind: 'success', title: `${d.label} attached`, body: 'Demo upload — no file leaves your browser.' })
                      }}
                      className={cx('w-full rounded-xl border-2 border-dashed p-4 flex items-center gap-3 text-left transition-colors',
                        done ? 'border-success/50 bg-success-soft' : 'border-line-strong hover:border-ember/50 hover:bg-surface-2')}>
                      <span className={cx('size-10 rounded-xl flex items-center justify-center shrink-0',
                        done ? 'bg-success text-white' : 'bg-surface-2 text-ink-muted')}>
                        {done ? <CheckCircle2 size={18} /> : <Upload size={18} />}
                      </span>
                      <span className="min-w-0">
                        <span className={cx('block text-sm font-semibold', done && 'text-success')}>
                          {d.label}{done && ' — attached ✓'}
                        </span>
                        <span className="block text-xs text-ink-faint mt-0.5">{done ? 'Ready for verification' : `${d.hint} · click to attach`}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Bank account number" hint="Settlements are paid here within T+2.">
                    <Input value={account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, ''))} placeholder="50100223344556" className="num" />
                  </Field>
                  <Field label="IFSC">
                    <Input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} placeholder="HDFC0000060" className="num" maxLength={11} />
                  </Field>
                </div>
                <div className="card bg-surface-2 p-4">
                  <Toggle
                    checked={declared}
                    onChange={setDeclared}
                    label={
                      <span className="text-sm font-medium leading-snug">
                        I declare that the material I list is owned by my firm, free of encumbrance, and sold on an as-is-where-is basis under ferroBid's seller terms.
                      </span>
                    }
                  />
                </div>
              </div>
            )}

            {/* --------------------------- wizard nav --------------------------- */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-line">
              <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
                Back
              </Button>
              {step < 2 ? (
                <Button
                  disabled={step === 0 ? !step1Ok : !step2Ok}
                  onClick={() => setStep((s) => s + 1)}
                  title={step === 0 && !step1Ok ? 'Fill all business details to continue' : step === 1 && !step2Ok ? 'Attach all three documents to continue' : undefined}
                >
                  Continue
                </Button>
              ) : (
                <Button
                  disabled={!step3Ok}
                  title={!step3Ok ? 'Enter bank details and accept the declaration' : undefined}
                  onClick={() => {
                    submitKyc()
                    pushToast({
                      kind: 'success',
                      title: 'Seller KYC submitted',
                      body: 'We verify GSTIN and bank details within 1 business day (demo: approvable instantly from Sub-Admin).',
                    })
                  }}
                >
                  Submit for verification
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Page>
  )
}
