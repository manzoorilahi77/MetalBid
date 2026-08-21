/* ---------------------------------------------------------------------------
   Realtime, over Server-Sent Events.

   The bidding room needs a shared clock and a pushed ladder. Without one, two
   bidders looking at the same lot see different states, and an anti-snipe
   extension triggered by one of them never reaches the other — which is not a
   cosmetic problem, it is the difference between a fair close and a disputed
   one.

   SSE rather than WebSockets, for three reasons that all point the same way on
   this deployment: it is plain HTTP, so cPanel's proxy passes it without
   configuration; it reconnects on its own, with `Last-Event-ID`, rather than
   needing a reconnect loop in the client; and the traffic here is one-way — the
   client already POSTs its bids and gets the authoritative answer back from
   bidding.mjs, so a duplex channel would carry nothing in the other direction.

   The bus is in-process. With one API process that is exactly right; with two
   it becomes wrong quietly, because a bid handled by process A would not reach
   a subscriber on process B. `fanout` is therefore the single place to swap in
   Redis pub/sub if a second process is ever added, and nothing else changes.
--------------------------------------------------------------------------- */

/** Every open connection. Bounded so a leak or an attack cannot exhaust memory. */
const subscribers = new Set()
const MAX_SUBSCRIBERS = 500

/** A short backlog so a client that reconnects after a blip does not miss the
 *  close it was watching for. Replayed by `Last-Event-ID`. */
const RECENT = []
const RECENT_MAX = 200
let sequence = 0

/**
 * Broadcast an event.
 *
 * `audience` decides who sees it. Most auction events are public in the sense
 * that anybody watching that lot may see them — but a bid carries a bidder, and
 * bidder identity is masked per the disclosure rules, so the payload is built
 * by the caller with that already applied. This function does not sanitise;
 * it delivers.
 *
 * @param {object} event
 * @param {string} event.type       'lot.close' | 'bid.placed' | 'catalogue.open' | ...
 * @param {string} [event.userId]   deliver only to this user
 * @param {string[]} [event.roles]  deliver only to these roles
 */
export function publish(event) {
  const record = { ...event, id: ++sequence, at: new Date().toISOString() }

  RECENT.push(record)
  if (RECENT.length > RECENT_MAX) RECENT.shift()

  for (const sub of subscribers) {
    if (!visibleTo(record, sub)) continue
    send(sub, record)
  }
  return record.id
}

/** Whether one subscriber should receive one event. */
function visibleTo(event, sub) {
  if (event.userId && event.userId !== sub.userId) return false
  if (event.roles && !event.roles.includes(sub.role)) return false
  /* A subscriber may narrow itself to one catalogue — the bidding room does,
     so a buyer in one sale is not woken by every bid in every other. */
  if (sub.catalogueId && event.catalogueId && event.catalogueId !== sub.catalogueId) return false
  return true
}

function send(sub, event) {
  try {
    sub.res.write(`id: ${event.id}\n`)
    sub.res.write(`event: ${event.type}\n`)
    sub.res.write(`data: ${JSON.stringify(event)}\n\n`)
  } catch {
    /* A write to a socket the client has already dropped throws. Remove it and
       move on — one dead subscriber must not break the broadcast. */
    subscribers.delete(sub)
  }
}

/**
 * Attach one HTTP response as a subscriber. Returns a detach function.
 *
 * The heartbeat is not optional: proxies and mobile networks close a connection
 * that has been silent for a minute or two, and a comment line is the cheapest
 * thing that keeps it open.
 */
export function subscribe({ req, res, userId, role, catalogueId, lastEventId }) {
  if (subscribers.size >= MAX_SUBSCRIBERS) {
    res.status(503).json({ error: 'unavailable', message: 'Too many live connections — try again shortly' })
    return null
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  /* nginx and several cPanel proxy configurations buffer responses by default,
     which turns a stream into a file that arrives when it ends. */
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const sub = { res, userId, role, catalogueId: catalogueId ?? null }
  subscribers.add(sub)

  /* Tell the client how long to wait before reconnecting, then replay anything
     it missed while it was away. */
  res.write('retry: 3000\n\n')
  const since = Number(lastEventId)
  if (Number.isFinite(since) && since > 0) {
    for (const event of RECENT) {
      if (event.id > since && visibleTo(event, sub)) send(sub, event)
    }
  }
  send(sub, { id: sequence, type: 'hello', at: new Date().toISOString(), serverTime: Date.now() })

  const heartbeat = setInterval(() => {
    try {
      /* A comment line keeps the socket warm without being an event, and the
         server time it carries lets the client correct its own clock — which is
         what a countdown on somebody's laptop actually needs. */
      sub.res.write(`: ping ${Date.now()}\n\n`)
    } catch {
      clearInterval(heartbeat)
      subscribers.delete(sub)
    }
  }, 25_000)
  heartbeat.unref?.()

  const detach = () => {
    clearInterval(heartbeat)
    subscribers.delete(sub)
  }
  req.on('close', detach)
  return detach
}

/** For the health endpoint — a stuck stream is invisible until you count it. */
export const subscriberCount = () => subscribers.size

/** Close every stream cleanly on shutdown, so clients reconnect to the new
 *  process rather than hanging on a socket the old one owned. */
export function closeAll() {
  for (const sub of subscribers) {
    try { sub.res.end() } catch { /* already gone */ }
  }
  subscribers.clear()
}
