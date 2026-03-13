import { Box, Button, Container, Heading, Text } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'

export function HomePage() {
  const navigate = useNavigate()
  return (
    <Container maxW="container.md">
      <Box textAlign="center" py={12}>
        <Heading size="xl" mb={4} color="white">
          Welcome to plzbuy.me
        </Heading>
        <Text fontSize="lg" color="#d4d4d8" mb={8}>
          Buy and sell through timed auctions. Browse active listings and place your bids.
        </Text>
        <Button bg="brand.500" color="white" _hover={{ bg: 'brand.400' }} size="lg" onClick={() => navigate('/auctions')}>
          Browse Auctions
        </Button>
      </Box>
    </Container>
  )
}
