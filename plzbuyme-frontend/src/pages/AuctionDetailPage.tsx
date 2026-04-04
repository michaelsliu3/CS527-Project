import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Badge, Button, Container, Flex, Heading, IconButton, Input, Spinner, Text } from '@chakra-ui/react'
import { keyframes } from '@emotion/react'
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
import { AdminAuctionEditModal } from '../components/AdminAuctionEditModal'
import { BidHistory } from '../components/BidHistory'
import { AuctionCard } from '../components/AuctionCard'
import { ImageCarousel, type CarouselSlide } from '../components/ImageCarousel'
import { DisplayNameText } from '../components/DisplayNameText'
import { UserAvatar } from '../components/UserAvatar'
import { showErrorToast } from '../components/ui/toaster'
import { dark } from '../theme/colors'
import { isAxiosError } from 'axios'
import { APP_PAGE_PX } from '../theme/layout'
import { resolveMediaUrl } from '../utils/mediaUrl'
import { notifyAuctionListRefresh } from '../utils/auctionListRefresh'
import { useScrollLock } from '../hooks/useScrollLock'
import { resolveAuction3dModelKey } from '../utils/auction3dModel'

const Su7ThreeHero = lazy(async () => {
  const module = await import('../components/Su7ThreeHero')
  return { default: module.Su7ThreeHero }
})

function buildImageVariantUrl(sourceUrl: string, frame: '01' | '02'): string | null {
  const [withoutHash, hash = ''] = sourceUrl.split('#')
  const [withoutQuery, query = ''] = withoutHash.split('?')
  const replaced = withoutQuery.replace(/2_\d{2}(?:-[^/.]+)?(?=\.[^/.]+$)/i, `2_${frame}`)
  if (replaced === withoutQuery) return null
  const queryPart = query ? `?${query}` : ''
  const hashPart = hash ? `#${hash}` : ''
  return `${replaced}${queryPart}${hashPart}`
}

function getImageFrameTag(sourceUrl: string): '00' | '01' | '02' | null {
  const match = sourceUrl.match(/2_(\d{2})/i)
  if (!match) return null
  if (match[1] === '00' || match[1] === '01' || match[1] === '02') {
    return match[1]
  }
  return null
}

