import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ReportsPage } from '../../pages/admin/ReportsPage'
import { AuthProvider } from '../../context/AuthContext'
import { system } from '../../theme'
import * as adminApi from '../../api/admin'

vi.mock('../../api/admin', () => ({
  getTotalEarnings: vi.fn(),
  getEarningsByType: vi.fn(),
  getEarningsByUser: vi.fn(),
  getEarningsByItem: vi.fn(),
  getBestSelling: vi.fn(),
  getBestBuyers: vi.fn(),
}))

const adminToken = `header.${btoa(JSON.stringify({ sub: '1', unique_name: 'admin', role: 'admin', exp: 9999999999 }))}.sig`

function renderReportsPage() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={['/admin/reports']}>
        <AuthProvider>
          <Routes>
            <Route path="/admin/reports" element={<ReportsPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </ChakraProvider>
  )
}

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('token', adminToken)
    vi.mocked(adminApi.getTotalEarnings).mockResolvedValue({
      data: { total: 50000.25, soldCount: 5, averageSale: 10000.05, distinctSellers: 3, distinctBuyers: 4 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
    vi.mocked(adminApi.getEarningsByType).mockResolvedValue({
      data: [
        { categoryId: 1, categoryName: 'Sedans', earnings: 30000 },
        { categoryId: 2, categoryName: 'SUVs', earnings: 20000.25 },
      ],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
    vi.mocked(adminApi.getEarningsByUser).mockResolvedValue({
      data: {
        items: [{ userId: 1, username: 'seller1', totalAsSeller: 15000, totalAsWinner: 0 }],
        totalCount: 30,
        page: 1,
        pageSize: 25,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
    vi.mocked(adminApi.getEarningsByItem).mockResolvedValue({
      data: {
        items: [{ itemId: 1, title: 'Toyota Camry', price: 22000 }],
        totalCount: 30,
        page: 1,
        pageSize: 25,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
    vi.mocked(adminApi.getBestSelling).mockResolvedValue({
      data: [
        { itemId: 1, title: 'Honda Civic', price: 25000, bidCount: 12 },
      ],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
    vi.mocked(adminApi.getBestBuyers).mockResolvedValue({
      data: [
        { userId: 2, username: 'buyer1', totalSpent: 45000, winCount: 3 },
      ],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
  })

  it('Total Earnings tab fetches and displays data', async () => {
    renderReportsPage()
    await waitFor(() => {
      expect(adminApi.getTotalEarnings).toHaveBeenCalled()
    })
    expect(screen.getByText('Reports')).toBeInTheDocument()
    expect(screen.getByText(/Total earnings:/)).toBeInTheDocument()
    expect(screen.getByText(/Total earnings:\s*\$50,000\.25/)).toBeInTheDocument()
    expect(screen.getByText(/Sold auctions/i)).toBeInTheDocument()
  })

  it('By Type tab fetches and displays data', async () => {
    const user = userEvent.setup()
    renderReportsPage()
    await waitFor(() => {
      expect(adminApi.getTotalEarnings).toHaveBeenCalled()
    })
    await user.click(screen.getByRole('tab', { name: 'By Type' }))
    await waitFor(() => {
      expect(adminApi.getEarningsByType).toHaveBeenCalled()
    })
    expect(screen.getByText('Sedans')).toBeInTheDocument()
    expect(screen.getByText('SUVs')).toBeInTheDocument()
    expect(screen.getByText(/30,?000/)).toBeInTheDocument()
    expect(screen.getByText(/20,?000/)).toBeInTheDocument()
  })

  it('Best Selling tab fetches and displays data', async () => {
    const user = userEvent.setup()
    renderReportsPage()
    await waitFor(() => {
      expect(adminApi.getTotalEarnings).toHaveBeenCalled()
    })
    await user.click(screen.getByRole('tab', { name: 'Best Selling' }))
    await waitFor(() => {
      expect(adminApi.getBestSelling).toHaveBeenCalledWith(10, expect.any(Object))
    })
    expect(screen.getByText('Honda Civic')).toBeInTheDocument()
    expect(screen.getByText(/25,?000/)).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('Best Buyers tab fetches and displays data', async () => {
    const user = userEvent.setup()
    renderReportsPage()
    await waitFor(() => {
      expect(adminApi.getTotalEarnings).toHaveBeenCalled()
    })
    await user.click(screen.getByRole('tab', { name: 'Best Buyers' }))
    await waitFor(() => {
      expect(adminApi.getBestBuyers).toHaveBeenCalledWith(10, expect.any(Object))
    })
    const buyerCell = screen.getByText('buyer1')
    const buyerRow = buyerCell.closest('tr')
    expect(buyerRow).not.toBeNull()
    expect(within(buyerRow as HTMLTableRowElement).getByText(/45,?000/)).toBeInTheDocument()
    expect(within(buyerRow as HTMLTableRowElement).getByText('3')).toBeInTheDocument()
  })

  it('applies shared filters and sends them to report requests', async () => {
    const user = userEvent.setup()
    renderReportsPage()
    await waitFor(() => {
      expect(adminApi.getTotalEarnings).toHaveBeenCalled()
    })

    await user.clear(screen.getByLabelText('From'))
    await user.type(screen.getByLabelText('From'), '2026-01-01')
    await user.clear(screen.getByLabelText('To'))
    await user.type(screen.getByLabelText('To'), '2026-03-01')
    fireEvent.change(screen.getByLabelText('Top N'), { target: { value: '15' } })
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => {
      expect(adminApi.getTotalEarnings).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: '2026-01-01', to: '2026-03-01', top: 15 }),
      )
    })
  })

  it('paginates by-item table', async () => {
    const user = userEvent.setup()
    renderReportsPage()
    await user.click(screen.getByRole('tab', { name: 'By Item' }))
    await waitFor(() => {
      expect(adminApi.getEarningsByItem).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 25 }))
    })

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => {
      expect(adminApi.getEarningsByItem).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 25 }))
    })
  })
})
