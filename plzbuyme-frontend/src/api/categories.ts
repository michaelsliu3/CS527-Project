import { apiClient } from './client'

export interface CategoryDto {
  id: number
  name: string
  parentId: number | null
  children: CategoryDto[]
}

export interface CategoryFieldDto {
  id: number
  fieldName: string
  fieldType: 'text' | 'number' | 'select'
  isRequired: boolean
  options?: string[] | null
}

export function fetchCategories() {
  return apiClient.get<CategoryDto[]>('/categories')
}

export function fetchCategoryFields(categoryId: number) {
  return apiClient.get<CategoryFieldDto[]>(`/categories/${categoryId}/fields`)
}

