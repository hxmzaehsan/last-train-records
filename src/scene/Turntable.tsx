import { RoundedBox } from '@react-three/drei'

/**
 * Late-70s Japanese direct-drive deck: low smoked-black plinth with a brushed
 * aluminium top plate, platter, controls and feet. Record centre is at origin.
 */
export function Turntable() {
  const deckTop = -0.32 // y of the plinth's upper surface

  return (
    <group>
      {/* Platter */}
      <mesh position={[0, -0.17, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[5.22, 5.28, 0.3, 128, 1]} />
        <meshStandardMaterial color="#0b1218" metalness={0.85} roughness={0.4} />
      </mesh>
      {/* Platter rim strobe band */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[5.23, 5.23, 0.07, 128, 1, true]} />
        <meshStandardMaterial color="#39454e" metalness={0.9} roughness={0.32} />
      </mesh>

      {/* Graphite top plate */}
      <RoundedBox
        args={[16, 0.14, 11.4]}
        radius={0.05}
        smoothness={3}
        position={[0.9, deckTop - 0.07, 0]}
        receiveShadow
      >
        <meshStandardMaterial color="#0a0f14" metalness={0.8} roughness={0.36} />
      </RoundedBox>

      {/* Brushed aluminium fascia along the front edge */}
      <RoundedBox
        args={[16.08, 0.34, 0.16]}
        radius={0.03}
        smoothness={2}
        position={[0.9, deckTop - 0.32, 5.72]}
        castShadow
      >
        <meshStandardMaterial color="#4a555e" metalness={0.9} roughness={0.34} />
      </RoundedBox>

      {/* Smoked-black body */}
      <RoundedBox
        args={[16.1, 1.3, 11.5]}
        radius={0.1}
        smoothness={3}
        position={[0.9, deckTop - 0.8, 0]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#050709"
          roughness={0.28}
          metalness={0.15}
          clearcoat={0.8}
          clearcoatRoughness={0.3}
        />
      </RoundedBox>

      {/* Platter well ring */}
      <mesh position={[0, deckTop + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.29, 5.5, 128]} />
        <meshStandardMaterial color="#0d1319" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Controls, bottom-left of the deck front */}
      <group position={[-4.4, deckTop, 4.9]}>
        {/* Start/stop pad */}
        <mesh position={[0, 0.05, 0]} castShadow>
          <boxGeometry args={[0.85, 0.1, 0.85]} />
          <meshStandardMaterial color="#10161b" metalness={0.5} roughness={0.35} />
        </mesh>
        {/* Speed buttons */}
        <mesh position={[1.15, 0.035, 0.12]} castShadow>
          <boxGeometry args={[0.42, 0.07, 0.42]} />
          <meshStandardMaterial color="#10161b" metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh position={[1.75, 0.035, 0.12]} castShadow>
          <boxGeometry args={[0.42, 0.07, 0.42]} />
          <meshStandardMaterial color="#10161b" metalness={0.5} roughness={0.35} />
        </mesh>
        {/* Power lamp */}
        <mesh position={[-0.85, 0.03, 0.3]}>
          <cylinderGeometry args={[0.055, 0.055, 0.06, 16]} />
          <meshStandardMaterial
            color="#FF2C9C"
            emissive="#FF2C9C"
            emissiveIntensity={2.2}
          />
        </mesh>
      </group>

      {/* Pitch knob, right side */}
      <mesh position={[7.3, deckTop + 0.09, 3.6]} castShadow>
        <cylinderGeometry args={[0.32, 0.36, 0.18, 32]} />
        <meshStandardMaterial color="#151b21" metalness={0.75} roughness={0.3} />
      </mesh>

      {/* Feet */}
      {[
        [-6.4, -5.0],
        [8.2, -5.0],
        [-6.4, 5.0],
        [8.2, 5.0],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, -1.62, z]} castShadow>
          <cylinderGeometry args={[0.42, 0.5, 0.35, 24]} />
          <meshStandardMaterial color="#07090c" roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}
