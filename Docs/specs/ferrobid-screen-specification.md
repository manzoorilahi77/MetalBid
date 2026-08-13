# FerroBid — Screen Specification (Phase 3)

> **Source of truth for role development.** Whenever a role or page is built, the
> requirements come from this document. Re-audited against the code on 13 August 2026.
> The original styled artifact is kept verbatim at
> [`ferrobid-screen-specification.html`](./ferrobid-screen-specification.html).

| | |
|---|---|
| Routes audited | 47 in the app |
| Pages specified | 96 |
| Already exist | 54 |
| New builds | 41 |
| Status | Spec — no UI design committed |

**Legend** — `Existing` · `Reassign role` · `Needs refinement` · `New` · `System generated`

---

## Part 1 — Executive overview

### Two sides of the platform

**Super Admin belongs to us, the software company** — the support and recovery role used
to fix problems, add or remove roles, rename pages and roll back a bad change. It is not
handed to the client. **Everything below it belongs to the client's business**, headed by
the CEO for commercial decisions and by the Sub Admin for day-to-day operations.

### Every role, in one line each

| Role | Sees | Does | Approves | What happens next |
|---|---|---|---|---|
| **Buyer** | Marketplace, shortlist, Bid Now, bidding room, wallet, orders | Shortlists, funds EMD, bids, pays, lifts | Nothing — accepts terms for themselves | System locks EMD, ranks bids, issues the delivery order |
| **Seller** | Own lots, own live auctions, own results, own settlement | Submits material, hosts inspection, watches, then **accepts or rejects each cleared price and pays commission** | The final price on their own lots | Auction moves into History once every lot is decided and commission is settled |
| **Field Executive** | Assigned catalogues and the lots inside them | Visits the yard, measures, photographs, files a report | Nothing — reports findings | Ops Manager reviews the report and decides the lot |
| **Operation Manager** | Whole lot pipeline, field team, catalogues, schedule, logistics, handover | Builds catalogues, assigns inspections, approves *or bypasses* lots, **publishes**, closes delivery | Lots, sellers, EMD eligibility, handover | The auction goes live; Auction Manager runs it from there |
| **Auction Manager** | Every scheduled and live auction, bidding rooms, bid stream | **Publishes** — nothing is public before that — then monitors, pauses, extends, closes | EMD eligibility, auction results | Finance collects; Ops delivers; the seller settles |
| **Finance Administrator** | Deposits, EMD, payments, commission, ledgers, **profit & loss** | Verifies money in and out, reconciles, issues invoices | Deposits, refunds, commission settlements | Wallets update; books reconcile; the CEO sees the result |
| **Sub Admin** | **Everything operational** — the same full menu for every Sub Admin account | Runs and supervises the whole operation; can do any operational job and resets passwords | **Can approve or reject any task any operational role performs** | Work continues, or goes back with a reason |
| **Super Admin** | Everything a Sub Admin sees, plus roles, pages, configuration and audit | Support and recovery — adds/removes roles, renames pages, rolls back changes | Bans, bid voids, cancellations, role changes | The platform changes shape immediately, all of it logged |
| **CEO / MD** | Profit and loss, growth, money at risk, what went wrong | Reads the business. Clears one approval queue | Big-money and high-risk decisions only | The requesting role proceeds, or does not |

### Which pages belong to which workspace

- **Operation Manager** — catalogue builder, seller approvals, pipeline, field team, lot approval & bypass, schedule & publish, EMD eligibility, logistics, handover
- **Auction Manager** — schedule & publish, bidding rooms, live control, EMD eligibility, bid monitor, results
- **Finance Administrator** — profit & loss, deposits, withdrawals, payments, EMD ledger, commission, reconciliation
- **Field Executive** — assignments, inspect a lot, submit report, history
- **Sub Admin** — all operational pages plus account admin (identical menu for every Sub Admin account)
- **Super Admin** — roles, page manager, rollback, configuration, audit, plus everything above
- **CEO / MD** — profit & loss, growth, money at risk, exceptions, approvals
- **Buyer** — browse, shortlist, EMD, Bid Now, bids, auction status, wallet
- **Seller** — workspace, create lot, my lots, live monitor, settlement, results

### The one rule that shapes the whole pre-auction flow

> **Nothing is public until someone presses Publish.**
> A seller submits a lot, the Operation Manager takes it into the pipeline and assigns a
> yard visit, the Field Executive measures and photographs it, the Operation Manager
> approves the lot and builds the catalogue — **and none of that is visible to any buyer
> or seller on the marketplace.** The catalogue only becomes public the moment it is
> scheduled and published. Four roles can press that button — Operation Manager, Auction
> Manager, Sub Admin and Super Admin — but until one of them does, the catalogue does not
> exist as far as customers are concerned.

### How much already exists

| Classification | Pages | Meaning |
|---|---|---|
| Existing | 20 | Built and working. Keeps its current role and behaviour |
| Reassign role | 11 | The screen works; it simply belongs to a different role now |
| Needs refinement | 23 | The screen exists but is missing actions the architecture requires |
| New | 41 | Does not exist in any form. Mostly Finance, CEO, accounts and role management |
| System generated | 1 | Content or numbers a person must never type in by hand |

---

## Part 2 — Role navigation maps

**Menu ordering rule:** every menu runs in *the order the work actually happens* — not
alphabetically, not by frequency. Dashboard first; then each page where its step falls in
the role's day; prerequisites before dependents (wallet before EMD; field team before lot
approval). Reports and history sit last.

**Designer note:** FerroBid deliberately has **no left sidebar anywhere**. Navigation is a
sticky top bar with the role's main destinations, plus a contextual tab strip directly
under it. The trees below describe *information structure*: the first level is the top bar,
the second is the tab strip.

### Buyer — *discover → fund → commit → bid → collect*

```
1 · Dashboard                Existing
2 · Browse & Shortlist       Existing      find what to bid on
      └ Catalogue detail     Existing
3 · Wallet & ledger          Existing      put money in — EMD needs balance
4 · EMD & payments           Existing      lock EMD on the lots you want
      └ Catalogue EMD detail Existing
5 · Bid Now                  Existing      the last-minutes path
      ├ Pick an auction      Existing
      └ Pick lots            Existing
            └ Bidding room   Existing
6 · My bids                  Existing      tab reads "Bid results"
7 · Auction status           Existing      pay, lift, complete
8 · Become a seller          Existing      optional, any time

shared  Noticeboard · Help · Disputes · Profile · Notification preferences · Legal
```
*Moved:* Wallet now sits before EMD & payments — it is a prerequisite for funding EMD.

### Seller — *submit → track → watch → settle*

```
1 · Workspace                Existing
2 · Create lot               Existing      declare the material
3 · My lots & batches        Refine — no edit or withdraw
      └ Lot detail           New
4 · Live monitor             Existing      watch it sell
5 · Settlement               Existing      agree price & pay commission
      ├ Upcoming · Live · Pending settlement · History
      ├ Accept or reject each cleared price
      └ Pay commission — bank transfer or netted from EMD
6 · Results & reports        Existing      read after the fact

shared  Noticeboard · Help · Disputes · Profile · Notification preferences
```

### Field Executive — *assigned → inspect → look back*

```
1 · My assignments           Existing      today: "Inspection queue"
      └ Catalogue detail     Existing
            └ Lot detail     Existing
                  └ Inspect lot  Existing
2 · Inspection history       Refine — today a short list on the queue

shared  Profile · Notification preferences
```
Inspection only: no auction, no pricing, no money.

### Operation Manager — *assemble → onboard → verify → publish → deliver*

```
1 · Dashboard                New
2 · Catalogue builder        Refine        the main workspace
    — feeding the catalogue —
3 · Seller approvals         New           a seller must exist before a lot can
4 · Lot pipeline             Existing      the lot arrives
5 · Field executives         New           assign the yard visit
6 · Lot approval             Refine — add Bypass, and write audit entries
      ├ Approve   routine — the report checks out
      ├ Bypass    trusted seller — skip inspection, accept directly
      └ Reject
    — taking it to market —
7 · Auction schedule         Refine — shared with Auction Mgr & Sub Admin
      └ PUBLISH              the moment a catalogue becomes public
8 · EMD eligibility          New           the deadline falls before go-live
    — after the auction —
9 · Logistics                Existing
10 · Handover & closure      Existing
11 · Operations reports      New
```

### Auction Manager — *publish → admit → run → watch → close*

