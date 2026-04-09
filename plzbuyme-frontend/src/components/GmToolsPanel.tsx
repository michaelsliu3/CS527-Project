import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Button, Checkbox, Flex, Icon, Input, Menu, Tabs, Text } from '@chakra-ui/react'
import { isAxiosError } from 'axios'
import { apiClient } from '../api/client'
import { fetchCategories, type CategoryDto } from '../api/categories'
import {
  bulkGmUsers,
  gmBulkCloseActiveAuctions,
  gmCreateCategory,
  gmDeleteAllAuctions,
  gmDeleteCategory,
  gmRunCloseSweep,
  gmUpdateCategory,
  gmWalletTopUp,
  seedGmAuctionsFromManifest,
  seedGmQuestions,
  seedGmSampleAlerts,
  seedGmSampleNotifications,
  seedGmSoldHistoryFixture,
} from '../api/gm'
import {
  DEFAULT_CATEGORY_LUCIDE_ICON_KEY,
  GM_CATEGORY_LUCIDE_OPTIONS,
  GM_CUSTOM_LUCIDE_VALUE,
  isGmPresetLucideKey,
  normalizeLucideIconKeyForApi,
  resolveLucideIconForKey,
} from '../constants/categoryLucideIcons'
import {
  isAuctionLowDetailModeEnabled,
  notifyAuctionListRefresh,
  setAuctionLowDetailModeEnabled,
} from '../utils/auctionListRefresh'
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

