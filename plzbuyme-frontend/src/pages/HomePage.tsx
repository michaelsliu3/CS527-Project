import { Box, Button, Container, Heading, Text } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { dark } from '../theme/colors'
import { APP_PAGE_PX } from '../theme/layout'

export function HomePage() {
  const navigate = useNavigate()
  return (
    <Container maxW="container.md" px={APP_PAGE_PX}>
      <Box textAlign="center" py={12}>
        <Heading size="xl" mb={4} color="white">
          Welcome to plzbuy.me
        </Heading>
        <Text fontSize="lg" color={dark.muted} mb={8}>
          Buy and sell through timed auctions. Browse active listings and place your bids.
        </Text>
        <Button bg="brand.500" color="white" _hover={{ bg: 'brand.400' }} size="lg" onClick={() => navigate('/auctions')}>
          Browse Auctions
        </Button>
      </Box>
    </Container>
  )
}
