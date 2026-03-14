import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter } from 'react-router-dom'
import { AuctionCard } from '../../components/AuctionCard'
import { system } from '../../theme'

function renderAuctionCard(auction: Parameters<typeof AuctionCard>[0]['auction']) {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter>
        <AuctionCard auction={auction} />
      </MemoryRouter>
    </ChakraProvider>
  )
}

describe('AuctionCard', () => {
  it('renders title, price, and countdown', () => {
    const close = new Date(Date.now() + 86400000).toISOString()
    renderAuctionCard({
      id: 1,
      title: 'Test Toyota Camry',
      currentPrice: 15000,
      closeDateTime: close,
      status: 'active',
      categoryName: 'Sedans',
      sellerUsername: 'seller1',
      bidCount: 3,
    })
    expect(screen.getByText('Test Toyota Camry')).toBeInTheDocument()
    expect(screen.getByText('$15,000')).toBeInTheDocument()
    expect(screen.getByText(/left/)).toBeInTheDocument()
  })

  it('renders status badge', () => {
    renderAuctionCard({
      id: 2,
      title: 'Sold Item',
      currentPrice: 20000,
      closeDateTime: new Date().toISOString(),
      status: 'sold',
      categoryName: 'Cars',
      sellerUsername: 'seller1',
      bidCount: 0,
    })
    expect(screen.getByText('sold')).toBeInTheDocument()
  })

  it('links to detail page', () => {
    renderAuctionCard({
      id: 42,
      title: 'Linked Auction',
      currentPrice: 100,
      closeDateTime: new Date(Date.now() + 3600000).toISOString(),
      status: 'active',
      categoryName: 'Cars',
      sellerUsername: 'u',
      bidCount: 0,
    })
    const link = screen.getByRole('link', { name: /Linked Auction/i })
    expect(link).toHaveAttribute('href', '/auctions/42')
  })
})
