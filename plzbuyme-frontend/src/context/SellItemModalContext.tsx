import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Box, Container, Flex, Heading, IconButton } from '@chakra-ui/react'
import { keyframes } from '@emotion/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CreateAuctionForm } from '../components/CreateAuctionForm'
import { dark } from '../theme/colors'
import { showSuccessToast } from '../components/ui/toaster'
import { APP_PAGE_PX } from '../theme/layout'
import { useScrollLock } from '../hooks/useScrollLock'

const overlayFadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const overlayFadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`

const panelScaleIn = keyframes`
  from { opacity: 0; transform: translateY(10px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`

const panelScaleOut = keyframes`
  from { opacity: 1; transform: translateY(0) scale(1); }
  to { opacity: 0; transform: translateY(8px) scale(0.985); }
`

const MODAL_CLOSE_MS = 180

/** Hide scrollbars; wheel / touch scrolling still works. */
const hideScrollbarCss = {
  scrollbarWidth: 'none' as const,
  msOverflowStyle: 'none' as const,
  '&::-webkit-scrollbar': {
    display: 'none',
  },
}

export type SellItemAfterCreateHandler = (auctionId: number) => void

export interface OpenSellItemModalOptions {
  onAfterCreate?: SellItemAfterCreateHandler
}

interface SellItemModalContextValue {
  openSellModal: (options?: OpenSellItemModalOptions) => void
}

const SellItemModalContext = createContext<SellItemModalContextValue | null>(null)

export function SellItemModalProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [formMountKey, setFormMountKey] = useState(0)
  const onAfterCreateRef = useRef<SellItemAfterCreateHandler | undefined>(undefined)
  const closeTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  const finishClose = useCallback(() => {
    setOpen(false)
    setIsClosing(false)
    onAfterCreateRef.current = undefined
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }, [])

  const requestClose = useCallback(() => {
    if (!open || isClosing) return
    setIsClosing(true)
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null
      finishClose()
    }, MODAL_CLOSE_MS)
  }, [open, isClosing, finishClose])

  const openSellModal = useCallback((options?: OpenSellItemModalOptions) => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setIsClosing(false)
    onAfterCreateRef.current = options?.onAfterCreate
    setFormMountKey((k) => k + 1)
    setOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    requestClose()
  }, [requestClose])

  const handleFormSuccess = useCallback(
    (auctionId: number) => {
      showSuccessToast('Auction listed', 'Your auction was created successfully.')
      const afterCreate = onAfterCreateRef.current
      onAfterCreateRef.current = undefined
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
      setIsClosing(false)
      setOpen(false)
      if (afterCreate) {
        afterCreate(auctionId)
      } else {
        navigate(`/auctions/${auctionId}`, { state: { backgroundLocation: location } })
      }
    },
    [navigate, location],
  )

  useScrollLock(open)

  useEffect(() => {
    if (!open || isClosing) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        requestClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, isClosing, requestClose])

  const value = useMemo(() => ({ openSellModal }), [openSellModal])

  return (
    <SellItemModalContext.Provider value={value}>
      {children}
      {open && (
        <Box
          position="fixed"
          inset={0}
          bg="blackAlpha.600"
          zIndex={1400}
          overflowY="auto"
          py={{ base: 4, md: 8 }}
          animation={`${isClosing ? overlayFadeOut : overlayFadeIn} 0.18s ease-out forwards`}
          onClick={handleClose}
          css={hideScrollbarCss}
        >
          <Container maxW="container.xl" px={APP_PAGE_PX} py={{ base: 4, md: 6 }}>
            <Box
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-auction-modal-title"
              maxW="920px"
              mx="auto"
              bg="rgba(24, 24, 27, 0.12)"
              backdropFilter="blur(12px)"
              borderWidth="1px"
              borderColor="whiteAlpha.200"
              borderRadius="xl"
              p={{ base: 4, md: 6 }}
              boxShadow="0 18px 48px rgba(0,0,0,0.35)"
              position="relative"
              onClick={(event) => event.stopPropagation()}
              animation={`${isClosing ? panelScaleOut : panelScaleIn} 0.18s ease-out forwards`}
            >
              <Flex align="center" justify="space-between" gap={3} mb={5}>
                <Heading
                  id="create-auction-modal-title"
                  size="lg"
                  color="white"
                  fontWeight="extrabold"
                >
                  Create Auction
                </Heading>
                <IconButton
                  aria-label="Close create auction"
                  size="sm"
                  variant="ghost"
                  color={dark.muted}
                  _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                  onClick={handleClose}
                  flexShrink={0}
                >
                  ×
                </IconButton>
              </Flex>
              <CreateAuctionForm
                key={formMountKey}
                onCancel={handleClose}
                onSuccess={handleFormSuccess}
              />
            </Box>
          </Container>
        </Box>
      )}
    </SellItemModalContext.Provider>
  )
}

export function useSellItemModal(): SellItemModalContextValue {
  const ctx = useContext(SellItemModalContext)
  if (!ctx) {
    throw new Error('useSellItemModal must be used within SellItemModalProvider')
  }
  return ctx
}
