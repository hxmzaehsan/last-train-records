import { Suspense, forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  ContactShadows,
  Environment,
  Lightformer,
  PerspectiveCamera,
} from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { Turntable } from './Turntable'
import { VinylRecord } from './VinylRecord'
import { Tonearm } from './Tonearm'
import { City } from './City'
import {
  RESET_SECONDS,
  RUN_SECONDS,
  RUN_SECONDS_REDUCED,
  buildProgress,
  cameraProgress,
  clamp01,
  resetTimeline,
  rotationTheta,
  startTimeline,
  timeline,
} from './timeline'
import { useReducedMotion } from './useReducedMotion'
import { AudioDriver } from '../audio/AudioDriver'
import { audioReset, audioStart } from '../audio/cues'
import type { HeroPhase } from '../hero/phase'
import {
  ENTER_SECONDS,
  ENTER_SECONDS_REDUCED,
  LEAVE_SECONDS,
  LEAVE_SECONDS_REDUCED,
  SHOP_ANCHOR,
  SHOP_ANCHOR_TOP,
  SLEEVE_LOCAL,
  VENUE_C1,
  VENUE_C2,
  type VenueId,
  type VenueView,
  endVenue,
  screen,
  shopPoint,
  startVenue,
  venue,
  venueMoving,
  venuePose,
  venueProgress,
} from './venue'

export type SceneHandle = {
  /** Activate from standby, or ease the settled hero back to standby. */
  toggle: () => void
  /** Fly the camera into a venue. Refused unless the city has settled. */
  openVenue: (id: VenueId) => boolean
  /** Fly back to the approved hero frame. */
  closeVenue: () => boolean
}

const TAN_HALF_FOV = Math.tan(THREE.MathUtils.degToRad(33) / 2)
const HERO_FOV = 33

/**
 * Cranes the real camera from a bird's-eye view of the centre label out to the
 * approved Stage 3.2B hero composition, driven by the shared timeline.
 */
function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)

  const poses = useMemo(() => {
    const aspect = size.width / size.height
    const k = aspect < 0.9 ? 1.5 : aspect < 1.25 ? 1.22 : 1
    // overhead height that frames the label plus a little groove texture,
    // limited by whichever screen axis is narrower
    const h = 2.35 / (TAN_HALF_FOV * Math.min(1, aspect))
    return {
      standbyPos: new THREE.Vector3(0, h, 0.36),
      standbyTarget: new THREE.Vector3(0, 0.1, 0),
      heroPos: new THREE.Vector3(-2.35 * k, 4.15 * k, 6.9 * k),
      heroTarget: new THREE.Vector3(1.32, 0.36, -0.38),
      venue: venuePose(aspect),
    }
  }, [size])

  const pos = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  const city = useMemo(() => new THREE.Vector3(), [])

  useLayoutEffect(() => {
    invalidate()
  }, [poses, invalidate])

  useFrame(() => {
    const c = cameraProgress(timeline.t)
    pos.lerpVectors(poses.standbyPos, poses.heroPos, c)
    // a gentle crane arc so the move never feels like a straight slide
    pos.y += Math.sin(Math.PI * c) * 0.55
    target.lerpVectors(poses.standbyTarget, poses.heroTarget, c)

    // venue blend: the same rig carries the camera into the shop and back,
    // so returning always lands on exactly the pose above.
    const v = venueProgress()
    if (v > 0) {
      city.copy(pos)
      const vp = poses.venue
      if (venue.reduced) {
        // reduced motion: a short, direct interpolation, no canyon run
        pos.lerpVectors(city, vp.pos, v)
      } else {
        // a curated approach: out of the hero angle, over the canyon mouth,
        // down the street and level with the storefront
        const s = v
        const m = 1 - s
        const b0 = m * m * m
        const b1 = 3 * m * m * s
        const b2 = 3 * m * s * s
        const b3 = s * s * s
        pos.set(
          b0 * city.x + b1 * VENUE_C1.x + b2 * VENUE_C2.x + b3 * vp.pos.x,
          b0 * city.y + b1 * VENUE_C1.y + b2 * VENUE_C2.y + b3 * vp.pos.y,
          b0 * city.z + b1 * VENUE_C1.z + b2 * VENUE_C2.z + b3 * vp.pos.z,
        )
      }
      target.lerp(vp.target, v)
    }

    const fov = THREE.MathUtils.lerp(HERO_FOV, poses.venue.fov, v)
    if (Math.abs(camera.fov - fov) > 0.001) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    camera.position.copy(pos)
    camera.lookAt(target)
  })

  return null
}

