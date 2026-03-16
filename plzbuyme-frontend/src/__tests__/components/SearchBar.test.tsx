import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { SearchBar } from '../../components/SearchBar'
import { system } from '../../theme'
import * as auctions from '../../api/auctions'

vi.mock('../../api/auctions', () => ({
  getFieldValues: vi.fn(),
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
  })

  it('has keyword input and Search button and submits without error', async () => {
    const user = userEvent.setup()
    renderSearchBar('/auctions')
    await user.type(screen.getByPlaceholderText(/Search title or description/i), 'Toyota')
    await user.click(screen.getByRole('button', { name: /Search/i }))
    expect(screen.getByRole('button', { name: /Search/i })).toBeInTheDocument()
  })

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

  it('appends car sort options when Cars category selected', () => {
    renderSearchBar('/auctions?categoryId=2')
    expect(screen.getByRole('option', { name: /Year: newest/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Mileage: low to high/i })).toBeInTheDocument()
  })
})
