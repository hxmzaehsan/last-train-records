import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Sign } from './signage'
import { kitMats } from './Kit'
import { clamp01, smoothEase, timeline } from './timeline'
import { RELEASES, sleeveTextures } from './releases'
import {
  MiniFigure,
  apronTexture,
  faceMaterial,
  geo,
  poseIdle,
  poseWalk,
  stepLength,
  wardrobe,
  wrapPi,
  type FigureRig,
} from './Figures'
import {
  SLEEVE_LOCAL,
  discoverPulse,
  selectRelease,
  venue,
  venueProgress,
} from './venue'

/**
 * Close-range interior for Last Train Records. Everything here lives in the
 * hollow ground floor cut into the shop-house (see NarrowShop's `cavity`), so
 * the building's outer envelope — and therefore the approved hero frame — is
 * untouched.
 *
 * Shop-local axes: +x runs along the façade, +y up from its base, +z out of
 * the storefront toward the street. The opening spans x -0.23 .. 0.17,
 * y 0 .. 0.215, z 0 .. -0.15.
 */

const CX = -0.03
/** deep enough that the shopkeeper can stand behind the counter, not inside it */
const CAV_D = 0.19
/* display window bay */
const WIN_X0 = -0.225
const WIN_X1 = 0.025
const WIN_Y0 = 0.055
const WIN_Y1 = 0.2
const WIN_W = WIN_X1 - WIN_X0
const WIN_CX = (WIN_X0 + WIN_X1) / 2
/* recessed entrance bay */
const DOOR_X = 0.108
const DOOR_W = 0.11
const DOOR_Z = -0.062
/* the counter, and where the shopkeeper stands behind it */
const KEEP_X = 0.088
const BIN_X = -0.075

const mats = {
  floor: new THREE.MeshStandardMaterial({ color: '#241f1a', roughness: 0.72 }),
  wall: new THREE.MeshStandardMaterial({ color: '#2b2620', roughness: 0.85 }),
  trim: new THREE.MeshStandardMaterial({ color: '#171b1d', roughness: 0.42, metalness: 0.55 }),
  brass: new THREE.MeshStandardMaterial({ color: '#8d7a55', roughness: 0.32, metalness: 0.8 }),
  bin: new THREE.MeshStandardMaterial({ color: '#2e2822', roughness: 0.66 }),
  record: new THREE.MeshStandardMaterial({ color: '#0b0c0d', roughness: 0.36 }),
  counter: new THREE.MeshStandardMaterial({ color: '#332c24', roughness: 0.6 }),
  poster: new THREE.MeshStandardMaterial({ color: '#3a3a34', roughness: 0.85 }),
  paving: new THREE.MeshStandardMaterial({ color: '#2a3138', roughness: 0.9 }),
  wear: new THREE.MeshStandardMaterial({ color: '#1d1a16', roughness: 0.95, transparent: true, opacity: 0.55 }),
}

