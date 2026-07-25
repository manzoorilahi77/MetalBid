# ferroBid — Guest 2 page content (editable)

This file mirrors the **current** copy of three public pages so you can rewrite it to a
FAANG-level bar. Edit freely, then hand it back and I'll implement your version.

**Conventions**
- `[accent]…[/accent]` = text rendered in the **ember** brand color (the orange highlight in a headline).
- Each page = a stack of blocks: **Hero → Section(s) → Closing CTA**.
- **Section** = an eyebrow (small uppercase label) + a title + content.
- **Feature card** = a small icon + a bold title + a one-line body. Grids are 2-up or 3-up.
- Icons and layout (grid columns, timeline, glossary) are structural — you can request changes to those too; I'll wire them.
- Every CTA is `Label → destination`. Real destinations today: `/browse` (live auctions), `/login` (register/sign in), `/g2/...` (other Guest 2 pages).

---

## 1) For Buyers
**URL:** `/g2/solutions/buyers`

### SEO
- **Title:** For buyers
- **Meta description:** Source verified metal without the yard-visit gamble. Shortlist lots, fund EMD only on what you contest, bid a live rate, then pay and lift.

### Hero
- **Eyebrow:** For buyers
- **Headline:** Source verified metal — [accent]without the yard-visit gamble[/accent].
- **Subhead:** Shortlist lots, fund EMD only on what you'll contest, and bid a live rate with full inspection reports in hand. Win, pay, lift. That's the whole loop.
- **Primary CTA:** Browse live auctions → `/browse`
- **Secondary CTA:** Register to bid → `/login`

### Section 1 — "The buyer loop" · "Four steps, every time." (2-up feature grid)
1. **1 · Shortlist** — Filter live catalogues by category, region and EMD band; star the lots you want to contest.
2. **2 · Fund EMD** — Lock pre-bid earnest money per lot from your wallet. Lose the lot and it is auto-released.
3. **3 · Bid live** — Forward auction on rate per UOM, with anti-snipe extensions so no one steals it in the last second.
4. **4 · Pay & lift** — H1 gets the delivery order. Pay, schedule lifting, and weighment settles the final quantity.

### Section 2 — "Built for serious buyers" · "Tools that respect your time." (3-up feature grid)
1. **Auto-bid / proxy** — Set a max rate; the engine bids for you up to it. No sitting at the screen to hold your position.
2. **Wallet & EMD ledger** — Every lock, release and refund is a line item. SmartPay top-up via UPI, NetBanking or RTGS.
3. **Fulfilment tracker** — Payment → demand draft → lifting scheduled → lifted → completed, with a gate-pass checklist.

### Closing CTA
- **Title:** Your next lot is already live.
- **Sub:** Registration is free — you only fund EMD on the lots you choose to contest.
- **Primary CTA:** Register to bid → `/login`
- **Secondary CTA:** Browse live auctions → `/browse`

---

## 2) For Sellers
**URL:** `/g2/solutions/sellers`

### SEO
- **Title:** For sellers
- **Meta description:** Turn surplus into a competitive price with the paperwork handled — inspected, catalogued and sold to EMD-backed buyers, with your reserve rate protected.

### Hero
- **Eyebrow:** For sellers
- **Headline:** Turn surplus into [accent]a competitive price[/accent] — with the paperwork handled.
- **Subhead:** Submit your material once. We inspect it, catalogue it, and put it in front of a pool of EMD-backed buyers — with your reserve rate confidential and protected.
- **Primary CTA:** List your material → `/login`
- **Secondary CTA:** Browse live auctions → `/browse`

### Section 1 — "The seller pipeline" · "Submit once. We handle the rest." (2-up feature grid)
1. **1 · Submit lots** — Bulk CSV / photo upload with indicative quantity, grade and yard location.
2. **2 · We inspect** — Our field team visits and verifies every lot — you don't chase buyers around the yard.
3. **3 · Catalogued** — Verified lots enter a scheduled auction with reserve protection. Below reserve closes as STA, not a forced sale.
4. **4 · Get paid** — Post-auction settlement with GST / TCS computed; funds to your account.

