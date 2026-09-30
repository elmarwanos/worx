/* ============================================================
   Worx | demo-space.js
   The far end of the Book a Demo journey (demo.js flies the camera;
   this only draws what it's told). After the WORX BELT, after
   Interstellar's tesseract, told in the Worx palette (the eye itself
   is the black hole: the journey falls into it in chapter 1):

     Tesseract    an endless corridor of glowing frames, their
                  corners strung together, warm threads running the
                  length of it, flown down toward the vanishing point.
     The door     an airlock hatch at the end of the corridor: hazard
                  ring, bolts, two warning lights, and the Worx mark on
                  the hatch. It splits through the logo's eye (the
                  journey began by entering that eye), built as SVG.
     The planet   the new world through the door: a warm planet of
                  rust, sand and cream cloud, lit warm from the upper left, its
                  atmosphere glowing on the lit limb. One WebGL
                  fragment shader, a real rotating sphere; if WebGL is
                  missing the page keeps a CSS disc instead.

   WorxSpace.tesseract(ctx, { W, H, z, a, t })     z = distance flown (grows with scroll)
   WorxSpace.door()                                 -> SVG markup string
   WorxSpace.planet(canvas)                         -> { resize(W,H,dpr), draw(t, {cx,cy,r,a}) } or null
   ============================================================ */

