import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from '../../pages/LoginPage'
import { AuthProvider } from '../../context/AuthContext'
import { system } from '../../theme'
import * as client from '../../api/client'

vi.mock('../../api/client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}))

function renderLoginPage() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
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
    await user.type(screen.getByLabelText(/Username or email/i), 'testuser')
    await user.type(screen.getByLabelText(/Password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /Log in/i }))
    await waitFor(() => {
      expect(client.apiClient.post).toHaveBeenCalledWith('auth/login', {
        username: 'testuser',
        password: 'password123',
      })
    })
  })
})
