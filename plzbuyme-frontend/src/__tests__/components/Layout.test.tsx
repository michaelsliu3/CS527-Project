import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { AuthProvider } from '../../context/AuthContext'
import { system } from '../../theme'

function renderWithProviders() {
  window.localStorage.setItem(
    'token',
    // minimal valid-looking JWT with unexpired exp; AuthContext will decode and set user
    // payload: { "sub": "1", "unique_name": "alice", "email": "alice@example.com", "role": "end_user", "exp": 4102444800 }
    [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      'eyJzdWIiOiIxIiwidW5pcXVlX25hbWUiOiJhbGljZSIsImVtYWlsIjoiYWxpY2VAZXhhbXBsZS5jb20iLCJyb2xlIjoiZW5kX3VzZXIiLCJleHAiOjQxMDI0NDQ4MDB9',
      'signature',
    ].join('.'),
  )

  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<div>Home</div>} />
              <Route path="/questions" element={<div>Questions Page</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </ChakraProvider>,
  )
}

describe('Layout navbar Forums link', () => {
  it('shows Forums link when logged in and navigates to /questions', async () => {
    const user = userEvent.setup()
    renderWithProviders()

    const forumsLink = await screen.findByRole('link', { name: /Forums/i })
    expect(forumsLink).toBeInTheDocument()

    await user.click(forumsLink)
    expect(screen.getByText(/Questions Page/i)).toBeInTheDocument()
  })
})