/**
 * Advances the venue camera on wall-clock time and reports the settled view
 * back to React. Construction and venue moves can never overlap: a venue only
 * opens from `done`, and replay is refused while a venue is open.
 */
function VenueDriver({ onView }: { onView: (v: VenueView) => void }) {
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const now = state.clock.elapsedTime

    // the shop only answers while it is actually reachable
    if (timeline.mode !== 'done' || venue.view !== 'city') venue.hotTarget = 0
    venue.hot += (venue.hotTarget - venue.hot) * (1 - Math.pow(0.0025, dt))

    if (!venueMoving()) return
    if (venue.anchor < 0) venue.anchor = now
    const entering = venue.view === 'entering-releases'
    const duration = venue.reduced
      ? entering
        ? ENTER_SECONDS_REDUCED
        : LEAVE_SECONDS_REDUCED
      : entering
        ? ENTER_SECONDS
        : LEAVE_SECONDS
    const k = clamp01((now - venue.anchor) / duration)
    venue.p = entering ? venue.from + (1 - venue.from) * k : venue.from * (1 - k)
    if (k >= 1) {
      venue.p = entering ? 1 : 0
      venue.view = entering ? 'releases' : 'city'
      venue.anchor = -1
      onView(venue.view)
    }
  })
  return null
}

/**
 * Writes the shop's and the sleeves' screen positions every frame so the DOM
 * controls stay glued to the real geometry — that is what makes the building
 * itself keyboard-reachable rather than a mouse-only raycast.
 */
function Projector() {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const setDpr = useThree((s) => s.setDpr)
  const size = useThree((s) => s.size)
  /* dev handles, same spirit as __tl / __venue: the preview has no inspector */
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    Object.assign(window, { __cam: camera, __scene: scene, __gl: gl, __setDpr: setDpr })
  }
  const a = useMemo(() => new THREE.Vector3(), [])
  const b = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const shopOn = timeline.mode === 'done' && venue.view === 'city'
    screen.shop.on = shopOn
    if (shopOn) {
      shopPoint(...SHOP_ANCHOR, a).project(camera)
      shopPoint(...SHOP_ANCHOR_TOP, b).project(camera)
      screen.shop.x = (a.x * 0.5 + 0.5) * size.width
      screen.shop.y = (-a.y * 0.5 + 0.5) * size.height
      screen.shop.s = Math.abs((a.y - b.y) * 0.5 * size.height)
      screen.shop.on = a.z < 1
    }

    const sleevesOn = venue.view === 'releases'
    for (let i = 0; i < 3; i++) {
      const s = screen.sleeves[i]
      s.on = sleevesOn
      if (!sleevesOn) continue
      const [x, y, z] = SLEEVE_LOCAL[i]
      shopPoint(x, y, z, a).project(camera)
      shopPoint(x, y + 0.062, z, b).project(camera)
      s.x = (a.x * 0.5 + 0.5) * size.width
      s.y = (-a.y * 0.5 + 0.5) * size.height
      s.s = Math.abs((a.y - b.y) * 0.5 * size.height)
      s.on = a.z < 1
    }
  })
  return null
}

/**
 * Every material compiles its shader the first time it is drawn. With ~160
 * programs appearing as the city rises, that compilation lands *inside* the
 * entrance and reads as a stutter. Compiling the whole scene up front moves
 * the cost behind the loading screen, where a pause is invisible — the hero
 * only reports itself ready once this is done.
 */
