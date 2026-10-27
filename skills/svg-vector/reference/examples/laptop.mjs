// New object: a laptop. Base slab, keyboard well, a standing lid with a
// screen decal on its left (+y) face.
import { box } from '../iso.js'
const W = 150, D = 100
const screen = `<rect x="8" y="8" width="${W - 16}" height="${D * 0.78 - 16}" rx="3"/>` +
  [0, 1, 2].map((i) => `<path d="M20 ${22 + i * 10}H${60 + i * 25}"/>`).join('')
export default {
  objects: [
    box({ at: [0, -4, 7], size: [W, 4, D * 0.78], radius: 3, round: 'y', tone: { edge: 'hi' },
      decals: [{ face: '+y', svg: screen }] }),
    box({ at: [0, 0, 0], size: [W, D, 7], radius: 5, bevel: 1.5, tone: { base: 'hi' } }),
    box({ at: [14, 12, 7], size: [W - 28, D * 0.5, 0.01], radius: 2, tone: { edge: 'lo' } }),
    box({ at: [W / 2 - 22, D * 0.68, 7], size: [44, 22, 0.01], radius: 2, tone: { edge: 'lo' } }),
  ],
}
