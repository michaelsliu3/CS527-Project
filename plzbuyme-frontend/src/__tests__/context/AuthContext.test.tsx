import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from '../../context/AuthContext'
import { system } from '../../theme'
import * as client from '../../api/client'

vi.mock('../../api/client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

function TestConsumer() {
  const { user, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="user">{user ? user.username : 'none'}</span>
      <button type="button" onClick={() => login('u', 'p')}>
        Login
      </button>
      <button type="button" onClick={() => logout()}>
        Logout
      </button>
    </div>
  )
}

function renderWithAuth() {
  return render(
    <ChakraProvider value={system}>
      <BrowserRouter>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </BrowserRouter>
    </ChakraProvider>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(client.apiClient.get).mockRejectedValue(new Error('profile fetch not mocked'))
  })

  it('login stores JWT and sets user state', async () => {
    const user = userEvent.setup()
    vi.mocked(client.apiClient.post).mockResolvedValueOnce({
      data: {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidW5pcXVlX25hbWUiOiJ0ZXN0Iiwicm9sZSI6ImVuZF91c2VyIiwiZXhwIjo5OTk5OTk5OTk5fQ.x',
        username: 'test',
        email: 'test@example.com',
        role: 'end_user',
        userId: 1,
      },
    })
    renderWithAuth()
    expect(screen.getByTestId('user')).toHaveTextContent('none')
    await user.click(screen.getByRole('button', { name: /Login/i }))
    await waitFor(() => {
      expect(localStorage.getItem('token')).toBeTruthy()
    })
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test')
    })
  })

  it('logout clears token and user state', async () => {
    const user = userEvent.setup()
    vi.mocked(client.apiClient.post).mockResolvedValueOnce({
      data: {
        token: 'fake.jwt.here',
        username: 'test',
        email: 't@t.com',
        role: 'end_user',
        userId: 1,
      },
    })
    renderWithAuth()
    await user.click(screen.getByRole('button', { name: /Login/i }))
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('test'))
    await user.click(screen.getByRole('button', { name: /Logout/i }))
    expect(localStorage.getItem('token')).toBeNull()
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })

  it('hydrates user from stored valid token on mount', async () => {
    const payload = btoa(
      JSON.stringify({
        sub: '42',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'persisted',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'persisted@example.com',
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'end_user',
        exp: Math.floor(Date.now() / 1000) + 60,
      })
    )
    const token = `header.${payload}.sig`
    localStorage.setItem('token', token)

    renderWithAuth()

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('persisted')
    })
  })

  it('expired token clears state on mount', async () => {
    const expiredPayload = btoa(JSON.stringify({ sub: '1', exp: 0 }))
    const token = `header.${expiredPayload}.sig`
    localStorage.setItem('token', token)
    renderWithAuth()
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('none')
    })
    expect(localStorage.getItem('token')).toBeNull()
  })
})
