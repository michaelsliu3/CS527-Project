import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Container,
  Flex,
  Grid,
  Input,
  Tabs,
  Text,
  Spinner,
} from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import {
  getTotalEarnings,
  getEarningsByType,
  getEarningsByUser,
  getEarningsByItem,
  getBestSelling,
  getBestBuyers,
  type ReportQueryParams,
  type EarningsByTypeItem,
  type EarningsByUserItem,
  type EarningsByItemItem,
  type BestSellingItem,
  type BestBuyer,
} from '../../api/admin'
import { showErrorToast } from '../../components/ui/toaster'
import { dark } from '../../theme/colors'
import { tableStyles, thBase, tdStyle } from '../../theme/tableStyles'
import { APP_PAGE_PX } from '../../theme/layout'

type ReportsFilters = {
  from?: string
  to?: string
  top: number
}

function toReportParams(filters: ReportsFilters, extra?: Omit<ReportQueryParams, 'from' | 'to' | 'top'>): ReportQueryParams {
  return {
    from: filters.from || undefined,
    to: filters.to || undefined,
    top: filters.top,
    ...extra,
  }
}

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState('total')
  const [draftFilters, setDraftFilters] = useState<ReportsFilters>({ top: 10 })
  const [filters, setFilters] = useState<ReportsFilters>({ top: 10 })
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryRefreshing, setSummaryRefreshing] = useState(false)
  const [summary, setSummary] = useState({
    total: 0,
    soldCount: 0,
    averageSale: 0,
    distinctSellers: 0,
    distinctBuyers: 0,
  })

  const summaryCards = useMemo(
    () => [
      { label: 'Total earnings', value: `$${summary.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
      { label: 'Sold auctions', value: summary.soldCount.toLocaleString('en-US') },
      { label: 'Average sale', value: `$${summary.averageSale.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
      { label: 'Unique sellers', value: summary.distinctSellers.toLocaleString('en-US') },
      { label: 'Unique buyers', value: summary.distinctBuyers.toLocaleString('en-US') },
    ],
    [summary]
  )

  const fetchSummary = (refresh = false, currentFilters = filters) => {
    if (refresh) setSummaryRefreshing(true)
    else setSummaryLoading(true)
    getTotalEarnings(toReportParams(currentFilters))
      .then((res) => {
        setSummary({
          total: res.data.total ?? 0,
          soldCount: res.data.soldCount ?? 0,
          averageSale: res.data.averageSale ?? 0,
          distinctSellers: res.data.distinctSellers ?? 0,
          distinctBuyers: res.data.distinctBuyers ?? 0,
        })
      })
      .catch(() => showErrorToast('Error', 'Failed to load report summary.'))
      .finally(() => {
        setSummaryLoading(false)
        setSummaryRefreshing(false)
      })
  }

  useEffect(() => {
    fetchSummary(false, filters)
  }, [filters])

  const onApplyFilters = () => {
    const normalizedTop = Number.isFinite(draftFilters.top) ? Math.min(100, Math.max(1, draftFilters.top)) : 10
    setDraftFilters((prev) => ({ ...prev, top: normalizedTop }))
    setFilters({
      from: draftFilters.from || undefined,
      to: draftFilters.to || undefined,
      top: normalizedTop,
    })
  }

  const onResetFilters = () => {
    const reset = { top: 10 } as ReportsFilters
    setDraftFilters(reset)
    setFilters(reset)
  }

  return (
    <Container maxW="container.xl" py={6} px={APP_PAGE_PX}>
      <Flex justify="space-between" align="center" mb={6}>
        <Text fontSize="2xl" fontWeight="bold" color="white">
          Reports
        </Text>
        <Button
          asChild
          size="sm"
          variant="outline"
          borderColor={dark.borderSubtle}
          color="white"
          _hover={{ bg: 'whiteAlpha.100' }}
        >
          <Link to="/admin">Back to Admin</Link>
        </Button>
      </Flex>

      <Box
        mb={5}
        p={4}
        borderWidth="1px"
        borderColor={dark.borderSubtle}
        borderRadius="md"
        bg={dark.cardBg}
      >
        <Flex gap={3} align={{ base: 'stretch', md: 'flex-end' }} direction={{ base: 'column', md: 'row' }}>
          <Box>
            <Text fontSize="xs" color={dark.label} mb={1}>
              From
            </Text>
            <Input
              aria-label="From"
              type="date"
              size="sm"
              value={draftFilters.from ?? ''}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, from: e.target.value || undefined }))}
              bg={dark.inputBg}
              borderColor={dark.borderSubtle}
              color="white"
            />
          </Box>
          <Box>
            <Text fontSize="xs" color={dark.label} mb={1}>
              To
            </Text>
            <Input
              aria-label="To"
              type="date"
              size="sm"
              value={draftFilters.to ?? ''}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, to: e.target.value || undefined }))}
              bg={dark.inputBg}
              borderColor={dark.borderSubtle}
              color="white"
            />
          </Box>
          <Box maxW="120px">
            <Text fontSize="xs" color={dark.label} mb={1}>
              Top N
            </Text>
            <Input
              aria-label="Top N"
              type="number"
              min={1}
              max={100}
              size="sm"
              value={draftFilters.top}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, top: Number.parseInt(e.target.value, 10) || 10 }))}
              bg={dark.inputBg}
              borderColor={dark.borderSubtle}
              color="white"
            />
          </Box>
          <Button size="sm" colorScheme="brand" onClick={onApplyFilters}>
            Apply
          </Button>
          <Button
            size="sm"
            variant="outline"
            borderColor={dark.borderSubtle}
            color="white"
            _hover={{ bg: 'whiteAlpha.100' }}
            onClick={onResetFilters}
          >
            Reset
          </Button>
          <Button size="sm" colorScheme="brand" onClick={() => fetchSummary(true)} loading={summaryRefreshing}>
            Refresh summary
          </Button>
        </Flex>
      </Box>

      {summaryLoading ? (
        <Flex justify="center" py={4}>
          <Spinner color="brand.400" />
        </Flex>
      ) : (
        <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)', xl: 'repeat(5, 1fr)' }} gap={3} mb={6}>
          {summaryCards.map((card) => (
            <Box
              key={card.label}
              p={3}
              borderWidth="1px"
              borderColor={dark.borderSubtle}
              borderRadius="md"
              bg={dark.cardBg}
            >
              <Text fontSize="xs" color={dark.muted} mb={1}>
                {card.label}
              </Text>
              <Text color="white" fontWeight="semibold">
                {card.value}
              </Text>
            </Box>
          ))}
        </Grid>
      )}

      <Tabs.Root value={activeTab} onValueChange={(d) => setActiveTab(d.value)} variant="line" colorPalette="brand">
        <Tabs.List borderColor={dark.borderSubtle} gap={2} color="white">
          <Tabs.Trigger value="total" color="white">Total Earnings</Tabs.Trigger>
          <Tabs.Trigger value="by-type" color="white">By Type</Tabs.Trigger>
          <Tabs.Trigger value="by-user" color="white">By User</Tabs.Trigger>
          <Tabs.Trigger value="by-item" color="white">By Item</Tabs.Trigger>
          <Tabs.Trigger value="best-selling" color="white">Best Selling</Tabs.Trigger>
          <Tabs.Trigger value="best-buyers" color="white">Best Buyers</Tabs.Trigger>
        </Tabs.List>
        <Box pt={4}>
          <Tabs.Content value="total">
            <TotalEarningsTab summary={summary} />
          </Tabs.Content>
          <Tabs.Content value="by-type">
            <EarningsByTypeTab filters={filters} />
          </Tabs.Content>
          <Tabs.Content value="by-user">
            <EarningsByUserTab filters={filters} />
          </Tabs.Content>
          <Tabs.Content value="by-item">
            <EarningsByItemTab filters={filters} />
          </Tabs.Content>
          <Tabs.Content value="best-selling">
            <BestSellingTab filters={filters} />
          </Tabs.Content>
          <Tabs.Content value="best-buyers">
            <BestBuyersTab filters={filters} />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Container>
  )
}