/** faint diagonal streak so the shop glass reads as glass, not as a hole */
function reflectionTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 128, 128)
  ctx.globalAlpha = 1
  const g = ctx.createLinearGradient(0, 128, 128, 0)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.42, 'rgba(190,214,222,0.5)')
  g.addColorStop(0.5, 'rgba(214,232,238,0.72)')
  g.addColorStop(0.58, 'rgba(190,214,222,0.4)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** the small price slip that names each pressing on the display deck */
function slipTexture(cat: string) {
  const c = document.createElement('canvas')
  c.width = 192
  c.height = 80
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#e8e3d6'
  ctx.fillRect(0, 0, 192, 80)
  ctx.fillStyle = '#1a1c1b'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = "620 40px 'Archivo Variable','Helvetica Neue',Arial,sans-serif"
  ctx.fillText(cat, 96, 42)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Frame({
  x,
  y,
  w,
  h,
  z,
  t = 0.006,
}: {
  x: number
  y: number
  w: number
  h: number
  z: number
  t?: number
}) {
  return (
    <group position={[x, y, z]}>
      {[-1, 1].map((s) => (
        <mesh key={`v${s}`} position={[(s * w) / 2, 0, 0]} material={mats.trim}>
          <boxGeometry args={[t, h + t, 0.014]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`h${s}`} position={[0, (s * h) / 2, 0]} material={mats.trim}>
          <boxGeometry args={[w + t, t, 0.014]} />
        </mesh>
      ))}
    </group>
  )
}

export function RecordShopVenue() {
  const sleeveTex = useMemo(() => sleeveTextures(), [])
  const reflect = useMemo(() => reflectionTexture(), [])
  const slips = useMemo(() => RELEASES.map((r) => slipTexture(r.cat)), [])

  const ceiling = useRef<THREE.MeshStandardMaterial>(null)
  const interior = useRef<THREE.PointLight>(null)
  const accent = useRef<THREE.PointLight>(null)
  const rim = useRef<THREE.SpotLight>(null)
  const open = useRef<THREE.MeshStandardMaterial>(null)
  const keeper = useRef<THREE.Group>(null)
  const sleeves = useRef<(THREE.Group | null)[]>([])
  const sleeveMats = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const slipMats = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const glass = useRef<THREE.MeshStandardMaterial>(null)
  const rimTarget = useRef<THREE.Object3D>(null)
  const fill = useRef<THREE.SpotLight>(null)
  const fillTarget = useRef<THREE.Object3D>(null)

  const keeperRig = useRef<FigureRig | null>(null)
  const keeperStride = useRef(0)

  const ease = useRef([1, 0, 0])
  const accentColor = useMemo(() => new THREE.Color(RELEASES[0].accent), [])
  const wanted = useMemo(() => new THREE.Color(), [])

  /* charcoal shirt, dark hair, an apron carrying a small LTR mark */
  const keeperMats = useMemo(() => {
    const apron = wardrobe.apron.clone() as THREE.MeshStandardMaterial
    apron.map = apronTexture()
    return {
      skin: wardrobe.skinPale,
      hair: wardrobe.hairBlack,
      coat: wardrobe.coatCharcoal,
      trouser: wardrobe.trouserDark,
      shoe: wardrobe.shoe,
      extra: apron,
      face: faceMaterial('welcome'),
    }
  }, [])

  useLayoutEffect(() => {
    if (rim.current && rimTarget.current) rim.current.target = rimTarget.current
    if (fill.current && fillTarget.current) fill.current.target = fillTarget.current
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const p = venueProgress()
    const hot = venue.hot
    const pulse = timeline.mode === 'done' ? discoverPulse(timeline.lifeT) : 0
    const lit = Math.max(p, hot * 0.55, pulse * 0.5)

    // Interior lights sit centimetres from what they light, so their values
    // are tiny: inverse-square at this scale blows out fast, and the close-up
    // has to stay black-first with warm pools, not a lit box.
    if (ceiling.current) ceiling.current.emissiveIntensity = 0.22 + 0.26 * lit
    if (interior.current) interior.current.intensity = 0.07 + 0.16 * lit
    if (glass.current) glass.current.opacity = 0.2 - 0.09 * p

    // the storefront light takes the selected pressing's accent
    wanted.set(RELEASES[venue.selected].spill)
    accentColor.lerp(wanted, 1 - Math.pow(0.001, dt))
    if (accent.current) {
      accent.current.color.copy(accentColor)
      accent.current.intensity = 0.014 + 0.085 * p + 0.015 * hot
    }
    // a cool street key: the shell is charcoal now, so it needs real shaping
    // to keep its depth without warming the palette back up
    if (fill.current) fill.current.intensity = 3.6 * p
    // restrained physical rim on hover / focus — no outline, just light
    if (rim.current) rim.current.intensity = 3.4 * hot

    if (open.current) open.current.emissiveIntensity = 1.5 + 0.7 * hot + 0.5 * pulse

    // The shopkeeper works his shift: long spells at the counter, an
    // occasional walk over to the bins, a glance at the window, and now and
    // then a hand up to straighten something. Nothing loops on a short cycle.
    if (keeper.current) {
      const t = timeline.lifeT
      const u = ((t / 34) % 1 + 1) % 1
      let at = 0
      let walking = 0
      if (u >= 0.16 && u < 0.3) {
        at = smoothEase((u - 0.16) / 0.14)
        walking = -1 // outbound, toward the bins
      } else if (u >= 0.3 && u < 0.6) {
        at = 1
      } else if (u >= 0.6 && u < 0.74) {
        at = 1 - smoothEase((u - 0.6) / 0.14)
        walking = 1 // back to the counter
      }
      const x = KEEP_X + (BIN_X - KEEP_X) * at
      keeper.current.position.x = x
      keeper.current.position.z = -0.172 + at * 0.006

      /*
       * He turns a beat before he sets off and holds that heading while he is
       * at the bins, so he never walks backwards down his own aisle. Facing is
       * driven by the leg he is on, and the legs wait for the body to come
       * round.
       */
      let facing = 0 // at the counter, facing the street
      if (u >= 0.13 && u < 0.57) facing = -Math.PI / 2 // out to the bins, and browsing
      else if (u >= 0.57 && u < 0.76) facing = Math.PI / 2 // back to the counter
      const diff = wrapPi(facing - keeper.current.rotation.y)
      keeper.current.rotation.y = wrapPi(
        keeper.current.rotation.y + Math.sign(diff) * Math.min(Math.abs(diff), 4 * dt),
      )
      const align = clamp01(1 - Math.abs(diff) / 0.55)
      keeperStride.current += Math.abs(x - keeper.current.position.x)

      const rig = keeperRig.current
      if (walking && align > 0.2) {
        poseWalk(rig, (keeperStride.current / stepLength(0.112)) * Math.PI, 0.85 * align, t, 3.1)
      } else if (walking) {
        poseIdle(rig, t, 3.1, 0)
      } else {
        // at the bins he looks down at the records; at the counter, outward
        poseIdle(rig, t, 3.1, at > 0.5 ? -0.5 : Math.sin(t * 0.21) * 0.55)
        if (rig) {
          if (at > 0.5) rig.head.rotation.x = 0.35
          // a small, occasional gesture rather than constant fidgeting
          const g = clamp01((Math.sin(t * 0.37 + 1.1) - 0.86) / 0.14)
          rig.armL.rotation.x -= g * 0.75
          rig.foreL.rotation.x += g * 0.95
          rig.chest.rotation.x += g * 0.05
        }
      }
    }

    // sleeves: hovered lifts, selected lifts more, the others step back
    for (let i = 0; i < 3; i++) {
      const target = venue.hover === i ? 1 : venue.selected === i ? 0.72 : -0.28
      const e = ease.current[i] + (target - ease.current[i]) * (1 - Math.pow(0.0015, dt))
      ease.current[i] = e
      const g = sleeves.current[i]
      if (g) {
        g.position.z = SLEEVE_LOCAL[i][2] + e * 0.012 * p
        g.position.y = SLEEVE_LOCAL[i][1] + Math.max(0, e) * 0.004 * p
      }
      const m = sleeveMats.current[i]
      if (m) m.emissiveIntensity = 0.34 + 0.5 * lit + Math.max(0, e) * 0.55 * p
      const s = slipMats.current[i]
      if (s) s.emissiveIntensity = 0.3 + 0.45 * lit + Math.max(0, e) * 0.9 * p
    }
  })

  return (
    <group>
      {/* ------------------------------------------------ shell + interior */}
      <mesh position={[CX, 0.004, -CAV_D / 2]} receiveShadow material={mats.floor}>
        <boxGeometry args={[0.4, 0.008, CAV_D]} />
      </mesh>
      <mesh position={[CX, 0.107, -CAV_D + 0.004]} material={mats.wall}>
        <boxGeometry args={[0.4, 0.215, 0.008]} />
      </mesh>
      {/* illuminated ceiling panel */}
      <mesh position={[CX, 0.209, -0.078]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.34, 0.12]} />
        <meshStandardMaterial
          ref={ceiling}
          color="#3b3225"
          emissive="#ffd6a0"
          emissiveIntensity={1.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* two track lights on a rail over the window */}
      <mesh position={[WIN_CX, 0.203, -0.05]} material={mats.trim}>
        <boxGeometry args={[0.2, 0.005, 0.005]} />
      </mesh>
      {[-0.05, 0.05].map((dx) => (
        <mesh key={dx} position={[WIN_CX + dx, 0.196, -0.05]} rotation={[0.5, 0, 0]} material={mats.trim}>
          <cylinderGeometry args={[0.006, 0.008, 0.014, 8]} />
        </mesh>
      ))}
      {/* hanging lamp over the counter */}
      <group position={[DOOR_X - 0.02, 0, -0.11]}>
        <mesh position={[0, 0.19, 0]} material={mats.trim}>
          <cylinderGeometry args={[0.0012, 0.0012, 0.05, 4]} />
        </mesh>
        <mesh position={[0, 0.161, 0]}>
          <coneGeometry args={[0.016, 0.016, 12, 1, true]} />
          <meshStandardMaterial color="#2b2a26" emissive="#ffcf96" emissiveIntensity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* ----------------------------------------------------- record bins */}
      {[-0.16, -0.06].map((x, i) => (
        <group key={x} position={[x, 0.008, -0.128]}>
          <mesh material={mats.bin} castShadow>
            <boxGeometry args={[0.088, 0.042, 0.058]} />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh
              key={k}
              position={[-0.02 + k * 0.018, 0.03, -0.004 + i * 0.002]}
              rotation={[0.16, 0, 0]}
              material={mats.record}
            >
              <boxGeometry args={[0.0035, 0.03, 0.03]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* ------------------------------------------------ counter + keeper */}
      <mesh position={[KEEP_X, 0.035, -0.136]} material={mats.counter} castShadow>
        <boxGeometry args={[0.088, 0.054, 0.042]} />
      </mesh>
      <mesh position={[KEEP_X, 0.064, -0.136]} material={mats.trim}>
        <boxGeometry args={[0.092, 0.004, 0.046]} />
      </mesh>
      <group ref={keeper} position={[KEEP_X, 0, -0.172]}>
        <MiniFigure
          spec={{
            height: 0.112,
            detail: 'near',
            hair: 'short',
            outfit: 'apron',
            mats: keeperMats,
          }}
          rigRef={(r) => {
            keeperRig.current = r
          }}
        >
          {/* small round glasses — the detail that makes him recognisable */}
          {[-0.026, 0.026].map((x) => (
            <mesh key={x} geometry={geo.lens} material={wardrobe.steel} position={[x, 0.056, 0.056]} />
          ))}
          <mesh geometry={geo.bridge} material={wardrobe.steel} position={[0, 0.056, 0.058]} />
        </MiniFigure>
      </group>

      {/* ---------------------------------------------------------- posters */}
      {[
        { x: -0.15, y: 0.155, w: 0.05, h: 0.062 },
        { x: 0.03, y: 0.148, w: 0.042, h: 0.056 },
      ].map((p) => (
        <mesh key={p.x} position={[p.x, p.y, -CAV_D + 0.009]} material={mats.poster}>
          <planeGeometry args={[p.w, p.h]} />
        </mesh>
      ))}
      <Sign
        spec={{ text: 'LTR', fg: '#0d0f10', bg: '#c9c2ae', weight: 700 }}
        height={0.014}
        position={[-0.15, 0.128, -CAV_D + 0.01]}
        backing={false}
      />

      {/* ------------------------------------------------ display + sleeves */}
      <mesh position={[WIN_CX, 0.068, -0.056]} material={mats.trim}>
        <boxGeometry args={[WIN_W - 0.01, 0.007, 0.085]} />
      </mesh>
      {RELEASES.map((r, i) => (
        <group key={r.cat}>
          <group
            ref={(g) => {
              sleeves.current[i] = g
            }}
            position={SLEEVE_LOCAL[i]}
            rotation={[-0.13, 0, 0]}
            onPointerOver={(e) => {
              e.stopPropagation()
              if (venue.view === 'releases') venue.hover = i
            }}
            onPointerOut={() => {
              if (venue.hover === i) venue.hover = -1
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (venue.view === 'releases') selectRelease(i)
            }}
          >
            <mesh>
              <boxGeometry args={[0.062, 0.062, 0.004]} />
              <meshStandardMaterial
                ref={(m) => {
                  sleeveMats.current[i] = m
                }}
                map={sleeveTex[i]}
                emissiveMap={sleeveTex[i]}
                emissive="#ffffff"
                emissiveIntensity={0.4}
                color="#2a2a2a"
                roughness={0.7}
              />
            </mesh>
          </group>
          {/* price slip / catalogue label on the deck */}
          <mesh position={[SLEEVE_LOCAL[i][0], 0.0725, -0.026]} rotation={[-Math.PI / 2.4, 0, 0]}>
            <planeGeometry args={[0.026, 0.011]} />
            <meshStandardMaterial
              ref={(m) => {
                slipMats.current[i] = m
              }}
              map={slips[i]}
              emissiveMap={slips[i]}
              emissive="#ffffff"
              emissiveIntensity={0.32}
              color="#1a1a1a"
              roughness={0.8}
            />
          </mesh>
        </group>
      ))}

      {/* ------------------------------------------------------ shop window */}
      {/* stall riser below the glazing */}
      <mesh position={[WIN_CX, WIN_Y0 / 2, -0.008]} material={kitMats.coolConcrete}>
        <boxGeometry args={[WIN_W + 0.012, WIN_Y0, 0.018]} />
      </mesh>
      <Frame x={WIN_CX} y={(WIN_Y0 + WIN_Y1) / 2} w={WIN_W} h={WIN_Y1 - WIN_Y0} z={-0.01} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[WIN_CX + s * (WIN_W / 6), (WIN_Y0 + WIN_Y1) / 2, -0.01]} material={mats.trim}>
          <boxGeometry args={[0.0035, WIN_Y1 - WIN_Y0, 0.012]} />
        </mesh>
      ))}
      {/* the glass itself, plus one soft reflected streak */}
      <mesh position={[WIN_CX, (WIN_Y0 + WIN_Y1) / 2, -0.011]}>
        <planeGeometry args={[WIN_W - 0.004, WIN_Y1 - WIN_Y0 - 0.004]} />
        <meshStandardMaterial
          ref={glass}
          color="#9fb6bd"
          transparent
          opacity={0.2}
          roughness={0.08}
          metalness={0.5}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[WIN_CX, (WIN_Y0 + WIN_Y1) / 2, -0.009]}>
        <planeGeometry args={[WIN_W - 0.004, WIN_Y1 - WIN_Y0 - 0.004]} />
        <meshBasicMaterial map={reflect} transparent opacity={0.16} depthWrite={false} />
      </mesh>
      {/* 営業中 hanging in the window */}
      <Sign
        spec={{ text: '営業中', fg: '#ffd7ec', bg: '#280515', frame: '#FF2C9C' }}
        height={0.02}
        position={[WIN_X0 + 0.036, 0.184, -0.02]}
        backing={false}
        neon
        intensity={1.5}
        materialRef={open}
      />

      {/* -------------------------------------------------- recessed entry */}
      {/* side reveal between window and door */}
      <mesh position={[WIN_X1 + 0.012, 0.107, DOOR_Z / 2]} material={mats.wall}>
        <boxGeometry args={[0.008, 0.215, -DOOR_Z]} />
      </mesh>
      {/* head reveal */}
      <mesh position={[DOOR_X, 0.208, DOOR_Z / 2]} material={mats.wall}>
        <boxGeometry args={[DOOR_W + 0.03, 0.014, -DOOR_Z]} />
      </mesh>
      {/* threshold and the step down to the pavement */}
      <mesh position={[DOOR_X, 0.004, DOOR_Z / 2]} material={kitMats.coolConcrete}>
        <boxGeometry args={[DOOR_W + 0.03, 0.008, -DOOR_Z]} />
      </mesh>
      <mesh position={[DOOR_X, 0.002, 0.022]} material={mats.paving} receiveShadow>
        <boxGeometry args={[DOOR_W + 0.05, 0.005, 0.048]} />
      </mesh>
      {/* glass door with a real handle */}
      <group position={[DOOR_X, 0.1, DOOR_Z]}>
        <Frame x={0} y={0} w={DOOR_W} h={0.19} z={0} />
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[DOOR_W - 0.006, 0.184]} />
          <meshStandardMaterial color="#8fa8b0" transparent opacity={0.22} roughness={0.1} metalness={0.45} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.062, 0.002]} material={mats.trim}>
          <boxGeometry args={[DOOR_W - 0.006, 0.004, 0.004]} />
        </mesh>
        <mesh position={[DOOR_W / 2 - 0.014, -0.006, 0.008]} material={mats.brass}>
          <cylinderGeometry args={[0.0022, 0.0022, 0.05, 8]} />
        </mesh>
      </group>

      {/* ------------------------------------------- façade signs and wear */}
      <Sign
        spec={{ text: '営業時間', fg: '#d6d2c4', bg: '#191c1e' }}
        height={0.017}
        position={[0.213, 0.152, 0.008]}
        backing={false}
      />
      <Sign
        spec={{ text: '18:00 – 26:00', fg: '#b9c2be', bg: '#141719' }}
        height={0.013}
        position={[0.213, 0.128, 0.008]}
        backing={false}
      />
      {/* a bill pasted on the left pier, curling at one corner */}
      <mesh position={[-0.25, 0.14, 0.008]} rotation={[0, 0, 0.03]} material={mats.poster}>
        <planeGeometry args={[0.026, 0.038]} />
      </mesh>
      {/* conduit and a service cable down the right pier, clear of the signs */}
      <mesh position={[0.256, 0.24, 0.01]} material={kitMats.pipe}>
        <boxGeometry args={[0.012, 0.44, 0.01]} />
      </mesh>
      <mesh position={[0.256, 0.3, 0.017]} material={kitMats.agedPlastic}>
        <boxGeometry args={[0.024, 0.03, 0.014]} />
      </mesh>
      {/* restrained damp staining under the sill */}
      <mesh position={[WIN_CX - 0.06, 0.028, 0.001]} material={mats.wear}>
        <planeGeometry args={[0.05, 0.045]} />
      </mesh>

      {/* --------------------------------------------------------- lighting */}
      <pointLight
        ref={interior}
        position={[CX, 0.17, -0.06]}
        color="#ffcf96"
        intensity={0.5}
        distance={0.72}
        decay={2}
        userData={{ driven: true }}
      />
      <pointLight
        ref={accent}
        position={[WIN_CX, 0.12, -0.018]}
        color={RELEASES[0].spill}
        intensity={0.35}
        distance={0.7}
        decay={2}
        userData={{ driven: true }}
      />
      <object3D ref={rimTarget} position={[0, 0.13, 0]} />
      <spotLight
        ref={rim}
        position={[-0.62, 0.42, 0.66]}
        angle={0.55}
        penumbra={0.9}
        intensity={0}
        distance={1.6}
        decay={2}
        color="#ff8fc8"
      />
      <object3D ref={fillTarget} position={[-0.02, 0.24, -0.02]} />
      <spotLight
        ref={fill}
        position={[-0.62, 0.95, 1.15]}
        angle={0.52}
        penumbra={0.92}
        intensity={0}
        /* kept short so it shapes the shop and not the buildings behind it */
        distance={2.15}
        decay={2}
        color="#9db3bb"
      />
    </group>
  )
}