```
1 · Dashboard                New
    — before it opens —
2 · Auction schedule         Reassign — today Ops "Auction setup"
      └ PUBLISH
3 · EMD eligibility          New
    — while it runs —
4 · Live auctions            Reassign — today Super Admin "Control tower"
      ├ Pause · resume · extend
      └ Cancellation request New — Super Admin approves
5 · Bidding rooms            New           drill into one room
6 · Bid monitor              Reassign — today Sub-Admin only
      └ Void request         New — Super Admin approves
7 · Announcements            Reassign
    — after it closes —
8 · Results                  Reassign — today inside Ops "Settlement"
9 · Auction history          Refine
10 · Auction reports         New
```

### Finance Administrator — *in → held → out → records*

```
1 · Dashboard                New
2 · Profit & loss            New           are we making money
    — money in —
3 · Deposits                 Reassign — today in Sub-Admin work queue
4 · Buyer payments & DOs     Reassign — today inside Ops "Settlement"
5 · Commission settlements   New           the finance side of seller settlement
    — money held —
6 · EMD ledger               New
      └ Forfeiture           New — CEO above threshold
    — money out —
7 · Bank accounts            Reassign — must be verified before paying out
8 · Withdrawals              Reassign — review and process are two people
9 · Refunds                  New
    — records —
10 · Invoices & receipts     New
11 · Reconciliation          New
12 · Financial reports       New
```
*Moved:* Bank accounts heads the money-out group — a payout account must be verified
before a withdrawal can be paid.

### Sub Admin — *head of operations; same order as the roles they oversee*

Every Sub Admin account sees exactly this — no per-account permission templates.

```
1 · Dashboard / Ops console  Refine — add assignment
2 · Work queue               Refine — add claiming
3 · Approvals — all roles    New       confirm or reverse any operational task
    — pre-auction, in the Operation Manager's order —
4 · Seller verification      New
5 · Lot pipeline             Reassign — shared with Ops
6 · Field executives         New
7 · Lot approval · bypass    Reassign — shared with Ops
8 · Catalogue builder        Reassign — shared with Ops
    — the auction, in the Auction Manager's order —
9 · Auction schedule & PUBLISH  Reassign — shared with Auction Mgr
10 · EMD eligibility         New
11 · Live auctions           Reassign — shared with Auction Mgr
12 · Bid monitor             Existing  flag; void still Super Admin
    — watching, not executing —
13 · EMD & payment activity  New       every EMD payment, alongside Finance
14 · Disputes & support      Refine — resolve does not exist
    — accounts and admin —
15 · User accounts           New
      └ Reset password       New — auto-generate or set manually
16 · Content management      New       draft; Super Admin publishes
17 · Reports                 New
18 · My activity             New
```

### Super Admin — *our role · structure → people → settings → exceptions → record*

Everything in the Sub Admin menu, plus, exclusive to us:

```
1 · Dashboard                Existing  platform-wide
    — structure: a role must exist before anyone can hold it —
2 · Roles                    New
      ├ Add a role (with default pages created for it)
      ├ Remove a role (accounts suspended, never deleted)
      ├ Duplicate a role
      └ Restore a removed role
3 · Page manager             New
      ├ Rename a page or sub-page
      ├ Show or hide a page per role
      ├ Reorder the menu
      └ Attach a page to a different role
    — people —
4 · Sub Admin accounts       New       any number, new credentials
5 · All user accounts        Refine — verify and suspend do nothing today
      └ Reset any password   New
    — settings —
6 · Financial config         Existing  + commission rate, CEO thresholds
7 · Master data              Refine — every add/edit is a stub
8 · Content publishing       New
    — exceptions —
9 · Blacklist & defaulters   Refine — ban is cosmetic today
10 · Emergency override      Refine — today the full "Control tower"
      ├ Void a bid
      ├ Approve cancellation
      └ Approve bypass exceptions
    — the record, and the undo —
11 · Change history & rollback  New    undo anything above, instantly
12 · Audit trail             Refine — export is a stub
```

### CEO / MD — *four questions, in order*

```
    — are we making money? —
1 · Profit & loss            New       the landing page
      ├ Income — commission, buyer premium, fees
      ├ Costs
      └ Net profit, this month and this year
    — is the business growing? —
2 · Business growth          New
3 · Auction performance      New
    — is anything at risk? —
4 · Money at risk            New
5 · Things that went wrong   New
    — what needs me? —
6 · What needs my signature  New       the only screen with buttons
7 · Delegate my approvals    New
8 · Reports                  New       reference, read last
```

### Public website

```
Home                Existing (content hardcoded)
Browse auctions     Existing — published catalogues only
      └ Catalogue detail  Existing
Noticeboard         Existing
How it works        Existing
Terms & privacy     Existing
Register            Refine — buyer/seller signup exists in the store
Sign in             Existing
      └ Forgot password  New

marketing site  Home · For buyers · For sellers · How it works · Contact
company site    About Us · Blog · FAQs · Pricing · Help · Grievance · Legal
```

---

## Part 3 — Dashboard contents

"Dashboard" is not an answer. Each dashboard answers exactly two questions — **"is anything
wrong?"** and **"what needs me today?"** Every work-list item links straight to the screen
where it is resolved. Nothing on a dashboard is edited in place.

| Role | Headline figures | Work lists | Status |
|---|---|---|---|
| Buyer | Wallet balance · EMD locked · active bids with leading/outbid split · lots won and their all-time value | Needs your attention (EMD shortfalls, closing soon, outbid) · auction calendar · recent notifications | Existing |
| Seller | Live catalogues · lots in auction · bids today · best uplift over start rate · **lots awaiting my accept/reject** · commission owed | My catalogues with countdowns · auctions pending settlement · lots where I have not yet decided the price | Refine |
| Field Executive | Catalogues assigned · lots inspected vs total per catalogue | Assigned catalogues with yard, seller and inspection window · recently completed reports | Existing — serves as the dashboard |
| Operation Manager | Pending inspection · inspected awaiting approval · approved · bypassed · in auction · resolved · needs attention | Catalogues ready to publish · flagged and rejected lots · pending seller KYC · EMD exemption requests · delivery orders at risk · field executive workload | Refine |
| Auction Manager | Live catalogues · lots live now · bids in the last hour · active bidders · anti-snipe extensions today · auctions closing within the hour | Catalogues ready to publish · live auctions with countdown and pause state · EMD eligibility queue · flagged bids · results awaiting confirmation | New |
| **Finance Administrator** | **Net profit this month** · money in today · money out today · total EMD held · outstanding buyer payments · commission owed by sellers | Deposit claims awaiting verification · withdrawals awaiting review · withdrawals awaiting processing (a separate list — different person) · bank accounts to verify · commission settlements to confirm · refunds due · reconciliation exceptions | New |
| Sub Admin | Everything on the operational dashboards above, in one place — pipeline counts, live auctions, EMD activity, open work items, SLA breaches | Their assigned queue ranked by SLA · anything awaiting approval from any operational role · pending seller verifications · open disputes · flagged bids · password reset requests · shift handover notes | Refine |
| Super Admin | Everything a Sub Admin sees, plus total users · roles in use · pages changed recently · failed sign-ins · platform health | Recent role and page changes with one-click undo · Sub Admin accounts and their activity · critical audit events · support items raised by the client | Refine |
| CEO / MD | **Net profit this month and this year** · income from commission, buyer premium and fees · costs · sales value and volume · new and repeat customers | What needs my signature · money we are holding · money owed to us and how old it is · money we owe sellers · things that went wrong this week | New |

---

## Part 4 — Page-by-page specification

### 4.1 Buyer

| Page | Contains | Buyer can do | Approval | Status |
|---|---|---|---|---|
| Dashboard | Wallet, EMD locked, active bids, lots won, attention list, calendar, notifications | Read and navigate | None | Existing |
| Browse & Shortlist | Live/upcoming/closed tabs, search, category, EMD band and seller filters, sort. **Only published catalogues appear** | Shortlist a catalogue, open a catalogue | None | Existing |
| Catalogue detail | Lots annexure, terms, inspection & contacts, documents, yard, countdown | Shortlist lots, book an inspection slot, accept terms, enter the bidding room | None | Existing |
| Wallet | Deposits, withdrawals, bank accounts, EMD refunds, ledger reports | Submit a deposit claim, request a withdrawal, register a payout account | **Finance** | Existing |
| EMD & payments | Shortlisted catalogues by status, EMD required / funded / shortfall per catalogue | Open a catalogue to fund, request a deadline exemption | Exemption → Auction Mgr or Sub Admin | Existing |
| Bid Now — pick an auction | Live auctions the buyer has shortlisted lots in, soonest-closing first, countdown and EMD state | Jump straight into the auction that needs them fastest | None | Existing |
| Bid Now — pick lots | Every lot as a large tap target, sticky countdown, sticky "enter room" bar | Star lots, fund pending EMD, enter the bidding room | None | Existing |
| My bids | Active / won / all-history tabs, bid trail per lot, rank and outcome | Read, jump to the bidding room | None | Existing (tab renamed "Bid results") |
| Auction status | Delivery orders by stage, amounts, lifting deadline, checklist, weighment entry | Tick the lifting checklist, record gross weighment, complete lifting | None | Refine |
| Become a seller | Three-step KYC: business details, documents, bank & declaration | Submit KYC | Sub Admin or Ops Manager | Existing |

