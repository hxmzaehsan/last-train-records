import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'

/**
 * Small architectural kit for the buildings closest to the hero camera.
 * Detailed geometry here; the distant background stays instanced.
 */

/* ---------- shared materials ---------- */

export const kitMats = {
  /* the record shop's shell — charcoal and petrol rather than brown timber,
     so the warmth in the close-up comes only from inside the shop */
  timber: new THREE.MeshStandardMaterial({ color: '#22262a', roughness: 0.72 }),
  timberLight: new THREE.MeshStandardMaterial({ color: '#3b332a', roughness: 0.68 }),
  creamTile: new THREE.MeshStandardMaterial({ color: '#304149', roughness: 0.62 }),
  coolConcrete: new THREE.MeshStandardMaterial({ color: '#2b3a42', roughness: 0.78 }),
  agedPlastic: new THREE.MeshStandardMaterial({ color: '#37444b', roughness: 0.55 }),
  greenSteel: new THREE.MeshStandardMaterial({ color: '#22362d', roughness: 0.55, metalness: 0.4 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: '#2f3438', roughness: 0.45, metalness: 0.7 }),
  frame: new THREE.MeshStandardMaterial({ color: '#323a3f', roughness: 0.5, metalness: 0.4 }),
  glassDark: new THREE.MeshStandardMaterial({ color: '#0e1216', roughness: 0.25, metalness: 0.2 }),
  tileRoof: new THREE.MeshStandardMaterial({ color: '#202a30', roughness: 0.55, metalness: 0.15 }),
  corrugated: new THREE.MeshStandardMaterial({ color: '#39454e', roughness: 0.5, metalness: 0.6 }),
  awningRed: new THREE.MeshStandardMaterial({ color: '#6b2c20', roughness: 0.8 }),
  awningGreen: new THREE.MeshStandardMaterial({ color: '#22332b', roughness: 0.8 }),
  pipe: new THREE.MeshStandardMaterial({ color: '#3a474d', roughness: 0.5, metalness: 0.6 }),
}

const warmPane = new THREE.MeshBasicMaterial({ color: '#c9d4c6' })
const dimPane = new THREE.MeshBasicMaterial({ color: '#2c3a42' })

/** Gabled roof prism: unit footprint, ridge along local z, height 1. */
export const wedgeGeometry = (() => {
  const g = new THREE.BufferGeometry()
  // prettier-ignore
  const v = new Float32Array([
    // slope +x
    0, 1, -0.5,  0.5, 0, -0.5,  0.5, 0, 0.5,
    0, 1, -0.5,  0.5, 0, 0.5,   0, 1, 0.5,
    // slope -x
    0, 1, 0.5,  -0.5, 0, 0.5,  -0.5, 0, -0.5,
    0, 1, 0.5,  -0.5, 0, -0.5,  0, 1, -0.5,
    // gable +z
    0, 1, 0.5,   0.5, 0, 0.5,  -0.5, 0, 0.5,
    // gable -z
    0, 1, -0.5, -0.5, 0, -0.5,  0.5, 0, -0.5,
  ])
  g.setAttribute('position', new THREE.BufferAttribute(v, 3))
  g.computeVertexNormals()
  return g
})()

/* ---------- atoms ---------- */

export function RecessedWindow({
  position,
  w = 0.085,
  h = 0.1,
  lit = false,
  dim = false,
}: {
  position: [number, number, number]
  w?: number
  h?: number
  lit?: boolean
  dim?: boolean
}) {
  return (
    <group position={position}>
      <mesh material={kitMats.frame}>
        <boxGeometry args={[w + 0.016, h + 0.016, 0.014]} />
      </mesh>
      <mesh position={[0, 0, 0.004]} material={lit ? warmPane : dim ? dimPane : kitMats.glassDark}>
        <boxGeometry args={[w, h, 0.012]} />
      </mesh>
    </group>
  )
}

export function Shutter({ position, w = 0.1, h = 0.11 }: { position: [number, number, number]; w?: number; h?: number }) {
  return (
    <group position={position}>
      <mesh material={kitMats.agedPlastic}>
        <boxGeometry args={[w, h, 0.012]} />
      </mesh>
      {[-0.3, -0.1, 0.1, 0.3].map((f) => (
        <mesh key={f} position={[0, f * h, 0.007]} material={kitMats.frame}>
          <boxGeometry args={[w, 0.006, 0.004]} />
        </mesh>
      ))}
    </group>
  )
}

export function Drainpipe({ x, h, z = 0.005 }: { x: number; h: number; z?: number }) {
  return (
    <group>
      <mesh position={[x, h / 2, z]} material={kitMats.pipe}>
        <cylinderGeometry args={[0.009, 0.009, h, 8]} />
      </mesh>
      <mesh position={[x, 0.02, z + 0.02]} rotation={[Math.PI / 2.6, 0, 0]} material={kitMats.pipe}>
        <cylinderGeometry args={[0.009, 0.009, 0.05, 8]} />
      </mesh>
    </group>
  )
}

