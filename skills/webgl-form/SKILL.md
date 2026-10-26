---
name: webgl-form
description: Build a Stripe-style hero wave in Three.js r178: stripe.com's own folded sheet (a plane folded in two, thick with a round edge), on the settings stripe.com ships, with Stripe's unlit shading (a palette painted along the sheet, long silky streaks, a pale underside), big and cropped by its frame, every part drifting on its own noise. Use whenever the user asks for a 3D hero visual, a "Stripe wave", a shader ribbon, a WebGL model or shape, or wants hero art for an idea or brand. Input is the meaning, never a shape: ask for what the product does (one sentence), the brand colours, and where the art sits; with no prompt, read the colours from the code and use Stripe's light-hero wave. The idea changes the wave's colour, crop and settings, never its form.
---

# WebGL form

The form is **the wave**: stripe.com's folded sheet, as stripe.com draws it.
The user's verdict after many attempts: "I only like the Wave because it's
really a good form. The Wave is what I wanted." Every other form tried
(rings, knots, springs, a coiled funnel, a tangled sheet) was rejected. So
an idea never becomes a new shape. It becomes a wave with its own colours,
crop and settings.

| File | What it is |
|---|---|
| `reference/stripe-three.js` | **The engine.** Three.js r178: the folded sheet built in the vertex shader, Stripe's twists as a list of turns, Stripe's unlit shading, the painted palette, the post pass, and `TAKES` / `PRESETS` with the five working waves below. Copy it, then add presets. |
| `reference/stripe-notes.md` | stripe.com's hero wave as it ships: the fold geometry, the shaders, the camera, and the settings of all four of its waves. Read before tuning. |
| `reference/twist-ribbon.js`, `reference/nib-ribbon.ts` | Older plain WebGL2 ribbons (OpenRouter, OpenEvidence). Only for projects that already run them. |
| `reference/ReactMount.tsx` | React/Next mount with fallback. |

## 0. What to ask for

The prompt carries **meaning, never a shape**. Shapes were the failure: every
named form built literally (a Mobius ring, a knot, a spring, a tornado)
came out as 3D clip art. The OpenRouter ribbon worked because the meaning
("many models in, one endpoint out") became settings (where the sheet
turns edge-on), not a drawing of the product.

**Ask for at most three things, in one message:**

1. **The idea**, in one sentence: what the product does, or the one thing the
   art should say. ("Every model through one endpoint.")
2. **The colours**: the brand's, or "read them from the code" (the tokens in
   `globals.css`, a Tailwind theme, the logo's colours).
3. **Where it sits**: a hero band (under or around copy), a cell, a card; a
   light or a dark page.

**No prompt at all** is a valid use: read the colours from the code, use the
`wave` preset in Stripe's light-hero placement, and say so in one line.

**A named shape** ("make a tornado"): do not build the shape. Read it as a
hint about meaning (a tornado: rising, rotation, force) and map that to the
settings below. Tell the user in one line that the skill keeps the wave and
why. If they still insist, build the shape as one extra take beside the
waves, labelled, so they can compare.

**From meaning to settings** (starting points, not rules):

| The idea feels | Start from | Change |
|---|---|---|
| Calm, trust, money, health | `deep` | Pace 4e-5, cool or warm-neutral palette, wide crop |
| Many into one, focus, an endpoint | `wave` | Place the edge-on stretch (the pinch) under or beside the copy |
| Energy, real time, speed | `petal` or `fold` | Pace up to 8e-5, warm palette |
| Change, two sides, a turnaround | `turn` | The roll-over shows both faces |
| Nothing specific | `wave` | Brand palette only |

**Output:** two or three takes on a takes page, the same wave family in
different presets, crops or palettes. The user picks one; delete the rest.

## 1. The form

- **The folded sheet**: a 400 x 400 plane (128 x 256 segments) folded in
  half: the top layer, a 32 unit strip bent round into a half cylinder (the
  rounded fold), the bottom layer tucked under, 4 units apart at the ends
  and 2 mid-length. Stood up with two quarter turns: length along x,
  thickness along y, width along z. Thick, with a round edge, never a
  hairline. Built from the uv in the vertex shader (`folded(uv)`), so normals
  are exact.
- **Stripe's three twists** shape it: rotations about the diagonal axes
  `(.5, 0, .5)` and `(0, .5, .5)`, each ramped by Stripe's soft step
  `exp2(-exp2(n) * pow(x, n))` along the width (u) or the length (v). In the
  engine: `stripeTwists([x, y, z], [powX, powY, powZ])` from Stripe's numbers.
  The x twist drifts on noise along the length: that, with the noise wave,
  is all the motion. Parts move; the whole never spins.
