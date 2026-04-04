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
import * as gmApi from '../../api/gm'

vi.mock('../../api/categories', () => ({
  fetchCategories: vi.fn(),
  fetchCategoryFields: vi.fn(),
}))

vi.mock('../../api/auctions', () => ({
  createAuction: vi.fn(),
}))

vi.mock('../../api/gm', () => ({
  searchGmManifestCars: vi.fn(),
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
    vi.mocked(gmApi.searchGmManifestCars).mockResolvedValue({
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

    // Default "Ends after…" + 1 day computes close time on submit; no custom date UI needed.

    await user.click(within(dialog).getByRole('button', { name: /^Create Auction$/i }))

    await waitFor(() => {
      expect(within(dialog).getByText(/Please select a category/i)).toBeInTheDocument()
    })
    expect(vi.mocked(auctionsApi.createAuction)).not.toHaveBeenCalled()
  })

  it('does not render quick-create button for non-admin users', async () => {
    const user = userEvent.setup()
    renderWithSellModal(<Opener />)

    await user.click(screen.getByRole('button', { name: /Open sell modal/i }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).queryByRole('button', { name: /^Quick create$/i })).not.toBeInTheDocument()
  })

  it('renders admin quick-create and autofills fields from manifest selection', async () => {
    window.localStorage.clear()
    setTestToken({
      sub: '1',
      unique_name: 'admin',
      email: 'admin@example.com',
      role: 'admin',
      exp: 4102444800,
    })

    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue({
      data: [
        {
          id: 10,
          name: 'Cars',
          parentId: null,
          children: [
            { id: 20, name: 'Sedans', parentId: 10, children: [] },
            { id: 21, name: 'Sports Cars', parentId: 10, children: [] },
          ],
        },
      ],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
    vi.mocked(categoriesApi.fetchCategoryFields).mockImplementation(async (categoryId: number) => {
      if (categoryId === 20) {
        return {
          data: [
            { id: 201, fieldName: 'Make', fieldType: 'text', isRequired: true },
            { id: 202, fieldName: 'Model', fieldType: 'text', isRequired: true },
            { id: 203, fieldName: 'Year', fieldType: 'number', isRequired: true },
          ],
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        } as never
      }
      return {
        data: [],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as never
    })

    vi.mocked(gmApi.searchGmManifestCars).mockResolvedValue({
      data: [
        {
          externalId: '12345',
          title: "Honda Civic Type R '22",
          make: 'Honda',
          model: 'Civic Type R',
          year: 2022,
          color: null,
          sourceUrl: 'https://example.com/car.png',
          detailSourceUrl: null,
          categoryIds: [20],
          categoryNames: ['Sedans'],
          categoryStringKeys: ['sedans'],
        },
      ],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)

    const user = userEvent.setup()
    renderWithSellModal(<Opener />)

    await user.click(screen.getByRole('button', { name: /Open sell modal/i }))
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: /^Quick create$/i }))
    const quickSearch = within(dialog).getByPlaceholderText('Search make, model, year, or variant')
    await user.type(quickSearch, 'civic')

    await waitFor(() => {
      expect(gmApi.searchGmManifestCars).toHaveBeenCalledWith('civic', 8)
    })

    const resultButton = await within(dialog).findByRole('button', { name: /Honda Civic Type R/i })
    await user.click(resultButton)

    expect(within(dialog).getByPlaceholderText('Item title')).toHaveValue('Honda Civic Type R 2022')
    const descriptionInput = within(dialog).getByPlaceholderText('Description') as HTMLTextAreaElement
    expect(descriptionInput.value).toContain('Auto-filled from GT7 manifest:')
    expect(within(dialog).queryByPlaceholderText('Search make, model, year, or variant')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Sedans')).toBeInTheDocument()
  })

  it('keeps manifest selector closed after closing and reopening modal', async () => {
    window.localStorage.clear()
    setTestToken({
      sub: '1',
      unique_name: 'admin',
      email: 'admin@example.com',
      role: 'admin',
      exp: 4102444800,
    })

    const user = userEvent.setup()
    renderWithSellModal(<Opener />)

    await user.click(screen.getByRole('button', { name: /Open sell modal/i }))
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: /^Quick create$/i }))
    expect(within(dialog).getByPlaceholderText('Search make, model, year, or variant')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /^Cancel$/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Open sell modal/i }))
    const reopenedDialog = await screen.findByRole('dialog')
    expect(
      within(reopenedDialog).queryByPlaceholderText('Search make, model, year, or variant'),
    ).not.toBeInTheDocument()
  })
})
