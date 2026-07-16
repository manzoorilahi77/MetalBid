# ferroBid v2 — architecture & page-authoring contract

Frontend-only clickable prototype. React 19 + TypeScript + Vite + Tailwind v4 + Zustand + React Router (HashRouter) + lucide-react + framer-motion + recharts.
All data seeds from `src/data/mock/*.json` (regenerate with `npm run mock`), rebased to "now" at load. A 1s tick drives countdowns, bot bidders, anti-snipe and lot closing.

## Non-negotiable rules for every page

1. **No left/right sidebars, ever.** Every page is full-width, card/section based, under the shared sticky top nav (already provided by `layout/Chrome.tsx` — pages render inside it via router `<Outlet>`; sub-area tab bars are already wired in `App.tsx`).
2. Wrap page content in `<Page>` from `../layout/Chrome` (or `../../layout/Chrome` from nested dirs). Use `<PageHeader>` from `components/ui` for the title row.
3. **Forge aesthetic**: flat surfaces, hairline borders, 16px radius (`card` class), generous whitespace, big confident `font-display` headings, sentence case. No heavy shadows/gradients, no generic admin-template look.
4. **All rates, EMD, prices, counts and countdowns use mono tabular numerals** — add the `num` class.
5. Every screen must be complete — no "coming soon", no dead-end buttons. Buttons either mutate the store, open a modal, navigate, or fire a toast.
6. TypeScript strictness: `verbatimModuleSyntax` (use `import type` for types), `noUnusedLocals`, `noUnusedParameters`, no TS enums. Unused imports fail the build.
7. Zustand: select primitive slices — `useStore(s => s.lots)`. NEVER return a fresh object/array literal from a selector (infinite re-render).
8. Default-export the page component from its file. Do not edit shared files (`types.ts`, `store/*`, `components/ui.tsx`, `components/domain.tsx`, `layout/*`, `App.tsx`, `index.css`).

## Design tokens (Tailwind utilities)

- Surfaces: `bg-canvas` (page), `bg-surface` (cards), `bg-surface-2` / `bg-surface-3` (insets)
- Text: `text-ink`, `text-ink-muted`, `text-ink-faint`, `text-ink-inverse`
- Hairlines: `border-line`, `border-line-strong`
- Brand: ember `bg-ember text-white`, `bg-ember-soft text-ember-strong` (CTAs, live); steel `bg-steel`, `bg-steel-soft text-steel-strong` (links, info, upcoming)
- Semantic: `success`, `warning`, `danger` + `-soft` variants
- Fonts: `font-display` (Space Grotesk, headings), default body Inter, `num` (JetBrains Mono tabular)
- Classes: `card`, `card-hover`, `num`; animations `animate-fade-up`, `animate-bid-in`, `animate-toast-in`, `animate-live-pulse`
- Status colour system: Live = ember w/ pulse · Upcoming = steel · Closing-soon = amber · Closed = neutral (use `<StatusChip>`)

## UI kit — `components/ui.tsx`

```tsx
Button({ variant: 'primary'|'secondary'|'ghost'|'danger'|'success'|'steel', size: 'sm'|'md'|'lg', loading?, ...button props })
Chip({ tone: 'neutral'|'ember'|'steel'|'success'|'warning'|'danger', pulse? })
StatusChip({ status })            // any CatalogueStatus | LotStatus | 'closing'
LockChip({ label? })              // sub-admin gated affordance
Countdown({ endsAt, prefix?, size: 'sm'|'md'|'lg' })  // live, red-pulse < 2 min
Tabs({ tabs: [{key,label,count?}], value, onChange })
Segmented({ options: [{key,label}], value, onChange })
Stat({ label, value, sub?, tone? })
Field({ label, hint?, children })  Input  Select  Textarea  Toggle({checked,onChange,label?})
Modal({ open, onClose, title, wide?, children })
EmptyState({ icon?, title, body?, action? })
PhotoThumb({ hue, label?, className? })   // gradient photo placeholder
Avatar({ name, hue, size? })
ProgressBar({ value, max, tone? })
MockPayModal({ open, onClose, amount: string, title, onSuccess(method) })  // fake UPI/NetBanking/RTGS w/ delay
PageHeader({ title, sub?, actions?, crumbs?: [{label, to?}] })
cx(...classNames)
```

