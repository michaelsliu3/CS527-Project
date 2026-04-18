import { useEffect, useRef, useState } from 'react'
import { Box, Container, Flex, SimpleGrid, Spinner, Text, Button, Icon } from '@chakra-ui/react'
import { useSearchParams } from 'react-router-dom'
import { LuChevronDown, LuRefreshCw } from 'react-icons/lu'
import { browseAuctions, type AuctionListItem, type BrowseParams } from '../api/auctions'
import { AuctionCard } from '../components/AuctionCard'
import { SearchBar } from '../components/SearchBar'
import { showErrorToast } from '../components/ui/toaster'
import { useAuth } from '../context/AuthContext'
import { useSellItemModal } from '../context/SellItemModalContext'
import { dark } from '../theme/colors'
import { APP_PAGE_PX } from '../theme/layout'
import {
  isAuctionLowDetailModeEnabled,
  subscribeAuctionListRefresh,
  subscribeAuctionLowDetailModeChange,
} from '../utils/auctionListRefresh'

function canCreateAuctions(role: string | undefined): boolean {
  if (!role) return false
  return role === 'end_user' || role === 'vip' || role === 'customer_rep' || role === 'admin'
}

const DEFAULT_AUCTION_PAGE_SIZE = 21
const TOP_RIGHT_SORT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'newest', label: 'Newest' },
  { value: 'closing_soon', label: 'Closing soon' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'most_bids', label: 'Most bids' },
  { value: 'relevance', label: 'Relevance' },
]
const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'sold', label: 'Sold' },
]

function normalizeGridPageSize(rawPageSize: string | null): number {
  if (!rawPageSize) return DEFAULT_AUCTION_PAGE_SIZE
  const parsed = Number(rawPageSize)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_AUCTION_PAGE_SIZE
  const whole = Math.floor(parsed)
  return whole % 3 === 0 ? whole : DEFAULT_AUCTION_PAGE_SIZE
}

function buildBrowseParams(searchParams: URLSearchParams): BrowseParams {
  const params: BrowseParams = {}
  const q = searchParams.get('q')
  if (q) params.q = q
  const categoryId = searchParams.get('categoryId')
  if (categoryId) params.categoryId = Number(categoryId)
  const minPrice = searchParams.get('minPrice')
  if (minPrice) params.minPrice = Number(minPrice)
  const maxPrice = searchParams.get('maxPrice')
  if (maxPrice) params.maxPrice = Number(maxPrice)
  const status = searchParams.get('status')
  if (status) params.status = status
  const closingBefore = searchParams.get('closingBefore')
  if (closingBefore) params.closingBefore = closingBefore
  const closingAfter = searchParams.get('closingAfter')
  if (closingAfter) params.closingAfter = closingAfter
  const seller = searchParams.get('seller')
  if (seller) params.seller = seller
  const fieldFilters = searchParams.get('fieldFilters')
  if (fieldFilters) params.fieldFilters = fieldFilters
  const sort = searchParams.get('sort')
  if (sort) params.sort = sort
  const page = searchParams.get('page')
  if (page) params.page = Number(page) || 1
  params.pageSize = normalizeGridPageSize(searchParams.get('pageSize'))
  return params
}

