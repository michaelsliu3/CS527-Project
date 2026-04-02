import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Box, Button, CloseButton, Flex, Heading, Text } from '@chakra-ui/react'
import { GmToolsPanel } from './GmToolsPanel'
import { dark } from '../theme/colors'

const BACKDROP_Z = 1548
const DRAWER_Z = 1550

/** Default until the tab is measured; keeps initial closed position sane. */
const DEFAULT_TAB_W = 44

export function GmToolsDockProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const tabRef = useRef<HTMLButtonElement>(null)
  const [tabW, setTabW] = useState(DEFAULT_TAB_W)

  useLayoutEffect(() => {
    const el = tabRef.current
    if (!el) return
    const measure = () => setTabW(Math.ceil(el.getBoundingClientRect().width))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [enabled])

  const hiddenOffset = `calc(100% - ${tabW}px)`

  return (
    <>
      {children}
      {enabled && (
        <>
          {open && (
            <Box
              position="fixed"
              inset={0}
              bg="blackAlpha.600"
              zIndex={BACKDROP_Z}
              onPointerDown={() => setOpen(false)}
              aria-hidden
            />
          )}

          <Flex
            position="fixed"
            top={0}
            right={0}
            h="100dvh"
            maxW="100vw"
            zIndex={DRAWER_Z}
            flexDirection="row"
            align="stretch"
            transform={open ? 'translateX(0)' : `translateX(${hiddenOffset})`}
            transition="transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)"
            pointerEvents="auto"
          >
            <Flex align="center" flexShrink={0} alignSelf="stretch">
              <Button
                ref={tabRef}
                size="sm"
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                gap={0}
                h="auto"
                py={3}
                px={2}
                minW="unset"
                borderRightRadius={0}
                borderLeftRadius="md"
                bg="brand.600"
                color="white"
                _hover={{ bg: 'brand.500' }}
                boxShadow="lg"
                fontWeight="bold"
                fontSize="sm"
                lineHeight={1}
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? 'Close GM tools' : 'Open GM tools'}
                aria-expanded={open}
              >
                {'GM'.split('').map((ch, i) => (
                  <Text key={`${ch}-${i}`} as="span" lineHeight={1.1}>
                    {ch}
                  </Text>
                ))}
              </Button>
            </Flex>

            <Box
              flex="1"
              minW={0}
              w={{ base: `calc(100vw - ${tabW}px)`, sm: `min(560px, calc(100vw - ${tabW}px))` }}
              bg="rgba(24, 24, 27, 0.12)"
              backdropFilter="blur(5px)"
              borderLeftWidth="1px"
              borderColor="whiteAlpha.200"
              boxShadow="-12px 0 40px rgba(0,0,0,0.35)"
              display="flex"
              flexDirection="column"
              pointerEvents={open ? 'auto' : 'none'}
            >
              <Flex
                align="flex-start"
                justify="space-between"
                gap={2}
                px={2.5}
                pt={2.5}
                pb={2}
                flexShrink={0}
                borderBottomWidth="1px"
                borderColor={dark.borderSubtle}
              >
                <Heading size="sm" color="white" fontWeight="bold">
                  GM tools
                </Heading>
                <CloseButton
                  color={dark.muted}
                  _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                  onClick={() => setOpen(false)}
                  aria-label="Close GM tools"
                />
              </Flex>
              <Box flex={1} overflowY="auto" px={2.5} pb={4} pt={2}>
                <GmToolsPanel />
              </Box>
            </Box>
          </Flex>
        </>
      )}
    </>
  )
}
