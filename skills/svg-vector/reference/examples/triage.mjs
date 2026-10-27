// Fig 0.4 Triage: a stack of issue cards that fans out toward you on hover,
// the top card first.
import { box, ZS } from '../iso.js'
import { hoverMove } from '../iso-motion.js'

const N = 6, W = 112, D = 72, T = 2.2, STEP = 5
const issue = (k) => `<circle cx="12" cy="13" r="3.5"/><path d="M21 13H${62 + (k % 3) * 9}"/><path d="M12 24H${48 + (k % 2) * 22}" opacity=".6"/>` +
  `<rect x="${W - 26}" y="${D - 18}" width="14" height="8" rx="4"/>`

export default {
  pad: 44, // room for the fan
  objects: Array.from({ length: N }, (_, i) => box({
    item: i, at: [0, 0, i * STEP], size: [W, D, T], radius: 5,
    tone: { edge: i === N - 1 ? 'hi' : 'mid', base: 'lo' },
    decals: i === N - 1 ? [{ face: '+z', svg: issue(i) }] : [],
  })),
}

// Fan: card i slides toward the viewer (+y) and up, more the higher it is.
const fan = (i) => { const dy = i * 11, dz = i * 3.5; return [-dy, dy / 2 - dz * ZS] }
export const meta = { fig: 'Fig 0.4', title: 'Triage', text: 'Every request lands in one place, sorted on arrival.' }
export const motion = (svg) => hoverMove(svg, { mode: 'all', offset: fan, stagger: (i, _, n) => (n - 1 - i) * 0.04 })
