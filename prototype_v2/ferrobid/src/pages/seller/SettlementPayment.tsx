/* Settlement payment flows for seller lot settlement:
   - TransferPaymentModal: confirm → OTP → bank details → pay.
   - EmdSettleModal: double confirmation → net-of-commission breakdown → settle. */
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Landmark } from 'lucide-react'
import { Button, Field, Input, Modal, MockOtpModal } from '../../components/ui'
import { inr, inrWords } from '../../lib/format'
import type { CompanyBankAccount } from '../../types'

/* ------------------------------ Pay by transfer ----------------------------- */
type TransferPhase = 'confirm' | 'otp' | 'bank' | 'processing' | 'done'

export function TransferPaymentModal({ open, onClose, amount, catCode, phone, settlementAccount, onDone }: {
  open: boolean; onClose: () => void; amount: number; catCode: string; phone?: string
  settlementAccount?: CompanyBankAccount; onDone: () => void
}) {
  const [phase, setPhase] = useState<TransferPhase>('confirm')
  const [bank, setBank] = useState({ holder: '', bankName: '', accountNumber: '', ifsc: '' })
  const timer = useRef<ReturnType<typeof setTimeout>>(null)
  // MockOtpModal fires onVerified() then immediately onClose() on success — this
  // guard stops that trailing onClose from clobbering the 'bank' phase we just set.
  const verifiedRef = useRef(false)

  useEffect(() => {
    if (open) { setPhase('confirm'); setBank({ holder: '', bankName: '', accountNumber: '', ifsc: '' }); verifiedRef.current = false }
  }, [open])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  if (!open) return null

  const bankValid = bank.holder.trim() && bank.bankName.trim() && bank.accountNumber.trim().length >= 6 && bank.ifsc.trim().length >= 6

  const pay = () => {
    setPhase('processing')
    timer.current = setTimeout(() => {
      setPhase('done')
      timer.current = setTimeout(() => { onDone(); onClose() }, 1000)
    }, 1500)
  }

  if (phase === 'otp') {
    return (
      <MockOtpModal
        open
        onClose={() => { if (!verifiedRef.current) setPhase('confirm') }}
        phone={phone}
        onVerified={() => { verifiedRef.current = true; setPhase('bank') }}
      />
    )
  }

  return (
    <Modal open onClose={phase === 'confirm' ? onClose : () => {}} title={phase === 'bank' ? 'Bank transfer details' : 'Pay ferroBid commission'}>
      {phase === 'confirm' && (
        <div className="space-y-4">
          <div className="card bg-surface-2 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-ink-muted">Commission for {catCode}</span>
              <span className="num text-2xl font-bold">{inr(amount)}</span>
            </div>
            <div className="text-xs text-ink-muted mt-1.5 pt-1.5 border-t border-line text-right italic">{inrWords(amount)}</div>
          </div>
          <p className="text-sm text-ink-muted">
            You&apos;re about to pay ferroBid&apos;s commission by bank transfer. We&apos;ll verify it&apos;s you with an OTP, then confirm the transferring bank details.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={() => setPhase('otp')}>Continue</Button>
          </div>
        </div>
      )}

      {phase === 'bank' && (
        <div className="space-y-4">
          <div className="card bg-surface-2 border-0 p-3.5 text-xs">
            <div className="flex items-center gap-2 font-semibold text-ink mb-1"><Landmark size={13} /> Transfer to ferroBid Settlement A/c</div>
            <div className="num text-ink-muted">
              {settlementAccount ? `${settlementAccount.bank} · ${settlementAccount.accountNumberMasked} · IFSC ${settlementAccount.ifsc}` : 'ICICI Bank · 0004 05•• ••77 910 · IFSC ICIC0000004'}
            </div>
          </div>

          <Field label="Paying from — account holder name">
            <Input value={bank.holder} onChange={(e) => setBank((b) => ({ ...b, holder: e.target.value }))} placeholder="e.g. Tata Steel Ltd" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank name">
              <Input value={bank.bankName} onChange={(e) => setBank((b) => ({ ...b, bankName: e.target.value }))} placeholder="e.g. HDFC Bank" />
            </Field>
            <Field label="IFSC">
              <Input value={bank.ifsc} onChange={(e) => setBank((b) => ({ ...b, ifsc: e.target.value.toUpperCase() }))} placeholder="e.g. HDFC0000060" className="uppercase" />
            </Field>
          </div>
          <Field label="Account number">
            <Input value={bank.accountNumber} onChange={(e) => setBank((b) => ({ ...b, accountNumber: e.target.value.replace(/\D/g, '') }))} placeholder="Account number" inputMode="numeric" />
          </Field>

          <Button className="w-full" size="lg" disabled={!bankValid} onClick={pay}>Pay {inr(amount)}</Button>
        </div>
      )}

      {phase === 'processing' && (
        <div className="py-10 flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-ember" />
          <div className="font-semibold">Processing transfer…</div>
          <div className="text-xs text-ink-faint">Do not refresh — contacting the bank (simulated)</div>
        </div>
      )}

      {phase === 'done' && (
        <div className="py-10 flex flex-col items-center gap-3 text-success">
          <CheckCircle2 size={40} />
          <div className="font-bold text-ink">Payment successful</div>
          <div className="text-sm text-ink-muted">{inr(amount)} paid to ferroBid for {catCode}</div>
        </div>
      )}
    </Modal>
  )
}

