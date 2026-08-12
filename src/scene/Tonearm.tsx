import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { NEEDLE_ANGLE, SURFACE_Y, TRACK_R, polar } from './helpers'
import { armProgress } from './timeline'

const UP = new THREE.Vector3(0, 1, 0)

function Tube({
  from,
  to,
  r,
  color = '#39434c',
  metalness = 0.95,
  roughness = 0.25,
}: {
  from: THREE.Vector3
  to: THREE.Vector3
  r: number
  color?: string
  metalness?: number
  roughness?: number
}) {
  const { mid, quat, len } = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(to, from)
    const len = dir.length()
    const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize())
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5)
    return { mid, quat, len }
  }, [from, to])
  return (
    <mesh position={mid} quaternion={quat} castShadow>
      <cylinderGeometry args={[r, r, len, 20]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  )
}

/**
 * S-ish tonearm reaching in from the deck's right rear. The stylus touches the
 * record exactly where the railway begins — the construction point.
 */
export function Tonearm() {
  const deckTop = -0.32

  const geo = useMemo(() => {
    const pivot = new THREE.Vector3(7.15, 1.02, 0.9)
    // Stylus rides the freshly-formed railhead, 0.14 above the vinyl surface.
    const contact = new THREE.Vector3(...polar(TRACK_R + 0.02, NEEDLE_ANGLE, SURFACE_Y + 0.14))

    // Headshell sits above and slightly behind the stylus.
    const headTop = contact.clone().add(new THREE.Vector3(0.14, 0.3, -0.2))
    const toHead = new THREE.Vector3().subVectors(headTop, pivot)
    // The arm runs almost level over the miniature skyline, then dips late.
    const bend = new THREE.Vector3(
      pivot.x + toHead.x * 0.76,
      pivot.y - 0.07,
      pivot.z + toHead.z * 0.76,
    )
    const tail = pivot.clone().add(
      toHead
        .clone()
        .setY(0)
        .normalize()
        .multiplyScalar(-0.72)
        .add(new THREE.Vector3(0, 0.08, 0)),
    )
    const headYaw = Math.atan2(-(headTop.z - bend.z), headTop.x - bend.x)
    // horizontal axis perpendicular to the arm, for the lift rotation
    const liftAxis = new THREE.Vector3(-(contact.z - pivot.z), 0, contact.x - pivot.x).normalize()
    return { pivot, contact, headTop, bend, tail, headYaw, liftAxis }
  }, [])

  const root = useRef<THREE.Group>(null)
  const tmpQ = useMemo(() => new THREE.Quaternion(), [])
  const tmpV = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const g = root.current
    if (!g) return
    // rotate the whole arm about its pivot: raised at idle, down while playing
    const lift = (1 - armProgress()) * 0.045
    tmpQ.setFromAxisAngle(geo.liftAxis, lift)
    g.quaternion.copy(tmpQ)
    tmpV.copy(geo.pivot).applyQuaternion(tmpQ)
    g.position.copy(geo.pivot).sub(tmpV)
  })

  return (
    <group ref={root}>
      {/* Arm base + gimbal */}
      <mesh position={[geo.pivot.x, deckTop + 0.22, geo.pivot.z]} castShadow>
        <cylinderGeometry args={[0.52, 0.6, 0.44, 32]} />
        <meshStandardMaterial color="#0d1116" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[geo.pivot.x, deckTop + 0.62, geo.pivot.z]} castShadow>
        <cylinderGeometry args={[0.3, 0.34, 0.42, 24]} />
        <meshStandardMaterial color="#39454e" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[geo.pivot.x, 0.72, geo.pivot.z]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.85, 16]} />
        <meshStandardMaterial color="#161c22" metalness={0.8} roughness={0.25} />
      </mesh>

      {/* Counterweight */}
      <Tube from={geo.pivot} to={geo.tail} r={0.07} />
      <mesh
        position={geo.tail}
        quaternion={new THREE.Quaternion().setFromUnitVectors(
          UP,
          new THREE.Vector3().subVectors(geo.tail, geo.pivot).normalize(),
        )}
        castShadow
      >
        <cylinderGeometry args={[0.21, 0.21, 0.32, 28]} />
        <meshStandardMaterial color="#37363c" metalness={0.85} roughness={0.3} />
      </mesh>

      {/* Arm tube, two segments */}
      <Tube from={geo.pivot} to={geo.bend} r={0.075} />
      <Tube from={geo.bend} to={geo.headTop} r={0.065} />

      {/* Headshell + cartridge */}
      <group position={geo.headTop} rotation={[0, geo.headYaw, 0]}>
        <mesh position={[0.14, -0.05, 0]} castShadow>
          <boxGeometry args={[0.55, 0.12, 0.2]} />
          <meshStandardMaterial color="#0b0f13" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0.2, -0.17, 0]} castShadow>
          <boxGeometry args={[0.34, 0.14, 0.17]} />
          <meshStandardMaterial color="#d9e2da" metalness={0.15} roughness={0.4} />
        </mesh>
        {/* Cartridge front badge */}
        <mesh position={[0.375, -0.17, 0]}>
          <boxGeometry args={[0.012, 0.1, 0.13]} />
          <meshStandardMaterial color="#FF2C9C" emissive="#FF2C9C" emissiveIntensity={0.5} roughness={0.4} />
        </mesh>
      </group>

      {/* Cantilever + stylus down to the record surface */}
      <Tube
        from={geo.headTop.clone().add(new THREE.Vector3(0.3, -0.24, -0.04))}
        to={geo.contact.clone().add(new THREE.Vector3(0, 0.02, 0))}
        r={0.014}
        color="#cfd8dc"
      />
    </group>
  )
}