function TotalEarningsTab({ summary }: { summary: { total: number } }) {
  return (
    <Box>
      <Text fontSize="xl" color="white" fontWeight="semibold" mb={2}>
        Total earnings: ${summary.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </Text>
      <Text fontSize="sm" color={dark.muted}>Use the global filter bar above to change the date window and Top N.</Text>
    </Box>
  )
}

function EarningsByTypeTab({ filters }: { filters: ReportsFilters }) {
  const [items, setItems] = useState<EarningsByTypeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    getEarningsByType(toReportParams(filters))
      .then((res) => setItems(res.data))
      .catch(() => showErrorToast('Error', 'Failed to load earnings by type.'))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  useEffect(() => {
    fetchData()
  }, [filters.from, filters.to, filters.top])

  if (loading) {
    return (
      <Flex justify="center" py={8}>
        <Spinner color="brand.400" />
      </Flex>
    )
  }

  return (
    <Box>
      <Button size="sm" colorScheme="brand" mb={4} onClick={() => fetchData(true)} loading={refreshing}>
        Refresh
      </Button>
      <Box overflowX="auto">
        <table style={tableStyles}>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign: 'left' }}>Category</th>
              <th style={{ ...thBase, textAlign: 'right' }}>Earnings</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => {
              const isLast = i === items.length - 1
              const cellStyle = tdStyle(isLast)
              return (
                <tr key={row.categoryId}>
                  <td style={{ ...cellStyle, textAlign: 'left' }}>{row.categoryName}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 500 }}>
                    ${row.earnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Box>
      {items.length === 0 && (
        <Text color={dark.muted} py={4}>No data.</Text>
      )}
    </Box>
  )
}

