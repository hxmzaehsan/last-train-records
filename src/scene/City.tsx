import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import {
  BASE_TOP_Y,
  CANYON_A0,
  CANYON_A1,
  CITY_END,
  CITY_SWEEP,
  NEEDLE_ANGLE,
  SURFACE_Y,
  T1_TOP,
  T2_TOP,
  T4_TOP,
  TRACK_R,
  mulberry32,
  polar,
  ringSectorGeometry,
  type InstanceItem,
} from './helpers'
import { InstancedUnits } from './InstancedUnits'
import { Sign } from './signage'
import { Venues, VENUE_ANGLE_LIST } from './Venues'
import { Revealable } from './Revealable'
import { neonGate, revealProgress, distOfPosition, trainState } from './timeline'
import { venueProgress } from './venue'
import { Canyon } from './Canyon'
import { Life } from './Life'
import { wedgeGeometry } from './Kit'
import { useReducedMotion } from './useReducedMotion'

/* ---------------------------------------------------------------- shared */

const unitBox = new THREE.BoxGeometry(1, 1, 1)
unitBox.translate(0, 0.5, 0)

const unitPlane = new THREE.PlaneGeometry(1, 1)
const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 10)
unitCylinder.translate(0, 0.5, 0)

const concreteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82 })
const windowMat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide })
const sleeperMat = new THREE.MeshStandardMaterial({ color: '#1b232a', roughness: 0.88 })
const railMat = new THREE.MeshStandardMaterial({ color: '#9fb4bd', metalness: 1, roughness: 0.24 })
const poleMat = new THREE.MeshStandardMaterial({ color: '#2a353c', roughness: 0.58, transparent: true })
const roofBitMat = new THREE.MeshStandardMaterial({ color: '#35434a', roughness: 0.62 })
const tankMat = new THREE.MeshStandardMaterial({ color: '#39464d', roughness: 0.45, metalness: 0.5 })
const railwayGreen = new THREE.MeshStandardMaterial({ color: '#1d2f28', roughness: 0.56 })
const wireMat = new THREE.MeshStandardMaterial({ color: '#141a1e', roughness: 0.48, metalness: 0.6 })
const antennaMat = new THREE.MeshStandardMaterial({ color: '#3a474d', roughness: 0.34, metalness: 0.85 })
const guardWhite = new THREE.MeshStandardMaterial({ color: '#a9bac0', roughness: 0.42 })
const lampHeadGeo = new THREE.SphereGeometry(0.016, 8, 8)
const lampHeadMat = new THREE.MeshStandardMaterial({ color: '#eaf4f0', emissive: '#E9F1EA', emissiveIntensity: 2.2, transparent: true })
const terra1Mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0.16 })
const terra2Mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.32, metalness: 0.16 })
const terra4Mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.36, metalness: 0.14 })
const bedMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, metalness: 0.08 })
const ballastMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 })
const ringRoadMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0.1 })

/** Interior glass of the train — animated from CityLife. */
const trainGlassMat = new THREE.MeshStandardMaterial({
  color: '#1a2320',
  emissive: '#dfe9e2',
  emissiveIntensity: 1.9,
  roughness: 0.4,
})

const STATION_A0 = NEEDLE_ANGLE - THREE.MathUtils.degToRad(128)
const STATION_A1 = NEEDLE_ANGLE - THREE.MathUtils.degToRad(96)
const STATION_MID = (STATION_A0 + STATION_A1) / 2
const STREET_ANGLES = [
  NEEDLE_ANGLE - THREE.MathUtils.degToRad(58),
  NEEDLE_ANGLE - THREE.MathUtils.degToRad(150),
  NEEDLE_ANGLE - THREE.MathUtils.degToRad(178),
]

const WINDOW_COLORS = ['#c6d2c9', '#b9c7bf', '#a8ccd6', '#cfd9cf', '#9fb8c0', '#e8bd83']
const COOL_WINDOW = '#9fccd8'
const CONCRETE_COLORS = [
  '#28373e', '#2c3c44', '#233139', '#30414a', '#26353d',
  '#334450', '#2b3034', '#1f2b32', '#35464f', '#293840',
]
const ROOF_COLORS = ['#202a30', '#243036', '#1d272d', '#26333a', '#222d34']

/* ------------------------------------------------------------ generation */

type CityData = {
  buildings: InstanceItem[]
  tiers: InstanceItem[]
  windows: InstanceItem[]
  tanks: InstanceItem[]
  acUnits: InstanceItem[]
  wallACs: InstanceItem[]
  antennas: InstanceItem[]
  balconies: InstanceItem[]
  balconyRails: InstanceItem[]
  escapes: InstanceItem[]
  escapeRails: InstanceItem[]
  roofs: InstanceItem[]
  parapets: InstanceItem[]
  ducts: InstanceItem[]
  sleepers: InstanceItem[]
  formingSleepers: InstanceItem[]
  poles: InstanceItem[]
  poleArms: InstanceItem[]
  droppers: InstanceItem[]
  canopyPosts: InstanceItem[]
  guardRails: InstanceItem[]
  spanWires: { from: THREE.Vector3; to: THREE.Vector3 }[]
}

