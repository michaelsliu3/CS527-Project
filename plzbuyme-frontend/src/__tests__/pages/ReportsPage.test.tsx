import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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
    expect(screen.getAllByText(/Sold auctions/i).length).toBeGreaterThan(0)
  })

  it('By Type panel fetches and displays data', async () => {
    renderReportsPage()
    await waitFor(() => {
      expect(adminApi.getEarningsByType).toHaveBeenCalled()
    })
    expect(screen.getAllByText('Sedans').length).toBeGreaterThan(0)
    expect(screen.getAllByText('SUVs').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/30,?000/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/20,?000/).length).toBeGreaterThan(0)
  })

  it('Best Selling panel fetches and displays data', async () => {
    renderReportsPage()
    await waitFor(() => {
      expect(adminApi.getBestSelling).toHaveBeenCalledWith(10, expect.any(Object))
    })
    expect(screen.getAllByText('Honda Civic').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/25,?000/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('12').length).toBeGreaterThan(0)
  })

  it('paginates best-selling panel in groups of 5', async () => {
    const user = userEvent.setup()
    vi.mocked(adminApi.getBestSelling).mockResolvedValueOnce({
      data: Array.from({ length: 8 }, (_, i) => ({
        itemId: i + 1,
        title: `Car ${i + 1}`,
        price: 10000 + i,
        bidCount: i + 2,
      })),
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)

    renderReportsPage()
    await waitFor(() => expect(adminApi.getBestSelling).toHaveBeenCalled())
    expect(screen.getAllByText(/Page 1 \/ 2/).length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole('button', { name: 'Next' })[2])
    expect(screen.getAllByText(/Page 2 \/ 2/).length).toBeGreaterThan(0)
  })

  it('Best Buyers panel fetches and displays data', async () => {
    renderReportsPage()
    await waitFor(() => {
      expect(adminApi.getBestBuyers).toHaveBeenCalledWith(10, expect.any(Object))
    })
    const buyerMatches = await screen.findAllByText('buyer1')
    const buyerCell = buyerMatches.find((el) => el.tagName.toLowerCase() === 'td')
    expect(buyerCell).toBeDefined()
    const buyerTableRow = buyerCell?.closest('tr')
    expect(buyerTableRow).not.toBeNull()
    expect(within(buyerTableRow as HTMLTableRowElement).getByText(/45,?000/)).toBeInTheDocument()
    expect(within(buyerTableRow as HTMLTableRowElement).getByText('3')).toBeInTheDocument()
  })

  it('paginates best-buyers panel in groups of 5', async () => {
    const user = userEvent.setup()
    vi.mocked(adminApi.getBestBuyers).mockResolvedValueOnce({
      data: Array.from({ length: 7 }, (_, i) => ({
        userId: i + 1,
        username: `buyer${i + 1}`,
        totalSpent: 2000 + i * 10,
        winCount: i + 1,
      })),
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)

    renderReportsPage()
    await waitFor(() => expect(adminApi.getBestBuyers).toHaveBeenCalled())
    expect((await screen.findAllByText(/Page 1 \/ 2/)).length).toBeGreaterThan(0)
    await user.click((await screen.findAllByRole('button', { name: 'Next' }))[3])
    expect((await screen.findAllByText(/Page 2 \/ 2/)).length).toBeGreaterThan(0)
  })

  it('renders without the top date filter bar and uses default report params', async () => {
    renderReportsPage()
    await waitFor(() => {
      expect(adminApi.getTotalEarnings).toHaveBeenCalledWith(expect.objectContaining({ top: 10 }))
    })
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('To')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Top N')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument()
  })

  it('paginates by-item table', async () => {
    const user = userEvent.setup()
    renderReportsPage()
    await waitFor(() => {
      expect(adminApi.getEarningsByItem).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 5 }))
    })

    const nextButtons = await screen.findAllByRole('button', { name: 'Next' })
    await user.click(nextButtons[1])
    await waitFor(() => {
      expect(adminApi.getEarningsByItem).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 5 }))
    })
  })

  it('requests by-user table with page size 5', async () => {
    renderReportsPage()
    await waitFor(() => {
      expect(adminApi.getEarningsByUser).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 5 }))
    })
  })
})
