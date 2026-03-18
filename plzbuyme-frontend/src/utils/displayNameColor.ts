const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/

export function normalizeDisplayNameColor(color: string | null | undefined): string | null {
  if (color == null) return null
  const trimmed = color.trim()
  if (!trimmed) return null
  if (!HEX_COLOR_REGEX.test(trimmed)) return null
  return trimmed.toUpperCase()
}

export function resolveDisplayNameColor(color: string | null | undefined, fallback: string): string {
  return normalizeDisplayNameColor(color) ?? fallback
}
