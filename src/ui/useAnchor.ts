import { useEffect } from 'react'
import type { ScreenAnchor } from '../scene/venue'

type Spec = {
  el: React.RefObject<HTMLElement | null>
  anchor: ScreenAnchor
  /** hit area as a multiple of the anchor's projected height */
  scaleX: number
  scaleY: number
  /** never smaller than this, so touch targets stay comfortable */
  min: number
}

/**
 * Glues DOM controls to points in the 3D scene. The scene writes projected
 * pixel positions every frame; this reads them on its own animation frame and
 * writes transforms straight to the elements — no React state, so the camera
 * move stays at full rate and the hit areas never lag behind the building.
 */
export function useAnchor(specs: Spec[], active: boolean) {
  useEffect(() => {
    if (!active) {
      for (const s of specs) if (s.el.current) s.el.current.style.display = 'none'
      return
    }
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      for (const s of specs) {
        const el = s.el.current
        if (!el) continue
        if (!s.anchor.on) {
          if (el.style.display !== 'none') el.style.display = 'none'
          continue
        }
        const w = Math.max(s.min, s.anchor.s * s.scaleX)
        const h = Math.max(s.min, s.anchor.s * s.scaleY)
        if (el.style.display === 'none') el.style.display = ''
        el.style.width = `${w.toFixed(1)}px`
        el.style.height = `${h.toFixed(1)}px`
        el.style.transform = `translate3d(${(s.anchor.x - w / 2).toFixed(1)}px, ${(
          s.anchor.y -
          h / 2
        ).toFixed(1)}px, 0)`
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // specs are stable refs into the shared anchor object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}
