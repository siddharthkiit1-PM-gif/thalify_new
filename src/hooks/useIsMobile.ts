import { useEffect, useState } from 'react'

/**
 * Returns true when viewport is <= 768px (tablet + phone breakpoint).
 * SSR-safe: returns false during initial render, updates after mount.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth <= breakpoint)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])

  return isMobile
}
