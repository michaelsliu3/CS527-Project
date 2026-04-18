import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react'
import {
  Box,
  Button,
  Container,
  Flex,
  Grid,
  GridItem,
  Text,
  Spinner,
} from '@chakra-ui/react'
import { LuGripVertical } from 'react-icons/lu'
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

const PANEL_IDS = ['usage', 'total', 'type', 'user', 'item', 'selling', 'buyers'] as const
type PanelId = (typeof PANEL_IDS)[number]

type AwsBarDatum = {
  label: string
  value: number
  valueText?: string
  secondaryValue?: number
  secondaryValueText?: string
}

function firstOfCurrentMonth(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function firstOfPreviousMonth(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
}

function lastOfPreviousMonth(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)
}

function daysInCurrentMonth(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
  const [filters] = useState<ReportsFilters>({ top: 10 })
  const [summaryLoading, setSummaryLoading] = useState(true)
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
  const [panelOrder, setPanelOrder] = useState<PanelId[]>([...PANEL_IDS])
  const [draggedPanelId, setDraggedPanelId] = useState<PanelId | null>(null)

  const fetchSummary = (currentFilters = filters) => {
    setSummaryLoading(true)
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
      })
  }

  useEffect(() => {
    fetchSummary(filters)
  }, [filters])

  const movePanel = (fromPanel: PanelId, toPanel: PanelId) => {
    if (fromPanel === toPanel) return
    setPanelOrder((prev) => {
      const fromIndex = prev.indexOf(fromPanel)
      const toIndex = prev.indexOf(toPanel)
      if (fromIndex < 0 || toIndex < 0) return prev
      const next = [...prev]
      next.splice(fromIndex, 1)
      next.splice(toIndex, 0, fromPanel)
      return next
    })
  }

  const onDragStart = (panelId: PanelId, event: DragEvent) => {
    setDraggedPanelId(panelId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', panelId)
  }

  const onDropPanel = (targetPanel: PanelId, event: DragEvent) => {
    event.preventDefault()
    const droppedPanel = event.dataTransfer.getData('text/plain')
    const sourcePanel = PANEL_IDS.includes(droppedPanel as PanelId)
      ? (droppedPanel as PanelId)
      : draggedPanelId
    if (!sourcePanel) return
    movePanel(sourcePanel, targetPanel)
    setDraggedPanelId(null)
  }

  const panelConfigs: Record<
    PanelId,
    {
      title: string
      subtitle: string
      colSpan: { base: number; xl: number }
      minH?: string
      content: ReactNode
    }
  > = {
    usage: {
      title: 'Earnings and Usage',
      subtitle: 'Current month revenue trend and category distribution.',
      colSpan: { base: 1, xl: 6 },
      minH: '180px',
      content: <EarningsUsagePanel />,
    },
    total: {
      title: 'Total Earnings',
      subtitle: 'Snapshot of all sold auctions for the selected date window.',
      colSpan: { base: 1, xl: 6 },
      minH: '180px',
      content: <TotalEarningsTab summary={summary} />,
    },
    type: {
      title: 'Earnings by Type',
      subtitle: 'Revenue distribution by category.',
      colSpan: { base: 1, xl: 6 },
      content: <EarningsByTypeTab filters={filters} />,
    },
    user: {
      title: 'Earnings by User',
      subtitle: 'Totals sold as seller and spent as buyer per user.',
      colSpan: { base: 1, xl: 6 },
      content: <EarningsByUserTab filters={filters} />,
    },
    item: {
      title: 'Earnings by Item',
      subtitle: 'Sold item performance and price ranking.',
      colSpan: { base: 1, xl: 6 },
      content: <EarningsByItemTab filters={filters} />,
    },
    selling: {
      title: 'Best Selling',
      subtitle: 'Top items by sale price and bid activity.',
      colSpan: { base: 1, xl: 6 },
      content: <BestSellingTab filters={filters} />,
    },
    buyers: {
      title: 'Best Buyers',
      subtitle: 'Highest-spend buyers and win volume.',
      colSpan: { base: 1, xl: 6 },
      content: <BestBuyersTab filters={filters} />,
    },
  }

  return (
    <Container maxW="container.xl" py={6} px={APP_PAGE_PX}>
      <Flex justify="space-between" align="center" mb={6}>
        <Text fontSize="2xl" fontWeight="bold" color="white">
          Reports
        </Text>
      </Flex>

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

      <Grid templateColumns={{ base: '1fr', xl: 'repeat(12, 1fr)' }} gap={4}>
        {panelOrder.map((panelId) => {
          const panel = panelConfigs[panelId]
          return (
            <GridItem
              key={panelId}
              colSpan={panel.colSpan}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDropPanel(panelId, event)}
            >
              <ReportPanel
                title={panel.title}
                subtitle={panel.subtitle}
                minH={panel.minH}
                isDragging={draggedPanelId === panelId}
                onHandleDragStart={(event) => onDragStart(panelId, event)}
                onHandleDragEnd={() => setDraggedPanelId(null)}
              >
                {panel.content}
              </ReportPanel>
            </GridItem>
          )
        })}
      </Grid>
    </Container>
  )
}

