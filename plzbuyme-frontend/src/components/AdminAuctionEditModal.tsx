import { useEffect, useRef, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Input,
  NativeSelect,
  Popover,
  Portal,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { isAxiosError } from 'axios'
import { patchAdminAuction } from '../api/adminAuctions'
import type { AuctionDetail } from '../api/auctions'
import { fetchCategories, type CategoryDto } from '../api/categories'
import { showErrorToast, showSuccessToast } from './ui/toaster'
import { dark } from '../theme/colors'

function normalizeCategoryName(value?: string): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0
  return Math.abs(hash)
}

function getRandomCategoryGradient(normalizedCategoryName: string): string {
  const h = hashString(normalizedCategoryName)
  const hue1 = h % 360
  const hue2 = (hue1 + 50 + (h % 80)) % 360
  return `linear-gradient(92deg, hsl(${hue1} 88% 58%) 0%, hsl(${hue2} 90% 46%) 100%)`
}

function getCategoryGradient(categoryName?: string): string {
  const normalized = normalizeCategoryName(categoryName)

  if (normalized === 'sedan' || normalized === 'sedans') {
    return 'linear-gradient(92deg, #38bdf8 0%, #0284c7 100%)'
  }
  if (normalized === 'sportscar' || normalized === 'sportscars') {
    return 'linear-gradient(90deg, #ff003c 0%, #ff8a00 16%, #f9f871 32%, #00d084 48%, #00c2ff 64%, #4d65ff 80%, #b347ff 100%)'
  }
  if (normalized === 'suv' || normalized === 'suvs') {
    return 'linear-gradient(92deg, #34d399 0%, #059669 100%)'
  }
  if (normalized === 'truck' || normalized === 'trucks') {
    return 'linear-gradient(92deg, #f59e0b 0%, #f97316 50%, #ef4444 100%)'
  }
  if (normalized === 'electric' || normalized === 'ev' || normalized === 'evs') {
    return 'linear-gradient(92deg, #a78bfa 0%, #7c3aed 100%)'
  }

  if (!normalized) return 'linear-gradient(92deg, #94a3b8 0%, #475569 100%)'
  return getRandomCategoryGradient(normalized)
}

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function findParentRoot(roots: CategoryDto[], categoryId: number): CategoryDto | undefined {
  for (const r of roots) {
    if (r.id === categoryId) return r
    if (r.children?.some((c) => c.id === categoryId)) return r
  }
  return undefined
}

export interface AdminAuctionEditModalProps {
  auction: AuctionDetail
  open: boolean
  onClose: () => void
  onSaved: (detail: AuctionDetail) => void
}

