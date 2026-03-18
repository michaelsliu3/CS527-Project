import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Container,
  Flex,
  Input,
  NativeSelect,
  Tabs,
  Text,
  Badge,
  Dialog,
  Spinner,
  Textarea,
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
import { browseAuctions, getAuction, type AuctionListItem, type AuctionDetail } from '../../api/auctions'
import { showErrorToast, showSuccessToast } from '../../components/ui/toaster'
import { dark } from '../../theme/colors'
import { tableStyles, thBase, tdStyle } from '../../theme/tableStyles'
import { useAuth } from '../../context/AuthContext'
import { APP_PAGE_PX } from '../../theme/layout'

const PAGE_SIZE = 10

function formatRelativeTime(dateInput: string): string {
  const postedAt = new Date(dateInput).getTime()
  const now = Date.now()
  const diffMs = Math.max(0, now - postedAt)
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (days < 1) {
    return `${Math.max(1, hours)}h ago`
  }
  if (days < 30) {
    return `${days}d ago`
  }
  if (days < 365) {
    return `${Math.max(1, months)}mo ago`
  }
  return `${Math.max(1, years)}y ago`
}

function getReplyTagLabel(replierRole: string | null, isOp: boolean): 'OP' | 'Admin' | 'Rep' | null {
  if (isOp) return 'OP'
  if (replierRole === 'admin') return 'Admin'
  if (replierRole === 'customer_rep') return 'Rep'
  return null
}

function getReplyTagColor(tag: 'OP' | 'Admin' | 'Rep'): 'green' | 'purple' | 'blue' {
  if (tag === 'OP') return 'green'
  if (tag === 'Admin') return 'purple'
  return 'blue'
}

function roleToLabel(role?: string | null): 'User' | 'Rep' | 'Admin' {
  const normalized = (role ?? '').trim().toLowerCase()
  if (normalized === 'admin') return 'Admin'
  if (normalized === 'customer_rep' || normalized === 'rep') return 'Rep'
  return 'User'
}

