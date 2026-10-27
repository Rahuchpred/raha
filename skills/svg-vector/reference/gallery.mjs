#!/usr/bin/env node
// node gallery.mjs [out.html] [--big] [--only a,b] [--row a,b,c]
//   default  every example in both themes, motion wired
//   --big    two columns, figures large, for close inspection
//   --only   just the named scenes
//   --row    a Linear-style feature row of the named scenes (FIG label, art,
//            title, line of text) in both themes
// Self-contained: the engine, motion and each scene's code are inlined.
// A scene may export `meta` ({ fig, title, text }) and `motion(svg)`.
import { render } from './iso.js'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const out = args.find((a) => a.endsWith('.html')) || join(here, 'gallery.html')
const big = args.includes('--big')
const rowArg = args.includes('--row') ? args[args.indexOf('--row') + 1] : null
const onlyArg = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
const files = rowArg || onlyArg
  ? (rowArg || onlyArg).split(',').map((f) => (f.endsWith('.mjs') ? f : f + '.mjs'))
  : readdirSync(join(here, 'examples')).filter((f) => f.endsWith('.mjs')).sort()

const mods = {}
for (const f of files) mods[f] = await import(pathToFileURL(join(here, 'examples', f)).href)

let cells = ''
for (const theme of ['dark', 'light']) {
  if (rowArg) cells += `<section class="row ${theme}">`
  for (const f of files) {
    const { default: scene, meta = {} } = mods[f]
    const svg = render({ theme, ...scene })
    cells += rowArg
      ? `<figure class="card" data-scene="${f}"><span class="fig">${meta.fig || ''}</span><div class="art">${svg}</div><h3>${meta.title || f}</h3><p>${meta.text || ''}</p></figure>`
      : `<figure class="${theme}" data-scene="${f}"><span>${f.replace('.mjs', '')}</span>${svg}</figure>`
  }
  if (rowArg) cells += '</section>'
}

const strip = (src) => src.replace(/^import .*$/gm, '').replace(/^export (const|function|let)/gm, '$1').replace(/^export /gm, '')
const engine = strip(readFileSync(join(here, 'iso.js'), 'utf8'))
const motion = strip(readFileSync(join(here, 'iso-motion.js'), 'utf8'))
const scenes = files.map((f) => {
  const src = readFileSync(join(here, 'examples', f), 'utf8')
    .replace(/JSON\.parse\(readFileSync\(new URL\('\.\.\/data\/([^']+)', import\.meta\.url\), 'utf8'\)\)/g, (_, d) => readFileSync(join(here, 'data', d), 'utf8'))
    .replace(/^export default /m, 'const __scene = ')
  return `mods[${JSON.stringify(f)}] = (() => {\n${strip(src)}\nreturn { motion: typeof motion === 'function' ? motion : null }\n})()`
}).join('\n')

const rowCss = `
body{display:block;background:#777}
.row{display:grid;grid-template-columns:repeat(${files.length},1fr);border-top:1px solid var(--rule)}
.row.dark{--rule:#23252a;background:#08090A;color:#F7F8F8}.row.light{--rule:#E6E6E3;background:#FBFBFA;color:#1A1B1E}
.card{margin:0;padding:28px 28px 32px;place-items:normal;align-items:stretch;border-right:1px solid var(--rule);display:flex;flex-direction:column;min-height:440px}
.card:last-child{border-right:none}
.fig{font:11px ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;opacity:.4}
.art{flex:1;display:grid;place-items:center;padding:18px 0}
.art svg{width:100%;max-width:300px;max-height:270px;height:auto}
.card h3{font:500 15px/1.3 system-ui,sans-serif;margin:0 0 6px}
.card p{font:14px/1.5 system-ui,sans-serif;margin:0;opacity:.55;text-wrap:balance}
@media (max-width:900px){.row{grid-template-columns:1fr 1fr}.card{border-bottom:1px solid var(--rule)}}
@media (max-width:560px){.row{grid-template-columns:1fr}.card{border-right:none;min-height:380px}}`

writeFileSync(out, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Iso gallery</title>
<style>
body{margin:0;font:12px ui-monospace,monospace;background:#777;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
figure{margin:0;padding:24px;display:grid;place-items:center;min-height:320px;position:relative}
figure>span{position:absolute;top:12px;left:16px;letter-spacing:.05em;text-transform:uppercase;opacity:.5}
figure svg{max-width:100%;height:auto}${big ? 'body{grid-template-columns:1fr 1fr}figure svg{width:100%;max-height:640px}' : ''}
.dark{background:#08090A;color:#D0D6E0}.light{background:#FBFBFA;color:#2A2C30}
${rowArg ? rowCss : ''}
</style>
<body>${cells}
<script type="module">
${engine}
${motion}
const mods = {}
${scenes}
document.querySelectorAll('figure[data-scene]').forEach((f) => mods[f.dataset.scene].motion?.(f.querySelector('svg')))
</script>`)
console.log(out)
