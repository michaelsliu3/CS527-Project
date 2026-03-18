import { useEffect, useState } from 'react'
import { Container, Flex, SimpleGrid, Spinner, Text, Button } from '@chakra-ui/react'
import { getMyAuctions, type AuctionListItem } from '../api/auctions'
import { AuctionCard } from '../components/AuctionCard'
import { dark } from '../theme/colors'
import { APP_PAGE_PX } from '../theme/layout'

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'sold', label: 'Sold' },
]

export function MyAuctionsPage() {
  const [items, setItems] = useState<AuctionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')

  useEffect(() => {
    setLoading(true)
    setError(null)
    getMyAuctions(statusFilter || undefined)
      .then((res) => setItems(res.data))
      .catch(() => setError('Failed to load your auctions.'))
      .finally(() => setLoading(false))
  }, [statusFilter])

  return (
    <Container maxW="container.xl" px={APP_PAGE_PX}>
      <Text fontSize="2xl" fontWeight="bold" color="white" mb={4}>
        My auctions
      </Text>
      <Flex gap={2} mb={6} flexWrap="wrap">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value || 'all'}
            size="sm"
            variant={statusFilter === tab.value ? 'solid' : 'outline'}
            colorScheme={statusFilter === tab.value ? 'brand' : 'gray'}
            borderColor={dark.borderSubtle}
            color={statusFilter === tab.value ? 'white' : dark.muted}
            onClick={() => setStatusFilter(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
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
          {items.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </SimpleGrid>
      )}
    </Container>
  )
}
