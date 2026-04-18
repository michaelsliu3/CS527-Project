import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { ChakraProvider } from '@chakra-ui/react'
import { GmToolsPanel } from '../../components/GmToolsPanel'
import { GmToolsDockProvider } from '../../components/GmToolsDock'
import { system } from '../../theme'
import * as gmApi from '../../api/gm'
import * as categoriesApi from '../../api/categories'
import * as auctionListRefresh from '../../utils/auctionListRefresh'
import { showErrorToast, showSuccessToast } from '../../components/ui/toaster'

vi.mock('../../api/gm', () => ({
  seedGmAuctionsFromManifest: vi.fn(),
  bulkGmUsers: vi.fn(),
  seedGmQuestions: vi.fn(),
  gmWalletTopUp: vi.fn(),
  seedGmSampleAlerts: vi.fn(),
  seedGmSampleNotifications: vi.fn(),
  seedGmSoldHistoryFixture: vi.fn(),
  seedGmSoldAuctions: vi.fn(),
  gmBulkCloseActiveAuctions: vi.fn(),
  gmRunCloseSweep: vi.fn(),
  gmDeleteAllAuctions: vi.fn(),
  gmCreateCategoryField: vi.fn(),
  gmUpdateCategoryField: vi.fn(),
  gmDeleteCategoryField: vi.fn(),
}))

vi.mock('../../api/categories', () => ({
  fetchCategories: vi.fn(),
  fetchCategoryFields: vi.fn(),
}))

vi.mock('../../components/ui/toaster', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}))

