import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { GmToolsPage } from '../../pages/admin/GmToolsPage'
import { AuthProvider } from '../../context/AuthContext'
import { system } from '../../theme'
import * as gmApi from '../../api/gm'
import { showErrorToast, showSuccessToast } from '../../components/ui/toaster'

vi.mock('../../api/gm', () => ({
  GM_CONFIRM_PHRASE: 'CONFIRM_GM',
  seedGmAuctions: vi.fn(),
  seedGmAuctionsFromManifest: vi.fn(),
  bulkGmUsers: vi.fn(),
  seedGmQuestions: vi.fn(),
  gmWalletTopUp: vi.fn(),
  seedGmSampleAlerts: vi.fn(),
  seedGmSampleNotifications: vi.fn(),
  seedGmSoldHistoryFixture: vi.fn(),
}))

vi.mock('../../components/ui/toaster', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}))

const adminToken = `header.${btoa(JSON.stringify({ sub: '1', unique_name: 'admin', role: 'admin', exp: 9999999999 }))}.sig`

function renderGmPage() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={['/admin/gm']}>
        <AuthProvider>
          <Routes>
            <Route path="/admin/gm" element={<GmToolsPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </ChakraProvider>
  )
}

describe('GmToolsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('token', adminToken)
  })

  it('renders GM tools heading for admin context', () => {
    renderGmPage()
    expect(screen.getByText('GM tools')).toBeInTheDocument()
    expect(screen.getByText(/Admin-only demo and QA utilities/i)).toBeInTheDocument()
  })

  it('seed auctions success shows success toast', async () => {
    const user = userEvent.setup()
    vi.mocked(gmApi.seedGmAuctions).mockResolvedValue({
      data: { createdCount: 2, auctionIds: [1, 2], totalBidsPlaced: 0 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    renderGmPage()
    await user.click(screen.getByTestId('gm-seed-auctions'))

    await waitFor(() => {
      expect(gmApi.seedGmAuctions).toHaveBeenCalled()
    })
    expect(showSuccessToast).toHaveBeenCalledWith(
      'Auctions seeded',
      expect.stringContaining('Created 2')
    )
  })

  it('seed auctions API error shows error toast', async () => {
    const user = userEvent.setup()
    const axiosErr = new AxiosError('bad request')
    axiosErr.response = {
      data: 'Count must be between 1 and 50.',
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    }
    vi.mocked(gmApi.seedGmAuctions).mockRejectedValue(axiosErr)

    renderGmPage()
    await user.click(screen.getByTestId('gm-seed-auctions'))

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith('GM tools', 'Count must be between 1 and 50.')
    })
  })
})
