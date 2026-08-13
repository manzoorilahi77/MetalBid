/* The metal taxonomy every catalogue is built from — a plain module so both the
   store (which seeds Master data from it) and the domain components can read it
   without an import cycle. Re-exported from components/domain for existing
   callers. */
import type { MetalCategory } from '../types'

export const CATEGORY_META: { key: MetalCategory; label: string; hue: number }[] = [
  { key: 'assets', label: 'Assets & Machinery', hue: 210 },
  { key: 'scrap', label: 'Scrap', hue: 20 },
  { key: 'flat-products', label: 'Flat Products', hue: 200 },
  { key: 'long-products', label: 'Long Products', hue: 30 },
  { key: 'melting-products', label: 'Melting Products', hue: 10 },
  { key: 'coal', label: 'Coal', hue: 260 },
  { key: 'chemicals', label: 'Chemicals', hue: 150 },
  { key: 'minerals', label: 'Minerals', hue: 90 },
  { key: 'ferro-alloys', label: 'Ferro Alloys', hue: 330 },
]
