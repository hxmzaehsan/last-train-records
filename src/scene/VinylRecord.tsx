import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RECORD_R, SURFACE_Y } from './helpers'
import { ringIntensity, ringWarm } from './timeline'

/* the ring waits in cyan and warms to magenta as the record starts */
const RING_COOL = new THREE.Color('#20E7FF')
const RING_HOT = new THREE.Color('#FF2C9C')
const RING_BASE_COOL = new THREE.Color('#0d3a45')
const RING_BASE_HOT = new THREE.Color('#5c1038')

function makeVinylColorTexture() {
  const size = 2048
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0a1218'
  ctx.fillRect(0, 0, size, size)

  const center = size / 2
  const px = (r: number) => (r / RECORD_R) * center

  // Broad track bands, alternating slightly light and dark, so the groove
  // structure reads at composition distance the way it does on a real press.
  let r = px(1.32)
  let light = true
  while (r < px(4.88)) {
    const bandW = px(0.14 + Math.abs(Math.sin(r * 0.013)) * 0.22)
    ctx.fillStyle = light ? '#0e1820' : '#070f15'
    ctx.beginPath()
    ctx.arc(center, center, r + bandW, 0, Math.PI * 2)
    ctx.arc(center, center, r, 0, Math.PI * 2, true)
    ctx.fill()
    // fine grooves inside the band
    ctx.strokeStyle = light ? '#15222c' : '#0a141b'
    ctx.lineWidth = 1
    for (let g = r + 3; g < r + bandW; g += 3.4) {
      ctx.beginPath()
      ctx.arc(center, center, g, 0, Math.PI * 2)
      ctx.stroke()
    }
    r += bandW
    light = !light
  }

  // Track separators
  for (const s of [2.35, 2.95, 3.35, 3.85, 4.35]) {
    ctx.strokeStyle = '#04080c'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(center, center, px(s), 0, Math.PI * 2)
    ctx.stroke()
  }

  // Rim + dead wax slightly darker
  ctx.strokeStyle = '#050a0f'
  ctx.lineWidth = px(0.09)
  ctx.beginPath()
  ctx.arc(center, center, px(4.94), 0, Math.PI * 2)
  ctx.stroke()

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

function makeGrooveBumpTexture() {
  const size = 2048
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, size, size)

  const center = size / 2
  const px = (r: number) => (r / RECORD_R) * center

  // Fine playing grooves from the dead wax out to the rim.
  for (let r = px(1.32); r < px(4.9); r += 2.4) {
    const bright = 128 + (Math.sin(r * 0.7) > 0 ? 22 : -26)
    ctx.strokeStyle = `rgb(${bright},${bright},${bright})`
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(center, center, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Wider, darker track separators.
  const separators = [2.35, 2.95, 3.35, 3.85, 4.35]
  for (const s of separators) {
    ctx.strokeStyle = '#565656'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(center, center, px(s), 0, Math.PI * 2)
    ctx.stroke()
  }

  // Lead-in groove near the rim.
  ctx.strokeStyle = '#4c4c4c'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(center, center, px(4.93), 0, Math.PI * 2)
  ctx.stroke()

  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

/** Vermilion pressing with procedural groove relief and a black centre label. */
export function VinylRecord() {
  const grooves = useMemo(makeGrooveBumpTexture, [])
  const vinylColor = useMemo(makeVinylColorTexture, [])
  const ringMat = useRef<THREE.MeshStandardMaterial>(null)
  const haloMat = useRef<THREE.MeshBasicMaterial>(null)
  const ringSpill = useRef<THREE.PointLight>(null)
  const level = useRef(0.7)
  const tint = useMemo(() => new THREE.Color(), [])

  useFrame(({ clock }) => {
    const target = ringIntensity(clock.elapsedTime)
    // a tube has a little thermal lag: snap down fast, recover slightly softer
    const l = level.current
    level.current = l + (target - l) * (target < l ? 0.65 : 0.3)
    const v = level.current
    // slight variation along the tube, so it never reads as a flat ring
    const uneven = 1 + 0.06 * Math.sin(clock.elapsedTime * 0.9)
    // the tube itself, its halo and the light it throws all change together
    const warm = ringWarm()
    tint.lerpColors(RING_COOL, RING_HOT, warm)
    if (ringMat.current) {
      ringMat.current.emissiveIntensity = 0.1 + v * 0.42 * uneven
      ringMat.current.emissive.copy(tint)
      ringMat.current.color.lerpColors(RING_BASE_COOL, RING_BASE_HOT, warm)
    }
    if (haloMat.current) {
      haloMat.current.opacity = 0.05 + v * 0.15
      haloMat.current.color.copy(tint)
    }
    if (ringSpill.current) {
      ringSpill.current.intensity = 0.03 + v * 0.2
      ringSpill.current.color.copy(tint)
    }
  })

  return (
    <group>
      <mesh position={[0, SURFACE_Y - 0.06, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[RECORD_R, RECORD_R, 0.12, 180, 1]} />
        <meshPhysicalMaterial
          map={vinylColor}
          roughness={0.38}
          metalness={0.05}
          clearcoat={0.7}
          clearcoatRoughness={0.3}
          envMapIntensity={0.4}
          bumpMap={grooves}
          bumpScale={0.6}
        />
      </mesh>

      {/* Dead-wax centre label — smoked black like the reference */}
      <mesh position={[0, SURFACE_Y + 0.004, 0]} receiveShadow>
        <cylinderGeometry args={[1.12, 1.12, 0.02, 96, 1]} />
        <meshPhysicalMaterial
          color="#04060a"
          roughness={0.48}
          clearcoat={0}
          envMapIntensity={0.1}
        />
      </mesh>

      {/* Label ring — a physical neon tube: narrow bright core, soft halo,
          a little spill on the label and a faint reflection on the vinyl */}
      <mesh position={[0, SURFACE_Y + 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.988, 1.006, 128]} />
        <meshStandardMaterial
          ref={ringMat}
          color="#0d3a45"
          emissive="#20E7FF"
          emissiveIntensity={0.32}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, SURFACE_Y + 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.955, 1.04, 128]} />
        <meshBasicMaterial
          ref={haloMat}
          color="#20E7FF"
          transparent
          opacity={0.12}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <pointLight
        ref={ringSpill}
        position={[0, SURFACE_Y + 1.15, 0]}
        color="#20E7FF"
        intensity={0.12}
        distance={3.2}
        decay={2}
      />

      {/* Spindle — kept for the physical model but almost black, so it never
          reads as a separate dot at the centre of the standby frame */}
      <mesh position={[0, SURFACE_Y + 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.12, 24]} />
        <meshStandardMaterial color="#0a0d10" metalness={0.45} roughness={0.62} />
      </mesh>
    </group>
  )
}
