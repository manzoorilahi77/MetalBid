import { useState } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { useApp } from '../store';
import { SectionTitle, Card, Btn, Tabs, Modal, Badge } from '../components/ui';
import { inr, cx } from '../utils';
import type { PlanAudience } from '../types';

export default function Subscription() {
  const { role, plans, subscriptions, subscribeToPlan } = useApp();
  const canSeeSeller = role === 'seller';
  const [audience, setAudience] = useState<PlanAudience>('buyer');
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [method, setMethod] = useState('Razorpay');
  const [processing, setProcessing] = useState(false);

  const visiblePlans = plans.filter((p) => p.audience === audience);
  const active = subscriptions[audience];
  const checkoutPlan = plans.find((p) => p.id === checkoutPlanId);

  const doSubscribe = () => {
    if (!checkoutPlan) return;
    setProcessing(true);
    setTimeout(() => {
      subscribeToPlan(audience, checkoutPlan.id);
      setProcessing(false);
      setCheckoutPlanId(null);
    }, 1400);
  };

  return (
    <div>
      <SectionTitle
        title="Subscription & Billing"
        sub="Choose the plan that matches your trading volume — simulated billing, no real charge"
        right={canSeeSeller ? (
          <Tabs
            active={audience} onChange={(k) => setAudience(k as PlanAudience)}
            tabs={[{ key: 'buyer', label: 'Buyer plans' }, { key: 'seller', label: 'Seller plans' }]}
          />
        ) : undefined}
      />

      <div className="grid gap-5 md:grid-cols-3">
        {visiblePlans.map((p) => {
          const isActive = active?.planId === p.id;
          return (
            <Card key={p.id} className={cx('relative flex flex-col p-6', p.highlight && 'ring-2 ring-ember-500')}>
              {p.highlight && <Badge tone="tone-ember" className="absolute -top-3 left-6">Most popular</Badge>}
              <div className="text-sm font-bold text-ink">{p.name}</div>
              <p className="mt-1 text-xs text-muted">{p.tagline}</p>
              <div className="mt-4">
                <span className="font-display text-3xl font-extrabold text-ink">{p.price === 0 ? 'Free' : inr(p.price)}</span>
                {p.price > 0 && <span className="text-xs text-faint"> /{p.billingCycle === 'yearly' ? 'year' : 'month'}</span>}
              </div>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check size={14} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-muted">{f}</span>
                  </li>
                ))}
              </ul>
              {isActive ? (
                <Badge tone="tone-emerald" className="mt-6 w-full justify-center py-2">Current plan</Badge>
              ) : (
                <Btn variant={p.highlight ? 'accent' : 'outline'} className="mt-6 w-full" onClick={() => setCheckoutPlanId(p.id)}>
                  {p.price === 0 ? 'Switch to Free' : 'Subscribe'} <ArrowRight size={14} />
                </Btn>
              )}
            </Card>
          );
        })}
      </div>

      {active && (
        <Card className="mt-5 p-4 text-xs text-muted">
          Current {audience} plan renews on <b className="text-ink">{new Date(active.renewsAt).toLocaleDateString('en-IN')}</b> · auto-renew {active.autoRenew ? 'on' : 'off'}.
        </Card>
      )}

      <Modal open={!!checkoutPlan} onClose={() => setCheckoutPlanId(null)} title={`Subscribe — ${checkoutPlan?.name ?? ''}`}>
        {checkoutPlan && (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-2 p-4">
              <div className="text-sm font-bold text-ink">{checkoutPlan.name} · {audience === 'buyer' ? 'Buyer' : 'Seller'} plan</div>
              <div className="mt-1 font-display text-2xl font-extrabold text-ink">
                {checkoutPlan.price === 0 ? 'Free' : inr(checkoutPlan.price)}
                {checkoutPlan.price > 0 && <span className="text-xs font-normal text-faint"> /{checkoutPlan.billingCycle === 'yearly' ? 'year' : 'month'}</span>}
              </div>
            </div>
            {checkoutPlan.price > 0 && (
              <div>
                <div className="mb-1 text-xs font-semibold text-muted">Payment method (simulated)</div>
                <div className="grid grid-cols-3 gap-2">
                  {['Razorpay', 'UPI', 'NetBanking'].map((m) => (
                    <button
                      key={m} onClick={() => setMethod(m)}
                      className={cx('rounded-xl border px-3 py-2.5 text-xs font-bold cursor-pointer', method === m ? 'border-steel-600 bg-steel-500/10 text-steel-800 dark:text-steel-200' : 'border-line text-muted hover:bg-surface-2')}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Btn variant="accent" size="lg" className="w-full" disabled={processing} onClick={doSubscribe}>
              {processing ? 'Processing payment…' : checkoutPlan.price === 0 ? 'Activate free plan' : `Pay ${inr(checkoutPlan.price)} via ${method}`}
            </Btn>
            <p className="text-center text-[11px] text-faint">A fake payment gateway response is returned after ~1.5s.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
