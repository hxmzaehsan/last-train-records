# Last Train Records

A vinyl record on a late-1970s Japanese turntable. Drop the needle and its
grooves rise into a miniature late-night Tokyo railway neighbourhood — track,
carriages, shopfronts, neon and the people still out at that hour — all
rendered live in the browser with Three.js.

Walk up to the record shop the neighbourhood is named after and three fictional
releases are waiting in the window.

**Live site:** _to be added once GitHub Pages is enabled_

![The settled city: a vinyl record whose grooves have risen into a miniature
night-time Tokyo neighbourhood, with a lit commuter train at the platform and
neon along the shop street](docs/preview.jpg)

---

## What it is

An independent design and development experiment. The record label is
fictional. Nothing is pre-rendered: the record, the railway, the buildings, the
train, the lighting, the pedestrians and every camera move are real-time
geometry driven by a single shared timeline.

## Built with

| | |
| --- | --- |
| **React 19** + **TypeScript** | Interface and state |
| **Three.js** | Rendering |
| **React Three Fiber** + **drei** | React renderer for Three.js |
| **@react-three/postprocessing** | Bloom and tone mapping |
| **Web Audio API** | The sound layer, hand-built (no audio library) |
| **Vite 7** | Dev server and build |

## Running it locally

Requires Node.js 20 or newer.

```bash
npm ci
```

```bash
npm run dev
```

The dev server starts on <http://localhost:5185>.

### Production build

```bash
npm run build
```

This type-checks and then writes the site to `dist/`. To view that build:

```bash
npm run preview
```

## Project structure

```
src/
  main.tsx              entry point; loads the two open-licence fonts
  App.tsx               top-level state: phase, venue view, selected release
  styles.css            all interface styling

  scene/
    timeline.ts         the single shared timeline — one mutable object read
                        by pure functions, never React state in the loop
    venue.ts            the shop close-up: view state, camera poses, and the
                        shop-local coordinate frame everything else is authored in
    Scene.tsx           canvas, camera rig, lighting, drivers, shader precompile
    VinylRecord.tsx     the record, label and neon ring
    Turntable.tsx       deck, plinth and controls
    Tonearm.tsx         arm and stylus
    City.tsx            terraces, railway, station, apartments, street life
    Canyon.tsx          the shop street, its signage and Last Train Records
    Kit.tsx             the shared kit of architectural parts
    Figures.tsx         the miniature people — a jointed rig and a wardrobe
    Life.tsx            pedestrian routes, cars and ambient movement
    signage.tsx         canvas-drawn Japanese signage
    releases.ts         the three fictional releases and their sleeve artwork
    InstancedUnits.tsx  instanced geometry with sweep-driven reveals

  audio/
    engine.ts           Web Audio graph: buses, limiter, mute, loop machinery
    manifest.ts         every sound, its bus and its level — the whole mix
    cues.ts             what plays and exactly when, keyed to the animation
    AudioDriver.tsx     maps the camera's approach onto the mix each frame

  ui/
    Overlay.tsx         header, headline, controls, shop and release hit areas
    InfoPanel.tsx       the About / Making of insert
    SoundToggle.tsx     sound on/off
    useAnchor.ts        glues DOM controls to projected 3D points

public/audio/           the 20 sound files (see ASSET_CREDITS.md)
```

## Interaction and accessibility

- **Nothing plays until you ask it to.** No audio context is created and no
  sound is loaded for playback before the first click, which respects browser
  autoplay rules and the visitor.
- **Sound can be turned off** from the header at any time, and the choice is
  remembered for the rest of the visit. The experience is fully usable muted —
  no timing, control or information depends on hearing it.
- **The record shop is keyboard-reachable.** It is a real `<button>` whose
  screen position is updated every frame from the building's projected
  position, rather than a mouse-only raycast. The three record sleeves work the
  same way.
- **Escape** leaves the shop, and the browser's Back button does too — entering
  the shop pushes a `#releases` history entry.
- **The information insert traps focus** while open and returns focus to the
  control that opened it.
- **Screen readers** get a polite live region describing the current phase, the
  view, and the selected release.
- **Reduced motion is respected.** With `prefers-reduced-motion` set, the
  entrance runs as a short 2.6-second sequence with no record rotation, and the
  sound follows a matching shortened cue list rather than a sped-up one.
- **No free camera.** Every move is authored, so the composition is never lost.

## Assets and credits

Full provenance for every font and sound is in
**[ASSET_CREDITS.md](ASSET_CREDITS.md)**.

Worth knowing up front: the **audio is AI-generated**, produced from original
prompts written for this project, and released under CC BY 4.0. All three
typefaces are open-licensed and bundled, so a fork renders exactly as designed.

## Licence

| | |
| --- | --- |
| Source code | [MIT](LICENSE) |
| Audio (`public/audio/`) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Archivo, Noto Sans JP | SIL OFL 1.1 |
| LT Remark | SIL OFL 1.0 — [licence](src/fonts/OFL-LTRemark.txt) |
| "Last Train Records" identity | All rights reserved |

Everything is reusable with credit except the fictional label identity itself —
the name, the release titles and the art direction. See [LICENSE](LICENSE) for
the exact boundaries.

## Credits

Designed and directed by **Hamza Ehsan**.
Built with **[Claude Code](https://claude.com/claude-code)**.

The label, its releases and its artists are fictional.
