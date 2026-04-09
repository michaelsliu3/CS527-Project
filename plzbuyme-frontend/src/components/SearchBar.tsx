import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Box,
  Button,
  DatePicker,
  Flex,
  Icon,
  Input,
  Portal,
  parseDate,
  Slider,
  SimpleGrid,
  Text,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import { HiChevronDown } from 'react-icons/hi'
import {
  LuCalendar,
  LuChevronLeft,
  LuChevronRight,
} from 'react-icons/lu'
import { useSearchParams } from 'react-router-dom'
import { getFieldValues } from '../api/auctions'
import { dark } from '../theme/colors'
import { fetchCategories, type CategoryDto } from '../api/categories'
import { resolveLucideIconForKey } from '../constants/categoryLucideIcons'
import { subscribeAuctionListRefresh } from '../utils/auctionListRefresh'

const SORT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'newest', label: 'Newest' },
  { value: 'closing_soon', label: 'Closing soon' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'most_bids', label: 'Most bids' },
]
const CAR_SORT_OPTIONS = [
  { value: 'year_newest', label: 'Year: newest' },
  { value: 'year_oldest', label: 'Year: oldest' },
  { value: 'mileage_low', label: 'Mileage: low to high' },
  { value: 'mileage_high', label: 'Mileage: high to low' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'sold', label: 'Sold' },
]
const DEFAULT_STATUS = 'active'

const CONDITION_OPTIONS = ['New', 'Like New', 'Excellent', 'Good', 'Fair', 'Poor']
const TRANSMISSION_OPTIONS = ['Automatic', 'Manual', 'CVT']
const FUEL_OPTIONS = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid']
const PRICE_SLIDER_MIN = 0
const PRICE_SLIDER_MAX = 200000
const PRICE_SLIDER_DEFAULT_MAX = 50000
const QUICK_PRICE_PRESETS: Array<{ label: string; min: number; max: number }> = [
  { label: '0 - 10k', min: 0, max: 10000 },
  { label: '10k - 50k', min: 10000, max: 50000 },
  { label: '50k - 200k', min: 50000, max: 200000 },
  { label: '200k+', min: 200000, max: PRICE_SLIDER_MAX },
]
const sectionToggleButtonProps = {
  variant: 'ghost',
  w: '100%',
  justifyContent: 'space-between',
  px: 0,
  py: 7,
  bg: 'transparent',
  color: 'white',
  fontWeight: 'semibold',
  _hover: { bg: 'transparent', color: 'white' },
  _active: { bg: 'transparent', color: 'white' },
  _focusVisible: { bg: 'transparent', color: 'white', boxShadow: 'none' },
  _expanded: { bg: 'transparent', color: 'white', pb: 5 },
} as const

const sectionContentPadding = {
  pt: 0,
  pb: 4,
} as const

function getPriceRangeFromSearchParams(searchParams: URLSearchParams): [number, number] {
  const minPriceParam = searchParams.get('minPrice')
  const maxPriceParam = searchParams.get('maxPrice')
  const minFromQuery =
    minPriceParam === null || minPriceParam.trim() === '' ? Number.NaN : Number(minPriceParam)
  const maxFromQuery =
    maxPriceParam === null || maxPriceParam.trim() === '' ? Number.NaN : Number(maxPriceParam)
  const minValue = Number.isFinite(minFromQuery)
    ? Math.max(PRICE_SLIDER_MIN, Math.min(minFromQuery, PRICE_SLIDER_MAX))
    : PRICE_SLIDER_MIN
  const maxValue = Number.isFinite(maxFromQuery)
    ? Math.max(PRICE_SLIDER_MIN, Math.min(maxFromQuery, PRICE_SLIDER_MAX))
    : PRICE_SLIDER_DEFAULT_MAX
  return [Math.min(minValue, maxValue), Math.max(minValue, maxValue)]
}

function getConditionIndexFromSearchParams(searchParams: URLSearchParams): number | null {
  const matchedIndexes = searchParams
    .getAll('condition')
    .map((value) => CONDITION_OPTIONS.indexOf(value))
    .filter((index) => index >= 0)

  if (!matchedIndexes.length) return null
  return Math.max(...matchedIndexes)
}

type SearchBarVariant = 'full' | 'top' | 'filters'
type FilterSectionKey =
  | 'category'
  | 'price'
  | 'listing'
  | 'carBasics'
  | 'condition'
  | 'transmission'
  | 'fuelType'

interface SearchBarProps {
  variant?: SearchBarVariant
  topMarginBottom?: number
}

