import { useState, useCallback, useEffect } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Icon,
  Input,
  Slider,
  SimpleGrid,
  Text,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import { HiChevronDown } from 'react-icons/hi'
import { useSearchParams } from 'react-router-dom'
import { getFieldValues } from '../api/auctions'
import { dark } from '../theme/colors'
import { fetchCategories, type CategoryDto } from '../api/categories'

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
  { value: '', label: 'Any' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'sold', label: 'Sold' },
]

const CONDITION_OPTIONS = ['New', 'Like New', 'Excellent', 'Good', 'Fair', 'Poor']
const TRANSMISSION_OPTIONS = ['Automatic', 'Manual', 'CVT']
const FUEL_OPTIONS = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid']
const PRICE_SLIDER_MIN = 0
const PRICE_SLIDER_MAX = 100000
const PRICE_SLIDER_DEFAULT_MAX = 50000
const QUICK_PRICE_PRESETS: Array<{ label: string; min: number; max: number }> = [
  { label: '<$10', min: PRICE_SLIDER_MIN, max: 10 },
  { label: '$10 - $50', min: 10, max: 50 },
  { label: '$50 - $250', min: 50, max: 250 },
  { label: '>$250', min: 250, max: PRICE_SLIDER_MAX },
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
  _expanded: { bg: 'transparent', color: 'white' },
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
}

