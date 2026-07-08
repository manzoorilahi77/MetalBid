# ferroBid — Digital Metal Auction Platform (Clickable Prototype)

**🔗 Live demo:** https://manzoorilahi77.github.io/MetalBid/

High-fidelity, front-end-only prototype of the MetalBid platform (v3.0 requirements) covering
**6 roles** and the **complete lot lifecycle** — entity/lot verification → auction → fulfilment.
Built by AspiraSys for Metal Bid Technologies.

## Run it

```bash
npm install
npm run dev        # → http://localhost:5173
```

## Stack

React 19 + TypeScript + Vite · Tailwind CSS v4 · Zustand (mock store + lifecycle state machine) ·
React Router (hash routing) · lucide-react icons. No backend — all data is seeded JSON under
`src/data/mock/{role}/` per the WBS convention.

## What's simulated

- **Auth**: mobile + OTP (any code works), demo role switcher in the header covers all 6 roles.
- **Payments**: wallet top-up (Razorpay/UPI mock), EMD lock / auto-refund, settlement.
- **Live bidding**: scripted bot bidders, 1s engine tick, countdown with late-bid
  auto-extension (window/duration/max configurable in Super Admin → System Config), auto-bid (proxy).
- **Lifecycle**: `Draft → Submitted → Under Verification → Approved → Scheduled → Live →
  Won → In Settlement → Ready for Pickup → In Logistics → Handover → Closed`, driven by the
  Executive Admin pipeline with notifications fired on every hand-off.

## Suggested demo walk (happy path)

1. **Landing** (`/`) → explore as Guest → read-only marketplace with register prompts.
2. **Register** via OTP → land as **Buyer (Arjun)** → submit KYC → top up wallet → open the live
   HMS Scrap lot → lock EMD → enter the **bidding room** → bid, get outbid by bots, arm auto-bid.
3. Buyer → **Become a Seller** → fill entity form, upload docs → submit.
4. Switch role to **Executive Admin (Ravi)** → Entity Verification → approve Arjun → back as Buyer,
   see Seller unlocked.
5. As **Seller (Kavitha)** → List a Lot → submit for verification.
6. As **Executive Admin** → Lot Verification (checklist + report) → Verify → Auction Setup →
   publish live with "starts in 0 min" and a short duration → watch it in the Seller **Live Monitor**
   and bid on it as Buyer → let it close → **Settlement** (confirm payment, EMD, invoice) →
   **Logistics** (schedule pickup + handler) → **Handover** (checklist + proof) → lot **Closed**.
7. **Super Admin (Farooq)** → lifecycle KPIs, admins & permission matrix (toggle Sub-Admin perms,
   then view the gated **Sub-Admin console**), system config, cross-stage audit trail.

> Prototype boundaries: no real APIs, RBAC enforcement, payments, SMS or persistence —
> state resets on reload by design.
