# MetalBid Digital Auction Platform
## Prototype — Requirements, Feature List & Work Breakdown Structure

**Prepared by:** AspiraSys · **Prepared for:** Metal Bid Technologies
**Document scope:** Clickable prototype (6 roles, full lot lifecycle) · **Version:** 3.0

> **v3.0 update:**
> - The pre-auction verification set, auction creation, and post-auction fulfilment set are now managed by a single operational role: **Executive Admin**.
> - Added a **Guest User** role (browse-only, no transactions).
> - **A Buyer can become a Seller, but only after the user is verified as an entity.** Seller is a capability unlocked on a verified account, not a separately registered login.
> - Broad role set: **Super Admin, Sub-Admin, Executive Admin, Buyer, Seller, Guest User.**

---

## 1. Prototype Requirement

### 1.1 Objective
A high-fidelity, **clickable front-end prototype** of MetalBid that lets stakeholders walk every role's journey across the **complete lot lifecycle** — entity/lot verification → auction → fulfilment — with realistic screens and simulated behaviour, before any production build begins.

### 1.2 Fidelity & Boundaries (what "prototype" means here)
- **Front-end only.** All data comes from a mock store (seeded JSON / in-memory state) — no real database, server, or APIs (in future leave the room for it and create JSON files in the folder path "{app}/data/mock/{role}/{json_file}").
- **Authentication is simulated:** OTP accepts any/fixed code; no real JWT, refresh rotation, or SMS gateway.
- **Roles & permissions are mocked:** roles can be switched and a demo permission matrix toggled, but there is no real RBAC enforcement.
- **Entity verification is a workflow simulation:** document review, checklists, and approve/reject move a user/lot through mock states with placeholder uploads.
- **Payments are mocked:** wallet top-up, EMD, Razorpay, and settlement appear as modals with fake success/failure.
- **Live bidding is scripted:** timers, late-bid auto-extension, and competing "bot" bids run locally.
- **Fulfilment (settlement/logistics/pickup)** moves lots through mock states with dummy proof.
- **Goal:** validate flows, screens, role hand-offs, and the lifecycle state machine — not performance, security, or concurrency.

### 1.3 In Scope
All six roles, the Buyer→Seller entity-verification upgrade, guest browsing, and the shared shell (auth, navigation, notifications, noticeboard). Fully responsive (desktop + mobile browser).

### 1.4 Out of Scope for the Prototype
Real backend/APIs, real JWT/RBAC enforcement, real payment/SMS/logistics integrations, real-time infrastructure, persistent audit logs, load/security hardening, and data migration.

---

## 2. Account & Role Model

- **Every registered user starts as a Buyer** (individual participant): can browse, top up wallet, lock EMD, and bid.
- **Seller is a capability, not a separate account.** A Buyer requests to sell → completes **Entity Verification** (business/KYC/entity documents) → an **Executive Admin** approves → Seller features unlock on the same account. A verified user is therefore **both Buyer and Seller** (can bid *and* list).
- **Only a verified entity can list lots.** Unverified buyers see the "Become a Seller" path instead of listing tools.
- **Guest User** is unauthenticated: browse-only, prompted to register to participate.
- **Executive Admin** owns the operational pipeline end to end: entity/seller verification, lot verification, auction creation & scheduling, and post-auction fulfilment (settlement, logistics, pickup/handover).
- **Super Admin** governs the platform and creates/manages Sub-Admins and Executive Admins. **Sub-Admin** operates a permission-scoped subset.

```
 Guest ──register──▶ Buyer ──"Become a Seller"──▶ Entity Verification (Executive Admin) ──approve──▶ Buyer + Seller
                       │                                                                                  │
                       └── bid / win / track fulfilment                        list lots ──▶ verification / auction / fulfilment
```

---

## 3. Lot Lifecycle (business model)

Executive Admin drives the lot across all operational stages; the state machine powers the whole prototype.

