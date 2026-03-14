import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { NotificationsPage } from '../../pages/NotificationsPage'
import { AuthProvider } from '../../context/AuthContext'
import { system } from '../../theme'
import * as notificationsApi from '../../api/notifications'

vi.mock('../../api/notifications', () => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const orig = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...orig,
    useNavigate: () => mockNavigate,
  }
})

function renderNotificationsPage() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={['/notifications']}>
        <AuthProvider>
          <Routes>
            <Route path="/notifications" element={<NotificationsPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </ChakraProvider>
  )
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders only unread notifications', async () => {
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue({
      data: {
        items: [
          {
            id: 1,
            userId: 1,
            itemId: 10,
            message: 'You were outbid on "Test Item"',
            type: 'outbid',
            isRead: false,
            createdAt: new Date().toISOString(),
          },
        ],
        unreadCount: 1,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
    renderNotificationsPage()
    await waitFor(() => {
      expect(screen.getByText(/You were outbid/)).toBeInTheDocument()
    })
    expect(screen.getByTestId('notification-unread')).toBeInTheDocument()
    expect(screen.queryByTestId('notification-read')).not.toBeInTheDocument()
  })

  it('View auction marks as read and dims notification', async () => {
    const user = userEvent.setup()
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue({
      data: {
        items: [
          {
            id: 1,
            userId: 1,
            itemId: 42,
            message: 'You were outbid',
            type: 'outbid',
            isRead: false,
            createdAt: new Date().toISOString(),
          },
        ],
        unreadCount: 1,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
    vi.mocked(notificationsApi.markNotificationRead).mockResolvedValue({
      data: undefined,
      status: 204,
      statusText: 'No Content',
      headers: {},
      config: {},
    } as never)
    renderNotificationsPage()
    await waitFor(() => {
      expect(screen.getByText('You were outbid')).toBeInTheDocument()
    })
    await user.click(screen.getByText('View auction →'))
    await waitFor(() => {
      expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith(1)
      expect(screen.getByText('You were outbid')).toBeInTheDocument()
      expect(screen.getByTestId('notification-read')).toBeInTheDocument()
    })
  })

  it('mark all as read dims all notifications', async () => {
    const user = userEvent.setup()
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue({
      data: {
        items: [
          {
            id: 1,
            userId: 1,
            itemId: null,
            message: 'First',
            type: 'outbid',
            isRead: false,
            createdAt: new Date().toISOString(),
          },
        ],
        unreadCount: 1,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
    vi.mocked(notificationsApi.markAllNotificationsRead).mockResolvedValue({
      data: undefined,
      status: 204,
      statusText: 'No Content',
      headers: {},
      config: {},
    } as never)
    renderNotificationsPage()
    await waitFor(() => {
      expect(screen.getByText('First')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('mark-all-read'))
    await waitFor(() => {
      expect(notificationsApi.markAllNotificationsRead).toHaveBeenCalled()
      expect(screen.getByText('First')).toBeInTheDocument()
      expect(screen.getByTestId('notification-read')).toBeInTheDocument()
    })
  })
})
