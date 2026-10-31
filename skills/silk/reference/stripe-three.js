// Five figures, every one of them stripe.com's folded sheet, in Three.js r178
// (the release stripe.com ships). Written in our own words from what its
// shipped code does; no Stripe code is copied.
//
// One form only: a 400 by 400 plane folded in half (top layer, a rounded
// fold, the bottom layer tucked under), so it always has thickness and a
// round edge. A figure is a choice of parameters, never a new object:
// - turns: rotations of the sheet about an axis, each ramped along the
//   sheet's length (v) or width (u). Stripe's wave is three of them; a
//   stronger roll turns the sheet over, a curl across the width rolls it into
//   a funnel, a coil along the length winds it round itself.
// - the slow, large noise wave that rolls through it,
// - its placement: rotation, scale and position in Stripe's 1392px frame,
//   always big and cropped by its frame.
// Parts move, the whole never spins: each turn's strength drifts on its own
// noise and the noise wave rolls on. No travelling lights.

import * as THREE from "three";

THREE.ColorManagement.enabled = false;

const MAX_TURNS = 6;

const NOISE = /* glsl */ `
float hash1(float n) { return fract(sin(n * 91.345) * 47453.53); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 grad2(vec2 p) { float k = 6.2831853 * hash2(p); return vec2(cos(k), sin(k)); }
// Gradient noise, about -1 to 1. The P version wraps every P cells in x.
float gnoiseP(vec2 p, float P) {
  vec2 i = floor(p), f = fract(p);
  vec2 w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float x0 = mod(i.x, P), x1 = mod(i.x + 1.0, P);
  float a = dot(grad2(vec2(x0, i.y)), f);
  float b = dot(grad2(vec2(x1, i.y)), f - vec2(1.0, 0.0));
  float c = dot(grad2(vec2(x0, i.y + 1.0)), f - vec2(0.0, 1.0));
  float d = dot(grad2(vec2(x1, i.y + 1.0)), f - vec2(1.0, 1.0));
  return 1.4 * mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}
float gnoise(vec2 p) { return gnoiseP(p, 1e6); }
const float PI = 3.14159265;
const float TAU = 6.2831853;
`;

