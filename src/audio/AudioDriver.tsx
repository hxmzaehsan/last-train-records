import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { venueProgress } from '../scene/venue'
import { audio, resumeAudio, suspendAudio } from './engine'
import { audioVenue } from './cues'

/**
 * The only per-frame audio work in the project: it reads the same
 * `venueProgress()` the camera reads and maps it onto the mix, so the sound
 * of walking to the shop is exactly as long as the walk, reduced motion
 * included. No duplicated timings, no second state machine.
 */
export function AudioDriver() {
  const last = useRef(-1)

  useEffect(() => {
    const onVisibility = () => (document.hidden ? suspendAudio() : resumeAudio())
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useFrame(() => {
    if (!audio.ready) return
    const p = venueProgress()
    // only talk to the audio graph when something actually moved
    if (Math.abs(p - last.current) < 0.002 && !(p === 0 && last.current !== 0)) return
    last.current = p
    audioVenue(p)
  })

  return null
}
