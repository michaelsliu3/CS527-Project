const EVENT = 'plzbuyme:auction-list-refresh'
const LOW_DETAIL_MODE_EVENT = 'plzbuyme:auction-low-detail-mode-change'
const LOW_DETAIL_MODE_STORAGE_KEY = 'plzbuyme:auction-low-detail-mode-enabled'

/** Call when browse-grid data may have changed (e.g. admin edit, end auction) while detail is open over the list. */
export function notifyAuctionListRefresh(): void {
  window.dispatchEvent(new Event(EVENT))
}

export function subscribeAuctionListRefresh(handler: () => void): () => void {
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}

export function isAuctionLowDetailModeEnabled(): boolean {
  const raw = window.localStorage.getItem(LOW_DETAIL_MODE_STORAGE_KEY)
  if (raw == null) return false
  return raw !== '0' && raw.toLowerCase() !== 'false'
}

export function notifyAuctionLowDetailModeChanged(): void {
  window.dispatchEvent(new Event(LOW_DETAIL_MODE_EVENT))
}

export function setAuctionLowDetailModeEnabled(enabled: boolean): void {
  window.localStorage.setItem(LOW_DETAIL_MODE_STORAGE_KEY, enabled ? '1' : '0')
  notifyAuctionLowDetailModeChanged()
}

export function subscribeAuctionLowDetailModeChange(handler: () => void): () => void {
  window.addEventListener(LOW_DETAIL_MODE_EVENT, handler)
  return () => window.removeEventListener(LOW_DETAIL_MODE_EVENT, handler)
}
