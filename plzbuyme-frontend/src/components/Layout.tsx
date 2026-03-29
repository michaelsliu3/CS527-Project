import { Box, Badge, Button, Container, Flex, Heading, Menu, Spinner } from '@chakra-ui/react'
import { Outlet, Link as RouterLink, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listNotifications, markNotificationRead } from '../api/notifications'
import { apiClient } from '../api/client'
import { showErrorToast, showNotificationToast } from './ui/toaster'
import { splitNotificationMessage } from '../utils/notificationMessage'
import { HiOutlineBell } from 'react-icons/hi'
import { dark } from '../theme/colors'
import { APP_PAGE_PX } from '../theme/layout'
import { DisplayNameText } from './DisplayNameText'
import { NavWallet } from './NavWallet'
import { UserAvatar } from './UserAvatar'

/** How often to poll for new notifications while the user is logged in (used for badge + real-time toasts). */
const NOTIFICATION_POLL_INTERVAL_MS = 5_000

const linkColor = dark.muted
const linkHover = '#ffffff'
const canUseEndUserFeatures = (role: string) =>
  role === 'end_user' || role === 'vip' || role === 'customer_rep' || role === 'admin'

export function Layout() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [navAvatarUrl, setNavAvatarUrl] = useState<string | null>(null)
  const lastKnownUnreadIdsRef = useRef<Set<number>>(new Set())
  const hasInitialFetchRef = useRef(false)

  const fetchUnreadCount = () => {
    if (!user) return
    listNotifications()
      .then((res) => {
        setUnreadCount(res.data.unreadCount)
        const unreadItems = res.data.items.filter((n) => !n.isRead)
        const unreadIds = new Set(unreadItems.map((n) => n.id))
        if (!hasInitialFetchRef.current) {
          hasInitialFetchRef.current = true
          lastKnownUnreadIdsRef.current = unreadIds
        } else {
          const known = lastKnownUnreadIdsRef.current
          for (const n of unreadItems) {
            if (!known.has(n.id)) {
              const path =
                n.itemId != null ? `/auctions/${n.itemId}` : '/notifications'
              const notificationId = n.id
              showNotificationToast('Notification', splitNotificationMessage(n.message).primary, {
                onClick: () => {
                  markNotificationRead(notificationId)
                    .then(() => window.dispatchEvent(new CustomEvent('notifications-updated')))
                    .catch(() => showErrorToast('Error', 'Failed to mark as read.'))
                  navigate(path)
                },
              })
            }
          }
          lastKnownUnreadIdsRef.current = unreadIds
        }
      })
      .catch(() => setUnreadCount(0))
  }

  useEffect(() => {
    if (!user) {
      setUnreadCount(0)
      setNavAvatarUrl(null)
      hasInitialFetchRef.current = false
      lastKnownUnreadIdsRef.current = new Set()
      return
    }
    apiClient
      .get<{ avatarUrl?: string | null }>('auth/profile')
      .then(({ data }) => setNavAvatarUrl(data.avatarUrl ?? null))
      .catch(() => setNavAvatarUrl(user.avatarUrl ?? null))
    fetchUnreadCount()
  }, [user])

  useEffect(() => {
    if (!user) return
    const onUpdated = () => fetchUnreadCount()
    window.addEventListener('notifications-updated', onUpdated)
    return () => window.removeEventListener('notifications-updated', onUpdated)
  }, [user])

  useEffect(() => {
    if (!user) return
    const interval = setInterval(fetchUnreadCount, NOTIFICATION_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [user])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (loading) {
    return (
      <Flex minH="100vh" align="center" justify="center" bg={dark.bg}>
        <Spinner size="xl" color="brand.400" />
      </Flex>
    )
  }

  return (
    <Box minH="100vh" bg={dark.bg} color="white">
      <Box as="nav" borderBottomWidth="1px" borderColor={dark.borderSubtle} py={3} bg={dark.navBg}>
        <Container maxW="container.xl" px={APP_PAGE_PX}>
          <Flex align="center" justify="space-between" gap={4}>
            <RouterLink to="/">
              <Heading size="md" color="brand.400">
                plzbuy.me
              </Heading>
            </RouterLink>
            <Flex align="center" gap={4}>
              <RouterLink to="/auctions" style={{ fontWeight: 500, color: linkColor }}>
                Auctions
              </RouterLink>
              {user ? (
                <>
                  {canUseEndUserFeatures(user.role) && (
                    <>
                      <RouterLink to="/my-auctions" style={{ fontWeight: 500, color: linkColor }}>
                        My Auctions
                      </RouterLink>
                      <RouterLink to="/alerts" style={{ fontWeight: 500, color: linkColor }}>
                        Alerts
                      </RouterLink>
                    </>
                  )}
                  <RouterLink to="/questions" style={{ fontWeight: 500, color: linkColor }}>
                    Forums
                  </RouterLink>
                  <NavWallet />
                  <RouterLink to="/notifications" aria-label="Notifications" style={{ padding: 8, display: 'inline-flex', alignItems: 'center', color: linkColor, position: 'relative' }}>
                    <HiOutlineBell size={20} />
                    {unreadCount > 0 && (
                      <Badge colorScheme="red" variant="solid" position="absolute" top={4} right={4} minW={5} h={5} borderRadius="full" fontSize="xs" display="flex" alignItems="center" justifyContent="center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Badge>
                    )}
                  </RouterLink>
                  <Menu.Root>
                    <Menu.Trigger asChild>
                      <Button variant="ghost" size="sm" color={linkColor} _hover={{ color: linkHover, bg: 'whiteAlpha.100' }}>
                        <Box mr={2}>
                          <UserAvatar name={user.username} avatarUrl={navAvatarUrl ?? user.avatarUrl} size="24px" />
                        </Box>
                        <DisplayNameText
                          name={user.username}
                          displayNameColor={user.displayNameColor}
                          fallbackColor={linkColor}
                          fontWeight="bold"
                        />
                      </Button>
                    </Menu.Trigger>
                    <Menu.Positioner>
                      <Menu.Content bg={dark.cardBg} borderColor={dark.borderSubtle}>
                        <Menu.Item value="profile" onClick={() => navigate('/profile')} color={linkColor} _hover={{ bg: 'whiteAlpha.100', color: linkHover }}>
                          Profile
                        </Menu.Item>
                        {(user.role === 'customer_rep' || user.role === 'admin') && (
                          <Menu.Item value="rep" onClick={() => navigate('/rep')} color={linkColor} _hover={{ bg: 'whiteAlpha.100', color: linkHover }}>
                            Rep Dashboard
                          </Menu.Item>
                        )}
                        {user.role === 'admin' && (
                          <Menu.Item value="admin" onClick={() => navigate('/admin')} color={linkColor} _hover={{ bg: 'whiteAlpha.100', color: linkHover }}>
                            Admin
                          </Menu.Item>
                        )}
                        <Menu.Item value="logout" onClick={handleLogout} color={linkColor} _hover={{ bg: 'whiteAlpha.100', color: linkHover }}>
                          Logout
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Positioner>
                  </Menu.Root>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" color={linkColor} borderColor={dark.borderSubtle} _hover={{ bg: 'whiteAlpha.100', color: linkHover }} onClick={() => navigate('/login')}>
                    Login
                  </Button>
                  <Button bg="brand.500" color="white" _hover={{ bg: 'brand.400' }} size="sm" onClick={() => navigate('/register')}>
                    Register
                  </Button>
                </>
              )}
            </Flex>
          </Flex>
        </Container>
      </Box>
      <Box as="main" py={6}>
        <Outlet />
      </Box>
    </Box>
  )
}
