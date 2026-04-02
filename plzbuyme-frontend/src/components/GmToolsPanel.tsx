import { useState } from 'react'
import { Box, Button, Checkbox, Flex, Input, Tabs, Text } from '@chakra-ui/react'
import { isAxiosError } from 'axios'
import { apiClient } from '../api/client'
import {
  bulkGmUsers,
  gmBulkCloseActiveAuctions,
  gmRunCloseSweep,
  gmWalletTopUp,
  seedGmAuctionsFromManifest,
  seedGmQuestions,
  seedGmSampleAlerts,
  seedGmSampleNotifications,
  seedGmSoldHistoryFixture,
} from '../api/gm'
import { notifyAuctionListRefresh } from '../utils/auctionListRefresh'
import { showErrorToast, showSuccessToast } from './ui/toaster'
import { dark } from '../theme/colors'

function parseOptionalInt(raw: string): number | undefined {
  const t = raw.trim()
  if (!t) return undefined
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) ? n : undefined
}

function parseUserIds(raw: string): number[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n))
}

export function GmToolsPanel() {
  const [busy, setBusy] = useState<string | null>(null)

  const [seedCount, setSeedCount] = useState('5')
  const [manifestKeyword, setManifestKeyword] = useState('')
  const [manifestCategoryMode, setManifestCategoryMode] = useState('auto')
  const [seedSellerId, setSeedSellerId] = useState('')
  const [seedCloseMin, setSeedCloseMin] = useState('6')
  const [seedCloseMax, setSeedCloseMax] = useState('120')
  const [seedBidMin, setSeedBidMin] = useState('0')
  const [seedBidMax, setSeedBidMax] = useState('0')

  const [uPrefix, setUPrefix] = useState('gmuser')
  const [uCount, setUCount] = useState('3')
  const [uStart, setUStart] = useState('1')
  const [uPassword, setUPassword] = useState('')
  const [uWallet, setUWallet] = useState('')

  const [qCount, setQCount] = useState('5')
  const [qRep, setQRep] = useState(true)

  const [wIds, setWIds] = useState('2,3')
  const [wAmount, setWAmount] = useState('10000')

  const [alUser, setAlUser] = useState('2')
  const [alCount, setAlCount] = useState('3')

  const [nUser, setNUser] = useState('2')
  const [nCount, setNCount] = useState('5')

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  const onSeedAuctions = () =>
    run('seed', async () => {
      try {
        const count = Number.parseInt(seedCount, 10) || 0
        const closeHoursMin = Number.parseInt(seedCloseMin, 10) || undefined
        const closeHoursMax = Number.parseInt(seedCloseMax, 10) || undefined
        const bidCountMin = Number.parseInt(seedBidMin, 10) || 0
        const bidCountMax = Number.parseInt(seedBidMax, 10) || 0
        const sellerUserId = parseOptionalInt(seedSellerId)

        const { data } = await seedGmAuctionsFromManifest({
          count,
          titleKeyword: manifestKeyword.trim() || undefined,
          categoryMode: manifestCategoryMode.trim() || 'auto',
          closeHoursMin,
          closeHoursMax,
          bidCountMin,
          bidCountMax,
          sellerUserId,
        })
        showSuccessToast(
          'Random listings added',
          `Created ${data.createdCount}, bids: ${data.totalBidsPlaced}.`,
        )
        notifyAuctionListRefresh()
      } catch (err) {
        if (isAxiosError(err) && err.response?.data) {
          const msg = typeof err.response.data === 'string' ? err.response.data : 'Request failed.'
          showErrorToast('GM tools', msg)
        } else {
          showErrorToast('GM tools', 'Request failed.')
        }
      }
    })

  const onBulkUsers = () =>
    run('users', async () => {
      try {
        const count = Number.parseInt(uCount, 10) || 0
        const startIndex = Number.parseInt(uStart, 10) || 1
        const walletBalanceEach =
          uWallet.trim() === '' ? undefined : Number.parseFloat(uWallet)
        const { data } = await bulkGmUsers({
          usernamePrefix: uPrefix.trim(),
          count,
          startIndex,
          password: uPassword.trim() || undefined,
          walletBalanceEach,
        })
        showSuccessToast('Users created', `${data.createdCount} accounts.`)
      } catch (err) {
        if (isAxiosError(err) && err.response?.data) {
          const msg = typeof err.response.data === 'string' ? err.response.data : 'Request failed.'
          showErrorToast('GM tools', msg)
        } else {
          showErrorToast('GM tools', 'Request failed.')
        }
      }
    })

  const onSeedQuestions = () =>
    run('questions', async () => {
      try {
        const count = Number.parseInt(qCount, 10) || 0
        const { data } = await seedGmQuestions({
          count,
          includeRepReplies: qRep,
        })
        showSuccessToast(
          'Questions seeded',
          `${data.createdCount} questions, ${data.repliesCreated} replies.`
        )
      } catch (err) {
        if (isAxiosError(err) && err.response?.data) {
          const msg = typeof err.response.data === 'string' ? err.response.data : 'Request failed.'
          showErrorToast('GM tools', msg)
        } else {
          showErrorToast('GM tools', 'Request failed.')
        }
      }
    })

  const onWalletTopUp = () =>
    run('wallet', async () => {
      try {
        const userIds = parseUserIds(wIds)
        const amountEach = Number.parseFloat(wAmount) || 0
        const { data } = await gmWalletTopUp({
          userIds,
          amountEach,
        })
        showSuccessToast('Wallet top-up', `${data.usersAffected} users credited.`)
      } catch (err) {
        if (isAxiosError(err) && err.response?.data) {
          const msg = typeof err.response.data === 'string' ? err.response.data : 'Request failed.'
          showErrorToast('GM tools', msg)
        } else {
          showErrorToast('GM tools', 'Request failed.')
        }
      }
    })

  const onSampleAlerts = () =>
    run('alerts', async () => {
      try {
        const userId = Number.parseInt(alUser, 10)
        const count = Number.parseInt(alCount, 10) || 3
        const { data } = await seedGmSampleAlerts({ userId, count })
        showSuccessToast('Sample alerts', `${data.alertsCreated} created.`)
      } catch (err) {
        if (isAxiosError(err) && err.response?.data) {
          const msg = typeof err.response.data === 'string' ? err.response.data : 'Request failed.'
          showErrorToast('GM tools', msg)
        } else {
          showErrorToast('GM tools', 'Request failed.')
        }
      }
    })

  const onSampleNotifications = () =>
    run('notifications', async () => {
      try {
        const userId = Number.parseInt(nUser, 10)
        const count = Number.parseInt(nCount, 10) || 5
        const { data } = await seedGmSampleNotifications({ userId, count })
        showSuccessToast('Sample notifications', `${data.notificationsCreated} created.`)
      } catch (err) {
        if (isAxiosError(err) && err.response?.data) {
          const msg = typeof err.response.data === 'string' ? err.response.data : 'Request failed.'
          showErrorToast('GM tools', msg)
        } else {
          showErrorToast('GM tools', 'Request failed.')
        }
      }
    })

  const onSoldFixture = () =>
    run('sold', async () => {
      try {
        const { data } = await seedGmSoldHistoryFixture()
        showSuccessToast('Sold history fixture', `Sold auction count: ${data.soldAuctionCount}.`)
      } catch (err) {
        if (isAxiosError(err) && err.response?.data) {
          const msg = typeof err.response.data === 'string' ? err.response.data : 'Request failed.'
          showErrorToast('GM tools', msg)
        } else {
          showErrorToast('GM tools', 'Request failed.')
        }
      }
    })

  const onRunCloseSweep = () =>
    run('sweep', async () => {
      try {
        await gmRunCloseSweep()
        showSuccessToast('Close sweep', 'Processed listings whose end time has passed.')
        notifyAuctionListRefresh()
      } catch (err) {
        if (isAxiosError(err) && err.response?.data) {
          const msg = typeof err.response.data === 'string' ? err.response.data : 'Request failed.'
          showErrorToast('GM tools', msg)
        } else {
          showErrorToast('GM tools', 'Request failed.')
        }
      }
    })

  const onEndAllNatural = () =>
    run('endNatural', async () => {
      if (
        !window.confirm(
          'End ALL active auctions using normal rules (reserve met → sold; otherwise closed)? This cannot be undone.',
        )
      ) {
        return
      }
      try {
        const { data } = await gmBulkCloseActiveAuctions({ mode: 'natural' })
        showSuccessToast(
          'Auctions ended',
          `Processed ${data.processedCount}: ${data.soldCount} sold, ${data.closedWithoutSaleCount} closed without sale.`,
        )
        notifyAuctionListRefresh()
      } catch (err) {
        if (isAxiosError(err) && err.response?.data) {
          const msg = typeof err.response.data === 'string' ? err.response.data : 'Request failed.'
          showErrorToast('GM tools', msg)
        } else {
          showErrorToast('GM tools', 'Request failed.')
        }
      }
    })

  const onRefreshBrowseListings = () => {
    notifyAuctionListRefresh()
    showSuccessToast(
      'Browse listings refresh',
      'Subscribers to the auction list will reload data (e.g. after a close sweep).',
    )
  }

  const onCopyApiBaseUrl = async () => {
    const url = String(apiClient.defaults.baseURL ?? '').trim() || '(not set)'
    try {
      await navigator.clipboard.writeText(url)
      showSuccessToast('API base URL copied', url)
    } catch {
      showErrorToast('GM tools', 'Could not copy to clipboard.')
    }
  }

  const onEndAllNoSale = () =>
    run('endClosed', async () => {
      if (
        !window.confirm(
          'End ALL active auctions WITHOUT selling (release bid holds, no winners)? Demo reset — cannot be undone.',
        )
      ) {
        return
      }
      try {
        const { data } = await gmBulkCloseActiveAuctions({ mode: 'closed' })
        showSuccessToast(
          'Auctions closed (no sale)',
          `Processed ${data.processedCount} listings.`,
        )
        notifyAuctionListRefresh()
      } catch (err) {
        if (isAxiosError(err) && err.response?.data) {
          const msg = typeof err.response.data === 'string' ? err.response.data : 'Request failed.'
          showErrorToast('GM tools', msg)
        } else {
          showErrorToast('GM tools', 'Request failed.')
        }
      }
    })

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder?: string
  ) => (
    <Box maxW="100%">
      <Text mb={1} color={dark.label} fontSize="xs">
        {label}
      </Text>
      <Input
        size="sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        bg={dark.inputBg}
        borderColor={dark.borderSubtle}
        color="white"
        w="100%"
        _placeholder={{ color: dark.placeholder }}
      />
    </Box>
  )

  return (
    <Box>
      <Text fontSize="sm" color={dark.label} mb={4}>
        Admin-only demo and QA utilities.
      </Text>

      <Tabs.Root defaultValue="general" variant="line" colorPalette="brand">
        <Box
          minW={0}
          overflowX="auto"
          overflowY="hidden"
          borderBottomWidth="1px"
          borderColor={dark.borderSubtle}
          css={{
            scrollbarWidth: 'thin',
            scrollbarColor: `${dark.borderSubtle} transparent`,
            WebkitOverflowScrolling: 'touch',
            '&::-webkit-scrollbar': { height: '6px' },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: dark.borderSubtle,
              borderRadius: '3px',
            },
          }}
        >
          <Tabs.List
            borderBottomWidth={0}
            borderColor="transparent"
            gap={2}
            flexWrap="nowrap"
            color="white"
            w="max-content"
            minW="min-content"
            pb={1}
          >
            <Tabs.Trigger value="general" color="white" flexShrink={0}>
              General
            </Tabs.Trigger>
            <Tabs.Trigger value="seed" color="white" flexShrink={0}>
              Seed auctions
            </Tabs.Trigger>
            <Tabs.Trigger value="users" color="white" flexShrink={0}>
              Users
            </Tabs.Trigger>
            <Tabs.Trigger value="qa" color="white" flexShrink={0}>
              Q&amp;A
            </Tabs.Trigger>
            <Tabs.Trigger value="wallet" color="white" flexShrink={0}>
              Wallet / fixtures
            </Tabs.Trigger>
            <Tabs.Trigger value="samples" color="white" flexShrink={0}>
              Alerts / notifications
            </Tabs.Trigger>
          </Tabs.List>
        </Box>

        <Box pt={4}>
          <Tabs.Content value="general">
            <>
              <Text fontWeight="semibold" color="white" mb={3}>
                Global auction actions
              </Text>
              <Text fontSize="sm" color={dark.label} mb={3}>
                For demos and QA. Prefer <Text as="span" fontFamily="mono">Run close sweep</Text> to match normal
                expiry behavior; use bulk end when you need every active listing to finish immediately. Max 500 active
                listings per bulk request.
              </Text>
              <Flex direction="column" gap={3} maxW="md">
                <Button
                  data-testid="gm-run-close-sweep"
                  variant="outline"
                  borderColor={dark.borderSubtle}
                  color="white"
                  _hover={{ bg: 'whiteAlpha.100' }}
                  loading={busy === 'sweep'}
                  onClick={onRunCloseSweep}
                  alignSelf="flex-start"
                >
                  Run close sweep now
                </Button>
                <Text fontSize="xs" color={dark.muted}>
                  Same logic as the background job: closes active items whose scheduled end time is already in the past.
                </Text>
                <Button
                  data-testid="gm-end-all-natural"
                  bg="orange.600"
                  color="white"
                  _hover={{ bg: 'orange.500' }}
                  loading={busy === 'endNatural'}
                  onClick={onEndAllNatural}
                  alignSelf="flex-start"
                >
                  End all active (natural / reserve rules)
                </Button>
                <Button
                  data-testid="gm-end-all-no-sale"
                  variant="outline"
                  borderColor="red.400"
                  color="red.300"
                  _hover={{ bg: 'whiteAlpha.100', borderColor: 'red.300' }}
                  loading={busy === 'endClosed'}
                  onClick={onEndAllNoSale}
                  alignSelf="flex-start"
                >
                  End all active (no sale)
                </Button>
              </Flex>

              <Text fontWeight="semibold" color="white" mb={2} mt={8}>
                Quick utilities
              </Text>
              <Text fontSize="sm" color={dark.label} mb={2}>
                Handy while demoing or testing without leaving this panel.
              </Text>
              <Text fontSize="xs" color={dark.muted} mb={3} fontFamily="mono">
                Vite mode: {import.meta.env.MODE}
              </Text>
              <Flex direction="row" gap={2} flexWrap="wrap" maxW="lg">
                <Button
                  data-testid="gm-refresh-browse"
                  size="sm"
                  variant="outline"
                  borderColor={dark.borderSubtle}
                  color="white"
                  _hover={{ bg: 'whiteAlpha.100' }}
                  onClick={onRefreshBrowseListings}
                >
                  Refresh browse listings
                </Button>
                <Button
                  data-testid="gm-copy-api-base"
                  size="sm"
                  variant="outline"
                  borderColor={dark.borderSubtle}
                  color="white"
                  _hover={{ bg: 'whiteAlpha.100' }}
                  onClick={() => void onCopyApiBaseUrl()}
                >
                  Copy API base URL
                </Button>
              </Flex>
              <Text fontSize="xs" color={dark.muted} mt={2} maxW="md">
                Refresh notifies in-app listeners only; use after close sweep or bulk end if the grid still looks stale.
              </Text>
            </>
          </Tabs.Content>

          <Tabs.Content value="seed">
            <>
              <Text fontWeight="semibold" color="white" mb={3}>
                Add random listings
              </Text>
              <Text fontSize="sm" color={dark.label} mb={3}>
                Same behavior as <Text as="span" fontFamily="mono">plzbuyme-backend/scripts/create-auctions-temp.mjs</Text>
                : shuffled picks from the car thumbnail manifest under <Text as="span" fontFamily="mono">plzbuyme-cdn</Text>,
                category from car metadata (or set category mode). Max 100 per run. Optional bids use{' '}
                <Text as="span" fontFamily="mono">PlaceBidAsync</Text> with large wallet credits.
              </Text>
              <Flex direction="column" gap={3}>
                {field('Count', seedCount, setSeedCount, 'max 100')}
                {field('Title keyword filter (optional)', manifestKeyword, setManifestKeyword)}
                {field('Category mode', manifestCategoryMode, setManifestCategoryMode, 'auto or Sedans, SUVs, …')}
                <Text fontSize="xs" color={dark.muted}>
                  Thumbnails are served from your media CDN (<Text as="span" fontFamily="mono">MediaStorage:ServiceBaseUrl</Text>
                  ), which mirrors car images on first request. Run <Text as="span" fontFamily="mono">plzbuyme-cdn</Text> beside
                  the API and keep the manifest path configured so resolution can match make/model/year.
                </Text>
                {field('Seller user ID (optional)', seedSellerId, setSeedSellerId)}
                <Flex gap={3} flexWrap="wrap">
                  <Box flex="1" minW="120px">
                    {field('Close hours min', seedCloseMin, setSeedCloseMin)}
                  </Box>
                  <Box flex="1" minW="120px">
                    {field('Close hours max', seedCloseMax, setSeedCloseMax)}
                  </Box>
                </Flex>
                <Flex gap={3} flexWrap="wrap">
                  <Box flex="1" minW="120px">
                    {field('Bid count min', seedBidMin, setSeedBidMin, '0 = none')}
                  </Box>
                  <Box flex="1" minW="120px">
                    {field('Bid count max', seedBidMax, setSeedBidMax)}
                  </Box>
                </Flex>
                <Button
                  data-testid="gm-seed-auctions"
                  bg="brand.500"
                  color="white"
                  _hover={{ bg: 'brand.400' }}
                  loading={busy === 'seed'}
                  onClick={onSeedAuctions}
                  alignSelf="flex-start"
                >
                  Run
                </Button>
              </Flex>
            </>
          </Tabs.Content>

          <Tabs.Content value="users">
            <>
                <Text fontWeight="semibold" color="white" mb={3}>
                  Bulk end-users
                </Text>
                <Text fontSize="sm" color={dark.label} mb={3}>
                  Usernames <Text as="span" fontFamily="mono">{'{prefix}{index}'}</Text>, emails{' '}
                  <Text as="span" fontFamily="mono">{'{prefix}{index}@gm.plzbuy.test'}</Text>. Default password{' '}
                  <Text as="span" fontFamily="mono">GmDemo123!</Text> if left blank.
                </Text>
                <Flex direction="column" gap={3}>
                  {field('Username prefix', uPrefix, setUPrefix)}
                  <Flex gap={3} flexWrap="wrap">
                    <Box flex="1" minW="120px">
                      {field('Count', uCount, setUCount)}
                    </Box>
                    <Box flex="1" minW="120px">
                      {field('Start index', uStart, setUStart)}
                    </Box>
                  </Flex>
                  {field('Password (optional)', uPassword, setUPassword, 'min 6 chars')}
                  {field('Wallet balance each (optional)', uWallet, setUWallet)}
                  <Button
                    bg="brand.500"
                    color="white"
                    _hover={{ bg: 'brand.400' }}
                    loading={busy === 'users'}
                    onClick={onBulkUsers}
                    alignSelf="flex-start"
                  >
                    Run
                  </Button>
                </Flex>
            </>
          </Tabs.Content>

          <Tabs.Content value="qa">
            <>
                <Text fontWeight="semibold" color="white" mb={3}>
                  Seed Q&amp;A
                </Text>
                <Text fontSize="sm" color={dark.label} mb={3}>
                  Creates questions as existing end-users; optional rep/admin replies.
                </Text>
                <Flex direction="column" gap={3}>
                  {field('Count', qCount, setQCount)}
                  <Checkbox.Root checked={qRep} onCheckedChange={(d) => setQRep(!!d.checked)}>
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label color={dark.label}>Include rep replies (~50%)</Checkbox.Label>
                  </Checkbox.Root>
                  <Button
                    bg="brand.500"
                    color="white"
                    _hover={{ bg: 'brand.400' }}
                    loading={busy === 'questions'}
                    onClick={onSeedQuestions}
                    alignSelf="flex-start"
                  >
                    Run
                  </Button>
                </Flex>
            </>
          </Tabs.Content>

          <Tabs.Content value="wallet">
            <Flex direction="column" gap={8}>
                  <Text fontWeight="semibold" color="white" mb={3}>
                    Wallet top-up
                  </Text>
                  <Text fontSize="sm" color={dark.label} mb={3}>
                    Comma- or space-separated user IDs. Up to 30 recipients per request; amount capped per API limits.
                  </Text>
                  <Flex direction="column" gap={3}>
                    {field('User IDs', wIds, setWIds)}
                    {field('Amount each', wAmount, setWAmount)}
                    <Button
                      bg="brand.500"
                      color="white"
                      _hover={{ bg: 'brand.400' }}
                      loading={busy === 'wallet'}
                      onClick={onWalletTopUp}
                      alignSelf="flex-start"
                    >
                      Run
                    </Button>
                  </Flex>
                  <Text fontWeight="semibold" color="white" mb={3} mt={2}>
                    Sold / closed history fixture
                  </Text>
                  <Text fontSize="sm" color={dark.label} mb={3}>
                    Idempotent: adds sold and some closed auctions for reports when below the internal threshold (see{' '}
                    <Text as="span" fontFamily="mono">SeedData.SeedSoldItemsForReports</Text>).
                  </Text>
                  <Button
                    bg="brand.500"
                    color="white"
                    _hover={{ bg: 'brand.400' }}
                    loading={busy === 'sold'}
                    onClick={onSoldFixture}
                    alignSelf="flex-start"
                  >
                    Run fixture
                  </Button>
            </Flex>
          </Tabs.Content>

          <Tabs.Content value="samples">
            <>
                <Text fontWeight="semibold" color="white" mb={3}>
                  Sample alerts &amp; notifications
                </Text>
                <Flex direction="column" gap={4}>
                  <Box>
                    <Text fontWeight="medium" color="white" mb={2}>
                      Keyword alerts
                    </Text>
                    <Flex direction="column" gap={2} maxW="md">
                      {field('User ID', alUser, setAlUser)}
                      {field('Count', alCount, setAlCount)}
                      <Button
                        size="sm"
                        variant="outline"
                        borderColor={dark.borderSubtle}
                        color="white"
                        loading={busy === 'alerts'}
                        onClick={onSampleAlerts}
                      >
                        Create sample alerts
                      </Button>
                    </Flex>
                  </Box>
                  <Box>
                    <Text fontWeight="medium" color="white" mb={2}>
                      In-app notifications
                    </Text>
                    <Flex direction="column" gap={2} maxW="md">
                      {field('User ID', nUser, setNUser)}
                      {field('Count', nCount, setNCount)}
                      <Button
                        size="sm"
                        variant="outline"
                        borderColor={dark.borderSubtle}
                        color="white"
                        loading={busy === 'notifications'}
                        onClick={onSampleNotifications}
                      >
                        Create sample notifications
                      </Button>
                    </Flex>
                  </Box>
                </Flex>
            </>
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Box>
  )
}