### Section 2 — "Protection built in" · "Your reserve, your terms." (3-up feature grid)
1. **Reserve stays secret** — Buyers never see your reserve rate. H1 below it is subject to your approval — never auto-sold.
2. **Verified demand** — Only KYC-verified, EMD-funded buyers can bid. Bidder standing is monitored; defaulters are flagged.
3. **Live monitor** — Watch the bid ladder on your own lots in real time — read-only, so the auction stays clean.

### Section 3 — (title only, one paragraph)
- **Title:** Selling is a capability, not a separate signup.
- **Body:** Every account starts as a buyer. Selling unlocks on the same account once your business entity and KYC are verified — so you can bid and sell from one login.

### Closing CTA
- **Title:** Put your material in front of verified demand.
- **Sub:** Talk to our team about listing your yard's surplus, scrap or assets.
- **Primary CTA:** List your material → `/login`
- **Secondary CTA:** Browse live auctions → `/browse`

---

## 3) How It Works
**URL:** `/g2/how-it-works`

### SEO
- **Title:** How it works
- **Meta description:** One catalogue, many lots, a fair close. How a lot travels from a seller's yard to a buyer's truck — inspection, catalogue, bidding, close, settlement, lifting — plus the terms, defined.

### Hero
- **Eyebrow:** How it works
- **Headline:** One catalogue. Many lots. [accent]A fair close.[/accent]
- **Subhead:** An auction on ferroBid is a catalogue of individually inspected lots. Here's exactly how a lot travels from a seller's yard to a buyer's truck.
- **Primary CTA:** Browse live auctions → `/browse`
- **Secondary CTA:** Register to bid → `/login`

### Section 1 — "The lifecycle" · "From yard to truck, step by step." (vertical timeline, 6 stages)
1. **Inspection** — A field executive measures and photographs the lot, then marks it verified, flagged or rejected.
2. **Catalogue** — Verified lots are grouped into a scheduled auction with start rate, increment, reserve and per-lot EMD.
3. **Live bidding** — Buyers bid a rate per UOM. Anti-snipe extends the close if a bid lands inside the final window.
4. **Close** — H1 at or above reserve sells; below reserve becomes STA; no bids means unsold. EMD auto-releases to losers.
5. **Settlement** — The winner pays; GST / TCS is computed; a demand draft is issued.
6. **Lifting** — Schedule pickup: vehicle at weighbridge, loading, gross weighment, gate pass and e-way bill — done.

### Section 2 — "Speak the language" · "The terms, defined openly." (glossary, 2-column cards)
- **EMD** — Earnest Money Deposit — refundable earnest money locked per lot before you can bid.
- **H1** — The highest bid on a lot at close.
- **STA** — Subject to approval — when H1 is below the seller's confidential reserve rate.
- **Reserve rate** — The seller's minimum acceptable rate. Confidential — never shown to buyers.
- **As-is-where-is** — Material sells in its current condition and location, after inspection.
- **Weighment** — Physical re-weighing at lifting that sets the final billed quantity.
- **Anti-snipe** — A last-window rule that auto-extends the close so timing can't steal a lot.
- **Delivery order (DO)** — The document authorising the winning buyer to lift the material.

### Closing CTA
- **Title:** Now see it on a real lot.
- **Sub:** Open a live catalogue and follow a lot through its countdown, bids and inspection report.
- **Primary CTA:** Browse live auctions → `/browse`
- **Secondary CTA:** For buyers → `/g2/solutions/buyers`

---

## Notes for your rewrite
- **Add or remove blocks freely.** Want a stats band, testimonial, FAQ, comparison table, or images per section? Note it inline (e.g. `[NEW SECTION: 3 KPIs …]`) and I'll build it.
- **Domain terms are load-bearing** — keep EMD, H1, STA, reserve rate, as-is-where-is, weighment, anti-snipe, UOM, DO, GST/TCS, e-way bill accurate; that vocabulary *is* the credibility.
- **Positioning:** India-proven, global-ready — elevate the polish, don't overclaim markets/features the product doesn't have yet.
- **Any real numbers** you add (buyers, lots, savings) should have a source, or flag them as placeholders.
