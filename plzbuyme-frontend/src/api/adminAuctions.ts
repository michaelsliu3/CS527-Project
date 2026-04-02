import { apiClient } from './client'
import type { AuctionDetail } from './auctions'

export interface AdminPatchAuctionPayload {
  title?: string
  description?: string | null
  closeDateTime?: string
  bidIncrement?: number
  reservePrice?: number
  initialPrice?: number
  currentPrice?: number
  /** natural | closed | sold — send alone (no other fields in same request per API). */
  endAuction?: string
}

export function patchAdminAuction(auctionId: number, payload: AdminPatchAuctionPayload) {
  return apiClient.patch<AuctionDetail>(`admin/auctions/${auctionId}`, payload)
}