export function WallAC({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh material={kitMats.agedPlastic}>
        <boxGeometry args={[0.055, 0.04, 0.035]} />
      </mesh>
      <mesh position={[0.012, 0, 0.019]} rotation={[0, 0, 0]} material={kitMats.frame}>
        <circleGeometry args={[0.013, 12]} />
      </mesh>
    </group>
  )
}

export function FabricAwning({
  w,
  y,
  mat = kitMats.awningRed,
  depth = 0.11,
}: {
  w: number
  y: number
  mat?: THREE.Material
  depth?: number
}) {
  return (
    <group position={[0, y, 0.055]} rotation={[0.5, 0, 0]}>
      <mesh castShadow material={mat}>
        <boxGeometry args={[w, 0.01, depth]} />
      </mesh>
      <mesh position={[0, -0.018, depth / 2]} material={mat}>
        <boxGeometry args={[w, 0.03, 0.008]} />
      </mesh>
    </group>
  )
}

export function CorrugatedAwning({ w, y }: { w: number; y: number }) {
  const n = Math.max(3, Math.round(w / 0.08))
  return (
    <group position={[0, y, 0.06]} rotation={[0.42, 0, 0]}>
      <mesh castShadow material={kitMats.corrugated}>
        <boxGeometry args={[w, 0.01, 0.14]} />
      </mesh>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[-w / 2 + (w / (n - 1)) * i, 0.007, 0]} material={kitMats.corrugated}>
          <boxGeometry args={[0.007, 0.005, 0.14]} />
        </mesh>
      ))}
    </group>
  )
}

export function RoofVent({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh material={kitMats.pipe}>
        <cylinderGeometry args={[0.02, 0.026, 0.05, 8]} />
      </mesh>
      <mesh position={[0, 0.032, 0]} material={kitMats.frame}>
        <cylinderGeometry args={[0.028, 0.028, 0.012, 8]} />
      </mesh>
    </group>
  )
}

export function RooftopFrame({ w, d }: { w: number; d: number }) {
  return (
    <group>
      {[
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [-w / 2, d / 2],
        [w / 2, d / 2],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.05, z]} material={kitMats.darkSteel}>
          <cylinderGeometry args={[0.006, 0.006, 0.1, 6]} />
        </mesh>
      ))}
      <mesh position={[0, 0.1, 0]} material={kitMats.darkSteel}>
        <boxGeometry args={[w + 0.02, 0.008, 0.008]} />
      </mesh>
    </group>
  )
}

/* ---------- building types ---------- */

type ShopFrontProps = {
  w: number
  lit?: boolean
  glow?: string
  door?: boolean
}

export function ShopFront({ w, lit = true, glow = '#ffc87e', door = true }: ShopFrontProps) {
  const gw = door ? w * 0.55 : w * 0.8
  return (
    <group>
      {/* glazing */}
      <group position={[door ? -w * 0.16 : 0, 0.115, 0]}>
        <mesh material={kitMats.frame}>
          <boxGeometry args={[gw + 0.02, 0.2, 0.014]} />
        </mesh>
        <mesh position={[0, 0, 0.005]}>
          <boxGeometry args={[gw, 0.18, 0.01]} />
          {lit ? <meshBasicMaterial color={glow} /> : <primitive object={kitMats.glassDark} attach="material" />}
        </mesh>
        {/* mullions */}
        {[-gw / 4, gw / 4].map((x) => (
          <mesh key={x} position={[x, 0, 0.011]} material={kitMats.frame}>
            <boxGeometry args={[0.008, 0.18, 0.004]} />
          </mesh>
        ))}
      </group>
      {door && (
        <group position={[w * 0.3, 0.1, 0]}>
          <mesh material={kitMats.frame}>
            <boxGeometry args={[0.09, 0.19, 0.014]} />
          </mesh>
          <mesh position={[0, 0.02, 0.005]} material={lit ? dimPane : kitMats.glassDark}>
            <boxGeometry args={[0.07, 0.13, 0.01]} />
          </mesh>
          {/* entrance step */}
          <mesh position={[0, -0.1, 0.03]} material={kitMats.coolConcrete}>
            <boxGeometry args={[0.11, 0.02, 0.06]} />
          </mesh>
        </group>
      )}
    </group>
  )
}

/**
 * A real opening in the ground floor: the body is built as piers, a header
 * and a back wall around it, so the storefront can be entered rather than
 * painted on. The outer envelope is unchanged, so the building reads exactly
 * the same from the city camera.
 */
