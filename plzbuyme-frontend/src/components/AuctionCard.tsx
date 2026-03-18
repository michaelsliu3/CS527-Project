import { Badge, Box, Card, Flex, Heading, Text } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { AuctionListItem } from '../api/auctions'
import { dark } from '../theme/colors'
import { DisplayNameText } from './DisplayNameText'

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
  const [countdown, setCountdown] = useState(() => formatCountdown(auction.closeDateTime))

  useEffect(() => {
    const t = setInterval(() => setCountdown(formatCountdown(auction.closeDateTime)), 1000)
    return () => clearInterval(t)
  }, [auction.closeDateTime])

  const statusColor =
    auction.status === 'active' ? 'green' : auction.status === 'sold' ? 'blue' : 'gray'

  return (
    <RouterLink to={`/auctions/${auction.id}`}>
      <Card.Root
        bg={dark.cardBg}
        borderWidth="1px"
        borderColor={dark.borderSubtle}
        overflow="hidden"
        _hover={{ borderColor: dark.hoverBorder }}
        transition="border-color 0.15s"
      >
        <Card.Body p={4}>
          <Flex align="flex-start" justify="space-between" gap={2} mb={2}>
            <Box overflow="hidden" textOverflow="ellipsis" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as 'vertical' }}>
            <Heading size="sm" color="white">
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
              />{' '}
              · {auction.bidCount} bid{auction.bidCount !== 1 ? 's' : ''}
            </Text>
          </Flex>
        </Card.Body>
      </Card.Root>
    </RouterLink>
  )
}
