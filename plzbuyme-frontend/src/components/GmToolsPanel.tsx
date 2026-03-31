import { useState } from 'react'
import { Box, Button, Checkbox, Flex, Input, Tabs, Text } from '@chakra-ui/react'
import { isAxiosError } from 'axios'
import {
  bulkGmUsers,
  gmWalletTopUp,
  seedGmAuctions,
  seedGmAuctionsFromManifest,
  seedGmQuestions,
  seedGmSampleAlerts,
  seedGmSampleNotifications,
  seedGmSoldHistoryFixture,
} from '../api/gm'
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

  const [aCount, setACount] = useState('3')
  const [aCategoryId, setACategoryId] = useState('')
  const [aSellerId, setASellerId] = useState('')
  const [aCloseMin, setACloseMin] = useState('6')
  const [aCloseMax, setACloseMax] = useState('120')
  const [aBidMin, setABidMin] = useState('0')
  const [aBidMax, setABidMax] = useState('0')

  const [mCount, setMCount] = useState('30')
  const [mKeyword, setMKeyword] = useState('')
  const [mCategoryMode, setMCategoryMode] = useState('auto')
  const [mCloseMin, setMCloseMin] = useState('6')
  const [mCloseMax, setMCloseMax] = useState('120')
  const [mBidMin, setMBidMin] = useState('0')
  const [mBidMax, setMBidMax] = useState('0')
  const [mSellerId, setMSellerId] = useState('')
  const [mUseDetail, setMUseDetail] = useState(true)

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
    run('auctions', async () => {
      try {
        const count = Number.parseInt(aCount, 10) || 0
        const { data } = await seedGmAuctions({
          count,
          categoryId: parseOptionalInt(aCategoryId),
          sellerUserId: parseOptionalInt(aSellerId),
          closeHoursMin: Number.parseInt(aCloseMin, 10) || undefined,
          closeHoursMax: Number.parseInt(aCloseMax, 10) || undefined,
          bidCountMin: Number.parseInt(aBidMin, 10) || 0,
          bidCountMax: Number.parseInt(aBidMax, 10) || 0,
        })
        showSuccessToast(
          'Auctions seeded',
          `Created ${data.createdCount}, bids placed: ${data.totalBidsPlaced}.`
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

  const onSeedManifest = () =>
    run('manifest', async () => {
      try {
        const count = Number.parseInt(mCount, 10) || 0
        const { data } = await seedGmAuctionsFromManifest({
          count,
          titleKeyword: mKeyword.trim() || undefined,
          categoryMode: mCategoryMode.trim() || 'auto',
          closeHoursMin: Number.parseInt(mCloseMin, 10) || undefined,
          closeHoursMax: Number.parseInt(mCloseMax, 10) || undefined,
          bidCountMin: Number.parseInt(mBidMin, 10) || 0,
          bidCountMax: Number.parseInt(mBidMax, 10) || 0,
          sellerUserId: parseOptionalInt(mSellerId),
          useDetailImage: mUseDetail,
        })
        showSuccessToast(
          'Manifest auctions seeded',
          `Created ${data.createdCount}, bids: ${data.totalBidsPlaced}.`
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

      <Tabs.Root defaultValue="auctions" variant="line" colorPalette="brand">
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
            <Tabs.Trigger value="auctions" color="white" flexShrink={0}>
              Random auctions
            </Tabs.Trigger>
            <Tabs.Trigger value="manifest" color="white" flexShrink={0}>
              GT7 manifest
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
          <Tabs.Content value="auctions">
            <>
                <Text fontWeight="semibold" color="white" mb={3}>
                  Seed auctions
                </Text>
                <Text fontSize="sm" color={dark.label} mb={3}>
                  Creates listings with realistic fields (aligned with seed categories). Optional synthetic bids use{' '}
                  <Text as="span" fontFamily="mono">PlaceBidAsync</Text> and large wallet credits for bidders. Max 50 per
                  request.
                </Text>
                <Flex direction="column" gap={3}>
                  {field('Count', aCount, setACount)}
                  {field('Category ID (optional)', aCategoryId, setACategoryId, 'e.g. Sedans leaf id')}
                  {field('Seller user ID (optional)', aSellerId, setASellerId)}
                  <Flex gap={3} flexWrap="wrap">
                    <Box flex="1" minW="120px">
                      {field('Close hours min', aCloseMin, setACloseMin)}
                    </Box>
                    <Box flex="1" minW="120px">
                      {field('Close hours max', aCloseMax, setACloseMax)}
                    </Box>
                  </Flex>
                  <Flex gap={3} flexWrap="wrap">
                    <Box flex="1" minW="120px">
                      {field('Bid count min', aBidMin, setABidMin, '0 = none')}
                    </Box>
                    <Box flex="1" minW="120px">
                      {field('Bid count max', aBidMax, setABidMax)}
                    </Box>
                  </Flex>
                  <Button
                    data-testid="gm-seed-auctions"
                    bg="brand.500"
                    color="white"
                    _hover={{ bg: 'brand.400' }}
                    loading={busy === 'auctions'}
                    onClick={onSeedAuctions}
                    alignSelf="flex-start"
                  >
                    Run
                  </Button>
                </Flex>
            </>
          </Tabs.Content>

          <Tabs.Content value="manifest">
            <>
                <Text fontWeight="semibold" color="white" mb={3}>
                  Seed from GT7 car manifest
                </Text>
                <Text fontSize="sm" color={dark.label} mb={3}>
                  Picks random cars from <Text as="span" fontFamily="mono">gt7-car-thumbnails.manifest.json</Text> with
                  the same category inference as the Node script. Sets listing images from manifest URLs. Up to 100 per
                  request.
                </Text>
                <Flex direction="column" gap={3}>
                  {field('Count (max 100)', mCount, setMCount)}
                  {field('Title keyword filter (optional)', mKeyword, setMKeyword)}
                  {field('Category mode', mCategoryMode, setMCategoryMode, 'auto or Sedans, SUVs, …')}
                  {field('Seller user ID (optional)', mSellerId, setMSellerId)}
                  <Flex gap={3} flexWrap="wrap">
                    <Box flex="1" minW="120px">
                      {field('Close hours min', mCloseMin, setMCloseMin)}
                    </Box>
                    <Box flex="1" minW="120px">
                      {field('Close hours max', mCloseMax, setMCloseMax)}
                    </Box>
                  </Flex>
                  <Flex gap={3} flexWrap="wrap">
                    <Box flex="1" minW="120px">
                      {field('Bid count min', mBidMin, setMBidMin)}
                    </Box>
                    <Box flex="1" minW="120px">
                      {field('Bid count max', mBidMax, setMBidMax)}
                    </Box>
                  </Flex>
                  <Checkbox.Root checked={mUseDetail} onCheckedChange={(d) => setMUseDetail(!!d.checked)}>
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label color={dark.label}>Use detail image URL when available</Checkbox.Label>
                  </Checkbox.Root>
                  <Button
                    data-testid="gm-seed-manifest"
                    bg="brand.500"
                    color="white"
                    _hover={{ bg: 'brand.400' }}
                    loading={busy === 'manifest'}
                    onClick={onSeedManifest}
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