export type Cavity = { w: number; h: number; d: number; x?: number }

export type NarrowShopProps = {
  position: [number, number, number]
  rotationY: number
  w?: number
  d?: number
  storeys?: number
  bodyMat?: THREE.Material
  roof?: 'flat' | 'tile' | 'corrugated'
  awning?: 'fabric' | 'corrugated' | 'none'
  awningMat?: THREE.Material
  litGround?: boolean
  glow?: string
  litUpper?: boolean[]
  /** hollow ground floor; suppresses the painted shopfront */
  cavity?: Cavity
  children?: React.ReactNode
}

/** Two/three-storey narrow shop-house with detailed front (local +z). */
export function NarrowShop({
  position,
  rotationY,
  w = 0.42,
  d = 0.34,
  storeys = 2,
  bodyMat = kitMats.creamTile,
  roof = 'flat',
  awning = 'fabric',
  awningMat = kitMats.awningRed,
  litGround = true,
  glow = '#ffc87e',
  litUpper = [true, false],
  cavity,
  children,
}: NarrowShopProps) {
  const H = storeys * 0.24
  const cx = cavity ? (cavity.x ?? 0) : 0
  const pierL = cavity ? cx - cavity.w / 2 + w / 2 : 0
  const pierR = cavity ? w / 2 - (cx + cavity.w / 2) : 0
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {cavity ? (
        <group>
          {/* piers either side of the opening */}
          <mesh position={[-w / 2 + pierL / 2, H / 2, -d / 2]} castShadow receiveShadow material={bodyMat}>
            <boxGeometry args={[pierL, H, d]} />
          </mesh>
          <mesh position={[w / 2 - pierR / 2, H / 2, -d / 2]} castShadow receiveShadow material={bodyMat}>
            <boxGeometry args={[pierR, H, d]} />
          </mesh>
          {/* header over the opening */}
          <mesh
            position={[cx, cavity.h + (H - cavity.h) / 2, -d / 2]}
            castShadow
            receiveShadow
            material={bodyMat}
          >
            <boxGeometry args={[cavity.w, H - cavity.h, d]} />
          </mesh>
          {/* wall behind the shop floor */}
          <mesh
            position={[cx, cavity.h / 2, -(d + cavity.d) / 2]}
            castShadow
            receiveShadow
            material={bodyMat}
          >
            <boxGeometry args={[cavity.w, cavity.h, d - cavity.d]} />
          </mesh>
        </group>
      ) : (
        <RoundedBox args={[w, H, d]} radius={0.01} smoothness={2} position={[0, H / 2, -d / 2]} castShadow receiveShadow>
          <primitive object={bodyMat} attach="material" />
        </RoundedBox>
      )}
      {/* front sits at z=0 */}
      {!cavity && <ShopFront w={w} lit={litGround} glow={glow} />}
      {awning === 'fabric' && <FabricAwning w={w * 0.94} y={0.245} mat={awningMat} />}
      {awning === 'corrugated' && <CorrugatedAwning w={w * 0.94} y={0.245} />}
      {Array.from({ length: storeys - 1 }, (_, s) => {
        const y = 0.36 + s * 0.24
        return (
          <group key={s}>
            <RecessedWindow position={[-w * 0.22, y, 0.006]} lit={litUpper[s] ?? false} />
            <RecessedWindow position={[w * 0.22, y, 0.006]} dim={!(litUpper[s] ?? false)} lit={false} />
          </group>
        )
      })}
      {/* drainpipe + AC on the front corner */}
      <Drainpipe x={-w / 2 + 0.02} h={H - 0.04} />
      <WallAC position={[w / 2 - 0.05, H - 0.08, 0.012]} />
      {/* roof */}
      {roof === 'tile' && (
        <mesh
          geometry={wedgeGeometry}
          position={[0, H - 0.005, -d / 2]}
          scale={[d * 1.15, 0.09, w * 1.1]}
          rotation={[0, Math.PI / 2, 0]}
          castShadow
          material={kitMats.tileRoof}
        />
      )}
      {roof === 'corrugated' && (
        <mesh
          geometry={wedgeGeometry}
          position={[0, H - 0.005, -d / 2]}
          scale={[d * 1.15, 0.06, w * 1.1]}
          rotation={[0, Math.PI / 2, 0]}
          castShadow
          material={kitMats.corrugated}
        />
      )}
      {roof === 'flat' && (
        <group position={[0, H, -d / 2]}>
          <mesh position={[0, 0.015, d / 2 - 0.01]} material={kitMats.coolConcrete}>
            <boxGeometry args={[w, 0.03, 0.02]} />
          </mesh>
          <RoofVent position={[w * 0.2, 0.03, 0]} />
        </group>
      )}
      {children}
    </group>
  )
}