```
 SELLER            EXECUTIVE ADMIN (verify → create auction → fulfil)                  MARKETPLACE
 ┌──────┐   ┌───────────────┬───────────┬──────────────┐   ┌──────────────┐   ┌────────────┬───────────┬──────────┐
 │Draft │ → │ Under         │ Approved  │ Auction       │→ │ Live Auction │ → │ Settlement │ Logistics │ Handover │ → Closed
 │Submit│   │ Verification  │ (lot ok)  │ Created/Sched │   │ → Won        │   │ (pay/EMD)  │ (pickup)  │ (proof)  │
 └──────┘   └───────────────┴───────────┴──────────────┘   └──────────────┘   └────────────┴───────────┴──────────┘
                     │ ↑ reject/return                                                   ↑ Executive Admin hand-offs
```

**States:** `Draft → Submitted → Under Verification → Verified/Rejected → Approved → Auction Created/Scheduled → Live → Bidding Closed → Won → In Settlement → Ready for Pickup → In Logistics → Picked Up/Handover Complete → Closed.`

---

## 4. User Roles

| # | Role | One-liner | Prototype focus |
|---|------|-----------|-----------------|
| 1 | **Super Admin** | Master controller of the platform | Global oversight & KPIs, creates/manages Sub-Admins & Executive Admins, entity-verification policy, config, audit |
| 2 | **Sub-Admin** | Day-to-day ops within limits | Permission-scoped console; auction/lot/user ops; visual action gating |
| 3 | **Executive Admin** | Owns the operational pipeline | Entity/seller verification, lot verification, **auction creation & scheduling**, settlement, logistics, pickup/handover |
| 4 | **Buyer** | Core participant (default account) | Register/KYC → wallet/EMD → browse → live bid → win → fulfilment tracker; can request Seller upgrade |
| 5 | **Seller** | Verified entity (unlocked capability) | List lots → submit for verification → monitor auction → results & report; also retains Buyer abilities |
| 6 | **Guest User** | Unauthenticated visitor | Browse public auctions & catalogue read-only; cannot bid/transact; prompted to register |

---

## 5. Functional Requirements

### 5.1 Super Admin
- Global dashboard with lifecycle KPIs: entities awaiting verification, lots under verification/approval, live auctions, awaiting settlement, awaiting pickup (mock).
- Create/manage Sub-Admins and Executive Admins; assign a demo permission matrix.
- Manage all users and the Buyer→Seller entity-verification policy/config.
- Manage lots, auctions, and system-wide configuration; cross-stage audit view (read-only, mock).

### 5.2 Sub-Admin
- Scoped console reflecting granted permissions; menus/actions hidden where a permission is off.
- Manage auctions, lots, and catalogue per assigned access; user search/filter.
- Actions shown as captured in the audit log (mock).

### 5.3 Executive Admin *(consolidated operational role)*
- **Entity / Seller verification queue:** review a buyer's business/KYC/entity documents (mock viewer); approve → unlock Seller capability, or reject/return with reason.
- **Lot verification:** inspection checklist (quality, quantity, condition, image authenticity); upload verification report + photos; mark Verified / Flagged / Rejected.
- **Auction creation & scheduling:** turn approved lots into auctions — set parameters (start/end, increments, reserve/EMD), publish live.
- **Settlement:** confirm winner payment (mock), EMD release for losers / forfeit for defaulters, generate invoice/receipt, hand off to logistics.
- **Logistics:** fulfilment board; schedule pickup (date/slot); assign a pickup handler; track status.
- **Handover:** pickup checklist + proof upload (photo/gate pass/signature); confirm handover → close lot.
- Works a single pipeline board spanning verification → auction → fulfilment.

### 5.4 Buyer *(default account)*
- Register via mobile + OTP (simulated); KYC submission with status.
- Wallet: balance, mock top-up, ledger, downloadable statement; EMD lock/available split + auto-refund (sim).
- Browse/filter live & upcoming auctions; real-time-style catalogue and lot detail.
- Bidding room: manual bids; auto-bid (max + increment); live ladder, current highest, instant outbid alerts; countdown with late-bid auto-extension.
- Outcomes: win/lose, receipt, bid history; **post-win fulfilment tracker** (settlement → pickup).
- **"Become a Seller":** submit entity documents to trigger verification; track upgrade status.

