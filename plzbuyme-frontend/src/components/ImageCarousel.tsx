import { Box, Flex, Image, Portal, Text } from '@chakra-ui/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { LuChevronLeft, LuChevronRight, LuBox, LuSearch, LuMinimize2 } from 'react-icons/lu'

export interface CarouselSlide {
  type: 'image' | '3d'
  src?: string
  alt?: string
  render?: (context: { isActive: boolean; activationCount: number; isFullscreen: boolean }) => ReactNode
}

interface ImageCarouselProps {
  slides: CarouselSlide[]
  aspectRatio?: number
  hideOverlays?: boolean
  initialSlideIndex?: number
}

const SWIPE_THRESHOLD = 40

export function ImageCarousel({
  slides,
  aspectRatio = 16 / 9,
  hideOverlays = false,
  initialSlideIndex = 0,
}: ImageCarouselProps) {
  const normalizedInitialSlideIndex =
    slides.length > 0 ? Math.max(0, Math.min(initialSlideIndex, slides.length - 1)) : 0
  const [current, setCurrent] = useState(normalizedInitialSlideIndex)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isFullscreenTransitioning, setIsFullscreenTransitioning] = useState(false)
  const [activationCounts, setActivationCounts] = useState<number[]>(() =>
    slides.map((_, i) => (i === normalizedInitialSlideIndex ? 1 : 0)),
  )

  const dragStart = useRef<{ x: number; y: number; time: number } | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const slideCount = slides.length

  useEffect(() => {
    setActivationCounts(slides.map((_, i) => (i === normalizedInitialSlideIndex ? 1 : 0)))
    setCurrent(normalizedInitialSlideIndex)
    setIsExpanded(false)
    setIsFullscreenTransitioning(false)
  }, [slides, normalizedInitialSlideIndex])

  useEffect(() => {
    // Once upstream intro/drive state says overlays may show, release the hard transition guard.
    if (!hideOverlays && isFullscreenTransitioning) {
      setIsFullscreenTransitioning(false)
    }
  }, [hideOverlays, isFullscreenTransitioning])

  useEffect(() => {
    if (!isExpanded) return
    const previousOverflow = document.body.style.overflow
    const previousFullscreenFlag = document.body.dataset.threeCarouselFullscreen
    document.body.style.overflow = 'hidden'
    document.body.dataset.threeCarouselFullscreen = 'true'
    return () => {
      document.body.style.overflow = previousOverflow
      if (previousFullscreenFlag === undefined) {
        delete document.body.dataset.threeCarouselFullscreen
      } else {
        document.body.dataset.threeCarouselFullscreen = previousFullscreenFlag
      }
    }
  }, [isExpanded])

  useEffect(() => {
    if (!isExpanded) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isExpanded])

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, slideCount - 1))
      setCurrent((prev) => {
        if (clamped === prev) return prev
        setActivationCounts((prevCounts) => {
          const nextCounts =
            prevCounts.length === slideCount ? [...prevCounts] : slides.map((_, i) => prevCounts[i] ?? 0)
          nextCounts[clamped] = (nextCounts[clamped] ?? 0) + 1
          return nextCounts
        })
        return clamped
      })
    },
    [slideCount, slides],
  )

  const goPrev = useCallback(() => goTo(current - 1), [goTo, current])
  const goNext = useCallback(() => goTo(current + 1), [goTo, current])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const preventScroll = (e: TouchEvent) => {
      if (isDragging) e.preventDefault()
    }
    el.addEventListener('touchmove', preventScroll, { passive: false })
    return () => el.removeEventListener('touchmove', preventScroll)
  }, [isDragging])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (slideCount <= 1) return
    if (slides[current]?.type === '3d') return
    dragStart.current = { x: e.clientX, y: e.clientY, time: Date.now() }
    setIsDragging(true)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current || !isDragging) return
    const dx = e.clientX - dragStart.current.x
    setDragOffset(dx)
  }

  const handlePointerUp = () => {
    if (!dragStart.current) return
    const dx = dragOffset
    const elapsed = Date.now() - dragStart.current.time
    const velocity = Math.abs(dx) / Math.max(elapsed, 1)

    if (dx < -SWIPE_THRESHOLD || (velocity > 0.4 && dx < -10)) {
      goNext()
    } else if (dx > SWIPE_THRESHOLD || (velocity > 0.4 && dx > 10)) {
      goPrev()
    }

    dragStart.current = null
    setIsDragging(false)
    setDragOffset(0)
  }

  useEffect(() => {
    if (slideCount <= 1) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goPrev, goNext, slideCount])

  if (slideCount === 0) return null

  const trackTranslate = -(current * 100) + (isDragging ? (dragOffset / (trackRef.current?.offsetWidth || 1)) * 100 : 0)

  const renderCarousel = (expanded: boolean) => {
    const isFullscreen = expanded
    const overlaysHidden = hideOverlays || isFullscreenTransitioning
    const navButtonSize = isFullscreen ? 14 : 9
    const navIconSize = isFullscreen ? 30 : 20
    const dotHeight = isFullscreen ? '12px' : '8px'
    const activeDotWidth = isFullscreen ? '32px' : '22px'
    const inactiveDotWidth = isFullscreen ? '12px' : '8px'
    const badgeIconSize = isFullscreen ? 20 : 14
    const badgeFontSize = isFullscreen ? 'md' : 'xs'
    const badgePaddingX = isFullscreen ? 4 : 2.5
    const hintFontSize = isFullscreen ? 'lg' : 'xs'
    const expandButtonSize = isFullscreen ? 16 : 12
    const expandIconSize = isFullscreen ? 26 : 18
    const is3dSlide = slides[current]?.type === '3d'
    const has3dSlide = slides.some((slide) => slide.type === '3d')
    const canGoPrev = current > 0
    const canGoNext = current < slideCount - 1

    return (
      <Box
        position="relative"
        w="100%"
        bg="black"
        borderRadius={expanded ? 'none' : 'lg'}
        overflow="hidden"
      >
      <Box
        ref={trackRef}
        position="relative"
        w="100%"
        aspectRatio={expanded ? undefined : aspectRatio}
        h={expanded ? '100vh' : undefined}
        overflow="hidden"
        cursor={slides[current]?.type === '3d' ? 'grab' : slideCount > 1 ? 'grab' : 'default'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        userSelect="none"
      >
        <Flex
          position="absolute"
          top={0}
          left={0}
          h="100%"
          w={`${slideCount * 100}%`}
          transform={`translateX(${trackTranslate / slideCount}%)`}
          transition={isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)'}
        >
          {slides.map((slide, i) => (
            <Box key={i} w={`${100 / slideCount}%`} h="100%" flexShrink={0} position="relative">
              {slide.type === 'image' && slide.src && (
                <Image
                  src={slide.src}
                  alt={slide.alt ?? ''}
                  w="100%"
                  h="100%"
                  objectFit="cover"
                  draggable={false}
                  pointerEvents="none"
                />
              )}
              {slide.type === '3d' && slide.render && (
                <Box w="100%" h="100%" position="relative">
                  {slide.render({
                    isActive: i === current,
                    activationCount: activationCounts[i] ?? 0,
                    isFullscreen,
                  })}
                </Box>
              )}
            </Box>
          ))}
        </Flex>
      </Box>

      {/* Prev / Next arrows */}
      {slideCount > 1 && (
        <Box
          as="button"
          position="absolute"
          left={isFullscreen ? 3 : 2}
          top="50%"
          transform="translateY(-50%)"
          bg="blackAlpha.600"
          _hover={{ bg: 'blackAlpha.800' }}
          color="white"
          borderRadius="full"
          w={navButtonSize}
          h={navButtonSize}
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={5}
          cursor="pointer"
          transition="background 0.15s, opacity 0.22s ease-out"
          onClick={goPrev}
          opacity={overlaysHidden || !canGoPrev ? 0 : 1}
          pointerEvents={overlaysHidden || !canGoPrev ? 'none' : 'auto'}
        >
          <LuChevronLeft size={navIconSize} />
        </Box>
      )}
      {slideCount > 1 && (
        <Box
          as="button"
          position="absolute"
          right={isFullscreen ? 3 : 2}
          top="50%"
          transform="translateY(-50%)"
          bg="blackAlpha.600"
          _hover={{ bg: 'blackAlpha.800' }}
          color="white"
          borderRadius="full"
          w={navButtonSize}
          h={navButtonSize}
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={5}
          cursor="pointer"
          transition="background 0.15s, opacity 0.22s ease-out"
          onClick={goNext}
          opacity={overlaysHidden || !canGoNext ? 0 : 1}
          pointerEvents={overlaysHidden || !canGoNext ? 'none' : 'auto'}
        >
          <LuChevronRight size={navIconSize} />
        </Box>
      )}

      {/* Dot indicators */}
      {slideCount > 1 && (
        <Flex
          position="absolute"
          bottom={isFullscreen ? 4 : 3}
          left="50%"
          transform="translateX(-50%)"
          gap={isFullscreen ? 2.5 : 2}
          zIndex={5}
          bg="blackAlpha.500"
          borderRadius="full"
          px={isFullscreen ? 3.5 : 3}
          py={isFullscreen ? 2 : 1.5}
          backdropFilter="blur(8px)"
          opacity={overlaysHidden ? 0 : 1}
          transition={overlaysHidden ? 'opacity 0.15s ease-out' : 'opacity 0.8s ease-in-out'}
          pointerEvents={overlaysHidden ? 'none' : undefined}
        >
          {slides.map((slide, i) => (
            <Box
              key={i}
              as="button"
              w={current === i ? activeDotWidth : inactiveDotWidth}
              h={dotHeight}
              borderRadius="full"
              bg={current === i ? 'white' : 'whiteAlpha.500'}
              transition="all 0.25s ease"
              cursor="pointer"
              onClick={() => goTo(i)}
              display="flex"
              alignItems="center"
              justifyContent="center"
              title={slide.type === '3d' ? '3D View' : `Image ${i + 1}`}
            />
          ))}
        </Flex>
      )}

      {/* 3D badge when on the 3D slide */}
      {slides[current]?.type === '3d' && (
        <Flex
          position="absolute"
          top={isFullscreen ? 4 : 3}
          right={isFullscreen ? 4 : 3}
          zIndex={5}
          bg="blackAlpha.600"
          borderRadius="md"
          px={badgePaddingX}
          py={isFullscreen ? 1.5 : 1}
          gap={isFullscreen ? 2 : 1.5}
          align="center"
          backdropFilter="blur(8px)"
          opacity={overlaysHidden ? 0 : 1}
          transition={overlaysHidden ? 'opacity 0.15s ease-out' : 'opacity 0.8s ease-in-out'}
          pointerEvents={overlaysHidden ? 'none' : undefined}
        >
          <LuBox size={badgeIconSize} color="white" />
          <Text fontSize={badgeFontSize} color="white" fontWeight="semibold" letterSpacing="0.04em">
            3D
          </Text>
        </Flex>
      )}

      {/* Drag to rotate hint on 3D slide */}
      {slides[current]?.type === '3d' && (
        <Text
          position="absolute"
          bottom={isFullscreen ? 12 : 10}
          left="50%"
          transform="translateX(-50%)"
          fontSize={hintFontSize}
          color="whiteAlpha.600"
          zIndex={5}
          pointerEvents="none"
          textAlign="center"
          opacity={overlaysHidden ? 0 : 1}
          transition={overlaysHidden ? 'opacity 0.15s ease-out' : 'opacity 0.8s ease-in-out'}
        >
          Drag to rotate · Scroll to zoom
        </Text>
      )}

      {/* Expand/Collapse 3D section control */}
      {has3dSlide && (
        <Box
          as="button"
          position="absolute"
          right={isFullscreen ? 4 : 3}
          bottom={isFullscreen ? 4 : 3}
          zIndex={6}
          bg="blackAlpha.700"
          color="white"
          borderRadius="full"
          w={expandButtonSize}
          h={expandButtonSize}
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          backdropFilter="blur(8px)"
          _hover={{ bg: 'blackAlpha.800' }}
          _active={{ transform: 'scale(0.98)' }}
          _focusVisible={{ boxShadow: 'none' }}
          outline="none"
          opacity={overlaysHidden || !is3dSlide ? 0 : 1}
          transition="opacity 0.22s ease-out"
          pointerEvents={overlaysHidden || !is3dSlide ? 'none' : 'auto'}
          onClick={() => {
            setIsFullscreenTransitioning(true)
            setIsExpanded((prev) => !prev)
          }}
          aria-label={isExpanded ? 'Minimize 3D section' : 'Expand 3D section to full tab'}
          title={isExpanded ? 'Minimize' : 'Expand to full tab'}
        >
          {isExpanded ? <LuMinimize2 size={expandIconSize} /> : <LuSearch size={expandIconSize} />}
        </Box>
      )}
    </Box>
    )
  }

  if (isExpanded) {
    return (
      <Portal>
        <Box position="fixed" inset={0} zIndex={1700} bg="black">
          {renderCarousel(true)}
        </Box>
      </Portal>
    )
  }

  return renderCarousel(false)
}
