import type { MetalCategory } from '../types'

/** Curated real photos per category (Wikimedia Commons), used to back PhotoThumb. */
export const CATEGORY_IMAGES: Record<MetalCategory, string[]> = {
  assets: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Caterpillar_330_excavator_on_a_pile_of_dirt.jpg/960px-Caterpillar_330_excavator_on_a_pile_of_dirt.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/2023-02-13_-_JCB_JS220LC_hydraulic_excavator_-_01.jpg/960px-2023-02-13_-_JCB_JS220LC_hydraulic_excavator_-_01.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/C620-1B_centre_lathe_%281975%29_20260331124639.jpg/960px-C620-1B_centre_lathe_%281975%29_20260331124639.jpg',
  ],
  scrap: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Schrottplatz_EMR_European_Metal_Recycling%2C_Ro%C3%9Fhafen%2C_Hambug-9371.jpg/960px-Schrottplatz_EMR_European_Metal_Recycling%2C_Ro%C3%9Fhafen%2C_Hambug-9371.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Scrap_Metal_%28Eugene%2C_Oregon%29.jpg/960px-Scrap_Metal_%28Eugene%2C_Oregon%29.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/d/d5/CompactedSteelScraps.jpg',
  ],
  'flat-products': [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/HDG_Coils_-_Leeco_Steel_Trading_-_Antonio_Carlos_Rosset.jpg/960px-HDG_Coils_-_Leeco_Steel_Trading_-_Antonio_Carlos_Rosset.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Colored_steel_coils.jpg/960px-Colored_steel_coils.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Steel_coil_and_machinery_-_geograph.org.uk_-_8200249.jpg/960px-Steel_coil_and_machinery_-_geograph.org.uk_-_8200249.jpg',
  ],
  'long-products': [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/A_bunch_of_rebar_up_close.jpg/960px-A_bunch_of_rebar_up_close.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Rebar_01.JPG/960px-Rebar_01.JPG',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Baustelle-H%C3%B6lzla-Rebar-6228085.jpg/960px-Baustelle-H%C3%B6lzla-Rebar-6228085.jpg',
  ],
  'melting-products': [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Metal_being_poured_during_the_investment_casting_process..jpg/960px-Metal_being_poured_during_the_investment_casting_process..jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Transferring_molten_metal_from_the_furnace_to_the_ladle.jpg/960px-Transferring_molten_metal_from_the_furnace_to_the_ladle.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Celsa_Steel_Works_%2830910245794%29.jpg/960px-Celsa_Steel_Works_%2830910245794%29.jpg',
  ],
  coal: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Coal_pile_in_Hanasaari%2C_Helsinki%2C_Finland%2C_2007.jpg/960px-Coal_pile_in_Hanasaari%2C_Helsinki%2C_Finland%2C_2007.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Coal_pile_in_Hanasaari%2C_Helsinki%2C_Finland%2C_2008.jpg/960px-Coal_pile_in_Hanasaari%2C_Helsinki%2C_Finland%2C_2008.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Coal_pile_at_Golden_Spike_National_Historical_Park%2C_Feb_17.jpg/960px-Coal_pile_at_Golden_Spike_National_Historical_Park%2C_Feb_17.jpg',
  ],
  chemicals: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Barrels_filled_with_sealants.jpg/960px-Barrels_filled_with_sealants.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Blue_Grass_Chemical_Agent-Destruction_Pilot_Plant_Bulk_Chemical_Storage_Tank_%286377565825%29.jpg/960px-Blue_Grass_Chemical_Agent-Destruction_Pilot_Plant_Bulk_Chemical_Storage_Tank_%286377565825%29.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Blue_Grass_Chemical_Agent-Destruction_Pilot_Plant_Water_Storage_Tanks_%283739846236%29.jpg/960px-Blue_Grass_Chemical_Agent-Destruction_Pilot_Plant_Water_Storage_Tanks_%283739846236%29.jpg',
  ],
  minerals: [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/M2500_stockpile_conveyor_and_washed_iron_ore_%286325636374%29.jpg/960px-M2500_stockpile_conveyor_and_washed_iron_ore_%286325636374%29.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Washed_and_dewatered_iron_ore_fines_are_stockpiled_%286025446558%29.jpg/960px-Washed_and_dewatered_iron_ore_fines_are_stockpiled_%286025446558%29.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Waste_rock_pile_%28Continental_Mine%2C_Butte%2C_Montana%2C_USA%29_2.jpg/960px-Waste_rock_pile_%28Continental_Mine%2C_Butte%2C_Montana%2C_USA%29_2.jpg',
  ],
  'ferro-alloys': [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Xstrata_ferrochroom-smelteraanleg%2C_Lydenburg%2C_Mpumalanga.jpg/960px-Xstrata_ferrochroom-smelteraanleg%2C_Lydenburg%2C_Mpumalanga.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Outokumpu_mill_in_Tornio_20121015.jpg/960px-Outokumpu_mill_in_Tornio_20121015.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Outokumpu_mills_in_Tornio_May2009.jpg/960px-Outokumpu_mills_in_Tornio_May2009.jpg',
  ],
}

/** Deterministically pick one image for a category, varied by seed (e.g. a photo's hue). */
export function categoryImageUrl(category: MetalCategory, seed: number): string {
  const imgs = CATEGORY_IMAGES[category]
  return imgs[Math.abs(Math.round(seed)) % imgs.length]
}
