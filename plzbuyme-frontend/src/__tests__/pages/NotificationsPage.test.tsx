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

  it('mark-read removes notification from list', async () => {
    const user = userEvent.setup()
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue({
      data: {
        items: [
          {
            id: 1,
            userId: 1,
            itemId: null,
            message: 'Unread notification',
            type: 'alert_match',
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
      expect(screen.getByText('Unread notification')).toBeInTheDocument()
    })
    const notificationButton = screen.getByText('Unread notification').closest('button')
    expect(notificationButton).toBeInTheDocument()
    await user.click(notificationButton!)
    await waitFor(() => {
      expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith(1)
      expect(screen.queryByText('Unread notification')).not.toBeInTheDocument()
    })
  })

  it('mark all as read button clears list', async () => {
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
      expect(screen.queryByText('First')).not.toBeInTheDocument()
    })
  })
})
