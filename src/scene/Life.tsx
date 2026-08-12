import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { T1_TOP, T2_TOP, T4_TOP, polar } from './helpers'
import { Revealable } from './Revealable'
import { clamp01, timeline } from './timeline'
import { useReducedMotion } from './useReducedMotion'
import {
  MiniFigure,
  fadingMats,
  faceMaterial,
  poseIdle,
  poseWalk,
  stepLength,
  wardrobe,
  wrapPi,
  type Carry,
  type Detail,
  type Expression,
  type FigureRig,
  type Hair,
  type Outfit,
  type WardrobeKey,
} from './Figures'

/**
 * Living Miniature: apartment silhouettes, street pedestrians and a little
 * road traffic. Everything is driven from one useFrame controller off
 * timeline.lifeT (seconds since the city settled) — no per-frame React state,
 * no extra lights, no shadows.
 *
 * Nothing pops into existence: every figure and vehicle fades up from the
 * dark, and cars drive on and off the ends of the carriageway rather than
 * being teleported around the loop.
 *
 * Scale reference: a train carriage is ~1.29 long, so a car sits near 0.24
 * and a standing pedestrian near 0.115.
 */

const hash = (i: number) => {
  const x = Math.sin(i * 91.7 + 43.1) * 43758.5453
  return x - Math.floor(x)
}
const smooth = (u: number) => u * u * (3 - 2 * u)

/** Position along a there-and-back stroll with dwells at both ends. */
function stroll(t: number, dur: number) {
  const u = ((t % dur) + dur) % dur / dur
  if (u < 0.12) return 0
  if (u < 0.44) return smooth((u - 0.12) / 0.32)
  if (u < 0.62) return 1
  if (u < 0.94) return 1 - smooth((u - 0.62) / 0.32)
  return 0
}

/** Shared bases — cloned per instance so each can fade independently. */
const silhouetteBase = new THREE.MeshBasicMaterial({ color: '#05080a' })
const roomBack = new THREE.MeshBasicMaterial({ color: '#0b1113' })
const partitionMat = new THREE.MeshBasicMaterial({ color: '#0a0f11' })
/* street clothing now comes from the shared wardrobe in Figures.tsx */
const carBodyBase = new THREE.MeshStandardMaterial({ color: '#12191f', roughness: 0.38, metalness: 0.45 })
const carBodyTaxiBase = new THREE.MeshStandardMaterial({ color: '#171e24', roughness: 0.35, metalness: 0.45 })
const carGlassBase = new THREE.MeshStandardMaterial({ color: '#223038', roughness: 0.22, metalness: 0.35 })
const headLampBase = new THREE.MeshStandardMaterial({ color: '#f2f7ef', emissive: '#e9f1ea', emissiveIntensity: 2 })
const tailLampBase = new THREE.MeshStandardMaterial({ color: '#FF2C9C', emissive: '#FF2C9C', emissiveIntensity: 1.6 })
const roofSignBase = new THREE.MeshStandardMaterial({ color: '#20E7FF', emissive: '#20E7FF', emissiveIntensity: 1.1 })
const roomTints = ['#cfd9cf', '#a8ccd6', '#e8bd83', '#c2cfc6']

const fadeable = (m: THREE.Material) => {
  const c = m.clone()
  c.transparent = true
  c.opacity = 0
  c.depthWrite = false
  return c
}

const faceIn = (a: number) => -a - Math.PI / 2
const faceOut = (a: number) => Math.PI / 2 - a

/* ------------------------------------------------------------ apartments */

type RoomMode = 'walk' | 'sit' | 'approach' | 'cross' | 'turn' | 'empty'

type Room = {
  r: number
  a: number
  y: number
  face: 'in' | 'out'
  tint: number
  people: number
  mode: RoomMode
  /** the six clear camera-facing rooms get a larger window and interior */
  big?: boolean
  prop?: 'curtain' | 'desk' | 'none'
}

