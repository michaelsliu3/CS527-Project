const EVENT = 'plzbuyme:auction-list-refresh'

/** Call when browse-grid data may have changed (e.g. admin edit, end auction) while detail is open over the list. */
export function notifyAuctionListRefresh(): void {
  window.dispatchEvent(new Event(EVENT))
}

export function subscribeAuctionListRefresh(handler: () => void): () => void {
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
