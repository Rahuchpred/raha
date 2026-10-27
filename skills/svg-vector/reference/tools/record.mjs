#!/usr/bin/env node
// node tools/record.mjs out.mp4 [--layout sequence|grid] [--size 1080x1080]
//   [--scenes a,b,c] [--title "SVG Vector"] [--theme light|dark] [--fps 60]
//
// A demo video: a title card, then the figures. `sequence` (default, square)
// shows one figure at a time, full frame: it fades in, the cursor plays its
// gesture, it fades out, the next comes. `grid` (16:9) shows them all at once
// while the cursor visits each in turn. Frame-exact: a fake clock is installed before the
// page loads. requestAnimationFrame and performance.now run on it, and every
// CSS animation, CSS transition and Web Animation is paused and set to the
// clock each frame, so one capture is one frame however slow the capture
// is. (Chrome's own virtual time stalls screenshots at 60fps.) Frames pipe
// into ffmpeg.
//
// Needs ffmpeg on PATH and puppeteer-core installed somewhere:
//   mkdir /tmp/rec && cd /tmp/rec && npm i puppeteer-core
//   PUPPETEER_DIR=/tmp/rec node tools/record.mjs demo.mp4
// CHROME=/path/to/chrome-headless-shell picks the browser (default: the
// newest headless shell under ~/.cache/puppeteer).
import { render } from '../iso.js'
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir, homedir } from 'node:os'
import { spawn } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const ref = resolve(here, '..')
const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const out = resolve(args.find((a) => a.endsWith('.mp4')) || 'svg-vector.mp4')
const scenes = opt('--scenes', 'triage,command,rack,sync,insights,earth').split(',').map((s) => s.replace(/\.mjs$/, '') + '.mjs')
const title = opt('--title', 'SVG Vector')
const themeName = opt('--theme', 'light')
const FPS = +opt('--fps', 60)
const layout = opt('--layout', 'sequence')
const [W, H] = opt('--size', layout === 'grid' ? '1920x1080' : '1080x1080').split('x').map(Number)
const COLS = 3, ROWS = Math.ceil(scenes.length / 3)
const TITLE_END = 3.1 // the title card owns the opening seconds

// The page palette. Light is raha.site's paper and ink.
const PAGE = themeName === 'dark'
  ? { bg: '#08090A', fg: '#F7F8F8', rule: '#1c1d20', theme: 'dark' }
  : { bg: '#FDFDFC', fg: '#26241F', rule: '#ECEBE8', theme: { bg: '#FDFDFC', hi: '#26241F', mid: '#8E887E', lo: '#CFCAC1', faint: '#E5E1DA', dot: '#26241F' } }

// ------------------------------------------------------------- the stage
const mods = {}
for (const f of scenes) mods[f] = await import(pathToFileURL(join(ref, 'examples', f)).href)
const cells = scenes.map((f) => `<figure data-scene="${f}">${render({ theme: PAGE.theme, ...mods[f].default })}</figure>`).join('')