const ROOMS: Room[] = [
  // six clear, camera-facing rooms on the back slabs and canyon shop upper floors
  { r: 4.4, a: THREE.MathUtils.degToRad(5), y: 0.46, face: 'in', tint: 0, people: 1, mode: 'walk', big: true, prop: 'curtain' },
  { r: 4.4, a: THREE.MathUtils.degToRad(-7), y: 0.62, face: 'in', tint: 1, people: 1, mode: 'approach', big: true, prop: 'none' },
  { r: 4.4, a: THREE.MathUtils.degToRad(-18), y: 0.4, face: 'in', tint: 2, people: 1, mode: 'sit', big: true, prop: 'desk' },
  { r: 4.4, a: THREE.MathUtils.degToRad(-29), y: 0.52, face: 'in', tint: 0, people: 2, mode: 'cross', big: true, prop: 'none' },
  { r: 4.02, a: THREE.MathUtils.degToRad(-12), y: 0.62, face: 'in', tint: 2, people: 1, mode: 'turn', big: true, prop: 'curtain' },
  { r: 4.02, a: THREE.MathUtils.degToRad(-23), y: 0.44, face: 'in', tint: 0, people: 1, mode: 'walk', big: true, prop: 'desk' },
  // four subtler background rooms, two deliberately empty
  { r: 3.24, a: THREE.MathUtils.degToRad(4), y: 0.22, face: 'out', tint: 3, people: 1, mode: 'turn' },
  { r: 3.24, a: THREE.MathUtils.degToRad(-17), y: 0.2, face: 'out', tint: 0, people: 0, mode: 'empty' },
  { r: 2.34, a: THREE.MathUtils.degToRad(-50), y: 0.34, face: 'in', tint: 3, people: 1, mode: 'walk' },
  { r: 2.34, a: THREE.MathUtils.degToRad(-66), y: 0.34, face: 'in', tint: 1, people: 0, mode: 'empty' },
]

/** Window silhouette: head + shoulders + body, ~70% of the window height. */
function FlatPerson({
  big,
  mat,
  innerRef,
}: {
  big?: boolean
  mat: THREE.Material
  innerRef: (g: THREE.Group | null) => void
}) {
  return (
    <group ref={innerRef} visible={false} scale={big ? 1 : 0.78}>
      <mesh position={[0, 0.058, 0]} material={mat}>
        <circleGeometry args={[0.0145, 12]} />
      </mesh>
      <mesh position={[0, 0.026, 0]} material={mat}>
        <planeGeometry args={[0.03, 0.05]} />
      </mesh>
      <mesh position={[0, -0.002, 0]} material={mat}>
        <planeGeometry args={[0.02, 0.02]} />
      </mesh>
    </group>
  )
}

/* ----------------------------------------------------------- pedestrians */

const deg = THREE.MathUtils.degToRad

type Ped = {
  r: number
  a0: number
  a1: number
  y: number
  dur: number
  detail: Detail
  /** standing height in scene units; a train carriage is 1.29 for reference */
  height: number
  build?: number
  hair: Hair
  outfit: Outfit
  carry?: Carry
  face: Expression
  scarf?: boolean
  skin: WardrobeKey
  hairMat: WardrobeKey
  coat: WardrobeKey
  trouser: WardrobeKey
  extra: WardrobeKey
  still?: boolean
  /** head yaw held while paused — a glance at a shop window or down the track */
  glance?: number
  /**
   * Body yaw held while paused, relative to facing the record centre. Walkers
   * travel along the street, which is side-on to every camera, so anyone we
   * want to actually see turns out to the street when they stop.
   */
  pause?: number
}

/**
 * Seven people, each built differently: height, build, hair, coat, pace and
 * expression all vary, so nobody reads as the same figure in another colour.
 * Only the one outside the record shop is ever seen close, so only that one
 * carries the full near-detail body.
 */
