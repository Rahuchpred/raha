// iso.js: Linear-style isometric line art as plain SVG. Zero dependencies.
// Runs in Node (string out) and the browser (same string, or live re-render).
//
// The look, as linear.app ships it (see linear-notes.md):
//   - 2:1 pixel isometric. Plan edges step 2 across, 1 down.
//   - No 3D engine. Every solid is its silhouette filled with the page
//     background, painted back to front, so nearer solids hide farther ones.
//   - Three line tones: silhouette (hi), inner creases (lo), bevel lip (faint).
//   - A blurred background-coloured copy under a solid fogs what is behind it.
//
// World axes: x runs right-down, y runs left-down, z runs up.
// The visible faces of any solid are +x (right), +y (left) and +z (top).

export const ZS = Math.sqrt(1.5) // true axonometric z scale for a 2:1 plan

const r3 = (n) => Math.round(n * 1000) / 1000

export const THEMES = {
  // Linear's own values, read off the shipped SVGs.
  dark: { bg: '#08090A', hi: '#D0D6E0', mid: '#62666D', lo: '#3E3E44', faint: '#2E2E32', dot: '#E4E5E9' },
  // Same ladder inverted for a paper page. Retune to the page's tokens.
  light: { bg: '#FBFBFA', hi: '#2A2C30', mid: '#8A8F98', lo: '#C2C5CB', faint: '#DADCE0', dot: '#2A2C30' },
}

// ---------------------------------------------------------------- projection

export function makeProjector(zs = ZS) {
  const project = ([x, y, z]) => [x - y, (x + y) / 2 - z * zs]
  const view = [1, 1, 1 / zs] // toward the viewer: faces whose normal dots this > 0 are seen
  return { project, view, zs }
}

// ------------------------------------------------------------------ outlines
// Outlines are convex 2D polygons in an object's local (u, v) plane, densely
// sampled where curved. Concave objects are built from several convex parts.

export function roundPoly(pts, radius = 0, seg = 8) {
  if (!radius) return pts.slice()
  const out = []
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n]
    const a = norm(sub(p0, p1)), b = norm(sub(p2, p1))
    const ang = Math.acos(clamp(dot(a, b), -1, 1))
    const maxR = Math.min(len(sub(p0, p1)), len(sub(p2, p1))) / 2 * Math.tan(ang / 2)
    const r = Math.min(radius, maxR)
    const t = r / Math.tan(ang / 2) // tangent distance from the corner
    const s = add(p1, mul(a, t)), e = add(p1, mul(b, t))
    const bis = norm(add(a, b))
    const c = add(p1, mul(bis, r / Math.sin(ang / 2)))
    let a0 = Math.atan2(s[1] - c[1], s[0] - c[0])
    let a1 = Math.atan2(e[1] - c[1], e[0] - c[0])
    let d = a1 - a0
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    for (let k = 0; k <= seg; k++) {
      const q = a0 + (d * k) / seg
      out.push([c[0] + r * Math.cos(q), c[1] + r * Math.sin(q)])
    }
  }
  return out
}

export const rect = (w, d, radius = 0) => roundPoly([[0, 0], [w, 0], [w, d], [0, d]], radius)
export const circle = (r, n = 72) =>
  Array.from({ length: n }, (_, i) => [r + r * Math.cos((i / n) * 2 * Math.PI), r + r * Math.sin((i / n) * 2 * Math.PI)])
export const ngon = (sides, r, radius = 0, rot = 0) =>
  roundPoly(Array.from({ length: sides }, (_, i) => {
    const a = rot + (i / sides) * 2 * Math.PI
    return [r + r * Math.cos(a), r + r * Math.sin(a)]
  }), radius)

// ---------------------------------------------------------------- primitives
// Every primitive is a prism: a convex outline in local (u, v), extruded by h
// along `axis`, placed with its local origin at `at` (world [x, y, z]).
//
// Shared options:
//   id       string, becomes data-id on the group (motion hooks onto it)
//   fog      blur radius; a bg-coloured blurred copy sits under the solid
//   bevel    world units; draws the lip line this far below the front cap
//   tone     { edge: 'hi'|'mid'|'lo', crease: 'lo'|..., base: 'hi'|'lo' }
//   xray     true: hidden edges drawn dashed over the fill (blueprint read)
//   decals   [{ face, svg, w, d }] svg in face-local units (see faceFrame)
//   grid     { face, n, gap, r, frames, interval } dot matrix on a face
//   order    number; overrides the automatic back-to-front sort
//   lift     integer; stack index for the hover lift (see iso-motion.js)

