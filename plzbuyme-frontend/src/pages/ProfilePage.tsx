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
  DISPLAY_NAME_STYLE_PRESETS,
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
  const colorValidationError =
    colorInput.trim().length > 0 && !normalizedColor
      ? 'Use a valid hex (#A1B2C3) or preset (RAINBOW, PURPBLU, RGBFLOW).'
      : null
  const originalColor = displayProfile.displayNameColor ?? ''
  const colorChanged = (normalizedColor ?? '') !== (normalizeDisplayNameColor(originalColor) ?? '')

  const handleSaveColor = async () => {
    if (!canCustomizeColor || colorValidationError || !colorChanged) return
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
                  <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
                    <Button
                      size="xs"
                      variant={normalizeDisplayNameColor(colorInput) === 'RAINBOW' ? 'solid' : 'outline'}
                      onClick={() => setColorInput('RAINBOW')}
                    >
                      Rainbow
                    </Button>
                    <Button
                      size="xs"
                      variant={normalizeDisplayNameColor(colorInput) === 'PURPBLU' ? 'solid' : 'outline'}
                      onClick={() => setColorInput('PURPBLU')}
                    >
                      Purple-Blue Fade
                    </Button>
                    <Button
                      size="xs"
                      variant={normalizeDisplayNameColor(colorInput) === 'RGBFLOW' ? 'solid' : 'outline'}
                      onClick={() => setColorInput('RGBFLOW')}
                    >
                      RGB Flow
                    </Button>
                  </Box>
                  <Box display="flex" gap={3} alignItems="center" flexWrap="wrap">
                    <Input
                      type="color"
                      aria-label="Pick display name color"
                      value={normalizedColor?.startsWith('#') ? normalizedColor : '#FFFFFF'}
                      onChange={(e) => setColorInput(e.target.value)}
                      w="56px"
                      p={1}
                      bg={dark.bg}
                      borderColor={dark.borderSubtle}
                    />
                    <Input
                      value={colorInput}
                      onChange={(e) => setColorInput(e.target.value)}
                      placeholder="#A1B2C3 or RAINBOW"
                      bg={dark.bg}
                      borderColor={colorValidationError ? 'red.400' : dark.borderSubtle}
                      color="white"
                      maxLength={7}
                    />
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
                  <Box color={dark.placeholder} fontSize="xs">
                    Presets: {DISPLAY_NAME_STYLE_PRESETS.join(', ')}
                  </Box>
                  {colorValidationError && (
                    <Box color="red.400" fontSize="sm">
                      {colorValidationError}
                    </Box>
                  )}
                  <Box display="flex" gap={2}>
                    <Button
                      type="button"
                      bg="brand.500"
                      color="white"
                      _hover={{ bg: 'brand.400' }}
                      disabled={!colorChanged || !!colorValidationError}
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