- **The noise wave**: `p.y += amount * noise(x * fx + t, z * fz + t)`.
- **Placement** in Stripe's frame: a 1392px-wide canvas in pixel units, an
  orthographic camera at `(100, 0, 5000)` turned 0.02 rad about y; every
  number scales by `canvas width / 1392`. **Always big and cropped by its
  frame**, never small and floating.
- Pace: Stripe's clock, `4e-5` to `8e-5` per millisecond. Slow on purpose.

## 2. The five waves that work

Four are the waves stripe.com ships, with their exact settings (twist x, y,
z; powers; noise wave; placement; glow; pace). The fifth adds one turn.

| Preset | Source | Twist x, y, z / powers | Noise wave | Rotation; scale; position | Glow | Pace, offset |
|---|---|---|---|---|---|---|
| `wave` | Stripe's light hero | -0.65, 0.41, -0.58 / 3.63, 0.7, 3.95 | 0.005831, 0.016001, -7.821 | -0.4496, -0.1176, 1.8744; 9, 8, 5; 380, -301.7, -11.1 | 1.98, 0.806, 0.834 | 4e-5, 17500 |
| `deep` | Stripe's dark hero, drawn on white | -0.055, 0.077, -0.518 / 3.95, 5.85, 6.33 | 0.003234, 0.00799, 6.051 | -0.1596, -0.2836, -2.8156; 10, 10, 7; -24.3, -56.4, -11.1 | 0.6, 0.589, 1 | 4e-5, 1150 |
| `fold` | Stripe's billing hero, turned to fit a cell | -0.424, 0.024, -1.312 / 1.81, 0.94, 4.76 | 0.005, 0.0212, 6.68 | -0.666, -0.0314, **1.9**; 6.05, 8.4, 6.99; **50, -100**, -11.1 | 1.55, 1.174, 0.972 | 5.25e-5, 17500 |
| `petal` | Stripe's small accent wave, enlarged and turned | 0.059, 0.32, -0.397 / 3.63, 0.44, 5.99 | 0.005831, 0.016001, -7.821 | -2.8756, 3.0959, **-1.6**; **9, 9, 9**; **0, -50**, -11.1 | 3.86, 0.923, 1 | 8e-5, 2275 |
| `turn` | The light hero, rolled fully over (the only added turn that works) | light hero's, plus `LENGTH (1, 0, 0) along v, 2pi, drift 0.15` | light hero's | light hero's | light hero's | light hero's |

Bold numbers differ from Stripe's own placement: Stripe placed those waves
for its own frames, so in a smaller cell they cropped to a flat patch or
floated small. **Re-place, never re-shape**: to fit a different frame,
change rotation, scale and position only (`data-overrides` in HTML).

## 3. The shading: Stripe's own, unlit

The live stripe.com hero has no lighting at all; that is why it looks bright
and luminous, not plastic. Its surface is:

1. **The palette** at the sheet's (u, v).
2. **Long, fine streaks** along the length: `n0 = noise(u * 0.1, v * 0.5)`,
   `n1 = noise(u * (600 + 300 n0), v * 4 n0)` (very fine across, nearly
   constant along), added as `n1 * 0.2 to 0.26 * (1 - blue * 0.9) * pdy *
   edge`, where `edge = 1 - pow(4u(1 - u), 3)` (strongest toward the open
   edges). They show best on warm colours; for an all-blue palette lower the
   blue fade to about 0.4.
3. **The glow term** `pdy`: `dFdy(v) * resolution.y * amount`, mapped from
   -1..1 to 0..1, raised to a power, smoothstepped by the ramp. Its sign
   tells the sheet's two faces apart; near zero the sheet is folding.
4. Contrast, saturation, hue, then **`+ (1 - pdy) * 0.25`**: the other face
   and the fold go pale. That is the creamy band at Stripe's fold.
5. Opaque, depth-tested. **Post pass**: a 0.02 rad rotational blur kept off a
   sharp band across the middle, then grain (1.1) where there is colour.
   **The grain is Stripe's static dither**: `color + mix(1, -1, random(
   gl_FragCoord.xy * 0.01)) * 4/255 * amount`. It never changes from frame
   to frame. A grain re-randomised every frame shimmers and reads as noise
   ("too much noise compared to Stripe"), and in video it also bloats the
   file several times over.

No drawn lines, no travelling lights, no normal lighting, no crease
highlight: the engine's older lit shading is kept only as an option
(`shading: "lit"`) and is not the default.

## 4. The palette

Paint it the way Stripe's runs, not as random blotches (random blotches gave
one flat colour over most of the visible sheet):

- **Along the length (v)**, the main gradient. The light hero: lavender blue
  `#9fb6ff`, violet `#a978ff`, magenta `#e05cff`, hot pink `#ff4fa8`, orange
  `#ff7a2a`, amber `#ffa318`.
- **Across the width (u)**, a tint toward the open edges (about 75%,
  fading out by u = 0.22 from each side): lavender `#a9b6ff` for the light
  hero.
