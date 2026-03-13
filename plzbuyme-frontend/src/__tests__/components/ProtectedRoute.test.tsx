import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ChakraProvider } from '@chakra-ui/react'
import { ProtectedRoute } from '../../components/ProtectedRoute'
import { AuthProvider } from '../../context/AuthContext'
import { system } from '../../theme'

function PublicPage() {
  return <div>Public</div>
}

function ProtectedContent() {
  return <div>Protected content</div>
}

function renderWithRouter(initialEntry: string, roles?: string[]) {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<PublicPage />} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute roles={roles}>
                  <ProtectedContent />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </ChakraProvider>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('redirects unauthenticated users to /login', async () => {
    renderWithRouter('/profile')
    await waitFor(() => {
      expect(screen.getByText('Login page')).toBeInTheDocument()
    })
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('blocks wrong role and redirects to /', async () => {
    const token = `header.${btoa(JSON.stringify({ sub: '1', unique_name: 'u', role: 'end_user', exp: 9999999999 }))}.sig`
    localStorage.setItem('token', token)
    renderWithRouter('/profile', ['admin'])
    await waitFor(() => {
      expect(screen.getByText('Public')).toBeInTheDocument()
    })
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('renders children for correct role', async () => {
    const token = `header.${btoa(JSON.stringify({ sub: '1', unique_name: 'u', role: 'end_user', exp: 9999999999 }))}.sig`
    localStorage.setItem('token', token)
    renderWithRouter('/profile', ['end_user'])
    await waitFor(() => {
      expect(screen.getByText('Protected content')).toBeInTheDocument()
    })
  })
})
