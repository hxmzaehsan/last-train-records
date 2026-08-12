import { useEffect, useRef, useState } from 'react'

/**
 * One shared information insert, switched by the two navigation buttons.
 * Built like a label's printed insert rather than a product modal: a smoked
 * black card, hairline rules, one magenta catalogue line, and nothing else.
 *
 * It never touches the scene — opening it cannot replay, pause or move the
 * settled city — and it never writes to the URL.
 */

export type InfoTopic = 'about' | 'making'

type Panel = {
  cat: string
  jp: string
  title: string
  body: string[]
  foot: string
}

const CONTENT: Record<InfoTopic, Panel> = {
  about: {
    cat: 'About',
    jp: '概要',
    title: 'About the experiment',
    body: [
      'Record World imagines a vinyl pressing as a living Tokyo neighbourhood. Dropping the needle causes its grooves to rise into railway lines, streets and late-night buildings around Last Train Records.',
      'The label is fictional. The experience is an independent design and development experiment by Hamza Ehsan.',
    ],
    foot: 'Designed and directed by Hamza Ehsan',
  },
  making: {
    cat: 'Making of',
    jp: '制作',
    title: 'How it was made',
    body: [
      'The entire world is rendered live in Three.js. The record, railway, shops, train, lighting, people and camera choreography are real-time geometry rather than a pre-rendered video.',
      'The experience combines creative direction, procedural modelling, motion design and AI-assisted development.',
    ],
    foot: 'React · Three.js · React Three Fiber',
  },
}

const FOCUSABLE = 'button, a[href], [tabindex]:not([tabindex="-1"])'

export function InfoPanel({ topic, onClose }: { topic: InfoTopic | null; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)
  const open = topic !== null

  // hold the last topic so the panel still has content while it fades out
  const [shown, setShown] = useState<InfoTopic>('about')
  useEffect(() => {
    if (topic) setShown(topic)
  }, [topic])

  // focus moves to Close on open and back to the button that opened it on close
  useEffect(() => {
    if (!open) return
    restoreTo.current = document.activeElement as HTMLElement | null
    panel.current?.querySelector<HTMLElement>('.info-close')?.focus()
    return () => restoreTo.current?.focus?.()
  }, [open])

  /*
   * Focus stays inside the insert *plus* the two navigation buttons: they are
   * the switcher for this panel, so they belong to the same loop. Everything
   * else — the playback control, the CTA, the shop hotspot — sits under the
   * backdrop and cannot be reached by pointer or keyboard.
   */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel.current) return
      const list = [
        // the two topic buttons are the panel's own switcher, so they stay in
        // the loop — the sound toggle beside them does not
        ...document.querySelectorAll<HTMLElement>('.nav button:not(.sound)'),
        ...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ]
      if (!list.length) return
      const i = list.indexOf(document.activeElement as HTMLElement)
      if (i === -1) {
        e.preventDefault()
        list[0].focus()
      } else if (e.shiftKey && i === 0) {
        e.preventDefault()
        list[list.length - 1].focus()
      } else if (!e.shiftKey && i === list.length - 1) {
        e.preventDefault()
        list[0].focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  const c = CONTENT[shown]

  return (
    <div className={`info${open ? ' is-open' : ''}`} aria-hidden={!open}>
      <div className="info-scrim" onClick={onClose} />
      <div className="info-panel" role="dialog" aria-labelledby="info-title" ref={panel}>
        <div className="info-head">
          <span className="info-cat">
            {c.cat}
            <span className="info-cat-jp" lang="ja">
              {c.jp}
            </span>
          </span>
          <button className="info-close" type="button" onClick={onClose}>
            Close
            <span lang="ja">閉じる</span>
          </button>
        </div>
        {/* keyed, so switching topics replays the short cross-fade */}
        <div className="info-body" key={shown}>
          <h2 id="info-title">{c.title}</h2>
          {c.body.map((line) => (
            <p key={line.slice(0, 24)}>{line}</p>
          ))}
          <p className="info-foot">{c.foot}</p>
        </div>
      </div>
    </div>
  )
}
