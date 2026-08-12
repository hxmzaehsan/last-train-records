import * as THREE from 'three'

/**
 * Three fictional pressings, drawn as real sleeve artwork on canvas so the
 * shop window holds up at close range. Each sleeve is one authored geometric
 * idea in one accent colour on a near-black ground — no gradients, no stock
 * imagery, no repeated layout.
 */

const EN = "'Archivo Variable','Helvetica Neue',Arial,sans-serif"
const JP = "'Noto Sans JP Variable','Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif"

export type Release = {
  cat: string
  jp: string
  en: string
  artist: string
  /** sleeve accent, also the colour the storefront light adopts */
  accent: string
  /** dimmer companion for the spill light */
  spill: string
}

export const RELEASES: Release[] = [
  { cat: 'LTR-001', jp: '2番線', en: 'Platform Two', artist: 'Night Service', accent: '#FF2C9C', spill: '#ff5cb4' },
  { cat: 'LTR-002', jp: '雨の自販機', en: 'Vending Machine in Rain', artist: 'Kita Line', accent: '#20E7FF', spill: '#7bf0ff' },
  { cat: 'LTR-003', jp: '終電後', en: 'After the Last Train', artist: 'Soft Exit', accent: '#A8FF3E', spill: '#c6ff86' },
]

const S = 512
const GROUND = '#0a0c0d'

function base(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = GROUND
  ctx.fillRect(0, 0, S, S)
  // faint printed border, the way a small-run sleeve is trimmed
  ctx.strokeStyle = 'rgba(233,241,234,0.12)'
  ctx.lineWidth = 2
  ctx.strokeRect(18, 18, S - 36, S - 36)
}

function footer(ctx: CanvasRenderingContext2D, r: Release) {
  ctx.fillStyle = 'rgba(233,241,234,0.72)'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `560 20px ${EN}`
  ctx.fillText(r.cat, 40, S - 42)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(233,241,234,0.5)'
  ctx.font = `430 18px ${EN}`
  ctx.fillText(r.artist, S - 40, S - 42)
}

/** LTR-001 — two rails running away from a platform edge. */
function drawPlatformTwo(ctx: CanvasRenderingContext2D, r: Release) {
  base(ctx)
  ctx.strokeStyle = r.accent
  ctx.lineWidth = 3
  // converging rails
  for (const x of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(S / 2 + x * 150, S - 96)
    ctx.lineTo(S / 2 + x * 16, 176)
    ctx.stroke()
  }
  // sleepers, thinning with distance
  ctx.strokeStyle = 'rgba(233,241,234,0.3)'
  for (let i = 0; i < 8; i++) {
    const u = i / 7
    const y = S - 96 - u * (S - 272)
    const w = 150 - u * 134
    ctx.lineWidth = 3 - u * 2
    ctx.beginPath()
    ctx.moveTo(S / 2 - w, y)
    ctx.lineTo(S / 2 + w, y)
    ctx.stroke()
  }
  // platform number, set as a station board would set it
  ctx.fillStyle = r.accent
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `620 132px ${EN}`
  ctx.fillText('2', 118, 132)
  ctx.fillStyle = 'rgba(233,241,234,0.8)'
  ctx.font = `500 30px ${JP}`
  ctx.fillText('番線', 118, 218)
  footer(ctx, r)
}

/** LTR-002 — a lit vending machine standing in ruled rain. */
function drawVendingMachine(ctx: CanvasRenderingContext2D, r: Release) {
  base(ctx)
  // machine body
  ctx.fillStyle = '#12181b'
  ctx.fillRect(268, 118, 168, 300)
  ctx.strokeStyle = r.accent
  ctx.lineWidth = 3
  ctx.strokeRect(268, 118, 168, 300)
  // drink rows
  ctx.fillStyle = r.accent
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      ctx.globalAlpha = row === 1 && col === 2 ? 1 : 0.34 + row * 0.06
      ctx.fillRect(288 + col * 44, 142 + row * 52, 30, 38)
    }
  }
  ctx.globalAlpha = 1
  // collection tray
  ctx.fillStyle = 'rgba(233,241,234,0.22)'
  ctx.fillRect(288, 368, 128, 22)
  // rain
  ctx.strokeStyle = 'rgba(233,241,234,0.26)'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 34; i++) {
    const x = 26 + ((i * 71) % (S - 52))
    const y = 40 + ((i * 137) % (S - 150))
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - 16, y + 54)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(233,241,234,0.86)'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.font = `500 34px ${JP}`
  ctx.fillText('雨の', 46, 132)
  ctx.fillText('自販機', 46, 176)
  footer(ctx, r)
}

/** LTR-003 — the last clock face, half below the line. */
function drawAfterTheLastTrain(ctx: CanvasRenderingContext2D, r: Release) {
  base(ctx)
  const cx = S / 2 + 34
  const cy = 336
  ctx.strokeStyle = r.accent
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, 128, 0, Math.PI * 2)
  ctx.stroke()
  // hands at 00:52
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx, cy - 74)
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx - 96, cy - 34)
  ctx.stroke()
  // horizon rule cutting the face
  ctx.strokeStyle = 'rgba(233,241,234,0.75)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(34, cy)
  ctx.lineTo(S - 34, cy)
  ctx.stroke()
  // last departures, struck through
  ctx.fillStyle = 'rgba(233,241,234,0.4)'
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(46, 96 + i * 26, 96 - i * 12, 5)
  }
  ctx.fillStyle = r.accent
  ctx.fillRect(46, 96 + 4 * 26, 96 - 4 * 12, 5)
  ctx.fillStyle = 'rgba(233,241,234,0.86)'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.font = `500 36px ${JP}`
  ctx.fillText('終電後', S - 46, 96)
  footer(ctx, r)
}

const DRAW = [drawPlatformTwo, drawVendingMachine, drawAfterTheLastTrain]

let cache: THREE.CanvasTexture[] | null = null

export function sleeveTextures() {
  if (cache) return cache
  cache = RELEASES.map((r, i) => {
    const canvas = document.createElement('canvas')
    canvas.width = S
    canvas.height = S
    const ctx = canvas.getContext('2d')!
    DRAW[i](ctx, r)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  })
  return cache
}