### 5.5 Seller *(verified entity — unlocked on a Buyer account)*
- Available only once entity verification is approved (otherwise the account sees the upgrade path).
- Create/list a lot: catalogue details + image uploads (mock); **submit for lot verification** (not straight to live).
- Manage listings across the full lifecycle; read-only live monitor for own lots.
- Result summary + downloadable formatted report (mock).
- Retains all Buyer abilities (can also bid).

### 5.6 Guest User *(new)*
- Browse public/live auctions and the catalogue (read-only), view lot details and auction status.
- Cannot bid, use a wallet, or access any transactional screen.
- Clear register/login prompts to convert into a Buyer to participate.

### 5.7 Shared / Supporting
- Auth shell + role-based landing with a **demo role switcher** covering all roles (incl. verified vs unverified buyer).
- Global notification centre and noticeboard; notifications fire on each hand-off (entity verified, lot verified, auction created, won, settled, scheduled, picked up).
- Fully responsive across all screens.

---

## 6. Feature List

| # | Area | Feature | Role(s) |
|---|------|---------|---------|
| F1 | Guest | Public browse of auctions/lots + catalogue (read-only) | Guest |
| F2 | Guest | Register/login prompts to convert to Buyer | Guest |
| F3 | Auth | Mobile + OTP registration/login (simulated) | Buyer/Seller, Admins |
| F4 | Auth | Buyer KYC submission + status | Buyer |
| F5 | Shell | Responsive nav shell + role-based landing + demo role switcher | All |
| F6 | Lifecycle | Lot lifecycle state machine (Draft → Closed) | Supporting |
| F7 | Account | "Become a Seller" request + entity-document submission | Buyer |
| F8 | Account | Verified-entity gating (list tools locked until approved) | Buyer/Seller |
| F9 | Admin | Super Admin dashboard incl. full-lifecycle KPIs | Super Admin |
| F10 | Admin | Create/manage Sub-Admins & Executive Admins + permission matrix | Super Admin |
| F11 | Admin | User management (list, search, filter) | Super Admin, Sub-Admin |
| F12 | Admin | System config incl. entity-verification policy | Super Admin |
| F13 | Admin | Cross-stage audit trail view (read-only) | Super Admin, Sub-Admin |
| F14 | Admin | Permission-scoped menu/action gating (visual) | Sub-Admin |
| **F15** | **Exec** | **Unified pipeline board (verify → auction → fulfil)** | **Executive Admin** |
| **F16** | **Exec** | **Entity/Seller verification queue + document review (mock)** | **Executive Admin** |
| **F17** | **Exec** | **Approve/reject entity → unlock Seller capability** | **Executive Admin** |
| **F18** | **Exec** | **Lot inspection checklist + report/photo upload** | **Executive Admin** |
| **F19** | **Exec** | **Lot decision: Verified / Flagged / Rejected** | **Executive Admin** |
| **F20** | **Exec** | **Auction creation & scheduling from approved lots** | **Executive Admin** |
| **F21** | **Exec** | **Settlement: confirm payment + EMD release/forfeit + invoice (mock)** | **Executive Admin** |
| **F22** | **Exec** | **Logistics: schedule pickup + assign handler + status tracking** | **Executive Admin** |
| **F23** | **Exec** | **Handover: pickup checklist + proof upload → close lot** | **Executive Admin** |
| F24 | Listing | Create/list lot + image upload → submit for verification | Seller |
| F25 | Listing | Listing management + full lifecycle tracking | Seller |
| F26 | Monitor | Read-only live bidding monitor for own lots | Seller |
| F27 | Results | Auction result summary + downloadable report (mock) | Seller |
| F28 | Wallet | Balance, mock top-up, ledger, statement download | Buyer |
| F29 | Wallet | EMD lock / available split + auto-refund (sim) | Buyer |
| F30 | Discovery | Auction/lot listing with filters & search | Buyer, Guest |
| F31 | Discovery | Lot detail / catalogue view | Buyer, Seller, Guest |
| F32 | Bidding | Live bidding room UI (ladder, highest) | Buyer |
| F33 | Bidding | Manual bid placement | Buyer |
| F34 | Bidding | Auto-bid setup (max + increment) | Buyer |
| F35 | Bidding | Outbid / win / refund alerts | Buyer |
| F36 | Timing | Countdown + late-bid auto-extension indicator | Buyer, Seller |
| F37 | Outcomes | Win/lose result + receipt + bid history | Buyer |
| F38 | Track | Buyer post-win fulfilment tracker (settlement → pickup) | Buyer |
| F39 | Notify | Notification centre + toast alerts on each lifecycle hand-off | All (auth) |
| F40 | Notify | Noticeboard / announcements | All |
| F41 | Sim | Scripted bidding simulation engine (bots/timer) | Supporting |

