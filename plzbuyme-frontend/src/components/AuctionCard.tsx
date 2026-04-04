import { Badge, Box, Card, Flex, Heading, Image, Text } from '@chakra-ui/react'
import { Link as RouterLink, useLocation, type Location } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { keyframes } from '@emotion/react'
import { LuBox, LuImageOff } from 'react-icons/lu'
import type { AuctionListItem } from '../api/auctions'
import { dark } from '../theme/colors'
import { DisplayNameText } from './DisplayNameText'
import { resolveMediaUrl } from '../utils/mediaUrl'
import { hasAuction3dModel } from '../utils/auction3dModel'

const timerGlowPulse = keyframes`
  0%, 100% {
    opacity: 0.94;
  }
  50% {
    opacity: 1;
  }
`

const timerFlow = keyframes`
  from {
    background-position: 180% 0;
  }
  to {
    background-position: -180% 0;
  }
`

function formatStatusLabel(status: string): string {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function toUtcEpochMs(value: string): number {
  const normalized = value.endsWith('Z') || /[-+]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`
  return new Date(normalized).getTime()
}

function formatCountdown(closeDateTime: string): string {
  const end = toUtcEpochMs(closeDateTime)
  const now = Date.now()
  const diff = end - now
  if (diff <= 0) return '00:00:00'

  const days = Math.floor(diff / (24 * 60 * 60 * 1000))
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
  const secs = Math.floor((diff % (60 * 1000)) / 1000)
  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(
      secs
    ).padStart(2, '0')}`
  }
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function getCountdownColor(closeDateTime: string, status: string): string {
  if (status !== 'active') return dark.muted

  const end = toUtcEpochMs(closeDateTime)
  const now = Date.now()
  const diff = end - now
  if (diff <= 0) return 'red.300'
  if (diff <= 60 * 60 * 1000) return 'red.300'
  if (diff <= 24 * 60 * 60 * 1000) return 'orange.300'
  return 'blue.300'
}

function getTimerAccent(closeDateTime: string, status: string): { width: string; bg: string } {
  if (status !== 'active') return { width: '24%', bg: dark.border }
  const diff = toUtcEpochMs(closeDateTime) - Date.now()
  if (diff <= 0) return { width: '100%', bg: 'red.400' }
  if (diff <= 60 * 60 * 1000) return { width: '100%', bg: 'red.400' }
  if (diff <= 6 * 60 * 60 * 1000) return { width: '72%', bg: 'orange.400' }
  if (diff <= 24 * 60 * 60 * 1000) return { width: '54%', bg: 'orange.300' }
  return { width: '38%', bg: 'blue.500' }
}

function getTimerGlow(closeDateTime: string, status: string): string {
  if (status !== 'active') return 'rgba(148, 163, 184, 0.24)'
  const diff = toUtcEpochMs(closeDateTime) - Date.now()
  if (diff <= 60 * 60 * 1000) return 'rgba(248, 113, 113, 0.82)'
  if (diff <= 24 * 60 * 60 * 1000) return 'rgba(251, 191, 36, 0.72)'
  return 'rgba(37, 99, 235, 0.68)'
}

function isEndingSoon(closeDateTime: string, status: string): boolean {
  if (status !== 'active') return false
  const diff = toUtcEpochMs(closeDateTime) - Date.now()
  return diff > 0 && diff <= 60 * 60 * 1000
}

function isNewlyListed(createdAt?: string): boolean {
  if (!createdAt) return false
  const created = toUtcEpochMs(createdAt)
  if (Number.isNaN(created)) return false
  return Date.now() - created <= 24 * 60 * 60 * 1000
}

function normalizeCategoryName(value?: string): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function hashString(value: string): number {
  // Simple deterministic hash (stable across renders).
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0
  return Math.abs(hash)
}

function getRandomCategoryGradient(normalizedCategoryName: string): string {
  // Generate a stable, high-contrast gradient for any unknown category.
  const h = hashString(normalizedCategoryName)
  const hue1 = h % 360
  const hue2 = (hue1 + 50 + (h % 80)) % 360

  // Use HSL with fairly saturated, mid-bright colors so it's easy to see.
  return `linear-gradient(92deg, hsl(${hue1} 88% 58%) 0%, hsl(${hue2} 90% 46%) 100%)`
}

function getCategoryGradient(categoryName?: string): string {
  const normalized = normalizeCategoryName(categoryName)

  if (normalized === 'sedan' || normalized === 'sedans') {
    return 'linear-gradient(92deg, #38bdf8 0%, #0284c7 100%)'
  }
  if (normalized === 'sportscar' || normalized === 'sportscars') {
    return 'linear-gradient(90deg, #ff003c 0%, #ff8a00 16%, #f9f871 32%, #00d084 48%, #00c2ff 64%, #4d65ff 80%, #b347ff 100%)'
  }
  if (normalized === 'suv' || normalized === 'suvs') {
    return 'linear-gradient(92deg, #34d399 0%, #059669 100%)'
  }
  if (normalized === 'truck' || normalized === 'trucks') {
    return 'linear-gradient(92deg, #f59e0b 0%, #f97316 50%, #ef4444 100%)'
  }
  if (normalized === 'electric' || normalized === 'ev' || normalized === 'evs') {
    return 'linear-gradient(92deg, #a78bfa 0%, #7c3aed 100%)'
  }

  // New/unrecognized categories: random but stable gradient (instead of a single default).
  if (!normalized) return 'linear-gradient(92deg, #94a3b8 0%, #475569 100%)'
  return getRandomCategoryGradient(normalized)
}

export interface AuctionCardProps {
  auction: AuctionListItem
}

export function AuctionCard({ auction }: AuctionCardProps) {
  const location = useLocation()
  const state = location.state as { backgroundLocation?: Location } | null
  const backgroundLocation = state?.backgroundLocation ?? location
  const [countdown, setCountdown] = useState(() => formatCountdown(auction.closeDateTime))
  const imageSrc = resolveMediaUrl(auction.imageUrl)
  const preferredCardImageSrc =
    imageSrc && /\/media\/(?:cars\/)?gt7\/car\d{3,5}\.png$/i.test(imageSrc)
      ? imageSrc.replace(/\/car(\d{3,5})\.png$/i, '/card/car$1.jpg')
      : imageSrc
  const [cardImageSrc, setCardImageSrc] = useState<string | null>(preferredCardImageSrc)

  useEffect(() => {
    const t = setInterval(() => setCountdown(formatCountdown(auction.closeDateTime)), 1000)
    return () => clearInterval(t)
  }, [auction.closeDateTime])

  useEffect(() => {
    setCardImageSrc(preferredCardImageSrc)
  }, [preferredCardImageSrc])

  const statusColor =
    auction.status === 'active' ? 'green' : auction.status === 'sold' ? 'blue' : 'gray'
  const countdownColor = getCountdownColor(auction.closeDateTime, auction.status)
  const timerAccent = getTimerAccent(auction.closeDateTime, auction.status)
  const endingSoon = isEndingSoon(auction.closeDateTime, auction.status)
  const statusLabel = endingSoon ? 'Ending soon' : formatStatusLabel(auction.status)
  const statusBadgeColor = endingSoon ? 'red' : statusColor
  const reservePrice = auction.reservePrice ?? null
  const hasReserve = reservePrice != null && reservePrice > 0
  const isReserveMet = hasReserve && ((auction.isReserveMet ?? false) || auction.currentPrice >= reservePrice)
  const showNoReserve = reservePrice != null && reservePrice <= 0
  const highlightTags = [
    isReserveMet ? 'Reserve met' : null,
    showNoReserve ? 'No reserve' : null,
    isNewlyListed(auction.createdAt) ? 'Newly listed' : null,
  ].filter((tag): tag is string => Boolean(tag))
  const isExpiredActiveAuction =
    auction.status === 'active' && toUtcEpochMs(auction.closeDateTime) <= Date.now()
  const timerLabel =
    auction.status === 'active'
      ? isExpiredActiveAuction
        ? 'Expired'
        : 'Expires in'
      : formatStatusLabel(auction.status)
  const timerValue = auction.status === 'active' ? countdown : '00:00:00'
  const animateTimerBar = auction.status === 'active' && !isExpiredActiveAuction
  const timerGlow = getTimerGlow(auction.closeDateTime, auction.status)
  const categoryNames =
    auction.categoryNames && auction.categoryNames.length > 0
      ? auction.categoryNames
      : [auction.categoryName].filter((v): v is string => Boolean(v))
  const has3dView = hasAuction3dModel(auction.title)

  return (
    <RouterLink to={`/auctions/${auction.id}`} state={{ backgroundLocation }}>
      <Card.Root
        role="group"
        bg={dark.cardBg}
        borderWidth="1px"
        borderColor={dark.borderSubtle}
        overflow="hidden"
        minH="460px"
        _hover={{
          borderColor: dark.hoverBorder,
          transform: 'scale(1.015)',
          boxShadow: '0 16px 34px rgba(0,0,0,0.5), 0 0 30px rgba(56,189,248,0.28)',
        }}
        transition="transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease"
      >
        <Card.Body p={4} display="flex" flexDirection="column" gap={3}>
          <Flex align="flex-start" justify="space-between" gap={2}>
            <Box overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" minW={0}>
              <Heading
                size="lg"
                color="white"
                fontWeight="extrabold"
                lineHeight="1.2"
                whiteSpace="nowrap"
                overflow="hidden"
                textOverflow="ellipsis"
              >
                {auction.title}
              </Heading>
            </Box>
            <Flex direction="column" align="flex-end" gap={1.5} flexShrink={0}>
              <Badge colorPalette={statusBadgeColor} size="sm" flexShrink={0}>
                {statusLabel}
              </Badge>
            </Flex>
          </Flex>
          <Box w="calc(100% + 2rem)" mx="-4">
            <Box
              position="relative"
              aspectRatio={4 / 3}
            >
              <Box
                position="absolute"
                inset={0}
                overflow="hidden"
                style={{
                  WebkitMaskImage:
                    'linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) 24%, rgba(0, 0, 0, 1) 80%, rgba(0, 0, 0, 0) 100%)',
                  maskImage:
                    'linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) 24%, rgba(0, 0, 0, 1) 80%, rgba(0, 0, 0, 0) 100%)',
                }}
              >
                {cardImageSrc ? (
                  <Image
                    src={cardImageSrc}
                    alt={auction.title}
                    w="100%"
                    h="100%"
                    objectFit="cover"
                    objectPosition="40% center"
                    transition="transform 0.25s ease"
                    _groupHover={{ transform: 'scale(1.04)' }}
                    onError={() => {
                      if (cardImageSrc !== imageSrc && imageSrc) {
                        setCardImageSrc(imageSrc)
                        return
                      }
                      setCardImageSrc(null)
                    }}
                  />
                ) : (
                  <Flex
                    h="100%"
                    w="100%"
                    bgGradient="linear(to-br, whiteAlpha.100, blackAlpha.400)"
                    align="center"
                    justify="center"
                    direction="column"
                    gap={1}
                    aria-label={`No image available for ${auction.title}`}
                  >
                    <Box color="whiteAlpha.700" mb={1} aria-hidden="true">
                      <LuImageOff size={24} />
                    </Box>
                    <Text fontSize="sm" color={dark.muted} fontWeight="semibold">
                      No image available
                    </Text>
                  </Flex>
                )}
              </Box>
              {has3dView ? (
                <Flex
                  position="absolute"
                  right={2}
                  bottom={2}
                  zIndex={2}
                  bg="blackAlpha.700"
                  borderRadius="md"
                  px={2}
                  py={0.5}
                  gap={1}
                  align="center"
                  borderWidth="1px"
                  borderColor="whiteAlpha.300"
                  aria-label="Includes 3D view"
                >
                  <LuBox size={12} color="white" />
                  <Text fontSize="xs" color="white" fontWeight="semibold" letterSpacing="0.04em">
                    3D
                  </Text>
                </Flex>
              ) : null}
            </Box>
          </Box>
          {highlightTags.length > 0 ? (
            <Flex gap={2} flexWrap="wrap">
              {highlightTags.map((tag) => (
                <Badge
                  key={`${auction.id}-${tag}`}
                  variant="subtle"
                  colorPalette={tag === 'Ending soon' ? 'red' : tag === 'Newly listed' ? 'purple' : 'yellow'}
                  size="sm"
                >
                  {tag}
                </Badge>
              ))}
            </Flex>
          ) : null}
          <Flex align="center" justify="space-between" gap={3} flexWrap="wrap">
            <Text fontSize="2xl" fontWeight="extrabold" color="brand.400" lineHeight="1.1">
              ${auction.currentPrice.toLocaleString()}
            </Text>
            <Flex gap={1.5} flexWrap="wrap" justify="flex-end" align="center" flexShrink={0}>
              {categoryNames.map((name, index) => (
                <Box
                  key={`${auction.id}-cat-${index}-${name}`}
                  as="span"
                  flexShrink={0}
                  px={2}
                  py={0.5}
                  borderRadius="md"
                  fontSize="xs"
                  fontWeight="bold"
                  lineHeight="1.2"
                  letterSpacing="0.01em"
                  color="white"
                  bg={getCategoryGradient(name)}
                  textShadow="0 1px 1px rgba(0, 0, 0, 0.28)"
                  boxShadow="0 6px 20px rgba(56, 189, 248, 0.22), 0 0 14px rgba(56, 189, 248, 0.2)"
                >
                  {name}
                </Box>
              ))}
            </Flex>
          </Flex>
          <Text fontSize="sm" color={dark.muted} lineHeight="1.5">
            by{' '}
            <DisplayNameText
              name={auction.sellerUsername}
              displayNameColor={auction.sellerDisplayNameColor}
              fallbackColor={dark.muted}
              fontWeight="bold"
            />
          </Text>
          <Box mt="auto" pt={10}>
            <Flex align="center" justify="space-between" gap={3}>
              <Text fontSize="xs" color={dark.muted} fontWeight="semibold">
                {timerLabel}
              </Text>
              <Text fontSize="md" lineHeight="1" color={countdownColor} fontWeight="bold" fontFamily="mono">
                {timerValue}
              </Text>
            </Flex>
            <Box h="6px" w="100%" mt={2} position="relative" overflow="visible">
              <Box
                h="100%"
                w="100%"
                bg="whiteAlpha.200"
                borderRadius="0"
                overflow="hidden"
                position="relative"
              >
                {animateTimerBar ? (
                  <Box
                    position="absolute"
                    left={0}
                    top="50%"
                    transform="translateY(-50%)"
                    h="12px"
                    w={timerAccent.width}
                    bg={timerAccent.bg}
                    opacity={0.62}
                    filter="blur(8px)"
                    pointerEvents="none"
                    transition="all 0.25s ease"
                  />
                ) : null}
              </Box>
              <Box
                position="absolute"
                left={0}
                top={0}
                h="100%"
                w={timerAccent.width}
                bg={timerAccent.bg}
                borderRadius="0"
                zIndex={1}
                overflow="hidden"
                transition="all 0.25s ease"
                boxShadow={animateTimerBar ? `0 0 10px ${timerGlow}, 0 0 22px ${timerGlow}` : 'none'}
                animation={animateTimerBar ? `${timerGlowPulse} 4.8s ease-in-out infinite` : undefined}
                _before={
                  animateTimerBar
                    ? {
                        content: '""',
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(110deg, rgba(255,255,255,0) 28%, rgba(255,255,255,0.68) 50%, rgba(255,255,255,0) 72%)',
                        backgroundSize: '220% 100%',
                        animation: `${timerFlow} 2.9s linear infinite`,
                        willChange: 'background-position',
                        mixBlendMode: 'screen',
                        opacity: 0.95,
                        filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.7))',
                        pointerEvents: 'none',
                      }
                    : undefined
                }
              />
            </Box>
          </Box>
        </Card.Body>
      </Card.Root>
    </RouterLink>
  )
}