vi.mock('../../utils/auctionListRefresh', () => ({
  notifyAuctionListRefresh: vi.fn(),
  isAuctionLowDetailModeEnabled: vi.fn(() => true),
  setAuctionLowDetailModeEnabled: vi.fn(),
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
    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue({
      data: [{ id: 1, name: 'Cars', parentId: null, children: [] }],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })
    vi.mocked(categoriesApi.fetchCategoryFields).mockResolvedValue({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })
  })

  it('renders intro copy, General tab, and Seed auctions tab', () => {
    renderPanel()
    expect(screen.getByText(/Admin-only demo and QA utilities/i)).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('Seed auctions')).toBeInTheDocument()
  })

  it('seed auctions success shows success toast', async () => {
    const user = userEvent.setup()
    vi.mocked(gmApi.seedGmAuctionsFromManifest).mockResolvedValue({
      data: { createdCount: 2, auctionIds: [1, 2], totalBidsPlaced: 0 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    renderPanel()
    await user.click(screen.getByRole('tab', { name: /^Seed auctions$/i }))
    await user.click(screen.getByTestId('gm-seed-auctions'))

    await waitFor(() => {
      expect(gmApi.seedGmAuctionsFromManifest).toHaveBeenCalled()
    })
    expect(showSuccessToast).toHaveBeenCalledWith(
      'Random listings added',
      expect.stringContaining('Created 2'),
    )
    expect(auctionListRefresh.notifyAuctionListRefresh).toHaveBeenCalled()
  })

  it('refresh browse listings notifies subscribers and shows toast', async () => {
    const user = userEvent.setup()
    renderPanel()
    await user.click(screen.getByTestId('gm-refresh-browse'))
    expect(auctionListRefresh.notifyAuctionListRefresh).toHaveBeenCalled()
    expect(showSuccessToast).toHaveBeenCalledWith(
      'Browse listings refresh',
      expect.stringContaining('Subscribers'),
    )
  })

  it('toggles low-detail mode from General tab', async () => {
    const user = userEvent.setup()
    renderPanel()

    const toggle = screen.getByTestId('gm-toggle-low-detail-mode')
    expect(toggle).toHaveAttribute('data-state', 'checked')

    await user.click(toggle)

    expect(auctionListRefresh.setAuctionLowDetailModeEnabled).toHaveBeenCalledWith(false)
    expect(showSuccessToast).toHaveBeenCalledWith(
      'Low-detail mode updated',
      'Low-detail mode is now disabled.',
    )
  })

  it('seed auctions API error shows error toast', async () => {
    const user = userEvent.setup()
    const axiosErr = new AxiosError('bad request')
    axiosErr.response = {
      data: 'Count must be between 1 and 100.',
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    }
    vi.mocked(gmApi.seedGmAuctionsFromManifest).mockRejectedValue(axiosErr)

    renderPanel()
    await user.click(screen.getByRole('tab', { name: /^Seed auctions$/i }))
    await user.click(screen.getByTestId('gm-seed-auctions'))

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith('GM tools', 'Count must be between 1 and 100.')
    })
  })

  it('custom sold seeding posts and shows success toast', async () => {
    const user = userEvent.setup()
    vi.mocked(gmApi.seedGmSoldAuctions).mockResolvedValue({
      data: { createdSoldCount: 3, createdClosedCount: 2, totalBids: 7 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    renderPanel()
    await user.click(screen.getByRole('tab', { name: /History \/ reports/i }))
    await user.click(screen.getByTestId('gm-seed-custom-sold'))

    await waitFor(() => {
      expect(gmApi.seedGmSoldAuctions).toHaveBeenCalled()
    })
    expect(showSuccessToast).toHaveBeenCalledWith(
      'Custom sold auctions seeded',
      expect.stringContaining('Sold: 3, closed: 2'),
    )
  })

  it('creates a category field from Fields tab', async () => {
    const user = userEvent.setup()
    vi.mocked(gmApi.gmCreateCategoryField).mockResolvedValue({
      data: {
        id: 99,
        categoryId: 1,
        fieldName: 'Boat Length',
        fieldType: 'number',
        isRequired: true,
        options: null,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    renderPanel()
    await user.click(screen.getByRole('tab', { name: /^Fields$/i }))
    await user.selectOptions(screen.getByTestId('gm-field-create-category'), '1')
    await user.type(screen.getByPlaceholderText('e.g. Engine Size'), 'Boat Length')
    await user.click(screen.getByRole('button', { name: /Add field/i }))

    await waitFor(() => {
      expect(gmApi.gmCreateCategoryField).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          fieldName: 'Boat Length',
          fieldType: 'text',
        }),
      )
    })
  })

  it('creates a select field with incremental select mode', async () => {
    const user = userEvent.setup()
    vi.mocked(gmApi.gmCreateCategoryField).mockResolvedValue({
      data: {
        id: 100,
        categoryId: 1,
        fieldName: 'Condition',
        fieldType: 'select',
        isRequired: true,
        options: ['Poor', 'Fair', 'Good'],
        selectMode: 'incremental',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    renderPanel()
    await user.click(screen.getByRole('tab', { name: /^Fields$/i }))
    await user.selectOptions(screen.getByTestId('gm-field-create-category'), '1')
    await user.type(screen.getByPlaceholderText('e.g. Engine Size'), 'Condition')
    const fieldTypeSelect = screen
      .getAllByRole('combobox')
      .find((el) => Array.from((el as HTMLSelectElement).options).some((option) => option.value === 'number'))
    expect(fieldTypeSelect).toBeDefined()
    await user.selectOptions(fieldTypeSelect as HTMLSelectElement, 'select')

    const selectModeSelect = screen
      .getAllByRole('combobox')
      .find((el) => Array.from((el as HTMLSelectElement).options).some((option) => option.value === 'incremental'))
    expect(selectModeSelect).toBeDefined()
    await user.selectOptions(selectModeSelect as HTMLSelectElement, 'incremental')
    await user.type(screen.getByPlaceholderText('Type one option'), 'Poor')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.type(screen.getByPlaceholderText('Type one option'), 'Fair')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.type(screen.getByPlaceholderText('Type one option'), 'Good')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: /Add field/i }))

    await waitFor(() => {
      expect(gmApi.gmCreateCategoryField).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          fieldName: 'Condition',
          fieldType: 'select',
          selectMode: 'incremental',
        }),
      )
    })
  })

  it('defaults Condition select mode to incremental', async () => {
    const user = userEvent.setup()
    vi.mocked(gmApi.gmCreateCategoryField).mockResolvedValue({
      data: {
        id: 101,
        categoryId: 1,
        fieldName: 'Condition',
        fieldType: 'select',
        isRequired: true,
        options: ['Poor', 'Fair', 'Good'],
        selectMode: 'incremental',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    renderPanel()
    await user.click(screen.getByRole('tab', { name: /^Fields$/i }))
    await user.selectOptions(screen.getByTestId('gm-field-create-category'), '1')
    await user.type(screen.getByPlaceholderText('e.g. Engine Size'), 'Condition')
    const fieldTypeSelect = screen
      .getAllByRole('combobox')
      .find((el) => Array.from((el as HTMLSelectElement).options).some((option) => option.value === 'number'))
    expect(fieldTypeSelect).toBeDefined()
    await user.selectOptions(fieldTypeSelect as HTMLSelectElement, 'select')
    await user.type(screen.getByPlaceholderText('Type one option'), 'Poor')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.type(screen.getByPlaceholderText('Type one option'), 'Fair')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: /Add field/i }))

    await waitFor(() => {
      expect(gmApi.gmCreateCategoryField).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          fieldName: 'Condition',
          fieldType: 'select',
          selectMode: 'incremental',
        }),
      )
    })
  })

  it('does not allow removing protected default filter fields', async () => {
    const user = userEvent.setup()
    vi.mocked(categoriesApi.fetchCategoryFields).mockResolvedValue({
      data: [
        {
          id: 5,
          categoryId: 1,
          fieldName: 'Condition',
          fieldType: 'select',
          isRequired: true,
          options: ['Poor', 'Fair', 'Good'],
          selectMode: 'incremental',
          isInherited: false,
        },
      ],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    renderPanel()
    await user.click(screen.getByRole('tab', { name: /^Fields$/i }))
    await user.selectOptions(screen.getByTestId('gm-field-assign-category'), '1')

    await waitFor(() => {
      expect(screen.getByText(/Protected default filter/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /Remove assignment/i })).not.toBeInTheDocument()
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