*(New/changed v3.0 features are bolded; Executive Admin now absorbs the former verification/approval/settlement/logistics/handover features.)*

---

## 7. Work Breakdown Structure (tasks + dependencies)

> No time estimates. Dependencies reference other WBS IDs.

### 1. Foundation & Setup
- **1.1** Scaffold front-end app, routing, folder structure — *no deps*
- **1.2** Confirm prototype flows & screen inventory (6 roles, full lifecycle) — *no deps*
- **1.3** Define navigation map / clickable sitemap (incl. guest vs authed) — *dep: 1.2*

### 2. Design System & Shared UI
- **2.1** Design tokens (colours, type, spacing) — *dep: 1.1*
- **2.2** Core components (buttons, inputs, cards, tables, modals, toasts, file-upload, checklist, kanban/board) — *dep: 2.1*
- **2.3** Responsive app shell (header, nav, role-based layout, demo role switcher) — *dep: 2.2, 1.3*

### 3. Mock Data, Account & Lifecycle Layer
- **3.1** Seed data: users (guest/buyer/seller/admins), roles/permissions, entity-verification records, lots, auctions, bids, wallet/EMD, settlements, logistics, notifications, audit — *dep: 1.2*
- **3.2** In-memory/mock store + state management wiring — *dep: 1.1, 3.1*
- **3.3** **Account/role model: Buyer default, Seller-capability flag, verified-entity gating** — *dep: 3.2*
- **3.4** **Lot lifecycle state machine (Draft → Closed) + transition rules & role hand-offs** — *dep: 3.2*
- **3.5** Mock "service" layer (fake async, latency, success/failure) — *dep: 3.2*

### 4. Guest & Auth
- **4.1** Guest browse (public auctions/catalogue, read-only) + register prompts — *dep: 2.3, 3.5*
- **4.2** OTP register/login screens (simulated) — *dep: 2.2, 3.5*
- **4.3** Buyer KYC submission + status flow — *dep: 4.2*
- **4.4** Role routing + demo role switcher (all roles, verified/unverified) — *dep: 2.3, 4.2, 3.3*

### 5. Platform Administration
- **5.1** Super Admin dashboard with full-lifecycle KPIs — *dep: 3.5, 2.2*
- **5.2** Create/manage Sub-Admins & Executive Admins + permission matrix — *dep: 5.1*
- **5.3** User management (list/search/filter) — *dep: 3.5, 2.2*
- **5.4** System config incl. entity-verification policy — *dep: 5.1*
- **5.5** Cross-stage audit trail view — *dep: 3.4*
- **5.6** Sub-Admin scoped console + permission-based gating — *dep: 5.2, 4.4*

### 6. Buyer→Seller Entity Verification *(new)*
- **6.1** "Become a Seller" request + entity-document submission (Buyer) — *dep: 4.4, 3.3*
- **6.2** Executive Admin entity-verification queue + document review viewer (mock) — *dep: 6.1, 2.2*
- **6.3** Approve/reject entity → unlock Seller capability + notify — *dep: 6.2, 3.3, 11.1*
- **6.4** Verified-entity gating across listing tools — *dep: 6.3*

### 7. Executive Admin Pipeline *(consolidated: verify → create auction → fulfil)*
- **7.1** Unified pipeline board (columns per lifecycle stage) — *dep: 3.4, 2.2*
- **7.2** Lot verification: inspection checklist + report/photo upload — *dep: 7.1*
- **7.3** Lot decision Verified/Flagged/Rejected (state transition) — *dep: 7.2, 3.4*
- **7.4** Auction creation & scheduling from approved lots — *dep: 7.3, 3.4*
- **7.5** Settlement: confirm payment + EMD release/forfeit + invoice (mock) — *dep: 10.x, 3.4*
- **7.6** Logistics: schedule pickup + assign handler + status tracking — *dep: 7.5*
- **7.7** Handover: pickup checklist + proof upload → close lot — *dep: 7.6, 3.4*

