// Linear Fig 0.2 "Powered by agents": rounded cubes in a cluster, each fogged
// so the one behind fades, dot-matrix loaders playing on three tops.
import { box, FRAMES } from '../iso.js'

const S = 50, R = 5
const pong = FRAMES.scan(), upDown = FRAMES.rain(), agent = FRAMES.fill()

const grid = (frames) => ({ face: '+z', n: 5, gap: 3.5 * 2.2, r: 2.2, at: [S / 2 - 19.6, S / 2 - 19.6], frames, interval: 200 })
const cube = (at, h, extra = {}) => box({ at, size: [S, S, h], radius: R, bevel: 1.4, fog: 14, ...extra })

export default {
  objects: [
    cube([0, 0, 0], S),
    cube([S + 12, 0, 18], S * 0.9, { tone: { edge: 'lo' } }),
    cube([0, S + 12, 0], S * 1.3, { grid: grid(pong) }),
    cube([S + 12, S + 12, 0], S * 0.8, { grid: grid(upDown) }),
    cube([0, 0, S + 40], S * 0.7, { grid: grid(agent) }),
  ],
}

export const meta = { fig: 'Fig 0.2', title: 'Powered by agents', text: 'Loaders wake on hover.' }
