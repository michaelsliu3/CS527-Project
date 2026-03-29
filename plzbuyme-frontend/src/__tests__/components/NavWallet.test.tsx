import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter } from 'react-router-dom'
import { NavWallet } from '../../components/NavWallet'
import { useAuth } from '../../context/AuthContext'
import { system } from '../../theme'

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)

describe('NavWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows spendable balance and opens wallet control for end users', () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: 1,
        username: 'alice',
        avatarUrl: null,
        displayNameColor: null,
        email: 'a@a.com',
        role: 'end_user',
        walletBalance: 1000,
        walletAvailableBalance: 250.5,
      },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateDisplayNameColor: vi.fn(),
      updateAvatarUrl: vi.fn(),
      refreshProfile: vi.fn().mockResolvedValue(null),
    })

    render(
      <ChakraProvider value={system}>
        <MemoryRouter>
          <NavWallet />
        </MemoryRouter>
      </ChakraProvider>
    )

    expect(screen.getByRole('button', { name: /Balance \$250\.50, deposit or withdraw/i })).toBeInTheDocument()
    expect(screen.getByText(/\$250\.50/)).toBeInTheDocument()
  })

  it('renders nothing for guests', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateDisplayNameColor: vi.fn(),
      updateAvatarUrl: vi.fn(),
      refreshProfile: vi.fn(),
    })

    render(
      <ChakraProvider value={system}>
        <MemoryRouter>
          <NavWallet />
        </MemoryRouter>
      </ChakraProvider>
    )

    expect(screen.queryByRole('button', { name: /Balance.*deposit or withdraw/i })).not.toBeInTheDocument()
  })
})
