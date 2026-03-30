import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuctionDetailPage } from '../../pages/AuctionDetailPage'
import { system } from '../../theme'
import * as auctionsApi from '../../api/auctions'
import { useAuth } from '../../context/AuthContext'

vi.mock('../../api/auctions', () => ({
  getAuction: vi.fn(),
  getSimilarAuctions: vi.fn(),
  placeBid: vi.fn(),
  setAutoBid: vi.fn(),
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../../utils/mediaUrl', () => ({
  resolveMediaUrl: (url: string | null | undefined) => url ?? '',
}))

const mockedUseAuth = vi.mocked(useAuth)

const auctionDetail = {
  id: 1,
  title: 'Test listing',
  description: null,
  categoryId: 1,
  categoryName: 'Sedans',
  sellerId: 99,
  sellerUsername: 'seller1',
  initialPrice: 1000,
  bidIncrement: 100,
  currentPrice: 1000,
  closeDateTime: new Date(Date.now() + 86400000).toISOString(),
  status: 'active',
  winnerId: null,
  createdAt: new Date().toISOString(),
  fieldValues: [] as { fieldName: string; value: string }[],
  bidHistory: [] as auctionsApi.BidHistoryItem[],
}

function renderDetail() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={['/auctions/1']}>
        <Routes>
          <Route path="/auctions/:id" element={<AuctionDetailPage />} />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>
  )
}

describe('AuctionDetailPage wallet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auctionsApi.getSimilarAuctions).mockResolvedValue({ data: [] } as never)
  })

  it('shows spendable wallet when logged in and bidding is allowed', async () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: 1,
        username: 'bidder',
        avatarUrl: null,
        displayNameColor: null,
        email: 'b@b.com',
        role: 'end_user',
        walletBalance: 5000,
        walletAvailableBalance: 4200.5,
      },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateDisplayNameColor: vi.fn(),
      updateAvatarUrl: vi.fn(),
      refreshProfile: vi.fn().mockResolvedValue(null),
    })
    vi.mocked(auctionsApi.getAuction).mockResolvedValue({ data: auctionDetail } as never)

    renderDetail()

    await waitFor(() => {
      expect(auctionsApi.getAuction).toHaveBeenCalledWith(1)
    })
    expect(await screen.findByText(/Spendable wallet:/)).toBeInTheDocument()
    expect(screen.getByText(/4,200\.50/)).toBeInTheDocument()
  })

  it('calls refreshProfile after a successful bid', async () => {
    const refreshProfile = vi.fn().mockResolvedValue(null)
    mockedUseAuth.mockReturnValue({
      user: {
        id: 1,
        username: 'bidder',
        avatarUrl: null,
        displayNameColor: null,
        email: 'b@b.com',
        role: 'end_user',
        walletBalance: 50_000,
        walletAvailableBalance: 50_000,
      },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateDisplayNameColor: vi.fn(),
      updateAvatarUrl: vi.fn(),
      refreshProfile,
    })
    vi.mocked(auctionsApi.getAuction).mockResolvedValue({ data: auctionDetail } as never)
    vi.mocked(auctionsApi.placeBid).mockResolvedValue({} as never)

    const user = userEvent.setup()
    renderDetail()

    await screen.findByPlaceholderText('Amount')
    await user.clear(screen.getByPlaceholderText('Amount'))
    await user.type(screen.getByPlaceholderText('Amount'), '1100')
    await user.click(screen.getByRole('button', { name: 'Bid' }))

    await waitFor(() => {
      expect(auctionsApi.placeBid).toHaveBeenCalledWith(1, 1100)
      expect(refreshProfile).toHaveBeenCalled()
    })
  })

  it('uses step=any on auto-bid upper limit so values need not align to bid increment', async () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: 1,
        username: 'bidder',
        avatarUrl: null,
        displayNameColor: null,
        email: 'b@b.com',
        role: 'end_user',
        walletBalance: 50_000,
        walletAvailableBalance: 50_000,
      },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateDisplayNameColor: vi.fn(),
      updateAvatarUrl: vi.fn(),
      refreshProfile: vi.fn().mockResolvedValue(null),
    })
    vi.mocked(auctionsApi.getAuction).mockResolvedValue({ data: auctionDetail } as never)

    renderDetail()

    const upperInput = await screen.findByPlaceholderText('Upper limit')
    expect(upperInput).toHaveAttribute('step', 'any')

    const amountInput = screen.getByPlaceholderText('Amount')
    expect(amountInput).toHaveAttribute('step', '100')
  })

  it('submits a non-increment-multiple auto-bid limit to the API', async () => {
    const refreshProfile = vi.fn().mockResolvedValue(null)
    mockedUseAuth.mockReturnValue({
      user: {
        id: 1,
        username: 'bidder',
        avatarUrl: null,
        displayNameColor: null,
        email: 'b@b.com',
        role: 'end_user',
        walletBalance: 50_000,
        walletAvailableBalance: 50_000,
      },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateDisplayNameColor: vi.fn(),
      updateAvatarUrl: vi.fn(),
      refreshProfile,
    })
    vi.mocked(auctionsApi.getAuction).mockResolvedValue({ data: auctionDetail } as never)
    vi.mocked(auctionsApi.setAutoBid).mockResolvedValue({} as never)

    const user = userEvent.setup()
    renderDetail()

    await screen.findByPlaceholderText('Upper limit')
    await user.type(screen.getByPlaceholderText('Upper limit'), '1101')
    await user.click(screen.getByRole('button', { name: 'Set auto-bid' }))

    await waitFor(() => {
      expect(auctionsApi.setAutoBid).toHaveBeenCalledWith(1, 1101)
      expect(refreshProfile).toHaveBeenCalled()
    })
  })
})
