import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuctionListPage } from '../../pages/AuctionListPage'
import { system } from '../../theme'
import * as api from '../../api/auctions'

vi.mock('../../api/auctions', () => ({
  browseAuctions: vi.fn(),
}))

function renderAuctionListPage(initialEntry = '/auctions') {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/auctions" element={<AuctionListPage />} />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>
  )
}

describe('AuctionListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches and renders paginated results', async () => {
    vi.mocked(api.browseAuctions).mockResolvedValue({
      data: {
        items: [
          {
            id: 1,
            title: 'Test Car',
            currentPrice: 15000,
            closeDateTime: new Date(Date.now() + 86400000).toISOString(),
            status: 'active',
            categoryName: 'Sedans',
            sellerUsername: 'seller1',
            bidCount: 2,
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 20,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as unknown as Awaited<ReturnType<typeof api.browseAuctions>>)
    renderAuctionListPage('/auctions')
    await waitFor(() => {
      expect(api.browseAuctions).toHaveBeenCalled()
    })
    expect(screen.getByText('Test Car')).toBeInTheDocument()
    expect(screen.getByText('$15,000')).toBeInTheDocument()
    expect(screen.getByText(/1 total/)).toBeInTheDocument()
  })

  it('shows no auctions message when empty', async () => {
    vi.mocked(api.browseAuctions).mockResolvedValue({
      data: {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 20,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as unknown as Awaited<ReturnType<typeof api.browseAuctions>>)
    renderAuctionListPage('/auctions')
    await waitFor(() => {
      expect(api.browseAuctions).toHaveBeenCalled()
    })
    expect(screen.getByText(/No auctions found/)).toBeInTheDocument()
  })
})
