1. What to build

A high-fidelity clickable prototype of ferroBid — a B2B, online auction marketplace for India and in-future it will be for global and buyer and seller will have subscription. It must look and feel like a shippable product and let a reviewer click through every role and flow, but it has no backend: all data is seeded from local JSON, all "real-time" behavior is simulated client-side, auth accepts any OTP, and payments are mocked. It's fine if state resets on reload (or persist in-memory / localStorage for the session).

Model the domain the way real Indian metal auction houses work (metaljunction, MSTC, matexnet): an Auction is a Catalogue containing many Lots; buyers shortlist the lots they want, fund pre-bid EMD per lot, and bid a rate per unit of measurement; material sells as-is-where-is after inspection.


2. Hard constraints


Frontend only. No API, no DB, no websockets, no auth server, no payment gateway.
Data from local JSON under src/data/mock/ loaded into a client store. Treat it as the source of truth; mutations happen in-memory.
Simulated real-time: a client tick loop drives countdowns, competing-bidder bots, and anti-snipe extensions.
Mock auth: phone + OTP screen accepts any 4-digit code; a demo role switcher in the header jumps between all roles.
Mock payments: wallet top-up and EMD funding show a fake UPI/NetBanking/RTGS picker with a processing delay, then succeed.
Every screen reachable and visually complete — no dead ends, no "coming soon" stubs on core flows.



3. New visual style (this is a primary deliverable — do NOT reuse a generic dashboard look)

Design a fresh, distinctive, industrial-modern marketplace aesthetic. Think confident editorial e-commerce, not an admin template. Cohesive across home and every inner page.

Direction — "Forge": warm-industrial, high-contrast, generous whitespace, big confident type, flat surfaces, purposeful motion. Trustworthy and premium, not flashy.

Palette (light + dark, use CSS variables/tokens):


Canvas: warm off-white paper #FAF8F5 (light) / deep graphite #141210 (dark).
Ink: near-black graphite for primary text; muted warm-gray for secondary.
Primary accent — molten ember #E4572E (CTAs, brand, live states).
Secondary — steel blue #2B4C7E (links, info, "upcoming").
Semantic: success green, warning amber, danger red. Status system: Live = ember/green with a subtle pulse, Upcoming = steel blue, Closing-soon = amber, Closed = neutral gray.


Typography:


Headings/display: a modern grotesk (e.g. Space Grotesk / Geist / Clash) — large, tight, sentence case.
Body: Inter (or system UI), 16px, line-height 1.6.
Tabular/mono numerals (JetBrains Mono or Inter tabular) for all rates, EMD, prices, and countdowns so numbers align and don't jitter.


Components: cards with 16px radius + hairline borders, flat (no heavy shadows/gradients); pill status chips; segmented controls + tabs (not sidebars); sticky action bars; a countdown widget (compact digital + optional ring) with red-pulse urgency under 2 minutes; a live bid ladder with slide-in on new bids; confetti on win. Big touch targets, keyboard accessible, fully responsive (mobile → desktop).

Motion: quick and functional — hover lifts on cards, new-bid slide-in, countdown tick, toast slide-ins. Nothing gratuitous.

Deliver this as a small design-token layer (colors, type scale, radius, spacing, status colors) that every page consumes, so the theme is consistent and swappable.


4. Navigation & layout model (IMPORTANT — read carefully)

Do NOT use a left-pane / right-pane dashboard shell for inner pages — not even for admin. The old prototype_v1 wrapped every authenticated route in a sidebar+header AppShell; replace that entirely and keep is in the HomeScreen instead so that there can be mock login can happen to go through all the roles like simulated view.

Instead, every page (home, buyer, seller, and all admin tiers) uses the same home-screen marketplace chrome:


A sticky top navigation bar: logo + wordmark, primary nav links, a global search, a wallet/EMD balance chip, a notification bell, a profile menu, and the demo role switcher. Nav links adapt to the active role.
A content area that is full-width and card/section based.
For multi-section areas (e.g. admin modules, buyer account, seller workspace), use a secondary contextual nav directly under the header — a tab bar or segmented control, or a top "module launcher" grid — never a persistent left sidebar.
A consistent footer.


Admin pages specifically: render admin modules (pipeline, verification, catalogue builder, settlement, control tower, user management, etc.) as full-width sections inside the marketplace theme — card grids, inline tables, a horizontal Kanban for the pipeline, tabs for sub-sections. They should visually feel like the same product as the home page, just with denser data. Same header, same tokens, same type, same cards.


5. Page inventory (all in the new style)

Public


Home / Landing (see §6).
Login — phone + OTP (any code), Register/Login toggle, "Continue as guest".
Buyer and seller will have subscription based after login to do necessary transaction.