const strip = (src) => src.replace(/^import .*$/gm, '').replace(/^export (const|function|let)/gm, '$1').replace(/^export /gm, '')
const engine = strip(readFileSync(join(ref, 'iso.js'), 'utf8'))
const motion = strip(readFileSync(join(ref, 'iso-motion.js'), 'utf8'))
const sceneCode = scenes.map((f) => {
  const src = readFileSync(join(ref, 'examples', f), 'utf8')
    .replace(/JSON\.parse\(readFileSync\(new URL\('\.\.\/data\/([^']+)', import\.meta\.url\), 'utf8'\)\)/g, (_, d) => readFileSync(join(ref, 'data', d), 'utf8'))
    .replace(/^export default /m, 'const __scene = ')
  return `mods[${JSON.stringify(f)}] = (() => {\n${strip(src)}\nreturn { motion: typeof motion === 'function' ? motion : null }\n})()`
}).join('\n')

const html = `<!doctype html><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@500&display=block" rel="stylesheet">
<style>
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${PAGE.bg}}
${layout === 'grid' ? `
.grid{position:absolute;inset:0;display:grid;grid-template-columns:repeat(${COLS},1fr);grid-template-rows:repeat(${ROWS},1fr);opacity:0;animation:show .7s cubic-bezier(.22,.61,.36,1) 2.5s forwards}
figure{margin:0;display:grid;place-items:center;border-right:1.5px solid ${PAGE.rule};border-bottom:1.5px solid ${PAGE.rule}}
figure:nth-child(${COLS}n){border-right:none}figure:nth-last-child(-n+${COLS}){border-bottom:none}
figure svg{width:66%;height:auto;max-height:78%}` : `
.grid{position:absolute;inset:0}
figure{position:absolute;inset:0;margin:0;display:grid;place-items:center;opacity:0;pointer-events:none;filter:blur(8px);transition:opacity .5s cubic-bezier(.22,.61,.36,1),filter .5s cubic-bezier(.22,.61,.36,1)}
figure.on{opacity:1;pointer-events:auto;filter:none}
figure:not(.on) *{pointer-events:none!important}
figure svg{width:72%;height:auto;max-height:72%}`}
.title{position:absolute;inset:0;display:grid;place-items:center;background:${PAGE.bg};animation:hide .6s cubic-bezier(.77,0,.175,1) 2.3s forwards}
.title h1{margin:0;font:500 ${layout === 'grid' ? 112 : 96}px/1 Inter,system-ui,sans-serif;letter-spacing:-.045em;color:${PAGE.fg};filter:blur(14px);opacity:0;transform:translateY(10px);animation:blurin .9s cubic-bezier(.22,.61,.36,1) .25s forwards}
@keyframes blurin{to{filter:blur(0);opacity:1;transform:none}}
@keyframes hide{to{opacity:0;visibility:hidden}}
@keyframes show{to{opacity:1}}
#cursor{position:absolute;left:0;top:0;width:30px;height:30px;pointer-events:none;opacity:0;z-index:9;will-change:transform}
</style>
<div class="grid">${cells}</div>
<div class="title"><h1>${title}</h1></div>
<svg id="cursor" viewBox="0 0 24 24"><path d="M4 2.5 4 19.5 8.6 15.4 11.6 22 14.6 20.7 11.7 14.2 18 14.2Z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>
<script type="module">
${engine}
${motion}
const mods = {}
${sceneCode}
document.querySelectorAll('figure[data-scene]').forEach((f) => mods[f.dataset.scene].motion?.(f.querySelector('svg')))
window.__ready = true
</script>`

const dir = mkdtempSync(join(tmpdir(), 'svg-vector-'))
const page_ = join(dir, 'stage.html')
writeFileSync(page_, html)

// --------------------------------------------------------------- browser
const req = createRequire(join(process.env.PUPPETEER_DIR || process.cwd(), 'noop.js'))
const puppeteer = req('puppeteer-core')
const chrome = process.env.CHROME || (() => {
  const base = join(homedir(), '.cache/puppeteer/chrome-headless-shell')
  const v = readdirSync(base).sort().pop()
  const d = join(base, v)
  const sub = readdirSync(d).find((x) => x.startsWith('chrome-headless-shell'))
  return join(d, sub, 'chrome-headless-shell')
})()
if (!existsSync(chrome)) throw new Error('No Chrome at ' + chrome)

const browser = await puppeteer.launch({ executablePath: chrome, headless: 'shell', protocolTimeout: 120000, args: ['--hide-scrollbars', '--force-color-profile=srgb'] })
const page = await browser.newPage()
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
const cdp = await page.createCDPSession()
await page.evaluateOnNewDocument(() => {
  let now = 0
  const queue = []
  const started = new WeakMap()
  performance.now = () => now
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length }
  window.cancelAnimationFrame = () => {}
  const sync = () => {
    for (const a of document.getAnimations()) {
      if (!started.has(a)) { started.set(a, now); a.pause() }
      a.currentTime = now - started.get(a)
    }
  }
  window.__clock = { step(ms) { now += ms; queue.splice(0).forEach((cb) => cb(now)); sync() }, sync }
})
await page.goto(pathToFileURL(page_).href, { waitUntil: 'networkidle0' })
await page.waitForFunction('window.__ready && document.fonts.ready')
await page.evaluate(() => document.fonts.ready)
// Take hold of every animation already running (the title card's) at t = 0.
await page.evaluate(() => window.__clock.sync())

// Points to visit, read from the live page. visible(el) finds the middle of
// the part of a hit shape that is actually on top, so the cursor lands on
// the drawer or key you can see.
// Scenes may export `targets`: world points per item for the cursor.
const targets = Object.fromEntries(scenes.filter((f) => mods[f].targets).map((f) => [f.replace('.mjs', ''), mods[f].targets]))
const pts = await page.evaluate((targets) => {
  const ZS = Math.sqrt(1.5)
  const fig = (n) => document.querySelector(`figure[data-scene="${n}.mjs"] svg`)
  const onScreen = (n, i) => {
    const svg = fig(n), [x, y, z] = targets[n][i], p = svg.createSVGPoint()
    p.x = x - y; p.y = (x + y) / 2 - z * ZS
    const q = p.matrixTransform(svg.getScreenCTM()); return [q.x, q.y]
  }
  const centre = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] }
  const visible = (el) => {
    const r = el.getBoundingClientRect(), hits = []
    for (let i = 1; i < 24; i++) for (let j = 1; j < 24; j++) {
      const x = r.left + (r.width * i) / 24, y = r.top + (r.height * j) / 24
      if (document.elementFromPoint(x, y) === el) hits.push([x, y])
    }
    const m = hits.reduce((a, p) => [a[0] + p[0] / hits.length, a[1] + p[1] / hits.length], [0, 0])
    return hits.sort((a, b) => Math.hypot(a[0] - m[0], a[1] - m[1]) - Math.hypot(b[0] - m[0], b[1] - m[1]))[0] || centre(el)
  }
  const hit = (n, i) => (targets[n] ? onScreen(n, i) : visible(fig(n).querySelector(`.iso-hit [data-i="${i}"]`)))
  const box = (n) => { const r = fig(n).getBoundingClientRect(); return [r.left, r.top, r.width, r.height] }
  const card = document.querySelector('.title')
  card.style.display = 'none' // measure the figures, not the title card above them
  const figs = [...document.querySelectorAll('figure')]
  const solo = (n) => figs.forEach((f) => {
    f.style.transition = 'none'
    f.classList.toggle('on', n === null || f.dataset.scene === n + '.mjs')
  })
  const sequence = !document.querySelector('.grid').style.gridTemplateColumns && getComputedStyle(figs[0]).position === 'absolute'
  const measure = (n, fn) => { if (sequence) solo(n); const v = fn(); return v }
  const out = {}
  if (fig('triage')) out.triage = measure('triage', () => centre(fig('triage')))
  if (fig('command')) out.command = measure('command', () => [0, 6, 3].map((i) => hit('command', i)))
  if (fig('rack')) out.rack = measure('rack', () => [0, 1, 2, 3, 4].map((i) => hit('rack', i)))
  if (fig('sync')) out.sync = measure('sync', () => centre(fig('sync')))
  if (fig('insights')) out.insights = measure('insights', () => { const [x, y, w, h] = box('insights'); return [[x + w * 0.3, y + h * 0.42], [x + w * 0.55, y + h * 0.35], [x + w * 0.7, y + h * 0.55], [x + w * 0.45, y + h * 0.62], [x + w * 0.5, y + h * 0.47]] })
  if (fig('earth')) out.earth = measure('earth', () => centre(fig('earth').querySelector('[data-id="earth"]')))
  if (sequence) { figs.forEach((f) => { f.classList.remove('on') }); void document.body.offsetHeight; figs.forEach((f) => { f.style.transition = '' }) }
  card.style.display = ''
  return out
}, targets)