export function prism(o) {
  return { kind: 'prism', axis: 'z', at: [0, 0, 0], h: 10, ...o }
}

// size [w, d, h] along x, y, z. `round` picks which edges carry the radius.
export function box({ size, radius = 0, round = 'z', ...o }) {
  const [w, d, h] = size
  const spec = {
    z: { outline: rect(w, d, radius), h, axis: 'z' },
    x: { outline: rect(d, h, radius), h: w, axis: 'x' },
    y: { outline: rect(w, h, radius), h: d, axis: 'y' },
  }[round]
  return prism({ ...o, ...spec, size, isBox: true })
}

export function cylinder({ r, h, axis = 'z', n = 72, ...o }) {
  return prism({ ...o, outline: circle(r, n), h, axis })
}

// A globe. at = centre. Not a prism: its silhouette is the great circle
// facing the viewer, and surface features show where they face the viewer.
//   rot        longitude at the centre of the view, degrees (spin this)
//   tilt       axis lean in the picture plane, degrees (Earth: 23.4)
//   graticule  { lat: 30, lon: 30 } or false; equator in `lo`, rest `faint`
//   dots       [[lat, lon], ...] e.g. data/land-dots-3.json; dotR sizes them
//   rings      [{ r, incline, lean, markers: [deg, ...] }] orbits; the half
//              behind the globe is painted before it, so the globe hides it
export function sphere(o) {
  return { kind: 'sphere', at: [0, 0, 0], r: 60, rot: 0, tilt: 0, graticule: { lat: 30, lon: 30 }, dots: [], dotR: 1.1, rings: [], ...o }
}

// Free lines and markers, for leader lines, axes and Modal-style node dots.
export const line = (o) => ({ kind: 'line', dash: false, tone: 'lo', ...o })
export const marker = (o) => ({ kind: 'marker', size: 2.5, tone: 'hi', ...o })

// ------------------------------------------------------------------ geometry

function toWorld(o, u, v, w) {
  const [x, y, z] = o.at
  if (o.axis === 'z') return [x + u, y + v, z + w]
  if (o.axis === 'x') return [x + w, y + u, z + v] // outline in (y, z)
  return [x + u, y + w, z + v] // 'y': outline in (x, z)
}

function axisVec(o, u, v, w) {
  if (o.axis === 'z') return [u, v, w]
  if (o.axis === 'x') return [w, u, v]
  return [u, w, v]
}

function signedArea(pts) {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length]
    a += p[0] * q[1] - q[0] * p[1]
  }
  return a / 2
}

export function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return p
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lo = [], up = []
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 1e-9) lo.pop(); lo.push(q) }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 1e-9) up.pop(); up.push(q) }
  up.pop(); lo.pop()
  return lo.concat(up)
}