### 4.2 Seller

> **The commercial model.** After an auction closes the seller reviews the cleared price on
> each sold lot and **accepts or rejects it**. On accepted lots ferroBid charges a
> **commission of 10% of the upside over the seller's own reserve** — nothing on a lot that
> merely met reserve. The seller settles that commission per auction, either by bank
> transfer or by having it netted out of their EMD.

| Page | Contains | Seller can do | Approval | Status |
|---|---|---|---|---|
| Workspace | Live catalogues, lots in auction, bids today, best uplift, my catalogues with countdowns | Read, open a catalogue | None | Existing |
| Create lot | Single lot form + bulk CSV; metal, grade, quantity, UOM, yard, start rate, increment, reserve, EMD, hazardous flag, photos | Submit a lot for inspection | Ops Manager or Sub Admin | Existing |
| My lots & batches | In-pipeline / in-auction / sold-and-closed tabs | Read only today. **Should also:** edit before inspection, withdraw before cataloguing, see the inspection report and any rejection reason | Ops Mgr on withdrawal after cataloguing | Refine |
| Live monitor | Read-only bid feed on own live catalogues, bidders masked as pseudonyms | Watch. Request an extension | Extension → Auction Mgr | Existing |
| Results & reports | Realisation by catalogue, sell-through, average uplift, per-lot outcomes | Read, export | None | Existing |

**Settlement — agree price & pay commission** (`/seller/settlement`, Existing)

- **Contains:** four tabs — Upcoming, Live, Pending settlement, History. Per auction: lots
  sold, lots accepted so far, gross value accepted, commission owed. Per sold lot: reserve
  value, cleared price, the upside over reserve, and the commission that upside attracts. A
  running commission total. A settlement record once paid — amount, method, date.
- **Actions:** Accept the buyer's price on a lot · Reject it · Pay commission by bank
  transfer (company account details + a reference) · Settle from EMD (netted against held
  EMD, two-step confirmation).
- **After the action:** every sold lot decided *and* any commission owed settled → the
  auction moves from Pending settlement into History. A rejected lot attracts no commission
  and needs an operational decision on the material.
- **Cannot do:** change the cleared price · change the commission rate · settle a
  commission already recorded · decide a lot that has not closed.
- **Approval:** Finance confirms the settlement against the bank. A rejected price is an
  operational exception for Ops Manager or Sub Admin.
- **Automation:** commission = 10% of (cleared price − reserve value) per accepted lot,
  never typed by hand.

### 4.3 Field Executive

Inspection, and nothing else. No auction screens, no pricing, no money.

- **My assignments** (`/field`, Existing) — assigned catalogues with code, title, yard,
  region, seller, inspection window and hours; lots inspected vs total; recently completed
  reports. Cannot assign work to themselves, see others' catalogues, or see any auction,
  bid, price or reserve. *Refinement:* a notification when an assignment arrives.
- **Inspect lot** (`/field/inspect/:lotId`, Existing) — declared vs measured quantity,
  condition, verification checklist, photo capture, notes. Actions: **Verify · Flag ·
  Reject** (notes mandatory on flag and reject). Ops Manager or Sub Admin decides the lot.
  *Refinement:* make the submitted report immutable (corrections create a new version), and
  notify the Operation Manager and seller on submission.
- **Catalogue detail** / **Lot detail** — Existing. **Inspection history** — Refine.

*Removed at client request:* the proposed "Yard day tasks" page. Field Executive scope
stays purely pre-auction inspection.

### 4.4 Operation Manager

**Lot approval — approve, bypass or reject** (`/exec/approvals`, Refine)

- Inspected lots awaiting a decision, declared vs measured quantity, condition, checklist,
  photographs, seller history and known-seller flag.
- **Approve** (the normal path) · **Bypass** (new — trusted seller, accepted directly
  without inspection) · **Reject** · **Send back** for re-inspection.
- Bypass safeguards: a **typed reason**, an **audit entry at warning severity**, a
  **bypassed marker** visible to Ops, Auction and Finance, and a monthly count on the
  Operations report. Deliberately *not* gated behind another approval.
- **Audit:** currently none at all — this is the core quality gate and must be logged.

**Catalogue builder** (`/exec/catalogue-builder`, Refine)

- Four steps — select lots (filter by seller, metal, yard; bulk-set increment, EMD % and
  unit) · details (title, schedule, auction type, anti-snipe window, bid validity, terms
  set, inspection window and contact) · documents · yard details and field exec assignment.
- **Visibility rule:** a catalogue created here is invisible to buyers and sellers until
  Publish.
- **Changes required:** Publish moves out of this screen onto Auction schedule; bulk
  overrides must be disclosed to the seller and the original values kept; bulk overrides
  must be audited.

| Other Ops pages | Contains | Actions | Status |
|---|---|---|---|
| Dashboard | Pipeline counts, catalogues ready to hand over, KYC queue, field workload, deliveries at risk | Read · route | New |
| Seller approvals | Pending KYC with firm, GSTIN, documents and SLA countdown | Approve · reject with reason · request documents | New |
| Lot pipeline | Six columns from pending inspection to resolved, plus an attention column | Approve · bypass · flag · resolve | Refine |
| Field executives | Each exec with region, catalogues assigned, lots outstanding, turnaround; unassigned catalogues; assignment history | Assign · re-assign · set availability | New |
| **Auction schedule & publish** | Catalogues ready for market with lot count, total reserve value and a buyer preview; scheduled auctions with start, end, anti-snipe window | **PUBLISH** now or schedule · reschedule before go-live. Shared with Auction Mgr, Sub Admin, Super Admin | Refine |
| **EMD eligibility** | Buyers who missed the pre-bid EMD deadline, with reason, standing and wallet position | Approve or reject an exemption. Shared with Auction Mgr, Sub Admin, Super Admin | New |
| Logistics | DOs awaiting payment, in lifting and completed; vehicle, gate pass, weighbridge queue | Advance a stage · schedule lifting | Existing |
| Handover & closure | Completed DOs with weighment-final quantities | Confirm handover | Refine |
| Operations reports | Pipeline throughput, inspection turnaround, rejection rate by seller, **bypass count**, delivery ageing, field productivity | Read · export | New |

### 4.5 Auction Manager

The most time-critical workspace. It owns the running auction end to end, and shares
publish and EMD-eligibility with Ops, Sub Admin and Super Admin. **Nothing here touches
money.**

**Auction schedule & publish** (Reassign) — turns a private, finished catalogue into a
public auction. **PUBLISH** is the boundary between private and public; the gate is a
*state* boundary, not a role boundary — four roles can press it, and whoever does is named
in the audit entry. CEO approves above the configured catalogue value. Cannot add/remove
lots, change a reserve, approve a lot, or publish a catalogue with undecided lots.

**Live auctions** (Reassign) — every live and upcoming catalogue with status, countdown,
lots live, bid count, participants, extensions and paused indicator. **Pause · Resume ·
Extend** (reason mandatory) · **Request cancellation** · open the bidding room. Cannot
**void a bid** (escalated to Super Admin), cancel unilaterally, alter a bid or rate, change
a reserve, or touch any wallet.

**EMD eligibility** (New) — decides whether a buyer who missed the pre-bid deadline may
still join. Approve reopens funding for that buyer on that catalogue; Reject with reason.
An eligibility decision, not a payment one — **Finance sees it but never decides it.**

| Other Auction pages | Contains | Actions | Status |
|---|---|---|---|
| Dashboard | Ready to publish, live now, closing within the hour, eligibility queue, flagged bids | Read · route | New |
| Bidding rooms | Operator view: lot-by-lot rates, ladders, participants, extension count, terms acceptance | Observe · handle an exception | New |
| Bid monitor | Recent valid bid stream with bidder firm, rate, type, hot-lot marker | Review a flag · dismiss · **request a void** from Super Admin | Reassign |
| Announcements | Catalogue-scoped notices and what has been sent | Broadcast to that catalogue's participants | Reassign |
| Results | Closed lots and outcomes, including below-reserve lots | Confirm the result · refer a below-reserve lot | Reassign |
| Auction history | Closed and cancelled catalogues with outcome, realisation, extensions, interventions | Read · export | Refine |
| Auction reports | Sell-through, average uplift, participation depth, anti-snipe frequency, cancellation and void rates | Read · export | New |

