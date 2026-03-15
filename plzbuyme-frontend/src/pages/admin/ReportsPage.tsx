import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Container,
  Flex,
  Table,
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
        <Tabs.List borderColor={dark.borderSubtle} gap={2}>
          <Tabs.Trigger value="total">Total Earnings</Tabs.Trigger>
          <Tabs.Trigger value="by-type">By Type</Tabs.Trigger>
          <Tabs.Trigger value="by-user">By User</Tabs.Trigger>
          <Tabs.Trigger value="by-item">By Item</Tabs.Trigger>
          <Tabs.Trigger value="best-selling">Best Selling</Tabs.Trigger>
          <Tabs.Trigger value="best-buyers">Best Buyers</Tabs.Trigger>
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
      <Table.Root size="sm">
        <Table.Header>
          <Table.Row borderColor={dark.borderSubtle}>
            <Table.ColumnHeader color={dark.muted}>Category</Table.ColumnHeader>
            <Table.ColumnHeader color={dark.muted}>Earnings</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {items.map((row) => (
            <Table.Row key={row.categoryId} borderColor={dark.borderSubtle}>
              <Table.Cell color="white">{row.categoryName}</Table.Cell>
              <Table.Cell color={dark.label}>
                ${row.earnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
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
      <Table.Root size="sm">
        <Table.Header>
          <Table.Row borderColor={dark.borderSubtle}>
            <Table.ColumnHeader color={dark.muted}>User</Table.ColumnHeader>
            <Table.ColumnHeader color={dark.muted}>As Seller</Table.ColumnHeader>
            <Table.ColumnHeader color={dark.muted}>As Winner</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {items.map((row) => (
            <Table.Row key={row.userId} borderColor={dark.borderSubtle}>
              <Table.Cell color="white">{row.username}</Table.Cell>
              <Table.Cell color={dark.label}>
                ${row.totalAsSeller.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Table.Cell>
              <Table.Cell color={dark.label}>
                ${row.totalAsWinner.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
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
      <Table.Root size="sm">
        <Table.Header>
          <Table.Row borderColor={dark.borderSubtle}>
            <Table.ColumnHeader color={dark.muted}>Title</Table.ColumnHeader>
            <Table.ColumnHeader color={dark.muted}>Price</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {items.map((row) => (
            <Table.Row key={row.itemId} borderColor={dark.borderSubtle}>
              <Table.Cell color="white">{row.title}</Table.Cell>
              <Table.Cell color={dark.label}>
                ${row.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
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
      <Table.Root size="sm">
        <Table.Header>
          <Table.Row borderColor={dark.borderSubtle}>
            <Table.ColumnHeader color={dark.muted}>Title</Table.ColumnHeader>
            <Table.ColumnHeader color={dark.muted}>Price</Table.ColumnHeader>
            <Table.ColumnHeader color={dark.muted}>Bid Count</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {items.map((row) => (
            <Table.Row key={row.itemId} borderColor={dark.borderSubtle}>
              <Table.Cell color="white">{row.title}</Table.Cell>
              <Table.Cell color={dark.label}>
                ${row.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Table.Cell>
              <Table.Cell color={dark.muted}>{row.bidCount}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
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
      <Table.Root size="sm">
        <Table.Header>
          <Table.Row borderColor={dark.borderSubtle}>
            <Table.ColumnHeader color={dark.muted}>Username</Table.ColumnHeader>
            <Table.ColumnHeader color={dark.muted}>Total Spent</Table.ColumnHeader>
            <Table.ColumnHeader color={dark.muted}>Wins</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {items.map((row) => (
            <Table.Row key={row.userId} borderColor={dark.borderSubtle}>
              <Table.Cell color="white">{row.username}</Table.Cell>
              <Table.Cell color={dark.label}>
                ${row.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Table.Cell>
              <Table.Cell color={dark.muted}>{row.winCount}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      {items.length === 0 && (
        <Text color={dark.muted} py={4}>No data.</Text>
      )}
    </Box>
  )
}