### 8. Seller Journey
- **8.1** Seller workspace (visible once verified) — *dep: 6.4, 2.3*
- **8.2** Create/list lot + image upload → submit for verification — *dep: 8.1, 3.5, 3.4*
- **8.3** Listing management + full lifecycle tracking — *dep: 8.2, 3.4*
- **8.4** Read-only live monitor for own lots — *dep: 8.3, 10.x*
- **8.5** Result summary + downloadable report (mock) — *dep: 8.4, 10.2*

### 9. Buyer Journey
- **9.1** Wallet: balance, top-up modal, ledger, statement — *dep: 3.5, 2.2*
- **9.2** EMD lock/available + auto-refund logic (sim) — *dep: 9.1*
- **9.3** Auction/lot browse + filters + detail (Live lots) — *dep: 3.4, 2.2*
- **9.4** Bidding room UI (ladder, highest, controls) — *dep: 9.3, 10.x*
- **9.5** Manual bid + validation against wallet/EMD — *dep: 9.4, 9.2*
- **9.6** Auto-bid setup & behaviour — *dep: 9.5*
- **9.7** Win/refund/result + receipt + bid history — *dep: 9.5, 10.2*
- **9.8** Post-win fulfilment tracker (settlement → pickup) — *dep: 9.7, 3.4, 7.5*

### 10. Bidding Simulation Engine (shared)
- **10.1** Countdown timer + late-bid auto-extension — *dep: 3.2*
- **10.2** Scripted competing-bid ("bot") engine — *dep: 3.2, 10.1*
- **10.3** Outbid/win/refund triggers → notifications + lifecycle → Won — *dep: 10.2, 3.4, 11.1*

### 11. Notifications & Noticeboard
- **11.1** Notification centre + toast alerts (fire on every hand-off) — *dep: 2.2, 3.4*
- **11.2** Noticeboard / announcements — *dep: 2.2, 3.1*

### 12. Assembly & Handoff
- **12.1** End-to-end flow linking — full lifecycle across all 6 roles — *dep: all of 4–11*
- **12.2** Responsive pass (desktop + mobile) — *dep: 12.1*
- **12.3** Prototype QA against flow inventory & lifecycle transitions — *dep: 12.2*
- **12.4** Demo script + stakeholder walkthrough / handoff — *dep: 12.3*


### 13. Tech Stack
Core

React.js + TypeScript — fast, type-safe, real-time multi-role UI foundation
Vite — instant dev server and near-instant hot reload for rapid prototype iteration
React Router — role-based routing (guest / buyer / seller / admins) and the clickable navigation map

UI & Styling (clean, modern look)

Tailwind CSS — utility-first styling for a consistent, polished design system
shadcn/ui + Radix UI — accessible, modern component primitives (dialogs, tables, tabs) that look premium out of the box
Lucide Icons — crisp, consistent icon set for roles, statuses, and actions
Framer Motion — subtle transitions and micro-interactions that make the prototype feel real

State & Mock Data

Zustand — lightweight state for the account/role model and lifecycle state machine
Mock Service Worker (MSW) + Faker.js — fake API layer with seeded, realistic dummy data (no backend needed)
TanStack Query — async data fetching/caching against the mock layer, with loading states

Forms, Boards & Dashboards

React Hook Form + Zod — typed, validated forms (registration, KYC, entity verification, lot creation)
TanStack Table + dnd-kit — sortable data grids and the Executive Admin pipeline board (verify → auction → fulfil)
Recharts — Super Admin dashboard KPIs and analytics visuals
react-dropzone + Sonner — mock file/image uploads and toast notifications for live-bidding and hand-off alerts

Real-Time Simulation

Local event-emitter engine (setInterval / mitt) — scripted countdowns, late-bid auto-extension, and competing "bot" bids that mimic live bidding without a real WebSocket/Redis
---

*Strictly Confidential · AspiraSys · MetalBid Prototype Requirements v3.0*
