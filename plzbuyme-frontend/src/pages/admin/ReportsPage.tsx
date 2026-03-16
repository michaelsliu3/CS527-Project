import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Container,
  Flex,
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
  type EarningsByTypeItem,
  type EarningsByUserItem,
  type EarningsByItemItem,
  type BestSellingItem,
  type BestBuyer,
} from '../../api/admin'
import { showErrorToast } from '../../components/ui/toaster'
import { dark } from '../../theme/colors'
import { tableStyles, thBase, tdStyle } from '../../theme/tableStyles'

export function ReportsPage() {
  return (
    <Container maxW="container.xl" py={6}>
      <Flex justify="space-between" align="center" mb={6}>
        <Text fontSize="2xl" fontWeight="bold" color="white">
          Reports
        </Text>
        <Button asChild size="sm" variant="outline" colorScheme="brand">
          <Link to="/admin">Back to Admin</Link>
        </Button>
      </Flex>
      <Tabs.Root defaultValue="total" variant="line" colorPalette="brand">
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
            <TotalEarningsTab />
          </Tabs.Content>
          <Tabs.Content value="by-type">
            <EarningsByTypeTab />
          </Tabs.Content>
          <Tabs.Content value="by-user">
            <EarningsByUserTab />
          </Tabs.Content>
          <Tabs.Content value="by-item">
            <EarningsByItemTab />
          </Tabs.Content>
          <Tabs.Content value="best-selling">
            <BestSellingTab />
          </Tabs.Content>
          <Tabs.Content value="best-buyers">
            <BestBuyersTab />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Container>
  )
}

function TotalEarningsTab() {
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    getTotalEarnings()
      .then((res) => setTotal(res.data.total))
      .catch(() => showErrorToast('Error', 'Failed to load total earnings.'))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <Flex justify="center" py={8}>
        <Spinner color="brand.400" />
      </Flex>
    )
  }

  return (
    <Box>
      <Flex align="center" gap={4} mb={4}>
        <Text fontSize="xl" color="white" fontWeight="semibold">
          Total earnings: ${total != null ? total.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
        </Text>
        <Button size="sm" colorScheme="brand" onClick={() => fetchData(true)} loading={refreshing}>
          Refresh
        </Button>
      </Flex>
    </Box>
  )
}

function EarningsByTypeTab() {
  const [items, setItems] = useState<EarningsByTypeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    getEarningsByType()
      .then((res) => setItems(res.data))
      .catch(() => showErrorToast('Error', 'Failed to load earnings by type.'))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  useEffect(() => {
    fetchData()
  }, [])

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

function EarningsByUserTab() {
  const [items, setItems] = useState<EarningsByUserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    getEarningsByUser()
      .then((res) => setItems(res.data))
      .catch(() => showErrorToast('Error', 'Failed to load earnings by user.'))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  useEffect(() => {
    fetchData()
  }, [])

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
    </Box>
  )
}

function EarningsByItemTab() {
  const [items, setItems] = useState<EarningsByItemItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    getEarningsByItem()
      .then((res) => setItems(res.data))
      .catch(() => showErrorToast('Error', 'Failed to load earnings by item.'))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  useEffect(() => {
    fetchData()
  }, [])

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
    </Box>
  )
}

function BestSellingTab() {
  const [items, setItems] = useState<BestSellingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    getBestSelling(10)
      .then((res) => setItems(res.data))
      .catch(() => showErrorToast('Error', 'Failed to load best-selling items.'))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  useEffect(() => {
    fetchData()
  }, [])

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

function BestBuyersTab() {
  const [items, setItems] = useState<BestBuyer[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    getBestBuyers(10)
      .then((res) => setItems(res.data))
      .catch(() => showErrorToast('Error', 'Failed to load best buyers.'))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  useEffect(() => {
    fetchData()
  }, [])

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
