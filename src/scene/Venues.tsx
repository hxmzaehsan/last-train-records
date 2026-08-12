import { useMemo } from 'react'
import * as THREE from 'three'
import { T1_TOP, polar } from './helpers'
import { NarrowShop, RecessedWindow, Shutter, kitMats } from './Kit'
import { Revealable } from './Revealable'

/**
 * The inner alley: a tight row of small shops around the inner groove,
 * storefronts facing the record centre. The louder venues live in the
 * canyon (Canyon.tsx); this street stays quieter and domestic.
 */

export const VENUE_R = 2.38
export const VENUE_ANGLES = {
  shopA: THREE.MathUtils.degToRad(-50),
  shopB: THREE.MathUtils.degToRad(-66),
  shopC: THREE.MathUtils.degToRad(-84),
}
export const VENUE_ANGLE_LIST = Object.values(VENUE_ANGLES)

const faceIn = (a: number) => -a - Math.PI / 2

function norenTexture(text: string, bg: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 256, 128)
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = 3
  for (const x of [85, 170]) {
    ctx.beginPath()
    ctx.moveTo(x, 40)
    ctx.lineTo(x, 128)
    ctx.stroke()
  }
  ctx.fillStyle = '#f3ede0'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = "600 44px 'Noto Sans JP Variable','Hiragino Sans',sans-serif"
  ctx.fillText(text, 128, 62)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Quiet noren-covered shop, closed for the night. */
function ShopA() {
  const a = VENUE_ANGLES.shopA
  const noren = useMemo(() => norenTexture('', '#2c3a52'), [])
  return (
    <group position={polar(VENUE_R, a, T1_TOP)} rotation={[0, faceIn(a), 0]}>
      <NarrowShop
        position={[0, 0, 0]}
        rotationY={0}
        w={0.42}
        d={0.34}
        storeys={2}
        bodyMat={kitMats.timberLight}
        roof="tile"
        awning="none"
        litGround={false}
        litUpper={[true]}
      />
      {/* noren over the closed doorway */}
      <mesh position={[-0.06, 0.21, 0.028]}>
        <planeGeometry args={[0.3, 0.1]} />
        <meshStandardMaterial map={noren} emissiveMap={noren} emissive="#ffffff" emissiveIntensity={0.35} color="#222" side={THREE.DoubleSide} />
      </mesh>
      <Shutter position={[0.12, 0.1, 0.008]} w={0.14} h={0.16} />
    </group>
  )
}

/** Shuttered shop with corrugated awning, one warm window above. */
function ShopB() {
  const a = VENUE_ANGLES.shopB
  return (
    <group position={polar(VENUE_R, a, T1_TOP)} rotation={[0, faceIn(a), 0]}>
      <NarrowShop
        position={[0, 0, 0]}
        rotationY={0}
        w={0.4}
        d={0.32}
        storeys={3}
        bodyMat={kitMats.coolConcrete}
        roof="flat"
        awning="corrugated"
        litGround={false}
        litUpper={[true, false]}
      />
      <Shutter position={[-0.08, 0.11, 0.008]} w={0.18} h={0.18} />
      <RecessedWindow position={[0.12, 0.11, 0.006]} dim />
    </group>
  )
}

function Bicycle({ position, lean }: { position: [number, number, number]; lean: number }) {
  return (
    <group position={position} rotation={[0, lean, 0.09]}>
      {[-0.045, 0.045].map((x) => (
        <mesh key={x} position={[x, 0.026, 0]} rotation={[0, Math.PI / 2, 0]} material={kitMats.darkSteel}>
          <torusGeometry args={[0.024, 0.0035, 6, 14]} />
        </mesh>
      ))}
      <mesh position={[0, 0.04, 0]} rotation={[0, 0, 0.5]} material={kitMats.darkSteel}>
        <cylinderGeometry args={[0.004, 0.004, 0.1, 6]} />
      </mesh>
      <mesh position={[0.045, 0.062, 0]} material={kitMats.darkSteel}>
        <boxGeometry args={[0.03, 0.006, 0.028]} />
      </mesh>
      <mesh position={[-0.04, 0.058, 0]} material={kitMats.darkSteel}>
        <boxGeometry args={[0.02, 0.008, 0.008]} />
      </mesh>
    </group>
  )
}


/** Small tiled home closing the alley, bicycles outside. */
function ShopC() {
  const a = VENUE_ANGLES.shopC
  return (
    <group>
      <group position={polar(VENUE_R, a, T1_TOP)} rotation={[0, faceIn(a), 0]}>
        <NarrowShop
          position={[0, 0, 0]}
          rotationY={0}
          w={0.4}
          d={0.34}
          storeys={2}
          bodyMat={kitMats.coolConcrete}
          roof="tile"
          awning="none"
          litGround={false}
          litUpper={[true]}
        />
        <RecessedWindow position={[-0.1, 0.11, 0.006]} dim />
      </group>
      <Bicycle position={polar(VENUE_R - 0.28, a + 0.07, T1_TOP)} lean={faceIn(a + 0.07) + 0.25} />
      <Bicycle position={polar(VENUE_R - 0.24, a + 0.115, T1_TOP)} lean={faceIn(a + 0.115) - 0.15} />
    </group>
  )
}

export function Venues() {
  return (
    <group>
      <Revealable a={VENUE_ANGLES.shopA} dur={0.5} lead={0.25}>
        <ShopA />
      </Revealable>
      <Revealable a={VENUE_ANGLES.shopB} dur={0.5} lead={0.25}>
        <ShopB />
      </Revealable>
      <Revealable a={VENUE_ANGLES.shopC} dur={0.5} lead={0.25}>
        <ShopC />
      </Revealable>
    </group>
  )
}