function generateCity(): CityData {
  const rng = mulberry32(20260811)
  const buildings: InstanceItem[] = []
  const tiers: InstanceItem[] = []
  const windows: InstanceItem[] = []
  const tanks: InstanceItem[] = []
  const acUnits: InstanceItem[] = []
  const wallACs: InstanceItem[] = []
  const antennas: InstanceItem[] = []
  const balconies: InstanceItem[] = []
  const balconyRails: InstanceItem[] = []
  const escapes: InstanceItem[] = []
  const escapeRails: InstanceItem[] = []
  const roofs: InstanceItem[] = []
  const parapets: InstanceItem[] = []
  const ducts: InstanceItem[] = []

  const nearStreet = (a: number) =>
    STREET_ANGLES.some((s) => Math.abs(a - s) < THREE.MathUtils.degToRad(4))
  const nearVenue = (a: number) =>
    VENUE_ANGLE_LIST.some((v) => Math.abs(a - v) < 0.155)
  const inCanyon = (a: number) => a < CANYON_A1 + 0.05 && a > CANYON_A0 - 0.06

  const pushWindows = (
    a: number,
    rb: number,
    w: number,
    h: number,
    d: number,
    baseY: number,
    allowShop: boolean,
    litRate: number,
  ) => {
    const cosA = Math.cos(a)
    const sinA = Math.sin(a)
    const radial = new THREE.Vector3(cosA, 0, sinA)
    const tangent = new THREE.Vector3(-sinA, 0, cosA)
    const cx = rb * cosA
    const cz = rb * sinA

    const addFacade = (normalKind: 'inner' | 'outer' | 'sideA' | 'sideB') => {
      let ry: number
      let facadeCenter: THREE.Vector3
      let along: THREE.Vector3
      let span: number
      if (normalKind === 'inner' || normalKind === 'outer') {
        const sign = normalKind === 'inner' ? -1 : 1
        ry = normalKind === 'inner' ? -a - Math.PI / 2 : Math.PI / 2 - a
        facadeCenter = new THREE.Vector3(cx, 0, cz).add(radial.clone().multiplyScalar(sign * (d / 2 + 0.012)))
        along = tangent
        span = w
      } else {
        const sign = normalKind === 'sideA' ? 1 : -1
        ry = normalKind === 'sideA' ? -a : Math.PI - a
        facadeCenter = new THREE.Vector3(cx, 0, cz).add(tangent.clone().multiplyScalar(sign * (w / 2 + 0.012)))
        along = radial
        span = d
      }

      const cols = Math.max(1, Math.floor(span / 0.15))
      const rows = Math.max(1, Math.floor((h - 0.08) / 0.15))
      const spacing = span / (cols + 0.4)

      let startRow = 0
      if (allowShop && normalKind === 'inner' && rng() < 0.5) {
        windows.push({
          p: [facadeCenter.x, baseY + 0.075, facadeCenter.z],
          ry,
          s: [span * 0.74, 0.12, 1],
          c: new THREE.Color(WINDOW_COLORS[Math.floor(rng() * 3)]).multiplyScalar(0.95),
        })
        startRow = 1
      }

      for (let rI = startRow; rI < rows; rI++) {
        for (let cI = 0; cI < cols; cI++) {
          if (rng() > litRate) continue
          const t = (cI - (cols - 1) / 2) * spacing
          const p = facadeCenter.clone().add(along.clone().multiplyScalar(t))
          const cool = rng() < 0.1
          const col = new THREE.Color(
            cool ? COOL_WINDOW : WINDOW_COLORS[Math.floor(rng() * WINDOW_COLORS.length)],
          ).multiplyScalar(0.55 + rng() * 0.35)
          windows.push({
            p: [p.x, baseY + 0.12 + rI * 0.15, p.z],
            ry,
            s: [0.062, 0.078, 1],
            c: col,
          })
        }
      }

      // occasional wall-mounted AC unit on a side facade
      if ((normalKind === 'sideA' || normalKind === 'sideB') && h > 0.4 && rng() < 0.4) {
        const t = (rng() - 0.5) * span * 0.7
        const p = facadeCenter.clone().add(along.clone().multiplyScalar(t))
        wallACs.push({
          p: [p.x, baseY + 0.1 + rng() * (h - 0.2), p.z],
          ry,
          s: [0.05, 0.035, 0.035],
        })
      }
    }

    addFacade('inner')
    addFacade('sideA')
    addFacade('sideB')
    addFacade('outer')
  }

  type Band = {
    rIn: number
    rOut: number
    hMin: number
    hMax: number
    startMargin: number
    endMargin: number
    baseY: number
    outerWindows: boolean
    skipStation: boolean
    dim?: boolean
  }

  const bands: Band[] = [
    { rIn: 2.14, rOut: 2.72, hMin: 0.32, hMax: 0.62, startMargin: 0.5, endMargin: 0.1, baseY: T1_TOP, outerWindows: false, skipStation: false },
    { rIn: 2.62, rOut: 2.88, hMin: 0.4, hMax: 0.78, startMargin: 0.78, endMargin: 0.09, baseY: T2_TOP, outerWindows: false, skipStation: false },
    { rIn: 3.06, rOut: 3.34, hMin: 0.42, hMax: 0.85, startMargin: 0.82, endMargin: 0.08, baseY: T2_TOP, outerWindows: false, skipStation: false },
    { rIn: 3.96, rOut: 4.32, hMin: 0.46, hMax: 0.82, startMargin: 0.68, endMargin: 0.06, baseY: T4_TOP, outerWindows: true, skipStation: true },
    { rIn: 4.34, rOut: 4.74, hMin: 0.55, hMax: 0.95, startMargin: 0.7, endMargin: 0.04, baseY: T4_TOP, outerWindows: true, skipStation: true, dim: true },
  ]

  for (const band of bands) {
    const rMid = (band.rIn + band.rOut) / 2
    let a = NEEDLE_ANGLE - band.startMargin
    const aEnd = CITY_END + band.endMargin
    while (a > aEnd) {
      const w = 0.32 + rng() * 0.34
      const arcW = w / rMid
      const aCenter = a - arcW / 2
      if (aCenter <= aEnd) break

      const inStation = band.skipStation && aCenter < STATION_A1 + 0.06 && aCenter > STATION_A0 - 0.06
      const blockVenue = band.baseY === T1_TOP && nearVenue(aCenter)
      const blockCanyon = band.baseY !== T1_TOP && inCanyon(aCenter)
      const farSkip = aCenter < THREE.MathUtils.degToRad(-70) ? 0.3 : 0.12
      if (!inStation && !blockVenue && !blockCanyon && !nearStreet(aCenter) && rng() > farSkip) {
        const d = Math.min(band.rOut - band.rIn - 0.04, 0.3 + rng() * 0.32)
        const rJitter = band.rIn + d / 2 + rng() * (band.rOut - band.rIn - d)
        const h = band.hMin + rng() * (band.hMax - band.hMin)
        // Rim skyline stays low near the stylus, climbs toward the back.
        let hh = h
        if (band.outerWindows) {
          const distFromNeedle = NEEDLE_ANGLE - aCenter
          const damp = THREE.MathUtils.clamp((distFromNeedle - 0.32) / 1.0, 0.3, 1)
          hh = Math.min(Math.max(0.36, h * damp), 1.0)
        }
        if (aCenter < THREE.MathUtils.degToRad(-70)) hh = Math.min(hh, 0.75)
        if (aCenter < THREE.MathUtils.degToRad(-95)) hh = Math.min(hh, 0.62)
        const c = new THREE.Color(CONCRETE_COLORS[Math.floor(rng() * CONCRETE_COLORS.length)])
        if (rng() < 0.1) c.offsetHSL(0.05, 0.1, 0)
        // foreground rim facing the camera reads lightest, back row darkest
        const facingCamera = aCenter < THREE.MathUtils.degToRad(28) && aCenter > THREE.MathUtils.degToRad(-48)
        if (band.outerWindows && !band.dim && facingCamera) c.multiplyScalar(1.12)
        else if (band.baseY === T2_TOP) c.multiplyScalar(0.86)
        if (band.dim) c.multiplyScalar(0.68)
        if (aCenter < THREE.MathUtils.degToRad(-95)) c.multiplyScalar(0.74)
        buildings.push({
          p: polar(rJitter, aCenter, band.baseY),
          ry: -aCenter,
          s: [d, hh, w],
          c,
        })
        let litRate = (band.dim ? 0.5 : 1) * (0.16 + rng() * 0.32)
        if (aCenter < THREE.MathUtils.degToRad(-95)) litRate *= 0.55
        pushWindows(aCenter, rJitter, w, hh, d, band.baseY, rMid < 3.4, litRate)

        const roofY = band.baseY + hh
        // stepped tower crown on the tallest rim blocks
        if (band.outerWindows && hh > 1.25) {
          tiers.push({
            p: polar(rJitter, aCenter, roofY),
            ry: -aCenter,
            s: [d * 0.72, 0.14 + rng() * 0.22, w * 0.7],
            c: c.clone().multiplyScalar(0.92),
          })
        }
        if (rng() < 0.34) {
          tanks.push({
            p: polar(rJitter + (rng() - 0.5) * 0.1, aCenter + ((rng() - 0.5) * 0.1) / rMid, roofY),
            s: [0.055, 0.09, 0.055],
          })
        }
        if (rng() < 0.42) {
          acUnits.push({
            p: polar(rJitter + (rng() - 0.5) * 0.14, aCenter + ((rng() - 0.5) * 0.14) / rMid, roofY),
            ry: -aCenter + rng() * 0.5,
            s: [0.09, 0.05, 0.07],
          })
        }
        if (rng() < 0.4) {
          antennas.push({
            p: polar(rJitter + (rng() - 0.5) * 0.12, aCenter + ((rng() - 0.5) * 0.1) / rMid, roofY),
            s: [0.008, 0.12 + rng() * 0.16, 0.008],
          })
        }
        // varied roofline: gabled tile roofs on low blocks, parapets on flats
        if (!band.outerWindows && hh < 0.65 && rng() < 0.55) {
          roofs.push({
            p: polar(rJitter, aCenter, band.baseY + hh - 0.004),
            ry: -aCenter,
            s: [d * 1.14, 0.055 + rng() * 0.05, w * 1.1],
            c: new THREE.Color(ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)]),
          })
        } else if (rng() < 0.6) {
          parapets.push({
            p: polar(rJitter - d / 2 + 0.012, aCenter, band.baseY + hh),
            ry: -aCenter - Math.PI / 2,
            s: [w, 0.028, 0.022],
          })
        }
        if (band.outerWindows && rng() < 0.3) {
          ducts.push({
            p: polar(rJitter + (rng() - 0.5) * 0.1, aCenter, band.baseY + hh + 0.005),
            ry: -aCenter - Math.PI / 2,
            s: [w * 0.5, 0.035, 0.045],
          })
        }
        // danchi balconies on the inner facades of low/mid blocks
        const balconyChance = aCenter < THREE.MathUtils.degToRad(-95) ? 0.55 : 0.3
        if (!band.outerWindows && hh > 0.45 && rng() < balconyChance) {
          const rFace = rJitter - d / 2
          const floors = Math.floor((hh - 0.2) / 0.15)
          for (let fI = 1; fI <= floors; fI++) {
            const y = band.baseY + 0.055 + fI * 0.15
            balconies.push({
              p: polar(rFace - 0.028, aCenter, y),
              ry: -aCenter - Math.PI / 2,
              s: [w * 0.78, 0.014, 0.05],
            })
            balconyRails.push({
              p: polar(rFace - 0.05, aCenter, y + 0.012),
              ry: -aCenter - Math.PI / 2,
              s: [w * 0.78, 0.04, 0.006],
            })
          }
        }
        // exterior stair / fire escape on a side wall
        if (band.baseY === T2_TOP && hh > 0.6 && rng() < 0.24) {
          const side = rng() < 0.5 ? 1 : -1
          const cosA = Math.cos(aCenter)
          const sinA = Math.sin(aCenter)
          const tx = -sinA * side * (w / 2 + 0.04)
          const tz = cosA * side * (w / 2 + 0.04)
          const cx = rJitter * cosA
          const cz = rJitter * sinA
          const floors = Math.floor(hh / 0.16)
          for (let fI = 1; fI <= floors; fI++) {
            const rOff = (fI % 2 === 0 ? 0.05 : -0.05)
            escapes.push({
              p: [cx + tx + cosA * rOff, band.baseY + fI * 0.16 - 0.02, cz + tz + sinA * rOff],
              ry: -aCenter,
              s: [0.07, 0.012, 0.1],
            })
          }
          escapeRails.push({
            p: [cx + tx, band.baseY, cz + tz],
            ry: -aCenter,
            s: [0.014, hh * 0.82, 0.014],
          })
        }
      }
      // tight alleys sometimes, ordinary gaps otherwise
      a -= arcW + (rng() < 0.24 ? 0.008 : 0.016 + rng() * 0.032)
    }
  }

  /* sleepers */
  const sleepers: InstanceItem[] = []
  const step = 0.115 / TRACK_R
  for (let t = 0.012; t < CITY_SWEEP - 0.01; t += step) {
    const a = NEEDLE_ANGLE - t
    sleepers.push({
      p: polar(TRACK_R, a, BASE_TOP_Y + 0.035),
      ry: -a,
      s: [0.34, 0.022, 0.075],
    })
  }

  /* half-sunk sleepers just ahead of the stylus */
  const formingSleepers: InstanceItem[] = []
  for (const f of [
    { da: 0.03, k: 0.75 },
    { da: 0.075, k: 0.45 },
    { da: 0.125, k: 0.22 },
  ]) {
    const a = NEEDLE_ANGLE + f.da
    formingSleepers.push({
      p: polar(TRACK_R, a, SURFACE_Y),
      ry: -a,
      s: [0.34 * f.k, 0.02 * f.k, 0.07],
    })
  }

  /* catenary poles + droppers */
  const poles: InstanceItem[] = []
  const poleArms: InstanceItem[] = []
  const droppers: InstanceItem[] = []
  const poleStep = THREE.MathUtils.degToRad(17)
  for (let t = THREE.MathUtils.degToRad(6); t < CITY_SWEEP - 0.06; t += poleStep) {
    const a = NEEDLE_ANGLE - t
    poles.push({ p: polar(3.94, a, T4_TOP), s: [0.016, 1.12, 0.016] })
    poleArms.push({
      p: polar(3.94 - 0.17, a, T4_TOP + 1.02),
      ry: -a,
      s: [0.36, 0.02, 0.026],
    })
  }
  for (let t = 0.05; t < CITY_SWEEP - 0.05; t += 0.105) {
    const a = NEEDLE_ANGLE - t
    droppers.push({ p: polar(TRACK_R, a, 0.95), s: [0.004, 0.06, 0.004] })
  }

  /* station canopy posts */
  const canopyPosts: InstanceItem[] = []
  for (let a = STATION_A0 + 0.05; a < STATION_A1 - 0.03; a += 0.1) {
    canopyPosts.push({ p: polar(4.16, a, T4_TOP + 0.09), s: [0.013, 0.5, 0.013] })
  }

  /* guard rails along the ring road */
  const guardRails: InstanceItem[] = []
  for (let a = NEEDLE_ANGLE - 0.62; a > CITY_END + 0.2; a -= 0.16) {
    if (nearStreet(a) || nearVenue(a)) continue
    if (rng() < 0.55) continue
    guardRails.push({
      p: polar(2.86, a, T2_TOP + 0.045),
      ry: -a - Math.PI / 2,
      s: [0.2, 0.01, 0.01],
    })
  }

  /* span wires from poles to nearby rooftops */
  const spanWires: { from: THREE.Vector3; to: THREE.Vector3 }[] = []
  for (const t of [0.35, 0.65, 0.85, 1.15, 1.35, 1.65, 1.9, 2.15, 2.4, 2.9]) {
    const a = NEEDLE_ANGLE - t
    if (a < CITY_END + 0.1) break
    const from = new THREE.Vector3(...polar(3.94, a, T4_TOP + 1.08))
    const inward = rng() < 0.5
    const to = new THREE.Vector3(
      ...polar(inward ? 3.1 : 4.45, a + (rng() - 0.5) * 0.16, inward ? T2_TOP + 0.6 + rng() * 0.25 : T4_TOP + 0.9 + rng() * 0.4),
    )
    spanWires.push({ from, to })
  }

  return {
    buildings, tiers, windows, tanks, acUnits, wallACs, antennas,
    balconies, balconyRails, escapes, escapeRails, roofs, parapets, ducts,
    sleepers, formingSleepers, poles, poleArms, droppers, canopyPosts,
    guardRails, spanWires,
  }
}

