// New object: a bar chart on a plinth. Bars grow toward the viewer.
import { box } from '../iso.js'
const H = [26, 40, 34, 58, 72, 96]
export default {
  objects: [
    box({ at: [0, 0, 0], size: [150, 40, 8], radius: 4, bevel: 1.5, tone: { base: 'hi' } }),
    ...H.map((h, i) => box({ at: [8 + i * 23, 12, 8], size: [16, 16, h], radius: 2.5, bevel: 1.2,
      tone: { edge: i === H.length - 1 ? 'hi' : 'mid' } })),
  ],
}