Shared


Browse Catalogues — Live / Upcoming / Closed tabs; filters (category, yard/region, seller, EMD range, closing-soon) + search; catalogue cards.
Auction (Catalogue) Detail (see §7).
Bidding Room — per-lot, rate-per-UOM, ladder, countdown, quick-bid/auto-bid, EMD gate, win confetti.
Noticeboard — platform + per-catalogue announcements.


Buyer — Dashboard, My Shortlist & EMD, My Bids & Results, Fulfilment Tracker, Wallet & EMD ledger, Become a Seller (KYC), Profile/Settings, My subscription.

Seller — Workspace, Create Lot (+ bulk CSV/photos), My Lots & Batches, Live Monitor (read-only), Results & Reports, My subscription.

Field Executive — Inspection queue + per-lot inspection form (mobile-first look): measured qty, photo capture placeholders, checklist, Verify/Flag/Reject.

Executive Manager — Pipeline (horizontal Kanban), Lot Approval, Catalogue Builder (see §8), Auction Setup, Settlement, Logistics, Handover, Approvals.

Sub-Admin — Ops console, Bid Monitor (flag → approval), Work Queue with SLA chips, Approvals, gated modules per template, Manage subscriptions.

Super Admin — Dashboard/KPIs, Team & Permissions, User Management, Control Tower (pause/resume/extend/cancel/void-bid), Blacklist & Defaulters, Financial Config, Master Data, Audit Trail, Manage subscriptions.

Also add (were missing before): Profile/edit, Help/FAQ, Terms & Privacy, a simple dispute/ticket screen, notification preferences.


6. Home page (new style)

A modern marketplace landing, not a dashboard:

