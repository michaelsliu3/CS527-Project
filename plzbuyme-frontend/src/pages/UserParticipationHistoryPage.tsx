import { useEffect, useMemo, useState } from 'react'
import { Box, Container, Flex, Heading, Spinner, Text } from '@chakra-ui/react'
import { isAxiosError } from 'axios'
import { useLocation, useParams } from 'react-router-dom'
import { getUserParticipationHistory, type AuctionListItem } from '../api/auctions'
import { AuctionCard } from '../components/AuctionCard'
import { DisplayNameText } from '../components/DisplayNameText'
import { UserAvatar } from '../components/UserAvatar'
import { dark } from '../theme/colors'
import { APP_PAGE_PX } from '../theme/layout'

interface TargetUserRouteState {
  targetUser?: {
    id: number
    username: string
    avatarUrl?: string | null
    displayNameColor?: string | null
  }
}

export function UserParticipationHistoryPage() {
  const { userId } = useParams<{ userId: string }>()
  const location = useLocation()
  const routeState = (location.state as TargetUserRouteState | null)?.targetUser
  const parsedUserId = useMemo(() => Number(userId), [userId])
  const [items, setItems] = useState<AuctionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
      setError('Invalid user id.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    getUserParticipationHistory(parsedUserId)
      .then((res) => {
        setItems(res.data)
      })
      .catch((err) => {
        if (isAxiosError(err) && err.response?.status === 403) {
          setError('You are not allowed to view this user history.')
          return
        }
        setError('Failed to load participation history.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [parsedUserId])

  return (
    <Container maxW="container.xl" px={APP_PAGE_PX}>
      <Flex direction="column" gap={4}>
        <Box>
          <Heading size="lg" color="white" mb={2}>
            User participation history
          </Heading>
          <Flex align="center" gap={2} color={dark.muted}>
            <Text>Target:</Text>
            <UserAvatar
              name={routeState?.username ?? `User ${parsedUserId}`}
              avatarUrl={routeState?.avatarUrl}
              size="24px"
            />
            <DisplayNameText
              name={routeState?.username ?? `User ${parsedUserId}`}
              displayNameColor={routeState?.displayNameColor}
              fallbackColor={dark.muted}
              fontWeight="bold"
            />
          </Flex>
        </Box>

        {loading && (
          <Flex justify="center" py={12}>
            <Spinner size="xl" color="brand.400" />
          </Flex>
        )}

        {!loading && error && (
          <Box
            bg={dark.cardBg}
            borderWidth="1px"
            borderColor={dark.borderSubtle}
            borderRadius="lg"
            p={4}
          >
            <Text color="red.300">{error}</Text>
          </Box>
        )}

        {!loading && !error && items.length === 0 && (
          <Box
            bg={dark.cardBg}
            borderWidth="1px"
            borderColor={dark.borderSubtle}
            borderRadius="lg"
            p={4}
          >
            <Text color={dark.muted}>No auction participation records found for this user.</Text>
          </Box>
        )}

        {!loading && !error && items.length > 0 && (
          <Flex direction={{ base: 'column', md: 'row' }} gap={3} wrap="wrap">
            {items.map((item) => (
              <Box key={item.id} w={{ base: '100%', md: 'calc(50% - 6px)', xl: 'calc(33.333% - 8px)' }}>
                <AuctionCard auction={item} />
              </Box>
            ))}
          </Flex>
        )}
      </Flex>
    </Container>
  )
}