/* ------------------------------- Cut from EMD ------------------------------- */
type EmdPhase = 'confirm1' | 'confirm2' | 'processing' | 'done'

export function EmdSettleModal({ open, onClose, gross, commission, catCode, onDone }: {
  open: boolean; onClose: () => void; gross: number; commission: number; catCode: string; onDone: () => void
}) {
  const [phase, setPhase] = useState<EmdPhase>('confirm1')
  const timer = useRef<ReturnType<typeof setTimeout>>(null)
  const balance = Math.max(0, gross - commission)

  useEffect(() => { if (open) setPhase('confirm1') }, [open])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  if (!open) return null

  const settle = () => {
    setPhase('processing')
    timer.current = setTimeout(() => {
      setPhase('done')
      timer.current = setTimeout(() => { onDone(); onClose() }, 1200)
    }, 1400)
  }

  return (
    <Modal open onClose={phase === 'confirm1' ? onClose : () => {}} title={phase === 'confirm2' ? 'Confirm settlement' : 'Settle from EMD'}>
      {phase === 'confirm1' && (
        <div className="space-y-4 text-center">
          <div className="mx-auto size-12 rounded-2xl bg-warning-soft text-warning grid place-items-center"><AlertTriangle size={22} /></div>
          <h3 className="font-bold text-lg">Are you sure?</h3>
          <p className="text-sm text-ink-muted">
            ferroBid will cut its commission from the sale proceeds of <span className="font-semibold text-ink">{catCode}</span> and remit the balance to you.
          </p>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button variant="danger" className="flex-1" onClick={() => setPhase('confirm2')}>Yes, continue</Button>
          </div>
        </div>
      )}

      {phase === 'confirm2' && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="mx-auto size-12 rounded-2xl bg-danger-soft text-danger grid place-items-center"><AlertTriangle size={22} /></div>
            <h3 className="font-bold text-lg mt-3">Are you absolutely sure?</h3>
            <p className="text-sm text-ink-muted mt-1">This is your final confirmation — it can&apos;t be undone.</p>
          </div>

          <div className="card bg-surface-2 border-0 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-ink-muted">Gross sale value (accepted lots)</span>
              <span className="num font-semibold">{inr(gross)}</span>
            </div>
            <div className="flex justify-between text-sm text-danger">
              <span>Less: ferroBid commission (10%)</span>
              <span className="num font-semibold">−{inr(commission)}</span>
            </div>
            <div className="border-t border-line pt-2 flex justify-between items-baseline">
              <span className="font-semibold text-sm">Net amount ferroBid will send you</span>
              <span className="num text-xl font-bold text-success">{inr(balance)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setPhase('confirm1')}>Go back</Button>
            <Button variant="danger" className="flex-1" onClick={settle}>Confirm &amp; settle</Button>
          </div>
        </div>
      )}

      {phase === 'processing' && (
        <div className="py-10 flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-ember" />
          <div className="font-semibold">Settling with ferroBid…</div>
          <div className="text-xs text-ink-faint">Deducting commission and releasing your balance (simulated)</div>
        </div>
      )}

      {phase === 'done' && (
        <div className="py-8 flex flex-col items-center gap-3 text-success text-center">
          <CheckCircle2 size={40} />
          <div className="font-bold text-ink">Settled</div>
          <div className="text-sm text-ink-muted max-w-xs">
            {inr(commission)} commission deducted · <span className="num font-semibold text-ink">{inr(balance)}</span> is on its way to you for {catCode}
          </div>
        </div>
      )}
    </Modal>
  )
}
