import { useState, type ReactNode } from 'react'
import { Box, Button, CloseButton, Flex, Heading, Text } from '@chakra-ui/react'
import { GmToolsPanel } from './GmToolsPanel'
import { dark } from '../theme/colors'

const TAB_Z = 1540
const BACKDROP_Z = 1548
const DRAWER_Z = 1550

export function GmToolsDockProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {children}
      {enabled && (
        <>
          <Box position="fixed" right={0} top="38%" zIndex={TAB_Z} transform="translateY(-50%)" pointerEvents="auto">
            <Button
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
              onClick={() => setOpen(true)}
              aria-label="Open GM tools"
            >
              {'GM'.split('').map((ch, i) => (
                <Text key={`${ch}-${i}`} as="span" lineHeight={1.1}>
                  {ch}
                </Text>
              ))}
            </Button>
          </Box>

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

          <Box
            position="fixed"
            top={0}
            right={0}
            h="100dvh"
            w={{ base: '100%', sm: 'min(560px, 100vw)' }}
            maxW="100vw"
            bg="rgba(24, 24, 27, 0.12)"
            backdropFilter="blur(5px)"
            borderLeftWidth="1px"
            borderColor="whiteAlpha.200"
            boxShadow="-12px 0 40px rgba(0,0,0,0.35)"
            zIndex={DRAWER_Z}
            display="flex"
            flexDirection="column"
            transform={open ? 'translateX(0)' : 'translateX(100%)'}
            transition="transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)"
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
        </>
      )}
    </>
  )
}
