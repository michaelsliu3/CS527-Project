import { Box, Image, type BoxProps } from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'
import { resolveMediaUrl } from '../utils/mediaUrl'

interface UserAvatarProps {
  name: string
  avatarUrl: string | null | undefined
  size?: string
  bg?: string
  color?: string
}

function resolveFallbackInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'

  const anonymousMatch = trimmed.match(/^\[anonymous\s+([a-z]+)\]$/i)
  if (anonymousMatch) {
    return anonymousMatch[1][0]?.toUpperCase() ?? '?'
  }

  return trimmed[0]?.toUpperCase() ?? '?'
}

export function UserAvatar({
  name,
  avatarUrl,
  size = '32px',
  bg = 'gray.600',
  color = 'white',
}: UserAvatarProps) {
  const resolvedSrc = useMemo(() => resolveMediaUrl(avatarUrl), [avatarUrl])
  const [imageErrored, setImageErrored] = useState(false)
  useEffect(() => {
    setImageErrored(false)
  }, [resolvedSrc])
  const fallback = resolveFallbackInitial(name)

  const frameProps: BoxProps = {
    w: size,
    h: size,
    minW: size,
    borderRadius: 'full',
    overflow: 'hidden',
    bg,
    borderWidth: '1px',
    borderColor: 'whiteAlpha.300',
  }

  if (resolvedSrc && !imageErrored) {
    return (
      <Box {...frameProps}>
        <Image
          src={resolvedSrc}
          alt={`${name} avatar`}
          w="100%"
          h="100%"
          fit="cover"
          onError={() => setImageErrored(true)}
        />
      </Box>
    )
  }

  return (
    <Box {...frameProps} display="flex" alignItems="center" justifyContent="center" color={color} fontSize="xs" fontWeight="bold">
      {fallback}
    </Box>
  )
}