// Everything a prism needs to draw: silhouette, creases, lip, hidden edges.
export function solveprism(o, proj) {
  let pts = o.outline
  if (signedArea(pts) < 0) pts = pts.slice().reverse()
  const n = pts.length
  const h = o.h
  const P = (u, v, w) => proj.project(toWorld(o, u, v, w))
  const top = pts.map(([u, v]) => P(u, v, h))
  const bot = pts.map(([u, v]) => P(u, v, 0))

  // Side face i spans pts[i] to pts[i+1]; outward normal in (u, v) for CCW.
  const faceVis = pts.map((p, i) => {
    const q = pts[(i + 1) % n]
    const nu = q[1] - p[1], nv = -(q[0] - p[0])
    return dot(axisVec(o, nu, nv, 0), proj.view) > 1e-9
  })

  const runs = (vis, ring) => { // contiguous polylines over edges where vis[i]
    const out = []
    let start = vis.findIndex((v, i) => v && !vis[(i - 1 + n) % n])
    if (start < 0) return vis[0] ? [ring.concat([ring[0]])] : []
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n
      if (vis[i] && !vis[(i - 1 + n) % n]) out.push([ring[i]])
      if (vis[i]) out[out.length - 1].push(ring[(i + 1) % n])
    }
    return out
  }

  const sil = hull(top.concat(bot))
  const capFront = runs(faceVis, top) // crease between cap and the seen sides
  const capBack = runs(faceVis.map((v) => !v), top) // on the silhouette
  const baseFront = runs(faceVis, bot) // on the silhouette
  const baseBack = runs(faceVis.map((v) => !v), bot) // hidden

  // Sharp vertical edges (corners of unrounded outlines).
  const verts = []
  const hiddenVerts = []
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n]
    const turn = Math.acos(clamp(dot(norm(sub(b, a)), norm(sub(c, b))), -1, 1))
    if (turn < 0.35) continue // part of a curve, not a corner
    const seen = faceVis[(i - 1 + n) % n] || faceVis[i]
    ;(seen ? verts : hiddenVerts).push([bot[i], top[i]])
  }

  let lip = []
  if (o.bevel) {
    const lipRing = pts.map(([u, v]) => P(u, v, h - o.bevel))
    lip = runs(faceVis, lipRing)
  }

  return { sil, capFront, capBack, baseFront, baseBack, verts, hiddenVerts, lip, top }
}

// Face frames: map face-local (u right, v down) to screen, as an SVG matrix.
// Box faces: '+z' top (origin back corner), '+x' right, '+y' left.
// Prisms: 'cap' is the front cap in the outline's own (u, v).
export function faceFrame(o, face, proj) {
  const pv = (vec) => { const [a, b] = proj.project(vec); const [c, d] = proj.project([0, 0, 0]); return [a - c, b - d] }
  let origin, eu, ev
  if (face === 'cap') {
    origin = toWorld(o, 0, 0, o.h); eu = axisVec(o, 1, 0, 0); ev = axisVec(o, 0, 1, 0)
  } else {
    const [w, d, h] = o.size
    const [x, y, z] = o.at
    if (face === '+z') { origin = [x, y, z + h]; eu = [1, 0, 0]; ev = [0, 1, 0] }
    if (face === '+x') { origin = [x + w, y + d, z + h]; eu = [0, -1, 0]; ev = [0, 0, -1] }
    if (face === '+y') { origin = [x, y + d, z + h]; eu = [1, 0, 0]; ev = [0, 0, -1] }
  }
  const [a, b] = pv(eu), [c, d] = pv(ev), [e, f] = proj.project(origin)
  return `matrix(${[a, b, c, d, e, f].map(r3).join(' ')})`
}

// ------------------------------------------------------------------- drawing

const pathOf = (pts, close) => pts.length ? 'M' + pts.map((p) => `${r3(p[0])} ${r3(p[1])}`).join('L') + (close ? 'Z' : '') : ''
const pathsOf = (runs) => runs.map((r) => pathOf(r)).join('')

function depthOf(o, proj) {
  if (o.order != null) return o.order
  if (o.kind === 'sphere') return o.at[0] + o.at[1] + (o.at[2] - o.r) * proj.view[2]
  if (o.kind !== 'prism') return Infinity // lines and markers on top
  // Plan centre plus base height: a tall solid must not jump ahead of the
  // shorter solids standing in front of it, but a solid resting on another
  // must come after it.
  let cx = 0, cy = 0, zb = Infinity
  for (const [u, v] of o.outline) for (const w of [0, o.h]) {
    const [x, y, z] = toWorld(o, u, v, w)
    cx += x; cy += y; zb = Math.min(zb, z)
  }
  const n = o.outline.length * 2
  return cx / n + cy / n + zb * proj.view[2]
}

function worldBounds(o) {
  if (o.kind === 'sphere') return { lo: o.at.map((c) => c - o.r), hi: o.at.map((c) => c + o.r) }
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
  for (const [u, v] of o.outline) for (const w of [0, o.h]) {
    toWorld(o, u, v, w).forEach((c, k) => { lo[k] = Math.min(lo[k], c); hi[k] = Math.max(hi[k], c) })
  }
  return { lo, hi }
}

