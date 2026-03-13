import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { jwtDecode } from 'jwt-decode'
import { apiClient } from '../api/client'

const TOKEN_KEY = 'token'

export interface AuthUser {
  id: number
  username: string
  email: string
  role: string
}

interface JwtPayload {
  sub?: string
  unique_name?: string
  name?: string
  email?: string
  role?: string
  exp: number
}

interface AuthResponse {
  token: string
  username: string
  email: string
  role: string
  userId: number
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<{ username: string }>
  register: (username: string, email: string, password: string) => Promise<{ username: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function decodeToken(token: string): AuthUser | null {
  try {
    const payload = jwtDecode<JwtPayload>(token)
    const exp = payload.exp
    if (exp * 1000 < Date.now()) return null
    const id = payload.sub ? parseInt(payload.sub, 10) : 0
    const username = payload.unique_name ?? payload.name ?? ''
    const email = payload.email ?? ''
    const role = payload.role ?? ''
    if (!id || !username) return null
    return { id, username, email, role }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const hydrate = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    const decoded = decodeToken(token)
    if (decoded) {
      setUser(decoded)
    } else {
      localStorage.removeItem(TOKEN_KEY)
      setUser(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const login = useCallback(async (username: string, password: string): Promise<{ username: string }> => {
    const { data } = await apiClient.post<AuthResponse>('auth/login', {
      username,
      password,
    })
    localStorage.setItem(TOKEN_KEY, data.token)
    setUser({
      id: data.userId,
      username: data.username,
      email: data.email,
      role: data.role,
    })
    return { username: data.username }
  }, [])

  const register = useCallback(
    async (username: string, email: string, password: string): Promise<{ username: string }> => {
      const { data } = await apiClient.post<AuthResponse>('auth/register', {
        username,
        email,
        password,
      })
      localStorage.setItem(TOKEN_KEY, data.token)
      setUser({
        id: data.userId,
        username: data.username,
        email: data.email,
        role: data.role,
      })
      return { username: data.username }
    },
    []
  )

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    login,
    register,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
