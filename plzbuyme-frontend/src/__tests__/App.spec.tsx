import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import { BrowserRouter } from 'react-router-dom'
import App from '../App'
import { system } from '../theme'

function renderApp() {
  return render(
    <ChakraProvider value={system}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ChakraProvider>
  )
}

describe('App', () => {
  it('renders placeholder for home route', () => {
    renderApp()
    expect(screen.getByText(/HomePage.*placeholder/i)).toBeInTheDocument()
  })
})
