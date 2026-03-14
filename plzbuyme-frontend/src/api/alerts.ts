import { apiClient } from './client'

export interface AlertResponse {
  id: number
  userId: number
  categoryId: number | null
  keyword: string | null
  criteria: string | null
  isActive: boolean
  createdAt: string
}

export interface CreateAlertDto {
  categoryId?: number | null
  keyword?: string | null
  criteria?: string | null
}

export function listAlerts() {
  return apiClient.get<AlertResponse[]>('alerts')
}

export function createAlert(dto: CreateAlertDto) {
  return apiClient.post<AlertResponse>('alerts', dto)
}

export function deleteAlert(id: number) {
  return apiClient.delete(`alerts/${id}`)
}
