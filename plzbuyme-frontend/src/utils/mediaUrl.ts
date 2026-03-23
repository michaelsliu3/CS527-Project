export function resolveMediaUrl(mediaUrl: string | null | undefined): string | null {
  if (!mediaUrl) return null
  if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://') || mediaUrl.startsWith('data:')) {
    return mediaUrl
  }
  const cdnBase = (import.meta.env.VITE_CDN_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:5090'
  if (!mediaUrl.startsWith('/')) return `${cdnBase}/media/${mediaUrl}`
  if (mediaUrl.startsWith('/media/')) return `${cdnBase}${mediaUrl}`

  const apiBase = import.meta.env.VITE_API_URL as string | undefined
  if (!apiBase) return mediaUrl
  const origin = apiBase.replace(/\/api\/?$/, '')
  return `${origin}${mediaUrl}`
}
