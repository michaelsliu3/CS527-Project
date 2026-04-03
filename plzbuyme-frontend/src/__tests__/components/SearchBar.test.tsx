import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { SearchBar } from '../../components/SearchBar'
import { system } from '../../theme'
import * as auctions from '../../api/auctions'
import * as categoriesApi from '../../api/categories'

vi.mock('../../api/auctions', () => ({
  getFieldValues: vi.fn(),
}))

vi.mock('../../api/categories', () => ({
  fetchCategories: vi.fn(),
}))

function renderSearchBar(initialEntry = '/auctions') {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/auctions" element={<SearchBar />} />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>
  )
}

describe('SearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'Cars',
          parentId: null,
          // Intentionally different casing to ensure hub-root detection is case-insensitive.
          stringKey: 'Cars',
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
  })

  it(
    'has keyword input and Search button and submits without error',
    async () => {
      renderSearchBar('/auctions')
      const input = screen.getByPlaceholderText(/Search title or description/i)
      fireEvent.change(input, { target: { value: 'Toyota' } })
      fireEvent.click(screen.getByRole('button', { name: /Search/i }))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Search/i })).toBeInTheDocument()
      })
    },
    10_000,
  )

  it('renders car-specific inputs when Cars subcategory is selected', () => {
    renderSearchBar('/auctions?categoryId=2')
    expect(screen.getByPlaceholderText(/e.g. Toyota/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/e.g. Camry/i)).toBeInTheDocument()
  })

  it('fetches field-values endpoint for Make autocomplete', async () => {
    vi.mocked(auctions.getFieldValues).mockResolvedValueOnce({
      data: ['Toyota', 'Honda'],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as unknown as Awaited<ReturnType<typeof auctions.getFieldValues>>)
    const user = userEvent.setup()
    renderSearchBar('/auctions?categoryId=2')
    const makeInput = screen.getByPlaceholderText(/e.g. Toyota/i)
    await user.type(makeInput, 'To')
    await waitFor(() => {
      expect(auctions.getFieldValues).toHaveBeenCalledWith(
        'Make',
        undefined,
        'To'
      )
    })
  })

  it('uses only default sort options when hub has no extraSortOptions', async () => {
    renderSearchBar('/auctions?categoryId=2')
    await waitFor(() => {
      expect(screen.getAllByRole('option', { name: /Newest/i }).length).toBeGreaterThan(0)
    })
    expect(screen.queryAllByRole('option', { name: /Year: newest/i })).toHaveLength(0)
  })

  it('shows top category bar and applies selection', async () => {
    const user = userEvent.setup()
    renderSearchBar('/auctions')

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /All Cars/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Sedans/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: /SUVs/i }))

    expect(screen.getByPlaceholderText(/e.g. Toyota/i)).toBeInTheDocument()
  })
})
