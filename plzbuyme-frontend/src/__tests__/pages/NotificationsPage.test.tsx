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

  it('renders with unread styling', async () => {
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
          {
            id: 2,
            userId: 1,
            itemId: null,
            message: 'Your alert matched a new listing.',
            type: 'alert_match',
            isRead: true,
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
      expect(screen.getByText(/Your alert matched/)).toBeInTheDocument()
    })
    const unreadRow = screen.getByTestId('notification-unread')
    expect(unreadRow).toBeInTheDocument()
    expect(screen.getByText(/You were outbid/)).toBeInTheDocument()
    expect(screen.getByTestId('notification-read')).toBeInTheDocument()
  })

  it('mark-read updates state', async () => {
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
    })
  })
})