export function SearchBar({ variant = 'full' }: SearchBarProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [categories, setCategories] = useState<CategoryDto[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [selectedRootId, setSelectedRootId] = useState<number | ''>('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>(() => {
    const fromQuery = searchParams.get('categoryId')
    return fromQuery ? Number(fromQuery) : ''
  })
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
  const [priceRange, setPriceRange] = useState<[number, number]>(() =>
    getPriceRangeFromSearchParams(searchParams)
  )

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
        const carsRoot = rootCategories.find((c) => c.name.toLowerCase() === 'cars')
        const existing = searchParams.get('categoryId')
        if (existing) {
          const idNum = Number(existing)
          const root = rootCategories.find((c) => c.id === idNum)
          if (root) {
            setSelectedRootId(root.id)
            if (carsRoot && root.id === carsRoot.id) {
              setSelectedCategoryId('')
            } else {
              setSelectedCategoryId(root.id)
            }
          } else {
            const child = data.find((c) => c.id === idNum)
            if (child) {
              setSelectedCategoryId(child.id)
              const parent = data.find((c) => c.id === child.parentId)
              if (parent) setSelectedRootId(parent.id)
            }
          }
        } else if (carsRoot) {
          setSelectedRootId(carsRoot.id)
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
  }, [searchParams])

  useEffect(() => {
    setPriceRange(getPriceRangeFromSearchParams(searchParams))
  }, [searchParams])

  const rootCategories = categories.filter((c) => c.parentId === null)
  const carsRootCategory = rootCategories.find((c) => c.name.toLowerCase() === 'cars')
  const topBarCategories =
    carsRootCategory?.children?.length
      ? [
          { id: carsRootCategory.id, name: 'All Cars' },
          ...carsRootCategory.children.map((child) => ({ id: child.id, name: child.name })),
        ]
      : rootCategories.map((root) => ({ id: root.id, name: root.name }))

  const selectedRoot: CategoryDto | undefined =
    typeof selectedRootId === 'number'
      ? rootCategories.find((c) => c.id === selectedRootId)
      : undefined

  const activeTopCategoryId =
    typeof selectedCategoryId === 'number' && carsRootCategory
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
    if (carsRootCategory && categoryId === carsRootCategory.id) {
      next.delete('categoryId')
    } else {
      next.set('categoryId', String(categoryId))
    }
    next.set('page', '1')
    setSearchParams(next)

    if (carsRootCategory && categoryId !== carsRootCategory.id) {
      setSelectedRootId(carsRootCategory.id)
      setSelectedCategoryId(categoryId)
    } else {
      setSelectedRootId(categoryId)
      setSelectedCategoryId('')
    }
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
    const condition: string[] = []
    const transmission: string[] = []
    const fuelType: string[] = []
    form.querySelectorAll<HTMLInputElement>('input[name="condition"]:checked').forEach((el) => condition.push(el.value))
    form.querySelectorAll<HTMLInputElement>('input[name="transmission"]:checked').forEach((el) => transmission.push(el.value))
    form.querySelectorAll<HTMLInputElement>('input[name="fuelType"]:checked').forEach((el) => fuelType.push(el.value))
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
      closingBefore: (form.elements.namedItem('closingBefore') as HTMLInputElement)?.value || undefined,
      closingAfter: (form.elements.namedItem('closingAfter') as HTMLInputElement)?.value || undefined,
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
    setSearchParams(next)
    setSelectedRootId('')
    setSelectedCategoryId('')
    setMakeInput('')
    setModelInput('')
    setMakeSuggestions([])
    setModelSuggestions([])
    setPriceRange([PRICE_SLIDER_MIN, PRICE_SLIDER_DEFAULT_MAX])
  }

  const allSortOptions = [...SORT_OPTIONS, ...CAR_SORT_OPTIONS]
  const showTopBar = variant !== 'filters'
  const showFilters = variant !== 'top'
  const formColumns = variant === 'filters' ? 1 : { base: 1, md: 2, lg: 4 }
  const carFilterColumns = variant === 'filters' ? 1 : { base: 1, md: 2, lg: 4 }

  return (
    <Box mb={variant === 'top' ? 3 : 0}>
      {showTopBar && (
      <Box
        bg={dark.cardBg}
        borderWidth="1px"
        borderColor={dark.borderSubtle}
        borderRadius="sm"
        overflow="hidden"
        mb={showFilters ? 3 : 0}
        w="full"
      >
        <Flex w="full">
          {topBarCategories.map((category, index) => {
            const isActive = activeTopCategoryId === category.id
            const isFirst = index === 0
            const isLast = index === topBarCategories.length - 1
            return (
              <Button
                key={category.id}
                size="sm"
                flex={1}
                minW={0}
                variant="ghost"
                borderRadius={0}
                borderLeftRadius={isFirst ? 'xs' : 0}
                borderRightRadius={isLast ? 'xs' : 0}
                borderRightWidth={isLast ? '0' : '1px'}
                borderRightColor={dark.borderSubtle}
                bg={isActive ? 'brand.500' : 'transparent'}
                color="white"
                fontWeight={isActive ? 'semibold' : 'medium'}
                px={2}
                _hover={{
                  bg: isActive ? 'brand.400' : 'whiteAlpha.100',
                }}
                _focus={{ boxShadow: 'none', outline: 'none' }}
                _focusVisible={{ boxShadow: 'none', outline: 'none' }}
                onClick={() => handleTopCategorySelect(category.id)}
                disabled={categoriesLoading || !!categoriesError}
              >
                {category.name}
              </Button>
            )
          })}
        </Flex>
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
                  py={openSections.price ? 4 : 0}
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
                  py={openSections.listing ? 4 : 0}
                  overflow="hidden"
                  minH={0}
                >
                  <Box>
                    <Text fontSize="xs" color={dark.muted} mb={1}>Status</Text>
                    <select
                      name="status"
                      defaultValue={searchParams.get('status') ?? ''}
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
                  <Box>
                    <Text fontSize="xs" color={dark.muted} mb={1}>Sort</Text>
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
                  <Box>
                    <Text fontSize="xs" color={dark.muted} mb={1}>Closing after</Text>
                    <Input
                      name="closingAfter"
                      type="datetime-local"
                      defaultValue={searchParams.get('closingAfter') ?? ''}
                      bg={dark.inputBg}
                      borderColor={dark.borderSubtle}
                      color="white"
                    />
                  </Box>
                  <Box>
                    <Text fontSize="xs" color={dark.muted} mb={1}>Closing before</Text>
                    <Input
                      name="closingBefore"
                      type="datetime-local"
                      defaultValue={searchParams.get('closingBefore') ?? ''}
                      bg={dark.inputBg}
                      borderColor={dark.borderSubtle}
                      color="white"
                    />
                  </Box>
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
                      py={openSections.carBasics ? 4 : 0}
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
                    <Wrap
                      py={openSections.condition ? 4 : 0}
                      gap={2}
                      overflow="hidden"
                      minH={0}
                    >
                      {CONDITION_OPTIONS.map((c) => (
                        <WrapItem key={c}>
                          <Checkbox.Root
                            name="condition"
                            value={c}
                            defaultChecked={searchParams.getAll('condition').includes(c)}
                            variant="outline"
                          >
                            <Checkbox.HiddenInput />
                            <Checkbox.Control
                              borderColor={dark.borderSubtle}
                              bg={dark.inputBg}
                              color="white"
                              _hover={{ borderColor: 'brand.400', bg: 'whiteAlpha.100' }}
                              _checked={{
                                bg: 'brand.500',
                                borderColor: 'brand.500',
                                _hover: { bg: 'brand.400', borderColor: 'brand.400' },
                              }}
                            />
                            <Checkbox.Label ml={-0.5} pr={2.5}>
                              {c}
                            </Checkbox.Label>
                          </Checkbox.Root>
                        </WrapItem>
                      ))}
                    </Wrap>
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
                    <Wrap
                      py={openSections.transmission ? 4 : 0}
                      gap={2}
                      overflow="hidden"
                      minH={0}
                    >
                      {TRANSMISSION_OPTIONS.map((t) => (
                        <WrapItem key={t}>
                          <Checkbox.Root
                            name="transmission"
                            value={t}
                            defaultChecked={searchParams.getAll('transmission').includes(t)}
                            variant="outline"
                          >
                            <Checkbox.HiddenInput />
                            <Checkbox.Control
                              borderColor={dark.borderSubtle}
                              bg={dark.inputBg}
                              color="white"
                              _hover={{ borderColor: 'brand.400', bg: 'whiteAlpha.100' }}
                              _checked={{
                                bg: 'brand.500',
                                borderColor: 'brand.500',
                                _hover: { bg: 'brand.400', borderColor: 'brand.400' },
                              }}
                            />
                            <Checkbox.Label ml={0} pr={2}>
                              {t}
                            </Checkbox.Label>
                          </Checkbox.Root>
                        </WrapItem>
                      ))}
                    </Wrap>
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
                    <Wrap
                      py={openSections.fuelType ? 4 : 0}
                      gap={2}
                      overflow="hidden"
                      minH={0}
                    >
                      {FUEL_OPTIONS.map((f) => (
                        <WrapItem key={f}>
                          <Checkbox.Root
                            name="fuelType"
                            value={f}
                            defaultChecked={searchParams.getAll('fuelType').includes(f)}
                            variant="outline"
                          >
                            <Checkbox.HiddenInput />
                            <Checkbox.Control
                              borderColor={dark.borderSubtle}
                              bg={dark.inputBg}
                              color="white"
                              _hover={{ borderColor: 'brand.400', bg: 'whiteAlpha.100' }}
                              _checked={{
                                bg: 'brand.500',
                                borderColor: 'brand.500',
                                _hover: { bg: 'brand.400', borderColor: 'brand.400' },
                              }}
                            />
                            <Checkbox.Label ml={0} pr={2}>
                              {f}
                            </Checkbox.Label>
                          </Checkbox.Root>
                        </WrapItem>
                      ))}
                    </Wrap>
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
                defaultValue={searchParams.get('status') ?? ''}
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
            <Box>
              <Text fontSize="sm" color={dark.muted} mb={1}>Closing after</Text>
              <Input
                name="closingAfter"
                type="datetime-local"
                defaultValue={searchParams.get('closingAfter') ?? ''}
                bg={dark.inputBg}
                borderColor={dark.borderSubtle}
                color="white"
              />
            </Box>
            <Box>
              <Text fontSize="sm" color={dark.muted} mb={1}>Closing before</Text>
              <Input
                name="closingBefore"
                type="datetime-local"
                defaultValue={searchParams.get('closingBefore') ?? ''}
                bg={dark.inputBg}
                borderColor={dark.borderSubtle}
                color="white"
              />
            </Box>
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
              <Wrap mt={3} gap={2}>
                <Text fontSize="xs" color={dark.muted} w="100%">Condition</Text>
                {CONDITION_OPTIONS.map((c) => (
                  <WrapItem key={c}>
                    <Checkbox.Root
                      name="condition"
                      value={c}
                      defaultChecked={searchParams.getAll('condition').includes(c)}
                      variant="outline"
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control
                        borderColor={dark.borderSubtle}
                        bg={dark.inputBg}
                        color="white"
                        _hover={{ borderColor: 'brand.400', bg: 'whiteAlpha.100' }}
                        _checked={{
                          bg: 'brand.500',
                          borderColor: 'brand.500',
                          _hover: { bg: 'brand.400', borderColor: 'brand.400' },
                        }}
                      />
                      <Checkbox.Label ml={-0.5} pr={2.5}>
                        {c}
                      </Checkbox.Label>
                    </Checkbox.Root>
                  </WrapItem>
                ))}
              </Wrap>
              <Wrap mt={2} gap={2}>
                <Text fontSize="xs" color={dark.muted} w="100%">Transmission</Text>
                {TRANSMISSION_OPTIONS.map((t) => (
                  <WrapItem key={t}>
                    <Checkbox.Root
                      name="transmission"
                      value={t}
                      defaultChecked={searchParams.getAll('transmission').includes(t)}
                      variant="outline"
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control
                        borderColor={dark.borderSubtle}
                        bg={dark.inputBg}
                        color="white"
                        _hover={{ borderColor: 'brand.400', bg: 'whiteAlpha.100' }}
                        _checked={{
                          bg: 'brand.500',
                          borderColor: 'brand.500',
                          _hover: { bg: 'brand.400', borderColor: 'brand.400' },
                        }}
                      />
                      <Checkbox.Label ml={0} pr={2}>
                        {t}
                      </Checkbox.Label>
                    </Checkbox.Root>
                  </WrapItem>
                ))}
              </Wrap>
              <Wrap mt={2} gap={2}>
                <Text fontSize="xs" color={dark.muted} w="100%">Fuel type</Text>
                {FUEL_OPTIONS.map((f) => (
                  <WrapItem key={f}>
                    <Checkbox.Root
                      name="fuelType"
                      value={f}
                      defaultChecked={searchParams.getAll('fuelType').includes(f)}
                      variant="outline"
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control
                        borderColor={dark.borderSubtle}
                        bg={dark.inputBg}
                        color="white"
                        _hover={{ borderColor: 'brand.400', bg: 'whiteAlpha.100' }}
                        _checked={{
                          bg: 'brand.500',
                          borderColor: 'brand.500',
                          _hover: { bg: 'brand.400', borderColor: 'brand.400' },
                        }}
                      />
                      <Checkbox.Label ml={0} pr={2}>
                        {f}
                      </Checkbox.Label>
                    </Checkbox.Root>
                  </WrapItem>
                ))}
              </Wrap>
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
