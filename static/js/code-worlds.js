/* ============================================================
   Worx | code-worlds.js
   The Mission modules' plates on the home page: one computer-science
   world per division, drawn live on one 2D canvas (no WebGL, no images).
   The code is the environment, not a caption on it:

     0 DEVELOPMENT      a source file compiles into a city: each token
                        rises into a block, functions become towers, and
                        requests run from them out to the services.
     1 MOBILE           the app's view tree, exploded like a debugger's
                        3D view: every layer wired to the JSX line that
                        draws it, then collapsing into the finished screen.
     2 DESIGN           a 12-column CSS grid that physically builds a
                        page, each block carried in on the easing curve
                        drawn beside it; a type scale, a pen path, tokens.
     3 EMERGING TECH    a neural net running forward passes inside a
                        latent point cloud, emitting tokens; an AR anchor
                        with a hologram on its plane (the violet chapter).
     4 IT & ENTERPRISE  an isometric topology: regions, racks, a primary
                        and replica, a perimeter that drops a probe, and
                        the cluster's own logs lighting the floor.

   Every service in the division has a port on the plate (home.js pins
   the service's label to it); hovering a service lights its part of
   the world and speeds its traffic. The loop only runs while the plate
   is on screen and the tab is visible; reduced motion gets one settled
   frame per change.
   ============================================================ */
