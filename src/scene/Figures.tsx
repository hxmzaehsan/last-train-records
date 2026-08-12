import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * Miniature people, built the way Japanese model-railway figures are: a small
 * kit of rounded parts, simplified but unmistakably human, and painted rather
 * than sculpted. Everything is authored at unit height and scaled per figure,
 * so proportions stay consistent across the town.
 *
 * Three levels of detail, chosen by how close the camera can ever get:
 *   'near' — jointed arms and legs, hands, shoes, hair, a painted face
 *   'mid'  — jointed limbs and hair silhouette, no face
 *   'far'  — one-piece limbs, no hands or face
 *
 * Geometry and materials are shared module-wide; only the tiny per-figure
 * fade palettes are cloned, so adding people costs draw calls, not memory.
 */

/* ------------------------------------------------------------ geometry */

const seg = (r: number) => Math.max(5, r)

/**
 * A shoe rather than a block: narrow rounded heel, widest at the ball, and a
 * tapered toe that reaches further forward than the heel reaches back — so
 * which way a figure is pointing is readable even at 11mm. Authored flat in
 * plan and stood up, so it stays one low-poly draw.
 */
function shoeGeometry() {
  const s = new THREE.Shape()
  s.moveTo(-0.021, -0.03)
  s.quadraticCurveTo(0, -0.042, 0.021, -0.03) // rounded heel, kept short
  s.lineTo(0.028, 0.016) // widest across the ball of the foot
  s.quadraticCurveTo(0.026, 0.058, 0, 0.064) // toe taper
  s.quadraticCurveTo(-0.026, 0.058, -0.028, 0.016)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false, curveSegments: 4 })
  g.rotateX(Math.PI / 2)
  g.translate(0, 0.03, 0) // sole on the ground, toe pointing along +z
  return g
}

/**
 * The head is an egg, not a ball, so everything that sits on it is squashed
 * to match — a spherical wig on an oval head is what made the hair read as a
 * hard hat. FACE_GAP is the opening the hair leaves at the front; the painted
 * face patch is cut to exactly the same width, so hair frames it.
 */
export const HEAD_SCALE: [number, number, number] = [0.95, 1.06, 0.94]
export const HAIR_SCALE: [number, number, number] = [0.993, 1.108, 0.982]
const FACE_GAP = 1.24
const FRONT = Math.PI / 2

export const geo = {
  head: new THREE.SphereGeometry(0.062, 12, 9),
  /** crown, stopping a little above the eyes so it reads as a fringe */
  hairCrown: new THREE.SphereGeometry(0.0655, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.44),
  /** back and sides, with the face left open */
  hairRear: new THREE.SphereGeometry(0.0655, 12, 8, FRONT + FACE_GAP / 2, Math.PI * 2 - FACE_GAP, 0, Math.PI * 0.62),
  hairLong: new THREE.SphereGeometry(0.0655, 12, 8, FRONT + FACE_GAP / 2, Math.PI * 2 - FACE_GAP, 0, Math.PI * 0.84),
  knit: new THREE.SphereGeometry(0.0705, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.55),
  bun: new THREE.SphereGeometry(0.028, 6, 5),
  nose: new THREE.ConeGeometry(0.008, 0.017, 5),
  neck: new THREE.CylinderGeometry(0.024, 0.028, 0.05, seg(6)),
  /** torso tapers toward the waist, so it never reads as a box */
  chest: new THREE.CylinderGeometry(0.098, 0.078, 0.3, seg(8)),
  hips: new THREE.CylinderGeometry(0.082, 0.072, 0.1, seg(8)),
  coat: new THREE.CylinderGeometry(0.108, 0.126, 0.4, seg(8), 1, true),
  jacket: new THREE.CylinderGeometry(0.104, 0.112, 0.27, seg(8), 1, true),
  skirt: new THREE.CylinderGeometry(0.086, 0.132, 0.16, seg(8), 1, true),
  collar: new THREE.CylinderGeometry(0.05, 0.062, 0.035, seg(8), 1, true),
  upperArm: new THREE.CapsuleGeometry(0.026, 0.15, 2, 6),
  foreArm: new THREE.CapsuleGeometry(0.022, 0.14, 2, 6),
  hand: new THREE.SphereGeometry(0.028, 6, 5),
  thigh: new THREE.CapsuleGeometry(0.038, 0.19, 2, 6),
  shin: new THREE.CapsuleGeometry(0.031, 0.19, 2, 6),
  shoe: shoeGeometry(),
  limb: new THREE.CapsuleGeometry(0.03, 0.36, 2, 6),
  /* the face is a patch of the head's own surface — a flat quad poked its
     corners outside the silhouette and warped as the head turned */
  face: new THREE.SphereGeometry(0.0632, 16, 12, FRONT - FACE_GAP / 2, FACE_GAP, Math.PI / 2 - 0.58, 1.16),
  bag: new THREE.BoxGeometry(0.1, 0.08, 0.04),
  pack: new THREE.BoxGeometry(0.13, 0.16, 0.07),
  strap: new THREE.BoxGeometry(0.012, 0.16, 0.012),
  scarf: new THREE.TorusGeometry(0.055, 0.016, 4, 10),
  brim: new THREE.TorusGeometry(0.06, 0.011, 4, 12),
  lens: new THREE.TorusGeometry(0.021, 0.005, 4, 10),
  bridge: new THREE.BoxGeometry(0.016, 0.004, 0.004),
  apron: new THREE.CylinderGeometry(0.086, 0.104, 0.34, seg(8), 1, true, -0.9, 1.8),
}

