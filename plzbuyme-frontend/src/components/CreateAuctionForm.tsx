import { useState, useEffect, useRef } from 'react'
import {
  Badge,
  Box,
  Button,
  DatePicker,
  Flex,
  Input,
  Popover,
  Portal,
  parseDate,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { LuCalendar, LuClock, LuImage, LuTimer } from 'react-icons/lu'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import { createAuction, type CreateAuctionDto } from '../api/auctions'
import { searchGmManifestCars, type GmManifestCarRow } from '../api/gm'
import { uploadFileToCdn } from '../api/cdn'
import {
  fetchCategories,
  fetchCategoryFields,
  type CategoryDto,
  type CategoryFieldDto,
} from '../api/categories'
import { dark } from '../theme/colors'
import { isAxiosError } from 'axios'

export interface CreateAuctionFormProps {
  onCancel: () => void
  onSuccess: (auctionId: number) => void
  quickCreateTrigger?: number
}

interface CreateFormValues {
  title: string
  description: string
  categoryId: string
  initialPrice: string
  bidIncrement: string
  reservePrice: string
  closeDateTime: string
  [key: `field_${number}`]: string
}

function normalizeFieldName(value: string): string {
  return value.trim().toLowerCase()
}

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

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatLocalTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function parseHHMM(s: string): { h: number; m: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(s)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return { h, m }
}

function formatTimeDisplay(hhmm: string): string {
  const parsed = parseHHMM(hhmm)
  if (!parsed) return hhmm
  const d = new Date()
  d.setHours(parsed.h, parsed.m, 0, 0)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 12-hour clock face order (12, 1, …, 11). */
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const

function to24From12Hour(hour12: number, isPm: boolean): number {
  if (hour12 === 12) return isPm ? 12 : 0
  return isPm ? hour12 + 12 : hour12
}

function from24To12Hour(h24: number): { hour12: number; isPm: boolean } {
  const isPm = h24 >= 12
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12
  return { hour12, isPm }
}

function isHourDisabled(
  closeDate: string,
  hour: number,
  minCloseDate: string,
  minCloseTime: string
): boolean {
  if (!closeDate || closeDate !== minCloseDate) return false
  const t = parseHHMM(minCloseTime)
  if (!t) return false
  return hour < t.h
}

function isMinuteDisabled(
  closeDate: string,
  hour: number,
  minute: number,
  minCloseDate: string,
  minCloseTime: string
): boolean {
  if (!closeDate || closeDate !== minCloseDate) return false
  const t = parseHHMM(minCloseTime)
  if (!t) return false
  return hour < t.h || (hour === t.h && minute < t.m)
}

function isHour12SlotDisabled(
  closeDate: string,
  hour12: number,
  minCloseDate: string,
  minCloseTime: string
): boolean {
  const hAm = to24From12Hour(hour12, false)
  const hPm = to24From12Hour(hour12, true)
  return (
    isHourDisabled(closeDate, hAm, minCloseDate, minCloseTime) &&
    isHourDisabled(closeDate, hPm, minCloseDate, minCloseTime)
  )
}

const MINUTES = Array.from({ length: 60 }, (_, i) => i)

const MS_PER_HOUR = 60 * 60 * 1000
const MS_PER_DAY = 24 * MS_PER_HOUR
const MS_PER_WEEK = 7 * MS_PER_DAY

type QuickDurationUnit = 'hours' | 'days' | 'weeks'
type ManifestImageSelection = { imageUrl?: string; imageStorageKey?: string } | null

const MAX_QUICK_AMOUNT = 30
const QUICK_AMOUNTS = Array.from({ length: MAX_QUICK_AMOUNT }, (_, i) => i + 1)
const MANIFEST_EXTERNAL_ID_REGEX = /^\d{3,8}$/

function normalizeManifestKeyword(value?: string | null): string {
  return (value ?? '').trim().toLowerCase()
}

function composeManifestSearchLabel(row: GmManifestCarRow): string {
  const title = (row.title ?? '').trim()
  if (title) return title
  const base = [row.make, row.model].filter(Boolean).join(' ').trim()
  const year = row.year ? String(row.year) : ''
  return [base, year].filter(Boolean).join(' ').trim() || 'Unknown manifest car'
}

function buildManifestTitle(row: GmManifestCarRow): string {
  const base = [row.make, row.model].filter(Boolean).join(' ').trim()
  const year = row.year ? String(row.year) : ''
  const fallback = (row.title ?? '').trim()
  const merged = [base, year].filter(Boolean).join(' ').trim()
  return merged || fallback
}

function buildManifestDescriptionTemplate(row: GmManifestCarRow): string {
  const title = composeManifestSearchLabel(row)
  return `Auto-filled from GT7 manifest: ${title}. Review and adjust specs, pricing, and auction timing before publishing.`
}

function buildManifestImageSelection(row: GmManifestCarRow): ManifestImageSelection {
  const externalId = (row.externalId ?? '').trim()
  if (MANIFEST_EXTERNAL_ID_REGEX.test(externalId)) {
    return { imageStorageKey: externalId }
  }
  const sourceUrl = (row.sourceUrl ?? '').trim()
  if (sourceUrl) {
    return { imageUrl: sourceUrl }
  }
  return null
}

function parseQuickDurationMs(amountStr: string, unit: QuickDurationUnit): number | null {
  const n = Number(String(amountStr).trim())
  if (!Number.isFinite(n) || n < 1 || n > MAX_QUICK_AMOUNT || n !== Math.floor(n)) return null
  const ms =
    unit === 'hours'
      ? n * MS_PER_HOUR
      : unit === 'days'
        ? n * MS_PER_DAY
        : n * MS_PER_WEEK
  if (!Number.isFinite(ms)) return null
  return ms
}

function formatQuickDurationTrigger(amountStr: string, unit: QuickDurationUnit): string {
  const n = Number(String(amountStr).trim())
  if (!Number.isFinite(n) || n < 1 || n > MAX_QUICK_AMOUNT || n !== Math.floor(n)) return ''
  const unitLabel =
    unit === 'hours'
      ? n === 1
        ? 'hour'
        : 'hours'
      : unit === 'days'
        ? n === 1
          ? 'day'
          : 'days'
        : n === 1
          ? 'week'
          : 'weeks'
  return `${n} ${unitLabel}`
}

function quickAmountColumnTitle(unit: QuickDurationUnit): string {
  if (unit === 'hours') return 'Hours'
  if (unit === 'days') return 'Days'
  return 'Weeks'
}

function quickUnitAriaWord(unit: QuickDurationUnit): string {
  if (unit === 'hours') return 'hours'
  if (unit === 'days') return 'days'
  return 'weeks'
}

interface AuctionDurationPickerProps {
  amount: string
  unit: QuickDurationUnit
  onChange: (amount: string, unit: QuickDurationUnit) => void
}

function AuctionDurationPicker({ amount, unit, onChange }: AuctionDurationPickerProps) {
  const [open, setOpen] = useState(false)

  const durationCellSx = {
    minW: '2.5rem',
    h: '2.25rem',
    borderRadius: 'md',
    fontSize: 'sm',
    fontVariantNumeric: 'tabular-nums' as const,
  }

  const amounts = QUICK_AMOUNTS
  const parsedN = Number(String(amount).trim())
  const currentAmount =
    Number.isFinite(parsedN) && parsedN >= 1 && parsedN <= MAX_QUICK_AMOUNT && parsedN === Math.floor(parsedN)
      ? parsedN
      : null

  const handleUnitSelect = (nextUnit: QuickDurationUnit) => {
    const cur = Number(String(amount).trim())
    const base = Number.isFinite(cur) && cur > 0 ? Math.floor(cur) : 1
    const clamped = Math.min(MAX_QUICK_AMOUNT, Math.max(1, base))
    onChange(String(clamped), nextUnit)
  }

  const handleAmountSelect = (a: number) => {
    onChange(String(a), unit)
    setOpen(false)
  }

  const label = formatQuickDurationTrigger(amount, unit)

  return (
    <Popover.Root
      lazyMount
      unmountOnExit
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
      positioning={{ placement: 'bottom-start' }}
    >
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Choose auction length"
          display="flex"
          w="full"
          h="auto"
          minH="10"
          alignItems="stretch"
          justifyContent="flex-start"
          gap={0}
          px={0}
          py={0}
          borderRadius="md"
          borderWidth="1px"
          borderColor={dark.borderSubtle}
          bg={dark.inputBg}
          color="inherit"
          overflow="hidden"
          textAlign="left"
          fontWeight="normal"
          colorPalette="brand"
          _hover={{ bg: dark.inputBg }}
          _active={{ bg: dark.inputBg }}
          _focusVisible={{
            borderColor: 'brand.500',
            boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)',
          }}
        >
          <Text
            flex="1"
            px={3}
            py={2}
            fontSize="sm"
            lineHeight="1.25rem"
            color={label ? 'white' : dark.placeholder}
            minW={0}
            truncate
          >
            {label || 'Select length'}
          </Text>
          <Flex
            align="center"
            justify="center"
            w="10"
            flexShrink={0}
            borderLeftWidth="1px"
            borderColor={dark.borderSubtle}
            color={dark.muted}
            _hover={{ color: 'white', bg: 'whiteAlpha.100' }}
          >
            <LuTimer size={18} />
          </Flex>
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner zIndex={2800}>
          <Popover.Content
            bg={dark.cardBg}
            borderWidth="1px"
            borderColor={dark.borderSubtle}
            color="white"
            boxShadow="xl"
            p={3}
            w="min-content"
          >
            <Text fontSize="xs" fontWeight="semibold" color={dark.muted} mb={2} letterSpacing="0.06em">
              Auction length
            </Text>
            <Flex gap={3} maxH="240px">
              <Box minW="0">
                <Text fontSize="xs" color={dark.muted} mb={1.5}>
                  {quickAmountColumnTitle(unit)}
                </Text>
                <Box maxH="200px" overflowY="auto" pr={1} css={{ scrollbarGutter: 'stable' }}>
                  <Flex direction="column" gap={1}>
                    {amounts.map((a) => {
                      const selected = currentAmount === a
                      return (
                        <Button
                          key={a}
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`${a} ${quickUnitAriaWord(unit)}`}
                          onClick={() => handleAmountSelect(a)}
                          justifyContent="center"
                          {...durationCellSx}
                          bg={selected ? 'brand.500' : 'transparent'}
                          color="white"
                          _hover={{
                            bg: selected ? 'brand.400' : 'rgba(255, 255, 255, 0.08)',
                          }}
                        >
                          {a}
                        </Button>
                      )
                    })}
                  </Flex>
                </Box>
              </Box>
              <Box minW="0">
                <Text fontSize="xs" color={dark.muted} mb={1.5}>
                  Unit
                </Text>
                <Flex direction="column" gap={1}>
                  {(
                    [
                      { label: 'Hours', value: 'hours' as const },
                      { label: 'Days', value: 'days' as const },
                      { label: 'Weeks', value: 'weeks' as const },
                    ] as const
                  ).map(({ label: unitLabel, value: unitValue }) => {
                    const selected = unit === unitValue
                    return (
                      <Button
                        key={unitValue}
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Length in ${unitLabel.toLowerCase()}`}
                        onClick={() => handleUnitSelect(unitValue)}
                        justifyContent="center"
                        {...durationCellSx}
                        minW="4.5rem"
                        bg={selected ? 'brand.500' : 'transparent'}
                        color="white"
                        _hover={{
                          bg: selected ? 'brand.400' : 'rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        {unitLabel}
                      </Button>
                    )
                  })}
                </Flex>
              </Box>
            </Flex>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}

type TimePick = {
  hour12: number | null
  isPm: boolean | null
  minute: number | null
}

function emptyTimePick(): TimePick {
  return { hour12: null, isPm: null, minute: null }
}

function timePickFromValue(value: string): TimePick {
  const p = parseHHMM(value)
  if (!p) return emptyTimePick()
  const { hour12, isPm } = from24To12Hour(p.h)
  return { hour12, isPm, minute: p.m }
}

/** Defaults for unset fields: 12 o’clock, AM, :00 — works for partial picks in any order. */
function resolvePickDefaults(p: TimePick): { hour12: number; isPm: boolean; minute: number } {
  return {
    hour12: p.hour12 ?? 12,
    isPm: p.isPm ?? false,
    minute: p.minute ?? 0,
  }
}

function clampToMinimumClose(
  closeDate: string,
  minCloseDate: string,
  minCloseTime: string,
  hour12: number,
  isPm: boolean,
  minute: number
): { hour12: number; isPm: boolean; minute: number } {
  if (closeDate !== minCloseDate) return { hour12, isPm, minute }
  const t = parseHHMM(minCloseTime)
  if (!t) return { hour12, isPm, minute }
  const h24 = to24From12Hour(hour12, isPm)
  if (h24 < t.h || (h24 === t.h && minute < t.m)) {
    const { hour12: h12, isPm: pm } = from24To12Hour(t.h)
    return { hour12: h12, isPm: pm, minute: t.m }
  }
  return { hour12, isPm, minute }
}

interface AuctionEndTimePickerProps {
  closeDate: string
  value: string
  onChange: (next: string) => void
  minCloseDate: string
  minCloseTime: string
  /** Outline color for the trigger (e.g. validation error). */
  triggerBorderColor?: string
}

function AuctionEndTimePicker({
  closeDate,
  value,
  onChange,
  minCloseDate,
  minCloseTime,
  triggerBorderColor = dark.borderSubtle,
}: AuctionEndTimePickerProps) {
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState<TimePick>(() => timePickFromValue(value))

  useEffect(() => {
    setPick(timePickFromValue(value))
  }, [value])

  const emitTime = (hour12: number, isPm: boolean, minute: number) => {
    const clamped = clampToMinimumClose(closeDate, minCloseDate, minCloseTime, hour12, isPm, minute)
    const h24 = to24From12Hour(clamped.hour12, clamped.isPm)
    setPick({
      hour12: clamped.hour12,
      isPm: clamped.isPm,
      minute: clamped.minute,
    })
    onChange(`${pad2(h24)}:${pad2(clamped.minute)}`)
  }

  const handleHour12Select = (hour12: number) => {
    if (isHour12SlotDisabled(closeDate, hour12, minCloseDate, minCloseTime)) return

    const hAm = to24From12Hour(hour12, false)
    const hPm = to24From12Hour(hour12, true)
    const amOk = !isHourDisabled(closeDate, hAm, minCloseDate, minCloseTime)
    const pmOk = !isHourDisabled(closeDate, hPm, minCloseDate, minCloseTime)

    let h24: number
    if (amOk && pmOk) {
      if (pick.isPm === true) h24 = hPm
      else if (pick.isPm === false) h24 = hAm
      else {
        const p = parseHHMM(value)
        const preferPm = p != null && p.h >= 12
        h24 = preferPm ? hPm : hAm
      }
    } else if (pmOk) {
      h24 = hPm
    } else if (amOk) {
      h24 = hAm
    } else {
      return
    }

    const { hour12: h12, isPm } = from24To12Hour(h24)
    const baseMinute = pick.minute ?? 0
    let minute = baseMinute
    if (isMinuteDisabled(closeDate, h24, minute, minCloseDate, minCloseTime)) {
      const t = parseHHMM(minCloseTime)
      minute = t && h24 === t.h ? t.m : 0
    }
    emitTime(h12, isPm, minute)
  }

  const handleMeridiemSelect = (isPm: boolean) => {
    const d = resolvePickDefaults({ ...pick, isPm })
    const h24 = to24From12Hour(d.hour12, d.isPm)
    if (isHourDisabled(closeDate, h24, minCloseDate, minCloseTime)) return
    let minute = d.minute
    if (isMinuteDisabled(closeDate, h24, minute, minCloseDate, minCloseTime)) {
      const t = parseHHMM(minCloseTime)
      minute = t && h24 === t.h ? t.m : 0
    }
    emitTime(d.hour12, isPm, minute)
  }

  const handleMinuteSelect = (minute: number) => {
    const d = resolvePickDefaults({ ...pick, minute })
    const h24 = to24From12Hour(d.hour12, d.isPm)
    if (isMinuteDisabled(closeDate, h24, minute, minCloseDate, minCloseTime)) return
    emitTime(d.hour12, d.isPm, minute)
    setOpen(false)
  }

  const defaults = resolvePickDefaults(pick)
  const effectiveH24 = to24From12Hour(defaults.hour12, defaults.isPm)

  const timeCellSx = {
    minW: '2.5rem',
    h: '2.25rem',
    borderRadius: 'md',
    fontSize: 'sm',
    fontVariantNumeric: 'tabular-nums' as const,
  }

  return (
    <Popover.Root
      lazyMount
      unmountOnExit
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
      positioning={{ placement: 'bottom-start' }}
    >
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label="Choose closing time"
          display="flex"
          w="full"
          h="auto"
          minH="10"
          alignItems="stretch"
          justifyContent="flex-start"
          gap={0}
          px={0}
          py={0}
          borderRadius="md"
          borderWidth="1px"
          borderColor={triggerBorderColor}
          bg={dark.inputBg}
          color="inherit"
          overflow="hidden"
          textAlign="left"
          fontWeight="normal"
          colorPalette="brand"
          _hover={{ bg: dark.inputBg }}
          _active={{ bg: dark.inputBg }}
          _focusVisible={{
            borderColor: 'brand.500',
            boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)',
          }}
        >
          <Text
            flex="1"
            px={3}
            py={2}
            fontSize="sm"
            lineHeight="1.25rem"
            color={value ? 'white' : dark.placeholder}
            minW={0}
            truncate
          >
            {value ? formatTimeDisplay(value) : 'Select time'}
          </Text>
          <Flex
            align="center"
            justify="center"
            w="10"
            flexShrink={0}
            borderLeftWidth="1px"
            borderColor={triggerBorderColor}
            color={dark.muted}
            _hover={{ color: 'white', bg: 'whiteAlpha.100' }}
          >
            <LuClock size={18} />
          </Flex>
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner zIndex={2800}>
          <Popover.Content
            bg={dark.cardBg}
            borderWidth="1px"
            borderColor={dark.borderSubtle}
            color="white"
            boxShadow="xl"
            p={3}
            w="min-content"
          >
            <Text fontSize="xs" fontWeight="semibold" color={dark.muted} mb={2} letterSpacing="0.06em">
              Closing time
            </Text>
            <Flex gap={3} maxH="240px">
              <Box minW="0">
                <Text fontSize="xs" color={dark.muted} mb={1.5}>
                  Hour
                </Text>
                <Box maxH="200px" overflowY="auto" pr={1} css={{ scrollbarGutter: 'stable' }}>
                  <Flex direction="column" gap={1}>
                    {HOURS_12.map((hour12) => {
                      const disabled = isHour12SlotDisabled(
                        closeDate,
                        hour12,
                        minCloseDate,
                        minCloseTime
                      )
                      const selected = pick.hour12 === hour12
                      return (
                        <Button
                          key={hour12}
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          aria-label={`Closing hour ${hour12}`}
                          onClick={() => handleHour12Select(hour12)}
                          justifyContent="center"
                          {...timeCellSx}
                          bg={selected ? 'brand.500' : 'transparent'}
                          color={selected ? 'white' : 'white'}
                          opacity={disabled ? 0.35 : 1}
                          cursor={disabled ? 'not-allowed' : 'pointer'}
                          _hover={
                            disabled
                              ? undefined
                              : {
                                  bg: selected ? 'brand.400' : 'rgba(255, 255, 255, 0.08)',
                                }
                          }
                        >
                          {hour12}
                        </Button>
                      )
                    })}
                  </Flex>
                </Box>
              </Box>
              <Box minW="0">
                <Text fontSize="xs" color={dark.muted} mb={1.5}>
                  Minute
                </Text>
                <Box maxH="200px" overflowY="auto" pr={1} css={{ scrollbarGutter: 'stable' }}>
                  <Flex direction="column" gap={1}>
                    {MINUTES.map((minute) => {
                      const disabled = isMinuteDisabled(
                        closeDate,
                        effectiveH24,
                        minute,
                        minCloseDate,
                        minCloseTime
                      )
                      const selected = pick.minute === minute
                      return (
                        <Button
                          key={minute}
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          aria-label={`Closing minute ${pad2(minute)}`}
                          onClick={() => handleMinuteSelect(minute)}
                          justifyContent="center"
                          {...timeCellSx}
                          bg={selected ? 'brand.500' : 'transparent'}
                          color="white"
                          opacity={disabled ? 0.35 : 1}
                          cursor={disabled ? 'not-allowed' : 'pointer'}
                          _hover={
                            disabled
                              ? undefined
                              : {
                                  bg: selected ? 'brand.400' : 'rgba(255, 255, 255, 0.08)',
                                }
                          }
                        >
                          {pad2(minute)}
                        </Button>
                      )
                    })}
                  </Flex>
                </Box>
              </Box>
              <Box minW="0">
                <Text fontSize="xs" color={dark.muted} mb={1.5}>
                  AM / PM
                </Text>
                <Flex direction="column" gap={1}>
                  {(
                    [
                      { label: 'AM', isPm: false },
                      { label: 'PM', isPm: true },
                    ] as const
                  ).map(({ label, isPm }) => {
                    const h24ForPeriod = to24From12Hour(defaults.hour12, isPm)
                    const disabledMeridiem = isHourDisabled(
                      closeDate,
                      h24ForPeriod,
                      minCloseDate,
                      minCloseTime
                    )
                    const selected = pick.isPm !== null && pick.isPm === isPm
                    return (
                      <Button
                        key={label}
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabledMeridiem}
                        aria-label={`Closing time ${label}`}
                        onClick={() => handleMeridiemSelect(isPm)}
                        justifyContent="center"
                        {...timeCellSx}
                        minW="3.25rem"
                        bg={selected ? 'brand.500' : 'transparent'}
                        color="white"
                        opacity={disabledMeridiem ? 0.35 : 1}
                        cursor={disabledMeridiem ? 'not-allowed' : 'pointer'}
                        _hover={
                          disabledMeridiem
                            ? undefined
                            : {
                                bg: selected ? 'brand.400' : 'rgba(255, 255, 255, 0.08)',
                              }
                        }
                      >
                        {label}
                      </Button>
                    )
                  })}
                </Flex>
              </Box>
            </Flex>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}

export function CreateAuctionForm({ onCancel, onSuccess, quickCreateTrigger = 0 }: CreateAuctionFormProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [categories, setCategories] = useState<CategoryDto[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [selectedRootId, setSelectedRootId] = useState<number | ''>('')
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<number[]>([])
  const [additionalSubcategoriesOpen, setAdditionalSubcategoriesOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [manifestImageSelection, setManifestImageSelection] = useState<ManifestImageSelection>(null)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [quickCreateQuery, setQuickCreateQuery] = useState('')
  const [quickCreateResults, setQuickCreateResults] = useState<GmManifestCarRow[]>([])
  const [quickCreateLoading, setQuickCreateLoading] = useState(false)
  const [quickCreateError, setQuickCreateError] = useState<string | null>(null)
  const [quickCreateHint, setQuickCreateHint] = useState<string | null>(null)
  const [selectedManifestLabel, setSelectedManifestLabel] = useState<string | null>(null)
  const quickCreateRequestIdRef = useRef(0)
  const quickCreateInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [closeEndMode, setCloseEndMode] = useState<'quick' | 'custom'>('quick')
  const [quickDurationAmount, setQuickDurationAmount] = useState('1')
  const [quickDurationUnit, setQuickDurationUnit] = useState<QuickDurationUnit>('days')
  const [closeDate, setCloseDate] = useState('')
  const [closeTime, setCloseTime] = useState('')

  const [fieldDefs, setFieldDefs] = useState<CategoryFieldDto[]>([])
  const [rootFieldDefs, setRootFieldDefs] = useState<CategoryFieldDto[]>([])
  const [globalFieldDefs, setGlobalFieldDefs] = useState<CategoryFieldDto[]>([])
  const [draftFieldValuesByName, setDraftFieldValuesByName] = useState<Record<string, string>>({})
  const [fieldsError, setFieldsError] = useState<string | null>(null)

  const [customErrors, setCustomErrors] = useState<Record<string, string>>({})
  const categoryFieldAnchorRef = useRef<HTMLDivElement>(null)
  const [rootCategoryHintActive, setRootCategoryHintActive] = useState(false)
  const rootCategoryHintTimeoutRef = useRef<number | null>(null)

  const { register, handleSubmit, setValue, getValues, formState } = useForm<CreateFormValues>({
    defaultValues: {
      title: '',
      description: '',
      categoryId: '',
      initialPrice: '',
      bidIncrement: '',
      reservePrice: '',
      closeDateTime: '',
    },
  })
  const { errors } = formState

  /** Hex for native controls + Chakra; aligns with red.400 */
  const errorAccent = '#f56565'
  const labelColor = (invalid: boolean) => (invalid ? errorAccent : dark.muted)
  const inputBorderColor = (invalid: boolean) => (invalid ? errorAccent : dark.borderSubtle)
  const selectChevronSvg =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7.5L10 12.5L15 7.5' stroke='%23A0AEC0' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")"
  const baseSelectStyle = {
    width: '100%',
    padding: '8px 12px',
    paddingRight: '2.25rem',
    background: dark.inputBg,
    borderRadius: '6px',
    color: 'white',
    backgroundImage: selectChevronSvg,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'calc(100% - 0.75rem) center',
    backgroundSize: '0.95rem',
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    MozAppearance: 'none' as const,
  }

  useEffect(() => {
    if (closeEndMode !== 'custom') {
      setValue('closeDateTime', '')
      return
    }
    if (!closeDate || !closeTime) {
      setValue('closeDateTime', '')
      return
    }
    setValue('closeDateTime', `${closeDate}T${closeTime}`, { shouldValidate: true })
  }, [closeEndMode, closeDate, closeTime, setValue])

  useEffect(() => {
    let isMounted = true
    const loadCategories = async () => {
      try {
        setCategoriesLoading(true)
        setCategoriesError(null)
        const res = await fetchCategories()
        if (!isMounted) return
        setCategories(res.data)
      } catch {
        if (!isMounted) return
        setCategoriesError('Failed to load categories.')
      } finally {
        if (isMounted) {
          setCategoriesLoading(false)
        }
      }
    }
    void loadCategories()
    return () => {
      isMounted = false
    }
  }, [])

  const firstSelectedSubcategoryId = selectedSubcategoryIds[0] ?? null

  useEffect(() => {
    if (!firstSelectedSubcategoryId) {
      setFieldDefs([])
      setFieldsError(null)
      return
    }
    let isMounted = true
    const loadFields = async () => {
      try {
        setFieldsError(null)
        const res = await fetchCategoryFields(firstSelectedSubcategoryId)
        if (!isMounted) return
        setFieldDefs(res.data)
      } catch {
        if (!isMounted) return
        setFieldDefs([])
        setFieldsError('Failed to load category fields.')
      }
    }
    void loadFields()
    return () => {
      isMounted = false
    }
  }, [firstSelectedSubcategoryId])

  const rootCategories = categories.filter((c) => c.parentId === null)

  const selectedRoot: CategoryDto | undefined =
    typeof selectedRootId === 'number'
      ? rootCategories.find((c) => c.id === selectedRootId)
      : undefined

  const findRootAndSubcategorySelection = (requestedCategoryIds: number[]) => {
    if (!requestedCategoryIds.length) return { rootId: '' as number | '', subcategoryIds: [] as number[] }

    const walk = (nodes: CategoryDto[], currentRootId: number | null): { id: number; rootId: number | null }[] => {
      const found: { id: number; rootId: number | null }[] = []
      for (const node of nodes) {
        const nextRootId = currentRootId ?? node.id
        found.push({ id: node.id, rootId: nextRootId })
        if (node.children?.length) {
          found.push(...walk(node.children, nextRootId))
        }
      }
      return found
    }

    const index = walk(categories, null)
    const idToRoot = new Map<number, number>()
    for (const node of index) {
      if (node.rootId != null) idToRoot.set(node.id, node.rootId)
    }

    const chosen = requestedCategoryIds.filter((id) => idToRoot.has(id))
    if (!chosen.length) return { rootId: '' as number | '', subcategoryIds: [] as number[] }

    const primaryRoot = idToRoot.get(chosen[0]!)!
    const subcategoryIds = chosen.filter((id) => id !== primaryRoot && idToRoot.get(id) === primaryRoot)
    return { rootId: primaryRoot, subcategoryIds }
  }

  useEffect(() => {
    if (!selectedRoot?.children?.length) {
      setRootFieldDefs([])
      return
    }

    let isMounted = true
    const loadRootFields = async () => {
      try {
        const children = [...selectedRoot.children]
        const responses = await Promise.all(children.map((c) => fetchCategoryFields(c.id)))
        if (!isMounted) return

        const byName = new Map<string, CategoryFieldDto>()
        for (const res of responses) {
          for (const f of res.data) {
            const key = f.fieldName.trim().toLowerCase()
            const existing = byName.get(key)
            if (!existing) {
              byName.set(key, { ...f, options: f.options ? [...f.options] : f.options })
              continue
            }

            if (existing.fieldType === 'select' && f.fieldType === 'select') {
              const mergedOptions = Array.from(new Set([...(existing.options ?? []), ...(f.options ?? [])]))
              byName.set(key, { ...existing, options: mergedOptions })
            }
          }
        }

        setRootFieldDefs(Array.from(byName.values()).sort((a, b) => a.fieldName.localeCompare(b.fieldName)))
      } catch {
        if (!isMounted) return
        setRootFieldDefs([])
      }
    }

    void loadRootFields()
    return () => {
      isMounted = false
    }
  }, [selectedRoot])

  useEffect(() => {
    if (!categories.length) {
      setGlobalFieldDefs([])
      return
    }

    let isMounted = true
    const loadGlobalFields = async () => {
      try {
        const leaves: CategoryDto[] = []
        const walkLeaves = (nodes: CategoryDto[]) => {
          for (const node of nodes) {
            if (!node.children?.length) leaves.push(node)
            else walkLeaves(node.children)
          }
        }
        walkLeaves(categories)

        const responses = await Promise.all(leaves.map((c) => fetchCategoryFields(c.id)))
        if (!isMounted) return

        const byName = new Map<string, CategoryFieldDto>()
        for (const res of responses) {
          for (const f of res.data) {
            const key = normalizeFieldName(f.fieldName)
            const existing = byName.get(key)
            if (!existing) {
              byName.set(key, { ...f, options: f.options ? [...f.options] : f.options })
              continue
            }
            if (existing.fieldType === 'select' && f.fieldType === 'select') {
              byName.set(key, {
                ...existing,
                options: Array.from(new Set([...(existing.options ?? []), ...(f.options ?? [])])),
              })
            }
          }
        }
        setGlobalFieldDefs(Array.from(byName.values()).sort((a, b) => a.fieldName.localeCompare(b.fieldName)))
      } catch {
        if (!isMounted) return
        setGlobalFieldDefs([])
      }
    }

    void loadGlobalFields()
    return () => {
      isMounted = false
    }
  }, [categories])

  useEffect(() => {
    if (!isAdmin || !quickCreateOpen) return
    const query = quickCreateQuery.trim()
    if (query.length < 2) {
      setQuickCreateResults([])
      setQuickCreateError(null)
      setQuickCreateLoading(false)
      return
    }

    quickCreateRequestIdRef.current += 1
    const requestId = quickCreateRequestIdRef.current
    setQuickCreateLoading(true)
    setQuickCreateError(null)
    const timer = window.setTimeout(() => {
      searchGmManifestCars(query, 8)
        .then((res) => {
          if (requestId !== quickCreateRequestIdRef.current) return
          setQuickCreateResults(res.data)
        })
        .catch(() => {
          if (requestId !== quickCreateRequestIdRef.current) return
          setQuickCreateResults([])
          setQuickCreateError('Failed to search manifest cars.')
        })
        .finally(() => {
          if (requestId === quickCreateRequestIdRef.current) {
            setQuickCreateLoading(false)
          }
        })
    }, 220)

    return () => window.clearTimeout(timer)
  }, [isAdmin, quickCreateOpen, quickCreateQuery])

  const visibleFieldDefs =
    fieldDefs.length > 0
      ? fieldDefs
      : rootFieldDefs.length > 0
        ? rootFieldDefs
        : globalFieldDefs

  useEffect(() => {
    if (!isAdmin || quickCreateTrigger <= 0) return
    setQuickCreateOpen(true)
    window.setTimeout(() => {
      quickCreateInputRef.current?.focus()
    }, 0)
  }, [isAdmin, quickCreateTrigger])

  const applyManifestSelection = (row: GmManifestCarRow) => {
    const title = buildManifestTitle(row)
    if (title) {
      setValue('title', title, { shouldDirty: true, shouldValidate: true })
    }

    const descriptionTemplate = buildManifestDescriptionTemplate(row)
    setValue('description', descriptionTemplate, { shouldDirty: true })

    const nextImage = buildManifestImageSelection(row)
    setManifestImageSelection(nextImage)
    setSelectedImageFile(null)

    const mergedDrafts: Record<string, string> = {}
    const make = normalizeManifestKeyword(row.make)
    if (make) mergedDrafts['make'] = row.make!.trim()
    const model = normalizeManifestKeyword(row.model)
    if (model) mergedDrafts['model'] = row.model!.trim()
    if (row.year) mergedDrafts['year'] = String(row.year)
    const color = normalizeManifestKeyword(row.color)
    if (color) mergedDrafts['exterior color'] = row.color!.trim()
    // Quick-create baseline defaults for common vehicle fields.
    mergedDrafts['condition'] = 'New'
    mergedDrafts['fuel type'] = 'Gasoline'
    mergedDrafts['transmission'] = 'Automatic'
    setDraftFieldValuesByName((prev) => ({ ...prev, ...mergedDrafts }))

    const { rootId, subcategoryIds } = findRootAndSubcategorySelection(row.categoryIds)
    if (rootId !== '') {
      setSelectedRootId(rootId)
      setSelectedSubcategoryIds(subcategoryIds)
      setAdditionalSubcategoriesOpen(false)
      setValue('categoryId', subcategoryIds.length ? String(subcategoryIds[0]!) : '')
    }

    setCustomErrors((prev) => {
      const next = { ...prev }
      delete next.rootCategory
      delete next.subcategory
      return next
    })

    const missing: string[] = []
    if (!row.make) missing.push('Make')
    if (!row.model) missing.push('Model')
    if (!row.year) missing.push('Year')
    if (!nextImage) missing.push('Image')
    if (rootId === '' || subcategoryIds.length === 0) missing.push('Category')
    setQuickCreateHint(
      missing.length
        ? `Manual input still needed: ${missing.join(', ')}.`
        : 'Manifest autofill applied. Review values before submitting.'
    )
    setSelectedManifestLabel(composeManifestSearchLabel(row))
    setQuickCreateOpen(false)
  }

  useEffect(() => {
    for (const f of visibleFieldDefs) {
      const draftValue = draftFieldValuesByName[normalizeFieldName(f.fieldName)]
      if (draftValue != null) {
        setValue(`field_${f.id}` as keyof CreateFormValues, draftValue)
      }
    }
  }, [visibleFieldDefs, draftFieldValuesByName, setValue])

  const handleRootChange = (value: string) => {
    const id = value ? Number(value) : ''
    setSelectedRootId(id)
    setSelectedSubcategoryIds([])
    setAdditionalSubcategoriesOpen(false)
    setFieldDefs([])
    setFieldsError(null)
    setValue('categoryId', '')
    setCustomErrors((prev) => {
      if (!prev.rootCategory) return prev
      const next = { ...prev }
      delete next.rootCategory
      return next
    })
  }

  const promptRootCategorySelection = () => {
    categoryFieldAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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

  const toggleSubcategorySelection = (subcategoryId: number) => {
    setSelectedSubcategoryIds((prev) =>
      prev.includes(subcategoryId) ? prev.filter((id) => id !== subcategoryId) : [...prev, subcategoryId],
    )
    setCustomErrors((prev) => {
      if (!prev.subcategory) return prev
      const next = { ...prev }
      delete next.subcategory
      return next
    })
  }

  const sectionLabelProps = {
    fontSize: 'xs' as const,
    fontWeight: 'semibold' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: dark.muted,
    mb: 3,
  }

  if (!user) {
    return (
      <Box py={2}>
        <Text color={dark.muted}>Please log in to create an auction.</Text>
      </Box>
    )
  }

  /** Category, subcategory, and auction-end rules (not covered by react-hook-form). */
  const validateCustomAuctionFields = (
    data: CreateFormValues,
  ): { customErrors: Record<string, string>; closeAt: Date | null } => {
    const nextCustom: Record<string, string> = {}

    if (!selectedRootId) {
      nextCustom.rootCategory = 'Please select a category.'
    }
    if (!firstSelectedSubcategoryId) {
      nextCustom.subcategory = 'Please select a subcategory.'
    }

    let closeAt: Date | null = null
    if (closeEndMode === 'quick') {
      const quickMs = parseQuickDurationMs(quickDurationAmount, quickDurationUnit)
      if (quickMs == null) {
        nextCustom.quickDuration = 'Choose a length from 1–30 hours, days, or weeks.'
      } else {
        closeAt = new Date(Date.now() + quickMs)
      }
    } else {
      if (!data.closeDateTime) {
        nextCustom.auctionEnd = 'Please select a closing date and time.'
      } else {
        const parsed = new Date(data.closeDateTime)
        if (Number.isNaN(parsed.getTime())) {
          nextCustom.auctionEnd = 'Please enter a valid closing date and time.'
        } else {
          closeAt = parsed
        }
      }
    }

    const minAllowedCloseAt = new Date()
    minAllowedCloseAt.setMinutes(minAllowedCloseAt.getMinutes() + 1)
    if (closeAt != null && closeAt.getTime() < minAllowedCloseAt.getTime()) {
      nextCustom.auctionEnd = 'Closing must be at least 1 minute from now.'
    }

    return { customErrors: nextCustom, closeAt }
  }

  const onSubmit = async (data: CreateFormValues) => {
    const { customErrors: nextCustom, closeAt } = validateCustomAuctionFields(data)

    if (Object.keys(nextCustom).length > 0) {
      setCustomErrors(nextCustom)
      setSubmitError(null)
      return
    }

    setCustomErrors({})
    setSubmitError(null)

    if (closeAt == null) {
      setSubmitError('Check auction end time and try again.')
      return
    }

    setSubmitting(true)

    const fieldValues = fieldDefs
      .map((f) => ({
        fieldId: f.id,
        value: data[`field_${f.id}` as keyof CreateFormValues] as string,
      }))
      .filter((fv) => fv.value != null && String(fv.value).trim() !== '')

    const dto: CreateAuctionDto = {
      title: data.title.trim(),
      description: data.description.trim() || undefined,
      categoryIds: selectedSubcategoryIds,
      initialPrice: Number(data.initialPrice),
      bidIncrement: Number(data.bidIncrement),
      reservePrice: Number(data.reservePrice),
      closeDateTime: closeAt.toISOString(),
      fieldValues,
    }

    try {
      if (selectedImageFile) {
        const imageKey = await uploadFileToCdn(selectedImageFile, 'items')
        dto.imageStorageKey = imageKey
      } else if (manifestImageSelection?.imageStorageKey) {
        dto.imageStorageKey = manifestImageSelection.imageStorageKey
      } else if (manifestImageSelection?.imageUrl) {
        dto.imageUrl = manifestImageSelection.imageUrl
      }
      const res = await createAuction(dto)
      onSuccess(res.data.id)
    } catch (err) {
      if (isAxiosError(err) && err.response?.data) {
        const msg =
          typeof err.response.data === 'string'
            ? err.response.data
            : (err.response.data as { message?: string }).message
        setSubmitError(msg ?? 'Failed to create auction.')
      } else {
        setSubmitError('Failed to create auction.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const minClose = new Date()
  minClose.setMinutes(minClose.getMinutes() + 1)
  const minCloseDate = formatLocalDate(minClose)
  const minCloseTime = formatLocalTime(minClose)

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit, () => {
        setCustomErrors(validateCustomAuctionFields(getValues()).customErrors)
        setSubmitError(null)
      })}
      style={{ width: '100%' }}
    >
      <Stack gap={0} width="100%">
      {submitError && (
        <Text color="red.400" mb={4}>
          {submitError}
        </Text>
      )}
      {categoriesError && (
        <Text color="red.400" mb={4}>
          {categoriesError}
        </Text>
      )}

      {isAdmin && (
        <Box mb={5}>
          {quickCreateOpen && (
            <Box borderWidth="1px" borderColor={dark.borderSubtle} borderRadius="md" p={3} bg={dark.inputBg}>
              <Text fontSize="xs" color={dark.muted} mb={2} textTransform="uppercase" letterSpacing="0.08em">
                Manifest selector
              </Text>
              <Input
                ref={quickCreateInputRef}
                bg={dark.cardBg}
                borderColor={dark.borderSubtle}
                color="white"
                _placeholder={{ color: dark.placeholder }}
                placeholder="Search make, model, year, or variant"
                value={quickCreateQuery}
                onChange={(event) => setQuickCreateQuery(event.target.value)}
              />
              {quickCreateError && (
                <Text fontSize="xs" color="red.400" mt={2}>
                  {quickCreateError}
                </Text>
              )}
              {quickCreateLoading && (
                <Text fontSize="xs" color={dark.muted} mt={2}>
                  Searching manifest...
                </Text>
              )}
              {!quickCreateLoading && quickCreateQuery.trim().length >= 2 && quickCreateResults.length === 0 && !quickCreateError && (
                <Text fontSize="xs" color={dark.placeholder} mt={2}>
                  No manifest matches found.
                </Text>
              )}
              {quickCreateResults.length > 0 && (
                <Stack gap={2} mt={3}>
                  {quickCreateResults.map((row, index) => {
                    const label = composeManifestSearchLabel(row)
                    const sub = [row.make, row.model, row.year ? String(row.year) : null].filter(Boolean).join(' • ')
                    return (
                      <Button
                        key={`${row.externalId ?? 'manifest'}-${index}`}
                        type="button"
                        justifyContent="space-between"
                        alignItems="center"
                        h="auto"
                        py={2}
                        px={3}
                        borderWidth="1px"
                        borderColor={dark.borderSubtle}
                        bg="transparent"
                        color="white"
                        _hover={{ bg: 'whiteAlpha.100' }}
                        onClick={() => applyManifestSelection(row)}
                      >
                        <Box textAlign="left" minW={0}>
                          <Text fontSize="sm" truncate>
                            {label}
                          </Text>
                          {sub && (
                            <Text fontSize="xs" color={dark.muted} truncate>
                              {sub}
                            </Text>
                          )}
                        </Box>
                        <Text fontSize="xs" color={dark.muted} flexShrink={0}>
                          Autofill
                        </Text>
                      </Button>
                    )
                  })}
                </Stack>
              )}
              {selectedManifestLabel && (
                <Text fontSize="xs" color={dark.muted} mt={3}>
                  Selected manifest car: <Text as="span" color="white">{selectedManifestLabel}</Text>
                </Text>
              )}
              {quickCreateHint && (
                <Text fontSize="xs" color={dark.muted} mt={1}>
                  {quickCreateHint}
                </Text>
              )}
            </Box>
          )}
        </Box>
      )}

      <Text {...sectionLabelProps}>Listing</Text>
      <Box mb={6}>
        <Text fontSize="sm" color={labelColor(!!errors.title)} mb={1}>
          Title *
        </Text>
        <Input
          bg={dark.inputBg}
          borderColor={inputBorderColor(!!errors.title)}
          color="white"
          _placeholder={{ color: dark.placeholder }}
          placeholder="Item title"
          {...register('title', {
            required: 'Title is required.',
            validate: (v) => v.trim() !== '' || 'Title cannot be empty.',
          })}
        />
        {errors.title?.message && (
          <Text fontSize="xs" color={errorAccent} mt={1}>
            {errors.title.message}
          </Text>
        )}
      </Box>
      <Box mb={4}>
        <Text fontSize="sm" color={dark.muted} mb={1}>
          Description
        </Text>
        <Textarea
          bg={dark.inputBg}
          borderColor={dark.borderSubtle}
          color="white"
          _placeholder={{ color: dark.placeholder }}
          placeholder="Description"
          rows={4}
          {...register('description')}
        />
      </Box>
      <Box mb={6}>
        <Text fontSize="sm" color={dark.muted} mb={3}>
          Item image
        </Text>
        <Box position="relative">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            aria-label="Choose item image"
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null
              setSelectedImageFile(nextFile)
            }}
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          />
          <Flex align="center" gap={2} flexWrap="wrap">
            <Button
              type="button"
              size="sm"
              variant="outline"
              borderColor={dark.borderSubtle}
              color="white"
              fontSize="sm"
              h="auto"
              py={1.5}
              px={3}
              _hover={{ bg: 'whiteAlpha.100' }}
              display="inline-flex"
              alignItems="center"
              gap={1.5}
              onClick={() => imageInputRef.current?.click()}
            >
              <LuImage size={15} aria-hidden />
              Choose image
            </Button>
            <Text
              fontSize="xs"
              color={selectedImageFile ? dark.label : dark.placeholder}
              flex="1"
              minW={0}
              css={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedImageFile ? selectedImageFile.name : 'No image selected'}
            </Text>
          </Flex>
        </Box>
      </Box>

      <Box borderTopWidth="1px" borderColor={dark.borderSubtle} pt={6} mb={6}>
        <Text {...sectionLabelProps}>Category</Text>
        <Box mb={4} ref={categoryFieldAnchorRef}>
          <Text fontSize="sm" color={labelColor(!!customErrors.rootCategory)} mb={1}>
            Category *
          </Text>
          <Box
            borderRadius="6px"
            style={{
              transformOrigin: 'center center',
              transform: rootCategoryHintActive ? 'scale(1.01)' : 'scale(1)',
              boxShadow: rootCategoryHintActive
                ? '0 0 0 1px rgba(66, 153, 225, 0.95), 0 0 0 6px rgba(66, 153, 225, 0.22), 0 0 20px rgba(66, 153, 225, 0.36)'
                : 'none',
              transition: 'transform 190ms ease, box-shadow 210ms ease',
            }}
          >
            <select
              style={{
                ...baseSelectStyle,
                border: `1px solid ${inputBorderColor(!!customErrors.rootCategory)}`,
              }}
              value={selectedRootId === '' ? '' : String(selectedRootId)}
              onChange={(e) => handleRootChange(e.target.value)}
              disabled={categoriesLoading}
            >
              <option value="">Select category</option>
              {rootCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Box>
          {customErrors.rootCategory && (
            <Text fontSize="xs" color={errorAccent} mt={1}>
              {customErrors.rootCategory}
            </Text>
          )}
        </Box>
        <Box mb={4}>
          <Text fontSize="sm" color={labelColor(!!customErrors.subcategory)} mb={1}>
            Subcategories *
          </Text>
          <Popover.Root
            open={additionalSubcategoriesOpen}
            onOpenChange={(e) => {
              if (e.open && !selectedRoot) {
                promptRootCategorySelection()
                setAdditionalSubcategoriesOpen(false)
                return
              }
              setAdditionalSubcategoriesOpen(e.open)
            }}
            positioning={{ placement: 'top-start' }}
          >
            <Popover.Trigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                w="100%"
                justifyContent="space-between"
                borderColor={dark.borderSubtle}
                color="white"
                _hover={{ bg: 'whiteAlpha.100' }}
                disabled={categoriesLoading || (!!selectedRoot && (!selectedRoot.children || selectedRoot.children.length === 0))}
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
              <Popover.Positioner zIndex={2800}>
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
                          onClick={() => toggleSubcategorySelection(c.id)}
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
                      onClick={() => setAdditionalSubcategoriesOpen(false)}
                    >
                      Done
                    </Button>
                  </Flex>
                </Popover.Content>
              </Popover.Positioner>
            </Portal>
          </Popover.Root>
          {customErrors.subcategory && (
            <Text fontSize="xs" color={errorAccent} mt={1}>
              {customErrors.subcategory}
            </Text>
          )}
          <Flex gap={2} flexWrap="wrap" mt={2}>
            {selectedSubcategoryIds.length === 0 ? (
              <Badge variant="subtle" colorPalette="gray">
                None selected
              </Badge>
            ) : (
              (selectedRoot?.children ?? [])
                .filter((c) => selectedSubcategoryIds.includes(c.id))
                .map((c) => (
                    <Badge
                      key={`selected-${c.id}`}
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

        {fieldsError && (
          <Text color="red.400" mb={4}>
            {fieldsError}
          </Text>
        )}

        <Box mb={0}>
          <Text fontSize="sm" color={dark.muted} mb={3}>
            Item details
          </Text>
          {visibleFieldDefs.length > 0 ? (
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
              {visibleFieldDefs.map((f) => {
                const fieldKey = `field_${f.id}` as keyof CreateFormValues
                const fieldErr = errors[fieldKey]
                const invalid = !!fieldErr
                return (
                  <Box key={f.id}>
                    <Text fontSize="sm" color={labelColor(invalid)} mb={1}>
                      {f.fieldName} {f.options ? '*' : ''}
                    </Text>
                    {f.fieldType === 'select' && f.options ? (
                      <select
                        style={{
                          ...baseSelectStyle,
                          border: `1px solid ${inputBorderColor(invalid)}`,
                        }}
                        {...register(
                          fieldKey,
                          f.options
                            ? {
                                required: `${f.fieldName} is required.`,
                                onChange: (e) =>
                                  setDraftFieldValuesByName((prev) => ({
                                    ...prev,
                                    [normalizeFieldName(f.fieldName)]: e.target.value,
                                  })),
                              }
                            : {},
                        )}
                      >
                        <option value="">Select {f.fieldName}</option>
                        {f.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        type={f.fieldType === 'number' ? 'number' : 'text'}
                        bg={dark.inputBg}
                        borderColor={inputBorderColor(invalid)}
                        color="white"
                        _placeholder={{ color: dark.placeholder }}
                        placeholder={f.fieldName}
                        {...register(fieldKey, {
                          onChange: (e) =>
                            setDraftFieldValuesByName((prev) => ({
                              ...prev,
                              [normalizeFieldName(f.fieldName)]: e.target.value,
                            })),
                        })}
                      />
                    )}
                    {fieldErr?.message && (
                      <Text fontSize="xs" color={errorAccent} mt={1}>
                        {fieldErr.message}
                      </Text>
                    )}
                  </Box>
                )
              })}
            </SimpleGrid>
          ) : (
            <Text fontSize="sm" color={dark.placeholder}>
              No item detail fields are configured for this category.
            </Text>
          )}
        </Box>
      </Box>

      <Box borderTopWidth="1px" borderColor={dark.borderSubtle} pt={6} mb={6}>
        <Text {...sectionLabelProps}>Pricing</Text>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
          <Box>
            <Text fontSize="sm" color={labelColor(!!errors.initialPrice)} mb={1}>
              Initial price *
            </Text>
            <Input
              type="number"
              min={0}
              step={0.01}
              bg={dark.inputBg}
              borderColor={inputBorderColor(!!errors.initialPrice)}
              color="white"
              {...register('initialPrice', {
                required: 'Initial price is required.',
                validate: (v) => {
                  if (v === '') return 'Initial price is required.'
                  const n = Number(v)
                  if (Number.isNaN(n) || n < 0) return 'Enter a valid price (0 or greater).'
                  return true
                },
              })}
            />
            {errors.initialPrice?.message && (
              <Text fontSize="xs" color={errorAccent} mt={1}>
                {errors.initialPrice.message}
              </Text>
            )}
          </Box>
          <Box>
            <Text fontSize="sm" color={labelColor(!!errors.bidIncrement)} mb={1}>
              Bid increment *
            </Text>
            <Input
              type="number"
              min={0.01}
              step={0.01}
              bg={dark.inputBg}
              borderColor={inputBorderColor(!!errors.bidIncrement)}
              color="white"
              {...register('bidIncrement', {
                required: 'Bid increment is required.',
                validate: (v) => {
                  if (v === '') return 'Bid increment is required.'
                  const n = Number(v)
                  if (Number.isNaN(n) || n < 0.01) return 'Must be at least 0.01.'
                  return true
                },
              })}
            />
            {errors.bidIncrement?.message && (
              <Text fontSize="xs" color={errorAccent} mt={1}>
                {errors.bidIncrement.message}
              </Text>
            )}
          </Box>
          <Box>
            <Text fontSize="sm" color={labelColor(!!errors.reservePrice)} mb={1}>
              Reserve price *
            </Text>
            <Input
              type="number"
              min={0}
              step={0.01}
              bg={dark.inputBg}
              borderColor={inputBorderColor(!!errors.reservePrice)}
              color="white"
              {...register('reservePrice', {
                required: 'Reserve price is required.',
                validate: (v) => {
                  if (v === '') return 'Reserve price is required.'
                  const n = Number(v)
                  if (Number.isNaN(n) || n < 0) return 'Enter a valid reserve (0 or greater).'
                  return true
                },
              })}
            />
            {errors.reservePrice?.message && (
              <Text fontSize="xs" color={errorAccent} mt={1}>
                {errors.reservePrice.message}
              </Text>
            )}
          </Box>
        </SimpleGrid>
      </Box>

      <Box borderTopWidth="1px" borderColor={dark.borderSubtle} pt={6} mb={6}>
        <Text {...sectionLabelProps}>Auction end</Text>
        <Flex gap={2} mb={4} flexWrap="wrap">
          <Button
            type="button"
            flex="1"
            minW="160px"
            variant={closeEndMode === 'quick' ? 'solid' : 'outline'}
            bg={closeEndMode === 'quick' ? 'brand.500' : undefined}
            color="white"
            borderColor={dark.borderSubtle}
            _hover={
              closeEndMode === 'quick'
                ? { bg: 'brand.400' }
                : { bg: 'whiteAlpha.100' }
            }
            onClick={() => {
              setCloseEndMode('quick')
              setCustomErrors((prev) => {
                if (!prev.auctionEnd) return prev
                const next = { ...prev }
                delete next.auctionEnd
                return next
              })
            }}
          >
            Ends after…
          </Button>
          <Button
            type="button"
            flex="1"
            minW="160px"
            variant={closeEndMode === 'custom' ? 'solid' : 'outline'}
            bg={closeEndMode === 'custom' ? 'brand.500' : undefined}
            color="white"
            borderColor={dark.borderSubtle}
            _hover={
              closeEndMode === 'custom'
                ? { bg: 'brand.400' }
                : { bg: 'whiteAlpha.100' }
            }
            onClick={() => {
              if (closeEndMode === 'custom') return
              setCloseEndMode('custom')
              setCustomErrors((prev) => {
                if (!prev.quickDuration) return prev
                const next = { ...prev }
                delete next.quickDuration
                return next
              })
              const quickMs = parseQuickDurationMs(quickDurationAmount, quickDurationUnit)
              if (quickMs != null) {
                const end = new Date(Date.now() + quickMs)
                setCloseDate(formatLocalDate(end))
                setCloseTime(formatLocalTime(end))
              }
            }}
          >
            Specific date & time
          </Button>
        </Flex>

        {closeEndMode === 'quick' ? (
          <Stack gap={3}>
            <Text fontSize="sm" color={labelColor(!!customErrors.quickDuration)}>
              Length of auction (from when you create the listing)
            </Text>
            <AuctionDurationPicker
              amount={quickDurationAmount}
              unit={quickDurationUnit}
              onChange={(nextAmount, nextUnit) => {
                setQuickDurationAmount(nextAmount)
                setQuickDurationUnit(nextUnit)
                setCustomErrors((prev) => {
                  if (!prev.quickDuration) return prev
                  const next = { ...prev }
                  delete next.quickDuration
                  return next
                })
              }}
            />
            {customErrors.quickDuration && (
              <Text fontSize="xs" color={errorAccent}>
                {customErrors.quickDuration}
              </Text>
            )}
            <Text fontSize="sm" color={dark.muted}>
              Closes around{' '}
              <Text as="span" color="white" fontWeight="medium">
                {(() => {
                  const ms = parseQuickDurationMs(quickDurationAmount, quickDurationUnit)
                  if (ms == null) return '—'
                  return new Date(Date.now() + ms).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                })()}
              </Text>{' '}
              (your local time)
            </Text>
          </Stack>
        ) : (
          <>
            <Text fontSize="sm" color={labelColor(!!customErrors.auctionEnd)} mb={1}>
              Closing date & time *
            </Text>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
              <DatePicker.Root
                name="closeDate"
                colorPalette="brand"
                positioning={{ placement: 'bottom-start' }}
                openOnClick
                value={closeDate ? [parseDate(closeDate)] : []}
                onValueChange={(details) => {
                  const selected = details.value[0]
                  setCloseDate(selected ? selected.toString() : '')
                  setCustomErrors((prev) => {
                    if (!prev.auctionEnd) return prev
                    const next = { ...prev }
                    delete next.auctionEnd
                    return next
                  })
                }}
              >
                <DatePicker.Control>
                  <DatePicker.Input
                    bg={dark.inputBg}
                    borderColor={inputBorderColor(!!customErrors.auctionEnd)}
                    color="white"
                    _placeholder={{ color: dark.placeholder }}
                    _focusVisible={{
                      borderColor: 'brand.500',
                      boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)',
                    }}
                    placeholder="Select date"
                  />
                  <DatePicker.IndicatorGroup>
                    <DatePicker.Trigger
                      color={dark.muted}
                      _hover={{ color: 'white', bg: 'whiteAlpha.100' }}
                      _focusVisible={{ boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' }}
                    >
                      <LuCalendar />
                    </DatePicker.Trigger>
                  </DatePicker.IndicatorGroup>
                </DatePicker.Control>
                <Portal>
                  <DatePicker.Positioner zIndex={2800}>
                    <DatePicker.Content
                      bg={dark.cardBg}
                      borderWidth="1px"
                      borderColor={dark.borderSubtle}
                      color="white"
                      boxShadow="xl"
                      css={{
                        '& [data-part="table-cell-trigger"]': {
                          color: 'white',
                          borderRadius: '0.375rem',
                        },
                        '& [data-part="table-cell-trigger"]:hover': {
                          background: 'rgba(255, 255, 255, 0.08)',
                        },
                        '& [data-part="table-cell-trigger"][data-selected]': {
                          background: 'var(--chakra-colors-brand-500)',
                          color: 'white',
                        },
                        '& [data-part="table-cell-trigger"][data-today]': {
                          borderColor: 'var(--chakra-colors-brand-500)',
                        },
                        '& [data-part="next-trigger"], & [data-part="prev-trigger"], & [data-part="view-trigger"]':
                          {
                            color: 'white',
                            borderRadius: '0.375rem',
                          },
                        '& [data-part="next-trigger"]:hover, & [data-part="prev-trigger"]:hover, & [data-part="view-trigger"]:hover':
                          {
                            background: 'rgba(255, 255, 255, 0.08)',
                          },
                        '& [data-part="month-select"], & [data-part="year-select"]': {
                          background: dark.inputBg,
                          color: 'white',
                          borderColor: dark.borderSubtle,
                          borderRadius: '0.375rem',
                        },
                        '& [data-part="table-header"]': {
                          color: dark.muted,
                        },
                      }}
                    >
                      <DatePicker.View view="day">
                        <DatePicker.Header />
                        <DatePicker.DayTable />
                      </DatePicker.View>
                      <DatePicker.View view="month">
                        <DatePicker.Header />
                        <DatePicker.MonthTable />
                      </DatePicker.View>
                      <DatePicker.View view="year">
                        <DatePicker.Header />
                        <DatePicker.YearTable />
                      </DatePicker.View>
                    </DatePicker.Content>
                  </DatePicker.Positioner>
                </Portal>
              </DatePicker.Root>
              <AuctionEndTimePicker
                closeDate={closeDate}
                value={closeTime}
                onChange={(next) => {
                  setCloseTime(next)
                  setCustomErrors((prev) => {
                    if (!prev.auctionEnd) return prev
                    const n = { ...prev }
                    delete n.auctionEnd
                    return n
                  })
                }}
                minCloseDate={minCloseDate}
                minCloseTime={minCloseTime}
                triggerBorderColor={inputBorderColor(!!customErrors.auctionEnd)}
              />
            </SimpleGrid>
            {customErrors.auctionEnd && (
              <Text fontSize="xs" color={errorAccent} mt={1}>
                {customErrors.auctionEnd}
              </Text>
            )}
          </>
        )}
        <Input type="hidden" {...register('closeDateTime')} />
      </Box>

      <Flex gap={3} justify="flex-end" flexWrap="wrap" pt={2}>
        <Button
          type="button"
          variant="outline"
          borderColor={dark.borderSubtle}
          color="white"
          _hover={{ bg: 'whiteAlpha.100' }}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          bg="brand.500"
          color="white"
          _hover={{ bg: 'brand.400' }}
          loading={submitting}
        >
          Create Auction
        </Button>
      </Flex>
      </Stack>
    </form>
  )
}
