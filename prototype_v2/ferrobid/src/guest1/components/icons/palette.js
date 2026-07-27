// Shared accent palette for the animated "How It Works" step icons.
//
// Each icon's *base* line-work stays on `currentColor` — that inherits the
// per-step accent set on `.hiw-step-card` (`--hiw-accent`), so the five steps
// read as five different colours. The values below are the semantic pops
// layered on top of that base: the thing being verified goes green, the thing
// being watched goes red, the thing being won goes gold, and so on.
export const ICON_COLORS = {
  gold: '#fbbf24',
  amber: '#f59e0b',
  green: '#22c55e',
  mint: '#34d399',
  sky: '#38bdf8',
  violet: '#a78bfa',
  red: '#f43f5e',
  steel: '#94a3b8',
  white: '#ffffff',
  ink: '#0a1220', // panel navy — used to knock glyphs out of filled badges
};

/**
 * Returns a tint function for an icon's semantic colours.
 *
 * While the sequence is running each icon is fully polychrome. Once every step
 * has played (`unified`), all five icons drop their semantic colours to
 * `currentColor` so the whole row resolves together onto the theme ember —
 * the swap is smoothed by the `fill`/`stroke` transition on `.hiw-step-icon *`.
 *
 * Pass `ICON_COLORS.ink` through untinted: it knocks glyphs out of filled
 * badges and must stay dark whatever the surrounding colour is.
 */
export function makeTint(unified) {
  return (color) => (unified ? 'currentColor' : color);
}
