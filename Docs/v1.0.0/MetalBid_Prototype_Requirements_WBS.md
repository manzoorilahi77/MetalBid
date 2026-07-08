# MetalBid Digital Auction Platform
## Prototype — Requirements, Feature List & Work Breakdown Structure

**Prepared by:** AspiraSys · **Prepared for:** Metal Bid Technologies
**Document scope:** Clickable prototype (all user roles) · **Version:** 1.0

---

## 1. Prototype Requirement

### 1.1 Objective
A high-fidelity, **clickable front-end prototype** of MetalBid that lets stakeholders walk every user role's core journey end to end — with realistic screens and simulated behaviour — before any production build begins.

### 1.2 Fidelity & Boundaries (what "prototype" means here)
- **Front-end only.** All data comes from a mock store (seeded JSON / in-memory state) — no real database, server, or APIs.
- **Authentication is simulated:** the OTP screen accepts any/fixed code; no real JWT, refresh rotation, or SMS gateway.
- **Role & permissions are mocked:** you can switch roles and toggle a demo permission matrix, but there is no real RBAC enforcement.
- **Payments are mocked:** wallet top-up, EMD, and Razorpay appear as modals with fake success/failure — no real money movement.
- **Live bidding is scripted:** countdown timers, late-bid auto-extension, and competing "bot" bids are driven locally to demonstrate the experience — not a real WebSocket/Redis engine.
- **Reports & statements** are pre-formatted mock views/downloads, not generated from live data.
- **Goal:** validate flows, screens, and interactions — not performance, security, or concurrency.

### 1.3 In Scope
All four user roles — **Super Admin, Sub-Admin, Buyer, Seller** — plus the shared shell (auth, navigation, notifications, noticeboard) and the bidding-room simulation that the roles depend on. Fully responsive (desktop + mobile browser).

### 1.4 Out of Scope for the Prototype
Real backend/APIs, real JWT/RBAC enforcement, real payment/SMS integration, real-time infrastructure (WebSocket/Redis/queues), audit-log persistence, load/security hardening, and data migration.

---

## 2. User Roles

| Role | One-liner | Prototype focus |
|------|-----------|-----------------|
| **Super Admin** | Master controller of the platform | Global oversight console, user/auction management, config, analytics, audit view, Sub-Admin creation |
| **Sub-Admin** | Day-to-day operations manager within limits | Scoped console driven by a demo permission matrix, auction/lot/catalogue ops, user search |
| **Buyer** | Core revenue driver | Register/KYC → wallet/EMD → browse → live bid (manual + auto) → win/refund |
| **Seller** | Trust-and-visibility user | List lot → submit → read-only live monitor → result summary → downloadable report |

---

## 3. Functional Requirements

### 3.1 Super Admin
- Global dashboard: active auctions, total bids, wallet credits, EMD in-flight (mock KPIs).
- Create and manage Sub-Admins; assign a demo permission matrix.
- Manage all users, auctions, lots, and system-wide configuration.
- View audit trail of administrative actions (mock, read-only).
- Full, unrestricted navigation across every module.

### 3.2 Sub-Admin
- Scoped landing/console reflecting the permissions granted by the Super Admin.
- Manage auctions, lots, and catalogue uploads based on assigned access.
- Routine user management with search and filters.
- Actions shown as captured in the audit log (mock).
- Restricted menus/actions where permission is toggled off (visual enforcement).

### 3.3 Buyer
- Register via mobile + OTP (simulated); KYC submission with status (pending → verified).
- Wallet: balance, mock top-up, transaction/ledger view, downloadable statement.
- EMD: lock EMD to enter an auction; locked vs available split; auto-refund on loss (simulated).
- Auction discovery: browse/filter live & upcoming auctions and lots; real-time-style catalogue.
- Bidding room: manual bids; auto-bid (max limit + increment); live bid ladder, current highest, instant outbid alerts.
- Fair-play timing: visible countdown with late-bid auto-extension and a reconnect-safe indicator.
- Outcomes: win/lose result, EMD refund confirmation, receipt, per-auction bid history.
- Notifications: outbid, win, refund, receipt (in-app + mock email preview).

### 3.4 Seller
- Login to seller workspace.
- Create/list a lot: catalogue details + image uploads (mock), lot parameters, submit for auction.
- Manage listings across lifecycle states (draft / submitted / live / closed).
- Monitor live bidding: real-time-style, read-only view of bid ladder and timer for own lots.
- Results: auction result summary once bidding closes; downloadable formatted result report (mock).
- Full outcome and bid trail per lot (transparency view).

### 3.5 Shared / Supporting
- Auth shell and role-based landing (with a demo role switcher for the prototype).
- Global notification centre and noticeboard/announcements.
- Fully responsive across all prototype screens.

---

## 4. Feature List

