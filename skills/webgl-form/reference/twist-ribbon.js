// The open-router ribbon. Plain WebGL2, no library.
//
// It is drawn as two layers on two canvases: the far half behind the page
// copy and the near half in front of it, so the ribbon wraps around the
// content the way Stripe's does. The inner side of the sheet has its own
// darker colours, so the twist reads as one object with two surfaces.
//
// Three layers, like Stripe's: a smooth lit surface, fine line striations
// inside it (clear in some stretches, faint in others), and a real blur. The
// ribbon is drawn small offscreen, blurred into a soft glow, and the sharp
// ribbon goes on top, fading out wherever it is away from the focus.
//
// Built the way Stripe's hero wave is: a flat sheet made of many fine
// parallel lines, twisted in 3D by the vertex shader. It runs edge to edge
// low in the hero, wide at both ends (many models in, many providers out),
// and turns edge-on once in the middle, where every line merges into one
// (the endpoint). Each line carries a faint pulse, so requests flow through.

const VERT = `#version 300 es
precision highp float;
in vec2 a_uv;
uniform float u_time;
uniform float u_aspect;
uniform float u_rock;
// Raises the ribbon on narrow screens, where the frame is tall.
uniform float u_lift;
// Placement: centre height (world units) and a width scale.
uniform float u_hy;
uniform float u_hw;
// How much real depth the twist keeps, 0 flat to 1 full. Real depth lets the
// arms come toward the viewer and fall away, so it reads as an object.
uniform float u_depth;
// How far the ends rise toward the copy, in world units.
uniform float u_rise;
out vec2 v_uv;
out float v_facing;
out float v_depth;
out vec3 v_normal;

const float PI = 3.14159265;

// Centre line: edge to edge, low in the frame, with a long slow wave.
vec3 path(float v) {
  vec3 p = mix(vec3(-3.6, u_hy + u_lift, 0.0), vec3(3.6, u_hy + u_lift, 0.0), v);
  p.y += 0.1 * sin(PI * v * 2.0 + 0.6);
  // The ends rise, so the arms come up both sides of the copy and the
  // ribbon cradles it instead of lying under it.
  p.y += u_rise * pow(abs(2.0 * v - 1.0), 2.2);
  return p;
}

void main() {
  float u = a_uv.x;
  float v = a_uv.y;

  vec3 c = path(v);
  vec3 t = normalize(path(v + 0.001) - c);
  vec3 n = normalize(vec3(-t.y, t.x, 0.0));
  vec3 bz = vec3(0.0, 0.0, 1.0);

  // Twist: open at both ends, edge-on in the middle. A slow rock keeps the
  // ends alive and fades out at the merge, so the middle stays one line.
  float theta = PI * 0.5 * (1.0 - sin(PI * v)) + PI * 0.5 + u_rock * (1.0 - sin(PI * v)) * sin(u_time * 0.3 + v * 3.0);
  // Wide where the lines are apart, a little narrower where they merge.
  float width = mix(1.3, 0.9, sin(PI * v)) * u_hw;
  // A breath of noise along the length.
  float wob = 0.035 * sin(v * 9.0 + u_time * 0.6) * sin(u * 3.14159);

  vec3 side = n * cos(theta) + bz * sin(theta);
  vec3 p = c + (u - 0.5) * width * side + n * wob;
  // Keep part of the twist's depth. Full depth would smear the edge-on merge
  // (the ribbon sits low, off the camera's axis), so it is eased back near
  // the middle and kept at the open ends, where it gives the sheet volume.
  float keep = mix(u_depth, 0.12, sin(PI * v));
  p.z = c.z + (p.z - c.z) * keep;

  v_uv = a_uv;
  v_facing = abs(cos(theta));
  v_depth = p.z;
  v_normal = normalize(cross(t, side));

  // Pinhole camera looking down -z.
  float camZ = 3.4;
  float f = 1.9;
  float w = camZ - p.z;
  gl_Position = vec4(p.x * f / u_aspect, p.y * f, 0.0, w);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
in float v_facing;
in float v_depth;
in vec3 v_normal;
uniform float u_time;
uniform float u_lines;
uniform float u_pulse;
// Depth in focus; lines further from it soften and dim, like a lens.
uniform float u_focus;
// 0: the sharp pass on screen. 1: the pass that gets blurred into the glow.
uniform int u_pass;
// 0 the whole ribbon. 1 only its far half, drawn behind the copy.
// 2 only its near half, drawn in front of the copy.
uniform int u_layer;
out vec4 outColor;

// OpenRouter's interface colours across the sheet: violet (light-theme
// accent), blue (info), green (success), lime (brand). Decorative only.
vec3 spectrum(float x) {
  vec3 violet = vec3(0.463, 0.141, 0.957);
  vec3 blue = vec3(0.302, 0.553, 1.0);
  vec3 green = vec3(0.0, 0.749, 0.435);
  vec3 lime = vec3(0.784, 1.0, 0.0);
  vec3 c = mix(violet, blue, smoothstep(0.0, 0.3, x));
  c = mix(c, green, smoothstep(0.3, 0.58, x));
  c = mix(c, lime, smoothstep(0.58, 0.85, x));
  return mix(c, vec3(0.93, 1.0, 0.75), smoothstep(0.9, 1.0, x));
}

float hash(float n) { return fract(sin(n * 91.345) * 47453.53); }
float grain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash2(i), b = hash2(i + vec2(1.0, 0.0)), c = hash2(i + vec2(0.0, 1.0)), d = hash2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Silk fibres across the sheet. Each fibre wanders a little along the length
// and has its own thickness and brightness, so it reads as material, not as
// evenly spaced vector lines.
float fibres(float u, float v, float n, float seed) {
  float k = u * n + 0.7 * (vnoise(vec2(u * n * 0.12 + seed, v * 3.0)) - 0.5);
  float id = floor(k);
  float f = fract(k);
  float d = min(f, 1.0 - f);
  float fw = max(fwidth(k), 1e-4);
  float weight = mix(0.5, 2.8, hash(id + seed));
  float line = 1.0 - smoothstep(0.0, fw * weight, d);
  // Fibres closer than about 2px interfere (moire): blend them into their
  // average coverage, an even sheen, before that happens.
  line = mix(line, 0.35, smoothstep(0.28, 0.55, fw));
  return line * (0.35 + 0.65 * hash(id * 1.7 + seed));
}

void main() {
  float u = v_uv.x;
  float v = v_uv.y;

  // Light: faces turned to it are bright, faces turned away fall into shadow,
  // so the front and back of the sheet read differently where it twists.
  // Turn the normal toward the camera (+z); if it had to flip, we see the back.
  vec3 nrm = normalize(v_normal);
  bool back = nrm.z < 0.0;
  if (back) nrm = -nrm;
  vec3 L = normalize(vec3(-0.45, 0.65, 0.62));
  float diffuse = max(dot(nrm, L), 0.0);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(nrm, H), 0.0), 28.0);

  // Distance from the focus. The sharp pass fades these parts out, the blur
  // pass keeps them, so they show up soft.
  float blur = smoothstep(0.12, 0.9, abs(v_depth - u_focus));

  // Two families of fibres, coarse and fine: texture inside the surface.
  float line = max(fibres(u, v, u_lines, 0.0), 0.5 * fibres(u, v, u_lines * 3.1, 11.0));
  float id = floor(u * u_lines);

  // Soft patches that drift slowly: there the sharp pass fades and the
  // blurred one shows through, so some of the sheet is crisp and some isn't.
  float patchy = smoothstep(0.5, 0.85, vnoise(vec2(u * 2.2, v * 4.0 - u_time * 0.03)));
  blur = max(blur, patchy * 0.85);

  // Broad satin highlights folding across the surface.
  float satin = pow(0.5 + 0.5 * sin(u * 8.0 + v * 2.0 + 3.0 * vnoise(vec2(v * 2.0, u * 1.5))), 6.0);

  // Edge-on, the sheet folds into one bright crease: the merge.
  float edge = pow(1.0 - v_facing, 3.0);
  float merge = smoothstep(0.12, 0.0, v_facing);

  // The lines come and go along the ribbon: some stretches plain, some lined.
  float lined = smoothstep(0.35, 0.8, 0.5 + 0.5 * sin(v * 5.5 + u * 1.7 - u_time * 0.12));

  // Requests: only some lines carry one, longer and softer than a spark.
  float carries = step(0.62, hash(id + 3.0));
  float speed = 0.04 + 0.04 * hash(id);
  // The head runs from a little before the start to a little past the end;
  // the lap is 1.25 sheets long, so the speed is divided to keep its pace.
  float head = fract(u_time * speed / 1.25 + hash(id + 7.0)) * 1.25 - 0.15;
  float rel = v - head;
  // Each light fades in as it sets off and fades out, whole, over its last
  // stretch to the far end, so none is cut off mid-line.
  float life = smoothstep(-0.15, 0.1, head) * (1.0 - smoothstep(0.86, 1.1, head));
  float req = (rel < 0.0 ? exp(rel * 14.0) : exp(-rel * 120.0)) * u_pulse * carries * life;

  float ends = smoothstep(0.0, 0.16, v) * (1.0 - smoothstep(0.86, 1.0, v));
  float light = 0.25 + 0.75 * diffuse;

  // Surface first, like Stripe's: a smooth lit sheet. Faint striation runs
  // through all of it, and clear lines show in the lined stretches.
  float surface = 0.06 + 0.42 * pow(light, 1.6) + 0.5 * spec + 0.22 * satin;
  float striation = mix(0.88 + 0.24 * line, 0.5 + 1.0 * line, lined);
  float a = surface * striation;
  a += edge * 0.3 + merge * 0.6;
  a += req * line * 1.1;
  a *= ends;
  if (u_pass == 0) a *= mix(1.0, 0.2, blur);

  // Colour runs across the sheet; the light shades it, so the shape comes from tone.
  vec3 base = spectrum(u) * (0.45 + 0.55 * light);
  // The inner side, where the sheet turns: its own darker, reversed colours,
  // so front and back read as two surfaces of one object.
  // The face we see at the open ends is the outer one; the other is inner.
  bool inner = !back;
  if (inner) base = spectrum(1.0 - u) * (0.18 + 0.32 * light);
  else base *= 0.82;

  // Fine grain, so it reads as a material.
  a *= 0.88 + 0.24 * grain(gl_FragCoord.xy + fract(u_time) * 31.0);

  // Split into the far half (behind the copy) and the near half (in front).
  if (u_layer == 1 && v_depth > 0.0) discard;
  if (u_layer == 2 && v_depth <= 0.0) discard;

  vec3 col = base * a;
  outColor = vec4(col, clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0));
}`;

