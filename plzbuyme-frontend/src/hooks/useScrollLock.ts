import { useEffect } from 'react'

let lockCount = 0
let savedHtmlOverflow = ''
let savedBodyOverflow = ''

function lock() {
  if (lockCount === 0) {
    savedHtmlOverflow = document.documentElement.style.overflow
    savedBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
  }
  lockCount += 1
}

function unlock() {
  lockCount -= 1
  if (lockCount <= 0) {
    lockCount = 0
    document.documentElement.style.overflow = savedHtmlOverflow
    document.body.style.overflow = savedBodyOverflow
  }
}

/** Prevents page scroll behind fixed overlays; ref-counted for stacked modals. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    lock()
    return () => {
      unlock()
    }
  }, [active])
}
