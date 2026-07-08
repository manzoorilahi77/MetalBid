/**
 * JS-side color constants.
 *
 * The single source of truth for every color is `src/index.css` (brand palette
 * in @theme, semantic light/dark tokens in :root / [data-theme="dark"]).
 * Use these when you need a color in JS (inline styles, canvas, charts) —
 * they resolve through the CSS variables, so they follow the active theme
 * and any palette change made in index.css.
 */
export const COLOR = {
  // brand
  steel: (shade: 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950) => `var(--color-steel-${shade})`,
  ember: (shade: 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950) => `var(--color-ember-${shade})`,
  // semantic (theme-aware)
  canvas: 'var(--canvas)',
  surface: 'var(--surface)',
  ink: 'var(--ink)',
  body: 'var(--body)',
  muted: 'var(--muted)',
  faint: 'var(--faint)',
  line: 'var(--line)',
} as const;

/** Celebration confetti — brand + supporting hues. */
export const CONFETTI_COLORS = [
  'var(--color-ember-500)',
  'var(--color-ember-300)',
  'var(--color-steel-500)',
  'var(--color-steel-300)',
  '#10b981',
  '#facc15',
];