function toUtcEpochMs(value: string): number {
  const normalized = value.endsWith('Z') || /[-+]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`
  return new Date(normalized).getTime()
}

function formatCountdown(closeDateTime: string): string {
  const end = toUtcEpochMs(closeDateTime)
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

const overlayFadeIn = keyframes`
  from { opacity: 0; backdrop-filter: blur(0px); }
  to { opacity: 1; backdrop-filter: blur(2px); }
`

const overlayFadeOut = keyframes`
  from { opacity: 1; backdrop-filter: blur(2px); }
  to { opacity: 0; backdrop-filter: blur(0px); }
`

const panelScaleIn = keyframes`
  from { opacity: 0; transform: translateY(10px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`

const panelScaleOut = keyframes`
  from { opacity: 1; transform: translateY(0) scale(1); }
  to { opacity: 0; transform: translateY(8px) scale(0.985); }
`

export function AuctionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, refreshProfile } = useAuth()
  const isModal = Boolean(location.state && (location.state as { backgroundLocation?: unknown }).backgroundLocation)
  const [isClosing, setIsClosing] = useState(false)
  const closeTimeoutRef = useRef<number | null>(null)

  useScrollLock(isModal)

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setIsClosing(false)
  }, [id, location.key])

  const handleClose = () => {
    if (isClosing) {
      return
    }

    if (isModal) {
      setIsClosing(true)
      closeTimeoutRef.current = window.setTimeout(() => {
        closeTimeoutRef.current = null
        navigate(-1)
      }, 180)
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
  const [adminEditOpen, setAdminEditOpen] = useState(false)
  const [isDriving3D, setIsDriving3D] = useState(false)
  const [introComplete3D, setIntroComplete3D] = useState(false)
  const adminEditOpenRef = useRef(false)
  const handleCloseRef = useRef(handleClose)
  adminEditOpenRef.current = adminEditOpen
  handleCloseRef.current = handleClose

  const { register, handleSubmit, setValue } = useForm<BidFormValues>({
    defaultValues: { amount: '', autoLimit: '' },
  })

  useEffect(() => {
    if (!isModal) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.body.dataset.threeCarouselFullscreen === 'true') return
      if (e.key !== 'Escape' || adminEditOpenRef.current) return
      handleCloseRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isModal])

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

  const closeEpochMs = auction ? toUtcEpochMs(auction.closeDateTime) : 0
  const canBid =
    user &&
    auction &&
    auction.status === 'active' &&
    closeEpochMs > Date.now() &&
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
      notifyAuctionListRefresh()
      await refreshProfile()
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
      notifyAuctionListRefresh()
      await refreshProfile()
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

  const carouselSlides = useMemo<CarouselSlide[]>(() => {
    if (!auction) return []
    const slides: CarouselSlide[] = []
    const seenImageUrls = new Set<string>()

    const imgSrc = resolveMediaUrl(auction.detailImageUrl ?? auction.imageUrl)
    const altImgSrc = resolveMediaUrl(auction.imageUrl)
    const model = auction.fieldValues.find((fv) => fv.fieldName.toLowerCase() === 'model')?.value ?? ''
    const searchableText = `${auction.title} ${auction.description ?? ''} ${model}`
    const heroModelKey = resolveAuction3dModelKey(searchableText)
    const isSu7 = heroModelKey === 'su7'

    if (heroModelKey) {
      slides.push({
        type: '3d',
        render: ({ activationCount, isFullscreen }) => (
          <Suspense fallback={<Box w="100%" h="100%" bg="#05070d" />}>
            <Su7ThreeHero
              key={`${heroModelKey}-3d-${activationCount}`}
              title={auction.title}
              modelKey={heroModelKey}
              interactive
              fullscreenUI={isFullscreen}
              onDrivingChange={setIsDriving3D}
              onIntroStart={() => setIntroComplete3D(false)}
              onIntroComplete={() => setIntroComplete3D(true)}
            />
          </Suspense>
        ),
      })
    }

    if (imgSrc) {
      slides.push({ type: 'image', src: imgSrc, alt: auction.title })
      seenImageUrls.add(imgSrc)
    }

    if (isSu7 && imgSrc) {
      const sourcesToInspect = [imgSrc, altImgSrc].filter((v): v is string => Boolean(v))

      ;(['01', '02'] as const).forEach((frame) => {
        const existingFrameUrl = sourcesToInspect.find((source) => getImageFrameTag(source) === frame)
        const frameSrc = existingFrameUrl ?? buildImageVariantUrl(imgSrc, frame)
        if (!frameSrc || seenImageUrls.has(frameSrc)) return
        slides.push({
          type: 'image',
          src: frameSrc,
          alt: `${auction.title} angle ${frame}`,
        })
        seenImageUrls.add(frameSrc)
      })
    }

    return slides
  }, [auction])

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
  const categoryNames =
    auction.categoryNames && auction.categoryNames.length > 0
      ? auction.categoryNames
      : [auction.categoryName].filter((v): v is string => Boolean(v))

  const adminEditModal =
    user?.role === 'admin' ? (
      <AdminAuctionEditModal
        auction={auction}
        open={adminEditOpen}
        onClose={() => setAdminEditOpen(false)}
        onSaved={(d) => {
          setAuction(d)
          setCountdown(formatCountdown(d.closeDateTime))
          setValue('amount', String(d.currentPrice + d.bidIncrement))
          notifyAuctionListRefresh()
        }}
      />
    ) : null

  const auctionPanel = (
    <>
      <Box
          maxW="920px"
          mx="auto"
          pointerEvents={isModal ? 'auto' : undefined}
          bg={dark.cardBg}
          borderWidth="1px"
          borderColor={dark.borderSubtle}
          borderRadius="xl"
          p={{ base: 4, md: 6 }}
          boxShadow="0 18px 48px rgba(0,0,0,0.45)"
          position="relative"
          animation={isModal ? `${isClosing ? panelScaleOut : panelScaleIn} 0.18s ease-out forwards` : undefined}
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
          <Flex align="center" gap={2} flexShrink={0}>
            {user?.role === 'admin' && (
              <Button
                size="sm"
                variant="outline"
                borderColor="red.400"
                color="red.300"
                _hover={{ bg: 'whiteAlpha.100', borderColor: 'red.300', color: 'red.200' }}
                onClick={() => setAdminEditOpen(true)}
              >
                Edit
              </Button>
            )}
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
        </Flex>
        <Flex color={dark.muted} align="center" gap={2}>
          <Text>{(categoryNames.length ? categoryNames : [auction.categoryName]).join(' · ')} · by</Text>
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
          {carouselSlides.length > 0 && (
            <Box
              w={{ base: 'calc(100% + 2rem)', md: 'calc(100% + 3rem)' }}
              mx={{ base: '-1rem', md: '-1.5rem' }}
            >
              <ImageCarousel slides={carouselSlides} aspectRatio={16 / 9} hideOverlays={isDriving3D || !introComplete3D} />
            </Box>
          )}
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
              {user && (
                <Text fontSize="sm" color={dark.muted} mb={2}>
                  Spendable wallet: $
                  {(user.walletAvailableBalance ?? 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              )}
              {bidError && (
                <Text color="red.400" fontSize="sm" mb={2}>
                  {bidError}
                </Text>
              )}
              <form onSubmit={handleSubmit(onPlaceBid)}>
                <Flex gap={2} mb={3}>
                  <Input
                    type="number"
                    step="any"
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
                    step="any"
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
        <Box maxW="1100px" mx="auto" mt={8} pointerEvents={isModal ? 'auto' : undefined}>
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
    </>
  )

  const detailPageBody = (
    <>
      {auctionPanel}
      {adminEditModal}
    </>
  )

  if (isModal) {
    return (
      <Box position="fixed" inset={0} zIndex={1400} overflowY="auto">
        <Box position="relative" minH="100%" w="100%">
          {/* Full-area layer receives side/top/bottom dimmed clicks; sheet is pointer-events auto above */}
          <Box
            data-testid="auction-detail-modal-backdrop"
            position="absolute"
            inset={0}
            minH="100%"
            bg="blackAlpha.700"
            backdropFilter={isClosing ? 'blur(0px)' : 'blur(2px)'}
            animation={`${isClosing ? overlayFadeOut : overlayFadeIn} 0.18s ease-out forwards`}
            onPointerDown={() => {
              if (adminEditOpenRef.current) return
              handleCloseRef.current()
            }}
          />
          <Box
            position="relative"
            zIndex={1}
            display="flex"
            flexDirection="column"
            alignItems="center"
            pointerEvents="none"
            px={APP_PAGE_PX}
            py={{ base: 4, md: 8 }}
          >
            {/* Only cards capture clicks; horizontal strips beside 920px / 1100px content hit the backdrop */}
            {detailPageBody}
          </Box>
        </Box>
      </Box>
    )
  }

  return (
    <Container maxW="container.xl" px={APP_PAGE_PX} py={{ base: 4, md: 6 }}>
      {detailPageBody}
    </Container>
  )
}
