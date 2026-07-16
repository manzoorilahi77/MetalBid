# ferroBid v2 — clickable prototype

High-fidelity, frontend-only prototype of a B2B metal e-auction marketplace for India,
modelled on how real Indian auction houses work (metaljunction, MSTC, matexnet):
an **Auction is a Catalogue of Lots**; buyers shortlist lots, fund pre-bid **EMD per lot**,
and bid a **rate per unit of measurement**; material sells **as-is-where-is** after inspection.

## Run

```bash
npm install
npm run dev        # local dev
npm run build      # static build (GitHub Pages ready — relative base + HashRouter)
npm run mock       # regenerate src/data/mock/*.json seed data
```

## What's simulated (no backend anywhere)

- **Data** — seeded from `src/data/mock/*.json`, timestamps rebased to "now" on load so
  live auctions are genuinely live on every reload. Mutations live in a Zustand store.
- **Real-time** — a 1 s tick drives countdowns, competing-bidder bots (more aggressive near
  close), anti-snipe auto-extensions, auto-bid proxy, and close logic
  (H1 ≥ reserve → sold · below reserve → STA · no bids → unsold, with EMD auto-release).
- **Auth** — phone + OTP screen accepts any 4-digit code; the header **demo role switcher**
  jumps between Guest / Buyer / Seller / Field Executive / Executive Manager / Sub-Admin / Super Admin.
- **Payments** — wallet top-up & EMD funding show a fake UPI/NetBanking/RTGS picker with a
  processing delay, then succeed.

State resets on reload by design.

## Where to look

| Thing | Path |
|---|---|
| Design tokens (Forge theme, light/dark) | `src/index.css` |
| Domain types | `src/types.ts` |
| Store + simulation engine | `src/store/store.ts` |
| Seed loader (time rebasing) | `src/store/seed.ts` |
| Mock data generator | `scripts/generate-mock.mjs` |
| UI kit | `src/components/ui.tsx` |
| Marketplace chrome (top nav, no sidebars) | `src/layout/Chrome.tsx` |
| Page contract / conventions | `ARCHITECTURE.md` |

## Demo script (suggested)

1. Land on **Home** → live rail → open **AUC-2412 (SAIL Bhilai)** — the demo buyer already
   has 5 lots shortlisted with partial EMD funded (§9 showcase).
2. Filter the 18-lot annexure, toggle **"Show only my selected lots"**, fund the EMD
   shortfall from the sticky bar, **Enter bidding room**.
3. Bid, get outbid by bots, set an auto-bid, watch anti-snipe extend the close — win → confetti.
4. Switch roles in the header: Seller live monitor → Field Executive inspection →
   Executive Manager pipeline/catalogue builder → Sub-Admin bid monitor → Super Admin control tower.