function Precompile({ onDone }: { onDone: () => void }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  useLayoutEffect(() => {
    let cancelled = false
    const finish = () => {
      if (!cancelled) onDone()
    }
    // never let a failed or slow compile strand the loader
    const safety = window.setTimeout(finish, 4000)
    const done = () => {
      window.clearTimeout(safety)
      finish()
    }
    /*
     * Compiling programs is only half of it: this city's signage, sleeves and
     * painted faces are canvas textures, and each one uploads to the GPU the
     * first time its material is drawn. Left alone that lands between 4 s and
     * 7 s — exactly as the buildings rise. Uploading them here instead costs
     * nothing visible behind the loader.
     */
    const uploadTextures = () => {
      const seen = new Set<THREE.Texture>()
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.material) return
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const mat of mats) {
          for (const value of Object.values(mat as unknown as Record<string, unknown>)) {
            if (value && (value as THREE.Texture).isTexture && !seen.has(value as THREE.Texture)) {
              seen.add(value as THREE.Texture)
              try {
                gl.initTexture(value as THREE.Texture)
              } catch {
                /* a texture that cannot be pre-uploaded just uploads later */
              }
            }
          }
        }
      })
    }

    /*
     * Every building is hidden until the needle reaches it, and a hidden
     * object's geometry has never been near the GPU. Showing the whole city
     * for one off-screen frame uploads all of it at once; without this the
     * buffers arrive one district at a time, mid-rise.
     */
    const hidden: THREE.Object3D[] = []
    scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o)
        o.visible = true
      }
    })

    const settle = () => {
      uploadTextures()
      try {
        gl.render(scene, camera)
      } catch {
        /* a failed warm-up render only costs us the optimisation */
      }
      for (const o of hidden) o.visible = false
      done()
    }

    const async = (gl as THREE.WebGLRenderer & {
      compileAsync?: (s: THREE.Scene, c: THREE.Camera) => Promise<unknown>
    }).compileAsync
    if (async) {
      async.call(gl, scene, camera).then(settle, settle)
    } else {
      gl.compile(scene, camera)
      settle()
    }
    return () => {
      cancelled = true
      window.clearTimeout(safety)
    }
  }, [gl, scene, camera, onDone])

  return null
}

/** Advances the shared timeline and rotates the world under the fixed needle. */
function TimelineDriver({
  world,
  onDone,
  onStandby,
}: {
  world: React.RefObject<THREE.Group | null>
  onDone: () => void
  onStandby: () => void
}) {
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const now = state.clock.elapsedTime
    const running = timeline.mode === 'playing' || timeline.mode === 'resetting'

    // Wall-clock driven, so the entrance always takes the same real time even
    // if individual frames render slowly. `paused` is a dev aid: it holds the
    // pose by sliding the anchor forward.
    if (running && timeline.anchor < 0) timeline.anchor = now
    if (running && timeline.paused) timeline.anchor += dt

    if (timeline.mode === 'playing' && !timeline.paused) {
      const duration = timeline.reduced ? RUN_SECONDS_REDUCED : RUN_SECONDS
      timeline.t = clamp01((now - timeline.anchor) / duration)
      timeline.u = buildProgress(timeline.t)
      timeline.theta = rotationTheta(timeline.u)
      if (timeline.t >= 1 && !timeline.notified) {
        timeline.notified = true
        timeline.mode = 'done'
        onDone()
      }
    } else if (timeline.mode === 'resetting' && !timeline.paused) {
      const p = clamp01((now - timeline.anchor) / RESET_SECONDS)
      timeline.t = timeline.anchorT * (1 - p)
      timeline.u = buildProgress(timeline.t)
      timeline.theta = rotationTheta(timeline.u)
      if (p >= 1) {
        timeline.mode = 'idle'
        timeline.t = 0
        timeline.u = 0
        timeline.theta = 0
        timeline.anchor = -1
        onStandby()
      }
    }

    if (timeline.mode === 'done') timeline.lifeT += dt
    if (world.current) world.current.rotation.y = -timeline.theta
  })
  return null
}

/**
 * Cinematic lighting: one shaped key aimed into the city, a grazing rim that
 * only catches vertical planes and roof edges, and a single warm island over
 * the inner alley. Readability comes from the material hierarchy — the lights
 * are here to sculpt, not to fill.
 */
