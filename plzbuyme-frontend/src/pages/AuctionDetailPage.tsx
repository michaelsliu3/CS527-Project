import { useEffect, useState } from 'react'
import {
  Box,
  Badge,
  Button,
  Container,
  Flex,
  Heading,
  Input,
  SimpleGrid,
  Spinner,
  Text,
} from '@chakra-ui/react'
import { useParams, useNavigate } from 'react-router-dom'
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
import { showErrorToast } from '../components/ui/toaster'
import { dark } from '../theme/colors'
import { isAxiosError } from 'axios'

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
  const { user } = useAuth()
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
      <Container maxW="container.md">
        <Text color="red.400">{error ?? 'Not found.'}</Text>
        <Button mt={4} variant="outline" onClick={() => navigate('/auctions')}>
          Back to listings
        </Button>
      </Container>
    )
  }

  const statusColor =
    auction.status === 'active' ? 'green' : auction.status === 'sold' ? 'blue' : 'gray'

  return (
    <Container maxW="container.lg">
      <Box mb={6}>
        <Flex align="center" gap={2} mb={2}>
          <Heading size="lg" color="white">
            {auction.title}
          </Heading>
          <Badge colorPalette={statusColor} size="sm">
            {auction.status}
          </Badge>
        </Flex>
        <Text color={dark.muted}>
          {auction.categoryName} · by {auction.sellerUsername}
        </Text>
        {auction.status === 'active' && (
          <Text fontSize="sm" color={dark.muted} mt={1}>
            Ends in {countdown}
          </Text>
        )}
      </Box>

      <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6}>
        <Box>
          <Box
            bg={dark.cardBg}
            borderWidth="1px"
            borderColor={dark.borderSubtle}
            borderRadius="md"
            p={4}
            mb={4}
          >
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
                <SimpleGrid columns={2} gap={2}>
                  {auction.fieldValues.map((fv, i) => (
                    <Flex key={i} gap={2}>
                      <Text color={dark.muted}>{fv.fieldName}:</Text>
                      <Text color="white">{fv.value}</Text>
                    </Flex>
                  ))}
                </SimpleGrid>
              </Box>
            )}
          </Box>

          {canBid && (
            <Box
              bg={dark.cardBg}
              borderWidth="1px"
              borderColor={dark.borderSubtle}
              borderRadius="md"
              p={4}
              mb={4}
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
          >
            <Heading size="sm" mb={3} color="white">
              Bid history
            </Heading>
            <BidHistory bids={auction.bidHistory} />
          </Box>
        </Box>

        {similar.length > 0 && (
          <Box>
            <Heading size="sm" mb={3} color="white">
              Similar items
            </Heading>
            <SimpleGrid columns={1} gap={3}>
              {similar.map((item) => (
                <AuctionCard key={item.id} auction={item} />
              ))}
            </SimpleGrid>
          </Box>
        )}
      </SimpleGrid>
    </Container>
  )
}
