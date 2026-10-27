// Earth: a dot-matrix globe floating over a plinth, Fig 0.1 style. Land is
// Natural Earth sampled every 3 degrees (data/land-dots-3.json). One orbit
// with a satellite. Live: spinObject turns it east while hovered, rests
// otherwise, and lets you fling it.
import { box, cylinder, line, sphere } from '../iso.js'
import { spinObject } from '../iso-motion.js'
import { readFileSync } from 'node:fs'

export const LAND = JSON.parse(readFileSync(new URL('../data/land-dots-3.json', import.meta.url), 'utf8'))

const W = 150, PH = 12, R = 62, GAP = 22
const C = [W / 2, W / 2, PH + GAP + R] // globe centre, over the plinth centre

export const earth = (rot) => sphere({
  id: 'earth', at: C, r: R, rot, tilt: 23.4, dots: LAND, dotR: 0.9, fog: 10, order: 3,
  graticule: { lat: 30, lon: 30 },
  rings: [{ r: R * 1.38, incline: -12, lean: 0, markers: [330], markerSize: 3.5 }],
})

export default {
  objects: [
    box({ at: [0, 0, 0], size: [W, W, PH], radius: 8, bevel: 1.6, order: 0, tone: { base: 'hi' } }),
    cylinder({ at: [W / 2 - 30, W / 2 - 30, PH], r: 30, h: 2.5, bevel: 0.8, order: 1, tone: { edge: 'lo' } }),
    line({ points: [[W / 2, W / 2, PH + 2.5], [W / 2, W / 2, C[2]]], dash: true, order: 2 }),
    earth(10), // Africa and Europe to the front
  ],
}

export const meta = { fig: 'Fig 0.9', title: 'Global', text: 'Turns under the pointer, flings on drag.' }
export const motion = (svg) => spinObject(svg, { id: 'earth', make: earth, rot: 10 })
