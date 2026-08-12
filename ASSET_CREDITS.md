# Asset credits and provenance

Every non-code asset in *Last Train Records*, where it came from, and whether
you may reuse it.

The short version: **the source code is MIT licensed, the three typefaces are
under the SIL Open Font License, and the audio is released under CC BY 4.0.**
The only thing held back is the fictional label identity. Details below.

---

## 1. Rendered artwork — no image files

Almost everything you see is **geometry and canvas textures generated in code
at runtime**. There are no illustration, photo or texture files in this
repository.

| What | Where it is made | Notes |
| --- | --- | --- |
| Record, turntable, tonearm, terraces, rails, train | `src/scene/` | Three.js geometry, built procedurally |
| Buildings, shopfronts, signage, street furniture | `src/scene/Kit.tsx`, `Canyon.tsx`, `City.tsx` | Procedural, from a shared kit of parts |
| Japanese shop signage and station boards | `src/scene/signage.tsx` | Drawn to an HTML canvas at runtime |
| Record sleeve artwork (LTR-001/002/003) | `src/scene/releases.ts` | Drawn to a canvas at runtime |
| Painted faces, hair, clothing of the miniature people | `src/scene/Figures.tsx` | Canvas atlas plus procedural meshes |
| The label mark (record + railway switch) | `src/ui/Logo.tsx` | Inline SVG |

**Status:** original work by Hamza Ehsan, produced as part of this project.
Covered by the code licence as code; the *design* is not — see §5.

---

## 2. Typefaces

All three typefaces are under the SIL Open Font License, so all three are
bundled and redistributed with the site.

| Font | Path | Licence | Attribution |
| --- | --- | --- | --- |
| Archivo Variable | `@fontsource-variable/archivo` (npm, v5.3.0) | SIL OFL 1.1 | © 2020 The Archivo Project Authors |
| Noto Sans JP Variable | `@fontsource-variable/noto-sans-jp` (npm, v5.3.0) | SIL OFL 1.1 | © Google Inc. |
| LT Remark | `src/fonts/LTRemark-Regular.otf` | SIL OFL **1.0** | © 2023 LyonsType — designed by Daniel Lyons |

Archivo (interface) and Noto Sans JP (Japanese) install from npm and are
bundled as 127 `.woff2` subsets.

**LT Remark** sets the headline. It is by **Daniel Lyons / LyonsType** and the
licence is embedded in the font's own metadata, reproduced verbatim in
[`src/fonts/OFL-LTRemark.txt`](src/fonts/OFL-LTRemark.txt) as OFL clause 2
requires. Two deliberate choices about how it ships:

- **The original `.otf` is bundled unconverted.** OFL 1.0 counts "changing
  formats" as creating a *Modified Version*, and a modified version may not
  keep the reserved name "LT Remark". Converting it to WOFF2 would have saved
  around 30 KB but would have meant renaming the family, so the original file
  ships as-is at 63 KB.
- **A locally installed copy is preferred.** The `@font-face` rule lists
  `local()` sources before the bundled file, so anyone who already owns the
  family skips the download.

If you fork this project, all three fonts come with it and the headline will
render as designed.

---

## 3. Audio — CC BY 4.0

All twenty audio files in `public/audio/` were generated from original text
prompts written for this project, using the **FLORA** platform
(`agents.flora.ai`), which routed them to two **ElevenLabs** models:

| Model | Used for |
| --- | --- |
| ElevenLabs Music v1 (`t2a-elevenlabs-music-t2a`) | The six music beds |
| ElevenLabs Sound Effects (`t2a-elevenlabs-sfx`) | The four room tones and ten physical sounds |

The files were then trimmed, loudness-matched and re-encoded locally (MP3,
44.1 kHz; beds normalised to −23 LUFS, one-shots peak-normalised to −6 dBFS).

### Inventory

