MetalBid / ferroBid — Full Feature List & App Flow (for AI hand-off)
Context
You asked for a complete, detailed feature and app-flow breakdown of the current auction app so it can be handed to another AI as a spec — that AI's job is to redesign the visual style and build a better, more complete version called ferroBid.

Important discovery: the current repo already is a prototype named ferroBid (folder: prototype_v1/ferrobid/). It's a frontend-only, no-backend clickable prototype — React 19 + TypeScript + Vite + Zustand + Tailwind v4, using HashRouter, all data mocked from static JSON, state resets on reload. There are no real APIs, no persistence, no real-time sockets (bidding is simulated with a client-side 1s tick loop), no payments, and no SMS/OTP (any code is accepted). This matters for the hand-off: the new AI should treat this as a UX/feature spec, not a working backend to copy — it will need to design real auth, a real-time bidding backend, and persistence from scratch.

This document is the deliverable: a full feature inventory + app flow, organized so it can be pasted directly into a prompt for the next build.

1. What the app is
A B2B all commodity auction marketplace ("ferroBid — Auctions"). Sellers list lots, lots go through field executive verification and get scheduled as timed live auctions, buyers place competitive bids (with EMD deposit gating and auto-bid), and winners go through a settlement → logistics → handover pipeline. A three-tier admin hierarchy (Super Admin / Executive Admin / Sub-Admin) runs verification, auction control, settlement, and fraud/defaulter management.

2. Tech stack (current prototype)
React 19 + TypeScript, Vite (rolldown-vite)
React Router v7 (HashRouter)
Zustand for state (mock store + a lifecycle.ts state machine)
Tailwind CSS v4, lucide-react icons
No backend — everything is static mock JSON under src/data/mock/{role}/
Declared-but-not-yet-used stack in docs: shadcn/ui + Radix, Framer Motion, TanStack Query/Table, React Hook Form + Zod, Recharts, react-dropzone, Sonner
3. Roles (6 total)
guest, buyer, seller, exec (Executive Admin), subadmin (Sub-Admin), superadmin (Super Admin)

Buyer is the default account type at signup.
Seller is a capability unlocked on the same account, not a separate signup — a buyer applies via KYC/entity verification and becomes Buyer+Seller simultaneously once approved.
Sub-Admin has a scoped permission matrix (module × action level hidden/view/act/approve × metal/region scope × ₹ ceiling) and inherits Executive Admin modules only where granted — over-ceiling actions require Super Admin/Exec approval (maker-checker pattern).
A demo-only Role Switcher in the header lets any persona jump between all 6 roles instantly (this is a prototype convenience, not a real feature to carry forward).
4. Navigation / App Flow
Landing ("/")  ──guest browse──▶ Browse (read-only, registration banner)
   │
   └─▶ Login ("/auth/login": phone + OTP, Register/Login toggle) ──▶ roleHome(role)

AppShell (sidebar + header: role switcher, notification bell, theme toggle)
   wraps all authenticated routes; sidebar nav is entirely role-driven.
Buyer flow: Dashboard → Browse (Live/Upcoming/Closed tabs, search, metal-type filter) → Lot Detail → Bidding Room (lock EMD → bid) → My Bids & Results (win/loss, mock invoice) → Fulfilment Tracker (settlement → pickup → logistics → handover) → Wallet (top-up, EMD ledger) → optionally "Become a Seller" (KYC/entity upload).

Seller flow: Workspace → Create Lot (title, metal, category, grade, quantity, location, description, base/reserve price, EMD %, ≥2 photos) → submit for verification → My Lots → (once scheduled) Live Monitor (read-only bid feed, cannot bid on own lot) → Results & Reports.

Executive Admin flow: Pipeline Board (lifecycle Kanban) → Entity Verification (approve seller KYC) → Lot Verification (inspection checklist, photos/report, verify/flag/reject) → Auction Setup (schedule, set increment/reserve/EMD/anti-snipe rule) → Settlement (confirm payment, EMD release/forfeit, generate invoice) → Logistics (pickup scheduling) → Handover (checklist, proof upload) → Approvals inbox.

Sub-Admin flow: Ops Console → Bid Monitor (flag suspicious bid → routes to approval) → Audit Log → Approvals outbox → gated access to the Exec modules above per permission template (Verification Officer / Settlement Officer / Senior Ops).

Super Admin flow: Dashboard (lifecycle KPIs) → Team & Permissions (create Sub/Exec admins, assign scoped matrix) → User Management (search/filter, KYC/seller badges, activate/deactivate) → Approvals → Control Tower (pause/resume/force-extend/cancel a live auction, void a specific bid — all reason-mandatory) → Blacklist & Defaulters (watchlist/suspend/blacklist, auto-suspend-after-N-defaults rule) → Financial Config (EMD %, commission, payment windows) → Master Data (metal categories, yards, doc types) → Audit Trail (read-only).

