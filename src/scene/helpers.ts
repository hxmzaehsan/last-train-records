import * as THREE from 'three'

/** Record geometry constants (world units). */
export const RECORD_R = 5
export const SURFACE_Y = 0.1 // top face of the vinyl
export const NEEDLE_ANGLE = THREE.MathUtils.degToRad(55)
export const CITY_SWEEP = THREE.MathUtils.degToRad(178)
export const CITY_END = NEEDLE_ANGLE - CITY_SWEEP
export const TRACK_R = 3.6
export const BASE_TOP_Y = SURFACE_Y + 0.06 // top of the railway terrace

/** Street canyon flanking the railway, directly behind the train. */
export const CANYON_A0 = THREE.MathUtils.degToRad(-38)
export const CANYON_A1 = THREE.MathUtils.degToRad(16)

/** Terraced foundations: concentric steps that rise from the vinyl. */
export const T1_TOP = SURFACE_Y + 0.028 // inner shopping street
export const T2_TOP = SURFACE_Y + 0.048 // mid neighbourhood
export const T4_TOP = SURFACE_Y + 0.042 // outer skyline shelf

export function polar(r: number, a: number, y = 0): [number, number, number] {
  return [r * Math.cos(a), y, r * Math.sin(a)]
}

/** Deterministic PRNG so the city is identical on every load. */
export function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Flat ring sector, extruded upward by `h`, angles preserved in the XZ plane. */
export function ringSectorGeometry(
  rIn: number,
  rOut: number,
  a0: number,
  a1: number,
  h: number,
  curveSegments = 64,
) {
  const lo = Math.min(a0, a1)
  const hi = Math.max(a0, a1)
  const shape = new THREE.Shape()
  shape.absarc(0, 0, rOut, lo, hi, false)
  shape.absarc(0, 0, rIn, hi, lo, true)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h,
    bevelEnabled: false,
    curveSegments,
  })
  geo.rotateX(Math.PI / 2)
  geo.translate(0, h, 0)
  geo.computeVertexNormals()
  return geo
}

export type InstanceItem = {
  p: [number, number, number]
  ry?: number
  s: [number, number, number]
  c?: THREE.Color
  /** authored polar angle for reveal ordering (else derived from p) */
  a?: number
}
