# Specs

Approved product specifications. **Read these before building or changing any role.**

| File | What it is |
|---|---|
| [`ferrobid-screen-specification.md`](./ferrobid-screen-specification.md) | The working reference — every page each of the nine roles sees, what is inside it, what they can do, who approves it, and what already exists. Markdown so it is greppable and diffable. |
| [`ferrobid-screen-specification.html`](./ferrobid-screen-specification.html) | The original styled artifact, saved verbatim. Open in a browser for the full formatting, colour-coded status tags and the complete Part 11 inventory. |

## How to use it

When asked to build or extend a role, work from this spec:

1. **Part 2** — the role's navigation tree, in the order the work happens. That is the tab strip.
2. **Part 3** — what belongs on that role's dashboard.
3. **Part 4** — the page-by-page detail: contains / actions / cannot do / approval / audit.
4. **Part 6 & 7** — who else can open each page, and who shares or signs off each action.
5. **Part 8** — whether a decision needs a second signature.
6. **Part 13** — which other roles the work hands off to, in both directions.

Two rules apply everywhere and are not negotiable:

- **No left sidebar.** Sticky top bar + contextual tab strip under it.
- **Nothing is public until someone presses Publish.**

## Build status

| Role | State |
|---|---|
| Buyer, Seller, Field Executive | Built |
| Operation Manager | Built (refinements outstanding) |
| Auction Manager | Built |
| **Finance Administrator** | **Built — all 12 pages, `/finance/*`** |
| Sub Admin | Partly built |
| Super Admin | Partly built |
| CEO / MD | Not started |