const PEDS: Ped[] = [
  // station platform, by the entrance — late, heavy coat, shoulder bag
  {
    r: 4.22, a0: deg(-45), a1: deg(-52), y: T4_TOP + 0.09, dur: 26,
    detail: 'far', height: 0.119, build: 1.06, hair: 'crop', outfit: 'coat', carry: 'bag',
    face: 'tired', skin: 'skinWarm', hairMat: 'hairBlack', coat: 'coatCharcoal',
    trouser: 'trouserDark', extra: 'bag',
  },
  // pavement outside the ramen shop — slowing to read the noren
  {
    r: 3.86, a0: deg(3), a1: deg(-0.5), y: T4_TOP, dur: 21,
    detail: 'mid', height: 0.112, build: 1.04, hair: 'short', outfit: 'jacket',
    face: 'curious', skin: 'skinPale', hairMat: 'hairBrown', coat: 'coatOlive',
    trouser: 'trouserGrey', extra: 'accentGreen', glance: -1.15,
  },
  // outside Last Train Records — the one the venue camera walks up to
  {
    r: 3.86, a0: deg(8), a1: deg(12.5), y: T4_TOP, dur: 30,
    /* no hair: she is the only figure the camera ever gets close to, and the
       long shell distorted against the head as she turned */
    detail: 'near', height: 0.114, build: 0.97, hair: 'none', outfit: 'coat', carry: 'bag',
    face: 'curious', scarf: true, skin: 'skinPale', hairMat: 'hairBlack',
    coat: 'coatNavy', trouser: 'trouserDark', extra: 'accentMagenta',
    pause: 0.12, glance: -0.12,
  },
  // waiting at the level crossing, watching down the track
  {
    r: 3.3, a0: deg(-2.5), a1: deg(-2.5), y: T2_TOP, dur: 1,
    detail: 'mid', height: 0.109, hair: 'cap', outfit: 'jacket',
    face: 'tired', skin: 'skinWarm', hairMat: 'hairBlack', coat: 'coatRust',
    trouser: 'trouserDark', extra: 'coatCharcoal', still: true, glance: 0.9,
  },
  // under the footbridge — a student on the way home
  {
    r: 3.86, a0: deg(-7), a1: deg(-10.5), y: T4_TOP, dur: 24,
    detail: 'mid', height: 0.103, build: 0.9, hair: 'tied', outfit: 'coat', carry: 'pack',
    face: 'subdued', skin: 'skinPale', hairMat: 'hairBrown', coat: 'coatIvory',
    trouser: 'trouserGrey', extra: 'bag',
  },
  // a pair passing each other on the inner shopping street: one talking...
  {
    r: 2.26, a0: deg(-54), a1: deg(-68), y: T1_TOP, dur: 34,
    detail: 'far', height: 0.117, build: 1.02, hair: 'short', outfit: 'jacket',
    face: 'talking', skin: 'skinWarm', hairMat: 'hairBlack', coat: 'coatCharcoal',
    trouser: 'trouserGrey', extra: 'accentCyan',
  },
  // ...and one listening, smiling
  {
    r: 2.31, a0: deg(-68), a1: deg(-54), y: T1_TOP, dur: 34,
    detail: 'far', height: 0.107, build: 0.93, hair: 'bob', outfit: 'skirt',
    face: 'welcome', scarf: true, skin: 'skinPale', hairMat: 'hairBrown',
    coat: 'coatNavy', trouser: 'trouserDark', extra: 'accentCyan',
  },
]

/* -------------------------------------------------------------- vehicles */

type Car = { start: number; speed: number; kind: 'taxi' | 'van' | 'car' }
const ROAD_R = 2.97
const ROAD_HI = THREE.MathUtils.degToRad(24)
const ROAD_LO = THREE.MathUtils.degToRad(-114)
const CROSS_A = THREE.MathUtils.degToRad(-3)
/** arc over which a car fades up on entry / away at the far end */
const CAR_FADE = 0.2

const CARS: Car[] = [
  { start: THREE.MathUtils.degToRad(-18), speed: 0.05, kind: 'taxi' },
  { start: THREE.MathUtils.degToRad(-62), speed: 0.038, kind: 'van' },
  { start: THREE.MathUtils.degToRad(-96), speed: 0.06, kind: 'car' },
]

const CAR_SPEC = {
  car: { L: 0.23, W: 0.098, H: 0.066 },
  taxi: { L: 0.245, W: 0.1, H: 0.072 },
  van: { L: 0.285, W: 0.104, H: 0.094 },
} as const

type CarMats = {
  body: THREE.Material
  glass: THREE.Material
  head: THREE.Material
  tail: THREE.Material
  sign: THREE.Material
  wheel: THREE.Material
  all: THREE.Material[]
}

function makeCarMats(kind: Car['kind']): CarMats {
  const body = fadeable(kind === 'taxi' ? carBodyTaxiBase : carBodyBase)
  const glass = fadeable(carGlassBase)
  const head = fadeable(headLampBase)
  const tail = fadeable(tailLampBase)
  const sign = fadeable(roofSignBase)
  const wheel = fadeable(silhouetteBase)
  return { body, glass, head, tail, sign, wheel, all: [body, glass, head, tail, sign, wheel] }
}

