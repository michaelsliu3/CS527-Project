const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/
const DISPLAY_NAME_PRESETS = ['RAINBOW', 'PURPBLU', 'RGBFLOW', 'SUNGLOW', 'AURORAX', 'FIREICE'] as const

export type DisplayNamePreset = (typeof DISPLAY_NAME_PRESETS)[number]
export const DISPLAY_NAME_STYLE_PRESETS = [...DISPLAY_NAME_PRESETS]

export function normalizeDisplayNameColor(color: string | null | undefined): string | null {
  if (color == null) return null
  const trimmed = color.trim()
  if (!trimmed) return null
  const upper = trimmed.toUpperCase()
  if (DISPLAY_NAME_PRESETS.includes(upper as DisplayNamePreset)) return upper
  if (!HEX_COLOR_REGEX.test(trimmed)) return null
  return trimmed.toUpperCase()
}

export function resolveDisplayNameColor(color: string | null | undefined, fallback: string): string {
  return normalizeDisplayNameColor(color) ?? fallback
}

export function isDisplayNamePreset(color: string | null | undefined): color is DisplayNamePreset {
  const normalized = normalizeDisplayNameColor(color)
  return normalized != null && DISPLAY_NAME_PRESETS.includes(normalized as DisplayNamePreset)
}
