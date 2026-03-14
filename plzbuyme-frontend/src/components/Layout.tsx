import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Menu,
  Spinner,
} from '@chakra-ui/react'
import { Outlet, Link as RouterLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { HiOutlineBell, HiOutlineUserCircle } from 'react-icons/hi'
import { dark } from '../theme/colors'

const linkColor = dark.muted
const linkHover = '#ffffff'

export function Layout() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()

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
        <Container maxW="container.xl">
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
                  {user.role === 'end_user' && (
                    <>
                      <RouterLink to="/auctions/create" style={{ fontWeight: 500, color: linkColor }}>
                        Sell
                      </RouterLink>
                      <RouterLink to="/my-auctions" style={{ fontWeight: 500, color: linkColor }}>
                        My Auctions
                      </RouterLink>
                      <RouterLink to="/alerts" style={{ fontWeight: 500, color: linkColor }}>
                        Alerts
                      </RouterLink>
                    </>
                  )}
                  <RouterLink to="/notifications" aria-label="Notifications" style={{ padding: 8, display: 'inline-flex', color: linkColor }}>
                    <HiOutlineBell size={20} />
                  </RouterLink>
                  <Menu.Root>
                    <Menu.Trigger>
                      <Button variant="ghost" size="sm" color={linkColor} _hover={{ color: linkHover, bg: 'whiteAlpha.100' }}>
                        <HiOutlineUserCircle size={18} style={{ marginRight: 6 }} />
                        {user.username}
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