export function AdminAuctionEditModal({ auction, open, onClose, onSaved }: AdminAuctionEditModalProps) {
  const [title, setTitle] = useState(auction.title)
  const [description, setDescription] = useState(auction.description ?? '')
  const [closeLocal, setCloseLocal] = useState(toLocalDatetimeValue(auction.closeDateTime))
  const [bidIncrement, setBidIncrement] = useState(String(auction.bidIncrement))
  const [reservePrice, setReservePrice] = useState(String(auction.reservePrice))
  const [initialPrice, setInitialPrice] = useState(String(auction.initialPrice))
  const [currentPrice, setCurrentPrice] = useState(String(auction.currentPrice))
  const [endMode, setEndMode] = useState('')
  const [saving, setSaving] = useState(false)
  const [ending, setEnding] = useState(false)

  const [categories, setCategories] = useState<CategoryDto[]>([])
  const [selectedRootId, setSelectedRootId] = useState<number | ''>('')
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<number[]>([])
  const [additionalOpen, setAdditionalOpen] = useState(false)
  const [rootCategoryHintActive, setRootCategoryHintActive] = useState(false)
  const rootCategoryHintTimeoutRef = useRef<number | null>(null)

  const hasBids = auction.bidHistory.length > 0
  const isActive = auction.status === 'active'

  useEffect(() => {
    if (!open) return
    setTitle(auction.title)
    setDescription(auction.description ?? '')
    setCloseLocal(toLocalDatetimeValue(auction.closeDateTime))
    setBidIncrement(String(auction.bidIncrement))
    setReservePrice(String(auction.reservePrice))
    setInitialPrice(String(auction.initialPrice))
    setCurrentPrice(String(auction.currentPrice))
    setEndMode('')
    setAdditionalOpen(false)

    fetchCategories()
      .then((res) => {
        const roots = res.data
        setCategories(roots)
        const parentRoot = findParentRoot(roots, auction.categoryId)
        if (parentRoot) {
          setSelectedRootId(parentRoot.id)
          const nextSelected = [auction.categoryId, ...(auction.additionalCategoryIds ?? [])]
          setSelectedSubcategoryIds(
            Array.from(new Set(nextSelected.filter((id) => id !== parentRoot.id))),
          )
        } else {
          setSelectedRootId(auction.categoryId)
          setSelectedSubcategoryIds(auction.additionalCategoryIds ?? [])
        }
      })
      .catch(() => {
        setCategories([])
        setSelectedSubcategoryIds([auction.categoryId, ...(auction.additionalCategoryIds ?? [])])
      })
  }, [open, auction])

  const selectedRoot = categories.find((c) => c.id === selectedRootId)
  const effectiveCategoryId = selectedSubcategoryIds[0] ?? selectedRootId

  const toggleSubcategory = (categoryId: number) => {
    setSelectedSubcategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
    )
  }

  const promptRootCategorySelection = () => {
    setRootCategoryHintActive(true)
    if (rootCategoryHintTimeoutRef.current != null) {
      window.clearTimeout(rootCategoryHintTimeoutRef.current)
    }
    rootCategoryHintTimeoutRef.current = window.setTimeout(() => {
      setRootCategoryHintActive(false)
      rootCategoryHintTimeoutRef.current = null
    }, 560)
  }

  useEffect(() => {
    return () => {
      if (rootCategoryHintTimeoutRef.current != null) {
        window.clearTimeout(rootCategoryHintTimeoutRef.current)
      }
    }
  }, [])

  const onSaveFields = async () => {
    setSaving(true)
    try {
      const catId =
        typeof effectiveCategoryId === 'number' && effectiveCategoryId !== auction.categoryId
          ? effectiveCategoryId
          : undefined
      const nextAdditionalCategoryIds = selectedSubcategoryIds
        .slice(1)
        .sort((a, b) => a - b)

      if (!isActive) {
        const { data } = await patchAdminAuction(auction.id, {
          title: title.trim(),
          description: description.trim() === '' ? null : description.trim(),
          categoryId: catId,
          additionalCategoryIds: nextAdditionalCategoryIds,
        })
        showSuccessToast('Auction updated')
        onSaved(data)
        onClose()
        return
      }

      const bi = Number.parseFloat(bidIncrement)
      const res = Number.parseFloat(reservePrice)
      const ini = Number.parseFloat(initialPrice)
      const cur = Number.parseFloat(currentPrice)
      if (!Number.isFinite(bi) || !Number.isFinite(res)) {
        showErrorToast('Admin edit', 'Invalid numbers.')
        return
      }
      if (!hasBids && (!Number.isFinite(ini) || !Number.isFinite(cur))) {
        showErrorToast('Admin edit', 'Invalid initial/current price.')
        return
      }

      const closeIso =
        closeLocal.trim() !== ''
          ? new Date(closeLocal).toISOString()
          : undefined
      const { data } = await patchAdminAuction(auction.id, {
        title: title.trim(),
        description: description.trim() === '' ? null : description.trim(),
        categoryId: catId,
        additionalCategoryIds: nextAdditionalCategoryIds,
        closeDateTime: closeIso,
        bidIncrement: bi,
        reservePrice: res,
        ...(hasBids
          ? {}
          : {
              initialPrice: ini,
              currentPrice: cur,
            }),
      })
      showSuccessToast('Auction updated')
      onSaved(data)
      onClose()
    } catch (err) {
      const msg =
        isAxiosError(err) && err.response?.data
          ? typeof err.response.data === 'string'
            ? err.response.data
            : 'Update failed.'
          : 'Update failed.'
      showErrorToast('Admin edit', msg)
    } finally {
      setSaving(false)
    }
  }

  const onEndAuction = async () => {
    if (!endMode) return
    setEnding(true)
    try {
      const { data } = await patchAdminAuction(auction.id, { endAuction: endMode })
      showSuccessToast('Auction ended', endMode)
      onSaved(data)
      onClose()
    } catch (err) {
      const msg =
        isAxiosError(err) && err.response?.data
          ? typeof err.response.data === 'string'
            ? err.response.data
            : 'End auction failed.'
          : 'End auction failed.'
      showErrorToast('End auction', msg)
    } finally {
      setEnding(false)
    }
  }

  const fieldLabel = (t: string) => (
    <Text fontSize="sm" color={dark.label} mb={1}>
      {t}
    </Text>
  )

  return (
    <Dialog.Root open={open} onOpenChange={({ open: o }) => !o && onClose()} size="lg">
      <Dialog.Backdrop bg="blackAlpha.700" zIndex={1600} />
      <Dialog.Positioner zIndex={1600}>
        <Dialog.Content bg={dark.cardBg} borderColor={dark.borderSubtle} borderWidth="1px" color="white">
          <Dialog.Header>
            <Dialog.Title>Admin: edit auction</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap={3}>
              <Text fontSize="sm" color={dark.muted}>
                Listing #{auction.id} · Changes are logged on the server. End-auction requests must be sent separately
                from field updates.
              </Text>
              {fieldLabel('Title')}
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                bg={dark.inputBg}
                borderColor={dark.borderSubtle}
                color="white"
              />
              {fieldLabel('Description')}
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                bg={dark.inputBg}
                borderColor={dark.borderSubtle}
                color="white"
              />
              {fieldLabel('Category')}
              <Flex gap={3}>
                <Box
                  flex="1"
                  style={{
                    transformOrigin: 'center center',
                    transform: rootCategoryHintActive ? 'scale(1.01)' : 'scale(1)',
                    boxShadow: rootCategoryHintActive
                      ? '0 0 0 1px rgba(66, 153, 225, 0.95), 0 0 0 6px rgba(66, 153, 225, 0.22), 0 0 20px rgba(66, 153, 225, 0.36)'
                      : 'none',
                    transition: 'transform 190ms ease, box-shadow 210ms ease',
                    borderRadius: '6px',
                  }}
                >
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={selectedRootId === '' ? '' : String(selectedRootId)}
                      onChange={(e) => {
                        const v = e.target.value
                        setSelectedRootId(v === '' ? '' : Number(v))
                        setSelectedSubcategoryIds([])
                        setAdditionalOpen(false)
                      }}
                      bg={dark.inputBg}
                      borderColor={dark.borderSubtle}
                      color="white"
                    >
                      <option value="">— select category —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Box>
                <Box flex="1">
                <Popover.Root
                  open={additionalOpen}
                  onOpenChange={(e) => {
                    if (e.open && !selectedRoot) {
                      promptRootCategorySelection()
                      setAdditionalOpen(false)
                      return
                    }
                    setAdditionalOpen(e.open)
                  }}
                >
                  <Popover.Trigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      w="full"
                      justifyContent="space-between"
                      variant="outline"
                      borderColor={dark.borderSubtle}
                      color="white"
                      _hover={{ bg: 'whiteAlpha.100' }}
                      disabled={!!selectedRoot && !selectedRoot.children?.length}
                      onFocus={() => {
                        if (!selectedRoot) promptRootCategorySelection()
                      }}
                    >
                      {selectedSubcategoryIds.length > 0
                        ? `${selectedSubcategoryIds.length} subcategories selected`
                        : 'Select subcategories'}
                    </Button>
                  </Popover.Trigger>
                  <Portal>
                    <Popover.Positioner zIndex={1700}>
                      <Popover.Content
                        bg={dark.cardBg}
                        borderWidth="1px"
                        borderColor={dark.borderSubtle}
                        color="white"
                        boxShadow="xl"
                        p={3}
                        w="320px"
                      >
                        <Flex gap={2} flexWrap="wrap">
                          {(selectedRoot?.children ?? []).map((c) => {
                            const selected = selectedSubcategoryIds.includes(c.id)
                            return (
                              <Button
                                key={c.id}
                                type="button"
                                size="sm"
                                variant="outline"
                                bg={selected ? 'whiteAlpha.300' : 'transparent'}
                                borderColor={dark.borderSubtle}
                                color="white"
                                fontWeight={selected ? 'semibold' : 'medium'}
                                _hover={{ bg: selected ? 'whiteAlpha.300' : 'whiteAlpha.100' }}
                                _active={{ bg: selected ? 'whiteAlpha.400' : 'whiteAlpha.200' }}
                                onClick={() => toggleSubcategory(c.id)}
                              >
                                {c.name}
                              </Button>
                            )
                          })}
                        </Flex>
                        <Flex justify="flex-end" mt={3} pt={3} borderTopWidth="1px" borderColor={dark.borderSubtle}>
                          <Button
                            type="button"
                            size="sm"
                            bg="brand.500"
                            color="white"
                            _hover={{ bg: 'brand.400' }}
                            _active={{ bg: 'brand.300' }}
                            onClick={() => setAdditionalOpen(false)}
                          >
                            Done
                          </Button>
                        </Flex>
                      </Popover.Content>
                    </Popover.Positioner>
                  </Portal>
                </Popover.Root>
                </Box>
              </Flex>
              <Box>
                <Flex gap={2} flexWrap="wrap" mb={2}>
                  {selectedSubcategoryIds.length === 0 ? (
                    <Badge variant="subtle" colorPalette="gray">
                      None selected
                    </Badge>
                  ) : (
                    (selectedRoot?.children ?? [])
                      .filter((c) => selectedSubcategoryIds.includes(c.id))
                      .map((c) => (
                        <Badge
                          key={`admin-selected-${c.id}`}
                          color="white"
                          bg={getCategoryGradient(c.name)}
                          textShadow="0 1px 1px rgba(0, 0, 0, 0.28)"
                        >
                          {c.name}
                        </Badge>
                      ))
                  )}
                </Flex>
              </Box>
              {isActive && (
                <>
                  {fieldLabel('Close time (local)')}
                  <Input
                    type="datetime-local"
                    value={closeLocal}
                    onChange={(e) => setCloseLocal(e.target.value)}
                    bg={dark.inputBg}
                    borderColor={dark.borderSubtle}
                    color="white"
                  />
                  {fieldLabel('Bid increment')}
                  <Input
                    type="number"
                    step="any"
                    value={bidIncrement}
                    onChange={(e) => setBidIncrement(e.target.value)}
                    bg={dark.inputBg}
                    borderColor={dark.borderSubtle}
                    color="white"
                  />
                  {fieldLabel('Reserve price')}
                  <Input
                    type="number"
                    step="any"
                    value={reservePrice}
                    onChange={(e) => setReservePrice(e.target.value)}
                    bg={dark.inputBg}
                    borderColor={dark.borderSubtle}
                    color="white"
                  />
                  {!hasBids && (
                    <>
                      {fieldLabel('Initial price')}
                      <Input
                        type="number"
                        step="any"
                        value={initialPrice}
                        onChange={(e) => setInitialPrice(e.target.value)}
                        bg={dark.inputBg}
                        borderColor={dark.borderSubtle}
                        color="white"
                      />
                      {fieldLabel('Current price')}
                      <Input
                        type="number"
                        step="any"
                        value={currentPrice}
                        onChange={(e) => setCurrentPrice(e.target.value)}
                        bg={dark.inputBg}
                        borderColor={dark.borderSubtle}
                        color="white"
                      />
                    </>
                  )}
                  {hasBids && (
                    <Text fontSize="sm" color={dark.muted}>
                      Initial/current price are locked while bids exist.
                    </Text>
                  )}
                </>
              )}
              {!isActive && (
                <Text fontSize="sm" color={dark.muted}>
                  This listing is not active; only title, description, and category can be changed.
                </Text>
              )}

              <Box borderTopWidth="1px" borderColor={dark.borderSubtle} pt={4} mt={2}>
                <Text fontWeight="semibold" mb={2} color="white">
                  End auction (active only)
                </Text>
                <Text fontSize="sm" color={dark.muted} mb={2}>
                  Natural: apply normal close rules (reserve). Closed: no sale, release holds. Sold: finalize with top
                  bid (must meet reserve).
                </Text>
                <NativeSelect.Root disabled={!isActive} mb={2}>
                  <NativeSelect.Field
                    value={endMode}
                    onChange={(e) => setEndMode(e.target.value)}
                    bg={dark.inputBg}
                    borderColor={dark.borderSubtle}
                    color="white"
                  >
                    <option value="">—</option>
                    <option value="natural">Natural (reserve rules)</option>
                    <option value="closed">Close without sale</option>
                    <option value="sold">Complete sale (top bid)</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <Button
                  size="sm"
                  variant="outline"
                  borderColor="red.400"
                  color="red.300"
                  disabled={!isActive || !endMode}
                  loading={ending}
                  onClick={onEndAuction}
                >
                  End with selected mode
                </Button>
              </Box>
            </Stack>
          </Dialog.Body>
          <Dialog.Footer gap={2}>
            <Dialog.ActionTrigger asChild>
              <Button variant="outline" borderColor={dark.borderSubtle} color="white">
                Cancel
              </Button>
            </Dialog.ActionTrigger>
            <Button bg="brand.500" color="white" loading={saving} onClick={onSaveFields}>
              Save changes
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
