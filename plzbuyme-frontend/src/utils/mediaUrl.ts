/** Base URL for browser-facing CDN (no trailing slash). */
export function getCdnBaseUrl(): string {
  const explicit = (import.meta.env.VITE_CDN_URL as string | undefined)?.replace(/\/$/, '')
  if (explicit) return explicit
  // Local `npm run dev`: API (5081) and CDN (5090) are different origins — never derive CDN from VITE_API_URL.
  if (import.meta.env.DEV) {
    return 'http://localhost:5090'
  }
  // Production build (e.g. S3 + same-host nginx): CDN often shares origin with API minus /api.
  const apiBase = import.meta.env.VITE_API_URL as string | undefined
  if (apiBase) return apiBase.replace(/\/api\/?$/, '')
  return 'http://localhost:5090'
}

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1'
}

/** DB often stores dev URLs (localhost:5090); rewrite to the public CDN base for EC2 / production SPAs. */
function rewriteLoopbackMediaUrlIfNeeded(url: string, cdnBase: string): string {
  try {
    const parsed = new URL(url)
    if (!isLoopbackHost(parsed.hostname)) return url
    if (!parsed.pathname.startsWith('/media/')) return url
    const base = new URL(cdnBase)
    return `${base.origin}${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return url
  }
}

export function resolveMediaUrl(mediaUrl: string | null | undefined): string | null {
  if (!mediaUrl) return null
  const cdnBase = getCdnBaseUrl()
  if (mediaUrl.startsWith('data:')) return mediaUrl
  if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
    return rewriteLoopbackMediaUrlIfNeeded(mediaUrl, cdnBase)
  }
  if (!mediaUrl.startsWith('/')) return `${cdnBase}/media/${mediaUrl}`
  if (mediaUrl.startsWith('/media/')) return `${cdnBase}${mediaUrl}`

  const apiBase = import.meta.env.VITE_API_URL as string | undefined
  if (!apiBase) return mediaUrl
  const origin = apiBase.replace(/\/api\/?$/, '')
  return `${origin}${mediaUrl}`
}
