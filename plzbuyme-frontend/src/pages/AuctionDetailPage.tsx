import { useEffect, useState } from 'react'
import { Box, Badge, Button, Container, Flex, Heading, IconButton, Image, Input, Spinner, Text } from '@chakra-ui/react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import {
  getAuction,
  getSimilarAuctions,
  placeBid,
  setAutoBid,
  type AuctionDetail,
  type AuctionListItem,
} from '../api/auctions'
import { BidHistory } from '../components/BidHistory'
import { AuctionCard } from '../components/AuctionCard'
import { DisplayNameText } from '../components/DisplayNameText'
import { UserAvatar } from '../components/UserAvatar'
import { showErrorToast } from '../components/ui/toaster'
import { dark } from '../theme/colors'
import { isAxiosError } from 'axios'
import { APP_PAGE_PX } from '../theme/layout'
import { resolveMediaUrl } from '../utils/mediaUrl'

function formatCountdown(closeDateTime: string): string {
  const end = new Date(closeDateTime).getTime()
  const now = Date.now()
  const diff = end - now
  if (diff <= 0) return 'Ended'
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
  if (days > 0) return `${days}d ${hours}h ${mins}m`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

interface BidFormValues {
  amount: string
  autoLimit: string
}

export function AuctionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const isModal = Boolean(location.state && (location.state as { backgroundLocation?: unknown }).backgroundLocation)
  const handleClose = () => {
    if (isModal) {
      navigate(-1)
      return
    }
    navigate('/auctions')
  }

  const [auction, setAuction] = useState<AuctionDetail | null>(null)
  const [similar, setSimilar] = useState<AuctionListItem[]>([])
  const [countdown, setCountdown] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bidError, setBidError] = useState<string | null>(null)
  const [bidSubmitting, setBidSubmitting] = useState(false)
  const { register, handleSubmit, setValue } = useForm<BidFormValues>({
    defaultValues: { amount: '', autoLimit: '' },
  })

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    getAuction(Number(id))
      .then((res) => {
        setAuction(res.data)
        setCountdown(formatCountdown(res.data.closeDateTime))
        setValue('amount', String(res.data.currentPrice + res.data.bidIncrement))
        setError(null)
      })
      .catch(() => {
        setError('Auction not found.')
        showErrorToast('Auction not found', 'The auction may have been removed or does not exist.')
      })
      .finally(() => setLoading(false))
  }, [id, setValue])

  useEffect(() => {
    if (!auction) return
    const t = setInterval(() => setCountdown(formatCountdown(auction.closeDateTime)), 1000)
    return () => clearInterval(t)
  }, [auction])

  useEffect(() => {
    if (!id || !auction) return
    getSimilarAuctions(Number(id), 6)
      .then((res) => setSimilar(res.data))
      .catch(() => setSimilar([]))
  }, [id, auction?.id])

  const canBid =
    user &&
    auction &&
    auction.status === 'active' &&
    user.id !== auction.sellerId

  const onPlaceBid = async (data: BidFormValues) => {
    if (!auction || !id) return
    setBidError(null)
    setBidSubmitting(true)
    try {
      await placeBid(auction.id, Number(data.amount))
      const res = await getAuction(auction.id)
      setAuction(res.data)
      setValue('amount', String(res.data.currentPrice + res.data.bidIncrement))
    } catch (err) {
      const msg = isAxiosError(err) && err.response?.data
        ? (typeof err.response.data === 'string' ? err.response.data : (err.response.data as { message?: string }).message)
        : 'Failed to place bid.'
      setBidError(msg ?? 'Failed to place bid.')
      showErrorToast('Bid failed', msg ?? 'Failed to place bid.')
    } finally {
      setBidSubmitting(false)
    }
  }

  const onSetAutoBid = async (data: BidFormValues) => {
    if (!auction || !id || !data.autoLimit) return
    setBidError(null)
    setBidSubmitting(true)
    try {
      await setAutoBid(auction.id, Number(data.autoLimit))
      const res = await getAuction(auction.id)
      setAuction(res.data)
    } catch (err) {
      const msg = isAxiosError(err) && err.response?.data
        ? (typeof err.response.data === 'string' ? err.response.data : (err.response.data as { message?: string }).message)
        : 'Failed to set auto-bid.'
      setBidError(msg ?? 'Failed to set auto-bid.')
      showErrorToast('Auto-bid failed', msg ?? 'Failed to set auto-bid.')
    } finally {
      setBidSubmitting(false)
    }
  }

  if (loading || !id) {
    return (
      <Flex justify="center" py={12}>
        <Spinner size="xl" color="brand.400" />
      </Flex>
    )
  }

  if (error || !auction) {
    return (
      <Container maxW="container.md" px={APP_PAGE_PX}>
        <Text color="red.400">{error ?? 'Not found.'}</Text>
        <Button mt={4} variant="outline" onClick={handleClose}>
          Back to listings
        </Button>
      </Container>
    )
  }

  const statusColor =
    auction.status === 'active' ? 'green' : auction.status === 'sold' ? 'blue' : 'gray'
  const imageSrc = resolveMediaUrl(auction.detailImageUrl ?? auction.imageUrl)

  const content = (
    <Container maxW="container.xl" px={APP_PAGE_PX} py={{ base: 4, md: 6 }}>
      <Box
        maxW="920px"
        mx="auto"
        bg={dark.cardBg}
        borderWidth="1px"
        borderColor={dark.borderSubtle}
        borderRadius="xl"
        p={{ base: 4, md: 6 }}
        boxShadow="0 18px 48px rgba(0,0,0,0.45)"
        position="relative"
        onClick={isModal ? (event) => event.stopPropagation() : undefined}
      >
      <Box mb={6}>
        <Flex align="center" justify="space-between" gap={2} mb={2}>
          <Flex align="center" gap={2} minW={0}>
            <Heading size="lg" color="white" fontWeight="extrabold" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
              {auction.title}
            </Heading>
            <Badge colorPalette={statusColor} size="sm" flexShrink={0}>
              {auction.status}
            </Badge>
          </Flex>
          {isModal && (
            <IconButton
              aria-label="Close auction details"
              size="sm"
              variant="ghost"
              color={dark.muted}
              _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
              onClick={handleClose}
              flexShrink={0}
            >
              ×
            </IconButton>
          )}
        </Flex>
        <Flex color={dark.muted} align="center" gap={2}>
          <Text>{auction.categoryName} · by</Text>
          <UserAvatar name={auction.sellerUsername} avatarUrl={auction.sellerAvatarUrl} size="22px" />
          <DisplayNameText
            name={auction.sellerUsername}
            displayNameColor={auction.sellerDisplayNameColor}
            fallbackColor={dark.muted}
            fontWeight="bold"
          />
        </Flex>
        {auction.status === 'active' && (
          <Text fontSize="sm" color={dark.muted} mt={1}>
            Ends in {countdown}
          </Text>
        )}
      </Box>

      <Box>
        <Box mb={4}>
          {imageSrc ? (
            <Box
              w={{ base: 'calc(100% + 2rem)', md: 'calc(100% + 3rem)' }}
              mx={{ base: '-1rem', md: '-1.5rem' }}
              aspectRatio={16 / 9}
              overflow="hidden"
              bg="black"
            >
              <Image src={imageSrc} alt={auction.title} w="100%" h="100%" objectFit="cover" />
            </Box>
          ) : null}
          <Box mt={4}>
            <Text fontSize="2xl" fontWeight="bold" color="brand.400">
              ${auction.currentPrice.toLocaleString()}
            </Text>
            <Text fontSize="sm" color={dark.muted}>
              Initial: ${auction.initialPrice.toLocaleString()} · Increment: $
              {auction.bidIncrement.toLocaleString()}
            </Text>
            {auction.description && (
              <Text mt={4} color="white" whiteSpace="pre-wrap">
                {auction.description}
              </Text>
            )}
            {auction.fieldValues.length > 0 && (
              <Box mt={4}>
                <Text fontSize="sm" fontWeight="medium" color={dark.muted} mb={2}>
                  Details
                </Text>
                <Flex gap={4} wrap="wrap">
                  {auction.fieldValues.map((fv, i) => (
                    <Flex key={i} gap={2} minW={{ base: '100%', md: 'calc(50% - 8px)' }}>
                      <Text color={dark.muted}>{fv.fieldName}:</Text>
                      <Text color="white">{fv.value}</Text>
                    </Flex>
                  ))}
                </Flex>
              </Box>
            )}
          </Box>
        </Box>

        <Flex direction={{ base: 'column', lg: 'row' }} gap={4} mb={4}>
          {canBid && (
            <Box
              bg={dark.cardBg}
              borderWidth="1px"
              borderColor={dark.borderSubtle}
              borderRadius="md"
              p={4}
              flex={1}
            >
              <Heading size="sm" mb={3} color="white">
                Place bid
              </Heading>
              {bidError && (
                <Text color="red.400" fontSize="sm" mb={2}>
                  {bidError}
                </Text>
              )}
              <form onSubmit={handleSubmit(onPlaceBid)}>
                <Flex gap={2} mb={3}>
                  <Input
                    type="number"
                    step={auction.bidIncrement}
                    min={auction.currentPrice + auction.bidIncrement}
                    bg={dark.inputBg}
                    borderColor={dark.borderSubtle}
                    color="white"
                    placeholder="Amount"
                    {...register('amount', { required: true })}
                  />
                  <Button
                    type="submit"
                    bg="brand.500"
                    color="white"
                    _hover={{ bg: 'brand.400' }}
                    loading={bidSubmitting}
                  >
                    Bid
                  </Button>
                </Flex>
              </form>
              <Text fontSize="sm" color={dark.muted} mb={2}>
                Auto-bid (max limit)
              </Text>
              <form onSubmit={handleSubmit(onSetAutoBid)}>
                <Flex gap={2}>
                  <Input
                    type="number"
                    step={auction.bidIncrement}
                    min={auction.currentPrice + auction.bidIncrement}
                    bg={dark.inputBg}
                    borderColor={dark.borderSubtle}
                    color="white"
                    placeholder="Upper limit"
                    {...register('autoLimit')}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    borderColor={dark.borderSubtle}
                    color="white"
                    _hover={{ bg: 'whiteAlpha.100' }}
                    loading={bidSubmitting}
                  >
                    Set auto-bid
                  </Button>
                </Flex>
              </form>
            </Box>
          )}

          <Box
            bg={dark.cardBg}
            borderWidth="1px"
            borderColor={dark.borderSubtle}
            borderRadius="md"
            p={4}
            flex={1}
          >
            <Heading size="sm" mb={3} color="white">
              Bid history
            </Heading>
            <BidHistory bids={auction.bidHistory} />
          </Box>
        </Flex>

      </Box>
      </Box>

      {similar.length > 0 && (
        <Box maxW="1100px" mx="auto" mt={8}>
          <Heading size="sm" mb={3} color="white">
            Similar items
          </Heading>
          <Flex direction={{ base: 'column', md: 'row' }} gap={3} wrap="wrap">
            {similar.map((item) => (
              <Box key={item.id} w={{ base: '100%', md: 'calc(50% - 6px)', xl: 'calc(33.333% - 8px)' }}>
                <AuctionCard auction={item} />
              </Box>
            ))}
          </Flex>
        </Box>
      )}
    </Container>
  )

  if (isModal) {
    return (
      <Box
        position="fixed"
        inset={0}
        bg="blackAlpha.700"
        backdropFilter="blur(2px)"
        zIndex={1400}
        overflowY="auto"
        py={{ base: 4, md: 8 }}
        onClick={handleClose}
      >
        {content}
      </Box>
    )
  }

  return content
}