export function AuctionListPage() {
  const { user } = useAuth()
  const { openSellModal } = useSellItemModal()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<AuctionListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_AUCTION_PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [listRefreshToken, setListRefreshToken] = useState(0)
  const [lowDetailModeEnabled, setLowDetailModeEnabled] = useState(() => isAuctionLowDetailModeEnabled())
  const activeRequestId = useRef(0)

  useEffect(() => {
    activeRequestId.current += 1
    const requestId = activeRequestId.current
    setLoading(true)
    setError(null)
    const params = buildBrowseParams(searchParams)
    browseAuctions(params)
      .then((res) => {
        if (requestId !== activeRequestId.current) return
        setItems(res.data.items)
        setTotalCount(res.data.totalCount)
        setPage(res.data.page)
        setPageSize(res.data.pageSize || DEFAULT_AUCTION_PAGE_SIZE)
        setError(null)
      })
      .catch(() => {
        if (requestId !== activeRequestId.current) return
        setError('Failed to load auctions.')
        showErrorToast('Failed to load auctions', 'Please try again later.')
      })
      .finally(() => {
        if (requestId === activeRequestId.current) {
          setLoading(false)
        }
      })
  }, [searchParams, listRefreshToken])

  useEffect(() => {
    return subscribeAuctionListRefresh(() => setListRefreshToken((t) => t + 1))
  }, [])

  useEffect(() => {
    return subscribeAuctionLowDetailModeChange(() => {
      setLowDetailModeEnabled(isAuctionLowDetailModeEnabled())
    })
  }, [])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const hasNext = page < totalPages
  const hasPrev = page > 1
  const sortKey = searchParams.get('sort') ?? ''
  const statusKey = searchParams.get('status') ?? 'active'
  const shouldForceStatic3dIcons = lowDetailModeEnabled
  const handleTopRightSortChange = (nextSort: string) => {
    const next = new URLSearchParams(searchParams)
    if (nextSort) {
      next.set('sort', nextSort)
    } else {
      next.delete('sort')
    }
    next.set('page', '1')
    setSearchParams(next)
  }

  const nextPage = () => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page + 1))
    setSearchParams(next)
  }

  const prevPage = () => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page - 1))
    setSearchParams(next)
  }

  const refreshAuctions = () => {
    setListRefreshToken((t) => t + 1)
  }

  const handleStatusTabChange = (nextStatus: string) => {
    const next = new URLSearchParams(searchParams)
    if (nextStatus) {
      next.set('status', nextStatus)
    } else {
      // Keep an explicit empty status so defaulting logic doesn't force "active" back.
      next.set('status', '')
    }
    next.set('page', '1')
    setSearchParams(next)
  }

  return (
    <Container maxW="container.xl" px={APP_PAGE_PX} position="relative">
      {canCreateAuctions(user?.role) && (
        <Box position="absolute" top={2} right={4} zIndex={2}>
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
        </Box>
      )}
      <SearchBar variant="top" topMarginBottom={0} />

      <Flex direction={{ base: 'column', lg: 'row' }} gap={4} align="flex-start">
        <Box w={{ base: '100%', lg: '320px' }} flexShrink={0}>
          <SearchBar variant="filters" />
        </Box>

        <Box flex="1" w="100%">
          <Flex mb={4} justify="space-between" align="center" gap={3} wrap="wrap">
            <Flex gap={2} wrap="wrap">
              {STATUS_TABS.map((tab) => {
                const isActive = statusKey === tab.value
                return (
                  <Button
                    key={tab.value || 'all'}
                    size="md"
                    variant="outline"
                    borderColor={dark.borderSubtle}
                    bg={isActive ? 'whiteAlpha.100' : 'transparent'}
                    color="white"
                    h="40px"
                    fontSize="md"
                    _hover={{
                      bg: 'whiteAlpha.100',
                      borderColor: dark.borderSubtle,
                    }}
                    onClick={() => handleStatusTabChange(tab.value)}
                  >
                    {tab.label}
                  </Button>
                )
              })}
            </Flex>
            <Flex align="center" gap={2}>
            <Button
              aria-label="Refresh auctions"
              onClick={refreshAuctions}
              disabled={loading}
              variant="outline"
              borderColor={dark.borderSubtle}
              color="white"
              _hover={{ bg: 'whiteAlpha.100' }}
              minW="40px"
              w="40px"
              h="40px"
              p={0}
            >
              <Icon as={LuRefreshCw} boxSize={4.5} />
            </Button>
            <Box position="relative" w="100%" maxW="230px">
              <select
                aria-label="Auction sort options"
                value={sortKey}
                onChange={(e) => handleTopRightSortChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 34px 8px 12px',
                  background: dark.inputBg,
                  border: `1px solid ${dark.borderSubtle}`,
                  borderRadius: '6px',
                  color: 'white',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                }}
              >
                {TOP_RIGHT_SORT_OPTIONS.map((o) => (
                  <option key={o.value || 'default'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Icon
                as={LuChevronDown}
                position="absolute"
                right={3}
                top="50%"
                transform="translateY(-50%)"
                color={dark.muted}
                pointerEvents="none"
              />
            </Box>
            </Flex>
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
            <>
              <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap={4}>
                {items.map((auction) => (
                  <AuctionCard
                    key={auction.id}
                    auction={auction}
                    forceStatic3dIcon={shouldForceStatic3dIcons}
                    disableTimerGlow={lowDetailModeEnabled}
                  />
                ))}
              </SimpleGrid>
              <Flex mt={6} justify="space-between" align="center">
                <Text fontSize="sm" color={dark.muted}>
                  Page {page} of {totalPages} ({totalCount} total)
                </Text>
                <Flex gap={2}>
                  <Button
                    size="sm"
                    variant="outline"
                    borderColor={dark.borderSubtle}
                    color="white"
                    _hover={{ bg: 'whiteAlpha.100' }}
                    disabled={!hasPrev}
                    onClick={prevPage}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    borderColor={dark.borderSubtle}
                    color="white"
                    _hover={{ bg: 'whiteAlpha.100' }}
                    disabled={!hasNext}
                    onClick={nextPage}
                  >
                    Next
                  </Button>
                </Flex>
              </Flex>
            </>
          )}
        </Box>
      </Flex>
    </Container>
  )
}