// --------------------------------------------------------------- script
// A step moves the cursor to p over t seconds (eased), then holds. `show`
// (sequence only) names the figure to fade in at that step's first frame,
// or null to fade the current one out.
const steps = []
const go = (p, t, hold = 0) => steps.push({ p, t, hold })
const wait = (t, show) => steps.push({ p: null, t: 0, hold: t, show })
const gesture = {
  triage: () => go(pts.triage, 0.7, 1.9),
  command: () => { go(pts.command[0], 0.6, 0.75); go(pts.command[1], 0.38, 0.85); go(pts.command[2], 0.32, 0.6) },
  rack: () => { go(pts.rack[0], 0.6, 0.6); pts.rack.slice(1).forEach((p) => go(p, 0.32, 0.5)) },
  sync: () => go(pts.sync, 0.6, 2.6),
  insights: () => { go(pts.insights[0], 0.6, 0.15); pts.insights.slice(1).forEach((p) => go(p, 0.55, 0.05)) },
  earth: () => go(pts.earth, 0.6, 3.2),
}
const names = scenes.map((f) => f.replace('.mjs', '')).filter((n) => gesture[n] && pts[n])
const park = layout === 'grid' ? [W - 60, H + 40] : [W - 96, H - 84]
if (layout === 'grid') {
  names.forEach((n) => gesture[n]())
  go(park, 0.9, 1.3)
} else {
  names.forEach((n, i) => {
    wait(i === 0 ? 0.55 : 0.45, n) // fade in
    gesture[n]()
    go(park, 0.55, 0.35) // step off: the figure settles back to rest
    wait(0.45, null) // fade out
  })
  wait(0.4, names[0]) // end on the first figure, at rest, so a loop is seamless-ish
  wait(0.6)
}

