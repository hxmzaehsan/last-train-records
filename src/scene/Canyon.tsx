import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { BASE_TOP_Y, T2_TOP, T4_TOP, TRACK_R, polar } from './helpers'
import { Sign } from './signage'
import {
  NarrowShop,
  RecessedWindow,
  RoofVent,
  RooftopFrame,
  Drainpipe,
  kitMats,
  wedgeGeometry,
} from './Kit'
import { useReducedMotion } from './useReducedMotion'
import { Revealable } from './Revealable'
import { neonGate, timeline } from './timeline'
import { RecordShopVenue } from './RecordShopVenue'
import { discoverPulse, venue, venueProgress } from './venue'

/**
 * The curated street canyon: five named shopfronts pulled tight against the
 * railway so the settled train is framed by lit storefronts, cables and the
 * big 終電レコード neon. Everything faces the record centre — and the camera.
 */

const deg = THREE.MathUtils.degToRad

const A_RECORD = deg(10)
const A_RAMEN = deg(-1)
const A_ARCADE = deg(-12)
const A_KISSATEN = deg(-23)
const A_KONBINI = deg(-33)
const A_BRIDGE = deg(-6.5)
const OUTER_R = 4.06
const INNER_R = 3.18

/** rotY so local +z faces the record centre (outer-wall storefronts). */
const faceIn = (a: number) => -a - Math.PI / 2
/** rotY so local +z faces outward (inner-wall backs). */
const faceOut = (a: number) => Math.PI / 2 - a

/** the record shop answers a hover; its neighbours step back very slightly */
const competing = () => 1 - 0.16 * venue.hot

function NeonDriver({
  matRef,
  lightRef,
  base,
  lightBase,
  angle,
  role = 'neighbour',
}: {
  matRef: React.RefObject<THREE.MeshStandardMaterial | null>
  lightRef: React.RefObject<THREE.PointLight | null>
  base: number
  lightBase: number
  angle: number
  /** 'shop' brightens on hover and flutters once on settle; others dim a touch */
  role?: 'shop' | 'neighbour'
}) {
  const reduced = useReducedMotion()
  useFrame(({ clock }) => {
    const gate = neonGate(angle)
    const t = clock.elapsedTime
    let factor = 1
    if (!reduced) {
      const slot = Math.floor(t * 18)
      const h = Math.abs(Math.sin(slot * 127.1) * 43758.5453) % 1
      const dip = h < 0.045 ? 0.25 : 1
      factor = dip * (0.94 + 0.06 * Math.sin(t * 1.7))
    }
    let lightFactor = factor
    if (role === 'shop') {
      const pulse = timeline.mode === 'done' ? discoverPulse(timeline.lifeT) : 0
      factor *= 1 + 0.55 * venue.hot + 0.45 * pulse
      // up close the sign frames the shop rather than leading it, so its
      // bloom is eased back — still well over the threshold, still magenta
      factor *= 1 - 0.34 * venueProgress()
      // the wide magenta spill is a city-scale effect: from a metre away it
      // would wash the whole façade pink, so it falls back as we walk up
      lightFactor = factor * (1 - 0.84 * venueProgress())
    } else {
      factor *= competing()
      lightFactor = factor
    }
    if (matRef.current) matRef.current.emissiveIntensity = base * factor * gate
    if (lightRef.current) {
      lightRef.current.userData.driven = true
      lightRef.current.intensity = lightBase * lightFactor * gate
    }
  })
  return null
}

/** dims a neighbouring sign's emissive while the record shop is highlighted */
function DimSign({ matRef, base }: { matRef: React.RefObject<THREE.MeshStandardMaterial | null>; base: number }) {
  useFrame(() => {
    if (matRef.current) matRef.current.emissiveIntensity = base * competing()
  })
  return null
}

