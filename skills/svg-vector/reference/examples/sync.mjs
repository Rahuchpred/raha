// Fig 0.7 Sync: a hub and four clients on dotted links, each top carrying a
// still dot grid. One gesture: on hover the hub's grid ripples once and it
// sends a single pulse down each link; each client lifts as its pulse lands
// and its grid ripples into a check. Leaving settles everything back to the
// still state. Nothing loops.
import { box, line, ZS } from '../iso.js'
import { hoverMove, playGrids, resetGrids, sendPulses } from '../iso-motion.js'

const HUB = 46, NODE = 26, R = 92, LIFT = 7
const DUR = 0.6, GAP = 0.12 // pulse travel time, and the stagger between links
// Clients clockwise from the back; `item` gives each its arrival order.
const CLIENTS = [[-R, 0], [0, -R], [R, 0], [0, R]]

// 5x5 frames. Frame one is what shows at rest.
const f = (rows) => rows.trim().split('\n').map((r) => r.trim()).join('\n')
const DOT = f(`
○ ○ ○ ○ ○
○ ○ ○ ○ ○
○ ○ ● ○ ○
○ ○ ○ ○ ○
○ ○ ○ ○ ○`)
const RING1 = f(`
○ ○ ○ ○ ○
○ ● ● ● ○
○ ● ○ ● ○
○ ● ● ● ○
○ ○ ○ ○ ○`)
const RING2 = f(`
● ● ● ● ●
● ○ ○ ○ ●
● ○ ○ ○ ●
● ○ ○ ○ ●
● ● ● ● ●`)
const CHECK = f(`
○ ○ ○ ○ ○
○ ○ ○ ○ ●
● ○ ○ ● ○
○ ● ● ○ ○
○ ○ ○ ○ ○`)
const ARRIVE = (i) => i * GAP + DUR * 0.85 // when client i's pulse lands
const grid = (s, frames, delay, interval) => ({ face: '+z', n: 5, gap: s / 6.2, r: s / 22,
  at: [s / 2 - (s / 6.2) * 2 - s / 22, s / 2 - (s / 6.2) * 2 - s / 22], frames, once: true, delay, interval })

const client = ([x, y], i, order) => box({ item: i, at: [x - NODE / 2, y - NODE / 2, 0], size: [NODE, NODE, NODE * 0.8],
  radius: 4, bevel: 1.2, fog: 8, order, tone: { edge: 'mid' }, grid: grid(NODE, [DOT, RING1, RING2, CHECK], ARRIVE(i), 90) })
const link = ([x, y], i, order) => line({ points: [[0, 0, 0.01], [x, y, 0.01]], dash: true, order,
  pulse: { once: true, len: 12, dur: DUR, delay: i * GAP } })

export default {
  objects: [
    client(CLIENTS[0], 0, 0), client(CLIENTS[1], 1, 0),
    link(CLIENTS[0], 0, 1), link(CLIENTS[1], 1, 1),
    box({ at: [-HUB / 2, -HUB / 2, 0], size: [HUB, HUB, HUB * 0.9], radius: 6, bevel: 1.6, fog: 12, order: 2, tone: { base: 'hi' },
      grid: grid(HUB, [DOT, RING1, RING2, DOT], 0, 110) }),
    link(CLIENTS[2], 2, 3), link(CLIENTS[3], 3, 3),
    client(CLIENTS[2], 2, 4), client(CLIENTS[3], 3, 4),
  ],
}

export const meta = { fig: 'Fig 0.7', title: 'Sync', text: 'Changes reach every client in real time.' }
export const motion = (svg) => {
  const lifts = hoverMove(svg, { mode: 'all', offset: () => [0, -LIFT * ZS], stagger: ARRIVE })
  const send = () => { sendPulses(svg); playGrids(svg) }
  const settle = () => resetGrids(svg)
  svg.addEventListener('pointerenter', send)
  svg.addEventListener('pointerleave', settle)
  return () => { lifts(); svg.removeEventListener('pointerenter', send); svg.removeEventListener('pointerleave', settle) }
}
