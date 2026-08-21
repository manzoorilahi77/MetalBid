/* ---------------------------------------------------------------------------
   Roles, as the server understands them.

   This mirrors the frontend's `Role` union and the groupings in store.ts. It is
   deliberately a second copy rather than an import: the frontend's version is a
   convenience for rendering menus, and a menu that hides a tab is not a
   security control. This one decides what the API will do, so it lives here and
   is the one that matters.

   The rule the whole file exists to express: **a role never grants access to a
   record, only to a kind of work.** Whether a particular buyer may read a
   particular wallet is an ownership question, answered in policy.mjs.
--------------------------------------------------------------------------- */

export const ROLES = [
  'guest', 'guest1', 'guest_buyer',
  'buyer', 'seller', 'field_exec',
  'exec_manager', 'auction_manager', 'finance_admin',
  'sub_admin', 'super_admin', 'ceo',
]

/** Roles nobody signs in as. An account can never hold one of these; they are
 *  shells the frontend renders for a visitor with no session. */
export const ANONYMOUS_ROLES = ['guest', 'guest1', 'guest_buyer']

/** Roles held by people who work for ferroBid, as opposed to its customers. */
export const STAFF_ROLES = [
  'field_exec', 'exec_manager', 'auction_manager', 'finance_admin',
  'sub_admin', 'super_admin', 'ceo',
]

/** The two sides of the market. */
export const TRADE_ROLES = ['buyer', 'seller']

/** Roles that may publish a catalogue, decide EMD eligibility, or otherwise act
 *  on the auction floor. Mirrors PUBLISH_ROLES in store.ts. */
export const AUCTION_CONTROL_ROLES = ['auction_manager', 'exec_manager', 'sub_admin', 'super_admin']

/** Roles that administer the platform itself — accounts, content, master data.
 *  Per the roles decision, the Sub Admin is the company's highest role and the
 *  Super Admin is a vendor-held break-glass superset of it. */
export const ADMIN_ROLES = ['sub_admin', 'super_admin']

/** Signing surfaces — the CEO, and whoever holds a live delegation. Delegation
 *  is data, so it is checked in policy.mjs, not here. */
export const CEO_ROLES = ['ceo', 'super_admin']

/** Roles allowed to read another user's operational record (a lot, a dispute, a
 *  payment) as part of their job. */
export const BACK_OFFICE_ROLES = [
  'exec_manager', 'auction_manager', 'finance_admin', 'sub_admin', 'super_admin', 'ceo',
]

export const isAnonymous = (role) => ANONYMOUS_ROLES.includes(role)
export const isStaff = (role) => STAFF_ROLES.includes(role)
export const isAdmin = (role) => ADMIN_ROLES.includes(role)

/** Everything the Sub Admin can do, the Super Admin can do. Expressed once,
 *  here, so no call site has to remember to list both. */
export function roleSatisfies(actual, required) {
  if (actual === required) return true
  if (actual === 'super_admin' && required !== 'ceo') return true
  return false
}

/** True when `role` is in `allowed`, honouring the Super Admin superset. */
export function hasRole(role, allowed) {
  if (!role) return false
  if (allowed.includes(role)) return true
  return role === 'super_admin' && !allowed.includes('ceo')
}
