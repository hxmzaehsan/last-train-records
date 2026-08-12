import { NEEDLE_ANGLE } from './helpers'
import { venueTrainOffset } from './venue'

/**
 * One shared transformation timeline, mutated inside the render loop and read
 * by every scene component through plain functions — no per-frame React state.
 *
 * `t` is the master progress of the whole entrance. The camera crane occupies
 * its first stretch; the physical construction runs on `u`, a remapped
 * sub-range, so the approved groove-to-city choreography is unchanged.
 *
 * The world group rotates by -theta while the needle stays fixed. An element
 * whose authored angle sits `d` radians behind the needle passes under the
 * stylus when theta reaches `d`, which is the moment it starts to rise.
 */

export const TWO_PI = Math.PI * 2

/** total wall-clock seconds for the entrance */
export const RUN_SECONDS = 10.5
export const RUN_SECONDS_REDUCED = 2.6
/** seconds to ease back from the settled hero to standby */
export const RESET_SECONDS = 1.6

/** fraction of `t` over which the camera cranes from overhead to the hero */
const CAM_SPAN = 0.4
/** fraction of `t` before the physical construction begins */
const BUILD_LEAD = 0.1

export type TimelineMode = 'idle' | 'playing' | 'done' | 'resetting'

export const timeline = {
  mode: 'idle' as TimelineMode,
  /** normalised 0..1 progress of the whole entrance */
  t: 0,
  /** normalised 0..1 progress of the physical construction */
  u: 0,
  /** current construction sweep angle (0..2π) */
  theta: 0,
  reduced: false,
  notified: false,
  /** seconds since the city settled (drives ambient life) */
  lifeT: 0,
  /** clock time the current run/reset began; < 0 until the driver anchors it */
  anchor: -1,
  /** progress the reset started from */
  anchorT: 1,
  /** the standby control is hovered or focused — the ring answers a little */
  cueHot: false,
  /** dev/debug: freeze the driver while keeping the current pose */
  paused: false,
}

if (typeof window !== 'undefined') {
  ;(window as unknown as { __tl?: typeof timeline }).__tl = timeline
}

export function startTimeline(reduced: boolean) {
  timeline.mode = 'playing'
  timeline.t = 0
  timeline.u = 0
  timeline.theta = 0
  timeline.reduced = reduced
  timeline.notified = false
  timeline.lifeT = 0
  timeline.anchor = -1
}