**What the Auction Manager must never see a button for:** building or approving catalogues ·
bypassing inspection · setting reserve prices · assigning field executives · any wallet,
deposit, withdrawal, refund, forfeiture or commission · voiding a bid directly.

### 4.6 Finance Administrator

Every rupee, and the answer to whether the company is making money. Four screens move here
from Operations and the Sub-Admin desk; the rest are new.

**Profit & loss** (New — shared figures with the CEO)

- **Contains:** net profit for the period with the previous period beside it · **income**
  (seller commission, buyer premium, listing fees, anything else charged) each as a value
  and a share of the total · **costs** in the categories the business tracks · profit by
  metal category, region, seller and auction · a twelve-month trend and a
  same-period-last-year comparison · commission earned against commission still owed.
- **Actions:** change the period · drill into any figure to the transactions behind it ·
  export.
- **Difference from the CEO's view:** the same numbers, but Finance can open every one of
  them down to the individual payment. The CEO's version stops at the summary and uses
  plainer wording.
- **Cannot do:** edit any figure. Everything is computed from real auctions and payments.

**Commission settlements** (New — the other side of seller Settlement)

- **Contains:** commission owed per auction and per seller · settlements the seller has
  recorded, with method (transfer or netted from EMD), reference and date · unmatched
  transfers · sellers with commission outstanding and how long · lots the seller rejected,
  which attract no commission.
- **Actions:** **Confirm** a transfer against the bank statement · **Query** a settlement ·
  **Apply** an EMD-netted settlement against the seller's held balance · chase an overdue
  commission.
- **After:** Confirmed → the auction is fully settled and appears in the seller's History.
  Queried → the seller is asked for a better reference. EMD-netted → held EMD reduces by
  the commission and the ledger records both sides.
- **Cannot do:** change the rate or computed amount · confirm a transfer without a matching
  bank credit · net more than the seller's held EMD.

**Withdrawals** (Reassign + maker-checker)

- Two distinct lists — **Awaiting review** and **Awaiting processing** · each request with
  buyer firm, amount, destination account (masked), request time and window state · the
  buyer's balance and EMD exposure.
- **Actions:** **Review** (accepts into processing) · **Process** (releases the payment) ·
  **Fail** with reason (reverses the amount to the wallet).
- **Maker–checker rule:** the Finance user who reviews a withdrawal **must not** be the
  user who processes it.
- **Cannot do:** process outside the configured weekly window · pay to an unverified
  account · release more than the held amount · review and process the same request.
- **Audit:** required at each step, naming both reviewer and processor.

| Other Finance pages | Contains | Actions & approval | Status |
|---|---|---|---|
| Dashboard | Net profit this month, money in and out today, EMD held, outstanding payments, commission owed | Read · route | New |
| Deposits | Submitted claims with amount, UTR, transfer date, proof and SLA countdown; duplicate-UTR warning | Approve (credits the wallet) · reject with reason. **Must be matched to a real bank credit** | Reassign |
| Buyer payments & DOs | Delivery orders by stage, material value, GST, TCS, paid vs due, ageing | Record a demand draft · confirm receipt · flag overdue | Reassign |
| EMD ledger & forfeiture | All EMD held by catalogue and buyer; locks, releases and forfeitures over time; buyers past the payment window | Forfeit with reason · waive and release. **CEO above value** | New |
| Bank accounts | Buyer and seller payout accounts, masked to last four digits | Verify · reject with reason | Reassign |
| Refunds | Refunds due from cancellations, weighment shortfalls and resolved disputes | Approve · process. **CEO above value** | New |
| Invoices & receipts | Buyer invoices and seller commission receipts, with tax breakdown | Generate · reissue after an adjustment · export | New |
| Reconciliation | Platform ledger against company bank accounts; unmatched credits and debits, ageing breaks | Match · flag a break · escalate | New |
| Financial reports | Money in and out by period, EMD movement, commission earned, tax collected, outstanding and failed payments, audit pack | Read · export | New |

### 4.7 Sub Admin

**Every Sub Admin account is identical** — the same full menu, the same powers. There are
no per-account permission templates. Work is divided by *assignment*, not by capability.

| Sub Admin can | Which means | Shared with |
|---|---|---|
| Run the whole pre-auction pipeline | Take a lot in, assign a yard visit, review the report, **approve/bypass/reject**, build the catalogue | Operation Manager |
| Run the auction | **Publish**, schedule, pause, resume, extend, decide EMD eligibility, review flagged bids, confirm results | Auction Manager |
| Verify sellers | Approve or reject KYC, request documents, hear an appeal | Operation Manager |
| Manage the field team | Assign and re-assign catalogues to field executives | Operation Manager |
| See all EMD and payment activity | Every EMD payment appears here as well as in Finance — Sub Admin sees the operational picture, **Finance owns the money** | Finance (read alongside) |
| Administer accounts | View/edit any buyer, seller or staff account, and **reset any password** | Super Admin |
| Approve or reject anything operational | Any task by Ops Mgr, Auction Mgr or Field Exec can be reviewed, approved, reversed or sent back | — |
| Handle support | Reply to and resolve disputes, publish drafts for Super Admin approval | Operation Manager |

**What a Sub Admin still cannot do:** void a bid · **execute a money movement** (they see
every deposit, withdrawal, payment and commission and can recommend, but Finance approves
and processes) · ban an account permanently · change financial configuration or master
data · create another Sub Admin, or change roles and pages.

**Approvals — all roles** (New) — one inbox of everything any operational role has done
that a Sub Admin may want to confirm, question or reverse. Not a gate on daily work: the
functional roles act first and their action takes effect immediately; this is a supervisory
review after the fact.

**User accounts & password reset** (New) — every account with role, status, last sign-in
and any open reset. **Reset password — auto-generate** (strong password shown once) or
**set manually**. After sign-in the user is prompted: *keep this password, or set a new
one?* Applies to every role; Super Admin passwords only by another Super Admin. A **Forgot
password** link on sign-in is the self-service route. Audit severity: critical.

### 4.8 Super Admin — our support role

Sees everything a Sub Admin sees, plus the tools to change the shape of the platform.

- **Roles** (New) — add (with default pages created), remove (accounts suspended, never
  deleted), duplicate, restore. Cannot delete accounts with a role, remove the Super Admin
  role, or remove a role while an auction it owns is live.
- **Page manager** (New) — rename, show/hide per role, reorder, attach/detach a page,
  add a sub-page. Cannot change what a page does, hide the only route to a live auction, or
  remove the audit trail from a role that must retain it.
- **Change history & rollback** (New) — every structural change in time order with before
  and after; **Undo this change** · **Restore to a point in time** · compare two points.
  Cannot roll back business data — auctions, bids, payments and audit entries are never
  affected.

| Other Super Admin pages | Contains | Actions | Status |
|---|---|---|---|
| Dashboard | Platform KPIs, roles in use, recent structural changes, failed sign-ins | Read · route · undo a recent change | Refine |
| Sub Admin accounts | Every Sub Admin with username, created date, last active, work handled, status | Create with new credentials · reset password · disable · re-enable · view activity. **No limit** | New |
| All user accounts | Every account of every role with KYC, standing and exposure | Edit · change standing · reset any password · suspend | Refine |
| Financial config | EMD sizing, GST, TCS, **commission rate**, payment windows, fees, withdrawal window, company bank accounts, **CEO thresholds** | Edit and save. CEO approves fee changes | Refine |
| Master data | Metal categories, units, yards and regions, terms & conditions sets | Add · edit · new terms version | Refine |
| Content publishing | Content drafted by Sub Admins, before-and-after view | Publish · return with comments | New |
| Blacklist & defaulters | Defaulters and watchlist with reason and forfeiture history | Restore · clear · escalate · permanent ban with CEO approval | Refine |
| Emergency override | Void requests, cancellation requests, bypass exceptions with evidence | Void a bid · approve a cancellation · direct auction override | Refine |
| Audit trail | Every recorded action, searchable by severity, type, actor and text | Read · export | Refine |

### 4.9 CEO / MD

Built around four plain questions, using ordinary words rather than platform jargon.
**Eight screens, one of which has buttons.**

