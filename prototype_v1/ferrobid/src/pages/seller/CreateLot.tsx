import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Save } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Btn, Field, inputCls, FileDrop } from '../../components/ui';

const METALS = ['Ferrous', 'Copper', 'Aluminium', 'Brass', 'Stainless', 'Zinc', 'Lead', 'Tin'];
const CATEGORIES = ['Scrap', 'Ingots', 'Coils', 'Offcuts', 'Dross', 'Turnings'];
const HUES: Record<string, number[]> = {
  Ferrous: [215, 230], Copper: [24, 16], Aluminium: [200, 190], Brass: [45, 38],
  Stainless: [205, 195], Zinc: [220, 200], Lead: [230, 250], Tin: [210, 240],
};

export default function CreateLot() {
  const nav = useNavigate();
  const { createLot } = useApp();
  const [f, setF] = useState({ title: '', metal: 'Ferrous', category: 'Scrap', grade: '', quantity: '', location: '', description: '', basePrice: '', reservePrice: '', emdAmount: '', increment: '5000' });
  const [images, setImages] = useState(0);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const valid = f.title && f.grade && f.quantity && f.location && Number(f.basePrice) > 0 && Number(f.reservePrice) > 0 && images >= 2;

  const save = (asDraft: boolean) => {
    createLot({
      title: f.title, metal: f.metal, category: f.category, grade: f.grade, quantity: f.quantity,
      location: f.location, description: f.description || 'No description provided.',
      basePrice: Number(f.basePrice), reservePrice: Number(f.reservePrice),
      emdAmount: Number(f.emdAmount || Math.round(Number(f.reservePrice) * 0.05)), increment: Number(f.increment),
      imageHues: HUES[f.metal],
    }, asDraft);
    nav('/seller/lots');
  };

  return (
    <div>
      <SectionTitle title="List a Lot" sub="New lots go to Field Executive Officer inspection before they can be auctioned" />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Lot title">
                <input className={inputCls} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Heavy Melting Steel Scrap (HMS 80:20)" />
              </Field>
            </div>
            <Field label="Metal type">
              <select className={inputCls} value={f.metal} onChange={(e) => set('metal', e.target.value)}>{METALS.map((m) => <option key={m}>{m}</option>)}</select>
            </Field>
            <Field label="Category">
              <select className={inputCls} value={f.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </Field>
            <Field label="Grade / specification">
              <input className={inputCls} value={f.grade} onChange={(e) => set('grade', e.target.value)} placeholder="e.g. HMS 80:20" />
            </Field>
            <Field label="Quantity">
              <input className={inputCls} value={f.quantity} onChange={(e) => set('quantity', e.target.value)} placeholder="e.g. 25 MT" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Material location">
                <input className={inputCls} value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="City, State" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Description">
                <textarea className={inputCls} rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Condition, sourcing, loading notes…" />
              </Field>
            </div>
            <Field label="Base price (₹)">
              <input className={inputCls} value={f.basePrice} onChange={(e) => set('basePrice', e.target.value.replace(/[^\d]/g, ''))} placeholder="850000" />
            </Field>
            <Field label="Reserve price (₹)">
              <input className={inputCls} value={f.reservePrice} onChange={(e) => set('reservePrice', e.target.value.replace(/[^\d]/g, ''))} placeholder="890000" />
            </Field>
            <Field label="EMD (₹)" hint="Defaults to 5% of reserve if left blank">
              <input className={inputCls} value={f.emdAmount} onChange={(e) => set('emdAmount', e.target.value.replace(/[^\d]/g, ''))} placeholder="auto" />
            </Field>
            <Field label="Bid increment (₹)">
              <input className={inputCls} value={f.increment} onChange={(e) => set('increment', e.target.value.replace(/[^\d]/g, ''))} />
            </Field>
          </div>

          <div className="mt-6">
            <div className="mb-2 text-xs font-semibold text-muted">Lot images (minimum 2 — simulated upload)</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <FileDrop key={i} label={`Photo ${i + 1}`} done={images > i} onUpload={() => setImages((n) => Math.max(n, i + 1))} />
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Btn variant="outline" onClick={() => save(true)} disabled={!f.title}><Save size={15} /> Save as draft</Btn>
            <Btn variant="accent" className="flex-1" disabled={!valid} onClick={() => save(false)}>
              <Send size={15} /> Submit for verification
            </Btn>
          </div>
          {!valid && <p className="mt-2 text-[11px] text-faint">Complete the details, pricing and at least 2 photos to submit.</p>}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-bold text-ink">What happens next?</h3>
            <ol className="mt-3 space-y-3 text-xs text-muted">
              {[
                ['Verification', 'A Field Executive Officer inspects quality, quantity, condition & image authenticity.'],
                ['Auction setup', 'Approved lots are scheduled with timings, increments, reserve & EMD.'],
                ['Live bidding', 'Watch bids in real time on your read-only monitor.'],
                ['Fulfilment', 'Settlement, pickup and handover are managed for you.'],
              ].map(([t, s], i) => (
                <li key={t} className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-steel-500/15 text-[10px] font-bold text-steel-700 dark:text-steel-300">{i + 1}</span>
                  <span><b className="text-ink">{t}.</b> {s}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
