/**
 * Optional redirect callback for 401 responses.
 * Set by the app (inside Router) so api client can redirect without window.location.
 */
let authRedirect: (() => void) | null = null

export function setAuthRedirect(callback: (() => void) | null): void {
  authRedirect = callback
}

export function getAuthRedirect(): (() => void) | null {
  return authRedirect
}