export function RepDashboard() {
  return (
    <Container maxW="container.xl" py={6} px={APP_PAGE_PX}>
      <Text fontSize="2xl" fontWeight="bold" color="white" mb={6}>
        Rep Dashboard
      </Text>
      <Tabs.Root defaultValue="users" variant="line" colorPalette="brand">
        <Tabs.List borderColor={dark.borderSubtle} gap={2} color="white">
          <Tabs.Trigger value="users" color="white">Users</Tabs.Trigger>
          <Tabs.Trigger value="questions" color="white">Questions</Tabs.Trigger>
          <Tabs.Trigger value="auctions" color="white">Auctions</Tabs.Trigger>
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
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
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
          <Box overflowX="auto">
            <table style={tableStyles}>
              <thead>
                <tr>
                  <th style={{ ...thBase, textAlign: 'left' }}>Username</th>
                  <th style={{ ...thBase, textAlign: 'left' }}>Email</th>
                  <th style={{ ...thBase, textAlign: 'left' }}>Role</th>
                  <th style={{ ...thBase, textAlign: 'left' }}>Active</th>
                  <th style={{ ...thBase, textAlign: 'left' }}>Created</th>
                  <th style={{ ...thBase, textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const isLast = i === users.length - 1
                  const cellStyle = tdStyle(isLast)
                  return (
                    <tr key={u.id}>
                      <td style={{ ...cellStyle, textAlign: 'left' }}>{u.username}</td>
                      <td style={{ ...cellStyle, textAlign: 'left' }}>{u.email}</td>
                      <td style={{ ...cellStyle, textAlign: 'left' }}>
                        <Badge
                          colorPalette={
                            roleToLabel(u.role) === 'Admin'
                              ? 'purple'
                              : roleToLabel(u.role) === 'Rep'
                                ? 'blue'
                                : 'gray'
                          }
                          size="sm"
                        >
                          {roleToLabel(u.role)}
                        </Badge>
                      </td>
                      <td style={{ ...cellStyle, textAlign: 'left' }}>
                        <Badge colorPalette={u.isActive ? 'green' : 'red'} size="sm">
                          {u.isActive ? 'Yes' : 'No'}
                        </Badge>
                      </td>
                      <td style={{ ...cellStyle, textAlign: 'left', color: dark.muted }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ ...cellStyle, textAlign: 'left' }}>
                        <Flex gap={2}>
                          <Button
                            size="sm"
                            variant="outline"
                            borderColor={dark.borderSubtle}
                            color="white"
                            _hover={{ bg: 'whiteAlpha.100' }}
                            onClick={() => setEditUser(u)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            borderColor={dark.borderSubtle}
                            color="white"
                            _hover={{ bg: 'whiteAlpha.100' }}
                            onClick={() => setResetUser(u)}
                          >
                            Reset PW
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            borderColor={dark.borderSubtle}
                            color="white"
                            _hover={{ bg: 'whiteAlpha.100' }}
                            onClick={() => setDeleteUser(u)}
                          >
                            Delete
                          </Button>
                        </Flex>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Box>
          {totalCount > PAGE_SIZE && (
            <Flex justify="space-between" align="center" mt={4}>
              <Text color={dark.muted} fontSize="sm">
                {totalCount} total
              </Text>
              <Flex gap={2}>
                <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" disabled={page * PAGE_SIZE >= totalCount} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </Flex>
            </Flex>
          )}
        </>
      )}
      {editUser && (
        <EditUserModal
          key={editUser.id}
          user={editUser}
          isAdmin={isAdmin}
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
  isAdmin: boolean
  onClose: () => void
  onSuccess: () => void
  onError: (msg: string) => void
}

function EditUserModal({ user, isAdmin, onClose, onSuccess, onError }: EditUserModalProps) {
  const { register, handleSubmit, formState } = useForm<EditUserDto>({
    defaultValues: { username: user.username, email: user.email, role: roleToLabel(user.role) },
  })

  const onSubmit = async (data: EditUserDto) => {
    try {
      const payload: EditUserDto = { username: data.username.trim(), email: data.email.trim() }
      if (isAdmin && data.role) {
        payload.role = data.role
      }
      await editRepUser(user.id, payload)
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
                {isAdmin && (
                  <Box>
                    <Text mb={1} color={dark.label} fontSize="sm">Role</Text>
                    <NativeSelect.Root size="md">
                      <NativeSelect.Field
                        {...register('role', { required: 'Required' })}
                        bg={dark.inputBg}
                        borderColor={dark.borderSubtle}
                        color="white"
                      >
                        <option value="User">User</option>
                        <option value="Rep">Rep</option>
                        <option value="Admin">Admin</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                    {formState.errors.role && (
                      <Text fontSize="sm" color="red.400">{formState.errors.role.message}</Text>
                    )}
                  </Box>
                )}
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
  const { register, handleSubmit, formState, reset } = useForm<{ newPassword: string }>({
    defaultValues: { newPassword: '' },
  })

  const onSubmit = async (data: { newPassword: string }) => {
    if (data.newPassword.length < 6) {
      onError('Password must be at least 6 characters.')
      return
    }
    try {
      await resetRepUserPassword(user.id, { newPassword: data.newPassword })
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
      reset()
    }
  }

  return (
    <Dialog.Root open onOpenChange={({ open }) => { if (!open) onClose() }}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content bg={dark.cardBg} borderColor={dark.borderSubtle} borderWidth="1px">
          <Dialog.Header color="white">Reset Password — {user.username}</Dialog.Header>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Dialog.Body>
              <Box>
                <Text mb={1} color={dark.label} fontSize="sm">New password</Text>
                <Input
                  type="password"
                  {...register('newPassword', {
                    required: 'Password is required.',
                    minLength: { value: 6, message: 'Password must be at least 6 characters.' },
                  })}
                  bg={dark.inputBg}
                  borderColor={dark.borderSubtle}
                  color="white"
                />
                {formState.errors.newPassword && (
                  <Text fontSize="sm" color="red.400">{formState.errors.newPassword.message}</Text>
                )}
              </Box>
            </Dialog.Body>
            <Dialog.Footer borderColor={dark.borderSubtle}>
              <Button variant="ghost" color={dark.muted} onClick={onClose}>Cancel</Button>
              <Button type="submit" colorScheme="brand" loading={formState.isSubmitting}>
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
        setQuestions([...list].sort((a, b) => a.replies.length - b.replies.length))
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
                {q.replies.length === 0 && (
                  <Badge colorPalette="orange" size="sm">Unanswered</Badge>
                )}
              </Flex>
              <Text color={dark.muted} fontSize="sm" mb={2}>
                {q.username} • {formatRelativeTime(q.createdAt)}
              </Text>
              <Text color={dark.label} whiteSpace="pre-wrap" mb={3}>
                {q.body}
              </Text>
              {q.replies.length > 0 && (
                <Flex direction="column" gap={2} mb={3}>
                  {q.replies.map((reply) => (
                    <Box key={reply.id} pl={3} borderLeftWidth="3px" borderColor="brand.500">
                      <Flex align="center" gap={2} mb={1} wrap="wrap">
                        <Text fontSize="xs" color={dark.placeholder}>
                          {reply.replierDisplayName}
                        </Text>
                        {(() => {
                          const tag = getReplyTagLabel(reply.replierRole, reply.replierDisplayName === q.username)
                          return tag ? (
                            <Badge size="sm" colorPalette={getReplyTagColor(tag)}>
                              {tag}
                            </Badge>
                          ) : null
                        })()}
                        <Text fontSize="xs" color={dark.placeholder}>
                          • {formatRelativeTime(reply.createdAt)}
                        </Text>
                      </Flex>
                      <Text color={dark.muted} whiteSpace="pre-wrap">{reply.body}</Text>
                    </Box>
                  ))}
                </Flex>
              )}
              <RepReplyForm
                questionId={q.id}
                replyingId={replyingId}
                setReplyingId={setReplyingId}
                onSuccess={() => { setReplyingId(null); fetchQuestions() }}
                onError={(msg) => showErrorToast('Error', msg)}
              />
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
  const [replyBody, setReplyBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isActive = replyingId === questionId

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyBody.trim()) return
    setSubmitting(true)
    try {
      await replyToQuestion(questionId, { body: replyBody.trim() })
      setReplyBody('')
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
        <Textarea
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          placeholder="Reply details..."
          rows={3}
          bg={dark.inputBg}
          borderColor={dark.borderSubtle}
          color="white"
          _placeholder={{ color: dark.placeholder }}
        />
      </Box>
      <Flex gap={2}>
        <Button size="sm" colorScheme="brand" type="submit" loading={submitting} disabled={!replyBody.trim()}>
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
          <Box overflowX="auto">
            <table style={tableStyles}>
              <thead>
                <tr>
                  <th style={{ ...thBase, textAlign: 'left' }}>Title</th>
                  <th style={{ ...thBase, textAlign: 'right' }}>Price</th>
                  <th style={{ ...thBase, textAlign: 'left' }}>Status</th>
                  <th style={{ ...thBase, textAlign: 'left' }}>Seller</th>
                  <th style={{ ...thBase, textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {auctions.map((a, i) => {
                  const isLast = i === auctions.length - 1
                  const cellStyle = tdStyle(isLast)
                  return (
                    <tr key={a.id}>
                      <td style={{ ...cellStyle, textAlign: 'left' }}>{a.title}</td>
                      <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 500 }}>${a.currentPrice.toLocaleString()}</td>
                      <td style={{ ...cellStyle, textAlign: 'left' }}>
                        <Badge size="sm">{a.status}</Badge>
                      </td>
                      <td style={{ ...cellStyle, textAlign: 'left', color: dark.muted }}>{a.sellerUsername}</td>
                      <td style={{ ...cellStyle, textAlign: 'left' }}>
                        <Flex gap={2}>
                          <Button
                            size="sm"
                            variant="outline"
                            borderColor={dark.borderSubtle}
                            color="white"
                            _hover={{ bg: 'whiteAlpha.100' }}
                            onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                          >
                            {expandedId === a.id ? 'Hide bids' : 'Bids'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            borderColor={dark.borderSubtle}
                            color="white"
                            _hover={{ bg: 'whiteAlpha.100' }}
                            onClick={() => handleRemoveAuction(a.id)}
                          >
                            Remove auction
                          </Button>
                        </Flex>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Box>
          {expandedId != null && (
            <Box mt={4} p={4} bg={dark.cardBg} borderRadius="md" borderWidth="1px" borderColor={dark.borderSubtle}>
              <Text fontWeight="semibold" color="white" mb={3}>Bid history</Text>
              {loadingDetail ? (
                <Spinner size="sm" color="brand.400" />
              ) : detail?.bidHistory?.length ? (
                <Box overflowX="auto">
                  <table style={tableStyles}>
                    <thead>
                      <tr>
                        <th style={{ ...thBase, textAlign: 'left' }}>Bidder</th>
                        <th style={{ ...thBase, textAlign: 'right' }}>Amount</th>
                        <th style={{ ...thBase, textAlign: 'left' }}>Time</th>
                        <th style={{ ...thBase, textAlign: 'left' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.bidHistory.map((b, idx) => {
                        const isLast = idx === detail!.bidHistory.length - 1
                        const cellStyle = tdStyle(isLast)
                        const rowKey = b.id != null ? b.id : `${b.bidderUsername}-${b.createdAt}-${idx}`
                        return (
                          <tr key={rowKey}>
                            <td style={{ ...cellStyle, textAlign: 'left' }}>{b.bidderUsername}</td>
                            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 500 }}>
                              ${b.amount.toLocaleString()}
                              {b.isAuto && <Badge ml={2} size="sm">Auto</Badge>}
                            </td>
                            <td style={{ ...cellStyle, textAlign: 'left', color: dark.muted }}>
                              {new Date(b.createdAt).toLocaleString()}
                            </td>
                            <td style={{ ...cellStyle, textAlign: 'left' }}>
                              {b.id != null ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  borderColor={dark.borderSubtle}
                                  color="white"
                                  _hover={{ bg: 'whiteAlpha.100' }}
                                  onClick={() => handleRemoveBid(b.id!, detail.id)}
                                >
                                  Remove bid
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </Box>
              ) : (
                <Text color={dark.muted}>No bids yet.</Text>
              )}
            </Box>
          )}
          {totalCount > PAGE_SIZE && (
            <Flex justify="space-between" align="center" mt={4}>
              <Text color={dark.muted} fontSize="sm">{totalCount} total</Text>
              <Flex gap={2}>
                <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button size="sm" disabled={page * PAGE_SIZE >= totalCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </Flex>
            </Flex>
          )}
        </>
      )}
    </Box>
  )
}
