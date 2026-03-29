import { apiClient } from './client'

export interface WalletDepositResponse {
  walletBalance: number
  walletAvailableBalance: number
}

export interface WalletWithdrawResponse {
  walletBalance: number
  walletAvailableBalance: number
}

export async function depositWallet(body: { amount?: number; preset?: 'small' | 'medium' | 'large' }) {
  return apiClient.post<WalletDepositResponse>('wallet/deposit', body)
}

export async function withdrawWallet(amount: number) {
  return apiClient.post<WalletWithdrawResponse>('wallet/withdraw', { amount })
}
