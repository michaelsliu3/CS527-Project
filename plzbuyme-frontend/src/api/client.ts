import axios from 'axios'
import { getAuthRedirect } from './authRedirect'

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:5081/api'

export const apiClient = axios.create({
  baseURL,
  paramsSerializer: {
    // ASP.NET Core binds List<string> from repeated query keys (e.g. ?condition=A&condition=B).
    // Axios defaults to bracket syntax (?condition[]=A&condition[]=B), which this API does not bind.
    indexes: null,
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url ?? ''
      const isAuthEndpoint = url === 'auth/login' || url === 'auth/register'
      if (!isAuthEndpoint) {
        localStorage.removeItem('token')
        const redirect = getAuthRedirect()
        if (redirect) redirect()
        else window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
