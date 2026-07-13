import { Banknote, Percent, Clock3, ReceiptIndianRupee, Save } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Btn, Badge, Field, inputCls } from '../../components/ui';
import { inr } from '../../utils';

/** Financial & commercial policy — static config screens with mock save (WBS v3.1 F47). */
export default function Financial() {
  const { config, updateConfig, pushToast } = useApp();
  const fin = config.financial;

  const numField = (key: keyof typeof fin, label: string, hint: string, step = 0.5) => (
    <Field label={label} hint={hint}>
      <input
        type="number" step={step} className={inputCls} value={fin[key] as number}
        onChange={(e) => updateConfig('financial', key, Number(e.target.value))}
      />
    </Field>
  );

  return (
    <div>
      <SectionTitle
        title="Financial & Commercial Config"
        sub="EMD policy, commission and payment windows — applied platform-wide (mock save)"
        right={<Badge tone="tone-steel"><Banknote size={12} /> Governs settlement maths</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><Percent size={15} className="text-steel-500" /> EMD % by metal category</h3>
          <p className="mt-0.5 text-xs text-faint">Earnest money locked before bidding, as % of the lot's base price.</p>
          <div className="mt-4 space-y-2.5">
            {Object.entries(fin.emdPercentByMetal).map(([metal, pct]) => (
              <div key={metal} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5">
                <span className="flex-1 text-sm font-semibold text-ink">{metal}</span>
                <input
                  type="number" min={1} max={25} step={0.5} value={pct as number}
                  onChange={(e) => updateConfig('financial', 'emdPercentByMetal', { ...fin.emdPercentByMetal, [metal]: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-right text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-steel-500/25"
                />
                <span className="w-4 text-sm font-bold text-faint">%</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><ReceiptIndianRupee size={15} className="text-steel-500" /> Commission & premium</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {numField('commissionPercent', 'Platform commission %', 'Charged to the seller on the hammer price')}
              {numField('buyerPremiumPercent', "Buyer's premium %", 'Added to the winner\'s invoice')}
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><Clock3 size={15} className="text-steel-500" /> Payment windows & penalties</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {numField('paymentWindowHours', 'Payment window (hours)', 'Winner must pay in full within this window', 1)}
              {numField('latePenaltyPercentPerDay', 'Late penalty % / day', 'Accrues after the window lapses')}
            </div>
            <div className="mt-4">
              <Field label="Refund approval threshold (₹)" hint={`Refunds above ${inr(fin.refundApprovalAbove)} need Super Admin approval`}>
                <input
                  type="number" step={50000} className={inputCls} value={fin.refundApprovalAbove}
                  onChange={(e) => updateConfig('financial', 'refundApprovalAbove', Number(e.target.value))}
                />
              </Field>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-line bg-surface-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-faint">Prototype note: values update the in-memory config that drives EMD/settlement copy across the app — no backend involved.</p>
        <Btn variant="accent" className="w-full sm:w-auto" onClick={() => pushToast({ title: 'Financial config saved (mock)', body: 'Policy applies to new auctions from now on.', tone: 'success' })}>
          <Save size={14} /> Save changes
        </Btn>
      </div>
    </div>
  );
}