/** Last Train Records — the anchor shop with the big vertical 終電レコード neon. */
function RecordShopCanyon() {
  const signMat = useRef<THREE.MeshStandardMaterial>(null)
  const light = useRef<THREE.PointLight>(null)
  return (
    <group position={polar(OUTER_R, A_RECORD, T4_TOP)} rotation={[0, faceIn(A_RECORD), 0]}>
      <NarrowShop
        position={[0, 0, 0]}
        rotationY={0}
        w={0.54}
        d={0.42}
        storeys={2}
        bodyMat={kitMats.timber}
        roof="flat"
        awning="none"
        litUpper={[true]}
        cavity={{ w: 0.4, h: 0.215, d: 0.19, x: -0.03 }}
      />
      {/* the shop the camera can actually walk up to */}
      <RecordShopVenue />
      {/* fascia: smaller and smoked black so it supports the vertical neon
          rather than competing with it */}
      <Sign
        spec={{ text: 'ラスト・トレイン・レコーズ', fg: '#e2d8c2', bg: '#131719', frame: '#39434a' }}
        height={0.031}
        position={[-0.03, 0.3, 0.035]}
      />
      {/* the big vertical neon that frames the train */}
      <Revealable a={A_RECORD} lead={0.55} dur={0.35}>
        <Sign
          spec={{ text: '終電レコード', vertical: true, fg: '#ffb3dd', bg: '#2b0618', frame: '#FF2C9C' }}
          height={0.72}
          position={[0.33, 0.62, 0.06]}
          neon
          intensity={2.1}
          materialRef={signMat}
        />
      </Revealable>
      {/* crates + a leaning pressing, kept clear of the recessed entrance */}
      <mesh position={[-0.26, 0.045, 0.085]} castShadow material={kitMats.darkSteel}>
        <boxGeometry args={[0.11, 0.09, 0.09]} />
      </mesh>
      {/* a pressing left flat on the crate lid */}
      <mesh position={[-0.26, 0.093, 0.085]} rotation={[0.04, 0, 0.05]}>
        <cylinderGeometry args={[0.042, 0.042, 0.005, 32]} />
        <meshStandardMaterial color="#0c0a0a" roughness={0.35} />
      </mesh>
      <pointLight ref={light} position={[0.3, 0.45, 0.4]} color="#FF2C9C" intensity={2.5} distance={2.9} decay={2} />
      <NeonDriver matRef={signMat} lightRef={light} base={2.1} lightBase={1.9} angle={A_RECORD} role="shop" />
      <group position={[-0.14, 0.48, -0.3]}>
        <RooftopFrame w={0.2} d={0.14} />
      </group>
    </group>
  )
}

function RamenCanyon() {
  const signMat = useRef<THREE.MeshStandardMaterial>(null)
  return (
    <group position={polar(OUTER_R, A_RAMEN, T4_TOP)} rotation={[0, faceIn(A_RAMEN), 0]}>
      <NarrowShop
        position={[0, 0, 0]}
        rotationY={0}
        w={0.42}
        d={0.36}
        storeys={2}
        bodyMat={kitMats.timberLight}
        roof="corrugated"
        awning="corrugated"
        litGround
        glow="#ffc87e"
        litUpper={[false]}
      />
      <Sign
        spec={{ text: 'ラーメン', vertical: true, fg: '#ffd9a3', bg: '#3a1610', frame: '#e8a04c' }}
        height={0.32}
        position={[-0.24, 0.36, 0.055]}
        neon
        intensity={1.6}
        materialRef={signMat}
      />
      <DimSign matRef={signMat} base={1.6} />
      {/* red noren over the counter */}
      <mesh position={[0.05, 0.21, 0.035]}>
        <planeGeometry args={[0.26, 0.09]} />
        <meshStandardMaterial color="#a32a1c" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <RoofVent position={[0.1, 0.54, -0.2]} />
      <pointLight position={[-0.1, 0.3, 0.34]} color="#ffab52" intensity={2.2} distance={2.4} decay={2} />
    </group>
  )
}

