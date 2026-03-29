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
