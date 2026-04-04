import { useEffect, useMemo, useState } from 'react'
import { Container, Flex, SimpleGrid, Spinner, Text, Button } from '@chakra-ui/react'
import { getMyAuctions, type AuctionListItem } from '../api/auctions'
import { AuctionCard } from '../components/AuctionCard'
import { useSellItemModal } from '../context/SellItemModalContext'
import { dark } from '../theme/colors'
import { APP_PAGE_PX } from '../theme/layout'

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'sold', label: 'Sold' },
]
const MY_AUCTIONS_SORT_OPTIONS = [
  { value: 'closing_soon', label: 'Closing soon' },
  { value: 'newest', label: 'Newest listed' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'most_bids', label: 'Most bids' },
]

export function MyAuctionsPage() {
  const { openSellModal } = useSellItemModal()
  const [items, setItems] = useState<AuctionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [sortKey, setSortKey] = useState<string>('closing_soon')
  const [listRefreshToken, setListRefreshToken] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getMyAuctions(statusFilter || undefined)
      .then((res) => setItems(res.data))
      .catch(() => setError('Failed to load your auctions.'))
      .finally(() => setLoading(false))
  }, [statusFilter, listRefreshToken])

  const sortedItems = useMemo(() => {
    const ranked = [...items]
    switch (sortKey) {
      case 'price_asc':
        ranked.sort((a, b) => a.currentPrice - b.currentPrice)
        break
      case 'price_desc':
        ranked.sort((a, b) => b.currentPrice - a.currentPrice)
        break
      case 'newest':
        ranked.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return bTime - aTime
        })
        break
      case 'most_bids':
        ranked.sort((a, b) => b.bidCount - a.bidCount)
        break
      case 'closing_soon':
      default:
        ranked.sort((a, b) => new Date(a.closeDateTime).getTime() - new Date(b.closeDateTime).getTime())
        break
    }

    return ranked
  }, [items, sortKey])

  return (
    <Container maxW="container.xl" px={APP_PAGE_PX}>
      <Flex align="center" justify="space-between" gap={4} mb={4} flexWrap="wrap">
        <Text fontSize="2xl" fontWeight="bold" color="white">
          My auctions
        </Text>
        <Flex direction="column" align="flex-end" gap={2}>
          <Button
            size="sm"
            bg="brand.500"
            color="white"
            _hover={{ bg: 'brand.400' }}
            onClick={() =>
              openSellModal({
                onAfterCreate: () => setListRefreshToken((t) => t + 1),
              })
            }
          >
            Create Auction
          </Button>
        </Flex>
      </Flex>
      <Flex align="center" justify="space-between" gap={3} mb={6} flexWrap="wrap">
        <Flex gap={2} flexWrap="wrap">
          {STATUS_TABS.map((tab) => (
            <Button
              key={tab.value || 'all'}
              size="md"
              variant="outline"
              borderColor={dark.borderSubtle}
              bg={statusFilter === tab.value ? 'whiteAlpha.100' : 'transparent'}
              color="white"
              h="40px"
              fontSize="md"
              _hover={{
                bg: 'whiteAlpha.100',
                borderColor: dark.borderSubtle,
              }}
              onClick={() => setStatusFilter(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </Flex>
        <select
          aria-label="My auctions sort options"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          style={{
            width: '210px',
            padding: '8px 12px',
            background: dark.inputBg,
            border: `1px solid ${dark.borderSubtle}`,
            borderRadius: '6px',
            color: 'white',
            marginLeft: 'auto',
          }}
        >
          {MY_AUCTIONS_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Flex>
      {error && (
        <Text color="red.400" mb={4}>
          {error}
        </Text>
      )}
      {loading ? (
        <Flex justify="center" py={12}>
          <Spinner size="xl" color="brand.400" />
        </Flex>
      ) : items.length === 0 ? (
        <Text color={dark.muted} py={8} textAlign="center">
          No auctions found.
        </Text>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} gap={4}>
          {sortedItems.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </SimpleGrid>
      )}
    </Container>
  )
}