- **A few faint blotches** (14, at 25%) only to vary it.
- The engine's `palette(along, edge, blobs)` builds this. Other working sets:
  ocean (blue to cyan), dusk (orange, pink, violet), lime (teal, green,
  yellow, orange), ember (pink, red, orange, yellow).
- The colour is the brand's, or Stripe-like. Decorative, never data.

## 5. Placement in the page

### Copy over the wave (Stripe's overlap)

Measured on stripe.com, 2026-10-22. When the wave runs under the headline,
Stripe does not mask it out and does not let it cover the words. It draws
the copy **twice**:

1. **Below the canvas**: the copy in its normal colours (Stripe: headline
   navy `#061b31`, body grey). Where the wave passes over it, the wave hides
   it.
2. **Above the canvas** (`z-index` over the wave's layer): an identical
   copy, same size and position, `aria-hidden`, with
   `mix-blend-mode: hard-light` and see-through tinted colours (Stripe:
   headline `rgb(45, 37, 100)`, a deep violet; body
   `rgba(0, 14, 255, 0.5)`, a half-transparent blue). Over the white page
   it reads as the normal text; over the wave the letters take the wave's
   colours, so they stay readable and look printed on the silk.

Rules:
- Pick the top copy's tints from the brand: a deep, saturated version of
  the headline colour, and a half-transparent brand blue (or accent) for the
  body. Check a screenshot where the wave is brightest: every word still
  readable.
- The two copies must match exactly (same element styles, same wrap): build
  them from one source and stack them in one grid cell
  (`grid-area: 1 / 1`), so a font or width change moves both.
- Screen readers get the bottom copy only; the top one is `aria-hidden`
  and takes no pointer events. Buttons and links stay in the bottom layer
  and are never covered by the canvas (keep them out of the wave's path,
  or lift just the buttons above it).
- Reduced motion and the still-image fallback keep both copies; the blend
  works over the still image too.
- Never make the copy dodge the wave with a white plate or a mask: that is
  the look the double copy exists to avoid.

- The wave fills or crops its cell or hero band. Captions sit on a small
  page-coloured chip.
- Never under the nav or into the next section. Where a cropped wave meets
  the top of a band, fade it with a CSS mask; where it meets copy, use the
  double copy above.
- No labels, numbers or grid lines inside the art.

## 6. Engineering rules

- Three.js r178 installed into the project, loaded with an import map
  (`"three": "/node_modules/three/build/three.module.js"`).
- `THREE.ColorManagement.enabled = false`; palette `NoColorSpace`;
  `ShaderMaterial` in GLSL1 style.
- `failIfMajorPerformanceCaveat: true`; on failure a still image of the same
  wave. Watch frame times: drop the post pass, then the DPR, then stop on a
  still frame.
- DPR capped at 2; `ResizeObserver`; pause off screen and in hidden tabs;
  reduced motion draws one settled frame. No pointer reactivity.
- Up to about 13 waves on a page; past 16 the browser drops contexts.
- Never name a GLSL variable `step`, `mix` or `fract`.

## 7. Workflow

1. Get the input (section 0): the idea, the colours, the place. No prompt:
   colours from the code, the `wave` preset. Map the idea to a preset, a
   crop and a palette; never to a new shape.
2. Compare against the real thing: screenshot stripe.com's hero at
   1440x900, render ours in a canvas at Stripe's exact frame (1392 x 761 at
   x 337), and compare the two at the same crop. Texture and colour are
   judged this way, not from memory.
3. For a page of several waves, use the presets above, re-placed to fit
   each frame; show alternatives on a takes page.
4. Verify at full size (headless Chrome): console clean and every canvas
   built; 1440 and 375; two frames four seconds apart compared per quarter
   (uneven change: parts moving; even change: a spin); the wave fills its
   frame.
5. Commit with a message that says what changed for the eye.

## Rejected, do not repeat

- **Taking a named shape literally.** A prompt like "make a tornado" is a
  hint about meaning, not geometry.
- **Any form other than the wave.** Rings, knots, springs and tubes swept
  along a path ("the other ones don't seem to be really cool"), and the
  folded sheet pushed into other shapes by strong turns: a coiled funnel, a
  wound coil, a tangle ("the tangle, the coil and the funnel are really
  bad"). Only the gentle roll-over (`turn`) passed, as "maybe okay".
- Lit, shaded sheets: they read plastic next to Stripe's unlit surface.
- A palette of random blotches: one flat colour fills the visible sheet.
- A single-layer sheet: "you can see the thin sides".
- The whole object rotating: "the whole thing moved, not some parts".
- Travelling light lines: "it was only an OpenRouter thing, here we imitate
  Stripe".
- A small wave floating in the middle of its frame.
- Ordinary alpha blending on anything see-through: seams.
- Drawn lines, node-and-wire diagrams, grid lines, labels or counts in the
  art; a wave reaching under the nav.
