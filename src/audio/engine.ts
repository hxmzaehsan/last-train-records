import { ALL_IDS, SOUNDS, type Bus, type SoundId } from './manifest'

/**
 * The audio layer, built the same way as `timeline` and `venue`: one mutable
 * singleton, mutated in place, read by plain functions. Nothing here is React
 * state and nothing here is allowed to affect a visual code path — muted, the
 * experience runs exactly as it did before Stage 5.
 *
 * The context is created inside the "Drop the needle" click and never before,
 * which is both the browser's autoplay rule and the project's own rule that
 * nothing may make a sound until the visitor asks for it.
 *
 * Entrance cues are *scheduled* on the audio clock rather than fired from the
 * render loop, so a dropped frame can never shift a sound. The visual timeline
 * is already wall-clock anchored, so the two stay locked without talking.
 */

const STORAGE_KEY = 'ltr-sound'

type Voice = {
  src: AudioBufferSourceNode
  gain: GainNode
}

type Bed = {
  id: SoundId
  /** the two offset voices that cross-fade to hide the loop seam */
  voices: Voice[]
  /** the bed's own fader, on top of its manifest gain */
  fader: GainNode
  /** per-bed tone control: this is what "stepping indoors" actually is */
  filter: BiquadFilterNode
  timer: number | null
  stopped: boolean
}

function readStored(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'off'
  } catch {
    return false
  }
}

export const audio = {
  ready: false,
  /**
   * The visitor's choice, remembered for this visit only. Read at module load
   * rather than when the context is built, so the control shows the truth
   * before anything has been pressed.
   */
  muted: typeof window !== 'undefined' && readStored(),
  /** true once every wave-0 buffer has decoded */
  primed: false,
  failed: false,
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
const buses: Partial<Record<Bus, { gain: GainNode; filter: BiquadFilterNode }>> = {}
const buffers = new Map<SoundId, AudioBuffer>()
const loading = new Map<SoundId, Promise<void>>()
/** everything currently sounding, so a rewind can silence the lot */
let scheduled: Voice[] = []
const beds = new Map<string, Bed>()

if (typeof window !== 'undefined') {
  ;(window as unknown as { __audio?: typeof audio }).__audio = audio
  // dev handle, same spirit as __tl / __venue: the preview has no mixer
  ;(window as unknown as { __audioState?: () => unknown }).__audioState = () => ({
    ...audio,
    state: ctx?.state ?? 'none',
    master: master?.gain.value ?? null,
    loaded: buffers.size,
    pending: loading.size,
    voices: scheduled.length,
    beds: [...beds.entries()].map(([k, b]) => ({
      key: k,
      id: b.id,
      gain: +b.fader.gain.value.toFixed(4),
      hz: Math.round(b.filter.frequency.value),
      copies: b.voices.length,
    })),
  })
}

/* ------------------------------------------------------------ lifecycle */

/**
 * Called from the first real click. Safe to call again: it only builds once,
 * and it resumes a context the browser suspended when the tab went away.
 */
export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) {
    audio.failed = true
    return
  }
  try {
    ctx = new Ctor()
  } catch {
    audio.failed = true
    return
  }

  // a limiter on the end so no combination of layers can ever clip
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -3
  limiter.knee.value = 6
  limiter.ratio.value = 12
  limiter.attack.value = 0.003
  limiter.release.value = 0.25
  limiter.connect(ctx.destination)

  master = ctx.createGain()
  master.gain.value = audio.muted ? 0 : 1
  master.connect(limiter)

  for (const bus of ['music', 'ambience', 'sfx'] as Bus[]) {
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 20000
    filter.Q.value = 0.4
    const gain = ctx.createGain()
    gain.gain.value = 1
    filter.connect(gain)
    gain.connect(master)
    buses[bus] = { gain, filter }
  }

  audio.ready = true
  // wave 0 is usually already decoded by the prefetch; the rest follow in
  // order so the entrance never competes for bandwidth with the shop
  void loadWave(0)
    .then(() => {
      audio.primed = true
      return loadWave(1)
    })
    .then(() => loadWave(2))
}

export const now = () => (ctx ? ctx.currentTime : 0)

/* -------------------------------------------------------------- loading */

/**
 * Decoding needs *a* context but not a running one, so an OfflineAudioContext
 * lets the entrance sounds be ready before the visitor has clicked anything.
 * Nothing can be heard from it — it is a decoder, not an output.
 */
let decoder: BaseAudioContext | null = null
function decoderCtx(): BaseAudioContext | null {
  if (ctx) return ctx
  if (decoder) return decoder
  const Ctor =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext
  if (!Ctor) return null
  try {
    decoder = new Ctor(2, 1, 44100)
  } catch {
    return null
  }
  return decoder
}

