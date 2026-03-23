import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import { QuestionsPage } from '../../pages/QuestionsPage'
import { system } from '../../theme'
import * as questionsApi from '../../api/questions'

vi.mock('../../api/questions', () => ({
  listQuestions: vi.fn(),
  createQuestion: vi.fn(),
  replyToQuestion: vi.fn(),
}))

vi.mock('../../components/ui/toaster', () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}))

function setTestToken(role: string) {
  const token = `header.${btoa(JSON.stringify({
    sub: '1',
    unique_name: 'test-user',
    email: 'test@example.com',
    role,
    exp: 4102444800,
  }))}.signature`
  window.localStorage.setItem('token', token)
}

function renderQuestionsPage(role: string) {
  setTestToken(role)
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter>
        <AuthProvider>
          <QuestionsPage />
        </AuthProvider>
      </MemoryRouter>
    </ChakraProvider>,
  )
}

describe('QuestionsPage ask question access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    vi.mocked(questionsApi.listQuestions).mockResolvedValue({
      data: [],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)
  })

  it('shows Ask a Question for admin users', async () => {
    renderQuestionsPage('admin')
    expect(await screen.findByRole('button', { name: /Ask a Question/i })).toBeInTheDocument()
  })

  it('shows Ask a Question for VIP users', async () => {
    renderQuestionsPage('vip')
    expect(await screen.findByRole('button', { name: /Ask a Question/i })).toBeInTheDocument()
  })

  it('shows Ask a Question for customer reps', async () => {
    renderQuestionsPage('customer_rep')
    expect(await screen.findByRole('button', { name: /Ask a Question/i })).toBeInTheDocument()
  })

  it('renders avatar fallbacks in forum threads when avatar URLs are missing', async () => {
    vi.mocked(questionsApi.listQuestions).mockResolvedValueOnce({
      data: [
        {
          id: 10,
          userId: 1,
          username: 'alice',
          usernameAvatarUrl: null,
          usernameDisplayNameColor: null,
          subject: 'Shipping question',
          body: 'When will this item ship?',
          score: 0,
          currentUserVote: 0,
          createdAt: new Date().toISOString(),
          replies: [
            {
              id: 91,
              parentReplyId: null,
              body: 'We shipped it this morning.',
              replierDisplayName: 'rep1',
              replierAvatarUrl: null,
              replierDisplayNameColor: null,
              replierRole: 'customer_rep',
              score: 0,
              currentUserVote: 0,
              replies: [],
              createdAt: new Date().toISOString(),
            },
          ],
        },
      ],
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)

    renderQuestionsPage('end_user')

    expect(await screen.findByText('Shipping question')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('R')).toBeInTheDocument()
  })

  it('changes sort mode and refetches questions', async () => {
    renderQuestionsPage('end_user')

    const select = await screen.findByRole('combobox')
    fireEvent.change(select, { target: { value: 'oldest' } })

    await waitFor(() =>
      expect(questionsApi.listQuestions).toHaveBeenLastCalledWith(undefined, 'oldest'),
    )
  })
})