// Painter's order. If any object sets `order`, the scene is sorted by it
// (unset ones fall back to the depth key). Otherwise solids get a real
// isometric sort: A is painted before B when A lies wholly on the far side
// of B along some world axis (the viewer looks from +x, +y, +z). That is
// exact for solids whose bounds do not interpenetrate. Lines and markers
// go last.
function sortScene(flat, proj) {
  const items = flat.map((o, i) => ({ o, i, d: depthOf(o, proj) }))
  if (items.some((it) => it.o.order != null)) return items.sort((a, b) => a.d - b.d || a.i - b.i)
  const isSolid = (it) => it.o.kind === 'prism' || it.o.kind === 'sphere'
  const solids = items.filter(isSolid)
  const rest = items.filter((it) => !isSolid(it))
  solids.forEach((it) => { it.b = worldBounds(it.o); it.in = 0; it.out = [] })
  const eps = 1e-6
  const behind = (a, b) => [0, 1, 2].some((k) => a.b.hi[k] <= b.b.lo[k] + eps)
  for (const a of solids) for (const b of solids) {
    if (a !== b && behind(a, b) && !behind(b, a)) { a.out.push(b); b.in++ }
  }
  const out = []
  const ready = solids.filter((it) => !it.in)
  const left = new Set(solids)
  while (left.size) {
    if (!ready.length) { // a cycle: break it at the nearest-to-back solid
      const pick = [...left].sort((a, b) => a.d - b.d)[0]
      pick.in = 0; ready.push(pick)
    }
    ready.sort((a, b) => a.d - b.d || a.i - b.i)
    const it = ready.shift()
    if (!left.has(it)) continue
    left.delete(it); out.push(it)
    for (const n of it.out) if (left.has(n) && --n.in === 0) ready.push(n)
  }
  return out.concat(rest.sort((a, b) => a.i - b.i))
}

export function drawPrism(o, proj, uid) {
  const g = solveprism(o, proj)
  const t = { edge: 'hi', crease: 'lo', base: null, ...(o.tone || {}) }
  const S = (cls, d, extra = '') => d ? `<path class="iso-${cls}" d="${d}"${extra}/>` : ''
  let s = ''
  if (o.fog) s += `<path class="iso-fill" filter="url(#${uid}-fog${o.fog})" d="${pathOf(g.sil, true)}"/>`
  s += S('fill', pathOf(g.sil, true))
  s += S(t.crease, pathsOf(g.capFront) + g.verts.map((v) => pathOf(v)).join(''))
  if (g.lip.length) s += S('faint', pathsOf(g.lip), ' stroke-linecap="round"')
  s += S(t.edge, pathOf(g.sil, true))
  if (t.base) s += S(t.base, pathsOf(g.baseFront))
  if (o.xray) s += S('lo', pathsOf(g.baseBack) + g.hiddenVerts.map((v) => pathOf(v)).join(''), ' stroke-dasharray="1 3" stroke-linecap="round"')
  for (const dc of o.decals || []) s += `<g transform="${faceFrame(o, dc.face, proj)}" class="iso-decal">${dc.svg}</g>`
  if (o.grid) s += drawGrid(o, proj, uid)
  return s
}

// Procedural frame sets for grid({ frames }), as string art rows.
const art = (n, on) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (on(i, j) ? '●' : '○')).join(' ')).join('\n')
export const FRAMES = {
  scan: (n = 5) => Array.from({ length: n }, (_, k) => art(n, (i, j) => j === k)), // a column sweeps across
  ring: (n = 5) => { const c = (n - 1) / 2; return Array.from({ length: Math.ceil(c) + 2 }, (_, k) => art(n, (i, j) => Math.max(Math.abs(i - c), Math.abs(j - c)) === k)) }, // a square ripple
  fill: (n = 5, step = 3) => Array.from({ length: Math.ceil((n * n) / step) + 2 }, (_, k) => art(n, (i, j) => i * n + j < k * step)), // fills row by row
  rain: (n = 5, len = 8) => Array.from({ length: len }, (_, k) => art(n, (i, j) => (i + j * 3 + 7 * j * j) % len === k % len || (i + 1 + j * 3 + 7 * j * j) % len === k % len)), // falling streaks
  beat: (n = 5) => [art(n, () => false), art(n, (i, j) => i === (n >> 1) && j === (n >> 1)), art(n, (i, j) => Math.abs(i - (n >> 1)) + Math.abs(j - (n >> 1)) <= 1), art(n, (i, j) => Math.abs(i - (n >> 1)) + Math.abs(j - (n >> 1)) === 2), art(n, () => false)], // a heartbeat
}

