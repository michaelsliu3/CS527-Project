import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { MyAuctionsPage } from '../../pages/MyAuctionsPage'
import { AuthProvider } from '../../context/AuthContext'
import { SellItemModalProvider } from '../../context/SellItemModalContext'
import { system } from '../../theme'
import * as api from '../../api/auctions'

vi.mock('../../api/categories', () => ({
  fetchCategories: vi.fn().mockResolvedValue({ data: [], status: 200, statusText: 'OK', headers: {}, config: {} }),
  fetchCategoryFields: vi.fn().mockResolvedValue({ data: [], status: 200, statusText: 'OK', headers: {}, config: {} }),
}))

vi.mock('../../api/auctions', () => ({
  getMyAuctions: vi.fn(),
  createAuction: vi.fn(),
}))

function setTestToken(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  const token = [header, body, 'signature'].join('.')
  window.localStorage.setItem('token', token)
}

function renderMyAuctionsPage() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={['/my-auctions']}>
        <AuthProvider>
          <SellItemModalProvider>
            <Routes>
              <Route path="/my-auctions" element={<MyAuctionsPage />} />
            </Routes>
          </SellItemModalProvider>
        </AuthProvider>
      </MemoryRouter>
    </ChakraProvider>,
  )
}

describe('MyAuctionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    setTestToken({
      sub: '1',
      unique_name: 'alice',
      email: 'alice@example.com',
      role: 'end_user',
      exp: 4102444800,
    })
    vi.mocked(api.getMyAuctions).mockResolvedValue({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
  })

  it('opens Create Auction modal from CTA', async () => {
    const user = userEvent.setup()
    renderMyAuctionsPage()
    await waitFor(() => {
      expect(api.getMyAuctions).toHaveBeenCalled()
    })
    await user.click(screen.getByRole('button', { name: /Create Auction/i }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Create Auction')
  })
})