(function (global) {
  "use strict";

  var TAU = Math.PI * 2;
  var MONO = "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";
  var DISPLAY = "Jost, Futura, 'Century Gothic', 'Helvetica Neue', Arial, sans-serif";
  var EMBER = [192, 69, 39], ORANGE = [229, 125, 35], AMBER = [250, 167, 25],
    CREAM = [254, 238, 207], VIOLET = [161, 71, 157], LILAC = [205, 140, 220], PEACH = [254, 214, 160];

  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ")"; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function out3(t) { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t) * (1 - t); }
  function io3(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6d2b79f5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // CSS cubic-bezier(x1, y1, x2, y2) as a function of time
  function cubic(x1, y1, x2, y2) {
    var B = function (a, b, t) { var u = 1 - t; return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t; };
    return function (x) {
      x = clamp(x, 0, 1);
      var lo = 0, hi = 1, t = x;
      for (var i = 0; i < 18; i++) { if (B(x1, x2, t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      return B(y1, y2, t);
    };
  }
  var WORX_EASE = cubic(0.2, 0.8, 0.2, 1);

  /* ---- syntax: a small tokenizer and the Worx theme ------------- */
  var KW = /^(import|export|from|const|let|return|async|await|function|def|for|in|if|default|interface|type|new|SELECT|FROM|WHERE|JOIN|ON|LIMIT)$/;
  var SYN = { kw: AMBER, fn: ORANGE, str: PEACH, num: [240, 122, 80], type: LILAC, id: CREAM, pun: CREAM, prop: [238, 190, 150] };
  var SYNA = { kw: 1, fn: 1, str: 0.82, num: 0.9, type: 0.92, id: 0.7, pun: 0.38, prop: 0.8 };
  function tokenize(line) {
    var out = [], re = /("[^"]*"|'[^']*')|(\d+(?:\.\d+)?(?:px|ms|fr|rem)?)|([A-Za-z_$][\w$-]*)|(\s+)|([^\sA-Za-z_$\d"']+)/g, m;
    while ((m = re.exec(line))) {
      var s = m[0], k;
      if (m[1]) k = "str";
      else if (m[2]) k = "num";
      else if (m[3]) {
        var nx = line.charAt(re.lastIndex);
        k = KW.test(s) ? "kw" : nx === "(" ? "fn" : nx === ":" && /^\s*[\w-]+$/.test(line.slice(0, re.lastIndex)) ? "prop" : /^[A-Z]/.test(s) ? "type" : "id";
      }
      else if (m[4]) k = "ws";
      else k = "pun";
      out.push({ s: s, k: k, col: m.index });
    }
    return out;
  }
  // one line of code, coloured token by token, from the left at (x, y)
  function codeLine(ctx, toks, x, y, size, alpha, cw) {
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (t.k === "ws") continue;
      ctx.fillStyle = rgba(SYN[t.k], SYNA[t.k] * alpha);
      ctx.fillText(t.s, x + t.col * cw, y);
    }
  }

  /* ---- light: soft sprites drawn additively (cheaper than blur) - */
  var sprites = {};
  function sprite(c) {
    var key = c.join();
    if (sprites[key]) return sprites[key];
    var cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    var g = cv.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(c, 1));
    gr.addColorStop(0.18, rgba(c, 0.55));
    gr.addColorStop(0.5, rgba(c, 0.12));
    gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return (sprites[key] = cv);
  }
  function glow(ctx, x, y, r, c, a) {
    if (a <= 0.004 || r <= 0.5) return;
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.drawImage(sprite(c), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  /* ---- camera: yaw about Y, then pitch about X, then perspective -- */
  function camera(cx, cy, S, yaw, pitch, dist, ox, oz) {
    ox = ox || 0; oz = oz || 0;
    var cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    return {
      cx: cx, cy: cy, S: S, yaw: yaw, pitch: pitch,
      p: function (x, y, z) {
        x -= ox; z -= oz;
        var X = x * cyw - z * syw, Z = x * syw + z * cyw;
        var Y = y * cp - Z * sp; Z = y * sp + Z * cp;
        var k = dist / (Z + dist);
        return [cx + X * k * S, cy + Y * k * S, k, Z];
      },
    };
  }
  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  // a block from y0 (floor) up by h, over [x0,x1] x [z0,z1]; top, front
  // and the side that faces the camera
  function block(ctx, cam, x0, x1, z0, z1, y0, h, col, lit) {
    var y1 = y0 - h;
    var P = cam.p;
    var a = P(x0, y0, z0), b = P(x1, y0, z0), c = P(x1, y1, z0), d = P(x0, y1, z0);
    var e = P(x0, y1, z1), f = P(x1, y1, z1), g = P(x1, y0, z1), hh = P(x0, y0, z1);
    ctx.lineWidth = 1;
    if (h > 0.004) {
      var side = cam.yaw > 0 ? [a, d, e, hh] : [b, c, f, g];
      poly(ctx, side); ctx.fillStyle = rgba([14, 7, 4], 0.94); ctx.fill();
      ctx.strokeStyle = rgba(col, 0.1 + lit * 0.25); ctx.stroke();
      poly(ctx, [a, b, c, d]);
      var gr = ctx.createLinearGradient(0, d[1], 0, a[1]);
      gr.addColorStop(0, rgba(col, 0.2 + lit * 0.3));
      gr.addColorStop(1, rgba([18, 9, 5], 0.96));
      ctx.fillStyle = gr; ctx.fill();
      ctx.strokeStyle = rgba(col, 0.22 + lit * 0.4); ctx.stroke();
    }
    poly(ctx, [d, c, f, e]);
    ctx.fillStyle = rgba(col, 0.14 + lit * 0.4); ctx.fill();
    ctx.strokeStyle = rgba(col, 0.4 + lit * 0.5); ctx.stroke();
    return d;
  }
  function floorGrid(ctx, cam, x0, x1, z0, z1, y, step, col, a) {
    ctx.lineWidth = 1;
    for (var x = x0; x <= x1 + 1e-6; x += step) {
      var p = cam.p(x, y, z0), q = cam.p(x, y, z1);
      var gr = ctx.createLinearGradient(p[0], p[1], q[0], q[1]);
      gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
      ctx.strokeStyle = gr;
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
    for (var z = z0; z <= z1 + 1e-6; z += step) {
      var r = cam.p(x0, y, z), s = cam.p(x1, y, z);
      ctx.strokeStyle = rgba(col, a * (1 - (z - z0) / (z1 - z0)));
      ctx.beginPath(); ctx.moveTo(r[0], r[1]); ctx.lineTo(s[0], s[1]); ctx.stroke();
    }
  }
  // a wire from a to the port b, bowed, with packets running along it
  function wire(ctx, a, b, t, hot, col, n) {
    var mx = mix(a[0], b[0], 0.55), my = Math.min(a[1], b[1]) - Math.abs(b[0] - a[0]) * 0.18;
    ctx.lineWidth = hot ? 1.6 : 1;
    ctx.strokeStyle = rgba(col, hot ? 0.85 : 0.26);
    ctx.setLineDash([3, 5]);
    ctx.lineDashOffset = -t * (hot ? 60 : 22);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(mx, my, b[0], b[1]); ctx.stroke();
    ctx.setLineDash([]);
    var sp = hot ? 0.9 : 0.32;
    for (var i = 0; i < n; i++) {
      var u = (t * sp + i / n) % 1, v = 1 - u;
      var x = v * v * a[0] + 2 * v * u * mx + u * u * b[0], y = v * v * a[1] + 2 * v * u * my + u * u * b[1];
      glow(ctx, x, y, hot ? 9 : 6, col, (hot ? 0.95 : 0.6) * Math.sin(u * Math.PI));
    }
    glow(ctx, b[0], b[1], hot ? 22 : 12, col, hot ? 0.9 : 0.45);
  }

  /* ================================================================
     0 · DEVELOPMENT: the compile city
     ================================================================ */
  var DEV_SRC = [
    'import { db } from "./db";',
    'export async function getOrders(req) {',
    '  const user = await auth(req);',
    '  const rows = await db.query(',
    '    "SELECT * FROM orders WHERE uid = $1",',
    '    [user.id], { cache: 60 }',
    '  );',
    '  return Response.json({ rows });',
    '}',
    'def ship(build):',
    '    for step in build.steps:',
    '        step.compile(target="edge")',
    '    return deploy(build, region="uae")',
  ];
  var DEV_H = { kw: 0.3, fn: 0.56, type: 0.4, str: 0.14, num: 0.2, id: 0.12, prop: 0.12, pun: 0.035 };
  var dev = (function () {
    var r = rng(7), lines = DEV_SRC.map(tokenize), blocks = [], towers = {};
    var CW = 0.05, X0 = -1.05, Z0 = -0.55, DZ = 0.23;
    lines.forEach(function (toks, li) {
      toks.forEach(function (t) {
        if (t.k === "ws") return;
        var b = {
          t: t, li: li,
          x0: X0 + t.col * CW, x1: X0 + (t.col + t.s.length) * CW - 0.012,
          z0: Z0 + li * DZ, z1: Z0 + li * DZ + DZ * 0.62,
          h: DEV_H[t.k] * (0.8 + r() * 0.45) * (t.s.length > 10 ? 1.2 : 1),
        };
        blocks.push(b);
        if (t.k === "fn" && !towers[t.s]) towers[t.s] = b;
      });
    });
    // the services' traffic: which function serves which port
    var FEEDS = ["getOrders", "query", "auth", "json"];
    var PERIOD = 12;
    return {
      draw: function (ctx, E, t) {
        var ph = t % PERIOD, loop = Math.floor(t / PERIOD);
        var sink = ph > PERIOD - 1.3 ? io3((ph - (PERIOD - 1.3)) / 1.1) : 0;
        var yaw = 0.34 + Math.sin(t * 0.17) * 0.05 + E.px * 0.07;
        var cam = camera(E.cx - E.S * 0.05, E.cy - E.S * 0.52, E.S * 0.84, yaw, 0.52 + E.py * 0.04, 4.8, -0.05, 1.05);
        var FL = 0.62;
        floorGrid(ctx, cam, -1.4, 1.4, -0.9, 3.2, FL, 0.2, AMBER, 0.12);

        // the compile front: a sheet of light walking back through the file
        var front = Z0 - 0.3 + (ph / 5.2) * (lines.length * DZ + 0.6);
        if (ph < 6) {
          var fa = Math.sin(clamp(ph / 5.6, 0, 1) * Math.PI);
          var l = cam.p(-1.3, FL, front), rr = cam.p(1.3, FL, front), lt = cam.p(-1.3, FL - 0.7, front), rt = cam.p(1.3, FL - 0.7, front);
          var gr = ctx.createLinearGradient(0, l[1], 0, lt[1]);
          gr.addColorStop(0, rgba(AMBER, 0.2 * fa)); gr.addColorStop(1, rgba(AMBER, 0));
          poly(ctx, [l, rr, rt, lt]); ctx.fillStyle = gr; ctx.fill();
          ctx.strokeStyle = rgba(AMBER, 0.75 * fa); ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(rr[0], rr[1]); ctx.stroke();
        }

        // the terminal, printed on the floor past the city, lights it
        var term = [
          { s: "$ worx build --target=edge", c: CREAM, a: 0.55 },
          { s: ph < 5.4 ? "compiling " + Math.min(13, Math.floor(ph / 5.2 * 13) + 1) + "/13 modules" : "✓ compiled 13 modules in 812ms", c: ph < 5.4 ? PEACH : AMBER, a: 0.75 },
        ];
        var tp = cam.p(-0.9, FL, 3.05);
        ctx.save();
        ctx.font = "500 " + (0.075 * E.S * tp[2]).toFixed(1) + "px " + MONO;
        ctx.setTransform(E.dpr, 0, -0.35 * E.dpr, 0.62 * E.dpr, tp[0] * E.dpr, tp[1] * E.dpr);
        term.forEach(function (ln, i) { ctx.fillStyle = rgba(ln.c, ln.a); ctx.fillText(ln.s, 0, i * 0.075 * E.S * tp[2] - 0.075 * E.S * tp[2]); });
        ctx.restore();
        glow(ctx, tp[0] + E.S * 0.5, tp[1] - E.S * 0.02, E.S * 0.75, ORANGE, 0.16);

        // the city, far to near
        var hotName = E.hot >= 0 ? FEEDS[E.hot] : null;
        var order = blocks.slice().sort(function (a, b) { return b.z0 - a.z0 + (b.x0 - a.x0) * (yaw > 0 ? -0.01 : 0.01); });
        ctx.textBaseline = "alphabetic";
        for (var i = 0; i < order.length; i++) {
          var b = order[i];
          // each line rises once the front has passed it (and once only:
          // on the first visit the file starts flat, as source)
          var passed = (ph - (b.li * DZ + 0.3) / (lines.length * DZ + 0.6) * 5.2) / 0.7;
          var rise = loop > 0 && ph < 0.01 ? 1 : out3(passed) * (1 - sink);
          var h = b.h * rise;
          var lit = b.t.s === hotName ? 1 : b.t.k === "fn" ? 0.25 : 0;
          var col = SYN[b.t.k];
          var d = block(ctx, cam, b.x0, b.x1, b.z0, b.z1, FL, h, col, lit);
          var fs = 0.046 * E.S * d[2];
          if (fs < 4) continue;
          ctx.font = "500 " + fs.toFixed(1) + "px " + MONO;
          ctx.fillStyle = rgba(col, (0.35 + 0.55 * SYNA[b.t.k]) * (0.55 + 0.45 * d[2]) + lit * 0.3);
          ctx.fillText(b.t.s, d[0] + 2, d[1] - 3);
        }

        // requests, from the towers out to the services
        ctx.globalCompositeOperation = "lighter";
        E.ports.forEach(function (port, i) {
          var tw = towers[FEEDS[i]];
          if (!tw) return;
          var top = cam.p((tw.x0 + tw.x1) / 2, FL - tw.h * out3((ph - 3) / 2) * (1 - sink), (tw.z0 + tw.z1) / 2);
          wire(ctx, top, port, t + i * 0.37, E.hot === i, i % 2 ? ORANGE : AMBER, 3);
          glow(ctx, top[0], top[1], E.S * 0.09, AMBER, E.hot === i ? 0.9 : 0.3);
        });
        ctx.globalCompositeOperation = "source-over";
      },
    };
  })();

  /* ================================================================
     1 · MOBILE: the view tree, exploded, then built
     ================================================================ */
  var APP_SRC = [
    "export default function App() {",
    "  return (",
    "    <SafeAreaView style={s.root}>",
    "      <Stack gap={16}>",
    '        <Card title="Today" />',
    "        <List data={orders} />",
    "      </Stack>",
    "      <TabBar items={tabs} />",
    "    </SafeAreaView>",
    "  );",
    "}",
  ].map(tokenize);
  // which source line draws which layer
  var LAYER_LINE = [2, 3, 4, 5, 7];
  var mobile = (function () {
    var W = 0.72, H = 1.5;
    // elements per layer, in [0,1] of the screen: u0, v0, u1, v1, kind
    var L = [
      [[0, 0, 1, 1, "screen"], [0.36, 0.018, 0.64, 0.04, "notch"]],
      [[0.06, 0.06, 0.94, 0.16, "guide"], [0.06, 0.19, 0.94, 0.8, "guide"], [0.06, 0.86, 0.94, 0.96, "guide"]],
      [[0.06, 0.2, 0.94, 0.44, "hero"], [0.06, 0.47, 0.48, 0.62, "card"], [0.52, 0.47, 0.94, 0.62, "card"], [0.28, 0.35, 0.72, 0.4, "pill"]],
      [[0.06, 0.66, 0.94, 0.715, "row"], [0.06, 0.73, 0.94, 0.785, "row"], [0.08, 0.085, 0.5, 0.12, "title"], [0.1, 0.52, 0.38, 0.54, "bar"], [0.56, 0.52, 0.84, 0.54, "bar"], [0.1, 0.25, 0.6, 0.28, "bar"]],
      [[0.06, 0.87, 0.94, 0.95, "tabs"], [0.06, 0.012, 0.2, 0.034, "bar"], [0.8, 0.012, 0.94, 0.034, "bar"]],
    ];
    var PORT_LAYER = [2, 0, 4];
    var PERIOD = 10;
    return {
      draw: function (ctx, E, t) {
        var ph = t < PERIOD ? t : 1.6 + (t - PERIOD) % (PERIOD - 1.6);
        // explode 0 (built) .. 1 (spread); layers arrive one by one first
        var ex;
        if (ph < 1.6) ex = 1;
        else if (ph < 5.6) ex = 1;
        else if (ph < 6.8) ex = 1 - io3((ph - 5.6) / 1.2);
        else if (ph < 8.6) ex = 0;
        else ex = io3((ph - 8.6) / 1.2);
        var built = 1 - ex;
        var yaw = mix(-0.2, -0.78, ex) + Math.sin(t * 0.21) * 0.04 + E.px * 0.08;
        var cam = camera(E.cx + E.S * 0.02, E.cy, E.S, yaw, 0.16 + E.py * 0.04, 4);
        var gap = 0.26 * ex + 0.012;
        var CXL = 0.18;
        var at = function (li, u, v) { return cam.p(CXL + (u - 0.5) * W, (v - 0.5) * H, (li - 2) * gap); };

        // the source, floating left of the stack, in front
        // (flat, in screen space: it's the editor, not part of the stack)
        var cp = [E.cx - E.S * 1.2, E.cy - E.S * 0.5];
        var fs = 0.037 * E.S, cw = fs * 0.6, lh = fs * 1.6;
        ctx.font = "500 " + fs.toFixed(1) + "px " + MONO;
        ctx.textBaseline = "middle";
        var srcA = 0.45 + 0.35 * ex;
        APP_SRC.forEach(function (toks, i) {
          var on = LAYER_LINE.indexOf(i);
          codeLine(ctx, toks, cp[0], cp[1] + i * lh, fs, srcA * (on >= 0 ? 1 : 0.6), cw);
        });

        // layers, back to front
        var hotLayer = E.hot >= 0 ? PORT_LAYER[E.hot] : -1;
        var order = [0, 1, 2, 3, 4];
        if (Math.sin(yaw) > 0) order.reverse();
        for (var oi = 0; oi < order.length; oi++) {
          var li = order[oi];
          var arrive = t < PERIOD ? out3((t - li * 0.22) / 0.8) : 1;
          if (arrive <= 0) continue;
          var off = (1 - arrive) * 1.2;
          var P = function (u, v) { var p = at(li, u, v); if (off) { p = cam.p(CXL + (u - 0.5) * W, (v - 0.5) * H, (li - 2) * gap - off); } return p; };
          var lit = li === hotLayer ? 1 : 0;
          ctx.globalAlpha = arrive;
          // the layer's plane
          var q = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)];
          poly(ctx, q);
          ctx.fillStyle = li === 0 ? rgba([16, 8, 5], 0.92) : rgba(AMBER, 0.02 + 0.04 * ex + lit * 0.05);
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = rgba(li === 0 ? CREAM : AMBER, (li === 0 ? 0.3 : 0.12 + 0.2 * ex) + lit * 0.5);
          ctx.stroke();
          L[li].forEach(function (el) {
            if (el[4] === "screen") return;
            var e = [P(el[0], el[1]), P(el[2], el[1]), P(el[2], el[3]), P(el[0], el[3])];
            poly(ctx, e);
            var k = el[4];
            if (k === "guide") {
              ctx.setLineDash([3, 3]); ctx.strokeStyle = rgba(AMBER, (0.2 + 0.4 * ex) + lit * 0.4); ctx.stroke(); ctx.setLineDash([]);
            } else if (k === "hero") {
              var g = ctx.createLinearGradient(e[0][0], e[0][1], e[2][0], e[2][1]);
              g.addColorStop(0, rgba(EMBER, 0.55 + built * 0.3)); g.addColorStop(1, rgba(AMBER, 0.35 + built * 0.4));
              ctx.fillStyle = g; ctx.fill();
            } else if (k === "card" || k === "row") {
              ctx.fillStyle = rgba(CREAM, 0.06 + built * 0.05 + lit * 0.05); ctx.fill();
              ctx.strokeStyle = rgba(CREAM, 0.16 + lit * 0.3); ctx.stroke();
            } else if (k === "pill") {
              ctx.fillStyle = rgba(CREAM, 0.85); ctx.fill();
            } else if (k === "tabs") {
              ctx.fillStyle = rgba([30, 15, 9], 0.9); ctx.fill(); ctx.strokeStyle = rgba(CREAM, 0.14); ctx.stroke();
              for (var d = 0; d < 5; d++) {
                var c = P(0.16 + d * 0.17, 0.91);
                glow(ctx, c[0], c[1], E.S * 0.04 * c[2], d === 0 ? AMBER : CREAM, d === 0 ? 0.9 : 0.35);
              }
            } else if (k === "notch") {
              ctx.fillStyle = "#000"; ctx.fill();
            } else {
              ctx.fillStyle = rgba(k === "title" ? CREAM : CREAM, k === "title" ? 0.8 : 0.4); ctx.fill();
            }
          });
          ctx.globalAlpha = 1;

          // the wire back to the line of code that draws this layer
          if (ex > 0.05) {
            var ln = LAYER_LINE[li];
            var toks = APP_SRC[ln], last = toks[toks.length - 1];
            var sx = cp[0] + (last.col + last.s.length + 1) * cw, sy = cp[1] + ln * lh;
            var lp = P(0, 0.5);
            ctx.strokeStyle = rgba(AMBER, (0.12 + lit * 0.5) * ex * arrive);
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.bezierCurveTo(sx + E.S * 0.3, sy, lp[0] - E.S * 0.3, lp[1], lp[0], lp[1]); ctx.stroke();
            var u = (t * 0.45 + li * 0.2) % 1;
            var bx = Math.pow(1 - u, 3) * sx + 3 * Math.pow(1 - u, 2) * u * (sx + E.S * 0.3) + 3 * (1 - u) * u * u * (lp[0] - E.S * 0.3) + u * u * u * lp[0];
            var by = Math.pow(1 - u, 3) * sy + 3 * Math.pow(1 - u, 2) * u * sy + 3 * (1 - u) * u * u * lp[1] + u * u * u * lp[1];
            ctx.globalCompositeOperation = "lighter";
            glow(ctx, bx, by, 6, AMBER, 0.7 * ex * Math.sin(u * Math.PI));
            ctx.globalCompositeOperation = "source-over";
          }
        }

        // built: the screen lights up, the run lands
        if (built > 0.02) {
          var c0 = at(4, 0.5, 0.45);
          ctx.globalCompositeOperation = "lighter";
          glow(ctx, c0[0], c0[1], E.S * 1.1, ORANGE, 0.22 * built);
          ctx.globalCompositeOperation = "source-over";
          var rp = at(4, 0.0, 1.06);
          ctx.font = "500 " + (0.042 * E.S).toFixed(1) + "px " + MONO;
          ctx.textBaseline = "middle";
          ctx.fillStyle = rgba(AMBER, 0.85 * built);
          ctx.fillText("▶ Build succeeded · iOS + Android", rp[0], rp[1]);
        }

        // services
        ctx.globalCompositeOperation = "lighter";
        E.ports.forEach(function (port, i) {
          var li = PORT_LAYER[i], a = at(li, 1, 0.3 + i * 0.22);
          wire(ctx, a, port, t + i * 0.3, E.hot === i, i === 1 ? ORANGE : AMBER, 3);
        });
        ctx.globalCompositeOperation = "source-over";
      },
    };
  })();

  /* ================================================================
     2 · DESIGN & CREATIVE: the grid builds the page
     ================================================================ */
  var design = (function () {
    var BW = 1.72, BH = 1.16, COLS = 12, G = 0.035, ROWS = 6;
    var colW = (BW - G * (COLS - 1)) / COLS, rowH = (BH - G * (ROWS - 1)) / ROWS;
    // grid areas: col start, col end (exclusive), row start, row end, kind
    var AREAS = [
      [0, 12, 0, 1, "nav"], [0, 8, 1, 4, "hero"], [8, 12, 1, 4, "mark"],
      [0, 4, 4, 6, "card"], [4, 8, 4, 6, "card"], [8, 12, 4, 6, "copy"],
    ];
    var r = rng(21);
    AREAS.forEach(function (a) { a.dx = (r() - 0.5) * 1.2; a.dy = (r() - 0.5) * 0.9; a.rz = (r() - 0.5) * 0.6; });
    var PORT_AREA = [1, 2, -1, 5];   // UI, branding, motion (the curve), copy
    var PERIOD = 11;
    var css = tokenize("grid-template-columns: repeat(12, 1fr);");
    var css2 = tokenize("gap: 24px;");
    return {
      draw: function (ctx, E, t) {
        var ph = t < PERIOD ? t : 1.2 + (t - PERIOD) % (PERIOD - 1.2);
        var yaw = 0.42 + Math.sin(t * 0.19) * 0.05 + E.px * 0.08;
        var cam = camera(E.cx - E.S * 0.05, E.cy - E.S * 0.02, E.S, yaw, 0.2 + E.py * 0.05, 3.6);
        var OX = -BW / 2 + 0.02, OY = -BH / 2 - 0.12;
        var P = function (x, y, z) { return cam.p(OX + x, OY + y, z || 0); };
        var cx0 = function (c) { return c * (colW + G); };
        var ry0 = function (rr) { return rr * (rowH + G); };

        // the artboard and its columns (a devtools grid overlay)
        poly(ctx, [P(-0.06, -0.06), P(BW + 0.06, -0.06), P(BW + 0.06, BH + 0.06), P(-0.06, BH + 0.06)]);
        ctx.fillStyle = rgba([16, 8, 5], 0.9); ctx.fill();
        ctx.strokeStyle = rgba(CREAM, 0.12); ctx.lineWidth = 1; ctx.stroke();
        var fsN = 0.036 * E.S;
        ctx.font = "500 " + fsN.toFixed(1) + "px " + MONO;
        ctx.textBaseline = "alphabetic";
        for (var c = 0; c < COLS; c++) {
          var g = out3((ph - c * 0.05) / 0.6);
          if (g <= 0) continue;
          var q = [P(cx0(c), 0), P(cx0(c) + colW, 0), P(cx0(c) + colW, BH * g), P(cx0(c), BH * g)];
          poly(ctx, q);
          ctx.fillStyle = rgba(VIOLET, 0.07 * g); ctx.fill();
          ctx.strokeStyle = rgba(LILAC, 0.2 * g); ctx.stroke();
          var n = P(cx0(c) + colW * 0.3, -0.1);
          ctx.fillStyle = rgba(LILAC, 0.55 * g);
          ctx.fillText(String(c + 1), n[0], n[1]);
        }
        // the rule that draws the grid, on the board's top edge
        var rt = P(0, -0.2);
        var fsC = 0.045 * E.S * rt[2];
        ctx.font = "500 " + fsC.toFixed(1) + "px " + MONO;
        codeLine(ctx, css, rt[0], rt[1], fsC, out3(ph / 0.8), fsC * 0.6);
        var rt2 = P(BW - 0.36, BH + 0.16);
        codeLine(ctx, css2, rt2[0], rt2[1], fsC, out3(ph / 0.8) * 0.8, fsC * 0.6);

        // the blocks fly in on the curve, one by one, and out at the end
        var hotArea = E.hot >= 0 ? PORT_AREA[E.hot] : -1;
        var prog = [];
        AREAS.forEach(function (a, i) {
          var inT = (ph - 1.1 - i * 0.32) / 0.95, outT = (ph - (PERIOD - 1.6) - i * 0.08) / 0.7;
          var k = WORX_EASE(inT) * (1 - io3(outT));
          prog.push(clamp(inT, 0, 1));
          if (k <= 0.001) return;
          var x0 = cx0(a[0]), x1 = cx0(a[1]) - G, y0 = ry0(a[2]), y1 = ry0(a[3]) - G;
          var lift = i === hotArea ? 0.08 : 0;
          var dz = -(1 - k) * 1.1 - lift - (E.hot < 0 ? 0 : 0.01);
          var dx = (1 - k) * a.dx, dy = (1 - k) * a.dy;
          var Q = function (u, v) { return P(mix(x0, x1, u) + dx, mix(y0, y1, v) + dy, dz + (1 - k) * a.rz * (u - 0.5)); };
          var pts = [Q(0, 0), Q(1, 0), Q(1, 1), Q(0, 1)];
          var lit = i === hotArea ? 1 : 0;
          // its shadow on the board while it's in the air
          if (k < 0.99) {
            poly(ctx, [P(x0 + dx * 0.4, y0 + dy * 0.4), P(x1 + dx * 0.4, y0 + dy * 0.4), P(x1 + dx * 0.4, y1 + dy * 0.4), P(x0 + dx * 0.4, y1 + dy * 0.4)]);
            ctx.fillStyle = rgba([0, 0, 0], 0.35 * k); ctx.fill();
          }
          ctx.globalAlpha = clamp(k * 1.4, 0, 1);
          poly(ctx, pts);
          if (a[4] === "hero") {
            var gr = ctx.createLinearGradient(pts[0][0], pts[0][1], pts[2][0], pts[2][1]);
            gr.addColorStop(0, rgba(EMBER, 0.7)); gr.addColorStop(0.55, rgba(ORANGE, 0.55)); gr.addColorStop(1, rgba(AMBER, 0.5));
            ctx.fillStyle = gr;
          } else ctx.fillStyle = rgba([34, 17, 10], 0.95);
          ctx.fill();
          ctx.strokeStyle = rgba(lit ? AMBER : CREAM, lit ? 0.95 : 0.2); ctx.lineWidth = lit ? 1.5 : 1; ctx.stroke();
          ctx.lineWidth = 1;
          var kind = a[4], p;
          if (kind === "hero") {
            p = Q(0.07, 0.52);
            ctx.font = "600 " + (0.3 * E.S * p[2]).toFixed(1) + "px " + DISPLAY;
            ctx.fillStyle = rgba(CREAM, 0.95);
            ctx.fillText("Aa", p[0], p[1]);
            var bar = function (u0, v0, u1, v1, a2) { poly(ctx, [Q(u0, v0), Q(u1, v0), Q(u1, v1), Q(u0, v1)]); ctx.fillStyle = rgba(CREAM, a2); ctx.fill(); };
            bar(0.07, 0.66, 0.62, 0.7, 0.75); bar(0.07, 0.75, 0.48, 0.78, 0.4);
            bar(0.07, 0.84, 0.27, 0.92, 0.9);
          } else if (kind === "nav") {
            for (var d = 0; d < 4; d++) { poly(ctx, [Q(0.58 + d * 0.1, 0.4), Q(0.65 + d * 0.1, 0.4), Q(0.65 + d * 0.1, 0.6), Q(0.58 + d * 0.1, 0.6)]); ctx.fillStyle = rgba(CREAM, 0.35); ctx.fill(); }
            poly(ctx, [Q(0.03, 0.3), Q(0.1, 0.3), Q(0.1, 0.7), Q(0.03, 0.7)]); ctx.fillStyle = rgba(AMBER, 0.9); ctx.fill();
          } else if (kind === "mark") {
            // a vector mark, drawn with the pen: anchors, handles, path
            var pen = [[0.18, 0.3], [0.34, 0.72], [0.5, 0.42], [0.66, 0.72], [0.82, 0.3]];
            var drawn = out3((ph - 3.2) / 1.6);
            ctx.strokeStyle = rgba(AMBER, 0.95); ctx.lineWidth = 1.6;
            ctx.beginPath();
            var steps = Math.max(1, Math.floor(drawn * 40));
            for (var s = 0; s <= steps; s++) {
              var u = s / 40 * (pen.length - 1), seg = Math.min(pen.length - 2, Math.floor(u)), f = u - seg;
              var a0 = pen[seg], a1 = pen[seg + 1], ee = (1 - Math.cos(f * Math.PI)) / 2;
              var pp = Q(mix(a0[0], a1[0], f), mix(a0[1], a1[1], ee));
              if (s) ctx.lineTo(pp[0], pp[1]); else ctx.moveTo(pp[0], pp[1]);
            }
            ctx.stroke(); ctx.lineWidth = 1;
            pen.forEach(function (pt, j) {
              if (j / (pen.length - 1) > drawn + 0.01) return;
              var ap = Q(pt[0], pt[1]), h1 = Q(pt[0] - 0.09, pt[1]), h2 = Q(pt[0] + 0.09, pt[1]);
              ctx.strokeStyle = rgba(LILAC, 0.6);
              ctx.beginPath(); ctx.moveTo(h1[0], h1[1]); ctx.lineTo(h2[0], h2[1]); ctx.stroke();
              ctx.fillStyle = rgba(LILAC, 0.9);
              ctx.fillRect(h1[0] - 1.5, h1[1] - 1.5, 3, 3); ctx.fillRect(h2[0] - 1.5, h2[1] - 1.5, 3, 3);
              ctx.fillStyle = rgba(CREAM, 1); ctx.fillRect(ap[0] - 2.5, ap[1] - 2.5, 5, 5);
            });
          } else if (kind === "copy") {
            // the type scale, 1.25 steps
            [["H1", 0.2], ["H2", 0.16], ["H3", 0.128], ["Body", 0.1]].forEach(function (st, j) {
              var tp = Q(0.08, 0.28 + j * 0.21);
              ctx.font = "600 " + (st[1] * E.S * tp[2] * 0.48).toFixed(1) + "px " + DISPLAY;
              ctx.fillStyle = rgba(CREAM, 0.9 - j * 0.15);
              ctx.fillText("Worx", tp[0], tp[1]);
              var lp = Q(0.62, 0.28 + j * 0.21);
              ctx.font = "500 " + (0.03 * E.S * lp[2]).toFixed(1) + "px " + MONO;
              ctx.fillStyle = rgba(AMBER, 0.7);
              ctx.fillText((1.25 * Math.pow(1.25, 3 - j)).toFixed(2) + "rem", lp[0], lp[1]);
            });
          } else {
            var bar2 = function (u0, v0, u1, v1, a2, col) { poly(ctx, [Q(u0, v0), Q(u1, v0), Q(u1, v1), Q(u0, v1)]); ctx.fillStyle = rgba(col || CREAM, a2); ctx.fill(); };
            bar2(0.08, 0.1, 0.92, 0.55, 0.06);
            bar2(0.08, 0.66, 0.7, 0.72, 0.6); bar2(0.08, 0.78, 0.5, 0.83, 0.3);
            bar2(0.08, 0.2, 0.3, 0.45, 0.35, i === 3 ? ORANGE : AMBER);
          }
          ctx.globalAlpha = 1;
        });

        // tokens on the board's foot
        var TOK = [EMBER, ORANGE, AMBER, CREAM, VIOLET];
        TOK.forEach(function (col, j) {
          var sw = out3((ph - 2.6 - j * 0.1) / 0.5);
          if (sw <= 0) return;
          var x = j * 0.1;
          poly(ctx, [P(x, BH + 0.09), P(x + 0.07, BH + 0.09), P(x + 0.07, BH + 0.16), P(x, BH + 0.16)]);
          ctx.fillStyle = rgba(col, 0.9 * sw); ctx.fill();
        });

        // the curve that carries them, in the foreground
        var cO = cam.p(OX + 0.95, OY + BH + 0.62, -0.3), cS = E.S * 0.36 * cO[2];
        var cx1 = cO[0], cy1 = cO[1];
        var hotCurve = E.hot === 2;
        ctx.strokeStyle = rgba(CREAM, 0.16); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx1, cy1 - cS); ctx.lineTo(cx1, cy1); ctx.lineTo(cx1 + cS, cy1); ctx.stroke();
        var h1x = cx1 + 0.2 * cS, h1y = cy1 - 0.8 * cS, h2x = cx1 + 0.2 * cS, h2y = cy1 - cS;
        ctx.strokeStyle = rgba(LILAC, 0.5);
        ctx.beginPath(); ctx.moveTo(cx1, cy1); ctx.lineTo(h1x, h1y); ctx.moveTo(cx1 + cS, cy1 - cS); ctx.lineTo(h2x, h2y); ctx.stroke();
        ctx.strokeStyle = rgba(AMBER, hotCurve ? 1 : 0.8); ctx.lineWidth = hotCurve ? 2.2 : 1.6;
        ctx.beginPath(); ctx.moveTo(cx1, cy1); ctx.bezierCurveTo(h1x, h1y, h2x, h2y, cx1 + cS, cy1 - cS); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = rgba(LILAC, 0.95);
        ctx.beginPath(); ctx.arc(h1x, h1y, 2.6, 0, TAU); ctx.arc(h2x, h2y, 2.6, 0, TAU); ctx.fill();
        // the dot rides the curve with whichever block is in flight
        var live = -1;
        for (var pi = 0; pi < prog.length; pi++) if (prog[pi] > 0 && prog[pi] < 1) live = pi;
        var tt = live >= 0 ? prog[live] : (t * 0.5) % 1;
        var dotx = cx1 + tt * cS, doty = cy1 - WORX_EASE(tt) * cS;
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, dotx, doty, 12, AMBER, 0.95);
        ctx.globalCompositeOperation = "source-over";
        ctx.font = "500 " + (0.036 * E.S).toFixed(1) + "px " + MONO;
        ctx.fillStyle = rgba(CREAM, 0.55);
        ctx.fillText("cubic-bezier(.2, .8, .2, 1)", cx1, cy1 + 0.075 * E.S);

        // services
        ctx.globalCompositeOperation = "lighter";
        E.ports.forEach(function (port, i) {
          var ai = PORT_AREA[i], a;
          if (ai < 0) a = [dotx, doty];
          else { var A = AREAS[ai]; a = P(cx0(A[1]) - G, mix(ry0(A[2]), ry0(A[3]) - G, 0.5)); }
          wire(ctx, a, port, t + i * 0.33, E.hot === i, i === 2 ? LILAC : AMBER, 3);
        });
        ctx.globalCompositeOperation = "source-over";
      },
    };
  })();

  /* ================================================================
     3 · EMERGING TECH: the forward pass, the latent field, the anchor
     ================================================================ */
  var emerging = (function () {
    var SIZES = [4, 7, 9, 7, 3], nodes = [], edges = [], cloud = [];
    var r = rng(33);
    SIZES.forEach(function (n, li) {
      var rad = 0.16 + 0.5 * n / 9, layer = [];
      for (var i = 0; i < n; i++) layer.push({ li: li, a: i / n * TAU + li * 0.4, rad: rad, x: -0.95 + li * 0.46 });
      nodes.push(layer);
    });
    for (var li = 0; li < SIZES.length - 1; li++)
      nodes[li].forEach(function (a) { nodes[li + 1].forEach(function (b) { edges.push({ a: a, b: b, w: r(), o: r() }); }); });
    for (var i = 0; i < 240; i++) {
      var th = r() * TAU, ph = Math.acos(2 * r() - 1), rr = 1.25 + (r() - 0.5) * 0.35;
      cloud.push({ x: rr * Math.sin(ph) * Math.cos(th) * 1.15, y: rr * Math.cos(ph) * 0.7, z: rr * Math.sin(ph) * Math.sin(th), c: r() < 0.18 ? AMBER : r() < 0.5 ? LILAC : VIOLET, s: r() });
    }
    var OUT = ["{", '"intent":', '"book_viewing",', '"area":', '"Dubai Marina",', '"confidence":', "0.97", "}"];
    var cube = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
    var CE = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    return {
      draw: function (ctx, E, t) {
        var yaw = 0.5 + Math.sin(t * 0.13) * 0.12 + E.px * 0.1;
        var cam = camera(E.cx - E.S * 0.1, E.cy - E.S * 0.08, E.S, yaw, 0.18 + E.py * 0.05, 3.8);
        var spin = t * 0.35;
        var hotAI = E.hot === 0, hotAR = E.hot === 1;
        var intro = out3(t / 1.4);

        // the latent field: a slow cloud round the net
        var cy_ = Math.cos(t * 0.06), sy = Math.sin(t * 0.06);
        ctx.globalCompositeOperation = "lighter";
        for (var i = 0; i < cloud.length; i++) {
          var c = cloud[i], x = c.x * cy_ - c.z * sy, z = c.x * sy + c.z * cy_;
          var p = cam.p(x * mix(1.6, 1, intro), c.y, z);
          var tw = 0.45 + 0.55 * Math.sin(t * 1.3 + c.s * 20);
          var sz = (c.c === AMBER ? 2.2 : 1.5) * p[2];
          ctx.fillStyle = rgba(c.c, (0.25 + 0.5 * tw) * clamp(p[2] - 0.35, 0.15, 1) * intro);
          ctx.fillRect(p[0] - sz / 2, p[1] - sz / 2, sz, sz);
        }
        ctx.globalCompositeOperation = "source-over";

        // the net
        var pos = function (n) {
          var a = n.a + spin * (n.li % 2 ? -1 : 1) * 0.5;
          return cam.p(n.x, Math.cos(a) * n.rad * 0.9, Math.sin(a) * n.rad);
        };
        nodes.forEach(function (layer) { layer.forEach(function (n) { n.p = pos(n); }); });
        // the forward pass: a wave across the layers, every 2.4s
        var wave = ((t * 0.9) % 2.4) / 2.4 * (SIZES.length + 0.5) - 0.5;
        ctx.lineWidth = 1;
        edges.forEach(function (e) {
          var act = Math.max(0, 1 - Math.abs(wave - e.a.li - 0.5) * 1.6);
          var a = 0.04 + e.w * 0.07 + act * e.w * 0.4 + (hotAI ? 0.08 : 0);
          ctx.strokeStyle = rgba(e.w > 0.7 ? AMBER : LILAC, a * intro);
          ctx.beginPath(); ctx.moveTo(e.a.p[0], e.a.p[1]); ctx.lineTo(e.b.p[0], e.b.p[1]); ctx.stroke();
        });
        ctx.globalCompositeOperation = "lighter";
        edges.forEach(function (e) {
          if (e.w < 0.62) return;
          var u = wave - e.a.li;
          if (u < 0 || u > 1) return;
          glow(ctx, mix(e.a.p[0], e.b.p[0], u), mix(e.a.p[1], e.b.p[1], u), 5, AMBER, 0.75 * intro);
        });
        nodes.forEach(function (layer, li) {
          var act = Math.max(0, 1 - Math.abs(wave - li) * 1.2);
          layer.forEach(function (n) {
            var k = n.p[2];
            glow(ctx, n.p[0], n.p[1], (6 + act * 10) * k, act > 0.3 ? AMBER : LILAC, (0.45 + act * 0.55) * intro);
          });
        });
        ctx.globalCompositeOperation = "source-over";
        nodes.forEach(function (layer) {
          layer.forEach(function (n) { ctx.fillStyle = rgba(CREAM, 0.85 * intro); ctx.beginPath(); ctx.arc(n.p[0], n.p[1], 1.6 * n.p[2], 0, TAU); ctx.fill(); });
        });

        // tokens stream out of the output layer, one at a time
        var outN = nodes[SIZES.length - 1];
        var o = [0, 0];
        outN.forEach(function (n) { o[0] += n.p[0] / outN.length; o[1] += n.p[1] / outN.length; });
        var port0 = E.ports[0] || [o[0] + E.S, o[1]];
        var gen = (t * 2.2) % (OUT.length + 5);
        ctx.font = "500 " + (0.042 * E.S).toFixed(1) + "px " + MONO;
        ctx.textBaseline = "middle";
        var tx = E.cx - E.S * 1.05, ty = E.cy + E.S * 0.98, acc = 0;
        ctx.fillStyle = rgba(CREAM, 0.4);
        ctx.fillText("> model.generate(prompt)", tx, ty - E.S * 0.085);
        for (var k = 0; k < OUT.length; k++) {
          var tok = OUT[k], w = ctx.measureText(tok + " ").width;
          if (k < gen) {
            var age = clamp(gen - k, 0, 1);
            var toks = tokenize(tok);
            ctx.globalAlpha = age;
            codeLine(ctx, toks, tx + acc, ty, 0, 0.95, w / (tok.length + 1));
            ctx.globalAlpha = 1;
            if (age < 1) {
              ctx.globalCompositeOperation = "lighter";
              glow(ctx, mix(o[0], tx + acc + w / 2, age), mix(o[1], ty, age), 8, AMBER, 0.9);
              ctx.globalCompositeOperation = "source-over";
            }
          }
          acc += w;
          if (acc > E.S * 1.2 && k < OUT.length - 1) { ty += E.S * 0.075; acc = 0; }
        }
        var caret = Math.floor(t * 2) % 2 ? 0.9 : 0.1;
        ctx.fillStyle = rgba(AMBER, caret); ctx.fillRect(tx + acc, ty - E.S * 0.025, 2, E.S * 0.05);

        // the AR anchor: a plane, a placement reticle, a hologram on it
        var ap = E.ports[1] || [E.cx + E.S, E.cy + E.S * 0.5];
        var acam = camera(ap[0] - E.S * 0.42, ap[1] + E.S * 0.12, E.S, t * 0.25, 0.9, 3);
        ctx.lineWidth = 1;
        for (var ring = 1; ring <= 3; ring++) {
          ctx.strokeStyle = rgba(LILAC, (hotAR ? 0.5 : 0.22) / ring);
          ctx.beginPath();
          for (var s = 0; s <= 48; s++) {
            var aa = s / 48 * TAU, pp = acam.p(Math.cos(aa) * 0.13 * ring, 0.08, Math.sin(aa) * 0.13 * ring);
            if (s) ctx.lineTo(pp[0], pp[1]); else ctx.moveTo(pp[0], pp[1]);
          }
          ctx.stroke();
        }
        var bob = Math.sin(t * 1.6) * 0.02;
        var hcam = camera(ap[0] - E.S * 0.42, ap[1] + E.S * 0.12, E.S, t * 0.6, 0.35, 3);
        var cp = cube.map(function (v) { return hcam.p(v[0] * 0.09, v[1] * 0.09 - 0.14 + bob, v[2] * 0.09); });
        ctx.strokeStyle = rgba(hotAR ? AMBER : LILAC, hotAR ? 0.95 : 0.75); ctx.lineWidth = hotAR ? 1.5 : 1.1;
        ctx.beginPath();
        CE.forEach(function (e) { ctx.moveTo(cp[e[0]][0], cp[e[0]][1]); ctx.lineTo(cp[e[1]][0], cp[e[1]][1]); });
        ctx.stroke(); ctx.lineWidth = 1;
        // the scan that places it
        var sc = (t * 0.7) % 1, sp = acam.p(0, 0.08, 0);
        ctx.strokeStyle = rgba(LILAC, 0.5 * (1 - sc));
        ctx.beginPath(); ctx.ellipse(sp[0], sp[1], E.S * 0.5 * sc, E.S * 0.5 * sc * Math.sin(0.9), 0, 0, TAU); ctx.stroke();

        ctx.globalCompositeOperation = "lighter";
        glow(ctx, sp[0], sp[1] - E.S * 0.14, E.S * 0.35, VIOLET, hotAR ? 0.55 : 0.3);
        wire(ctx, o, port0, t, hotAI, AMBER, 4);
        wire(ctx, [sp[0] + E.S * 0.1, sp[1] - E.S * 0.16], ap, t + 0.5, hotAR, LILAC, 2);
        ctx.globalCompositeOperation = "source-over";
      },
    };
  })();

  /* ================================================================
     4 · IT & ENTERPRISE: the topology
     ================================================================ */
  var infra = (function () {
    // platforms: x, z, w, d, name
    var PLAT = [
      { x: -0.55, z: 0.1, w: 0.95, d: 0.8, name: "me-central-1" },
      { x: -0.65, z: 1.35, w: 0.8, d: 0.62, name: "eu-west-1" },
      { x: 0.7, z: 0.55, w: 0.6, d: 0.5, name: "edge-pop" },
    ];
    var RACKS = [
      [0, -0.85, -0.05, 0.42], [0, -0.63, -0.05, 0.5], [0, -0.41, -0.05, 0.46], [0, -0.19, -0.05, 0.38],
      [1, -0.9, 1.3, 0.34], [1, -0.68, 1.3, 0.4], [1, -0.46, 1.3, 0.3],
    ];
    var DB = [{ x: -0.62, z: 0.36, name: "pg-primary" }, { x: -0.52, z: 1.52, name: "pg-replica" }];
    var OPS = [[0.55, 0.45], [0.72, 0.62], [0.88, 0.47]];
    var LOG = [
      "$ kubectl get pods -n prod",
      "api-7f9c4d     1/1   Running   12d",
      "worker-2b8e1   1/1   Running   12d",
      "pg-primary-0   1/1   Running   40d",
      "replication lag 3ms  ·  p99 41ms",
      "deny tcp 203.0.113.7:22  →  perimeter",
      "autoscale api 4 → 6 replicas",
    ];
    var PORT_OBJ = ["db", "cloud", "ops"];
    return {
      draw: function (ctx, E, t) {
        var yaw = 0.62 + Math.sin(t * 0.15) * 0.05 + E.px * 0.07;
        var cam = camera(E.cx + E.S * 0.12, E.cy - E.S * 0.05, E.S * 0.85, yaw, 0.62 + E.py * 0.04, 5.5, 0.05, 0.75);
        var FL = 0.35;
        var intro = function (d) { return out3((t - d) / 0.8); };
        floorGrid(ctx, cam, -1.5, 1.5, -0.9, 2.1, FL, 0.2, ORANGE, 0.1);

        // the logs, scrolling on the floor in front: they light it
        var lp = cam.p(0.15, FL, -0.75);
        var fs = 0.046 * E.S * lp[2], scroll = (t * 0.6) % LOG.length;
        ctx.save();
        ctx.setTransform(E.dpr * 0.85, E.dpr * 0.32, -E.dpr * 0.62, E.dpr * 0.5, lp[0] * E.dpr, lp[1] * E.dpr);
        ctx.font = "500 " + fs.toFixed(1) + "px " + MONO;
        ctx.textBaseline = "middle";
        for (var i = 0; i < 5; i++) {
          var li = (Math.floor(scroll) + i) % LOG.length, fade = i === 4 ? scroll % 1 : 1;
          var s = LOG[li];
          ctx.fillStyle = rgba(s.indexOf("deny") === 0 ? EMBER : s.charAt(0) === "$" ? CREAM : AMBER, (0.2 + i * 0.12) * fade);
          ctx.fillText(s, 0, (i - (scroll % 1)) * fs * 1.6);
        }
        ctx.restore();

        // platforms
        PLAT.forEach(function (pl, i) {
          var k = intro(i * 0.2);
          var a = cam.p(pl.x - pl.w / 2, FL, pl.z - pl.d / 2), b = cam.p(pl.x + pl.w / 2, FL, pl.z - pl.d / 2),
            c = cam.p(pl.x + pl.w / 2, FL, pl.z + pl.d / 2), d = cam.p(pl.x - pl.w / 2, FL, pl.z + pl.d / 2);
          poly(ctx, [a, b, c, d]);
          ctx.fillStyle = rgba(ORANGE, 0.05 * k); ctx.fill();
          ctx.strokeStyle = rgba(AMBER, (E.hot === 1 && i === 1 ? 0.8 : 0.3) * k); ctx.lineWidth = 1; ctx.stroke();
          ctx.font = "500 " + (0.034 * E.S * a[2]).toFixed(1) + "px " + MONO;
          ctx.textBaseline = "alphabetic";
          ctx.fillStyle = rgba(CREAM, 0.45 * k);
          ctx.fillText(pl.name, a[0] + 4, a[1] - 4);
        });

        // the perimeter round the primary region
        var per = PLAT[0];
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = rgba(AMBER, 0.35 * intro(0.3));
        ctx.beginPath();
        for (var s2 = 0; s2 <= 60; s2++) {
          var aa = s2 / 60 * TAU, pp = cam.p(per.x + Math.cos(aa) * 0.72, FL, per.z + Math.sin(aa) * 0.62);
          if (s2) ctx.lineTo(pp[0], pp[1]); else ctx.moveTo(pp[0], pp[1]);
        }
        ctx.stroke(); ctx.setLineDash([]);
        // a probe from outside, dropped at the edge
        var pr = (t * 0.33) % 1;
        var from = [per.x - 1.5, per.z - 0.9], hit = [per.x - 0.72 * 0.8, per.z - 0.62 * 0.6];
        var ppr = cam.p(mix(from[0], hit[0], Math.min(pr / 0.6, 1)), FL - 0.05, mix(from[1], hit[1], Math.min(pr / 0.6, 1)));
        ctx.globalCompositeOperation = "lighter";
        if (pr < 0.6) glow(ctx, ppr[0], ppr[1], 7, EMBER, 0.9);
        else {
          var burst = (pr - 0.6) / 0.4;
          ctx.strokeStyle = rgba(EMBER, 0.8 * (1 - burst));
          ctx.beginPath(); ctx.arc(ppr[0], ppr[1], 4 + burst * 22, 0, TAU); ctx.stroke();
          glow(ctx, ppr[0], ppr[1], 16, EMBER, 0.6 * (1 - burst));
        }
        ctx.globalCompositeOperation = "source-over";

        // racks and databases, far to near
        var items = [];
        RACKS.forEach(function (rk, i) { items.push({ kind: "rack", x: rk[1], z: rk[2], h: rk[3], d: 0.15 + i * 0.05, reg: rk[0] }); });
        DB.forEach(function (db, i) { items.push({ kind: "db", x: db.x, z: db.z, d: 0.5 + i * 0.3, i: i }); });
        OPS.forEach(function (o, i) { items.push({ kind: "op", x: o[0], z: o[1], d: 0.7 + i * 0.1, i: i }); });
        items.forEach(function (it) { it.depth = cam.p(it.x, FL, it.z)[3]; });
        items.sort(function (a, b) { return b.depth - a.depth; });
        var anchor = {};
        items.forEach(function (it) {
          var k = intro(it.d);
          if (k <= 0) return;
          if (it.kind === "rack") {
            var top = block(ctx, cam, it.x - 0.08, it.x + 0.08, it.z - 0.13, it.z + 0.13, FL, it.h * k, it.reg ? ORANGE : AMBER, E.hot === 1 && it.reg === 1 ? 0.8 : 0);
            // status LEDs down the face
            var n = Math.floor(it.h * 14 * k);
            for (var j = 0; j < n; j++) {
              var lpt = cam.p(it.x - 0.06, FL - 0.03 - j * 0.07 * (1 / 1), it.z - 0.13);
              var on = Math.sin(t * (2 + j) + it.x * 30 + j) > 0.2;
              ctx.fillStyle = rgba(on ? AMBER : CREAM, on ? 0.9 : 0.15);
              ctx.fillRect(lpt[0], lpt[1], 2, 1.5);
            }
            if (it.reg === 1 && it.x === -0.68) anchor.cloud = top;
          } else if (it.kind === "db") {
            var lit = E.hot === 0 ? 1 : 0, hgt = 0.26 * k, rr = 0.1;
            var bt = cam.p(it.x, FL, it.z), tp = cam.p(it.x, FL - hgt, it.z);
            var rx = rr * E.S * bt[2], ry = rx * Math.sin(cam.pitch);
            ctx.fillStyle = rgba([18, 9, 5], 0.95);
            ctx.beginPath(); ctx.ellipse(bt[0], bt[1], rx, ry, 0, 0, Math.PI); ctx.lineTo(tp[0] - rx, tp[1]); ctx.ellipse(tp[0], tp[1], rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = rgba(AMBER, 0.35 + lit * 0.5); ctx.stroke();
            for (var bnd = 1; bnd < 3; bnd++) {
              var by = mix(bt[1], tp[1], bnd / 3);
              ctx.beginPath(); ctx.ellipse(bt[0], by, rx, ry, 0, 0, Math.PI); ctx.stroke();
            }
            ctx.fillStyle = rgba(AMBER, 0.25 + lit * 0.4);
            ctx.beginPath(); ctx.ellipse(tp[0], tp[1], rx, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
            if (it.i === 0) anchor.db = tp; else anchor.rep = tp;
          } else {
            var op = cam.p(it.x, FL - 0.06, it.z), ol = E.hot === 2;
            ctx.globalCompositeOperation = "lighter";
            glow(ctx, op[0], op[1], E.S * 0.07, ol ? AMBER : ORANGE, ol ? 1 : 0.6);
            ctx.globalCompositeOperation = "source-over";
            ctx.font = "500 " + (0.03 * E.S).toFixed(1) + "px " + MONO;
            ctx.fillStyle = rgba(CREAM, 0.55 + (ol ? 0.4 : 0));
            ctx.fillText(["@dev", "@ops", "@sre"][it.i], op[0] + 6, op[1] - 6);
            if (it.i === 1) anchor.ops = op;
          }
        });

        // links: region to region, primary to replica, edge to core
        ctx.globalCompositeOperation = "lighter";
        var arc = function (a, b, lift, col, sp, n, hot) {
          ctx.strokeStyle = rgba(col, hot ? 0.7 : 0.28); ctx.lineWidth = hot ? 1.4 : 1;
          ctx.beginPath();
          var pts = [];
          for (var s3 = 0; s3 <= 24; s3++) {
            var u = s3 / 24, pp2 = cam.p(mix(a[0], b[0], u), FL - Math.sin(u * Math.PI) * lift, mix(a[1], b[1], u));
            pts.push(pp2);
            if (s3) ctx.lineTo(pp2[0], pp2[1]); else ctx.moveTo(pp2[0], pp2[1]);
          }
          ctx.stroke();
          for (var m = 0; m < n; m++) {
            var uu = (t * sp + m / n) % 1, idx = uu * 24, i0 = Math.floor(idx), f = idx - i0, p0 = pts[i0], p1 = pts[Math.min(24, i0 + 1)];
            glow(ctx, mix(p0[0], p1[0], f), mix(p0[1], p1[1], f), hot ? 8 : 6, col, 0.85);
          }
        };
        arc([DB[0].x, DB[0].z], [DB[1].x, DB[1].z], 0.55, AMBER, E.hot === 0 ? 0.8 : 0.35, 4, E.hot === 0);
        arc([-0.3, 0.2], [0.62, 0.52], 0.3, ORANGE, 0.4, 3, E.hot === 2);
        arc([-0.2, 0.3], [-0.55, 1.2], 0.35, ORANGE, 0.3, 2, E.hot === 1);
        var ports = E.ports;
        var tgt = { db: anchor.db, cloud: anchor.cloud, ops: anchor.ops };
        ports.forEach(function (port, i) {
          var a = tgt[PORT_OBJ[i]];
          if (a) wire(ctx, a, port, t + i * 0.4, E.hot === i, i === 1 ? ORANGE : AMBER, 3);
        });
        ctx.globalCompositeOperation = "source-over";
      },
    };
  })();

  var SCENES = [dev, mobile, design, emerging, infra];
  // reduced motion: the moment each world is shown settled at
  var STILL = [7, 7.6, 7, 3.2, 6];

  /* ---- mount ----------------------------------------------------- */
  function mount(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var idx = opts.scene || 0, t0 = performance.now(), hot = -1, W = 0, H = 0, dpr = 1;
    var running = false, onScreen = false, raf = 0, bg = null;
    var ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    var nPorts = function () { return opts.ports ? opts.ports(idx) : 0; };

    var geom = function () {
      var off = opts.offsetX ? opts.offsetX() : 0;
      var S = (opts.radius || 0.31) * H;
      return { cx: W / 2 + off * H, cy: H / 2, S: S };
    };
    // the ports: where each service's pin lands (canvas CSS px)
    var anchors = function (n) {
      var g = geom(), out = [];
      for (var i = 0; i < n; i++) {
        var deg = n > 1 ? 38 - 76 * i / (n - 1) : 0, a = deg * Math.PI / 180;
        out.push([g.cx + g.S * 0.95 * Math.cos(a), g.cy - g.S * 0.95 * Math.sin(a)]);
      }
      return out;
    };

    var resize = function () {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      bg = null;
      if (!running) frame(performance.now());
    };

    var frame = function (now) {
      if (!W) return;
      var t = (now - t0) / 1000;
      if (reduced) t = STILL[idx];
      ptr.x += (ptr.tx - ptr.x) * 0.06; ptr.y += (ptr.ty - ptr.y) * 0.06;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      var g = geom();
      // the room: deep black, one warm pool of light behind the world
      if (!bg) {
        bg = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, Math.max(W, H) * 0.8);
        bg.addColorStop(0, "rgba(52,22,10,1)");
        bg.addColorStop(0.45, "rgba(16,7,4,1)");
        bg.addColorStop(1, "rgba(5,2,1,1)");
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      var E = { cx: g.cx, cy: g.cy, S: g.S, W: W, H: H, dpr: dpr, hot: hot, px: ptr.x, py: ptr.y, ports: anchors(nPorts()) };
      ctx.save();
      SCENES[idx].draw(ctx, E, t);
      ctx.restore();
      // atmosphere: the far edges fall into black
      var v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      v.addColorStop(0, "rgba(5,2,1,0)"); v.addColorStop(1, "rgba(5,2,1,0.7)");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    };

    var loop = function (now) {
      if (!running) return;
      frame(now);
      raf = requestAnimationFrame(loop);
    };
    var sync = function () {
      var want = onScreen && !document.hidden && !reduced;
      if (want && !running) { running = true; raf = requestAnimationFrame(loop); }
      else if (!want && running) { running = false; cancelAnimationFrame(raf); }
    };

    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; sync(); }, { rootMargin: "80px" }).observe(canvas);
    else onScreen = true;
    document.addEventListener("visibilitychange", sync);
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener("resize", resize);
    // the world leans a touch toward the pointer
    var host = canvas.parentNode;
    if (host && window.matchMedia("(hover: hover)").matches) {
      host.addEventListener("pointermove", function (e) {
        var r = host.getBoundingClientRect();
        ptr.tx = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1);
        ptr.ty = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
      }, { passive: true });
      host.addEventListener("pointerleave", function () { ptr.tx = ptr.ty = 0; });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!running) frame(performance.now()); });
    resize();
    sync();

    return {
      // switch world: it assembles from the start
      set: function (i) { idx = clamp(i, 0, SCENES.length - 1); t0 = performance.now(); if (!running) frame(t0); },
      hot: function (i) { hot = i; if (!running) frame(performance.now()); },
      anchors: anchors,
      radius: function () { return geom().S; },
    };
  }

  global.CodeWorlds = {
    mount: mount,
    count: SCENES.length,
    // the drawing kit, shared with the services fleet (fleet-worlds.js)
    kit: {
      TAU: TAU, MONO: MONO, DISPLAY: DISPLAY,
      C: { ember: EMBER, orange: ORANGE, amber: AMBER, cream: CREAM, violet: VIOLET, lilac: LILAC, peach: PEACH },
      SYN: SYN, SYNA: SYNA,
      rgba: rgba, clamp: clamp, mix: mix, out3: out3, io3: io3, rng: rng, cubic: cubic,
      tokenize: tokenize, codeLine: codeLine, glow: glow, camera: camera, poly: poly,
      block: block, floorGrid: floorGrid, wire: wire,
    },
  };
})(window);