// Dot matrix on a face, Linear's grid loader done in true projection (dots
// become ellipses) instead of a CSS 3D tilt. frames: array of string art,
// rows of ● and ○, played with steps() keyframes; one frame = static.
let gridCounter = 0
export function drawGrid(o, proj, uid) {
  const { face = '+z', n = 5, gap = 3.5, r = 1, frames, interval = 200, at = [0, 0], lit = 1, unlit = 0.3, once = false, delay = 0 } = o.grid
  const id = `${uid}-g${gridCounter++}`
  const parsed = (frames || []).map((f) => f.trim().split('\n').map((row) => row.trim().split(/\s+/).map((c) => c === '●')))
  if (once) {
    // Frame one stays on screen at rest. playGrids() runs the rest a single
    // time and holds the last frame; resetGrids() returns to frame one.
    let dots = ''
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const seq = parsed.map((fr) => (fr[i][j] ? lit : unlit))
      dots += `<circle cx="${r3(at[0] + r + gap * j)}" cy="${r3(at[1] + r + gap * i)}" r="${r}" opacity="${seq[0] ?? unlit}" data-seq="${seq.join(',')}"/>`
    }
    return `<g class="iso-dots" data-grid-once data-interval="${interval}" data-delay="${delay}" transform="${faceFrame(o, face, proj)}">${dots}</g>`
  }
  let css = '', dots = ''
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const cls = `${id}-${i}-${j}`
    const first = parsed[0] ? (parsed[0][i][j] ? lit : unlit) : unlit
    dots += `<circle class="${cls}" cx="${r3(at[0] + r + gap * j)}" cy="${r3(at[1] + r + gap * i)}" r="${r}" opacity="${first}"/>`
    if (parsed.length > 1) {
      const L = parsed.length
      let kf = ''
      parsed.forEach((fr, k) => {
        const op = fr[i][j] ? lit : unlit
        kf += `${r3((k / L) * 100)}%{opacity:${op}}${r3(((k + 1) / L) * 100)}%{opacity:${op}}`
      })
      css += `@keyframes ${cls}{${kf}}.${cls}{animation:${cls} ${L * interval}ms steps(1,end) infinite}`
    }
  }
  return (css ? `<style>${css}@media (prefers-reduced-motion:reduce){[class^="${id}-"]{animation:none}}</style>` : '') +
    `<g class="iso-dots" transform="${faceFrame(o, face, proj)}">${dots}</g>`
}

// pulse: { len, dur, delay } sends a bright dash from the first point to the
// last, looping while the figure is hovered (see render). With once: true it
// waits for sendPulses() and runs a single time per call.
let pulseCounter = 0
function drawLine(o, proj, uid) {
  const pts = o.points.map(proj.project)
  let s = `<path class="iso-${o.tone}" d="${pathOf(pts)}"${o.dash ? ' stroke-dasharray="1 3" stroke-linecap="round"' : ''}/>`
  if (o.pulse && o.pulse.once) {
    // Fired by sendPulses() in iso-motion.js, once per trigger.
    const { len = 10, dur = 0.7, delay = 0 } = o.pulse
    let L = 0
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    s += `<path class="iso-hi iso-shot" d="${pathOf(pts)}" stroke-linecap="round" stroke-dasharray="${r3(len)} ${r3(L + len)}" ` +
      `data-len="${r3(len)}" data-l="${r3(L)}" data-dur="${dur}" data-delay="${delay}" style="stroke-width:1;opacity:0"/>`
  } else if (o.pulse) {
    const { len = 8, dur = 1.4, delay = 0 } = o.pulse
    let L = 0
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    const id = `${uid}-p${pulseCounter++}`
    s += `<style>@keyframes ${id}{from{stroke-dashoffset:${r3(len)}}to{stroke-dashoffset:${r3(-L)}}}</style>` +
      `<path class="iso-hi iso-pulse" d="${pathOf(pts)}" stroke-linecap="round" stroke-dasharray="${r3(len)} ${r3(L + len)}" ` +
      `style="stroke-width:1;animation:${id} ${dur}s linear ${delay}s infinite"/>`
  }
  return s
}

