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

export interface GmManifestCarRow {
  externalId?: string | null
  title?: string | null
  make?: string | null
  model?: string | null
  year?: number | null
  color?: string | null
  sourceUrl?: string | null
  detailSourceUrl?: string | null
  categoryIds: number[]
  categoryNames: string[]
  categoryStringKeys: string[]
}

export function searchGmManifestCars(query: string, limit = 12) {
  return apiClient.get<GmManifestCarRow[]>('admin/gm/manifest/cars', {
    params: { q: query, limit },
  })
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

export interface GmDeleteAllAuctionsResult {
  itemsDeleted: number
  bidsDeleted: number
  autoBidsDeleted: number
  bidHoldsDeleted: number
  notificationsDeleted: number
}

export function gmDeleteAllAuctions() {
  return apiClient.post<GmDeleteAllAuctionsResult>('admin/gm/auctions/delete-all')
}

export interface GmCreateCategoryPayload {
  name: string
  parentId?: number | null
  stringKey?: string | null
  /** Omit or empty: backend stores platform default (Car). */
  lucideIconKey?: string | null
}

export interface GmUpdateCategoryPayload {
  name?: string
  stringKey?: string | null
  /** Empty string clears to platform default (null in DB). Omit to leave unchanged. */
  lucideIconKey?: string | null
}

export interface GmCategoryMutationResult {
  id: number
  name: string
}

export interface GmDeleteCategoryResult {
  id: number
  deleted: boolean
}

export function gmCreateCategory(payload: GmCreateCategoryPayload) {
  return apiClient.post<GmCategoryMutationResult>('admin/gm/categories', payload)
}

export function gmUpdateCategory(categoryId: number, payload: GmUpdateCategoryPayload) {
  return apiClient.patch<GmCategoryMutationResult>(`admin/gm/categories/${categoryId}`, payload)
}

export function gmDeleteCategory(categoryId: number) {
  return apiClient.delete<GmDeleteCategoryResult>(`admin/gm/categories/${categoryId}`)
}
