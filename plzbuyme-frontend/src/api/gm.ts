import { apiClient } from './client'

export interface GmSeedManifestAuctionsPayload {
  count: number
  titleKeyword?: string
  categoryMode?: string
  closeHoursMin?: number
  closeHoursMax?: number
  bidCountMin?: number
  bidCountMax?: number
  sellerUserId?: number
}

export function seedGmAuctionsFromManifest(payload: GmSeedManifestAuctionsPayload) {
  return apiClient.post<GmSeedAuctionsResult>('admin/gm/auctions/seed-from-manifest', payload)
}

export interface GmSeedAuctionsPayload {
  count: number
  categoryId?: number
  sellerUserId?: number
  closeHoursMin?: number
  closeHoursMax?: number
  bidCountMin?: number
  bidCountMax?: number
}

export interface GmSeedAuctionsResult {
  createdCount: number
  auctionIds: number[]
  totalBidsPlaced: number
}

export interface GmBulkUsersPayload {
  usernamePrefix: string
  count: number
  startIndex?: number
  password?: string
  walletBalanceEach?: number
}

export interface GmBulkUsersResult {
  createdCount: number
  usernames: string[]
}

export interface GmSeedQuestionsPayload {
  count: number
  includeRepReplies?: boolean
}

export interface GmSeedQuestionsResult {
  createdCount: number
  repliesCreated: number
}

export interface GmWalletTopUpPayload {
  userIds: number[]
  amountEach: number
}

export interface GmWalletTopUpResult {
  usersAffected: number
}

export interface GmSampleAlertsPayload {
  userId: number
  count?: number
}

export interface GmSampleAlertsResult {
  alertsCreated: number
}

export interface GmSampleNotificationsPayload {
  userId: number
  count?: number
}

export interface GmSampleNotificationsResult {
  notificationsCreated: number
}

export interface GmSoldHistoryFixtureResult {
  soldAuctionCount: number
}

export function seedGmAuctions(payload: GmSeedAuctionsPayload) {
  return apiClient.post<GmSeedAuctionsResult>('admin/gm/auctions/seed', payload)
}

export function bulkGmUsers(payload: GmBulkUsersPayload) {
  return apiClient.post<GmBulkUsersResult>('admin/gm/users/bulk', payload)
}

export function seedGmQuestions(payload: GmSeedQuestionsPayload) {
  return apiClient.post<GmSeedQuestionsResult>('admin/gm/questions/seed', payload)
}

export function gmWalletTopUp(payload: GmWalletTopUpPayload) {
  return apiClient.post<GmWalletTopUpResult>('admin/gm/wallets/top-up', payload)
}

export function seedGmSampleAlerts(payload: GmSampleAlertsPayload) {
  return apiClient.post<GmSampleAlertsResult>('admin/gm/alerts/sample', payload)
}

export function seedGmSampleNotifications(payload: GmSampleNotificationsPayload) {
  return apiClient.post<GmSampleNotificationsResult>('admin/gm/notifications/sample', payload)
}

export function seedGmSoldHistoryFixture() {
  return apiClient.post<GmSoldHistoryFixtureResult>('admin/gm/fixtures/sold-history')
}

export interface GmBulkCloseAuctionsPayload {
  /** natural = reserve rules; closed = no sale, release holds */
  mode: 'natural' | 'closed'
}

export interface GmBulkCloseAuctionsResult {
  processedCount: number
  soldCount: number
  closedWithoutSaleCount: number
}

export function gmBulkCloseActiveAuctions(payload: GmBulkCloseAuctionsPayload) {
  return apiClient.post<GmBulkCloseAuctionsResult>('admin/gm/auctions/close-active', payload)
}

export function gmRunCloseSweep() {
  return apiClient.post<{ ran: boolean }>('admin/gm/auctions/run-close-sweep')
}
