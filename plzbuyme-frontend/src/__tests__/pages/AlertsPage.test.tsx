import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AlertsPage } from '../../pages/AlertsPage'
import { AuthProvider } from '../../context/AuthContext'
import { system } from '../../theme'
import * as alertsApi from '../../api/alerts'
import * as categoriesApi from '../../api/categories'

vi.mock('../../api/alerts', () => ({
  listAlerts: vi.fn(),
  createAlert: vi.fn(),
  deleteAlert: vi.fn(),
}))

vi.mock('../../api/categories', async () => {
  const actual = await vi.importActual<typeof import('../../api/categories')>('../../api/categories')
  return {
    ...actual,
    fetchCategories: vi.fn(),
  }
})

function renderAlertsPage() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={['/alerts']}>
        <AuthProvider>
          <Routes>
            <Route path="/alerts" element={<AlertsPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </ChakraProvider>
  )
}

const mockCategoryTree = [
  {
    id: 1,
    name: 'Cars',
    parentId: null as number | null,
    children: [{ id: 2, name: 'Sedans', parentId: 1, children: [] as never[] }],
  },
]

describe('AlertsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(alertsApi.listAlerts).mockResolvedValue({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue({
      data: mockCategoryTree,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
  })

  it('create alert form submits correct payload', async () => {
    const user = userEvent.setup()
    vi.mocked(alertsApi.createAlert).mockResolvedValue({
      data: {
        id: 1,
        userId: 1,
        categoryId: 2,
        keyword: 'Toyota',
        criteria: null,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
    renderAlertsPage()
    await waitFor(() => {
      expect(alertsApi.listAlerts).toHaveBeenCalled()
    })
    await user.click(screen.getByRole('button', { name: /Create alert/i }))
    await waitFor(() => {
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(dialog).toHaveTextContent('Create alert')
    })
    const keywordInput = screen.getByPlaceholderText(/e.g. Toyota/i)
    await user.type(keywordInput, 'Camry')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(() => {
      expect(alertsApi.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          keyword: 'Camry',
        })
      )
    })
  })

  it('delete shows confirmation', async () => {
    const user = userEvent.setup()
    vi.mocked(alertsApi.listAlerts).mockResolvedValue({
      data: [
        {
          id: 1,
          userId: 1,
          categoryId: null,
          keyword: 'test',
          criteria: null,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
    renderAlertsPage()
    await waitFor(() => {
      expect(screen.getByText(/test/)).toBeInTheDocument()
    })
    const deleteBtn = screen.getByRole('button', { name: /Delete alert/i })
    await user.click(deleteBtn)
    await waitFor(() => {
      const dialogs = screen.getAllByRole('dialog')
      const deleteDialog = dialogs.find((d) => d.textContent?.includes('Delete alert'))
      expect(deleteDialog).toBeInTheDocument()
      expect(screen.getByText(/Are you sure you want to delete this alert/i)).toBeInTheDocument()
    })
  })
})
