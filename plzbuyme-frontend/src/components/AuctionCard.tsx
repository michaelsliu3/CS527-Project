import { Badge, Box, Card, Flex, Heading, Image, Text } from '@chakra-ui/react'
import { Link as RouterLink, useLocation, type Location } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { keyframes } from '@emotion/react'
import { LuImageOff } from 'react-icons/lu'
import type { AuctionListItem } from '../api/auctions'
import { dark } from '../theme/colors'
import { DisplayNameText } from './DisplayNameText'
import { resolveMediaUrl } from '../utils/mediaUrl'

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
  return 'brand.400'
}

function getTimerAccent(closeDateTime: string, status: string): { width: string; bg: string } {
  if (status !== 'active') return { width: '24%', bg: dark.border }
  const diff = toUtcEpochMs(closeDateTime) - Date.now()
  if (diff <= 0) return { width: '100%', bg: 'red.400' }
  if (diff <= 60 * 60 * 1000) return { width: '100%', bg: 'red.400' }
  if (diff <= 6 * 60 * 60 * 1000) return { width: '72%', bg: 'orange.400' }
  if (diff <= 24 * 60 * 60 * 1000) return { width: '54%', bg: 'orange.300' }
  return { width: '38%', bg: 'brand.400' }
}

function getTimerGlow(closeDateTime: string, status: string): string {
  if (status !== 'active') return 'rgba(148, 163, 184, 0.24)'
  const diff = toUtcEpochMs(closeDateTime) - Date.now()
  if (diff <= 60 * 60 * 1000) return 'rgba(248, 113, 113, 0.82)'
  if (diff <= 24 * 60 * 60 * 1000) return 'rgba(251, 191, 36, 0.72)'
  return 'rgba(56, 189, 248, 0.72)'
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
            <Badge colorPalette={statusBadgeColor} size="sm" flexShrink={0}>
              {statusLabel}
            </Badge>
          </Flex>
          <Box w="calc(100% + 2rem)" mx="-4">
            <Box
              position="relative"
              aspectRatio={4 / 3}
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
          <Text fontSize="2xl" fontWeight="extrabold" color="brand.400" lineHeight="1.1">
            ${auction.currentPrice.toLocaleString()}
          </Text>
          <Flex align="center" gap={2} flexWrap="wrap">
            <Badge variant="subtle" colorPalette="gray" size="sm">
              {auction.categoryName}
            </Badge>
            <Text fontSize="sm" color={dark.muted} lineHeight="1.5">
              by{' '}
              <DisplayNameText
                name={auction.sellerUsername}
                displayNameColor={auction.sellerDisplayNameColor}
                fallbackColor={dark.muted}
                fontWeight="bold"
              />
            </Text>
          </Flex>
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