function ReportPanel({
  title,
  subtitle,
  minH,
  isDragging = false,
  onHandleDragStart,
  onHandleDragEnd,
  children,
}: {
  title: string
  subtitle?: string
  minH?: string | number
  isDragging?: boolean
  onHandleDragStart?: (event: DragEvent) => void
  onHandleDragEnd?: () => void
  children: ReactNode
}) {
  return (
    <Box
      borderWidth="1px"
      borderColor={dark.borderSubtle}
      borderRadius="md"
      bg={dark.cardBg}
      overflow="hidden"
      h="100%"
      minH={minH}
      opacity={isDragging ? 0.6 : 1}
      transition="opacity 120ms ease"
    >
      <Flex
        align="center"
        justify="space-between"
        px={4}
        py={3}
        borderBottomWidth="1px"
        borderColor={dark.borderSubtle}
      >
        <Flex align="center" gap={2}>
          <Box
            color={dark.muted}
            aria-label={`Drag ${title} widget`}
            draggable
            onDragStart={onHandleDragStart}
            onDragEnd={onHandleDragEnd}
            cursor="grab"
            title="Drag to reorder"
          >
            <LuGripVertical size={14} />
          </Box>
          <Text color="white" fontWeight="semibold">
            {title}
          </Text>
        </Flex>
      </Flex>
      {subtitle ? (
        <Box px={4} pt={3} pb={1}>
          <Text color={dark.muted} fontSize="xs">
            {subtitle}
          </Text>
        </Box>
      ) : null}
      <Box p={4}>
        {children}
      </Box>
    </Box>
  )
}

