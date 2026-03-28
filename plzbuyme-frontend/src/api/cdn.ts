import { apiClient } from './client'
import { getCdnBaseUrl } from '../utils/mediaUrl'

interface CdnUploadResponse {
  key: string
  url: string
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