/* ----------------------------------------------------------- face atlas */

const EXPRESSIONS = ['welcome', 'curious', 'tired', 'talking', 'subdued'] as const
export type Expression = (typeof EXPRESSIONS)[number]

const CELL = 128
let atlas: THREE.Texture | null = null

/**
 * One 5-cell atlas of painted faces. Everything is drawn at the size it will
 * actually be read at: two beady eyes, a hint of brow, a small mouth. No
 * large eyes, no skin shading, no animation.
 */
function faceAtlas() {
  if (atlas) return atlas
  const c = document.createElement('canvas')
  c.width = CELL * EXPRESSIONS.length
  c.height = CELL
  const ctx = c.getContext('2d')!
  const ink = '#16191b'

  const eye = (x: number, y: number, r: number) => {
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * 1.15, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  const lid = (x: number, y: number, w: number) => {
    ctx.beginPath()
    ctx.moveTo(x - w, y)
    ctx.lineTo(x + w, y)
    ctx.stroke()
  }
  const arcEye = (x: number, y: number, w: number) => {
    ctx.beginPath()
    ctx.arc(x, y + 3, w, Math.PI * 1.15, Math.PI * 1.85)
    ctx.stroke()
  }
  const cheeks = (o: number) => {
    ctx.fillStyle = 'rgba(196,116,116,0.34)'
    for (const x of [o + 30, o + 98]) {
      ctx.beginPath()
      ctx.ellipse(x, 82, 12, 8, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = ink
  }

  EXPRESSIONS.forEach((name, i) => {
    const o = i * CELL
    ctx.fillStyle = ink
    ctx.strokeStyle = ink
    ctx.lineCap = 'round'
    ctx.lineWidth = 5

    switch (name) {
      case 'welcome':
        arcEye(o + 44, 62, 10)
        arcEye(o + 84, 62, 10)
        cheeks(o)
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.arc(o + 64, 82, 13, 0.2, Math.PI - 0.2)
        ctx.stroke()
        break
      case 'curious':
        eye(o + 44, 62, 8)
        eye(o + 84, 62, 8)
        ctx.lineWidth = 4
        lid(o + 82, 42, 11) // one brow lifted
        ctx.beginPath()
        ctx.moveTo(o + 56, 88)
        ctx.lineTo(o + 72, 86)
        ctx.stroke()
        break
      case 'tired':
        ctx.lineWidth = 5
        lid(o + 44, 62, 11)
        lid(o + 84, 62, 11)
        ctx.lineWidth = 3
        lid(o + 44, 52, 9)
        lid(o + 84, 52, 9)
        ctx.lineWidth = 4
        lid(o + 64, 88, 8)
        break
      case 'talking':
        eye(o + 44, 60, 8)
        eye(o + 84, 60, 8)
        ctx.beginPath()
        ctx.ellipse(o + 64, 86, 8, 10, 0, 0, Math.PI * 2)
        ctx.fill()
        break
      default:
        eye(o + 44, 62, 7)
        eye(o + 84, 62, 7)
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(o + 64, 96, 12, Math.PI + 0.35, -0.35)
        ctx.stroke()
    }
  })

  atlas = new THREE.CanvasTexture(c)
  atlas.colorSpace = THREE.SRGBColorSpace
  atlas.anisotropy = 4
  return atlas
}

const faceMats = new Map<Expression, THREE.MeshBasicMaterial>()

export function faceMaterial(e: Expression) {
  const hit = faceMats.get(e)
  if (hit) return hit
  const tex = faceAtlas().clone()
  tex.needsUpdate = true
  tex.repeat.set(1 / EXPRESSIONS.length, 1)
  tex.offset.set(EXPRESSIONS.indexOf(e) / EXPRESSIONS.length, 0)
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  faceMats.set(e, m)
  return m
}

/** the tiny LTR mark on the shopkeeper's apron */
export function apronTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#20242a'
  ctx.fillRect(0, 0, 128, 128)
  ctx.fillStyle = 'rgba(233,241,234,0.72)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = "620 26px 'Archivo Variable','Helvetica Neue',Arial,sans-serif"
  ctx.fillText('LTR', 64, 52)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/* --------------------------------------------------------- the wardrobe */

/* Clothing shells are open cylinders, so both faces have to be drawn or a
   coat shows a hole where it opens at the hem. */
const mat = (color: string, roughness = 0.86, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide })

export const wardrobe = {
  /* painted-figure skin: light enough that the inked features still read in
     a street this dark, without turning into a glowing dot */
  skinPale: mat('#b3a294', 0.92),
  skinWarm: mat('#9c8875', 0.92),
  hairBlack: mat('#141618', 0.78),
  hairBrown: mat('#241c18', 0.8),
  coatCharcoal: mat('#181d21'),
  coatNavy: mat('#17222c'),
  coatOlive: mat('#26291f'),
  coatIvory: mat('#3d4139'),
  coatRust: mat('#2f231d'),
  trouserDark: mat('#131719'),
  trouserGrey: mat('#242a2c'),
  skirtPlaid: mat('#2b2126'),
  shoe: mat('#0e1113', 0.7),
  bag: mat('#20262a', 0.8),
  apron: mat('#20242a', 0.88),
  steel: mat('#3a4247', 0.4, 0.6),
  accentCyan: mat('#186b78', 0.8),
  accentMagenta: mat('#6b1a45', 0.8),
  accentGreen: mat('#3f5a1b', 0.8),
}

export type WardrobeKey = keyof typeof wardrobe

export type FigureMats = {
  skin: THREE.Material
  hair: THREE.Material
  coat: THREE.Material
  trouser: THREE.Material
  shoe: THREE.Material
  extra: THREE.Material
  face?: THREE.Material
}

const fadeable = (m: THREE.Material) => {
  const c = m.clone()
  c.transparent = true
  c.opacity = 0
  c.depthWrite = false
  return c
}

/** Clones a wardrobe set so one figure can fade up on its own. */
export function fadingMats(base: FigureMats): { mats: FigureMats; all: THREE.Material[] } {
  const skin = fadeable(base.skin)
  const hair = fadeable(base.hair)
  const coat = fadeable(base.coat)
  const trouser = fadeable(base.trouser)
  const shoe = fadeable(base.shoe)
  const extra = fadeable(base.extra)
  const face = base.face ? fadeable(base.face) : undefined
  const mats: FigureMats = { skin, hair, coat, trouser, shoe, extra, face }
  return { mats, all: [skin, hair, coat, trouser, shoe, extra, ...(face ? [face] : [])] }
}

/* -------------------------------------------------------------- the rig */

export type FigureRig = {
  root: THREE.Group
  hips: THREE.Group
  chest: THREE.Group
  head: THREE.Group
  armL: THREE.Group
  armR: THREE.Group
  foreL: THREE.Group
  foreR: THREE.Group
  legL: THREE.Group
  legR: THREE.Group
  shinL: THREE.Group
  shinR: THREE.Group
}

export type Detail = 'near' | 'mid' | 'far'
/* 'none' renders no hair meshes at all — every style below is opt-in */
export type Hair = 'none' | 'short' | 'bob' | 'crop' | 'tied' | 'cap'
export type Outfit = 'coat' | 'jacket' | 'skirt' | 'apron'
export type Carry = 'none' | 'bag' | 'pack'

export type FigureSpec = {
  /** world height in scene units — a standing adult is about 0.115 */
  height: number
  /** 1 = reference build; below 1 reads slighter, above 1 heavier */
  build?: number
  detail: Detail
  hair: Hair
  outfit: Outfit
  carry?: Carry
  /** cyan / magenta / green scarf, used on two people only */
  scarf?: boolean
  mats: FigureMats
}

/**
 * One miniature person. Joints are empty groups so the walk driver can pose
 * them; every mesh hangs off a joint and never moves on its own.
 */
export function MiniFigure({
  spec,
  rigRef,
  children,
}: {
  spec: FigureSpec
  rigRef?: (r: FigureRig | null) => void
  children?: React.ReactNode
}) {
  const { detail, hair, outfit, carry = 'none', mats } = spec
  const b = spec.build ?? 1
  const near = detail === 'near'
  const jointed = detail !== 'far'
  // mid-distance people still get a painted face; only the nose, hands and
  // knee joints are reserved for figures the camera can walk up to
  const faced = jointed && !!mats.face

  const rig = useMemo<Partial<FigureRig>>(() => ({}), [])
  const set = (k: keyof FigureRig) => (o: THREE.Group | null) => {
    if (o) (rig as Record<string, THREE.Group>)[k] = o
    const done = [
      'root',
      'hips',
      'chest',
      'head',
      'armL',
      'armR',
      'foreL',
      'foreR',
      'legL',
      'legR',
      'shinL',
      'shinR',
    ].every((n) => (rig as Record<string, unknown>)[n])
    if (done && rigRef) rigRef(rig as FigureRig)
  }

  const leg = (side: 1 | -1, key: 'legL' | 'legR', shinKey: 'shinL' | 'shinR') => (
    <group key={key} ref={set(key)} position={[0.052 * side * b, 0.46, 0]}>
      {jointed ? (
        <>
          <mesh geometry={geo.thigh} material={mats.trouser} position={[0, -0.115, 0]} scale={[b, 1, b]} />
          <group ref={set(shinKey)} position={[0, -0.225, 0]}>
            <mesh geometry={geo.shin} material={mats.trouser} position={[0, -0.11, 0]} scale={[b, 1, b]} />
            {/* sole on the ground; the geometry carries the forward offset */}
            <mesh geometry={geo.shoe} material={mats.shoe} position={[0, -0.235, 0]} scale={[b, 1, 1]} />
          </group>
        </>
      ) : (
        <>
          <mesh geometry={geo.limb} material={mats.trouser} position={[0, -0.21, 0]} scale={[b, 1, b]} />
          <group ref={set(shinKey)} position={[0, -0.42, 0]}>
            <mesh geometry={geo.shoe} material={mats.shoe} position={[0, -0.04, 0]} scale={[b, 0.85, 1]} />
          </group>
        </>
      )}
    </group>
  )

  const arm = (side: 1 | -1, key: 'armL' | 'armR', foreKey: 'foreL' | 'foreR') => (
    // shoulder height is 0.735 of the body, and the chest joint already sits
    // at 0.5, so the arms hang from the difference
    <group key={key} ref={set(key)} position={[0.108 * side * b, 0.235, 0]}>
      {jointed ? (
        <>
          <mesh geometry={geo.upperArm} material={mats.coat} position={[0, -0.095, 0]} />
          <group ref={set(foreKey)} position={[0, -0.185, 0]}>
            <mesh geometry={geo.foreArm} material={mats.coat} position={[0, -0.09, 0]} />
            {near && <mesh geometry={geo.hand} material={mats.skin} position={[0, -0.175, 0]} scale={[1, 1.1, 0.8]} />}
          </group>
        </>
      ) : (
        <>
          <mesh geometry={geo.limb} material={mats.coat} position={[0, -0.17, 0]} scale={[0.8, 0.86, 0.8]} />
          <group ref={set(foreKey)} position={[0, -0.34, 0]} />
        </>
      )}
    </group>
  )

  return (
    <group ref={set('root')} scale={spec.height}>
      {/* legs hang from the hips so the whole body can counter-rotate */}
      <group ref={set('hips')} position={[0, 0, 0]}>
        <mesh geometry={geo.hips} material={mats.trouser} position={[0, 0.5, 0]} scale={[b, 1, b * 0.86]} />
        {leg(1, 'legL', 'shinL')}
        {leg(-1, 'legR', 'shinR')}
        {outfit === 'skirt' && (
          <mesh geometry={geo.skirt} material={mats.extra} position={[0, 0.44, 0]} scale={[b, 1, b]} />
        )}

        <group ref={set('chest')} position={[0, 0.5, 0]}>
          <mesh geometry={geo.chest} material={mats.coat} position={[0, 0.14, 0]} scale={[b, 1, b * 0.82]} />
          {outfit === 'coat' && (
            <mesh geometry={geo.coat} material={mats.coat} position={[0, 0.06, 0]} scale={[b, 1, b * 0.86]} />
          )}
          {outfit === 'jacket' && (
            <mesh geometry={geo.jacket} material={mats.coat} position={[0, 0.145, 0]} scale={[b, 1, b * 0.86]} />
          )}
          {outfit === 'apron' && (
            <mesh geometry={geo.apron} material={mats.extra} position={[0, 0.11, 0]} scale={[b, 1, b * 0.9]} />
          )}
          {/* collar: the detail that stops a torso reading as a tube */}
          <mesh geometry={geo.collar} material={mats.coat} position={[0, 0.288, 0]} scale={[b, 1, b * 0.9]} />
          {spec.scarf && (
            <mesh
              geometry={geo.scarf}
              material={mats.extra}
              position={[0, 0.29, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[b, b, 1]}
            />
          )}
          <mesh geometry={geo.neck} material={mats.skin} position={[0, 0.315, 0]} />

          {arm(1, 'armL', 'foreL')}
          {arm(-1, 'armR', 'foreR')}

          <group ref={set('head')} position={[0, 0.33, 0]}>
            <mesh geometry={geo.head} material={mats.skin} position={[0, 0.055, 0]} scale={HEAD_SCALE} />
            {near && (
              <mesh geometry={geo.nose} material={mats.skin} position={[0, 0.052, 0.0555]} rotation={[Math.PI / 2, 0, 0]} />
            )}
            {faced && (
              <mesh geometry={geo.face} material={mats.face} position={[0, 0.055, 0]} scale={HEAD_SCALE} />
            )}
            {/* hair sits on the head's own curve and leaves the face open */}
            {hair === 'crop' && (
              <mesh geometry={geo.hairCrown} material={mats.hair} position={[0, 0.055, 0]} scale={HAIR_SCALE} />
            )}
            {hair === 'short' && (
              <>
                <mesh geometry={geo.hairCrown} material={mats.hair} position={[0, 0.055, 0]} scale={HAIR_SCALE} />
                <mesh geometry={geo.hairRear} material={mats.hair} position={[0, 0.055, 0]} scale={HAIR_SCALE} />
              </>
            )}
            {hair === 'bob' && (
              <>
                <mesh geometry={geo.hairCrown} material={mats.hair} position={[0, 0.055, 0]} scale={HAIR_SCALE} />
                <mesh geometry={geo.hairLong} material={mats.hair} position={[0, 0.055, 0]} scale={HAIR_SCALE} />
              </>
            )}
            {hair === 'tied' && (
              <>
                <mesh geometry={geo.hairCrown} material={mats.hair} position={[0, 0.055, 0]} scale={HAIR_SCALE} />
                <mesh geometry={geo.hairRear} material={mats.hair} position={[0, 0.055, 0]} scale={HAIR_SCALE} />
                <mesh geometry={geo.bun} material={mats.hair} position={[0, 0.05, -0.066]} scale={[1, 1, 0.85]} />
              </>
            )}
            {hair === 'cap' && (
              <>
                <mesh geometry={geo.knit} material={mats.extra} position={[0, 0.055, 0]} scale={HAIR_SCALE} />
                <mesh
                  geometry={geo.brim}
                  material={mats.extra}
                  position={[0, 0.058, 0]}
                  rotation={[Math.PI / 2, 0, 0]}
                  scale={[1.06, 1.06, 1]}
                />
                <mesh geometry={geo.hairRear} material={mats.hair} position={[0, 0.055, 0]} scale={HAIR_SCALE} />
              </>
            )}
            {children}
          </group>

          {carry === 'bag' && (
            <group position={[0.1 * b, 0.02, 0.03]} rotation={[0, 0, -0.12]}>
              <mesh geometry={geo.bag} material={mats.extra} />
              <mesh geometry={geo.strap} material={mats.extra} position={[-0.03, 0.11, -0.01]} rotation={[0, 0, 0.5]} />
            </group>
          )}
          {carry === 'pack' && (
            <>
              <mesh geometry={geo.pack} material={mats.extra} position={[0, 0.12, -0.11 * b]} />
              {[-0.05, 0.05].map((x) => (
                <mesh key={x} geometry={geo.strap} material={mats.extra} position={[x * b, 0.19, -0.03]} rotation={[0.3, 0, 0]} />
              ))}
            </>
          )}
        </group>
      </group>
    </group>
  )
}

/* ------------------------------------------------------------- movement */

const hash = (i: number) => {
  const x = Math.sin(i * 63.7 + 11.3) * 43758.5453
  return x - Math.floor(x)
}

/** Shortest signed angle, so a turnaround never takes the long way round. */
export const wrapPi = (x: number) => Math.atan2(Math.sin(x), Math.cos(x))

/** One step per π of phase: how far this figure travels between footfalls. */
export const stepLength = (height: number) => 0.4 * height

/**
 * Poses a figure for a walk. `phase` comes from the distance actually
 * travelled (see `stepLength`), so the legs turn over at the speed the body
 * moves and the feet stay planted instead of skating. `move` is 0 when
 * standing, which lets everything settle rather than march on the spot.
 * Amplitudes are deliberately small — these are 11mm people.
 */
export function poseWalk(
  rig: FigureRig | null | undefined,
  phase: number,
  move: number,
  t: number,
  seed: number,
  look = 0,
) {
  if (!rig) return
  const p = phase + seed * 6
  const s = Math.sin(p) * move
  const c = Math.cos(p) * move
  const idle = Math.sin(t * 0.9 + seed * 9)

  rig.legL.rotation.x = s * 0.62
  rig.legR.rotation.x = -s * 0.62
  // knees only bend on the backswing, which is what stops the block look
  rig.shinL.rotation.x = Math.max(0, -s) * 0.85
  rig.shinR.rotation.x = Math.max(0, s) * 0.85

  rig.armL.rotation.x = -s * 0.5
  rig.armR.rotation.x = s * 0.5
  rig.armL.rotation.z = 0.08
  rig.armR.rotation.z = -0.08
  rig.foreL.rotation.x = 0.18 + Math.max(0, s) * 0.5
  rig.foreR.rotation.x = 0.18 + Math.max(0, -s) * 0.5

  // hips and shoulders counter-rotate, and the body rises on each step
  rig.hips.rotation.y = s * 0.13
  rig.chest.rotation.y = -s * 0.16
  rig.chest.rotation.x = 0.02 + move * 0.03
  rig.hips.position.y = Math.abs(c) * 0.012 * move

  rig.head.rotation.y = look + idle * 0.12 * (1 - move * 0.5)
  rig.head.rotation.x = -0.02 + idle * 0.04
}

/** Standing pose with a little life in it — used when a figure has stopped. */
export function poseIdle(rig: FigureRig | null | undefined, t: number, seed: number, look = 0) {
  if (!rig) return
  const breathe = Math.sin(t * 0.8 + seed * 7)
  const shift = Math.sin(t * 0.23 + seed * 3)
  rig.legL.rotation.x = 0.02
  rig.legR.rotation.x = -0.03
  rig.shinL.rotation.x = 0.02
  rig.shinR.rotation.x = 0.04
  rig.armL.rotation.x = 0.04 + breathe * 0.02
  rig.armR.rotation.x = -0.02 - breathe * 0.02
  rig.armL.rotation.z = 0.1
  rig.armR.rotation.z = -0.09
  rig.foreL.rotation.x = 0.22
  rig.foreR.rotation.x = 0.26
  rig.hips.rotation.y = shift * 0.05
  rig.chest.rotation.y = -shift * 0.07
  rig.chest.rotation.x = 0.02 + breathe * 0.012
  rig.hips.position.y = 0
  rig.head.rotation.y = look + shift * 0.22
  rig.head.rotation.x = -0.02 + breathe * 0.03
}

export { hash as figureHash }
