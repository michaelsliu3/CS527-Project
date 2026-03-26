import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuctionListPage } from '../../pages/AuctionListPage'
import { AuthProvider } from '../../context/AuthContext'
import { SellItemModalProvider } from '../../context/SellItemModalContext'
import { system } from '../../theme'
import * as api from '../../api/auctions'

vi.mock('../../api/categories', () => ({
  fetchCategories: vi.fn().mockResolvedValue({
    data: [],
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  }),
  fetchCategoryFields: vi.fn().mockResolvedValue({
    data: [],
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  }),
}))

vi.mock('../../api/auctions', () => ({
  browseAuctions: vi.fn(),
}))

function setTestToken(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  const token = [header, body, 'signature'].join('.')
  window.localStorage.setItem('token', token)
}

function renderAuctionListPage(initialEntry = '/auctions') {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AuthProvider>
          <SellItemModalProvider>
            <Routes>
              <Route path="/auctions" element={<AuctionListPage />} />
            </Routes>
          </SellItemModalProvider>
        </AuthProvider>
      </MemoryRouter>
    </ChakraProvider>
  )
}

describe('AuctionListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.removeItem('token')
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
    expect(await screen.findByText('Test Car')).toBeInTheDocument()
    expect(await screen.findByText('$15,000')).toBeInTheDocument()
    expect(await screen.findByText(/1 total/)).toBeInTheDocument()
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
    expect(await screen.findByText(/No auctions found/)).toBeInTheDocument()
  })

  it('opens Create Auction modal from CTA when logged in as end_user', async () => {
    const user = userEvent.setup()
    setTestToken({
      sub: '1',
      unique_name: 'bob',
      email: 'bob@example.com',
      role: 'end_user',
      exp: 4102444800,
    })
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
    await user.click(screen.getByRole('button', { name: /Create Auction/i }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Create Auction')
  })
})
