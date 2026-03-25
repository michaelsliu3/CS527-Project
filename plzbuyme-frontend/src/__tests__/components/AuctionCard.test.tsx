import { afterEach, describe, it, expect, vi } from 'vitest'
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
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders title, price, and countdown', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-24T00:00:00.000Z'))
    const close = new Date('2026-03-25T03:04:05.000Z').toISOString()

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
    expect(screen.getByText('Expires in')).toBeInTheDocument()
    expect(screen.getByText('1d 03:04:05')).toBeInTheDocument()
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
    expect(screen.getAllByText('Sold').length).toBeGreaterThan(0)
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

  it('renders optional highlight tags when data is available', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-24T00:00:00.000Z'))

    renderAuctionCard({
      id: 55,
      title: 'Featured Listing',
      currentPrice: 25000,
      reservePrice: 20000,
      closeDateTime: new Date('2026-03-24T00:30:00.000Z').toISOString(),
      status: 'active',
      categoryName: 'Sports Cars',
      sellerUsername: 'seller2',
      bidCount: 5,
      createdAt: new Date('2026-03-23T18:00:00.000Z').toISOString(),
    })

    expect(screen.getByText('Ending soon')).toBeInTheDocument()
    expect(screen.getByText('Reserve met')).toBeInTheDocument()
    expect(screen.getByText('Newly listed')).toBeInTheDocument()
  })

  it('renders no reserve tag when reserve is zero', () => {
    renderAuctionCard({
      id: 56,
      title: 'No Reserve Auction',
      currentPrice: 5000,
      reservePrice: 0,
      closeDateTime: new Date(Date.now() + 7200000).toISOString(),
      status: 'active',
      categoryName: 'Sedans',
      sellerUsername: 'seller3',
      bidCount: 2,
    })

    expect(screen.getByText('No reserve')).toBeInTheDocument()
  })

  it('renders a placeholder when no image exists', () => {
    renderAuctionCard({
      id: 57,
      title: 'Missing Image Auction',
      currentPrice: 7000,
      imageUrl: null,
      closeDateTime: new Date(Date.now() + 7200000).toISOString(),
      status: 'active',
      categoryName: 'Sedans',
      sellerUsername: 'seller4',
      bidCount: 1,
    })

    expect(screen.getByText('No image available')).toBeInTheDocument()
    expect(screen.getByLabelText('No image available for Missing Image Auction')).toBeInTheDocument()
  })
})
