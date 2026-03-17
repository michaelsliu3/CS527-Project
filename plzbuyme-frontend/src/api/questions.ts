import { apiClient } from './client'

export interface QuestionResponse {
  id: number
  userId: number
  username: string
  subject: string
  body: string
  replies: QuestionReply[]
  createdAt: string
}

export interface QuestionReply {
  id: number
  title: string | null
  body: string
  replierDisplayName: string
  replierRole: string | null
  createdAt: string
}

export interface CreateQuestionDto {
  subject: string
  body: string
}

export interface ReplyDto {
  title?: string
  body: string
}

export function listQuestions(keyword?: string) {
  return apiClient.get<QuestionResponse[]>('questions', {
    params: keyword ? { keyword } : undefined,
  })
}

export function createQuestion(dto: CreateQuestionDto) {
  return apiClient.post<QuestionResponse>('questions', dto)
}

export function replyToQuestion(id: number, dto: ReplyDto) {
  return apiClient.post<QuestionResponse>(`questions/${id}/reply`, dto)
}
