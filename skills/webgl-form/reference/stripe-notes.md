# How stripe.com draws its hero wave

Read from stripe.com's own shipped code on 2026-10-21 (the `single-wave`
component, chunk `73692`). These are notes on the technique, in our words.
Do not paste Stripe's code into a project. Rebuild the ideas in our engine.

## Engine and setup

- Three.js r178. The canvas says so: `data-engine="three.js r178"`.
- **Orthographic camera** at z = 5000, not a perspective one. Depth reads
  from shading and the fold, not from things getting smaller far away.
- DPR capped at 2. `powerPreference: "high-performance"`.
- **Capability gate**: it asks for a context with
  `failIfMajorPerformanceCaveat: true` (refuses slow software rendering)
  and checks required features. Any failure throws, and the page shows a
  **static image of the same wave** (`.single-wave__static`, preloaded webp,
  sized per breakpoint: up to 639px, 640 to 1263px, 1264px and up). The
  dark-theme wave is turned off on touch phones outright and shows the
  image.
- A shared render loop measures frame times, estimates the refresh rate,
  raises warning levels when frames are slow and suspends the wave if the
  device cannot keep up. Pauses on `visibilitychange`.
- The clear colour is read from a CSS variable on the page, so the canvas
  edge melts into the background.
- A mouse position uniform exists but its effect is a TODO. The wave does
  not react to the pointer.

## Shape (vertex shader)

- A plane (a custom "folded" geometry with a tangent attribute), bent by
  **three rotations in a row**, each around a diagonal axis such as
  (0.5, 0, 0.5) or (0, 0.5, 0.5).
- Each rotation's angle is a strength times a **soft step along u or v**:
  `exp2(-exp2(n) * pow(x, n))`. That keeps one end flat and lets the twist
  build up toward the other, with `n` (the "power", about 0.4 to 6) setting
  how sudden the turn is. Twist strengths are small (about 0.02 to 1.3 rad).
- One twist's strength wanders with simplex noise over v and time, so the
  fold breathes.
- A **simplex-noise displacement** pushes the sheet up and down, read from
  world x and z at very low frequency (about 0.006 and 0.016) with a large
  amount (about -7.8). Big, slow undulation.
- Time runs very slowly: speed about 0.00004 to 0.00008 per ms, so 0.04 to
  0.08 per second.

## Two layers, two materials

The sheet is drawn twice: once as a **surface** and once as **lines**.

### Lines

- Lines are `abs(sin(u * lineAmount))` with lineAmount about 425 (around
  135 lines across the sheet), cut with a smoothstep.
- **Line thickness follows the screen-space derivative of the uv**
  (`dFdy`): `thickness * pow(abs(dy * maxWidth), derivativePower)`. Where
  the sheet is foreshortened the lines thicken, so folds read stronger and
  the lines never alias into noise.
- Lines fade with depth (clip-space z), so the far part is fainter.
- Colour comes from the same palette as the surface.

### Surface

- **Colour is a 2D palette texture** (a 500x500 painted image of soft,
  blurry blotches) sampled at the sheet's (u, v). Colour changes across the
  width and along the length at once, with no visible stops. Then global
  contrast, saturation and hue shift controls.
- **Glow from the derivative**: how fast v changes per screen pixel
  (`dFdy(v_uv).y * resolution.y * glowAmount`), remapped, raised to a power
  and ramped. Where the sheet turns edge-on the derivative spikes, so the
  glow appears exactly at the folds, for any geometry, with no normals
  needed. The surface also gets `+ (1 - pdy) * 0.25` brightness.
- **Fine texture**: high-frequency simplex noise streaks along the length,
  roughly `simplex(u * (600 + 300 * n0), v * 4 * n0)` where n0 is a very
  low-frequency noise, so the streak density itself drifts. Strength about
  0.2, weaker on blue-heavy colours, stronger toward the sheet's two long
  edges (one minus a parabola across u), and gated by the glow term.
- **Noise bands**: up to two feathered rectangles in uv space that override
  the texture's strength, frequency and edge falloff. This is how one
  stretch of the wave looks plain satin and another looks finely lined.

## Post-processing

