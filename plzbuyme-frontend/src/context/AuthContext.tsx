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
  avatarUrl: string | null
  displayNameColor: string | null
  email: string
  role: string
  walletBalance: number
  walletAvailableBalance: number
}

interface JwtPayload {
  sub?: string
  unique_name?: string
  name?: string
  email?: string
  role?: string
  exp: number
  [key: string]: string | number | undefined
}

interface AuthResponse {
  token: string
  username: string
  avatarUrl?: string | null
  displayNameColor?: string | null
  email: string
  role: string
  userId: number
  walletBalance?: number
  walletAvailableBalance?: number
}

export interface AuthProfilePayload {
  id: number
  username: string
  avatarUrl?: string | null
  displayNameColor?: string | null
  email: string
  role: string
  walletBalance?: number
  walletAvailableBalance?: number
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<{ username: string }>
  register: (username: string, email: string, password: string) => Promise<{ username: string }>
  logout: () => void
  updateDisplayNameColor: (displayNameColor: string | null) => void
  updateAvatarUrl: (avatarUrl: string | null) => void
  refreshProfile: () => Promise<AuthProfilePayload | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const DOTNET_CLAIM_NAME = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
const DOTNET_CLAIM_EMAIL = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
const DOTNET_CLAIM_ROLE = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
const DOTNET_CLAIM_NAME_ID = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'

function firstString(payload: JwtPayload, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return null
}

function decodeToken(token: string): AuthUser | null {
  try {
    const payload = jwtDecode<JwtPayload>(token)
    const exp = payload.exp
    if (exp * 1000 < Date.now()) return null
    const idString = firstString(payload, ['sub', DOTNET_CLAIM_NAME_ID])
    const id = idString ? parseInt(idString, 10) : 0

    const username =
      firstString(payload, ['unique_name', 'name', DOTNET_CLAIM_NAME]) ?? ''
    const email = firstString(payload, ['email', DOTNET_CLAIM_EMAIL]) ?? ''
    const role = firstString(payload, ['role', DOTNET_CLAIM_ROLE]) ?? ''
    const avatarUrl = firstString(payload, ['avatar_url'])
    const displayNameColor = firstString(payload, ['display_name_color'])
    if (!id || !username) return null
    return {
      id,
      username,
      avatarUrl,
      displayNameColor,
      email,
      role,
      walletBalance: 0,
      walletAvailableBalance: 0,
    }
  } catch {
    return null
  }
}

function mergeProfileIntoUser(prev: AuthUser, data: AuthProfilePayload): AuthUser {
  return {
    ...prev,
    username: data.username,
    avatarUrl: data.avatarUrl ?? null,
    displayNameColor: data.displayNameColor ?? null,
    email: data.email,
    role: data.role,
    walletBalance: data.walletBalance ?? 0,
    walletAvailableBalance: data.walletAvailableBalance ?? 0,
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
      // Always hydrate latest profile metadata (avatar/color) from backend,
      // because JWT claims may lag behind profile updates.
      void apiClient
        .get<AuthProfilePayload>('auth/profile')
        .then(({ data }) => {
          setUser((prev) => {
            if (!prev) return prev
            return mergeProfileIntoUser(prev, data)
          })
        })
        .catch(() => {
          // Keep decoded token state when profile refresh fails.
        })
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
      avatarUrl: data.avatarUrl ?? null,
      displayNameColor: data.displayNameColor ?? null,
      email: data.email,
      role: data.role,
      walletBalance: data.walletBalance ?? 0,
      walletAvailableBalance: data.walletAvailableBalance ?? 0,
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
        avatarUrl: data.avatarUrl ?? null,
        displayNameColor: data.displayNameColor ?? null,
        email: data.email,
        role: data.role,
        walletBalance: data.walletBalance ?? 0,
        walletAvailableBalance: data.walletAvailableBalance ?? 0,
      })
      return { username: data.username }
    },
    []
  )

  const refreshProfile = useCallback(async (): Promise<AuthProfilePayload | null> => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return null
    try {
      const { data } = await apiClient.get<AuthProfilePayload>('auth/profile')
      setUser((prev) => {
        if (!prev) return prev
        return mergeProfileIntoUser(prev, data)
      })
      return data
    } catch {
      return null
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }, [])

  const updateDisplayNameColor = useCallback((displayNameColor: string | null) => {
    setUser((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        displayNameColor,
      }
    })
  }, [])

  const updateAvatarUrl = useCallback((avatarUrl: string | null) => {
    setUser((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        avatarUrl,
      }
    })
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    login,
    register,
    logout,
    updateDisplayNameColor,
    updateAvatarUrl,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
