import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter } from 'react-router-dom'
import { ProfilePage } from '../../pages/ProfilePage'
import { system } from '../../theme'
import { apiClient } from '../../api/client'
import { useAuth } from '../../context/AuthContext'

vi.mock('../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../../components/ui/toaster', () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)

function renderProfile() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </ChakraProvider>
  )
}

describe('ProfilePage display name color', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedUseAuth.mockReturnValue({
      user: { id: 1, username: 'alice', avatarUrl: null, displayNameColor: null, email: 'alice@example.com', role: 'vip' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateDisplayNameColor: vi.fn(),
      updateAvatarUrl: vi.fn(),
    })
  })

  it('shows color controls for VIP users', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { id: 1, username: 'alice', avatarUrl: null, displayNameColor: null, email: 'alice@example.com', role: 'vip' },
    } as never)
    renderProfile()
    expect(await screen.findByText('Display name color')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Solid Blue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gradient Rainbow' })).toBeInTheDocument()
  })

  it('hides color controls for end users', async () => {
    mockedUseAuth.mockReturnValue({
      user: { id: 2, username: 'bob', avatarUrl: null, displayNameColor: null, email: 'bob@example.com', role: 'end_user' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateDisplayNameColor: vi.fn(),
      updateAvatarUrl: vi.fn(),
    })
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { id: 2, username: 'bob', avatarUrl: null, displayNameColor: null, email: 'bob@example.com', role: 'end_user' },
    } as never)
    renderProfile()
    await screen.findByText('Profile')
    expect(screen.queryByText('Display name color')).not.toBeInTheDocument()
  })

  it('submits selected hardcoded solid color and updates auth color', async () => {
    const updateDisplayNameColor = vi.fn()
    mockedUseAuth.mockReturnValue({
      user: { id: 1, username: 'alice', avatarUrl: null, displayNameColor: null, email: 'alice@example.com', role: 'vip' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateDisplayNameColor,
      updateAvatarUrl: vi.fn(),
    })
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { id: 1, username: 'alice', avatarUrl: null, displayNameColor: null, email: 'alice@example.com', role: 'vip' },
    } as never)
    vi.mocked(apiClient.patch).mockResolvedValueOnce({
      data: { displayNameColor: '#A78BFA' },
    } as never)

    const user = userEvent.setup()
    renderProfile()

    await screen.findByText('Display name color')
    await user.click(screen.getByRole('button', { name: 'Solid Violet' }))
    await user.click(screen.getByRole('button', { name: 'Save color' }))

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith('auth/profile/display-name-color', {
        displayNameColor: '#A78BFA',
      })
    })
    expect(updateDisplayNameColor).toHaveBeenCalledWith('#A78BFA')
  })

  it('does not render manual color picker inputs', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { id: 1, username: 'alice', avatarUrl: null, displayNameColor: null, email: 'alice@example.com', role: 'vip' },
    } as never)

    renderProfile()
    await screen.findByText('Display name color')
    expect(screen.queryByLabelText('Pick display name color')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('#A1B2C3 or RAINBOW')).not.toBeInTheDocument()
  })

  it('submits animated preset payload', async () => {
    const updateDisplayNameColor = vi.fn()
    mockedUseAuth.mockReturnValue({
      user: { id: 1, username: 'alice', avatarUrl: null, displayNameColor: null, email: 'alice@example.com', role: 'vip' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateDisplayNameColor,
      updateAvatarUrl: vi.fn(),
    })
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { id: 1, username: 'alice', avatarUrl: null, displayNameColor: null, email: 'alice@example.com', role: 'vip' },
    } as never)
    vi.mocked(apiClient.patch).mockResolvedValueOnce({
      data: { displayNameColor: 'RAINBOW' },
    } as never)

    const user = userEvent.setup()
    renderProfile()

    await user.click(await screen.findByRole('button', { name: 'Gradient Rainbow' }))
    await user.click(screen.getByRole('button', { name: 'Save color' }))

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith('auth/profile/display-name-color', {
        displayNameColor: 'RAINBOW',
      })
    })
    expect(updateDisplayNameColor).toHaveBeenCalledWith('RAINBOW')
  })

  it('uploads profile picture and updates auth avatar state', async () => {
    const updateAvatarUrl = vi.fn()
    mockedUseAuth.mockReturnValue({
      user: { id: 1, username: 'alice', avatarUrl: null, displayNameColor: null, email: 'alice@example.com', role: 'vip' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateDisplayNameColor: vi.fn(),
      updateAvatarUrl,
    })
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { id: 1, username: 'alice', avatarUrl: null, displayNameColor: null, email: 'alice@example.com', role: 'vip' },
    } as never)
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { key: 'avatars/user-1-new.png', url: 'http://localhost:5090/media/avatars/user-1-new.png' },
    } as never)
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { avatarUrl: 'avatars/user-1-new.png' },
    } as never)

    const user = userEvent.setup()
    renderProfile()

    const uploadInput = await screen.findByTestId('avatar-upload-input')
    const file = new File(['img'], 'avatar.png', { type: 'image/png' })
    await user.upload(uploadInput, file)

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('auth/profile/avatar', {
        avatarKey: 'avatars/user-1-new.png',
      })
    })
    expect(updateAvatarUrl).toHaveBeenCalledWith('avatars/user-1-new.png')
  })

  it('removes profile picture and falls back to initials', async () => {
    const updateAvatarUrl = vi.fn()
    mockedUseAuth.mockReturnValue({
      user: {
        id: 1,
        username: 'alice',
        avatarUrl: 'avatars/user-1.png',
        displayNameColor: null,
        email: 'alice@example.com',
        role: 'vip',
      },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateDisplayNameColor: vi.fn(),
      updateAvatarUrl,
    })
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        id: 1,
        username: 'alice',
        avatarUrl: 'avatars/user-1.png',
        displayNameColor: null,
        email: 'alice@example.com',
        role: 'vip',
      },
    } as never)
    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      data: { avatarUrl: null },
    } as never)

    const user = userEvent.setup()
    renderProfile()

    const removeButton = await screen.findByRole('button', { name: 'Remove picture' })
    await user.click(removeButton)

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith('auth/profile/avatar')
    })
    expect(updateAvatarUrl).toHaveBeenCalledWith(null)
  })
})
