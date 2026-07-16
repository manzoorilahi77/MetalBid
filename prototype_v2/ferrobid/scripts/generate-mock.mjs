/* ---------------------------------------------------------------------------
   Deterministic mock-data generator for ferroBid.
   Run: npm run mock   → writes src/data/mock/*.json
   All timestamps are anchored to ANCHOR; the app rebases them to Date.now()
   at seed load so "live" catalogues are genuinely live on every reload.
--------------------------------------------------------------------------- */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'mock')
mkdirSync(OUT, { recursive: true })

export const ANCHOR = Date.parse('2026-07-16T12:00:00+05:30')
const MIN = 60_000
const iso = (minFromAnchor) => new Date(ANCHOR + minFromAnchor * MIN).toISOString()
const DAY = 24 * 60

// seeded RNG — stable output across runs
let _s = 42
const rnd = () => ((_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const between = (a, b) => a + rnd() * (b - a)
const round = (n, step) => Math.round(n / step) * step

/* ------------------------------- users ---------------------------------- */
const users = [
  { id: 'u-buyer-1', name: 'Arvind Mehta', firm: 'Mehta Metals & Alloys', phone: '+91 98200 41775', email: 'arvind@mehtametals.in', role: 'buyer', kycStatus: 'verified', sellerVerified: false, standing: 'good', city: 'Mumbai', gstin: '27AAECM4321Q1ZP', avatarHue: 18, joinedAt: iso(-260 * DAY) },
  { id: 'u-buyer-2', name: 'Kavitha Rao', firm: 'Sree Lakshmi Alloys', phone: '+91 90000 22814', email: 'kavitha@slalloys.in', role: 'buyer', kycStatus: 'verified', sellerVerified: false, standing: 'good', city: 'Hyderabad', gstin: '36AABCS9812K1Z3', avatarHue: 210, joinedAt: iso(-410 * DAY) },
  { id: 'u-buyer-3', name: 'Imran Shaikh', firm: 'Al-Noor Metal Trading', phone: '+91 99670 55211', email: 'imran@alnoormetal.in', role: 'buyer', kycStatus: 'verified', sellerVerified: false, standing: 'watchlist', city: 'Bhiwandi', gstin: '27AAKFA0921L1Z6', avatarHue: 140, joinedAt: iso(-150 * DAY) },
  { id: 'u-buyer-4', name: 'Deepak Jindal', firm: 'Jindal Ispat Udyog', phone: '+91 98140 77320', email: 'deepak@jindalispat.in', role: 'buyer', kycStatus: 'verified', sellerVerified: false, standing: 'defaulter', city: 'Ludhiana', gstin: '03AABCJ7710M1ZR', avatarHue: 0, joinedAt: iso(-520 * DAY), blacklistReason: 'EMD forfeited twice — failed to lift material within validity (AUC-2381, AUC-2394)' },
  { id: 'u-buyer-5', name: 'Ganesh Iyer', firm: 'Ganesh Steel Traders', phone: '+91 98844 10293', email: 'ganesh@gstraders.in', role: 'buyer', kycStatus: 'verified', sellerVerified: false, standing: 'good', city: 'Chennai', gstin: '33AADCG5541P1Z8', avatarHue: 260, joinedAt: iso(-300 * DAY) },
  { id: 'u-buyer-6', name: 'Ritu Agarwal', firm: 'OmShakti Metal Corp', phone: '+91 93300 84712', email: 'ritu@omshakti.in', role: 'buyer', kycStatus: 'verified', sellerVerified: false, standing: 'good', city: 'Kolkata', gstin: '19AAFCO2231R1Z4', avatarHue: 300, joinedAt: iso(-190 * DAY) },
  { id: 'u-buyer-7', name: 'Sandeep Patil', firm: 'Deccan Ferro Works', phone: '+91 97640 31556', email: 'sandeep@deccanferro.in', role: 'buyer', kycStatus: 'verified', sellerVerified: false, standing: 'good', city: 'Pune', gstin: '27AAGCD8812T1Z1', avatarHue: 45, joinedAt: iso(-95 * DAY) },
  { id: 'u-buyer-8', name: 'Harpreet Gill', firm: 'Punjab Rolling Mills', phone: '+91 98722 60148', email: 'harpreet@punjabrolling.in', role: 'buyer', kycStatus: 'pending', sellerVerified: false, standing: 'good', city: 'Mandi Gobindgarh', gstin: '03AACCP1190B1ZS', avatarHue: 175, joinedAt: iso(-20 * DAY) },
  { id: 'u-seller-1', name: 'R. K. Verma', firm: 'SAIL — Bhilai Steel Plant', phone: '+91 78802 11430', email: 'rk.verma@sail.in', role: 'seller', kycStatus: 'verified', sellerVerified: true, standing: 'good', city: 'Bhilai', gstin: '22AAACS7062F1Z7', avatarHue: 220, joinedAt: iso(-700 * DAY) },
  { id: 'u-seller-2', name: 'S. Banerjee', firm: 'Tata Steel — Jamshedpur Works', phone: '+91 65722 41190', email: 's.banerjee@tatasteel.com', role: 'seller', kycStatus: 'verified', sellerVerified: true, standing: 'good', city: 'Jamshedpur', gstin: '20AAACT2803M1Z9', avatarHue: 235, joinedAt: iso(-800 * DAY) },
  { id: 'u-seller-3', name: 'A. K. Mishra', firm: 'East Coast Railway — Stores Dept', phone: '+91 67122 30871', email: 'akmishra@ecor.gov.in', role: 'seller', kycStatus: 'verified', sellerVerified: true, standing: 'good', city: 'Bhubaneswar', gstin: '21AAAGE0123F1ZD', avatarHue: 120, joinedAt: iso(-560 * DAY) },
  { id: 'u-seller-4', name: 'P. Nagaraj', firm: 'JSW Steel — Vijayanagar Works', phone: '+91 83952 50617', email: 'p.nagaraj@jsw.in', role: 'seller', kycStatus: 'verified', sellerVerified: true, standing: 'good', city: 'Bellary', gstin: '29AAACJ4323N1ZW', avatarHue: 25, joinedAt: iso(-450 * DAY) },
  { id: 'u-seller-5', name: 'V. Ramesh', firm: 'NTPC — Ramagundam STPS', phone: '+91 87242 72218', email: 'v.ramesh@ntpc.co.in', role: 'seller', kycStatus: 'verified', sellerVerified: true, standing: 'good', city: 'Ramagundam', gstin: '36AAACN0255D1Z1', avatarHue: 55, joinedAt: iso(-380 * DAY) },
  { id: 'u-seller-6', name: 'D. Chatterjee', firm: 'MSTC — Eastern Region Yard', phone: '+91 33224 40911', email: 'd.chatterjee@mstc.in', role: 'seller', kycStatus: 'verified', sellerVerified: true, standing: 'good', city: 'Kolkata', gstin: '19AAACM0954J1Z2', avatarHue: 200, joinedAt: iso(-900 * DAY) },
  { id: 'u-seller-7', name: 'K. Sundaram', firm: 'BHEL — Tiruchirappalli Unit', phone: '+91 43122 57703', email: 'k.sundaram@bhel.in', role: 'seller', kycStatus: 'verified', sellerVerified: true, standing: 'good', city: 'Tiruchirappalli', gstin: '33AAACB4146P1ZN', avatarHue: 280, joinedAt: iso(-640 * DAY) },
  { id: 'u-field-1', name: 'Ravi Kumar', firm: 'ferroBid Field Ops', phone: '+91 97313 48802', email: 'ravi.kumar@ferrobid.in', role: 'field_exec', kycStatus: 'verified', sellerVerified: false, standing: 'good', city: 'Raipur', gstin: '—', avatarHue: 90, joinedAt: iso(-330 * DAY) },
  { id: 'u-field-2', name: 'Sunita Devi', firm: 'ferroBid Field Ops', phone: '+91 91626 55917', email: 'sunita.devi@ferrobid.in', role: 'field_exec', kycStatus: 'verified', sellerVerified: false, standing: 'good', city: 'Jamshedpur', gstin: '—', avatarHue: 330, joinedAt: iso(-210 * DAY) },
  { id: 'u-exec-1', name: 'Meera Nair', firm: 'ferroBid Operations', phone: '+91 98450 27384', email: 'meera.nair@ferrobid.in', role: 'exec_manager', kycStatus: 'verified', sellerVerified: false, standing: 'good', city: 'Bengaluru', gstin: '—', avatarHue: 245, joinedAt: iso(-540 * DAY) },
  { id: 'u-sub-1', name: 'Ankit Sharma', firm: 'ferroBid Operations', phone: '+91 99105 63421', email: 'ankit.sharma@ferrobid.in', role: 'sub_admin', kycStatus: 'verified', sellerVerified: false, standing: 'good', city: 'New Delhi', gstin: '—', avatarHue: 160, joinedAt: iso(-280 * DAY) },
  { id: 'u-super-1', name: 'Priya Venkatesan', firm: 'ferroBid HQ', phone: '+91 98410 90112', email: 'priya.v@ferrobid.in', role: 'super_admin', kycStatus: 'verified', sellerVerified: false, standing: 'good', city: 'Chennai', gstin: '—', avatarHue: 15, joinedAt: iso(-1000 * DAY) },
]
const BOTS = ['u-buyer-2', 'u-buyer-3', 'u-buyer-5', 'u-buyer-6', 'u-buyer-7']

/* ---------------------------- lot templates ------------------------------ */
// [metal, category, grade, uom, rate-low, rate-high, qtyLow, qtyHigh, desc]
const POOLS = {
  msScrap: [
    ['MS', 'scrap', 'HMS 1', 'MT', 27000, 31500, 20, 120, 'Heavy melting scrap — plate cuttings, structural offcuts, thickness ≥ 6 mm'],
    ['MS', 'scrap', 'HMS 2', 'MT', 24500, 28000, 25, 150, 'Mixed heavy melting scrap incl. sheet, pipe and light structural, some rust'],
    ['MS', 'melting-products', 'Turnings', 'MT', 19500, 23000, 15, 90, 'MS turnings and borings from machine shop, loose, oil traces present'],
    ['MS', 'scrap', 'Plate Cuttings', 'MT', 29000, 33500, 18, 70, 'Prime plate end-cuttings, 8–40 mm, sizes suitable for re-rolling'],
    ['CI', 'melting-products', 'Borings', 'MT', 21000, 24500, 20, 80, 'Cast iron borings, dry, free from foreign material as inspected'],
    ['MS', 'long-products', 'Rejected TMT', 'MT', 33000, 37500, 12, 60, 'Rejected/off-grade TMT bars, mixed dia 8–32 mm, bent and bundled'],
  ],
  ssOffcuts: [
    ['SS 304', 'flat-products', '304 Offcuts', 'KG', 118, 142, 4000, 22000, 'SS 304 coil-end offcuts and side trims, 0.5–3 mm, coils strapped'],
    ['SS 316', 'flat-products', '316 Offcuts', 'KG', 168, 196, 2500, 12000, 'SS 316L sheet offcuts, mixed sizes, mill finish, bundled on pallets'],
    ['SS 409', 'scrap', '409 Scrap', 'KG', 62, 78, 6000, 26000, 'SS 409 ferritic scrap, punchings and skeletons, baled'],
    ['SS 304', 'melting-products', '304 Turnings', 'KG', 84, 102, 5000, 18000, 'SS 304 turnings, compacted briquettes, oil ≤ 2 % as inspected'],
    ['MS', 'flat-products', 'CRC End Cuts', 'MT', 38500, 43500, 15, 55, 'Cold-rolled coil end cuts, prime surface, 0.6–1.6 mm'],
  ],
  railway: [
    ['MS', 'scrap', 'Rail Scrap', 'MT', 30500, 35000, 40, 200, 'Released rails 52/60 kg, cut pieces 1.5–6 m, class III condemned'],
    ['MS', 'assets', 'Wagon Bodies', 'MT', 26000, 30000, 60, 240, 'Condemned BOXN wagon bodies without wheelsets, as-is at siding'],
    ['CI', 'scrap', 'Brake Blocks', 'MT', 22500, 26000, 15, 60, 'Worn cast iron brake blocks, loose in heaps, yard stack no. 14'],
    ['MS', 'scrap', 'PSC Sleeper Scrap', 'MT', 12500, 15500, 80, 300, 'Scrap from PSC sleepers — embedded MS inserts and SGCI, mixed'],
    ['Copper', 'scrap', 'OHE Cu Wire', 'KG', 610, 690, 1200, 5200, 'Released OHE copper contact wire, cut lengths, verified purity 99 %+'],
  ],
  nonFerrous: [
    ['Aluminium', 'flat-products', 'Al Sheet 1050', 'KG', 148, 172, 3000, 14000, 'Aluminium sheet offcuts 1050 grade, 0.8–3 mm, palletised'],
    ['Aluminium', 'melting-products', 'Al Ingot Rejects', 'KG', 158, 182, 2500, 9000, 'Off-spec aluminium ingots, analysis reports attached'],
    ['Copper', 'scrap', 'Cu Wire Millberry', 'KG', 645, 715, 800, 4200, 'Bright bare copper wire scrap (Millberry), coiled, no attachments'],
    ['Brass', 'scrap', 'Brass Honey', 'KG', 385, 428, 1000, 5000, 'Mixed brass scrap (honey), valves and fittings, dezinced excluded'],
    ['Zinc', 'melting-products', 'Zinc Dross', 'MT', 118000, 138000, 5, 25, 'Galvanising zinc dross, top dross, drummed, Zn ≥ 85 %'],
    ['Ferro Alloys', 'ferro-alloys', 'FeSiMg Fines', 'MT', 68000, 82000, 8, 30, 'Ferro silicon magnesium fines, bagged 1 MT jumbo bags'],
  ],
  coal: [
    ['Coal', 'coal', 'Washery Rejects', 'MT', 1450, 1900, 500, 2500, 'Coal washery rejects, GCV 2200–2800, ex-stack loading'],
    ['Coal', 'coal', 'Unburnt Coal', 'MT', 2400, 3100, 300, 1400, 'Mill reject unburnt coal, GCV 3000–3600, loose at ash dyke'],
    ['Minerals', 'minerals', 'Fly Ash', 'MT', 380, 520, 1000, 5000, 'Dry fly ash ex-silo, suitable for cement/brick units, self-lifting'],
    ['Chemicals', 'chemicals', 'Used Transformer Oil', 'KG', 38, 52, 8000, 24000, 'Used transformer oil in sealed drums, PCB-free certificates available'],
  ],
  copperBrass: [
    ['Copper', 'scrap', 'Cu Cable Scrap', 'KG', 465, 540, 2000, 9000, 'PVC insulated copper cable scrap, recovery 55–65 %, baled'],
    ['Copper', 'scrap', 'Cu Armature', 'KG', 495, 560, 1500, 6000, 'Copper armature scrap — motors and stators, iron attachments'],
    ['Brass', 'scrap', 'Brass Shell Scrap', 'KG', 402, 448, 1200, 4800, 'Brass shell/pipe scrap, clean, moisture-free as inspected'],
    ['Aluminium', 'scrap', 'Al Utensil Scrap', 'KG', 132, 152, 2500, 10000, 'Aluminium utensil scrap (taint/tabor), loose in bags'],
  ],
  assets: [
    ['Assets', 'assets', 'Lathe Machines', 'PCS', 165000, 320000, 2, 8, 'Condemned centre lathes 8–12 ft, motors included, seized condition'],
    ['Assets', 'assets', 'EOT Crane Parts', 'LOT', 480000, 950000, 1, 1, 'Dismantled 20 T EOT crane — girders, trolley, hoist as one lot'],
    ['Assets', 'assets', 'DG Sets', 'PCS', 210000, 420000, 1, 4, 'Non-working 500 kVA DG sets, engine + alternator, as-is'],
    ['MS', 'assets', 'Storage Tanks', 'MT', 24000, 28500, 30, 110, 'Dismantled MS storage tanks, plate 8–12 mm, gas-cut pieces'],
    ['Assets', 'assets', 'Compressors', 'PCS', 85000, 190000, 2, 6, 'Reciprocating air compressors, condemned, foundation bolts cut'],
  ],
}

const YARDS = {
  'cat-1': { name: 'BSP Scrap Yard 3', addr: 'Gate 7, SAIL Bhilai Steel Plant, Bhilai, Chhattisgarh 490001', region: 'Bhilai, CG' },
  'cat-2': { name: 'Burma Mines Yard', addr: 'Burma Mines, Tata Steel Works, Jamshedpur, Jharkhand 831007', region: 'Jamshedpur, JH' },
  'cat-3': { name: 'Mancheswar Depot', addr: 'Carriage Repair Workshop, Mancheswar, Bhubaneswar, Odisha 751017', region: 'Bhubaneswar, OD' },
  'cat-4': { name: 'VJNR Yard B', addr: 'JSW Steel Vijayanagar Works, Toranagallu, Bellary, Karnataka 583275', region: 'Bellary, KA' },
  'cat-5': { name: 'RSTPS Ash Yard', addr: 'NTPC Ramagundam, Jyothinagar, Peddapalli, Telangana 505215', region: 'Ramagundam, TS' },
  'cat-6': { name: 'MSTC Paradip Yard', addr: 'MSTC Stockyard, Paradip Port Area, Jagatsinghpur, Odisha 754142', region: 'Paradip, OD' },
  'cat-7': { name: 'BHEL Unit II Yard', addr: 'BHEL Tiruchirappalli, Kailasapuram, Tamil Nadu 620014', region: 'Trichy, TN' },
}

/* ------------------------------ catalogues ------------------------------- */
const cataloguesDef = [
  { id: 'cat-1', code: 'AUC-2412', title: 'SAIL Bhilai — Mixed MS Scrap, Turnings & TMT Rejects', sellerId: 'u-seller-1', status: 'live', start: -3 * DAY, end: 42, pool: 'msScrap', count: 18, insp: [-6 * DAY, -2 * DAY], contact: { name: 'S. K. Sahu', phone: '+91 94252 10883', role: 'Yard In-charge (Inspection & Lifting)' }, antiSnipe: 3, validity: 7 },
  { id: 'cat-2', code: 'AUC-2415', title: 'Tata Steel Jamshedpur — SS Offcuts, Coil Ends & Turnings', sellerId: 'u-seller-2', status: 'live', start: -2 * DAY, end: 205, pool: 'ssOffcuts', count: 14, insp: [-5 * DAY, -1 * DAY], contact: { name: 'M. Oraon', phone: '+91 82102 44561', role: 'Dy. Manager, By-products' }, antiSnipe: 5, validity: 10 },
  { id: 'cat-3', code: 'AUC-2418', title: 'East Coast Railway — Released Rails, Wagons & OHE Copper', sellerId: 'u-seller-3', status: 'live', start: -1 * DAY, end: 21, pool: 'railway', count: 12, insp: [-4 * DAY, -1 * DAY], contact: { name: 'B. Pradhan', phone: '+91 89178 30425', role: 'SSE / Depot Material Superintendent' }, antiSnipe: 3, validity: 14 },
  { id: 'cat-4', code: 'AUC-2421', title: 'JSW Vijayanagar — Aluminium, Copper & Ferro Alloy Lots', sellerId: 'u-seller-4', status: 'upcoming', start: 1 * DAY + 120, end: 1 * DAY + 420, pool: 'nonFerrous', count: 16, insp: [10 * 60, 1 * DAY], contact: { name: 'H. Kulkarni', phone: '+91 90360 71182', role: 'Manager, Commercial (Disposals)' }, antiSnipe: 5, validity: 7 },
  { id: 'cat-5', code: 'AUC-2424', title: 'NTPC Ramagundam — Coal Rejects, Fly Ash & Used Oil', sellerId: 'u-seller-5', status: 'upcoming', start: 3 * DAY, end: 3 * DAY + 300, pool: 'coal', count: 10, insp: [1 * DAY, 2 * DAY + 720], contact: { name: 'G. Srinivas', phone: '+91 87903 55240', role: 'AGM (Fuel Handling)' }, antiSnipe: 5, validity: 10 },
  { id: 'cat-6', code: 'AUC-2406', title: 'MSTC Eastern Region — Copper, Brass & Cable Scrap', sellerId: 'u-seller-6', status: 'closed', start: -3 * DAY, end: -2 * DAY, pool: 'copperBrass', count: 12, insp: [-6 * DAY, -4 * DAY], contact: { name: 'T. Ghosh', phone: '+91 90070 18836', role: 'Yard Supervisor' }, antiSnipe: 3, validity: 7 },
  { id: 'cat-7', code: 'AUC-2402', title: 'BHEL Trichy — Plant & Machinery, Condemned Assets', sellerId: 'u-seller-7', status: 'closed', start: -7 * DAY, end: -6 * DAY, pool: 'assets', count: 10, insp: [-10 * DAY, -8 * DAY], contact: { name: 'R. Elango', phone: '+91 94430 20951', role: 'Sr. Engineer (Disposals)' }, antiSnipe: 5, validity: 15 },
]

const PHOTO_LABELS = ['Overview', 'Close-up', 'Stack view', 'Weighbridge', 'Condition detail']
const lots = []
const inspectionReports = []
let lotSeq = 0

for (const c of cataloguesDef) {
  const pool = POOLS[c.pool]
  const yard = YARDS[c.id]
  for (let i = 0; i < c.count; i++) {
    lotSeq++
    const t = pool[i % pool.length]
    const [metal, category, grade, uom, rLo, rHi, qLo, qHi] = t
    const desc = t[8]
    const qty = uom === 'MT' ? Math.round(between(qLo, qHi)) : round(between(qLo, qHi), uom === 'PCS' || uom === 'LOT' ? 1 : 100)
    const startRate = round(between(rLo, rHi), uom === 'KG' ? 1 : 100)
    const increment = uom === 'KG' ? pick([1, 2, 5]) : round(startRate * 0.005, 50) || 50
    const reserveRate = round(startRate * between(1.04, 1.12), uom === 'KG' ? 1 : 50)
    const emdBase = startRate * qty * 0.05
    const preBidEmd = Math.min(500000, Math.max(10000, round(emdBase, 5000)))
    const id = `lot-${String(lotSeq).padStart(3, '0')}`
    const hazardous = /oil|Chemicals/i.test(metal + desc) || category === 'chemicals'
    const nPhotos = 2 + Math.floor(rnd() * 3)
    const repId = `ir-${String(lotSeq).padStart(3, '0')}`
    const measured = Math.round(qty * between(0.93, 1.05) * 100) / 100
    const condition = pick(['good', 'good', 'fair', 'mixed'])
    inspectionReports.push({
      id: repId, lotId: id, inspectorId: pick(['u-field-1', 'u-field-2']),
      date: iso(c.insp[0] + Math.floor(between(0, Math.max(60, c.insp[1] - c.insp[0])))),
      measuredQty: measured, uom, condition,
      notes: pick([
        'Stack verified against yard register. Quantity indicative — final on weighment.',
        'Material matches description. Minor surface rust observed, within norms.',
        'Segregation acceptable. Access for 20 ft trucks confirmed at yard gate.',
        'Photos captured from all sides. Weighbridge within 2 km of the yard.',
      ]),
      checklist: [
        { item: 'Material matches declared grade', ok: true },
        { item: 'Quantity verified (visual/weighment)', ok: true },
        { item: 'No hazardous contamination', ok: !hazardous },
        { item: 'Loading access available', ok: true },
        { item: 'Photos captured', ok: true },
      ],
      photoCount: nPhotos, status: 'verified',
    })
    lots.push({
      id, lotNo: `LOT-${String(i + 1).padStart(2, '0')}`, catalogueId: c.id,
      metal, category, grade, indicativeQty: qty, uom,
      yard: yard.name, description: desc, startRate, increment, reserveRate,
      preBidEmd, saleBasis: 'as-is-where-is', hazardous,
      photos: Array.from({ length: nPhotos }, (_, p) => ({ id: `${id}-p${p}`, label: PHOTO_LABELS[p], hue: Math.floor(between(10, 40) + p * 8) })),
      inspectionReportId: repId,
      status: c.status === 'closed' ? 'sold' : c.status === 'live' ? 'live' : 'approved',
      currentRate: null, leadingBidderId: null, bidCount: 0,
      endsAt: iso(c.end), extensions: 0, resultH1Rate: null,
    })
  }
}

/* --------------- pipeline lots (not yet in any catalogue) ---------------- */
const pipelineDefs = [
  ['pending_inspection', 'u-seller-2', 'MS', 'scrap', 'Skull Scrap', 'MT', 26500, 45, 'Furnace skull scrap, oxy-cut to charge size, yard heap 9'],
  ['pending_inspection', 'u-seller-4', 'Aluminium', 'scrap', 'Al Extrusion 6063', 'KG', 156, 5200, 'Aluminium extrusion offcuts 6063, mill finish, bundled'],
  ['pending_inspection', 'u-seller-1', 'MS', 'melting-products', 'Mill Scale', 'MT', 9800, 220, 'Mill scale, Fe ≥ 68 %, ex-rolling mill, loose'],
  ['inspected', 'u-seller-3', 'MS', 'scrap', 'Point & Crossing Scrap', 'MT', 28800, 65, 'Released points and crossings, manganese steel portions included'],
  ['inspected', 'u-seller-6', 'Copper', 'scrap', 'Cu Radiators', 'KG', 445, 2600, 'Copper-brass radiators, drained, no iron attachments'],
  ['inspected', 'u-seller-2', 'SS 304', 'scrap', '304 Skeleton Scrap', 'KG', 96, 8400, 'SS 304 punching skeletons, coiled, baled at source'],
  ['approved', 'u-seller-4', 'Ferro Alloys', 'ferro-alloys', 'FeMn Slag', 'MT', 14500, 180, 'Ferro manganese slag, metal recovery grade, ex-dump'],
  ['approved', 'u-seller-1', 'CI', 'melting-products', 'CI Moulds', 'MT', 23800, 95, 'Rejected CI ingot moulds, cracked, avg 4 MT per piece'],
  ['approved', 'u-seller-5', 'Minerals', 'minerals', 'Bottom Ash', 'MT', 310, 3200, 'Bottom ash ex-dyke, self-loading, moisture ≤ 20 %'],
  ['flagged', 'u-seller-3', 'Assets', 'assets', 'Condemned Cranes', 'PCS', 240000, 3, 'Condemned yard cranes — ownership document mismatch, on hold'],
  ['rejected', 'u-seller-6', 'Brass', 'scrap', 'Mixed Brass', 'KG', 372, 1800, 'Mixed brass scrap — rejected: radioactive source scan pending'],
]
for (const [status, sellerId, metal, category, grade, uom, rate, qty, desc] of pipelineDefs) {
  lotSeq++
  const id = `lot-${String(lotSeq).padStart(3, '0')}`
  const hasReport = status !== 'pending_inspection'
  const repId = hasReport ? `ir-${String(lotSeq).padStart(3, '0')}` : null
  if (hasReport) {
    inspectionReports.push({
      id: repId, lotId: id, inspectorId: 'u-field-1', date: iso(-2 * DAY + lotSeq * 7),
      measuredQty: Math.round(qty * between(0.94, 1.03) * 100) / 100, uom,
      condition: status === 'flagged' ? 'mixed' : 'good',
      notes: status === 'flagged' ? 'Ownership papers do not match yard register — escalated to manager.' : 'Verified at source yard. Ready for cataloguing.',
      checklist: [
        { item: 'Material matches declared grade', ok: status !== 'rejected' },
        { item: 'Quantity verified (visual/weighment)', ok: true },
        { item: 'No hazardous contamination', ok: status !== 'rejected' },
        { item: 'Loading access available', ok: true },
        { item: 'Photos captured', ok: true },
      ],
      photoCount: 3, status: status === 'flagged' ? 'flagged' : status === 'rejected' ? 'rejected' : 'verified',
    })
  }
  const sellerYard = { 'u-seller-1': YARDS['cat-1'], 'u-seller-2': YARDS['cat-2'], 'u-seller-3': YARDS['cat-3'], 'u-seller-4': YARDS['cat-4'], 'u-seller-5': YARDS['cat-5'], 'u-seller-6': YARDS['cat-6'] }[sellerId]
  lots.push({
    id, lotNo: `UNL-${String(lotSeq).padStart(2, '0')}`, catalogueId: null,
    metal, category, grade, indicativeQty: qty, uom, yard: sellerYard.name,
    description: desc, startRate: rate, increment: uom === 'KG' ? 2 : round(rate * 0.005, 50) || 50,
    reserveRate: round(rate * 1.07, 10), preBidEmd: Math.max(10000, round(rate * qty * 0.05, 5000)),
    saleBasis: 'as-is-where-is', hazardous: false,
    photos: Array.from({ length: 3 }, (_, p) => ({ id: `${id}-p${p}`, label: PHOTO_LABELS[p], hue: 20 + p * 10 })),
    inspectionReportId: repId, status,
    currentRate: null, leadingBidderId: null, bidCount: 0,
    endsAt: iso(30 * DAY), extensions: 0, resultH1Rate: null,
  })
}

/* -------------------------------- bids ----------------------------------- */
const bids = []
let bidSeq = 0
const lotById = Object.fromEntries(lots.map((l) => [l.id, l]))

function seedBidsForLot(lot, cat, { closed = false, includeDemoBuyer = false } = {}) {
  const n = closed ? 3 + Math.floor(rnd() * 6) : Math.floor(rnd() * 4)
  let rate = lot.startRate
  const bidders = [...BOTS]
  if (includeDemoBuyer) bidders.push('u-buyer-1', 'u-buyer-1')
  const windowStart = closed ? -300 : -170
  const windowEnd = closed ? -10 : -4
  for (let i = 0; i < n; i++) {
    rate = rate + lot.increment * (1 + Math.floor(rnd() * 3))
    bidSeq++
    bids.push({
      id: `bid-${String(bidSeq).padStart(4, '0')}`, lotId: lot.id, catalogueId: cat.id,
      bidderId: pick(bidders), rate,
      at: iso(Date.parse(cat.endsAt ?? 0) ? 0 : 0), // placeholder, fixed below
      type: rnd() < 0.15 ? 'auto' : 'manual', status: 'valid',
    })
    const catEndMin = cataloguesDef.find((c) => c.id === cat.id).end
    bids[bids.length - 1].at = iso(catEndMin + windowStart + ((windowEnd - windowStart) / n) * i)
  }
  if (n > 0) {
    const last = bids[bids.length - 1]
    lot.currentRate = last.rate
    lot.leadingBidderId = last.bidderId
    lot.bidCount = n
  }
  if (closed) {
    const won = rnd() < 0.72 && lot.currentRate != null
    const meetsReserve = lot.currentRate != null && lot.currentRate >= lot.reserveRate
    lot.resultH1Rate = lot.currentRate
    lot.status = lot.currentRate == null ? 'unsold' : won && meetsReserve ? 'sold' : meetsReserve ? 'sold' : 'sta'
    if (lot.currentRate == null) lot.status = 'unsold'
  }
}

for (const c of cataloguesDef) {
  const catLots = lots.filter((l) => l.catalogueId === c.id)
  if (c.status === 'live') {
    for (const l of catLots) seedBidsForLot(l, c, { includeDemoBuyer: c.id === 'cat-1' && rnd() < 0.5 })
  } else if (c.status === 'closed') {
    for (const l of catLots) seedBidsForLot(l, c, { closed: true, includeDemoBuyer: c.id === 'cat-6' })
  }
}

// guarantee the demo buyer is leading one lot and outbid on another in cat-1
const demoLots = lots.filter((l) => l.catalogueId === 'cat-1').slice(0, 5)
const [dl1, dl2] = demoLots
for (const [lot, winner] of [[dl1, 'u-buyer-1'], [dl2, 'u-buyer-6']]) {
  bidSeq++
  const rate = (lot.currentRate ?? lot.startRate) + lot.increment
  bids.push({ id: `bid-${String(bidSeq).padStart(4, '0')}`, lotId: lot.id, catalogueId: 'cat-1', bidderId: winner === 'u-buyer-1' ? 'u-buyer-6' : 'u-buyer-1', rate, at: iso(-9), type: 'manual', status: 'valid' })
  bidSeq++
  bids.push({ id: `bid-${String(bidSeq).padStart(4, '0')}`, lotId: lot.id, catalogueId: 'cat-1', bidderId: winner, rate: rate + lot.increment, at: iso(-3), type: 'manual', status: 'valid' })
  lot.currentRate = rate + lot.increment
  lot.leadingBidderId = winner
  lot.bidCount += 2
}

// closed cat-6: make sure demo buyer WON two lots (drives fulfilment tracker)
const wonLots = lots.filter((l) => l.catalogueId === 'cat-6').slice(0, 2)
for (const lot of wonLots) {
  bidSeq++
  const rate = (lot.currentRate ?? lot.startRate) + lot.increment * 2
  bids.push({ id: `bid-${String(bidSeq).padStart(4, '0')}`, lotId: lot.id, catalogueId: 'cat-6', bidderId: 'u-buyer-1', rate, at: iso(-2 * DAY - 14), type: 'manual', status: 'valid' })
  lot.currentRate = rate
  lot.leadingBidderId = 'u-buyer-1'
  lot.bidCount += 1
  lot.status = 'sold'
  lot.resultH1Rate = rate
}

/* --------------------------- delivery orders ----------------------------- */
const deliveryOrders = wonLots.map((lot, i) => {
  const materialValue = Math.round(lot.resultH1Rate * lot.indicativeQty)
  const gst = Math.round(materialValue * 0.18)
  const tcs = Math.round(materialValue * 0.01)
  return {
    id: `do-${String(i + 1).padStart(3, '0')}`, lotId: lot.id, catalogueId: 'cat-6', buyerId: 'u-buyer-1',
    stage: i === 0 ? 'lifting_scheduled' : 'payment_pending',
    h1Rate: lot.resultH1Rate, awardedQty: lot.indicativeQty, uom: lot.uom,
    materialValue, gstAmount: gst, tcsAmount: tcs,
    paidAmount: i === 0 ? materialValue + gst + tcs : Math.round((materialValue + gst + tcs) * 0.25),
    liftingBy: iso(5 * DAY), createdAt: iso(-2 * DAY + 300),
  }
})
// one completed DO from an older auction for history
deliveryOrders.push({
  id: 'do-003', lotId: lots.find((l) => l.catalogueId === 'cat-7').id, catalogueId: 'cat-7', buyerId: 'u-buyer-1',
  stage: 'completed', h1Rate: 291000, awardedQty: 2, uom: 'PCS',
  materialValue: 582000, gstAmount: 104760, tcsAmount: 5820, paidAmount: 692580,
  liftingBy: iso(-1 * DAY), createdAt: iso(-6 * DAY + 400),
})

/* ------------------------------- wallets --------------------------------- */
const demoSelection = demoLots.map((l) => l.id) // 5 shortlisted in cat-1
const demoFunded = demoSelection.slice(0, 3) // 3 of 5 EMD-funded (partial — showcases shortfall)
const fundedEmd = demoFunded.reduce((s, id) => s + lotById[id].preBidEmd, 0)

const wallets = [
  {
    userId: 'u-buyer-1', balance: 850000, emdLocked: fundedEmd,
    ledger: [
      { id: 'led-001', at: iso(-12 * DAY), type: 'topup', amount: 1500000, ref: 'UTR-N2607-118842', note: 'RTGS top-up — HDFC ****4412' },
      { id: 'led-002', at: iso(-2 * DAY - 60), type: 'emd_lock', amount: -lotById[wonLots[0].id].preBidEmd, ref: 'EMD-2406-01', lotId: wonLots[0].id, catalogueId: 'cat-6', note: `EMD locked — ${wonLots[0].lotNo} (AUC-2406)` },
      { id: 'led-003', at: iso(-2 * DAY + 320), type: 'payment', amount: -692580, ref: 'PAY-2402-77', lotId: deliveryOrders[2].lotId, catalogueId: 'cat-7', note: 'Material value + GST + TCS — AUC-2402' },
      { id: 'led-004', at: iso(-1 * DAY - 200), type: 'emd_release', amount: lotById[wonLots[0].id].preBidEmd, ref: 'EMDR-2406-01', lotId: wonLots[0].id, catalogueId: 'cat-6', note: 'EMD adjusted into payment — AUC-2406' },
      ...demoFunded.map((id, i) => ({
        id: `led-01${i}`, at: iso(-1 * DAY + 90 + i * 3), type: 'emd_lock', amount: -lotById[id].preBidEmd,
        ref: `EMD-2412-0${i + 1}`, lotId: id, catalogueId: 'cat-1', note: `Pre-bid EMD locked — ${lotById[id].lotNo} (AUC-2412)`,
      })),
      { id: 'led-020', at: iso(-4 * 60), type: 'topup', amount: 200000, ref: 'UTR-U2607-90211', note: 'UPI top-up — arvind@okhdfcbank' },
    ],
  },
  { userId: 'u-buyer-2', balance: 640000, emdLocked: 180000, ledger: [{ id: 'led-b2-1', at: iso(-8 * DAY), type: 'topup', amount: 900000, ref: 'UTR-N2607-22101', note: 'RTGS top-up' }] },
  { userId: 'u-buyer-3', balance: 120000, emdLocked: 45000, ledger: [{ id: 'led-b3-1', at: iso(-15 * DAY), type: 'topup', amount: 200000, ref: 'UTR-N2606-88452', note: 'NetBanking top-up' }] },
  { userId: 'u-buyer-4', balance: 0, emdLocked: 0, ledger: [{ id: 'led-b4-1', at: iso(-60 * DAY), type: 'emd_forfeit', amount: -75000, ref: 'FORF-2394-02', note: 'EMD forfeited — lifting default (AUC-2394)' }] },
  { userId: 'u-buyer-5', balance: 480000, emdLocked: 95000, ledger: [] },
  { userId: 'u-buyer-6', balance: 720000, emdLocked: 260000, ledger: [] },
  { userId: 'u-buyer-7', balance: 310000, emdLocked: 60000, ledger: [] },
  { userId: 'u-buyer-8', balance: 50000, emdLocked: 0, ledger: [{ id: 'led-b8-1', at: iso(-2 * DAY), type: 'topup', amount: 50000, ref: 'UTR-U2607-30112', note: 'UPI top-up' }] },
]

/* ------------------------------ selections -------------------------------- */
const selections = [
  { buyerId: 'u-buyer-1', catalogueId: 'cat-1', lotIds: demoSelection, emdFundedLotIds: demoFunded },
  { buyerId: 'u-buyer-2', catalogueId: 'cat-2', lotIds: lots.filter((l) => l.catalogueId === 'cat-2').slice(0, 4).map((l) => l.id), emdFundedLotIds: lots.filter((l) => l.catalogueId === 'cat-2').slice(0, 2).map((l) => l.id) },
]

const autoBids = [
  { buyerId: 'u-buyer-1', lotId: demoSelection[2], maxRate: Math.round(lotById[demoSelection[2]].startRate * 1.18), active: true },
]

/* ---------------------------- notifications ------------------------------ */
const notifications = [
  { id: 'ntf-01', userId: 'u-buyer-1', kind: 'bid', title: 'You have been outbid', body: `OmShakti Metal Corp is leading ${dl2.lotNo} (AUC-2412) at ₹${(dl2.currentRate).toLocaleString('en-IN')}/${dl2.uom}.`, at: iso(-3), read: false, href: `/bidding/cat-1?lot=${dl2.id}` },
  { id: 'ntf-02', userId: 'u-buyer-1', kind: 'lifecycle', title: 'AUC-2418 closing soon', body: 'East Coast Railway catalogue closes in under 30 minutes. 2 of your watched lots are still open.', at: iso(-16), read: false, href: '/catalogue/cat-3' },
  { id: 'ntf-03', userId: 'u-buyer-1', kind: 'wallet', title: 'EMD locked for 3 lots', body: `₹${fundedEmd.toLocaleString('en-IN')} locked against AUC-2412 shortlist. 2 lots still unfunded.`, at: iso(-1 * DAY + 95), read: true, href: '/buyer/shortlist' },
  { id: 'ntf-04', userId: 'u-buyer-1', kind: 'bid', title: 'You won 2 lots in AUC-2406', body: 'Congratulations — H1 confirmed on both lots. Delivery order do-001 issued; payment pending on do-002.', at: iso(-2 * DAY + 290), read: true, href: '/buyer/fulfilment' },
  { id: 'ntf-05', userId: 'u-buyer-1', kind: 'wallet', title: 'Wallet top-up successful', body: '₹2,00,000 added via UPI (arvind@okhdfcbank). Available balance ₹8,50,000.', at: iso(-4 * 60), read: true, href: '/buyer/wallet' },
  { id: 'ntf-06', userId: 'u-buyer-1', kind: 'system', title: 'Inspection slot confirmed', body: 'JSW Vijayanagar (AUC-2421) — visit booked. Gate pass QR available in Inspection & Contacts.', at: iso(-7 * 60), read: true, href: '/catalogue/cat-4' },
  { id: 'ntf-07', userId: null, kind: 'system', title: 'Scheduled maintenance', body: 'ferroBid will be unavailable Sun 02:00–04:00 IST for planned maintenance. No auctions close in this window.', at: iso(-1 * DAY), read: false },
  { id: 'ntf-08', userId: 'u-buyer-1', kind: 'lifecycle', title: 'AUC-2421 starts tomorrow', body: 'JSW Vijayanagar non-ferrous catalogue goes live at 14:00 IST tomorrow. 16 lots. Fund EMD early to avoid the rush.', at: iso(-2 * 60), read: false, href: '/catalogue/cat-4' },
  { id: 'ntf-09', userId: 'u-seller-2', kind: 'lifecycle', title: 'Your catalogue is live', body: 'AUC-2415 (SS Offcuts) is receiving bids — 14 lots live, 9 with activity.', at: iso(-2 * DAY), read: true },
  { id: 'ntf-10', userId: 'u-exec-1', kind: 'system', title: '3 lots awaiting approval', body: 'Inspected lots from ECoR and MSTC are pending your approval before cataloguing.', at: iso(-5 * 60), read: false },
]

/* ---------------------------- announcements ------------------------------ */
const announcements = [
  { id: 'ann-01', scope: 'platform', title: 'TCS @1% applicable on all scrap sales', body: 'Per Section 206C(1H), TCS at 1% of sale consideration applies on all successful bids. TCS is collected with the final payment and reflected on the tax invoice.', at: iso(-9 * DAY), severity: 'info' },
  { id: 'ann-02', scope: 'platform', title: 'Revised EMD refund timeline', body: 'EMD for unsuccessful bidders is now auto-released within 24 hours of catalogue close (previously 72 hours).', at: iso(-5 * DAY), severity: 'info' },
  { id: 'ann-03', scope: 'catalogue', catalogueId: 'cat-1', title: 'Lot 07 quantity revised', body: 'Indicative quantity for LOT-07 revised from 60 MT to 52 MT after re-measurement. Final quantity on weighment as always.', at: iso(-1 * DAY + 200), severity: 'warning' },
  { id: 'ann-04', scope: 'catalogue', catalogueId: 'cat-3', title: 'Lifting window extended', body: 'Due to yard congestion at Mancheswar Depot, the lifting window for all lots is extended by 5 working days.', at: iso(-3 * 60), severity: 'info' },
  { id: 'ann-05', scope: 'catalogue', catalogueId: 'cat-4', title: 'Inspection: max 2 persons per firm', body: 'Yard security requires prior gate-pass booking. Maximum 2 representatives per bidding firm. Carry photo ID matching the booking.', at: iso(-1 * DAY), severity: 'warning' },
]

/* ------------------------------ terms sets -------------------------------- */
const termsSets = [
  {
    id: 'ts-standard', name: 'Standard Scrap Disposal Terms', version: 'v4.2',
    general: [
      'All material is sold on "AS IS WHERE IS" and "NO COMPLAINT" basis. Quantity, quality, grade and description are indicative only; bidders must satisfy themselves by physical inspection before bidding.',
      'The rate quoted is per unit of measurement (UOM) stated against each lot, exclusive of GST, TCS and other statutory levies, which are payable extra at actuals.',
      'Pre-bid EMD must be funded lot-wise before the bid is accepted. EMD of unsuccessful bidders is auto-released within 24 hours of catalogue close.',
      'The highest bid (H1) is subject to seller approval where the reserve rate is not met (Subject To Approval — STA).',
      'Full material value plus taxes must be paid within the bid-validity period stated on the catalogue, failing which EMD stands forfeited.',
      'Final quantity is determined on weighment at the designated weighbridge; payment is adjusted pro-rata to the weighed quantity.',
      'Material must be lifted within the lifting window in the delivery order. Ground rent applies thereafter.',
    ],
    special: [
      'Gas cutting inside the yard is permitted only with yard in-charge approval and a valid hot-work permit.',
      'Loading is the buyer’s responsibility. Cranes/forklifts may be available on chargeable basis with prior booking.',
      'Vehicles must carry a valid e-way bill before exiting the plant gate.',
    ],
    lotSpecificNote: 'Where lot-specific conditions are stated in the lot description or annexure, they take precedence over Special Conditions, which take precedence over General Conditions.',
  },
  {
    id: 'ts-hazmat', name: 'Hazardous & Regulated Material Terms', version: 'v2.1',
    general: [
      'Sold on "AS IS WHERE IS" basis to buyers holding valid authorisation from the State Pollution Control Board for the applicable waste category.',
      'Buyer must produce Form-10/manifest documentation at the time of lifting for each consignment.',
      'Rates are exclusive of GST and applicable cess; statutory levies extra at actuals.',
      'EMD is forfeited in full if authorisation documents are found invalid after award.',
    ],
    special: [
      'Used oil lots: transportation only in leak-proof HDPE drums / tankers licensed for hazardous cargo.',
      'PCB-free certificates are available in the Documents tab and form part of the sale description.',
    ],
    lotSpecificNote: 'Lot-specific regulatory conditions in the annexure take precedence over all other conditions.',
  },
]

/* -------------------------------- disputes -------------------------------- */
const disputes = [
  {
    id: 'dsp-001', userId: 'u-buyer-1', subject: 'Weighment variance beyond 5% on LOT-04', category: 'quantity',
    lotId: wonLots[1]?.id, status: 'in_review', createdAt: iso(-1 * DAY + 30),
    messages: [
      { from: 'user', body: 'Weighbridge shows 7.2% less than the awarded indicative quantity. Requesting pro-rata adjustment on the balance payment as per clause 6.', at: iso(-1 * DAY + 30) },
      { from: 'support', body: 'Acknowledged. We have requested the yard weighment slips and CCTV weighbridge log from MSTC. Expect an update within 2 working days.', at: iso(-1 * DAY + 210) },
    ],
  },
  {
    id: 'dsp-002', userId: 'u-buyer-1', subject: 'Gate pass delay at BHEL Trichy', category: 'lifting',
    lotId: deliveryOrders[2].lotId, status: 'resolved', createdAt: iso(-5 * DAY),
    messages: [
      { from: 'user', body: 'Trucks waited 6 hours at Gate 2 on lifting day. Requesting waiver of ground rent for one day.', at: iso(-5 * DAY) },
      { from: 'support', body: 'Seller has confirmed the delay was on the yard side. One day ground-rent waiver approved and reflected in your ledger.', at: iso(-4 * DAY) },
    ],
  },
]

/* ------------------------------ audit events ------------------------------ */
const auditActions = [
  ['u-super-1', 'catalogue.publish', 'AUC-2412', 'Published SAIL Bhilai catalogue with 18 lots', 'info'],
  ['u-exec-1', 'lot.approve', 'UNL-104', 'Approved Point & Crossing Scrap after inspection review', 'info'],
  ['u-sub-1', 'bid.flag', 'bid-0031', 'Flagged rapid bid pattern on LOT-09 (AUC-2415) for review', 'warning'],
  ['u-super-1', 'bid.void', 'bid-0018', 'Voided bid — bidder wallet failed EMD re-validation', 'critical'],
  ['u-super-1', 'user.blacklist', 'u-buyer-4', 'Moved Jindal Ispat Udyog to defaulters — repeat lifting default', 'critical'],
  ['u-exec-1', 'auction.extend', 'AUC-2406', 'Anti-snipe auto-extension ×3 on LOT-02 (final 3 minutes)', 'info'],
  ['u-super-1', 'config.update', 'financial.tcs', 'TCS rate confirmed at 1% for FY 2026-27', 'info'],
  ['u-sub-1', 'kyc.review', 'u-buyer-8', 'Requested GSTIN clarification from Punjab Rolling Mills', 'info'],
  ['u-super-1', 'auction.pause', 'AUC-2402', 'Paused catalogue for 12 min during payment-gateway incident', 'warning'],
  ['u-exec-1', 'settlement.approve', 'do-001', 'Approved settlement & DO issue for AUC-2406 / LOT-01', 'info'],
  ['u-field-1', 'inspection.submit', 'ir-101', 'Submitted inspection — Skull Scrap, Burma Mines Yard', 'info'],
  ['u-exec-1', 'lot.flag', 'UNL-113', 'Held Condemned Cranes — ownership document mismatch', 'warning'],
]
const auditEvents = auditActions.map(([actorId, action, target, detail, severity], i) => ({
  id: `aud-${String(i + 1).padStart(3, '0')}`, at: iso(-i * 340 - 25), actorId, action, target, detail, severity,
}))

/* ---------------------------- inspection slots ---------------------------- */
const inspectionSlots = [
  { id: 'slot-001', catalogueId: 'cat-4', userId: 'u-buyer-1', date: iso(20 * 60), window: '10:00–13:00 IST', persons: 2, status: 'booked', passCode: 'FB-GATE-7C42' },
]

/* -------------------------------- write ---------------------------------- */
const catalogues = cataloguesDef.map((c) => ({
  id: c.id, code: c.code, title: c.title, sellerId: c.sellerId, type: 'forward',
  status: c.status, startsAt: iso(c.start), endsAt: iso(c.end),
  inspectionFrom: iso(c.insp[0]), inspectionTo: iso(c.insp[1]),
  inspectionHours: '10:00–16:00 IST', inspectionContact: c.contact,
  yardName: YARDS[c.id].name, yardAddress: YARDS[c.id].addr, region: YARDS[c.id].region,
  antiSnipeMinutes: c.antiSnipe, bidValidityDays: c.validity,
  lotIds: lots.filter((l) => l.catalogueId === c.id).map((l) => l.id),
  documents: [
    { id: `${c.id}-doc-1`, name: `${c.code} Catalogue & Annexure.pdf`, type: 'pdf', size: '2.4 MB' },
    { id: `${c.id}-doc-2`, name: 'Yard Map & Gate Directions.pdf', type: 'pdf', size: '810 KB' },
    { id: `${c.id}-doc-3`, name: 'Payment Schedule & Bank Details.xlsx', type: 'xlsx', size: '96 KB' },
    ...(c.pool === 'ssOffcuts' ? [{ id: `${c.id}-doc-4`, name: 'Sample Test Certificates.zip', type: 'zip', size: '5.1 MB' }] : []),
    ...(c.pool === 'coal' ? [{ id: `${c.id}-doc-4`, name: 'PCB-Free Certificates (Used Oil).pdf', type: 'pdf', size: '1.2 MB' }] : []),
  ],
  termsSetId: c.pool === 'coal' ? 'ts-hazmat' : 'ts-standard',
  description: `E-auction of ${c.title.split('—')[1]?.trim() ?? 'industrial material'} on as-is-where-is basis. Physical inspection completed and reports attached against each lot. Quantity indicative — final on weighment.`,
}))

const files = {
  'anchor.json': { anchor: new Date(ANCHOR).toISOString() },
  'catalogues.json': catalogues,
  'lots.json': lots,
  'users.json': users,
  'bids.json': bids,
  'wallets.json': wallets,
  'inspectionReports.json': inspectionReports,
  'notifications.json': notifications,
  'termsSets.json': termsSets,
  'deliveryOrders.json': deliveryOrders,
  'announcements.json': announcements,
  'disputes.json': disputes,
  'auditEvents.json': auditEvents,
  'selections.json': selections,
  'autoBids.json': autoBids,
  'inspectionSlots.json': inspectionSlots,
}
for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2) + '\n')
}
console.log(`Wrote ${Object.keys(files).length} files → src/data/mock/`)
console.log(`catalogues=${catalogues.length} lots=${lots.length} bids=${bids.length} users=${users.length}`)
