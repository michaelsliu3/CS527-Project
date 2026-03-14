import { apiClient } from './client'

export interface NotificationItem {
  id: number
  userId: number
  itemId: number | null
  message: string
  type: string
  isRead: boolean
  createdAt: string
}

export interface NotificationsListResponse {
  items: NotificationItem[]
  unreadCount: number
}

export function listNotifications() {
  return apiClient.get<NotificationsListResponse>('notifications')
}

export function markNotificationRead(id: number) {
  return apiClient.patch(`notifications/${id}/read`)
}

export function markAllNotificationsRead() {
  return apiClient.patch('notifications/read-all')
}
