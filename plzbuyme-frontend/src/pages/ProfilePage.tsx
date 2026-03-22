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
import { showErrorToast, showSuccessToast } from '../components/ui/toaster'
import { dark } from '../theme/colors'
import { APP_PAGE_PX } from '../theme/layout'
import {
  normalizeDisplayNameColor,
} from '../utils/displayNameColor'
import { DisplayNameText } from '../components/DisplayNameText'

interface Profile {
  id: number
  username: string
  displayNameColor: string | null
  email: string
  role: string
}

const SOLID_COLOR_OPTIONS = [
  { label: 'Blue', value: '#60A5FA' },
  { label: 'Mint', value: '#34D399' },
  { label: 'Coral', value: '#FB7185' },
  { label: 'Gold', value: '#F59E0B' },
  { label: 'Violet', value: '#A78BFA' },
  { label: 'Rose', value: '#F472B6' },
] as const

const GRADIENT_PRESET_OPTIONS = [
  { label: 'Rainbow', value: 'RAINBOW' },
  { label: 'Purple-Blue Fade', value: 'PURPBLU' },
  { label: 'RGB Flow', value: 'RGBFLOW' },
  { label: 'Sun Glow', value: 'SUNGLOW' },
  { label: 'Aurora X', value: 'AURORAX' },
  { label: 'Fire Ice', value: 'FIREICE' },
] as const

function gradientSwatch(preset: string): string {
  switch (preset) {
    case 'RAINBOW':
      return 'linear-gradient(90deg, #ff3b30, #ff9500, #ffcc00, #34c759, #00c7ff, #5e5ce6, #af52de, #ff3b30)'
    case 'PURPBLU':
      return 'linear-gradient(120deg, #7c3aed, #6366f1, #3b82f6, #22d3ee, #7c3aed)'
    case 'RGBFLOW':
      return 'linear-gradient(90deg, #ff3b30, #22c55e, #3b82f6, #ff3b30)'
    case 'SUNGLOW':
      return 'linear-gradient(120deg, #ff4fa3, #ff79c6, #ff9ed8, #ffd0ef, #ff4fa3)'
    case 'AURORAX':
      return 'linear-gradient(125deg, #ff2d95, #e879f9, #c084fc, #f472b6, #ff2d95)'
    case 'FIREICE':
      return 'linear-gradient(95deg, #ff3d00 0%, #ff8f00 35%, #fff8e1 50%, #7dd3fc 65%, #0ea5e9 100%)'
    default:
      return 'transparent'
  }
}

