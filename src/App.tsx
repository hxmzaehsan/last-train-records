import { useCallback, useEffect, useRef, useState } from 'react'
import { Scene, type SceneHandle } from './scene/Scene'
import type { HeroPhase } from './hero/phase'
import { Overlay } from './ui/Overlay'
import { RELEASES } from './scene/releases'
import { onReleaseSelect, selectRelease, venue, type VenueView } from './scene/venue'
import type { InfoTopic } from './ui/InfoPanel'
import { prefetchAudio } from './audio/engine'

const STATUS_TEXT: Record<HeroPhase, string> = {
  idle: '',
  playing: 'The record is playing. Tokyo is being rebuilt.',
  done: 'The city is complete. Label navigation is now available.',
  resetting: 'Rewinding. The city is returning to the empty record.',
}

const VENUE_STATUS: Partial<Record<VenueView, string>> = {
  'entering-releases': 'Moving to the Last Train Records shop.',
  releases: 'Outside the record shop. Three releases are on display in the window.',
  'leaving-releases': 'Returning to the city.',
}

const HASH = '#releases'
const clean = () => window.location.pathname + window.location.search

export default function App() {
  const [ready, setReady] = useState(false)
  const [phase, setPhase] = useState<HeroPhase>('idle')
  const [view, setView] = useState<VenueView>('city')
  const [selected, setSelected] = useState(0)
  const [info, setInfo] = useState<InfoTopic | null>(null)
  const hero = useRef<SceneHandle>(null)

  const handleInfo = useCallback((topic: InfoTopic | null) => {
    // reading about the piece never disturbs the city; just drop any shop
    // highlight so the building is not left lit behind the insert
    if (topic) venue.hotTarget = 0
    setInfo(topic)
  }, [])

  const handleReady = useCallback(() => {
    setReady(true)
    // download the entrance sounds now so the first press is never silent;
    // this only decodes, it cannot make a noise before the visitor asks
    prefetchAudio()
  }, [])
  const handleCue = useCallback(() => hero.current?.toggle(), [])

  const openVenue = useCallback(() => {
    // the scene owns the guard, so a second click can never start a second move
    if (!hero.current?.openVenue('releases')) return
    if (window.location.hash !== HASH) window.history.pushState({ venue: 'releases' }, '', HASH)
  }, [])

  const closeVenue = useCallback(() => {
    if (!hero.current?.closeVenue()) return
    if (window.location.hash === HASH) window.history.replaceState(null, '', clean())
  }, [])

  const handleSelect = useCallback((i: number) => selectRelease(i), [])

  // scene-side picks (clicking a sleeve in the window) drive the live caption
  useEffect(() => {
    onReleaseSelect(setSelected)
    return () => onReleaseSelect(null)
  }, [])

  // the city must be built first: never fly in straight off a deep link
  useEffect(() => {
    if (window.location.hash === HASH) window.history.replaceState(null, '', clean())
  }, [])

  // Escape leaves the shop; the browser's Back button does too
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && venue.view === 'releases') closeVenue()
    }
    const onPop = () => {
      if (window.location.hash === HASH) openVenue()
      else if (venue.view === 'releases') hero.current?.closeVenue()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('popstate', onPop)
    }
  }, [openVenue, closeVenue])

  return (
    <>
      <div className="stage">
        <Scene ref={hero} onReady={handleReady} onPhase={setPhase} onView={setView} />
      </div>
      <div className="vignette" aria-hidden="true" />
      <Overlay
        ready={ready}
        phase={phase}
        view={view}
        selected={selected}
        info={info}
        onCue={handleCue}
        onOpenVenue={openVenue}
        onCloseVenue={closeVenue}
        onSelectRelease={handleSelect}
        onInfo={handleInfo}
      />
      <p className="sr-only" role="status" aria-live="polite">
        {view === 'city'
          ? STATUS_TEXT[phase]
          : view === 'releases'
            ? `${VENUE_STATUS.releases} Selected: ${RELEASES[selected].cat}, ${RELEASES[selected].en} by ${RELEASES[selected].artist}.`
            : VENUE_STATUS[view]}
      </p>
    </>
  )
}