function Vehicle({
  kind,
  mats,
  innerRef,
}: {
  kind: Car['kind']
  mats: CarMats
  innerRef: (g: THREE.Group | null) => void
}) {
  const { L, W, H } = CAR_SPEC[kind]
  const cabin = kind === 'van' ? L * 0.42 : L * 0.5
  const cabinX = kind === 'van' ? L * 0.16 : 0
  return (
    <group ref={innerRef} visible={false}>
      <mesh position={[0, H / 2 + 0.008, 0]} material={mats.body}>
        <boxGeometry args={[L, H, W]} />
      </mesh>
      <mesh position={[cabinX, H + 0.022, 0]} material={mats.glass}>
        <boxGeometry args={[cabin, 0.036, W * 0.88]} />
      </mesh>
      {kind === 'van' && (
        <mesh position={[-L * 0.22, H + 0.03, 0]} material={mats.body}>
          <boxGeometry args={[L * 0.52, 0.05, W * 0.96]} />
        </mesh>
      )}
      {kind === 'taxi' && (
        <mesh position={[cabinX, H + 0.05, 0]} material={mats.sign}>
          <boxGeometry args={[0.04, 0.016, 0.026]} />
        </mesh>
      )}
      {[-W * 0.33, W * 0.33].map((z) => (
        <mesh key={`h${z}`} position={[L / 2 - 0.004, H * 0.55, z]} material={mats.head}>
          <boxGeometry args={[0.008, 0.014, 0.02]} />
        </mesh>
      ))}
      {[-W * 0.33, W * 0.33].map((z) => (
        <mesh key={`t${z}`} position={[-L / 2 + 0.004, H * 0.6, z]} material={mats.tail}>
          <boxGeometry args={[0.006, 0.011, 0.018]} />
        </mesh>
      ))}
      {[-L * 0.3, L * 0.3].map((x) =>
        [-W * 0.5, W * 0.5].map((z) => (
          <mesh key={`w${x}${z}`} position={[x, 0.014, z]} rotation={[Math.PI / 2, 0, 0]} material={mats.wheel}>
            <cylinderGeometry args={[0.016, 0.016, 0.012, 8]} />
          </mesh>
        )),
      )}
    </group>
  )
}

/* ------------------------------------------------------------------ life */

