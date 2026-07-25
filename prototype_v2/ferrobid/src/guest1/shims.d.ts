/* The migrated homepage is plain JS/JSX and is intentionally NOT type-checked
   by the manager's `tsc` (the tsconfig has no `allowJs`). This ambient
   declaration lets the single .tsx→.jsx bridge import in Guest1App.tsx resolve
   as `any` so `tsc -b` succeeds without pulling the homepage into the program. */
declare module '*.jsx'
