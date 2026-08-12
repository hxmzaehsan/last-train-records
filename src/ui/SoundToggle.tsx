import { useCallback, useState } from 'react'
import { audio, setMuted } from '../audio/engine'

/**
 * Sound on/off, sitting with the other two header controls and wearing the
 * same bilingual treatment rather than an icon. It appears when the rest of
 * the interface appears, and the choice is remembered for this visit only.
 */
export function SoundToggle() {
  const [on, setOn] = useState(!audio.muted)

  const toggle = useCallback(() => {
    setOn((was) => {
      setMuted(was)
      return !was
    })
  }, [])

  return (
    <button
      className="sound"
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? 'Turn sound off' : 'Turn sound on'}
    >
      <span className="nav-en" aria-hidden="true">
        {on ? 'Sound on' : 'Sound off'}
      </span>
      <span className="nav-jp" lang="ja" aria-hidden="true">
        {on ? '音声オン' : '音声オフ'}
      </span>
    </button>
  )
}
