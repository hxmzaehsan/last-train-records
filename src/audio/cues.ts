import {
  audio,
  initAudio,
  now,
  play,
  rampBed,
  setBedFilter,
  startBed,
  stopAll,
  stopBed,
} from './engine'
import type { SoundId } from './manifest'

/**
 * What plays, and exactly when.
 *
 * Times are seconds from the "Drop the needle" press and were taken from the
 * real animation, not estimated: the stylus lands at 1.81 s, the city rises
 * between 4.5 s and 6.3 s, the train runs from 6.34 s to 9.93 s, and the whole
 * entrance is 10.5 s (2.6 s with reduced motion).
 *
 * One-shots are scheduled on the audio clock at press time so a dropped frame
 * cannot shift them. Beds fade in on ordinary timers, because a bed arriving
 * 30 ms early is not something anyone can hear.
 */

type Cue = { at: number; id: SoundId; gain?: number }

/* Full motion. The city's buildings all rise inside one ~1.7 s window, so they
   get a single layered swell rather than seven separate noises. */
const ENTRANCE: Cue[] = [
  { at: 0.0, id: 'sfx-cue-press' },
  { at: 0.05, id: 'sfx-motor-start' },
  { at: 1.05, id: 'sfx-tonearm' },
  { at: 1.72, id: 'sfx-stylus-contact' },
  { at: 1.62, id: 'sfx-groove-to-rail' },
  { at: 4.45, id: 'sfx-city-rise' },
  // four scattered tube ignitions, not one per sign
  { at: 4.82, id: 'sfx-neon-strike', gain: 0.9 },
  { at: 5.31, id: 'sfx-neon-strike', gain: 0.6 },
  { at: 5.94, id: 'sfx-neon-strike', gain: 1.0 },
  { at: 6.48, id: 'sfx-neon-strike', gain: 0.45 },
  { at: 6.34, id: 'sfx-train-arrive' },
]

/* Reduced motion: cues are dropped rather than sped up, because a sped-up
   mechanical sound reads as comedy. No neon cluster, and the train is played
   from its arrival rather than its long approach. */
const ENTRANCE_REDUCED: Cue[] = [
  { at: 0.0, id: 'sfx-cue-press' },
  { at: 0.05, id: 'sfx-motor-start' },
  { at: 0.26, id: 'sfx-tonearm' },
  { at: 0.8, id: 'sfx-stylus-contact' },
  { at: 0.9, id: 'sfx-groove-to-rail' },
  { at: 1.3, id: 'sfx-city-rise' },
  { at: 1.55, id: 'sfx-train-arrive' },
]

/** when the settled city fades up, and how long it takes */
const SETTLE = { full: { at: 6.3, over: 3.2 }, reduced: { at: 1.5, over: 1.0 } }

const BED = {
  cityMusic: 'city-music',
  shopMusic: 'shop-music',
  release: 'release',
  rail: 'rail',
  neon: 'neon',
  street: 'street',
  shopRoom: 'shop-room',
} as const

const RELEASE_LAYERS: SoundId[] = ['music-ltr-001', 'music-ltr-002', 'music-ltr-003']

/** open at the top, closed down to this when the camera is at the storefront */
const CITY_OPEN_HZ = 20000
const CITY_SHOP_HZ = 900

let timers: number[] = []
let shopOpen = false
let currentRelease = 0

function clearTimers() {
  for (const t of timers) window.clearTimeout(t)
  timers = []
}

const later = (ms: number, fn: () => void) => {
  timers.push(window.setTimeout(fn, ms))
}

/* --------------------------------------------------------------- start */

/** Called from the same click that starts the visual timeline. */
export function audioStart(reduced: boolean) {
  initAudio()
  if (!audio.ready) return
  clearTimers()

  const t0 = now()
  const table = reduced ? ENTRANCE_REDUCED : ENTRANCE
  for (const cue of table) play(cue.id, t0 + cue.at, cue.gain ?? 1)

  // the emergence: near-silent room tone that grows into the city bed
  play('music-assembly', t0 + (reduced ? 0.2 : 0.3))

  const settle = reduced ? SETTLE.reduced : SETTLE.full
  later(settle.at * 1000, () => {
    startBed(BED.cityMusic, 'music-city', 1, settle.over)
    startBed(BED.rail, 'amb-rail-resonance', 1, settle.over)
    startBed(BED.neon, 'amb-neon-hum', 1, settle.over)
    startBed(BED.street, 'amb-street-quiet', 1, settle.over)
  })
}

/* -------------------------------------------------------------- rewind */

/** The rewind is the only hard stop in the piece. Standby is silent. */
export function audioReset() {
  shopOpen = false
  currentRelease = 0
  if (!audio.ready) return
  clearTimers()
  play('sfx-rewind')
  for (const key of Object.values(BED)) rampBed(key, 0.0001, 0.35)
  later(1600, () => stopAll(0.2))
}

/* ---------------------------------------------------------------- shop */

/**
 * Entering the shop is a change of perspective, not a change of track: the
 * city closes down behind glass while the shop's own room opens up. Driven
 * every frame from `venueProgress()`, so it is automatically the same length
 * as the camera move, reduced motion included.
 */
export function audioVenue(p: number) {
  if (!audio.ready) return

  if (p > 0.02) {
    if (!shopOpen) {
      shopOpen = true
      startBed(BED.shopMusic, 'music-shop', 0.0001, 0.1)
      startBed(BED.shopRoom, 'amb-shop-room', 0.0001, 0.1)
      startRelease(currentRelease, 0.1)
    }
  } else if (shopOpen) {
    shopOpen = false
    stopBed(BED.shopMusic, 0.6)
    stopBed(BED.shopRoom, 0.6)
    stopBed(BED.release, 0.6)
  }

  // the city does not switch off — it goes outside
  rampBed(BED.cityMusic, 1 - 0.72 * p, 0.12)
  rampBed(BED.street, 1 - 0.55 * p, 0.12)
  rampBed(BED.neon, 1 - 0.4 * p, 0.12)
  rampBed(BED.rail, 1 - 0.3 * p, 0.12)
  const hz = CITY_OPEN_HZ * Math.pow(CITY_SHOP_HZ / CITY_OPEN_HZ, p)
  setBedFilter(BED.cityMusic, hz, 0.12)
  setBedFilter(BED.street, hz, 0.12)

  if (shopOpen) {
    rampBed(BED.shopMusic, p, 0.12)
    rampBed(BED.shopRoom, p, 0.12)
    rampBed(BED.release, p, 0.12)
  }
}

/* ------------------------------------------------------------ releases */

function startRelease(i: number, fade: number) {
  startBed(BED.release, RELEASE_LAYERS[i], shopOpen ? 1 : 0.0001, fade)
}

/**
 * Picking a record fades one layer out and another in over the *same* shop
 * bed. The soundtrack itself never restarts.
 */
export function audioRelease(i: number) {
  currentRelease = i
  if (!audio.ready) return
  play('sfx-sleeve-select')
  if (!shopOpen) return
  stopBed(BED.release, 1.0)
  window.setTimeout(() => {
    if (shopOpen) startRelease(i, 1.2)
  }, 120)
}
