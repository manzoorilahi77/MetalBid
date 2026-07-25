/* ---------------------------------------------------------------------------
   Demo login credentials for the ferroBid role portals.

   These are the user IDs + password entered on the manager Login page (/login).
   Password validation is currently OFF (any password signs in) — the user ID
   alone selects which role portal opens. The live sign-in source of truth is
   DEMO_LOGINS / DEMO_PASSWORD / ENFORCE_LOGIN_PASSWORD in src/store/store.ts;
   this file mirrors them as an at-a-glance reference for the six roles.
--------------------------------------------------------------------------- */

/** Shared password for every demo account. */
export const PASSWORD = 'Admin@123';

/** One entry per role: the user ID to type, the password, and the portal it opens. */
export const ROLE_CREDENTIALS = [
  { role: 'Buyer',userId: 'buy@gmail.com',password: 'Admin@123' },
  { role: 'Seller',userId: 'sell@gmail.com',password: 'Admin@123' },
  { role: 'Field Executive',userId: 'field@gmail.com',password: 'Admin@123' },
  { role: 'Executive Manager',userId: 'executive@gmail.com', password: 'Admin@123' },
  { role: 'Sub-Admin',userId: 'sub@gmail.com',password: 'Admin@123' },
  { role: 'Super Admin',userId: 'super@gmail.com',password: 'Admin@123' },
];

export default ROLE_CREDENTIALS;