function drawMarker(o, proj) {
  const [x, y] = proj.project(o.at)
  const s = o.size
  return `<rect class="iso-marker" x="${r3(x - s / 2)}" y="${r3(y - s / 2)}" width="${s}" height="${s}" transform="rotate(45 ${r3(x)} ${r3(y)})"${o.color ? ` style="fill:${o.color}"` : ''}/>`
}

// ------------------------------------------------------------------- sphere

const D2R = Math.PI / 180
const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l] },
  // Rodrigues: rotate v about unit axis k by angle t
  rot: (v, k, t) => v3.add(v3.add(v3.mul(v, Math.cos(t)), v3.mul(v3.cross(k, v), Math.sin(t))), v3.mul(k, v3.dot(k, v) * (1 - Math.cos(t)))),
}

// The globe's frame: V toward the viewer, A north, B the meridian facing
// the viewer, C to its right (east as seen).
function sphereFrame(o, proj) {
  const V = v3.norm(proj.view)
  const A = v3.norm(v3.rot([0, 0, 1], V, -o.tilt * D2R))
  const B = v3.norm(v3.add(V, v3.mul(A, -v3.dot(V, A))))
  const C = v3.cross(B, A) // east, to the right as seen
  const dir = (lat, lon) => {
    const p = lat * D2R, l = (lon - o.rot) * D2R
    return v3.add(v3.add(v3.mul(B, Math.cos(p) * Math.cos(l)), v3.mul(C, Math.cos(p) * Math.sin(l))), v3.mul(A, Math.sin(p)))
  }
  const S = (d, r = o.r) => proj.project(v3.add(o.at, v3.mul(d, r)))
  return { V, A, B, C, dir, S }
}

function sphereOutline(o, proj, n = 120) {
  const { V, C, S } = sphereFrame(o, proj)
  const U = v3.norm(v3.cross(V, C)), W = C // both perpendicular to V
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 2 * Math.PI
    return S(v3.add(v3.mul(U, Math.cos(t)), v3.mul(W, Math.sin(t))))
  })
}

// Polylines of the samples whose `seen` flag holds, split at the limb.
function seenRuns(samples, closed) {
  const out = []
  let cur = null
  samples.forEach(({ p, seen }) => {
    if (seen) { if (!cur) out.push((cur = [])); cur.push(p) } else cur = null
  })
  if (closed && out.length > 1 && samples[0].seen && samples[samples.length - 1].seen) out[0] = out.pop().concat(out[0])
  return out
}

function ringSamples(o, ring, proj) {
  const { V, A, B, C } = sphereFrame(o, proj)
  let N = v3.rot(A, C, (ring.incline || 0) * D2R)
  N = v3.rot(N, B, (ring.lean || 0) * D2R)
  const U = v3.norm(v3.cross(N, V)), W = v3.cross(N, U)
  const at = (deg) => {
    const t = deg * D2R
    const d = v3.add(v3.mul(U, Math.cos(t)), v3.mul(W, Math.sin(t)))
    return { p: proj.project(v3.add(o.at, v3.mul(d, ring.r))), front: v3.dot(d, V) >= 0 }
  }
  return { at, pts: Array.from({ length: 181 }, (_, i) => at(i * 2)) }
}