const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2)
const timeline = [] // per frame: { p: cursor or null, show?: figure | null }
for (let t = 0; t < TITLE_END; t += 1 / FPS) timeline.push({ p: null })
let from = layout === 'grid' ? park : [W - 96, H + 40] // first entry: up from below the frame
for (const s of steps) {
  const first = timeline.length
  const n = s.p ? Math.max(1, Math.round(s.t * FPS)) : 0
  for (let k = 1; k <= n; k++) { const u = ease(k / n); timeline.push({ p: [from[0] + (s.p[0] - from[0]) * u, from[1] + (s.p[1] - from[1]) * u] }) }
  for (let k = 0; k < Math.round(s.hold * FPS); k++) timeline.push({ p: s.p || from })
  if (s.p) from = s.p
  if ('show' in s && timeline[first]) timeline[first].show = s.show
  if (s.show !== undefined && !s.p && timeline.length === first) timeline.push({ p: from, show: s.show })
}

// ---------------------------------------------------------------- record
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] })

const step = (ms) => page.evaluate((ms) => window.__clock.step(ms), ms)

let shown = false, last = null
for (let f = 0; f < timeline.length; f++) {
  const { p, show } = timeline[f]
  if (show !== undefined) {
    await page.evaluate((n) => document.querySelectorAll('figure').forEach((el) => el.classList.toggle('on', n !== null && el.dataset.scene === n + '.mjs')), show)
  }
  if (p && (!last || p[0] !== last[0] || p[1] !== last[1])) {
    await page.mouse.move(p[0], p[1])
    await page.evaluate((x, y, show) => {
      const c = document.getElementById('cursor')
      c.style.transform = `translate(${x - 6}px, ${y - 4}px)`
      if (show) c.style.opacity = 1
    }, p[0], p[1], !shown)
    shown = true
    last = p
  }
  await step(1000 / FPS)
  // PROBE_AT=<seconds> PROBE_JS=<expression>: print a page value at that moment.
  if (process.env.PROBE_AT && Math.abs(f / FPS - +process.env.PROBE_AT) < 0.5 / FPS) {
    console.log('\nPROBE', JSON.stringify(await page.evaluate(process.env.PROBE_JS)))
  }
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true })
  if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r))
  if (f % FPS === 0) process.stdout.write(`\r${(f / FPS).toFixed(0)}s / ${(timeline.length / FPS).toFixed(1)}s`)
}
ff.stdin.end()
await new Promise((r) => ff.on('close', r))
await browser.close()
console.log(`\n${out}`)
