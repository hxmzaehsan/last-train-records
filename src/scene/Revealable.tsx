import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { clamp01, distBehindNeedle, revealProgress, smoothEase, timeline } from './timeline'

type Props = {
  /** authored polar angle of the anchor (radians) */
  a: number
  /** sweep radians the rise takes */
  dur?: number
  /** extra sweep delay after the needle passes */
  lead?: number
  children: React.ReactNode
}

/**
 * Group that unfolds vertically out of the vinyl once the needle has passed
 * its angle. Descendant point lights fade up only after the shell has risen
 * (unless a driver component owns them via userData.driven).
 */
export function Revealable({ a, dur = 0.55, lead = 0, children }: Props) {
  const ref = useRef<THREE.Group>(null)
  const d = useRef(distBehindNeedle(a))
  const lights = useRef<{ light: THREE.PointLight; base: number }[] | null>(null)
  const last = useRef(-1)

  useFrame(() => {
    const g = ref.current
    if (!g) return
    const e = revealProgress(d.current, dur, lead)
    if (e === last.current && timeline.mode !== 'playing') return
    last.current = e
    g.visible = e > 0.001
    const k = smoothEase(e)
    g.scale.setY(0.22 + 0.78 * k)
    g.position.y = -0.16 * (1 - k)
    if (!lights.current) {
      const found: { light: THREE.PointLight; base: number }[] = []
      g.traverse((n) => {
        if ((n as THREE.PointLight).isPointLight && !n.userData.driven) {
          found.push({ light: n as THREE.PointLight, base: (n as THREE.PointLight).intensity })
        }
      })
      lights.current = found
    }
    const gate = clamp01((e - 0.75) / 0.25)
    for (const { light, base } of lights.current) light.intensity = base * gate
  })

  return <group ref={ref}>{children}</group>
}
