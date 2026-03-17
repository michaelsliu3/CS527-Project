import { useEffect, useState } from 'react'
import { Box, Container, Flex, SimpleGrid, Spinner, Text, Button } from '@chakra-ui/react'
import { useSearchParams } from 'react-router-dom'
import { browseAuctions, type AuctionListItem, type BrowseParams } from '../api/auctions'
import { AuctionCard } from '../components/AuctionCard'
import { SearchBar } from '../components/SearchBar'
import { showErrorToast } from '../components/ui/toaster'
import { dark } from '../theme/colors'

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
  const sort = searchParams.get('sort')
  if (sort) params.sort = sort
  const page = searchParams.get('page')
  if (page) params.page = Number(page) || 1
  const pageSize = searchParams.get('pageSize')
  if (pageSize) params.pageSize = Number(pageSize) || 20
  const make = searchParams.get('make')
  if (make) params.make = make
  const model = searchParams.get('model')
  if (model) params.model = model
  const yearMin = searchParams.get('yearMin')
  if (yearMin) params.yearMin = Number(yearMin)
  const yearMax = searchParams.get('yearMax')
  if (yearMax) params.yearMax = Number(yearMax)
  const mileageMax = searchParams.get('mileageMax')
  if (mileageMax) params.mileageMax = Number(mileageMax)
  const exteriorColor = searchParams.get('exteriorColor')
  if (exteriorColor) params.exteriorColor = exteriorColor
  const condition = searchParams.getAll('condition')
  if (condition.length) params.condition = condition
  const transmission = searchParams.getAll('transmission')
  if (transmission.length) params.transmission = transmission
  const fuelType = searchParams.getAll('fuelType')
  if (fuelType.length) params.fuelType = fuelType
  return params
}

export function AuctionListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<AuctionListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = buildBrowseParams(searchParams)
    browseAuctions(params)
      .then((res) => {
        setItems(res.data.items)
        setTotalCount(res.data.totalCount)
        setPage(res.data.page)
        setError(null)
      })
      .catch(() => {
        setError('Failed to load auctions.')
        showErrorToast('Failed to load auctions', 'Please try again later.')
      })
      .finally(() => setLoading(false))
  }, [searchParams])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const hasNext = page < totalPages
  const hasPrev = page > 1

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

  return (
    <Container maxW="container.xl">
      <SearchBar variant="top" />

      <Flex direction={{ base: 'column', lg: 'row' }} gap={4} align="flex-start">
        <Box w={{ base: '100%', lg: '320px' }} flexShrink={0}>
          <SearchBar variant="filters" />
        </Box>

        <Box flex="1" w="100%">
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
                  <AuctionCard key={auction.id} auction={auction} />
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