function EarningsByUserTab({ filters }: { filters: ReportsFilters }) {
  const [items, setItems] = useState<EarningsByUserItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 25
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    getEarningsByUser(toReportParams(filters, { page, pageSize }))
      .then((res) => {
        setItems(res.data.items)
        setTotalCount(res.data.totalCount)
      })
      .catch(() => showErrorToast('Error', 'Failed to load earnings by user.'))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  useEffect(() => {
    setPage(1)
  }, [filters.from, filters.to, filters.top])

  useEffect(() => {
    fetchData()
  }, [filters.from, filters.to, filters.top, page])

  if (loading) {
    return (
      <Flex justify="center" py={8}>
        <Spinner color="brand.400" />
      </Flex>
    )
  }

  return (
    <Box>
      <Button size="sm" colorScheme="brand" mb={4} onClick={() => fetchData(true)} loading={refreshing}>
        Refresh
      </Button>
      <Box overflowX="auto">
        <table style={tableStyles}>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign: 'left' }}>User</th>
              <th style={{ ...thBase, textAlign: 'right' }}>As Seller</th>
              <th style={{ ...thBase, textAlign: 'right' }}>As Winner</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => {
              const isLast = i === items.length - 1
              const cellStyle = tdStyle(isLast)
              return (
                <tr key={row.userId}>
                  <td style={{ ...cellStyle, textAlign: 'left' }}>{row.username}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 500 }}>
                    ${row.totalAsSeller.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 500 }}>
                    ${row.totalAsWinner.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Box>
      {items.length === 0 && (
        <Text color={dark.muted} py={4}>No data.</Text>
      )}
      <Flex mt={4} gap={2}>
        <Button
          size="sm"
          variant="outline"
          borderColor={dark.borderSubtle}
          color="white"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
        >
          Prev
        </Button>
        <Button
          size="sm"
          variant="outline"
          borderColor={dark.borderSubtle}
          color="white"
          onClick={() => setPage((p) => p + 1)}
          disabled={loading || page * pageSize >= totalCount}
        >
          Next
        </Button>
        <Text color={dark.muted} fontSize="sm" alignSelf="center">
          Page {page} / {Math.max(1, Math.ceil(totalCount / pageSize))}
        </Text>
      </Flex>
    </Box>
  )
}

