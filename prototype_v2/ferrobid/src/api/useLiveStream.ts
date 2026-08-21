/* ---------------------------------------------------------------------------
   The live stream.

   Every browser used to work out the state of a running auction from its own
   clock and its own copy of the lots. Two bidders on the same lot could
   therefore see different rates, and an anti-snipe extension one of them
   triggered never reached the other — which is not cosmetic, it is the
   difference between a fair close and a disputed one.

   This subscribes to /api/stream and merges what the server says into the store.
   The server is the authority; this hook never computes an outcome, it only
   applies one.

   EventSource is used rather than fetch-with-a-reader because it reconnects on
   its own and replays with `Last-Event-ID`, which is exactly the behaviour a
   bidding room needs on a phone that changes cell tower mid-auction.

   One limitation, stated because it shapes how this is used: EventSource cannot
   send an Authorization header. So the stream is anonymous, and the bus filters
   accordingly — public auction events reach everybody, and anything addressed
   to one account is only delivered on a connection the server could identify.
   Private notifications therefore still arrive via the normal fetches; what
   this carries is the shared, public state of a sale.
--------------------------------------------------------------------------- */
import { useEffect } from 'react'
import { API_BASE } from './client'
import { hydrateStore } from './persist'
import type { Lot, Catalogue, LotStatus, CatalogueStatus } from '../types'

interface LotCloseEvent {
  type: 'lot.close'
  lotId: string
  catalogueId: string
  status: 'sold' | 'sta' | 'unsold'
  h1Rate: number | null
}

interface BidPlacedEvent {
  type: 'bid.placed'
  lotId: string
  catalogueId: string
  currentRate: number
  bidCount: number
  endsAt: string | null
  extended: boolean
}

interface CatalogueEvent {
  type: 'catalogue.open' | 'catalogue.close'
  catalogueId: string
  code: string
}

type StreamEvent = LotCloseEvent | BidPlacedEvent | CatalogueEvent

/**
 * Watch one catalogue, or the whole platform when `catalogueId` is omitted.
 *
 * Scoping to a catalogue matters on the bidding room: without it, a buyer in
 * one sale is woken by every bid in every other sale running at the same time.
 */
export function useLiveStream(catalogueId?: string): void {
  useEffect(() => {
    /* An environment without EventSource — a test runner, an old embedded
       browser — simply gets no live updates rather than a crash. */
    if (typeof EventSource === 'undefined') return

    const url = new URL(`${API_BASE}/api/stream`)
    if (catalogueId) url.searchParams.set('catalogueId', catalogueId)

    const source = new EventSource(url.toString())

    const apply = (raw: MessageEvent) => {
      let event: StreamEvent
      try { event = JSON.parse(raw.data) } catch { return }

      if (event.type === 'bid.placed') {
        hydrateStore((s: { lots: Lot[] }) => ({
          lots: s.lots.map((l) => (l.id === event.lotId
            ? {
                ...l,
                currentRate: event.currentRate,
                bidCount: event.bidCount,
                endsAt: event.endsAt ?? l.endsAt,
              }
            : l)),
        }))
        return
      }

      if (event.type === 'lot.close') {
        hydrateStore((s: { lots: Lot[] }) => ({
          lots: s.lots.map((l) => (l.id === event.lotId
            ? { ...l, status: event.status as LotStatus, resultH1Rate: event.h1Rate ?? undefined }
            : l)),
        }))
        return
      }

      if (event.type === 'catalogue.open' || event.type === 'catalogue.close') {
        const status: CatalogueStatus = event.type === 'catalogue.open' ? 'live' : 'closed'
        hydrateStore((s: { catalogues: Catalogue[] }) => ({
          catalogues: s.catalogues.map((c) => (c.id === event.catalogueId ? { ...c, status } : c)),
        }))
      }
    }

    for (const name of ['bid.placed', 'lot.close', 'catalogue.open', 'catalogue.close']) {
      source.addEventListener(name, apply as EventListener)
    }

    /* EventSource retries on its own using the `retry:` the server sends, so an
       error here is informational — closing the connection would disable the
       reconnect that is the whole reason for using it. */
    source.onerror = () => { /* browser reconnects */ }

    return () => source.close()
  }, [catalogueId])
}
