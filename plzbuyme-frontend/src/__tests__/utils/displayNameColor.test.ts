import { describe, expect, it } from 'vitest'
import {
  isDisplayNamePreset,
  normalizeDisplayNameColor,
  resolveDisplayNameColor,
} from '../../utils/displayNameColor'

describe('displayNameColor utils', () => {
  it('normalizes valid hex colors to uppercase', () => {
    expect(normalizeDisplayNameColor('  #ab12cd  ')).toBe('#AB12CD')
  })

  it('returns null for invalid colors', () => {
    expect(normalizeDisplayNameColor('blue')).toBeNull()
    expect(normalizeDisplayNameColor('#123')).toBeNull()
  })

  it('normalizes supported animated presets', () => {
    expect(normalizeDisplayNameColor('rainbow')).toBe('RAINBOW')
    expect(normalizeDisplayNameColor('purpblu')).toBe('PURPBLU')
    expect(normalizeDisplayNameColor('rgbflow')).toBe('RGBFLOW')
    expect(normalizeDisplayNameColor('sunglow')).toBe('SUNGLOW')
    expect(normalizeDisplayNameColor('aurorax')).toBe('AURORAX')
    expect(normalizeDisplayNameColor('fireice')).toBe('FIREICE')
    expect(isDisplayNamePreset('RAINBOW')).toBe(true)
  })

  it('resolves to fallback when unset or invalid', () => {
    expect(resolveDisplayNameColor(null, '#FFFFFF')).toBe('#FFFFFF')
    expect(resolveDisplayNameColor('not-a-color', '#FFFFFF')).toBe('#FFFFFF')
  })
})
