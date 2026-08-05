/* `@svg-maps/*` ships types that import from `svg-maps__common`, which the
   package doesn't depend on. Declare the shape here so `tsc -b` resolves the
   India map import without pulling in an extra @types package. */
declare module 'svg-maps__common' {
  export interface Location {
    id: string
    name: string
    path: string
  }
  export interface Map {
    label: string
    viewBox: string
    locations: Location[]
  }
}
