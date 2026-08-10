/* Maps real Catalogue + Lot[] + seller User (from the Zustand store) into the
   flat auction-card shape src/guest1/pages/Marketplace.jsx and
   src/guest1/components/AuctionCard.jsx already consume, so the guest
   marketplace can read the same data as #/buyermarketplace without touching
   either component's filtering/sort/pagination/JSX logic. */
import { inr } from '../../lib/format';
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
