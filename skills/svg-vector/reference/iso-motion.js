// iso-motion.js: the two pointer behaviours from linear.app's benefit figures.
// Dot matrices need no JS: drawGrid() ships them as CSS steps() keyframes.
//
//   liftStack(svg, opts)  Fig 0.1. Hover a layer of a stack: it and every
//                         layer above ride up, the hovered one first.
//   pointerWave(svg, opts) Fig 0.3. Pointer x sets each solid's height via a
//                         falloff, a spring smooths it, paths are rewritten.
//
// Both honour prefers-reduced-motion: lifts jump, waves stay at rest.

import { drawObject, makeProjector, sphereSurface, ZS } from './iso.js'

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

// Linear: 0.7s cubic-bezier(.32,.72,0,1), 0.05s stagger, lift = the lid gap.
export function liftStack(svg, { step = 30, stagger = 0.05, max = Infinity } = {}) {
  const groups = [...svg.querySelectorAll('[data-lift]')]
  const boxes = groups.map((g) => ({ g, i: +g.dataset.lift, b: g.getBBox() }))
  const set = (s) => {
    for (const { g, i } of boxes) {
      const on = s != null && i <= s
      g.style.setProperty('--lift-delay', on ? `${(s - i) * stagger}s` : '0s')
      g.style.transform = on ? `translateY(${-step}px)` : ''
    }
  }
  const toUser = (e) => {
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY
    return p.matrixTransform(svg.getScreenCTM().inverse())
  }
  const move = (e) => {
    const { y } = toUser(e)
    // Resting boxes, so a lifted layer never steals the hit.
    const hit = boxes.filter(({ b }) => y >= b.y && y <= b.y + b.height).sort((a, b) => a.i - b.i)
    set(hit.length ? Math.min(hit[hit.length - 1].i, max) : null)
  }
  svg.addEventListener('pointermove', move)
  svg.addEventListener('pointerleave', () => set(null))
  return () => { svg.removeEventListener('pointermove', move); set(null) }
}

// Linear's falloff (screen px): peak 128 under the pointer, 40 at 25px,
// 12 past 60px. Spring: stiffness 100, damping 18, mass 1.
export const linearFalloff = (t) => (t <= 25 ? 128 - (t / 25) * 88 : t <= 60 ? 40 - ((t - 25) / 35) * 28 : 12)