(function (global) {
  "use strict";

  var TAU = Math.PI * 2;

  /* ---- Tesseract --------------------------------------------------- */

  var THREADS = (function () {
    var list = [];
    for (var i = 0; i < 38; i++) list.push({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, al: 0.2 + Math.random() * 0.6 });
    return list;
  })();

  function tesseract(ctx, s) {
    if (s.a <= 0.001) return;
    var W = s.W, H = s.H, cx = W / 2, cy = H / 2;
    var half = Math.max(W, H) * 0.62;                      // a frame's half-size at depth 1
    var gap = 1;                                           // distance between frames
    var off = s.z % gap;
    ctx.save();
    ctx.fillStyle = "rgba(4, 2, 3, " + s.a.toFixed(3) + ")";          // the dark it hangs in
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    // the far light at the vanishing point: small, so the lattice stays crisp
    var vp = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.16);
    vp.addColorStop(0, "rgba(255,236,200," + (0.3 * s.a).toFixed(3) + ")");
    vp.addColorStop(1, "rgba(250,167,25,0)");
    ctx.fillStyle = vp;
    ctx.fillRect(0, 0, W, H);
    var roll = Math.sin(s.t * 0.12) * 0.03;
    ctx.translate(cx, cy);
    ctx.rotate(roll);
    var prev = null;
    for (var i = 18; i >= 0; i--) {
      var z = i * gap + gap - off;                         // near frames last (on top)
      if (z < 0.08) continue;
      var hw = half / (z + 0.25);                          // perspective: size falls off with distance
      var fog = Math.min(1, 0.55 + 1.6 / (z + 0.3)) * (1 - Math.min(1, z / 18));
      var al = fog * s.a;
      if (al < 0.01) { prev = null; continue; }
      // the frame, and its shelves (the tesseract's lattice): solid, heavy lines
      ctx.strokeStyle = "rgba(255,226,170," + al.toFixed(3) + ")";
      ctx.lineWidth = Math.max(1.6, 4.2 / (z + 0.3));
      ctx.strokeRect(-hw, -hw * 0.62, hw * 2, hw * 1.24);
      ctx.strokeStyle = "rgba(250,167,25," + (0.8 * al).toFixed(3) + ")";
      ctx.lineWidth = Math.max(1.1, 2.4 / (z + 0.3));
      ctx.beginPath();
      for (var k = 1; k < 5; k++) {
        var y = -hw * 0.62 + (hw * 1.24) * k / 5;
        ctx.moveTo(-hw, y); ctx.lineTo(hw, y);
        var x = -hw + hw * 2 * k / 5;
        ctx.moveTo(x, -hw * 0.62); ctx.lineTo(x, hw * 0.62);
      }
      ctx.stroke();
      // corners strung to the next frame in
      if (prev) {
        ctx.strokeStyle = "rgba(255,236,205," + (0.7 * al).toFixed(3) + ")";
        ctx.lineWidth = Math.max(1.1, 2.4 / (z + 0.3));
        ctx.beginPath();
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) {
          ctx.moveTo(c[0] * hw, c[1] * hw * 0.62);
          ctx.lineTo(c[0] * prev, c[1] * prev * 0.62);
        });
        ctx.stroke();
      }
      prev = hw;
    }
    // threads running the length of it, rushing past
    for (var j = 0; j < THREADS.length; j++) {
      var th = THREADS[j];
      var z1 = 0.35, z2 = 6;
      var x1 = th.x * half / z1 * 0.9, y1 = th.y * half * 0.62 / z1 * 0.9;
      var x2 = th.x * half / z2 * 0.9, y2 = th.y * half * 0.62 / z2 * 0.9;
      var g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, "rgba(255,236,205,0)");
      g.addColorStop(0.5, "rgba(255,236,205," + (Math.min(1, th.al * 1.1) * s.a).toFixed(3) + ")");
      g.addColorStop(1, "rgba(255,236,205,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---- The door ------------------------------------------------------ */

  // the Worx mark (the traced logo, as on the eye), placed on the hatch
  var MARK = {
    tile: "M639 5731 c-214 -13 -408 -124 -527 -303 -62 -94 -98 -196 -110 -314 -2 -28 -3 -4466 0 -4495 27 -274 207 -501 466 -585 51 -17 93 -25 160 -32 16 -2 4418 -3 4454 -1 173 8 330 77 451 198 112 112 179 254 196 416 3 27 3 4476 0 4503 -12 115 -48 215 -109 308 -119 181 -313 292 -530 305 -22 1 -4430 1 -4451 0z",
    gold: "M3718 5283 c-60 -294 -155 -553 -249 -676 -16 -22 -26 -33 -35 -40 -72 -54 -155 -32 -238 64 -67 77 -149 212 -208 338 -3 6 -6 12 -6 12 0 0 -1 -1 -3 -2 -105 -78 -249 -161 -362 -207 -106 -44 -190 -64 -273 -63 -81 0 -144 15 -197 49 -58 36 -95 84 -131 168 -14 32 -13 32 -18 -2 -9 -65 -13 -98 -15 -137 -15 -210 38 -340 157 -386 15 -6 33 -11 46 -13 14 -2 84 -2 112 0 94 8 210 25 267 39 141 35 294 108 403 192 4 2 6 4 6 4 1 0 5 -11 11 -23 22 -49 62 -128 88 -172 100 -172 191 -259 270 -259 82 0 160 85 240 261 4 9 12 27 18 39 62 129 107 337 120 550 6 82 6 219 1 272 -1 8 -1 8 -4 -8z",
    eye: "M2806 3432 c-627 -9 -1237 -235 -1719 -635 -40 -32 -599 -511 -599 -512 0 -1 533 -458 586 -502 454 -381 1021 -607 1614 -641 62 -4 78 -4 165 -4 87 0 103 0 165 4 594 35 1157 259 1615 642 54 45 586 500 586 501 0 1 -546 467 -590 505 -511 426 -1154 653 -1823 642z",
    crescent: "M2670 3163 c-232 -49 -432 -184 -564 -380 -102 -153 -152 -325 -150 -511 3 -176 53 -339 150 -484 274 -412 831 -525 1243 -251 227 150 372 394 397 666 3 26 3 26 -8 7 -146 -244 -420 -380 -702 -349 -394 44 -681 399 -640 794 20 199 124 384 283 503 12 9 12 9 10 9 -1 0 -10 -2 -19 -4z",
  };
  // hatch geometry (viewBox 1000): the mark 460 wide, centred on the hatch
  var MS = 460 / 5731;
  var MARK_T = "translate(" + (500 - 2865 * MS).toFixed(2) + " " + (500 - 2866 * MS).toFixed(2) + ") scale(" + MS.toFixed(5) + ") translate(0 5732) scale(1 -1)";
  var SPLIT_Y = +(500 + (3447 - 2866) * MS).toFixed(2);   // the eye's centre line: where the hatch parts

  function hatch(cls) {
    var seams = "", bolts = "";
    for (var i = 0; i < 12; i++) {
      var a = i / 12 * TAU, c = Math.cos(a), sn = Math.sin(a);
      seams += '<line x1="' + (500 + c * 300).toFixed(1) + '" y1="' + (500 + sn * 300).toFixed(1) + '" x2="' + (500 + c * 436).toFixed(1) + '" y2="' + (500 + sn * 436).toFixed(1) + '"/>';
    }
    for (var j = 0; j < 16; j++) {
      var b = j / 16 * TAU + 0.2;
      bolts += '<circle cx="' + (500 + Math.cos(b) * 410).toFixed(1) + '" cy="' + (500 + Math.sin(b) * 410).toFixed(1) + '" r="7"/>';
    }
    return '<g class="' + cls + '">' +
      '<circle cx="500" cy="500" r="446" fill="url(#dmd-metal)"/>' +
      '<circle cx="500" cy="500" r="300" fill="none" stroke="rgba(0,0,0,0.45)" stroke-width="3"/>' +
      '<circle cx="500" cy="500" r="303" fill="none" stroke="rgba(254,238,207,0.08)" stroke-width="1.5"/>' +
      '<g stroke="rgba(0,0,0,0.4)" stroke-width="3">' + seams + "</g>" +
      '<g fill="#6b4a33" stroke="rgba(0,0,0,0.5)" stroke-width="1.5">' + bolts + "</g>" +
      '<line x1="54" y1="' + SPLIT_Y + '" x2="946" y2="' + SPLIT_Y + '" stroke="rgba(0,0,0,0.55)" stroke-width="3"/>' +
      '<g transform="' + MARK_T + '">' +
        '<path fill="#e57d23" d="' + MARK.tile + '"/><path fill="#edc314" d="' + MARK.gold + '"/>' +
        '<path fill="#000" d="' + MARK.eye + '"/><path fill="#060201" stroke="#faa719" stroke-width="60" stroke-linejoin="round" d="' + MARK.crescent + '"/>' +
      "</g></g>";
  }

  function door() {
    return '<svg class="dm-door-svg" viewBox="0 0 1000 1000" aria-hidden="true" focusable="false">' +
      "<defs>" +
        '<radialGradient id="dmd-metal" cx="42%" cy="36%" r="70%"><stop offset="0" stop-color="#4a2e1e"/><stop offset="0.6" stop-color="#2a170d"/><stop offset="1" stop-color="#140905"/></radialGradient>' +
        '<linearGradient id="dmd-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a5236"/><stop offset="0.5" stop-color="#2c180e"/><stop offset="1" stop-color="#5a3a26"/></linearGradient>' +
        '<pattern id="dmd-haz" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="34" height="34" fill="#150905"/><rect width="17" height="34" fill="#e8a21c"/></pattern>' +
        '<clipPath id="dmd-ring"><circle cx="500" cy="500" r="449"/></clipPath>' +
        '<clipPath id="dmd-top"><rect x="0" y="0" width="1000" height="' + SPLIT_Y + '"/></clipPath>' +
        '<clipPath id="dmd-bot"><rect x="0" y="' + SPLIT_Y + '" width="1000" height="' + (1000 - SPLIT_Y) + '"/></clipPath>' +
        '<linearGradient id="dmd-light" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(255,236,200,0)"/><stop offset="0.5" stop-color="rgba(255,244,222,0.95)"/><stop offset="1" stop-color="rgba(255,236,200,0)"/></linearGradient>' +
      "</defs>" +
      // the light that pours through the parting hatch (demo.js grows it)
      '<rect class="dm-door-light" x="54" y="' + (SPLIT_Y - 1) + '" width="892" height="2" fill="url(#dmd-light)" opacity="0"/>' +
      // the hatch: whole while shut (no seam can show), two halves while it opens
      hatch("dm-hatch dm-hatch--whole") +
      '<g clip-path="url(#dmd-ring)">' +
        '<g class="dm-hatch-half dm-hatch-half--top" clip-path="url(#dmd-top)">' + hatch("") + "</g>" +
        '<g class="dm-hatch-half dm-hatch-half--bot" clip-path="url(#dmd-bot)">' + hatch("") + "</g>" +
      "</g>" +
      // the frame the hatch sits in: rim, hazard ring, the two warning lights
      '<circle cx="500" cy="500" r="472" fill="none" stroke="url(#dmd-haz)" stroke-width="44"/>' +
      '<circle cx="500" cy="500" r="496" fill="none" stroke="url(#dmd-rim)" stroke-width="10"/>' +
      '<circle cx="500" cy="500" r="449" fill="none" stroke="url(#dmd-rim)" stroke-width="7"/>' +
      '<circle class="dm-door-lamp" cx="30" cy="500" r="16"/><circle class="dm-door-lamp dm-door-lamp--b" cx="970" cy="500" r="16"/>' +
      "</svg>";
  }

  /* ---- The planet (WebGL) --------------------------------------------- */

  var VERT = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
  var FRAG = [
    "precision highp float;",
    "uniform vec2 uRes; uniform float uTime; uniform vec4 uP; // cx, cy (px, top-left origin), radius, alpha",
    "float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }",
    "float noise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),",
    "             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }",
    "float fbm(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }",
    "void main(){",
    "  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);",
    "  vec2 p = (frag - uP.xy) / uP.z;",
    "  float d = length(p);",
    "  vec3 L = normalize(vec3(-0.5, 0.5, 0.72));              // a warm light: upper left (y is up here), in front",
    "  vec3 col = vec3(0.0); float a = 0.0;",
    "  if (d < 1.0) {",
    "    vec3 n = vec3(p.x, -p.y, sqrt(1.0 - d * d));",
    "    float ang = uTime * 0.025, c = cos(ang), s = sin(ang);",
    "    vec3 q = vec3(c * n.x + s * n.z, n.y, -s * n.x + c * n.z);   // turning on its axis",
    "    q.xy = mat2(0.96, -0.28, 0.28, 0.96) * q.xy;                // a little axial tilt",
    "    float land = smoothstep(0.5, 0.56, fbm(q * 2.1 + 4.0));",
    "    float ice = smoothstep(0.62, 0.9, abs(q.y)) + 0.35 * fbm(q * 5.0);",
    // the Worx palette only: rust lowlands, sand and amber highlands,
    // cream caps and cream cloud (no blue or grey)
    "    vec3 sea = mix(vec3(0.16, 0.06, 0.03), vec3(0.34, 0.13, 0.06), fbm(q * 3.0));",
    "    vec3 ground = mix(vec3(0.66, 0.34, 0.16), vec3(0.93, 0.66, 0.38), fbm(q * 6.0));",
    "    vec3 surf = mix(sea, ground, land);",
    "    surf = mix(surf, vec3(1.0, 0.93, 0.81), clamp(ice, 0.0, 1.0));",
    "    float cl = smoothstep(0.48, 0.78, fbm(vec3(q.x * 2.2, q.y * 5.5, q.z * 2.2) + vec3(uTime * 0.004, 0.0, 0.0)));",
    "    surf = mix(surf, vec3(1.0, 0.94, 0.84), cl * 0.88);",
    "    float diff = max(dot(n, L), 0.0);",
    "    vec3 warm = vec3(1.0, 0.84, 0.64);",
    "    vec3 lit = surf * (0.025 + 1.15 * pow(diff, 0.9)) * warm;",
    "    float rim = pow(1.0 - n.z, 2.6);",
    "    lit += vec3(1.0, 0.7, 0.38) * rim * (0.12 + 1.1 * smoothstep(-0.25, 0.6, dot(n, L)));",
    "    col = lit; a = 1.0;",
    "  }",
    "  float side = clamp(0.35 + dot(normalize(vec3(p.x, -p.y, 0.001)), L) * 0.9, 0.0, 1.0);",
    "  float halo = exp(-max(d - 1.0, 0.0) * 22.0) * step(1.0, d) * side;",
    "  col += vec3(1.0, 0.72, 0.4) * halo * 0.75;",
    "  a = max(a, halo * 0.75);",
    "  gl_FragColor = vec4(col * uP.w, a * uP.w);",
    "}",
  ].join("\n");

  function planet(canvas) {
    var gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return null;
    var sh = function (type, src) {
      var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(o)); return null; }
      return o;
    };
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uRes = gl.getUniformLocation(prog, "uRes"), uTime = gl.getUniformLocation(prog, "uTime"), uP = gl.getUniformLocation(prog, "uP");
    var dpr = 1;
    return {
      resize: function (W, H, d) {
        dpr = d;
        canvas.width = Math.max(1, Math.round(W * dpr));
        canvas.height = Math.max(1, Math.round(H * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
      },
      draw: function (t, s) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (s.a <= 0.001) return;
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, t);
        gl.uniform4f(uP, s.cx * dpr, s.cy * dpr, s.r * dpr, s.a);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
    };
  }

  /* ---- The burning eye (the logo's iris on the surface) -------------------
     A living iris of fire inside the Worx eye, after the Eye of Sauron but in
     the Worx palette: fibres of flame radiating from the pupil and writhing
     outward, dark and ember-red near the centre, amber and gold toward the
     rim, a hot ring around the pupil, and the almond's own black edge kept as
     a frame so the logo still reads. The canvas covers the eye's box; CSS
     masks it to the almond. uFlare (0..1) is the gaze: when the eye finds
     the visitor the flames run hotter and faster. */
  var FIRE_FRAG = [
    "precision highp float;",
    "uniform vec2 uRes; uniform float uTime; uniform vec2 uPupil; uniform float uFlare;",
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }",
    "float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.02 + vec2(1.7, 9.2); a *= 0.5; } return v; }",
    "void main(){",
    "  vec2 uv = gl_FragCoord.xy / uRes;",
    "  float asp = uRes.x / uRes.y;",
    "  vec2 e = vec2((uv.x - 0.5) * asp, uv.y - 0.5);             // the eye's box, its height = 1",
    "  vec2 p = e - uPupil;                                         // centred on the pupil",
    "  float r = length(p), a = atan(p.y, p.x);",
    "  float t = uTime * (0.3 + 0.35 * uFlare);",
    "  vec2 w = vec2(fbm(vec2(a * 2.0, r * 3.0 - t)), fbm(vec2(a * 2.0 + 5.2, r * 3.0 - t * 1.3)));",
    "  float fib = fbm(vec2(a * 9.0 + w.x * 2.5, r * 4.0 - t * 1.6 + w.y * 1.5));   // fibres, flowing out",
    "  float heat = smoothstep(0.1, 0.95, r);",
    "  float v = fib * (0.5 + 0.95 * heat) + 0.22 * heat;",
    "  v += (fbm(p * 6.0 - vec2(0.0, t * 2.0)) - 0.5) * 0.25;       // licks of flame",
    "  v *= 0.82 + 0.22 * uFlare;                                  // hotter, never bleached",
    "  v += 0.5 * exp(-pow((r - 0.2) / 0.05, 2.0)) * (0.5 + 0.9 * uFlare);   // the hot ring round the pupil",
    "  vec3 c = mix(vec3(0.02, 0.0, 0.0), vec3(0.24, 0.04, 0.01), smoothstep(0.05, 0.35, v));",
    "  c = mix(c, vec3(0.75, 0.27, 0.15), smoothstep(0.3, 0.6, v));   // ember",
    "  c = mix(c, vec3(0.9, 0.49, 0.14), smoothstep(0.5, 0.8, v));    // orange",
    "  c = mix(c, vec3(0.98, 0.65, 0.1), smoothstep(0.7, 0.95, v));   // amber",
    "  c = mix(c, vec3(1.0, 0.86, 0.55), 0.8 * smoothstep(0.92, 1.3, v));   // gold at the hottest",
    "  float edge = length(vec2(e.x / (0.5 * asp), e.y / 0.5));      // 1 at the almond's edge",
    "  c *= 1.0 - 0.92 * smoothstep(0.72, 1.0, edge);                 // its black rim stays: the logo still reads",
    "  gl_FragColor = vec4(c, 1.0);",
    "}",
  ].join("\n");

  function fireEye(canvas) {
    var gl = canvas.getContext("webgl", { alpha: false, antialias: false, preserveDrawingBuffer: false });
    if (!gl) return null;
    var sh = function (type, src) {
      var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(o)); return null; }
      return o;
    };
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FIRE_FRAG);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = { res: gl.getUniformLocation(prog, "uRes"), time: gl.getUniformLocation(prog, "uTime"),
      pupil: gl.getUniformLocation(prog, "uPupil"), flare: gl.getUniformLocation(prog, "uFlare") };
    return {
      resize: function (w, h, d) {
        canvas.width = Math.max(1, Math.round(w * d));
        canvas.height = Math.max(1, Math.round(h * d));
        gl.viewport(0, 0, canvas.width, canvas.height);
      },
      // pupil: its offset from the eye's centre, in eye-heights (x right, y up)
      draw: function (t, pupil, flare) {
        gl.uniform2f(U.res, canvas.width, canvas.height);
        gl.uniform1f(U.time, t);
        gl.uniform2f(U.pupil, pupil[0], pupil[1]);
        gl.uniform1f(U.flare, flare);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
    };
  }

  global.WorxSpace = { tesseract: tesseract, door: door, planet: planet, fireEye: fireEye, SPLIT_Y: SPLIT_Y };
})(window);