const SHEET_VERT = /* glsl */ `
uniform float uTime;
uniform vec3 uDisplace;            // frequency across, frequency along, amount
uniform vec4 uAxis[${MAX_TURNS}];  // xyz: axis; w: ramps along 0 the width (u), 1 the length (v), 2 the distance from the fold (w)
uniform vec4 uTurn[${MAX_TURNS}];  // x: strength (rad); y: power, 0 for a straight ramp; z: 1 starts from the far end; w: drift
uniform int uTurns;
varying vec2 vUv;
varying vec3 vView;
varying vec3 vNormal;
${NOISE}

// 1 at x = 0, falling to 0; n sets how sudden the fall is.
float softStep(float x, float n) { return exp2(-exp2(n) * pow(max(x, 0.0), n)); }
mat3 axisAngle(vec3 axis, float a) {
  axis = normalize(axis);
  float s = sin(a), c = cos(a), oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c, oc * axis.x * axis.y + axis.z * s, oc * axis.z * axis.x - axis.y * s,
    oc * axis.x * axis.y - axis.z * s, oc * axis.y * axis.y + c, oc * axis.y * axis.z + axis.x * s,
    oc * axis.z * axis.x + axis.y * s, oc * axis.y * axis.z - axis.x * s, oc * axis.z * axis.z + c);
}

// The plane folded in half, as Stripe's geometry is: left of the seam the top
// layer, a 32 unit strip bent round into the fold, right of it the bottom
// layer tucked under. The gap is 4 units at the ends and 2 mid-length. Then
// the two quarter turns that stand it the way Stripe's does: length along x,
// thickness along y, width along z.
vec3 folded(vec2 uv) {
  float x = (uv.x - 0.5) * 400.0;
  float y = (uv.y - 0.5) * 400.0;
  float z = 0.0;
  float gap = 4.0 - 2.0 * pow(4.0 * uv.y * (1.0 - uv.y), 9.5);
  float seam = 16.0;
  if (x < -seam) {
    z = gap;
  } else if (x < seam) {
    float a = (x + seam) / (2.0 * seam);
    z = cos(a * PI) * gap;
    x = sin(a * PI) * gap - seam;
  } else {
    z = -gap;
    x = -x;
  }
  x += 100.0;
  return vec3(y, z, x);
}

vec3 sheet(vec2 uv, float t) {
  vec3 p = folded(uv);
  // the slow, large noise wave
  p.y += uDisplace.z * gnoise(vec2(p.x * uDisplace.x + t, p.z * uDisplace.y + t));
  for (int i = 0; i < ${MAX_TURNS}; i++) {
    if (i >= uTurns) break;
    // u differs between the two layers (a gentle turn along u opens them like
    // a book, as Stripe's does); w is the same for both, so a strong curl
    // rolls the thick sheet as one
    float w = uv.x < 0.5 ? uv.x * 2.0 : (1.0 - uv.x) * 2.0;
    float c = uAxis[i].w < 0.5 ? uv.x : (uAxis[i].w < 1.5 ? uv.y : 1.0 - w);
    if (uTurn[i].z > 0.5) c = 1.0 - c;
    float ramp = uTurn[i].y > 0.0 ? softStep(c, uTurn[i].y) : c;
    // each turn drifts on its own noise along the length: parts of the
    // sheet move against each other, the whole never spins
    float strength = uTurn[i].x - uTurn[i].w * gnoise(vec2(uv.y * 2.0, t + float(i) * 3.7));
    p = axisAngle(uAxis[i].xyz, strength * ramp) * p;
  }
  return p;
}

void main() {
  float t = uTime;
  vUv = uv;
  vec3 p = sheet(uv, t);
  // exact normals, even through strong curls: step a little across and along
  vec3 pu = sheet(uv + vec2(0.0025, 0.0), t);
  vec3 pv = sheet(uv + vec2(0.0, 0.0025), t);
  vNormal = normalize(normalMatrix * cross(pu - p, pv - p));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const SURFACE_FRAG = /* glsl */ `
uniform sampler2D uPalette;
uniform vec3 uGrade;      // contrast, saturation, hue shift
uniform float uTime;
uniform vec4 uBandA;      // calm band: u0, u1, v0, v1
uniform vec4 uBandB;      // detailed band
uniform float uAlpha;
uniform float uBlueDim;   // how much streaks fade on blue colours (Stripe: 0.9)
uniform int uInk;         // 1: see-through, drawn as ink that multiplies the paper
uniform int uStripe;      // 1: Stripe's own shading, unlit
uniform vec3 uGlow;       // Stripe's glow: amount, power, ramp
uniform float uStreak;    // streak strength (Stripe: 0.2)
uniform vec2 uRes;        // drawing buffer size
varying vec2 vUv;
varying vec3 vView;
varying vec3 vNormal;
${NOISE}

vec3 grade(vec3 c) {
  c = (c - 0.5) * uGrade.x + 0.5;
  c = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, uGrade.y);
  vec3 k = vec3(0.57735);
  c = c * cos(uGrade.z) + cross(k, c) * sin(uGrade.z) + k * dot(k, c) * (1.0 - cos(uGrade.z));
  return clamp(c, 0.0, 1.0);
}
float rect(vec2 p, vec4 r, float f) {
  return smoothstep(r.x - f, r.x, p.x) * (1.0 - smoothstep(r.y, r.y + f, p.x))
       * smoothstep(r.z - f, r.z, p.y) * (1.0 - smoothstep(r.w, r.w + f, p.y));
}