function Lights() {
  const key = useRef<THREE.SpotLight>(null)
  const roofRim = useRef<THREE.SpotLight>(null)
  const backLeft = useRef<THREE.SpotLight>(null)

  useLayoutEffect(() => {
    const aim = (l: THREE.SpotLight | null, x: number, y: number, z: number) => {
      if (!l) return
      l.target.position.set(x, y, z)
      l.target.updateMatrixWorld()
    }
    // key: into the middle/foreground rows, stopping short of the deck
    aim(key.current, 2.6, 0.3, -0.3)
    // rim: only the upper edges and side planes of the canyon row
    aim(roofRim.current, 2.4, 0.7, -1.2)
    // back-left: reveals that cluster's silhouettes and planes
    aim(backLeft.current, -0.2, 0.5, -3.0)
  }, [])

  // The rim and back-left lights shape architecture, so they belong to the
  // city: they stay off over the empty record and rise as it is built.
  useFrame(() => {
    const g =
      timeline.mode === 'idle' ? 0 : timeline.mode === 'done' ? 1 : clamp01((timeline.t - 0.2) / 0.5)
    if (roofRim.current) roofRim.current.intensity = 18 * g
    if (backLeft.current) backLeft.current.intensity = 38 * g
  })

  return (
    <>
      {/* cool charcoal base — just enough that shadows aren't dead */}
      <ambientLight intensity={0.13} color="#121416" />
      {/* shaped architectural key: narrow cone, soft edge, real falloff */}
      <spotLight
        ref={key}
        position={[-2.2, 7.2, 5.4]}
        angle={0.34}
        penumbra={0.92}
        intensity={112}
        decay={2}
        distance={13.5}
        color="#e6e9e4"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.00035}
        shadow-normalBias={0.02}
      />
      {/* roofline rim — an aimed cone, so it edges the canyon's upper planes
          and never spills onto the deck the way a directional did */}
      <spotLight
        ref={roofRim}
        position={[6.5, 3.2, -5.0]}
        angle={0.45}
        penumbra={0.9}
        intensity={0}
        decay={2}
        distance={11}
        color="#9fa9ad"
      />
      {/* low backlight behind the back-left cluster: rims its skyline and
          rooflines without filling the façades or reaching the record */}
      <spotLight
        ref={backLeft}
        position={[-5.5, 2.2, -6.5]}
        angle={0.55}
        penumbra={0.95}
        intensity={0}
        decay={2}
        distance={15}
        color="#a6aeb2"
      />
      {/* deep blue-grey fill so shadows read cool, not dead black */}
      <directionalLight position={[-6, 3, -8]} intensity={0.35} color="#232628" />
      <StandbyLight />
    </>
  )
}

/**
 * Standby only: a soft frontal light that lets the groove relief and label
 * read from directly overhead. It fades out as the camera cranes away, so the
 * approved settled lighting is untouched.
 */
function StandbyLight() {
  const l = useRef<THREE.PointLight>(null)
  useFrame(() => {
    if (!l.current) return
    l.current.intensity = 17 * (1 - cameraProgress(timeline.t))
  })
  return (
    <pointLight ref={l} position={[0.4, 6.6, 1.1]} intensity={17} decay={2} distance={15} color="#c4cdc9" />
  )
}

