import { isAxiosError } from 'axios'

/** Reads ASP.NET ProblemDetails (`detail`) or plain string bodies from an axios error response. */
export function getApiErrorMessage(e: unknown): string | null {
  if (!isAxiosError(e) || e.response?.data == null) return null
  const d = e.response.data
  if (typeof d === 'string') return d
  if (typeof d !== 'object') return null
  const o = d as Record<string, unknown>
  if (typeof o.detail === 'string' && o.detail.length > 0) return o.detail
  if (typeof o.message === 'string' && o.message.length > 0) return o.message
  if (typeof o.title === 'string' && o.title.length > 0 && o.title !== 'Bad Request') return o.title
  const errs = o.errors
  if (errs && typeof errs === 'object' && errs !== null) {
    const first = Object.values(errs as Record<string, string[]>).flat()[0]
    if (typeof first === 'string') return first
  }
  return null
}
