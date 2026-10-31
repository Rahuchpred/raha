// The pulse ribbon. Plain WebGL2, no library.
//
// Built the way the OpenRouter concept's ribbon is (itself after Stripe's
// hero wave): a flat sheet of fine silk fibres, bent in 3D by the vertex
// shader, lit, with a real blur pass under the sharp one and a fine grain.
// Here the sheet's centre line is an ECG trace, P wave, QRS spike and T wave,
// repeating across the hero, in OpenEvidence's warm ember, accent and cream.
// A slow sweep redraws it and the trace fades behind it.
//
// Unlike a free twist, the sheet is a broad nib: its width runs along one
// slanted direction, rolled only a little into depth. A swept nib never
// folds over itself at the spike's sharp corners and is never seen edge-on,
// so it reads as one continuous ribbon: wide on the flats, about half as
// wide on the steep strokes, like a calligraphic stroke.

const VERT = `#version 300 es
precision highp float;
in vec2 a_uv;
uniform float u_time;
uniform float u_aspect;
uniform float u_hy;
// half the visible width in world units, and beats across it
uniform float u_span;
uniform float u_beats;
uniform float u_head;
uniform float u_f;     // focal scale: larger frames the ribbon tighter
out vec2 v_uv;
out float v_facing;
out float v_depth;
out vec3 v_normal;

const float PI = 3.14159265;

float g(float x, float m, float s) { return exp(-pow((x - m) / s, 2.0)); }

// One heartbeat, p in [0, 1): P, Q, R, S, T.
float ecg(float p) {
  return 0.07 * g(p, 0.16, 0.035)
       - 0.06 * g(p, 0.30, 0.012)
       + 0.62 * g(p, 0.335, 0.014)
       - 0.16 * g(p, 0.37, 0.014)
       + 0.14 * g(p, 0.58, 0.06);
}

vec3 path(float v) {
  float x = mix(-u_span, u_span, v);
  // beats across the width; the trace holds still like a monitor's and a
  // sweep (in the fragment shader) redraws it
  float p = fract(v * u_beats + 0.08);
  return vec3(x, u_hy + ecg(p) * 1.1, 0.0);
}

void main() {
  float u = a_uv.x;
  float v = a_uv.y;
  vec3 c = path(v);
  vec3 t = normalize(path(v + 0.0008) - c);

  // the nib: about 72 degrees from horizontal, rolling slowly in one long
  // wave so the light moves across the sheet
  const float NIB = 1.26;
  float roll = 0.45 * sin(v * 2.4 - u_time * 0.12);
  vec3 side = vec3(cos(NIB) * cos(roll), sin(NIB) * cos(roll), sin(roll));
  // narrower toward both ends, so it tapers away instead of stopping
  float width = 0.22 * mix(0.55, 1.0, smoothstep(0.0, 0.25, v) * (1.0 - smoothstep(0.75, 1.0, v)));
  vec3 p = c + (u - 0.5) * width * side;

  v_uv = a_uv;
  v_facing = cos(roll);
  v_depth = p.z;
  v_normal = normalize(cross(t, side));

  float camZ = 3.4;
  float f = u_f;
  gl_Position = vec4(p.x * f / u_aspect, p.y * f, 0.0, camZ - p.z);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
in float v_facing;
in float v_depth;
in vec3 v_normal;
uniform float u_time;
uniform int u_pass;
uniform float u_light;
uniform float u_head;
out vec4 outColor;

// ember, accent, amber, cream across the sheet
vec3 warm(float x) {
  vec3 ember = vec3(0.42, 0.13, 0.06);
  vec3 accent = vec3(0.894, 0.392, 0.239);
  vec3 amber = vec3(0.95, 0.62, 0.32);
  vec3 cream = vec3(0.96, 0.9, 0.82);
  vec3 c = mix(ember, accent, smoothstep(0.0, 0.35, x));
  c = mix(c, amber, smoothstep(0.35, 0.7, x));
  return mix(c, cream, smoothstep(0.7, 1.0, x));
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

float fibres(float u, float v, float n, float seed) {
  float k = u * n + 0.6 * (vnoise(vec2(u * n * 0.12 + seed, v * 3.0)) - 0.5);
  float id = floor(k);
  float f = fract(k);
  float d = min(f, 1.0 - f);
  float fw = max(fwidth(k), 1e-4);
  float weight = mix(0.5, 2.6, hash(id + seed));
  float line = 1.0 - smoothstep(0.0, fw * weight, d);
  line = mix(line, 0.35, smoothstep(0.28, 0.55, fw));
  return line * (0.35 + 0.65 * hash(id * 1.7 + seed));
}

void main() {
  float u = v_uv.x;
  float v = v_uv.y;

  // light: faces turned to it bright, faces turned away in shadow
  vec3 nrm = normalize(v_normal);
  bool back = nrm.z < 0.0;
  if (back) nrm = -nrm;
  vec3 L = normalize(vec3(-0.45, 0.65, 0.62));
  float diffuse = max(dot(nrm, L), 0.0);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(nrm, H), 0.0), 28.0);
  float light = 0.25 + 0.75 * diffuse;

  // Surface first, like Stripe's: a smooth lit sheet with broad satin
  // folds. Fibres run through all of it, faint in some stretches and clear
  // in others, and the stretches drift slowly along the ribbon.
  float line = max(fibres(u, v, 26.0, 0.0), 0.5 * fibres(u, v, 80.0, 11.0));
  float lined = smoothstep(0.35, 0.8, 0.5 + 0.5 * sin(v * 5.5 + u * 1.7 - u_time * 0.08));
  float satin = pow(0.5 + 0.5 * sin(u * 8.0 + v * 2.0 + 3.0 * vnoise(vec2(v * 2.0, u * 1.5))), 6.0);
  float surface = 0.08 + 0.42 * pow(light, 1.6) + 0.45 * spec + 0.22 * satin;
  float a = surface * mix(0.88 + 0.24 * line, 0.5 + 1.0 * line, lined);
  // the two long edges catch the light, so it reads as a cut sheet
  a += 0.25 * smoothstep(0.08, 0.0, min(u, 1.0 - u));

  float ends = smoothstep(0.0, 0.12, v) * (1.0 - smoothstep(0.88, 1.0, v));
  a *= ends;
  // soft patches where the sharp pass gives way to the blurred one
  float patchy = smoothstep(0.5, 0.85, vnoise(vec2(u * 2.0, v * 5.0 - u_time * 0.03)));
  if (u_pass == 0) a *= mix(1.0, 0.3, patchy);

  // The sweep redraws the trace and it settles back to a resting level,
  // never off. No flashes.
  float rel = fract(u_head - v);
  // it also brightens a little ahead of the head, so there is no cliff
  a *= 0.5 + 0.7 * max(exp(-rel * 1.7), 0.6 * smoothstep(0.8, 1.0, rel));
  float spark = exp(-rel * 60.0) * (1.0 - step(0.98, rel));
  a += spark * 0.5 * (0.3 + 0.7 * line) * ends;

  vec3 base = warm(u) * (0.45 + 0.55 * light);
  if (back) base = warm(1.0 - u) * (0.25 + 0.35 * light);
  base = mix(base, vec3(1.0, 0.92, 0.82), spark * 0.4);
  a *= 0.9 + 0.2 * grain(gl_FragCoord.xy + fract(u_time) * 31.0);

  if (u_light > 0.5) {
    // on paper, glowing light would wash out: draw it as ink instead, the
    // colour deeper and the coverage real
    vec3 ink = base * vec3(0.95, 0.72, 0.62);
    outColor = vec4(ink * clamp(a * 1.25, 0.0, 1.0), clamp(a * 1.25, 0.0, 1.0));
    return;
  }
  vec3 col = base * a * 1.5;
  outColor = vec4(col, clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0));
}`;