1. *Are we making money?* → **Profit & loss** (the landing page). One headline number: net
   profit, this month and this financial year, with the previous period beside it. Money we
   earned (commission, buyer premium, fees), money we spent, a twelve-month trend, which
   categories and regions earned most. Language deliberately plain.
2. *Is the business growing?* → **Business growth** · **Auction performance**
3. *Is anything at risk?* → **Money at risk** · **Things that went wrong**
   - Money at risk: money we are holding for customers (EMD locked — not the company's
     money) · money owed to us (buyers who won but have not paid, sellers with commission
     outstanding, each with ageing) · money in transit (withdrawals debited but not paid
     out) · forfeitures this period and disputed amounts.
4. *What needs me?* → **What needs my signature** — requests above the configured
   thresholds (large concessions, EMD forfeitures, refunds, high-value auction publishes)
   plus every permanent ban, fee change and new Super Admin. **Approve · Refuse with reason
   · Ask for more information · Delegate** the queue to a named person until a set date.
   The CEO approves, never originates.

---

## Part 5 — Public website ownership

> **The rule for every public number:** auction numbers come from the auction system, money
> numbers come from the finance system, words come from the CMS. No content editor should
> ever be able to type a lot count, a price, a fee or a growth statistic into a page.

The build currently serves **three separate public sites** — a marketplace landing page, a
marketing site, and a company site. They already contradict each other. Consolidating to
one public site is Client Decision 4.

### Home page, section by section

| Section | Type | Source | Owner | Actions |
|---|---|---|---|---|
| Header & navigation | Static | Application shell | Super Admin | None — structural |
| Hero headline & copy | CMS | Written into the page file today | Sub Admin | Edit → Super Admin publishes |
| Search | System | Catalogue index | System | None |
| Live ticker — "N live now" | System | Live catalogue count | Auction system | **No manual CRUD** |
| Next to close | System | Earliest-closing live catalogue | Auction system | **No manual CRUD** |
| Live auctions rail | System | Live catalogues | Auction system | **No manual CRUD** |
| Upcoming auctions | System | Upcoming catalogues | Auction system | **No manual CRUD** |
| Browse by category | Master data | Nine categories in a code constant | Super Admin | Create · edit · delete |
| How it works | CMS | Written into the page file | Sub Admin | Edit → Super Admin publishes |
| Trust statistics | *Should be system* | **Three literal numbers in the source** | Reporting system | **Must become live counts. Never a CMS field** |
| Footer links & contact | CMS | Written into the shell file | Sub Admin | Edit → Super Admin publishes |

### Marketing site — flagged content

| Section | Type | Note |
|---|---|---|
| "Live activity" feed | **Fabricated** | Presents invented events as live activity. Must be real or removed |
| Upcoming auctions | **Fabricated** | Contradicts the real list on the marketplace landing page |
| Price chart | **Fabricated** | Presented as market data. High risk if it ships as-is |
| Announcements | CMS (Sub Admin) | Should read from the real announcement system |
| Testimonials | CMS (Sub Admin) | Named customers — needs consent tracking per quote |
| Partner brands | CMS (Super Admin) | Named third parties — permission required |

### Company site & CMS pages

| Page group | Owner | Approval | Note |
|---|---|---|---|
| About Us, How it works | Sub Admin | Super Admin | Names real partner firms — verify before publishing |
| Blog, Knowledge Centre, Market Reports | Sub Admin | Super Admin | Needs draft / scheduled / published states |
| FAQs, Help Centre, Grievance | Sub Admin | Super Admin | Support owns this |
| **Pricing** | **Finance Administrator drafts** | **CEO** | Must match Financial Configuration exactly |
| Terms, Privacy, Auction terms | Super Admin | **CEO** | Legally binding. Versioned, with effective date |
| Contact details | Sub Admin | Super Admin | One source, not two |

### Marketplace — one page, many views

| Page | Buyer sees | Seller sees | Auction Manager sees | Ops / Finance see |
|---|---|---|---|---|
| Marketplace landing | Live, upcoming, closed with filters and shortlist stars | Own catalogues highlighted | Everything, plus draft and paused | Read-only |
| Catalogue detail | Lots, terms, inspection, documents. **No reserve** | Own catalogue with reserve visible | All lots with reserve, live state, extension count | Ops: pipeline state. **Finance: EMD exposure** |
| Lot detail | Photos, inspection report, EMD, start rate | Own lot with reserve and inspection notes | Bid ladder and participant count | Ops: full inspection history |
| Bidding room | Own funded lots, own ladder position, own bid trail | No access — cannot bid on own material | Operator view: all participants, ladders, extension state | Sub Admin: read-only stream |
| Bid history | Own bids only | Rates only, bidders masked | Full identities | Super Admin: full, plus voided bids |
| EMD information | Own EMD, funded and required | Not shown | Eligibility state per bidder | **Finance: the money side of the same records** |

---

## Part 6 — Page visibility matrix

`✓` can open and act · `R` can open, read-only · `—` no access.
Every Sub Admin account has identical access. Super Admin is our support role.

| Page | Buyer | Seller | Field | Ops Mgr | Auction | **Finance** | Sub Admin | Super | CEO |
|---|---|---|---|---|---|---|---|---|---|
| Public home & browse | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sign in · forgot password | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Catalogue detail (published) | ✓ | ✓ | ✓ | ✓ | ✓ | R | ✓ | ✓ | R |
| Catalogue — before publish | — | — | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| Bidding room | ✓ | — | — | R | ✓ | — | ✓ | ✓ | R |
| Buyer dashboard | ✓ | — | — | — | — | — | — | — | — |
| Shortlist & EMD | ✓ | — | — | — | R | — | R | R | — |
| Bid Now (2 steps) | ✓ | — | — | — | — | — | — | — | — |
| Wallet | ✓ | ✓ | — | — | — | R | R | R | — |
| Auction status / DOs | ✓ | — | — | ✓ | — | ✓ | ✓ | ✓ | R |
| Seller workspace & lots | — | ✓ | — | R | — | — | R | R | — |
| Seller settlement | — | ✓ | — | R | R | ✓ | ✓ | ✓ | R |
| Field assignments & inspect | — | — | ✓ | ✓ | — | — | ✓ | ✓ | — |
| Lot pipeline | — | — | — | ✓ | R | — | ✓ | ✓ | R |
| Lot approval · bypass · reject | — | — | — | ✓ | — | — | ✓ | ✓ | R |
| Field executives | — | — | — | ✓ | — | — | ✓ | ✓ | — |
| Catalogue builder | — | — | — | ✓ | R | — | ✓ | ✓ | — |
| Seller verification (KYC) | — | — | — | ✓ | — | — | ✓ | ✓ | — |
| Logistics & handover | — | — | R | ✓ | — | R | ✓ | ✓ | — |
| Auction schedule & PUBLISH | — | R | — | ✓ | ✓ | — | ✓ | ✓ | R |
| Live auctions | — | — | — | R | ✓ | — | ✓ | ✓ | R |
| EMD eligibility | — | — | — | ✓ | ✓ | R | ✓ | ✓ | R |
| Bid monitor | — | — | — | — | ✓ | — | ✓ | ✓ | R |
| Auction results | — | R | — | R | ✓ | R | ✓ | ✓ | R |
| **Profit & loss** | — | — | — | — | — | ✓ | R | R | ✓ |
| **Deposits** | — | — | — | — | — | ✓ | R | R | R |
| **Withdrawals** | — | — | — | — | — | ✓ | R | R | R |
| **Commission settlements** | — | R | — | — | — | ✓ | R | R | R |
| **EMD ledger & forfeiture** | — | — | — | — | R | ✓ | R | R | ✓ |
| **Refunds** | — | — | — | R | — | ✓ | R | R | ✓ |
| **Reconciliation** | — | — | — | — | — | ✓ | — | R | R |
| **EMD & payment activity** | — | — | — | R | R | ✓ | ✓ | ✓ | R |
| Work queue & approvals | — | — | — | R | R | R | ✓ | ✓ | — |
| Disputes | ✓ | ✓ | — | ✓ | R | ✓ | ✓ | ✓ | R |
| User accounts · reset password | — | — | — | R | — | — | ✓ | ✓ | — |
| Sub Admin accounts | — | — | — | — | — | — | — | ✓ | R |
| Roles | — | — | — | — | — | — | — | ✓ | R |
| Page manager | — | — | — | — | — | — | — | ✓ | — |
| Change history & rollback | — | — | — | — | — | — | — | ✓ | — |
| Blacklist & defaulters | — | — | — | — | — | R | R | ✓ | ✓ |
| Financial config | — | — | — | — | — | R | R | ✓ | ✓ |
| Master data | — | — | — | R | R | R | R | ✓ | R |
| Content management | — | — | — | — | — | — | ✓ | ✓ | R |
| Content publishing | — | — | — | — | — | — | — | ✓ | R |
| Emergency override · void | — | — | — | — | — | — | — | ✓ | R |
| Audit trail | — | — | — | R | R | R | R | ✓ | ✓ |
| What needs my signature | — | — | — | — | — | — | — | — | ✓ |