| # | Area | Feature | Role(s) |
|---|------|---------|---------|
| F1 | Auth | Mobile + OTP registration/login (simulated) | All |
| F2 | Auth | KYC submission + status states | Buyer |
| F3 | Shell | Responsive nav shell + role-based landing + demo role switcher | All |
| F4 | Admin | Super Admin global dashboard (mock KPIs) | Super Admin |
| F5 | Admin | Sub-Admin creation + permission matrix editor | Super Admin |
| F6 | Admin | User management (list, search, filter) | Super Admin, Sub-Admin |
| F7 | Admin | Auction & lot management + catalogue upload | Super Admin, Sub-Admin |
| F8 | Admin | System configuration screens (mock) | Super Admin |
| F9 | Admin | Audit trail view (read-only, mock) | Super Admin, Sub-Admin |
| F10 | Admin | Permission-scoped menu/action gating (visual) | Sub-Admin |
| F11 | Wallet | Balance, mock top-up, ledger, statement download | Buyer |
| F12 | Wallet | EMD lock / available split + auto-refund (sim) | Buyer |
| F13 | Discovery | Auction/lot listing with filters & search | Buyer |
| F14 | Discovery | Lot detail / catalogue view | Buyer, Seller |
| F15 | Bidding | Live bidding room UI (bid ladder, highest) | Buyer, Seller |
| F16 | Bidding | Manual bid placement | Buyer |
| F17 | Bidding | Auto-bid setup (max + increment) | Buyer |
| F18 | Bidding | Outbid / win / refund alerts | Buyer |
| F19 | Timing | Countdown + late-bid auto-extension indicator | Buyer, Seller |
| F20 | Outcomes | Win/lose result + receipt + bid history | Buyer |
| F21 | Listing | Create/list lot + image upload (mock) | Seller |
| F22 | Listing | Listing management + lifecycle states | Seller |
| F23 | Monitor | Read-only live bidding monitor | Seller |
| F24 | Results | Auction result summary | Seller |
| F25 | Results | Downloadable formatted result report (mock) | Seller |
| F26 | Notify | Notification centre + toast alerts | All |
| F27 | Notify | Noticeboard / announcements | All |
| F28 | Sim | Scripted bidding simulation engine (bots/timer) | Supporting |

---

## 5. Work Breakdown Structure (tasks + dependencies)

> No time estimates. Dependencies reference other WBS IDs.

### 1. Foundation & Setup
- **1.1** Scaffold front-end app, routing, folder structure — *no deps*
- **1.2** Confirm prototype user flows & screen inventory (all 4 roles) — *no deps*
- **1.3** Define navigation map / clickable sitemap — *dep: 1.2*

### 2. Design System & Shared UI
- **2.1** Design tokens (colours, type, spacing) — *dep: 1.1*
- **2.2** Core components (buttons, inputs, cards, tables, modals, toasts) — *dep: 2.1*
- **2.3** Responsive app shell (header, nav, role-based layout, demo role switcher) — *dep: 2.2, 1.3*

### 3. Mock Data & State Layer
- **3.1** Seed data: users, roles/permissions, auctions, lots, bids, wallet/EMD, notifications, audit — *dep: 1.2*
- **3.2** In-memory/mock store + state management wiring — *dep: 1.1, 3.1*
- **3.3** Mock "service" layer (fake async calls, latency, success/failure) — *dep: 3.2*

### 4. Auth & Onboarding
- **4.1** OTP register/login screens (simulated) — *dep: 2.2, 3.3*
- **4.2** KYC submission + status flow — *dep: 4.1*
- **4.3** Role routing + demo role switcher (buyer / seller / sub-admin / super admin) — *dep: 2.3, 4.1*

### 5. Super Admin Console
- **5.1** Global dashboard with mock KPIs — *dep: 3.3, 2.2*
- **5.2** Sub-Admin creation + permission matrix editor — *dep: 5.1*
- **5.3** User management (list/search/filter) — *dep: 3.3, 2.2*
- **5.4** Auction & lot management + catalogue upload — *dep: 3.3, 2.2*
- **5.5** System configuration screens — *dep: 5.1*
- **5.6** Audit trail view (read-only) — *dep: 3.3*

### 6. Sub-Admin Console
- **6.1** Scoped landing driven by permission matrix — *dep: 5.2, 4.3*
- **6.2** Permission-based menu/action gating (visual enforcement) — *dep: 6.1*
- **6.3** Reuse auction/lot/catalogue & user-management views within scope — *dep: 5.3, 5.4, 6.2*

### 7. Buyer Journey
- **7.1** Wallet: balance, top-up modal, ledger, statement — *dep: 3.3, 2.2*
- **7.2** EMD lock/available + auto-refund logic (sim) — *dep: 7.1*
- **7.3** Auction/lot browse + filters + detail — *dep: 3.3, 2.2*
- **7.4** Bidding room UI (ladder, highest, controls) — *dep: 7.3, 9.x*
- **7.5** Manual bid + validation against wallet/EMD — *dep: 7.4, 7.2*
- **7.6** Auto-bid setup & behaviour — *dep: 7.5*
- **7.7** Win/refund/result + receipt + bid history — *dep: 7.5, 9.2*

### 8. Seller Journey
- **8.1** Seller workspace/dashboard — *dep: 4.3, 2.3*
- **8.2** Create/list lot + image upload (mock) — *dep: 8.1, 3.3*
- **8.3** Listing management + lifecycle states — *dep: 8.2*
- **8.4** Read-only live monitor for own lots — *dep: 8.3, 9.x*
- **8.5** Result summary + downloadable report (mock) — *dep: 8.4, 9.2*

### 9. Bidding Simulation Engine (shared)
- **9.1** Countdown timer + late-bid auto-extension — *dep: 3.2*
- **9.2** Scripted competing-bid ("bot") engine — *dep: 3.2, 9.1*
- **9.3** Outbid/win/refund event triggers → notifications — *dep: 9.2, 10.1*

### 10. Notifications & Noticeboard
- **10.1** Notification centre + toast alerts — *dep: 2.2, 3.2*
- **10.2** Noticeboard / announcements — *dep: 2.2, 3.1*

### 11. Assembly & Handoff
- **11.1** End-to-end flow linking (clickable walkthrough, all roles) — *dep: all of 4–10*
- **11.2** Responsive pass (desktop + mobile) — *dep: 11.1*
- **11.3** Prototype QA against flow inventory — *dep: 11.2*
- **11.4** Demo script + stakeholder walkthrough / handoff — *dep: 11.3*

---

*Strictly Confidential · AspiraSys · MetalBid Prototype Requirements v1.0*
