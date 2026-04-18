import { apiClient } from './client'
export interface CategoryDto {
  id: number
  name: string
  stringKey?: string | null
  /** Lucide icon key (react-icons/lu name without Lu); omit/null uses platform default. */
  lucideIconKey?: string | null
  parentId: number | null
  children: CategoryDto[]
}

export interface CategoryFieldDto {
  id: number
  categoryId: number
  fieldName: string
  fieldType: 'text' | 'number' | 'select'
  isRequired: boolean
  options?: string[] | null
  selectMode?: 'single' | 'multi' | 'incremental' | null
  isInherited: boolean
}

export function fetchCategories() {
  return apiClient.get<CategoryDto[]>('/categories')
}

export function fetchCategoryFields(categoryId: number) {
  return apiClient.get<CategoryFieldDto[]>(`/categories/${categoryId}/fields`)
}

/** Flat list of every category node (root + descendants), sorted by name for selects. */
export function flattenCategories(roots: CategoryDto[]): { id: number; name: string }[] {
  const items: { id: number; name: string }[] = []
  const walk = (nodes: CategoryDto[]) => {
    for (const n of nodes) {
      items.push({ id: n.id, name: n.name })
      if (n.children?.length) walk(n.children)
    }
  }
  walk(roots)
  items.sort((a, b) => a.name.localeCompare(b.name))
  return items
}

export function categoryIdToNameMap(roots: CategoryDto[]): Map<number, string> {
  const map = new Map<number, string>()
  const walk = (nodes: CategoryDto[]) => {
    for (const n of nodes) {
      map.set(n.id, n.name)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(roots)
  return map
}

