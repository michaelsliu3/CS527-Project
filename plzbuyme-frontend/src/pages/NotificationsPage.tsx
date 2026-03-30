import { useEffect, useState } from 'react'
import { Box, Button, Container, Flex, Icon, Spinner, Text } from '@chakra-ui/react'
import { showErrorToast } from '../components/ui/toaster'
import { useNavigate } from 'react-router-dom'
import {
  HiOutlineBell,
  HiOutlineCheckCircle,
  HiOutlineExclamation,
  HiOutlineTag,
  HiOutlineLightningBolt,
} from 'react-icons/hi'
import { HiOutlineTrophy } from 'react-icons/hi2'
import { listNotifications, markNotificationRead, markAllNotificationsRead, type NotificationItem } from '../api/notifications'
import { dark } from '../theme/colors'
import { APP_PAGE_PX } from '../theme/layout'
import { splitNotificationMessage } from '../utils/notificationMessage'

const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
  outbid: HiOutlineExclamation,
  auto_limit_reached: HiOutlineLightningBolt,
  auto_bid_placed: HiOutlineLightningBolt,
  auction_won: HiOutlineTrophy,
  auction_lost: HiOutlineExclamation,
  auction_sold: HiOutlineCheckCircle,
  alert_match: HiOutlineTag,
  reserve_not_met: HiOutlineExclamation,
}

function NotificationIcon({ type }: { type: string }) {
  const IconComponent = NOTIFICATION_ICONS[type] ?? HiOutlineBell
  return <Icon as={IconComponent} boxSize={5} color="brand.400" />
}

function formatTime(createdAt: string) {
  const iso = createdAt.endsWith('Z') || /[-+]\d{2}:?\d{2}$/.test(createdAt)
    ? createdAt
    : createdAt + 'Z'
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 0) return d.toLocaleDateString()
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [markAllLoading, setMarkAllLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = () => {
    setLoading(true)
    setError(null)
    listNotifications()
      .then((res) => setItems(res.data.items))
      .catch(() => {
        setError('Failed to load notifications.')
        showErrorToast('Error', 'Failed to load notifications.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  const handleViewAuction = async (n: NotificationItem) => {
    if (n.isRead) {
      navigate(`/auctions/${n.itemId!}`)
      return
    }
    try {
      await markNotificationRead(n.id)
      setItems((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
      )
      window.dispatchEvent(new CustomEvent('notifications-updated'))
      navigate(`/auctions/${n.itemId!}`)
    } catch {
      showErrorToast('Error', 'Failed to mark as read.')
    }
  }

  const handleMarkAllRead = async () => {
    const unread = items.filter((i) => !i.isRead)
    if (unread.length === 0) return
    setMarkAllLoading(true)
    try {
      await markAllNotificationsRead()
      setItems((prev) => prev.map((i) => ({ ...i, isRead: true })))
      window.dispatchEvent(new CustomEvent('notifications-updated'))
    } catch {
      showErrorToast('Error', 'Failed to mark all as read.')
    } finally {
      setMarkAllLoading(false)
    }
  }

  const hasUnread = items.some((i) => !i.isRead)

  return (
    <Container maxW="container.md" px={APP_PAGE_PX}>
      <Flex justify="space-between" align="center" mb={6}>
        <Text fontSize="2xl" fontWeight="bold" color="white">
          Notifications
        </Text>
        {hasUnread && (
          <Button
            size="sm"
            colorScheme="brand"
            onClick={handleMarkAllRead}
            loading={markAllLoading}
            data-testid="mark-all-read"
          >
            Mark all as read
          </Button>
        )}
      </Flex>

      {error && (
        <Text color="red.400" mb={4}>
          {error}
        </Text>
      )}

      {loading ? (
        <Flex justify="center" py={12}>
          <Spinner size="xl" color="brand.400" />
        </Flex>
      ) : items.length === 0 ? (
        <Text color={dark.muted} py={8} textAlign="center">
          No notifications yet.
        </Text>
      ) : (
        <Flex direction="column" gap={2}>
          {items.map((n) => (
            <Box
              key={n.id}
              textAlign="left"
              p={4}
              bg={dark.cardBg}
              borderRadius="md"
              borderWidth="1px"
              borderColor={dark.borderSubtle}
              fontWeight={n.isRead ? 'normal' : 'semibold'}
              opacity={n.isRead ? 0.65 : 1}
              transition="opacity 0.2s"
              data-testid={n.isRead ? 'notification-read' : 'notification-unread'}
            >
              <Flex gap={3} align="flex-start">
                <Box mt={0.5}>
                  <NotificationIcon type={n.type} />
                </Box>
                <Box flex={1} minW={0}>
                  {(() => {
                    const { primary, disclaimer } = splitNotificationMessage(n.message)
                    return (
                      <>
                        <Text color="white">{primary}</Text>
                        {disclaimer != null && disclaimer.length > 0 && (
                          <Text fontSize="sm" color={dark.placeholder} mt={1.5} lineHeight="short">
                            {disclaimer}
                          </Text>
                        )}
                      </>
                    )
                  })()}
                  <Flex align="center" gap={2} mt={2}>
                    <Text fontSize="sm" color={dark.placeholder}>
                      {formatTime(n.createdAt)}
                    </Text>
                    {n.itemId != null && (
                      <Box
                        as="button"
                        fontSize="sm"
                        color="brand.400"
                        _hover={{ textDecoration: 'underline' }}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation()
                          handleViewAuction(n)
                        }}
                      >
                        View auction →
                      </Box>
                    )}
                  </Flex>
                </Box>
              </Flex>
            </Box>
          ))}
        </Flex>
      )}
    </Container>
  )
}
