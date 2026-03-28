import { useState, useEffect } from 'react'
import {
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
import { LuCalendar, LuClock } from 'react-icons/lu'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import { createAuction, type CreateAuctionDto } from '../api/auctions'
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
}

function AuctionEndTimePicker({
  closeDate,
  value,
  onChange,
  minCloseDate,
  minCloseTime,
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
            borderColor={dark.borderSubtle}
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

export function CreateAuctionForm({ onCancel, onSuccess }: CreateAuctionFormProps) {
  const { user } = useAuth()
  const [categories, setCategories] = useState<CategoryDto[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [selectedRootId, setSelectedRootId] = useState<number | ''>('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [closeDate, setCloseDate] = useState('')
  const [closeTime, setCloseTime] = useState('')

  const [fieldDefs, setFieldDefs] = useState<CategoryFieldDto[]>([])
  const [fieldsError, setFieldsError] = useState<string | null>(null)

  const { register, handleSubmit, setValue } = useForm<CreateFormValues>({
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

  useEffect(() => {
    if (!closeDate || !closeTime) {
      setValue('closeDateTime', '')
      return
    }
    setValue('closeDateTime', `${closeDate}T${closeTime}`, { shouldValidate: true })
  }, [closeDate, closeTime, setValue])

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

  useEffect(() => {
    if (!categoryId) {
      setFieldDefs([])
      setFieldsError(null)
      return
    }
    let isMounted = true
    const loadFields = async () => {
      try {
        setFieldsError(null)
        const res = await fetchCategoryFields(Number(categoryId))
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
  }, [categoryId])

  const rootCategories = categories.filter((c) => c.parentId === null)

  const selectedRoot: CategoryDto | undefined =
    typeof selectedRootId === 'number'
      ? rootCategories.find((c) => c.id === selectedRootId)
      : undefined

  const handleRootChange = (value: string) => {
    const id = value ? Number(value) : ''
    setSelectedRootId(id)
    setCategoryId('')
    setFieldDefs([])
    setFieldsError(null)
    setValue('categoryId', '')
  }

  const handleSubcategoryChange = (value: string) => {
    const id = value ? Number(value) : ''
    setCategoryId(id)
    setValue('categoryId', value)
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

  const onSubmit = async (data: CreateFormValues) => {
    if (!selectedRootId) {
      setSubmitError('Please select a category.')
      return
    }
    if (!categoryId) {
      setSubmitError('Please select a subcategory.')
      return
    }
    if (!data.closeDateTime) {
      setSubmitError('Please select a closing date and time.')
      return
    }
    const closeAt = new Date(data.closeDateTime)
    if (Number.isNaN(closeAt.getTime())) {
      setSubmitError('Please select a valid closing date and time.')
      return
    }
    const minAllowedCloseAt = new Date()
    minAllowedCloseAt.setMinutes(minAllowedCloseAt.getMinutes() + 1)
    if (closeAt.getTime() < minAllowedCloseAt.getTime()) {
      setSubmitError('Closing date must be at least 1 minute in the future.')
      return
    }

    setSubmitError(null)
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
      categoryId: Number(categoryId),
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
    <Stack
      as="form"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      gap={0}
      width="100%"
    >
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

      <Text {...sectionLabelProps}>Listing</Text>
      <Box mb={6}>
        <Text fontSize="sm" color={dark.muted} mb={1}>
          Title *
        </Text>
        <Input
          bg={dark.inputBg}
          borderColor={dark.borderSubtle}
          color="white"
          _placeholder={{ color: dark.placeholder }}
          placeholder="Item title"
          {...register('title', { required: true })}
        />
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
      <Box mb={4}>
        <Text fontSize="sm" color={dark.muted} mb={1}>
          Item image
        </Text>
        <Input
          type="file"
          accept="image/*"
          bg={dark.inputBg}
          borderColor={dark.borderSubtle}
          color={dark.muted}
          onChange={(event) => {
            const nextFile = event.target.files?.[0] ?? null
            setSelectedImageFile(nextFile)
          }}
        />
      </Box>

      <Box borderTopWidth="1px" borderColor={dark.borderSubtle} pt={6} mb={6}>
        <Text {...sectionLabelProps}>Category</Text>
        <Box mb={4}>
          <Text fontSize="sm" color={dark.muted} mb={1}>
            Category *
          </Text>
          <select
            style={{
              width: '100%',
              padding: '8px 12px',
              background: dark.inputBg,
              border: `1px solid ${dark.borderSubtle}`,
              borderRadius: '6px',
              color: 'white',
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
        <Box mb={4}>
          <Text fontSize="sm" color={dark.muted} mb={1}>
            Subcategory *
          </Text>
          <select
            style={{
              width: '100%',
              padding: '8px 12px',
              background: dark.inputBg,
              border: `1px solid ${dark.borderSubtle}`,
              borderRadius: '6px',
              color: 'white',
            }}
            value={categoryId === '' ? '' : String(categoryId)}
            onChange={(e) => handleSubcategoryChange(e.target.value)}
            disabled={
              categoriesLoading ||
              !selectedRoot ||
              !selectedRoot.children ||
              selectedRoot.children.length === 0
            }
          >
            <option value="">Select subcategory</option>
            {selectedRoot?.children?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Box>

        {fieldsError && (
          <Text color="red.400" mb={4}>
            {fieldsError}
          </Text>
        )}

        {fieldDefs.length > 0 && (
          <Box mb={0}>
            <Text fontSize="sm" color={dark.muted} mb={3}>
              Item details
            </Text>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
              {fieldDefs.map((f) => (
                <Box key={f.id}>
                  <Text fontSize="sm" color={dark.muted} mb={1}>
                    {f.fieldName} {f.options ? '*' : ''}
                  </Text>
                  {f.fieldType === 'select' && f.options ? (
                    <select
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: dark.inputBg,
                        border: `1px solid ${dark.borderSubtle}`,
                        borderRadius: '6px',
                        color: 'white',
                      }}
                      {...register(`field_${f.id}` as keyof CreateFormValues)}
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
                      borderColor={dark.borderSubtle}
                      color="white"
                      _placeholder={{ color: dark.placeholder }}
                      placeholder={f.fieldName}
                      {...register(`field_${f.id}` as keyof CreateFormValues)}
                    />
                  )}
                </Box>
              ))}
            </SimpleGrid>
          </Box>
        )}
      </Box>

      <Box borderTopWidth="1px" borderColor={dark.borderSubtle} pt={6} mb={6}>
        <Text {...sectionLabelProps}>Pricing</Text>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
          <Box>
          <Text fontSize="sm" color={dark.muted} mb={1}>
            Initial price *
          </Text>
          <Input
            type="number"
            min={0}
            step={0.01}
            bg={dark.inputBg}
            borderColor={dark.borderSubtle}
            color="white"
            {...register('initialPrice', { required: true })}
          />
          </Box>
          <Box>
            <Text fontSize="sm" color={dark.muted} mb={1}>
              Bid increment *
            </Text>
            <Input
              type="number"
              min={0.01}
              step={0.01}
              bg={dark.inputBg}
              borderColor={dark.borderSubtle}
              color="white"
              {...register('bidIncrement', { required: true })}
            />
          </Box>
          <Box>
            <Text fontSize="sm" color={dark.muted} mb={1}>
              Reserve price *
            </Text>
            <Input
              type="number"
              min={0}
              step={0.01}
              bg={dark.inputBg}
              borderColor={dark.borderSubtle}
              color="white"
              {...register('reservePrice', { required: true })}
            />
          </Box>
        </SimpleGrid>
      </Box>

      <Box borderTopWidth="1px" borderColor={dark.borderSubtle} pt={6} mb={6}>
        <Text {...sectionLabelProps}>Auction end</Text>
        <Text fontSize="sm" color={dark.muted} mb={1}>
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
            }}
          >
            <DatePicker.Control>
              <DatePicker.Input
                bg={dark.inputBg}
                borderColor={dark.borderSubtle}
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
            onChange={setCloseTime}
            minCloseDate={minCloseDate}
            minCloseTime={minCloseTime}
          />
        </SimpleGrid>
        <Input type="hidden" {...register('closeDateTime', { required: true })} />
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
  )
}
