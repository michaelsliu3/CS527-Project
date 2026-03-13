import { Box, Button, Container, Heading, Text } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'

export function HomePage() {
  const navigate = useNavigate()
  return (
    <Container maxW="container.md">
      <Box textAlign="center" py={12}>
        <Heading size="xl" mb={4}>
          Welcome to plzbuy.me
        </Heading>
        <Text fontSize="lg" color="gray.600" _dark={{ color: 'gray.400' }} mb={8}>
          Buy and sell through timed auctions. Browse active listings and place your bids.
        </Text>
        <Button colorPalette="brand" size="lg" onClick={() => navigate('/auctions')}>
          Browse Auctions
        </Button>
      </Box>
    </Container>
  )
}