void main() {
  float u = vUv.x, v = vUv.y;

  if (uStripe == 1) {
    // Stripe's own shading. No lighting: the colour is the palette at the
    // sheet's uv, lifted by fine streaks and by the glow term.
    // The glow term: how fast the length runs per screen pixel, signed. Its
    // sign tells the sheet's two faces apart; near zero, the sheet is folding.
    float pdy = dFdy(v) * uRes.y * uGlow.x;
    pdy = clamp(pdy * 0.5 + 0.5, 0.0, 1.0);
    pdy = smoothstep(0.0, uGlow.z, pow(pdy, uGlow.y));
    vec3 col = texture2D(uPalette, vec2(u, clamp(v, 0.01, 0.99))).rgb;
    // long fine streaks along the length: very fine across, nearly constant
    // along, their density drifting; strongest toward the open edges, only
    // on the face the glow term marks as the front, weaker on blue
    float edge = 1.0 - pow(4.0 * u * (1.0 - u), 3.0);
    float n0 = gnoise(vec2(u * 0.1, v * 0.5));
    float n1 = 0.5 + 0.5 * gnoise(vec2(u * (600.0 + 300.0 * n0), v * 4.0 * n0));
    col += n1 * uStreak * (1.0 - col.b * uBlueDim) * pdy * edge;
    col = grade(col);
    // the other face, and the fold, go pale
    col += (1.0 - pdy) * 0.25;
    col = clamp(col, 0.0, 1.0);
    if (uInk == 1) { gl_FragColor = vec4(mix(vec3(1.0), col, uAlpha), 1.0); return; }
    gl_FragColor = vec4(col, uAlpha);
    return;
  }

  vec3 pal = grade(texture2D(uPalette, vec2(u + uTime * 0.01, clamp(v, 0.01, 0.99))).rgb);

  // the underside: the layer past the fold
  float under = smoothstep(0.44, 0.56, u);

  // soft light from the surface's own normal, turned toward the viewer
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 eye = normalize(-vView);
  float facing = abs(dot(n, eye));
  if (dot(n, eye) < 0.0) n = -n;
  vec3 L = normalize(vec3(-0.45, 0.65, 0.62));
  float diffuse = max(dot(n, L), 0.0);
  float spec = pow(max(dot(n, normalize(L + eye)), 0.0), 40.0);

  // a light crease where the sheet turns edge-on
  float fold = smoothstep(0.42, 0.05, facing);

  // fine streaks along the length, in a calm band and a busy band, none on
  // the underside, weaker on blue, as Stripe's are
  float n0 = gnoise(vec2(u * 0.1, v * 0.5) * 4.0);
  float fine = 0.5 + 0.5 * gnoise(vec2(u * 600.0, v * (3.0 + 2.0 * n0)));
  float coarse = 0.5 + 0.5 * gnoise(vec2(u * 190.0, v * (2.0 + 1.5 * n0)));
  float calm = rect(vec2(u, v), uBandA, 0.12);
  float busy = rect(vec2(u, v), uBandB, 0.18);
  float strength = mix(mix(0.2, 0.05, calm), 1.0, busy);
  float streak = mix(fine, coarse, busy) * strength * (1.0 - uBlueDim * pal.b) * (1.0 - under);

  vec3 col = pal * (0.6 + 0.5 * diffuse);
  col += streak * 0.22;
  col += under * 0.25;
  col = mix(col, mix(pal, vec3(1.0, 0.97, 0.92), 0.7), fold * 0.6);
  col += spec * 0.18;
  col = clamp(col, 0.0, 1.0);
  // ink multiplies whatever is under it, so overlaps darken in any order
  if (uInk == 1) { gl_FragColor = vec4(mix(vec3(1.0), col, uAlpha), 1.0); return; }
  gl_FragColor = vec4(col, uAlpha);
}`;

const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// A small rotational blur about the centre, kept off a sharp band across
// the middle of the frame, then grain where there is colour.
const POST_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uRes;
uniform float uBlur;
uniform float uGrain;
uniform float uTime;
uniform int uInk;
varying vec2 vUv;
float rnd(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec4 sharp = texture2D(tScene, vUv);
  vec4 sum = vec4(0.0);
  vec2 c = (vUv - 0.5) * uRes;
  for (int i = 0; i < 12; i++) {
    float a = (float(i) / 11.0 - 0.5) * uBlur;
    vec2 r = mat2(cos(a), sin(a), -sin(a), cos(a)) * c;
    sum += texture2D(tScene, r / uRes + 0.5);
  }
  vec4 soft = sum / 12.0;
  float keep = clamp((smoothstep(0.0, 0.7, vUv.y) - smoothstep(0.2, 1.0, vUv.y)) * 1.8, 0.0, 1.0);
  vec4 col = mix(soft, sharp, keep);
  float cover = uInk == 1 ? clamp((1.0 - min(min(col.r, col.g), col.b)) * 3.0, 0.0, 1.0) : col.a;
  col.rgb += (rnd(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * 0.045 * uGrain * cover;
  gl_FragColor = col;
}`;

