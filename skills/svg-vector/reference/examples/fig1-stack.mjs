// Linear Fig 0.1 "Purpose-built": a stack of rounded slabs, a lifted lid
// with a mark on top, dotted axes through the gap. Hover lift: iso-motion.js.
import { box, line, ZS } from '../iso.js'
import { liftStack } from '../iso-motion.js'

const W = 120, H = 13, R = 7, LAYERS = 5, GAP = 30
const sun = [
  '<circle cx="60" cy="60" r="34"/>',
  ...[0, 1, 2, 3, 4].map((i) => `<path d="M${26 + i * 3} ${66 + i * 5}H${94 - i * 3}"/>`),
].join('')

export default {
  objects: [
    ...Array.from({ length: LAYERS }, (_, i) =>
      box({ at: [0, 0, i * H], size: [W, W, H], radius: R, bevel: 1.6, lift: LAYERS - 1 - i, order: i,
        tone: { base: i === 0 ? 'hi' : 'lo' } })),
    ...[[0, W], [W, 0], [W, W]].map(([x, y]) =>
      line({ points: [[x, y, LAYERS * H], [x, y, LAYERS * H + GAP]], dash: true, order: LAYERS })),
    box({ at: [0, 0, LAYERS * H + GAP], size: [W, W, H], radius: R, bevel: 1.6, fog: 6, order: LAYERS + 1,
      decals: [{ face: '+z', svg: sun }] }),
  ],
}

export const meta = { fig: 'Fig 0.1', title: 'Purpose-built', text: 'Layers lift apart under the pointer.' }
export const motion = (svg) => liftStack(svg, { step: GAP * ZS, max: 3 })
