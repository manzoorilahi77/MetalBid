/* ---------------------------------------------------------------------------
   Time handling for FerroBid.

   The database server's clock is EDT (US Eastern) and we do not change it.
   Instead the rule is enforced entirely on our side:

     STORE   every instant as UTC, in DATETIME(3) columns
     COMPUTE every deadline in UTC milliseconds
     DISPLAY every instant as IST (Asia/Kolkata) at the edge, never before

   Two things are therefore banned in FerroBid SQL, and both are banned because
   they silently resolve against the server's EDT clock:

     - TIMESTAMP columns  -> use DATETIME(3); TIMESTAMP is re-interpreted on
                             read/write using the session time zone
     - NOW() / CURRENT_TIMESTAMP defaults -> pass nowUtc() from the app instead

   IST is UTC+05:30 year round (India observes no daylight saving), so the
   offset is fixed -- but formatting still goes through Intl so that weekday
   and month names, and any future locale work, stay correct.
--------------------------------------------------------------------------- */

export const IST_TIMEZONE = 'Asia/Kolkata'
export const IST_OFFSET_MINUTES = 330 // +05:30, no DST

/** The current instant, as a Date. Always UTC-based; never the DB's clock. */
export const nowUtc = () => new Date()

/** Milliseconds since epoch — the form auction countdowns and anti-snipe use. */
export const nowMs = () => Date.now()

/** JS Date -> the literal a DATETIME(3) column stores: 'YYYY-MM-DD HH:MM:SS.mmm' in UTC. */
export function toDbDateTime(value) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) throw new TypeError(`toDbDateTime: invalid date ${value}`)
  return d.toISOString().slice(0, 23).replace('T', ' ')
}

/** A DATETIME(3) value read back from MySQL -> a correct UTC Date.
 *  Accepts both the driver's Date objects and raw strings. */
export function fromDbDateTime(value) {
  if (value == null) return null
  if (value instanceof Date) return value
  return new Date(value.replace(' ', 'T') + 'Z')
}

const istFormat = (opts) => new Intl.DateTimeFormat('en-IN', { timeZone: IST_TIMEZONE, ...opts })

const FORMATS = {
  //                                     e.g.
  datetime: istFormat({ dateStyle: 'medium', timeStyle: 'short' }),   // 19 Aug 2026, 10:34 am
  date:     istFormat({ dateStyle: 'medium' }),                       // 19 Aug 2026
  time:     istFormat({ timeStyle: 'short' }),                        // 10:34 am
  full:     istFormat({ dateStyle: 'full', timeStyle: 'medium' }),    // Wednesday 19 August 2026, 10:34:05 am
}

/** Render an instant in IST for a human. `style` is one of the FORMATS keys. */
export function formatIst(value, style = 'datetime') {
  const d = fromDbDateTime(value)
  if (!d) return ''
  const fmt = FORMATS[style]
  if (!fmt) throw new TypeError(`formatIst: unknown style ${style}`)
  return fmt.format(d)
}

/** IST wall-clock parts of an instant — for grouping reports by Indian calendar day. */
export function istParts(value) {
  const d = fromDbDateTime(value)
  const p = Object.fromEntries(
    istFormat({ year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      .formatToParts(d).filter((x) => x.type !== 'literal').map((x) => [x.type, x.value]),
  )
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute, second: +p.second }
}

/** 'YYYY-MM-DD' for the IST calendar day an instant falls in. Use this to bucket
 *  finance and auction reports — bucketing by UTC day shifts the boundary 5.5h. */
export function istDateKey(value) {
  const { year, month, day } = istParts(value)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** IST wall-clock time -> the UTC instant it denotes.
 *  How an operator's "close this auction at 4:30 pm" becomes a stored deadline. */
export function istToUtc(year, month, day, hour = 0, minute = 0, second = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second) - IST_OFFSET_MINUTES * 60_000)
}
