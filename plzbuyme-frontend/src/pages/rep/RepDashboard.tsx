import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Container,
  Flex,
  Input,
  Table,
  Tabs,
  Text,
  Badge,
  Dialog,
  Spinner,
  useDisclosure,
} from '@chakra-ui/react'
import { useForm } from 'react-hook-form'
import { isAxiosError } from 'axios'
import {
  getRepUsers,
  editRepUser,
  deleteRepUser,
  resetRepUserPassword,
  deleteRepBid,
  deleteRepAuction,
  type UserSummary,
  type EditUserDto,
} from '../../api/rep'
import { listQuestions, replyToQuestion, type QuestionResponse } from '../../api/questions'
import { browseAuctions, getAuction, type AuctionListItem, type AuctionDetail, type BidHistoryItem } from '../../api/auctions'
import { showErrorToast, showSuccessToast } from '../../components/ui/toaster'
import { dark } from '../../theme/colors'

const PAGE_SIZE = 10

export function RepDashboard() {
  return (
    <Container maxW="container.xl" py={6}>
      <Text fontSize="2xl" fontWeight="bold" color="white" mb={6}>
        Rep Dashboard
      </Text>
      <Tabs.Root defaultValue="users" variant="line" colorPalette="brand">
        <Tabs.List borderColor={dark.borderSubtle} gap={2}>
          <Tabs.Trigger value="users">Users</Tabs.Trigger>
          <Tabs.Trigger value="questions">Questions</Tabs.Trigger>
          <Tabs.Trigger value="auctions">Auctions</Tabs.Trigger>
        </Tabs.List>
        <Box pt={4}>
          <Tabs.Content value="users">
            <RepUsersTab />
          </Tabs.Content>
          <Tabs.Content value="questions">
            <RepQuestionsTab />
          </Tabs.Content>
          <Tabs.Content value="auctions">
            <RepAuctionsTab />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Container>
  )
}

function RepUsersTab() {
  const [users, setUsers] = useState<UserSummary[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editUser, setEditUser] = useState<UserSummary | null>(null)
  const [resetUser, setResetUser] = useState<UserSummary | null>(null)
  const [deleteUser, setDeleteUser] = useState<UserSummary | null>(null)

  const fetchUsers = () => {
    setLoading(true)
    getRepUsers({ search: search || undefined, page, pageSize: PAGE_SIZE })
      .then((res) => {
        setUsers(res.data.items)
        setTotalCount(res.data.totalCount)
      })
      .catch(() => showErrorToast('Error', 'Failed to load users.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsers()
  }, [page, search])

  const handleEditSuccess = () => {
    setEditUser(null)
    fetchUsers()
  }
  const handleResetSuccess = () => {
    setResetUser(null)
  }
  const handleDeleteSuccess = () => {
    setDeleteUser(null)
    fetchUsers()
  }

  return (
    <Box>
      <Flex mb={4} gap={2} align="center">
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          bg={dark.inputBg}
          borderColor={dark.borderSubtle}
          color="white"
          _placeholder={{ color: dark.placeholder }}
          size="sm"
          w="200px"
        />
      </Flex>
      {loading ? (
        <Flex justify="center" py={8}>
          <Spinner color="brand.400" />
        </Flex>
      ) : (
        <>
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row borderColor={dark.borderSubtle}>
                <Table.ColumnHeader color={dark.muted}>Username</Table.ColumnHeader>
                <Table.ColumnHeader color={dark.muted}>Email</Table.ColumnHeader>
                <Table.ColumnHeader color={dark.muted}>Active</Table.ColumnHeader>
                <Table.ColumnHeader color={dark.muted}>Created</Table.ColumnHeader>
                <Table.ColumnHeader color={dark.muted}>Actions</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {users.map((u) => (
                <Table.Row key={u.id} borderColor={dark.borderSubtle}>
                  <Table.Cell color="white">{u.username}</Table.Cell>
                  <Table.Cell color={dark.label}>{u.email}</Table.Cell>
                  <Table.Cell>
                    <Badge colorPalette={u.isActive ? 'green' : 'red'} size="sm">
                      {u.isActive ? 'Yes' : 'No'}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell color={dark.muted} fontSize="sm">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </Table.Cell>
                  <Table.Cell>
                    <Flex gap={2}>
                      <Button size="xs" variant="outline" colorScheme="brand" onClick={() => setEditUser(u)}>
                        Edit
                      </Button>
                      <Button size="xs" variant="outline" colorScheme="brand" onClick={() => setResetUser(u)}>
                        Reset PW
                      </Button>
                      <Button size="xs" variant="outline" colorPalette="red" onClick={() => setDeleteUser(u)}>
                        Delete
                      </Button>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          {totalCount > PAGE_SIZE && (
            <Flex justify="space-between" align="center" mt={4}>
              <Text color={dark.muted} fontSize="sm">
                {totalCount} total
              </Text>
              <Flex gap={2}>
                <Button size="sm" isDisabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" isDisabled={page * PAGE_SIZE >= totalCount} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </Flex>
            </Flex>
          )}
        </>
      )}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSuccess={handleEditSuccess}
          onError={(msg) => showErrorToast('Error', msg)}
        />
      )}
      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onSuccess={handleResetSuccess}
          onError={(msg) => showErrorToast('Error', msg)}
        />
      )}
      {deleteUser && (
        <DeleteUserModal
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onSuccess={handleDeleteSuccess}
          onError={(msg) => showErrorToast('Error', msg)}
        />
      )}
    </Box>
  )
}

