import { apiClient } from './client'

export interface QuestionResponse {
  id: number
  userId: number
  subject: string
  body: string
  reply: string | null
  repliedBy: number | null
  createdAt: string
  repliedAt: string | null
}

export interface CreateQuestionDto {
  subject: string
  body: string
}

export interface ReplyDto {
  reply: string
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
