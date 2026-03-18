import { Box } from '@chakra-ui/react'
import { keyframes } from '@emotion/react'
import {
  isDisplayNamePreset,
  normalizeDisplayNameColor,
  resolveDisplayNameColor,
} from '../utils/displayNameColor'

interface DisplayNameTextProps {
  name: string
  displayNameColor: string | null | undefined
  fallbackColor: string
  fontWeight?: string | number
}

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`

function presetGradient(preset: string): string {
  switch (preset) {
    case 'RAINBOW':
      return 'linear-gradient(90deg, #ff3b30, #ff9500, #ffcc00, #34c759, #00c7ff, #5e5ce6, #af52de, #ff3b30)'
    case 'PURPBLU':
      return 'linear-gradient(120deg, #7c3aed, #6366f1, #3b82f6, #22d3ee, #7c3aed)'
    case 'RGBFLOW':
      return 'linear-gradient(90deg, #ff3b30, #22c55e, #3b82f6, #ff3b30)'
    case 'SUNGLOW':
      return 'linear-gradient(120deg, #ff4fa3, #ff79c6, #ff9ed8, #ffd0ef, #ff4fa3)'
    case 'AURORAX':
      return 'linear-gradient(125deg, #ff2d95, #e879f9, #c084fc, #f472b6, #ff2d95)'
    case 'FIREICE':
      return 'linear-gradient(95deg, #ff3d00 0%, #ff8f00 35%, #fff8e1 50%, #7dd3fc 65%, #0ea5e9 100%)'
    default:
      return ''
  }
}

export function DisplayNameText({
  name,
  displayNameColor,
  fallbackColor,
  fontWeight,
}: DisplayNameTextProps) {
  const normalized = normalizeDisplayNameColor(displayNameColor)

  if (isDisplayNamePreset(normalized)) {
    return (
      <Box
        as="span"
        display="inline-block"
        fontWeight={fontWeight}
        backgroundImage={presetGradient(normalized)}
        backgroundSize="260% 260%"
        backgroundClip="text"
        sx={{ WebkitTextFillColor: 'transparent' }}
        animation={`${gradientShift} 5s linear infinite`}
      >
        {name}
      </Box>
    )
  }

  return (
    <Box as="span" color={resolveDisplayNameColor(displayNameColor, fallbackColor)} fontWeight={fontWeight}>
      {name}
    </Box>
  )
}
