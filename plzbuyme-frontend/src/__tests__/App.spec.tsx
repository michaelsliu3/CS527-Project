import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import { BrowserRouter } from 'react-router-dom'
import App from '../App'
import { AuthProvider } from '../context/AuthContext'
import { system } from '../theme'

function renderApp() {
  return render(
    <ChakraProvider value={system}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ChakraProvider>
  )
}

describe('App', () => {
  it('renders home page with CTA', () => {
    renderApp()
    expect(screen.getByText(/Welcome to plzbuy.me/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Browse Auctions/i })).toBeInTheDocument()
  })
})