const QUAD = `#version 300 es
out vec2 v_st;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_st = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

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

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
  return s;
}

type Options = {
  // baseline height, world units
  hy?: number;
  // focal scale: 3.8 shows about +-0.9 units vertically
  f?: number;
};

export function createPulseRibbon(canvas: HTMLCanvasElement, { hy = -0.3, f = 3.8 }: Options = {}) {
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true });
  if (!gl) return null;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dark = window.matchMedia("(prefers-color-scheme: dark)");

  const link = (vs: string, fs: string) => {
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
    return p;
  };
  const prog = link(VERT, FRAG);
  const progBlur = link(QUAD, BLUR);
  const progComp = link(QUAD, COMPOSITE);
  const emptyVao = gl.createVertexArray();

  // few quads across (fibres are in the fragment shader), many along so the
  // QRS spike stays sharp
  const SX = 16;
  const SY = 1400;
  const uv: number[] = [];
  for (let j = 0; j < SY; j++) {
    for (let i = 0; i < SX; i++) {
      const u0 = i / SX, u1 = (i + 1) / SX, v0 = j / SY, v1 = (j + 1) / SY;
      uv.push(u0, v0, u1, v0, u0, v1, u1, v0, u1, v1, u0, v1);
    }
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a_uv");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const count = uv.length / 2;

  const U = (n: string) => gl.getUniformLocation(prog, n);
  const uTime = U("u_time"), uAspect = U("u_aspect"), uHy = U("u_hy"), uPass = U("u_pass"), uLight = U("u_light");
  const uSpan = U("u_span"), uBeats = U("u_beats"), uHead = U("u_head"), uF = U("u_f");
  const bTex = gl.getUniformLocation(progBlur, "u_tex"), bDir = gl.getUniformLocation(progBlur, "u_dir");
  const cTex = gl.getUniformLocation(progComp, "u_tex"), cGain = gl.getUniformLocation(progComp, "u_gain");

  const targets = [0, 1].map(() => ({ tex: gl.createTexture()!, fb: gl.createFramebuffer()! }));
  let sw = 1, sh = 1, aspect = 1;
  const size = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    aspect = r.width / Math.max(1, r.height);
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
  };

  let beats = 2, head = 0;
  const pace = (t: number) => {
    beats = Math.max(2, Math.round(canvas.width / Math.min(window.devicePixelRatio || 1, 2) / 420));
    head = (t * 0.09) % 1;
  };

  const ribbon = (t: number, pass: number) => {
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
    gl.uniform1f(uTime, t);
    gl.uniform1f(uAspect, aspect);
    gl.uniform1f(uHy, hy);
    // the camera sees x up to aspect * camZ / f at z = 0; run a little past it
    const span = (aspect * 3.4) / f * 1.04;
    gl.uniform1f(uSpan, span);
    // about one beat per 420 css px of width
    gl.uniform1f(uBeats, beats);
    gl.uniform1f(uHead, head);
    gl.uniform1f(uF, f);
    gl.uniform1i(uPass, pass);
    gl.uniform1f(uLight, dark.matches ? 0 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  };
  const full = (p: WebGLProgram) => {
    gl.useProgram(p);
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const draw = (t: number) => {
    pace(t);
    const [A, B] = targets;
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.fb);
    gl.viewport(0, 0, sw, sh);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    ribbon(t, 1);
    gl.disable(gl.BLEND);
    gl.useProgram(progBlur);
    gl.uniform1i(bTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    // three widening passes, so the glow has a soft tail as well as a core
    for (const r of [1.0, 2.4, 4.5]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, B.fb);
      gl.bindTexture(gl.TEXTURE_2D, A.tex);
      gl.uniform2f(bDir, r / sw, 0);
      full(progBlur);
      gl.bindFramebuffer(gl.FRAMEBUFFER, A.fb);
      gl.bindTexture(gl.TEXTURE_2D, B.tex);
      gl.uniform2f(bDir, 0, r / sh);
      full(progBlur);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(progComp);
    gl.bindTexture(gl.TEXTURE_2D, A.tex);
    gl.uniform1i(cTex, 0);
    // the glow is light: strong on the dark page, a faint halo on paper
    gl.uniform1f(cGain, dark.matches ? 1.1 : 0.35);
    full(progComp);
    ribbon(t, 0);
  };

  let raf = 0;
  let running = false;
  const t0 = performance.now();
  const loop = (now: number) => {
    draw((now - t0) / 1000);
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
  draw(reduce ? 4 : 0);
  const ro = new ResizeObserver(() => {
    size();
    draw(reduce ? 4 : (performance.now() - t0) / 1000);
  });
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()));
  io.observe(canvas);
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVis);

  return () => {
    stop();
    ro.disconnect();
    io.disconnect();
    document.removeEventListener("visibilitychange", onVis);
  };
}
