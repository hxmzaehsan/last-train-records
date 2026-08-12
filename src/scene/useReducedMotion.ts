import { useMemo } from 'react'

export function useReducedMotion() {
  return useMemo(() => {
    if (typeof window === 'undefined') return false
    if (new URLSearchParams(window.location.search).has('reduced')) return true
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  }, [])
}
