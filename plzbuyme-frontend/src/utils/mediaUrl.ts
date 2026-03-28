function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1'
}

/**
 * Base URL for browser-facing CDN (no trailing slash).
 * Production DB rows often still have http://localhost:5090/media/... — callers use resolveMediaUrl to rewrite.
 */
export function getCdnBaseUrl(): string {
  const explicit = (import.meta.env.VITE_CDN_URL as string | undefined)?.replace(/\/$/, '')
  if (explicit) return explicit

  if (import.meta.env.DEV) {
    return 'http://localhost:5090'
  }

  const apiBase = import.meta.env.VITE_API_URL as string | undefined
  if (apiBase) {
    try {
      const origin = apiBase.replace(/\/api\/?$/, '')
      const host = new URL(origin).hostname
      if (!isLoopbackHost(host)) {
        return origin
      }
    } catch {
      /* ignore invalid VITE_API_URL */
    }
  }

  // Production build opened in the browser (e.g. Vite on EC2 :5173, nginx serves /media on :80 same host).
  // Avoids img src staying http://localhost:5090/... when VITE_* were not set at build time.
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location
    if (!isLoopbackHost(hostname)) {
      return `${protocol}//${hostname}`
    }
  }

  return 'http://localhost:5090'
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
