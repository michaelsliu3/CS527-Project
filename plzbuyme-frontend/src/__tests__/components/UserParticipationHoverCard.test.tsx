import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { UserParticipationHoverCard } from '../../components/UserParticipationHoverCard'
import { system } from '../../theme'

describe('UserParticipationHoverCard', () => {
  it('shows hover card content and navigates to target history', async () => {
    const user = userEvent.setup()
    render(
      <ChakraProvider value={system}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route
              path="/"
              element={
                <UserParticipationHoverCard
                  userId={42}
                  username="bidder42"
                  avatarUrl={null}
                  displayNameColor={null}
                  fallbackColor="white"
                  avatarSize="20px"
                />
              }
            />
            <Route path="/users/:userId/history" element={<div>History Route Loaded</div>} />
          </Routes>
        </MemoryRouter>
      </ChakraProvider>
    )

    fireEvent.mouseEnter(screen.getByRole('button', { name: /bidder42/i }))
    const viewButton = await screen.findByRole('button', { name: 'View participation history' })
    await user.click(viewButton)

    expect(await screen.findByText('History Route Loaded')).toBeInTheDocument()
  })
})
