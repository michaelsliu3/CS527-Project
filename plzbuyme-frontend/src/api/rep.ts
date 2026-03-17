import { apiClient } from './client'

export interface UserSummary {
  id: number
  username: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
}

export interface PaginatedUsers {
  items: UserSummary[]
  totalCount: number
  page: number
  pageSize: number
}

export interface EditUserDto {
  username: string
  email: string
  role?: string
}

export interface ResetPasswordDto {
  newPassword: string
}

export function getRepUsers(params?: { search?: string; page?: number; pageSize?: number }) {
  return apiClient.get<PaginatedUsers>('rep/users', { params: params ?? {} })
}

export function editRepUser(id: number, dto: EditUserDto) {
  return apiClient.put(`rep/users/${id}`, dto)
}

export function deleteRepUser(id: number) {
  return apiClient.delete(`rep/users/${id}`)
}

export function resetRepUserPassword(id: number, dto: ResetPasswordDto) {
  return apiClient.post(`rep/users/${id}/reset-password`, dto)
}

export function deleteRepBid(id: number) {
  return apiClient.delete(`rep/bids/${id}`)
}

export function deleteRepAuction(id: number) {
  return apiClient.delete(`rep/auctions/${id}`)
}
