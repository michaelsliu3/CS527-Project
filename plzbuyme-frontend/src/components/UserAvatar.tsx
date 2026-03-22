import { Box, type BoxProps } from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'

interface UserAvatarProps {
  name: string
  avatarUrl: string | null | undefined
  size?: string
  bg?: string
  color?: string
}

function resolveAvatarSrc(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://') || avatarUrl.startsWith('data:')) {
    return avatarUrl
  }
  if (!avatarUrl.startsWith('/')) return avatarUrl

  const apiBase = import.meta.env.VITE_API_URL as string | undefined
  if (!apiBase) return avatarUrl
  const origin = apiBase.replace(/\/api\/?$/, '')
  return `${origin}${avatarUrl}`
}

export function UserAvatar({
  name,
  avatarUrl,
  size = '32px',
  bg = 'gray.600',
  color = 'white',
}: UserAvatarProps) {
  const resolvedSrc = useMemo(() => resolveAvatarSrc(avatarUrl), [avatarUrl])
  const [imageErrored, setImageErrored] = useState(false)
  useEffect(() => {
    setImageErrored(false)
  }, [resolvedSrc])
  const fallback = (name.trim()[0] ?? '?').toUpperCase()

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
        <Box
          as="img"
          src={resolvedSrc}
          alt={`${name} avatar`}
          w="100%"
          h="100%"
          objectFit="cover"
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
