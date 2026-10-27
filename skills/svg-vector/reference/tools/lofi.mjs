#!/usr/bin/env node
// node tools/lofi.mjs out.wav [--preset drift|rain|dusk] [--seconds 36] [--bpm n] [--seed 7]
//
// An original lofi bed for demo videos, synthesized from nothing, so it is
// free to post anywhere. Low-passed, gently saturated, faded in and out.
//   drift (default) 66 bpm, the calm one: felt-piano chords with slow
//                   attacks over Dmaj9 Bm9 Gmaj9 Em9, a few soft melody
//                   notes, a warm pad and sub, a muffled kick and a brushed
//                   swell (no clicks, hats or shakers), a smooth rain wash,
//                   a dark low-pass and a little reverb. Mixed quieter.
//   rain            84 bpm, A minor: plucked-guitar arpeggios over Am9 D9
//                   Gmaj9 Em7, a sparse pentatonic melody, a warm pad, a
//                   syncopated kick, rimshot, shaker, rain ambience.
//   dusk            72 bpm: electric-piano sevenths (Fmaj7 Em7 Dm7 Cmaj7),
//                   a warm bass, kick and snare with swung hats, vinyl.
// Use a different preset (or --seed) from the last video so tracks differ.
// record.mjs --music [preset] mixes it under the video.
import { writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const out = args.find((a) => a.endsWith('.wav')) || 'lofi.wav'
const SECONDS = +opt('--seconds', 36)
const PRESET = opt('--preset', 'drift')
const BPM = +opt('--bpm', { dusk: 72, rain: 84, drift: 66 }[PRESET] || 66)
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

function dusk() {
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
}

// Plucked string (Karplus-Strong): a burst of noise in a delay line the
// length of one period, averaged a little each pass so it rings and darkens.
const pluck = (t, m, vel, len, pan, damp = 0.996) => {
  const p = Math.max(2, Math.round(SR / hz(m)))
  const line = Float32Array.from({ length: p }, () => rand() * 2 - 1)
  let i = 0, prev = 0
  add(t, len, pan, (x) => {
    const a = line[i], b = line[(i + 1) % p]
    const v = damp * 0.5 * (a + b)
    line[i] = v; i = (i + 1) % p
    prev += 0.45 * (v - prev) // soften the attack's top end
    const tail = x > len - 0.12 ? (len - x) / 0.12 : 1
    return vel * prev * tail
  })
}
// Pad: a root and fifth with a slow swell, detuned for width.
const pad = (t, notes, len, vel) => notes.forEach((m, k) => {
  const f = hz(m)
  add(t, len, k % 2 ? 0.35 : -0.35, (x) => {
    const env = Math.min(1, x / 0.9) * Math.min(1, (len - x) / 0.8)
    return vel * env * (Math.sin(2 * Math.PI * f * x) + 0.5 * Math.sin(2 * Math.PI * f * 1.004 * x))
  })
})
const rim = (t) => {
  noise(t, 0.08, 0.018, 3800, 1800, 0.3, -0.1)
  add(t, 0.06, -0.1, (x) => 0.12 * Math.exp(-x / 0.012) * Math.sin(2 * Math.PI * 820 * x))
}
const shaker = (t, g) => noise(t, 0.07, 0.03, 7500, 3500, g, 0.3)

function rain() {
  // Am9 D9 Gmaj9 Em7, voiced up top; roots in the bass.
  const CH = [[60, 64, 67, 71], [60, 64, 66, 69], [59, 62, 66, 69], [59, 62, 67, 71]]
  const RT = [45, 38, 43, 40]
  // A sparse melody from A minor pentatonic: [bar-in-loop, eighth, note].
  const MEL = [[0, 4, 76], [0, 6, 74], [1, 3, 72], [1, 7, 69], [2, 2, 74], [2, 5, 76], [2, 6, 79], [3, 4, 76], [3, 7, 72]]
  const bars = Math.ceil(SECONDS / bar) + 1
  const sw = beat * 0.11 // swing on the off-eighths
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar, c = CH[b % 4]
    pad(t0, [c[0] - 12, c[2] - 12], bar + 0.6, 0.05)
    // Arpeggio up and down the chord in eighths.
    const order = [0, 1, 2, 3, 2, 1, 2, 3]
    order.forEach((k, e) => pluck(t0 + e * (beat / 2) + (e % 2 ? sw : 0), c[k] - 12, e === 0 ? 0.5 : 0.36, beat * 1.6, -0.4 + k * 0.27, 0.9965))
    if (b > 0) MEL.filter(([mb]) => mb === b % 4).forEach(([, e, m]) => pluck(t0 + e * (beat / 2) + (e % 2 ? sw : 0), m, 0.42, beat * 2, 0.25, 0.998))
    bass(t0, RT[b % 4], beat * 1.4)
    bass(t0 + beat * 1.75, RT[b % 4], beat * 0.6)
    bass(t0 + beat * 3, RT[b % 4] + 7, beat * 0.9)
    if (b === 0) continue // the title card opens on the guitar alone
    kick(t0); kick(t0 + beat * 1.75); kick(t0 + beat * 2.5)
    rim(t0 + beat); rim(t0 + beat * 3)
    for (let e = 0; e < 16; e++) shaker(t0 + e * (beat / 4) + (e % 2 ? beat * 0.05 : 0), e % 4 === 2 ? 0.05 : 0.028)
  }
  // Rain: a soft wash of filtered noise and scattered drops.
  let w = 0, w2 = 0
  for (let i = 0; i < N; i++) {
    const n = rand() * 2 - 1
    w += 0.08 * (n - w); w2 += 0.6 * (w - w2)
    let v = (w - w2 * 0.6) * 0.05
    if (rand() < 0.0009) v += (rand() * 2 - 1) * 0.05
    L[i] += v; R[i] += v * (0.8 + 0.2 * Math.sin(i / SR))
  }
}


