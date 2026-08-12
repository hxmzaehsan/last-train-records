import * as THREE from 'three'
import { T4_TOP, polar } from './helpers'
import { audioRelease } from '../audio/cues'

/**
 * Venue state: a view layer that sits *beside* the construction timeline
 * rather than inside it. The city is only ever entered once it has settled,
 * so the two can never run at the same time.
 *
 * Stage 4A only wires the record shop, but every pose and every guard is
 * keyed by venue id so the kissaten and station can be added later without
 * touching the camera architecture.
 */

export type VenueId = 'releases'
export type VenueView = 'city' | 'entering-releases' | 'releases' | 'leaving-releases'

/** seconds for the camera move in and back out */
export const ENTER_SECONDS = 1.85
export const LEAVE_SECONDS = 1.55
export const ENTER_SECONDS_REDUCED = 0.9
export const LEAVE_SECONDS_REDUCED = 0.8

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2)

/* ------------------------------------------------------------ shop frame */

/** authored pose of the Last Train Records shop-house (see Canyon.tsx) */
export const SHOP_A = THREE.MathUtils.degToRad(10)
export const SHOP_R = 4.06

export const shopOrigin = new THREE.Vector3(...polar(SHOP_R, SHOP_A, T4_TOP))
/** local +x of the shop group: along the façade, toward increasing angle */
export const shopRight = new THREE.Vector3(-Math.sin(SHOP_A), 0, Math.cos(SHOP_A))
/** local +z of the shop group: out of the storefront, toward the record centre */
export const shopFront = new THREE.Vector3(-Math.cos(SHOP_A), 0, -Math.sin(SHOP_A))

/**
 * Shop-local (x along the façade, y above its base, z out toward the street)
 * to world. The world group's settled rotation is a whole turn, so local and
 * world agree once the city is built — which is the only time a venue opens.
 */
export function shopPoint(x: number, y: number, z: number, out = new THREE.Vector3()) {
  return out
    .copy(shopOrigin)
    .addScaledVector(shopRight, x)
    .addScaledVector(shopFront, z)
    .setY(shopOrigin.y + y)
}

/* --------------------------------------------------------- camera poses */

/**
 * Settled close-up: just inside the carriageway — any further back and the
 * road traffic would sweep the lens — a little above the pavement, aimed at
 * the storefront so a strip of railway stays in the foreground.
 *
 * The distance is fixed by the street, so narrow screens cannot simply pull
 * back: they open the lens instead and shift the frame toward the neon, which
 * keeps the window, the entrance and the sign column all in shot.
 */
type VenuePose = { pos: THREE.Vector3; target: THREE.Vector3; fov: number }

/*
 * Arriving outside the shop, close enough to read the sleeves in the window.
 * The camera stands on the storefront's own centreline so the façade is seen
 * dead-on, at roughly twice a pedestrian's eye height, and aims a little off
 * so the window and doorway sit left of centre with the right of frame kept
 * dark for the release caption.
 *
 * The neon is 0.72 tall against a 0.48 building: framing all of it would push
 * the shop down to a third of the width, so the sign is deliberately cropped
 * at the top and used as a framing edge instead. Standing this close also
 * puts the carriageway and the railway behind the lens rather than across
 * the bottom of the shot.
 */
const POSE_WIDE: VenuePose = {
  pos: shopPoint(0, 0.2, 0.85),
  target: shopPoint(0.15, 0.263, 0),
  fov: 40,
}
const POSE_TABLET: VenuePose = {
  pos: shopPoint(0, 0.22, 0.95),
  target: shopPoint(0.12, 0.29, 0),
  fov: 46,
}
const POSE_PHONE: VenuePose = {
  pos: shopPoint(0, 0.26, 1.02),
  target: shopPoint(0.05, 0.32, 0),
  fov: 62,
}

export function venuePose(aspect: number): VenuePose {
  if (aspect >= 1.25) return POSE_WIDE
  if (aspect >= 0.9) return POSE_TABLET
  return POSE_PHONE
}

/**
 * Curated approach: the camera leaves the hero angle, drops over the canyon
 * mouth and glides down the street to the shop. Both control points sit in
 * the clear band inside the track, so nothing is flown through.
 */
export const VENUE_C1 = new THREE.Vector3(1.3, 2.6, 4.3)
export const VENUE_C2 = new THREE.Vector3(3.1, 1.05, 1.6)