export function ProfilePage() {
  const { user, logout, updateDisplayNameColor } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [colorInput, setColorInput] = useState('')
  const [savingColor, setSavingColor] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const deleteDialog = useDisclosure()

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<Profile>('auth/profile')
      .then(({ data }) => {
        if (!cancelled) {
          setProfile(data)
          setColorInput(data.displayNameColor ?? '')
        }
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
      <Container maxW="md" px={APP_PAGE_PX}>
        <Box display="flex" justifyContent="center" py={8}>
          <Spinner size="lg" />
        </Box>
      </Container>
    )
  }

  if (loadError || (!profile && !user)) {
    if (loadError) {
      return (
        <Container maxW="md" px={APP_PAGE_PX}>
          <Card.Root p={6} bg={dark.cardBg} borderColor={dark.borderSubtle} borderWidth="1px">
            <Card.Body color={dark.muted}>Failed to load profile.</Card.Body>
          </Card.Root>
        </Container>
      )
    }
    return null
  }

  const displayProfile =
    profile ??
    (user
      ? {
          id: user.id,
          username: user.username,
          displayNameColor: user.displayNameColor ?? null,
          email: user.email,
          role: user.role,
        }
      : null)
  if (!displayProfile) return null

  const canCustomizeColor =
    displayProfile.role === 'vip' ||
    displayProfile.role === 'customer_rep' ||
    displayProfile.role === 'admin'
  const normalizedColor = normalizeDisplayNameColor(colorInput)
  const originalColor = displayProfile.displayNameColor ?? ''
  const colorChanged = (normalizedColor ?? '') !== (normalizeDisplayNameColor(originalColor) ?? '')

  const handleSaveColor = async () => {
    if (!canCustomizeColor || !colorChanged) return
    setSavingColor(true)
    try {
      const payloadColor = normalizedColor ?? null
      const { data } = await apiClient.patch<{ displayNameColor: string | null }>(
        'auth/profile/display-name-color',
        { displayNameColor: payloadColor }
      )
      const nextColor = data.displayNameColor ?? null
      setProfile((prev) => (prev ? { ...prev, displayNameColor: nextColor } : prev))
      setColorInput(nextColor ?? '')
      updateDisplayNameColor(nextColor)
      showSuccessToast('Name color updated')
    } catch {
      showErrorToast('Error', 'Failed to update display name color.')
    } finally {
      setSavingColor(false)
    }
  }

  const handleResetColor = () => {
    setColorInput('')
  }

  return (
    <Container maxW="md" px={APP_PAGE_PX}>
      <Card.Root p={6} bg={dark.cardBg} borderColor={dark.borderSubtle} borderWidth="1px">
        <Card.Header>
          <Card.Title color="white">Profile</Card.Title>
        </Card.Header>
        <Card.Body>
          <Box as="form" display="flex" flexDirection="column" gap={4}>
            <Field.Root>
              <Field.Label color={dark.label}>Username</Field.Label>
              <Input value={displayProfile.username} readOnly disabled bg={dark.bg} borderColor={dark.borderSubtle} color="white" />
            </Field.Root>
            {canCustomizeColor && (
              <Field.Root>
                <Field.Label color={dark.label}>Display name color</Field.Label>
                <Box display="flex" flexDirection="column" gap={3}>
                  <Box color={dark.placeholder} fontSize="xs">
                    Solid
                  </Box>
                  <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
                    {SOLID_COLOR_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        aria-label={`Solid ${option.label}`}
                        title={option.label}
                        onClick={() => setColorInput(option.value)}
                        w="32px"
                        minW="32px"
                        h="32px"
                        p={0}
                        borderRadius="md"
                        bg={option.value}
                        border="none"
                        boxShadow="none"
                        _focusVisible={{ outline: 'none', boxShadow: 'none' }}
                        _hover={{
                          opacity: 0.9,
                        }}
                      />
                    ))}
                  </Box>
                  <Box color={dark.placeholder} fontSize="xs">
                    Gradient
                  </Box>
                  <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
                    {GRADIENT_PRESET_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        aria-label={`Gradient ${option.label}`}
                        title={option.label}
                        onClick={() => setColorInput(option.value)}
                        w="32px"
                        minW="32px"
                        h="32px"
                        p={0}
                        borderRadius="md"
                        bgImage={gradientSwatch(option.value)}
                        bgSize="cover"
                        bgRepeat="no-repeat"
                        backgroundPosition="center"
                        border="none"
                        boxShadow="none"
                        _focusVisible={{ outline: 'none', boxShadow: 'none' }}
                        _hover={{ opacity: 0.9 }}
                      />
                    ))}
                  </Box>
                  <Box color={dark.label} fontSize="sm">
                    Preview:{' '}
                    <Box as="span" fontWeight="600">
                      <DisplayNameText
                        name={displayProfile.username}
                        displayNameColor={colorInput}
                        fallbackColor="white"
                      />
                    </Box>
                  </Box>
                  <Box display="flex" gap={2}>
                    <Button
                      type="button"
                      size="sm"
                      bg="brand.500"
                      color="white"
                      _hover={{ bg: 'brand.400' }}
                      disabled={!colorChanged}
                      loading={savingColor}
                      onClick={handleSaveColor}
                    >
                      Save color
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      borderColor={dark.borderSubtle}
                      color="white"
                      _hover={{ bg: 'whiteAlpha.100' }}
                      disabled={!colorChanged}
                      onClick={handleResetColor}
                    >
                      Reset
                    </Button>
                  </Box>
                </Box>
              </Field.Root>
            )}
            <Field.Root>
              <Field.Label color={dark.label}>Email</Field.Label>
              <Input type="email" value={displayProfile.email} readOnly disabled bg={dark.bg} borderColor={dark.borderSubtle} color="white" />
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
          <Dialog.Content bg={dark.cardBg} borderColor={dark.borderSubtle} borderWidth="1px">
            <Dialog.Header color="white">Delete account?</Dialog.Header>
            <Dialog.Body color={dark.muted}>
              This will soft-delete your account. You will be logged out and cannot sign in again with this account.
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" color={dark.muted} borderColor={dark.borderSubtle} _hover={{ bg: 'whiteAlpha.100' }} onClick={deleteDialog.onClose}>
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
