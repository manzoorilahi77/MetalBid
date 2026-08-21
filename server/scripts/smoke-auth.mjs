/* ---------------------------------------------------------------------------
   Smoke test: are the holes actually closed?

   Not a unit-test suite — it is the checklist a reviewer would run by hand
   against a live server, automated so it can be run again after every change.
   Every case here corresponds to something that WAS possible before migration
   009 and the guards that came with it.

     node scripts/smoke-auth.mjs [--url http://localhost:4000]

   It signs in as the seeded development accounts, so run `npm run db:seed-auth`
   first. It makes no destructive writes: the one mutation it attempts is
   expected to be refused, and it checks that it was.
--------------------------------------------------------------------------- */
const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1] ?? true] : [])).filter(Boolean))

const BASE = args.url ?? 'http://localhost:4000'
const PASSWORD = process.env.DEV_PASSWORD ?? 'FerroBid@Dev2026'

let passed = 0
let failed = 0

async function check(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed += 1
    console.log(`  ✗ ${name}\n      ${err.message}`)
  }
}

const expect = (condition, message) => { if (!condition) throw new Error(message) }

async function call(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json().catch(() => null) }
}

async function signIn(identifier) {
  const { status, data } = await call('/api/auth/login', {
    method: 'POST', body: { identifier, password: PASSWORD },
  })
  if (status !== 200) throw new Error(`sign-in for ${identifier} failed: ${status} ${data?.message ?? ''}`)
  return data
}

/* -------------------------------- the run -------------------------------- */

console.log(`\nFerroBid security smoke test — ${BASE}\n`)

const health = await call('/api/health')
if (health.status !== 200) {
  console.error(`Server is not answering at ${BASE}. Start it with: npm run dev\n`)
  process.exit(1)
}

const buyer = await signIn('buy@gmail.com')
const seller = await signIn('sell@gmail.com')
const finance = await signIn('finance@gmail.com')
const sub = await signIn('sub@gmail.com')
/* The publish chain needs three distinct people: an author, a second reader,
   and the signatory. super_admin doubles as the second reader here because it
   is the only other admin account seeded. */
const sup = await signIn('super@gmail.com')
const ceo = await signIn('ceo@gmail.com')

console.log('AUTHENTICATION')

await check('a wrong password is refused', async () => {
  const { status } = await call('/api/auth/login', {
    method: 'POST', body: { identifier: 'buy@gmail.com', password: 'not-the-password' },
  })
  expect(status === 401, `expected 401, got ${status}`)
})

await check('an unknown account and a wrong password give the same answer', async () => {
  const a = await call('/api/auth/login', { method: 'POST', body: { identifier: 'buy@gmail.com', password: 'wrong-one-here' } })
  const b = await call('/api/auth/login', { method: 'POST', body: { identifier: 'nobody@nowhere.test', password: 'wrong-one-here' } })
  expect(a.status === b.status, `statuses differ: ${a.status} vs ${b.status}`)
  expect(a.data?.message === b.data?.message, `messages differ:\n      "${a.data?.message}"\n      "${b.data?.message}"`)
})

await check('a tampered token is rejected', async () => {
  const tampered = `${buyer.accessToken.slice(0, -4)}AAAA`
  const { status } = await call('/api/auth/me', { token: tampered })
  expect(status === 401, `expected 401, got ${status}`)
})

await check('"alg: none" is rejected', async () => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    sub: 'u-super-1', role: 'super_admin', tv: 1, iss: 'ferrobid',
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url')
  const { status } = await call('/api/admin', { token: `${header}.${payload}.` })
  expect(status === 401 || status === 403, `expected 401/403, got ${status}`)
})

await check('a refresh token rotates', async () => {
  const rotated = await call('/api/auth/refresh', { method: 'POST', body: { refreshToken: buyer.refreshToken } })
  expect(rotated.status === 200, `rotation failed: ${rotated.status}`)
  expect(rotated.data.refreshToken !== buyer.refreshToken, 'the refresh token did not change')
  buyer.refreshToken = rotated.data.refreshToken
  buyer.accessToken = rotated.data.accessToken
})