function ArcadeCanyon() {
  const signMat = useRef<THREE.MeshStandardMaterial>(null)
  const light = useRef<THREE.PointLight>(null)
  return (
    <group position={polar(OUTER_R, A_ARCADE, T4_TOP)} rotation={[0, faceIn(A_ARCADE), 0]}>
      <NarrowShop
        position={[0, 0, 0]}
        rotationY={0}
        w={0.48}
        d={0.38}
        storeys={3}
        bodyMat={kitMats.coolConcrete}
        roof="flat"
        awning="none"
        litGround
        glow="#bfeef8"
        litUpper={[true, false]}
      />
      <Sign
        spec={{ text: 'ゲーム', vertical: true, fg: '#c8f6ff', bg: '#062329', frame: '#20E7FF' }}
        height={0.4}
        position={[-0.28, 0.46, 0.06]}
        neon
        intensity={1.8}
        materialRef={signMat}
      />
      <Sign
        spec={{ text: '入口', fg: '#f2efe4', bg: '#20343c' }}
        height={0.042}
        position={[0.16, 0.27, 0.012]}
      />
      {[-0.1, 0.0].map((x) => (
        <mesh key={x} position={[x, 0.1, 0.013]}>
          <planeGeometry args={[0.05, 0.11]} />
          <meshBasicMaterial color="#17323a" />
        </mesh>
      ))}
      <pointLight ref={light} position={[-0.26, 0.44, 0.36]} color="#20E7FF" intensity={2.2} distance={2.5} decay={2} />
      <NeonDriver matRef={signMat} lightRef={light} base={1.8} lightBase={1.7} angle={A_ARCADE} />
    </group>
  )
}

function KissatenCanyon() {
  const signMat = useRef<THREE.MeshStandardMaterial>(null)
  return (
    <group position={polar(OUTER_R, A_KISSATEN, T4_TOP)} rotation={[0, faceIn(A_KISSATEN), 0]}>
      <NarrowShop
        position={[0, 0, 0]}
        rotationY={0}
        w={0.46}
        d={0.36}
        storeys={2}
        bodyMat={kitMats.creamTile}
        roof="tile"
        awning="fabric"
        awningMat={kitMats.awningGreen}
        litGround
        glow="#ffdca4"
        litUpper={[true]}
      />
      <Sign
        spec={{ text: '喫茶', vertical: true, fg: '#2b241c', bg: '#e8dfc9', frame: '#8a7c5e' }}
        height={0.2}
        position={[-0.26, 0.36, 0.05]}
        neon
        intensity={1.1}
        materialRef={signMat}
      />
      <DimSign matRef={signMat} base={1.1} />
      <pointLight position={[0, 0.26, 0.3]} color="#ffc37a" intensity={1.4} distance={1.9} decay={2} />
    </group>
  )
}

function KonbiniCanyon() {
  const glowMat = useRef<THREE.MeshBasicMaterial>(null)
  const signMat = useRef<THREE.MeshStandardMaterial>(null)
  const reduced = useReducedMotion()
  useFrame(({ clock }) => {
    if (!glowMat.current) return
    const gate = neonGate(A_KONBINI)
    glowMat.current.opacity = reduced
      ? gate
      : (0.93 + 0.07 * Math.sin(clock.elapsedTime * 0.9)) * gate
  })
  return (
    <group position={polar(OUTER_R, A_KONBINI, T4_TOP)} rotation={[0, faceIn(A_KONBINI), 0]}>
      <mesh position={[0, 0.2, -0.2]} castShadow receiveShadow material={kitMats.agedPlastic}>
        <boxGeometry args={[0.6, 0.4, 0.4]} />
      </mesh>
      <mesh position={[0, 0.12, 0.005]}>
        <planeGeometry args={[0.52, 0.18]} />
        <meshBasicMaterial ref={glowMat} color="#c8dfc2" transparent opacity={1} />
      </mesh>
      {[-0.16, 0.0, 0.16].map((x) => (
        <mesh key={x} position={[x, 0.1, 0.012]}>
          <planeGeometry args={[0.07, 0.1]} />
          <meshBasicMaterial color="#7fa78c" />
        </mesh>
      ))}
      <Sign
        spec={{ text: '24時間', fg: '#dcffb2', bg: '#15260a', frame: '#A8FF3E' }}
        height={0.075}
        position={[-0.1, 0.335, 0.03]}
        neon
        intensity={1.25}
        materialRef={signMat}
      />
      <DimSign matRef={signMat} base={1.25} />
      <Sign
        spec={{ text: '入口', fg: '#20343c', bg: '#e4e9e2' }}
        height={0.04}
        position={[0.2, 0.3, 0.012]}
      />
      {[0.06, 0.13, 0.2].map((y) => (
        <mesh key={y} position={[0.305, y, -0.1]} castShadow material={kitMats.pipe}>
          <boxGeometry args={[0.02, 0.045, 0.045]} />
        </mesh>
      ))}
      {/* green spill from the 24-hour shop */}
      <pointLight position={[0, 0.24, 0.32]} color="#A8FF3E" intensity={0.95} distance={1.6} decay={2} />
    </group>
  )
}