`components/domain.tsx`: `CatalogueCard({cat})`, `CategoryTile({category})`, `CATEGORY_META` (9 metal categories with label+hue).
`layout/Chrome.tsx` exports: `Page({children,className?})`, `SubNav({items})` (already wired — don't re-add).

## Store API — `store/store.ts`

```ts
useStore(s => s.…)  // state slices:
now, theme, role, currentUser, paused[catalogueId],
catalogues, lots, users, bids, wallets, inspectionReports, notifications,
termsSets, deliveryOrders, announcements, disputes, auditEvents,
selections, autoBids, inspectionSlots, termsAccepted, lastWonLotId

// actions:
tick(); toggleTheme(); switchRole(role); login(phone); logout()
toggleShortlist(catalogueId, lotId)
fundEmd(catalogueId, lotIds, method) => boolean          // false = insufficient balance
placeBid(lotId, rate, bidderId?, type?) => {ok, error?}  // validates min-increment, anti-snipe
setAutoBid(lotId, maxRate, active)
topUpWallet(amount, method); acceptTerms(catalogueId)
bookInspectionSlot(catalogueId, date, window, persons); submitKyc()
advanceDeliveryOrder(doId)                                // steps the fulfilment stage
createLot(partialLot)                                     // seller — status pending_inspection
submitInspection(lotId, reportFields, 'verified'|'flagged'|'rejected')
setLotStatus(lotId, status)
publishCatalogue(cat, lotIds, overridesById)
pauseCatalogue(id); resumeCatalogue(id); extendCatalogue(id, minutes); cancelCatalogue(id)
voidBid(bidId); setUserStanding(userId, standing, reason?)
pushToast({kind:'success'|'info'|'warning'|'danger', title, body?})
notify({userId, kind, title, body, href?}); markNotificationsRead()
createDispute(subject, category, body, lotId?); clearWinFlag()
audit(action, target, detail, severity?)
```

Helpers: `selectionSummary(state, buyerId, catalogueId)` → `{count, required, funded, shortfall, lotIds, fundedLotIds, unfundedLotIds}`; `catalogueUiStatus(cat, now, lots?)` → `'live'|'closing'|'upcoming'|'closed'`; `ROLE_LABEL`, `ROLE_HOME`, `ROLE_DEMO_USER` maps.
`lib/format.ts`: `inr(n)` ₹12,40,000 · `inrCompact(n)` ₹12.4 L / ₹1.2 Cr · `num(n)` · `countdown(msLeft)` · `relTime(iso, now)` · `fmtDate(iso)` · `fmtDateTime(iso)` · `uid(prefix)`.
`lib/useTick.ts`: `useNow()` (1s-updating timestamp — use for anything time-derived).
`lib/confetti.ts`: `fireConfetti()`.

## Seeded data facts (ids you can rely on)

- Demo identities: buyer `u-buyer-1` (Arvind Mehta, funded wallet ₹8.5 L, EMD locked); seller `u-seller-2` (Tata Steel); field `u-field-1`; exec `u-exec-1`; sub-admin `u-sub-1`; super-admin `u-super-1`. `u-buyer-4` is a defaulter, `u-buyer-3` watchlist, `u-buyer-8` KYC pending.
- Catalogues: `cat-1` AUC-2412 SAIL (LIVE, ends ~40 min, demo buyer has 5 lots shortlisted / 3 EMD-funded — the §9 showcase), `cat-2` AUC-2415 Tata SS (LIVE ~3.5 h), `cat-3` AUC-2418 Railway (LIVE, closing <30 min), `cat-4` AUC-2421 JSW (UPCOMING +1 d), `cat-5` AUC-2424 NTPC coal (UPCOMING +3 d), `cat-6` AUC-2406 MSTC copper (CLOSED, u-buyer-1 WON 2 lots → delivery orders), `cat-7` AUC-2402 BHEL assets (CLOSED).
- Lots `lot-001…lot-092` belong to catalogues; `lot-093…lot-103` (`lotNo` UNL-xx, `catalogueId: null`) are the ops pipeline: statuses `pending_inspection`(3), `inspected`(3), `approved`(3), `flagged`(1), `rejected`(1).
- Reserve rates are hidden from buyers — never render `reserveRate` on buyer-facing pages (admin/seller pages may).
- Delivery orders `do-001` (lifting_scheduled), `do-002` (payment_pending), `do-003` (completed) all for u-buyer-1.

## Voice & content

Indian B2B metal-trade domain language: EMD, H1, STA, as-is-where-is, weighment, lifting, delivery order (DO), GST/TCS, e-way bill, yard, gate pass. Amounts in ₹ (lakh/crore). Always show the "quantity is indicative — final on weighment" idea where quantities appear in buyer flows.