| File | What it is | Length |
| --- | --- | --- |
| `audio/music/music-assembly.mp3` | Entrance piece — near-silence growing into the beat | 30.0 s |
| `audio/music/music-city.mp3` | Settled-city bed, looping | 30.0 s |
| `audio/music/music-shop.mp3` | Interior bed heard from inside the shop, looping | 30.0 s |
| `audio/music/music-ltr-001.mp3` | Release layer — *Platform Two* | 20.0 s |
| `audio/music/music-ltr-002.mp3` | Release layer — *Vending Machine in Rain* | 20.0 s |
| `audio/music/music-ltr-003.mp3` | Release layer — *After the Last Train* | 20.1 s |
| `audio/ambience/amb-rail-resonance.mp3` | Distant steel-rail resonance | 30.0 s |
| `audio/ambience/amb-neon-hum.mp3` | Neon transformer hum | 30.0 s |
| `audio/ambience/amb-street-quiet.mp3` | Deserted street at night | 30.0 s |
| `audio/ambience/amb-shop-room.mp3` | Shop interior room tone | 30.0 s |
| `audio/sfx/sfx-cue-press.mp3` | Relay click on the control | 1.0 s |
| `audio/sfx/sfx-motor-start.mp3` | Turntable motor spinning up | 4.0 s |
| `audio/sfx/sfx-tonearm.mp3` | Tonearm cueing down | 2.0 s |
| `audio/sfx/sfx-stylus-contact.mp3` | Stylus meeting the groove | 3.0 s |
| `audio/sfx/sfx-groove-to-rail.mp3` | Groove becoming rail resonance | 7.7 s |
| `audio/sfx/sfx-city-rise.mp3` | The city rising | 8.0 s |
| `audio/sfx/sfx-neon-strike.mp3` | A neon tube igniting | 2.0 s |
| `audio/sfx/sfx-train-arrive.mp3` | Last train arriving and settling | 12.0 s |
| `audio/sfx/sfx-sleeve-select.mp3` | A record sleeve lifted | 1.0 s |
| `audio/sfx/sfx-rewind.mp3` | Mechanical spool rewinding | 3.0 s |

Total: **≈3.9 MB**, 20 files.

### Licence

The audio is released by Hamza Ehsan under the
**[Creative Commons Attribution 4.0 International licence](https://creativecommons.org/licenses/by/4.0/)**
(CC BY 4.0). You may use, remix and build on it, including commercially, with
credit.

Two honest notes so you can make your own decision:

- These are **AI-generated** recordings, produced from original prompts on a
  paid account. They are offered here in good faith as the author's own work.
  Anyone with strict provenance requirements should be aware of how they were
  made.
- No third-party music, field recordings or sample libraries were used, and no
  existing recording was imitated.

Suggested credit: *Audio by Hamza Ehsan (Last Train Records), CC BY 4.0.*

---

## 4. Excluded from this repository

Present in the author's working copy, deliberately not published (see
`.gitignore`):

| Path | What | Why excluded |
| --- | --- | --- |
| `work/` | Raw generator output plus loud volume-matched review copies, including rejected takes | Working material; large; not used by the site |
| `outputs/` | Early visual-direction stills and a motion study | Direction reference only; never displayed; rights unresolved |
| `public/media/` | Generated video and stills from an abandoned video-led approach | **Not used by the live site**; rights unresolved |

The live experience is rendered in real time. It has never displayed generated
video or stills, and none of the above is required to build or run it.

---

## 5. The label identity

"Last Train Records" is a **fictional record label** created for this project.
The name, the mark, the release titles, the catalogue numbers (LTR-001 to
LTR-003), the fictional artists and the Japanese signage copy are original
creative work by **Hamza Ehsan**.

They are **not** covered by the MIT licence. Please don't republish the
identity as your own or present the label as real.

Any resemblance to a real record label, shop or station is coincidental.

---

## 6. Summary

| Asset class | Licence | Safe to redistribute? |
| --- | --- | --- |
| Source code | MIT | Yes |
| Procedural artwork (as code) | MIT as code; design rights reserved | Code yes, design no |
| Archivo, Noto Sans JP | SIL OFL 1.1 | Yes, with attribution |
| LT Remark | SIL OFL 1.0 | Yes — keep the licence file with it, don't rename a converted copy |
| Audio | CC BY 4.0 | Yes, with attribution |
| Label identity and naming | All rights reserved | No |

Everything here is reusable with credit except the label identity itself.