> **Today this matrix is aspirational.** Every page is currently reachable by every role —
> the router mounts them all without an access check, and only 12 of roughly 50
> state-changing operations verify who is calling. **This matrix has to be enforced on the
> server before any new role is built.**

---

## Part 7 — Page → action → role matrix

| Page | Action | Primary role | Also held by | Approval | Status |
|---|---|---|---|---|---|
| Buyer journey | Shortlist a lot · book inspection · accept terms | Buyer | — | None | Exists |
| | Place a bid · set an auto-bid ceiling | Buyer | — | None | Exists |
| | Fund EMD (also from Bid Now) | Buyer | — | None — seen by Finance *and* Sub Admin | Exists |
| | Submit a deposit claim · request a withdrawal | Buyer | — | **Finance** | Exists |
| Seller journey | Create a lot | Seller | — | Ops Mgr · Sub Admin | Exists |
| | Edit or withdraw a lot | Seller | — | Ops Mgr after cataloguing | New |
| | **Accept or reject the cleared price** | Seller | — | None — it is their material | Exists |
| | **Pay commission** — transfer or from EMD | Seller | — | **Finance confirms** | Exists |
| Inspect lot | Submit inspection report | Field Executive | — | None — it is evidence | Exists |
| Lot approval | **Approve** a lot | Operation Manager | Sub Admin | None | Exists |
| | **Bypass** — trusted seller, skip inspection | Operation Manager | Sub Admin | None — reason + audit only | Refine |
| | Reject · send back for re-inspection | Operation Manager | Sub Admin | None | Exists |
| | Assign · re-assign a field executive | Operation Manager | Sub Admin | None | New screen |
| | Build a catalogue (stays private) | Operation Manager | Sub Admin | None | Refine |
| Seller approvals | Approve or reject KYC | Sub Admin | Operation Manager | Ops Mgr on appeal | New |
| Auction | **PUBLISH** — make a catalogue public | Auction Manager | Ops Mgr · Sub Admin · Super Admin | **CEO** above value | Refine |
| | Pause · resume · extend | Auction Manager | Sub Admin | None · reason mandatory | Reassign |
| | Request cancellation | Auction Manager | Sub Admin | **Super Admin** | New |
| | Approve or reject an EMD exemption | Auction Manager | Ops Mgr · Sub Admin · Super Admin | None | New |
| | Confirm an auction result | Auction Manager | Sub Admin | CEO above concession | Reassign |
| Bid monitor | Flag a bid · request a void | Sub Admin | Auction Manager | **Super Admin** | Exists |
| | **Void a bid** | Super Admin | — | None · reason mandatory | Refine |
| **Finance** | Approve or reject a deposit claim | Finance | — (Sub Admin may recommend) | None | Reassign |
| | Withdrawal — **review** | Finance user A | — | None | Reassign |
| | Withdrawal — **process** | **Finance user B** | — | Must not be user A | New (maker-checker) |
| | Confirm a commission settlement | Finance | — | None | New |
| | Forfeit an EMD | Finance | — | **CEO** above value | New |
| | Approve a refund | Finance | — | **CEO** above value | New |
| | Verify a bank account · record a demand draft | Finance | — | None | Reassign |
| Fulfilment | Advance a delivery stage · schedule lifting | Operation Manager | Sub Admin | None | Exists |
| | Confirm handover complete | Operation Manager | Sub Admin | None | Exists |
| Disputes | Reply on a ticket | Sub Admin | Operation Manager | None | Exists |
| | Resolve a dispute | Sub Admin | Operation Manager | **Finance if a refund follows** | New |
| Accounts | View and edit any account | Sub Admin | Super Admin | None | New |
| | **Reset a password** — auto-generate / set manually | Sub Admin | Super Admin | None · user prompted to change | New |
| | Suspend · permanently ban | Super Admin | Sub Admin proposes | **CEO** on a ban | Refine |
| Platform (our role) | Create a Sub Admin account | Super Admin | — | CEO notified only | New |
| | **Add or remove a role** | Super Admin | — | None | New |
| | **Rename or hide a page** | Super Admin | — | None | New |
| | **Roll back a structural change** | Super Admin | — | None | New |
| | Change financial configuration | Super Admin | — | **CEO** for fees | Refine |
| | Publish content | Super Admin | — (Sub Admin drafts) | CEO for pricing and legal | New |
| CEO queue | Approve · refuse · delegate | CEO | a named delegate | Final | New |

> Wherever "also held by" says **Sub Admin**, that is supervisory overlap: the functional
> role does the work day to day, and the Sub Admin can do the same job when covering an
> absence or correcting something. It is not a second approval step; both roles act
> directly, and every action is audited by name.

---

## Part 8 — Approval matrix

Only the decisions that need a second signature. **Approval is the exception, not the
default** — only 22 decisions in the whole system need one. **A refusal is never a dead
end** — every row returns a reason to whoever asked. **Bypass is deliberately not on this
list**: it is controlled by a typed reason and an audit entry rather than a second
approver.

| Decision | Requested by | Approved by | Trigger | If refused |
|---|---|---|---|---|
| Seller KYC | Seller | Sub Admin · Ops Manager | Every time | Told what to resubmit; may appeal to Ops Manager |
| Lot into a catalogue | Field Executive report | Ops Manager · Sub Admin | Every lot | Flagged for re-inspection, or rejected; seller informed |
| **Inspection bypass** | Ops Manager · Sub Admin | Nobody — direct acceptance | Trusted sellers | n/a — reason and audit entry required instead |
| **Auction publish** | Ops Mgr · Auction Mgr · Sub Admin | **CEO** | Above catalogue value | Catalogue stays private and unpublished |
| EMD deadline exemption | Buyer | Ops Mgr · Auction Mgr · Sub Admin | Every time | Buyer cannot join that sale; told why |
| Auction cancellation | Auction Manager · Sub Admin | **Super Admin** · CEO informed | Every time | Auction continues to its scheduled close |
| Bid void | Sub Admin flags → Auction Manager requests | **Super Admin** | Every time | Bid stands; the flag remains on record |
| Cleared price on a sold lot | System, at auction close | **The seller** — accept or reject | Every sold lot | No commission charged; the lot becomes an operational exception |
| Commission settlement | Seller | **Finance** | Every auction with commission owed | Seller asked for a better reference; auction stays in Pending settlement |
| Deposit claim | Buyer | **Finance** | Every time | Not credited; buyer asked for better proof |
| Withdrawal | Buyer | **Finance user A reviews · Finance user B processes** | Every time. Second signature mandatory above value | Reversed to wallet with the reason shown |
| Bank account | Buyer or Seller | **Finance** | Every time | Rejected with reason; may re-register |
| EMD forfeiture | **Finance** | **CEO** | Above value | EMD released back to the buyer |
| Refund | **Finance** | **CEO** | Above value | Held pending review; dispute stays open |
| Handover closure | Ops Manager · Sub Admin | Ops Manager · Sub Admin | Every time | Delivery stays open |
| Dispute resolution | Sub Admin | Sub Admin · Ops Manager | Every time | Ticket stays open; SLA clock continues |
| Password reset | User, or support on their behalf | Sub Admin · Super Admin | Every time | User stays locked out; identity check repeated |
| Permanent ban | Sub Admin proposes | Super Admin executes · **CEO** approves | Every time | Account stays on watchlist or defaulter standing |
| New Sub Admin account | Super Admin | None — CEO notified | — | — |
| Add or remove a role | Super Admin | None — ours to manage | — | reversible via rollback |
| Fee or commission change | Super Admin | **CEO** | Every time | Rates unchanged |
| Content publish | Sub Admin | Super Admin · CEO for pricing and legal | Every time | Returned to the author with comments |

---

## Part 9 — Automation

**Automate anything deterministic, reversible and high-frequency. Require a person for
anything judgemental, irreversible, or that takes money away from a customer.** That is why
EMD release is automatic and EMD forfeiture never can be — one returns money, the other
takes it.

