import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  Input,
  NativeSelect,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { isAxiosError } from 'axios'
import { patchAdminAuction } from '../api/adminAuctions'
import type { AuctionDetail } from '../api/auctions'
import { showErrorToast, showSuccessToast } from './ui/toaster'
import { dark } from '../theme/colors'

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
  }, [open, auction])

  const onSaveFields = async () => {
    setSaving(true)
    try {
      if (!isActive) {
        const { data } = await patchAdminAuction(auction.id, {
          title: title.trim(),
          description: description.trim() === '' ? null : description.trim(),
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
                  This listing is not active; only title and description can be changed.
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