/** 終電前 timetable board at the canyon mouth, right where the track forms. */
function LastTrainBoard() {
  const a = deg(15)
  /* it stands between the close-up camera and the shop, straight across the
     neon, so it steps aside for the venue and comes back with the hero */
  const post = useRef<THREE.Material & { opacity: number }>(null)
  const panel = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => {
    const k = 1 - venueProgress()
    if (post.current) post.current.opacity = k
    if (panel.current) {
      panel.current.opacity = k
      panel.current.emissiveIntensity = 1.15 * k
    }
  })
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 192
    c.height = 144
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#14171a'
    ctx.fillRect(0, 0, 192, 144)
    ctx.fillStyle = '#f0ede2'
    ctx.textAlign = 'center'
    ctx.font = "600 34px 'Noto Sans JP Variable','Hiragino Sans',sans-serif"
    ctx.fillText('終電前', 96, 36)
    ctx.fillStyle = '#20E7FF'
    ctx.fillRect(16, 52, 160, 3)
    ctx.fillStyle = '#9aa4a8'
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(16, 68 + i * 18, 110, 6)
      ctx.fillStyle = '#c8d2d4'
      ctx.fillRect(140, 68 + i * 18, 36, 6)
      ctx.fillStyle = '#9aa4a8'
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  return (
    <group position={polar(3.95, a, T4_TOP)} rotation={[0, faceIn(a) + 0.3, 0]}>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.01, 0.012, 0.32, 8]} />
        {/* matches kitMats.greenSteel, but per-instance so it can fade */}
        <meshStandardMaterial ref={post} color="#22362d" roughness={0.55} metalness={0.4} transparent />
      </mesh>
      <mesh position={[0, 0.37, 0]}>
        <planeGeometry args={[0.19, 0.145]} />
        <meshStandardMaterial ref={panel} map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={1.15} color="#111" side={THREE.DoubleSide} transparent />
      </mesh>
    </group>
  )
}

/** Lit station-approach name board at the canyon's station end. */
function ApproachSign() {
  const a = deg(-38)
  return (
    <group position={polar(3.24, a, T2_TOP)} rotation={[0, faceIn(a), 0]}>
      {[-0.08, 0.08].map((x) => (
        <mesh key={x} position={[x, 0.12, 0]} material={kitMats.greenSteel}>
          <cylinderGeometry args={[0.006, 0.006, 0.24, 6]} />
        </mesh>
      ))}
      <Sign
        spec={{ text: '下北沢', fg: '#1e2022', bg: '#edf2ec', stripe: '#FF2C9C' }}
        height={0.09}
        position={[0, 0.28, 0]}
        neon
        intensity={1.35}
      />
    </group>
  )
}

