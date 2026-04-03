import { Box, Flex, Image, Text } from '@chakra-ui/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { LuChevronLeft, LuChevronRight, LuBox } from 'react-icons/lu'

export interface CarouselSlide {
  type: 'image' | '3d'
  src?: string
  alt?: string
  render?: (context: { isActive: boolean; activationCount: number }) => ReactNode
}

interface ImageCarouselProps {
  slides: CarouselSlide[]
  aspectRatio?: number
}

const SWIPE_THRESHOLD = 40

export function ImageCarousel({ slides, aspectRatio = 16 / 9 }: ImageCarouselProps) {
  const [current, setCurrent] = useState(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [activationCounts, setActivationCounts] = useState<number[]>(() =>
    slides.map((_, i) => (i === 0 ? 1 : 0)),
  )

  const dragStart = useRef<{ x: number; y: number; time: number } | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const slideCount = slides.length

  useEffect(() => {
    setActivationCounts(slides.map((_, i) => (i === 0 ? 1 : 0)))
    setCurrent(0)
  }, [slides])

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

  return (
    <Box position="relative" w="100%" bg="black" borderRadius="lg" overflow="hidden">
      <Box
        ref={trackRef}
        position="relative"
        w="100%"
        aspectRatio={aspectRatio}
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
                  {slide.render({ isActive: i === current, activationCount: activationCounts[i] ?? 0 })}
                </Box>
              )}
            </Box>
          ))}
        </Flex>
      </Box>

      {/* Prev / Next arrows */}
      {slideCount > 1 && current > 0 && (
        <Box
          as="button"
          position="absolute"
          left={2}
          top="50%"
          transform="translateY(-50%)"
          bg="blackAlpha.600"
          _hover={{ bg: 'blackAlpha.800' }}
          color="white"
          borderRadius="full"
          w={9}
          h={9}
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={5}
          cursor="pointer"
          transition="background 0.15s"
          onClick={goPrev}
        >
          <LuChevronLeft size={20} />
        </Box>
      )}
      {slideCount > 1 && current < slideCount - 1 && (
        <Box
          as="button"
          position="absolute"
          right={2}
          top="50%"
          transform="translateY(-50%)"
          bg="blackAlpha.600"
          _hover={{ bg: 'blackAlpha.800' }}
          color="white"
          borderRadius="full"
          w={9}
          h={9}
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={5}
          cursor="pointer"
          transition="background 0.15s"
          onClick={goNext}
        >
          <LuChevronRight size={20} />
        </Box>
      )}

      {/* Dot indicators */}
      {slideCount > 1 && (
        <Flex
          position="absolute"
          bottom={3}
          left="50%"
          transform="translateX(-50%)"
          gap={2}
          zIndex={5}
          bg="blackAlpha.500"
          borderRadius="full"
          px={3}
          py={1.5}
          backdropFilter="blur(8px)"
        >
          {slides.map((slide, i) => (
            <Box
              key={i}
              as="button"
              w={current === i ? '22px' : '8px'}
              h="8px"
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
          top={3}
          right={3}
          zIndex={5}
          bg="blackAlpha.600"
          borderRadius="md"
          px={2.5}
          py={1}
          gap={1.5}
          align="center"
          backdropFilter="blur(8px)"
        >
          <LuBox size={14} color="white" />
          <Text fontSize="xs" color="white" fontWeight="semibold" letterSpacing="0.04em">
            3D
          </Text>
        </Flex>
      )}

      {/* Drag to rotate hint on 3D slide */}
      {slides[current]?.type === '3d' && (
        <Text
          position="absolute"
          bottom={10}
          left="50%"
          transform="translateX(-50%)"
          fontSize="xs"
          color="whiteAlpha.600"
          zIndex={5}
          pointerEvents="none"
          textAlign="center"
        >
          Drag to rotate · Scroll to zoom
        </Text>
      )}
    </Box>
  )
}
