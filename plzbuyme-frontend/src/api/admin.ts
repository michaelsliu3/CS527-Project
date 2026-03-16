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

export function getTotalEarnings() {
  return apiClient.get<EarningsReport>('admin/reports/earnings')
}

export function getEarningsByType() {
  return apiClient.get<EarningsByTypeItem[]>('admin/reports/earnings-by-type')
}

export function getEarningsByUser() {
  return apiClient.get<EarningsByUserItem[]>('admin/reports/earnings-by-user')
}

export function getEarningsByItem() {
  return apiClient.get<EarningsByItemItem[]>('admin/reports/earnings-by-item')
}

export function getBestSelling(top = 10) {
  return apiClient.get<BestSellingItem[]>('admin/reports/best-selling', { params: { top } })
}

export function getBestBuyers(top = 10) {
  return apiClient.get<BestBuyer[]>('admin/reports/best-buyers', { params: { top } })
}
