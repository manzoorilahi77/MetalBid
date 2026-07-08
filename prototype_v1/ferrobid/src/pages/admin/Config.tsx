import { useApp } from '../../store';
import { SectionTitle, Card, Toggle, Field, inputCls, Badge } from '../../components/ui';

const NUM_LABEL: Record<string, string> = {
  auctionAutoExtensionWindowSec: 'Auto-extension trigger window (seconds before close)',
  auctionAutoExtensionBySec: 'Auto-extension duration (seconds added)',
  defaultEmdPercent: 'Default EMD (% of reserve)',
  maxAutoExtensions: 'Max auto-extensions per auction',
  walletTopupLimit: 'Wallet top-up limit (₹)',
};
const POLICY_LABEL: Record<string, string> = {
  requireGST: 'GST certificate required',
  requirePAN: 'Business PAN required',
  requireBankProof: 'Bank proof (cancelled cheque) required',
  requireMSME: 'MSME / Udyam certificate required',
};
const NOTIF_LABEL: Record<string, string> = {
  onEntityVerified: 'Entity verified', onLotVerified: 'Lot verified', onAuctionCreated: 'Auction created',
  onWon: 'Auction won', onSettled: 'Settlement completed', onPickupScheduled: 'Pickup scheduled', onHandover: 'Handover complete',
};

export default function Config() {
  const { config, updateConfig } = useApp();

  return (
    <div>
      <SectionTitle title="System Configuration" sub="Platform parameters, entity-verification policy and notification rules (all mock)" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="mb-1 text-sm font-bold text-steel-950">Auction & wallet parameters</h3>
          <p className="mb-4 text-[11px] text-slate-400">The bidding engine reads these values live — try shrinking the extension window.</p>
          <div className="space-y-3">
            {Object.entries(config.platform).map(([k, v]) => (
              <Field key={k} label={NUM_LABEL[k] ?? k}>
                <input
                  className={inputCls} value={String(v)}
                  onChange={(e) => updateConfig('platform', k, Number(e.target.value.replace(/[^\d]/g, '') || 0))}
                />
              </Field>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-1 text-sm font-bold text-steel-950">Entity verification policy</h3>
          <p className="mb-4 text-[11px] text-slate-400">Documents required to unlock the Seller capability.</p>
          <div className="space-y-3">
            {Object.entries(config.entityVerificationPolicy).filter(([, v]) => typeof v === 'boolean').map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-600">{POLICY_LABEL[k] ?? k}</span>
                <Toggle on={v as boolean} onChange={() => updateConfig('entityVerificationPolicy', k, !v)} />
              </div>
            ))}
            <div className="rounded-xl bg-slate-50 px-3.5 py-3 text-xs text-slate-500 ring-1 ring-slate-200">
              Review SLA: <b className="text-steel-900">{config.entityVerificationPolicy.reviewSLA}</b> ·
              Auto-return after <b className="text-steel-900">{config.entityVerificationPolicy.autoReturnAfterDays} days</b> of inactivity
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-1 text-sm font-bold text-steel-950">Lifecycle notifications</h3>
          <p className="mb-4 text-[11px] text-slate-400">Fire a notification on each hand-off.</p>
          <div className="space-y-3">
            {Object.entries(config.notifications).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-600">{NOTIF_LABEL[k] ?? k}</span>
                <Toggle on={v as boolean} onChange={() => updateConfig('notifications', k, !v)} />
              </div>
            ))}
          </div>
          <Badge tone="bg-slate-100 text-slate-500 ring-slate-300" className="mt-4">Changes apply in-session only (prototype)</Badge>
        </Card>
      </div>
    </div>
  );
}
