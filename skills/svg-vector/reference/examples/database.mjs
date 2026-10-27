// New object: a database. Three stacked discs, the top one lifted, fogged.
import { cylinder, line } from '../iso.js'
const R = 60, H = 18
export default {
  objects: [
    cylinder({ at: [0, 0, 0], r: R, h: H, bevel: 2, order: 0, tone: { base: 'hi' } }),
    cylinder({ at: [0, 0, H + 6], r: R, h: H, bevel: 2, fog: 6, order: 1 }),
    line({ points: [[R, R, 2 * H + 6], [R, R, 2 * H + 34]], dash: true, order: 2 }),
    cylinder({ at: [0, 0, 2 * H + 34], r: R, h: H, bevel: 2, fog: 8, order: 3,
      grid: { face: 'cap', n: 7, gap: 10, r: 1.2, at: [R - 31, R - 31], frames: [`
○ ○ ● ● ● ○ ○
○ ● ○ ○ ○ ● ○
● ○ ○ ● ○ ○ ●
● ○ ● ● ● ○ ●
● ○ ○ ● ○ ○ ●
○ ● ○ ○ ○ ● ○
○ ○ ● ● ● ○ ○`] } }),
  ],
}