/** Alley backs: low dark buildings facing away, pipes and vents only. */
function AlleyBack({
  a,
  w = 0.44,
  h = 0.34,
  mat = kitMats.coolConcrete,
}: {
  a: number
  w?: number
  h?: number
  mat?: THREE.Material
}) {
  return (
    <group position={polar(INNER_R, a, T2_TOP)} rotation={[0, faceOut(a), 0]}>
      <mesh position={[0, h / 2, -0.14]} castShadow receiveShadow material={mat}>
        <boxGeometry args={[w, h, 0.28]} />
      </mesh>
      <RecessedWindow position={[-w * 0.22, h * 0.62, 0.006]} dim />
      <RecessedWindow position={[w * 0.2, h * 0.38, 0.006]} lit={false} />
      <Drainpipe x={w / 2 - 0.02} h={h - 0.03} />
      <mesh position={[-w * 0.3, h + 0.02, -0.1]} material={kitMats.pipe}>
        <cylinderGeometry args={[0.016, 0.02, 0.045, 8]} />
      </mesh>
      <group position={[w * 0.1, h * 0.42, 0.04]} rotation={[0.5, 0, 0]}>
        <mesh material={kitMats.corrugated}>
          <boxGeometry args={[0.16, 0.008, 0.09]} />
        </mesh>
      </group>
    </group>
  )
}

function FootBridge() {
  const a = A_BRIDGE
  const deckY = BASE_TOP_Y + 0.72
  return (
    <group>
      {[3.26, 4.0].map((r) => (
        <group key={r} position={polar(r, a, r < TRACK_R ? T2_TOP : T4_TOP)} rotation={[0, -a, 0]}>
          <mesh position={[0, (deckY - T2_TOP) / 2, 0]} castShadow material={kitMats.greenSteel}>
            <boxGeometry args={[0.1, deckY - T2_TOP + 0.02, 0.16]} />
          </mesh>
        </group>
      ))}
      <group position={polar(3.62, a, deckY)} rotation={[0, -a, 0]}>
        <mesh castShadow material={kitMats.greenSteel}>
          <boxGeometry args={[0.9, 0.024, 0.13]} />
        </mesh>
        {[-0.062, 0.062].map((z) => (
          <mesh key={z} position={[0, 0.045, z]} material={kitMats.greenSteel}>
            <boxGeometry args={[0.9, 0.07, 0.008]} />
          </mesh>
        ))}
        {/* fluorescent strip under the handrail */}
        <mesh position={[0, 0.062, 0]}>
          <boxGeometry args={[0.84, 0.008, 0.02]} />
          <meshStandardMaterial color="#e8f7fb" emissive="#bfeef8" emissiveIntensity={1.9} />
        </mesh>
        <pointLight position={[0, 0.02, 0]} color="#9fe6f5" intensity={1.3} distance={1.7} decay={2} />
      </group>
    </group>
  )
}

const UP = new THREE.Vector3(0, 1, 0)

/* Shared so the overhead lines can be faded together: from the street they
   cross straight over the shop's neon, which the close-up needs clear. They
   come back with the hero camera. */
const wireMat = new THREE.MeshStandardMaterial({
  color: '#151716',
  roughness: 0.5,
  metalness: 0.5,
  transparent: true,
})

function WireFade() {
  useFrame(() => {
    wireMat.opacity = 1 - 0.92 * venueProgress()
  })
  return null
}

function Wire({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const { mid, quat, len } = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(to, from)
    const len = dir.length()
    const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize())
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5)
    return { mid, quat, len }
  }, [from, to])
  return (
    <mesh position={mid} quaternion={quat} material={wireMat}>
      <cylinderGeometry args={[0.0035, 0.0035, len, 6]} />
    </mesh>
  )
}

