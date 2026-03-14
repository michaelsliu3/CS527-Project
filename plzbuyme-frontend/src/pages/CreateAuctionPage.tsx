import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Input,
  SimpleGrid,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import { createAuction, type CreateAuctionDto } from '../api/auctions'
import { CAR_CATEGORIES, getFieldsForCategory } from '../constants/categories'
import { dark } from '../theme/colors'
import { isAxiosError } from 'axios'

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

export function CreateAuctionPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fieldDefs = categoryId ? getFieldsForCategory(Number(categoryId)) : []

  const { register, handleSubmit, watch } = useForm<CreateFormValues>({
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

  const watchedCategoryId = watch('categoryId')
  useEffect(() => {
    setCategoryId(watchedCategoryId ? Number(watchedCategoryId) : '')
  }, [watchedCategoryId])

  if (!user) {
    return (
      <Container maxW="container.md">
        <Text color={dark.muted}>Please log in to create an auction.</Text>
      </Container>
    )
  }

  const onSubmit = async (data: CreateFormValues) => {
    const catId = Number(data.categoryId)
    if (!catId) {
      setSubmitError('Please select a category.')
      return
    }
    setSubmitError(null)
    setSubmitting(true)
    const fields = getFieldsForCategory(catId)
    const fieldValues = fields
      .map((f) => ({
        fieldId: f.id,
        value: data[`field_${f.id}` as keyof CreateFormValues] as string,
      }))
      .filter((fv) => fv.value != null && String(fv.value).trim() !== '')

    const dto: CreateAuctionDto = {
      title: data.title.trim(),
      description: data.description.trim() || undefined,
      categoryId: catId,
      initialPrice: Number(data.initialPrice),
      bidIncrement: Number(data.bidIncrement),
      reservePrice: Number(data.reservePrice),
      closeDateTime: new Date(data.closeDateTime).toISOString(),
      fieldValues,
    }

    try {
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
  const minCloseStr = minClose.toISOString().slice(0, 16)

  return (
    <Container maxW="container.md">
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
            {...register('categoryId', { required: true })}
          >
            <option value="">Select category</option>
            {CAR_CATEGORIES.filter((c) => c.parentId !== null).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Box>

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
          <Input
            type="datetime-local"
            min={minCloseStr}
            bg={dark.inputBg}
            borderColor={dark.borderSubtle}
            color="white"
            {...register('closeDateTime', { required: true })}
          />
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
