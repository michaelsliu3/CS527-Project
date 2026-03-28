import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactElement } from 'react'
import { AuthProvider } from '../../context/AuthContext'
import { SellItemModalProvider, useSellItemModal } from '../../context/SellItemModalContext'
import { system } from '../../theme'
import * as categoriesApi from '../../api/categories'
import * as auctionsApi from '../../api/auctions'

vi.mock('../../api/categories', () => ({
  fetchCategories: vi.fn(),
  fetchCategoryFields: vi.fn(),
}))

vi.mock('../../api/auctions', () => ({
  createAuction: vi.fn(),
}))

vi.mock('../../api/cdn', () => ({
  uploadFileToCdn: vi.fn(),
}))

function setTestToken(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  const token = [header, body, 'signature'].join('.')
  window.localStorage.setItem('token', token)
}

function Opener() {
  const { openSellModal } = useSellItemModal()
  return (
    <button type="button" onClick={() => openSellModal()}>
      Open sell modal
    </button>
  )
}

function renderWithSellModal(ui: ReactElement) {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <SellItemModalProvider>
            <Routes>
              <Route path="/" element={ui} />
            </Routes>
          </SellItemModalProvider>
        </AuthProvider>
      </MemoryRouter>
    </ChakraProvider>,
  )
}

describe('SellItemModalContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    setTestToken({
      sub: '1',
      unique_name: 'seller',
      email: 'seller@example.com',
      role: 'end_user',
      exp: 4102444800,
    })
    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue({
      data: [
        {
          id: 10,
          name: 'Cars',
          parentId: null,
          children: [{ id: 20, name: 'Sedans', parentId: 10, children: [] }],
        },
      ],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
    vi.mocked(categoriesApi.fetchCategoryFields).mockResolvedValue({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
  })

  it('opens and closes via Cancel; reopening shows a reset title field', async () => {
    const user = userEvent.setup()
    renderWithSellModal(<Opener />)

    await user.click(screen.getByRole('button', { name: /Open sell modal/i }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Create Auction')

    const titleInput = within(dialog).getByPlaceholderText('Item title')
    await user.type(titleInput, 'My listing')
    expect(titleInput).toHaveValue('My listing')

    await user.click(within(dialog).getByRole('button', { name: /^Cancel$/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Open sell modal/i }))
    const dialog2 = await screen.findByRole('dialog')
    expect(within(dialog2).getByPlaceholderText('Item title')).toHaveValue('')
  })

  it('shows category validation when submitting without category selection', async () => {
    const user = userEvent.setup()
    renderWithSellModal(<Opener />)
    await user.click(screen.getByRole('button', { name: /Open sell modal/i }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByPlaceholderText('Item title'), 'Test title')
    await user.type(within(dialog).getByPlaceholderText('Description'), 'Desc')
    const spins = within(dialog).getAllByRole('spinbutton')
    expect(spins.length).toBeGreaterThanOrEqual(3)
    await user.type(spins[0]!, '100')
    await user.type(spins[1]!, '5')
    await user.type(spins[2]!, '50')

    const future = new Date()
    future.setDate(future.getDate() + 2)
    const y = future.getFullYear()
    const m = String(future.getMonth() + 1).padStart(2, '0')
    const d = String(future.getDate()).padStart(2, '0')
    await user.type(within(dialog).getByPlaceholderText('Select date'), `${y}-${m}-${d}`)
    // Close the date grid so it does not steal clicks from the time popover (openOnClick keeps it open while typing).
    await user.click(within(dialog).getByRole('button', { name: /close calendar/i }))

    await user.click(screen.getByRole('button', { name: /choose closing time/i }))
    const timeHeading = await screen.findByText('Closing time')
    const timePopoverContent = timeHeading.closest('[data-part="content"]')
    expect(timePopoverContent).toBeTruthy()
    const inTimePopover = within(timePopoverContent as HTMLElement)
    await user.click(inTimePopover.getByRole('button', { name: /closing hour 12/i }))
    await user.click(inTimePopover.getByRole('button', { name: /closing time pm/i }))
    await user.click(inTimePopover.getByRole('button', { name: /closing minute 00/i }))

    await user.click(within(dialog).getByRole('button', { name: /^Create Auction$/i }))

    await waitFor(() => {
      expect(within(dialog).getByText(/Please select a category/i)).toBeInTheDocument()
    })
    expect(vi.mocked(auctionsApi.createAuction)).not.toHaveBeenCalled()
  })
})
