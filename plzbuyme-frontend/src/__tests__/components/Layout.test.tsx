import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { AuthProvider } from '../../context/AuthContext'
import { system } from '../../theme'

function setTestToken(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  const token = [header, body, 'signature'].join('.')
  window.localStorage.setItem('token', token)
}

function renderWithProviders(role: string = 'end_user') {
  // Minimal valid-looking JWT with unexpired exp; AuthContext will decode and set user.
  setTestToken({
    sub: '1',
    unique_name: 'alice',
    email: 'alice@example.com',
    role,
    exp: 4102444800, // far-future expiry
  })

  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<div>Home</div>} />
              <Route path="/questions" element={<div>Questions Page</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </ChakraProvider>,
  )
}

describe('Layout navbar Forums link', () => {
  it('shows Forums link when logged in and navigates to /questions', async () => {
    const user = userEvent.setup()
    renderWithProviders()

    const forumsLink = await screen.findByRole('link', { name: /Forums/i })
    expect(forumsLink).toBeInTheDocument()

    await user.click(forumsLink)
    expect(screen.getByText(/Questions Page/i)).toBeInTheDocument()
  })
})

describe('Layout navbar role links', () => {
  it('shows sell and alerts links for admin users', async () => {
    renderWithProviders('admin')

    expect(await screen.findByRole('link', { name: /Sell/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /My Auctions/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Alerts/i })).toBeInTheDocument()
  })

  it('shows sell and alerts links for VIP users', async () => {
    renderWithProviders('vip')

    expect(await screen.findByRole('link', { name: /Sell/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /My Auctions/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Alerts/i })).toBeInTheDocument()
  })
})

