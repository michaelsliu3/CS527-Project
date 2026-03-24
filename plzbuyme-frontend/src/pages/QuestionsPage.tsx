import { useEffect, useState } from 'react'

function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const id = setTimeout(() => setDebouncedValue(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debouncedValue
}
import {
  Badge,
  Box,
  Button,
  Container,
  Dialog,
  Flex,
  IconButton,
  Input,
  NativeSelect,
  Text,
  Textarea,
  useDisclosure,
} from '@chakra-ui/react'
import { LuArrowBigDown, LuArrowBigUp, LuArrowLeft, LuMessageSquareReply } from 'react-icons/lu'
import { showErrorToast, showSuccessToast } from '../components/ui/toaster'
import { useForm } from 'react-hook-form'
import {
  listQuestions,
  createQuestion,
  replyToQuestion,
  voteQuestion,
  voteReply,
  type QuestionReply,
  type QuestionResponse,
} from '../api/questions'
import { useAuth } from '../context/AuthContext'
import { dark } from '../theme/colors'
import { isAxiosError } from 'axios'
import { APP_PAGE_PX } from '../theme/layout'
import { DisplayNameText } from '../components/DisplayNameText'
import { UserAvatar } from '../components/UserAvatar'
import { useNavigate, useParams } from 'react-router-dom'

interface AskQuestionFormValues {
  subject: string
  body: string
}

const KEYWORD_DEBOUNCE_MS = 350
const CARD_INTERACTIVE_SELECTOR =
  'a,button,input,textarea,select,option,[role="button"],[role="link"],[data-prevent-card-click="true"]'

function isFromNestedInteractiveElement(target: EventTarget | null, currentTarget: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  const closestInteractive = target.closest(CARD_INTERACTIVE_SELECTOR)
  return Boolean(closestInteractive && closestInteractive !== currentTarget)
}

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

export function QuestionsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { questionId } = useParams<{ questionId?: string }>()
  const [questions, setQuestions] = useState<QuestionResponse[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replyingId, setReplyingId] = useState<number | null>(null)
  const [replyParentId, setReplyParentId] = useState<number | null>(null)
  const [sortMode, setSortMode] = useState<'top' | 'newest' | 'oldest'>('top')
  const askDialog = useDisclosure()

  const debouncedKeyword = useDebounce(keyword, KEYWORD_DEBOUNCE_MS)

  const askForm = useForm<AskQuestionFormValues>({
    defaultValues: { subject: '', body: '' },
  })

  const fetchQuestions = () => {
    setLoading(true)
    setError(null)
    listQuestions(debouncedKeyword || undefined, sortMode)
      .then((res) => setQuestions(res.data))
      .catch(() => {
        setError('Failed to load questions.')
        showErrorToast('Error', 'Failed to load questions.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchQuestions()
  }, [debouncedKeyword, sortMode])

  const handleVoteQuestion = async (questionId: number, value: 1 | -1) => {
    try {
      const res = await voteQuestion(questionId, { value })
      setQuestions((prev) => prev.map((q) => (q.id === questionId ? res.data : q)))
    } catch {
      showErrorToast('Error', 'Failed to update vote.')
    }
  }

  const handleVoteReply = async (replyId: number, value: 1 | -1) => {
    try {
      const res = await voteReply(replyId, { value })
      setQuestions((prev) => prev.map((q) => (q.id === res.data.id ? res.data : q)))
    } catch {
      showErrorToast('Error', 'Failed to update vote.')
    }
  }

  const onSubmitAsk = async (data: AskQuestionFormValues) => {
    try {
      await createQuestion({ subject: data.subject.trim(), body: data.body.trim() })
      showSuccessToast('Question submitted')
      askDialog.onClose()
      askForm.reset()
      fetchQuestions()
    } catch (err) {
      if (isAxiosError(err) && err.response?.data) {
        const msg = typeof err.response.data === 'string' ? err.response.data : 'Failed to submit question.'
        showErrorToast('Error', msg)
      } else {
        showErrorToast('Error', 'Failed to submit question.')
      }
    }
  }

  const isRepOrAdmin = user?.role === 'customer_rep' || user?.role === 'admin'
  const canAskQuestion =
    user?.role === 'end_user' ||
    user?.role === 'vip' ||
    user?.role === 'customer_rep' ||
    user?.role === 'admin'
  const parsedQuestionId = questionId ? Number(questionId) : null
  const selectedQuestionId =
    parsedQuestionId !== null && Number.isInteger(parsedQuestionId) && parsedQuestionId > 0 ? parsedQuestionId : null
  const singleQuestionMode = selectedQuestionId !== null
  const visibleQuestions =
    selectedQuestionId === null ? questions : questions.filter((question) => question.id === selectedQuestionId)

  return (
    <Container maxW="container.lg" px={APP_PAGE_PX}>
      {!singleQuestionMode ? (
        <Flex justify="space-between" align="center" mb={6} flexWrap="wrap" gap={4}>
          <Text fontSize="2xl" fontWeight="bold" color="white">
            Q&A
          </Text>
          <Flex gap={2} align="center">
            <NativeSelect.Root size="sm" width="120px">
              <NativeSelect.Field
                value={sortMode}
                onChange={(e) => {
                  const next = e.target.value
                  if (next === 'top' || next === 'newest' || next === 'oldest') setSortMode(next)
                }}
                bg={dark.inputBg}
                borderColor={dark.borderSubtle}
                color="white"
              >
                <option value="top">Top</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            <Input
              placeholder="Search by keyword..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              bg={dark.inputBg}
              borderColor={dark.borderSubtle}
              color="white"
              _placeholder={{ color: dark.placeholder }}
              size="sm"
              w={{ base: '100%', sm: '200px' }}
            />
            {canAskQuestion && (
              <Button
                size="sm"
                variant="outline"
                borderColor={dark.borderSubtle}
                color="white"
                _hover={{ bg: 'whiteAlpha.100' }}
                onClick={askDialog.onOpen}
              >
                Ask a Question
              </Button>
            )}
          </Flex>
        </Flex>
      ) : null}

      {singleQuestionMode ? (
        <Flex align="flex-start" gap={{ base: 2, md: 4 }}>
          <IconButton
            size="sm"
            variant="ghost"
            color={dark.muted}
            aria-label="Back to all posts"
            onClick={() => navigate('/questions')}
            _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
            mt={1}
            flexShrink={0}
          >
            <LuArrowLeft />
          </IconButton>
          <Box flex="1">
            {error && (
              <Text color="red.400" mb={4}>
                {error}
              </Text>
            )}
            {loading ? (
              <Text color={dark.muted} py={8} textAlign="center">
                Loading...
              </Text>
            ) : visibleQuestions.length === 0 ? (
              <Text color={dark.muted} py={8} textAlign="center">
                Post not found.
              </Text>
            ) : (
              <Flex direction="column" gap={4}>
                {visibleQuestions.map((q) => (
                  <Box key={q.id}>
                    <Text fontWeight="bold" fontSize={{ base: 'xl', md: '2xl' }} color="white" mb={2}>
                      {q.subject}
                    </Text>
                    <Flex color={dark.muted} fontSize="sm" mb={3} align="center" gap={2}>
                      <UserAvatar name={q.username} avatarUrl={q.usernameAvatarUrl} size="22px" />
                      <Box>
                        <DisplayNameText
                          name={q.username}
                          displayNameColor={q.usernameDisplayNameColor}
                          fallbackColor={dark.muted}
                          fontWeight="bold"
                        />{' '}
                        • {formatRelativeTime(q.createdAt)}
                      </Box>
                    </Flex>
                    <Text color={dark.label} whiteSpace="pre-wrap" mb={3}>
                      {q.body}
                    </Text>
                    <ActionRow
                      score={q.score}
                      currentUserVote={q.currentUserVote}
                      canReply={isRepOrAdmin}
                      onUpvote={() => void handleVoteQuestion(q.id, 1)}
                      onDownvote={() => void handleVoteQuestion(q.id, -1)}
                      onReply={() => {
                        setReplyingId(q.id)
                        setReplyParentId(null)
                      }}
                    />
                    {isRepOrAdmin ? (
                      <ReplyForm
                        questionId={q.id}
                        parentReplyId={null}
                        isActive={replyingId === q.id && replyParentId === null}
                        onCancel={() => {
                          setReplyingId(null)
                          setReplyParentId(null)
                        }}
                        onSuccess={() => {
                          setReplyingId(null)
                          setReplyParentId(null)
                          fetchQuestions()
                        }}
                        onError={(msg) => showErrorToast('Error', msg)}
                      />
                    ) : null}
                  </Box>
                ))}

                {visibleQuestions.map((q) => (
                  <Box key={`comments-${q.id}`}>
                    <Flex align="center" gap={3} mb={6}>
                      <Text color="white" fontWeight="bold" fontSize="lg" flexShrink={0}>
                        Comments ({q.replies.length})
                      </Text>
                      <Box flex="1" borderTopWidth="1px" borderColor="whiteAlpha.300" />
                    </Flex>
                    {q.replies.length > 0 ? (
                      <Flex direction="column" gap={3}>
                        {q.replies.map((reply) => (
                          <ReplyThread
                            key={reply.id}
                            questionId={q.id}
                            questionUsername={q.username}
                            reply={reply}
                            depth={0}
                            canReply={isRepOrAdmin}
                            onVote={handleVoteReply}
                            replyingId={replyingId}
                            replyParentId={replyParentId}
                            onReply={(parentReplyId) => {
                              setReplyingId(q.id)
                              setReplyParentId(parentReplyId)
                            }}
                            onCancelReply={() => {
                              setReplyingId(null)
                              setReplyParentId(null)
                            }}
                            onReplySuccess={() => {
                              setReplyingId(null)
                              setReplyParentId(null)
                              fetchQuestions()
                            }}
                            onReplyError={(msg) => showErrorToast('Error', msg)}
                          />
                        ))}
                      </Flex>
                    ) : (
                      <Text color={dark.muted}>No comments yet.</Text>
                    )}
                  </Box>
                ))}
              </Flex>
            )}
          </Box>
        </Flex>
      ) : (
        <>
          {error && (
            <Text color="red.400" mb={4}>
              {error}
            </Text>
          )}
          {loading ? (
            <Text color={dark.muted} py={8} textAlign="center">
              Loading...
            </Text>
          ) : visibleQuestions.length === 0 ? (
            <Text color={dark.muted} py={8} textAlign="center">
              No questions found.
            </Text>
          ) : (
            <Flex direction="column" gap={4}>
              {visibleQuestions.map((q) => (
                <Box
                  key={q.id}
                  p={4}
                  bg={dark.cardBg}
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor={dark.borderSubtle}
                  role="button"
                  tabIndex={0}
                  cursor="pointer"
                  _hover={{ borderColor: 'whiteAlpha.500' }}
                  onClick={(e) => {
                    if (singleQuestionMode || isFromNestedInteractiveElement(e.target, e.currentTarget)) {
                      return
                    }
                    navigate(`/questions/${q.id}`)
                  }}
                  onKeyDown={(e) => {
                    if (singleQuestionMode || (e.key !== 'Enter' && e.key !== ' ')) {
                      return
                    }
                    e.preventDefault()
                    navigate(`/questions/${q.id}`)
                  }}
                >
                  <Text fontWeight="semibold" color="white" mb={1}>
                    {q.subject}
                  </Text>
                  <Flex color={dark.muted} fontSize="sm" mb={2} align="center" gap={2}>
                    <UserAvatar name={q.username} avatarUrl={q.usernameAvatarUrl} size="22px" />
                    <Box>
                      <DisplayNameText
                        name={q.username}
                        displayNameColor={q.usernameDisplayNameColor}
                        fallbackColor={dark.muted}
                        fontWeight="bold"
                      />{' '}
                      • {formatRelativeTime(q.createdAt)}
                    </Box>
                  </Flex>
                  <Text color={dark.label} whiteSpace="pre-wrap" mb={3}>
                    {q.body}
                  </Text>
                  <ActionRow
                    score={q.score}
                    currentUserVote={q.currentUserVote}
                    canReply={isRepOrAdmin}
                    onUpvote={() => void handleVoteQuestion(q.id, 1)}
                    onDownvote={() => void handleVoteQuestion(q.id, -1)}
                    onReply={() => {
                      setReplyingId(q.id)
                      setReplyParentId(null)
                    }}
                  />
                  {isRepOrAdmin ? (
                    <ReplyForm
                      questionId={q.id}
                      parentReplyId={null}
                      isActive={replyingId === q.id && replyParentId === null}
                      onCancel={() => {
                        setReplyingId(null)
                        setReplyParentId(null)
                      }}
                      onSuccess={() => {
                        setReplyingId(null)
                        setReplyParentId(null)
                        fetchQuestions()
                      }}
                      onError={(msg) => showErrorToast('Error', msg)}
                    />
                  ) : null}
                  {q.replies.length > 0 ? (
                    <Flex direction="column" gap={3} mb={3}>
                      {q.replies.map((reply) => (
                        <ReplyThread
                          key={reply.id}
                          questionId={q.id}
                          questionUsername={q.username}
                          reply={reply}
                          depth={0}
                          canReply={isRepOrAdmin}
                          onVote={handleVoteReply}
                          replyingId={replyingId}
                          replyParentId={replyParentId}
                          onReply={(parentReplyId) => {
                            setReplyingId(q.id)
                            setReplyParentId(parentReplyId)
                          }}
                          onCancelReply={() => {
                            setReplyingId(null)
                            setReplyParentId(null)
                          }}
                          onReplySuccess={() => {
                            setReplyingId(null)
                            setReplyParentId(null)
                            fetchQuestions()
                          }}
                          onReplyError={(msg) => showErrorToast('Error', msg)}
                        />
                      ))}
                    </Flex>
                  ) : null}
                </Box>
              ))}
            </Flex>
          )}
        </>
      )}

      <Dialog.Root open={askDialog.open} onOpenChange={({ open: isOpen }) => { if (!isOpen) askDialog.onClose() }} size="md">
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg={dark.cardBg} borderColor={dark.borderSubtle} borderWidth="1px">
            <Dialog.Header color="white">Ask a Question</Dialog.Header>
            <Dialog.Body>
              <form id="ask-question-form" onSubmit={askForm.handleSubmit(onSubmitAsk)}>
                <Flex direction="column" gap={4}>
                  <Box>
                    <Text mb={2} color={dark.label} fontSize="sm">
                      Subject
                    </Text>
                    <Input
                      {...askForm.register('subject', { required: 'Subject is required' })}
                      placeholder="Brief subject"
                      bg={dark.inputBg}
                      borderColor={dark.borderSubtle}
                      color="white"
                      _placeholder={{ color: dark.placeholder }}
                    />
                    {askForm.formState.errors.subject && (
                      <Text fontSize="sm" color="red.400" mt={1}>
                        {askForm.formState.errors.subject.message}
                      </Text>
                    )}
                  </Box>
                  <Box>
                    <Text mb={2} color={dark.label} fontSize="sm">
                      Question
                    </Text>
                    <Textarea
                      {...askForm.register('body', { required: 'Question is required' })}
                      placeholder="Your question..."
                      bg={dark.inputBg}
                      borderColor={dark.borderSubtle}
                      color="white"
                      _placeholder={{ color: dark.placeholder }}
                      rows={4}
                    />
                    {askForm.formState.errors.body && (
                      <Text fontSize="sm" color="red.400" mt={1}>
                        {askForm.formState.errors.body.message}
                      </Text>
                    )}
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
                onClick={askDialog.onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="ask-question-form"
                bg="brand.500"
                color="white"
                _hover={{ bg: 'brand.400' }}
              >
                Submit
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Container>
  )
}

function ReplyForm({
  questionId,
  parentReplyId,
  isActive,
  onCancel,
  onSuccess,
  onError,
}: {
  questionId: number
  parentReplyId: number | null
  isActive: boolean
  onCancel: () => void
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const [replyBody, setReplyBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyBody.trim()) return
    setSubmitting(true)
    try {
      await replyToQuestion(questionId, { body: replyBody.trim(), parentReplyId: parentReplyId ?? undefined })
      setReplyBody('')
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
    return null
  }

  return (
    <Box as="form" onSubmit={handleSubmit} mt={2} data-prevent-card-click="true">
      <Textarea
        value={replyBody}
        onChange={(e) => setReplyBody(e.target.value)}
        placeholder="Reply details..."
        bg={dark.inputBg}
        borderColor={dark.borderSubtle}
        color="white"
        _placeholder={{ color: dark.placeholder }}
        rows={3}
        mb={2}
      />
      <Flex gap={2} mb={5}>
        <Button
          size="sm"
          variant="outline"
          borderColor={dark.borderSubtle}
          color="white"
          _hover={{ bg: 'whiteAlpha.100' }}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          type="submit"
          bg="brand.500"
          color="white"
          _hover={{ bg: 'brand.400' }}
          loading={submitting}
          disabled={!replyBody.trim()}
        >
          Submit reply
        </Button>
      </Flex>
    </Box>
  )
}

function ActionRow({
  score,
  currentUserVote,
  canReply,
  onUpvote,
  onDownvote,
  onReply,
}: {
  score: number
  currentUserVote: number
  canReply: boolean
  onUpvote: () => void
  onDownvote: () => void
  onReply: () => void
}) {
  return (
    <Flex align="center" gap={1} mb={3} wrap="wrap">
      <IconButton
        size="xs"
        variant="ghost"
        color={currentUserVote === 1 ? 'green.300' : dark.placeholder}
        _hover={{ bg: 'whiteAlpha.100' }}
        minW="auto"
        h="auto"
        px={1.5}
        py={1}
        onClick={onUpvote}
        aria-label="Upvote"
      >
        <LuArrowBigUp />
      </IconButton>
      <Text fontSize="sm" color={dark.muted} minW="auto" px={1} textAlign="center">
        {score}
      </Text>
      <IconButton
        size="xs"
        variant="ghost"
        color={currentUserVote === -1 ? 'red.300' : dark.placeholder}
        _hover={{ bg: 'whiteAlpha.100' }}
        minW="auto"
        h="auto"
        px={1.5}
        py={1}
        onClick={onDownvote}
        aria-label="Downvote"
      >
        <LuArrowBigDown />
      </IconButton>
      {canReply ? (
        <Button
          size="xs"
          variant="ghost"
          color={dark.placeholder}
          _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
          minW="auto"
          h="auto"
          px={1.5}
          py={1}
          ml={1}
          onClick={onReply}
        >
          <LuMessageSquareReply />
          Reply
        </Button>
      ) : null}
    </Flex>
  )
}

function ReplyThread({
  questionId,
  questionUsername,
  reply,
  depth,
  canReply,
  onVote,
  replyingId,
  replyParentId,
  onReply,
  onCancelReply,
  onReplySuccess,
  onReplyError,
}: {
  questionId: number
  questionUsername: string
  reply: QuestionReply
  depth: number
  canReply: boolean
  onVote: (replyId: number, value: 1 | -1) => Promise<void>
  replyingId: number | null
  replyParentId: number | null
  onReply: (parentReplyId: number) => void
  onCancelReply: () => void
  onReplySuccess: () => void
  onReplyError: (msg: string) => void
}) {
  const tag = getReplyTagLabel(reply.replierRole, reply.replierDisplayName === questionUsername)
  return (
    <Box pl={Math.min(depth + 1, 5) * 3} borderLeftWidth="2px" borderColor={depth === 0 ? 'brand.500' : 'whiteAlpha.300'}>
      <Flex align="center" gap={2} mb={1} wrap="wrap">
        <UserAvatar name={reply.replierDisplayName} avatarUrl={reply.replierAvatarUrl} size="20px" />
        <Text fontSize="xs" color={dark.placeholder}>
          <DisplayNameText
            name={reply.replierDisplayName}
            displayNameColor={reply.replierDisplayNameColor}
            fallbackColor={dark.placeholder}
            fontWeight="bold"
          />
        </Text>
        {tag ? (
          <Badge size="sm" colorPalette={getReplyTagColor(tag)}>
            {tag}
          </Badge>
        ) : null}
        <Text fontSize="xs" color={dark.placeholder}>
          • {formatRelativeTime(reply.createdAt)}
        </Text>
      </Flex>
      <Text color={dark.muted} whiteSpace="pre-wrap" mb={2}>
        {reply.body}
      </Text>
      <ActionRow
        score={reply.score}
        currentUserVote={reply.currentUserVote}
        canReply={canReply}
        onUpvote={() => void onVote(reply.id, 1)}
        onDownvote={() => void onVote(reply.id, -1)}
        onReply={() => onReply(reply.id)}
      />
      {canReply ? (
        <ReplyForm
          questionId={questionId}
          parentReplyId={reply.id}
          isActive={replyingId === questionId && replyParentId === reply.id}
          onCancel={onCancelReply}
          onSuccess={onReplySuccess}
          onError={onReplyError}
        />
      ) : null}
      {reply.replies.length > 0 ? (
        <Flex direction="column" gap={2} mb={2}>
          {reply.replies.map((childReply) => (
            <ReplyThread
              key={childReply.id}
              questionId={questionId}
              questionUsername={questionUsername}
              reply={childReply}
              depth={depth + 1}
              canReply={canReply}
              onVote={onVote}
              replyingId={replyingId}
              replyParentId={replyParentId}
              onReply={onReply}
              onCancelReply={onCancelReply}
              onReplySuccess={onReplySuccess}
              onReplyError={onReplyError}
            />
          ))}
        </Flex>
      ) : null}
    </Box>
  )
}
