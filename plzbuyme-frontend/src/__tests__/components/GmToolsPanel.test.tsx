import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { ChakraProvider } from '@chakra-ui/react'
import { GmToolsPanel } from '../../components/GmToolsPanel'
import { GmToolsDockProvider } from '../../components/GmToolsDock'
import { system } from '../../theme'
import * as gmApi from '../../api/gm'
import { showErrorToast, showSuccessToast } from '../../components/ui/toaster'

vi.mock('../../api/gm', () => ({
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

function renderPanel() {
  return render(
    <ChakraProvider value={system}>
      <GmToolsPanel />
    </ChakraProvider>,
  )
}

describe('GmToolsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders intro copy and auction tab', () => {
    renderPanel()
    expect(screen.getByText(/Admin-only demo and QA utilities/i)).toBeInTheDocument()
    expect(screen.getByText('Random auctions')).toBeInTheDocument()
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

    renderPanel()
    await user.click(screen.getByTestId('gm-seed-auctions'))

    await waitFor(() => {
      expect(gmApi.seedGmAuctions).toHaveBeenCalled()
    })
    expect(showSuccessToast).toHaveBeenCalledWith(
      'Auctions seeded',
      expect.stringContaining('Created 2'),
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

    renderPanel()
    await user.click(screen.getByTestId('gm-seed-auctions'))

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith('GM tools', 'Count must be between 1 and 50.')
    })
  })
})

describe('GmToolsDockProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens GM dialog when edge tab is clicked', async () => {
    const user = userEvent.setup()
    render(
      <ChakraProvider value={system}>
        <GmToolsDockProvider enabled>
          <div>App</div>
        </GmToolsDockProvider>
      </ChakraProvider>,
    )

    await user.click(screen.getByRole('button', { name: /open gm tools/i }))
    await waitFor(() => {
      expect(screen.getByText(/Admin-only demo and QA utilities/i)).toBeInTheDocument()
    })
  })
})