| The system does this by itself | Where it shows | Human involvement | Status |
|---|---|---|---|
| Validates every bid — increment, live state, paused state, one offer per sealed tender | Bidding room | None | Exists |
| Extends a lot when a bid lands inside the anti-snipe window | Bidding room · Live auctions | None | Exists |
| Places proxy bids up to a buyer's ceiling | Bidding room | None | Exists |
| Ranks the bid ladder and detects who has been outbid | Bidding room · Bid monitor | None | Exists |
| Closes each lot at its own end time and resolves it against reserve | Everywhere the lot appears | None | Exists |
| Creates the delivery order on a win, with GST and TCS computed | Auction status · Logistics · Payments | None | Exists |
| Releases EMD to unsuccessful bidders the moment their lot closes | Wallet · EMD ledger | None | Exists |
| Locks EMD from the available balance when a buyer funds a lot | Wallet · Shortlist | None | Exists |
| Closes EMD funding at the deadline and reopens it only on an approved exemption | Shortlist · Bidding room · EMD eligibility | Auction Manager on exemptions only | Exists |
| Takes a catalogue live on schedule and flips its approved lots to live | Auction schedule · Marketplace | None once published | Exists |
| Closes a catalogue when no lot in it is still open | Auction schedule · Marketplace | None | Exists |
| Freezes every countdown in a paused catalogue and refuses bids | Bidding room · Live auctions | Auction Manager triggers the pause | Exists |
| Notifies a buyer they have been outbid, won, or had EMD released | Notification bell | None | Exists |
| Enforces the weekly withdrawal window on both the button and the request | Wallet · Withdrawals | None — not overridable | Exists |
| Masks a bank account to its last four digits on entry | Wallet · Bank accounts | None | Exists |
| Computes SLA countdowns and marks breaches | Work queue · Sub Admin dashboard | None | Exists |
| Writes an audit entry on privileged actions | Audit trail | None | Refine |
| Computes GST and TCS on a DO, and the commission on a seller settlement, from Financial Configuration | Auction status · Seller Settlement · Invoices | **Finance confirms; nobody types a deduction** | Refine |
| Routes work to the accountable role and escalates on SLA breach | Every queue | None | New |
| Computes seller commission as 10% of cleared price over reserve, per accepted lot, and moves an auction into History once every lot is decided and commission settled | Seller Settlement · Commission settlements | Seller accepts; **Finance confirms** | Exists |
| Keeps a catalogue invisible until published, then puts it on the marketplace and opens EMD funding | Marketplace · Auction schedule | Publish is pressed | Refine |
| Prompts a user to keep or change their password after a reset | Sign in | The user chooses | New |
| Assigns and re-assigns queue items between Sub Admins | Work queue · Ops console | Sub Admins claim | New |

> **One automation that must be deleted:** the prototype contains a synthetic bidding engine
> that places competing bids on live lots on the platform's own behalf. **A production
> platform that generates its own bids is committing market manipulation.** This must be
> deleted rather than disabled, and its removal should be an explicit acceptance criterion
> on the first release.

---

## Part 10 — Real-time pages & page states

### Pages that update live

| Page | What updates | How often | If the connection drops |
|---|---|---|---|
| Bidding room | Current rate, minimum next bid, ladder, countdown, extension notice, participant activity | Continuously | **Show a clear disconnected banner and disable the bid button.** A stale rate that still accepts a bid is the worst failure this system can have |
| Live auctions | Countdown, lots live, bid count, pause state, extension count | Continuously | Banner, values dim, controls disabled |
| Bid monitor | The bid stream, newest first | Continuously | Feed marked stale with last-updated time |
| Auction status | Countdown to lifting deadline, delivery stage | Every few seconds | Degrades quietly |
| Buyer dashboard | Wallet, EMD locked, active bid positions, closing-soon warnings | Every few seconds | Degrades quietly |
| EMD status | Deadline countdown, funded vs required, exemption state | Every few seconds | Degrades quietly; enforced server-side regardless |
| Notifications | Unread count and new items | On arrival | Queues and delivers on reconnect |
| **Finance & Sub Admin queues** | New items arriving, SLA countdowns | Every minute is enough | Manual refresh is acceptable here |

Everything else — pipeline, catalogue builder, reports, configuration, master data, audit —
is request-and-response.

### What every operational page shows in each state

| State | What the user sees |
|---|---|
| Loading | The page frame and headings appear immediately with placeholder rows — never a blank screen, never a full-page spinner |
| Empty | A plain sentence saying what would appear here and what to do next. Never just "No data" |
| Error | What failed, in the user's terms, and one action to recover. Never a code, never a silent failure |
| Pending | The item, who it is waiting on, how long it has waited — with an SLA countdown where one applies |
| Approved | Outcome, who approved it, when, and the next automatic step |
| Rejected | Outcome, the reason typed by the decider, and what the affected person can do |
| Escalated | "Above your scope — sent to [named role]", the evidence attached, and where it now sits. The item does not vanish from the requester's view |
| Password reset | On first sign-in after a reset: "Keep this password, or set a new one?" |
| Locked | The affordance stays visible but disabled, with a short explanation of what would unlock it |

---

## Part 11 — Existing vs new (full inventory)

The number against each page is **its position in that role's menu**, matching Part 2.

### Finance (12 pages)

| # | Page | Purpose | Owner | Approval | Classification |
|---|---|---|---|---|---|
| 1 | Dashboard | Profit, money in, out and held | Finance | — | New |
| 2 | **Profit & loss** | Is the company in profit, and where from | Finance | — | New |
| 3 | Deposits | Verify claims, credit wallets | Finance | Finance | Reassign |
| 4 | Buyer payments & DOs | Record and chase what is owed | Finance | Finance | Reassign |
| 5 | **Commission settlements** | Confirm what sellers have paid | Finance | Finance | New |
| 6 | EMD ledger & forfeiture | All EMD held; forfeit with reason | Finance | CEO above value | New |
| 7 | Bank accounts | Verify payout destinations first | Finance | Finance | Reassign |
| 8 | Withdrawals | Review then process — two people | Finance | Second Finance user | Reassign |
| 9 | Refunds | Return money where due | Finance | CEO above value | New |
| 10 | Invoices & receipts | Issue and reissue tax documents | Finance | — | New |
| 11 | Reconciliation | Match the ledger to the bank | Finance | — | New |
| 12 | Financial reports | Movement, exposure, audit pack | Finance | — | New |

*(The full per-role inventory for Buyer, Seller, Field Executive, Operation Manager,
Auction Manager, Sub Admin, Super Admin, CEO and Public follows the same shape and is
preserved in the source HTML, Part 11.)*

---

## Part 12 — Missing screens, in build order

| # | Screen | Role | Priority | Why it cannot be skipped |
|---|---|---|---|---|
| 1 | Role enforcement on the server | All | **Blocking** | Every page and action depends on the system checking who is calling |
| 2 | The publish gate | Ops · Auction · Sub Admin | **Blocking** | Nothing may reach a buyer until someone deliberately publishes |
| 3 | Sub Admin accounts | Super Admin | **Blocking** | Today there is one fixed account and "Invite teammate" creates nothing |
| 4 | Password reset & forgot password | All | **Blocking** | There is no way to recover any account of any role |
| 5 | Queue assignment & claiming | Sub Admin | **Blocking** | Two people will work the same ticket unless items have an owner |
| 6 | EMD eligibility queue | Auction Mgr · Sub Admin | Urgent | Buyers raise these today and nobody can answer them |
| 7 | Seller verification that works | Sub Admin · Ops Mgr | Urgent | Four screens offer to approve KYC and none of them changes anything |
| 8 | Bypass on lot approval | Ops Mgr · Sub Admin | High | Direct acceptance for trusted sellers |
| 9 | **Commission settlements — finance side** | **Finance** | High | Sellers can record a payment; nobody can confirm it arrived or chase it |
| 10 | **Profit & loss** | **Finance · CEO** | High | Nobody can tell whether the business is making money |
| 11 | **Finance dashboard** | **Finance** | High | The role has no landing surface |
| 12 | **EMD ledger & forfeiture** | **Finance** | High | The platform cannot enforce its own payment terms |
| 13 | **Refunds** | **Finance** | High | Money can enter and be held but never deliberately returned |
| 14 | **Invoices & receipts** | **Finance** | High | GST and TCS are computed but never issued as documents |
| 15 | **Reconciliation** | **Finance** | High | Deposits are approved on a buyer-typed reference with no bank match — the weakest control in the money flow |
| 16 | Approvals — all roles | Sub Admin | High | No single place to review, confirm or reverse what the other roles did |
| 17 | Auction Manager dashboard | Auction Manager | High | Figures exist across three screens and never appear together |
| 18 | Bidding rooms — operator view | Auction Manager | High | No way for an operator to see all participants and ladders at once |
| 19 | Void & cancellation request flow | Auction Mgr → Super Admin | High | The escalation has no destination |
| 20 | Roles — add, remove, restore | Super Admin | High | Cannot rebuild a broken role without a code release |
| 21 | Page manager | Super Admin | High | The most common support request, least worth a release |
| 22 | Change history & rollback | Super Admin | High | A bad structural change means an emergency release |
| 23 | Field executives roster | Ops Mgr · Sub Admin | Medium | Assignment happens once and can never change |
| 24 | Ops Manager dashboard | Ops Manager | Medium | KYC, bypass and field workload never appear together |
| 25 | Seller lot detail & edit | Seller | Medium | A seller cannot correct or withdraw a lot after submitting |
| 26 | Dispute resolution | Sub Admin · Ops Mgr | Medium | Tickets can be replied to but never closed |
| 27 | CEO workspace — 8 screens | CEO | Medium | The role does not exist |
| 28 | CMS editor & publishing | Sub Admin → Super Admin | Medium | Every public page is written into source |
| 29 | Reports × 4 | Ops · Auction · Finance · Sub Admin | Low | Today only commercial KPIs exist and export is a stub |

