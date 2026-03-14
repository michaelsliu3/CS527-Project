/**
 * Hardcoded Cars category hierarchy and field definitions for Create Auction form.
 * Matches seed data from backend (PBM-3). Replace with API (PBM-13) when available.
 */

export interface CategoryOption {
  id: number
  name: string
  parentId: number | null
}

export interface CategoryFieldDef {
  id: number
  fieldName: string
  fieldType: 'text' | 'number' | 'select'
  options?: string[]
}

export const CAR_CATEGORIES: CategoryOption[] = [
  { id: 1, name: 'Cars', parentId: null },
  { id: 2, name: 'Sedans', parentId: 1 },
  { id: 3, name: 'SUVs', parentId: 1 },
  { id: 4, name: 'Trucks', parentId: 1 },
  { id: 5, name: 'Sports Cars', parentId: 1 },
  { id: 6, name: 'Electric', parentId: 1 },
  { id: 7, name: 'Compact Sedans', parentId: 2 },
  { id: 8, name: 'Full-Size Sedans', parentId: 2 },
]

const CONDITION_OPTIONS = ['New', 'Like New', 'Excellent', 'Good', 'Fair', 'Poor']
const TRANSMISSION_OPTIONS = ['Automatic', 'Manual', 'CVT']
const FUEL_OPTIONS = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid']

function makeFieldsForCategory(baseId: number): CategoryFieldDef[] {
  return [
    { id: baseId, fieldName: 'Make', fieldType: 'text' },
    { id: baseId + 1, fieldName: 'Model', fieldType: 'text' },
    { id: baseId + 2, fieldName: 'Year', fieldType: 'number' },
    { id: baseId + 3, fieldName: 'Mileage', fieldType: 'number' },
    { id: baseId + 4, fieldName: 'Condition', fieldType: 'select', options: CONDITION_OPTIONS },
    { id: baseId + 5, fieldName: 'Transmission', fieldType: 'select', options: TRANSMISSION_OPTIONS },
    { id: baseId + 6, fieldName: 'Fuel Type', fieldType: 'select', options: FUEL_OPTIONS },
    { id: baseId + 7, fieldName: 'Exterior Color', fieldType: 'text' },
  ]
}

const FIELDS_BY_CATEGORY_ID: Record<number, CategoryFieldDef[]> = {
  2: makeFieldsForCategory(1),
  3: makeFieldsForCategory(9),
  4: makeFieldsForCategory(17),
  5: makeFieldsForCategory(25),
  6: makeFieldsForCategory(33),
  7: makeFieldsForCategory(1),
  8: makeFieldsForCategory(1),
}

export function getFieldsForCategory(categoryId: number): CategoryFieldDef[] {
  return FIELDS_BY_CATEGORY_ID[categoryId] ?? []
}

export function getLeafCategories(): CategoryOption[] {
  return CAR_CATEGORIES.filter((c) => !CAR_CATEGORIES.some((child) => child.parentId === c.id))
}