/* ----------------------------------------------------------- primitives */

const UP = new THREE.Vector3(0, 1, 0)

function Wire({ from, to, r = 0.004 }: { from: THREE.Vector3; to: THREE.Vector3; r?: number }) {
  const { mid, quat, len } = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(to, from)
    const len = dir.length()
    const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize())
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5)
    return { mid, quat, len }
  }, [from, to])
  return (
    <mesh position={mid} quaternion={quat} material={wireMat}>
      <cylinderGeometry args={[r, r, len, 6]} />
    </mesh>
  )
}

function stripeTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 32
  const ctx = c.getContext('2d')!
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#0c1115' : '#c8d2cf'
    ctx.fillRect(i * 16, 0, 16, 32)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function clockTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#e9ebe4'
  ctx.beginPath()
  ctx.arc(64, 64, 62, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#22241f'
  ctx.lineWidth = 6
  ctx.stroke()
  ctx.strokeStyle = '#2a2c26'
  ctx.lineWidth = 5
  // 0:05 — just past midnight
  ctx.beginPath()
  ctx.moveTo(64, 64)
  ctx.lineTo(64, 22)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(64, 64)
  ctx.lineTo(85, 28)
  ctx.stroke()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function timetableTexture() {
  const c = document.createElement('canvas')
  c.width = 192
  c.height = 144
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#14171a'
  ctx.fillRect(0, 0, 192, 144)
  ctx.fillStyle = '#f0ede2'
  ctx.textAlign = 'center'
  ctx.font = "600 30px 'Noto Sans JP Variable','Hiragino Sans',sans-serif"
  ctx.fillText('終電前', 96, 36)
  ctx.fillStyle = '#d8b93c'
  ctx.fillRect(16, 48, 160, 3)
  ctx.fillStyle = '#9aa4a8'
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(16, 64 + i * 18, 110, 6)
    ctx.fillStyle = '#c8d2d4'
    ctx.fillRect(140, 64 + i * 18, 36, 6)
    ctx.fillStyle = '#9aa4a8'
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function steamTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 128, 0, 0)
  g.addColorStop(0, 'rgba(255,244,230,0.55)')
  g.addColorStop(0.6, 'rgba(255,244,230,0.22)')
  g.addColorStop(1, 'rgba(255,244,230,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(32, 64, 14, 62, 0, 0, Math.PI * 2)
  ctx.fill()
  return new THREE.CanvasTexture(c)
}

function Steam({ position, phase = 0 }: { position: [number, number, number]; phase?: number }) {
  const tex = useMemo(steamTexture, [])
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const reduced = useReducedMotion()
  const d = useMemo(() => distOfPosition(position[0], position[2]), [position])
  useFrame(({ clock, camera }) => {
    if (!mesh.current || !mat.current) return
    mesh.current.quaternion.copy(camera.quaternion)
    const gate = revealProgress(d, 0.4, 0.9)
    if (gate <= 0) {
      mat.current.opacity = 0
      return
    }
    if (reduced) {
      mat.current.opacity = 0.16 * gate
      return
    }
    const t = (clock.elapsedTime * 0.12 + phase) % 1
    mesh.current.position.set(position[0] + Math.sin(t * 9 + phase * 7) * 0.015, position[1] + t * 0.28, position[2])
    mat.current.opacity = 0.3 * Math.sin(Math.PI * t) * gate
  })
  return (
    <mesh ref={mesh} position={position}>
      <planeGeometry args={[0.09, 0.34]} />
      <meshBasicMaterial ref={mat} map={tex} transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

/* ------------------------------------------------------------ sub-scenes */

function TrainCar({ angle, lead, carNo }: { angle: number; lead?: boolean; carNo: string }) {
  const floorY = 0.245
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const gr = g.current
    if (!gr) return
    const st = trainState()
    gr.visible = st.visible
    const a = angle + st.off
    gr.position.set(TRACK_R * Math.cos(a), floorY, TRACK_R * Math.sin(a))
    gr.rotation.y = -a - Math.PI / 2
  })
  return (
    <group ref={g} visible={false} scale={1.22}>
      <mesh position={[0, 0.03, 0]} castShadow>
        <boxGeometry args={[0.95, 0.06, 0.26]} />
        <meshStandardMaterial color="#1e1c1a" roughness={0.8} />
      </mesh>
      {[-0.32, 0.32].map((x) => (
        <mesh key={x} position={[x, 0.015, 0]}>
          <boxGeometry args={[0.2, 0.05, 0.24]} />
          <meshStandardMaterial color="#141312" roughness={0.8} />
        </mesh>
      ))}

      {/* vermilion body */}
      <mesh position={[0, 0.23, 0]} castShadow>
        <boxGeometry args={[1.06, 0.34, 0.3]} />
        <meshPhysicalMaterial color="#0a1118" roughness={0.34} clearcoat={0.55} clearcoatRoughness={0.3} />
      </mesh>

      {/* divided windows, both sides */}
      {[0.153, -0.153].map((z) => (
        <group key={z}>
          {[-0.1, 0.02, 0.14].map((x) => (
            <mesh key={x} position={[x, 0.29, z]} material={trainGlassMat}>
              <boxGeometry args={[0.1, 0.1, 0.008]} />
            </mesh>
          ))}
          <mesh position={[0.47, 0.29, z]} material={trainGlassMat}>
            <boxGeometry args={[0.06, 0.1, 0.008]} />
          </mesh>
          <mesh position={[-0.47, 0.29, z]} material={trainGlassMat}>
            <boxGeometry args={[0.06, 0.1, 0.008]} />
          </mesh>
          {/* twin sliding doors */}
          {[-0.31, 0.31].map((dx) => (
            <group key={dx}>
              <mesh position={[dx, 0.22, z]}>
                <boxGeometry args={[0.16, 0.3, 0.006]} />
                <meshStandardMaterial color="#0d151c" roughness={0.4} />
              </mesh>
              <mesh position={[dx, 0.22, z + (z > 0 ? 0.004 : -0.004)]}>
                <boxGeometry args={[0.006, 0.3, 0.004]} />
                <meshStandardMaterial color="#030608" roughness={0.5} />
              </mesh>
              {[-0.045, 0.045].map((wx) => (
                <mesh key={wx} position={[dx + wx, 0.29, z + (z > 0 ? 0.005 : -0.005)]} material={trainGlassMat}>
                  <boxGeometry args={[0.05, 0.08, 0.004]} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}

      {/* carriage number + side destination plate */}
      <Sign
        spec={{ text: carNo, fg: '#241f1a', bg: '#e6e1d4', weight: 700 }}
        height={0.028}
        position={[-0.44, 0.185, 0.156]}
        backing={false}
      />
      <Sign
        spec={{ text: '渋谷方面', fg: '#e8e4da', bg: '#232722' }}
        height={0.026}
        position={[0.2, 0.335, 0.156]}
        backing={false}
      />

      {/* acid-green route stripe */}
      <mesh position={[0, 0.13, 0]}>
        <boxGeometry args={[1.062, 0.026, 0.302]} />
        <meshStandardMaterial color="#243c0c" emissive="#A8FF3E" emissiveIntensity={0.45} roughness={0.5} />
      </mesh>

      {/* silver roof */}
      <mesh position={[0, 0.418, 0]} castShadow>
        <boxGeometry args={[1.0, 0.04, 0.27]} />
        <meshStandardMaterial color="#1b252d" metalness={0.7} roughness={0.4} />
      </mesh>

      {!lead && (
        <>
          {[-0.09, 0.09].map((z) => (
            <mesh key={z} position={[-0.535, 0.16, z]}>
              <sphereGeometry args={[0.016, 8, 8]} />
              <meshStandardMaterial color="#FF2C9C" emissive="#FF2C9C" emissiveIntensity={3} />
            </mesh>
          ))}
        </>
      )}
      {lead && (
        <>
          <mesh position={[0.535, 0.23, 0]}>
            <boxGeometry args={[0.015, 0.33, 0.29]} />
            <meshStandardMaterial color="#11181f" roughness={0.45} />
          </mesh>
          <mesh position={[0.545, 0.29, 0]} material={trainGlassMat}>
            <boxGeometry args={[0.012, 0.09, 0.2]} />
          </mesh>
          {/* destination roller: 各停 */}
          <Sign
            spec={{ text: '各停', fg: '#efe9da', bg: '#101312' }}
            height={0.04}
            position={[0.549, 0.375, 0]}
            rotationY={Math.PI / 2}
            backing={false}
            neon
          />
          {[-0.09, 0.09].map((z) => (
            <mesh key={z} position={[0.548, 0.14, z]}>
              <sphereGeometry args={[0.02, 10, 10]} />
              <meshStandardMaterial color="#f2fbff" emissive="#e8f6ff" emissiveIntensity={4} />
            </mesh>
          ))}
          <group position={[-0.2, 0.44, 0]}>
            <mesh position={[-0.09, 0.12, 0]} rotation={[0, 0, 0.75]}>
              <cylinderGeometry args={[0.008, 0.008, 0.3, 8]} />
              <meshStandardMaterial color="#3c3a36" roughness={0.5} metalness={0.6} />
            </mesh>
            <mesh position={[0.09, 0.12, 0]} rotation={[0, 0, -0.75]}>
              <cylinderGeometry args={[0.008, 0.008, 0.3, 8]} />
              <meshStandardMaterial color="#3c3a36" roughness={0.5} metalness={0.6} />
            </mesh>
            <mesh position={[0, 0.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.3, 8]} />
              <meshStandardMaterial color="#3c3a36" roughness={0.5} metalness={0.6} />
            </mesh>
          </group>
        </>
      )}
    </group>
  )
}

function Station() {
  const platformGeo = useMemo(
    () => ringSectorGeometry(3.96, 4.36, STATION_A0, STATION_A1, 0.09, 48),
    [],
  )
  const tactileGeo = useMemo(
    () => ringSectorGeometry(4.01, 4.06, STATION_A0 + 0.015, STATION_A1 - 0.015, 0.004, 48),
    [],
  )
  const edgeGeo = useMemo(
    () => ringSectorGeometry(3.96, 4.0, STATION_A0 + 0.01, STATION_A1 - 0.01, 0.006, 48),
    [],
  )
  const canopyGeo = useMemo(
    () => ringSectorGeometry(3.9, 4.44, STATION_A0 + 0.03, STATION_A1 - 0.03, 0.018, 48),
    [],
  )
  const clockTex = useMemo(clockTexture, [])
  const timetableTex = useMemo(timetableTexture, [])
  const stripes = useMemo(stripeTexture, [])
  const platTop = T4_TOP + 0.09

  const bPos = polar(4.56, STATION_MID, T4_TOP)
  const boardA = STATION_A1 - 0.07
  const postA = STATION_A0 + 0.09

  return (
    <group>
      <mesh geometry={platformGeo} position={[0, T4_TOP, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#26343b" roughness={0.78} />
      </mesh>
      {/* white painted edge + yellow tactile strip */}
      <mesh geometry={edgeGeo} position={[0, platTop, 0]}>
        <meshStandardMaterial color="#9fc4cd" roughness={0.5} />
      </mesh>
      <mesh geometry={tactileGeo} position={[0, platTop + 0.002, 0]}>
        <meshStandardMaterial color="#2a5f6b" emissive="#20E7FF" emissiveIntensity={0.55} roughness={0.5} />
      </mesh>
      {/* canopy with fluorescent strip beneath */}
      <mesh geometry={canopyGeo} position={[0, T4_TOP + 0.59, 0]} castShadow>
        <meshStandardMaterial color="#1d262c" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* standing station name board */}
      <group position={polar(4.18, boardA, platTop)} rotation={[0, -boardA - Math.PI / 2, 0]}>
        {[-0.09, 0.09].map((x) => (
          <mesh key={x} position={[x, 0.09, 0]} material={railwayGreen}>
            <cylinderGeometry args={[0.006, 0.006, 0.18, 6]} />
          </mesh>
        ))}
        <Sign
          spec={{ text: '下北沢', fg: '#1e2022', bg: '#eef0ea', stripe: '#e2492a' }}
          height={0.08}
          position={[0, 0.2, 0]}
          neon
        />
      </group>

      {/* hanging direction sign under the canopy */}
      <Sign
        spec={{ text: '渋谷方面', fg: '#e8f0ee', bg: '#1c3a34', frame: '#4fae9a' }}
        height={0.05}
        position={polar(4.14, STATION_MID + 0.04, T4_TOP + 0.52)}
        rotationY={-(STATION_MID + 0.04) - Math.PI / 2}
      />
      {/* platform number on a canopy post */}
      <Sign
        spec={{ text: '2番線', fg: '#f0ede2', bg: '#20262c' }}
        height={0.045}
        position={polar(4.16, postA, T4_TOP + 0.42)}
        rotationY={-postA - Math.PI / 2}
      />
      {/* clock */}
      <mesh
        position={polar(4.16, postA + 0.05, T4_TOP + 0.5)}
        rotation={[0, -(postA + 0.05) - Math.PI / 2, 0]}
      >
        <circleGeometry args={[0.035, 24]} />
        <meshBasicMaterial map={clockTex} />
      </mesh>
      {/* timetable board near the station house */}
      <mesh
        position={polar(4.32, STATION_MID - 0.06, platTop + 0.12)}
        rotation={[0, -(STATION_MID - 0.06) - Math.PI / 2 + Math.PI, 0]}
      >
        <planeGeometry args={[0.16, 0.12]} />
        <meshBasicMaterial map={timetableTex} />
      </mesh>

      {/* benches */}
      {[STATION_MID - 0.02, STATION_MID + 0.06].map((a) => (
        <group key={a} position={polar(4.24, a, platTop)} rotation={[0, -a - Math.PI / 2, 0]}>
          <mesh position={[0, 0.05, 0]} castShadow material={railwayGreen}>
            <boxGeometry args={[0.16, 0.016, 0.05]} />
          </mesh>
          {[-0.06, 0.06].map((x) => (
            <mesh key={x} position={[x, 0.024, 0]} material={railwayGreen}>
              <boxGeometry args={[0.012, 0.05, 0.04]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* station house + ticket gates */}
      <group position={bPos} rotation={[0, -STATION_MID, 0]}>
        <mesh position={[0, 0.21, 0]} castShadow>
          <boxGeometry args={[0.42, 0.42, 1.05]} />
          <meshStandardMaterial color="#24323a" roughness={0.82} />
        </mesh>
        <mesh position={[0, 0.44, 0]} castShadow>
          <boxGeometry args={[0.5, 0.05, 1.13]} />
          <meshStandardMaterial color="#202a30" roughness={0.7} />
        </mesh>
        {/* vermilion route stripe on the fascia */}
        <mesh position={[-0.255, 0.395, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[1.05, 0.022]} />
          <meshBasicMaterial color="#e2492a" />
        </mesh>
        {/* glowing ticket hall + warm spill */}
        <mesh position={[-0.22, 0.16, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[0.62, 0.24]} />
          <meshBasicMaterial color="#ffd9a0" />
        </mesh>
        <pointLight position={[-0.34, 0.2, 0]} color="#ffbe72" intensity={1.9} distance={2.3} decay={2} />
        {/* 出口 above the gate line */}
        <Sign
          spec={{ text: '出口', fg: '#f6efe0', bg: '#2c3038' }}
          height={0.05}
          position={[-0.27, 0.34, 0.28]}
          rotationY={-Math.PI / 2}
          neon
          intensity={1.2}
        />
        {/* ticket gates */}
        {[-0.16, 0, 0.16].map((z) => (
          <group key={z} position={[-0.31, 0, z]}>
            <mesh position={[0, 0.07, 0]} castShadow>
              <boxGeometry args={[0.09, 0.14, 0.028]} />
              <meshStandardMaterial color="#33424a" roughness={0.42} metalness={0.3} />
            </mesh>
            <mesh position={[-0.046, 0.115, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[0.02, 0.012]} />
              <meshBasicMaterial color="#20E7FF" />
            </mesh>
          </group>
        ))}
      </group>

      {/* stop line + warning stripes on the ballast */}
      <mesh
        position={polar(TRACK_R, STATION_A1 + 0.05, BASE_TOP_Y + 0.037)}
        rotation={[-Math.PI / 2, 0, -(STATION_A1 + 0.05)]}
      >
        <planeGeometry args={[0.06, 0.4]} />
        <meshBasicMaterial color="#ddd8ca" />
      </mesh>
      <mesh
        position={polar(TRACK_R + 0.31, STATION_A0 - 0.04, BASE_TOP_Y + 0.06)}
        rotation={[0, -(STATION_A0 - 0.04) - Math.PI / 2, 0]}
      >
        <planeGeometry args={[0.12, 0.035]} />
        <meshBasicMaterial map={stripes} />
      </mesh>
    </group>
  )
}

function LevelCrossing() {
  const a = STREET_ANGLES[0]
  const stripes = useMemo(stripeTexture, [])
  return (
    <group>
      {/* crossing surface across the corridor */}
      <mesh position={polar(TRACK_R, a, BASE_TOP_Y + 0.036)} rotation={[-Math.PI / 2, 0, -a]}>
        <planeGeometry args={[0.5, 0.16]} />
        <meshStandardMaterial color="#131a20" roughness={0.85} />
      </mesh>
      {/* crossing post: X sign + twin red lamps */}
      {[TRACK_R - 0.42, TRACK_R + 0.42].map((r, i) => (
        <group key={r} position={polar(r, a + (i === 0 ? 0.045 : -0.045), i === 0 ? T2_TOP : T4_TOP)} rotation={[0, -a - Math.PI / 2, 0]}>
          <mesh position={[0, 0.17, 0]} material={railwayGreen}>
            <cylinderGeometry args={[0.008, 0.01, 0.34, 6]} />
          </mesh>
          <mesh position={[0, 0.33, 0]} rotation={[0, 0, 0.78]}>
            <boxGeometry args={[0.11, 0.018, 0.008]} />
            <meshStandardMaterial color="#8fa0a6" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.33, 0.004]} rotation={[0, 0, -0.78]}>
            <boxGeometry args={[0.11, 0.018, 0.008]} />
            <meshStandardMaterial color="#8fa0a6" roughness={0.5} />
          </mesh>
          {[-0.028, 0.028].map((x) => (
            <mesh key={x} position={[x, 0.26, 0.01]}>
              <sphereGeometry args={[0.014, 8, 8]} />
              <meshStandardMaterial color="#4a0d2e" emissive="#FF2C9C" emissiveIntensity={1.6} />
            </mesh>
          ))}
          <mesh position={[0, 0.38, 0]}>
            <planeGeometry args={[0.07, 0.02]} />
            <meshBasicMaterial map={stripes} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function VendingMachines() {
  const spots = useMemo(
    () => [
      { a: STATION_A1 - 0.11, r: 4.3, hot: true, y: T4_TOP + 0.09 },
      { a: STATION_A1 - 0.15, r: 4.3, hot: false, y: T4_TOP + 0.09 },
      { a: STREET_ANGLES[0] + 0.05, r: 2.79, hot: true, y: T2_TOP },
    ],
    [],
  )
  return (
    <group>
      {spots.map((s, i) => (
        <Revealable key={i} a={s.a} lead={0.6} dur={0.3}>
          <group position={polar(s.r, s.a, s.y)} rotation={[0, -s.a - Math.PI / 2, 0]}>
            <mesh position={[0, 0.115, 0]} castShadow>
              <boxGeometry args={[0.12, 0.23, 0.1]} />
              <meshStandardMaterial color={s.hot ? '#122530' : '#101a21'} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.13, 0.052]}>
              <planeGeometry args={[0.095, 0.16]} />
              <meshBasicMaterial color={s.hot ? '#bfeef8' : '#e9f1ea'} />
            </mesh>
          </group>
        </Revealable>
      ))}
    </group>
  )
}

function Signals() {
  const spots = [
    { a: NEEDLE_ANGLE - 0.14, r: TRACK_R + 0.32, aspect: '#A8FF3E' },
    { a: STATION_A1 + 0.12, r: TRACK_R - 0.34, aspect: '#A8FF3E' },
  ]
  return (
    <group>
      {spots.map((s, i) => (
        <Revealable key={i} a={s.a} lead={0.35} dur={0.35}>
        <group position={polar(s.r, s.a, BASE_TOP_Y)} rotation={[0, -s.a - Math.PI / 2, 0]}>
          <mesh position={[0, 0.24, 0]} material={railwayGreen}>
            <cylinderGeometry args={[0.012, 0.014, 0.48, 8]} />
          </mesh>
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[0.05, 0.13, 0.045]} />
            <meshStandardMaterial color="#22241f" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.53, 0.026]}>
            <sphereGeometry args={[0.017, 10, 10]} />
            <meshStandardMaterial color={s.aspect} emissive={s.aspect} emissiveIntensity={3} />
          </mesh>
          <mesh position={[0, 0.475, 0.026]}>
            <sphereGeometry args={[0.015, 10, 10]} />
            <meshStandardMaterial color="#181a17" roughness={0.4} />
          </mesh>
          <pointLight position={[0, 0.53, 0.1]} color={s.aspect} intensity={0.14} distance={0.45} decay={2} />
        </group>
        </Revealable>
      ))}
    </group>
  )
}

/** Slow ambient animation: train interiors + station fluorescents. */
function CityLife() {
  const reduced = useReducedMotion()
  const stationLight = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const gate = neonGate(STATION_MID)
    const trainOn = trainState().visible ? 1 : 0
    /*
     * Street lamp heads are city-scale points of light. At the shop close-up
     * one of them sits right beside the neon and reads as a blown highlight,
     * so they dim as the venue camera arrives and come straight back with it.
     */
    const vp = venueProgress()
    lampHeadMat.emissiveIntensity = 2.2 * (1 - 0.985 * vp)
    // the head is a near-white ball, so dim the diffuse too or it stays a dot
    lampHeadMat.color.setRGB(0.82 - 0.78 * vp, 0.9 - 0.86 * vp, 0.87 - 0.83 * vp)
    /* the lamp and utility columns stand between the close-up camera and the
       storefront, reading as dark bars across the neon, so they fade with it */
    lampHeadMat.opacity = 1 - vp
    poleMat.opacity = 1 - 0.94 * vp
    if (reduced) {
      trainGlassMat.emissiveIntensity = 1.9 * trainOn
      if (stationLight.current) {
        stationLight.current.userData.driven = true
        stationLight.current.intensity = 3.3 * gate
      }
      return
    }
    trainGlassMat.emissiveIntensity = (1.8 + 0.25 * Math.sin(t * 0.55) + 0.08 * Math.sin(t * 2.3)) * trainOn
    if (stationLight.current) {
      stationLight.current.userData.driven = true
      stationLight.current.intensity = (3.1 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.7))) * gate
    }
  })
  return (
    <pointLight
      ref={stationLight}
      position={polar(4.16, STATION_MID, T4_TOP + 0.52)}
      color="#9fe6f5"
      intensity={2.3}
      distance={2.6}
      decay={2}
    />
  )
}

/* ------------------------------------------------------------------ city */

export function City() {
  const data = useMemo(generateCity, [])

  /* terraced foundations, chunked into sectors so they can rise progressively */
  const chunked = useMemo(() => {
    const CH = THREE.MathUtils.degToRad(3)
    const vinylEdge = new THREE.Color('#0a141c')
    const ring = (rIn: number, rOut: number, h: number, y: number, aStart: number, aEnd: number, tint = '#26282c') => {
      const geo = ringSectorGeometry(rIn, rOut, 0, CH, h, 8)
      const items: InstanceItem[] = []
      const n = Math.max(1, Math.ceil((aStart - aEnd) / CH))
      const base = new THREE.Color(tint)
      for (let k = 0; k < n; k++) {
        const end = aStart - k * CH
        const mid = end - CH / 2
        // charcoal street fades back into vermilion where it meets the groove
        const w = THREE.MathUtils.clamp(1 - (NEEDLE_ANGLE - mid) / 0.3, 0, 1)
        const c = base.clone().lerp(vinylEdge, w * 0.85)
        items.push({ p: [0, y, 0], ry: CH - end, s: [1, 1, 1], a: mid, c })
      }
      return { geo, items }
    }
    const tube = (r: number, tubeR: number, y: number, aStart: number, aEnd: number, step: number) => {
      const arc = THREE.MathUtils.degToRad(step)
      const geo = new THREE.TorusGeometry(r, tubeR, 8, 12, arc)
      geo.rotateX(-Math.PI / 2)
      const items: InstanceItem[] = []
      const n = Math.max(1, Math.ceil((aStart - aEnd) / arc))
      for (let k = 0; k < n; k++) {
        const end = aStart - k * arc
        items.push({ p: [0, y, 0], ry: -end, s: [1, 1, 1], a: end - arc / 2 })
      }
      return { geo, items }
    }
    return {
      t1: ring(1.7, 2.58, 0.028, SURFACE_Y, NEEDLE_ANGLE - 0.16, CITY_END + 0.1, '#1a242b'),
      t2: ring(2.58, 3.4, 0.048, SURFACE_Y, NEEDLE_ANGLE - 0.1, CITY_END + 0.05, '#18222a'),
      t4: ring(3.8, 4.78, 0.042, SURFACE_Y, NEEDLE_ANGLE - 0.07, CITY_END + 0.03, '#1c262e'),
      bed: ring(TRACK_R - 0.2, TRACK_R + 0.2, 0.06, SURFACE_Y, NEEDLE_ANGLE, CITY_END, '#161f26'),
      ballast: ring(TRACK_R - 0.16, TRACK_R + 0.16, 0.035, BASE_TOP_Y, NEEDLE_ANGLE - 0.002, CITY_END + 0.005, '#1e262d'),
      road: ring(2.89, 3.05, 0.008, T2_TOP, NEEDLE_ANGLE - 0.46, CITY_END + 0.06, '#1c252c'),
      railIn: tube(TRACK_R - 0.062, 0.014, BASE_TOP_Y + 0.069, NEEDLE_ANGLE, CITY_END, 5),
      railOut: tube(TRACK_R + 0.062, 0.014, BASE_TOP_Y + 0.069, NEEDLE_ANGLE, CITY_END, 5),
      contact: tube(TRACK_R, 0.006, 0.95, NEEDLE_ANGLE - 0.02, CITY_END + 0.1, 9),
      messenger: tube(TRACK_R, 0.005, 1.01, NEEDLE_ANGLE - 0.02, CITY_END + 0.1, 9),
      feeder: tube(3.94, 0.005, T4_TOP + 1.03, NEEDLE_ANGLE - 0.06, CITY_END + 0.1, 9),
    }
  }, [])
  // stepped slivers that let each terrace fade into the grooves at the needle side
  const taperGeos = useMemo(
    () => [
      ringSectorGeometry(1.86, 2.5, NEEDLE_ANGLE - 0.16, NEEDLE_ANGLE - 0.1, 0.016, 24),
      ringSectorGeometry(2.02, 2.42, NEEDLE_ANGLE - 0.1, NEEDLE_ANGLE - 0.05, 0.007, 24),
      ringSectorGeometry(2.66, 3.22, NEEDLE_ANGLE - 0.1, NEEDLE_ANGLE - 0.04, 0.026, 24),
      ringSectorGeometry(2.78, 3.1, NEEDLE_ANGLE - 0.04, NEEDLE_ANGLE + 0.01, 0.011, 24),
      ringSectorGeometry(4.04, 4.66, NEEDLE_ANGLE - 0.07, NEEDLE_ANGLE - 0.015, 0.022, 24),
      ringSectorGeometry(4.16, 4.5, NEEDLE_ANGLE - 0.015, NEEDLE_ANGLE + 0.035, 0.009, 24),
    ],
    [],
  )
  const rampGeos = useMemo(
    () => [
      ringSectorGeometry(TRACK_R - 0.26, TRACK_R + 0.26, NEEDLE_ANGLE, NEEDLE_ANGLE + 0.05, 0.022, 24),
      ringSectorGeometry(TRACK_R - 0.22, TRACK_R + 0.22, NEEDLE_ANGLE + 0.05, NEEDLE_ANGLE + 0.09, 0.009, 24),
    ],
    [],
  )

  const lamps = useMemo(() => {
    const spots: { r: number; a: number; y: number }[] = [
      { r: 2.62, a: THREE.MathUtils.degToRad(-46), y: T1_TOP },
      { r: 2.62, a: THREE.MathUtils.degToRad(-62), y: T1_TOP },
      { r: 2.62, a: THREE.MathUtils.degToRad(-78), y: T1_TOP },
      { r: 3.9, a: THREE.MathUtils.degToRad(14), y: T4_TOP },
      { r: 3.9, a: THREE.MathUtils.degToRad(3), y: T4_TOP },
      { r: 3.9, a: THREE.MathUtils.degToRad(-9), y: T4_TOP },
      { r: 3.9, a: THREE.MathUtils.degToRad(-20), y: T4_TOP },
      { r: 3.9, a: THREE.MathUtils.degToRad(-30), y: T4_TOP },
    ]
    const poles: InstanceItem[] = spots.map((sp) => ({
      p: polar(sp.r, sp.a, sp.y),
      s: [0.008, 0.3, 0.008],
    }))
    const heads: InstanceItem[] = spots.map((sp) => ({
      p: polar(sp.r, sp.a, sp.y + 0.3),
      s: [1, 1, 1],
    }))
    return { poles, heads }
  }, [])

  const streetMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#1a232a', roughness: 0.4, metalness: 0.1 }),
    [],
  )
  const streetItems = useMemo<InstanceItem[]>(
    () =>
      STREET_ANGLES.flatMap((a) => [
        { p: polar(2.35, a, T1_TOP), ry: -a, s: [0.44, 0.006, 0.15] } as InstanceItem,
        { p: polar(2.97, a, T2_TOP), ry: -a, s: [0.72, 0.006, 0.15] } as InstanceItem,
        { p: polar(4.35, a, T4_TOP), ry: -a, s: [0.74, 0.006, 0.15] } as InstanceItem,
      ]),
    [],
  )


  return (
    <group>
      {/* terraces rising out of the vinyl, chunk by chunk behind the stylus */}
      <InstancedUnits items={chunked.t1.items} geometry={chunked.t1.geo} material={terra1Mat} castShadow receiveShadow reveal={{ mode: 'grow', dur: 0.3 }} />
      <InstancedUnits items={chunked.t2.items} geometry={chunked.t2.geo} material={terra2Mat} castShadow receiveShadow reveal={{ mode: 'grow', dur: 0.3 }} />
      <InstancedUnits items={chunked.t4.items} geometry={chunked.t4.geo} material={terra4Mat} castShadow receiveShadow reveal={{ mode: 'grow', dur: 0.3 }} />
      <InstancedUnits items={chunked.bed.items} geometry={chunked.bed.geo} material={bedMat} castShadow receiveShadow reveal={{ mode: 'grow', dur: 0.25 }} />
      {rampGeos.map((g, i) => (
        <Revealable key={i} a={NEEDLE_ANGLE - 0.02} dur={0.2}>
          <mesh geometry={g} position={[0, SURFACE_Y, 0]} receiveShadow>
            <meshStandardMaterial color="#0e161d" roughness={0.5} />
          </mesh>
        </Revealable>
      ))}
      {taperGeos.map((g, i) => (
        <Revealable key={i} a={NEEDLE_ANGLE - 0.04} dur={0.25}>
          <mesh geometry={g} position={[0, SURFACE_Y, 0]} receiveShadow>
            <meshStandardMaterial color="#0d141b" roughness={0.42} metalness={0.1} />
          </mesh>
        </Revealable>
      ))}
      <InstancedUnits items={chunked.road.items} geometry={chunked.road.geo} material={ringRoadMat} reveal={{ mode: 'grow', dur: 0.3, lead: 0.15 }} />
      <InstancedUnits items={streetItems} geometry={unitBox} material={streetMat} reveal={{ mode: 'grow', dur: 0.3, lead: 0.2 }} />

      {/* railway: ballast, sleepers and rails laid clockwise from the needle */}
      <InstancedUnits items={chunked.ballast.items} geometry={chunked.ballast.geo} material={ballastMat} castShadow receiveShadow reveal={{ mode: 'grow', dur: 0.22 }} />
      <InstancedUnits items={data.sleepers} geometry={unitBox} material={sleeperMat} castShadow reveal={{ mode: 'pop', dur: 0.18, lead: 0.08 }} />
      <InstancedUnits items={data.formingSleepers} geometry={unitBox} material={sleeperMat} reveal={{ mode: 'pop', dur: 0.1 }} />
      <InstancedUnits items={chunked.railIn.items} geometry={chunked.railIn.geo} material={railMat} castShadow reveal={{ mode: 'pop', dur: 0.16, lead: 0.14 }} />
      <InstancedUnits items={chunked.railOut.items} geometry={chunked.railOut.geo} material={railMat} castShadow reveal={{ mode: 'pop', dur: 0.16, lead: 0.14 }} />
      <InstancedUnits items={chunked.contact.items} geometry={chunked.contact.geo} material={wireMat} reveal={{ mode: 'pop', dur: 0.2, lead: 0.5 }} />
      <InstancedUnits items={chunked.messenger.items} geometry={chunked.messenger.geo} material={wireMat} reveal={{ mode: 'pop', dur: 0.2, lead: 0.55 }} />
      <InstancedUnits items={chunked.feeder.items} geometry={chunked.feeder.geo} material={wireMat} reveal={{ mode: 'pop', dur: 0.2, lead: 0.6 }} />
      <InstancedUnits items={data.droppers} geometry={unitCylinder} material={wireMat} reveal={{ mode: 'pop', dur: 0.15, lead: 0.62 }} />
      <InstancedUnits items={data.poles} geometry={unitCylinder} material={poleMat} castShadow reveal={{ mode: 'grow', dur: 0.35, lead: 0.28 }} />
      <InstancedUnits items={data.poleArms} geometry={unitBox} material={poleMat} reveal={{ mode: 'pop', dur: 0.18, lead: 0.46 }} />
      {data.spanWires.map((wSpec, i) => (
        <Revealable key={i} a={Math.atan2(wSpec.from.z, wSpec.from.x)} lead={0.65} dur={0.25}>
          <Wire from={wSpec.from} to={wSpec.to} />
        </Revealable>
      ))}
      {/* pole-mounted transformers */}
      {[0.55, 1.45, 2.35].map((t) => {
        const a = NEEDLE_ANGLE - t
        return (
          <Revealable key={t} a={a} lead={0.5} dur={0.3}>
            <mesh position={polar(3.9, a, T4_TOP + 0.62)} material={tankMat} castShadow>
              <cylinderGeometry args={[0.03, 0.03, 0.08, 8]} />
            </mesh>
          </Revealable>
        )
      })}

      {/* rolling stock */}
      <TrainCar angle={NEEDLE_ANGLE - 0.55} lead carNo="1" />
      <TrainCar angle={NEEDLE_ANGLE - 0.93} carNo="2" />

      {/* place */}
      <Revealable a={STATION_MID} dur={0.8} lead={0.15}>
        <Station />
      </Revealable>
      <Revealable a={STREET_ANGLES[0]} dur={0.4} lead={0.3}>
        <LevelCrossing />
      </Revealable>
      <Canyon />
      <InstancedUnits items={data.canopyPosts} geometry={unitCylinder} material={poleMat} reveal={{ mode: 'grow', dur: 0.3, lead: 0.3 }} />
      <InstancedUnits items={data.buildings} geometry={unitBox} material={concreteMat} castShadow receiveShadow reveal={{ mode: 'grow', dur: 0.5, lead: 0.3, jitter: 0.16 }} />
      <InstancedUnits items={data.tiers} geometry={unitBox} material={concreteMat} castShadow reveal={{ mode: 'grow', dur: 0.35, lead: 0.6, jitter: 0.1 }} />
      <InstancedUnits items={data.windows} geometry={unitPlane} material={windowMat} reveal={{ mode: 'pop', dur: 0.1, lead: 0.9, jitter: 0.55 }} />
      <InstancedUnits items={data.tanks} geometry={unitCylinder} material={tankMat} castShadow reveal={{ mode: 'pop', dur: 0.2, lead: 0.75, jitter: 0.2 }} />
      <InstancedUnits items={data.acUnits} geometry={unitBox} material={roofBitMat} reveal={{ mode: 'pop', dur: 0.2, lead: 0.78, jitter: 0.2 }} />
      <InstancedUnits items={data.wallACs} geometry={unitBox} material={roofBitMat} reveal={{ mode: 'pop', dur: 0.2, lead: 0.7, jitter: 0.25 }} />
      <InstancedUnits items={data.antennas} geometry={unitCylinder} material={antennaMat} reveal={{ mode: 'grow', dur: 0.25, lead: 0.85, jitter: 0.2 }} />
      <InstancedUnits items={data.balconies} geometry={unitBox} material={roofBitMat} reveal={{ mode: 'pop', dur: 0.2, lead: 0.6, jitter: 0.18 }} />
      <InstancedUnits items={data.balconyRails} geometry={unitBox} material={guardWhite} reveal={{ mode: 'pop', dur: 0.2, lead: 0.66, jitter: 0.18 }} />
      <InstancedUnits items={data.escapes} geometry={unitBox} material={antennaMat} reveal={{ mode: 'pop', dur: 0.2, lead: 0.62, jitter: 0.15 }} />
      <InstancedUnits items={data.escapeRails} geometry={unitBox} material={antennaMat} reveal={{ mode: 'grow', dur: 0.25, lead: 0.58 }} />
      <InstancedUnits items={data.roofs} geometry={wedgeGeometry} material={concreteMat} castShadow reveal={{ mode: 'pop', dur: 0.22, lead: 0.52, jitter: 0.12 }} />
      <InstancedUnits items={data.parapets} geometry={unitBox} material={roofBitMat} reveal={{ mode: 'pop', dur: 0.2, lead: 0.52, jitter: 0.12 }} />
      <InstancedUnits items={data.ducts} geometry={unitBox} material={tankMat} reveal={{ mode: 'pop', dur: 0.2, lead: 0.75, jitter: 0.2 }} />
      <InstancedUnits items={data.guardRails} geometry={unitBox} material={guardWhite} reveal={{ mode: 'pop', dur: 0.2, lead: 0.5, jitter: 0.2 }} />
      <InstancedUnits items={lamps.poles} geometry={unitCylinder} material={poleMat} reveal={{ mode: 'grow', dur: 0.25, lead: 0.5 }} />
      <InstancedUnits items={lamps.heads} geometry={lampHeadGeo} material={lampHeadMat} reveal={{ mode: 'pop', dur: 0.15, lead: 0.62 }} />
      <Venues />
      {/* 電気 shop sign on a mid-band facade */}
      <Revealable a={THREE.MathUtils.degToRad(-16)} lead={0.7} dur={0.3}>
        <Sign
          spec={{ text: '電気', vertical: true, fg: '#bfeef8', bg: '#0a222c', frame: '#20E7FF' }}
          height={0.2}
          position={polar(2.72, THREE.MathUtils.degToRad(-16), T2_TOP + 0.42)}
          rotationY={-THREE.MathUtils.degToRad(-16) - Math.PI / 2}
          neon
        />
      </Revealable>
      <VendingMachines />
      <Signals />

      {/* warm island over the inner shopping street — arrives with the alley */}
      <Revealable a={THREE.MathUtils.degToRad(-64)} lead={0.55} dur={0.35}>
        <pointLight position={[1.0, 1.35, -2.05]} intensity={1.7} decay={2} distance={3.4} color="#ffb877" />
      </Revealable>

      {/* atmosphere */}
      <Steam position={polar(4.08, THREE.MathUtils.degToRad(-19.5), T4_TOP + 0.58)} />
      <Steam position={polar(3.05, THREE.MathUtils.degToRad(-128), T2_TOP + 0.78)} phase={0.45} />
      <CityLife />
      <Life />
    </group>
  )
}
