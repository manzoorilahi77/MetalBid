/* Vite does NOT rewrite absolute URLs written inside JS/JSX, so a literal
   "/logo.png" stays "/logo.png" in the bundle. That works on `npm run dev`
   (served from "/") but 404s on GitHub Pages, where the site lives under
   /MetalBid/. Every public/ asset referenced from code must therefore be
   prefixed with import.meta.env.BASE_URL — this helper does exactly that.

     asset('/logo.png')  ->  './logo.png'  (base './')

   Guest2 already does this inline; guest1 uses this helper instead. */
export const asset = (path) =>
  `${import.meta.env.BASE_URL}${String(path).replace(/^\/+/, '')}`;
