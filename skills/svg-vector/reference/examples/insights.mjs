// Fig 0.8 Insights: a field of pillars on a plinth. The pillars near the
// pointer rise on a spring, the rest settle back to a low resting terrain.
import { box } from '../iso.js'
import { springField } from '../iso-motion.js'

const N = 6, S = 13, G = 6, PH = 6, PAD = 9
const W = N * S + (N - 1) * G + PAD * 2
// A gentle resting terrain so the field reads as data even when still.
export const REST = Array.from({ length: N * N }, (_, i) => {
  const r = Math.floor(i / N), c = i % N
  return 5 + 9 * (0.5 + 0.5 * Math.sin(r * 0.9 + c * 0.6)) * (0.6 + 0.4 * Math.cos(c * 1.3 - r * 0.4))
})
const at = (i) => [PAD + (i % N) * (S + G), PAD + Math.floor(i / N) * (S + G), PH]
export const pillar = (i, h) => box({ id: `p${i}`, at: at(i), size: [S, S, Math.max(1, h)], radius: 2.5, bevel: h > 6 ? 1 : 0,
  tone: { edge: h > 30 ? 'hi' : 'mid' } })

export default {
  objects: [box({ at: [0, 0, 0], size: [W, W, PH], radius: 7, bevel: 1.6, tone: { base: 'hi' } }), ...REST.map((h, i) => pillar(i, h))],
}

// Distance from the pointer to each pillar's base centre, in screen px.
const rise = (i, p, proj) => {
  if (!p) return REST[i]
  const [x, y, z] = at(i)
  const [sx, sy] = proj.project([x + S / 2, y + S / 2, z])
  const d = Math.hypot(p.x - sx, (p.y - sy) * 1.6)
  return REST[i] + 58 * Math.exp(-((d / 44) ** 2))
}
export const meta = { fig: 'Fig 0.8', title: 'Insights', text: 'See where work piles up before it slows you down.' }
export const motion = (svg) => springField(svg, { count: N * N, make: pillar, rest: REST, target: rise })