/* Replaying a rotated token is the signal that somebody kept a copy. The server
   treats it as theft: it revokes the whole family AND bumps the account's token
   version, which kills the access tokens already in flight too.
   Run on a session of its own — it deliberately destroys the one it uses. */
await check('replaying a rotated token revokes the family and every live token', async () => {
  const victim = await signIn('field@gmail.com')
  const rotated = await call('/api/auth/refresh', { method: 'POST', body: { refreshToken: victim.refreshToken } })
  expect(rotated.status === 200, `rotation failed: ${rotated.status}`)

  const stillGood = await call('/api/auth/me', { token: rotated.data.accessToken })
  expect(stillGood.status === 200, `the rotated access token should work, got ${stillGood.status}`)

  const replay = await call('/api/auth/refresh', { method: 'POST', body: { refreshToken: victim.refreshToken } })
  expect(replay.status === 401, `replaying the old token returned ${replay.status}, expected 401`)

  /* The point of the test: the token issued by the rotation is dead too. */
  const afterTheft = await call('/api/auth/me', { token: rotated.data.accessToken })
  expect(afterTheft.status === 401, `access token survived reuse detection: ${afterTheft.status}`)

  const newRefresh = await call('/api/auth/refresh', { method: 'POST', body: { refreshToken: rotated.data.refreshToken } })
  expect(newRefresh.status === 401, `the rotated refresh token survived: ${newRefresh.status}`)
})

console.log('\nAUTHORIZATION — reads')

await check('an anonymous caller cannot read a buyer workspace', async () => {
  const { status } = await call('/api/buyer/u-buyer-1')
  expect(status === 401, `expected 401, got ${status}`)
})

await check('a buyer cannot read another buyer', async () => {
  const { status } = await call('/api/buyer/u-buyer-2', { token: buyer.accessToken })
  expect(status === 404, `expected 404, got ${status}`)
})

await check('a buyer can read their own workspace', async () => {
  const { status } = await call('/api/buyer/u-buyer-1', { token: buyer.accessToken })
  expect(status === 200, `expected 200, got ${status}`)
})

await check('a buyer cannot open the finance desk', async () => {
  const { status } = await call('/api/finance', { token: buyer.accessToken })
  expect(status === 403, `expected 403, got ${status}`)
})

await check('a buyer cannot open the admin console', async () => {
  const { status } = await call('/api/admin', { token: buyer.accessToken })
  expect(status === 403, `expected 403, got ${status}`)
})

await check('a seller cannot open the auction floor', async () => {
  const { status } = await call('/api/auction', { token: seller.accessToken })
  expect(status === 403, `expected 403, got ${status}`)
})

await check('finance can open the finance desk', async () => {
  const { status } = await call('/api/finance', { token: finance.accessToken })
  expect(status === 200, `expected 200, got ${status}`)
})

await check('the sub admin can open the ops console', async () => {
  const { status } = await call('/api/sub', { token: sub.accessToken })
  expect(status === 200, `expected 200, got ${status}`)
})

await check('the sub admin reads the platform structure too — Financial config, Master data, Page manager', async () => {
  const { status, data } = await call('/api/sub', { token: sub.accessToken })
  expect(status === 200, `expected 200, got ${status}`)
  expect(data.financeConfig && typeof data.financeConfig.emdPct === 'number', 'financeConfig is missing')
  expect(Array.isArray(data.masterCategories) && data.masterCategories.length > 0, 'masterCategories is missing')
  expect(Array.isArray(data.pageRegistry) && data.pageRegistry.length > 0, 'pageRegistry is missing')
  expect(Array.isArray(data.roleRegistry) && data.roleRegistry.length > 0, 'roleRegistry is missing')
})

await check('the sub admin can actually write Master data, not just read it', async () => {
  const { data: before } = await call('/api/sub', { token: sub.accessToken })
  const cat = before.masterCategories[0]
  expect(cat, 'no master category to test against — is db:seed-cms up to date?')
  const { status, data } = await call('/api/mutate', {
    token: sub.accessToken, method: 'POST',
    body: { ops: [{ entity: 'masterCategories', op: 'upsert',
      row: { key: cat.key, label: cat.label, hue: cat.hue } }] },
  })
  expect(status === 200, `expected 200, got ${status} — ${JSON.stringify(data)}`)
})

await check('the sub admin still cannot open the super admin console — Roles, Sub Admins, Emergency override and Audit stay ours', async () => {
  const { status } = await call('/api/admin', { token: sub.accessToken })
  expect(status === 403, `expected 403, got ${status} — the break-glass boundary moved`)
})

await check('the public marketplace stays public', async () => {
  const { status, data } = await call('/api/home')
  expect(status === 200, `expected 200, got ${status}`)
  expect(Array.isArray(data?.catalogues), 'no catalogues in the response')
})

await check('the public marketplace never carries a reserve price', async () => {
  const { data } = await call('/api/home')
  const withReserve = (data?.lots ?? []).filter((l) => l.reserveRate !== undefined)
  expect(withReserve.length === 0, `${withReserve.length} lots exposed reserveRate`)
})

console.log('\nAUTHORIZATION — writes')

await check('an anonymous caller cannot write', async () => {
  const { status } = await call('/api/mutate', {
    method: 'POST', body: { ops: [{ entity: 'lots', row: { id: 'lot-1', status: 'sold' } }] },
  })
  expect(status === 401, `expected 401, got ${status}`)
})

await check('a buyer cannot write a catalogue', async () => {
  const { status, data } = await call('/api/mutate', {
    token: buyer.accessToken,
    method: 'POST',
    body: { ops: [{ entity: 'catalogues', row: { id: 'cat-1', status: 'closed' } }] },
  })
  expect(status === 403, `expected 403, got ${status} ${data?.message ?? ''}`)
})

await check('a buyer cannot give themselves a role', async () => {
  const { status } = await call('/api/mutate', {
    token: buyer.accessToken,
    method: 'POST',
    body: { ops: [{ entity: 'users', row: { id: 'u-buyer-1', role: 'super_admin' } }] },
  })
  expect(status === 403, `expected 403, got ${status}`)
})

await check('a buyer cannot credit their own wallet', async () => {
  const { status } = await call('/api/wallet/credit', {
    token: buyer.accessToken, method: 'POST', body: { userId: 'u-buyer-1', amount: 1000000 },
  })
  expect(status === 403, `expected 403, got ${status}`)
})

await check('a buyer cannot register a bank account for somebody else', async () => {
  const { status, data } = await call('/api/mutate', {
    token: buyer.accessToken,
    method: 'POST',
    body: { ops: [{ entity: 'bankAccounts', row: { id: 'ba-smoke-test', userId: 'u-buyer-2', bankName: 'Test' } }] },
  })
  expect(status === 403, `expected 403, got ${status} ${data?.message ?? ''}`)
})

await check('the audit trail cannot be edited', async () => {
  const { status } = await call('/api/mutate', {
    token: buyer.accessToken,
    method: 'POST',
    body: { ops: [{ entity: 'auditEvents', op: 'delete', row: { id: 'aud-1' } }] },
  })
  expect(status === 403, `expected 403, got ${status}`)
})

console.log('\nCMS')

await check('published content is readable without an account', async () => {
  const { status } = await call('/api/cms/page?route=/')
  expect(status === 200, `expected 200, got ${status}`)
})

await check('a buyer cannot edit site content', async () => {
  const { status } = await call('/api/cms/blocks', {
    token: buyer.accessToken,
    method: 'POST',
    body: { pageKey: 'home', sectionKey: 'hero', blockKey: 'headline', kind: 'text', value: 'Owned' },
  })
  expect(status === 403, `expected 403, got ${status}`)
})

await check('the sub admin can edit site content', async () => {
  const { status, data } = await call('/api/cms/blocks', {
    token: sub.accessToken,
    method: 'POST',
    body: {
      pageKey: 'home', sectionKey: 'hero', blockKey: 'smoke_test', kind: 'text',
      value: 'Industrial metal, sold the fair way.',
    },
  })
  expect(status === 200, `expected 200, got ${status} ${data?.message ?? ''}`)
})

await check('a figure typed into copy is refused', async () => {
  const { status, data } = await call('/api/cms/blocks', {
    token: sub.accessToken,
    method: 'POST',
    body: {
      pageKey: 'home', sectionKey: 'trust', blockKey: 'smoke_test_figure', kind: 'text',
      value: 'Over 12,400 lots sold on ferroBid',
    },
  })
  expect(status === 400, `expected 400, got ${status}`)
  expect(/figure/i.test(data?.message ?? ''), `unexpected message: ${data?.message}`)
})

console.log('\nCMS - publishing reaches the public page')

/* This section exists because publishing was silently broken: draft_value is
   written with JSON.stringify, but mysql2 PARSES json columns on the way out,
   so re-inserting it into cms_block_versions.value handed MySQL a bare string
   and every publish of a text block died on ER_INVALID_JSON_TEXT. Nobody
   noticed, because the public pages did not read the CMS at all — they do now. */

await check('an editor can draft a block, and a second one can publish it', async () => {
  const draft = await call('/api/cms/blocks', {
    token: sub.accessToken, method: 'POST',
    body: {
      pageKey: 'about', sectionKey: 'leadership', blockKey: 'smoke_publish', kind: 'text',
      value: 'Eight roles. One chain of authority.',
    },
  })
  expect(draft.status === 200, `draft: expected 200, got ${draft.status} ${draft.data?.message ?? ''}`)
  expect(!!draft.data?.id, 'draft returned no id')

  const pub = await call(`/api/cms/blocks/${draft.data.id}/publish`, {
    token: sup.accessToken, method: 'POST', body: {},
  })
  expect(pub.status === 200, `publish: expected 200, got ${pub.status} ${pub.data?.message ?? ''}`)
  expect(pub.data?.status === 'published', `expected published, got ${pub.data?.status}`)
})

await check('the published words are on the public page, with no account', async () => {
  const { status, data } = await call('/api/cms/page?route=%2Fabout')
  expect(status === 200, `expected 200, got ${status}`)
  const section = (data?.sections ?? []).find((x) => x.key === 'leadership')
  expect(section?.content?.smoke_publish === 'Eight roles. One chain of authority.',
    `public page did not serve the published value: ${JSON.stringify(section?.content)}`)
})

await check('a page that commits the company waits for the CEO', async () => {
  /* Authored by super_admin so the sub admin is a legitimate second reader —
     and the sub admin is not in CEO_ROLES, so this must queue, not go live. */
  const draft = await call('/api/cms/blocks', {
    token: sup.accessToken, method: 'POST',
    body: {
      pageKey: 'pricing', sectionKey: 'intro', blockKey: 'smoke_signoff', kind: 'text',
      value: 'Every yard in Karnataka.',
    },
  })
  expect(draft.status === 200, `draft: expected 200, got ${draft.status}`)

  const pub = await call(`/api/cms/blocks/${draft.data.id}/publish`, {
    token: sub.accessToken, method: 'POST', body: {},
  })
  expect(pub.data?.status === 'ceo_pending', `expected ceo_pending, got ${pub.data?.status}`)

  const before = await call('/api/cms/page?route=%2Fpricing')
  const intro = (before.data?.sections ?? []).find((x) => x.key === 'intro')
  expect(intro?.content?.smoke_signoff === undefined,
    'unsigned pricing copy was public before the CEO signed it')

  const signed = await call(`/api/cms/blocks/${draft.data.id}/sign`, {
    token: ceo.accessToken, method: 'POST', body: { approve: true },
  })
  expect(signed.status === 200, `sign: expected 200, got ${signed.status} ${signed.data?.message ?? ''}`)

  const after = await call('/api/cms/page?route=%2Fpricing')
  const intro2 = (after.data?.sections ?? []).find((x) => x.key === 'intro')
  expect(intro2?.content?.smoke_signoff === 'Every yard in Karnataka.',
    'signed pricing copy never reached the public page')
})

await check('the author of a reviewed section cannot publish it alone', async () => {
  const draft = await call('/api/cms/blocks', {
    token: sub.accessToken, method: 'POST',
    body: {
      pageKey: 'pricing', sectionKey: 'intro', blockKey: 'smoke_foureyes', kind: 'text',
      value: 'One plan. One year.',
    },
  })
  expect(draft.status === 200, `draft: expected 200, got ${draft.status}`)
  const pub = await call(`/api/cms/blocks/${draft.data.id}/publish`, {
    token: sub.accessToken, method: 'POST', body: {},
  })
  expect(pub.status === 403, `expected 403, got ${pub.status}`)
})

console.log('\nCMS - the section registry')

await check('the inventory is seeded', async () => {
  const { data } = await call('/api/cms/sections', { token: sub.accessToken })
  expect(Array.isArray(data) && data.length > 200,
    `expected the full inventory, got ${Array.isArray(data) ? data.length : 'nothing'} - run npm run db:seed-cms`)
})

await check('an editor sees every role’s sections; a buyer sees only their own', async () => {
  const editor = await call('/api/cms/sections', { token: sub.accessToken })
  const buyerView = await call('/api/cms/sections?route=/buyer', { token: buyer.accessToken })
  const editorBuyer = await call('/api/cms/sections?route=/buyer', { token: sub.accessToken })
  expect(editor.data.length > editorBuyer.data.length, 'the unfiltered editor view is not wider')
  expect(buyerView.data.every((s) => s.role === '*' || s.role === 'buyer'),
    'a buyer was shown a section scoped to another role')
})

await check('a locked section refuses with its reason', async () => {
  const { status, data } = await call('/api/cms/sections/enabled', {
    token: sub.accessToken, method: 'PATCH',
    body: { route: '/', sectionKey: 'footer', enabled: false },
  })
  expect(status === 403, `expected 403, got ${status}`)
  expect(/statutory/i.test(data?.message ?? ''), `the reason was not returned: ${data?.message}`)
})

await check('a toggle round-trips and the public page follows it', async () => {
  const before = await call('/api/cms/page?route=/')
  expect(before.data.sections.some((s) => s.key === 'testimonials'),
    'testimonials was not on the page to begin with')

  const off = await call('/api/cms/sections/enabled', {
    token: sub.accessToken, method: 'PATCH',
    body: { route: '/', sectionKey: 'testimonials', enabled: false, reason: 'smoke test' },
  })
  expect(off.status === 200, `switching off returned ${off.status}`)

  const during = await call('/api/cms/page?route=/')
  expect(!during.data.sections.some((s) => s.key === 'testimonials'),
    'the section was still served after being switched off')

  const on = await call('/api/cms/sections/enabled', {
    token: sub.accessToken, method: 'PATCH',
    body: { route: '/', sectionKey: 'testimonials', enabled: true },
  })
  expect(on.status === 200, `switching back on returned ${on.status}`)

  const after = await call('/api/cms/page?route=/')
  expect(after.data.sections.some((s) => s.key === 'testimonials'), 'the section did not come back')
})

await check('the seeded home copy is published, not draft', async () => {
  const { data } = await call('/api/cms/page?route=/')
  const hero = data.sections.find((s) => s.key === 'hero')
  expect(hero, 'the hero section is missing')
  expect(typeof hero.content?.headline_lead === 'string' && hero.content.headline_lead.length > 0,
    'the hero headline is not published - the page would fall back to the bundle')
})

console.log('\nTESTIMONIALS')

const testimonialId = `smoke-tst-${Date.now()}`

await check('a buyer can submit a testimonial, pending by default', async () => {
  const { status, data } = await call('/api/mutate', {
    token: buyer.accessToken, method: 'POST',
    body: { ops: [{ entity: 'testimonials', op: 'upsert', row: {
      id: testimonialId, role: 'buyer',
      quote: 'Smoke test: transparent bidding and the field inspection made all the difference.',
      submittedAt: new Date().toISOString(),
    } }] },
  })
  expect(status === 200, `expected 200, got ${status} — ${JSON.stringify(data)}`)

  const { data: sub_ } = await call('/api/sub', { token: sub.accessToken })
  const mine = sub_.testimonials.find((t) => t.id === testimonialId)
  expect(mine, 'the submitted testimonial is not in the Sub Admin feed')
  expect(mine.status === 'pending', `expected pending, got ${mine.status}`)
})

await check('a buyer cannot publish their own testimonial', async () => {
  await call('/api/mutate', {
    token: buyer.accessToken, method: 'POST',
    body: { ops: [{ entity: 'testimonials', op: 'upsert', row: { id: testimonialId, status: 'approved' } }] },
  })
  const { data } = await call('/api/sub', { token: sub.accessToken })
  const still = data.testimonials.find((t) => t.id === testimonialId)
  expect(still.status === 'pending', `a buyer's write moved status to ${still.status}`)
})

await check('a pending testimonial is not on the public home page', async () => {
  const { data } = await call('/api/home')
  expect(!(data.testimonials ?? []).some((t) => t.id === testimonialId),
    'a pending testimonial was served publicly')
})

await check('the sub admin approves it, and it reaches the public page', async () => {
  const { status } = await call('/api/mutate', {
    token: sub.accessToken, method: 'POST',
    body: { ops: [{ entity: 'testimonials', op: 'upsert',
      row: { id: testimonialId, status: 'approved', moderatedAt: new Date().toISOString() } }] },
  })
  expect(status === 200, `expected 200, got ${status}`)
  const { data } = await call('/api/home')
  expect((data.testimonials ?? []).some((t) => t.id === testimonialId),
    'the approved testimonial did not reach /api/home')
})

console.log('\nIMPERSONATION - log in as another account')

await check('an admin can sign in as a buyer with no password', async () => {
  const imp = await call('/api/auth/impersonate', { token: sub.accessToken, method: 'POST', body: { userId: buyer.user.id } })
  expect(imp.status === 200, `expected 200, got ${imp.status} ${imp.data?.message ?? ''}`)
  expect(imp.data?.user?.id === buyer.user.id, 'the token issued was not for the target user')

  const me = await call('/api/auth/me', { token: imp.data.accessToken })
  expect(me.data?.user?.id === buyer.user.id, 'the impersonated token does not authenticate as the target')

  const ws = await call(`/api/buyer/${buyer.user.id}`, { token: imp.data.accessToken })
  expect(ws.status === 200, `impersonated token could not read the target's own workspace: ${ws.status}`)
})

await check('the CEO, another admin, and self cannot be impersonated', async () => {
  const asCeo = await call('/api/auth/impersonate', { token: sub.accessToken, method: 'POST', body: { userId: ceo.user.id } })
  expect(asCeo.status === 403, `expected 403 for CEO target, got ${asCeo.status}`)

  const asSelf = await call('/api/auth/impersonate', { token: sub.accessToken, method: 'POST', body: { userId: sub.user.id } })
  expect(asSelf.status === 400, `expected 400 for self target, got ${asSelf.status}`)
})

await check('a non-admin cannot impersonate anyone', async () => {
  const { status } = await call('/api/auth/impersonate', { token: buyer.accessToken, method: 'POST', body: { userId: finance.user.id } })
  expect(status === 403, `expected 403, got ${status}`)
})

await check('an admin-issued password reset actually works to sign in', async () => {
  const issued = await call('/api/auth/reset', { token: sub.accessToken, method: 'POST', body: { userId: buyer.user.id } })
  expect(issued.status === 200 && !!issued.data?.temporaryPassword,
    `expected a temporary password, got ${issued.status} ${JSON.stringify(issued.data)}`)

  const relogin = await call('/api/auth/login', {
    method: 'POST', body: { identifier: 'buy@gmail.com', password: issued.data.temporaryPassword },
  })
  expect(relogin.status === 200, `the issued password did not sign in: ${relogin.status}`)

  // restore the demo password so every other check in this run keeps working
  await call('/api/auth/reset', {
    token: sub.accessToken, method: 'POST', body: { userId: buyer.user.id, password: 'FerroBid@Dev2026' },
  })
})

console.log('\nRATE LIMITING')

await check('repeated bad sign-ins are throttled', async () => {
  /* The IP threshold is intentionally loosened outside production — see
     ACCOUNT_MAX_FAILURES/IP_MAX_FAILURES in auth.mjs — so repeated testing
     does not eat a 15-minute lockout. 520 covers the loosened dev/test value
     (500) with margin; a production target (20) trips well before that, via
     the early exit below. */
  let throttled = false
  for (let i = 0; i < 520; i += 1) {
    const { status } = await call('/api/auth/login', {
      method: 'POST', body: { identifier: `probe-${i}@nowhere.test`, password: 'wrong-one-here' },
    })
    if (status === 429) { throttled = true; break }
  }
  expect(throttled, 'no 429 after 520 failed attempts')
})

/* -------------------------------- result --------------------------------- */

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
