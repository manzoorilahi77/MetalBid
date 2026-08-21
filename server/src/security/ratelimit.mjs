/* ---------------------------------------------------------------------------
   Rate limiting.

   In-process, fixed-window counters. No Redis, because there is one API process
   on one shared host — and a limiter that needs infrastructure we do not have
   is a limiter that never ships.

   Two consequences of that choice, stated rather than discovered later:
   restarting the process forgets every counter, and running two processes
   doubles every limit. Neither matters at this scale; both would if the API is
   ever load-balanced, at which point the login limiter is the one to move to
   the database first — and it already half-lives there, because
   `login_attempts` is the durable record the throttle in api/auth.mjs reads.

   The window is fixed rather than sliding: cheaper, and the difference only
   shows at the boundary, where a determined caller gets 2× the limit across two
   adjacent windows. For "20 writes a minute" that is irrelevant.
--------------------------------------------------------------------------- */

const buckets = new Map()

/* One sweep a minute keeps the map from growing without bound on a long-running
   process. unref() so this timer never holds the process open at shutdown. */
const sweeper = setInterval(() => {
  const now = Date.now()
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key)
}, 60_000)
sweeper.unref?.()

/**
 * @param {object}  opts
 * @param {number}  opts.limit      requests allowed per window
 * @param {number}  opts.windowMs   window length
 * @param {string}  opts.name       used in the bucket key, so two limiters on
 *                                  one route do not share a counter
 * @param {(req) => string} [opts.key] what to count by — defaults to client IP
 * @param {boolean} [opts.countFailuresOnly] refund the count when the request
 *   succeeds. For sign-in this is not a nicety: a successful login is proof the
 *   caller knew the password, and counting it means ten people in one office
 *   signing in normally locks the eleventh out of their own account. What needs
 *   throttling is the guess rate, so only failures are kept.
 */
export function rateLimit({ limit, windowMs, name, key = clientIp, countFailuresOnly = false }) {
  return (req, res, next) => {
    const id = `${name}:${key(req) ?? 'unknown'}`
    const now = Date.now()

    let b = buckets.get(id)
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + windowMs }
      buckets.set(id, b)
    }
    b.count += 1

    if (countFailuresOnly) {
      res.on('finish', () => {
        /* Refund on success only. A 429 is not refunded — that would let a
           caller who is already over the limit hold it open indefinitely. */
        if (res.statusCode < 400 && b.count > 0) b.count -= 1
      })
    }

    const remaining = Math.max(0, limit - b.count)
    res.setHeader('RateLimit-Limit', String(limit))
    res.setHeader('RateLimit-Remaining', String(remaining))
    res.setHeader('RateLimit-Reset', String(Math.ceil((b.resetAt - now) / 1000)))

    if (b.count > limit) {
      const retryAfter = Math.ceil((b.resetAt - now) / 1000)
      res.setHeader('Retry-After', String(retryAfter))
      return next(Object.assign(
        new Error(`Too many requests — try again in ${retryAfter}s`),
        { status: 429, code: 'rate_limited', expected: true },
      ))
    }
    next()
  }
}

/**
 * The client's address.
 *
 * `trust proxy` is set on the app, so Express has already resolved
 * `req.ip` from X-Forwarded-For when the deployment sits behind cPanel's proxy.
 * Falling back to the socket address matters for direct-to-node runs.
 */
export function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || null
}

/** Counts an authenticated caller by account, so one noisy user cannot spend a
 *  shared office IP's entire budget. Falls back to IP for anonymous callers. */
export const byUserOrIp = (req) => req.auth?.userId ?? clientIp(req)

/* Reset hook for tests — never called by the server itself. */
export const _resetBuckets = () => buckets.clear()
