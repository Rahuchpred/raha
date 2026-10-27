// New object: a chip. Die on a substrate, pins along the two seen edges,
// a hexagonal core, xray on the substrate for a blueprint read.
import { box, prism, ngon } from '../iso.js'
const S = 120
const pins = []
for (let i = 0; i < 8; i++) {
  pins.push(box({ at: [S + 2, 12 + i * 13, 2], size: [10, 5, 2], radius: 0.6 }))
  pins.push(box({ at: [12 + i * 13, S + 2, 2], size: [5, 10, 2], radius: 0.6 }))
  pins.push(box({ at: [-12, 12 + i * 13, 2], size: [10, 5, 2], radius: 0.6 }))
  pins.push(box({ at: [12 + i * 13, -12, 2], size: [5, 10, 2], radius: 0.6 }))
}
export default {
  objects: [
    ...pins,
    box({ at: [0, 0, 0], size: [S, S, 8], radius: 6, bevel: 1.5, xray: true, tone: { base: 'hi' } }),
    box({ at: [22, 22, 8], size: [S - 44, S - 44, 10], radius: 4, bevel: 1.5, fog: 6 }),
    prism({ at: [S / 2 - 18, S / 2 - 18, 18], outline: ngon(6, 18, 2), h: 6, bevel: 1 }),
  ],
}