/** how far forward the last train pulls out so it never masks the storefront */
/* far enough that it clears the wider close-up frame, not just the storefront */
export const TRAIN_AWAY = 0.8

/** shop-local anchors the DOM controls are pinned to */
export const SHOP_ANCHOR: [number, number, number] = [-0.03, 0.13, 0.02]
export const SHOP_ANCHOR_TOP: [number, number, number] = [-0.03, 0.46, 0.02]
export const SLEEVE_LOCAL: [number, number, number][] = [
  [-0.185, 0.104, -0.048],
  [-0.11, 0.104, -0.048],
  [-0.035, 0.104, -0.048],
]

/* ------------------------------------------------------------ view state */

export const venue = {
  view: 'city' as VenueView,
  /** 0 = city hero, 1 = settled venue close-up */
  p: 0,
  /** clock time the current transition began; < 0 until the driver anchors it */
  anchor: -1,
  /** progress the current transition started from */
  from: 0,
  reduced: false,
  /** shop highlight: pointer hover or keyboard focus, eased in the render loop */
  hotTarget: 0,
  hot: 0,
  /** default selection is LTR-001 */
  selected: 0,
  /** hovered/focused sleeve, -1 for none */
  hover: -1,
}

if (typeof window !== 'undefined') {
  ;(window as unknown as { __venue?: typeof venue }).__venue = venue
}

export const inVenue = () => venue.view !== 'city'
export const venueMoving = () =>
  venue.view === 'entering-releases' || venue.view === 'leaving-releases'

export function startVenue(reduced: boolean) {
  venue.view = 'entering-releases'
  venue.reduced = reduced
  venue.anchor = -1
  venue.from = venue.p
  venue.hover = -1
}

export function endVenue(reduced: boolean) {
  venue.view = 'leaving-releases'
  venue.reduced = reduced
  venue.anchor = -1
  venue.from = venue.p
  venue.hover = -1
  venue.hotTarget = 0
}

/** eased 0..1 blend between the hero frame and the settled close-up */
export function venueProgress() {
  return easeInOut(clamp01(venue.p))
}

/** the last train pulls out ahead of the camera, and returns behind it */
export function venueTrainOffset() {
  switch (venue.view) {
    case 'city':
      return 0
    case 'entering-releases':
      return TRAIN_AWAY * easeInOut(clamp01(venue.p))
    case 'releases':
      return TRAIN_AWAY
    default:
      // leaving: p falls 1 -> 0, so the train arrives from the far side
      return -TRAIN_AWAY * easeInOut(clamp01(venue.p))
  }
}

/** local shop highlight, 0..1 — hover, focus, or the one-shot settle flutter */
export function shopHot() {
  return venue.hot
}

/**
 * One restrained "the shop is open" beat a couple of seconds after the city
 * settles: the vertical neon flutters and the window light swells, then both
 * fall back. Returns 0..1 and never fires again during that visit.
 */
export function discoverPulse(lifeT: number) {
  if (lifeT < 2.3 || lifeT > 3.7) return 0
  const u = (lifeT - 2.3) / 1.4
  // two quick beats inside one gentle envelope
  const env = Math.sin(Math.PI * u)
  return env * env * (0.62 + 0.38 * Math.sin(u * Math.PI * 4.5))
}

/* ----------------------------------------------------------- selection */

let selectListener: ((i: number) => void) | null = null

/** the caption is live text, so React needs to hear about scene-side picks */
export function onReleaseSelect(fn: ((i: number) => void) | null) {
  selectListener = fn
}

export function selectRelease(i: number) {
  if (i < 0 || i > 2 || venue.selected === i) return
  venue.selected = i
  selectListener?.(i)
  // hooked here rather than in the interface so a scene-side pick and a
  // sleeve button behave identically
  audioRelease(i)
}

/* ------------------------------------------------- projected DOM anchors */

export type ScreenAnchor = { x: number; y: number; s: number; on: boolean }

/**
 * Written every frame by the scene, read every frame by the DOM controls, so
 * the accessible hit areas stay glued to the building as the camera moves and
 * as the viewport changes size. No React state is involved.
 */
export const screen = {
  shop: { x: 0, y: 0, s: 0, on: false } as ScreenAnchor,
  sleeves: [0, 1, 2].map(() => ({ x: 0, y: 0, s: 0, on: false })) as ScreenAnchor[],
}
