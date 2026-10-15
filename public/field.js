// Faint painted background: a thyroid (two lobes + isthmus, follicles inside)
// and the axis behind it (pituitary signal down, hormone feedback up), with
// diffusion contours drifting outward. Anchored to the hero portrait, parallax
// on scroll. Static frame when the user prefers reduced motion.
(() => {
  const canvas = document.getElementById("field");
  if (!canvas) return;
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false, antialias: false });
  if (!gl) return;

  const vert = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;
  const frag = `
precision mediump float;
uniform vec2 uRes;      // drawing-buffer size
uniform vec2 uAnchor;   // thyroid centre in buffer px (GL coords, y up)
uniform float uScale;   // buffer px per thyroid unit
uniform float uTime;
uniform float uFade;    // 1 at top of page, lower further down
uniform vec3 uPaper, uRose, uRoseDeep, uPlum, uSage;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a*noise(p); p = p*2.03 + 17.1; a *= 0.5; } return v; }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0-h); }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// pear-shaped lobe: wider lower pole, narrow upper pole
float lobe(vec2 q, vec2 c, float tilt){
  vec2 l = rot(tilt)*(q - c);
  float taper = mix(1.12, 0.62, smoothstep(-0.55, 0.6, l.y));
  vec2 r = vec2(0.24*taper, 0.5);
  return (length(l/r) - 1.0) * min(r.x, r.y);
}
float segment(vec2 p, vec2 a, vec2 b, float r){
  vec2 pa = p-a, ba = b-a; float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
  return length(pa - ba*h) - r;
}
vec2 voronoi(vec2 x){
  vec2 n = floor(x), f = fract(x); float f1 = 8.0, f2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 g = vec2(float(i), float(j));
    vec2 o = vec2(hash(n+g), hash(n+g+19.7));
    o = 0.5 + 0.35*sin(uTime*0.05 + 6.2831*o);
    float d = length(g + o - f);
    if (d < f1){ f2 = f1; f1 = d; } else if (d < f2){ f2 = d; }
  }
  return vec2(f1, f2);
}
float dash(float s, float speed, float len){ return smoothstep(0.0, 0.08, fract(s - uTime*speed)) * smoothstep(len, len-0.08, fract(s - uTime*speed)); }

void main(){
  vec2 q = (gl_FragCoord.xy - uAnchor) / uScale;
  float t = uTime;

  // painterly wobble on everything
  vec2 w = vec2(fbm(q*2.6 + t*0.02), fbm(q*2.6 + 9.3 - t*0.02)) - 0.5;
  vec2 qw = q + w*0.07;

  float dl = lobe(qw, vec2(-0.44, 0.04), -0.16);
  float dr = lobe(qw, vec2( 0.44, 0.04),  0.16);
  float di = segment(qw, vec2(-0.3, -0.24), vec2(0.3, -0.24), 0.1);
  float d = smin(smin(dl, dr, 0.05), di, 0.14);

  vec3 col = uPaper;

  // watercolour body: granulated pigment, darker pooled edge
  float inside = smoothstep(0.012, -0.012, d);
  float grain = fbm(qw*7.0 + 3.0);
  float pigment = inside * (0.45 + 0.55*grain);
  float pooled = inside * smoothstep(-0.07, 0.0, d);
  col = mix(col, uRose, pigment*0.30);
  col = mix(col, uRoseDeep, pooled*0.28);

  // follicles (colloid-filled cells) inside the gland
  vec2 v = voronoi(qw*8.5);
  float wall = 1.0 - smoothstep(0.0, 0.07, v.y - v.x);
  float colloid = smoothstep(0.32, 0.12, v.x);
  col = mix(col, uRoseDeep, inside * wall * 0.16);
  col = mix(col, uRose, inside * colloid * 0.10);

  // diffusion contours outside the gland, drifting outward
  float outside = smoothstep(0.0, 0.03, d);
  float dd = d + (fbm(q*1.4 - t*0.015) - 0.5)*0.12;
  float ring = abs(fract(dd*4.2 - t*0.03) - 0.5);
  float rings = smoothstep(0.035, 0.0, ring) * exp(-dd*1.9) * outside;
  col = mix(col, uSage, rings*0.2);

  // the axis: pituitary node above, signal down the midline, feedback arcs up
  vec2 node = vec2(0.0, 1.02);
  float nodeD = length(qw - node) - 0.075;
  float nodeFill = smoothstep(0.012, -0.012, nodeD);
  float nodeRing = smoothstep(0.012, 0.0, abs(length(qw - node) - 0.12));
  col = mix(col, uPlum, nodeFill*0.20 + nodeRing*0.14);

  float midX = abs(qw.x + 0.015*sin(qw.y*9.0 + t*0.3));
  float midline = smoothstep(0.009, 0.0, midX) * step(-0.12, qw.y) * step(qw.y, 0.94);
  col = mix(col, uPlum, midline * dash(qw.y*5.0, -0.18, 0.55) * 0.26);

  vec2 ac = vec2(0.0, 0.42);
  float arcR = 0.62;
  float arcD = abs(length(qw - ac) - arcR);
  float arcMask = smoothstep(0.48, 0.56, qw.y) * step(qw.y, 0.98);
  float ang = atan(abs(qw.x), qw.y - ac.y);           // 0 at top, grows toward sides
  float arc = smoothstep(0.008, 0.0, arcD) * arcMask;
  col = mix(col, uPlum, arc * dash(ang*3.2, 0.12, 0.5) * 0.22);

  // overall fade further down the page + paper grain
  col = mix(uPaper, col, uFade);
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, vert), fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (n) => gl.getUniformLocation(prog, n);
  const U = { res: u("uRes"), anchor: u("uAnchor"), scale: u("uScale"), time: u("uTime"), fade: u("uFade") };

  // colours come from CSS custom properties so the palette lives in one place
  function cssColor(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    const m = v.match(/^#([0-9a-f]{6})$/i);
    if (!m) return [0, 0, 0];
    const n = parseInt(m[1], 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  function setPalette() {
    gl.uniform3fv(u("uPaper"), cssColor("--field-paper", "#fbf7f2"));
    gl.uniform3fv(u("uRose"), cssColor("--field-rose", "#e3a597"));
    gl.uniform3fv(u("uRoseDeep"), cssColor("--field-rose-deep", "#b8695c"));
    gl.uniform3fv(u("uPlum"), cssColor("--field-plum", "#6e3f52"));
    gl.uniform3fv(u("uSage"), cssColor("--field-sage", "#7e9688"));
  }

  const RES = 0.5; // render at half resolution; it is a soft painting anyway
  const anchorEl = document.querySelector("[data-field-anchor]");
  let anchorDocY = 0, anchorX = 0;

  function measure() {
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.max(1, Math.round(w * RES));
    canvas.height = Math.max(1, Math.round(h * RES));
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (anchorEl) {
      const r = anchorEl.getBoundingClientRect();
      anchorX = r.left + r.width / 2;
      anchorDocY = r.top + window.scrollY + r.height / 2;
    } else {
      anchorX = w / 2; anchorDocY = h * 0.35;
    }
    setPalette();
  }

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let last = 0, start = performance.now(), raf = 0;

  function draw(now) {
    const w = window.innerWidth, h = window.innerHeight;
    const scaleCss = Math.min(Math.max(Math.min(w * 0.34, h * 0.38), 160), 360);
    const y = anchorDocY - window.scrollY * 0.55; // parallax: gland drifts slower than the page
    const fade = 1 - 0.6 * Math.min(1, window.scrollY / (h * 1.4));
    gl.uniform2f(U.res, canvas.width, canvas.height);
    gl.uniform2f(U.anchor, anchorX * RES, (h - y - scaleCss * 0.22) * RES); // gland sits a little below the portrait
    gl.uniform1f(U.scale, scaleCss * RES);
    gl.uniform1f(U.time, reduce.matches ? 12.0 : (now - start) / 1000);
    gl.uniform1f(U.fade, fade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - last < 1000 / 30) return; // 30 fps is plenty
    last = now;
    draw(now);
  }

  function restart() {
    cancelAnimationFrame(raf);
    if (reduce.matches || document.hidden) { draw(performance.now()); return; }
    raf = requestAnimationFrame(loop);
  }

  measure();
  restart();
  canvas.classList.add("is-ready");
  window.addEventListener("resize", () => { measure(); draw(performance.now()); });
  window.addEventListener("scroll", () => { if (reduce.matches) draw(performance.now()); }, { passive: true });
  document.addEventListener("visibilitychange", restart);
  reduce.addEventListener?.("change", restart);
  window.addEventListener("load", () => { measure(); draw(performance.now()); });
})();
