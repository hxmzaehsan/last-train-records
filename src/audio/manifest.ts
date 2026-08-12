/**
 * Every sound in the piece, its bus, and where it sits in the mix.
 *
 * All twenty files were loudness-matched on the way in (beds to -23 LUFS,
 * one-shots peak-normalised to -6 dBFS), so `gain` here is a pure balance
 * decision and nothing else. If something is too loud, this is the only file
 * that needs touching.
 */

export type Bus = 'music' | 'ambience' | 'sfx'

export type SoundId =
  | 'music-assembly'
  | 'music-city'
  | 'music-shop'
  | 'music-ltr-001'
  | 'music-ltr-002'
  | 'music-ltr-003'
  | 'amb-rail-resonance'
  | 'amb-neon-hum'
  | 'amb-street-quiet'
  | 'amb-shop-room'
  | 'sfx-cue-press'
  | 'sfx-motor-start'
  | 'sfx-tonearm'
  | 'sfx-stylus-contact'
  | 'sfx-groove-to-rail'
  | 'sfx-city-rise'
  | 'sfx-neon-strike'
  | 'sfx-train-arrive'
  | 'sfx-sleeve-select'
  | 'sfx-rewind'

export type SoundSpec = {
  url: string
  bus: Bus
  /** settled level, linear gain */
  gain: number
  /** loading priority: 0 is needed within two seconds of the first click */
  wave: 0 | 1 | 2
}

/*
 * Audio is fetched at runtime, so it cannot use the build-time asset pipeline.
 * BASE_URL carries whatever the site is served from — `/` locally, `./` under
 * a GitHub Pages project path — which keeps one build working in both.
 */
const base = import.meta.env.BASE_URL
const asset = (path: string) => `${base}${base.endsWith('/') ? '' : '/'}${path}`

const music = (n: string) => asset(`audio/music/${n}.mp3`)
const amb = (n: string) => asset(`audio/ambience/${n}.mp3`)
const sfx = (n: string) => asset(`audio/sfx/${n}.mp3`)

export const SOUNDS: Record<SoundId, SoundSpec> = {
  // ---- music ---------------------------------------------------------
  'music-assembly': { url: music('music-assembly'), bus: 'music', gain: 0.9, wave: 0 },
  'music-city': { url: music('music-city'), bus: 'music', gain: 0.85, wave: 1 },
  'music-shop': { url: music('music-shop'), bus: 'music', gain: 0.9, wave: 2 },
  // release layers sit under the shop bed, present but never in front of it
  'music-ltr-001': { url: music('music-ltr-001'), bus: 'music', gain: 0.42, wave: 2 },
  'music-ltr-002': { url: music('music-ltr-002'), bus: 'music', gain: 0.42, wave: 2 },
  'music-ltr-003': { url: music('music-ltr-003'), bus: 'music', gain: 0.42, wave: 2 },

  // ---- living environment --------------------------------------------
  'amb-rail-resonance': { url: amb('amb-rail-resonance'), bus: 'ambience', gain: 0.62, wave: 1 },
  'amb-neon-hum': { url: amb('amb-neon-hum'), bus: 'ambience', gain: 0.3, wave: 1 },
  'amb-street-quiet': { url: amb('amb-street-quiet'), bus: 'ambience', gain: 0.5, wave: 1 },
  'amb-shop-room': { url: amb('amb-shop-room'), bus: 'ambience', gain: 0.72, wave: 2 },

  // ---- physical interaction ------------------------------------------
  'sfx-cue-press': { url: sfx('sfx-cue-press'), bus: 'sfx', gain: 0.34, wave: 0 },
  'sfx-motor-start': { url: sfx('sfx-motor-start'), bus: 'sfx', gain: 0.5, wave: 0 },
  'sfx-tonearm': { url: sfx('sfx-tonearm'), bus: 'sfx', gain: 0.46, wave: 0 },
  'sfx-stylus-contact': { url: sfx('sfx-stylus-contact'), bus: 'sfx', gain: 0.6, wave: 0 },
  'sfx-groove-to-rail': { url: sfx('sfx-groove-to-rail'), bus: 'sfx', gain: 0.7, wave: 0 },
  'sfx-city-rise': { url: sfx('sfx-city-rise'), bus: 'sfx', gain: 0.55, wave: 0 },
  'sfx-neon-strike': { url: sfx('sfx-neon-strike'), bus: 'sfx', gain: 0.26, wave: 0 },
  'sfx-train-arrive': { url: sfx('sfx-train-arrive'), bus: 'sfx', gain: 0.62, wave: 0 },
  'sfx-sleeve-select': { url: sfx('sfx-sleeve-select'), bus: 'sfx', gain: 0.4, wave: 2 },
  'sfx-rewind': { url: sfx('sfx-rewind'), bus: 'sfx', gain: 0.4, wave: 1 },
}

export const ALL_IDS = Object.keys(SOUNDS) as SoundId[]
