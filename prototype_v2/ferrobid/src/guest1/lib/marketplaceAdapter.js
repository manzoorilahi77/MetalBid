/* Maps real Catalogue + Lot[] + seller User (from the Zustand store) into the
   flat auction-card shape src/guest1/pages/Marketplace.jsx and
   src/guest1/components/AuctionCard.jsx already consume, so the guest
   marketplace can read the same data as #/buyermarketplace without touching
   either component's filtering/sort/pagination/JSX logic. */
import { fmtDate, inr } from '../../lib/format';
import { catalogueUiStatus } from '../../store/store';
import { asset } from '../utils/asset';

const METAL_TO_CATEGORY = {
  MS: 'Ferrous',
  CI: 'Ferrous',
  'SS 304': 'Stainless Steel',
  'SS 316': 'Stainless Steel',
  'SS 409': 'Stainless Steel',
  Aluminium: 'Non-Ferrous',
  Copper: 'Non-Ferrous',
  Brass: 'Non-Ferrous',
  Zinc: 'Non-Ferrous',
  Assets: 'Minor Metals',
  Chemicals: 'Minor Metals',
  Coal: 'Minor Metals',
  'Ferro Alloys': 'Minor Metals',
  'Long Products': 'Minor Metals',
  Minerals: 'Minor Metals',
};

const NON_FERROUS_IMAGE = {
  Aluminium: 'aluminium_scrap.png',
  Copper: 'copper_wire.png',
  Zinc: 'zinc_dross.png',
  Brass: 'brass_borings.png',
};

/** Most common `metal` value across a catalogue's lots. Ties keep whichever
    metal was seen first, so the result is deterministic across renders. */
const dominantMetal = (catLots) => {
  const counts = new Map();
  for (const lot of catLots) counts.set(lot.metal, (counts.get(lot.metal) ?? 0) + 1);
  let best = null;
  let bestCount = 0;
  for (const [metal, count] of counts) {
    if (count > bestCount) {
      best = metal;
      bestCount = count;
    }
  }
  return best;
};

const categoryFor = (catLots) => METAL_TO_CATEGORY[dominantMetal(catLots)] ?? 'Minor Metals';

const imageFor = (category, catLots) => {
  if (category === 'Non-Ferrous') {
    const file = NON_FERROUS_IMAGE[dominantMetal(catLots)] ?? 'hms_scrap.png';
    return asset(`/images/auctions/${file}`);
  }
  if (category === 'Stainless Steel') return asset('/images/auctions/cr_coil.png');
  return asset('/images/auctions/hms_scrap.png');
};

/** One Catalogue (+ its Lot[], + its seller User) -> the AuctionCard shape. */
export function catalogueToAuction(cat, catLots, seller) {
  const category = categoryFor(catLots);
  const uom = catLots[0]?.uom ?? 'MT';
  const qtyTotal = catLots.reduce((sum, lot) => sum + lot.indicativeQty, 0);
  const priceNum = catLots.length ? Math.min(...catLots.map((lot) => lot.preBidEmd)) : 0;
  const uiStatus = catalogueUiStatus(cat, Date.now());

  return {
    id: cat.code,
    catalogueId: cat.id,
    material: cat.title,
    seller: seller?.firm ?? 'Verified Seller',
    location: cat.region,
    state: cat.region,
    qty: `${qtyTotal} ${uom}`,
    price: inr(priceNum),
    priceNum,
    category,
    type: category.toLowerCase(),
    isLive: uiStatus === 'live' || uiStatus === 'closing',
    img: imageFor(category, catLots),
  };
}

/* ---------------------------------------------------------------------------
   Homepage feeds.

   The two bands on the homepage — Live Activity and Forthcoming Auctions — read
   the same store the marketplace and every signed-in screen read, so a lot that
   is taking bids right now says so on the homepage, and a catalogue that opened
   on schedule leaves the forthcoming rail by itself. Both feeds carry the
   catalogue id, because both are doors into that catalogue's page.
--------------------------------------------------------------------------- */

/** Lots grouped by catalogue once, rather than a scan of every lot per row. */
const lotsByCatalogue = (lots) => {
  const map = new Map();
  for (const lot of lots) {
    const list = map.get(lot.catalogueId);
    if (list) list.push(lot);
    else map.set(lot.catalogueId, [lot]);
  }
  return map;
};

/** "Bhilai, CG" → { city: 'Bhilai', state: 'CG' }. */
export const splitRegion = (region) => {
  const [city, state = ''] = String(region ?? '').split(',').map((part) => part.trim());
  return { city, state };
};

/* Only three beads are styled (.ticker-dot.ferrous / .aluminium / .copper in
   guest1/styles/index.css), so every metal has to resolve to one of them — an
   unmapped class paints no colour at all. */
const TICKER_BEAD = { Aluminium: 'aluminium', Copper: 'copper', Brass: 'copper' };

/** What is being bid on at this instant: every live lot inside a live
 *  catalogue, closing soonest first.
 *
 *  Ordered by close time rather than by last bid on purpose — the band is a
 *  marquee, and re-sorting it each time a bid lands would slide every pill
 *  sideways under the reader. The figures inside the pills are read straight
 *  off the lot, so they still move the moment a bid does. */
export function liveActivityFeed(catalogues, lots, now, limit = 12) {
  const byCat = lotsByCatalogue(lots);
  const items = [];
  let auctions = 0;
  for (const cat of catalogues) {
    const catLots = byCat.get(cat.id) ?? [];
    const ui = catalogueUiStatus(cat, now, catLots);
    if (ui !== 'live' && ui !== 'closing') continue;
    auctions += 1;
    const { city, state } = splitRegion(cat.region);
    for (const lot of catLots) {
      if (lot.status !== 'live') continue;
      items.push({
        key: lot.id,
        catalogueId: cat.id,
        material: `${lot.metal} ${lot.grade}`,
        city,
        state,
        rate: lot.currentRate ?? lot.startRate,
        uom: lot.uom,
        /** false → nobody has bid yet, so the figure is the opening rate. */
        hasBid: lot.currentRate != null,
        endsAt: lot.endsAt,
        bead: TICKER_BEAD[lot.metal] ?? 'ferrous',
      });
    }
  }
  items.sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt));
  return { auctions, items: items.slice(0, limit) };
}

/** Catalogues published but not yet open, soonest first. */
export function forthcomingAuctions(catalogues, lots, users, now, limit = 8) {
  const byCat = lotsByCatalogue(lots);
  return catalogues
    .filter((cat) => catalogueUiStatus(cat, now, byCat.get(cat.id) ?? []) === 'upcoming')
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, limit)
    .map((cat) => {
      const catLots = byCat.get(cat.id) ?? [];
      const category = categoryFor(catLots);
      return {
        catalogueId: cat.id,
        code: cat.code,
        company: users.find((u) => u.id === cat.sellerId)?.firm ?? 'Verified Seller',
        loc: cat.region,
        cat: (dominantMetal(catLots) ?? category).toUpperCase(),
        startsAt: cat.startsAt,
        date: fmtDate(cat.startsAt),
        lots: catLots.length,
        /* The lowest pre-bid EMD in the catalogue — what it costs to get into
           the sale at all, rather than a figure covering every lot in it. */
        emd: catLots.length ? inr(Math.min(...catLots.map((l) => l.preBidEmd))) : '—',
        img: imageFor(category, catLots),
      };
    });
}