async function load(id: SoundId): Promise<void> {
  if (buffers.has(id)) return
  const existing = loading.get(id)
  if (existing) return existing
  const target = decoderCtx()
  if (!target) return
  const task = (async () => {
    try {
      const res = await fetch(SOUNDS[id].url)
      if (!res.ok) throw new Error(String(res.status))
      const bytes = await res.arrayBuffer()
      // decodeAudioData runs off the main thread, so this cannot stutter the
      // render loop however many files are in flight
      const buf = await target.decodeAudioData(bytes)
      buffers.set(id, buf)
    } catch {
      // a missing or undecodable file simply means that cue stays silent
    } finally {
      loading.delete(id)
    }
  })()
  loading.set(id, task)
  return task
}

/**
 * Fetch and decode only the entrance sounds, before any interaction, so the
 * very first press is not silent while its buffers are still arriving. The
 * heavier city and shop material waits for the click, because a visitor who
 * never presses play should not pay for it.
 */
export function prefetchAudio() {
  void loadWave(0).then(() => {
    audio.primed = true
  })
}

function loadWave(wave: 0 | 1 | 2) {
  return Promise.all(ALL_IDS.filter((id) => SOUNDS[id].wave === wave).map(load))
}

export const hasBuffer = (id: SoundId) => buffers.has(id)

/* ---------------------------------------------------------------- mute */

export function setMuted(muted: boolean) {
  audio.muted = muted
  try {
    sessionStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on')
  } catch {
    /* private mode: the choice just doesn't outlive the page */
  }
  if (!ctx || !master) return
  if (ctx.state === 'suspended') void ctx.resume()
  // a ramp rather than a cut, so muting mid-phrase isn't a click
  const t = ctx.currentTime
  master.gain.cancelScheduledValues(t)
  master.gain.setValueAtTime(master.gain.value, t)
  master.gain.linearRampToValueAtTime(muted ? 0 : 1, t + 0.12)
}

export const isMuted = () => audio.muted

/* ------------------------------------------------------------ one-shots */

/**
 * Play a one-shot at an absolute time on the audio clock. `at` of 0 means
 * "now". A cue whose buffer has not arrived yet is skipped rather than
 * delayed — audio must never hold up the visuals.
 */
export function play(id: SoundId, at = 0, gainScale = 1) {
  if (!ctx || !audio.ready) return null
  const buf = buffers.get(id)
  if (!buf) return null
  const spec = SOUNDS[id]
  const bus = buses[spec.bus]
  if (!bus) return null

  const src = ctx.createBufferSource()
  src.buffer = buf
  const gain = ctx.createGain()
  gain.gain.value = spec.gain * gainScale
  src.connect(gain)
  gain.connect(bus.filter)
  const when = at > 0 ? at : ctx.currentTime
  src.start(when)

  const voice: Voice = { src, gain }
  scheduled.push(voice)
  src.onended = () => {
    scheduled = scheduled.filter((v) => v !== voice)
    try {
      gain.disconnect()
    } catch {
      /* already torn down */
    }
  }
  return voice
}

/** Silence everything that is sounding or waiting to sound. */
export function stopAll(fade = 0.25) {
  if (!ctx) return
  const t = ctx.currentTime
  for (const v of scheduled) {
    try {
      v.gain.gain.cancelScheduledValues(t)
      v.gain.gain.setValueAtTime(v.gain.gain.value, t)
      v.gain.gain.linearRampToValueAtTime(0.0001, t + fade)
      v.src.stop(t + fade + 0.02)
    } catch {
      /* a source that never started throws on stop; nothing to do */
    }
  }
  scheduled = []
  for (const key of [...beds.keys()]) stopBed(key, fade)
}

/* ----------------------------------------------------------------- beds */

/**
 * Neither generator supports seamless loops, so every bed is manufactured:
 * two copies of the same buffer running half a length apart, cross-faded on
 * an equal-power curve. The seam lands in the middle of the other copy, where
 * there is nothing to hear.
 */
const XFADE = 3.0