/** Mid-rise slabs behind the canyon shops for skyline layering. */
function BackSlabs() {
  const slabs = [
    { a: deg(5), h: 0.68, w: 0.5, mat: kitMats.coolConcrete },
    { a: deg(-7), h: 0.86, w: 0.44, mat: kitMats.creamTile },
    { a: deg(-18), h: 0.62, w: 0.55, mat: kitMats.coolConcrete },
    { a: deg(-29), h: 0.74, w: 0.46, mat: kitMats.coolConcrete },
  ]
  return (
    <group>
      {slabs.map((s, i) => (
        <Revealable key={i} a={s.a} dur={0.5} lead={0.5}>
        <group position={polar(4.6, s.a, T4_TOP)} rotation={[0, faceIn(s.a), 0]}>
          <mesh position={[0, s.h / 2, -0.15]} castShadow receiveShadow material={s.mat}>
            <boxGeometry args={[s.w, s.h, 0.3]} />
          </mesh>
          {[0.18, 0.38, 0.58].map(
            (fy, j) =>
              fy < s.h - 0.08 && (
                <RecessedWindow
                  key={j}
                  position={[(j % 2 ? -1 : 1) * s.w * 0.2, fy, 0.006]}
                  lit={j % 3 === 0}
                  dim={j % 3 === 1}
                />
              ),
          )}
          <mesh
            geometry={wedgeGeometry}
            position={[0, s.h, -0.15]}
            scale={[0.3, 0.05, s.w * 1.05]}
            rotation={[0, Math.PI / 2, 0]}
            material={kitMats.corrugated}
          />
        </group>
        </Revealable>
      ))}
    </group>
  )
}

export function Canyon() {
  const wires = useMemo(() => {
    const list: { from: THREE.Vector3; to: THREE.Vector3 }[] = []
    for (const a of [deg(13), deg(7), deg(2), deg(-4), deg(-10), deg(-16), deg(-21.5), deg(-27), deg(-31.5)]) {
      list.push({
        from: new THREE.Vector3(...polar(3.98, a + 0.01, T4_TOP + 0.5 + (a < deg(-14) ? 0.08 : 0.02 * (a > 0 ? 1 : -1) + 0.04))),
        to: new THREE.Vector3(...polar(3.24, a - 0.012, T2_TOP + 0.38 + (a < deg(-8) ? 0.06 : 0.12))),
      })
    }
    return list
  }, [])

  return (
    <group>
      <WireFade />
      <Revealable a={A_RECORD} dur={0.5} lead={0.22}>
        <RecordShopCanyon />
      </Revealable>
      <Revealable a={A_RAMEN} dur={0.5} lead={0.26}>
        <RamenCanyon />
      </Revealable>
      <Revealable a={A_ARCADE} dur={0.5} lead={0.26}>
        <ArcadeCanyon />
      </Revealable>
      <Revealable a={A_KISSATEN} dur={0.5} lead={0.26}>
        <KissatenCanyon />
      </Revealable>
      <Revealable a={A_KONBINI} dur={0.5} lead={0.26}>
        <KonbiniCanyon />
      </Revealable>
      <Revealable a={deg(15)} dur={0.3} lead={0.4}>
        <LastTrainBoard />
      </Revealable>
      <Revealable a={deg(-38)} dur={0.35} lead={0.4}>
        <ApproachSign />
      </Revealable>
      <BackSlabs />
      <Revealable a={deg(4)} dur={0.45} lead={0.3}>
        <AlleyBack a={deg(4)} w={0.42} h={0.32} />
      </Revealable>
      <Revealable a={deg(-17)} dur={0.45} lead={0.3}>
        <AlleyBack a={deg(-17)} w={0.44} h={0.3} mat={kitMats.creamTile} />
      </Revealable>
      <Revealable a={deg(-28)} dur={0.45} lead={0.3}>
        <AlleyBack a={deg(-28)} w={0.4} h={0.34} mat={kitMats.timberLight} />
      </Revealable>
      <Revealable a={A_BRIDGE} dur={0.55} lead={0.4}>
        <FootBridge />
      </Revealable>
      {wires.map((w, i) => (
        <Revealable key={i} a={Math.atan2(w.from.z, w.from.x)} lead={0.6} dur={0.25}>
          <Wire from={w.from} to={w.to} />
        </Revealable>
      ))}
    </group>
  )
}