function TotalEarningsTab({ summary }: { summary: { total: number } }) {
  return (
    <Flex h="100%" align="center">
      <Box>
      <Text fontSize="xl" color="white" fontWeight="semibold" mb={2}>
        Total earnings: ${summary.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </Text>
      <Text fontSize="sm" color={dark.muted}>Use the global filter bar above to change the date window and Top N.</Text>
      </Box>
    </Flex>
  )
}

function AwsMetricBarChart({
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  data,
}: {
  title: string
  subtitle?: string
  primaryLabel: string
  secondaryLabel?: string
  data: AwsBarDatum[]
}) {
  const maxValue = useMemo(
    () =>
      Math.max(
        1,
        ...data.map((d) => (d.value || 0) + (d.secondaryValue || 0)),
      ),
    [data]
  )

  if (data.length === 0) return null

  return (
    <Box
      mb={4}
      p={4}
      borderWidth="1px"
      borderColor={dark.borderSubtle}
      borderRadius="md"
      bg={dark.cardBg}
    >
      <Flex justify="space-between" align="center" mb={3}>
        <Box>
          <Text color="white" fontWeight="semibold">
            {title}
          </Text>
          {subtitle ? (
            <Text color={dark.muted} fontSize="xs">
              {subtitle}
            </Text>
          ) : null}
        </Box>
        <Flex gap={3} fontSize="xs">
          <Text color="brand.300">{primaryLabel}</Text>
          {secondaryLabel ? <Text color="cyan.300">{secondaryLabel}</Text> : null}
        </Flex>
      </Flex>

      <Flex direction="column" gap={2}>
        {data.map((row) => {
          const total = (row.value || 0) + (row.secondaryValue || 0)
          const primaryPct = Math.max(0, Math.min(100, ((row.value || 0) / maxValue) * 100))
          const secondaryPct = Math.max(
            0,
            Math.min(100 - primaryPct, ((row.secondaryValue || 0) / maxValue) * 100),
          )
          return (
            <Flex key={row.label} align="center" gap={3}>
              <Text
                color={dark.label}
                fontSize="xs"
                minW={{ base: '90px', md: '130px' }}
                maxW={{ base: '90px', md: '160px' }}
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
                title={row.label}
              >
                {row.label}
              </Text>
              <Box
                flex={1}
                h="12px"
                borderRadius="sm"
                bg={dark.inputBg}
                borderWidth="1px"
                borderColor={dark.borderSubtle}
                overflow="hidden"
              >
                <Flex h="100%">
                  <Box
                    w={`${primaryPct}%`}
                    bg="linear-gradient(90deg, #2b6cb0 0%, #3182ce 100%)"
                  />
                  {secondaryLabel ? (
                    <Box
                      w={`${secondaryPct}%`}
                      bg="linear-gradient(90deg, #0d9488 0%, #06b6d4 100%)"
                    />
                  ) : null}
                </Flex>
              </Box>
              <Text
                color="white"
                fontSize="xs"
                minW={secondaryLabel ? '160px' : '100px'}
                textAlign="right"
              >
                {row.valueText ?? total.toLocaleString('en-US')}
                {secondaryLabel && row.secondaryValueText
                  ? ` · ${row.secondaryValueText}`
                  : null}
              </Text>
            </Flex>
          )
        })}
      </Flex>
    </Box>
  )
}

type EarningsUsageState = {
  loading: boolean
  currentMonth: number
  previousMonth: number
  byType: EarningsByTypeItem[]
}

function EarningsUsagePanel() {
  const [state, setState] = useState<EarningsUsageState>({
    loading: true,
    currentMonth: 0,
    previousMonth: 0,
    byType: [],
  })

  const fetchData = () => {
    setState((s) => ({ ...s, loading: true }))
    const from = firstOfCurrentMonth()
    const prevFrom = firstOfPreviousMonth()
    const prevTo = lastOfPreviousMonth()
    Promise.all([
      getTotalEarnings({ from }),
      getTotalEarnings({ from: prevFrom, to: prevTo }),
      getEarningsByType({ from }),
    ])
      .then(([current, previous, byType]) => {
        setState({
          loading: false,
          currentMonth: current.data.total ?? 0,
          previousMonth: previous.data.total ?? 0,
          byType: byType.data ?? [],
        })
      })
      .catch(() => {
        showErrorToast('Error', 'Failed to load earnings snapshot.')
        setState((s) => ({ ...s, loading: false }))
      })
  }

  useEffect(() => {
    fetchData()
  }, [])

  const forecast = useMemo(() => {
    const now = new Date()
    const day = now.getDate()
    if (day <= 0) return state.currentMonth
    const daysInMonth = daysInCurrentMonth()
    return (state.currentMonth / day) * daysInMonth
  }, [state.currentMonth])

  const trendPct = useMemo(() => {
    if (state.previousMonth <= 0) return null
    const delta = ((state.currentMonth - state.previousMonth) / state.previousMonth) * 100
    return delta
  }, [state.currentMonth, state.previousMonth])

  return (
    <Box h="100%" display="flex" flexDirection="column">
      {state.loading ? (
        <Flex justify="center" py={6} flex={1}>
          <Spinner color="brand.400" size="sm" />
        </Flex>
      ) : (
        <Flex direction="column" gap={3} flex={1} justify="center">
          <Grid templateColumns="repeat(3, minmax(0, 1fr))" gap={3}>
            <Box minW={0}>
              <Text fontSize="xs" color={dark.muted}>
                Current
              </Text>
              <Flex align="baseline" gap={2}>
                <Text color="brand.300" fontSize="lg" fontWeight="bold">
                  {formatMoney(state.currentMonth)}
                </Text>
                {trendPct !== null ? (
                  <Text fontSize="xs" color={trendPct >= 0 ? 'green.300' : 'red.300'}>
                    {trendPct >= 0 ? '▲' : '▼'} {Math.abs(trendPct).toFixed(0)}%
                  </Text>
                ) : null}
              </Flex>
            </Box>
            <Box minW={0}>
              <Text fontSize="xs" color={dark.muted}>
                Forecast
              </Text>
              <Text color="brand.300" fontSize="lg" fontWeight="bold">
                {formatMoney(forecast)}
              </Text>
            </Box>
            <Box minW={0}>
              <Text fontSize="xs" color={dark.muted}>
                Previous
              </Text>
              <Text color="white" fontSize="sm" fontWeight="semibold">
                {formatMoney(state.previousMonth)}
              </Text>
            </Box>
          </Grid>
        </Flex>
      )}
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
      <AwsMetricBarChart
        title="Earnings by category"
        subtitle="AWS-style quick visual distribution"
        primaryLabel="Earnings"
        data={items.slice(0, 8).map((row) => ({
          label: row.categoryName,
          value: row.earnings,
          valueText: `$${row.earnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        }))}
      />
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
  const pageSize = 5
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
      <AwsMetricBarChart
        title="Sold vs spent totals"
        subtitle="Stacked totals per user"
        primaryLabel="Sold total"
        secondaryLabel="Spent total"
        data={items.slice(0, 8).map((row) => ({
          label: row.username,
          value: row.totalAsSeller,
          valueText: `$${row.totalAsSeller.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          secondaryValue: row.totalAsWinner,
          secondaryValueText: `$${row.totalAsWinner.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        }))}
      />
      <Box overflowX="auto">
        <table style={tableStyles}>
          <thead>
            <tr>
              <th style={{ ...thBase, textAlign: 'left' }}>User</th>
              <th style={{ ...thBase, textAlign: 'right' }}>Sold (as seller)</th>
              <th style={{ ...thBase, textAlign: 'right' }}>Spent (as winner)</th>
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
  const pageSize = 5
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
      <AwsMetricBarChart
        title="Top earning items"
        subtitle="Current page distribution"
        primaryLabel="Sale price"
        data={items.slice(0, 8).map((row) => ({
          label: row.title,
          value: row.price,
          valueText: `$${row.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        }))}
      />
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
  const [page, setPage] = useState(1)
  const pageSize = 5
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

  useEffect(() => {
    setPage(1)
  }, [filters.from, filters.to, filters.top])

  const pagedItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page]
  )

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
      <AwsMetricBarChart
        title="Best-selling overview"
        subtitle="Price and bid intensity"
        primaryLabel="Price"
        secondaryLabel="Bid count"
        data={pagedItems.slice(0, 5).map((row) => ({
          label: row.title,
          value: row.price,
          valueText: `$${row.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          secondaryValue: row.bidCount,
          secondaryValueText: `${row.bidCount} bids`,
        }))}
      />
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
            {pagedItems.map((row, i) => {
              const isLast = i === pagedItems.length - 1
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
          disabled={loading || page * pageSize >= items.length}
        >
          Next
        </Button>
        <Text color={dark.muted} fontSize="sm" alignSelf="center">
          Page {page} / {Math.max(1, Math.ceil(items.length / pageSize))}
        </Text>
      </Flex>
    </Box>
  )
}

function BestBuyersTab({ filters }: { filters: ReportsFilters }) {
  const [items, setItems] = useState<BestBuyer[]>([])
  const [page, setPage] = useState(1)
  const pageSize = 5
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

  useEffect(() => {
    setPage(1)
  }, [filters.from, filters.to, filters.top])

  const pagedItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page]
  )

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
      <AwsMetricBarChart
        title="Buyer leaderboard"
        subtitle="Spend and wins"
        primaryLabel="Total spent"
        secondaryLabel="Wins"
        data={pagedItems.slice(0, 5).map((row) => ({
          label: row.username,
          value: row.totalSpent,
          valueText: `$${row.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          secondaryValue: row.winCount,
          secondaryValueText: `${row.winCount} wins`,
        }))}
      />
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
            {pagedItems.map((row, i) => {
              const isLast = i === pagedItems.length - 1
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
          disabled={loading || page * pageSize >= items.length}
        >
          Next
        </Button>
        <Text color={dark.muted} fontSize="sm" alignSelf="center">
          Page {page} / {Math.max(1, Math.ceil(items.length / pageSize))}
        </Text>
      </Flex>
    </Box>
  )
}
