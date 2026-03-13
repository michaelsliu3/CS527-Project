import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Card,
  Container,
  Dialog,
  Field,
  Input,
  Spinner,
  useDisclosure,
} from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../api/client'

interface Profile {
  id: number
  username: string
  email: string
  role: string
}

export function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const deleteDialog = useDisclosure()

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<Profile>('auth/profile')
      .then(({ data }) => {
        if (!cancelled) setProfile(data)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      await apiClient.delete('auth/profile')
      logout()
      navigate('/', { replace: true })
    } catch {
      // Keep dialog open on error; user can retry or cancel
    } finally {
      setDeleting(false)
      deleteDialog.onClose()
    }
  }

  if (loading) {
    return (
      <Container maxW="md">
        <Box display="flex" justifyContent="center" py={8}>
          <Spinner size="lg" />
        </Box>
      </Container>
    )
  }

  if (loadError || (!profile && !user)) {
    if (loadError) {
      return (
        <Container maxW="md">
          <Card.Root p={6}>
            <Card.Body>Failed to load profile.</Card.Body>
          </Card.Root>
        </Container>
      )
    }
    return null
  }

  const displayProfile = profile ?? (user ? { id: user.id, username: user.username, email: user.email, role: user.role } : null)
  if (!displayProfile) return null

  return (
    <Container maxW="md">
      <Card.Root p={6}>
        <Card.Header>
          <Card.Title>Profile</Card.Title>
        </Card.Header>
        <Card.Body>
          <Box as="form" display="flex" flexDirection="column" gap={4}>
            <Field.Root>
              <Field.Label>Username</Field.Label>
              <Input value={displayProfile.username} readOnly disabled />
            </Field.Root>
            <Field.Root>
              <Field.Label>Email</Field.Label>
              <Input type="email" value={displayProfile.email} readOnly disabled />
            </Field.Root>
            <Box pt={2}>
              <Button
                type="button"
                colorPalette="red"
                variant="outline"
                onClick={deleteDialog.onOpen}
              >
                Delete account
              </Button>
            </Box>
          </Box>
        </Card.Body>
      </Card.Root>

      <Dialog.Root open={deleteDialog.open} onOpenChange={({ open: isOpen }) => { if (!isOpen) deleteDialog.onClose() }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>Delete account?</Dialog.Header>
            <Dialog.Body>
              This will soft-delete your account. You will be logged out and cannot sign in again with this account.
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={deleteDialog.onClose}>
                Cancel
              </Button>
              <Button colorPalette="red" onClick={handleDeleteAccount} loading={deleting as boolean}>
                Delete account
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Container>
  )
}