- Rendered to a target, then one full-screen pass:
  - **Angular blur**: samples rotated around the screen centre (a small
    rotational motion blur, amount about 0.02).
  - The blur's strength depends on **screen height**: a band through the
    middle stays sharp, top and bottom go soft
    (`smoothstep(0, 0.7, y) - smoothstep(0.2, 1, y)`). Depth of field by
    screen band, cheap and art-directed.
  - An optional **diffuse blur**: 16 random samples in a disc, weighted
    toward the centre.
  - **Grain** at about 1.1 to 1.2.
- Post-processing runs in the light theme on desktop only. The dark theme
  and phones skip it.

## What this tells us

1. A 2D palette beats a 1D gradient: the colour feels painted.
2. Derivatives (`dFdx`, `dFdy`) are the cheapest way to find folds and to
   size lines in screen pixels. Use them alongside the normal-based light.
3. Lines and surface as two separate passes give independent control.
4. Plain and lined stretches are placed on purpose (bands), not left to
   chance.
5. Weak devices get a still image of the same art, never an empty hero.
6. No pointer reactivity, even at Stripe.

## The geometry: a folded sheet (read 2026-10-22)

`folded()` (built in a worker, `waveGeometry.worker`) starts from a
400 x 400 plane with 128 x 256 segments and folds it in half:

- Left of x = -16: the top layer, pushed up by the gap.
- From x = -16 to 16: a strip bent into a half cylinder (z runs from +gap to
  -gap round a cosine, x bulges out by the gap), the rounded fold.
- Right of x = 16: mirrored under the top layer, pushed down by the gap.
- The gap is 4 units at both ends of the sheet's length and pinches to 2
  mid-length: `4 - 2 * (4v(1 - v))^9.5`.
- Then shifted by a quarter width and turned -90 degrees about x, then -90
  about y. uv is the flat plane's, so the top layer has u below about 0.46,
  the fold about 0.5, the underside above about 0.54.

So the sheet is two layers with a round edge: thick, never a hairline.

## Settings of the homepage waves

All use the same camera: orthographic, pixel units, at (100, 0, 5000),
turned 0.02 rad about y, zoom 1 (0.93 for the billing wave). Speed is per
millisecond.

| Wave | Theme | Twist x, y, z | Powers x, y, z | Displace fx, fz, amount | Rotation x, y, z | Scale | Position | Lines | Glow amount, power, ramp |
|---|---|---|---|---|---|---|---|---|---|
| Light hero | light | -0.65, 0.41, -0.58 | 3.63, 0.70, 3.95 | 0.005831, 0.016001, -7.821 | -0.4496, -0.1176, 1.8744 | 9, 8, 5 | 380, -301.7, -11.1 | none (amount 1) | 1.98, 0.806, 0.834 |
| Dark hero | dark | -0.055, 0.077, -0.518 | 3.95, 5.85, 6.33 | 0.003234, 0.00799, 6.051 | -0.1596, -0.2836, -2.8156 | 10, 10, 7 | -24.3, -56.4, -11.1 | 425 lines | 0.6, 0.589, 1 |
| Small accent | light | 0.059, 0.32, -0.397 | 3.63, 0.44, 5.99 | 0.005831, 0.016001, -7.821 | -2.8756, 3.0959, -2.9259 | 3, 3, 3 | -200.7, -65.4, -11.1 | none | 3.86, 0.923, 1 |
| Billing hero | light | -0.424, 0.024, -1.312 | 1.81, 0.94, 4.76 | 0.005, 0.0212, 6.68 | -0.666, -0.0314, 0.7791 | 6.05, 8.40, 6.99 | 206.1, -438, -11.1 | none | 1.55, 1.174, 0.972 |

Speeds: 4e-5 (most), 5.25e-5, 8e-5. Time offsets: 1150 to 17500. The post
pass (blur 0.02, grain 1.1 to 1.2) runs only for light waves, and not on
phones; the dark wave never gets it, and is switched off on touch phones.

## What the surface shader does not do

No lighting from normals at all. Its depth comes from the folded geometry,
the opaque depth-tested sheet, the derivative term (`dFdy(uv.y)`, signed,
which tells the two faces of the fold apart: one face gets the streak
texture, the other `+0.25` toward white), and the sheer size of the mesh
against the frame. Our engine adds a soft normal light on top, which helps
the path forms that Stripe never drew.
