import { apiClient } from './client'

export interface AuctionListItem {
  id: number
  title: string
  currentPrice: number
  closeDateTime: string
  status: string
  categoryName: string
  sellerUsername: string
  bidCount: number
}

export interface PaginatedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

export interface CategoryFieldValueDto {
  fieldName: string
  value: string
}

export interface BidHistoryItem {
  bidderUsername: string
  amount: number
  isAuto: boolean
  createdAt: string
}

export interface AuctionDetail {
  id: number
  title: string
  description: string | null
  categoryId: number
  categoryName: string
  sellerId: number
  sellerUsername: string
  initialPrice: number
  bidIncrement: number
  currentPrice: number
  closeDateTime: string
  status: string
  winnerId: number | null
  createdAt: string
  fieldValues: CategoryFieldValueDto[]
  bidHistory: BidHistoryItem[]
}

export interface CreateAuctionDto {
  title: string
  description?: string
  categoryId: number
  initialPrice: number
  bidIncrement: number
  reservePrice: number
  closeDateTime: string
  fieldValues: { fieldId: number; value: string }[]
}

export interface BrowseParams {
  q?: string
  categoryId?: number
  minPrice?: number
  maxPrice?: number
  status?: string
  closingBefore?: string
  closingAfter?: string
  seller?: string
  fieldFilters?: string
  sort?: string
  page?: number
  pageSize?: number
  make?: string
  model?: string
  yearMin?: number
  yearMax?: number
  mileageMax?: number
  exteriorColor?: string
  condition?: string[]
  transmission?: string[]
  fuelType?: string[]
}

export function browseAuctions(params: BrowseParams = {}) {
  return apiClient.get<PaginatedResult<AuctionListItem>>('/auctions/browse', { params })
}

export function getAuction(id: number) {
  return apiClient.get<AuctionDetail>(`/auctions/view/${id}`)
}

export function getSimilarAuctions(id: number, limit = 10) {
  return apiClient.get<AuctionListItem[]>(`/auctions/view/${id}/similar`, { params: { limit } })
}

export function getFieldValues(fieldName: string, categoryId?: number, prefix?: string, maxCount = 50) {
  return apiClient.get<string[]>('/auctions/field-values', {
    params: { fieldName, categoryId, prefix, maxCount },
  })
}

export function createAuction(dto: CreateAuctionDto) {
  return apiClient.post<AuctionDetail>('/auctions/create', dto)
}

export function placeBid(auctionId: number, amount: number) {
  return apiClient.post(`/auctions/${auctionId}/bids/place`, { amount })
}

export function setAutoBid(auctionId: number, upperLimit: number) {
  return apiClient.post(`/auctions/${auctionId}/autobids/set`, { upperLimit })
}

export function getMyAuctions(status?: string) {
  return apiClient.get<AuctionListItem[]>('/auctions/mine', { params: status ? { status } : {} })
}
