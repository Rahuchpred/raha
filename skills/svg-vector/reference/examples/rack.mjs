// Fig 0.6 Infrastructure: a rack of drawers. The hovered drawer slides out
// toward you on Linear's curve; the rest stay put.
import { box } from '../iso.js'
import { hoverMove } from '../iso-motion.js'

const N = 5, W = 96, D = 128, H = 17, GAP = 2.5, OUT = 30
const front = (k) => `<path d="M10 6.5H${54 + (k % 3) * 8}M10 10.5H${40 + (k % 2) * 16}"/>` +
  Array.from({ length: 4 }, (_, j) => `<rect x="${78 + j * 7}" y="5" width="4" height="7" rx="1"/>`).join('') +
  `<circle cx="${D - 10}" cy="${H / 2}" r="1.8"/>`

export default {
  objects: [
    ...Array.from({ length: N }, (_, i) => box({
      item: N - 1 - i, at: [0, 0, i * (H + GAP)], size: [W, D, H], radius: 3, bevel: 1.2,
      tone: { base: i === 0 ? 'hi' : 'lo' }, decals: [{ face: '+x', svg: front(i) }],
    })),
    // The cabinet: a left side panel and a lid, so a drawer slides out of a
    // case instead of leaving a hole in a stack.
    box({ at: [0, D, 0], size: [W, 3, N * (H + GAP) - GAP], radius: 1.5, tone: { base: 'hi' } }),
    box({ at: [-2, -2, N * (H + GAP) - GAP], size: [W + 4, D + 7, 4], radius: 4, bevel: 1, tone: { base: 'lo' } }),
  ],
}

export const meta = { fig: 'Fig 0.6', title: 'Infrastructure', text: 'Built to scale with the team.' }
export const motion = (svg) => hoverMove(svg, { mode: 'each', offset: (i, a) => (i === a ? [OUT, OUT / 2] : null) })

// Where a demo cursor should point, per item: the middle of each drawer front.
export const targets = Array.from({ length: N }, (_, k) => { const i = N - 1 - k; return [W, D * 0.55, i * (H + GAP) + H / 2] })