export function Life() {
  const reduced = useReducedMotion()
  const roomPeople = useRef<(THREE.Group | null)[]>([])
  const peds = useRef<(THREE.Group | null)[]>([])
  const cars = useRef<(THREE.Group | null)[]>([])
  /** integrated car angle, so nothing ever teleports mid-view */
  const carA = useRef<number[]>(CARS.map((c) => c.start))

  const roomPersonIndex = useMemo(() => {
    let n = 0
    return ROOMS.map((room) => {
      const start = n
      n += room.people
      return start
    })
  }, [])

  const roomMats = useMemo(() => {
    const total = ROOMS.reduce((n, r) => n + r.people, 0)
    return Array.from({ length: total }, () => fadeable(silhouetteBase))
  }, [])
  const pedRigs = useRef<(FigureRig | null)[]>([])
  /** metres walked, so the legs turn over at the speed the body moves */
  const pedStride = useRef<number[]>(PEDS.map(() => 0))
  /** last frame's angle and the direction that movement implied */
  const pedPrevA = useRef<(number | undefined)[]>(PEDS.map(() => undefined))
  const pedDir = useRef<number[]>(PEDS.map((p) => (p.a1 >= p.a0 ? 1 : -1)))

  const pedMats = useMemo(
    () =>
      PEDS.map((p) =>
        fadingMats({
          skin: wardrobe[p.skin],
          hair: wardrobe[p.hairMat],
          coat: wardrobe[p.coat],
          trouser: wardrobe[p.trouser],
          shoe: wardrobe.shoe,
          extra: wardrobe[p.extra],
          face: p.detail === 'far' ? undefined : faceMaterial(p.face),
        }),
      ),
    [],
  )
  const carMats = useMemo(() => CARS.map((c) => makeCarMats(c.kind)), [])

  useFrame((_, delta) => {
    const lt = timeline.lifeT
    const alive = timeline.mode === 'done'
    const dt = Math.min(delta, 0.05)

    // apartment silhouettes
    ROOMS.forEach((room, ri) => {
      for (let p = 0; p < room.people; p++) {
        const idx = roomPersonIndex[ri] + p
        const g = roomPeople.current[idx]
        const mat = roomMats[idx]
        if (!g || !mat) continue
        const seed = hash(ri * 7 + p * 3)
        const appear = 0.4 + seed * 1.6
        const fade = alive ? clamp01((lt - appear) / 1.1) : 0
        mat.opacity = smooth(fade)
        g.visible = fade > 0.002
        if (!g.visible) continue
        const span = room.big ? 0.05 : 0.038
        const baseScale = room.big ? 1 : 0.78
        if (reduced) {
          g.position.x = (seed - 0.5) * span
          g.scale.y = baseScale * (room.mode === 'sit' ? 0.7 : 1)
          continue
        }
        const dur = 16 + seed * 18
        const t = lt + seed * 40
        g.scale.y = baseScale
        switch (room.mode) {
          case 'sit': {
            const s = stroll(t, dur * 1.6)
            g.position.x = (seed - 0.5) * span * 0.5
            g.scale.y = baseScale * (0.7 + 0.3 * s)
            break
          }
          case 'cross':
            g.position.x = (p === 0 ? stroll(t, dur) - 0.5 : 0.5 - stroll(t, dur)) * span * 1.9
            break
          case 'walk':
            g.position.x = (stroll(t, dur) - 0.5) * span * 1.9
            break
          case 'approach': {
            const s = stroll(t, dur * 1.3)
            g.position.x = (seed - 0.5) * span * 0.4
            g.position.z = 0.012 * s
            g.scale.y = baseScale * (1 + 0.12 * s)
            break
          }
          default: {
            const s = stroll(t, dur * 1.5)
            g.position.x = (seed - 0.5) * span * 0.4
            g.scale.x = baseScale * (1 - 0.55 * s)
            break
          }
        }
      }
    })

    // pedestrians
    PEDS.forEach((ped, i) => {
      const g = peds.current[i]
      const mats = pedMats[i]
      if (!g || !mats) return
      const seed = hash(i * 13 + 5)
      const appear = 0.6 + seed * 1.4
      const fade = alive ? smooth(clamp01((lt - appear) / 1.0)) : 0
      for (const m of mats.all) m.opacity = fade
      g.visible = fade > 0.002
      if (!g.visible) return

      // where along the walk, and how fast
      const span = ped.a1 - ped.a0
      let a = ped.a0
      let speed = 0
      let soon = 0
      let here = 0
      if (!reduced && !ped.still) {
        const t = lt + seed * 50
        here = stroll(t, ped.dur)
        const ahead = stroll(t + 0.1, ped.dur)
        soon = stroll(t + 0.7, ped.dur)
        a = ped.a0 + span * here
        speed = (Math.abs(ahead - here) * Math.abs(span) * ped.r) / 0.1
      }
      g.position.set(...polar(ped.r, a, ped.y))

      /*
       * Which way they are facing comes from the movement that actually
       * happened between frames, not from how the route was authored — the
       * route runs there and back, so a fixed heading meant walking backwards
       * for half of every loop. While they are standing still we look a beat
       * ahead instead, so the turn happens during the pause rather than after
       * they have set off.
       */
      const prev = pedPrevA.current[i]
      const da = prev === undefined ? 0 : a - prev
      pedPrevA.current[i] = a
      if (Math.abs(da) > 1e-5) pedDir.current[i] = Math.sign(da)
      else if (Math.abs(soon - here) > 1e-4) pedDir.current[i] = Math.sign((soon - here) * span)
      // standing, and still standing a beat from now: free to turn and look
      const resting = speed < 1e-4 && Math.abs(soon - here) < 1e-4
      const heading =
        resting && ped.pause !== undefined
          ? faceIn(a) + ped.pause
          : pedDir.current[i] > 0
            ? -a
            : -a + Math.PI

      let align = 1
      if (ped.still) {
        g.rotation.y = faceIn(ped.a0) + 0.5
      } else if (prev === undefined) {
        g.rotation.y = heading // first frame: face the right way immediately
      } else {
        // turn the whole body the short way round, at a walking-pace rate
        const diff = wrapPi(heading - g.rotation.y)
        g.rotation.y = wrapPi(g.rotation.y + Math.sign(diff) * Math.min(Math.abs(diff), 5 * dt))
        align = clamp01(1 - Math.abs(diff) / 0.55)
      }

      // legs only cycle once the body is substantially facing the new way,
      // so nobody strides sideways through a turnaround
      const move = clamp01(speed / 0.028) * align
      pedStride.current[i] += speed * dt * align
      if (reduced) {
        poseIdle(pedRigs.current[i], 0, seed, 0)
      } else if (move > 0.06) {
        const phase = (pedStride.current[i] / stepLength(ped.height)) * Math.PI
        poseWalk(pedRigs.current[i], phase, move, lt, seed)
      } else {
        // stopped or turning: hold a glance at whatever they paused for
        poseIdle(pedRigs.current[i], lt, seed, ped.glance ?? 0)
      }
    })

    // vehicles — integrated along the carriageway, fading on and off its ends
    CARS.forEach((car, i) => {
      const g = cars.current[i]
      const mats = carMats[i]
      if (!g || !mats) return

      if (!alive) {
        // parked off-scene until the city settles; reset for replay
        carA.current[i] = car.start
        for (const m of mats.all) m.opacity = 0
        g.visible = false
        return
      }

      let a = carA.current[i]
      if (!reduced) {
        // ease off approaching the level crossing while its lamps are lit
        let rate = 1
        if (a > CROSS_A && Math.sin((lt + hash(i * 29 + 11) * 10) * 0.35) > 0.4) {
          rate = clamp01((a - CROSS_A - 0.02) / 0.1)
        }
        a -= car.speed * rate * dt
        if (a <= ROAD_LO) a = ROAD_HI
        carA.current[i] = a
      }

      // graceful arrival: fade up entering the road, fade away at the far end
      const entry = clamp01((ROAD_HI - a) / CAR_FADE)
      const exit = clamp01((a - ROAD_LO) / CAR_FADE)
      const stagger = clamp01((lt - (1.0 + hash(i * 29 + 11))) / 1.2)
      const o = smooth(Math.min(entry, exit)) * smooth(stagger)
      for (const m of mats.all) m.opacity = o
      g.visible = o > 0.002
      g.position.set(...polar(ROAD_R, a, T2_TOP))
      g.rotation.y = -a - Math.PI / 2
    })
  })

  return (
    <group>
      {/* lit rooms with silhouettes */}
      {ROOMS.map((room, ri) => {
        const w = room.big ? 0.15 : 0.105
        const h = room.big ? 0.125 : 0.1
        return (
          <Revealable key={ri} a={room.a} lead={0.95} dur={0.2}>
            <group
              position={polar(room.r, room.a, room.y)}
              rotation={[0, room.face === 'in' ? faceIn(room.a) : faceOut(room.a), 0]}
            >
              {/* dark reveal around the opening, deepest layer */}
              <mesh position={[0, h * 0.44, -0.03]} material={roomBack}>
                <planeGeometry args={[w + 0.022, h + 0.022]} />
              </mesh>
              {/* lit rear wall, set back so figures read as being inside */}
              <mesh position={[0, h * 0.44, -0.026]}>
                <planeGeometry args={[w, h]} />
                <meshBasicMaterial color={roomTints[room.tint]} />
              </mesh>
              {room.prop === 'curtain' && (
                <mesh position={[-w * 0.38, h * 0.44, -0.016]} material={partitionMat}>
                  <planeGeometry args={[w * 0.2, h * 0.88]} />
                </mesh>
              )}
              {room.prop === 'desk' && (
                <mesh position={[w * 0.22, h * 0.14, -0.016]} material={partitionMat}>
                  <planeGeometry args={[w * 0.42, h * 0.22]} />
                </mesh>
              )}
              {Array.from({ length: room.people }, (_, p) => {
                const idx = roomPersonIndex[ri] + p
                return (
                  <group key={p} position={[0, 0, -0.005]}>
                    <FlatPerson
                      big={room.big}
                      mat={roomMats[idx]}
                      innerRef={(g) => {
                        roomPeople.current[idx] = g
                      }}
                    />
                  </group>
                )
              })}
            </group>
          </Revealable>
        )
      })}

      {/* pedestrians — ~0.11 tall, model-railway figures */}
      {PEDS.map((ped, i) => (
        <group
          key={i}
          ref={(g) => {
            peds.current[i] = g
          }}
          visible={false}
        >
          <MiniFigure
            spec={{
              height: ped.height,
              build: ped.build,
              detail: ped.detail,
              hair: ped.hair,
              outfit: ped.outfit,
              carry: ped.carry,
              scarf: ped.scarf,
              mats: pedMats[i].mats,
            }}
            rigRef={(r) => {
              pedRigs.current[i] = r
            }}
          />
        </group>
      ))}

      {/* road traffic */}
      {CARS.map((car, i) => (
        <Vehicle
          key={i}
          kind={car.kind}
          mats={carMats[i]}
          innerRef={(g) => {
            cars.current[i] = g
          }}
        />
      ))}
    </group>
  )
}
