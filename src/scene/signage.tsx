import { useMemo } from 'react'
import * as THREE from 'three'

const JP_FONT = "'Noto Sans JP Variable','Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif"

export type SignSpec = {
  text: string
  vertical?: boolean
  fg: string
  bg: string
  frame?: string
  /** bottom route-colour stripe, e.g. station boards */
  stripe?: string
  weight?: number
}

const cache = new Map<string, { tex: THREE.CanvasTexture; aspect: number }>()

/** Renders a small sign texture once and caches it. aspect = width / height. */
export function signTexture(spec: SignSpec): { tex: THREE.CanvasTexture; aspect: number } {
  const key = JSON.stringify(spec)
  const hit = cache.get(key)
  if (hit) return hit

  const chars = Array.from(spec.text)
  const cell = 96
  const pad = 26
  const canvas = document.createElement('canvas')
  let w: number
  let h: number

  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = `${spec.weight ?? 620} ${cell * 0.72}px ${JP_FONT}`

  if (spec.vertical) {
    w = cell + pad * 2 - 24
    h = chars.length * cell + pad * 2
  } else {
    w = Math.ceil(measure.measureText(spec.text).width) + pad * 2
    h = cell + pad
  }
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = spec.bg
  ctx.fillRect(0, 0, w, h)
  if (spec.frame) {
    ctx.strokeStyle = spec.frame
    ctx.lineWidth = 6
    ctx.strokeRect(4, 4, w - 8, h - 8)
  }
  if (spec.stripe) {
    ctx.fillStyle = spec.stripe
    ctx.fillRect(0, h - Math.round(h * 0.12), w, Math.round(h * 0.12))
  }

  ctx.fillStyle = spec.fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${spec.weight ?? 620} ${cell * 0.72}px ${JP_FONT}`
  if (spec.vertical) {
    chars.forEach((ch, i) => {
      ctx.fillText(ch, w / 2, pad + cell * (i + 0.5))
    })
  } else {
    ctx.fillText(spec.text, w / 2, (h - (spec.stripe ? h * 0.12 : 0)) / 2 + 4)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.needsUpdate = true
  const out = { tex, aspect: w / h }
  cache.set(key, out)
  return out
}

type SignProps = {
  spec: SignSpec
  /** world height of the sign plane */
  height: number
  position: [number, number, number]
  rotationY?: number
  /** thin dark backing box behind the plane */
  backing?: boolean
  /** emissive HDR sign — glows, catches selective bloom */
  neon?: boolean
  /** emissive strength for neon signs (>1 blooms) */
  intensity?: number
  materialRef?: React.Ref<THREE.MeshStandardMaterial>
}

export function Sign({
  spec,
  height,
  position,
  rotationY = 0,
  backing = true,
  neon = false,
  intensity = 1.5,
  materialRef,
}: SignProps) {
  const { tex, aspect } = useMemo(() => signTexture(spec), [spec])
  const w = height * aspect
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {backing && (
        <mesh position={[0, 0, -0.008]} castShadow>
          <boxGeometry args={[w + 0.015, height + 0.015, 0.012]} />
          <meshStandardMaterial color="#181a1c" roughness={0.55} metalness={0.3} />
        </mesh>
      )}
      <mesh>
        <planeGeometry args={[w, height]} />
        {neon ? (
          <meshStandardMaterial
            ref={materialRef}
            map={tex}
            emissiveMap={tex}
            emissive="#ffffff"
            emissiveIntensity={intensity}
            color="#151515"
            roughness={0.4}
            side={THREE.DoubleSide}
          />
        ) : (
          <meshStandardMaterial
            map={tex}
            emissiveMap={tex}
            emissive="#ffffff"
            emissiveIntensity={0.55}
            color="#111111"
            roughness={0.5}
            side={THREE.DoubleSide}
          />
        )}
      </mesh>
    </group>
  )
}
