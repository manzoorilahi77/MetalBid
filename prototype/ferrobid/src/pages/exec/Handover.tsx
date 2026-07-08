import { Handshake, PackageCheck } from 'lucide-react';
import { useApp } from '../../store';
import { SectionTitle, Card, Btn, Badge, CheckItem, FileDrop, Empty, LotImage } from '../../components/ui';

export default function Handover() {
  const { logistics, lots, toggleHandoverCheck, uploadProof, confirmHandover } = useApp();
  const rows = logistics.filter((x) => ['scheduled', 'in_transit'].includes(x.status));
  const doneRows = logistics.filter((x) => x.status === 'completed');

  return (
    <div>
      <SectionTitle title="Pickup & Handover" sub="Complete the pickup checklist, capture proof and close the lot" />
      {rows.length === 0 && <Empty title="No handovers pending" sub="Lots with a scheduled or in-transit pickup appear here." />}

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((x) => {
          const lot = lots.find((l) => l.id === x.lotId)!;
          const allChecked = Object.values(x.checklist).every(Boolean);
          const ready = allChecked && x.proofUploaded;
          return (
            <Card key={x.id} className="p-5">
              <div className="flex items-center gap-3">
                <LotImage hues={lot.imageHues} label={lot.metal} className="h-13 w-20 rounded-lg shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-slate-400">{x.id} · {lot.id}</div>
                  <div className="truncate text-sm font-bold text-steel-950">{lot.title}</div>
                  <div className="text-xs text-slate-400">📅 {x.pickupDate} · {x.slot} · 🚚 {x.handler}</div>
                </div>
                <Badge tone={x.status === 'in_transit' ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-indigo-50 text-indigo-700 ring-indigo-200'} className="capitalize">{x.status.replace('_', ' ')}</Badge>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Pickup checklist</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(x.checklist).map(([k, v]) => (
                    <CheckItem key={k} label={k} checked={v} onToggle={() => toggleHandoverCheck(x.id, k)} />
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <FileDrop label="Proof: photo / gate pass / signature" done={x.proofUploaded} onUpload={() => uploadProof(x.id)} />
                <Btn variant="success" className="h-full" size="lg" disabled={!ready} onClick={() => confirmHandover(x.id)}>
                  <Handshake size={17} /> Confirm handover & close lot
                </Btn>
              </div>
              {!ready && <p className="mt-2 text-[11px] text-slate-400">Complete all checklist items and upload proof to close.</p>}
            </Card>
          );
        })}
      </div>

      {doneRows.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-sm font-bold text-steel-950">Closed handovers</h2>
          <div className="space-y-2">
            {doneRows.map((x) => {
              const lot = lots.find((l) => l.id === x.lotId);
              return (
                <Card key={x.id} className="flex items-center gap-3 p-3.5">
                  <PackageCheck size={17} className="text-emerald-500 shrink-0" />
                  <div className="flex-1 text-sm font-bold text-steel-950">{lot?.title}</div>
                  <span className="text-xs text-slate-400">{x.pickupDate}</span>
                  <Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-200">Proof on file · Lot closed</Badge>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
