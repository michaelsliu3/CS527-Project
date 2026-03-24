import { apiClient } from './client'

export interface QuestionResponse {
  id: number
  userId: number
  username: string
  usernameAvatarUrl: string | null
  usernameDisplayNameColor: string | null
  subject: string
  body: string
  score: number
  currentUserVote: number
  replies: QuestionReply[]
  createdAt: string
}

export interface QuestionReply {
  id: number
  parentReplyId: number | null
  body: string
  replierDisplayName: string
  replierAvatarUrl: string | null
  replierDisplayNameColor: string | null
  replierRole: string | null
  score: number
  currentUserVote: number
  replies: QuestionReply[]
  createdAt: string
}

export interface CreateQuestionDto {
  subject: string
  body: string
}

export interface ReplyDto {
  body: string
  parentReplyId?: number
}

export interface VoteDto {
  value: 1 | -1
}

export function listQuestions(keyword?: string, sort?: 'top' | 'newest' | 'oldest') {
  return apiClient.get<QuestionResponse[]>('questions', {
    params: {
      ...(keyword ? { keyword } : {}),
      ...(sort ? { sort } : {}),
    },
  })
}

export function createQuestion(dto: CreateQuestionDto) {
  return apiClient.post<QuestionResponse>('questions', dto)
}

export function replyToQuestion(id: number, dto: ReplyDto) {
  return apiClient.post<QuestionResponse>(`questions/${id}/reply`, dto)
}

export function voteQuestion(id: number, dto: VoteDto) {
  return apiClient.post<QuestionResponse>(`questions/${id}/vote`, dto)
}

export function voteReply(id: number, dto: VoteDto) {
  return apiClient.post<QuestionResponse>(`questions/replies/${id}/vote`, dto)
}