function flattenCategoryDtos(roots: CategoryDto[]): CategoryDto[] {
  const out: CategoryDto[] = []
  const walk = (nodes: CategoryDto[]) => {
    for (const n of nodes) {
      out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(roots)
  return out.sort((a, b) => a.id - b.id)
}

function formatCategoriesLoadError(err: unknown): string {
  if (isAxiosError(err)) {
    const d = err.response?.data
    if (typeof d === 'string' && d.trim()) return d.trim().slice(0, 280)
    if (d && typeof d === 'object') {
      const title = (d as { title?: unknown }).title
      const detail = (d as { detail?: unknown }).detail
      if (typeof title === 'string' && title.trim()) return title.trim().slice(0, 280)
      if (typeof detail === 'string' && detail.trim()) return detail.trim().slice(0, 280)
    }
    const st = err.response?.status
    if (st === 401) return 'Not signed in or session expired. Log in again.'
    if (st)
      return `Could not load categories (HTTP ${st}). Check the API is running and database migrations are applied.`
  }
  if (err instanceof Error && err.message) return err.message.slice(0, 280)
  return 'Could not load categories.'
}

function lucideKeyForGmCreate(preset: string, custom: string): string | null {
  if (preset === GM_CUSTOM_LUCIDE_VALUE) {
    const t = custom.trim()
    return t.length > 0 ? normalizeLucideIconKeyForApi(custom) : null
  }
  return preset
}

function lucideKeyForGmUpdate(preset: string, custom: string): string {
  if (preset === '') return ''
  if (preset === GM_CUSTOM_LUCIDE_VALUE) return normalizeLucideIconKeyForApi(custom)
  return preset
}

function GmLucideIconPicker({
  preset,
  custom,
  onPresetChange,
  onCustomChange,
  showPlatformDefaultOption,
}: {
  preset: string
  custom: string
  onPresetChange: (v: string) => void
  onCustomChange: (v: string) => void
  showPlatformDefaultOption: boolean
}) {
  const effectiveDisplayKey = useMemo(() => {
    if (showPlatformDefaultOption && preset === '') return null
    if (preset === GM_CUSTOM_LUCIDE_VALUE) {
      const t = custom.trim()
      return t.length > 0 ? normalizeLucideIconKeyForApi(custom) : null
    }
    return preset
  }, [preset, custom, showPlatformDefaultOption])

  const triggerLabel = useMemo(() => {
    if (showPlatformDefaultOption && preset === '') return 'Platform default (car)'
    if (preset === GM_CUSTOM_LUCIDE_VALUE) {
      const t = custom.trim()
      if (!t) return 'Custom (type icon name)'
      return `Custom: ${normalizeLucideIconKeyForApi(custom)}`
    }
    return GM_CATEGORY_LUCIDE_OPTIONS.find((o) => o.key === preset)?.label ?? preset
  }, [preset, custom, showPlatformDefaultOption])

  const TriggerIcon = resolveLucideIconForKey(effectiveDisplayKey)

  const menuItemProps = {
    cursor: 'pointer' as const,
    bg: 'transparent',
    color: dark.label,
    _hover: { bg: 'whiteAlpha.100', color: 'white' },
    _focus: { bg: 'whiteAlpha.100', color: 'white' },
  }

  return (
    <Flex direction="column" gap={2}>
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button
            type="button"
            variant="outline"
            borderColor={dark.borderSubtle}
            bg={dark.inputBg}
            color={dark.label}
            justifyContent="flex-start"
            gap={3}
            fontWeight="normal"
            h="auto"
            py={2}
            _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
          >
            <Icon as={TriggerIcon} boxSize={5} flexShrink={0} color="brand.400" />
            <Text flex={1} textAlign="left" fontSize="sm" color="inherit">
              {triggerLabel}
            </Text>
          </Button>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content
            bg={dark.cardBg}
            borderColor={dark.borderSubtle}
            borderWidth="1px"
            borderRadius="md"
            minW="260px"
            maxH="320px"
            overflowY="auto"
            zIndex={2500}
            color={dark.label}
            css={{
              '& [data-highlighted]': {
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#fafafa',
              },
            }}
          >
            {showPlatformDefaultOption && (
              <Menu.Item
                value="platform-default"
                onClick={() => {
                  onPresetChange('')
                  onCustomChange('')
                }}
                {...menuItemProps}
              >
                <Flex align="center" gap={3} py={1}>
                  <Icon
                    as={resolveLucideIconForKey(DEFAULT_CATEGORY_LUCIDE_ICON_KEY)}
                    boxSize={5}
                    flexShrink={0}
                    color="brand.400"
                  />
                  <Text fontSize="sm" color="inherit">
                    Platform default (car)
                  </Text>
                </Flex>
              </Menu.Item>
            )}
            {GM_CATEGORY_LUCIDE_OPTIONS.map((o) => (
              <Menu.Item
                key={o.key}
                value={o.key}
                onClick={() => {
                  onPresetChange(o.key)
                  onCustomChange('')
                }}
                {...menuItemProps}
              >
                <Flex align="center" gap={3} py={1}>
                  <Icon as={resolveLucideIconForKey(o.key)} boxSize={5} flexShrink={0} color="brand.400" />
                  <Text fontSize="sm" color="inherit">
                    {o.label}
                  </Text>
                </Flex>
              </Menu.Item>
            ))}
            <Menu.Item
              value={GM_CUSTOM_LUCIDE_VALUE}
              onClick={() => onPresetChange(GM_CUSTOM_LUCIDE_VALUE)}
              {...menuItemProps}
            >
              <Flex align="center" gap={3} py={1}>
                <Icon as={resolveLucideIconForKey('Pencil')} boxSize={5} flexShrink={0} color="brand.400" />
                <Text fontSize="sm" color="inherit">
                  Custom…
                </Text>
              </Flex>
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
      {preset === GM_CUSTOM_LUCIDE_VALUE && (
        <Box>
          <Text mb={1} color={dark.muted} fontSize="xs">
            Lucide name without Lu prefix; matching is case-insensitive. Unknown names preview as the default car
            icon.
          </Text>
          <Input
            value={custom}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder="e.g. Bike, Plane, Wrench"
            size="sm"
            bg={dark.inputBg}
            borderColor={dark.borderSubtle}
            color="white"
            _placeholder={{ color: dark.placeholder }}
          />
        </Box>
      )}
    </Flex>
  )
}

export function GmToolsPanel() {
  const [busy, setBusy] = useState<string | null>(null)
  const [lowDetailModeEnabled, setLowDetailModeEnabled] = useState(() => isAuctionLowDetailModeEnabled())

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

  const [categoryTree, setCategoryTree] = useState<CategoryDto[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)

  const [cName, setCName] = useState('')
  const [cParentId, setCParentId] = useState('')
  const [cStringKey, setCStringKey] = useState('')
  const [cLucidePreset, setCLucidePreset] = useState(DEFAULT_CATEGORY_LUCIDE_ICON_KEY)
  const [cLucideCustom, setCLucideCustom] = useState('')

  const [uCatId, setUCatId] = useState('')
  const [uName, setUName] = useState('')
  const [uStringKey, setUStringKey] = useState('')
  const [uLucidePreset, setULucidePreset] = useState('')
  const [uLucideCustom, setULucideCustom] = useState('')

  const [dCatId, setDCatId] = useState('')

  const flatCategories = useMemo(() => flattenCategoryDtos(categoryTree), [categoryTree])

  const loadGmCategories = useCallback(async () => {
    setCategoriesLoading(true)
    try {
      const res = await fetchCategories()
      if (!Array.isArray(res.data)) {
        showErrorToast('GM tools', 'Categories response was not a list. Check API version.')
        return
      }
      setCategoryTree(res.data)
    } catch (err) {
      showErrorToast('GM tools', formatCategoriesLoadError(err))
    } finally {
      setCategoriesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadGmCategories()
  }, [loadGmCategories])

  const nativeSelectSx = {
    width: '100%',
    padding: '8px 12px',
    background: dark.inputBg,
    border: `1px solid ${dark.borderSubtle}`,
    borderRadius: '6px',
    color: 'white',
  } as const

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

  const onToggleLowDetailMode = (enabled: boolean) => {
    setLowDetailModeEnabled(enabled)
    setAuctionLowDetailModeEnabled(enabled)
    showSuccessToast(
      'Low-detail mode updated',
      enabled
        ? 'Low-detail mode is now enabled.'
        : 'Low-detail mode is now disabled.',
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

  const onDeleteAllAuctions = () =>
    run('deleteAll', async () => {
      if (
        !window.confirm(
          'Permanently DELETE every auction from the database?\n\n' +
            'All rows for listings, bids, auto-bids, bid holds, and auction-tied notifications will be removed. This cannot be undone.',
        )
      ) {
        return
      }
      try {
        const { data } = await gmDeleteAllAuctions()
        showSuccessToast(
          'Auctions removed',
          `Deleted ${data.itemsDeleted} listings, ${data.bidsDeleted} bids, ${data.autoBidsDeleted} auto-bids.`,
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

  const applySelectedCategoryToUpdateForm = (idStr: string) => {
    setUCatId(idStr)
    if (!idStr) {
      setUName('')
      setUStringKey('')
      setULucidePreset('')
      setULucideCustom('')
      return
    }
    const c = flatCategories.find((x) => x.id === Number(idStr))
    if (!c) return
    setUName(c.name)
    setUStringKey(c.stringKey ?? '')
    const iconKey = c.lucideIconKey ?? ''
    if (!iconKey.trim()) {
      setULucidePreset('')
      setULucideCustom('')
    } else {
      const canon = normalizeLucideIconKeyForApi(iconKey)
      if (isGmPresetLucideKey(canon)) {
        setULucidePreset(canon)
        setULucideCustom('')
      } else {
        setULucidePreset(GM_CUSTOM_LUCIDE_VALUE)
        setULucideCustom(canon)
      }
    }
  }

  const onCreateCategory = () =>
    run('catCreate', async () => {
      if (!cName.trim()) {
        showErrorToast('GM tools', 'Name is required.')
        return
      }
      try {
        await gmCreateCategory({
          name: cName.trim(),
          parentId: cParentId === '' ? null : Number.parseInt(cParentId, 10),
          stringKey: cStringKey.trim() || null,
          lucideIconKey: lucideKeyForGmCreate(cLucidePreset, cLucideCustom),
        })
        showSuccessToast('Category created', cName.trim())
        setCName('')
        setCParentId('')
        setCStringKey('')
        setCLucidePreset(DEFAULT_CATEGORY_LUCIDE_ICON_KEY)
        setCLucideCustom('')
        await loadGmCategories()
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

  const onUpdateCategorySave = () =>
    run('catUpdate', async () => {
      const id = Number.parseInt(uCatId, 10)
      if (!Number.isFinite(id)) {
        showErrorToast('GM tools', 'Select a category to update.')
        return
      }
      try {
        await gmUpdateCategory(id, {
          name: uName.trim(),
          stringKey: uStringKey.trim(),
          lucideIconKey: lucideKeyForGmUpdate(uLucidePreset, uLucideCustom),
        })
        showSuccessToast('Category updated', `#${id} ${uName.trim()}`)
        await loadGmCategories()
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

  const onDeleteCategoryRow = () =>
    run('catDelete', async () => {
      const id = Number.parseInt(dCatId, 10)
      if (!Number.isFinite(id)) {
        showErrorToast('GM tools', 'Select a category to delete.')
        return
      }
      const c = flatCategories.find((x) => x.id === id)
      if (
        !window.confirm(
          `Delete category #${id} (${c?.name ?? 'unknown'})? Only succeeds if it has no child categories, listings, field definitions, or alerts.`,
        )
      ) {
        return
      }
      try {
        await gmDeleteCategory(id)
        showSuccessToast('Category deleted', `#${id}`)
        setDCatId('')
        if (uCatId === String(id)) applySelectedCategoryToUpdateForm('')
        await loadGmCategories()
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
            <Tabs.Trigger value="categories" color="white" flexShrink={0}>
              Categories
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
                <Text fontSize="xs" color={dark.muted} mt={2} maxW="md">
                  To wipe listings entirely (including sold/closed), use delete below — that removes rows from the database,
                  not just status changes.
                </Text>
                <Button
                  data-testid="gm-delete-all-auctions"
                  mt={3}
                  variant="outline"
                  borderColor="red.500"
                  color="red.200"
                  _hover={{ bg: 'whiteAlpha.100', borderColor: 'red.400' }}
                  loading={busy === 'deleteAll'}
                  onClick={onDeleteAllAuctions}
                  alignSelf="flex-start"
                >
                  Delete all auctions from database
                </Button>
              </Flex>

              <Text fontWeight="semibold" color="white" mb={2} mt={8}>
                Quick utilities
              </Text>
              <Text fontSize="sm" color={dark.label} mb={2}>
                Handy while demoing or testing without leaving this panel.
              </Text>
              <Checkbox.Root
                data-testid="gm-toggle-low-detail-mode"
                checked={lowDetailModeEnabled}
                onCheckedChange={(d) => onToggleLowDetailMode(!!d.checked)}
                mb={2}
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control />
                <Checkbox.Label color={dark.label}>
                  Enable low-detail mode
                </Checkbox.Label>
              </Checkbox.Root>
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
                {field('Category mode', manifestCategoryMode, setManifestCategoryMode, 'auto or string key (sedans) or display name')}
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

          <Tabs.Content value="categories">
            <Flex direction="column" gap={6}>
              <Box>
                <Text fontWeight="semibold" color="white" mb={2}>
                  Category catalog
                </Text>
                <Text fontSize="sm" color={dark.label} mb={2}>
                  Uses the same tree as browse/search. Category changes push an in-app refresh to open browse views and
                  modals. String keys must be unique when set; use them for GT7 &quot;auto&quot; routing and search hub metadata.
                </Text>
                <Flex gap={2} mb={2} flexWrap="wrap" align="center">
                  <Button
                    size="sm"
                    variant="outline"
                    borderColor={dark.borderSubtle}
                    color="white"
                    loading={categoriesLoading}
                    onClick={() => void loadGmCategories()}
                  >
                    Reload list
                  </Button>
                  <Text fontSize="xs" color={dark.muted}>
                    {flatCategories.length} categories loaded
                  </Text>
                </Flex>
                <Box
                  maxH="140px"
                  overflowY="auto"
                  borderWidth="1px"
                  borderColor={dark.borderSubtle}
                  borderRadius="md"
                  p={2}
                  fontSize="xs"
                  fontFamily="mono"
                  color={dark.muted}
                >
                  {flatCategories.length === 0 ? (
                    <Text color={dark.muted}>No categories (or still loading).</Text>
                  ) : (
                    flatCategories.map((c) => (
                      <Text key={c.id} mb={0.5}>
                        #{c.id} {c.name}
                        {c.stringKey ? ` [${c.stringKey}]` : ''} icon=
                        {c.lucideIconKey ?? 'default'} parent={c.parentId ?? '—'}
                      </Text>
                    ))
                  )}
                </Box>
              </Box>

              <Box>
                <Text fontWeight="semibold" color="white" mb={2}>
                  Create category
                </Text>
                <Flex direction="column" gap={2} maxW="md">
                  {field('Name', cName, setCName, 'required')}
                  <Box>
                    <Text mb={1} color={dark.label} fontSize="xs">
                      Tab icon (Lucide)
                    </Text>
                    <GmLucideIconPicker
                      preset={cLucidePreset}
                      custom={cLucideCustom}
                      onPresetChange={setCLucidePreset}
                      onCustomChange={setCLucideCustom}
                      showPlatformDefaultOption={false}
                    />
                  </Box>
                  <Box>
                    <Text mb={1} color={dark.label} fontSize="xs">
                      Parent
                    </Text>
                    <select
                      style={nativeSelectSx}
                      value={cParentId}
                      onChange={(e) => setCParentId(e.target.value)}
                    >
                      <option value="">Root (no parent)</option>
                      {flatCategories.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          #{c.id} {c.name}
                        </option>
                      ))}
                    </select>
                  </Box>
                  {field('String key (optional, unique)', cStringKey, setCStringKey, 'e.g. boats')}
                  <Button
                    bg="brand.500"
                    color="white"
                    _hover={{ bg: 'brand.400' }}
                    loading={busy === 'catCreate'}
                    onClick={onCreateCategory}
                    alignSelf="flex-start"
                  >
                    Create
                  </Button>
                </Flex>
              </Box>

              <Box>
                <Text fontWeight="semibold" color="white" mb={2}>
                  Update category
                </Text>
                <Text fontSize="sm" color={dark.label} mb={2}>
                  Pick a row to load fields. Empty string key clears the key.
                </Text>
                <Flex direction="column" gap={2} maxW="md">
                  <Box>
                    <Text mb={1} color={dark.label} fontSize="xs">
                      Category
                    </Text>
                    <select
                      style={nativeSelectSx}
                      value={uCatId}
                      onChange={(e) => applySelectedCategoryToUpdateForm(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {flatCategories.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          #{c.id} {c.name}
                        </option>
                      ))}
                    </select>
                  </Box>
                  {field('Name', uName, setUName)}
                  {field('String key', uStringKey, setUStringKey, 'empty to clear')}
                  <Box>
                    <Text mb={1} color={dark.label} fontSize="xs">
                      Tab icon (Lucide)
                    </Text>
                    <GmLucideIconPicker
                      preset={uLucidePreset}
                      custom={uLucideCustom}
                      onPresetChange={setULucidePreset}
                      onCustomChange={setULucideCustom}
                      showPlatformDefaultOption
                    />
                  </Box>
                  <Button
                    variant="outline"
                    borderColor={dark.borderSubtle}
                    color="white"
                    _hover={{ bg: 'whiteAlpha.100' }}
                    loading={busy === 'catUpdate'}
                    onClick={onUpdateCategorySave}
                    alignSelf="flex-start"
                  >
                    Save changes
                  </Button>
                </Flex>
              </Box>

              <Box>
                <Text fontWeight="semibold" color="white" mb={2}>
                  Delete category
                </Text>
                <Text fontSize="sm" color={dark.label} mb={2}>
                  Safe only for unused categories (API enforces no children, listings, fields, or alerts).
                </Text>
                <Flex direction="column" gap={2} maxW="md">
                  <Box>
                    <Text mb={1} color={dark.label} fontSize="xs">
                      Category
                    </Text>
                    <select
                      style={nativeSelectSx}
                      value={dCatId}
                      onChange={(e) => setDCatId(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {flatCategories.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          #{c.id} {c.name}
                        </option>
                      ))}
                    </select>
                  </Box>
                  <Button
                    variant="outline"
                    borderColor="red.400"
                    color="red.200"
                    _hover={{ bg: 'whiteAlpha.100' }}
                    loading={busy === 'catDelete'}
                    onClick={onDeleteCategoryRow}
                    alignSelf="flex-start"
                  >
                    Delete
                  </Button>
                </Flex>
              </Box>
            </Flex>
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