Lifecycle state machine (drives Pipeline & Approvals views), 13 stages: Draft → Submitted → Under Verification → (Rejected | Approved) → Scheduled → Live → Bidding Closed → Won → In Settlement → Ready for Pickup → In Logistics → Handover Complete → Closed

5. Full screen list
Public: Landing (marketing/hero, "how it works"), Login (phone+OTP, Register/Login toggle, "Continue as Guest")

Shared: Browse, Lot Detail, Bidding Room, Noticeboard (platform announcements, distinct from personal notifications), Approvals (mounted per-role)

Buyer: Dashboard, Wallet & EMD, My Bids & Results, Fulfilment Tracker, Become a Seller

Seller: Workspace, Create Lot, My Lots, Live Monitor, Results & Reports

Executive Admin: Pipeline Board, Entity Verification, Lot Verification, Auction Setup, Settlement, Logistics, Handover, Approvals

Sub-Admin: Ops Console, Bid Monitor, Audit Log, Approvals (+ gated Exec modules)

Super Admin: Dashboard, Admins & Permissions/Team, User Management, Approvals, Control Tower, Blacklist & Defaulters, System Config, Financial Config, Master Data, Audit Trail

Notably absent: no Settings/Profile-edit screen, no Help/FAQ/Support screen, no Splash/Onboarding walkthrough, no Terms/Privacy pages, no chat.