**Suggested build sequence:** 1. Enforcement, publish gate, accounts and passwords (1–5).
2. Close the live dead ends (6–7). 3. Bypass and the Finance workspace (8–15). 4. Sub Admin
oversight and the Auction Manager workspace (16–19). 5. Super Admin support tools (20–22).
6. Operations and seller gaps (23–26). 7. CEO and CMS (27–28). 8. Reports (29).

---

## Part 13 — How the roles connect

### The pre-auction chain, and the publish gate

```
SELLER        submits a lot
    ↓
OPS MANAGER   takes it into the pipeline, assigns a yard visit   (or SUB ADMIN)
    ↓
FIELD EXEC    measures it, photographs it, files a report
    ↓
OPS MANAGER   approves the lot — or bypasses it for a trusted seller   (or SUB ADMIN)
    ↓
OPS MANAGER   builds the catalogue   (or SUB ADMIN)
    ↓
═══ NOTHING ABOVE THIS LINE IS VISIBLE TO ANY BUYER OR SELLER ═══
    ↓
OPS MANAGER   schedules it and presses PUBLISH   (or AUCTION MGR · SUB ADMIN · SUPER ADMIN)
    ↓
              the catalogue appears on the marketplace · EMD funding opens
    ↓
BUYER         shortlists, funds EMD, bids
    ↓
SYSTEM        validates, ranks, anti-snipes, closes, resolves against reserve
    ↓
AUCTION MGR   confirms the results
    ↓
SELLER        accepts or rejects the cleared price on each sold lot
    ↓
SELLER        pays commission — bank transfer, or netted from EMD
    ↓
FINANCE       confirms the commission against the bank
    ↓
OPS MANAGER   schedules lifting, closes the handover
    ↓
FINANCE       books it — and the result appears in profit & loss
    ↓
CEO           sees whether the company made money

Watching throughout: SUB ADMIN can do or review any of it · SUPER ADMIN holds the override
```

### When a customer does something, who picks it up

| Customer does this | Picked up by | Then handed to | Closed by | Chain status |
|---|---|---|---|---|
| Buyer or seller registers | System — self-signup | — | System | Complete |
| Buyer applies to sell (KYC) | Sub Admin · Ops Manager | Ops Manager on appeal | Sub Admin | **Broken** — no working approver |
| Anyone forgets their password | Sub Admin · Super Admin | User prompted to keep or change it | The user | **Broken** — no reset exists |
| Buyer claims a deposit | **Finance** | — | Finance credits the wallet | Sits with Ops today |
| Buyer funds EMD | System — automatic lock | **Finance** and **Sub Admin** both see it | System at close | Visible to Finance only today |
| Buyer misses the EMD deadline | Ops Mgr · Auction Mgr · Sub Admin | — | Auction Manager | **Broken** — no approver screen |
| Buyer bids | System — validate, rank, anti-snipe | Auction Manager if anomalous | System at close | Complete |
| Buyer pays for a won lot | **Finance** | Ops Manager schedules lifting | Finance confirms receipt | Sits with Ops today |
| Buyer requests a withdrawal | **Finance user A** reviews | **Finance user B** processes | Finance | One person today |
| Buyer raises a dispute | Sub Admin replies | Ops Manager resolves | **Finance if a refund follows** | **Broken** — cannot be closed |
| Seller submits a lot | Ops Manager · Sub Admin | Field Executive inspects, unless bypassed | Ops Manager approves | Bypass not yet a button |
| Seller edits or withdraws a lot | Ops Manager · Sub Admin | Field Exec re-inspects if changed | Ops Manager | **Broken** — seller cannot edit |
| Seller's catalogue is ready | Ops Mgr · Auction Mgr · Sub Admin | System runs the sale | Auction Manager confirms results | Ops publishes today |
| Seller accepts a cleared price | System computes the commission | Seller pays it | **Finance confirms it arrived** | **Finance side missing** |
| Seller rejects a cleared price | Ops Manager · Sub Admin | Decide what happens to the material | Ops Manager | **Broken** — no handling exists |
| Seller requests an extension | Auction Manager · Sub Admin | — | Auction Manager | Sits in Ops handover today |
| Material is lifted | Ops Manager closes handover | **Finance books it** | Finance | **Booking side missing** |

### Internal hand-offs between staff roles

| From | To | What is handed over | What the receiver does with it |
|---|---|---|---|
| Field Executive | Ops Manager · Sub Admin | An inspection report | Approves, bypasses, sends back, or rejects the lot |
| Ops Manager · Sub Admin | Field Executive | A catalogue assignment or re-assignment | Visits the yard and inspects every lot |
| Ops Manager · Sub Admin | Auction Manager | A published, running auction | Monitors it, intervenes if needed, confirms the results |
| Auction Manager | Seller | Confirmed results, lot by lot | Accepts or rejects each cleared price |
| **Seller** | **Finance** | A commission payment, by transfer or from EMD | **Confirms it against the bank and closes the auction** |
| Auction Manager | Super Admin | A void or cancellation request, with evidence | Approves or refuses |
| Any operational role | Sub Admin | Everything they did — visible in Approvals | Confirms, questions, reverses, or lets it stand |
| Sub Admin | Super Admin | A ban proposal, a void request, or content to publish | Executes what only Super Admin can |
| **Finance** | **Ops Manager** | Confirmation that a buyer has paid | **Releases the delivery order and schedules lifting** |
| **Finance** | **CEO** | Forfeitures and refunds above threshold, and the P&L | Approves the movement; reads the result |
| Super Admin | Sub Admins | Account credentials, and any structural fix | Runs the operation |
| CEO | Any role | An approval, a refusal with a reason, or a delegation | Completes or abandons the action |

---

## Part 14 — Client decisions

| # | Question | Recommendation | What it changes |
|---|---|---|---|
| 1 | **How does the seller receive the money for their material?** The buyer's DO pays material + GST + TCS into the platform, and the seller separately pays commission — but nothing sends the material value on to the seller | Confirm the model. Either the platform remits to the seller (a payout screen is needed), or the buyer settles with the seller directly and we only collect commission (the DO should not collect the full material value) | **The single biggest open item.** Determines the whole shape of the Finance workspace |
| 2 | What rupee thresholds send a decision to the CEO — concessions, forfeitures, refunds, high-value publishes? | Set to your risk appetite and store them in Financial Configuration so they can be tuned without a release | The CEO approval queue cannot be built without numbers |
| 3 | Does the withdrawal maker–checker apply to every withdrawal, or only above a value? | **Record both steps always; make the second person mandatory above a threshold.** Below it, one Finance user may do both but the audit still names them at each step | Determines Finance team size and the withdrawals screen |
| 4 | How many Sub Admin accounts at launch, and do they work in shifts? | Tell us headcount and shift pattern. Does not change what any of them can do | Work-distribution design on the busiest back-office screen |
| 5 | Do all three public sites remain, or consolidate into one? | **Consolidate to one.** Three front doors mean three places to correct a fact | Triples or thirds the CMS scope |
| 6 | May staff act on behalf of a buyer or seller — placing a bid or funding EMD by phone? | **Only as an explicit, separately-audited feature** recording both the staff member and the customer. Never by staff signing in as a customer | Adds a screen and changes the audit model |

### Decisions settled since this document was written

- **Decision 1 — settled.** Buyers pay sellers directly; the platform only collects
  commission. **Finance therefore needs no seller-payout screen**, and the delivery order
  collects the platform's own dues rather than remitting material value.
