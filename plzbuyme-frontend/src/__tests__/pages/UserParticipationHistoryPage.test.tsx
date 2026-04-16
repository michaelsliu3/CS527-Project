import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AxiosError } from 'axios'
import { UserParticipationHistoryPage } from '../../pages/UserParticipationHistoryPage'
import * as auctionsApi from '../../api/auctions'
import { system } from '../../theme'

vi.mock('../../api/auctions', () => ({
  getUserParticipationHistory: vi.fn(),
}))

function renderPage(path = '/users/7/history') {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/users/:userId/history" element={<UserParticipationHistoryPage />} />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>
  )
}

describe('UserParticipationHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads and renders participation auctions', async () => {
    vi.mocked(auctionsApi.getUserParticipationHistory).mockResolvedValue({
      data: [
        {
          id: 1,
          title: 'History Listing',
          currentPrice: 15000,
          closeDateTime: new Date(Date.now() + 60_000).toISOString(),
          status: 'active',
          categoryName: 'Sedans',
          sellerUsername: 'seller1',
          bidCount: 2,
        },
      ],
    } as never)

    renderPage()

    await waitFor(() => {
      expect(auctionsApi.getUserParticipationHistory).toHaveBeenCalledWith(7)
    })
    expect(await screen.findByText('History Listing')).toBeInTheDocument()
  })

  it('shows forbidden error when API returns 403', async () => {
    vi.mocked(auctionsApi.getUserParticipationHistory).mockRejectedValue(
      new AxiosError('Forbidden', '403', undefined, undefined, {
        status: 403,
        statusText: 'Forbidden',
        data: null,
        headers: {},
        config: {} as never,
      })
    )

    renderPage()

    expect(await screen.findByText('You are not allowed to view this user history.')).toBeInTheDocument()
  })
})