6. Detailed feature inventory
6.1 Authentication & Onboarding
Single login screen: phone (+91) + 4-digit OTP (any code accepted in prototype), Register/Login tab toggle
"Continue as Guest" (read-only browse)
No password/forgot-password (phone/OTP only), no social login, no email verification
No tutorial/walkthrough; Landing page's "how it works" section substitutes
6.2 User profile & KYC
User model: id, name, phone, role, kycStatus (not_submitted/pending/verified), sellerVerified flag, businessName (optional), email (optional), joinedAt, active flag, standing (good/watchlist/suspended/blacklisted), defaults count + reason
No edit-profile screen or avatar upload anywhere — only a name/role chip in the header
Seller/entity KYC ("Become a Seller"): business name, GSTIN, PAN + file uploads (GST cert, PAN, cancelled cheque/bank proof, optional MSME/Udyam cert), reviewed by Executive Admin with approve/reject/return-with-reason, 48h SLA noted
6.3 Lot / auction data model
Lot: title, metal type (8 options), category (Scrap/Ingots/Coils/Offcuts/Dross/Turnings), grade/spec, quantity (free text), location, description, sellerId, basePrice, reservePrice, emdAmount (default 5% of reserve), increment, photos (min 2), createdAt, verification info, rejectReason
Auction (separate entity, references lotId): startsAt/endsAt, startPrice, currentBid, leaderId/leaderName, increment, reserve, emd, extension count, bidderCount, pause state
Create Lot form validation: title/grade/quantity/location required, prices > 0, ≥2 photos before submission; "Save as draft" or "Submit for verification"
6.4 Bidding mechanics (core differentiator — very detailed in prototype)
Simulated real-time via client-side 1s tick loop (not real websockets)
Min next bid = currentBid + increment, enforced client-side, rejected with toast if violated
Bid step multiplier picker (1x/2x/5x/10x) drives quick-bid chips
Three bidding UI modes: Easy view, Pro view, Max view (one-tap)
Quick-bid chips (+1/+2/+4 steps) + custom stepper
Auto-bid / proxy bidding: set a max + step, engine auto-places bids up to max when outbid
Live bid ladder: full history desc by time, bidder name ("You" for self), auto-bid badge, timestamp, crown icon for leader, slide-in animation for new bids
Condensed "what's happening" feed (last 4 bids) in Easy view
Shows: current highest bid, leader name, "leading"/"outbid"/"no bid yet" state, bidder count, reserve amount, increment
Simulated competing bots (4 fake companies) bid automatically, more frequently near close — a stand-in for real concurrent bidders
Anti-sniping auto-extension: bid within a configurable window (default ~60s) before close extends the auction by a configurable amount (default 2 min), capped at a max extension count; UI shows "extended ×N"
EMD gating: must lock an EMD deposit (checked against wallet balance) before bidding is allowed
Confetti + success animation on winning
Countdown: circular SVG progress ring + digital flip-clock + linear progress bar; urgency styling (red pulse) under 2 minutes
6.5 Auction lifecycle & admin control
13-stage lifecycle (see §4) with named owner per transition (Seller/Exec Admin/System)
Auction close logic: if final bid ≥ reserve and has a leader → lot "won" + settlement record created; else → "closed" unsold, EMD auto-refunded to all non-winners
Control Tower (Super Admin): pause/resume (freezes clock, records remaining time + mandatory reason), force-extend by N minutes, cancel auction, void a specific bid (recalculates ladder/leader)
6.6 Browse / search / discovery
Tabs: Live / Upcoming / Closed
Text search across title, id, location, grade
Metal-type filter dropdown
Card shows id, title, status badge, quantity, grade, location, current/start/final bid (context-aware label), live countdown or "Starts " or "Won · "
Guest read-only banner prompting registration
Not present: favorites/watchlist for lots, buy-now/fixed-price option, ratings/reviews between buyer and seller
6.7 Seller tools
Create Lot, My Lots (manage listings), Live Monitor (read-only bid feed on own lots, cannot bid on own material), Results & Reports
"Become a Seller" upgrade path from a buyer account (see 6.2)
6.8 Notifications
In-app bell + dropdown per role, unread badge, "mark all read"
Kinds: lifecycle | bid | wallet | system, targeted by audience (role or "all")
Toast alerts for real-time events: outbid, auto-extension, "auction is live", win/loss + EMD refund note, lifecycle transitions (submitted/verified/rejected, KYC decisions, wallet top-up, pickup scheduled, handover complete, pause/resume/extend/cancel, bid voided)
Separate Noticeboard for pinned platform-wide announcements (distinct from personal notification feed)
Not present: push notifications, email notifications, notification preference/settings screen
6.9 Admin panel (three tiers)
Super Admin: KPI dashboard, Team/permissions editor (create Sub/Exec admins + scoped matrix + role templates), User Management, Approvals inbox, Control Tower, Blacklist & Defaulters (with auto-suspend-after-N-defaults toggle), Financial Config (EMD %, commission, payment windows), Master Data (categories/yards/doc types), read-only Audit Trail
Executive Admin: unified Pipeline board, Entity/Seller verification queue, Lot Verification (inspection checklist + photo/report upload), Auction Setup, Settlement, Logistics, Handover, shared Approvals
Sub-Admin: inherits gated Exec modules, own Work Queue with SLA timers, scoped read-only Bid Monitor with "flag suspicious bid → approval" escalation, Approvals outbox, own Audit log view
Maker-checker pattern throughout: risky Sub-Admin actions become Approval Requests routed upward
6.10 Wallet, payments & settlement
Wallet: balance + EMD-locked amount + total, ledger (topup/emd_lock/emd_release/emd_forfeit/payment/refund)
Mock top-up (preset amounts, simulated Razorpay/UPI/NetBanking picker with fake processing delay)
EMD auto-refund on loss, forfeiture on default (admin-triggered)
Settlement record: winnerId, amount, paymentConfirmed, emdHandled, invoiceGenerated; Exec actions: confirm payment, handle EMD, generate invoice, hand off to logistics
Mock invoice/receipt ("Download PDF") showing winning bid, EMD adjustment, balance payable
Not present: withdrawal, saved payment methods/cards, real payment gateway
6.11 Fulfilment / logistics
Fulfilment Tracker (buyer-facing): settlement → ready-for-pickup → logistics (pickup date/slot/handler, in-transit) → handover checklist (weighbridge recheck, tally, gate pass, loading photos) → proof upload → closed
6.12 Support & policy — largely absent
No FAQ/help center, no contact-support form, no formal dispute/ticketing system
Informal dispute handling only via admin "void bid" / blacklist reason fields
No Terms of Service / Privacy Policy pages
Only cross-cutting integrity tools: audit log of every action, role-scoped permissions, user standing/blacklist system
6.13 Settings & design system
Light/dark theme toggle only — no language selector, no currency selector (hardcoded ₹ INR)
Brand palette: steel (blue-grey) + ember (orange) Tailwind scales, semantic theme tokens (canvas/surface/ink/muted/faint/line, light+dark variants)
Component kit: Btn (primary/accent/outline/ghost/danger/success variants), Badge (tone system), Modal, Field, Toggle, Tabs, Stat, Card, FileDrop, ThemeToggle
Logo: flame icon + "ferroBid" wordmark, tagline "Metal Auctions"
7. Explicitly out-of-scope in this prototype (candidates for the "better" v2)
Confirmed absent both in code and in the project's own WBS docs as deferred: real backend/API/persistence, real-time bidding infra (websockets), real SMS/OTP, real payments, buy-it-now/fixed-price listings, favorites/watchlist on lots, ratings & reviews, buyer-seller or support chat, push/email notifications, notification preferences, profile photo/avatar upload, edit-profile screen, help center/FAQ, Terms/Privacy pages, onboarding walkthrough, language/currency settings, referral/rewards/loyalty program, admin delegation/impersonation, platform freeze, re-auction flow.

These are the natural "what to add or do better" list when handing this to another AI for a v2 redesign — both the visual style and this feature gap list should go into that prompt.