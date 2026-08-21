/* ---------------------------------------------------------------------------
   Input validation.

   Small and hand-written. A schema library would be more expressive, but every
   endpoint here takes between one and six fields, and the failure this file
   exists to prevent is not "the shape was subtly wrong" — it is "nobody checked
   at all", which is what `req.body?.ops` and `req.body?.value` were doing.

   Every helper throws a 400 the error handler already knows how to render, and
   every message says what to send rather than what was wrong with what arrived.
--------------------------------------------------------------------------- */

export const invalid = (message) =>
  Object.assign(new Error(message), { status: 400, code: 'invalid_request', expected: true })

export function str(value, field, { min = 1, max = 255, trim = true, optional = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null
    throw invalid(`${field} is required`)
  }
  if (typeof value !== 'string') throw invalid(`${field} must be text`)
  const v = trim ? value.trim() : value
  if (v.length < min) throw invalid(`${field} must be at least ${min} characters`)
  if (v.length > max) throw invalid(`${field} must be at most ${max} characters`)
  return v
}

export function id(value, field, { optional = false } = {}) {
  const v = str(value, field, { max: 64, optional })
  if (v === null) return null
  /* Ids in this system are slugs the app generates — never free text, and never
     anything that could be mistaken for SQL, a path segment or an HTML tag. */
  if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(v)) throw invalid(`${field} is not a valid id`)
  return v
}

export function money(value, field, { min = 0, max = 1e12, optional = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null
    throw invalid(`${field} is required`)
  }
  const n = Number(value)
  if (!Number.isFinite(n)) throw invalid(`${field} must be a number`)
  if (n < min) throw invalid(`${field} cannot be less than ${min}`)
  if (n > max) throw invalid(`${field} is unreasonably large`)
  /* Money columns are DECIMAL(16,2) / DECIMAL(14,2). Rounding here rather than
     letting MySQL truncate means the number we validated is the number stored. */
  return Math.round(n * 100) / 100
}

export function int(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER, optional = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null
    throw invalid(`${field} is required`)
  }
  const n = Number(value)
  if (!Number.isInteger(n)) throw invalid(`${field} must be a whole number`)
  if (n < min || n > max) throw invalid(`${field} is out of range`)
  return n
}

export function bool(value, field, { optional = false } = {}) {
  if (value === undefined || value === null) {
    if (optional) return null
    throw invalid(`${field} is required`)
  }
  if (typeof value === 'boolean') return value
  if (value === 1 || value === 0 || value === '1' || value === '0') return Boolean(Number(value))
  if (value === 'true' || value === 'false') return value === 'true'
  throw invalid(`${field} must be true or false`)
}

export function oneOf(value, field, allowed, { optional = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null
    throw invalid(`${field} is required`)
  }
  if (!allowed.includes(value)) throw invalid(`${field} must be one of: ${allowed.join(', ')}`)
  return value
}

export function list(value, field, { max = 500, optional = false } = {}) {
  if (value === undefined || value === null) {
    if (optional) return []
    throw invalid(`${field} is required`)
  }
  if (!Array.isArray(value)) throw invalid(`${field} must be a list`)
  if (value.length > max) throw invalid(`${field} cannot hold more than ${max} items`)
  return value
}

export function email(value, field, { optional = false } = {}) {
  const v = str(value, field, { max: 191, optional })
  if (v === null) return null
  const lower = v.toLowerCase()
  /* Deliberately permissive: the definitive test of an address is whether mail
     to it arrives, and an over-strict regex rejects valid addresses. This only
     catches what is obviously not an address at all. */
  if (!/^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(lower)) throw invalid(`${field} is not a valid email address`)
  return lower
}

export function isoDate(value, field, { optional = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null
    throw invalid(`${field} is required`)
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw invalid(`${field} must be a date`)
  return d
}

/** Strips HTML-significant characters from text that will be rendered as text.
 *  Belt and braces — React escapes on output — but content written by one user
 *  and read by another is exactly where that assumption eventually breaks. */
export function plain(value, field, opts = {}) {
  const v = str(value, field, opts)
  if (v === null) return null
  return v.replace(/[<>]/g, '')
}