// The parts of a globe that change with `rot`: graticule paths and dots.
// Split out so motion can patch them in place every frame instead of
// rebuilding markup. dots[i] is null when dot i faces away.
export function sphereSurface(o, proj) {
  const { V, dir, S } = sphereFrame(o, proj)
  const [cx, cy] = proj.project(o.at)
  const P = (pts) => pathOf(pts)
  let faint = '', lo = ''
  if (o.graticule) {
    const { lat = 30, lon = 30 } = o.graticule
    for (let p = -90 + lat; p < 90; p += lat) {
      const pts = []
      for (let l = 0; l <= 360; l += 2) { const d = dir(p, l); pts.push({ p: S(d), seen: v3.dot(d, V) > 0 }) }
      const d = seenRuns(pts, true).map(P).join('')
      if (Math.abs(p) < 1e-9) lo += d; else faint += d
    }
    for (let l = 0; l < 360; l += lon) {
      const pts = []
      for (let p = -90; p <= 90; p += 2) { const d = dir(p, l); pts.push({ p: S(d), seen: v3.dot(d, V) > 0 }) }
      faint += seenRuns(pts, false).map(P).join('')
    }
  }
  const R = o.dotR * sphereScale(o, proj)
  const dots = o.dots.map(([lat, lon]) => {
    const d = dir(lat, lon)
    const f = v3.dot(d, V)
    if (f <= 0.04) return null
    const [x, y] = S(d)
    // A small disc on the surface: full size across, foreshortened by f
    // along the radius, fading into the limb.
    return { x, y, rx: R * f, ry: R, ang: Math.atan2(y - cy, x - cx) / D2R, op: Math.min(1, f * 2.5) }
  })
  return { faint, lo, dots }
}

// Screen px per world unit: the outline radius over r.
function sphereScale(o, proj) {
  const [cx, cy] = proj.project(o.at)
  const [x, y] = sphereOutline(o, proj, 4)[0]
  return Math.hypot(x - cx, y - cy) / o.r
}

export const dotAttrs = (q) =>
  `cx="${r3(q.x)}" cy="${r3(q.y)}" rx="${r3(q.rx)}" ry="${r3(q.ry)}" transform="rotate(${r3(q.ang)} ${r3(q.x)} ${r3(q.y)})" opacity="${r3(q.op)}"`

export function drawSphere(o, proj, uid) {
  const sil = sphereOutline(o, proj)
  const P = (pts) => pathOf(pts)
  const ring = (front) => o.rings.map((rg) => {
    const { at, pts } = ringSamples(o, rg, proj)
    let s = `<path class="iso-${rg.tone || 'lo'}" d="${seenRuns(pts.map((q) => ({ p: q.p, seen: q.front === front })), true).map(P).join('')}"${front ? '' : ' stroke-dasharray="1 3" stroke-linecap="round"'}/>`
    for (const m of rg.markers || []) {
      const q = at(m)
      if (q.front !== front) continue
      const sz = rg.markerSize || 3
      s += `<rect class="iso-marker" x="${r3(q.p[0] - sz / 2)}" y="${r3(q.p[1] - sz / 2)}" width="${sz}" height="${sz}" transform="rotate(45 ${r3(q.p[0])} ${r3(q.p[1])})"/>`
    }
    return s
  }).join('')

  let s = ring(false)
  if (o.fog) s += `<path class="iso-fill" filter="url(#${uid}-fog${o.fog})" d="${pathOf(sil, true)}"/>`
  s += `<path class="iso-fill" d="${pathOf(sil, true)}"/>`

  const surf = sphereSurface(o, proj)
  if (o.graticule) s += `<path class="iso-faint" data-part="grat" d="${surf.faint}"/><path class="iso-lo" data-part="equator" d="${surf.lo}"/>`
  if (o.dots.length) {
    s += `<g class="iso-dots" data-part="dots">${surf.dots.map((q) => q ? `<ellipse ${dotAttrs(q)}/>` : '').join('')}</g>`
  }

  s += `<path class="iso-${(o.tone && o.tone.edge) || 'hi'}" d="${pathOf(sil, true)}"/>`
  s += ring(true)
  return s
}

export function drawObject(o, proj, uid) {
  if (o.kind === 'prism') return drawPrism(o, proj, uid)
  if (o.kind === 'sphere') return drawSphere(o, proj, uid)
  if (o.kind === 'line') return drawLine(o, proj, uid)
  if (o.kind === 'marker') return drawMarker(o, proj)
  return ''
}

// ------------------------------------------------------------------- render
// render({ objects, theme, pad, stroke, zs, title }) -> SVG string.
// The viewBox fits the art. Colours are CSS custom properties with the theme
// as fallback, so the host page retunes them: .wrap .iso-root { --iso-bg: ... }

