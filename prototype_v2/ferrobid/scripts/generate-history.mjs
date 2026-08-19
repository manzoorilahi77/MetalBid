/* ---------------------------------------------------------------------------
   ferroBid — 12 months of trading history.

   Run: npm run mock:history   → rewrites src/data/mock/*.json in place

   WHY THIS IS A SEPARATE SCRIPT
   `generate-mock.mjs` builds the *demo scenario* — the handful of catalogues,
   lots and wallet states every showcase flow rides on (cat-1 §9 showcase,
   buyer-1's shortlist, the ops pipeline). Parts of the committed mock data
   were hand-authored after that script was last run, so re-running it would
   throw them away. This script never regenerates any of that: it READS the
   mock files, strips whatever it wrote last time, and APPENDS a year of
   history behind them. Everything it writes is prefixed `h` (`hcat-`, `hlot-`,
   `hbid-`, `u-hbuyer-`…), which is also how the purge finds it — so the script
   is idempotent and can be re-run at any time.

   WHAT IT MODELS
   A platform that went live 12 months before the anchor instant and grew:
   3 auctions in the first month rising to ~14 a month by the end, buyers
   signing up throughout, sellers onboarding one or two a month, and the whole
   post-auction chain behind each sale — inspection report, bid ladder,
   delivery order, payment, weighment, lifting. Everything is anchored to
   ANCHOR exactly the way the demo seed is, so the app's rebasing loader keeps
   all of it correctly in the past on every reload.
--------------------------------------------------------------------------- */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'mock')
const read = (n) => JSON.parse(readFileSync(join(OUT, n), 'utf8'))
const write = (n, d) => writeFileSync(join(OUT, n), JSON.stringify(d, null, 2) + '\n')

const MIN = 60_000
const DAY = 1440 // minutes
const ANCHOR = Date.parse(read('anchor.json').anchor)
const iso = (minFromAnchor) => new Date(ANCHOR + minFromAnchor * MIN).toISOString()

/* Seeded RNG — a different stream from generate-mock.mjs, but just as stable:
   the same history comes out of every run, so a diff only ever shows what the
   script itself changed. */
let _s = 20260819
const rnd = () => ((_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const between = (a, b) => a + rnd() * (b - a)
const int = (a, b) => Math.floor(between(a, b + 1))
const round = (n, step) => Math.round(n / step) * step
const shuffled = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const t = a[i]; a[i] = a[j]; a[j] = t
  }
  return a
}
const pad = (n, w) => String(n).padStart(w, '0')

/* ------------------------------- load + purge ---------------------------- */
const HIST = (id) => typeof id === 'string' && id.startsWith('h')
const HIST_USER = (id) => typeof id === 'string' && id.startsWith('u-h')

const users = read('users.json').filter((u) => !HIST_USER(u.id))
const catalogues = read('catalogues.json').filter((c) => !HIST(c.id))
const lots = read('lots.json').filter((l) => !HIST(l.id))
const bids = read('bids.json').filter((b) => !HIST(b.id))
const inspectionReports = read('inspectionReports.json').filter((r) => !HIST(r.id))
const deliveryOrders = read('deliveryOrders.json').filter((d) => !HIST(d.id))
const disputes = read('disputes.json').filter((d) => !HIST(d.id))
const auditEvents = read('auditEvents.json').filter((a) => !HIST(a.id))
const announcements = read('announcements.json').filter((a) => !HIST(a.id))
const notifications = read('notifications.json').filter((n) => !HIST(n.id))
const inspectionSlots = read('inspectionSlots.json').filter((s) => !HIST(s.id))
const selections = read('selections.json').filter((s) => !HIST_USER(s.buyerId))
const watchlist = read('watchlist.json').filter((w) => !HIST_USER(w.buyerId))
/* wallets: drop history buyers entirely, and strip history ledger rows out of
   the hand-authored wallets so a re-run never double-posts into them. */
const wallets = read('wallets.json')
  .filter((w) => !HIST_USER(w.userId))
  .map((w) => ({ ...w, ledger: w.ledger.filter((e) => !HIST(e.id)) }))

/* ------------------------- permanent account codes ------------------------
   Same charset and shape as src/lib/format.ts, seeded from the codes existing
   accounts already hold so a new account can never collide with one. */
const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const usedBidderIds = new Set(users.map((u) => u.bidderId).filter(Boolean))
const usedSellerIds = new Set(users.map((u) => u.sellerId).filter(Boolean))
const randomCode = (prefix, used) => {
  let code
  do {
    code = prefix + Array.from({ length: 4 }, () => ID_CHARS[Math.floor(rnd() * ID_CHARS.length)]).join('')
  } while (used.has(code))
  used.add(code)
  return code
}

/* --------------------------------- people -------------------------------- */
const FIRST = [
  'Rajesh', 'Suresh', 'Anil', 'Vikram', 'Mahesh', 'Prakash', 'Nitin', 'Rohit', 'Sanjay', 'Ashok',
  'Yogesh', 'Dinesh', 'Manoj', 'Pramod', 'Vinod', 'Amit', 'Sunil', 'Rakesh', 'Jitendra', 'Naveen',
  'Lakshmi', 'Anita', 'Shalini', 'Meenakshi', 'Rekha', 'Pooja', 'Sneha', 'Vandana', 'Bhavna', 'Aarti',
  'Faisal', 'Zubair', 'Salim', 'Nasir', 'Iqbal', 'Gurpreet', 'Jaswinder', 'Balbir', 'Tejinder', 'Manpreet',
  'Venkatesh', 'Srinivas', 'Murugan', 'Karthik', 'Selvam', 'Ashwin', 'Bhaskar', 'Chandran', 'Devraj', 'Elangovan',
]
const LAST = [
  'Sharma', 'Verma', 'Gupta', 'Agarwal', 'Jain', 'Mehta', 'Shah', 'Patel', 'Desai', 'Joshi',
  'Kulkarni', 'Deshmukh', 'Patil', 'Chavan', 'Naik', 'Reddy', 'Rao', 'Naidu', 'Chowdary', 'Prasad',
  'Iyer', 'Iyengar', 'Subramanian', 'Krishnan', 'Pillai', 'Menon', 'Nair', 'Kurup', 'Warrier', 'Panicker',
  'Singh', 'Gill', 'Dhillon', 'Sandhu', 'Bedi', 'Sheikh', 'Ansari', 'Qureshi', 'Khan', 'Sayyed',
  'Banerjee', 'Chatterjee', 'Mukherjee', 'Ghosh', 'Das', 'Mohanty', 'Sahu', 'Behera', 'Mishra', 'Panda',
]
const FIRM_A = [
  'Shree', 'Om', 'Bharat', 'Anand', 'Krishna', 'Deccan', 'Vindhya', 'Sagar', 'Ganga', 'Arihant',
  'Balaji', 'Maruti', 'Nakoda', 'Jai', 'Vardhman', 'Sundaram', 'Kaveri', 'Narmada', 'Konark', 'Ambika',
  'Rathi', 'Goyal', 'Bansal', 'Poddar', 'Kothari', 'Sanghvi', 'Modi', 'Lodha', 'Thakkar', 'Chordia',
]
const FIRM_B = [
  'Metals', 'Alloys', 'Steel Traders', 'Ispat', 'Metal Corp', 'Scrap Traders', 'Recycling', 'Enterprises',
  'Industries', 'Metal Works', 'Steels', 'Trading Co', 'Metallics', 'Ferro Works', 'Casting Works', 'Smelters',
]
const CITIES = [
  ['Mumbai', 'MH', '27'], ['Pune', 'MH', '27'], ['Nagpur', 'MH', '27'], ['Bhiwandi', 'MH', '27'],
  ['Ahmedabad', 'GJ', '24'], ['Rajkot', 'GJ', '24'], ['Jamnagar', 'GJ', '24'], ['Surat', 'GJ', '24'],
  ['New Delhi', 'DL', '07'], ['Ghaziabad', 'UP', '09'], ['Kanpur', 'UP', '09'], ['Agra', 'UP', '09'],
  ['Ludhiana', 'PB', '03'], ['Mandi Gobindgarh', 'PB', '03'], ['Jalandhar', 'PB', '03'],
  ['Chennai', 'TN', '33'], ['Coimbatore', 'TN', '33'], ['Tiruchirappalli', 'TN', '33'],
  ['Bengaluru', 'KA', '29'], ['Hubli', 'KA', '29'], ['Mangaluru', 'KA', '29'],
  ['Hyderabad', 'TS', '36'], ['Visakhapatnam', 'AP', '37'], ['Vijayawada', 'AP', '37'],
  ['Kolkata', 'WB', '19'], ['Howrah', 'WB', '19'], ['Durgapur', 'WB', '19'],
  ['Jamshedpur', 'JH', '20'], ['Ranchi', 'JH', '20'], ['Raipur', 'CG', '22'], ['Bhilai', 'CG', '22'],
  ['Bhubaneswar', 'OD', '21'], ['Rourkela', 'OD', '21'], ['Indore', 'MP', '23'], ['Bhopal', 'MP', '23'],
  ['Jaipur', 'RJ', '08'], ['Jodhpur', 'RJ', '08'], ['Alwar', 'RJ', '08'], ['Kochi', 'KL', '32'],
  ['Guwahati', 'AS', '18'],
]

const letters = (s, n) => {
  const up = s.toUpperCase().replace(/[^A-Z]/g, '')
  return (up + 'ABCDEFGH').slice(0, n)
}
const gstinFor = (stateCode, firm, i) =>
  `${stateCode}${letters(firm, 5)}${pad(1000 + (i * 137) % 9000, 4)}${ID_CHARS[i % 24]}1Z${i % 10}`
const phone = () => `+91 ${int(70, 99)}${int(100, 999)} ${int(10000, 99999)}`
const emailOf = (name, firm) =>
  `${name.split(' ')[0].toLowerCase()}@${firm.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14)}.in`

/* Signups ramp the way a marketplace's do: a trickle at launch, accelerating
   once the first catalogues have visibly cleared. Index 0 = 12 months ago. */
const BUYER_SIGNUPS = [2, 3, 3, 4, 5, 5, 6, 7, 7, 8, 9, 9]
const SELLER_SIGNUPS = [2, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1]

const newBuyers = []
const newSellers = []
let personSeq = 0
const usedFirms = new Set(users.map((u) => u.firm))

const makeFirm = () => {
  for (let attempt = 0; attempt < 400; attempt++) {
    const f = `${pick(FIRM_A)} ${pick(FIRM_B)}`
    if (!usedFirms.has(f)) { usedFirms.add(f); return f }
  }
  return `${pick(FIRM_A)} ${pick(FIRM_B)} (${personSeq})`
}

for (let m = 0; m < 12; m++) {
  const monthStart = -(12 - m) * 30 * DAY
  for (let k = 0; k < BUYER_SIGNUPS[m]; k++) {
    personSeq++
    const city = pick(CITIES)
    const name = `${pick(FIRST)} ${pick(LAST)}`
    const firm = makeFirm()
    /* A live marketplace is never all-clean: a few accounts sit in KYC, one in
       ten ends up on the watchlist, and a couple default outright. */
    const kycRoll = rnd()
    const kycStatus = kycRoll > 0.94 ? 'pending' : kycRoll > 0.92 ? 'rejected' : 'verified'
    const standRoll = rnd()
    const standing = standRoll > 0.965 ? 'defaulter' : standRoll > 0.9 ? 'watchlist' : 'good'
    newBuyers.push({
      id: `u-hbuyer-${pad(personSeq, 3)}`,
      name, firm, phone: phone(), email: emailOf(name, firm), role: 'buyer',
      kycStatus, sellerVerified: false, standing, city: city[0], gstin: gstinFor(city[2], firm, personSeq),
      avatarHue: int(0, 359), joinedAt: iso(monthStart + int(0, 29) * DAY + int(540, 1080)),
      ...(standing === 'defaulter'
        ? { blacklistReason: 'EMD forfeited — material not lifted within the delivery-order validity' }
        : {}),
      bidderId: randomCode('B', usedBidderIds), sellerId: null,
    })
  }
}

/* Sellers are institutions, not individuals — each arrives with the yard its
   catalogues then sell out of, and a named contact for inspection and lifting. */
const SELLER_FIRMS = [
  ['RINL — Visakhapatnam Steel Plant', 'Visakhapatnam', '37', 'VSP Scrap Yard 2', 'Gate 3, RINL Visakhapatnam Steel Plant, Visakhapatnam, Andhra Pradesh 530031', 'Visakhapatnam, AP', 'msScrap'],
  ['Hindalco — Renukoot Works', 'Renukoot', '09', 'Renukoot Smelter Yard', 'Hindalco Industries, Renukoot, Sonbhadra, Uttar Pradesh 231217', 'Renukoot, UP', 'nonFerrous'],
  ['NALCO — Angul Smelter', 'Angul', '21', 'Angul Disposal Yard', 'NALCO Smelter Plant, Angul, Odisha 759145', 'Angul, OD', 'nonFerrous'],
  ['Northern Railway — Jagadhri Workshop', 'Yamunanagar', '06', 'Jagadhri Workshop Yard', 'Carriage Workshop, Jagadhri, Yamunanagar, Haryana 135002', 'Yamunanagar, HR', 'railway'],
  ['Mahindra & Mahindra — Nashik Plant', 'Nashik', '27', 'Nashik Plant Scrap Bay', 'Mahindra Nashik Plant, Satpur MIDC, Nashik, Maharashtra 422007', 'Nashik, MH', 'ssOffcuts'],
  ['Ashok Leyland — Hosur Unit II', 'Hosur', '33', 'Hosur Unit II Yard', 'Ashok Leyland Hosur Unit II, Hosur, Tamil Nadu 635109', 'Hosur, TN', 'ssOffcuts'],
  ['Vedanta — Jharsuguda Aluminium', 'Jharsuguda', '21', 'Jharsuguda Pot-line Yard', 'Vedanta Aluminium, Bhurkhamunda, Jharsuguda, Odisha 768202', 'Jharsuguda, OD', 'nonFerrous'],
  ['WCL — Nagpur Area Stores', 'Nagpur', '27', 'WCL Central Stores Yard', 'Western Coalfields Ltd, Civil Lines, Nagpur, Maharashtra 440001', 'Nagpur, MH', 'coal'],
  ['ONGC — Hazira Plant', 'Surat', '24', 'Hazira Disposal Yard', 'ONGC Hazira Gas Processing Complex, Surat, Gujarat 394518', 'Hazira, GJ', 'assets'],
  ['Ordnance Factory — Medak', 'Sangareddy', '36', 'OFMK Salvage Yard', 'Ordnance Factory Medak, Yeddumailaram, Sangareddy, Telangana 502205', 'Medak, TS', 'assets'],
  ['South Central Railway — Lallaguda Workshop', 'Secunderabad', '36', 'Lallaguda Workshop Yard', 'Carriage Repair Workshop, Lallaguda, Secunderabad, Telangana 500017', 'Secunderabad, TS', 'railway'],
  ['NMDC — Bacheli Complex', 'Dantewada', '22', 'Bacheli Stores Yard', 'NMDC Bacheli Complex, Dantewada, Chhattisgarh 494553', 'Bacheli, CG', 'copperBrass'],
  ['IOCL — Panipat Refinery', 'Panipat', '06', 'Panipat Refinery Scrap Yard', 'IOCL Panipat Refinery & Petrochemical Complex, Panipat, Haryana 132140', 'Panipat, HR', 'coal'],
  ['Jindal Stainless — Hisar Works', 'Hisar', '06', 'Hisar Works Yard 4', 'Jindal Stainless Ltd, Hisar, Haryana 125005', 'Hisar, HR', 'ssOffcuts'],
  ['Bharat Forge — Mundhwa Works', 'Pune', '27', 'Mundhwa Forge Yard', 'Bharat Forge Ltd, Mundhwa, Pune, Maharashtra 411036', 'Pune, MH', 'msScrap'],
]
const CONTACT_ROLES = [
  'Yard In-charge (Inspection & Lifting)', 'Manager, Commercial (Disposals)',
  'Sr. Engineer (Salvage & Disposals)', 'Dy. Manager, By-products', 'Stores Superintendent',
]
let sellerSeq = 0
for (let m = 0; m < 12; m++) {
  const monthStart = -(12 - m) * 30 * DAY
  for (let k = 0; k < SELLER_SIGNUPS[m] && sellerSeq < SELLER_FIRMS.length; k++) {
    const [firm, city, stateCode, yardName, yardAddress, region, pool] = SELLER_FIRMS[sellerSeq]
    sellerSeq++
    const name = `${pick(FIRST)} ${pick(LAST)}`
    newSellers.push({
      id: `u-hseller-${pad(sellerSeq, 2)}`,
      name, firm, phone: phone(),
      email: `${name.split(' ')[0].toLowerCase()}.${name.split(' ')[1].toLowerCase()}@${letters(firm, 4).toLowerCase()}.in`,
      role: 'seller', kycStatus: 'verified', sellerVerified: true, standing: 'good', city,
      gstin: gstinFor(stateCode, firm, 40 + sellerSeq), avatarHue: int(0, 359),
      joinedAt: iso(monthStart + int(0, 20) * DAY + int(540, 900)),
      bidderId: null, sellerId: randomCode('S', usedSellerIds),
      _yard: { name: yardName, addr: yardAddress, region },
      _pool: pool,
      _contact: { name: `${pick(FIRST)} ${pick(LAST)}`, phone: phone(), role: pick(CONTACT_ROLES) },
    })
  }
}

/* Ops staff hired as the volume grew — the roster the workload justifies. */
const newStaff = [
  ['u-hfield-01', 'Prakash Bora', 'field_exec', 'Visakhapatnam', -330],
  ['u-hfield-02', 'Neelam Sethi', 'field_exec', 'Bhubaneswar', -250],
  ['u-hfield-03', 'Mohd Arif', 'field_exec', 'Kanpur', -170],
  ['u-hfield-04', 'Divya Menon', 'field_exec', 'Coimbatore', -110],
  ['u-hauc-01', 'Rohan Deshpande', 'auction_manager', 'Pune', -240],
  ['u-hsub-01', 'Faiza Ahmed', 'sub_admin', 'Lucknow', -300],
  ['u-hsub-02', 'Vikas Thakur', 'sub_admin', 'Indore', -140],
].map(([id, name, role, city, joinedDays]) => ({
  id, name, firm: role === 'field_exec' ? 'ferroBid Field Ops' : 'ferroBid Operations',
  phone: phone(), email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@ferrobid.in`, role,
  kycStatus: 'verified', sellerVerified: false, standing: 'good', city, gstin: '—',
  avatarHue: int(0, 359), joinedAt: iso(joinedDays * DAY), bidderId: null, sellerId: null,
}))

const allBuyers = [...users.filter((u) => u.role === 'buyer'), ...newBuyers]
const allSellers = [...users.filter((u) => u.role === 'seller'), ...newSellers]
const fieldExecs = [...users.filter((u) => u.role === 'field_exec'), ...newStaff.filter((s) => s.role === 'field_exec')]
const subAdmins = [...users.filter((u) => u.role === 'sub_admin'), ...newStaff.filter((s) => s.role === 'sub_admin')]
const auctionManagers = [...users.filter((u) => u.role === 'auction_manager'), ...newStaff.filter((s) => s.role === 'auction_manager')]

/* ---------------------------- lot templates ------------------------------
   Same pools generate-mock.mjs sells from, so a year of history reads in the
   same domain voice as the demo scenario sitting in front of it.
   [metal, category, grade, uom, rateLow, rateHigh, qtyLow, qtyHigh, desc] */
const POOLS = {
  msScrap: [
    ['MS', 'scrap', 'HMS 1', 'MT', 26000, 31500, 20, 120, 'Heavy melting scrap — plate cuttings, structural offcuts, thickness ≥ 6 mm'],
    ['MS', 'scrap', 'HMS 2', 'MT', 23500, 28000, 25, 150, 'Mixed heavy melting scrap incl. sheet, pipe and light structural, some rust'],
    ['MS', 'melting-products', 'Turnings', 'MT', 18500, 23000, 15, 90, 'MS turnings and borings from machine shop, loose, oil traces present'],
    ['MS', 'scrap', 'Plate Cuttings', 'MT', 28000, 33500, 18, 70, 'Prime plate end-cuttings, 8–40 mm, sizes suitable for re-rolling'],
    ['CI', 'melting-products', 'Borings', 'MT', 20000, 24500, 20, 80, 'Cast iron borings, dry, free from foreign material as inspected'],
    ['MS', 'long-products', 'Rejected TMT', 'MT', 32000, 37500, 12, 60, 'Rejected/off-grade TMT bars, mixed dia 8–32 mm, bent and bundled'],
    ['MS', 'scrap', 'Skull Scrap', 'MT', 24500, 28500, 25, 110, 'Furnace skull scrap, oxy-cut to charge size, ex-melting shop'],
  ],
  ssOffcuts: [
    ['SS 304', 'flat-products', '304 Offcuts', 'KG', 112, 142, 4000, 22000, 'SS 304 coil-end offcuts and side trims, 0.5–3 mm, coils strapped'],
    ['SS 316', 'flat-products', '316 Offcuts', 'KG', 160, 196, 2500, 12000, 'SS 316L sheet offcuts, mixed sizes, mill finish, bundled on pallets'],
    ['SS 409', 'scrap', '409 Scrap', 'KG', 58, 78, 6000, 26000, 'SS 409 ferritic scrap, punchings and skeletons, baled'],
    ['SS 304', 'melting-products', '304 Turnings', 'KG', 80, 102, 5000, 18000, 'SS 304 turnings, compacted briquettes, oil ≤ 2 % as inspected'],
    ['MS', 'flat-products', 'CRC End Cuts', 'MT', 37000, 43500, 15, 55, 'Cold-rolled coil end cuts, prime surface, 0.6–1.6 mm'],
    ['MS', 'flat-products', 'HR Off-Spec Coils', 'MT', 34500, 40500, 20, 80, 'Off-spec hot-rolled coils, edge defects, weight 8–14 MT per coil'],
  ],
  railway: [
    ['MS', 'scrap', 'Rail Scrap', 'MT', 29500, 35000, 40, 200, 'Released rails 52/60 kg, cut pieces 1.5–6 m, class III condemned'],
    ['MS', 'assets', 'Wagon Bodies', 'MT', 25000, 30000, 60, 240, 'Condemned BOXN wagon bodies without wheelsets, as-is at siding'],
    ['CI', 'scrap', 'Brake Blocks', 'MT', 21500, 26000, 15, 60, 'Worn cast iron brake blocks, loose in heaps, yard stack no. 14'],
    ['MS', 'scrap', 'PSC Sleeper Scrap', 'MT', 12000, 15500, 80, 300, 'Scrap from PSC sleepers — embedded MS inserts and SGCI, mixed'],
    ['Copper', 'scrap', 'OHE Cu Wire', 'KG', 590, 690, 1200, 5200, 'Released OHE copper contact wire, cut lengths, verified purity 99 %+'],
    ['MS', 'scrap', 'Point & Crossing Scrap', 'MT', 27000, 31000, 30, 120, 'Released points and crossings, manganese steel portions included'],
  ],
  nonFerrous: [
    ['Aluminium', 'flat-products', 'Al Sheet 1050', 'KG', 142, 172, 3000, 14000, 'Aluminium sheet offcuts 1050 grade, 0.8–3 mm, palletised'],
    ['Aluminium', 'melting-products', 'Al Ingot Rejects', 'KG', 150, 182, 2500, 9000, 'Off-spec aluminium ingots, analysis reports attached'],
    ['Copper', 'scrap', 'Cu Wire Millberry', 'KG', 620, 715, 800, 4200, 'Bright bare copper wire scrap (Millberry), coiled, no attachments'],
    ['Brass', 'scrap', 'Brass Honey', 'KG', 370, 428, 1000, 5000, 'Mixed brass scrap (honey), valves and fittings, dezinced excluded'],
    ['Zinc', 'melting-products', 'Zinc Dross', 'MT', 112000, 138000, 5, 25, 'Galvanising zinc dross, top dross, drummed, Zn ≥ 85 %'],
    ['Ferro Alloys', 'ferro-alloys', 'FeSiMg Fines', 'MT', 64000, 82000, 8, 30, 'Ferro silicon magnesium fines, bagged 1 MT jumbo bags'],
    ['Aluminium', 'scrap', 'Al Extrusion 6063', 'KG', 148, 176, 3000, 12000, 'Aluminium extrusion offcuts 6063, mill finish, bundled'],
  ],
  coal: [
    ['Coal', 'coal', 'Washery Rejects', 'MT', 1400, 1900, 500, 2500, 'Coal washery rejects, GCV 2200–2800, ex-stack loading'],
    ['Coal', 'coal', 'Unburnt Coal', 'MT', 2300, 3100, 300, 1400, 'Mill reject unburnt coal, GCV 3000–3600, loose at ash dyke'],
    ['Minerals', 'minerals', 'Fly Ash', 'MT', 360, 520, 1000, 5000, 'Dry fly ash ex-silo, suitable for cement/brick units, self-lifting'],
    ['Chemicals', 'chemicals', 'Used Transformer Oil', 'KG', 36, 52, 8000, 24000, 'Used transformer oil in sealed drums, PCB-free certificates available'],
    ['Minerals', 'minerals', 'Bottom Ash', 'MT', 290, 430, 1000, 4000, 'Bottom ash ex-dyke, self-loading, moisture ≤ 20 %'],
  ],
  copperBrass: [
    ['Copper', 'scrap', 'Cu Cable Scrap', 'KG', 445, 540, 2000, 9000, 'PVC insulated copper cable scrap, recovery 55–65 %, baled'],
    ['Copper', 'scrap', 'Cu Armature', 'KG', 475, 560, 1500, 6000, 'Copper armature scrap — motors and stators, iron attachments'],
    ['Brass', 'scrap', 'Brass Shell Scrap', 'KG', 390, 448, 1200, 4800, 'Brass shell/pipe scrap, clean, moisture-free as inspected'],
    ['Aluminium', 'scrap', 'Al Utensil Scrap', 'KG', 126, 152, 2500, 10000, 'Aluminium utensil scrap (taint/tabor), loose in bags'],
    ['Copper', 'scrap', 'Cu Radiators', 'KG', 420, 495, 1500, 6500, 'Copper-brass radiators, drained, no iron attachments'],
  ],
  assets: [
    ['Assets', 'assets', 'Lathe Machines', 'PCS', 160000, 320000, 2, 8, 'Condemned centre lathes 8–12 ft, motors included, seized condition'],
    ['Assets', 'assets', 'EOT Crane Parts', 'LOT', 460000, 950000, 1, 1, 'Dismantled 20 T EOT crane — girders, trolley, hoist as one lot'],
    ['Assets', 'assets', 'DG Sets', 'PCS', 220000, 480000, 1, 4, 'Condemned 250–500 kVA diesel generating sets, non-working'],
    ['Assets', 'assets', 'Air Compressors', 'PCS', 95000, 240000, 2, 6, 'Reciprocating air compressors, condemned, ex-utilities block'],
    ['Assets', 'assets', 'Storage Tanks', 'PCS', 180000, 420000, 1, 5, 'MS storage tanks 20–60 KL, dismantling and removal by buyer'],
  ],
}
const POOL_TITLE = {
  msScrap: ['Mixed MS Scrap, Turnings & TMT Rejects', 'HMS 1 & 2 with Plate Cuttings', 'Melting Shop Scrap & CI Borings', 'Structural Scrap & Skull'],
  ssOffcuts: ['SS Offcuts, Coil Ends & Turnings', '304 / 316 Offcuts & CRC End Cuts', 'Off-Spec Coils & Stainless Trims', 'Stainless Skeletons & Briquettes'],
  railway: ['Released Rails, Wagons & OHE Copper', 'PSC Sleeper & Brake Block Scrap', 'Condemned Rolling Stock & Track Fittings', 'Points, Crossings & Rail Cuttings'],
  nonFerrous: ['Aluminium, Copper & Ferro Alloy Lots', 'Zinc Dross & FeSiMg Fines', 'Al Sheet Offcuts & Ingot Rejects', 'Non-Ferrous Mixed Disposal'],
  coal: ['Coal Rejects, Fly Ash & Used Oil', 'Washery Rejects & Bottom Ash', 'Unburnt Coal & Ash Products', 'Fuel Handling Disposals'],
  copperBrass: ['Copper, Brass & Cable Scrap', 'Cu Armature & Brass Shell Scrap', 'Radiators, Cable & Utensil Scrap', 'Non-Ferrous Yard Clearance'],
  assets: ['Plant & Machinery, Condemned Assets', 'Compressors, DG Sets & Lathes', 'EOT Crane Parts & Storage Tanks', 'Workshop Machinery Disposal'],
}
/* The seven founding sellers already have yards in the demo seed; history
   catalogues raised for them reuse those, so a seller's material always comes
   out of the same place. */
const LEGACY_SELLER = {
  'u-seller-1': { pool: 'msScrap', yard: { name: 'BSP Scrap Yard 3', addr: 'Gate 7, SAIL Bhilai Steel Plant, Bhilai, Chhattisgarh 490001', region: 'Bhilai, CG' }, contact: { name: 'S. K. Sahu', phone: '+91 94252 10883', role: 'Yard In-charge (Inspection & Lifting)' } },
  'u-seller-2': { pool: 'ssOffcuts', yard: { name: 'Burma Mines Yard', addr: 'Burma Mines, Tata Steel Works, Jamshedpur, Jharkhand 831007', region: 'Jamshedpur, JH' }, contact: { name: 'M. Oraon', phone: '+91 82102 44561', role: 'Dy. Manager, By-products' } },
  'u-seller-3': { pool: 'railway', yard: { name: 'Mancheswar Depot', addr: 'Carriage Repair Workshop, Mancheswar, Bhubaneswar, Odisha 751017', region: 'Bhubaneswar, OD' }, contact: { name: 'B. Pradhan', phone: '+91 89178 30425', role: 'SSE / Depot Material Superintendent' } },
  'u-seller-4': { pool: 'nonFerrous', yard: { name: 'VJNR Yard B', addr: 'JSW Steel Vijayanagar Works, Toranagallu, Bellary, Karnataka 583275', region: 'Bellary, KA' }, contact: { name: 'H. Kulkarni', phone: '+91 90360 71182', role: 'Manager, Commercial (Disposals)' } },
  'u-seller-5': { pool: 'coal', yard: { name: 'RSTPS Ash Yard', addr: 'NTPC Ramagundam, Jyothinagar, Peddapalli, Telangana 505215', region: 'Ramagundam, TS' }, contact: { name: 'G. Srinivas', phone: '+91 87903 55240', role: 'AGM (Fuel Handling)' } },
  'u-seller-6': { pool: 'copperBrass', yard: { name: 'MSTC Paradip Yard', addr: 'MSTC Stockyard, Paradip Port Area, Jagatsinghpur, Odisha 754142', region: 'Paradip, OD' }, contact: { name: 'T. Ghosh', phone: '+91 90070 18836', role: 'Yard Supervisor' } },
  'u-seller-7': { pool: 'assets', yard: { name: 'BHEL Unit II Yard', addr: 'BHEL Tiruchirappalli, Kailasapuram, Tamil Nadu 620014', region: 'Trichy, TN' }, contact: { name: 'R. Elango', phone: '+91 94430 20951', role: 'Sr. Engineer (Disposals)' } },
}
const sellerProfile = (s) => LEGACY_SELLER[s.id] ?? { pool: s._pool, yard: s._yard, contact: s._contact }
const sellerShort = (firm) => firm.split('—')[0].trim()

/* ------------------------------- catalogues ------------------------------ */
/* Auctions per month, oldest first: the sale calendar filling up as sellers
   onboard and buyers arrive to bid. */
const AUCTIONS_PER_MONTH = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
const TOTAL_AUCTIONS = AUCTIONS_PER_MONTH.reduce((a, b) => a + b, 0)
const PHOTO_LABELS = ['Overview', 'Close-up', 'Stack view', 'Weighbridge', 'Condition detail']

const histCatalogues = []
const histLots = []
const histReports = []
const histBids = []
let catSeq = 0
let lotSeq = 0
let bidSeq = 0
let repSeq = 0

/* Auction codes run backwards from just under the oldest demo catalogue, in the
   same 3-apart rhythm the demo codes use, so the whole series reads as one
   register rather than two. */
const codeFor = (chronoIndex) => `AUC-${2395 - (TOTAL_AUCTIONS - 1 - chronoIndex) * 3}`

const INSPECTION_NOTES = [
  'Stack verified against yard register. Quantity indicative — final on weighment.',
  'Material matches description. Minor surface rust observed, within norms.',
  'Segregation acceptable. Access for 20 ft trucks confirmed at yard gate.',
  'Photos captured from all sides. Weighbridge within 2 km of the yard.',
  'Heap re-measured with the yard in-charge present. No foreign material seen.',
  'Lot lying in the open; moisture allowance to be read against weighment.',
]

let chrono = 0
for (let m = 0; m < 12; m++) {
  const monthStart = -(12 - m) * 30 * DAY
  const perMonth = AUCTIONS_PER_MONTH[m]
  for (let k = 0; k < perMonth; k++) {
    chrono++
    catSeq++
    /* Closes spread through the month; the newest history auction still lands
       ~12 days back so it never crowds the live demo catalogues. */
    const closeAt = Math.min(monthStart + Math.round(((k + 0.5) / perMonth) * 30 * DAY) + int(600, 1020), -12 * DAY)
    const runDays = int(1, 3)
    const startAt = closeAt - runDays * DAY
    const eligibleSellers = allSellers.filter((s) => Date.parse(s.joinedAt) < ANCHOR + startAt * MIN)
    const seller = pick(eligibleSellers.length ? eligibleSellers : allSellers.slice(0, 7))
    const prof = sellerProfile(seller)
    const pool = POOLS[prof.pool] ?? POOLS.msScrap
    const id = `hcat-${pad(catSeq, 3)}`
    const code = codeFor(chrono - 1)
    const isTender = rnd() < 0.12
    const antiSnipe = pick([3, 5])
    const count = int(5, 14)
    const catLotIds = []

    for (let i = 0; i < count; i++) {
      lotSeq++
      const t = pool[Math.floor(rnd() * pool.length)]
      const [metal, category, grade, uom, rLo, rHi, qLo, qHi, desc] = t
      const qty = uom === 'MT' ? Math.round(between(qLo, qHi)) : round(between(qLo, qHi), uom === 'PCS' || uom === 'LOT' ? 1 : 100)
      const startRate = round(between(rLo, rHi), uom === 'KG' ? 1 : 100)
      const increment = uom === 'KG' ? pick([1, 2, 5]) : round(startRate * 0.005, 50) || 50
      const reserveRate = round(startRate * between(1.04, 1.12), uom === 'KG' ? 1 : 50)
      const preBidEmd = Math.min(500000, Math.max(10000, round(startRate * qty * 0.05, 5000)))
      const lotId = `hlot-${pad(lotSeq, 4)}`
      const hazardous = category === 'chemicals' || /oil/i.test(desc)
      const nPhotos = int(2, 4)

      /* Every catalogued lot was inspected before it was catalogued — that is
         the platform's whole promise, so the report exists for all of them. */
      repSeq++
      const repId = `hir-${pad(repSeq, 4)}`
      const inspectorPool = fieldExecs.filter((f) => Date.parse(f.joinedAt) < ANCHOR + startAt * MIN)
      const flagged = rnd() < 0.03
      histReports.push({
        id: repId, lotId, inspectorId: (inspectorPool.length ? pick(inspectorPool) : fieldExecs[0]).id,
        date: iso(startAt - int(1, 5) * DAY + int(600, 960)),
        measuredQty: Math.round(qty * between(0.93, 1.05) * 100) / 100, uom,
        condition: pick(['good', 'good', 'good', 'fair', 'mixed']),
        notes: flagged
          ? 'Part of the heap could not be verified against the register — seller to reconcile before lifting.'
          : pick(INSPECTION_NOTES),
        checklist: [
          { item: 'Material matches declared grade', ok: true },
          { item: 'Quantity verified (visual/weighment)', ok: !flagged },
          { item: 'No hazardous contamination', ok: !hazardous },
          { item: 'Loading access available', ok: true },
          { item: 'Photos captured', ok: true },
        ],
        photoCount: nPhotos, status: flagged ? 'flagged' : 'verified',
      })

      /* How the lot ended. Decided first, then the bid ladder is built to land
         on it — which is what makes the sold/STA/unsold mix (and therefore the
         commission the platform earned) come out at a believable ratio. */
      const roll = rnd()
      const outcome = roll < 0.70 ? 'sold' : roll < 0.88 ? 'sta' : 'unsold'
      let finalRate = null
      let bidCount = 0
      let winner = null
      let extensions = 0

      if (outcome !== 'unsold') {
        const target = outcome === 'sold'
          ? reserveRate * between(1.005, 1.19)
          : reserveRate * between(0.88, 0.995)
        finalRate = Math.max(startRate + increment, round(target, increment))
        if (outcome === 'sold' && finalRate < reserveRate) finalRate = round(reserveRate + increment, increment)
        if (outcome === 'sta' && finalRate >= reserveRate) finalRate = round(reserveRate - increment, increment)

        const eligibleBuyers = allBuyers.filter(
          (b) => b.standing !== 'defaulter' && b.kycStatus === 'verified' && Date.parse(b.joinedAt) < ANCHOR + startAt * MIN,
        )
        const roster = shuffled(eligibleBuyers.length >= 3 ? eligibleBuyers : allBuyers).slice(0, int(3, 7))
        const steps = Math.max(1, Math.round((finalRate - startRate) / increment))
        bidCount = isTender ? Math.min(roster.length, int(2, 5)) : Math.min(Math.max(steps, 2), int(3, 11))
        const runMinutes = runDays * DAY

        if (isTender) {
          /* Sealed tender: one offer per bidder, no visible ladder, all of them
             priced independently under the H1 that eventually took it. */
          const offers = shuffled(roster).slice(0, bidCount)
          offers.forEach((b, i) => {
            bidSeq++
            const rate = i === offers.length - 1
              ? finalRate
              : Math.max(startRate, round(finalRate * between(0.86, 0.985), increment))
            histBids.push({
              id: `hbid-${pad(bidSeq, 5)}`, lotId, catalogueId: id, bidderId: b.id, rate,
              at: iso(closeAt - Math.round(between(30, runMinutes * 0.8))),
              type: 'tender', status: 'valid',
            })
          })
          winner = offers[offers.length - 1].id
        } else {
          let lastBidder = null
          for (let bIdx = 0; bIdx < bidCount; bIdx++) {
            bidSeq++
            const frac = (bIdx + 1) / bidCount
            const rate = bIdx === bidCount - 1
              ? finalRate
              : Math.max(startRate + increment * (bIdx + 1), round(startRate + (finalRate - startRate) * frac * between(0.75, 0.95), increment))
            let bidder = pick(roster)
            let guard = 0
            while (roster.length > 1 && bidder.id === lastBidder && guard++ < 8) bidder = pick(roster)
            lastBidder = bidder.id
            /* Bidding clusters into the last hour — the same shape the live bid
               room shows, so history and live read alike. */
            const minsBeforeClose = Math.round(runMinutes * Math.pow(1 - frac, 2.2)) + int(1, 25)
            histBids.push({
              id: `hbid-${pad(bidSeq, 5)}`, lotId, catalogueId: id, bidderId: bidder.id, rate,
              at: iso(closeAt - minsBeforeClose),
              type: rnd() < 0.18 ? 'auto' : 'manual', status: 'valid',
            })
            winner = bidder.id
          }
          // anti-snipe: a late bid inside the window pushes the close out
          if (rnd() < 0.22) extensions = int(1, 3)
        }
      }

      catLotIds.push(lotId)
      histLots.push({
        id: lotId, lotNo: `LOT-${pad(i + 1, 2)}`, catalogueId: id, sellerId: seller.id,
        metal, category, grade, indicativeQty: qty, uom,
        yard: prof.yard.name, description: desc, startRate, increment, reserveRate,
        preBidEmd, saleBasis: 'as-is-where-is', hazardous,
        photos: Array.from({ length: nPhotos }, (_, p) => ({ id: `${lotId}-p${p}`, label: PHOTO_LABELS[p], hue: int(10, 44) + p * 6 })),
        inspectionReportId: repId,
        status: outcome,
        currentRate: finalRate, leadingBidderId: winner, bidCount,
        endsAt: iso(closeAt), extensions, resultH1Rate: finalRate,
        knownSeller: false, inspectionWaived: false, waivedBy: null, waivedReason: null, waivedAt: null,
      })
    }

    const title = `${sellerShort(seller.firm)} — ${pick(POOL_TITLE[prof.pool] ?? POOL_TITLE.msScrap)}`
    histCatalogues.push({
      id, code, title, sellerId: seller.id, type: isTender ? 'tender' : 'forward',
      status: 'closed', assignedFieldExecId: null,
      startsAt: iso(startAt), endsAt: iso(closeAt),
      emdDeadline: iso(startAt - 1 * DAY),
      inspectionFrom: iso(startAt - 5 * DAY), inspectionTo: iso(startAt - 1 * DAY),
      inspectionHours: '10:00–16:00 IST', inspectionContact: prof.contact,
      yardName: prof.yard.name, yardAddress: prof.yard.addr, region: prof.yard.region,
      antiSnipeMinutes: antiSnipe, bidValidityDays: pick([7, 10, 14]),
      lotIds: catLotIds,
      documents: [
        { id: `${id}-doc-1`, name: `${code} Catalogue & Annexure.pdf`, type: 'pdf', size: `${(between(1.1, 3.4)).toFixed(1)} MB` },
        { id: `${id}-doc-2`, name: 'Yard Map & Gate Directions.pdf', type: 'pdf', size: `${int(600, 940)} KB` },
      ],
      termsSetId: prof.pool === 'coal' ? 'ts-hazmat' : 'ts-standard',
      description: `E-auction of ${title.split('—')[1].trim().toLowerCase()} on as-is-where-is basis. Physical inspection completed and reports attached against each lot. Auction closed — H1 rates below are final, quantity settled on weighment.`,
    })
  }
}

/* ---------------------------- delivery orders -----------------------------
   One per lot that sold, then aged: an auction that closed nine months ago has
   been paid, weighed, lifted and closed out; last week's is still collecting
   money. A handful never got paid at all — which is what puts the buyer on the
   defaulters list and the EMD in the forfeiture queue. */
const catById = Object.fromEntries(histCatalogues.map((c) => [c.id, c]))
const histDeliveryOrders = []
let doSeq = 0
const GST = 0.18
const TCS = 0.01
const liftedChecklist = (at) => [
  { key: 'vehicle_at_weighbridge', label: 'Vehicle at weighbridge', done: true, at },
  { key: 'loading_complete', label: 'Loading complete', done: true, at },
  { key: 'gross_weighment', label: 'Gross weighment recorded', done: true, at },
]
const openChecklist = () => [
  { key: 'vehicle_at_weighbridge', label: 'Vehicle at weighbridge', done: false },
  { key: 'loading_complete', label: 'Loading complete', done: false },
  { key: 'gross_weighment', label: 'Gross weighment recorded', done: false },
]

for (const lot of histLots) {
  if (lot.status !== 'sold' || !lot.leadingBidderId) continue
  if (rnd() < 0.06) continue // award lapsed before a DO was raised
  doSeq++
  const cat = catById[lot.catalogueId]
  const closeMin = (Date.parse(cat.endsAt) - ANCHOR) / MIN
  const ageDays = -closeMin / DAY
  const materialValue = Math.round(lot.resultH1Rate * lot.indicativeQty)
  const gstAmount = Math.round(materialValue * GST)
  const tcsAmount = Math.round(materialValue * TCS)
  const due = materialValue + gstAmount + tcsAmount
  const buyer = allBuyers.find((b) => b.id === lot.leadingBidderId)
  const createdAt = closeMin + int(60, 400)
  const liftingBy = createdAt + cat.bidValidityDays * DAY

  let stage = 'completed'
  let paidAmount = due
  let weighedQty = Math.round(lot.indicativeQty * between(0.94, 1.04) * 100) / 100
  const extra = {}

  const defaulted = buyer?.standing === 'defaulter' && rnd() < 0.6
  if (defaulted) {
    stage = 'payment_pending'
    paidAmount = 0
    weighedQty = undefined
  } else if (ageDays > 45) {
    stage = 'completed'
  } else if (ageDays > 25) {
    stage = rnd() < 0.8 ? 'completed' : 'lifted'
  } else if (ageDays > 16) {
    const r = rnd()
    stage = r < 0.45 ? 'completed' : r < 0.75 ? 'lifted' : 'lifting_scheduled'
  } else {
    const r = rnd()
    stage = r < 0.25 ? 'lifting_scheduled' : r < 0.45 ? 'dd_issued' : 'payment_pending'
    if (stage === 'payment_pending') {
      paidAmount = rnd() < 0.45 ? 0 : Math.round(due * between(0.2, 0.6))
      weighedQty = undefined
    }
  }
  if (stage === 'lifting_scheduled' || stage === 'dd_issued') weighedQty = undefined
  if (stage === 'completed' || stage === 'lifted') {
    const liftedAt = iso(createdAt + int(2, 9) * DAY)
    extra.weighedById = 'u-exec-1'
    extra.weighedAt = liftedAt
    extra.liftingChecklist = liftedChecklist(liftedAt)
    if (stage === 'completed') {
      extra.handoverConfirmedAt = iso(createdAt + int(3, 11) * DAY)
      extra.handoverConfirmedBy = 'u-exec-1'
      extra.handoverNote = pick([
        'Gate pass issued and material cleared the weighbridge against the DO quantity.',
        'Lifting completed in two trips; balance quantity settled on weighment.',
        'Handover witnessed by the yard in-charge. No shortfall reported.',
      ])
    }
  } else {
    extra.liftingChecklist = openChecklist()
  }

  histDeliveryOrders.push({
    id: `hdo-${pad(doSeq, 4)}`, lotId: lot.id, catalogueId: lot.catalogueId, buyerId: lot.leadingBidderId,
    stage, h1Rate: lot.resultH1Rate, awardedQty: lot.indicativeQty, uom: lot.uom,
    materialValue, gstAmount, tcsAmount, paidAmount,
    liftingBy: iso(liftingBy), createdAt: iso(createdAt),
    ...(weighedQty != null ? { weighedQty } : {}),
    liftingChecklist: extra.liftingChecklist,
    ...(extra.weighedById ? { weighedById: extra.weighedById, weighedAt: extra.weighedAt } : {}),
    ...(extra.handoverConfirmedAt
      ? { handoverConfirmedAt: extra.handoverConfirmedAt, handoverConfirmedBy: extra.handoverConfirmedBy, handoverNote: extra.handoverNote }
      : {}),
  })
}

/* --------------------------- wallets and ledgers --------------------------
   Every history buyer's wallet is *arrived at* rather than typed: the ledger is
   posted in date order and the balance is what the running total came to. So
   the EMD ledger, the deposits screen and the buyer's own wallet agree. */
const winsByBuyer = new Map()
for (const d of histDeliveryOrders) {
  const arr = winsByBuyer.get(d.buyerId)
  if (arr) arr.push(d)
  else winsByBuyer.set(d.buyerId, [d])
}
const bidsByBuyer = new Map()
for (const b of histBids) {
  const arr = bidsByBuyer.get(b.bidderId)
  if (arr) arr.push(b)
  else bidsByBuyer.set(b.bidderId, [b])
}

const histWallets = []
const histLedgerForExisting = new Map() // userId → rows appended to a hand-authored wallet
let ledSeq = 0
const utr = (tag) => `UTR-${tag}-${pad(int(10000, 99999), 5)}`
const lotById = Object.fromEntries(histLots.map((l) => [l.id, l]))

/* `netZero` builds the same history so that it nets to zero — used for the
   hand-authored demo wallets, whose stated balance belongs to the demo
   scenario and must still be the sum of everything in the ledger after a
   year of trading is posted behind it. */
const buildLedger = (buyerId, netZero = false) => {
  const rows = []
  const wins = (winsByBuyer.get(buyerId) ?? []).slice(-3) // last three wins carry the detail
  const theirBids = bidsByBuyer.get(buyerId) ?? []
  const emdLots = shuffled([...new Set(theirBids.map((b) => b.lotId))]).slice(0, 3)

  for (const lotId of emdLots) {
    const lot = lotById[lotId]
    if (!lot) continue
    const cat = catById[lot.catalogueId]
    const closeMin = (Date.parse(cat.endsAt) - ANCHOR) / MIN
    if (!netZero) {
      ledSeq++
      rows.push({
        id: `hled-${pad(ledSeq, 5)}`, at: iso(closeMin - int(2, 6) * DAY), type: 'topup',
        amount: lot.preBidEmd, ref: utr('N' + pad(int(1000, 9999), 4)), note: `RTGS top-up ahead of ${cat.code}`,
      })
    }
    ledSeq++
    rows.push({
      id: `hled-${pad(ledSeq, 5)}`, at: iso(closeMin - int(1, 2) * DAY), type: 'emd_lock',
      amount: -lot.preBidEmd, ref: `EMD-${cat.code.slice(4)}-${lot.lotNo.slice(-2)}`,
      lotId: lot.id, catalogueId: cat.id, note: `Pre-bid EMD locked — ${lot.lotNo} (${cat.code})`,
    })
    const wonThis = (winsByBuyer.get(buyerId) ?? []).some((d) => d.lotId === lot.id)
    ledSeq++
    rows.push(wonThis
      ? {
          id: `hled-${pad(ledSeq, 5)}`, at: iso(closeMin + int(60, 600)), type: 'emd_release',
          amount: lot.preBidEmd, ref: `EMDR-${cat.code.slice(4)}-${lot.lotNo.slice(-2)}`,
          lotId: lot.id, catalogueId: cat.id, note: `EMD adjusted into payment — ${cat.code}`,
        }
      : {
          id: `hled-${pad(ledSeq, 5)}`, at: iso(closeMin + int(60, 1400)), type: 'emd_release',
          amount: lot.preBidEmd, ref: `EMDR-${cat.code.slice(4)}-${lot.lotNo.slice(-2)}`,
          lotId: lot.id, catalogueId: cat.id, note: `EMD auto-released — ${lot.lotNo} (${cat.code}), not H1`,
        })
  }

  for (const d of wins) {
    if (d.paidAmount <= 0) continue
    const cat = catById[d.catalogueId]
    const createdMin = (Date.parse(d.createdAt) - ANCHOR) / MIN
    ledSeq++
    rows.push({
      id: `hled-${pad(ledSeq, 5)}`, at: iso(createdMin + int(60, 900)), type: 'topup',
      amount: d.paidAmount, ref: utr('R' + pad(int(1000, 9999), 4)),
      note: `RTGS top-up — payment for ${cat.code}`,
    })
    ledSeq++
    rows.push({
      id: `hled-${pad(ledSeq, 5)}`, at: iso(createdMin + int(950, 2400)), type: 'payment',
      amount: -d.paidAmount, ref: `PAY-${cat.code.slice(4)}-${pad(int(10, 99), 2)}`,
      lotId: d.lotId, catalogueId: d.catalogueId,
      note: `Material value + GST + TCS — ${cat.code}`,
    })
  }

  // A defaulter's EMD does not come back — it is forfeited, and the ledger says so.
  const buyer = allBuyers.find((b) => b.id === buyerId)
  if (!netZero && buyer?.standing === 'defaulter') {
    const lost = (winsByBuyer.get(buyerId) ?? []).find((d) => d.paidAmount === 0)
    if (lost) {
      const lot = lotById[lost.lotId]
      const cat = catById[lost.catalogueId]
      ledSeq++
      rows.push({
        id: `hled-${pad(ledSeq, 5)}`, at: iso((Date.parse(lost.liftingBy) - ANCHOR) / MIN + DAY), type: 'emd_forfeit',
        amount: -(lot?.preBidEmd ?? 50000), ref: `FORF-${cat.code.slice(4)}-${pad(int(1, 9), 2)}`,
        lotId: lost.lotId, catalogueId: lost.catalogueId,
        note: `EMD forfeited — material not lifted within validity (${cat.code})`,
      })
    }
  }

  return rows.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

for (const b of newBuyers) {
  const ledger = buildLedger(b.id)
  const posted = ledger.reduce((sum, e) => sum + e.amount, 0)
  /* Buyers keep a working float in the wallet — what is left after the year's
     trading, plus whatever they have topped up for the sales now running. */
  const float = ledger.length ? round(between(40_000, 900_000), 5_000) : round(between(0, 250_000), 5_000)
  ledSeq++
  const opening = {
    id: `hled-${pad(ledSeq, 5)}`, at: b.joinedAt, type: 'topup',
    amount: float, ref: utr('O' + pad(int(1000, 9999), 4)), note: 'Opening wallet top-up',
  }
  histWallets.push({
    userId: b.id,
    balance: Math.max(0, float + posted),
    emdLocked: 0,
    ledger: [opening, ...ledger].reverse(), // newest first, as the app renders it
  })
}

/* The demo buyer traded through the whole year too — their hand-authored wallet
   keeps its current position, and the history is posted behind it. */
for (const u of users.filter((x) => x.role === 'buyer')) {
  const rows = buildLedger(u.id, true)
  if (rows.length) histLedgerForExisting.set(u.id, rows)
}

/* ------------------- current EMD held against live sales ------------------
   Some of the year's buyers are in the sales running right now. Their EMD is
   locked, which is what makes the platform's EMD-held figure look like a
   platform with a hundred buyers rather than eight. */
const liveOrUpcoming = catalogues.filter((c) => c.status === 'live' || c.status === 'upcoming')
const lotsByCat = new Map()
for (const l of lots) {
  const arr = lotsByCat.get(l.catalogueId)
  if (arr) arr.push(l)
  else lotsByCat.set(l.catalogueId, [l])
}
const histSelections = []
const activeBuyers = shuffled(newBuyers.filter((b) => b.kycStatus === 'verified' && b.standing !== 'defaulter')).slice(0, 26)
for (const b of activeBuyers) {
  const wallet = histWallets.find((w) => w.userId === b.id)
  for (const cat of shuffled(liveOrUpcoming).slice(0, int(1, 2))) {
    const catLots = shuffled(lotsByCat.get(cat.id) ?? []).slice(0, int(2, 5))
    if (!catLots.length) continue
    const funded = catLots.slice(0, Math.max(1, catLots.length - int(0, 2)))
    const emd = funded.reduce((sum, l) => sum + l.preBidEmd, 0)
    histSelections.push({
      buyerId: b.id, catalogueId: cat.id,
      lotIds: catLots.map((l) => l.id),
      emdFundedLotIds: funded.map((l) => l.id),
    })
    if (wallet) {
      ledSeq++
      // fund the lock first, so the wallet never goes negative to pay for it
      wallet.ledger.unshift({
        id: `hled-${pad(ledSeq, 5)}`, at: iso(-int(2, 20) * DAY), type: 'emd_lock',
        amount: -emd, ref: `EMD-${cat.code.slice(4)}-${pad(int(1, 20), 2)}`,
        catalogueId: cat.id, note: `Pre-bid EMD locked — ${funded.length} lot${funded.length === 1 ? '' : 's'} (${cat.code})`,
      })
      ledSeq++
      wallet.ledger.unshift({
        id: `hled-${pad(ledSeq, 5)}`, at: iso(-int(21, 30) * DAY), type: 'topup',
        amount: emd, ref: utr('N' + pad(int(1000, 9999), 4)), note: `RTGS top-up ahead of ${cat.code}`,
      })
      wallet.emdLocked += emd
    }
  }
}
// keep every ledger newest-first after the unshifts above
for (const w of histWallets) w.ledger.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

const histWatchlist = shuffled(newBuyers).slice(0, 30).map((b) => ({
  buyerId: b.id, catalogueId: pick(liveOrUpcoming).id,
}))

/* -------------------------------- disputes -------------------------------- */
const DISPUTE_TEMPLATES = [
  ['quantity', 'Weighment shortfall against awarded quantity on {lot}', 'Weighbridge slip is {pct}% under the awarded indicative quantity. Requesting pro-rata adjustment on the balance payment as per clause 6.', 'Weighment slips and yard register reconciled. Pro-rata adjustment of the material value approved and passed to Finance.'],
  ['quality', 'Grade variance on {lot} — material not as catalogued', 'A part of the consignment is off-grade against the catalogue description. Photos from the weighbridge attached.', 'Field inspection report re-read with the seller. Variance accepted in part; a goodwill credit was issued against the next sale.'],
  ['lifting', 'Gate pass delay at {yard}', 'Trucks waited at the gate on the lifting day. Requesting a waiver of ground rent for the idle day.', 'Seller confirmed the delay was on the yard side. One day of ground rent waived.'],
  ['payment', 'Duplicate debit against {cat} payment', 'Two debits appear against the same UTR for this delivery order. Requesting a refund of the duplicate.', 'Bank statement confirmed the duplicate credit. Refund raised and paid to the registered account.'],
  ['other', 'E-way bill not generated for {lot}', 'Vehicle stopped at the check post — the e-way bill against this delivery order was not issued.', 'Seller regenerated the e-way bill the same day. Documentation checklist updated to catch this before lifting.'],
  ['quantity', 'Short quantity in second trip — {lot}', 'The second trip weighed under the balance quantity shown on the delivery order.', 'Both weighbridge slips totalled against the DO. Balance was within the stated tolerance; explained to the buyer with the slips attached.'],
]
const OUTCOMES = ['upheld', 'declined', 'refund_due', 'goodwill']
const histDisputes = []
const doPool = shuffled(histDeliveryOrders).slice(0, 34)
doPool.forEach((d, i) => {
  const lot = lotById[d.lotId]
  const cat = catById[d.catalogueId]
  if (!lot || !cat) return
  const [category, subject, body, resolution] = DISPUTE_TEMPLATES[i % DISPUTE_TEMPLATES.length]
  const createdMin = (Date.parse(d.createdAt) - ANCHOR) / MIN + int(1, 6) * DAY
  if (createdMin > -1 * DAY) return
  const ageDays = -createdMin / DAY
  const status = ageDays > 20 ? 'resolved' : ageDays > 8 ? (rnd() < 0.7 ? 'resolved' : 'in_review') : (rnd() < 0.5 ? 'in_review' : 'open')
  const fill = (s) => s.replace('{lot}', lot.lotNo).replace('{yard}', cat.yardName).replace('{cat}', cat.code).replace('{pct}', String(int(4, 9)))
  const assigned = pick(subAdmins)
  const messages = [{ from: 'user', body: fill(body), at: iso(createdMin) }]
  if (status !== 'open') {
    messages.push({
      from: 'support',
      body: 'Acknowledged. We have asked the yard for the weighment slips and the seller for their side of the record. We will come back within two working days.',
      at: iso(createdMin + int(120, 900)),
    })
  }
  if (status === 'resolved') messages.push({ from: 'support', body: fill(resolution), at: iso(createdMin + int(2, 9) * DAY) })
  const outcome = OUTCOMES[i % OUTCOMES.length]
  histDisputes.push({
    id: `hdsp-${pad(i + 1, 3)}`, userId: d.buyerId, subject: fill(subject), category,
    lotId: d.lotId, status, createdAt: iso(createdMin), messages,
    assignedToId: assigned.id,
    ...(status === 'resolved'
      ? {
          outcome, resolution: fill(resolution),
          resolvedAt: iso(createdMin + int(2, 9) * DAY), resolvedById: assigned.id,
        }
      : {}),
  })
})

/* ------------------------------ inspection slots -------------------------- */
const histSlots = shuffled(histCatalogues).slice(0, 45).map((c, i) => {
  const buyer = pick(allBuyers)
  const startMin = (Date.parse(c.startsAt) - ANCHOR) / MIN
  return {
    id: `hslot-${pad(i + 1, 3)}`, catalogueId: c.id, userId: buyer.id,
    date: iso(startMin - int(1, 4) * DAY + int(600, 900)),
    window: pick(['10:00–13:00 IST', '13:00–16:00 IST', '11:00–14:00 IST']),
    persons: int(1, 3), status: 'attended',
    passCode: `FB-GATE-${ID_CHARS[int(0, 23)]}${int(100, 999)}`,
  }
})

/* -------------------------------- audit trail -----------------------------
   Twelve months of what staff actually did, anchored to the auctions it was
   done on — so opening any historical sale and opening the audit log tell the
   same story. */
const histAudit = []
let audSeq = 0
const addAudit = (atMin, actorId, action, target, detail, severity) => {
  audSeq++
  histAudit.push({ id: `haud-${pad(audSeq, 4)}`, at: iso(atMin), actorId, action, target, detail, severity })
}
for (const c of histCatalogues) {
  const startMin = (Date.parse(c.startsAt) - ANCHOR) / MIN
  const closeMin = (Date.parse(c.endsAt) - ANCHOR) / MIN
  const catLots = histLots.filter((l) => l.catalogueId === c.id)
  const am = pick(auctionManagers)
  addAudit(startMin - int(200, 900), pick([...auctionManagers, users.find((u) => u.id === 'u-exec-1')]).id,
    'catalogue.publish', c.code, `Published ${c.title} with ${catLots.length} lots`, 'info')
  if (rnd() < 0.35) {
    addAudit(closeMin - int(5, 60), am.id, 'auction.extend', c.code,
      `Anti-snipe auto-extension ×${int(1, 3)} on ${pick(catLots).lotNo} (final ${c.antiSnipeMinutes} minutes)`, 'info')
  }
  if (rnd() < 0.12) {
    addAudit(closeMin - int(60, 400), am.id, 'auction.pause', c.code,
      `Paused ${int(4, 20)} min — ${pick(['payment-gateway incident', 'seller clarification on a lot description', 'yard confirmed a quantity correction'])}`, 'warning')
  }
  if (rnd() < 0.10) {
    addAudit(closeMin - int(20, 200), pick(subAdmins).id, 'bid.flag', c.code,
      `Flagged rapid bid pattern on ${pick(catLots).lotNo} for review`, 'warning')
  }
  const staLots = catLots.filter((l) => l.status === 'sta')
  if (staLots.length) {
    addAudit(closeMin + int(60, 900), am.id, 'auction.sta_refer', c.code,
      `${staLots.length} lot${staLots.length === 1 ? '' : 's'} referred to the seller — H1 below reserve`, 'info')
  }
  if (rnd() < 0.5) {
    addAudit(closeMin + int(900, 4000), 'u-exec-1', 'settlement.approve', c.code,
      `Approved settlement and delivery-order issue for ${catLots.filter((l) => l.status === 'sold').length} sold lots`, 'info')
  }
}
for (const b of newBuyers) {
  const joinMin = (Date.parse(b.joinedAt) - ANCHOR) / MIN
  addAudit(joinMin + int(60, 2000), pick(subAdmins).id, 'kyc.review', b.id,
    b.kycStatus === 'verified'
      ? `KYC verified — GSTIN and PAN matched for ${b.firm}`
      : b.kycStatus === 'rejected'
        ? `KYC rejected — GSTIN does not match the firm name for ${b.firm}`
        : `KYC pending — clarification requested from ${b.firm}`,
    b.kycStatus === 'rejected' ? 'warning' : 'info')
  if (b.standing === 'defaulter') {
    addAudit(joinMin + int(30, 120) * DAY, 'u-super-1', 'user.blacklist', b.id,
      `Moved ${b.firm} to defaulters — EMD forfeited after a lifting default`, 'critical')
  }
  if (b.standing === 'watchlist') {
    addAudit(joinMin + int(20, 100) * DAY, pick(subAdmins).id, 'user.watchlist', b.id,
      `${b.firm} placed on the watchlist — late payment on two delivery orders`, 'warning')
  }
}
for (const s of newSellers) {
  const joinMin = (Date.parse(s.joinedAt) - ANCHOR) / MIN
  addAudit(joinMin + int(60, 1500), pick(subAdmins).id, 'seller.verify', s.id,
    `Seller verified — ${s.firm}, disposal authorisation and GSTIN on file`, 'info')
}
for (const st of newStaff) {
  const joinMin = (Date.parse(st.joinedAt) - ANCHOR) / MIN
  addAudit(joinMin, 'u-super-1', 'user.create', st.id,
    `Created ${st.role.replace('_', ' ')} account for ${st.name} (${st.city})`, 'info')
}
histAudit.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

/* ------------------------------ announcements ----------------------------- */
const HIST_ANNOUNCEMENTS = [
  [-350, 'ferroBid is live', 'The platform is open for its first e-auctions. Sellers can list, buyers can inspect and bid, and every lot carries a field-inspection report.', 'info'],
  [-320, 'Pre-bid EMD is now lot-wise', 'EMD is funded against each lot rather than against the catalogue, so a bidder only ever blocks money on what they actually intend to bid on.', 'info'],
  [-280, 'Anti-snipe extension standardised', 'Every catalogue now states its anti-snipe window on the auction card. A bid inside the window extends the lot by that many minutes.', 'info'],
  [-240, 'Sealed tender sales added', 'Selected catalogues now run as sealed tenders — one offer per bidder, no visible ladder, opened together at close.', 'info'],
  [-200, 'Weighment tolerance published', 'Final quantity is settled on weighment. The tolerance and the pro-rata adjustment method are now stated in the standard terms.', 'info'],
  [-160, 'Festive week auction calendar', 'No auctions will close between the 9th and the 12th. Inspection visits continue as scheduled at all yards.', 'warning'],
  [-120, 'EMD refund timeline halved', 'EMD for unsuccessful bidders is auto-released within 24 hours of catalogue close, down from 72 hours.', 'info'],
  [-90, 'GST rate change on scrap', 'Please note the revised GST treatment applicable from this quarter. Invoices raised after the effective date carry the new rate.', 'warning'],
  [-60, 'Delivery orders now carry a lifting checklist', 'Weighbridge, loading and gross weighment are recorded against every delivery order before handover is confirmed.', 'info'],
  [-30, 'Buyer premium disclosed on every lot', 'The buyer premium is now shown on the lot card and on the delivery order, so the landed cost is visible before a bid is placed.', 'info'],
].map(([days, title, body, severity], i) => ({
  id: `hann-${pad(i + 1, 2)}`, scope: 'platform', title, body, at: iso(days * DAY + 600), severity,
}))

/* ------------------------------ notifications ------------------------------
   The demo buyer's own history, so their notification list is a year deep and
   not a week. All read — an unread badge in the hundreds helps nobody. */
const histNotifications = []
const demoWins = histDeliveryOrders.filter((d) => d.buyerId === 'u-buyer-1').slice(-8)
demoWins.forEach((d, i) => {
  const lot = lotById[d.lotId]
  const cat = catById[d.catalogueId]
  const closeMin = (Date.parse(cat.endsAt) - ANCHOR) / MIN
  histNotifications.push({
    id: `hntf-w${pad(i + 1, 2)}`, userId: 'u-buyer-1', kind: 'bid',
    title: `You won ${lot.lotNo} in ${cat.code}`,
    body: `H1 confirmed at ₹${lot.resultH1Rate.toLocaleString('en-IN')}/${lot.uom}. Delivery order raised — ${d.stage === 'completed' ? 'since lifted and closed out' : 'payment opens the lifting'}.`,
    at: iso(closeMin + 30), read: true, href: '/buyer/auction-status',
  })
})
shuffled(histCatalogues).slice(0, 10).forEach((c, i) => {
  const closeMin = (Date.parse(c.endsAt) - ANCHOR) / MIN
  histNotifications.push({
    id: `hntf-s${pad(i + 1, 2)}`, userId: c.sellerId, kind: 'lifecycle',
    title: `${c.code} closed`,
    body: `${histLots.filter((l) => l.catalogueId === c.id && l.status === 'sold').length} lots cleared at or above reserve. Settlement summary is on your workspace.`,
    at: iso(closeMin + 60), read: true, href: '/seller/settlement',
  })
})

/* ---------------------------------- write --------------------------------- */
const cleanSeller = (s) => {
  const { _yard, _pool, _contact, ...rest } = s
  return rest
}
const outUsers = [...users, ...newBuyers, ...newSellers.map(cleanSeller), ...newStaff]
const outWallets = [
  ...wallets.map((w) => {
    const extra = histLedgerForExisting.get(w.userId)
    if (!extra) return w
    return { ...w, ledger: [...w.ledger, ...extra].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)) }
  }),
  ...histWallets,
]

write('users.json', outUsers)
write('catalogues.json', [...catalogues, ...histCatalogues])
write('lots.json', [...lots, ...histLots])
write('bids.json', [...bids, ...histBids])
write('inspectionReports.json', [...inspectionReports, ...histReports])
write('deliveryOrders.json', [...deliveryOrders, ...histDeliveryOrders])
write('wallets.json', outWallets)
write('selections.json', [...selections, ...histSelections])
write('watchlist.json', [...watchlist, ...histWatchlist])
write('disputes.json', [...disputes, ...histDisputes])
write('auditEvents.json', [...auditEvents, ...histAudit])
write('announcements.json', [...announcements, ...HIST_ANNOUNCEMENTS])
write('notifications.json', [...notifications, ...histNotifications])
write('inspectionSlots.json', [...inspectionSlots, ...histSlots])

const sold = histLots.filter((l) => l.status === 'sold')
const gmv = sold.reduce((sum, l) => sum + l.resultH1Rate * l.indicativeQty, 0)
console.log('ferroBid — 12 months of history appended to src/data/mock/')
console.log(`  auctions   ${histCatalogues.length} closed (+${catalogues.length} demo) · tender ${histCatalogues.filter((c) => c.type === 'tender').length}`)
console.log(`  lots       ${histLots.length} (sold ${sold.length} · STA ${histLots.filter((l) => l.status === 'sta').length} · unsold ${histLots.filter((l) => l.status === 'unsold').length})`)
console.log(`  bids       ${histBids.length}`)
console.log(`  buyers     +${newBuyers.length} (total ${outUsers.filter((u) => u.role === 'buyer').length}) · sellers +${newSellers.length} (total ${outUsers.filter((u) => u.role === 'seller').length}) · staff +${newStaff.length}`)
console.log(`  DOs        ${histDeliveryOrders.length} · disputes ${histDisputes.length} · audit ${histAudit.length} · inspections ${histReports.length}`)
console.log(`  GMV        ₹${(gmv / 10_000_000).toFixed(2)} Cr cleared across the year`)