export function startBed(key: string, id: SoundId, target = 1, fadeIn = 1.5) {
  if (!ctx || !audio.ready) return
  const existing = beds.get(key)
  if (existing && existing.id === id) {
    rampBed(key, target, fadeIn)
    return
  }
  if (existing) stopBed(key, 0.8)

  const buf = buffers.get(id)
  if (!buf) {
    // Not decoded yet: try again once it lands, as long as nothing else has
    // claimed this slot meanwhile. Only ever one retry — if the file is
    // missing the load resolves without a buffer, and retrying on that would
    // spin forever.
    void load(id).then(() => {
      if (!buffers.has(id) || beds.has(key)) return
      startBed(key, id, target, fadeIn)
    })
    return
  }

  const spec = SOUNDS[id]
  const bus = buses[spec.bus]
  if (!bus) return

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 20000
  filter.Q.value = 0.4
  filter.connect(bus.filter)

  const fader = ctx.createGain()
  fader.gain.value = 0.0001
  fader.connect(filter)
  fader.gain.exponentialRampToValueAtTime(Math.max(0.0001, target * spec.gain), ctx.currentTime + fadeIn)

  const bed: Bed = { id, voices: [], fader, filter, timer: null, stopped: false }
  beds.set(key, bed)

  const period = Math.max(buf.duration - XFADE, 4)

  const spawn = (when: number) => {
    if (!ctx || bed.stopped) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, when)
    g.gain.linearRampToValueAtTime(1, when + XFADE)
    g.gain.setValueAtTime(1, when + buf.duration - XFADE)
    g.gain.linearRampToValueAtTime(0.0001, when + buf.duration)
    src.connect(g)
    g.connect(fader)
    src.start(when)
    src.stop(when + buf.duration + 0.05)
    const voice: Voice = { src, gain: g }
    bed.voices.push(voice)
    src.onended = () => {
      bed.voices = bed.voices.filter((v) => v !== voice)
      try {
        g.disconnect()
      } catch {
        /* already torn down */
      }
    }
  }

  // first copy starts immediately at full level so the bed does not fade up
  // twice; every copy after it cross-fades in
  const t0 = ctx.currentTime
  const first = ctx.createBufferSource()
  first.buffer = buf
  const fg = ctx.createGain()
  fg.gain.setValueAtTime(1, t0)
  fg.gain.setValueAtTime(1, t0 + buf.duration - XFADE)
  fg.gain.linearRampToValueAtTime(0.0001, t0 + buf.duration)
  first.connect(fg)
  fg.connect(fader)
  first.start(t0)
  first.stop(t0 + buf.duration + 0.05)
  const firstVoice: Voice = { src: first, gain: fg }
  bed.voices.push(firstVoice)
  first.onended = () => {
    bed.voices = bed.voices.filter((v) => v !== firstVoice)
  }

  let next = t0 + period
  spawn(next)
  // keep one copy queued ahead of the playhead; a plain interval is enough
  // because every copy is scheduled at an absolute time, not "now"
  bed.timer = window.setInterval(() => {
    if (!ctx || bed.stopped) return
    // only ever a few seconds of lookahead, so a long visit never accumulates
    // a queue of scheduled sources
    while (next < ctx.currentTime + 5) {
      next += period
      spawn(next)
    }
  }, 1000)
}

export function rampBed(key: string, target: number, time = 0.8) {
  if (!ctx) return
  const bed = beds.get(key)
  if (!bed) return
  const spec = SOUNDS[bed.id]
  const t = ctx.currentTime
  bed.fader.gain.cancelScheduledValues(t)
  bed.fader.gain.setValueAtTime(Math.max(0.0001, bed.fader.gain.value), t)
  bed.fader.gain.linearRampToValueAtTime(Math.max(0.0001, target * spec.gain), t + time)
}

export function stopBed(key: string, fade = 1.0) {
  if (!ctx) return
  const bed = beds.get(key)
  if (!bed) return
  beds.delete(key)
  bed.stopped = true
  if (bed.timer !== null) window.clearInterval(bed.timer)
  const t = ctx.currentTime
  bed.fader.gain.cancelScheduledValues(t)
  bed.fader.gain.setValueAtTime(Math.max(0.0001, bed.fader.gain.value), t)
  bed.fader.gain.linearRampToValueAtTime(0.0001, t + fade)
  for (const v of bed.voices) {
    try {
      v.src.stop(t + fade + 0.05)
    } catch {
      /* not started */
    }
  }
  window.setTimeout(() => {
    try {
      bed.fader.disconnect()
      bed.filter.disconnect()
    } catch {
      /* already torn down */
    }
  }, (fade + 0.2) * 1000)
}

/** Close a single bed down without touching anything else on its bus. */
export function setBedFilter(key: string, hz: number, time = 0.2) {
  if (!ctx) return
  const bed = beds.get(key)
  if (!bed) return
  const t = ctx.currentTime
  bed.filter.frequency.cancelScheduledValues(t)
  bed.filter.frequency.setTargetAtTime(hz, t, Math.max(0.01, time / 3))
}

export const bedPlaying = (key: string) => beds.has(key)
export const bedId = (key: string) => beds.get(key)?.id ?? null

/* ------------------------------------------------------- bus automation */

/** Walking into the shop closes the city down rather than switching it off. */
export function setBusFilter(bus: Bus, hz: number, time = 0.2) {
  if (!ctx) return
  const b = buses[bus]
  if (!b) return
  const t = ctx.currentTime
  b.filter.frequency.cancelScheduledValues(t)
  b.filter.frequency.setTargetAtTime(hz, t, Math.max(0.01, time / 3))
}

export function setBusGain(bus: Bus, value: number, time = 0.2) {
  if (!ctx) return
  const b = buses[bus]
  if (!b) return
  const t = ctx.currentTime
  b.gain.gain.cancelScheduledValues(t)
  b.gain.gain.setTargetAtTime(value, t, Math.max(0.01, time / 3))
}

/** Give the whole mix back to the browser when the tab is hidden. */
export function suspendAudio() {
  if (ctx && ctx.state === 'running') void ctx.suspend()
}
export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') void ctx.resume()
}