/** Ease the settled hero back to standby, reversing the construction. */
export function resetTimeline() {
  timeline.mode = 'resetting'
  timeline.lifeT = 0
  timeline.anchor = -1
  timeline.anchorT = timeline.t
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export function easeInOutCubic(u: number) {
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}

export function easeOutCubic(u: number) {
  return 1 - Math.pow(1 - u, 3)
}

/** Smooth at both ends — used for reveals so nothing pops or snaps. */
export function smoothEase(u: number) {
  return u * u * (3 - 2 * u)
}

/** Construction progress remapped out of the master timeline. */
export function buildProgress(t: number) {
  return clamp01((t - BUILD_LEAD) / (1 - BUILD_LEAD))
}

/** Camera crane progress: overhead label (0) to the settled hero (1). */
export function cameraProgress(t: number) {
  return easeInOutCubic(clamp01(t / CAM_SPAN))
}

/** Art-directed rotation: one slow full turn that settles at the authored pose. */
export function rotationTheta(u: number) {
  if (timeline.reduced) return 0
  const v = clamp01((u - 0.06) / 0.9)
  return easeInOutCubic(v) * TWO_PI
}

/** Angular distance behind the needle for an authored angle. */
export function distBehindNeedle(a: number) {
  return (((NEEDLE_ANGLE - a) % TWO_PI) + TWO_PI) % TWO_PI
}

export function distOfPosition(x: number, z: number) {
  return distBehindNeedle(Math.atan2(z, x))
}

/**
 * Reveal progress for an element `d` radians behind the needle.
 * `dur` is how much sweep (radians) the rise takes; `lead` delays it.
 */
export function revealProgress(d: number, dur = 0.5, lead = 0) {
  if (timeline.mode === 'idle') return 0
  if (timeline.mode === 'done') return 1
  if (timeline.reduced) {
    const s = d / TWO_PI
    return clamp01((timeline.u - 0.08 - s * 0.35 - lead * 0.04) / 0.5)
  }
  return clamp01((timeline.theta - d - lead) / dur)
}

/** Neon and interior light pools switch on after their building has risen. */
export function neonGate(a: number) {
  const p = revealProgress(distBehindNeedle(a), 0.45, 0.55)
  return clamp01((p - 0.6) / 0.4)
}

/** Tonearm: 0 = raised (idle), 1 = stylus on the groove. */
export function armProgress() {
  if (timeline.mode === 'idle') return 0
  if (timeline.mode === 'done') return 1
  const span = timeline.reduced ? 0.25 : 0.08
  return easeOutCubic(clamp01(timeline.u / span))
}

/**
 * The train arrives from the far side of the built city and drives forward.
 * Once the city has settled it also answers the venue camera: the last train
 * pulls out of the platform so it can never mask the record shop close-up,
 * and rolls back in as the camera returns to the hero frame.
 */
export function trainState(): { visible: boolean; off: number } {
  if (timeline.mode === 'idle') return { visible: false, off: -2.9 }
  if (timeline.mode === 'done') return { visible: true, off: venueTrainOffset() }
  if (timeline.reduced) {
    const v = clamp01((timeline.u - 0.55) / 0.4)
    return { visible: v > 0, off: 0 }
  }
  const v = clamp01((timeline.u - 0.56) / 0.38)
  return { visible: v > 0, off: -2.9 * (1 - easeInOutCubic(v)) }
}

/**
 * Colour of the label ring: cyan while the record is waiting, crossing to
 * magenta as it starts. Driven off `t`, so the rewind runs it back to cyan
 * on the way to standby without any extra state.
 */
export function ringWarm() {
  if (timeline.mode === 'idle') return 0
  if (timeline.mode === 'done') return 1
  // the rewind is short, so the cool-down gets its own wider window rather
  // than snapping back to cyan in the last fraction of a second
  if (timeline.mode === 'resetting') return smoothEase(clamp01((timeline.t - 0.25) / 0.45))
  return smoothEase(clamp01((timeline.t - 0.02) / 0.1))
}

const fract = (v: number) => v - Math.floor(v)
const hash1 = (n: number) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453)

/** how often a flicker cluster may occur (seconds) */
const NEON_WINDOW = 6.5

/**
 * The magenta label ring behaves like a slightly unreliable late-night neon
 * sign: lit and steady most of the time, then an occasional short cluster of
 * two to four irregular brightness changes, sometimes a near-complete dropout,
 * and a brief recovery surge before settling again.
 *
 * The pattern never repeats visibly: each window's start offset, length, step
 * count and per-step level are all drawn from a hash of that window's index,
 * so no two clusters share a shape and the calm gaps vary too.
 */
export function ringIntensity(clock: number) {
  const standby = timeline.mode === 'idle' || timeline.mode === 'resetting'
  const hot = timeline.cueHot ? 0.16 : 0

  if (standby) {
    // reduced motion: a steady dim glow, no flicker at all
    if (timeline.reduced) return 0.52 + hot

    const idx = Math.floor(clock / NEON_WINDOW)
    const start = idx * NEON_WINDOW + 1.2 + hash1(idx) * (NEON_WINDOW - 2.4)
    const span = 0.3 + hash1(idx + 37) * 0.45
    const local = clock - start
    const calm = 0.72 + 0.03 * Math.sin(clock * 0.6) + hot

    if (local >= 0 && local < span) {
      const steps = 2 + Math.floor(hash1(idx + 11) * 3) // 2..4 changes
      const step = Math.min(steps - 1, Math.floor((local / span) * steps))
      const h = hash1(idx * 31.7 + step * 7.3)
      if (h < 0.16) return 0.05 + hot // near-complete dropout
      if (h < 0.46) return 0.3 + hot // partial dim
      if (h < 0.78) return 0.62 + hot
      return 1.15 + hot // momentary over-drive
    }
    // brief brighter recovery just after the cluster, then back to calm
    if (local >= span && local < span + 0.16) return 1.05 + hot
    return calm
  }

  // activation: one short electric flicker, a surge, then a confident glow
  if (!timeline.reduced && timeline.t < 0.02) {
    return hash1(Math.floor(clock * 26)) < 0.4 ? 0.22 : 1.1
  }
  if (!timeline.reduced && timeline.t < 0.045) return 1.3
  return 0.95
}
