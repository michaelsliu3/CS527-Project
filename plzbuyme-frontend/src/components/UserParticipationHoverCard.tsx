import { useEffect, useRef, useState } from 'react'
import { Box, Button, Flex, Popover, Portal, Text } from '@chakra-ui/react'
import { keyframes } from '@emotion/react'
import { useNavigate } from 'react-router-dom'
import { dark } from '../theme/colors'
import { DisplayNameText } from './DisplayNameText'
import { UserAvatar } from './UserAvatar'
import { isDisplayNamePreset, normalizeDisplayNameColor } from '../utils/displayNameColor'
import { useAuth } from '../context/AuthContext'

interface UserParticipationHoverCardProps {
  userId: number
  username: string
  revealUsername?: string | null
  avatarUrl?: string | null
  displayNameColor?: string | null
  fallbackColor?: string
  avatarSize?: string
  showTriggerAvatar?: boolean
  openOnMountToken?: number
}

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`

function presetGradient(preset: string): string {
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
      return 'linear-gradient(90deg, #60A5FA, #60A5FA)'
  }
}

export function UserParticipationHoverCard({
  userId,
  username,
  revealUsername,
  avatarUrl,
  displayNameColor,
  fallbackColor = dark.muted,
  avatarSize = '22px',
  showTriggerAvatar = true,
  openOnMountToken,
}: UserParticipationHoverCardProps) {
  let currentUserId: number | null = null
  try {
    currentUserId = useAuth().user?.id ?? null
  } catch {
    // Some isolated tests render this component without AuthProvider.
    currentUserId = null
  }
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [isNameRevealActive, setIsNameRevealActive] = useState(false)
  const closeTimerRef = useRef<number | null>(null)
  const revealOffTimerRef = useRef<number | null>(null)
  const normalizedNameColor = normalizeDisplayNameColor(displayNameColor)
  const hasGradientPreset = normalizedNameColor != null && isDisplayNamePreset(normalizedNameColor)
  const accentColor = normalizedNameColor && !isDisplayNamePreset(normalizedNameColor)
    ? normalizedNameColor
    : '#60A5FA'
  const accentBorder = `${accentColor}CC`
  const accentGlowSoft = `${accentColor}66`
  const accentGlowStrong = `${accentColor}B3`
  const accentGradient = hasGradientPreset ? presetGradient(normalizedNameColor) : null
  const shouldDisableReveal = currentUserId === userId
  const effectiveRevealUsername = shouldDisableReveal ? null : revealUsername
  const displayedName =
    isNameRevealActive && effectiveRevealUsername ? effectiveRevealUsername : username
  const revealHoverMinWidthCh =
    effectiveRevealUsername != null
      ? Math.max(username.length, effectiveRevealUsername.length)
      : undefined

  useEffect(() => {
    if (openOnMountToken == null) return
    setOpen(true)
  }, [openOnMountToken])

  useEffect(() => {
    return () => {
      if (revealOffTimerRef.current != null) {
        window.clearTimeout(revealOffTimerRef.current)
      }
    }
  }, [])

  const clearCloseTimer = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const clearRevealOffTimer = () => {
    if (revealOffTimerRef.current != null) {
      window.clearTimeout(revealOffTimerRef.current)
      revealOffTimerRef.current = null
    }
  }

  const activateReveal = () => {
    clearRevealOffTimer()
    setIsNameRevealActive(true)
  }

  const scheduleRevealOff = () => {
    clearRevealOffTimer()
    // Keep reveal stable while cursor crosses tiny trigger/content gaps.
    revealOffTimerRef.current = window.setTimeout(() => {
      setIsNameRevealActive(false)
      revealOffTimerRef.current = null
    }, 140)
  }

  const openPopover = () => {
    clearCloseTimer()
    setOpen(true)
  }

  const scheduleClosePopover = () => {
    clearCloseTimer()
    // Small delay prevents flicker while cursor crosses trigger/content gap.
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false)
      closeTimerRef.current = null
    }, 120)
  }

  return (
    <Popover.Root
      lazyMount
      unmountOnExit
      autoFocus={false}
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
      positioning={{ placement: 'bottom-start', gutter: 0 }}
    >
      <Popover.Trigger asChild>
        <Box
          as="span"
          display="inline-flex"
          p={0}
          bg="transparent"
          border="none"
          borderRadius="0"
          boxShadow="none"
          color={fallbackColor}
          cursor="pointer"
          _hover={{ bg: 'transparent', color: 'white' }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onMouseEnter={openPopover}
          onMouseLeave={scheduleClosePopover}
        >
          <Flex align="center" gap={showTriggerAvatar ? 2 : 0}>
            {showTriggerAvatar ? (
              <UserAvatar name={username} avatarUrl={avatarUrl} size={avatarSize} />
            ) : null}
            <Box
              as="span"
              display="inline-flex"
              minW={revealHoverMinWidthCh ? `${revealHoverMinWidthCh}ch` : undefined}
              whiteSpace="nowrap"
              onMouseEnter={activateReveal}
              onMouseLeave={scheduleRevealOff}
              onFocus={activateReveal}
              onBlur={scheduleRevealOff}
            >
              <DisplayNameText
                name={displayedName}
                displayNameColor={displayNameColor}
                fallbackColor={fallbackColor}
                fontWeight="bold"
              />
            </Box>
          </Flex>
        </Box>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner zIndex={2800}>
          <Popover.Content
            bg="transparent"
            border="none"
            boxShadow="none"
            p={0}
            w="260px"
            css={{
              '--popover-bg': 'rgba(0, 0, 0, 0.42)',
              background: 'transparent !important',
            }}
            style={{
              background: 'transparent',
            }}
            onMouseEnter={openPopover}
            onMouseLeave={scheduleClosePopover}
          >
            <Box
              p="1px"
              borderRadius="md"
              bg={hasGradientPreset ? undefined : 'transparent'}
              borderWidth={hasGradientPreset ? '0' : '1px'}
              borderStyle={hasGradientPreset ? undefined : 'solid'}
              borderColor={hasGradientPreset ? undefined : accentBorder}
              boxShadow={
                hasGradientPreset
                  ? '0 10px 28px rgba(0,0,0,0.24), 0 0 18px rgba(96, 165, 250, 0.35)'
                  : `0 10px 28px rgba(0,0,0,0.24), 0 0 0 1px ${accentGlowSoft}, 0 0 18px ${accentGlowSoft}`
              }
              transition="border-color 0.2s ease, box-shadow 0.2s ease"
              _hover={{
                borderColor: hasGradientPreset ? undefined : accentColor,
                boxShadow: hasGradientPreset
                  ? '0 12px 30px rgba(0,0,0,0.26), 0 0 24px rgba(96, 165, 250, 0.55)'
                  : `0 12px 30px rgba(0,0,0,0.26), 0 0 0 1px ${accentGlowStrong}, 0 0 24px ${accentGlowStrong}`,
              }}
              position="relative"
              overflow="hidden"
              _before={
                hasGradientPreset
                  ? {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 'inherit',
                    p: '1px',
                    backgroundImage: accentGradient ?? undefined,
                    backgroundSize: '260% 260%',
                    animation: `${gradientShift} 5s linear infinite`,
                    pointerEvents: 'none',
                    WebkitMask:
                      'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                  }
                  : undefined
              }
            >
              <Box
                p={3}
                borderRadius="calc(var(--chakra-radii-md) - 1px)"
                bg="rgba(0, 0, 0, 0.2)"
                backdropFilter="blur(2px)"
                style={{ WebkitBackdropFilter: 'blur(2px)' }}
                onMouseEnter={activateReveal}
                onMouseLeave={scheduleRevealOff}
                onFocus={activateReveal}
                onBlur={scheduleRevealOff}
              >
              <Flex align="center" gap={3} mb={3}>
                <UserAvatar name={username} avatarUrl={avatarUrl} size="34px" />
                <Box minW={0}>
                  <Box
                    as="span"
                    display="inline-flex"
                    minW={revealHoverMinWidthCh ? `${revealHoverMinWidthCh}ch` : undefined}
                    whiteSpace="nowrap"
                  >
                    <DisplayNameText
                      name={displayedName}
                      displayNameColor={displayNameColor}
                      fallbackColor="white"
                      fontWeight="bold"
                    />
                  </Box>
                  <Text color={dark.muted} fontSize="xs">
                    User participation overview
                  </Text>
                </Box>
              </Flex>
              <Button
                w="full"
                size="sm"
                variant="outline"
                borderColor={dark.borderSubtle}
                color="white"
                _hover={{ bg: 'whiteAlpha.100' }}
                _focus={{ boxShadow: 'none !important', borderColor: dark.borderSubtle, outline: 'none !important' }}
                _focusVisible={{
                  boxShadow: 'none !important',
                  borderColor: dark.borderSubtle,
                  outline: 'none !important',
                  outlineOffset: '0',
                }}
                css={{
                  '&:focus, &:focus-visible, &[data-focus], &[data-focus-visible]': {
                    outline: 'none !important',
                    boxShadow: 'none !important',
                  },
                }}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setOpen(false)
                  navigate(`/users/${userId}/history`, {
                    state: {
                      targetUser: {
                        id: userId,
                        username,
                        revealUsername: effectiveRevealUsername ?? null,
                        avatarUrl: avatarUrl ?? null,
                        displayNameColor: displayNameColor ?? null,
                      },
                    },
                  })
                }}
              >
                View participation history
              </Button>
              </Box>
            </Box>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}