export function pointerWave(svg, { rest, make, falloff = linearFalloff, spring = { stiffness: 100, damping: 18, mass: 1 }, zs = ZS }) {
  const proj = makeProjector(zs)
  const uid = svg.dataset.iso || 'iso'
  const groups = rest.map((_, i) => svg.querySelector(`[data-id="p${i}"]`))
  const anchors = groups.map((g) => { const b = g.getBBox(); return b.x + b.width / 2 })
  const state = rest.map((h) => ({ x: h, v: 0, target: h }))
  let px = Infinity, raf = 0, last = 0

  const toUserX = (e) => {
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY
    return p.matrixTransform(svg.getScreenCTM().inverse()).x
  }
  const retarget = () => state.forEach((s, i) => { s.target = isFinite(px) ? falloff(Math.abs(px - anchors[i])) : rest[i] })
  const draw = () => groups.forEach((g, i) => { g.innerHTML = drawObject(make(i, state[i].x), proj, uid) })

  const tick = (now) => {
    const dt = Math.min(0.032, (now - (last || now)) / 1000) || 0.016
    last = now
    let moving = false
    for (const s of state) {
      const a = (-spring.stiffness * (s.x - s.target) - spring.damping * s.v) / spring.mass
      s.v += a * dt; s.x += s.v * dt
      if (Math.abs(s.v) > 0.01 || Math.abs(s.x - s.target) > 0.01) moving = true
    }
    draw()
    raf = moving ? requestAnimationFrame(tick) : 0
    if (!raf) last = 0
  }
  const kick = () => {
    retarget()
    if (reduced()) { state.forEach((s) => { s.x = s.target; s.v = 0 }); draw(); return }
    if (!raf) raf = requestAnimationFrame(tick)
  }
  const move = (e) => { px = toUserX(e); kick() }
  const leave = () => { px = Infinity; kick() }
  if (!reduced()) { svg.addEventListener('pointermove', move); svg.addEventListener('pointerleave', leave) }
  return () => { svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerleave', leave); cancelAnimationFrame(raf) }
}

// Globe spin. Still at rest. Hovering eases it into a spin at `speed`
// deg/s (negative turns the surface east), leaving eases it to a stop. It
// can be grabbed and flung any time; the fling decays to the hover speed
// or to rest. Every frame patches the existing dots and graticule in place
// (no markup rebuild), so it holds the display's frame rate. make(rot)
// returns the sphere at a rotation. Reduced motion: no hover spin, drag
// still works because the user drives it.
export function spinObject(svg, { id, make, rot = 0, speed = -24, ease = 4, degPerPx = 0.5, zs = ZS }) {
  const proj = makeProjector(zs)
  const g = svg.querySelector(`[data-id="${id}"]`)
  const grat = g.querySelector('[data-part="grat"]')
  const equator = g.querySelector('[data-part="equator"]')
  const dotsG = g.querySelector('[data-part="dots"]')
  const hoverSpeed = reduced() ? 0 : speed

  // One ellipse per dot, created once; hidden ones are display:none.
  const NS = 'http://www.w3.org/2000/svg'
  const n = make(rot).dots.length
  const pool = []
  if (dotsG) {
    dotsG.textContent = ''
    for (let i = 0; i < n; i++) { const e = document.createElementNS(NS, 'ellipse'); dotsG.appendChild(e); pool.push(e) }
  }
  const r3 = (v) => Math.round(v * 100) / 100
  const draw = () => {
    const surf = sphereSurface(make(rot), proj)
    if (grat) grat.setAttribute('d', surf.faint)
    if (equator) equator.setAttribute('d', surf.lo)
    for (let i = 0; i < pool.length; i++) {
      const e = pool[i], q = surf.dots[i]
      if (!q) { if (e.style.display !== 'none') e.style.display = 'none'; continue }
      if (e.style.display) e.style.display = ''
      e.setAttribute('cx', r3(q.x)); e.setAttribute('cy', r3(q.y))
      e.setAttribute('rx', r3(q.rx)); e.setAttribute('ry', r3(q.ry))
      e.setAttribute('transform', `rotate(${r3(q.ang)} ${r3(q.x)} ${r3(q.y)})`)
      e.setAttribute('opacity', r3(q.op))
    }
  }

  let v = 0, target = 0, raf = 0, last = 0, dragging = false, px = 0, lastMove = 0, onScreen = true
  const tick = (now) => {
    const dt = Math.min(0.05, (now - (last || now)) / 1000)
    last = now
    if (!dragging) { v += (target - v) * Math.min(1, dt * ease); rot += v * dt }
    draw()
    const live = dragging || Math.abs(v - target) > 0.05 || Math.abs(target) > 0
    raf = onScreen && live ? requestAnimationFrame(tick) : 0
    if (!raf) { last = 0; if (!target && Math.abs(v) <= 0.05) v = 0 }
  }
  const start = () => { if (!raf && onScreen) raf = requestAnimationFrame(tick) }

  const enter = () => { target = hoverSpeed; start() }
  const leave = () => { if (!dragging) target = 0; start() }
  const down = (e) => { dragging = true; px = e.clientX; lastMove = performance.now(); v = 0; svg.setPointerCapture(e.pointerId); svg.style.cursor = 'grabbing'; start() }
  const move = (e) => {
    if (!dragging) return
    const now = performance.now()
    const dx = e.clientX - px; px = e.clientX
    rot -= dx * degPerPx // drag right turns the surface right
    v = (-dx * degPerPx) / Math.max(0.008, (now - lastMove) / 1000) // fling, deg/s
    lastMove = now
  }
  const up = (e) => {
    dragging = false; svg.style.cursor = 'grab'
    if (performance.now() - lastMove > 80) v = 0 // held still before release: no fling
    // still over the globe (mouse) keeps the hover spin; touch has no hover
    target = e && e.pointerType === 'mouse' && svg.matches(':hover') ? hoverSpeed : 0
    start()
  }
  svg.style.cursor = 'grab'
  svg.style.touchAction = 'pan-y'
  const on = [['pointerenter', enter], ['pointerleave', leave], ['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up]]
  on.forEach(([t, f]) => svg.addEventListener(t, f))
  const io = typeof IntersectionObserver !== 'undefined' && new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; if (onScreen) start() })
  io && io.observe(svg)
  draw()
  return () => { cancelAnimationFrame(raf); io && io.disconnect(); on.forEach(([t, f]) => svg.removeEventListener(t, f)) }
}

// Static, invisible copies of every solid's silhouette, laid over the art
// in paint order, so the pointer always lands on the solid you can see. Item
// copies carry data-i; the rest (a case, a lid, a stem) are blockers that
// mean "no item". A moving item never steals or drops the hover because
// these copies do not move.
function hitLayer(svg, items) {
  const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  layer.setAttribute('class', 'iso-hit')
  const hits = []
  for (const g of svg.querySelectorAll('.iso-obj')) {
    const src = [...g.querySelectorAll('.iso-fill')].find((p) => !p.hasAttribute('filter'))
    if (!src) continue
    const h = src.cloneNode()
    h.removeAttribute('class')
    // A transparent fill is still hit-testable, and leaving pointer-events
    // unset lets a hidden ancestor (pointer-events: none) switch it off.
    h.setAttribute('fill', 'transparent')
    const i = items.indexOf(g)
    if (i >= 0) h.dataset.i = i; else h.dataset.block = ''
    layer.appendChild(h)
    hits.push(h)
  }
  svg.appendChild(layer)
  return hits
}

// Hover moves groups tagged with `item` by screen offsets, through the CSS
// transition render() already puts on every object (Linear's .7s curve).
//   mode 'each': active = index of the hovered item, or null
//   mode 'all' : active = true while the figure is hovered
//   offset(i, active, n) -> [dx, dy] screen px, or null for rest
//   stagger(i, active, n) -> delay in seconds
//   transition: optional CSS transition to use instead (e.g. a fast press)
export function hoverMove(svg, { mode = 'each', offset, stagger = () => 0, transition }) {
  const groups = [...svg.querySelectorAll('[data-item]')].sort((a, b) => a.dataset.item - b.dataset.item)
  const n = groups.length
  if (transition) groups.forEach((g) => { g.style.transition = transition })
  const set = (active) => groups.forEach((g, i) => {
    const off = active == null || active === false ? null : offset(i, active, n)
    g.style.setProperty('--lift-delay', `${off ? stagger(i, active, n) : 0}s`)
    g.style.transform = off ? `translate(${off[0]}px, ${off[1]}px)` : ''
  })
  const offs = []
  const on = (el, t, f) => { el.addEventListener(t, f); offs.push(() => el.removeEventListener(t, f)) }
  if (mode === 'all') {
    on(svg, 'pointerenter', () => set(true))
    on(svg, 'pointerleave', () => set(null))
  } else {
    const hits = hitLayer(svg, groups)
    hits.forEach((h) => on(h, 'pointerenter', () => set(h.dataset.i != null ? +h.dataset.i : null)))
    on(svg, 'pointerleave', () => set(null))
  }
  return () => { offs.forEach((f) => f()); set(null) }
}

// A spring per solid, its target set from the pointer. make(i, v) returns
// solid i at value v (a height, a slide); it is redrawn in place. target(i,
// p) gets the pointer in viewBox units ({ x, y }) or null when it is away,
// and returns the value to spring toward. Same spring as Fig 0.3.
export function springField(svg, { count, make, rest, target, id = (i) => `p${i}`, spring = { stiffness: 100, damping: 18, mass: 1 }, zs = ZS }) {
  const proj = makeProjector(zs)
  const uid = svg.dataset.iso || 'iso'
  const groups = Array.from({ length: count }, (_, i) => svg.querySelector(`[data-id="${id(i)}"]`))
  const st = rest.map((v) => ({ x: v, v: 0, t: v }))
  let p = null, raf = 0, last = 0
  const toUser = (e) => {
    const q = svg.createSVGPoint(); q.x = e.clientX; q.y = e.clientY
    const r = q.matrixTransform(svg.getScreenCTM().inverse())
    return { x: r.x, y: r.y }
  }
  const tick = (now) => {
    const dt = Math.min(0.032, (now - (last || now)) / 1000) || 0.016
    last = now
    let moving = false
    st.forEach((s, i) => {
      const a = (-spring.stiffness * (s.x - s.t) - spring.damping * s.v) / spring.mass
      s.v += a * dt; s.x += s.v * dt
      if (Math.abs(s.v) > 0.01 || Math.abs(s.x - s.t) > 0.01) moving = true
      groups[i].innerHTML = drawObject(make(i, s.x), proj, uid)
    })
    raf = moving ? requestAnimationFrame(tick) : 0
    if (!raf) last = 0
  }
  const kick = () => {
    st.forEach((s, i) => { s.t = target(i, p, proj) })
    if (reduced()) { st.forEach((s, i) => { s.x = s.t; s.v = 0; groups[i].innerHTML = drawObject(make(i, s.x), proj, uid) }); return }
    if (!raf) raf = requestAnimationFrame(tick)
  }
  const move = (e) => { p = toUser(e); kick() }
  const leave = () => { p = null; kick() }
  svg.addEventListener('pointermove', move)
  svg.addEventListener('pointerleave', leave)
  return () => { svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerleave', leave); cancelAnimationFrame(raf) }
}

// Fire every once-pulse (line({ pulse: { once: true } })) a single time.
// Returns the time in seconds when the last one lands, so a caller can time
// an arrival. Reduced motion: nothing fires.
export function sendPulses(svg) {
  let end = 0
  if (reduced()) return end
  for (const p of svg.querySelectorAll('.iso-shot')) {
    const len = +p.dataset.len, L = +p.dataset.l, dur = +p.dataset.dur, delay = +p.dataset.delay
    p.getAnimations().forEach((a) => a.cancel())
    p.animate([{ strokeDashoffset: len, opacity: 1 }, { strokeDashoffset: -L + len * 0.5, opacity: 1 }, { strokeDashoffset: -L, opacity: 0 }],
      { duration: dur * 1000, delay: delay * 1000, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'none' })
    end = Math.max(end, delay + dur)
  }
  return end
}

// Play every one-shot grid (grid({ once: true, frames, delay })) a single
// time, holding its last frame. resetGrids() puts frame one back. Reduced
// motion: jump straight to the last frame.
export function playGrids(svg) {
  for (const g of svg.querySelectorAll('[data-grid-once]')) {
    const interval = +g.dataset.interval, delay = +g.dataset.delay * 1000
    for (const c of g.querySelectorAll('circle')) {
      const seq = c.dataset.seq.split(',').map(Number)
      c.getAnimations().forEach((a) => a.cancel())
      if (reduced()) { c.setAttribute('opacity', seq[seq.length - 1]); continue }
      const L = seq.length
      c.animate(seq.map((v, k) => ({ opacity: v, offset: L > 1 ? k / (L - 1) : 0, easing: 'steps(1, end)' })),
        { duration: (L - 1) * interval, delay, fill: 'forwards' })
    }
  }
}

export function resetGrids(svg) {
  for (const c of svg.querySelectorAll('[data-grid-once] circle')) {
    c.getAnimations().forEach((a) => a.cancel())
    c.setAttribute('opacity', c.dataset.seq.split(',')[0])
  }
}