let renderCounter = 0
// playOnHover (default true): CSS animations (dot grids, pulses) hold still
// until the figure is hovered or carries .iso-active; pulses hide at rest.
export function render({ objects, theme = 'dark', pad = 16, stroke = 0.5, zs = ZS, title, uid, className = '', playOnHover = true }) {
  const proj = makeProjector(zs)
  uid = uid || `iso${renderCounter++}`
  const th = typeof theme === 'string' ? THEMES[theme] : theme
  const flat = objects.flat(Infinity).filter(Boolean)

  // Bounds from every projected point.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const grow = ([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  for (const o of flat) {
    if (o.kind === 'prism') for (const [u, v] of o.outline) { grow(proj.project(toWorld(o, u, v, 0))); grow(proj.project(toWorld(o, u, v, o.h))) }
    if (o.kind === 'line') o.points.forEach((p) => grow(proj.project(p)))
    if (o.kind === 'marker') grow(proj.project(o.at))
    if (o.kind === 'sphere') {
      sphereOutline(o, proj).forEach(grow)
      for (const rg of o.rings) ringSamples(o, rg, proj).pts.forEach((q) => grow(q.p))
    }
  }
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad

  const sorted = sortScene(flat, proj)
  const fogs = [...new Set(flat.filter((o) => o.fog).map((o) => o.fog))]

  const body = sorted.map(({ o }) => {
    const attrs = [o.id && `data-id="${o.id}"`, o.lift != null && `data-lift="${o.lift}"`, o.item != null && `data-item="${o.item}"`].filter(Boolean).join(' ')
    return `<g class="iso-obj"${attrs ? ' ' + attrs : ''}>${drawObject(o, proj, uid)}</g>`
  }).join('')

  const vars = Object.entries(th).map(([k, v]) => `--iso-${k}:${v}`).join(';')
  const style = `.${uid}{${vars}}` +
    `.${uid} .iso-fill{fill:var(--iso-bg)}` +
    `.${uid} .iso-hi,.${uid} .iso-mid,.${uid} .iso-lo,.${uid} .iso-faint{fill:none;stroke-width:${stroke};stroke-linejoin:round}` +
    `.${uid} .iso-hi{stroke:var(--iso-hi)}.${uid} .iso-mid{stroke:var(--iso-mid)}.${uid} .iso-lo{stroke:var(--iso-lo)}.${uid} .iso-faint{stroke:var(--iso-faint)}` +
    `.${uid} .iso-dots>*{fill:var(--iso-dot)}.${uid} .iso-marker{fill:var(--iso-hi)}` +
    `.${uid} .iso-decal{fill:none;stroke:var(--iso-lo);stroke-width:${stroke}}` +
    `.${uid} .iso-obj{transition:transform .7s cubic-bezier(.32,.72,0,1);transition-delay:var(--lift-delay,0s)}` +
    `.${uid} .iso-pulse{transition:opacity .3s}` +
    (playOnHover ? `.${uid}:not(:hover):not(.iso-active) *{animation-play-state:paused!important}.${uid}:not(:hover):not(.iso-active) .iso-pulse{opacity:0}` : '') +
    `@media (prefers-reduced-motion:reduce){.${uid} .iso-obj{transition:none}.${uid} *{animation:none!important}.${uid} .iso-pulse{display:none}}`

  const defs = fogs.map((f) => `<filter id="${uid}-fog${f}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${f}"/></filter>`).join('')
  const w = r3(x1 - x0), h = r3(y1 - y0)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r3(x0)} ${r3(y0)} ${w} ${h}" width="${w}" height="${h}" fill="none" overflow="visible" class="iso-root ${uid} ${className}" data-iso="${uid}" role="img"${title ? ` aria-label="${title}"` : ' aria-hidden="true"'}><style>${style}</style><defs>${defs}</defs>${body}</svg>`
}

// --------------------------------------------------------------------- math
function add(a, b) { return [a[0] + b[0], a[1] + b[1]] }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1]] }
function mul(a, s) { return [a[0] * s, a[1] * s] }
function len(a) { return Math.hypot(a[0], a[1]) }
function norm(a) { const l = len(a) || 1; return [a[0] / l, a[1] / l] }
function dot(a, b) { return a.reduce((s, v, i) => s + v * b[i], 0) }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }
