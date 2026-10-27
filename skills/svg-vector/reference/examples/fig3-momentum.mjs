// Linear Fig 0.3 "Designed for speed": fifteen standing plates whose heights
// make a wave. Live version follows the pointer on a spring (iso-motion.js).
import { box, ZS } from '../iso.js'
import { pointerWave } from '../iso-motion.js'

// Linear's resting heights, in screen px.
export const REST = [20.529, 34.049, 54.331, 81.373, 128.697, 81.373, 54.331, 34.049, 20.529, 13.768, 10.387, 8.698, 7.852, 7.853, 7.853]
export const plate = (i, hpx) => box({ id: `p${i}`, at: [0, i * 8.45, 0], size: [115, 1.6, Math.max(hpx, 2) / ZS], radius: 0.9, round: 'y', bevel: 1.2, tone: { edge: 'mid' } })

export default { objects: REST.map((h, i) => plate(i, h)) }

export const meta = { fig: 'Fig 0.3', title: 'Designed for speed', text: 'Plates rise to follow the pointer.' }
export const motion = (svg) => pointerWave(svg, { rest: REST, make: plate })