interface EditUserModalProps {
  user: UserSummary
  onClose: () => void
  onSuccess: () => void
  onError: (msg: string) => void
}

function EditUserModal({ user, onClose, onSuccess, onError }: EditUserModalProps) {
  const { register, handleSubmit, formState } = useForm<EditUserDto>({
    defaultValues: { username: user.username, email: user.email },
  })

  const onSubmit = async (data: EditUserDto) => {
    try {
      await editRepUser(user.id, { username: data.username.trim(), email: data.email.trim() })
      showSuccessToast('User updated')
      onSuccess()
    } catch (err) {
      if (isAxiosError(err) && err.response?.data) {
        onError(typeof err.response.data === 'string' ? err.response.data : 'Failed to update user.')
      } else {
        onError('Failed to update user.')
      }
    }
  }

  return (
    <Dialog.Root open onOpenChange={({ open }) => { if (!open) onClose() }}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content bg={dark.cardBg} borderColor={dark.borderSubtle} borderWidth="1px">
          <Dialog.Header color="white">Edit User</Dialog.Header>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Dialog.Body>
              <Flex direction="column" gap={4}>
                <Box>
                  <Text mb={1} color={dark.label} fontSize="sm">Username</Text>
                  <Input
                    {...register('username', { required: 'Required' })}
                    bg={dark.inputBg}
                    borderColor={dark.borderSubtle}
                    color="white"
                  />
                  {formState.errors.username && (
                    <Text fontSize="sm" color="red.400">{formState.errors.username.message}</Text>
                  )}
                </Box>
                <Box>
                  <Text mb={1} color={dark.label} fontSize="sm">Email</Text>
                  <Input
                    type="email"
                    {...register('email', { required: 'Required' })}
                    bg={dark.inputBg}
                    borderColor={dark.borderSubtle}
                    color="white"
                  />
                  {formState.errors.email && (
                    <Text fontSize="sm" color="red.400">{formState.errors.email.message}</Text>
                  )}
                </Box>
              </Flex>
            </Dialog.Body>
            <Dialog.Footer borderColor={dark.borderSubtle}>
              <Button variant="ghost" color={dark.muted} onClick={onClose}>Cancel</Button>
              <Button type="submit" colorScheme="brand" loading={formState.isSubmitting}>Save</Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}

function ResetPasswordModal({
  user,
  onClose,
  onSuccess,
  onError,
}: {
  user: UserSummary
  onClose: () => void
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      onError('Password must be at least 6 characters.')
      return
    }
    setSubmitting(true)
    try {
      await resetRepUserPassword(user.id, { newPassword: password })
      showSuccessToast('Password reset')
      onSuccess()
      onClose()
    } catch (err) {
      if (isAxiosError(err) && err.response?.data) {
        onError(typeof err.response.data === 'string' ? err.response.data : 'Failed to reset password.')
      } else {
        onError('Failed to reset password.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={({ open }) => { if (!open) onClose() }}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content bg={dark.cardBg} borderColor={dark.borderSubtle} borderWidth="1px">
          <Dialog.Header color="white">Reset Password — {user.username}</Dialog.Header>
          <form onSubmit={onSubmit}>
            <Dialog.Body>
              <Box>
                <Text mb={1} color={dark.label} fontSize="sm">New password</Text>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  bg={dark.inputBg}
                  borderColor={dark.borderSubtle}
                  color="white"
                />
              </Box>
            </Dialog.Body>
            <Dialog.Footer borderColor={dark.borderSubtle}>
              <Button variant="ghost" color={dark.muted} onClick={onClose}>Cancel</Button>
              <Button type="submit" colorScheme="brand" loading={submitting} disabled={password.length < 6}>
                Reset
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}

function DeleteUserModal({
  user,
  onClose,
  onSuccess,
  onError,
}: {
  user: UserSummary
  onClose: () => void
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const [submitting, setSubmitting] = useState(false)

  const onConfirm = async () => {
    setSubmitting(true)
    try {
      await deleteRepUser(user.id)
      showSuccessToast('User removed')
      onSuccess()
      onClose()
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) {
        onError('User not found.')
      } else {
        onError('Failed to delete user.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={({ open }) => { if (!open) onClose() }}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content bg={dark.cardBg} borderColor={dark.borderSubtle} borderWidth="1px">
          <Dialog.Header color="white">Delete user?</Dialog.Header>
          <Dialog.Body>
            <Text color={dark.label}>
              Soft-delete user &quot;{user.username}&quot;? They will no longer be able to log in.
            </Text>
          </Dialog.Body>
          <Dialog.Footer borderColor={dark.borderSubtle}>
            <Button variant="ghost" color={dark.muted} onClick={onClose}>Cancel</Button>
            <Button colorPalette="red" onClick={onConfirm} loading={submitting}>
              Delete
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}

function RepQuestionsTab() {
  const [questions, setQuestions] = useState<QuestionResponse[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [replyingId, setReplyingId] = useState<number | null>(null)

  const fetchQuestions = () => {
    setLoading(true)
    listQuestions(keyword || undefined)
      .then((res) => {
        const list = res.data as QuestionResponse[]
        setQuestions([...list].sort((a, b) => (a.reply ? 1 : 0) - (b.reply ? 1 : 0)))
      })
      .catch(() => showErrorToast('Error', 'Failed to load questions.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchQuestions()
  }, [keyword])

  return (
    <Box>
      <Flex mb={4}>
        <Input
          placeholder="Search by keyword..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          bg={dark.inputBg}
          borderColor={dark.borderSubtle}
          color="white"
          _placeholder={{ color: dark.placeholder }}
          size="sm"
          w="200px"
        />
      </Flex>
      {loading ? (
        <Flex justify="center" py={8}>
          <Spinner color="brand.400" />
        </Flex>
      ) : questions.length === 0 ? (
        <Text color={dark.muted} py={8}>No questions found.</Text>
      ) : (
        <Flex direction="column" gap={4}>
          {questions.map((q) => (
            <Box
              key={q.id}
              p={4}
              bg={dark.cardBg}
              borderRadius="md"
              borderWidth="1px"
              borderColor={dark.borderSubtle}
            >
              <Flex justify="space-between" align="flex-start" mb={2}>
                <Text fontWeight="semibold" color="white">
                  {q.subject}
                </Text>
                {!q.reply && (
                  <Badge colorPalette="orange" size="sm">Unanswered</Badge>
                )}
              </Flex>
              <Text color={dark.muted} fontSize="sm" mb={2}>
                {new Date(q.createdAt).toLocaleString()}
              </Text>
              <Text color={dark.label} whiteSpace="pre-wrap" mb={3}>
                {q.body}
              </Text>
              {q.reply ? (
                <Box pl={3} borderLeftWidth="3px" borderColor="brand.500">
                  <Text fontSize="sm" color={dark.placeholder} mb={1}>Reply</Text>
                  <Text color={dark.muted} whiteSpace="pre-wrap">{q.reply}</Text>
                  {q.repliedAt && (
                    <Text fontSize="xs" color={dark.placeholder} mt={1}>
                      {new Date(q.repliedAt).toLocaleString()}
                    </Text>
                  )}
                </Box>
              ) : (
                <RepReplyForm
                  questionId={q.id}
                  replyingId={replyingId}
                  setReplyingId={setReplyingId}
                  onSuccess={() => { setReplyingId(null); fetchQuestions() }}
                  onError={(msg) => showErrorToast('Error', msg)}
                />
              )}
            </Box>
          ))}
        </Flex>
      )}
    </Box>
  )
}

function RepReplyForm({
  questionId,
  replyingId,
  setReplyingId,
  onSuccess,
  onError,
}: {
  questionId: number
  replyingId: number | null
  setReplyingId: (id: number | null) => void
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isActive = replyingId === questionId

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim()) return
    setSubmitting(true)
    try {
      await replyToQuestion(questionId, { reply: replyText.trim() })
      setReplyText('')
      setReplyingId(null)
      showSuccessToast('Reply submitted')
      onSuccess()
    } catch (err) {
      if (isAxiosError(err) && err.response?.data) {
        onError(typeof err.response.data === 'string' ? err.response.data : 'Failed to submit reply.')
      } else {
        onError('Failed to submit reply.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!isActive) {
    return (
      <Button size="sm" variant="outline" colorScheme="brand" onClick={() => setReplyingId(questionId)}>
        Reply
      </Button>
    )
  }

  return (
    <Box as="form" onSubmit={handleSubmit} mt={2}>
      <Box mb={2}>
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Your reply..."
          rows={3}
          style={{
            width: '100%',
            padding: '8px',
            background: dark.inputBg,
            border: `1px solid ${dark.borderSubtle}`,
            borderRadius: '6px',
            color: 'white',
          }}
        />
      </Box>
      <Flex gap={2}>
        <Button size="sm" colorScheme="brand" type="submit" loading={submitting} disabled={!replyText.trim()}>
          Submit reply
        </Button>
        <Button size="sm" variant="ghost" color={dark.muted} onClick={() => setReplyingId(null)}>
          Cancel
        </Button>
      </Flex>
    </Box>
  )
}

function RepAuctionsTab() {
  const [auctions, setAuctions] = useState<AuctionListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<AuctionDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchAuctions = () => {
    setLoading(true)
    browseAuctions({ q: search || undefined, page, pageSize: PAGE_SIZE })
      .then((res) => {
        setAuctions(res.data.items)
        setTotalCount(res.data.totalCount)
      })
      .catch(() => showErrorToast('Error', 'Failed to load auctions.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAuctions()
  }, [page, search])

  useEffect(() => {
    if (expandedId == null) {
      setDetail(null)
      return
    }
    setLoadingDetail(true)
    getAuction(expandedId)
      .then((res) => setDetail(res.data))
      .catch(() => showErrorToast('Error', 'Failed to load auction detail.'))
      .finally(() => setLoadingDetail(false))
  }, [expandedId])

  const handleRemoveAuction = async (id: number) => {
    try {
      await deleteRepAuction(id)
      showSuccessToast('Auction removed')
      if (expandedId === id) setExpandedId(null)
      fetchAuctions()
    } catch {
      showErrorToast('Error', 'Failed to remove auction.')
    }
  }

  const handleRemoveBid = async (bidId: number, itemId: number) => {
    try {
      await deleteRepBid(bidId)
      showSuccessToast('Bid removed')
      if (expandedId === itemId) {
        getAuction(itemId).then((res) => setDetail(res.data)).catch(() => setDetail(null))
      }
      fetchAuctions()
    } catch {
      showErrorToast('Error', 'Failed to remove bid.')
    }
  }

  return (
    <Box>
      <Flex mb={4} gap={2} align="center">
        <Input
          placeholder="Search auctions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          bg={dark.inputBg}
          borderColor={dark.borderSubtle}
          color="white"
          _placeholder={{ color: dark.placeholder }}
          size="sm"
          w="200px"
        />
      </Flex>
      {loading ? (
        <Flex justify="center" py={8}>
          <Spinner color="brand.400" />
        </Flex>
      ) : (
        <>
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row borderColor={dark.borderSubtle}>
                <Table.ColumnHeader color={dark.muted}>Title</Table.ColumnHeader>
                <Table.ColumnHeader color={dark.muted}>Price</Table.ColumnHeader>
                <Table.ColumnHeader color={dark.muted}>Status</Table.ColumnHeader>
                <Table.ColumnHeader color={dark.muted}>Seller</Table.ColumnHeader>
                <Table.ColumnHeader color={dark.muted}>Actions</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {auctions.map((a) => (
                <Table.Row key={a.id} borderColor={dark.borderSubtle}>
                  <Table.Cell color="white">{a.title}</Table.Cell>
                  <Table.Cell color={dark.label}>${a.currentPrice.toLocaleString()}</Table.Cell>
                  <Table.Cell>
                    <Badge size="sm">{a.status}</Badge>
                  </Table.Cell>
                  <Table.Cell color={dark.muted}>{a.sellerUsername}</Table.Cell>
                  <Table.Cell>
                    <Flex gap={2}>
                      <Button
                        size="xs"
                        variant="outline"
                        colorScheme="brand"
                        onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                      >
                        {expandedId === a.id ? 'Hide bids' : 'Bids'}
                      </Button>
                      <Button size="xs" variant="outline" colorPalette="red" onClick={() => handleRemoveAuction(a.id)}>
                        Remove auction
                      </Button>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          {expandedId != null && (
            <Box mt={4} p={4} bg={dark.cardBg} borderRadius="md" borderWidth="1px" borderColor={dark.borderSubtle}>
              <Text fontWeight="semibold" color="white" mb={3}>Bid history</Text>
              {loadingDetail ? (
                <Spinner size="sm" color="brand.400" />
              ) : detail?.bidHistory?.length ? (
                <Table.Root size="sm">
                  <Table.Header>
                    <Table.Row borderColor={dark.borderSubtle}>
                      <Table.ColumnHeader color={dark.muted}>Bidder</Table.ColumnHeader>
                      <Table.ColumnHeader color={dark.muted}>Amount</Table.ColumnHeader>
                      <Table.ColumnHeader color={dark.muted}>Time</Table.ColumnHeader>
                      <Table.ColumnHeader color={dark.muted}>Actions</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {(detail.bidHistory as (BidHistoryItem & { id?: number })[]).map((b) => (
                      <Table.Row key={b.createdAt + b.bidderUsername} borderColor={dark.borderSubtle}>
                        <Table.Cell color="white">{b.bidderUsername}</Table.Cell>
                        <Table.Cell color={dark.label}>
                          ${b.amount.toLocaleString()}
                          {b.isAuto && <Badge ml={2} size="sm">Auto</Badge>}
                        </Table.Cell>
                        <Table.Cell color={dark.muted} fontSize="sm">
                          {new Date(b.createdAt).toLocaleString()}
                        </Table.Cell>
                        <Table.Cell>
                          {b.id != null ? (
                            <Button
                              size="xs"
                              variant="outline"
                              colorPalette="red"
                              onClick={() => handleRemoveBid(b.id!, detail.id)}
                            >
                              Remove bid
                            </Button>
                          ) : null}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              ) : (
                <Text color={dark.muted}>No bids yet.</Text>
              )}
            </Box>
          )}
          {totalCount > PAGE_SIZE && (
            <Flex justify="space-between" align="center" mt={4}>
              <Text color={dark.muted} fontSize="sm">{totalCount} total</Text>
              <Flex gap={2}>
                <Button size="sm" isDisabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button size="sm" isDisabled={page * PAGE_SIZE >= totalCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </Flex>
            </Flex>
          )}
        </>
      )}
    </Box>
  )
}
