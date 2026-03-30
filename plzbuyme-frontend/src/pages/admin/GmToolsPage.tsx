import { useState, type ReactNode } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Container,
  Flex,
  Input,
  Tabs,
  Text,
} from '@chakra-ui/react'
import { isAxiosError } from 'axios'
import { Link } from 'react-router-dom'
import {
  GM_CONFIRM_PHRASE,
  bulkGmUsers,
  gmWalletTopUp,
  seedGmAuctions,
  seedGmAuctionsFromManifest,
  seedGmQuestions,
  seedGmSampleAlerts,
  seedGmSampleNotifications,
  seedGmSoldHistoryFixture,
} from '../../api/gm'
import { showErrorToast, showSuccessToast } from '../../components/ui/toaster'
import { dark } from '../../theme/colors'
import { APP_PAGE_PX } from '../../theme/layout'

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

export function GmToolsPage() {
  const [busy, setBusy] = useState<string | null>(null)

  const [aCount, setACount] = useState('3')
  const [aCategoryId, setACategoryId] = useState('')
  const [aSellerId, setASellerId] = useState('')
  const [aCloseMin, setACloseMin] = useState('6')
  const [aCloseMax, setACloseMax] = useState('120')
  const [aBidMin, setABidMin] = useState('0')
  const [aBidMax, setABidMax] = useState('0')
  const [aConfirm, setAConfirm] = useState('')

  const [mCount, setMCount] = useState('30')
  const [mKeyword, setMKeyword] = useState('')
  const [mCategoryMode, setMCategoryMode] = useState('auto')
  const [mCloseMin, setMCloseMin] = useState('6')
  const [mCloseMax, setMCloseMax] = useState('120')
  const [mBidMin, setMBidMin] = useState('0')
  const [mBidMax, setMBidMax] = useState('0')
  const [mSellerId, setMSellerId] = useState('')
  const [mUseDetail, setMUseDetail] = useState(true)
  const [mConfirm, setMConfirm] = useState('')

  const [uPrefix, setUPrefix] = useState('gmuser')
  const [uCount, setUCount] = useState('3')
  const [uStart, setUStart] = useState('1')
  const [uPassword, setUPassword] = useState('')
  const [uWallet, setUWallet] = useState('')
  const [uConfirm, setUConfirm] = useState('')

  const [qCount, setQCount] = useState('5')
  const [qRep, setQRep] = useState(true)
  const [qConfirm, setQConfirm] = useState('')

  const [wIds, setWIds] = useState('2,3')
  const [wAmount, setWAmount] = useState('10000')
  const [wConfirm, setWConfirm] = useState('')

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
          confirmation: aConfirm.trim() || undefined,
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
          confirmation: mConfirm.trim() || undefined,
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
          confirmation: uConfirm.trim() || undefined,
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
          confirmation: qConfirm.trim() || undefined,
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
          confirmation: wConfirm.trim() || undefined,
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
    <Box>
      <Text mb={1} color={dark.label} fontSize="sm">
        {label}
      </Text>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        bg={dark.inputBg}
        borderColor={dark.borderSubtle}
        color="white"
        _placeholder={{ color: dark.placeholder }}
      />
    </Box>
  )

  const card = (children: ReactNode) => (
    <Box
      p={5}
      bg={dark.cardBg}
      borderRadius="md"
      borderWidth="1px"
      borderColor={dark.borderSubtle}
    >
      {children}
    </Box>
  )

  return (
    <Container maxW="container.lg" py={6} px={APP_PAGE_PX}>
      <Flex justify="space-between" align="flex-start" mb={4} gap={4} flexWrap="wrap">
        <Box>
          <Text fontSize="2xl" fontWeight="bold" color="white">
            GM tools
          </Text>
          <Text fontSize="sm" color={dark.label} mt={1} maxW="xl">
            Admin-only demo and QA utilities. High-volume actions require typing{' '}
            <Text as="span" fontFamily="mono">{GM_CONFIRM_PHRASE}</Text> where noted. GT7 manifest seeding matches{' '}
            <Text as="span" fontFamily="mono">scripts/create-auctions-temp.mjs</Text> (up to 100 cars per run); keep{' '}
            <Text as="span" fontFamily="mono">plzbuyme-cdn</Text> next to the repo or set <Text as="span" fontFamily="mono">Gt7CarManifest:Path</Text> on the API.
          </Text>
        </Box>
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

      <Tabs.Root defaultValue="auctions" variant="line" colorPalette="brand">
        <Tabs.List borderColor={dark.borderSubtle} gap={2} flexWrap="wrap" color="white">
          <Tabs.Trigger value="auctions" color="white">
            Random auctions
          </Tabs.Trigger>
          <Tabs.Trigger value="manifest" color="white">
            GT7 manifest
          </Tabs.Trigger>
          <Tabs.Trigger value="users" color="white">
            Users
          </Tabs.Trigger>
          <Tabs.Trigger value="qa" color="white">
            Q&amp;A
          </Tabs.Trigger>
          <Tabs.Trigger value="wallet" color="white">
            Wallet / fixtures
          </Tabs.Trigger>
          <Tabs.Trigger value="samples" color="white">
            Alerts / notifications
          </Tabs.Trigger>
        </Tabs.List>

        <Box pt={4}>
          <Tabs.Content value="auctions">
            {card(
              <>
                <Text fontWeight="semibold" color="white" mb={3}>
                  Seed auctions
                </Text>
                <Text fontSize="sm" color={dark.label} mb={3}>
                  Creates listings with realistic fields (aligned with seed categories). Optional synthetic bids use{' '}
                  <Text as="span" fontFamily="mono">PlaceBidAsync</Text> and large wallet credits for bidders. Max 50 per
                  request; confirmation required if count &gt; 20.
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
                  {field(`Confirmation (required if count &gt; 20): ${GM_CONFIRM_PHRASE}`, aConfirm, setAConfirm)}
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
            )}
          </Tabs.Content>

          <Tabs.Content value="manifest">
            {card(
              <>
                <Text fontWeight="semibold" color="white" mb={3}>
                  Seed from GT7 car manifest
                </Text>
                <Text fontSize="sm" color={dark.label} mb={3}>
                  Picks random cars from <Text as="span" fontFamily="mono">gt7-car-thumbnails.manifest.json</Text> with
                  the same category inference as the Node script. Sets listing images from manifest URLs. Up to 100 per
                  request; confirmation if count &gt; 40.
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
                  {field(`Confirmation (if count &gt; 40): ${GM_CONFIRM_PHRASE}`, mConfirm, setMConfirm)}
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
            )}
          </Tabs.Content>

          <Tabs.Content value="users">
            {card(
              <>
                <Text fontWeight="semibold" color="white" mb={3}>
                  Bulk end-users
                </Text>
                <Text fontSize="sm" color={dark.label} mb={3}>
                  Usernames <Text as="span" fontFamily="mono">{'{prefix}{index}'}</Text>, emails{' '}
                  <Text as="span" fontFamily="mono">{'{prefix}{index}@gm.plzbuy.test'}</Text>. Default password{' '}
                  <Text as="span" fontFamily="mono">GmDemo123!</Text> if left blank. Confirmation if count &gt; 25.
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
                  {field(`Confirmation (if count &gt; 25): ${GM_CONFIRM_PHRASE}`, uConfirm, setUConfirm)}
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
            )}
          </Tabs.Content>

          <Tabs.Content value="qa">
            {card(
              <>
                <Text fontWeight="semibold" color="white" mb={3}>
                  Seed Q&amp;A
                </Text>
                <Text fontSize="sm" color={dark.label} mb={3}>
                  Creates questions as existing end-users; optional rep/admin replies. Confirmation if count &gt; 15.
                </Text>
                <Flex direction="column" gap={3}>
                  {field('Count', qCount, setQCount)}
                  <Checkbox.Root checked={qRep} onCheckedChange={(d) => setQRep(!!d.checked)}>
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                    <Checkbox.Label color={dark.label}>Include rep replies (~50%)</Checkbox.Label>
                  </Checkbox.Root>
                  {field(`Confirmation (if count &gt; 15): ${GM_CONFIRM_PHRASE}`, qConfirm, setQConfirm)}
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
            )}
          </Tabs.Content>

          <Tabs.Content value="wallet">
            <Flex direction="column" gap={4}>
              {card(
                <>
                  <Text fontWeight="semibold" color="white" mb={3}>
                    Wallet top-up
                  </Text>
                  <Text fontSize="sm" color={dark.label} mb={3}>
                    Comma- or space-separated user IDs. Caps and confirmation apply for large batches or amounts.
                  </Text>
                  <Flex direction="column" gap={3}>
                    {field('User IDs', wIds, setWIds)}
                    {field('Amount each', wAmount, setWAmount)}
                    {field(`Confirmation (large batches): ${GM_CONFIRM_PHRASE}`, wConfirm, setWConfirm)}
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
                </>
              )}
              {card(
                <>
                  <Text fontWeight="semibold" color="white" mb={3}>
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
                </>
              )}
            </Flex>
          </Tabs.Content>

          <Tabs.Content value="samples">
            {card(
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
            )}
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Container>
  )
}