At the top right need to show the IP address in all the pages and if in future while we developing the backend and realtime database we have to restrict login or bidding from the same IP address.
Hero — bold headline + value prop, a prominent catalogue/lot search, primary CTA ("Register to Bid"), secondary ("Sell your material"). Live-auction count / next-closing ticker.
Live auctions rail — horizontally scrollable catalogue cards with status chip + live countdown + lot count + EMD-from.
Upcoming auctions — grid of catalogue cards with "starts in".
Browse by category — tiles for the metal categories: assets, scrap, flat products, long products, melting products, coal, chemicals, minerals, ferro alloys (metaljunction's taxonomy).
How it works — three short tracks (Buyer / Seller / Verified & catalogued by our team) explaining inspection → catalogue → auction.
Trust band — stats (lots sold, verified yards, buyers) + "physically inspected & catalogued" trust message.
Subscription plans for Buyers/Bidders (need to show all the required details what we can offer them after subscription).
Footer — links, categories, support, legal, and few more.



7. Auction (Catalogue) Detail page — model on metaljunction

Reference: https://auction1.metaljunction.com/pre/auctions/223592 (a catalogue/auction detail page). Reproduce its information architecture in the new Forge style. No left/right admin panes — this is a marketplace detail page under the top nav.

Header block


Breadcrumb (Home / Browse / Catalogue) → catalogue title + code (e.g. AUC-2418), status chip, live countdown, locations (name or code of the city).
Key-facts strip (mono numerals): seller/principal, e-auction date & time (start–end), inspection window (dates + visiting hours + contact person), yard/material location, bid validity days, and an EMD summary for the buyer's current selection.
Actions: Download catalogue PDF, Accept Terms & Conditions (versioned, gates bidding).


Body — tabs or stacked sections:


Lots (the annexure) — the main content. A filterable, shortlistable list of all lots (see §9). Each lot row/card: lot no, description, metal + grade, indicative qty + UOM, start rate, increment, pre-bid EMD, status, an "as-is-where-is" note, an inspection-report highlight (measured qty, condition), a photo thumbnail strip, and a Bid CTA → Bidding Room. Prominent "quantity is indicative — final on weighment" reminder.
Terms & Conditions — General + Special + lot-specific (precedence noted).
Inspection & Contacts — window, yard address/map placeholder, contact persons (inspection/lifting, payment/DO, confirmation), "max 2 persons per firm" rule, in-app book inspection slot (mock pass/QR).
Documents — catalogue PDF, sample test certs, GST/TCS notes, yard map, payment-schedule sheet.


Sticky bottom action bar — running selection summary + "Fund EMD for selected" + "Enter bidding room".


8. Catalogue Builder (admin, in the home theme — no sidebar)

A full-width, tabbed builder inside the marketplace chrome:


Step/tab 1 Select lots — pick from approved lots (filter by seller/metal/yard), drag to order & number, bulk-set increment / EMD % / UOM / sale-basis.
Step/tab 2 Details — title, auction type, start/end schedule, inspection window + contact + visiting hours, anti-snipe rule, bid-validity days, choose T&C set.
Step/tab 3 Documents — attach files; auto-generate a preview of the catalogue PDF/annexure.
Step/tab 4 Preview & publish — "view as buyer" rendering of the auction detail page, then Publish now / Schedule.



9. Lot filtering, shortlist & scoped EMD (build exactly this — carry over from the spec)

On any catalogue with many lots (e.g. 20), the buyer must narrow to their own set and fund EMD only for it:


Filter (view-level): metal, grade, quantity range, UOM, yard, EMD range, start-rate range, status, hazardous flag, + lot-no/description search; sortable; combinable; "clear all".
Shortlist ("My Lots to Bid", persistent per buyer + catalogue): select lots via checkbox/star; a "Show only my selected lots" toggle collapses 20 lots to their 4–5; a pinned selection summary bar: N lots selected · Pre-bid EMD ₹X · Funded ₹Y · Shortfall ₹Z with a single "Fund EMD for selected lots" batch action + per-lot funded/pending chips.
EMD scoped to the selection only: required EMD = Σ (pre-bid EMD of shortlisted lots); never fund the other lots. (Selection is free; EMD locks only on explicit "Fund EMD".)
Live cockpit = the shortlist: the Bidding Room defaults to only the buyer's selected + EMD-funded lots, side by side, with the full catalogue one tap away.


Back this with a buyerLotSelection object in the store and lot-referencing wallet ledger entries so scoped funding/shortfall computes directly.


10. Roles & the demo role switcher

Roles: guest, buyer, seller, field executive, sub-admin, executive manager, super admin. Buyer is the default; seller is a capability unlocked on a buyer account after mock KYC. The header role switcher instantly re-seeds the nav and lands on that role's home. Sub-admin has a scoped permission feel (some modules gated / read-only) — represent it visually with lock/permission chips.


11. Tech stack & structure


React + TypeScript + Vite, Tailwind (v4), Zustand for state, React Router (HashRouter is fine), lucide-react icons. Add framer-motion for the motion, and a light chart lib (recharts) for admin KPIs. Optional shadcn/Radix for primitives.
Design tokens as CSS variables consumed by Tailwind theme; light/dark toggle.
All data local: src/data/mock/ →

catalogues.json (auctions: code, title, sellerId, type, status, startsAt, endsAt, inspectionFrom/To, inspectionContact, yardAddress, antiSnipe, bidValidityDays, lotIds[], documents[])
lots.json (lotNo, catalogueId, metal, category, grade, indicativeQty, uom, yard, description, startRate, increment, reserveRate, preBidEmd, saleBasis, photos[], inspectionReportId, status)
users.json (roles, kycStatus, sellerVerified, standing/defaulters)
bids.json, inspectionReports.json, wallets.json (balance + emdLocked + ledger), notifications.json, termsSets.json, deliveryOrders.json



Simulated engine (src/lib/): a useTick() loop that advances countdowns; a bot bidder that places rate bids on live lots (more often near close); anti-snipe auto-extension; auto-bid/proxy; close logic (H1 ≥ reserve → won / STA / unsold + EMD refund); confetti on win.



12. Sample data to seed (make it feel real)


~6–8 catalogues across statuses (2–3 live, 2–3 upcoming, 2 closed), each with 10–25 lots so the filter/shortlist feature is meaningful.
Realistic Indian metal lots (MS turnings, HMS 1&2, SS 304/316 offcuts, CI borings, aluminium sheet, copper wire) with indicative qty + UOM (MT/KG/PCS), plausible ₹ rates, and per-lot EMD.
A few sellers with KYC, several buyers (one with funded wallet + shortlist mid-flow), a couple with watchlist standing/defaults for the admin blacklist screen.
Inspection reports with measured qty + condition notes + photo placeholders.
Notifications spanning lifecycle/bid/wallet/system.
One catalogue pre-set so the demo buyer already has 5 lots shortlisted with partial EMD funded — to showcase §9 immediately.



13. Acceptance / deliverables


A cohesive Forge design-token layer + light/dark.
Home page in the new style (§6).
Auction detail page modeled on the metaljunction IA (§7), in the new style.
All inner pages (buyer, seller, field exec, and 3 admin tiers) in the same top-nav marketplace theme — no left/right dashboard panes anywhere.
Working shortlist + scoped-EMD flow (§9) and a simulated live Bidding Room with bots, anti-snipe, and win confetti.
Catalogue Builder (§8) and a role switcher covering every role.
Everything seeded from local JSON, no backend.


Ask me to confirm anything ambiguous, then build.