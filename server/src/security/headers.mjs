/* ---------------------------------------------------------------------------
   Security headers and request hygiene.

   Hand-written rather than `helmet`, for the same reason the JWT is hand-written:
   this is a JSON API, so most of helmet's surface (CSP for HTML, frameguard for
   embedded pages) either does not apply or applies to the frontend's host, not
   to us. What is left is short enough to read.

   The one header that genuinely matters for an API returning JSON is
   `X-Content-Type-Options: nosniff` — without it a browser may sniff a JSON
   response containing attacker-controlled text as HTML and run it.
--------------------------------------------------------------------------- */

export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
  /* This API serves JSON and uploaded files, never HTML that runs script. A CSP
     that forbids everything is therefore free, and it neuters the "upload an
     HTML file, open it directly, own the origin" path against /api/uploads. */
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; sandbox")
  res.removeHeader('X-Powered-By')
  next()
}

/**
 * A per-request id, echoed in the response and attached to `req` so every log
 * line about one request can be tied together. Honours an inbound
 * `X-Request-Id` so a trace started at the frontend survives the hop.
 */
export function requestId(req, res, next) {
  const inbound = req.headers['x-request-id']
  const id = typeof inbound === 'string' && /^[\w-]{1,64}$/.test(inbound)
    ? inbound
    : Math.random().toString(36).slice(2, 12)
  req.id = id
  res.setHeader('X-Request-Id', id)
  next()
}

/**
 * One line per request, once it has finished, at a level that reflects the
 * outcome. Slow requests are called out because on a shared 150-connection
 * MySQL box a slow query is the thing that takes everyone else down with it.
 */
export function requestLog({ slowMs = 1000 } = {}) {
  return (req, res, next) => {
    const started = process.hrtime.bigint()
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6
      const who = req.auth ? `${req.auth.role}:${req.auth.userId}` : 'anon'
      const line = `[${req.id}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms ${who}`
      if (res.statusCode >= 500) console.error(line)
      else if (res.statusCode >= 400 || ms >= slowMs) console.warn(line)
      else console.log(line)
    })
    next()
  }
}

/**
 * Rejects a request whose body is not JSON when a body is present.
 *
 * express.json() quietly leaves `req.body` as `{}` for an unparsed content
 * type, which turns "you sent the wrong content type" into "your fields were
 * all missing" three layers further down.
 */
export function requireJsonBody(req, _res, next) {
  const method = req.method.toUpperCase()
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') return next()
  if (req.is('application/json')) return next()
  /* Uploads set their own content type and are handled by their own route. */
  if (req.path.startsWith('/api/uploads')) return next()
  next(Object.assign(
    new Error('Send this request as application/json'),
    { status: 415, code: 'unsupported_media_type', expected: true },
  ))
}
