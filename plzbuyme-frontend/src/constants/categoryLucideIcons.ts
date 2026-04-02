import type { IconType } from 'react-icons'
import * as LucidePack from 'react-icons/lu'
import {
  LuBattery,
  LuBox,
  LuCar,
  LuCarFront,
  LuCircleDot,
  LuFolderTree,
  LuGauge,
  LuLayoutGrid,
  LuPackage,
  LuShoppingBag,
  LuSparkles,
  LuTag,
  LuTruck,
  LuZap,
} from 'react-icons/lu'

/** Platform default for categories without a stored key; react-icons `LuCar`. */
export const DEFAULT_CATEGORY_LUCIDE_ICON_KEY = 'Car'

/** Menu value for free-text Lucide name (PascalCase, no `Lu` prefix). */
export const GM_CUSTOM_LUCIDE_VALUE = '__custom__'

const lucidePack = LucidePack as Record<string, IconType | undefined>

/** `lowerSuffix` → canonical PascalCase name (e.g. `carfront` → `CarFront`). */
const canonicalLucideKeyByLower = (() => {
  const m = new Map<string, string>()
  for (const exportName of Object.keys(lucidePack)) {
    if (!exportName.startsWith('Lu') || exportName.length < 3) continue
    const fn = lucidePack[exportName]
    if (typeof fn !== 'function') continue
    const suffix = exportName.slice(2)
    m.set(suffix.toLowerCase(), suffix)
  }
  return m
})()

/** Case-insensitive match to react-icons/lu export name (no `Lu` prefix). */
export function canonicalLucideIconKey(input: string): string | null {
  const t = input.trim()
  if (!t) return null
  return canonicalLucideKeyByLower.get(t.toLowerCase()) ?? null
}

/** Normalize custom input for API / display: canonical when known, else trimmed. */
export function normalizeLucideIconKeyForApi(input: string): string {
  const t = input.trim()
  if (!t) return ''
  return canonicalLucideIconKey(t) ?? t
}

const lucideKeyToIcon: Record<string, IconType> = {
  LayoutGrid: LuLayoutGrid,
  Car: LuCar,
  CarFront: LuCarFront,
  Truck: LuTruck,
  Gauge: LuGauge,
  Battery: LuBattery,
  Zap: LuZap,
  Sparkles: LuSparkles,
  Package: LuPackage,
  Tag: LuTag,
  Box: LuBox,
  FolderTree: LuFolderTree,
  ShoppingBag: LuShoppingBag,
  CircleDot: LuCircleDot,
}

/** Curated GM presets (each key must match a `Lu{Name}` export when possible). */
export const GM_CATEGORY_LUCIDE_OPTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'Car', label: 'Default (car)' },
  { key: 'LayoutGrid', label: 'Layout grid' },
  { key: 'CarFront', label: 'Car front' },
  { key: 'Truck', label: 'Truck / SUV' },
  { key: 'Gauge', label: 'Gauge (sport)' },
  { key: 'Battery', label: 'Battery (EV)' },
  { key: 'Zap', label: 'Zap (hybrid)' },
  { key: 'Sparkles', label: 'Sparkles' },
  { key: 'Package', label: 'Package' },
  { key: 'Tag', label: 'Tag' },
  { key: 'Box', label: 'Box' },
  { key: 'FolderTree', label: 'Folder tree' },
  { key: 'ShoppingBag', label: 'Shopping bag' },
  { key: 'CircleDot', label: 'Circle dot (placeholder)' },
]

export function isGmPresetLucideKey(key: string): boolean {
  const t = key.trim()
  if (!t) return false
  const canon = canonicalLucideIconKey(t) ?? t
  return GM_CATEGORY_LUCIDE_OPTIONS.some((o) => o.key === canon)
}

function getLucideExportByKey(trimmedKey: string): IconType | undefined {
  const canon = canonicalLucideKeyByLower.get(trimmedKey.toLowerCase()) ?? trimmedKey
  const exported = lucidePack[`Lu${canon}`]
  return typeof exported === 'function' ? exported : undefined
}

/**
 * Resolves a stored Lucide key to an icon component. Unknown or missing exports fall back to the default (car).
 * Matching is case-insensitive against bundled `react-icons/lu` exports.
 */
export function resolveLucideIconForKey(key: string | null | undefined): IconType {
  const trimmed = key?.trim() ?? ''
  if (!trimmed) {
    return lucideKeyToIcon[DEFAULT_CATEGORY_LUCIDE_ICON_KEY]
  }
  const canon = canonicalLucideKeyByLower.get(trimmed.toLowerCase()) ?? trimmed
  const fromMap =
    lucideKeyToIcon[canon] ??
    Object.entries(lucideKeyToIcon).find(([k]) => k.toLowerCase() === canon.toLowerCase())?.[1]
  if (fromMap) {
    return fromMap
  }
  const fromPack = getLucideExportByKey(trimmed)
  return fromPack ?? lucideKeyToIcon[DEFAULT_CATEGORY_LUCIDE_ICON_KEY]
}