function flattenCategoryNodes(roots: CategoryDto[]): CategoryDto[] {
  const out: CategoryDto[] = []
  const walk = (nodes: CategoryDto[]) => {
    for (const n of nodes) {
      out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(roots)
  return out
}

function normalizeKey(s: string | null | undefined): string {
  return s?.trim().toLowerCase() ?? ''
}

function pickCarsSearchHubRoot(roots: CategoryDto[]): CategoryDto | undefined {
  // Prefer the explicit `stringKey` marker when present.
  const byStringKey = roots.find((c) => normalizeKey(c.stringKey) === 'cars')
  if (byStringKey) return byStringKey
  return roots.find((c) => normalizeKey(c.name) === 'cars')
}

interface DateFilterPickerProps {
  label: string
  textSize?: 'xs' | 'sm'
  name: 'closingAfter' | 'closingBefore'
  value: string
  onValueChange: (value: string) => void
}

function getDateOnlyValue(rawValue: string | null): string {
  if (!rawValue) return ''
  const trimmed = rawValue.trim()
  if (!trimmed) return ''

  const isoDatePart = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed)
  if (isoDatePart) return isoDatePart[1]

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

function toDatePickerValue(value: string) {
  const normalized = getDateOnlyValue(value)
  if (!normalized) return []

  try {
    return [parseDate(normalized)]
  } catch {
    return []
  }
}

function DateFilterPicker({
  label,
  textSize = 'xs',
  name,
  value,
  onValueChange,
}: DateFilterPickerProps) {
  return (
    <Box>
      <Text fontSize={textSize} color={dark.muted} mb={1}>{label}</Text>
      <DatePicker.Root
        name={name}
        colorPalette="brand"
        value={toDatePickerValue(value)}
        onValueChange={(details) => {
          const selected = details.value[0]
          onValueChange(selected ? selected.toString() : '')
        }}
      >
        <DatePicker.Control>
          <DatePicker.Input
            bg={dark.inputBg}
            borderColor={dark.borderSubtle}
            color="white"
            _placeholder={{ color: dark.placeholder }}
            _focusVisible={{ borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' }}
            placeholder="YYYY-MM-DD"
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
                '& [data-part="next-trigger"], & [data-part="prev-trigger"], & [data-part="view-trigger"]': {
                  color: 'white',
                  borderRadius: '0.375rem',
                },
                '& [data-part="next-trigger"]:hover, & [data-part="prev-trigger"]:hover, & [data-part="view-trigger"]:hover': {
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
    </Box>
  )
}

export function SearchBar({ variant = 'full', topMarginBottom = 3 }: SearchBarProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const hasInitializedDefaultStatus = useRef(false)
  const previousPriceQuery = useRef<{ min: string | null; max: string | null } | null>(null)
  const previousConditionQuery = useRef<string | null>(null)
  const previousClosingQuery = useRef<{ after: string | null; before: string | null } | null>(null)
  const [categories, setCategories] = useState<CategoryDto[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [selectedRootId, setSelectedRootId] = useState<number | ''>('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>(() => {
    const fromQuery = searchParams.get('categoryId')
    return fromQuery ? Number(fromQuery) : ''
  })
  const [hoveredTopCategoryId, setHoveredTopCategoryId] = useState<number | null>(null)
  const topBarScrollRef = useRef<HTMLDivElement | null>(null)
  const [canScrollTopBarLeft, setCanScrollTopBarLeft] = useState(false)
  const [canScrollTopBarRight, setCanScrollTopBarRight] = useState(false)
  const [makeSuggestions, setMakeSuggestions] = useState<string[]>([])
  const [modelSuggestions, setModelSuggestions] = useState<string[]>([])
  const [makeInput, setMakeInput] = useState(searchParams.get('make') ?? '')
  const [modelInput, setModelInput] = useState(searchParams.get('model') ?? '')
  const [openSections, setOpenSections] = useState<Record<FilterSectionKey, boolean>>({
    category: false,
    price: false,
    listing: false,
    carBasics: false,
    condition: false,
    transmission: false,
    fuelType: false,
  })
  const [conditionSliderIndex, setConditionSliderIndex] = useState<number>(() => {
    const index = getConditionIndexFromSearchParams(searchParams)
    return index ?? 0
  })
  const [isConditionSelected, setIsConditionSelected] = useState<boolean>(() =>
    getConditionIndexFromSearchParams(searchParams) !== null
  )
  const [priceRange, setPriceRange] = useState<[number, number]>(() =>
    getPriceRangeFromSearchParams(searchParams)
  )
  const [closingAfter, setClosingAfter] = useState<string>(() =>
    getDateOnlyValue(searchParams.get('closingAfter'))
  )
  const [closingBefore, setClosingBefore] = useState<string>(() =>
    getDateOnlyValue(searchParams.get('closingBefore'))
  )
  const [categoriesRefreshToken, setCategoriesRefreshToken] = useState(0)

  useEffect(() => {
    if (hasInitializedDefaultStatus.current) return
    hasInitializedDefaultStatus.current = true
    if (searchParams.has('status')) return
    const next = new URLSearchParams(searchParams)
    next.set('status', DEFAULT_STATUS)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    return subscribeAuctionListRefresh(() => {
      setCategoriesRefreshToken((token) => token + 1)
    })
  }, [])

  useEffect(() => {
    let isMounted = true
    const loadCategories = async () => {
      try {
        setCategoriesLoading(true)
        setCategoriesError(null)
        const res = await fetchCategories()
        if (!isMounted) return
        const data = res.data
        setCategories(data)

        const rootCategories = data.filter((c) => c.parentId === null)
        const searchHubRoot = pickCarsSearchHubRoot(rootCategories)
        const flatFromResponse = flattenCategoryNodes(data)
        const existing = searchParams.get('categoryId')
        if (existing) {
          const idNum = Number(existing)
          const root = rootCategories.find((c) => c.id === idNum)
          if (root) {
            setSelectedRootId(root.id)
            if (searchHubRoot && root.id === searchHubRoot.id) {
              setSelectedCategoryId('')
            } else {
              setSelectedCategoryId(root.id)
            }
          } else {
            const child = flatFromResponse.find((c) => c.id === idNum)
            if (child) {
              setSelectedCategoryId(child.id)
              const parent = child.parentId != null ? flatFromResponse.find((c) => c.id === child.parentId) : undefined
              if (parent) setSelectedRootId(parent.id)
            }
          }
        } else if (searchHubRoot) {
          setSelectedRootId(searchHubRoot.id)
          setSelectedCategoryId('')
        }
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
    // Use serialized query so a new URLSearchParams instance each render does not refetch in a loop.
  }, [searchParams.toString(), categoriesRefreshToken])

  useEffect(() => {
    const nextMin = searchParams.get('minPrice')
    const nextMax = searchParams.get('maxPrice')
    const previous = previousPriceQuery.current
    previousPriceQuery.current = { min: nextMin, max: nextMax }

    if (previous && previous.min === nextMin && previous.max === nextMax) {
      return
    }
    setPriceRange(getPriceRangeFromSearchParams(searchParams))
  }, [searchParams])

  useEffect(() => {
    const nextCondition = searchParams.getAll('condition').join('|')
    const previous = previousConditionQuery.current
    previousConditionQuery.current = nextCondition

    if (previous !== null && previous === nextCondition) {
      return
    }
    const index = getConditionIndexFromSearchParams(searchParams)
    if (index === null) {
      setConditionSliderIndex(0)
      setIsConditionSelected(false)
      return
    }
    setConditionSliderIndex(index)
    setIsConditionSelected(true)
  }, [searchParams])

  const rootCategories = categories.filter((c) => c.parentId === null)
  const searchHubRoot = pickCarsSearchHubRoot(rootCategories)

  type TopBarCategoryTab = { id: number; name: string; lucideIconKey?: string | null }
  const topBarCategories: TopBarCategoryTab[] =
    searchHubRoot?.children?.length
      ? [
          {
            id: searchHubRoot.id,
            name: `All ${searchHubRoot.name}`,
            lucideIconKey: searchHubRoot.lucideIconKey,
          },
          ...searchHubRoot.children.map((child) => ({
            id: child.id,
            name: child.name,
            lucideIconKey: child.lucideIconKey,
          })),
          ...rootCategories
            .filter((root) => root.id !== searchHubRoot.id)
            .map((root) => ({ id: root.id, name: root.name, lucideIconKey: root.lucideIconKey })),
        ]
      : rootCategories.map((root) => ({ id: root.id, name: root.name, lucideIconKey: root.lucideIconKey }))

  const selectedRoot: CategoryDto | undefined =
    typeof selectedRootId === 'number'
      ? rootCategories.find((c) => c.id === selectedRootId)
      : undefined

  const activeTopCategoryId =
    typeof selectedCategoryId === 'number' && searchHubRoot
      ? selectedCategoryId
      : typeof selectedRootId === 'number'
        ? selectedRootId
        : undefined

  const handleSubcategoryChange = (value: string) => {
    const id = value ? Number(value) : ''
    setSelectedCategoryId(id)
  }

  const handleTopCategorySelect = (categoryId: number) => {
    const next = new URLSearchParams(searchParams)
    const isCarsHub = !!searchHubRoot && categoryId === searchHubRoot.id
    const isCarsChild =
      !!searchHubRoot && searchHubRoot.children.some((child) => child.id === categoryId)

    if (isCarsHub) {
      next.delete('categoryId')
    } else {
      next.set('categoryId', String(categoryId))
    }
    next.set('page', '1')
    setSearchParams(next)

    if (isCarsHub) {
      setSelectedRootId(searchHubRoot.id)
      setSelectedCategoryId('')
      return
    }

    if (isCarsChild) {
      setSelectedRootId(searchHubRoot.id)
      setSelectedCategoryId(categoryId)
      return
    }

    setSelectedRootId(categoryId)
    setSelectedCategoryId(categoryId)
  }

  const fetchMakeSuggestions = useCallback(async (prefix: string) => {
    if (!prefix.trim()) {
      setMakeSuggestions([])
      return
    }
    try {
      const { data } = await getFieldValues('Make', undefined, prefix)
      setMakeSuggestions(data)
    } catch {
      setMakeSuggestions([])
    }
  }, [])

  const fetchModelSuggestions = useCallback(async (prefix: string) => {
    if (!prefix.trim()) {
      setModelSuggestions([])
      return
    }
    try {
      const catId = searchParams.get('categoryId')
      const { data } = await getFieldValues(
        'Model',
        catId ? Number(catId) : undefined,
        prefix
      )
      setModelSuggestions(data)
    } catch {
      setModelSuggestions([])
    }
  }, [searchParams])

  useEffect(() => {
    const t = setTimeout(() => fetchMakeSuggestions(makeInput), 200)
    return () => clearTimeout(t)
  }, [makeInput, fetchMakeSuggestions])

  useEffect(() => {
    const t = setTimeout(() => fetchModelSuggestions(modelInput), 200)
    return () => clearTimeout(t)
  }, [modelInput, fetchModelSuggestions])

  useEffect(() => {
    const nextClosingAfter = searchParams.get('closingAfter')
    const nextClosingBefore = searchParams.get('closingBefore')
    const previous = previousClosingQuery.current
    previousClosingQuery.current = { after: nextClosingAfter, before: nextClosingBefore }

    if (previous && previous.after === nextClosingAfter && previous.before === nextClosingBefore) {
      return
    }
    setClosingAfter(getDateOnlyValue(nextClosingAfter))
    setClosingBefore(getDateOnlyValue(nextClosingBefore))
  }, [searchParams])

  function applyFilters(values: Record<string, string | string[] | undefined>) {
    const next = new URLSearchParams(searchParams)
    next.delete('make')
    next.delete('model')
    next.delete('yearMin')
    next.delete('yearMax')
    next.delete('mileageMax')
    next.delete('condition')
    next.delete('transmission')
    next.delete('fuelType')
    next.delete('exteriorColor')
    next.delete('q')
    next.delete('categoryId')
    next.delete('minPrice')
    next.delete('maxPrice')
    next.delete('status')
    next.delete('closingBefore')
    next.delete('closingAfter')
    next.delete('seller')
    next.delete('sort')
    next.delete('page')
    next.delete('pageSize')

    Object.entries(values).forEach(([key, value]) => {
      if (value === undefined || value === '') return
      if (Array.isArray(value)) {
        value.forEach((v) => next.append(key, v))
      } else {
        next.set(key, value)
      }
    })
    next.set('page', '1')
    setSearchParams(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const condition =
      isConditionSelected && CONDITION_OPTIONS[conditionSliderIndex]
        ? [CONDITION_OPTIONS[conditionSliderIndex]]
        : []
    const transmissionValue = (form.elements.namedItem('transmission') as HTMLSelectElement)?.value || undefined
    const transmission: string[] = transmissionValue ? [transmissionValue] : []
    const fuelTypeValue = (form.elements.namedItem('fuelType') as HTMLSelectElement)?.value || undefined
    const fuelType: string[] = fuelTypeValue ? [fuelTypeValue] : []
    const minPriceFromForm = (form.elements.namedItem('minPrice') as HTMLInputElement)?.value || undefined
    const maxPriceFromForm = (form.elements.namedItem('maxPrice') as HTMLInputElement)?.value || undefined
    const minPrice =
      variant === 'filters'
        ? priceRange[0] > PRICE_SLIDER_MIN
          ? String(priceRange[0])
          : undefined
        : minPriceFromForm
    const maxPrice =
      variant === 'filters'
        ? priceRange[1] < PRICE_SLIDER_MAX
          ? String(priceRange[1])
          : undefined
        : maxPriceFromForm

    applyFilters({
      q: (form.elements.namedItem('q') as HTMLInputElement)?.value?.trim() || undefined,
      categoryId: selectedCategoryId ? String(selectedCategoryId) : undefined,
      minPrice,
      maxPrice,
      status: (form.elements.namedItem('status') as HTMLSelectElement)?.value || undefined,
      closingBefore: closingBefore || undefined,
      closingAfter: closingAfter || undefined,
      seller: (form.elements.namedItem('seller') as HTMLInputElement)?.value?.trim() || undefined,
      sort: (form.elements.namedItem('sort') as HTMLSelectElement)?.value || undefined,
      make: makeInput.trim() || undefined,
      model: modelInput.trim() || undefined,
      yearMin: (form.elements.namedItem('yearMin') as HTMLInputElement)?.value || undefined,
      yearMax: (form.elements.namedItem('yearMax') as HTMLInputElement)?.value || undefined,
      mileageMax: (form.elements.namedItem('mileageMax') as HTMLInputElement)?.value || undefined,
      exteriorColor: (form.elements.namedItem('exteriorColor') as HTMLInputElement)?.value?.trim() || undefined,
      condition: condition.length ? condition : undefined,
      transmission: transmission.length ? transmission : undefined,
      fuelType: fuelType.length ? fuelType : undefined,
    })
  }

  const toggleSection = (section: FilterSectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const sectionAnimationProps = (isOpen: boolean) => ({
    display: 'grid',
    gridTemplateRows: isOpen ? '1fr' : '0fr',
    opacity: isOpen ? 1 : 0,
    transition:
      'grid-template-rows 420ms cubic-bezier(0.16, 1, 0.3, 1), opacity 320ms cubic-bezier(0.22, 1, 0.36, 1)',
    willChange: 'grid-template-rows, opacity',
    pointerEvents: isOpen ? 'auto' : 'none',
  })

  const setPriceFromPreset = (min: number, max: number) => {
    setPriceRange([min, max])
  }

  const onPriceSliderChange = (details: { value: number[] }) => {
    if (details.value.length < 2) return
    setPriceRange([details.value[0], details.value[1]])
  }

  const onConditionSliderChange = (details: { value: number[] }) => {
    if (details.value.length === 0) return
    const nextIndex = Math.max(0, Math.min(CONDITION_OPTIONS.length - 1, details.value[0]))
    setConditionSliderIndex(nextIndex)
    setIsConditionSelected(true)
  }

  const onPriceInputChange = (input: 'min' | 'max', nextValue: string) => {
    const numeric = Number(nextValue)
    if (!Number.isFinite(numeric)) return
    const bounded = Math.max(PRICE_SLIDER_MIN, Math.min(numeric, PRICE_SLIDER_MAX))
    setPriceRange((current) => {
      if (input === 'min') {
        return [Math.min(bounded, current[1]), current[1]]
      }
      return [current[0], Math.max(bounded, current[0])]
    })
  }

  const resetAllFilters = () => {
    const next = new URLSearchParams()
    next.set('page', '1')
    next.set('status', DEFAULT_STATUS)
    setSearchParams(next)
    setSelectedRootId('')
    setSelectedCategoryId('')
    setMakeInput('')
    setModelInput('')
    setMakeSuggestions([])
    setModelSuggestions([])
    setPriceRange([PRICE_SLIDER_MIN, PRICE_SLIDER_DEFAULT_MAX])
    setClosingAfter('')
    setClosingBefore('')
  }

  const handleFiltersStatusChange = (nextStatus: string) => {
    if (variant !== 'filters') return
    const next = new URLSearchParams(searchParams)
    if (nextStatus) {
      next.set('status', nextStatus)
    } else {
      // Keep explicit empty status to represent "All".
      next.set('status', '')
    }
    next.set('page', '1')
    setSearchParams(next)
  }

  const isCarsContext = Boolean(
    searchHubRoot &&
      (selectedRootId === searchHubRoot.id ||
        (typeof selectedCategoryId === 'number' &&
          (selectedCategoryId === searchHubRoot.id ||
            searchHubRoot.children?.some((child) => child.id === selectedCategoryId))))
  )

  const allSortOptions = isCarsContext
    ? [...SORT_OPTIONS, ...CAR_SORT_OPTIONS]
    : SORT_OPTIONS
  const showTopBar = variant !== 'filters'
  const showFilters = variant !== 'top'
  const formColumns = variant === 'filters' ? 1 : { base: 1, md: 2, lg: 4 }
  const carFilterColumns = variant === 'filters' ? 1 : { base: 1, md: 2, lg: 4 }
  const topBarScrollStep = 220

  const syncTopBarScrollState = useCallback(() => {
    const container = topBarScrollRef.current
    if (!container) {
      setCanScrollTopBarLeft(false)
      setCanScrollTopBarRight(false)
      return
    }
    const maxScrollLeft = container.scrollWidth - container.clientWidth
    const hasOverflow = maxScrollLeft > 2
    if (!hasOverflow) {
      setCanScrollTopBarLeft(false)
      setCanScrollTopBarRight(false)
      return
    }
    setCanScrollTopBarLeft(container.scrollLeft > 2)
    setCanScrollTopBarRight(container.scrollLeft < maxScrollLeft - 2)
  }, [])

  const scrollTopBar = useCallback((direction: 'left' | 'right') => {
    const container = topBarScrollRef.current
    if (!container) return
    container.scrollBy({
      left: direction === 'left' ? -topBarScrollStep : topBarScrollStep,
      behavior: 'smooth',
    })
  }, [])

  useEffect(() => {
    syncTopBarScrollState()
    window.addEventListener('resize', syncTopBarScrollState)
    return () => window.removeEventListener('resize', syncTopBarScrollState)
  }, [syncTopBarScrollState, topBarCategories])

  return (
    <Box mb={variant === 'top' ? topMarginBottom : 0}>
      {showTopBar && (
      <Box mb={showFilters ? 3 : 0} w="full" position="relative" overflow="hidden">
        <Box
          ref={topBarScrollRef}
          overflowX="auto"
          overflowY="hidden"
          py={4}
          pl={{ base: canScrollTopBarLeft ? 10 : 4, md: canScrollTopBarLeft ? 12 : 4 }}
          pr={{ base: canScrollTopBarRight ? 10 : 4, md: canScrollTopBarRight ? 12 : 4 }}
          onScroll={syncTopBarScrollState}
          css={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent',
            WebkitOverflowScrolling: 'touch',
            '&::-webkit-scrollbar': { height: '5px' },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '4px',
            },
          }}
        >
          <Flex
            as="nav"
            aria-label="Browse by category"
            role="tablist"
            gap={{ base: 5, md: 8 }}
            align="flex-start"
            justify="flex-start"
            w="max-content"
            mx="auto"
            minH="86px"
          >
            {topBarCategories.map((category) => {
              const isActive = activeTopCategoryId === category.id
              const isHovered = hoveredTopCategoryId === category.id
              const TabIcon = resolveLucideIconForKey(category.lucideIconKey)
              return (
                <Button
                  key={category.id}
                  role="tab"
                  aria-selected={isActive}
                  variant="ghost"
                  flexDirection="column"
                  alignItems="center"
                  justifyContent="flex-start"
                  gap={2.5}
                  flexShrink={0}
                  w="auto"
                  minW={{ base: '82px', md: '92px' }}
                  maxW={{ base: '108px', md: '120px' }}
                  h="auto"
                  minH={{ base: '78px', md: '84px' }}
                  px={2.5}
                  py={1.5}
                  borderRadius="md"
                  bg="transparent"
                  color="inherit"
                  transition="color 0.2s ease, background 0.2s ease, transform 0.2s ease"
                  title={category.name}
                  _hover={{
                    bg: 'whiteAlpha.50',
                    transform: 'translateY(-1px)',
                  }}
                  _focus={{ boxShadow: 'none', outline: 'none' }}
                  _focusVisible={{
                    boxShadow: '0 0 0 2px var(--chakra-colors-brand-500)',
                    outline: 'none',
                    bg: 'whiteAlpha.50',
                  }}
                  onMouseEnter={() => setHoveredTopCategoryId(category.id)}
                  onMouseLeave={() => setHoveredTopCategoryId((current) => (current === category.id ? null : current))}
                  onClick={() => handleTopCategorySelect(category.id)}
                  disabled={categoriesLoading || !!categoriesError}
                >
                  <Icon
                    as={TabIcon}
                    boxSize={{ base: 7.5, md: 8 }}
                    flexShrink={0}
                    aria-hidden
                    transition="color 0.2s ease, filter 0.2s ease, transform 0.2s ease"
                    opacity={isActive || isHovered ? 1 : 0.78}
                    filter={
                      isActive || isHovered
                        ? 'drop-shadow(0 0 8px rgba(129, 140, 248, 0.8))'
                        : 'drop-shadow(0 0 0 rgba(129, 140, 248, 0))'
                    }
                    transform={isHovered ? 'scale(1.04)' : 'scale(1)'}
                    color={isActive ? 'brand.400' : isHovered ? 'brand.300' : 'gray.300'}
                  />
                  <Text
                    as="span"
                    fontSize="10px"
                    fontWeight={isActive ? 'bold' : 'medium'}
                    textTransform="uppercase"
                    letterSpacing="0.1em"
                    lineHeight="1.25"
                    textAlign="center"
                    color={isActive ? 'white' : 'whiteAlpha.500'}
                    css={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {category.name}
                  </Text>
                  <Box
                    h="3px"
                    w={isActive || isHovered ? '50px' : '28px'}
                    borderRadius="full"
                    transition="width 0.24s ease, opacity 0.2s ease, filter 0.2s ease"
                    bg={
                      isActive || isHovered
                        ? 'linear-gradient(90deg, rgba(129, 140, 248, 0.2) 0%, rgba(129, 140, 248, 1) 50%, rgba(129, 140, 248, 0.2) 100%)'
                        : 'linear-gradient(90deg, rgba(148, 163, 184, 0) 0%, rgba(148, 163, 184, 0.55) 50%, rgba(148, 163, 184, 0) 100%)'
                    }
                    opacity={isActive ? 1 : isHovered ? 1 : 0.68}
                    filter={isActive || isHovered ? 'drop-shadow(0 0 10px rgba(129, 140, 248, 0.8))' : 'none'}
                  />
                </Button>
              )
            })}
          </Flex>
        </Box>
        {canScrollTopBarLeft && (
          <Flex
            aria-hidden
            position="absolute"
            left={0}
            top={0}
            bottom={0}
            w={{ base: '52px', md: '60px' }}
            align="center"
            justify="center"
            pointerEvents="none"
            css={{
              background: `linear-gradient(to right, ${dark.bg} 52%, transparent)`,
            }}
          >
            <Button
              size="sm"
              borderRadius="full"
              minW="30px"
              h="30px"
              p={0}
              pointerEvents="auto"
              bg="whiteAlpha.200"
              color="white"
              _hover={{ bg: 'whiteAlpha.300' }}
              _active={{ bg: 'whiteAlpha.350' }}
              onClick={() => scrollTopBar('left')}
              aria-label="Scroll categories left"
            >
              <Icon as={LuChevronLeft} boxSize={4} />
            </Button>
          </Flex>
        )}
        {canScrollTopBarRight && (
          <Flex
            aria-hidden
            position="absolute"
            right={0}
            top={0}
            bottom={0}
            w={{ base: '52px', md: '60px' }}
            align="center"
            justify="center"
            pointerEvents="none"
            css={{
              background: `linear-gradient(to left, ${dark.bg} 52%, transparent)`,
            }}
          >
            <Button
              size="sm"
              borderRadius="full"
              minW="30px"
              h="30px"
              p={0}
              pointerEvents="auto"
              bg="whiteAlpha.200"
              color="white"
              _hover={{ bg: 'whiteAlpha.300' }}
              _active={{ bg: 'whiteAlpha.350' }}
              onClick={() => scrollTopBar('right')}
              aria-label="Scroll categories right"
            >
              <Icon as={LuChevronRight} boxSize={4} />
            </Button>
          </Flex>
        )}
      </Box>
      )}

      {showFilters && (
      <Box
        as="form"
        onSubmit={handleSubmit}
        bg={dark.cardBg}
        borderWidth="1px"
        borderColor={dark.borderSubtle}
        borderRadius="md"
        p={4}
      >
      {variant === 'filters' ? (
        <Box>
          <Box mb={3}>
            <Input
              name="q"
              placeholder="Search for items..."
              defaultValue={searchParams.get('q') ?? ''}
              bg={dark.inputBg}
              borderColor={dark.borderSubtle}
              color="white"
              _placeholder={{ color: dark.placeholder }}
            />
          </Box>

          <Box>
            <Box borderBottomWidth="1px" borderColor={dark.borderSubtle}>
              <Button
                type="button"
                {...sectionToggleButtonProps}
                onClick={() => toggleSection('price')}
                aria-expanded={openSections.price}
              >
                Price
                <Icon
                  as={HiChevronDown}
                  boxSize={5}
                  color={dark.muted}
                  transition="transform 320ms cubic-bezier(0.22, 1, 0.36, 1)"
                  transform={openSections.price ? 'rotate(180deg)' : 'rotate(0deg)'}
                />
              </Button>
              <Box {...sectionAnimationProps(openSections.price)}>
                <SimpleGrid
                  columns={1}
                  gap={3}
                  pt={openSections.price ? sectionContentPadding.pt : 0}
                  pb={openSections.price ? sectionContentPadding.pb : 0}
                  overflow="hidden"
                  minH={0}
                >
                  <Slider.Root
                    min={PRICE_SLIDER_MIN}
                    max={PRICE_SLIDER_MAX}
                    step={1}
                    value={priceRange}
                    onValueChange={onPriceSliderChange}
                  >
                    <Slider.Control py={2}>
                      <Slider.Track h="6px" bg="whiteAlpha.200" borderRadius="full">
                        <Slider.Range bg="brand.500" />
                      </Slider.Track>
                      <Slider.Thumb
                        index={0}
                        boxSize={5}
                        bg="white"
                        borderWidth="2px"
                        borderColor={dark.cardBg}
                      />
                      <Slider.Thumb
                        index={1}
                        boxSize={5}
                        bg="white"
                        borderWidth="2px"
                        borderColor={dark.cardBg}
                      />
                    </Slider.Control>
                  </Slider.Root>

                  <SimpleGrid columns={2} gap={3}>
                    <Box>
                      <Text fontSize="sm" color={dark.muted} mb={1.5} fontWeight="semibold">
                        From
                      </Text>
                      <Box position="relative">
                        <Text
                          position="absolute"
                          left={3}
                          top="50%"
                          transform="translateY(-50%)"
                          color="whiteAlpha.800"
                          zIndex={1}
                        >
                          $
                        </Text>
                        <Input
                          name="minPrice"
                          type="number"
                          min={PRICE_SLIDER_MIN}
                          max={PRICE_SLIDER_MAX}
                          step={1}
                          value={priceRange[0]}
                          onChange={(e) => onPriceInputChange('min', e.target.value)}
                          pl={7}
                          bg={dark.inputBg}
                          borderColor={dark.borderSubtle}
                          color="white"
                          _placeholder={{ color: dark.placeholder }}
                        />
                      </Box>
                    </Box>
                    <Box>
                      <Text fontSize="sm" color={dark.muted} mb={1.5} fontWeight="semibold">
                        To
                      </Text>
                      <Box position="relative">
                        <Text
                          position="absolute"
                          left={3}
                          top="50%"
                          transform="translateY(-50%)"
                          color="whiteAlpha.800"
                          zIndex={1}
                        >
                          $
                        </Text>
                        <Input
                          name="maxPrice"
                          type="number"
                          min={PRICE_SLIDER_MIN}
                          max={PRICE_SLIDER_MAX}
                          step={1}
                          value={priceRange[1]}
                          onChange={(e) => onPriceInputChange('max', e.target.value)}
                          pl={7}
                          bg={dark.inputBg}
                          borderColor={dark.borderSubtle}
                          color="white"
                          _placeholder={{ color: dark.placeholder }}
                        />
                      </Box>
                    </Box>
                  </SimpleGrid>

                  <Wrap gap={2}>
                    {QUICK_PRICE_PRESETS.map((preset) => {
                      const isActive = priceRange[0] === preset.min && priceRange[1] === preset.max
                      return (
                        <WrapItem key={preset.label}>
                          <Button
                            type="button"
                            size="sm"
                            px={4}
                            borderRadius="full"
                            bg={isActive ? 'brand.500' : dark.inputBg}
                            color={isActive ? 'white' : dark.muted}
                            borderWidth="1px"
                            borderColor={isActive ? 'brand.500' : dark.borderSubtle}
                            _hover={{
                              bg: isActive ? 'brand.400' : 'whiteAlpha.100',
                              color: 'white',
                              borderColor: isActive ? 'brand.400' : 'whiteAlpha.300',
                            }}
                            onClick={() => setPriceFromPreset(preset.min, preset.max)}
                          >
                            {preset.label}
                          </Button>
                        </WrapItem>
                      )
                    })}
                  </Wrap>
                </SimpleGrid>
              </Box>
            </Box>

            <Box borderBottomWidth="1px" borderColor={dark.borderSubtle}>
              <Button
                type="button"
                {...sectionToggleButtonProps}
                onClick={() => toggleSection('listing')}
                aria-expanded={openSections.listing}
              >
                Listing
                <Icon
                  as={HiChevronDown}
                  boxSize={5}
                  color={dark.muted}
                  transition="transform 320ms cubic-bezier(0.22, 1, 0.36, 1)"
                  transform={openSections.listing ? 'rotate(180deg)' : 'rotate(0deg)'}
                />
              </Button>
              <Box {...sectionAnimationProps(openSections.listing)}>
                <SimpleGrid
                  columns={1}
                  gap={3}
                  pt={openSections.listing ? sectionContentPadding.pt : 0}
                  pb={openSections.listing ? sectionContentPadding.pb : 0}
                  overflow="hidden"
                  minH={0}
                >
                  <Box>
                    <Text fontSize="xs" color={dark.muted} mb={1}>Status</Text>
                    <select
                      name="status"
                      value={searchParams.get('status') ?? DEFAULT_STATUS}
                      onChange={(e) => handleFiltersStatusChange(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: dark.inputBg,
                        border: `1px solid ${dark.borderSubtle}`,
                        borderRadius: '6px',
                        color: 'white',
                      }}
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={dark.muted} mb={1}>Seller</Text>
                    <Input
                      name="seller"
                      placeholder="Username"
                      defaultValue={searchParams.get('seller') ?? ''}
                      bg={dark.inputBg}
                      borderColor={dark.borderSubtle}
                      color="white"
                      _placeholder={{ color: dark.placeholder }}
                    />
                  </Box>
                  <DateFilterPicker
                    label="Closing after"
                    name="closingAfter"
                    value={closingAfter}
                    onValueChange={setClosingAfter}
                  />
                  <DateFilterPicker
                    label="Closing before"
                    name="closingBefore"
                    value={closingBefore}
                    onValueChange={setClosingBefore}
                  />
                </SimpleGrid>
              </Box>
            </Box>

            <>
                <Box borderBottomWidth="1px" borderColor={dark.borderSubtle}>
                  <Button
                    type="button"
                    {...sectionToggleButtonProps}
                    onClick={() => toggleSection('carBasics')}
                    aria-expanded={openSections.carBasics}
                  >
                    Vehicle Details
                    <Icon
                      as={HiChevronDown}
                      boxSize={5}
                      color={dark.muted}
                      transition="transform 320ms cubic-bezier(0.22, 1, 0.36, 1)"
                      transform={openSections.carBasics ? 'rotate(180deg)' : 'rotate(0deg)'}
                    />
                  </Button>
                  <Box {...sectionAnimationProps(openSections.carBasics)}>
                    <SimpleGrid
                      columns={1}
                      gap={3}
                      pt={openSections.carBasics ? sectionContentPadding.pt : 0}
                      pb={openSections.carBasics ? sectionContentPadding.pb : 0}
                      overflow="hidden"
                      minH={0}
                    >
                      <Box>
                        <Text fontSize="xs" color={dark.muted} mb={1}>Make</Text>
                        <Input
                          placeholder="e.g. Toyota"
                          value={makeInput}
                          onChange={(e) => setMakeInput(e.target.value)}
                          onBlur={() => setTimeout(() => setMakeSuggestions([]), 150)}
                          bg={dark.inputBg}
                          borderColor={dark.borderSubtle}
                          color="white"
                          _placeholder={{ color: dark.placeholder }}
                        />
                        {makeSuggestions.length > 0 && (
                          <Box mt={1} bg={dark.cardBg} borderWidth="1px" borderColor={dark.borderSubtle} borderRadius="md" maxH="120px" overflowY="auto">
                            {makeSuggestions.map((s) => (
                              <Box
                                key={s}
                                px={2}
                                py={1}
                                cursor="pointer"
                                color="white"
                                _hover={{ bg: 'whiteAlpha.100' }}
                                onClick={() => {
                                  setMakeInput(s)
                                  setMakeSuggestions([])
                                }}
                              >
                                {s}
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                      <Box>
                        <Text fontSize="xs" color={dark.muted} mb={1}>Model</Text>
                        <Input
                          placeholder="e.g. Camry"
                          value={modelInput}
                          onChange={(e) => setModelInput(e.target.value)}
                          onBlur={() => setTimeout(() => setModelSuggestions([]), 150)}
                          bg={dark.inputBg}
                          borderColor={dark.borderSubtle}
                          color="white"
                          _placeholder={{ color: dark.placeholder }}
                        />
                        {modelSuggestions.length > 0 && (
                          <Box mt={1} bg={dark.cardBg} borderWidth="1px" borderColor={dark.borderSubtle} borderRadius="md" maxH="120px" overflowY="auto">
                            {modelSuggestions.map((s) => (
                              <Box
                                key={s}
                                px={2}
                                py={1}
                                cursor="pointer"
                                color="white"
                                _hover={{ bg: 'whiteAlpha.100' }}
                                onClick={() => {
                                  setModelInput(s)
                                  setModelSuggestions([])
                                }}
                              >
                                {s}
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                      <Box>
                        <Text fontSize="xs" color={dark.muted} mb={1}>Year range</Text>
                        <Flex gap={2}>
                          <Input
                            name="yearMin"
                            type="number"
                            placeholder="Min"
                            defaultValue={searchParams.get('yearMin') ?? ''}
                            bg={dark.inputBg}
                            borderColor={dark.borderSubtle}
                            color="white"
                            _placeholder={{ color: dark.placeholder }}
                          />
                          <Input
                            name="yearMax"
                            type="number"
                            placeholder="Max"
                            defaultValue={searchParams.get('yearMax') ?? ''}
                            bg={dark.inputBg}
                            borderColor={dark.borderSubtle}
                            color="white"
                            _placeholder={{ color: dark.placeholder }}
                          />
                        </Flex>
                      </Box>
                      <Box>
                        <Text fontSize="xs" color={dark.muted} mb={1}>Mileage max</Text>
                        <Input
                          name="mileageMax"
                          type="number"
                          min={0}
                          placeholder="e.g. 50000"
                          defaultValue={searchParams.get('mileageMax') ?? ''}
                          bg={dark.inputBg}
                          borderColor={dark.borderSubtle}
                          color="white"
                          _placeholder={{ color: dark.placeholder }}
                        />
                      </Box>
                      <Box>
                        <Text fontSize="xs" color={dark.muted} mb={1}>Exterior color</Text>
                        <Input
                          name="exteriorColor"
                          placeholder="Color"
                          defaultValue={searchParams.get('exteriorColor') ?? ''}
                          bg={dark.inputBg}
                          borderColor={dark.borderSubtle}
                          color="white"
                          _placeholder={{ color: dark.placeholder }}
                        />
                      </Box>
                    </SimpleGrid>
                  </Box>
                </Box>

                <Box borderBottomWidth="1px" borderColor={dark.borderSubtle}>
                  <Button
                    type="button"
                    {...sectionToggleButtonProps}
                    onClick={() => toggleSection('condition')}
                    aria-expanded={openSections.condition}
                  >
                    Condition
                    <Icon
                      as={HiChevronDown}
                      boxSize={5}
                      color={dark.muted}
                      transition="transform 320ms cubic-bezier(0.22, 1, 0.36, 1)"
                      transform={openSections.condition ? 'rotate(180deg)' : 'rotate(0deg)'}
                    />
                  </Button>
                  <Box {...sectionAnimationProps(openSections.condition)}>
                    <Box
                      pt={openSections.condition ? sectionContentPadding.pt : 0}
                      pb={openSections.condition ? sectionContentPadding.pb : 0}
                      overflow="hidden"
                      minH={0}
                    >
                      <Flex justify="space-between" align="center" mb={2}>
                        <Text fontSize="xs" color={dark.muted}>Slide to choose one condition</Text>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          color={dark.muted}
                          _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                          onClick={() => setIsConditionSelected(false)}
                        >
                          Clear
                        </Button>
                      </Flex>

                      <Slider.Root
                        min={0}
                        max={CONDITION_OPTIONS.length - 1}
                        step={1}
                        value={[conditionSliderIndex]}
                        onValueChange={onConditionSliderChange}
                      >
                        <Slider.Control py={2}>
                          <Slider.Track h="6px" bg="whiteAlpha.200" borderRadius="full">
                            <Slider.Range bg="brand.500" />
                          </Slider.Track>
                          <Slider.Thumb
                            index={0}
                            boxSize={5}
                            bg="white"
                            borderWidth="2px"
                            borderColor={dark.cardBg}
                          />
                        </Slider.Control>
                      </Slider.Root>
                      <SimpleGrid columns={6} mt={2} gap={1}>
                        {CONDITION_OPTIONS.map((option, idx) => (
                          <Text
                            key={option}
                            fontSize="2xs"
                            textAlign="center"
                            color={isConditionSelected && idx === conditionSliderIndex ? 'white' : dark.muted}
                            fontWeight={isConditionSelected && idx === conditionSliderIndex ? 'semibold' : 'normal'}
                          >
                            {option}
                          </Text>
                        ))}
                      </SimpleGrid>
                    </Box>
                  </Box>
                </Box>

                <Box borderBottomWidth="1px" borderColor={dark.borderSubtle}>
                  <Button
                    type="button"
                    {...sectionToggleButtonProps}
                    onClick={() => toggleSection('transmission')}
                    aria-expanded={openSections.transmission}
                  >
                    Transmission
                    <Icon
                      as={HiChevronDown}
                      boxSize={5}
                      color={dark.muted}
                      transition="transform 320ms cubic-bezier(0.22, 1, 0.36, 1)"
                      transform={openSections.transmission ? 'rotate(180deg)' : 'rotate(0deg)'}
                    />
                  </Button>
                  <Box {...sectionAnimationProps(openSections.transmission)}>
                    <Box
                      pt={openSections.transmission ? sectionContentPadding.pt : 0}
                      pb={openSections.transmission ? sectionContentPadding.pb : 0}
                      overflow="hidden"
                      minH={0}
                    >
                      <Text fontSize="xs" color={dark.muted} mb={1.5}>
                        Choose transmission
                      </Text>
                      <select
                        name="transmission"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: dark.inputBg,
                          border: `1px solid ${dark.borderSubtle}`,
                          borderRadius: '6px',
                          color: 'white',
                        }}
                        defaultValue={searchParams.get('transmission') ?? ''}
                      >
                        <option value="">Any transmission</option>
                        {TRANSMISSION_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </Box>
                  </Box>
                </Box>

                <Box borderBottomWidth="1px" borderColor={dark.borderSubtle}>
                  <Button
                    type="button"
                    {...sectionToggleButtonProps}
                    onClick={() => toggleSection('fuelType')}
                    aria-expanded={openSections.fuelType}
                  >
                    Fuel Type
                    <Icon
                      as={HiChevronDown}
                      boxSize={5}
                      color={dark.muted}
                      transition="transform 320ms cubic-bezier(0.22, 1, 0.36, 1)"
                      transform={openSections.fuelType ? 'rotate(180deg)' : 'rotate(0deg)'}
                    />
                  </Button>
                  <Box {...sectionAnimationProps(openSections.fuelType)}>
                    <Box
                      pt={openSections.fuelType ? sectionContentPadding.pt : 0}
                      pb={openSections.fuelType ? sectionContentPadding.pb : 0}
                      overflow="hidden"
                      minH={0}
                    >
                      <Text fontSize="xs" color={dark.muted} mb={1.5}>
                        Choose fuel type
                      </Text>
                      <select
                        name="fuelType"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: dark.inputBg,
                          border: `1px solid ${dark.borderSubtle}`,
                          borderRadius: '6px',
                          color: 'white',
                        }}
                        defaultValue={searchParams.get('fuelType') ?? ''}
                      >
                        <option value="">Any fuel type</option>
                        {FUEL_OPTIONS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </Box>
                  </Box>
                </Box>
            </>
          </Box>
        </Box>
      ) : (
        <>
          <SimpleGrid columns={formColumns} gap={4}>
            <Box>
              <Text fontSize="sm" color={dark.muted} mb={1}>Keyword</Text>
              <Input
                name="q"
                placeholder="Search title or description"
                defaultValue={searchParams.get('q') ?? ''}
                bg={dark.inputBg}
                borderColor={dark.borderSubtle}
                color="white"
                _placeholder={{ color: dark.placeholder }}
              />
            </Box>
            <Box>
              <Text fontSize="sm" color={dark.muted} mb={1}>Subcategory</Text>
              <select
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: dark.inputBg,
                  border: `1px solid ${dark.borderSubtle}`,
                  borderRadius: '6px',
                  color: 'white',
                }}
                value={selectedCategoryId === '' ? '' : String(selectedCategoryId)}
                onChange={(e) => handleSubcategoryChange(e.target.value)}
                disabled={
                  categoriesLoading ||
                  !selectedRoot ||
                  !selectedRoot.children ||
                  selectedRoot.children.length === 0
                }
              >
                <option value="">All</option>
                {selectedRoot?.children?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Box>
            <Box>
              <Text fontSize="sm" color={dark.muted} mb={1}>Min price</Text>
              <Input
                name="minPrice"
                type="number"
                min={0}
                step={0.01}
                placeholder="0"
                defaultValue={searchParams.get('minPrice') ?? ''}
                bg={dark.inputBg}
                borderColor={dark.borderSubtle}
                color="white"
                _placeholder={{ color: dark.placeholder }}
              />
            </Box>
            <Box>
              <Text fontSize="sm" color={dark.muted} mb={1}>Max price</Text>
              <Input
                name="maxPrice"
                type="number"
                min={0}
                step={0.01}
                placeholder="Any"
                defaultValue={searchParams.get('maxPrice') ?? ''}
                bg={dark.inputBg}
                borderColor={dark.borderSubtle}
                color="white"
                _placeholder={{ color: dark.placeholder }}
              />
            </Box>
            <Box>
              <Text fontSize="sm" color={dark.muted} mb={1}>Status</Text>
              <select
                name="status"
                defaultValue={searchParams.get('status') ?? DEFAULT_STATUS}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: dark.inputBg,
                  border: `1px solid ${dark.borderSubtle}`,
                  borderRadius: '6px',
                  color: 'white',
                }}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value || 'any'} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Box>
            <DateFilterPicker
              label="Closing after"
              textSize="sm"
              name="closingAfter"
              value={closingAfter}
              onValueChange={setClosingAfter}
            />
            <DateFilterPicker
              label="Closing before"
              textSize="sm"
              name="closingBefore"
              value={closingBefore}
              onValueChange={setClosingBefore}
            />
            <Box>
              <Text fontSize="sm" color={dark.muted} mb={1}>Seller</Text>
              <Input
                name="seller"
                placeholder="Username"
                defaultValue={searchParams.get('seller') ?? ''}
                bg={dark.inputBg}
                borderColor={dark.borderSubtle}
                color="white"
                _placeholder={{ color: dark.placeholder }}
              />
            </Box>
            <Box>
              <Text fontSize="sm" color={dark.muted} mb={1}>Sort</Text>
              <select
                name="sort"
                defaultValue={searchParams.get('sort') ?? ''}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: dark.inputBg,
                  border: `1px solid ${dark.borderSubtle}`,
                  borderRadius: '6px',
                  color: 'white',
                }}
              >
                {allSortOptions.map((o) => (
                  <option key={o.value || 'default'} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Box>
          </SimpleGrid>

          <Box mt={4} pt={4} borderTopWidth="1px" borderColor={dark.borderSubtle}>
              <Text fontSize="sm" fontWeight="medium" color={dark.muted} mb={3}>Car filters</Text>
              <SimpleGrid columns={carFilterColumns} gap={4}>
                <Box>
                  <Text fontSize="xs" color={dark.muted} mb={1}>Make</Text>
                  <Input
                    placeholder="e.g. Toyota"
                    value={makeInput}
                    onChange={(e) => setMakeInput(e.target.value)}
                    onBlur={() => setTimeout(() => setMakeSuggestions([]), 150)}
                    bg={dark.inputBg}
                    borderColor={dark.borderSubtle}
                    color="white"
                    _placeholder={{ color: dark.placeholder }}
                  />
                  {makeSuggestions.length > 0 && (
                    <Box mt={1} bg={dark.cardBg} borderWidth="1px" borderColor={dark.borderSubtle} borderRadius="md" maxH="120px" overflowY="auto">
                      {makeSuggestions.map((s) => (
                        <Box
                          key={s}
                          px={2}
                          py={1}
                          cursor="pointer"
                          color="white"
                          _hover={{ bg: 'whiteAlpha.100' }}
                          onClick={() => {
                            setMakeInput(s)
                            setMakeSuggestions([])
                          }}
                        >
                          {s}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
                <Box>
                  <Text fontSize="xs" color={dark.muted} mb={1}>Model</Text>
                  <Input
                    placeholder="e.g. Camry"
                    value={modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                    onBlur={() => setTimeout(() => setModelSuggestions([]), 150)}
                    bg={dark.inputBg}
                    borderColor={dark.borderSubtle}
                    color="white"
                    _placeholder={{ color: dark.placeholder }}
                  />
                  {modelSuggestions.length > 0 && (
                    <Box mt={1} bg={dark.cardBg} borderWidth="1px" borderColor={dark.borderSubtle} borderRadius="md" maxH="120px" overflowY="auto">
                      {modelSuggestions.map((s) => (
                        <Box
                          key={s}
                          px={2}
                          py={1}
                          cursor="pointer"
                          color="white"
                          _hover={{ bg: 'whiteAlpha.100' }}
                          onClick={() => {
                            setModelInput(s)
                            setModelSuggestions([])
                          }}
                        >
                          {s}
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
                <Box>
                  <Text fontSize="xs" color={dark.muted} mb={1}>Year range</Text>
                  <Flex gap={2}>
                    <Input
                      name="yearMin"
                      type="number"
                      placeholder="Min"
                      defaultValue={searchParams.get('yearMin') ?? ''}
                      bg={dark.inputBg}
                      borderColor={dark.borderSubtle}
                      color="white"
                      _placeholder={{ color: dark.placeholder }}
                    />
                    <Input
                      name="yearMax"
                      type="number"
                      placeholder="Max"
                      defaultValue={searchParams.get('yearMax') ?? ''}
                      bg={dark.inputBg}
                      borderColor={dark.borderSubtle}
                      color="white"
                      _placeholder={{ color: dark.placeholder }}
                    />
                  </Flex>
                </Box>
                <Box>
                  <Text fontSize="xs" color={dark.muted} mb={1}>Mileage max</Text>
                  <Input
                    name="mileageMax"
                    type="number"
                    min={0}
                    placeholder="e.g. 50000"
                    defaultValue={searchParams.get('mileageMax') ?? ''}
                    bg={dark.inputBg}
                    borderColor={dark.borderSubtle}
                    color="white"
                    _placeholder={{ color: dark.placeholder }}
                  />
                </Box>
                <Box>
                  <Text fontSize="xs" color={dark.muted} mb={1}>Exterior color</Text>
                  <Input
                    name="exteriorColor"
                    placeholder="Color"
                    defaultValue={searchParams.get('exteriorColor') ?? ''}
                    bg={dark.inputBg}
                    borderColor={dark.borderSubtle}
                    color="white"
                    _placeholder={{ color: dark.placeholder }}
                  />
                </Box>
              </SimpleGrid>
              <Box mt={3}>
                <Flex justify="space-between" align="center" mb={2}>
                  <Text fontSize="xs" color={dark.muted}>Condition</Text>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    color={dark.muted}
                    _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                    onClick={() => setIsConditionSelected(false)}
                  >
                    Clear
                  </Button>
                </Flex>
                <Slider.Root
                  min={0}
                  max={CONDITION_OPTIONS.length - 1}
                  step={1}
                  value={[conditionSliderIndex]}
                  onValueChange={onConditionSliderChange}
                >
                  <Slider.Control py={2}>
                    <Slider.Track h="6px" bg="whiteAlpha.200" borderRadius="full">
                      <Slider.Range bg="brand.500" />
                    </Slider.Track>
                    <Slider.Thumb
                      index={0}
                      boxSize={5}
                      bg="white"
                      borderWidth="2px"
                      borderColor={dark.cardBg}
                    />
                  </Slider.Control>
                </Slider.Root>
                <SimpleGrid columns={6} mt={2} gap={1}>
                  {CONDITION_OPTIONS.map((option, idx) => (
                    <Text
                      key={option}
                      fontSize="2xs"
                      textAlign="center"
                      color={isConditionSelected && idx === conditionSliderIndex ? 'white' : dark.muted}
                      fontWeight={isConditionSelected && idx === conditionSliderIndex ? 'semibold' : 'normal'}
                    >
                      {option}
                    </Text>
                  ))}
                </SimpleGrid>
              </Box>
              <Box mt={2}>
                <Text fontSize="xs" color={dark.muted} mb={1}>Transmission</Text>
                <select
                  name="transmission"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: dark.inputBg,
                    border: `1px solid ${dark.borderSubtle}`,
                    borderRadius: '6px',
                    color: 'white',
                  }}
                  defaultValue={searchParams.get('transmission') ?? ''}
                >
                  <option value="">Any transmission</option>
                  {TRANSMISSION_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Box>
              <Box mt={2}>
                <Text fontSize="xs" color={dark.muted} mb={1}>Fuel type</Text>
                <select
                  name="fuelType"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: dark.inputBg,
                    border: `1px solid ${dark.borderSubtle}`,
                    borderRadius: '6px',
                    color: 'white',
                  }}
                  defaultValue={searchParams.get('fuelType') ?? ''}
                >
                  <option value="">Any fuel type</option>
                  {FUEL_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </Box>
            </Box>
        </>
      )}

        {variant === 'filters' ? (
          <Flex mt={4} direction="column" gap={2}>
            <Button
              type="submit"
              bg="brand.500"
              color="white"
              _hover={{ bg: 'brand.400' }}
              w="full"
            >
              Apply Filters
            </Button>
            <Button
              type="button"
              variant="outline"
              borderColor="red.400"
              color="red.300"
              _hover={{ bg: 'red.500', color: 'white', borderColor: 'red.500' }}
              w="full"
              onClick={resetAllFilters}
            >
              Reset All Filters
            </Button>
          </Flex>
        ) : (
          <Flex mt={4} justify="flex-end">
            <Button
              type="submit"
              bg="brand.500"
              color="white"
              _hover={{ bg: 'brand.400' }}
            >
              Search
            </Button>
          </Flex>
        )}
      </Box>
      )}
    </Box>
  )
}
