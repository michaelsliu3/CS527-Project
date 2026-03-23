import { apiClient } from './client'

interface CdnUploadResponse {
  key: string
  url: string
}

function getCdnBaseUrl() {
  return (import.meta.env.VITE_CDN_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:5090'
}

export async function uploadFileToCdn(file: File, folder: 'avatars' | 'items', replaceKey?: string | null): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)
  if (replaceKey) formData.append('replaceKey', replaceKey)

  const cdnBase = getCdnBaseUrl()
  const { data } = await apiClient.post<CdnUploadResponse>(`${cdnBase}/api/media/upload`, formData)
  return data.key
}
