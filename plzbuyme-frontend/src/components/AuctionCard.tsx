import { Badge, Box, Card, Flex, Heading, Image, Text } from '@chakra-ui/react'
import { Link as RouterLink, useLocation, type Location } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { AuctionListItem } from '../api/auctions'
import { dark } from '../theme/colors'
import { DisplayNameText } from './DisplayNameText'
import { resolveMediaUrl } from '../utils/mediaUrl'

function formatCountdown(closeDateTime: string): string {
  const end = new Date(closeDateTime).getTime()
  const now = Date.now()
  const diff = end - now
  if (diff <= 0) return 'Ended'
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
  if (days > 0) return `${days}d ${hours}h left`
  if (hours > 0) return `${hours}h ${mins}m left`
  return `${mins}m left`
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

  return (
    <RouterLink to={`/auctions/${auction.id}`} state={{ backgroundLocation }}>
      <Card.Root
        role="group"
        bg={dark.cardBg}
        borderWidth="1px"
        borderColor={dark.borderSubtle}
        overflow="hidden"
        _hover={{
          borderColor: dark.hoverBorder,
          transform: 'scale(1.015)',
          boxShadow: '0 14px 30px rgba(0,0,0,0.45)',
        }}
        transition="transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease"
      >
        {cardImageSrc ? (
          <Image
            src={cardImageSrc}
            alt={auction.title}
            w="100%"
            h="160px"
            objectFit="cover"
            borderBottomWidth="1px"
            borderColor={dark.borderSubtle}
            transition="transform 0.25s ease"
            _groupHover={{ transform: 'scale(1.04)' }}
            onError={() => {
              if (cardImageSrc !== imageSrc) {
                setCardImageSrc(imageSrc)
              }
            }}
          />
        ) : null}
        <Card.Body p={4}>
          <Flex align="flex-start" justify="space-between" gap={2} mb={2}>
            <Box overflow="hidden" textOverflow="ellipsis" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as 'vertical' }}>
            <Heading size="sm" color="white" fontWeight="extrabold">
              {auction.title}
            </Heading>
          </Box>
            <Badge colorPalette={statusColor} size="sm" flexShrink={0}>
              {auction.status}
            </Badge>
          </Flex>
          <Text fontSize="xl" fontWeight="semibold" color="brand.400">
            ${auction.currentPrice.toLocaleString()}
          </Text>
          <Text fontSize="sm" color={dark.muted} mt={1}>
            {countdown}
          </Text>
          <Flex mt={2} gap={2} flexWrap="wrap">
            <Badge variant="subtle" colorPalette="gray" size="sm">
              {auction.categoryName}
            </Badge>
            <Text fontSize="xs" color={dark.muted}>
              by{' '}
              <DisplayNameText
                name={auction.sellerUsername}
                displayNameColor={auction.sellerDisplayNameColor}
                fallbackColor={dark.muted}
                fontWeight="bold"
              />{' '}
              · {auction.bidCount} bid{auction.bidCount !== 1 ? 's' : ''}
            </Text>
          </Flex>
        </Card.Body>
      </Card.Root>
    </RouterLink>
  )
}
