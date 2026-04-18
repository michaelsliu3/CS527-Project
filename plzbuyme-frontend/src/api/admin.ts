import { apiClient } from './client'

export interface CreateRepDto {
  username: string
  email: string
  password: string
}

export interface CreateRepResponse {
  id: number
  username: string
  email: string
}

export interface EarningsReport {
  total: number
  soldCount: number
  averageSale: number
  distinctSellers: number
  distinctBuyers: number
}

export interface ReportQueryParams {
  from?: string
  to?: string
  top?: number
  page?: number
  pageSize?: number
}

export interface PaginatedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

export interface EarningsByTypeItem {
  categoryId: number
  categoryName: string
  earnings: number
}

export interface EarningsByUserItem {
  userId: number
  username: string
  totalAsSeller: number
  totalAsWinner: number
}

export interface EarningsByItemItem {
  itemId: number
  title: string
  price: number
}

export interface BestSellingItem {
  itemId: number
  title: string
  price: number
  bidCount: number
}

export interface BestBuyer {
  userId: number
  username: string
  totalSpent: number
  winCount: number
}

export function createRep(dto: CreateRepDto) {
  return apiClient.post<CreateRepResponse>('admin/reps', dto)
}

export function getTotalEarnings(params?: ReportQueryParams) {
  return apiClient.get<EarningsReport>('admin/reports/earnings', { params })
}

export function getEarningsByType(params?: ReportQueryParams) {
  return apiClient.get<EarningsByTypeItem[]>('admin/reports/earnings-by-type', { params })
}

export function getEarningsByUser(params?: ReportQueryParams) {
  return apiClient.get<PaginatedResult<EarningsByUserItem>>('admin/reports/earnings-by-user', { params })
}

export function getEarningsByItem(params?: ReportQueryParams) {
  return apiClient.get<PaginatedResult<EarningsByItemItem>>('admin/reports/earnings-by-item', { params })
}

export function getBestSelling(top = 10, params?: ReportQueryParams) {
  return apiClient.get<BestSellingItem[]>('admin/reports/best-selling', { params: { ...params, top } })
}

export function getBestBuyers(top = 10, params?: ReportQueryParams) {
  return apiClient.get<BestBuyer[]>('admin/reports/best-buyers', { params: { ...params, top } })
}
