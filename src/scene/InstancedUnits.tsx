import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { InstanceItem } from './helpers'
import { distOfPosition, revealProgress, smoothEase, timeline } from './timeline'

const dummy = new THREE.Object3D()

export type RevealSpec = {
  /** 'grow' unfolds upward from the ground, 'pop' scales in whole */
  mode?: 'grow' | 'pop'
  /** sweep radians the reveal takes */
  dur?: number
  /** extra sweep delay after the shell (roofs, windows, clutter) */
  lead?: number
  /** deterministic per-instance scatter, in sweep radians */
  jitter?: number
}

type Props = {
  items: InstanceItem[]
  geometry: THREE.BufferGeometry
  material: THREE.Material
  castShadow?: boolean
  receiveShadow?: boolean
  reveal?: RevealSpec
}

const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** One InstancedMesh draw call; with `reveal`, instances rise from the vinyl
 *  as the needle sweep passes them, updated directly in the render loop. */
export function InstancedUnits({ items, geometry, material, castShadow, receiveShadow, reveal }: Props) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const invalidate = useThree((s) => s.invalidate)
  const lastMode = useRef<string>('')

  const dists = useMemo(() => {
    if (!reveal) return null
    const jitter = reveal.jitter ?? 0
    return items.map((it, i) => {
      const a = it.a ?? Math.atan2(it.p[2], it.p[0])
      return distOfPosition(Math.cos(a), Math.sin(a)) + hash(i) * jitter
    })
  }, [items, reveal])

  /* The earliest and latest instance in this batch. Outside that window every
     instance is either untouched or fully risen, so the whole batch — matrix
     composition for every unit plus a buffer upload — can be skipped. During
     the entrance most batches are idle most of the time. */
  const span = useMemo(() => {
    if (!dists || dists.length === 0) return null
    let lo = Infinity
    let hi = -Infinity
    for (const d of dists) {
      if (d < lo) lo = d
      if (d > hi) hi = d
    }
    return { lo, hi }
  }, [dists])

  const writeAll = () => {
    const mesh = ref.current
    if (!mesh) return
    const mode = reveal?.mode ?? 'grow'
    const dur = reveal?.dur ?? 0.45
    const lead = reveal?.lead ?? 0
    items.forEach((it, i) => {
      let sx = it.s[0]
      let sy = it.s[1]
      let sz = it.s[2]
      let y = it.p[1]
      if (dists) {
        const e = revealProgress(dists[i], dur, lead)
        if (e <= 0.001) {
          sx = sy = sz = 0.0001
        } else if (mode === 'grow') {
          const k = smoothEase(e)
          sy = it.s[1] * (0.3 + 0.7 * k)
          y = it.p[1] - it.s[1] * 0.3 * (1 - k)
        } else {
          const k = smoothEase(e)
          sx = it.s[0] * Math.max(0.05, k)
          sy = it.s[1] * Math.max(0.05, k)
          sz = it.s[2] * Math.max(0.05, k)
        }
      }
      dummy.position.set(it.p[0], y, it.p[2])
      dummy.rotation.set(0, it.ry ?? 0, 0)
      dummy.scale.set(sx, sy, sz)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      if (it.c) mesh.setColorAt(i, it.c)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  useLayoutEffect(() => {
    writeAll()
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, invalidate])

  const wasActive = useRef(true)

  useFrame(() => {
    if (!dists) return

    // The sweep runs in both directions: forward while the city is built and
    // backward while it is rewound, so both are animating states.
    const animating = timeline.mode === 'playing' || timeline.mode === 'resetting'
    const modeChanged = lastMode.current !== timeline.mode
    lastMode.current = timeline.mode

    // A mode change always writes. That final write on entering 'idle' is what
    // puts every instance back down — skipping it leaves the city standing on
    // an empty record.
    if (!animating && !modeChanged) return

    if (animating && !modeChanged && span) {
      const dur = reveal?.dur ?? 0.45
      const lead = reveal?.lead ?? 0
      // first instance to move, and last one to finish
      const first = revealProgress(span.lo, dur, lead)
      const last = revealProgress(span.hi, dur, lead)
      const active = first > 0.001 && last < 1
      // one write on each edge so the batch lands on exact start/end values
      if (!active && !wasActive.current) return
      wasActive.current = active
    }

    writeAll()
  })

  if (items.length === 0) return null
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  )
}
