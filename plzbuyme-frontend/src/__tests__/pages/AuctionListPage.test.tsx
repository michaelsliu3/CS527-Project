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
import * as categoriesApi from '../../api/categories'

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

  it('passes sort query param to browse request', async () => {
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

    renderAuctionListPage('/auctions?sort=price_desc')

    await waitFor(() => {
      expect(api.browseAuctions).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: 'price_desc',
        })
      )
    })
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

  it('renders listing sort dropdown above results and refetches when changed', async () => {
    const user = userEvent.setup()
    setTestToken({
      sub: '2',
      unique_name: 'sam',
      email: 'sam@example.com',
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

    const listingSort = await screen.findByLabelText('Auction sort options')
    await user.selectOptions(listingSort, 'price_asc')

    await waitFor(() => {
      expect(api.browseAuctions).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: 'price_asc',
        })
      )
    })
  })

  it('renders refresh button and refetches auctions when clicked', async () => {
    const user = userEvent.setup()
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
    const callsBeforeRefresh = vi.mocked(api.browseAuctions).mock.calls.length

    await user.click(screen.getByRole('button', { name: /Refresh auctions/i }))

    await waitFor(() => {
      expect(vi.mocked(api.browseAuctions).mock.calls.length).toBeGreaterThan(callsBeforeRefresh)
    })
  })

  it('renders status tabs in middle controls and refetches when selecting Sold', async () => {
    const user = userEvent.setup()
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

    await user.click(screen.getByRole('button', { name: /^Sold$/i }))

    await waitFor(() => {
      expect(api.browseAuctions).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sold',
        })
      )
    })

    await user.click(screen.getByRole('button', { name: /^All$/i }))

    await waitFor(() => {
      const calls = vi.mocked(api.browseAuctions).mock.calls
      expect(calls.length).toBeGreaterThan(0)
      const lastCall = calls[calls.length - 1]
      expect(lastCall).toBeDefined()
      expect(lastCall?.[0]?.status).toBeUndefined()
    })
  })

  it('switches cards to static 3D icons when three model previews are present', async () => {
    vi.mocked(api.browseAuctions).mockResolvedValue({
      data: {
        items: [
          {
            id: 201,
            title: 'SU7 Custom Build',
            currentPrice: 51000,
            closeDateTime: new Date(Date.now() + 86400000).toISOString(),
            status: 'active',
            categoryName: 'Electric',
            sellerUsername: 'seller1',
            bidCount: 3,
          },
          {
            id: 202,
            title: 'Praga R1 Track Special',
            currentPrice: 73000,
            closeDateTime: new Date(Date.now() + 86400000).toISOString(),
            status: 'active',
            categoryName: 'Sports Cars',
            sellerUsername: 'seller2',
            bidCount: 4,
          },
          {
            id: 203,
            title: 'Mazzanti Evantra Rare Spec',
            currentPrice: 89000,
            closeDateTime: new Date(Date.now() + 86400000).toISOString(),
            status: 'active',
            categoryName: 'Sports Cars',
            sellerUsername: 'seller3',
            bidCount: 5,
          },
        ],
        totalCount: 3,
        page: 1,
        pageSize: 21,
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

    expect(await screen.findAllByText('3D preview available')).toHaveLength(3)
  })

  it('ignores stale browse responses when a newer request completes first', async () => {
    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'Cars',
          parentId: null,
          stringKey: 'cars',
          children: [
            { id: 2, name: 'Sedans', parentId: 1, children: [] },
            { id: 3, name: 'SUVs', parentId: 1, children: [] },
          ],
        },
      ],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as unknown as Awaited<ReturnType<typeof categoriesApi.fetchCategories>>)

    let resolveFirst: ((value: Awaited<ReturnType<typeof api.browseAuctions>>) => void) | undefined
    const firstPromise = new Promise<Awaited<ReturnType<typeof api.browseAuctions>>>((resolve) => {
      resolveFirst = resolve
    })

    const secondResponse = {
      data: {
        items: [
          {
            id: 99,
            title: 'Second Response Car',
            currentPrice: 22000,
            closeDateTime: new Date(Date.now() + 86400000).toISOString(),
            status: 'active',
            categoryName: 'SUVs',
            sellerUsername: 'seller2',
            bidCount: 1,
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
    } as unknown as Awaited<ReturnType<typeof api.browseAuctions>>

    let callCount = 0
    vi.mocked(api.browseAuctions).mockImplementation(() => {
      callCount += 1
      return callCount === 1 ? firstPromise : Promise.resolve(secondResponse)
    })

    const user = userEvent.setup()
    renderAuctionListPage('/auctions')

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /SUVs/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: /SUVs/i }))

    await waitFor(() => {
      expect(api.browseAuctions).toHaveBeenCalled()
      expect(callCount).toBeGreaterThanOrEqual(2)
    })

    expect(await screen.findByText('Second Response Car')).toBeInTheDocument()

    resolveFirst?.({
      data: {
        items: [
          {
            id: 100,
            title: 'First Response Car',
            currentPrice: 10000,
            closeDateTime: new Date(Date.now() + 86400000).toISOString(),
            status: 'active',
            categoryName: 'Sedans',
            sellerUsername: 'seller1',
            bidCount: 0,
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

    await waitFor(() => {
      expect(screen.queryByText('First Response Car')).not.toBeInTheDocument()
      expect(screen.getByText('Second Response Car')).toBeInTheDocument()
    })
  })
})