// Felt piano: a soft hammer (slow attack), a long decay, a quick-fading
// second harmonic, and a slight detuned double for warmth. No sharp edge.
const felt = (t, m, vel, len, pan) => {
  const f = hz(m)
  add(t, len, pan, (x) => {
    const env = Math.min(1, x / 0.045) * Math.exp(-x / 2.6) * Math.min(1, (len - x) / 0.6)
    const w = 2 * Math.PI * f * x
    return vel * env * (Math.sin(w) + 0.45 * Math.sin(w * 1.0015) + 0.12 * Math.exp(-x / 0.35) * Math.sin(2 * w))
  })
}
const softKick = (t) => add(t, 0.5, 0, (x) => {
  const f = 42 + 30 * Math.exp(-x / 0.05)
  return 0.32 * Math.min(1, x / 0.006) * Math.exp(-x / 0.22) * Math.sin(2 * Math.PI * f * x)
})
// A brushed swell: noise that fades in and out instead of cracking.
const brush = (t) => {
  let a = 0, b = 0
  const kl = 1 - Math.exp((-2 * Math.PI * 2600) / SR), kh = 1 - Math.exp((-2 * Math.PI * 500) / SR)
  add(t, 0.42, 0.1, (x) => {
    const w = rand() * 2 - 1
    a += kl * (w - a); b += kh * (a - b)
    const env = Math.min(1, x / 0.06) * Math.exp(-x / 0.14)
    return 0.16 * env * (a - b)
  })
}

function drift() {
  // Dmaj9 Bm9 Gmaj9 Em9, close voicings in the middle of the piano.
  const CH = [[54, 57, 61, 64], [50, 54, 57, 61], [54, 57, 59, 62], [50, 54, 55, 59]]
  const RT = [38, 35, 43, 40]
  // A few melody notes per bar, from D major pentatonic: [bar, beat, note].
  const MEL = [[0, 2, 73], [0, 3.5, 71], [1, 1, 69], [1, 2.5, 66], [2, 2, 71], [2, 3, 74], [3, 1.5, 71], [3, 3, 69]]
  const bars = Math.ceil(SECONDS / bar) + 1
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar, c = CH[b % 4]
    // The chord, rolled slowly from the bottom, held into the next bar.
    c.forEach((m, i) => felt(t0 + i * 0.06, m, 0.13, bar + 0.8, -0.45 + i * 0.3))
    pad(t0, [RT[b % 4] + 12, RT[b % 4] + 19], bar + 1, 0.035)
    add(t0, bar, 0, (x) => 0.22 * Math.min(1, x / 0.08) * Math.min(1, (bar - x) / 0.3) * Math.sin(2 * Math.PI * hz(RT[b % 4]) * x)) // sub
    MEL.filter(([mb]) => mb === b % 4).forEach(([, bt, m]) => b > 0 && felt(t0 + bt * beat, m, 0.075, beat * 2.5, 0.3))
    if (b === 0) continue // the title card opens on the piano alone
    softKick(t0); softKick(t0 + beat * 2.5)
    brush(t0 + beat); brush(t0 + beat * 3)
  }
  // Rain: a smooth wash, no drops.
  let w = 0, w2 = 0
  for (let i = 0; i < N; i++) {
    const n = rand() * 2 - 1
    w += 0.05 * (n - w); w2 += 0.5 * (w - w2)
    const v = (w - w2 * 0.7) * 0.035
    L[i] += v; R[i] += v * 0.92
  }
  // A little room: two damped feedback delays per side, mixed in low.
  const room = (buf, d1, d2) => {
    const a = new Float32Array(buf), n1 = Math.round(d1 * SR), n2 = Math.round(d2 * SR)
    let lp = 0
    for (let i = 0; i < N; i++) {
      const fb = (i >= n1 ? a[i - n1] : 0) * 0.42 + (i >= n2 ? a[i - n2] : 0) * 0.3
      lp += 0.25 * (fb - lp)
      a[i] = buf[i] + lp
    }
    for (let i = 0; i < N; i++) buf[i] = buf[i] * 0.8 + (a[i] - buf[i]) * 0.55
  }
  room(L, 0.113, 0.271); room(R, 0.127, 0.293)
}

;({ dusk, rain, drift }[PRESET] || drift)()

// Master: low-pass for the warm lofi top end, soft saturation, fades, then
// normalise to -3 dBFS.
const LP = 1 - Math.exp((-2 * Math.PI * (PRESET === 'drift' ? 2100 : 3400)) / SR)
let fl = 0, fr = 0, peak = 0
for (let i = 0; i < N; i++) {
  fl += LP * (L[i] - fl); fr += LP * (R[i] - fr)
  const t = i / SR
  const fade = Math.min(1, t / 1.2, (SECONDS - t) / 2.5)
  L[i] = Math.tanh(fl * 1.4) * Math.max(0, fade); R[i] = Math.tanh(fr * 1.4) * Math.max(0, fade)
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
}
const g = (PRESET === 'drift' ? 0.56 : 0.708) / (peak || 1) // drift peaks at -5 dBFS, the others at -3

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
