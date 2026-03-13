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

export function Layout() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (loading) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <Spinner size="xl" />
      </Flex>
    )
  }

  return (
    <Box minH="100vh">
      <Box as="nav" borderBottomWidth="1px" py={3} bg="white" _dark={{ bg: 'gray.800' }}>
        <Container maxW="container.xl">
          <Flex align="center" justify="space-between" gap={4}>
            <RouterLink to="/">
              <Heading size="md" color="brand.500">
                plzbuy.me
              </Heading>
            </RouterLink>
            <Flex align="center" gap={2}>
              <RouterLink to="/auctions" style={{ fontWeight: 500 }}>
                Auctions
              </RouterLink>
              {user ? (
                <>
                  {user.role === 'end_user' && (
                    <>
                      <RouterLink to="/my-auctions" style={{ fontWeight: 500 }}>
                        My Auctions
                      </RouterLink>
                      <RouterLink to="/alerts" style={{ fontWeight: 500 }}>
                        Alerts
                      </RouterLink>
                    </>
                  )}
                  <RouterLink to="/notifications" aria-label="Notifications" style={{ padding: 8, display: 'inline-flex' }}>
                    <HiOutlineBell size={20} />
                  </RouterLink>
                  <Menu.Root>
                    <Menu.Trigger>
                      <Button variant="ghost" size="sm">
                        <HiOutlineUserCircle size={18} style={{ marginRight: 6 }} />
                        {user.username}
                      </Button>
                    </Menu.Trigger>
                    <Menu.Positioner>
                      <Menu.Content>
                        <Menu.Item value="profile" onClick={() => navigate('/profile')}>
                          Profile
                        </Menu.Item>
                        {(user.role === 'customer_rep' || user.role === 'admin') && (
                          <Menu.Item value="rep" onClick={() => navigate('/rep')}>
                            Rep Dashboard
                          </Menu.Item>
                        )}
                        {user.role === 'admin' && (
                          <Menu.Item value="admin" onClick={() => navigate('/admin')}>
                            Admin
                          </Menu.Item>
                        )}
                        <Menu.Item value="logout" onClick={handleLogout}>
                          Logout
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Positioner>
                  </Menu.Root>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
                    Login
                  </Button>
                  <Button colorPalette="brand" size="sm" onClick={() => navigate('/register')}>
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
