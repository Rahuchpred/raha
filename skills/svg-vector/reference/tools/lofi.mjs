#!/usr/bin/env node
// node tools/lofi.mjs out.wav [--seconds 36] [--bpm 72] [--seed 7]
//
// An original lofi bed for demo videos, synthesized from nothing, so it is
// free to post anywhere: soft electric-piano sevenths (Fmaj7 Em7 Dm7 Cmaj7),
// a warm bass, a dusty kick and snare with swung hats, vinyl crackle, all
// low-passed and gently saturated. Fades in and out over the length.
// record.mjs --music mixes it under the video.
import { writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const out = args.find((a) => a.endsWith('.wav')) || 'lofi.wav'
const SECONDS = +opt('--seconds', 36)
const BPM = +opt('--bpm', 72)
let seed = +opt('--seed', 7)
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) // repeatable noise

const SR = 44100
const N = Math.ceil(SECONDS * SR)
const L = new Float32Array(N), R = new Float32Array(N)
const beat = 60 / BPM, bar = beat * 4
const hz = (m) => 440 * 2 ** ((m - 69) / 12)

// Add a mono voice into the stereo bed at time t (s), panned -1..1.
const add = (t, len, pan, fn) => {
  const s0 = Math.floor(t * SR), n = Math.floor(len * SR)
  const gl = Math.cos(((pan + 1) * Math.PI) / 4), gr = Math.sin(((pan + 1) * Math.PI) / 4)
  for (let i = 0; i < n && s0 + i < N; i++) {
    if (s0 + i < 0) continue
    const v = fn(i / SR)
    L[s0 + i] += v * gl; R[s0 + i] += v * gr
  }
}

// Electric piano: a sine with a fading second harmonic and a bell-like
// third at the attack, a slow decay, and tremolo.
const keys = (t, m, vel, len, pan) => {
  const f = hz(m) * (1 + (rand() - 0.5) * 0.002)
  add(t, len, pan, (x) => {
    const env = Math.min(1, x / 0.012) * Math.exp(-x / 1.7) * (x > len - 0.25 ? (len - x) / 0.25 : 1)
    const trem = 1 - 0.14 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 4.3 * x))
    const w = 2 * Math.PI * f * x
    return vel * env * trem * (Math.sin(w) + 0.28 * Math.exp(-x / 0.5) * Math.sin(2 * w) + 0.06 * Math.exp(-x / 0.08) * Math.sin(3 * w))
  })
}
const bass = (t, m, len) => add(t, len, 0, (x) => {
  const env = Math.min(1, x / 0.02) * Math.exp(-x / 0.9) * (x > len - 0.08 ? (len - x) / 0.08 : 1)
  return 0.34 * Math.tanh(1.6 * env * Math.sin(2 * Math.PI * hz(m) * x))
})
const kick = (t) => add(t, 0.4, 0, (x) => {
  const f = 45 + 75 * Math.exp(-x / 0.035)
  return 0.42 * Math.exp(-x / 0.16) * Math.sin(2 * Math.PI * f * x)
})
// One-pole filtered noise, for snare and hats.
const noise = (t, len, decay, lp, hp, gain, pan) => {
  let a = 0, b = 0
  const kl = 1 - Math.exp((-2 * Math.PI * lp) / SR), kh = 1 - Math.exp((-2 * Math.PI * hp) / SR)
  add(t, len, pan, (x) => {
    const w = rand() * 2 - 1
    a += kl * (w - a); b += kh * (a - b)
    return gain * Math.exp(-x / decay) * (a - b)
  })
}
const snare = (t) => {
  noise(t, 0.3, 0.09, 4200, 900, 0.32, 0.05)
  add(t, 0.15, 0, (x) => 0.1 * Math.exp(-x / 0.04) * Math.sin(2 * Math.PI * 185 * x))
}
const hat = (t, g) => noise(t, 0.06, 0.018, 9000, 5000, g, 0.25)

const CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]
const ROOTS = [41, 40, 38, 36]
const bars = Math.ceil(SECONDS / bar) + 1
for (let b = 0; b < bars; b++) {
  const t0 = b * bar, c = CHORDS[b % 4]
  // The chord, strummed a touch, held for the bar; a soft re-strike late in it.
  c.forEach((m, i) => keys(t0 + i * 0.018, m, 0.24, bar * 0.98, -0.5 + i * 0.33))
  c.slice(1).forEach((m, i) => keys(t0 + beat * 2.5 + i * 0.015, m + (i === 2 ? 12 : 0), 0.1, beat * 1.4, 0.4 - i * 0.3))
  bass(t0, ROOTS[b % 4], beat * 1.5)
  bass(t0 + beat * 2.5, ROOTS[b % 4] + (b % 2 ? 7 : 12), beat * 1.2)
  // Drums start after the first bar, so the title card opens on keys alone.
  if (b === 0) continue
  kick(t0); kick(t0 + beat * 2); if (b % 2) kick(t0 + beat * 2.75)
  snare(t0 + beat); snare(t0 + beat * 3)
  for (let e = 0; e < 8; e++) hat(t0 + e * (beat / 2) + (e % 2 ? beat * 0.09 : 0), e % 2 ? 0.045 : 0.07) // swung eighths
}

// Vinyl: a quiet hiss and sparse crackles.
let h = 0
for (let i = 0; i < N; i++) {
  h += 0.02 * ((rand() * 2 - 1) - h)
  let v = h * 0.06
  if (rand() < 0.00018) v += (rand() * 2 - 1) * 0.25
  L[i] += v; R[i] += v * 0.9
}

// Master: low-pass for the warm lofi top end, soft saturation, fades, then
// normalise to -3 dBFS.
const LP = 1 - Math.exp((-2 * Math.PI * 3400) / SR)
let fl = 0, fr = 0, peak = 0
for (let i = 0; i < N; i++) {
  fl += LP * (L[i] - fl); fr += LP * (R[i] - fr)
  const t = i / SR
  const fade = Math.min(1, t / 1.2, (SECONDS - t) / 2.5)
  L[i] = Math.tanh(fl * 1.4) * Math.max(0, fade); R[i] = Math.tanh(fr * 1.4) * Math.max(0, fade)
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
}
const g = 0.708 / (peak || 1)

// 16-bit stereo WAV.
const buf = Buffer.alloc(44 + N * 4)
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8)
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22)
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34)
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40)
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g)) * 32767), 44 + i * 4)
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g)) * 32767), 46 + i * 4)
}
writeFileSync(out, buf)
console.log(out)
