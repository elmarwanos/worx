/* ============================================================
   Worx | demo-belt.js
   The WORX BELT as a reusable drawing: the tilted ring of dust and
   tumbling asteroids from the Services page (services.js,
   setupBelt(), Yonas's), lifted out of that page so another page
   can fly through it. Same bodies, same rocks, same light: the
   inner edge orbits faster than the outer (Kepler), about one body
   in four is a real 3D asteroid (an icosahedron knocked into a
   potato, pitted with craters, lit from the upper right, rendered
   once into tumbling sprites), and once in a long while a faint
   comet drifts through.

   The page owns the camera; this only draws what it's told:
     var belt = WorxBelt.create(canvas);
     belt.resize(W, H, dpr);                     // CSS px
     belt.draw(dt, { cx, cy, a, b,               // the ring's centre and half-axes
                     k,                          // 0..1 how present it is
                     flat,                       // 1 seen from below, 0 edge-on
                     spin,                       // extra turn (radians), e.g. from scroll
                     boost });                   // extra orbital speed (0 at rest)
   Nothing runs on its own: the page calls draw() from its loop.
   ============================================================ */

(function (global) {
  "use strict";

  var rnd = function (a, b) { return a + Math.random() * (b - a); };

  // ---- The asteroids (services.js, as built there) -------------------
  function icosphere() {
    var p = (1 + Math.sqrt(5)) / 2;
    var V = [[-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0], [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p], [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1]];
    var F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    var norm = function (v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
    V = V.map(norm);
    for (var it = 0; it < 2; it++) {
      var cache = {}, NF = [];
      var mid = function (i, j) {
        var key = i < j ? i + "_" + j : j + "_" + i;
        if (cache[key] == null) { V.push(norm([(V[i][0] + V[j][0]) / 2, (V[i][1] + V[j][1]) / 2, (V[i][2] + V[j][2]) / 2])); cache[key] = V.length - 1; }
        return cache[key];
      };
      F.forEach(function (t3) {
        var ab = mid(t3[0], t3[1]), bc = mid(t3[1], t3[2]), ca = mid(t3[2], t3[0]);
        NF.push([t3[0], ab, ca], [t3[1], bc, ab], [t3[2], ca, bc], [ab, bc, ca]);
      });
      F = NF;
    }
    return { V: V, F: F };
  }
  var dirRnd = function () { var z = rnd(-1, 1), a2 = rnd(0, 6.2832), q = Math.sqrt(1 - z * z); return [q * Math.cos(a2), q * Math.sin(a2), z]; };
  function asteroidMesh() {
    var base = icosphere();
    var swells = [], craters = [];
    for (var k = 0; k < 5; k++) swells.push({ d: dirRnd(), a: rnd(0.08, 0.22), p: rnd(2, 5) });
    for (var c2 = 0; c2 < 5 + Math.floor(Math.random() * 4); c2++) craters.push({ d: dirRnd(), r: rnd(0.22, 0.5), h: rnd(0.08, 0.16) });
    var ax = [rnd(1.25, 1.7), rnd(0.8, 1.05), rnd(0.62, 0.85)];
    var V = base.V.map(function (v) {
      var r = 1;
      swells.forEach(function (w) { var d = v[0] * w.d[0] + v[1] * w.d[1] + v[2] * w.d[2]; if (d > 0) r += w.a * Math.pow(d, w.p); });
      craters.forEach(function (c3) {
        var d = v[0] * c3.d[0] + v[1] * c3.d[1] + v[2] * c3.d[2], ang = Math.acos(Math.max(-1, Math.min(1, d)));
        var u = ang / c3.r;
        if (u < 1) r -= c3.h * (1 - u * u);                              // the dent
        else if (u < 1.35) r += c3.h * 0.35 * (1 - (u - 1) / 0.35);      // its rim
      });
      r *= 1 + rnd(-0.025, 0.025);                                        // grit
      return [v[0] * r * ax[0], v[1] * r * ax[1], v[2] * r * ax[2]];
    });
    var ext = V.reduce(function (m, v) { return Math.max(m, Math.hypot(v[0], v[1], v[2])); }, 0);
    V = V.map(function (v) { return [v[0] / ext, v[1] / ext, v[2] / ext]; });
    var tone = base.F.map(function () { return rnd(0.86, 1.08); });       // patchy surface
    return { V: V, F: base.F, tone: tone, axis: dirRnd(), start: [rnd(0, 6.28), rnd(0, 6.28)], red: Math.random() };
  }
  var ASTEROIDS = 8, SPIN_FRAMES = 48, SPR = 80;
  var LIGHT = (function () { var l = [0.62, -0.5, 0.6], n = Math.hypot(l[0], l[1], l[2]); return [l[0] / n, l[1] / n, l[2] / n]; })();
  function rotate(v, ax, ang) {          // Rodrigues: v turned ang about the unit axis ax
    var c = Math.cos(ang), sn = Math.sin(ang), d = v[0] * ax[0] + v[1] * ax[1] + v[2] * ax[2];
    return [v[0] * c + (ax[1] * v[2] - ax[2] * v[1]) * sn + ax[0] * d * (1 - c),
      v[1] * c + (ax[2] * v[0] - ax[0] * v[2]) * sn + ax[1] * d * (1 - c),
      v[2] * c + (ax[0] * v[1] - ax[1] * v[0]) * sn + ax[2] * d * (1 - c)];
  }
  function renderAsteroid(m) {
    var frames = [];
    for (var fr = 0; fr < SPIN_FRAMES; fr++) {
      var cv = document.createElement("canvas"); cv.width = cv.height = SPR;
      var g = cv.getContext("2d"), R = SPR * 0.44, C = SPR / 2, ang = (fr / SPIN_FRAMES) * 6.2832;
      var P = m.V.map(function (v) {
        var w = rotate(rotate(v, [1, 0, 0], m.start[0]), [0, 1, 0], m.start[1]);
        return rotate(w, m.axis, ang);
      });
      var faces = [];
      m.F.forEach(function (t3, fi) {
        var A = P[t3[0]], B = P[t3[1]], Cc = P[t3[2]];
        var ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = Cc[0] - A[0], vy = Cc[1] - A[1], vz = Cc[2] - A[2];
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        if (nz <= 0) return;                                              // facing away
        var lit = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
        var fill = Math.max(0, -nx * 0.6 + ny * 0.3 + nz * 0.25) * 0.12;
        faces.push({ t: t3, z: (A[2] + B[2] + Cc[2]) / 3, lit: lit, fill: fill, tone: m.tone[fi] });
      });
      faces.sort(function (p1, p2) { return p1.z - p2.z; });
      faces.forEach(function (fc) {
        var k2 = (0.07 + 0.93 * Math.pow(fc.lit, 0.9)) * fc.tone;
        var r = Math.round(Math.min(255, (150 + 40 * m.red) * k2 + 38 * fc.fill));
        var gg = Math.round(Math.min(255, (116 + 6 * m.red) * k2 + 34 * fc.fill));
        var bb = Math.round(Math.min(255, (94 - 18 * m.red) * k2 + 52 * fc.fill));
        g.fillStyle = g.strokeStyle = "rgb(" + r + "," + gg + "," + bb + ")";
        g.lineWidth = 0.6;
        g.beginPath();
        for (var q = 0; q < 3; q++) { var pt = P[fc.t[q]], px = C + pt[0] * R, py = C + pt[1] * R; if (q) g.lineTo(px, py); else g.moveTo(px, py); }
        g.closePath(); g.fill(); g.stroke();
      });
      frames.push(cv);
    }
    return frames;
  }

  function create(canvas) {
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, dpr = 1, bodies = [], sprites = [], t = 0;
    var comet = null, nextComet = rnd(8, 14);

    function resize(w, h, d) {
      W = w; H = h; dpr = d;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      var n = Math.round(Math.max(420, Math.min(1500, W * 0.8)));
      bodies = [];
      for (var i = 0; i < n; i++) {
        var ring = Math.pow(Math.random(), 0.8);                         // 0 inner edge .. 1 outer
        var o = {
          th: Math.random() * Math.PI * 2,
          r: 0.84 + ring * 0.34 + rnd(-0.03, 0.03),
          z: rnd(-1, 1) * rnd(0.1, 0.45),                                // height off the plane
          sz: Math.pow(Math.random(), 3.2) * 1.9 + 0.35,
          red: Math.random(),                                             // ice to reddish
          tumble: Math.random() < 0.18 ? rnd(0.4, 1.6) : 0,
          ph: Math.random() * 6.28,
        };
        if (Math.random() < 0.26) {
          o.rock = { mesh: Math.floor(Math.random() * ASTEROIDS), ph: Math.random() * SPIN_FRAMES,
            spin: rnd(1.2, 4) * (Math.random() < 0.5 ? -1 : 1), sz: Math.random() < 0.1 ? rnd(9, 16) : rnd(3.5, 7.5) };
        }
        bodies.push(o);
      }
    }

    // one asteroid shape per frame until all exist, so nothing stalls
    function grow() {
      if (sprites.length < ASTEROIDS) sprites.push(renderAsteroid(asteroidMesh()));
    }

    function draw(dt, s) {
      t += dt;
      grow();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (s.k < 0.01) return;
      var a = s.a, b = s.b * s.flat, cx = s.cx, cy = s.cy, thick = s.b;
      var farRocks = [], nearRocks = [];
      ctx.globalCompositeOperation = "lighter";
      for (var i = 0; i < bodies.length; i++) {
        var o = bodies[i];
        o.th += dt * (0.02 + (s.boost || 0) * 0.05) / Math.pow(o.r, 1.5);  // Kepler
        var th = o.th + (s.spin || 0);
        var sn = Math.sin(th), near = (sn + 1) / 2, depth = 0.4 + 0.6 * near;
        var x = cx + a * o.r * Math.cos(th);
        var y = cy - b * o.r * sn + o.z * thick * (0.4 + 0.6 * s.flat);
        if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
        var tum = o.tumble ? 0.55 + 0.45 * Math.sin(t * o.tumble + o.ph) : 1;
        var alpha = Math.min(1, (0.14 + 0.62 * depth) * tum * s.k);
        if (alpha < 0.02) continue;
        var size = o.sz * (0.5 + 0.8 * depth) * (s.scale || 1);
        if (o.rock) {
          if (!sprites[o.rock.mesh]) continue;
          o.px = x; o.py = y; o.pa = alpha; o.ps = o.rock.sz * (0.45 + 0.75 * depth) * (s.scale || 1);
          (near < 0.5 ? farRocks : nearRocks).push(o);
          continue;
        }
        var gC = Math.round(238 - o.red * 90), bC = Math.round(207 - o.red * 140);
        ctx.fillStyle = "rgba(254," + gC + "," + bC + "," + alpha.toFixed(3) + ")";
        if (size > 1.4) {
          ctx.beginPath(); ctx.arc(x, y, size * 0.6, 0, 6.2832); ctx.fill();
          ctx.fillStyle = "rgba(250,167,25," + (alpha * 0.12).toFixed(3) + ")";
          ctx.beginPath(); ctx.arc(x, y, size * 2.2, 0, 6.2832); ctx.fill();
        } else {
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
      ctx.globalCompositeOperation = "source-over";
      var drawRocks = function (list) {
        for (var j = 0; j < list.length; j++) {
          var q = list[j], rk = q.rock;
          var fi = Math.floor(((rk.ph + t * rk.spin) % SPIN_FRAMES + SPIN_FRAMES) % SPIN_FRAMES);
          ctx.globalAlpha = Math.min(1, q.pa * 1.15);
          ctx.drawImage(sprites[rk.mesh][fi], q.px - q.ps, q.py - q.ps, q.ps * 2, q.ps * 2);
        }
        ctx.globalAlpha = 1;
      };
      drawRocks(farRocks);
      drawRocks(nearRocks);

      // a comet, once in a while: slow and faint, its tail away from the light
      if (s.k > 0.5) {
        nextComet -= dt;
        if (!comet && nextComet <= 0) {
          var fromLeft = Math.random() < 0.5;
          comet = { x: (fromLeft ? rnd(0.04, 0.2) : rnd(0.8, 0.96)) * W, y: cy - thick * rnd(1.6, 2.4),
            vx: (fromLeft ? 1 : -1) * rnd(0.018, 0.03) * W, vy: thick * rnd(0.12, 0.2), age: 0, life: rnd(6, 9) };
        }
        if (comet) {
          comet.age += dt; comet.x += comet.vx * dt; comet.y += comet.vy * dt;
          var ca = Math.sin(Math.min(1, comet.age / comet.life) * Math.PI) * 0.5 * s.k;
          var tx = comet.x - 0.83 * W * 0.06, ty = comet.y + 0.56 * W * 0.06;
          ctx.globalCompositeOperation = "lighter";
          var cg = ctx.createLinearGradient(comet.x, comet.y, tx, ty);
          cg.addColorStop(0, "rgba(255,236,200," + ca.toFixed(3) + ")");
          cg.addColorStop(1, "rgba(255,236,200,0)");
          ctx.strokeStyle = cg; ctx.lineWidth = 1.2; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(comet.x, comet.y); ctx.lineTo(tx, ty); ctx.stroke();
          ctx.fillStyle = "rgba(255,248,232," + Math.min(1, ca * 1.6).toFixed(3) + ")";
          ctx.beginPath(); ctx.arc(comet.x, comet.y, 1.3, 0, 6.2832); ctx.fill();
          ctx.globalCompositeOperation = "source-over";
          if (comet.age > comet.life) { comet = null; nextComet = rnd(22, 38); }
        }
      }
    }

    function clear() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    return { resize: resize, draw: draw, clear: clear };
  }

  global.WorxBelt = { create: create };
})(window);