function EarningsByItemTab({ filters }: { filters: ReportsFilters }) {
  const [items, setItems] = useState<EarningsByItemItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 25
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    getEarningsByItem(toReportParams(filters, { page, pageSize }))
      .then((res) => {
        setItems(res.data.items)
        setTotalCount(res.data.totalCount)
      })
      .catch(() => showErrorToast('Error', 'Failed to load earnings by item.'))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  useEffect(() => {
    setPage(1)
  }, [filters.from, filters.to, filters.top])

  useEffect(() => {
    fetchData()
  }, [filters.from, filters.to, filters.top, page])

  if (loading) {
    return (
      <Flex justify="center" py={8}>
        <Spinner color="brand.400" />
      </Flex>
    )
  }

  return (
    <Box>
      <Button size="sm" colorScheme="brand" mb={4} onClick={() => fetchData(true)} loading={refreshing}>
        Refresh
      </Button>
      <Box overflowX="auto">
        <table style={tableStyles}>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign: 'left' }}>Title</th>
              <th style={{ ...thBase, textAlign: 'right' }}>Price</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => {
              const isLast = i === items.length - 1
              const cellStyle = tdStyle(isLast)
              return (
                <tr key={row.itemId}>
                  <td style={{ ...cellStyle, textAlign: 'left' }}>{row.title}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 500 }}>
                    ${row.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Box>
      {items.length === 0 && (
        <Text color={dark.muted} py={4}>No data.</Text>
      )}
      <Flex mt={4} gap={2}>
        <Button
          size="sm"
          variant="outline"
          borderColor={dark.borderSubtle}
          color="white"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
        >
          Prev
        </Button>
        <Button
          size="sm"
          variant="outline"
          borderColor={dark.borderSubtle}
          color="white"
          onClick={() => setPage((p) => p + 1)}
          disabled={loading || page * pageSize >= totalCount}
        >
          Next
        </Button>
        <Text color={dark.muted} fontSize="sm" alignSelf="center">
          Page {page} / {Math.max(1, Math.ceil(totalCount / pageSize))}
        </Text>
      </Flex>
    </Box>
  )
}

function BestSellingTab({ filters }: { filters: ReportsFilters }) {
  const [items, setItems] = useState<BestSellingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    getBestSelling(filters.top, toReportParams(filters))
      .then((res) => setItems(res.data))
      .catch(() => showErrorToast('Error', 'Failed to load best-selling items.'))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  useEffect(() => {
    fetchData()
  }, [filters.from, filters.to, filters.top])

  if (loading) {
    return (
      <Flex justify="center" py={8}>
        <Spinner color="brand.400" />
      </Flex>
    )
  }

  return (
    <Box>
      <Button size="sm" colorScheme="brand" mb={4} onClick={() => fetchData(true)} loading={refreshing}>
        Refresh
      </Button>
      <Box overflowX="auto">
        <table style={tableStyles}>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign: 'left' }}>Title</th>
              <th style={{ ...thBase, textAlign: 'right' }}>Price</th>
              <th style={{ ...thBase, textAlign: 'right' }}>Bid Count</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => {
              const isLast = i === items.length - 1
              const cellStyle = tdStyle(isLast)
              return (
                <tr key={row.itemId}>
                  <td style={{ ...cellStyle, textAlign: 'left' }}>{row.title}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 500 }}>
                    ${row.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'right', color: dark.muted }}>{row.bidCount}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Box>
      {items.length === 0 && (
        <Text color={dark.muted} py={4}>No data.</Text>
      )}
    </Box>
  )
}

function BestBuyersTab({ filters }: { filters: ReportsFilters }) {
  const [items, setItems] = useState<BestBuyer[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    getBestBuyers(filters.top, toReportParams(filters))
      .then((res) => setItems(res.data))
      .catch(() => showErrorToast('Error', 'Failed to load best buyers.'))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  useEffect(() => {
    fetchData()
  }, [filters.from, filters.to, filters.top])

  if (loading) {
    return (
      <Flex justify="center" py={8}>
        <Spinner color="brand.400" />
      </Flex>
    )
  }

  return (
    <Box>
      <Text color={dark.muted} fontSize="sm" mb={2}>
        Best buyers = top end-users on the buyer side.
      </Text>
      <Button size="sm" colorScheme="brand" mb={4} onClick={() => fetchData(true)} loading={refreshing}>
        Refresh
      </Button>
      <Box overflowX="auto">
        <table style={tableStyles}>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign: 'left' }}>Username</th>
              <th style={{ ...thBase, textAlign: 'right' }}>Total Spent</th>
              <th style={{ ...thBase, textAlign: 'right' }}>Wins</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => {
              const isLast = i === items.length - 1
              const cellStyle = tdStyle(isLast)
              return (
                <tr key={row.userId}>
                  <td style={{ ...cellStyle, textAlign: 'left' }}>{row.username}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 500 }}>
                    ${row.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'right', color: dark.muted }}>{row.winCount}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Box>
      {items.length === 0 && (
        <Text color={dark.muted} py={4}>No data.</Text>
      )}
    </Box>
  )
}
