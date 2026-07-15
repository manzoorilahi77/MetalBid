import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, FileText, Download, ScrollText } from 'lucide-react';
import { useApp, DEMO_USER_ID, catalogueById, eventForCatalogue, lotsForCatalogue, catalogueEmdAmount } from '../store';
import { SectionTitle, Card, Empty, Badge } from '../components/ui';
import { Reveal } from '../components/fx';
import { LotCard } from '../components/LotCard';
import { FilterBar, DEFAULT_LOT_FILTERS, applyLotFilters } from '../components/FilterBar';
import { EmdOtpGate } from '../components/EmdOtpGate';
import { inrCompact } from '../utils';

export default function CatalogueDetail() {
  const { eventId, catalogueId } = useParams();
  const nav = useNavigate();
  const {
    auctionEvents, catalogues, lots, auctions, bids, now, role,
    kycStatus, kycProfile, emdLockedCatalogues, lockCatalogueEmd, placeBid, pushToast,
  } = useApp();
  const catalogue = catalogueById(catalogues, catalogueId ?? '');
  const event = catalogue ? eventForCatalogue(auctionEvents, catalogue.id) : undefined;

  const [filters, setFilters] = useState(DEFAULT_LOT_FILTERS);
  const [emdGateOpen, setEmdGateOpen] = useState(false);
  const [pendingBid, setPendingBid] = useState<{ auctionId: string; amount: number } | null>(null);

  const catalogueLots = catalogue ? lotsForCatalogue(lots, catalogue) : [];
  const canBid = role === 'buyer' || role === 'seller';
  const emdAmount = catalogue ? catalogueEmdAmount(lots, catalogue) : 0;
  const emdLocked = catalogue ? emdLockedCatalogues.includes(catalogue.id) : false;

  const rows = useMemo(() => {
    const withAuctions = catalogueLots.map((lot) => ({ lot, auction: auctions.find((a) => a.id === lot.auctionId) }));
    return applyLotFilters(withAuctions, filters);
  }, [catalogueLots, auctions, filters]);

  const tryBid = (auctionId: string, amount: number) => {
    if (!canBid) { nav('/auth/login'); return; }
    if (kycStatus !== 'verified') { pushToast({ title: 'Complete KYC first', body: 'KYC verification is required before bidding.', tone: 'error' }); return; }
    if (!emdLocked) {
      setPendingBid({ auctionId, amount });
      pushToast({ title: 'OTP sent to both channels (simulated)', body: `Sent via SMS to ${kycProfile.phone} and email to ${kycProfile.email} — try 1234.`, tone: 'info' });
      setEmdGateOpen(true);
      return;
    }
    placeBid(auctionId, amount);
  };

  const onEmdVerified = () => {
    if (!catalogue) return;
    const ok = lockCatalogueEmd(catalogue.id);
    if (ok && pendingBid) placeBid(pendingBid.auctionId, pendingBid.amount);
    setPendingBid(null);
  };

  if (!catalogue || !event) {
    return (
      <div className="text-sm text-muted">
        Catalogue not found. <button className="text-steel-700 dark:text-steel-300 font-semibold cursor-pointer" onClick={() => nav('/browse')}>Back to marketplace</button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-faint">
        <button className="hover:text-ink cursor-pointer" onClick={() => nav('/browse')}>Browse</button>
        <ChevronRight size={12} />
        <button className="hover:text-ink cursor-pointer" onClick={() => nav(`/events/${eventId}`)}>{event.name}</button>
        <ChevronRight size={12} />
        <span className="text-muted">{catalogue.title}</span>
      </div>

      <SectionTitle
        title={catalogue.title}
        sub={`${catalogueLots.length} lot${catalogueLots.length === 1 ? '' : 's'} in this bid room`}
        right={emdLocked
          ? <Badge tone="tone-emerald">EMD locked · bid on any lot</Badge>
          : <Badge tone="tone-amber">EMD {inrCompact(emdAmount)} unlocks the room</Badge>}
      />

      {(catalogue.additionalInfo.description || catalogue.additionalInfo.terms || catalogue.documents.length > 0) && (
        <Card className="mb-4 p-4">
          {catalogue.additionalInfo.description && <p className="text-sm text-muted">{catalogue.additionalInfo.description}</p>}
          {catalogue.additionalInfo.terms && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-faint"><ScrollText size={13} className="mt-0.5 shrink-0" /> {catalogue.additionalInfo.terms}</div>
          )}
          {catalogue.documents.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {catalogue.documents.map((d) => (
                <span key={d.id} className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1.5 text-[11px] font-semibold text-muted">
                  <FileText size={12} /> {d.label} <Download size={11} />
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      <FilterBar lots={catalogueLots} filters={filters} onChange={setFilters} />

      {rows.length === 0 && <Empty title="No lots match your filters" sub="Try a different metal, grade, price or quantity range." />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ lot, auction }, idx) => {
          const iAmLeading = auction?.leaderId === DEMO_USER_ID;
          const iHaveBid = !!auction && bids.some((b) => b.auctionId === auction.id && b.bidderId === DEMO_USER_ID);
          return (
            <Reveal key={lot.id} delay={Math.min(idx, 8) * 60}>
              <LotCard
                lot={lot} auction={auction} now={now} onClick={() => nav(`/lot/${lot.id}`)}
                inlineBid iAmLeading={iAmLeading} iHaveBid={iHaveBid}
                onBid={(amount) => auction && tryBid(auction.id, amount)}
              />
            </Reveal>
          );
        })}
      </div>

      <EmdOtpGate
        open={emdGateOpen} onClose={() => setEmdGateOpen(false)}
        amount={emdAmount} phone={kycProfile.phone} email={kycProfile.email}
        onVerified={onEmdVerified}
      />
    </div>
  );
}
