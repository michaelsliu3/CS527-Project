import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LoginPage } from '../../pages/LoginPage'
import { AuthProvider } from '../../context/AuthContext'
import { system } from '../../theme'
import * as client from '../../api/client'

vi.mock('../../api/client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}))

function renderLoginPage(initialEntry = '/login') {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<div>Home</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </ChakraProvider>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('form submits and calls login', async () => {
    const user = userEvent.setup()
    vi.mocked(client.apiClient.post).mockResolvedValueOnce({
      data: {
        token: 'jwt.here',
        username: 'testuser',
        email: 'test@example.com',
        role: 'end_user',
        userId: 1,
      },
    })
    renderLoginPage()
    await user.type(screen.getByLabelText(/Email or username/i), 'testuser')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /Sign in/i }))
    await waitFor(() => {
      expect(client.apiClient.post).toHaveBeenCalledWith('auth/login', {
        username: 'testuser',
        password: 'password123',
      })
    })
  })

  it('shows error on failure', async () => {
    const user = userEvent.setup()
    vi.mocked(client.apiClient.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { message: 'Invalid credentials' } },
    })
    renderLoginPage()
    await user.type(screen.getByLabelText(/Email or username/i), 'wronguser')
    await user.type(screen.getByLabelText('Password'), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /Sign in/i }))
    await waitFor(() => {
      expect(screen.getByText('Sign in failed')).toBeInTheDocument()
    })
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
  })

  it('redirects on success', async () => {
    const user = userEvent.setup()
    vi.mocked(client.apiClient.post).mockResolvedValueOnce({
      data: {
        token: 'jwt.here',
        username: 'testuser',
        email: 'test@example.com',
        role: 'end_user',
        userId: 1,
      },
    })
    renderLoginPage()
    await user.type(screen.getByLabelText(/Email or username/i), 'testuser')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /Sign in/i }))
    await waitFor(
      () => {
        expect(screen.getByText('Home')).toBeInTheDocument()
      },
      { timeout: 2500 }
    )
  })
})
