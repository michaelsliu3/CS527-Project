import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Input,
  NativeSelect,
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
  const [selectedSubId, setSelectedSubId] = useState<number | ''>('')

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

    fetchCategories()
      .then((res) => {
        const roots = res.data
        setCategories(roots)
        const parentRoot = findParentRoot(roots, auction.categoryId)
        if (parentRoot) {
          setSelectedRootId(parentRoot.id)
          setSelectedSubId(parentRoot.id === auction.categoryId ? '' : auction.categoryId)
        } else {
          setSelectedRootId(auction.categoryId)
          setSelectedSubId('')
        }
      })
      .catch(() => {
        setCategories([])
      })
  }, [open, auction])

  const selectedRoot = categories.find((c) => c.id === selectedRootId)
  const effectiveCategoryId = selectedSubId || selectedRootId

  const onSaveFields = async () => {
    setSaving(true)
    try {
      const catId = effectiveCategoryId !== '' && effectiveCategoryId !== auction.categoryId
        ? (effectiveCategoryId as number)
        : undefined

      if (!isActive) {
        const { data } = await patchAdminAuction(auction.id, {
          title: title.trim(),
          description: description.trim() === '' ? null : description.trim(),
          categoryId: catId,
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
                <Box flex="1">
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={selectedRootId === '' ? '' : String(selectedRootId)}
                      onChange={(e) => {
                        const v = e.target.value
                        setSelectedRootId(v === '' ? '' : Number(v))
                        setSelectedSubId('')
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
                  <NativeSelect.Root disabled={!selectedRoot?.children?.length}>
                    <NativeSelect.Field
                      value={selectedSubId === '' ? '' : String(selectedSubId)}
                      onChange={(e) => {
                        const v = e.target.value
                        setSelectedSubId(v === '' ? '' : Number(v))
                      }}
                      bg={dark.inputBg}
                      borderColor={dark.borderSubtle}
                      color="white"
                    >
                      <option value="">— subcategory —</option>
                      {selectedRoot?.children?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Box>
              </Flex>
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
