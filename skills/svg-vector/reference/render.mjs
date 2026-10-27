#!/usr/bin/env node
// node render.mjs <scene.mjs> [--theme dark|light] [--out file.svg]
import { render } from './iso.js'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const scene = (await import(pathToFileURL(resolve(args[0])).href)).default
const svg = render({ theme: opt('--theme', 'dark'), ...scene })
const out = opt('--out')
if (out) writeFileSync(out, svg); else process.stdout.write(svg)