function paintPalette(colors, fill, seed, blobs = 18, size = [0.12, 0.18], gradient = null, blobAlpha = 1, gradientV = null, gradientAlpha = 1) {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d");
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, S, S);
  // Ordered gradients, as Stripe's palette runs: the main one along the
  // sheet's length (v; the canvas top is v = 1), a second across its width
  // (u) laid over it, then the blotches only vary them.
  if (gradientV) {
    const g = ctx.createLinearGradient(0, S, 0, 0);
    for (const [at, color] of gradientV) g.addColorStop(at, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  if (gradient) {
    const g = ctx.createLinearGradient(0, 0, S, 0);
    for (const [at, color] of gradient) g.addColorStop(at, color);
    ctx.globalAlpha = gradientAlpha;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = blobAlpha;
  ctx.filter = "blur(22px)";
  for (let i = 0; i < blobs; i++) {
    const color = colors[i % colors.length];
    const x = rnd() * S, y = rnd() * S, r = (size[0] + size[1] * rnd()) * S;
    for (const dx of [-S, 0, S]) {
      const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, color + "00");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

// Axes, in the sheet's own frame (length along x, thickness y, width z).
const DIAG_XZ = [0.5, 0, 0.5]; // Stripe's first and third axis
const DIAG_YZ = [0, 0.5, 0.5]; // Stripe's second axis
const LENGTH = [1, 0, 0];      // roll the sheet over about its length
const WIDTH = [0, 0, 1];       // coil the length round itself
const THICK = [0, 1, 0];       // swing the length sideways

// A turn: { axis, along: "u" | "v" | "w", strength (rad), power (0 = straight
// ramp), fromEnd, drift }. w runs from the folded edge (0) to the open edge (1)
// and is the same on both layers.
const turn = (axis, along, strength, power = 0, fromEnd = false, drift = 0) => ({ axis, along, strength, power, fromEnd, drift });

// Stripe's light hero, as turns: its three twists (the second drifts).
const STRIPE_TURNS = [
  turn(DIAG_XZ, "u", 0.41, 0.7),
  turn(DIAG_YZ, "v", -0.65, 3.63, false, 0.1),
  turn(DIAG_XZ, "v", -0.58, 3.95),
];

// Placement is in Stripe's frame: a 1392px-wide canvas, pixel units.
const STRIPE_PLACE = { rotation: [-0.4496, -0.1176, 1.8744], scale: [9, 8, 5], position: [380, -301.7, -11.1] };
const STRIPE_DISPLACE = [0.005831, 0.016001, -7.821];

// Palettes painted the way Stripe's runs: the main gradient along the
// sheet's length, a tint toward the open edge across its width, and a few
// faint blotches. Each figure has its own colours; the treatment is one.
const palette = (along, edge, blobs) => ({
  gradientV: along,
  gradient: [[0, edge], [0.22, edge + "00"], [0.78, edge + "00"], [1, edge]],
  gradientAlpha: 0.75,
  colors: blobs,
  fill: along[0][1],
  blobs: 14,
  blobSize: [0.1, 0.14],
  blobAlpha: 0.25,
});
// Stripe's light hero: lavender at the open edge, violet, pink, orange.
const WARM = palette([[0, "#9fb6ff"], [0.25, "#a978ff"], [0.45, "#e05cff"], [0.62, "#ff4fa8"], [0.8, "#ff7a2a"], [1, "#ffa318"]], "#a9b6ff", ["#ff8a1f", "#ff4fa8", "#a35cff", "#9fb4ff", "#ffb000"]);
const OCEAN = { ...palette([[0, "#1f3fff"], [0.3, "#3f7bff"], [0.55, "#3fb4ff"], [0.8, "#6fe0ff"], [1, "#c8f4ff"]], "#c7b8ff", ["#2f5bff", "#5aa8ff", "#7a5cff", "#9ff0ff"]), blueDim: 0.4 };
const DUSK = palette([[0, "#ff9a3d"], [0.3, "#ff4fa8"], [0.6, "#c35cff"], [0.85, "#7a5cff"], [1, "#9fb6ff"]], "#ffd0a8", ["#ff4fa8", "#c35cff", "#ff9a3d", "#7a5cff"]);
const LIME = palette([[0, "#00b8a3"], [0.3, "#3fd69a"], [0.55, "#b7e85a"], [0.8, "#ffd36b"], [1, "#ff8a3d"]], "#9fe8ff", ["#00c2a8", "#6fe3a1", "#ffd36b", "#ff8a3d"]);
const EMBER = palette([[0, "#ff4f8b"], [0.3, "#ff5a3c"], [0.6, "#ff8a3d"], [0.85, "#ffc24b"], [1, "#ffe08a"]], "#ffb3c8", ["#ff5a3c", "#ff8a3d", "#ffc24b", "#ff4f8b"]);

const P = Math.PI;

// Stripe's three twists from its numbers: twist (x, y, z) and their powers.
const stripeTwists = ([tx, ty, tz], [px, py, pz]) => [
  turn(DIAG_XZ, "u", ty, py),
  turn(DIAG_YZ, "v", tx, px, false, 0.1),
  turn(DIAG_XZ, "v", tz, pz),
];

// Every figure is the folded sheet. Four are the waves stripe.com ships,
// each with its own twist, noise wave, placement, glow and pace; the fifth
// turns the light hero over along its length. Each figure has takes; the
// first is the one on the page.
export const TAKES = {
  wave: [
    { label: "Stripe's light hero", ...WARM, turns: STRIPE_TURNS },
  ],
  deep: [
    { label: "Stripe's dark hero, on white", ...OCEAN, turns: stripeTwists([-0.055, 0.077, -0.518], [3.95, 5.85, 6.33]), displace: [0.003234, 0.00799, 6.051], rotation: [-0.1596, -0.2836, -2.8156], scale: [10, 10, 7], position: [-24.3, -56.4, -11.1], glow: [0.6, 0.589, 1], offset: 1150 },
  ],
  fold: [
    { label: "Stripe's billing hero, turned to fit", ...DUSK, turns: stripeTwists([-0.424, 0.024, -1.312], [1.81, 0.94, 4.76]), displace: [0.005, 0.0212, 6.68], rotation: [-0.666, -0.0314, 1.9], scale: [6.05, 8.4, 6.99], position: [50, -100, -11.1], glow: [1.55, 1.174, 0.972], speed: 5.25e-5 },
    { label: "Stripe's billing hero, as placed", ...DUSK, turns: stripeTwists([-0.424, 0.024, -1.312], [1.81, 0.94, 4.76]), displace: [0.005, 0.0212, 6.68], rotation: [-0.666, -0.0314, 0.7791], scale: [6.05, 8.4, 6.99], position: [206.1, -438, -11.1], glow: [1.55, 1.174, 0.972], speed: 5.25e-5 },
  ],
  petal: [
    { label: "Stripe's accent wave, turned and enlarged", ...LIME, turns: stripeTwists([0.059, 0.32, -0.397], [3.63, 0.44, 5.99]), rotation: [-2.8756, 3.0959, -1.6], scale: [9, 9, 9], position: [0, -50, -11.1], glow: [3.86, 0.923, 1], speed: 8e-5, offset: 2275 },
    { label: "Stripe's accent wave, enlarged", ...LIME, turns: stripeTwists([0.059, 0.32, -0.397], [3.63, 0.44, 5.99]), rotation: [-2.8756, 3.0959, -2.9259], scale: [7, 7, 7], position: [0, 0, -11.1], glow: [3.86, 0.923, 1], speed: 8e-5, offset: 2275 },
  ],
  turn: [
    { label: "Rolled fully over", ...EMBER, turns: [...STRIPE_TURNS, turn(LENGTH, "v", 2 * P, 0, false, 0.15)] },
    { label: "Rolled half over", ...EMBER, turns: [...STRIPE_TURNS, turn(LENGTH, "v", P, 0, false, 0.15)], rotation: [-0.2, 0.1, 1.5], scale: [6, 7, 5], position: [250, -120, 0] },
    { label: "Rolled over at one end", ...EMBER, turns: [...STRIPE_TURNS, turn(LENGTH, "v", 2 * P, 1.6, true, 0.15)], rotation: [-0.45, -0.12, 1.6], scale: [7, 7, 5], position: [200, -200, 0] },
  ],
};

export const PRESETS = Object.fromEntries(Object.entries(TAKES).map(([k, list]) => [k, list[0]]));

export const FIGURES = PRESETS;

function pageColor(el) {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const c = getComputedStyle(n).backgroundColor;
    if (c && !/rgba\(.*,\s*0\)$/.test(c) && c !== "transparent") return c;
  }
  return "#ffffff";
}

const DEFAULTS = {
  turns: STRIPE_TURNS,
  displace: STRIPE_DISPLACE,
  ...STRIPE_PLACE,
  speed: 4e-5,
  offset: 17500,
  grade: [1, 1.15, 0],
  bands: [[0.6, 1.0, 0.0, 0.9], [0.04, 0.54, 0.1, 1.0]],
  blobs: 22,
  blobSize: [0.1, 0.16],
  alpha: 1,
  blueDim: 0.9,
  shading: "stripe",
  glow: [1.98, 0.806, 0.834],
  streak: 0.26,
  gradient: null,
  gradientV: null,
  gradientAlpha: 1,
  blobAlpha: 1,
  ...WARM,
};

// name: a preset; overrides replace any of its settings for one canvas
// (for trying new takes), e.g. { turns: [...], scale: [...] } or
// { post: false } to skip the post pass.
export function createFigure(canvas, name, overrides = {}) {
  const fig = { ...DEFAULTS, ...PRESETS[name], ...overrides };
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    failIfMajorPerformanceCaveat: true,
  });
  const ink = fig.alpha < 1;
  if (ink) renderer.setClearColor(new THREE.Color(pageColor(canvas)), 1);
  else renderer.setClearColor(0x000000, 0);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scene = new THREE.Scene();
  // Stripe's camera: orthographic, pixel units
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 10000);

  const axes = Array.from({ length: MAX_TURNS }, () => new THREE.Vector4());
  const turns = Array.from({ length: MAX_TURNS }, () => new THREE.Vector4());
  fig.turns.slice(0, MAX_TURNS).forEach((t, i) => {
    axes[i].set(t.axis[0], t.axis[1], t.axis[2], { u: 0, v: 1, w: 2 }[t.along]);
    turns[i].set(t.strength, t.power, t.fromEnd ? 1 : 0, t.drift);
  });

  const uniforms = {
    uTime: { value: 0 },
    uDisplace: { value: new THREE.Vector3(...fig.displace) },
    uAxis: { value: axes },
    uTurn: { value: turns },
    uTurns: { value: Math.min(fig.turns.length, MAX_TURNS) },
    uPalette: { value: paintPalette(fig.colors, fig.fill, 7 + name.length * 13, fig.blobs, fig.blobSize, fig.gradient, fig.blobAlpha, fig.gradientV, fig.gradientAlpha) },
    uGrade: { value: new THREE.Vector3(...fig.grade) },
    uBandA: { value: new THREE.Vector4(...fig.bands[0]) },
    uBandB: { value: new THREE.Vector4(...fig.bands[1]) },
    uAlpha: { value: fig.alpha },
    uBlueDim: { value: fig.blueDim },
    uStripe: { value: fig.shading === "stripe" ? 1 : 0 },
    uGlow: { value: new THREE.Vector3(...fig.glow) },
    uStreak: { value: fig.streak },
    uRes: { value: new THREE.Vector2(1, 1) },
    uInk: { value: ink ? 1 : 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SHEET_VERT,
    fragmentShader: SURFACE_FRAG,
    side: THREE.DoubleSide,
    transparent: ink,
    depthWrite: !ink,
    ...(ink ? { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor } : {}),
  });
  // the sheet is shaped in the vertex shader from its uv: 128 across, 256 along
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 128, 256), material);
  mesh.frustumCulled = false;
  mesh.rotation.set(...fig.rotation);
  scene.add(mesh);

  const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
  const post = new THREE.ShaderMaterial({
    uniforms: { tScene: { value: target.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uBlur: { value: 0.02 }, uGrain: { value: 1.1 }, uTime: { value: 0 }, uInk: { value: ink ? 1 : 0 } },
    vertexShader: POST_VERT,
    fragmentShader: POST_FRAG,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: THREE.NoBlending,
  });
  const postScene = new THREE.Scene();
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let level = 0;
  function size() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    const dpr = level >= 2 ? 1 : Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    target.setSize(Math.round(w * dpr), Math.round(h * dpr));
    post.uniforms.uRes.value.set(w * dpr, h * dpr);
    uniforms.uRes.value.set(w * dpr, h * dpr);
    // Stripe lays its scene out for a 1392px canvas; scale it to this one,
    // so the sheet stays big and cropped at any size
    const k = w / 1392;
    camera.left = -w / 2;
    camera.right = w / 2;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.position.set(100 * k, 0, 5000);
    camera.rotation.set(0, 0.02, 0);
    camera.updateProjectionMatrix();
    mesh.scale.set(fig.scale[0] * k, fig.scale[1] * k, fig.scale[2] * k);
    mesh.position.set(fig.position[0] * k, fig.position[1] * k, fig.position[2] * k);
  }

  const t0 = performance.now();
  const timeAt = (now) => ((reduce ? 6000 : now - t0) + fig.offset) * fig.speed;

  function draw(now) {
    uniforms.uTime.value = timeAt(now);
    post.uniforms.uTime.value = now / 1000;
    if (level < 1 && fig.post !== false) {
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(postScene, postCamera);
    } else {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    }
  }

  let raf = 0, running = false, frames = [], last = 0;
  function watch(stamp) {
    if (last) frames.push(stamp - last);
    last = stamp;
    if (frames.length < 90) return;
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
    frames = [];
    if (avg > 26 && level < 3) {
      level++;
      if (level === 2) size();
      if (level === 3) stop();
    }
  }
  const loop = (stamp) => {
    draw(stamp);
    watch(stamp);
    if (running) raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (running || reduce || level >= 3) return;
    running = true;
    last = 0;
    frames = [];
    raf = requestAnimationFrame(loop);
  };
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  size();
  draw(performance.now());
  new ResizeObserver(() => {
    size();
    draw(performance.now());
  }).observe(canvas);
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(canvas);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  return { stop };
}

export { turn, DIAG_XZ, DIAG_YZ, LENGTH, WIDTH, THICK, STRIPE_TURNS, STRIPE_PLACE, STRIPE_DISPLACE };