// Full-screen triangle for the blur and composite passes.
const QUAD = `#version 300 es
out vec2 v_st;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_st = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Separable Gaussian, 9 taps folded into 5 linear samples.
const BLUR = `#version 300 es
precision highp float;
in vec2 v_st;
uniform sampler2D u_tex;
uniform vec2 u_dir;
out vec4 o;
void main() {
  vec4 c = texture(u_tex, v_st) * 0.227027;
  c += (texture(u_tex, v_st + u_dir * 1.3846) + texture(u_tex, v_st - u_dir * 1.3846)) * 0.3162162;
  c += (texture(u_tex, v_st + u_dir * 3.2308) + texture(u_tex, v_st - u_dir * 3.2308)) * 0.0702703;
  o = c;
}`;

const COMPOSITE = `#version 300 es
precision highp float;
in vec2 v_st;
uniform sampler2D u_tex;
uniform float u_gain;
out vec4 o;
void main() { o = texture(u_tex, v_st) * u_gain; }`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

// lines: 40 keeps the flattened sheet free of moire. horizonY and
// horizonWidth place it under the centred copy.
const LAYERS = { all: 0, back: 1, front: 2 };

export function createRibbon(canvas, { lines = 40, pulse = 1, rock = 0.12, focus = 0, horizonY = -0.98, horizonWidth = 1.45, depth = 0.6, layer = "all", rise = 0.9 } = {}) {
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true });
  if (!gl) throw new Error("no webgl2");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const link = (vs, fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  };
  const prog = link(VERT, FRAG);
  const progBlur = link(QUAD, BLUR);
  const progComp = link(QUAD, COMPOSITE);
  const emptyVao = gl.createVertexArray();

  // A sheet of quads: few across (the lines are drawn in the fragment
  // shader), many along so the twist stays smooth.
  const SX = 24;
  const SY = 480;
  const uv = [];
  for (let j = 0; j < SY; j++) {
    for (let i = 0; i < SX; i++) {
      const u0 = i / SX, u1 = (i + 1) / SX, v0 = j / SY, v1 = (j + 1) / SY;
      uv.push(u0, v0, u1, v0, u0, v1, u1, v0, u1, v1, u0, v1);
    }
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a_uv");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const count = uv.length / 2;

  const U = (n) => gl.getUniformLocation(prog, n);
  const uTime = U("u_time"), uAspect = U("u_aspect"), uRock = U("u_rock");
  const uLines = U("u_lines"), uPulse = U("u_pulse");
  const uLift = U("u_lift");
  const uHy = U("u_hy"), uHw = U("u_hw");
  const uFocus = U("u_focus"), uPass = U("u_pass");
  const uDepth = U("u_depth"), uLayer = U("u_layer"), uRise = U("u_rise");
  const bTex = gl.getUniformLocation(progBlur, "u_tex"), bDir = gl.getUniformLocation(progBlur, "u_dir");
  const cTex = gl.getUniformLocation(progComp, "u_tex"), cGain = gl.getUniformLocation(progComp, "u_gain");

  // Two small render targets, a third of the canvas size, for the blur.
  const targets = [0, 1].map(() => ({ tex: gl.createTexture(), fb: gl.createFramebuffer() }));
  let sw = 1, sh = 1;
  function sizeTargets() {
    sw = Math.max(1, Math.ceil(canvas.width / 3));
    sh = Math.max(1, Math.ceil(canvas.height / 3));
    for (const t of targets) {
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, sw, sh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  let raf = 0;
  let running = false;
  let aspect = 1;
  const t0 = performance.now();

  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    aspect = r.width / Math.max(1, r.height);
    sizeTargets();
  }

  function drawRibbon(t, pass) {
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
    gl.uniform1f(uTime, t);
    gl.uniform1f(uAspect, aspect);
    gl.uniform1f(uRock, reduce ? 0 : rock);
    gl.uniform1f(uLines, lines);
    gl.uniform1f(uPulse, pulse);
    gl.uniform1f(uLift, aspect < 1 ? 0.6 : 0);
    gl.uniform1f(uHy, horizonY);
    gl.uniform1f(uHw, horizonWidth);
    gl.uniform1f(uFocus, focus);
    gl.uniform1i(uPass, pass);
    gl.uniform1f(uDepth, depth);
    gl.uniform1f(uRise, rise);
    gl.uniform1i(uLayer, LAYERS[layer] ?? 0);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  }

  function fullscreen(program) {
    gl.useProgram(program);
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function draw(now) {
    // Reduced motion: one settled frame, with requests caught mid-flight.
    const t = reduce ? 12 : (now - t0) / 1000;
    const [A, B] = targets;

    // 1. The ribbon, small and offscreen, to be blurred.
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.fb);
    gl.viewport(0, 0, sw, sh);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    drawRibbon(t, 1);

    // 2. Blur it: two rounds of horizontal then vertical, the second wider.
    gl.disable(gl.BLEND);
    gl.useProgram(progBlur);
    gl.uniform1i(bTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    for (const r of [1.0, 2.2]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, B.fb);
      gl.bindTexture(gl.TEXTURE_2D, A.tex);
      gl.uniform2f(bDir, r / sw, 0);
      fullscreen(progBlur);
      gl.bindFramebuffer(gl.FRAMEBUFFER, A.fb);
      gl.bindTexture(gl.TEXTURE_2D, B.tex);
      gl.uniform2f(bDir, 0, r / sh);
      fullscreen(progBlur);
    }

    // 3. On screen: the soft glow, then the sharp ribbon on top.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(progComp);
    gl.bindTexture(gl.TEXTURE_2D, A.tex);
    gl.uniform1i(cTex, 0);
    gl.uniform1f(cGain, 1.15);
    fullscreen(progComp);
    drawRibbon(t, 0);
  }

  const loop = (now) => {
    draw(now);
    if (running) raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (running || reduce) return;
    running = true;
    raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  size();
  draw(performance.now());
  new ResizeObserver(() => {
    size();
    draw(performance.now());
  }).observe(canvas);
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(canvas);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    stop();
    canvas.dispatchEvent(new CustomEvent("ribbonfailed"));
  });

  return { draw: () => draw(performance.now()), stop };
}
