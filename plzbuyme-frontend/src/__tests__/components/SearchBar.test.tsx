import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { SearchBar } from '../../components/SearchBar'
import { system } from '../../theme'
import * as auctions from '../../api/auctions'
import * as categoriesApi from '../../api/categories'

vi.mock('../../api/auctions', () => ({
  getFieldValues: vi.fn(),
}))

vi.mock('../../api/categories', () => ({
  fetchCategories: vi.fn(),
  fetchCategoryFields: vi.fn(),
}))

function renderSearchBar(
  initialEntry = '/auctions',
  variant: 'full' | 'top' | 'filters' = 'full'
) {
  function LocationProbe() {
    const location = useLocation()
    return <div data-testid="location-search">{location.search}</div>
  }

  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/auctions"
            element={
              <>
                <SearchBar variant={variant} />
                <LocationProbe />
              </>
            }
          />
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
    vi.mocked(categoriesApi.fetchCategoryFields).mockResolvedValue({
      data: [
        { id: 10, categoryId: 1, fieldName: 'Make', fieldType: 'text', isRequired: true, options: null, isInherited: true },
        { id: 11, categoryId: 1, fieldName: 'Year', fieldType: 'number', isRequired: false, options: null, isInherited: true },
        {
          id: 12,
          categoryId: 1,
          fieldName: 'Fuel Type',
          fieldType: 'select',
          isRequired: false,
          options: ['Gasoline', 'Electric'],
          selectMode: 'multi',
          isInherited: true,
        },
        {
          id: 13,
          categoryId: 1,
          fieldName: 'Condition',
          fieldType: 'select',
          isRequired: false,
          options: ['Poor', 'Fair', 'Good', 'Excellent'],
          selectMode: 'incremental',
          isInherited: true,
        },
        {
          id: 14,
          categoryId: 1,
          fieldName: 'Transmission',
          fieldType: 'select',
          isRequired: false,
          options: ['Automatic', 'Manual'],
          selectMode: 'single',
          isInherited: true,
        },
      ],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as unknown as Awaited<ReturnType<typeof categoriesApi.fetchCategoryFields>>)
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

  it('renders dynamic field controls in filters variant', async () => {
    renderSearchBar('/auctions?categoryId=2', 'filters')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Vehicle Details/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Fuel Type/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Condition/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Transmission/i })).toBeInTheDocument()
      expect(screen.getByText('Make')).toBeInTheDocument()
      expect(screen.getByText('Year range')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Gasoline' })).toBeInTheDocument()
    })
  })

  it('fetches dynamic category fields when category is selected', async () => {
    renderSearchBar('/auctions?categoryId=2', 'filters')
    await waitFor(() => {
      expect(categoriesApi.fetchCategoryFields).toHaveBeenCalledWith(1)
    })
  })

  it('uses slider UI for incremental select fields', async () => {
    const user = userEvent.setup()
    renderSearchBar('/auctions?categoryId=2', 'filters')
    const conditionToggle = await screen.findByRole('button', { name: /Condition/i })
    await user.click(conditionToggle)
    expect(screen.getByText('Poor')).toBeInTheDocument()
    expect(screen.getByText('Excellent')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Clear/i }).length).toBeGreaterThan(0)
  })

  it('uses dropdown UI for single select fields', async () => {
    const user = userEvent.setup()
    renderSearchBar('/auctions?categoryId=2', 'filters')
    const transmissionToggle = await screen.findByRole('button', { name: /Transmission/i })
    await user.click(transmissionToggle)
    expect(screen.getAllByRole('option', { name: /Automatic/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('option', { name: /Manual/i }).length).toBeGreaterThan(0)
  })

  it('submits dynamic fieldFilters JSON on apply', async () => {
    vi.mocked(auctions.getFieldValues).mockResolvedValueOnce({
      data: ['Toyota', 'Honda'],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as unknown as Awaited<ReturnType<typeof auctions.getFieldValues>>)
    const user = userEvent.setup()
    renderSearchBar('/auctions?categoryId=2', 'filters')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Vehicle Details/i })).toBeInTheDocument()
    })
    const vehicleDetailsToggle = screen.getByRole('button', { name: /Vehicle Details/i })
    await user.click(vehicleDetailsToggle)
    expect(vehicleDetailsToggle).toHaveAttribute('aria-expanded', 'true')
    const makeInput = screen.getByText('Make').parentElement?.querySelector('input') as HTMLInputElement | null
    expect(makeInput).not.toBeNull()
    await user.type(makeInput!, 'To')
    const fuelTypeToggle = screen.getByRole('button', { name: /Fuel Type/i })
    await user.click(fuelTypeToggle)
    expect(fuelTypeToggle).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('button', { name: 'Gasoline' }))
    await user.click(screen.getByRole('button', { name: /Apply Filters/i }))
    await waitFor(() => {
      const search = screen.getByTestId('location-search').textContent ?? ''
      expect(search).toContain('fieldFilters=')
    })
  })

  it('shows relevance sort option', async () => {
    renderSearchBar('/auctions?categoryId=2')
    await waitFor(() => {
      expect(screen.getAllByRole('option', { name: /Relevance/i }).length).toBeGreaterThan(0)
    })
  })

  it('updates query params with selected sort on submit', async () => {
    const user = userEvent.setup()
    renderSearchBar('/auctions')

    await waitFor(() => {
      expect(screen.getByText('Sort')).toBeInTheDocument()
    })

    const sortSelect = screen.getAllByRole('combobox').find((el) =>
      (el as HTMLSelectElement).name === 'sort'
    ) as HTMLSelectElement | undefined

    expect(sortSelect).toBeDefined()
    await user.selectOptions(sortSelect!, 'price_desc')
    await user.click(screen.getByRole('button', { name: /Search/i }))

    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain('sort=price_desc')
    })
  })

  it('shows top category bar and applies selection', async () => {
    const user = userEvent.setup()
    renderSearchBar('/auctions')

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /All Cars/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Sedans/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: /SUVs/i }))

    expect(screen.getByRole('tab', { name: /SUVs/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('resets filters when Reset All Filters is clicked', async () => {
    const user = userEvent.setup()
    renderSearchBar('/auctions?fieldFilters=%7B%2212%22%3A%5B%22Gasoline%22%5D%7D', 'filters')

    await user.click(screen.getByRole('button', { name: /Reset All Filters/i }))
    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain('page=1')
      expect(screen.getByTestId('location-search').textContent).toContain('status=active')
    })
  })

  it('migrates legacy car params into fieldFilters', async () => {
    renderSearchBar('/auctions?categoryId=2&make=Toyota&yearMin=2020', 'filters')
    await waitFor(() => {
      const search = screen.getByTestId('location-search').textContent ?? ''
      expect(search).toContain('fieldFilters=')
      expect(search).not.toContain('make=')
      expect(search).not.toContain('yearMin=')
    })
  })
})
