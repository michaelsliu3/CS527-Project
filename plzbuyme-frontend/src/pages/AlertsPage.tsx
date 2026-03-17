import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Container,
  Dialog,
  Flex,
  IconButton,
  Input,
  NativeSelect,
  SimpleGrid,
  Spinner,
  Text,
  Textarea,
  useDisclosure,
} from '@chakra-ui/react'
import { showErrorToast, showSuccessToast } from '../components/ui/toaster'
import { useForm, Controller } from 'react-hook-form'
import { HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi'
import { listAlerts, createAlert, deleteAlert, type AlertResponse, type CreateAlertDto } from '../api/alerts'
import { CAR_CATEGORIES } from '../constants/categories'
import { dark } from '../theme/colors'
import { isAxiosError } from 'axios'

interface CreateAlertFormValues {
  categoryId: string
  keyword: string
  criteria: string
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const createDialog = useDisclosure()
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, reset, control } = useForm<CreateAlertFormValues>({
    defaultValues: { categoryId: '', keyword: '', criteria: '' },
  })

  const fetchAlerts = () => {
    setLoading(true)
    setError(null)
    listAlerts()
      .then((res) => setAlerts(res.data))
      .catch(() => {
        setError('Failed to load alerts.')
        showErrorToast('Error', 'Failed to load alerts.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAlerts()
  }, [])

  const onSubmitCreate = async (data: CreateAlertFormValues) => {
    const criteriaTrimmed = data.criteria.trim()
    if (criteriaTrimmed) {
      try {
        JSON.parse(criteriaTrimmed)
      } catch {
        showErrorToast('Invalid criteria', 'Criteria must be valid JSON (e.g. {"fieldId": "value"}).')
        return
      }
    }
    setSubmitting(true)
    const dto: CreateAlertDto = {
      categoryId: data.categoryId ? Number(data.categoryId) : null,
      keyword: data.keyword.trim() || null,
      criteria: criteriaTrimmed || null,
    }
    try {
      await createAlert(dto)
      showSuccessToast('Alert created')
      createDialog.onClose()
      reset()
      fetchAlerts()
    } catch (err) {
      if (isAxiosError(err) && err.response?.data) {
        const msg = typeof err.response.data === 'string' ? err.response.data : 'Failed to create alert.'
        showErrorToast('Error', msg)
      } else {
        showErrorToast('Error', 'Failed to create alert.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteClick = (id: number) => setDeleteId(id)
  const handleDeleteConfirm = async () => {
    if (deleteId == null) return
    try {
      await deleteAlert(deleteId)
      showSuccessToast('Alert deleted')
      setDeleteId(null)
      fetchAlerts()
    } catch {
      showErrorToast('Error', 'Failed to delete alert.')
    }
  }

  const categoryName = (categoryId: number | null) => {
    if (categoryId == null) return 'Any category'
    return CAR_CATEGORIES.find((c) => c.id === categoryId)?.name ?? `Category ${categoryId}`
  }

  return (
    <Container maxW="container.lg">
      <Flex justify="space-between" align="center" mb={6}>
        <Text fontSize="2xl" fontWeight="bold" color="white">
          My alerts
        </Text>
        <Button
          size="sm"
          variant="outline"
          borderColor={dark.borderSubtle}
          color="white"
          _hover={{ bg: 'whiteAlpha.100' }}
          onClick={createDialog.onOpen}
        >
          <HiOutlinePlus style={{ marginRight: 6 }} />
          Create alert
        </Button>
      </Flex>

      {error && (
        <Text color="red.400" mb={4}>
          {error}
        </Text>
      )}

      {loading ? (
        <Flex justify="center" py={12}>
          <Spinner size="xl" color="brand.400" />
        </Flex>
      ) : alerts.length === 0 ? (
        <Text color={dark.muted} py={8} textAlign="center">
          No alerts. Create one to get notified when matching items are listed.
        </Text>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          {alerts.map((alert) => (
            <Box
              key={alert.id}
              p={4}
              bg={dark.cardBg}
              borderRadius="md"
              borderWidth="1px"
              borderColor={dark.borderSubtle}
            >
              <Flex justify="space-between" align="flex-start">
                <Box>
                  <Text fontWeight="medium" color="white">
                    {categoryName(alert.categoryId)}
                  </Text>
                  {alert.keyword && (
                    <Text fontSize="sm" color={dark.muted}>
                      Keyword: {alert.keyword}
                    </Text>
                  )}
                  {alert.criteria && (
                    <Text fontSize="sm" color={dark.muted} lineClamp={2}>
                      Criteria: {alert.criteria}
                    </Text>
                  )}
                  <Text fontSize="xs" color={dark.placeholder} mt={1}>
                    Created {new Date(alert.createdAt).toLocaleDateString()}
                  </Text>
                </Box>
                <IconButton
                  aria-label="Delete alert"
                  variant="ghost"
                  size="sm"
                  color={dark.muted}
                  _hover={{ color: 'red.400' }}
                  onClick={() => handleDeleteClick(alert.id)}
                >
                  <HiOutlineTrash />
                </IconButton>
              </Flex>
            </Box>
          ))}
        </SimpleGrid>
      )}

      <Dialog.Root open={createDialog.open} onOpenChange={({ open: isOpen }) => { if (!isOpen) createDialog.onClose() }} size="md">
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg={dark.cardBg} borderColor={dark.borderSubtle} borderWidth="1px">
            <Dialog.Header color="white">Create alert</Dialog.Header>
            <Dialog.Body>
              <form id="create-alert-form" onSubmit={handleSubmit(onSubmitCreate)}>
                <Flex direction="column" gap={4}>
                  <Box>
                    <Text mb={2} color={dark.label} fontSize="sm">
                      Category (optional)
                    </Text>
                    <Controller
                      name="categoryId"
                      control={control}
                      defaultValue=""
                      render={({ field }) => (
                        <NativeSelect.Root
                          value={field.value}
                          onValueChange={(e) => field.onChange(e.value)}
                          size="md"
                        >
                          <NativeSelect.Field
                            bg={dark.inputBg}
                            borderColor={dark.borderSubtle}
                            color="white"
                          >
                            <option value="">Any category</option>
                            {CAR_CATEGORIES.map((c) => (
                              <option key={c.id} value={String(c.id)}>
                                {c.name}
                              </option>
                            ))}
                          </NativeSelect.Field>
                          <NativeSelect.Indicator />
                        </NativeSelect.Root>
                      )}
                    />
                  </Box>
                  <Box>
                    <Text mb={2} color={dark.label} fontSize="sm">
                      Keyword (optional)
                    </Text>
                    <Input
                      {...register('keyword')}
                      placeholder="e.g. Toyota"
                      bg={dark.inputBg}
                      borderColor={dark.borderSubtle}
                      color="white"
                      _placeholder={{ color: dark.placeholder }}
                    />
                  </Box>
                  <Box>
                    <Text mb={2} color={dark.label} fontSize="sm">
                      Criteria JSON (optional)
                    </Text>
                    <Textarea
                      {...register('criteria')}
                      placeholder='e.g. {"fieldId": "value"}'
                      bg={dark.inputBg}
                      borderColor={dark.borderSubtle}
                      color="white"
                      _placeholder={{ color: dark.placeholder }}
                      rows={3}
                    />
                  </Box>
                </Flex>
              </form>
            </Dialog.Body>
            <Dialog.Footer borderColor={dark.borderSubtle}>
              <Button
                variant="outline"
                borderColor={dark.borderSubtle}
                color="white"
                _hover={{ bg: 'whiteAlpha.100' }}
                onClick={createDialog.onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="create-alert-form"
                bg="brand.500"
                color="white"
                _hover={{ bg: 'brand.400' }}
                loading={submitting}
              >
                Create
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <Dialog.Root open={deleteId != null} onOpenChange={(e) => !e.open && setDeleteId(null)} size="sm">
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg={dark.cardBg} borderColor={dark.borderSubtle} borderWidth="1px">
            <Dialog.Header color="white">Delete alert</Dialog.Header>
            <Dialog.Body>
              <Text color={dark.muted}>Are you sure you want to delete this alert?</Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" color={dark.muted} onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteConfirm}>
                Delete
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Container>
  )
}
