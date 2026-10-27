// Fig 0.5 Command: a small keyboard. The hovered key presses down onto its
// stem with a quick spring-like ease. Cmd and K carry the bright edge.
import { box, ZS } from '../iso.js'
import { hoverMove } from '../iso-motion.js'

const K = 30, G = 7, COLS = 4, ROWS = 2, PH = 8, STEM = 6, CAP = 11
const W = COLS * K + (COLS + 1) * G, D = ROWS * K + (ROWS + 1) * G
const cmd = `<path d="M12 12H18V18H12Z"/><circle cx="10" cy="10" r="2.6"/><circle cx="20" cy="10" r="2.6"/><circle cx="10" cy="20" r="2.6"/><circle cx="20" cy="20" r="2.6"/>`
const kGlyph = `<path d="M11 8V22M11 16L19 8M14 13.5L20 22"/>`
const glyph = { '0,0': cmd, '2,1': kGlyph }

const keys = []
let item = 0
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const x = G + c * (K + G), y = G + r * (K + G), g = glyph[`${c},${r}`]
  keys.push(box({ at: [x + K / 2 - 6, y + K / 2 - 6, PH], size: [12, 12, STEM], radius: 2, tone: { edge: 'lo' } }))
  keys.push(box({ item: item++, at: [x, y, PH + STEM], size: [K, K, CAP], radius: 5, bevel: 2,
    tone: { edge: g ? 'hi' : 'mid' }, decals: g ? [{ face: '+z', svg: g }] : [] }))
}

export default {
  objects: [box({ at: [0, 0, 0], size: [W, D, PH], radius: 8, bevel: 1.6, tone: { base: 'hi' } }), ...keys],
}

const TRAVEL = STEM - 1
export const meta = { fig: 'Fig 0.5', title: 'Command', text: 'Every action is one keystroke away.' }
export const motion = (svg) => hoverMove(svg, {
  mode: 'each', offset: (i, a) => (i === a ? [0, TRAVEL * ZS] : null),
  transition: 'transform .16s cubic-bezier(.32,.72,0,1)',
})

// Where a demo cursor should point, per item: the middle of each key top.
export const targets = Array.from({ length: ROWS * COLS }, (_, i) => {
  const r = Math.floor(i / COLS), c = i % COLS
  return [G + c * (K + G) + K / 2, G + r * (K + G) + K / 2, PH + STEM + CAP]
})