function Room() {
  return (
    <>
      {/* bar table */}
      <mesh position={[0.9, -1.98, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[90, 60]} />
        <meshStandardMaterial color="#050607" roughness={0.68} metalness={0.05} />
      </mesh>
      <ContactShadows
        position={[0.9, -1.96, 0]}
        scale={32}
        blur={2.6}
        far={4.5}
        opacity={0.75}
        frames={1}
      />
    </>
  )
}

type SceneProps = {
  onReady: () => void
  onPhase: (phase: HeroPhase) => void
  onView: (view: VenueView) => void
}

/**
 * The real-time hero: everything pressed from the vinyl — record, terraces,
 * city and train — lives in one rotating world group. The turntable body and
 * tonearm stay fixed; the stylus is the construction point.
 */
/**
 * Pick a device pixel ratio from a *fragment budget* rather than a fixed cap.
 *
 * The canyon carries around twenty small neon lights and every surface is a
 * MeshStandardMaterial, so each fragment pays for all of them: measured on an
 * M4 Max, the lights alone are 5 ms of an 8.3 ms frame. That makes cost scale
 * with total pixels, not with how sharp the screen is — a fixed ratio that
 * feels fine in a small window turns a full-screen 4K one into a slideshow.
 *
 * Budgeting pixels instead keeps the frame at roughly the same cost on every
 * display: small windows get a crisp ratio, very large ones quietly render
 * softer rather than dropping frames.
 *
 * This is read once, at mount, and that is deliberate — the postprocessing
 * composer allocates its render targets from the ratio it is built with and
 * does not rebuild them when the ratio changes later. Lowering the ratio at
 * runtime shrinks the canvas but not the buffers, which measured *slower*
 * (the scene still renders large, then gets scaled down).
 */
const PIXEL_BUDGET = 1_500_000

function chooseDpr() {
  if (typeof window === 'undefined') return 1
  const css = window.innerWidth * window.innerHeight
  const native = Math.min(window.devicePixelRatio || 1, 1.5)
  if (!css) return native
  return Math.max(0.75, Math.min(native, Math.sqrt(PIXEL_BUDGET / css)))
}

export const Scene = forwardRef<SceneHandle, SceneProps>(function Scene(
  { onReady, onPhase, onView },
  ref,
) {
  const world = useRef<THREE.Group>(null)
  const reduced = useReducedMotion()
  const dpr = useMemo(chooseDpr, [])

  useImperativeHandle(
    ref,
    () => ({
      toggle: () => {
        if (timeline.mode === 'playing' || timeline.mode === 'resetting') return
        // replay belongs to the city; inside a venue the control is Back
        if (venue.view !== 'city') return
        if (timeline.mode === 'done') {
          resetTimeline()
          audioReset()
          // the interface stays in its own resetting state until the scene
          // has finished rewinding — onStandby() flips it to idle
          onPhase('resetting')
          return
        }
        startTimeline(reduced)
        // this click is the gesture the browser needs, so the audio context
        // is created here and nowhere earlier
        audioStart(reduced)
        onPhase('playing')
      },
      openVenue: () => {
        // only from a settled city, and never on top of a move already running
        if (timeline.mode !== 'done' || venue.view !== 'city') return false
        startVenue(reduced)
        onView('entering-releases')
        return true
      },
      closeVenue: () => {
        if (venue.view !== 'releases') return false
        endVenue(reduced)
        onView('leaving-releases')
        return true
      },
    }),
    [reduced, onPhase, onView],
  )

  return (
    <Canvas
      shadows
      frameloop="always"
      dpr={dpr}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.0
      }}
    >
      <PerspectiveCamera makeDefault fov={33} position={[-2.75, 4.7, 7.35]} />
      <CameraRig />
      <TimelineDriver world={world} onDone={() => onPhase('done')} onStandby={() => onPhase('idle')} />
      <VenueDriver onView={onView} />
      <AudioDriver />
      <Projector />
      <color attach="background" args={['#050607']} />
      <fogExp2 attach="fog" args={['#050608', 0.014]} />
      <Suspense fallback={null}>
        <Lights />
        <Environment resolution={128} frames={1}>
          <Lightformer intensity={0.78} color="#d8dcd8" position={[0, 4.6, -6.5]} scale={[9, 1.6, 1]} />
          <Lightformer intensity={0.25} color="#20E7FF" position={[-6, 2, 2]} rotation-y={Math.PI / 2} scale={[2, 0.8, 1]} />
          <Lightformer intensity={0.3} color="#FF2C9C" position={[7, 3, 3]} rotation-y={-Math.PI / 2} scale={[1.8, 0.7, 1]} />
        </Environment>
        {/* the pressed world: rotates beneath the fixed stylus */}
        <group ref={world}>
          <VinylRecord />
          <City />
        </group>
        <Turntable />
        <Tonearm />
        <Room />
        {/* last inside Suspense, so everything it compiles is already mounted */}
        <Precompile onDone={onReady} />
      </Suspense>
      {/* multisampling is per-sample bandwidth on an already fill-bound scene;
          2 samples plus the bloom's own softening reads the same here */}
      <EffectComposer multisampling={2}>
        <Bloom mipmapBlur intensity={0.45} luminanceThreshold={1.0} luminanceSmoothing={0.15} levels={4} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  )
})
