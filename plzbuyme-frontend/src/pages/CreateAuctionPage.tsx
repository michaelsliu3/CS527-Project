import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Container,
  DatePicker,
  Flex,
  Heading,
  Input,
  Portal,
  parseDate,
  SimpleGrid,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { LuCalendar } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
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
import { APP_PAGE_PX } from '../theme/layout'

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

export function CreateAuctionPage() {
  const navigate = useNavigate()
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
  const [fieldsLoading, setFieldsLoading] = useState(false)
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
        setFieldsLoading(true)
        setFieldsError(null)
        const res = await fetchCategoryFields(Number(categoryId))
        if (!isMounted) return
        setFieldDefs(res.data)
      } catch {
        if (!isMounted) return
        setFieldDefs([])
        setFieldsError('Failed to load category fields.')
      } finally {
        if (isMounted) {
          setFieldsLoading(false)
        }
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

  if (!user) {
    return (
      <Container maxW="container.md" px={APP_PAGE_PX}>
        <Text color={dark.muted}>Please log in to create an auction.</Text>
      </Container>
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
      navigate(`/auctions/${res.data.id}`)
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
    <Container maxW="container.md" px={APP_PAGE_PX}>
      <Heading size="lg" mb={6} color="white">
        Create auction
      </Heading>
      <Box
        as="form"
        onSubmit={handleSubmit(onSubmit)}
        bg={dark.cardBg}
        borderWidth="1px"
        borderColor={dark.borderSubtle}
        borderRadius="md"
        p={6}
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

        <Box mb={4}>
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

        {fieldsLoading && categoryId !== '' && (
          <Text color={dark.muted} mb={4} fontSize="sm">
            Loading item fields…
          </Text>
        )}

        {fieldsError && (
          <Text color="red.400" mb={4}>
            {fieldsError}
          </Text>
        )}

        {fieldDefs.length > 0 && (
          <Box mb={4}>
            <Text fontSize="sm" fontWeight="medium" color={dark.muted} mb={3}>
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

        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4} mb={4}>
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
        <Box mb={6}>
          <Text fontSize="sm" color={dark.muted} mb={1}>
            Closing date & time *
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
            <DatePicker.Root
              name="closeDate"
              colorPalette="brand"
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
                <DatePicker.Positioner zIndex={1700}>
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
            <Input
              type="time"
              value={closeTime}
              min={closeDate === minCloseDate ? minCloseTime : undefined}
              onChange={(event) => setCloseTime(event.target.value)}
              bg={dark.inputBg}
              borderColor={dark.borderSubtle}
              color="white"
              _placeholder={{ color: dark.placeholder }}
              _focusVisible={{
                borderColor: 'brand.500',
                boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)',
              }}
            />
          </SimpleGrid>
          <Input type="hidden" {...register('closeDateTime', { required: true })} />
        </Box>

        <Flex gap={3} justify="flex-end">
          <Button
            type="button"
            variant="outline"
            borderColor={dark.borderSubtle}
            color="white"
            _hover={{ bg: 'whiteAlpha.100' }}
            onClick={() => navigate('/auctions')}
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
            Create auction
          </Button>
        </Flex>
      </Box>
    </Container>
  )
}
