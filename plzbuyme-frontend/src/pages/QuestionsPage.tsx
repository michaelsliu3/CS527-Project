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
  Input,
  Text,
  Textarea,
  useDisclosure,
} from '@chakra-ui/react'
import { showErrorToast, showSuccessToast } from '../components/ui/toaster'
import { useForm } from 'react-hook-form'
import {
  listQuestions,
  createQuestion,
  replyToQuestion,
  type QuestionResponse,
} from '../api/questions'
import { useAuth } from '../context/AuthContext'
import { dark } from '../theme/colors'
import { isAxiosError } from 'axios'
import { APP_PAGE_PX } from '../theme/layout'
import { resolveDisplayNameColor } from '../utils/displayNameColor'

interface AskQuestionFormValues {
  subject: string
  body: string
}

const KEYWORD_DEBOUNCE_MS = 350

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
  const [questions, setQuestions] = useState<QuestionResponse[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replyingId, setReplyingId] = useState<number | null>(null)
  const askDialog = useDisclosure()

  const debouncedKeyword = useDebounce(keyword, KEYWORD_DEBOUNCE_MS)

  const askForm = useForm<AskQuestionFormValues>({
    defaultValues: { subject: '', body: '' },
  })

  const fetchQuestions = () => {
    setLoading(true)
    setError(null)
    listQuestions(debouncedKeyword || undefined)
      .then((res) => setQuestions(res.data))
      .catch(() => {
        setError('Failed to load questions.')
        showErrorToast('Error', 'Failed to load questions.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchQuestions()
  }, [debouncedKeyword])

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
    user?.role === 'end_user' || user?.role === 'vip' || user?.role === 'admin'

  return (
    <Container maxW="container.lg" px={APP_PAGE_PX}>
      <Flex justify="space-between" align="center" mb={6} flexWrap="wrap" gap={4}>
        <Text fontSize="2xl" fontWeight="bold" color="white">
          Q&A
        </Text>
        <Flex gap={2} align="center">
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

      {error && (
        <Text color="red.400" mb={4}>
          {error}
        </Text>
      )}

      {loading ? (
        <Text color={dark.muted} py={8} textAlign="center">
          Loading...
        </Text>
      ) : questions.length === 0 ? (
        <Text color={dark.muted} py={8} textAlign="center">
          No questions found.
        </Text>
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
              <Text fontWeight="semibold" color="white" mb={1}>
                {q.subject}
              </Text>
              <Text color={dark.muted} fontSize="sm" mb={2}>
                <Box as="span" color={resolveDisplayNameColor(q.usernameDisplayNameColor, dark.muted)}>
                  {q.username}
                </Box>{' '}
                • {formatRelativeTime(q.createdAt)}
              </Text>
              <Text color={dark.label} whiteSpace="pre-wrap" mb={3}>
                {q.body}
              </Text>
              {q.replies.length > 0 ? (
                <Flex direction="column" gap={3} mb={3}>
                  {q.replies.map((reply) => (
                    <Box key={reply.id} pl={3} borderLeftWidth="3px" borderColor="brand.500">
                      <Flex align="center" gap={2} mb={1} wrap="wrap">
                        <Text fontSize="xs" color={dark.placeholder}>
                          <Box
                            as="span"
                            color={resolveDisplayNameColor(reply.replierDisplayNameColor, dark.placeholder)}
                          >
                            {reply.replierDisplayName}
                          </Box>
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
                      <Text color={dark.muted} whiteSpace="pre-wrap">
                        {reply.body}
                      </Text>
                    </Box>
                  ))}
                </Flex>
              ) : null}
              {isRepOrAdmin ? (
                <ReplyForm
                  questionId={q.id}
                  replyingId={replyingId}
                  setReplyingId={setReplyingId}
                  onSuccess={() => {
                    setReplyingId(null)
                    fetchQuestions()
                  }}
                  onError={(msg) => showErrorToast('Error', msg)}
                />
              ) : null}
            </Box>
          ))}
        </Flex>
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
      <Button
        size="sm"
        variant="outline"
        borderColor={dark.borderSubtle}
        color="white"
        _hover={{ bg: 'whiteAlpha.100' }}
        onClick={() => setReplyingId(questionId)}
      >
        Reply
      </Button>
    )
  }

  return (
    <Box as="form" onSubmit={handleSubmit} mt={2}>
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
      <Flex gap={2}>
        <Button
          size="sm"
          variant="outline"
          borderColor={dark.borderSubtle}
          color="white"
          _hover={{ bg: 'whiteAlpha.100' }}
          onClick={() => setReplyingId(null)}
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
