import { useRef } from 'react'
import type { HeroPhase } from '../hero/phase'
import { timeline } from '../scene/timeline'
import { RELEASES } from '../scene/releases'
import { screen, venue, type VenueView } from '../scene/venue'
import { useAnchor } from './useAnchor'
import { InfoPanel, type InfoTopic } from './InfoPanel'
import { SoundToggle } from './SoundToggle'

/** Two real controls that open the information insert — no dead anchors. */
const NAV: { en: string; jp: string; topic: InfoTopic }[] = [
  { en: 'About', jp: '概要', topic: 'about' },
  { en: 'Making of', jp: '制作', topic: 'making' },
]

const CUE_LABELS: Record<HeroPhase, { en: string; jp: string }> = {
  idle: { en: 'Drop the needle', jp: '針を落とす' },
  playing: { en: 'Playing', jp: '再生中' },
  done: { en: 'Play again', jp: 'もう一度' },
  resetting: { en: 'Rewinding', jp: '巻き戻し中' },
}

const BACK = { en: 'Back to the city', jp: '街に戻る' }

export function Overlay({
  ready,
  phase,
  view,
  selected,
  info,
  onCue,
  onOpenVenue,
  onCloseVenue,
  onSelectRelease,
  onInfo,
}: {
  ready: boolean
  phase: HeroPhase
  view: VenueView
  selected: number
  info: InfoTopic | null
  onCue: () => void
  onOpenVenue: () => void
  onCloseVenue: () => void
  onSelectRelease: (i: number) => void
  onInfo: (topic: InfoTopic | null) => void
}) {
  const inShop = view !== 'city'
  const moving = view === 'entering-releases' || view === 'leaving-releases'
  const cue = inShop ? BACK : CUE_LABELS[phase]
  const busy = phase === 'playing' || phase === 'resetting' || moving

  const shopEl = useRef<HTMLButtonElement>(null)
  const sleeveEls = [
    useRef<HTMLButtonElement>(null),
    useRef<HTMLButtonElement>(null),
    useRef<HTMLButtonElement>(null),
  ]

  useAnchor(
    [{ el: shopEl, anchor: screen.shop, scaleX: 1.75, scaleY: 1.7, min: 58 }],
    ready && phase === 'done' && view === 'city',
  )
  useAnchor(
    sleeveEls.map((el, i) => ({ el, anchor: screen.sleeves[i], scaleX: 1.5, scaleY: 1.5, min: 46 })),
    view === 'releases',
  )

  const release = RELEASES[selected]

  return (
    <div
      className={`chrome${ready ? ' is-ready' : ''} phase-${phase} view-${view}${
        info ? ' info-open' : ''
      }`}
    >
      {/* the wordmark, sitting inside the record's ring above the control
          while the needle is still up — it hands over to the header copy
          once the city has settled */}
      <div className="standby-mark" aria-hidden="true">
        <span className="standby-en">Last Train Records</span>
        <span className="standby-jp" lang="ja">
          ラスト・トレイン・レコーズ
        </span>
      </div>

      <header className="topbar">
        {/* BASE_URL rather than "/", so the wordmark links to this site's own
            root even when it is hosted under a repository path */}
        <a
          className="brand rv rv-brand"
          href={import.meta.env.BASE_URL}
          aria-label="Last Train Records home"
        >
          <span className="brand-en">Last Train Records</span>
          <span className="brand-jp" lang="ja">
            ラスト・トレイン・レコーズ
          </span>
        </a>

        <button
          className="cue"
          type="button"
          onClick={() => {
            if (busy) return
            if (inShop) onCloseVenue()
            else onCue()
          }}
          onPointerEnter={() => (timeline.cueHot = true)}
          onPointerLeave={() => (timeline.cueHot = false)}
          onFocus={() => (timeline.cueHot = true)}
          onBlur={() => (timeline.cueHot = false)}
          aria-disabled={busy}
        >
          <span className="cue-inner">
            <span className="cue-face">
              <span className="cue-en">{cue.en}</span>
              <span className="cue-jp" lang="ja">
                {cue.jp}
              </span>
            </span>
          </span>
        </button>

        <nav className="nav rv rv-nav" aria-label="Primary">
          {NAV.map((item) => (
            <button
              key={item.en}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={info === item.topic}
              onClick={() => onInfo(info === item.topic ? null : item.topic)}
            >
              <span className="nav-en">{item.en}</span>
              <span className="nav-jp" lang="ja" aria-hidden="true">
                {item.jp}
              </span>
            </button>
          ))}
          <SoundToggle />
        </nav>
      </header>

      <div className="lede">
        <h1 className="rv rv-h1">Music for the last train home</h1>
        <p className="rv rv-p">
          Last Train Records is an independent Tokyo label releasing limited vinyl,
          nocturnal electronics and intimate live sessions.
        </p>
      </div>

      <a
        className="cta rv rv-cta"
        href="#releases"
        onClick={(e) => {
          e.preventDefault()
          onOpenVenue()
        }}
      >
        <span className="cta-inner">
          <span className="cta-face">
            <span className="cta-en">Explore releases</span>
            <span className="cta-jp" lang="ja">
              リリースを見る
            </span>
          </span>
        </span>
      </a>

      {/* --------------------------------------------------- venue framing */}

      <div className="venue-copy" aria-hidden={!inShop}>
        <h2>
          <span className="vt-en">Releases</span>
          <span className="vt-jp" lang="ja">
            リリース
          </span>
        </h2>
        <p>Small-run pressings for the journey home.</p>
      </div>

      <figure
        className="venue-caption"
        aria-hidden={!inShop}
        style={{ '--accent': release.accent } as React.CSSProperties}
      >
        <span className="vc-cat">{release.cat}</span>
        <span className="vc-jp" lang="ja">
          {release.jp}
        </span>
        <span className="vc-en">{release.en}</span>
        <span className="vc-artist">{release.artist}</span>
        <span className="vc-limited">
          Limited pressing
          <span lang="ja">限定盤</span>
        </span>
      </figure>

      {/* the building itself, as a real control pinned to its projection */}
      <button
        ref={shopEl}
        className="hotspot"
        type="button"
        style={{ display: 'none' }}
        onClick={onOpenVenue}
        onPointerEnter={() => (venue.hotTarget = 1)}
        onPointerLeave={() => (venue.hotTarget = 0)}
        onFocus={() => (venue.hotTarget = 1)}
        onBlur={() => (venue.hotTarget = 0)}
      >
        <span className="sr-only">Open Last Train Records releases</span>
        <span className="sr-only" lang="ja">
          終電レコードのリリースを見る
        </span>
      </button>

      {RELEASES.map((r, i) => (
        <button
          key={r.cat}
          ref={sleeveEls[i]}
          className={`sleeve-pick${selected === i ? ' is-selected' : ''}`}
          type="button"
          style={{ display: 'none' }}
          aria-pressed={selected === i}
          onClick={() => onSelectRelease(i)}
          onPointerEnter={() => (venue.hover = i)}
          onPointerLeave={() => {
            if (venue.hover === i) venue.hover = -1
          }}
          onFocus={() => (venue.hover = i)}
          onBlur={() => {
            if (venue.hover === i) venue.hover = -1
          }}
        >
          <span className="sr-only">{`${r.cat} — ${r.en}, ${r.artist}`}</span>
          <span className="sr-only" lang="ja">
            {r.jp}
          </span>
        </button>
      ))}

      <InfoPanel topic={info} onClose={() => onInfo(null)} />
    </div>
  )
}
