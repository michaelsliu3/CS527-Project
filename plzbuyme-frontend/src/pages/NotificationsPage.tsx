import { useEffect, useState } from 'react'
import { Box, Container, Flex, Icon, Spinner, Text } from '@chakra-ui/react'
import { showErrorToast } from '../components/ui/toaster'
import { Link as RouterLink } from 'react-router-dom'
import {
  HiOutlineBell,
  HiOutlineExclamation,
  HiOutlineTag,
  HiOutlineLightningBolt,
} from 'react-icons/hi'
import { HiOutlineTrophy } from 'react-icons/hi2'
import { listNotifications, markNotificationRead, type NotificationItem } from '../api/notifications'
import { dark } from '../theme/colors'

const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
  outbid: HiOutlineExclamation,
  auto_limit_reached: HiOutlineLightningBolt,
  auction_won: HiOutlineTrophy,
  alert_match: HiOutlineTag,
  reserve_not_met: HiOutlineExclamation,
}

function NotificationIcon({ type }: { type: string }) {
  const IconComponent = NOTIFICATION_ICONS[type] ?? HiOutlineBell
  return <Icon as={IconComponent} boxSize={5} color="brand.400" />
}

function formatTime(createdAt: string) {
  const d = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
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

  const handleMarkRead = async (n: NotificationItem) => {
    if (n.isRead) return
    try {
      await markNotificationRead(n.id)
      setItems((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
      )
    } catch {
      showErrorToast('Error', 'Failed to mark as read.')
    }
  }

  return (
    <Container maxW="container.md">
      <Text fontSize="2xl" fontWeight="bold" color="white" mb={6}>
        Notifications
      </Text>

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
              as="button"
              textAlign="left"
              p={4}
              bg={dark.cardBg}
              borderRadius="md"
              borderWidth="1px"
              borderColor={dark.borderSubtle}
              _hover={{ bg: dark.inputBg }}
              onClick={() => handleMarkRead(n)}
              fontWeight={n.isRead ? 'normal' : 'semibold'}
              data-testid={n.isRead ? 'notification-read' : 'notification-unread'}
            >
              <Flex gap={3} align="flex-start">
                <Box mt={0.5}>
                  <NotificationIcon type={n.type} />
                </Box>
                <Box flex={1} minW={0}>
                  <Text color="white" lineClamp={2}>
                    {n.message}
                  </Text>
                  <Flex align="center" gap={2} mt={2}>
                    <Text fontSize="sm" color={dark.placeholder}>
                      {formatTime(n.createdAt)}
                    </Text>
                    {n.itemId != null && (
                      <RouterLink to={`/auctions/${n.itemId}`} style={{ fontSize: '0.875rem', color: '#38b2ac' }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        View auction →
                      </RouterLink>
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
