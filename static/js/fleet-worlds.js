/* ============================================================
   Worx | fleet-worlds.js
   The services page's fleet: one live computer-science world per
   division, on one 2D canvas each (the drawing kit is shared with the
   home page's code-worlds.js). Different chapters from the home page's,
   same universe:

     web       the repository: branches as lit rails running toward
               you, real commits riding them, merges folding in, and
               the CI gate every commit on main flies through
               (build, test, lint, deploy) before it ships to the edge.
     mobile    hot reload: a prop is edited in the component on the
               left; on save the change beams to an iPhone, an Android
               and a tablet, and each re-renders in place.
     uiux      the type lab: the W of Worx drawn with the pen, anchor
               by anchor, on its metric lines, then filled; its path
               data streaming beside it and a dopesheet playing below.
     arvr      attention: a sentence being generated, every head's
               weights arcing back over the tokens, the next-token
               distribution resolving; a LiDAR sweep mapping the room
               below, an anchor placed in it (the violet chapter).
     platform  the data plane: CMS, CRM and HR topics streaming events
               into the warehouse, a query answering on the far side,
               infrastructure applied in the terminal below.

   Each canvas animates only while it is on screen and the tab is
   visible; reduced motion gets one settled frame.
   ============================================================ */
(function (global) {
  "use strict";
  if (!global.CodeWorlds || !global.CodeWorlds.kit) return;
  var K = global.CodeWorlds.kit;
  var TAU = K.TAU, MONO = K.MONO, DISPLAY = K.DISPLAY;
  var EMBER = K.C.ember, ORANGE = K.C.orange, AMBER = K.C.amber, CREAM = K.C.cream, VIOLET = K.C.violet, LILAC = K.C.lilac, PEACH = K.C.peach;
  var rgba = K.rgba, clamp = K.clamp, mix = K.mix, out3 = K.out3, io3 = K.io3, glow = K.glow, poly = K.poly, camera = K.camera;

  function font(px, w, fam) { return (w || 500) + " " + Math.max(1, px).toFixed(1) + "px " + (fam || MONO); }
  function add(ctx) { ctx.globalCompositeOperation = "lighter"; }
  function norm(ctx) { ctx.globalCompositeOperation = "source-over"; }
  // a rounded rectangle in local (u, v) space, sampled, for projection
  function rrect(u0, v0, u1, v1, r, n) {
    var pts = [], k = n || 5;
    var c = [[u1 - r, v0 + r, -Math.PI / 2], [u1 - r, v1 - r, 0], [u0 + r, v1 - r, Math.PI / 2], [u0 + r, v0 + r, Math.PI]];
    c.forEach(function (q) { for (var i = 0; i <= k; i++) { var a = q[2] + i / k * Math.PI / 2; pts.push([q[0] + Math.cos(a) * r, q[1] + Math.sin(a) * r]); } });
    return pts;
  }
  function path(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  /* ================================================================
     web · the repository and its CI gate
     ================================================================ */
  var LANES = [{ x: -0.62, name: "feature/checkout", c: ORANGE }, { x: 0, name: "main", c: AMBER }, { x: 0.62, name: "fix/seo", c: LILAC }];
  // a loop of history: lane, message, merge-from lane (or -1)
  var LOG = [
    [0, "feat(checkout): apple pay", -1], [1, "perf: lazy-load hero media", -1], [2, "fix(seo): canonical tags", -1],
    [0, "test(e2e): checkout flow", -1], [1, "Merge feature/checkout", 0], [2, "fix(seo): hreflang ar/en", -1],
    [1, "feat(api): GET /orders", -1], [1, "Merge fix/seo", 2], [0, "feat(checkout): saved cards", -1],
    [1, "refactor: edge cache keys", -1], [2, "fix(seo): sitemap index", -1], [1, "chore: bump next 14.2", -1],
  ];
  var HASH = ["a3f9c1e", "7be20d4", "c41a9f0", "e8d3b72", "19fa6c3", "5c0e7a8", "d27b41f", "8a6f3e2", "f04c9d1", "3e7a2b6", "b91d5c0", "6d2e8f4"];
  var STAGES = ["build", "test", "lint", "deploy"];
  var web = {
    draw: function (ctx, E, t) {
      var yaw = -0.28 + Math.sin(t * 0.2) * 0.04 + E.px * 0.06;
      var cam = camera(E.W * 0.52, E.H * 0.3, E.S, yaw, 0.42 + E.py * 0.03, 3.2);
      var FL = 0.62, SP = 0.55, GAP = 0.5, N = LOG.length, LEN = N * GAP;
      var scroll = (t * SP) % LEN;
      var GATE = -0.62;
      K.floorGrid(ctx, cam, -1.6, 1.6, -1.2, 5.5, FL, 0.25, AMBER, 0.08);

      // the rails
      LANES.forEach(function (ln) {
        ctx.lineWidth = 1.2;
        var a = cam.p(ln.x, FL, -1.3), b = cam.p(ln.x, FL, 5.4);
        var g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
        g.addColorStop(0, rgba(ln.c, 0.65)); g.addColorStop(1, rgba(ln.c, 0));
        ctx.strokeStyle = g;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        var far = cam.p(ln.x, FL, 4.6);
        ctx.font = font(0.05 * E.S * far[2]);
        ctx.fillStyle = rgba(ln.c, 0.55);
        ctx.textAlign = "center";
        ctx.fillText(ln.name, far[0], far[1] - 8);
        ctx.textAlign = "left";
      });

      // the gate: an arch over main, its stages on the beam
      var gl = cam.p(-0.46, FL, GATE), gr = cam.p(0.46, FL, GATE), gtl = cam.p(-0.46, FL - 0.7, GATE), gtr = cam.p(0.46, FL - 0.7, GATE);
      // which main commit is passing through, and how far
      var passing = -1, pp = 0;
      var commits = [];
      for (var i = 0; i < N * 2; i++) {
        var e = LOG[i % N];
        var z = (i * GAP) - scroll - 0.9;
        if (z < -1.25 || z > 5.2) continue;
        commits.push({ e: e, z: z, i: i % N });
        if (e[0] === 1 && z > GATE - 0.5 && z < GATE + 0.45) { passing = i % N; pp = 1 - (z - (GATE - 0.5)) / 0.95; }
      }
      // merges: a curve from the branch into main
      commits.forEach(function (c) {
        if (c.e[2] < 0) return;
        var from = LANES[c.e[2]];
        ctx.strokeStyle = rgba(from.c, 0.5 * clamp(1.4 - c.z / 4, 0, 1));
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (var s = 0; s <= 16; s++) {
          var u = s / 16, x = mix(from.x, 0, io3(u)), zz = c.z + (1 - u) * 0.7;
          var q = cam.p(x, FL, zz);
          if (s) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
        }
        ctx.stroke();
      });
      // gate posts
      ctx.strokeStyle = rgba(CREAM, 0.35); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(gl[0], gl[1]); ctx.lineTo(gtl[0], gtl[1]); ctx.lineTo(gtr[0], gtr[1]); ctx.lineTo(gr[0], gr[1]); ctx.stroke();
      // the commits, far to near
      commits.sort(function (a, b) { return b.z - a.z; });
      commits.forEach(function (c) {
        var ln = LANES[c.e[0]], q = cam.p(ln.x, FL, c.z);
        var fade = clamp(1.3 - c.z / 4.4, 0, 1) * clamp((c.z + 1.25) / 0.4, 0, 1);
        var shipped = c.e[0] === 1 && c.z < GATE;
        add(ctx);
        glow(ctx, q[0], q[1], (shipped ? 16 : 11) * q[2], shipped ? AMBER : ln.c, 0.85 * fade);
        norm(ctx);
        ctx.fillStyle = rgba(CREAM, 0.95 * fade);
        ctx.beginPath(); ctx.arc(q[0], q[1], 2.4 * q[2], 0, TAU); ctx.fill();
        var fs = 0.042 * E.S * q[2];
        if (fs < 5) return;
        var side = c.e[0] === 0 ? -1 : 1;
        ctx.font = font(fs);
        ctx.textAlign = side < 0 ? "right" : "left";
        var tx = q[0] + side * 10 * q[2];
        ctx.fillStyle = rgba(AMBER, 0.75 * fade);
        ctx.fillText(HASH[c.i], tx, q[1] - fs * 0.2);
        ctx.fillStyle = rgba(CREAM, 0.62 * fade);
        ctx.fillText(c.e[1], tx, q[1] + fs * 1.05);
        ctx.textAlign = "left";
      });

      // the beam and its stages
      var bw = gtr[0] - gtl[0], fsS = Math.max(8, 0.043 * E.S * gtl[2]);
      ctx.font = font(fsS);
      STAGES.forEach(function (st, k) {
        var u = (k + 0.5) / STAGES.length, x = mix(gtl[0], gtr[0], u), y = mix(gtl[1], gtr[1], u) - fsS * 1.2;
        var lit = passing >= 0 && pp > k / STAGES.length;
        ctx.textAlign = "center";
        ctx.fillStyle = rgba(lit ? AMBER : CREAM, lit ? 1 : 0.4);
        ctx.fillText((lit ? "✓ " : "") + st, x, y);
        if (lit) { add(ctx); glow(ctx, x, mix(gtl[1], gtr[1], u), 10, AMBER, 0.8); norm(ctx); }
      });
      ctx.textAlign = "left";
      ctx.strokeStyle = rgba(passing >= 0 ? AMBER : CREAM, passing >= 0 ? 0.9 : 0.35);
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(gtl[0], gtl[1]); ctx.lineTo(gtr[0], gtr[1]); ctx.stroke();
      // the ship: a flash on the ground past the gate
      if (passing >= 0 && pp > 0.95) {
        add(ctx); glow(ctx, (gl[0] + gr[0]) / 2, gl[1], E.S * 0.5, AMBER, 0.35); norm(ctx);
      }
      ctx.font = font(0.04 * E.S);
      ctx.fillStyle = rgba(passing >= 0 && pp > 0.95 ? AMBER : CREAM, passing >= 0 && pp > 0.95 ? 0.95 : 0.45);
      ctx.fillText(passing >= 0 && pp > 0.95 ? "▲ deployed · edge · 212ms" : "$ git push origin main", E.W * 0.07, E.H * 0.92);
    },
  };

  /* ================================================================
     mobile · hot reload
     ================================================================ */
  var TONES = [["ember", EMBER], ["amber", AMBER], ["cream", CREAM]];
  var RADII = [24, 8, 999];
  var mobile = {
    draw: function (ctx, E, t) {
      var CYC = 5.2, cyc = Math.floor(t / CYC), ph = t % CYC;
      var prevI = (cyc + 2) % 3, curI = cyc % 3;
      // the edit: backspace the old value, type the new, save
      var oldV = TONES[prevI][0], newV = TONES[curI][0];
      var typed;
      if (ph < 0.5) typed = oldV;
      else if (ph < 0.5 + oldV.length * 0.07) typed = oldV.slice(0, oldV.length - Math.floor((ph - 0.5) / 0.07));
      else typed = newV.slice(0, Math.floor((ph - 0.5 - oldV.length * 0.07) / 0.1) + 1);
      var typeEnd = 0.5 + oldV.length * 0.07 + newV.length * 0.1;
      var saved = ph > typeEnd + 0.3;
      var sinceSave = ph - (typeEnd + 0.3);
      var radius = RADII[saved ? curI : prevI];
      var src = [
        "export const Launch = () => (",
        "  <Button",
        '    tone="' + typed + '"',
        "    radius={" + RADII[saved || ph > typeEnd ? curI : prevI] + "}",
        '    label="Book now"',
        "  />",
        ");",
      ];
      // the editor, flat and near
      var ex = E.W * 0.05, ey = E.H * 0.2, ew = E.W * 0.43, lh = E.S * 0.07;
      ctx.fillStyle = "rgba(18,8,5,0.92)";
      path(ctx, rrect(ex, ey, ex + ew, ey + lh * 9.6, 10));
      ctx.fill();
      ctx.strokeStyle = rgba(CREAM, 0.14); ctx.lineWidth = 1; ctx.stroke();
      ctx.font = font(E.S * 0.036);
      ctx.fillStyle = rgba(CREAM, 0.5);
      ctx.fillText("Launch.tsx" + (ph > typeEnd - 0.01 && !saved ? "  ●" : ""), ex + 14, ey + lh * 0.75);
      ctx.fillStyle = rgba(CREAM, 0.08);
      ctx.fillRect(ex, ey + lh * 1.2, ew, 1);
      var fs = E.S * 0.043, cw = fs * 0.6;
      ctx.font = font(fs);
      src.forEach(function (line, i) {
        var y = ey + lh * (2.2 + i);
        ctx.fillStyle = rgba(CREAM, 0.25);
        ctx.fillText(String(i + 1), ex + 12, y);
        K.codeLine(ctx, K.tokenize(line), ex + 34, y, fs, 1, cw);
        if (i === 2 && !saved) {
          var cx = ex + 34 + (10 + typed.length) * cw;
          ctx.fillStyle = rgba(AMBER, Math.floor(t * 3) % 2 ? 1 : 0.2);
          ctx.fillRect(cx, y - fs * 0.8, 2, fs);
        }
      });
      if (saved && sinceSave < 1.6) {
        ctx.fillStyle = rgba(AMBER, 0.9 * (1 - sinceSave / 1.6));
        ctx.font = font(E.S * 0.038);
        ctx.fillText("⚡ Fast Refresh · 38ms", ex + 14, ey + lh * 10.4);
      }

      // the devices, in a gentle arc
      var tone = TONES[saved ? curI : prevI][1];
      var DEV = [
        { x: -0.42, z: 0.3, w: 0.42, h: 0.88, r: 0.07, name: "iOS", yaw: -0.5 },
        { x: 0.18, z: 0.05, w: 0.4, h: 0.86, r: 0.04, name: "Android", yaw: -0.35 },
        { x: -0.1, z: 1.0, w: 0.76, h: 1.0, r: 0.05, name: "iPadOS", yaw: -0.45 },
      ];
      var order = [2, 0, 1];
      order.forEach(function (di, k) {
        var d = DEV[di];
        var cam = camera(E.W * 0.74, E.H * 0.5, E.S, d.yaw + Math.sin(t * 0.3 + di) * 0.03 + E.px * 0.06, 0.08 + E.py * 0.03, 3.4);
        var P = function (u, v) { return cam.p(d.x + u, v, d.z); };
        var body = rrect(-d.w / 2, -d.h / 2, d.w / 2, d.h / 2, d.r * 1.3, 4).map(function (q) { return P(q[0], q[1]); });
        path(ctx, body); ctx.fillStyle = "rgba(10,5,3,0.96)"; ctx.fill();
        ctx.strokeStyle = rgba(CREAM, 0.25); ctx.lineWidth = 1; ctx.stroke();
        var m = 0.025, sw = d.w / 2 - m, sh = d.h / 2 - m;
        var scr = rrect(-sw, -sh, sw, sh, d.r, 4).map(function (q) { return P(q[0], q[1]); });
        path(ctx, scr); ctx.fillStyle = "rgba(26,12,7,1)"; ctx.fill();
        // the rendered app
        var delay = k * 0.22, hit = saved ? clamp((sinceSave - delay) / 0.5, 0, 1) : 1;
        var tNow = saved && sinceSave > delay ? tone : TONES[prevI][1];
        var rNow = saved && sinceSave > delay ? RADII[curI] : RADII[prevI];
        var bar = function (u0, v0, u1, v1, col, a) { path(ctx, [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)]); ctx.fillStyle = rgba(col, a); ctx.fill(); };
        bar(-sw + 0.04, -sh + 0.08, -sw + 0.04 + sw * 0.9, -sh + 0.12, CREAM, 0.8);
        bar(-sw + 0.04, -sh + 0.16, -sw + 0.04 + sw * 0.6, -sh + 0.185, CREAM, 0.35);
        bar(-sw + 0.04, -sh + 0.24, sw - 0.04, -sh + 0.24 + sh * 0.7, AMBER, 0.08);
        bar(-sw + 0.04, sh * 0.35, sw - 0.04, sh * 0.35 + 0.05, CREAM, 0.14);
        bar(-sw + 0.04, sh * 0.35 + 0.08, sw * 0.4, sh * 0.35 + 0.13, CREAM, 0.1);
        // the button: its tone and radius from the props
        var bh = 0.1, bw2 = sw - 0.06, by = sh - 0.2;
        var br = Math.min(rNow / 999 * bh / 2 + (rNow === 999 ? bh / 2 : rNow / 24 * 0.03), bh / 2);
        var btn = rrect(-bw2, by - bh / 2, bw2, by + bh / 2, Math.max(0.004, br), 4).map(function (q) { return P(q[0], q[1]); });
        path(ctx, btn);
        ctx.fillStyle = rgba(tNow, 0.95); ctx.fill();
        var bc = P(0, by);
        ctx.font = font(0.03 * E.S * bc[2], 600, DISPLAY);
        ctx.textAlign = "center";
        ctx.fillStyle = tNow === CREAM ? "rgba(26,10,4,0.9)" : "rgba(26,10,4,0.85)";
        ctx.fillText("Book now", bc[0], bc[1] + 0.011 * E.S);
        ctx.textAlign = "left";
        // the re-render ripple
        if (saved && hit > 0 && hit < 1) {
          var sc = P(0, 0);
          add(ctx);
          ctx.strokeStyle = rgba(AMBER, 0.8 * (1 - hit));
          ctx.lineWidth = 2;
          path(ctx, scr); ctx.stroke();
          glow(ctx, sc[0], sc[1], E.S * 0.6 * sc[2], AMBER, 0.35 * (1 - hit));
          norm(ctx);
        }
        var lab = P(-d.w / 2, d.h / 2 + 0.07);
        ctx.font = font(0.032 * E.S * lab[2]);
        ctx.fillStyle = rgba(CREAM, 0.45);
        ctx.fillText(d.name, lab[0], lab[1]);
        d.anchor = P(-d.w / 2, 0);
        d.sc = P(0, 0);
      });
      // the beams from the editor, on save
      if (saved) {
        var s0 = [ex + ew, ey + lh * 4.2];
        add(ctx);
        DEV.forEach(function (d, k) {
          var u = clamp((sinceSave - k * 0.12) / 0.45, 0, 1);
          if (u <= 0 || u >= 1) return;
          var x = mix(s0[0], d.anchor[0], u), y = mix(s0[1], d.anchor[1], u) - Math.sin(u * Math.PI) * E.S * 0.12;
          ctx.strokeStyle = rgba(AMBER, 0.5 * (1 - u));
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.quadraticCurveTo((s0[0] + d.anchor[0]) / 2, Math.min(s0[1], d.anchor[1]) - E.S * 0.24, x, y); ctx.stroke();
          glow(ctx, x, y, 12, AMBER, 1);
        });
        norm(ctx);
      }
      void radius;
    },
  };

  /* ================================================================
     uiux · the type lab
     ================================================================ */
  // the W, as anchors and handles in em units (0..1 wide, 0 = baseline, -0.7 = cap)
  var W_PTS = [
    [[0.0, -0.7], null, [0.06, -0.45]],
    [[0.22, 0.0], [0.18, -0.12], [0.26, -0.12]],
    [[0.5, -0.52], [0.44, -0.3], [0.56, -0.3]],
    [[0.78, 0.0], [0.74, -0.12], [0.82, -0.12]],
    [[1.0, -0.7], [0.94, -0.45], null],
  ];
  var uiux = {
    draw: function (ctx, E, t) {
      var CYC = 9, ph = t % CYC;
      var yaw = 0.22 + Math.sin(t * 0.2) * 0.04 + E.px * 0.06;
      var cam = camera(E.W * 0.5, E.H * 0.4, E.S, yaw, 0.12 + E.py * 0.03, 3.4);
      var EM = 0.82, OX = -0.98, BY = 0.3;   // glyph size, left, baseline
      var P = function (u, v, z) { return cam.p(OX + u * EM, BY + v * EM, z || 0); };
      // metric lines
      var METRICS = [["ascender", -0.78], ["cap height", -0.7], ["x-height", -0.5], ["baseline", 0], ["descender", 0.2]];
      ctx.lineWidth = 1;
      METRICS.forEach(function (m, i) {
        var a = P(-0.12, m[1]), b = P(1.95, m[1]);
        ctx.strokeStyle = rgba(m[0] === "baseline" ? AMBER : LILAC, m[0] === "baseline" ? 0.5 : 0.2);
        if (m[0] !== "baseline") ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = font(0.03 * E.S * a[2]);
        ctx.fillStyle = rgba(m[0] === "baseline" ? AMBER : LILAC, 0.6);
        ctx.fillText(m[0], a[0], a[1] - 4);
      });
      // the pen: the path drawn segment by segment, then filled
      var segs = W_PTS.length - 1, draw = clamp((ph - 0.3) / 3.2, 0, 1), fill = io3((ph - 3.8) / 1.2) * (1 - io3((ph - (CYC - 0.8)) / 0.7));
      var bez = function (a, b, u) {
        var p0 = a[0], p1 = a[2] || a[0], p2 = b[1] || b[0], p3 = b[0], v = 1 - u;
        return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]];
      };
      // a stroke weight: the W is a thick outline, so offset the path both ways
      var outline = function (upto) {
        var pts = [];
        for (var s = 0; s < segs; s++) for (var i = 0; i <= 14; i++) {
          var g = (s + i / 14) / segs;
          if (g > upto) break;
          pts.push(bez(W_PTS[s], W_PTS[s + 1], i / 14));
        }
        return pts;
      };
      var line = outline(draw);
      if (fill > 0.01) {
        // the filled glyph: the centreline stroked thick in the brand gradient
        var all = outline(1).map(function (q) { return P(q[0], q[1]); });
        var g = ctx.createLinearGradient(all[0][0], all[0][1], all[all.length - 1][0], all[all.length - 1][1]);
        g.addColorStop(0, rgba(EMBER, fill)); g.addColorStop(0.55, rgba(ORANGE, fill)); g.addColorStop(1, rgba(AMBER, fill));
        ctx.strokeStyle = g;
        ctx.lineWidth = 0.13 * EM * E.S * all[0][2];
        ctx.lineJoin = "miter"; ctx.lineCap = "butt"; ctx.miterLimit = 3;
        ctx.beginPath(); all.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.stroke();
        ctx.lineJoin = "round"; ctx.lineCap = "butt";
        // "orx", set beside it on the baseline
        var o = P(1.06, 0);
        ctx.font = font(0.66 * EM * E.S * o[2], 600, DISPLAY);
        ctx.fillStyle = rgba(CREAM, fill * 0.95);
        ctx.fillText("orx", o[0], o[1]);
      }
      if (line.length > 1) {
        ctx.strokeStyle = rgba(CREAM, 0.9); ctx.lineWidth = 1.4;
        ctx.beginPath(); line.forEach(function (q, i) { var p = P(q[0], q[1], -0.01); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke();
      }
      // anchors and handles, as the pen reaches them
      W_PTS.forEach(function (a, i) {
        if (i / segs > draw + 0.001) return;
        var ap = P(a[0][0], a[0][1], -0.01);
        [a[1], a[2]].forEach(function (h) {
          if (!h) return;
          var hp = P(h[0], h[1], -0.01);
          ctx.strokeStyle = rgba(LILAC, 0.7); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(ap[0], ap[1]); ctx.lineTo(hp[0], hp[1]); ctx.stroke();
          ctx.fillStyle = rgba(LILAC, 1);
          ctx.beginPath(); ctx.arc(hp[0], hp[1], 2.6, 0, TAU); ctx.fill();
        });
        ctx.fillStyle = rgba(CREAM, 1);
        ctx.fillRect(ap[0] - 3, ap[1] - 3, 6, 6);
        ctx.strokeStyle = rgba(AMBER, 0.9); ctx.strokeRect(ap[0] - 3, ap[1] - 3, 6, 6);
      });
      // the pen tip
      if (draw > 0 && draw < 1 && line.length) {
        var tip = line[line.length - 1], tp = P(tip[0], tip[1], -0.01);
        add(ctx); glow(ctx, tp[0], tp[1], 14, AMBER, 1); norm(ctx);
      }
      // the path data, streaming out on the right
      var d = "M0 -700 C60 -450 180 -120 220 0 C260 -120 440 -300 500 -520 C560 -300 740 -120 780 0 C820 -120 940 -450 1000 -700";
      var shown = Math.floor(d.length * draw);
      var px0 = E.W * 0.08, py0 = E.H * 0.1, fsD = E.S * 0.034;
      ctx.font = font(fsD);
      var chunk = ('<path d="' + d.slice(0, shown) + (draw >= 1 ? '" />' : "")).split(" C"), yy = py0;
      chunk.forEach(function (c, i) {
        ctx.fillStyle = rgba(i ? AMBER : PEACH, i ? 0.7 : 0.55);
        ctx.fillText((i ? "  C" : "") + c, px0 + (i ? 0 : 0), yy); yy += fsD * 1.45;
      });

      // the dopesheet below: three tracks, keyframes, a playhead
      var dx = E.W * 0.08, dy = E.H * 0.8, dw = E.W * 0.84, rowH = E.S * 0.07;
      var tracks = ["opacity", "translateY", "scale"], keys = [[0, 0.35, 0.7], [0.1, 0.45, 0.9], [0.2, 0.55, 0.8]];
      var head = (t * 0.14) % 1;
      ctx.font = font(E.S * 0.03);
      tracks.forEach(function (tr, i) {
        var y = dy + i * rowH;
        ctx.fillStyle = rgba(CREAM, 0.4);
        ctx.fillText(tr, dx, y + 4);
        ctx.fillStyle = rgba(CREAM, 0.07);
        ctx.fillRect(dx + dw * 0.18, y, dw * 0.82, 1);
        keys[i].forEach(function (k) {
          var kx = dx + dw * (0.18 + 0.82 * k), lit = Math.abs(head - k) < 0.04;
          ctx.save(); ctx.translate(kx, y); ctx.rotate(Math.PI / 4);
          ctx.fillStyle = rgba(lit ? AMBER : LILAC, lit ? 1 : 0.7);
          ctx.fillRect(-3.5, -3.5, 7, 7);
          ctx.restore();
        });
      });
      var hx = dx + dw * (0.18 + 0.82 * head);
      ctx.strokeStyle = rgba(AMBER, 0.9); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx, dy - rowH * 0.6); ctx.lineTo(hx, dy + rowH * 2.4); ctx.stroke();
      add(ctx); glow(ctx, hx, dy - rowH * 0.6, 8, AMBER, 0.9); norm(ctx);
    },
  };

  /* ================================================================
     arvr · attention, and the room mapped
     ================================================================ */
  // the model, asked why Worx: its answer written token by token, and
  // for each next token the distribution it chose from
  var SENT = ["Why", "Worx?", "One", "crew", "designs,", "builds", "and", "ships", "it", "all."];
  var CAND = [["One", "A", "Our", "Every"], ["crew", "team", "studio", "vision"], ["designs,", "plans,", "owns", "builds"], ["builds", "codes", "tests", "writes"], ["and", "then", "&", "plus"], ["ships", "scales", "runs", "hosts"], ["it", "your", "every", "the"], ["all.", "end-to-end.", "right.", "fast."]];
  var arvr = (function () {
    var r = K.rng(5), W8 = [];
    for (var i = 0; i < 40; i++) W8.push(r());
    return {
      draw: function (ctx, E, t) {
        var STEP = 1.25, n = 2 + Math.floor(t / STEP) % (SENT.length - 1), f = (t % STEP) / STEP;
        // the tokens, on a shallow arc
        var cx = E.W * 0.5, cy = E.H * 0.34, R = E.W * 0.9;
        var fs = E.S * 0.058;
        ctx.font = font(fs, 500);
        var widths = SENT.map(function (w) { return ctx.measureText(w).width + fs * 0.9; });
        var total = 0; for (var i = 0; i < n; i++) total += widths[i];
        var x = cx - total / 2, pos = [];
        for (var j = 0; j < n; j++) {
          var mx = x + widths[j] / 2, a = (mx - cx) / R;
          pos.push([cx + Math.sin(a) * R, cy + (1 - Math.cos(a)) * R * 0.6 + Math.sin(t * 0.8 + j) * 1.5]);
          x += widths[j];
        }
        // attention: from the newest token back over the rest, per head
        var last = pos[n - 1];
        add(ctx);
        for (var h = 0; h < 3; h++) {
          var col = [LILAC, AMBER, VIOLET][h];
          for (var k = 0; k < n - 1; k++) {
            var w = W8[(h * 13 + k * 7 + n) % W8.length];
            w = w * w;
            var p = pos[k], lift = (last[0] - p[0]) * 0.35 + h * fs * 0.6;
            ctx.strokeStyle = rgba(col, (0.12 + w * 0.7) * clamp(f * 3, 0, 1));
            ctx.lineWidth = 0.6 + w * 3;
            ctx.beginPath(); ctx.moveTo(last[0], last[1] - fs * 0.9); ctx.quadraticCurveTo((last[0] + p[0]) / 2, p[1] - fs - lift, p[0], p[1] - fs * 0.9); ctx.stroke();
          }
        }
        norm(ctx);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (var q = 0; q < n; q++) {
          var nw = q === n - 1;
          ctx.fillStyle = nw ? rgba(AMBER, 1) : rgba(CREAM, 0.82);
          ctx.fillText(SENT[q], pos[q][0], pos[q][1] - (nw ? (1 - out3(f * 2)) * fs : 0));
          if (nw) { add(ctx); glow(ctx, pos[q][0], pos[q][1], fs * 1.6, AMBER, 0.35); norm(ctx); }
        }
        // the next token's distribution
        var cand = CAND[n - 2];
        var bx = E.W * 0.3, by = E.H * 0.5, bw = E.W * 0.4, bh = E.S * 0.05;
        var probs = [0.71, 0.14, 0.09, 0.06];
        ctx.textAlign = "left";
        ctx.font = font(E.S * 0.034);
        ctx.fillStyle = rgba(CREAM, 0.4);
        ctx.fillText('> ask("why choose worx?")', bx, E.H * 0.13);
        ctx.fillText(cand ? "p(next | context)" : "", bx, by - bh * 0.9);
        if (!cand) { ctx.fillStyle = rgba(AMBER, 0.9); ctx.fillText("\u2713 answer complete \u00B7 10 tokens", bx, by); }
        (cand || []).forEach(function (c, i) {
          var y = by + i * bh * 1.25, grow = out3(f * 2.2 - i * 0.1) * probs[i];
          ctx.fillStyle = rgba(i ? LILAC : AMBER, i ? 0.35 : 0.85);
          ctx.fillRect(bx + E.S * 0.3, y - bh * 0.3, bw * grow, bh * 0.6);
          ctx.fillStyle = rgba(i ? CREAM : AMBER, i ? 0.55 : 1);
          ctx.fillText(c, bx, y);
          ctx.fillStyle = rgba(CREAM, 0.4);
          ctx.textAlign = "right";
          ctx.fillText(probs[i].toFixed(2), bx + E.S * 0.3 + bw + E.S * 0.14, y);
          ctx.textAlign = "left";
        });
        ctx.textBaseline = "alphabetic";

        // the room, mapped: a LiDAR sweep over a point grid
        var cam = camera(E.W * 0.5, E.H * 0.8, E.S, 0.3 + Math.sin(t * 0.15) * 0.08 + E.px * 0.08, 0.5 + E.py * 0.04, 3);
        var sweep = (t * 0.35) % 1;
        add(ctx);
        for (var gx = -12; gx <= 12; gx++) for (var gz = 0; gz <= 9; gz++) {
          var X = gx * 0.11, Z = gz * 0.11 - 0.2;
          var hgt = Math.max(0, Math.sin(gx * 0.7) * Math.cos(gz * 0.9)) * 0.18 + (Math.abs(gx) > 9 ? 0.3 * (Math.abs(gx) - 9) / 3 : 0);
          var pp = cam.p(X, 0.12 - hgt, Z);
          var dz = gz / 9, lit = Math.max(0, 1 - Math.abs(dz - sweep) * 7);
          var seen = dz < sweep ? 0.55 : 0.12;
          ctx.fillStyle = rgba(lit > 0.1 ? AMBER : LILAC, clamp(seen + lit, 0, 1) * clamp(pp[2], 0.3, 1));
          var sz = 1.4 + lit * 1.6;
          ctx.fillRect(pp[0] - sz / 2, pp[1] - sz / 2, sz, sz);
        }
        // the anchor, placed once the sweep has passed it
        var an = cam.p(0.2, 0.12, 0.45);
        var placed = sweep > 0.7;
        ctx.strokeStyle = rgba(placed ? AMBER : LILAC, placed ? 0.95 : 0.4);
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(an[0], an[1], E.S * 0.12, E.S * 0.05, 0, 0, TAU); ctx.stroke();
        if (placed) {
          glow(ctx, an[0], an[1] - E.S * 0.08, E.S * 0.12, VIOLET, 0.6);
          ctx.beginPath(); ctx.moveTo(an[0], an[1]); ctx.lineTo(an[0], an[1] - E.S * 0.16); ctx.stroke();
        }
        norm(ctx);
        if (placed) {
          ctx.font = font(E.S * 0.03);
          ctx.fillStyle = rgba(AMBER, 0.85);
          ctx.fillText("anchor · 0.02m", an[0] + E.S * 0.14, an[1] - E.S * 0.12);
        }
      },
    };
  })();

  /* ================================================================
     platform · the data plane
     ================================================================ */
  var TOPICS = [
    { name: "cms.pages", rec: ['{"page":"/offers",', '"status":"live"}'] },
    { name: "crm.deals", rec: ['{"deal":"D-77",', '"stage":"won"}'] },
    { name: "hr.payroll", rec: ['{"emp":219,', '"net":"AED"}'] },
  ];
  var TERM = ["$ terraform apply -auto-approve", "  + aws_rds_cluster.dwh", "  + aws_kinesis_stream.events", "Apply complete! 12 added, 0 changed.", "$ kubectl rollout status deploy/api", "deployment \"api\" successfully rolled out"];
  var platform = {
    draw: function (ctx, E, t) {
      var cam = camera(E.W * 0.47, E.H * 0.43, E.S, -0.3 + Math.sin(t * 0.17) * 0.04 + E.px * 0.06, 0.35 + E.py * 0.03, 3.6);
      var FL = 0.4;
      K.floorGrid(ctx, cam, -1.7, 1.7, -0.6, 1.6, FL, 0.2, ORANGE, 0.07);
      // the warehouse: stacked discs, right of centre
      var WX = 0.85, WZ = 0.4;
      var wb = cam.p(WX, FL, WZ), wr = 0.26 * E.S * wb[2], wry = wr * Math.sin(0.35);
      for (var d = 0; d < 4; d++) {
        var y = wb[1] - d * E.S * 0.12 * wb[2];
        ctx.fillStyle = "rgba(18,8,5,0.95)";
        ctx.beginPath(); ctx.ellipse(wb[0], y, wr, wry, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba(AMBER, 0.35 + (d === 3 ? 0.3 : 0)); ctx.lineWidth = 1; ctx.stroke();
      }
      var top = [wb[0], wb[1] - 3 * E.S * 0.12 * wb[2]];
      ctx.fillStyle = rgba(AMBER, 0.2);
      ctx.beginPath(); ctx.ellipse(top[0], top[1], wr, wry, 0, 0, TAU); ctx.fill();
      add(ctx); glow(ctx, top[0], top[1], wr * 1.4, ORANGE, 0.3); norm(ctx);
      // the encryption ring
      ctx.setLineDash([2, 5]);
      ctx.strokeStyle = rgba(LILAC, 0.45);
      ctx.beginPath(); ctx.ellipse(wb[0], wb[1] - E.S * 0.18 * wb[2], wr * 1.55, wry * 1.9, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = font(E.S * 0.03);
      ctx.fillStyle = rgba(LILAC, 0.6);
      ctx.fillText("tls 1.3 · aes-256", wb[0] - wr * 1.5, wb[1] + wry * 2.6);

      // the topics: lanes from the left into the warehouse
      TOPICS.forEach(function (tp, i) {
        var z = -0.25 + i * 0.35, x0 = -1.12;
        var a = cam.p(x0, FL, z), b = cam.p(WX - 0.3, FL - 0.06, WZ + (i - 1) * 0.06);
        ctx.strokeStyle = rgba(AMBER, 0.28); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(mix(a[0], b[0], 0.6), a[1], b[0], b[1]); ctx.stroke();
        ctx.font = font(E.S * 0.036 * a[2]);
        ctx.fillStyle = rgba(CREAM, 0.6);
        ctx.fillText(tp.name, a[0] - 4, a[1] - 8);
        // events riding the lane
        for (var k = 0; k < 3; k++) {
          var u = (t * 0.22 + k / 3 + i * 0.13) % 1, v = 1 - u;
          var qx = v * v * a[0] + 2 * v * u * mix(a[0], b[0], 0.6) + u * u * b[0];
          var qy = v * v * a[1] + 2 * v * u * a[1] + u * u * b[1];
          var fade = Math.sin(u * Math.PI);
          add(ctx); glow(ctx, qx, qy, 10, AMBER, 0.9 * fade); norm(ctx);
          if (k === 0) {
            ctx.font = font(E.S * 0.028);
            ctx.fillStyle = rgba(PEACH, 0.75 * fade);
            ctx.fillText(tp.rec[0], qx + 8, qy - 6);
            ctx.fillText(tp.rec[1], qx + 8, qy + E.S * 0.03);
          }
        }
      });

      // the query and its answer, on the far side
      var QX = E.W * 0.58, QY = E.H * 0.1, fq = E.S * 0.034;
      ctx.font = font(fq);
      K.codeLine(ctx, K.tokenize("SELECT region, SUM(total)"), QX, QY, fq, 0.9, fq * 0.6);
      K.codeLine(ctx, K.tokenize("FROM invoices GROUP BY region;"), QX, QY + fq * 1.5, fq, 0.9, fq * 0.6);
      var ROWS = [["UAE", "AED 1.24M", 1], ["KSA", "AED 0.84M", 0.68], ["EU", "AED 0.61M", 0.49]];
      var qph = (t % 6) / 6;
      ROWS.forEach(function (rw, i) {
        var on = clamp((qph - 0.15 - i * 0.12) / 0.15, 0, 1);
        var y = QY + fq * (3.4 + i * 1.6);
        ctx.fillStyle = rgba(CREAM, 0.6 * on); ctx.fillText(rw[0], QX, y);
        ctx.fillStyle = rgba(AMBER, 0.95 * on); ctx.fillText(rw[1], QX + fq * 4, y);
        ctx.fillStyle = rgba(AMBER, 0.35 * on); ctx.fillRect(QX + fq * 13, y - fq * 0.55, fq * 5 * rw[2] * on, fq * 0.5);
      });
      ctx.fillStyle = rgba(CREAM, 0.3 * clamp((qph - 0.55) / 0.1, 0, 1));
      ctx.fillText("3 rows · 41ms", QX, QY + fq * 8.4);

      // the terminal, below
      var tx = E.W * 0.06, ty = E.H * 0.8, ft = E.S * 0.032;
      ctx.fillStyle = "rgba(14,6,4,0.9)";
      path(ctx, rrect(tx - 10, ty - ft * 1.6, E.W * 0.94, ty + ft * 3.6, 8));
      ctx.fill(); ctx.strokeStyle = rgba(CREAM, 0.1); ctx.stroke();
      ctx.font = font(ft);
      var line = Math.floor(t / 0.9) % TERM.length;
      for (var i = 0; i < 3; i++) {
        var li = (line + i) % TERM.length, s = TERM[li];
        var tn = i === 2 ? s.slice(0, Math.floor(((t / 0.9) % 1) * s.length * 1.4)) : s;
        ctx.fillStyle = rgba(s.charAt(0) === "$" ? CREAM : s.indexOf("complete") >= 0 || s.indexOf("success") >= 0 ? AMBER : PEACH, i === 2 ? 0.95 : 0.45 + i * 0.15);
        ctx.fillText(tn, tx, ty + i * ft * 1.5);
      }
    },
  };

  var SCENES = { web: web, mobile: mobile, uiux: uiux, arvr: arvr, platform: platform };
  var STILL = { web: 3.1, mobile: 4.6, uiux: 5.2, arvr: 5.1, platform: 3.6 };

  function mount(canvas, key) {
    var scene = SCENES[key];
    if (!scene) return null;
    var ctx = canvas.getContext("2d");
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var W = 0, H = 0, dpr = 1, t0 = performance.now(), running = false, onScreen = false, raf = 0, clock = 0, last = 0;
    var ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    var resize = function () {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, (window.innerWidth < 768 ? 1.25 : 1.75));   // phones: lighter canvases
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      if (!running) frame(performance.now());
    };
    var frame = function (now) {
      if (!W) return;
      // the scene's own clock only runs while it's shown: it picks up
      // where it left off rather than jumping
      if (running && last) clock += Math.min(now - last, 64) / 1000;
      last = running ? now : 0;
      var t = reduced ? STILL[key] : clock;
      ptr.x += (ptr.tx - ptr.x) * 0.06; ptr.y += (ptr.ty - ptr.y) * 0.06;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1; norm(ctx);
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      scene.draw(ctx, { W: W, H: H, S: Math.min(W, H) * 0.5, dpr: dpr, px: ptr.x, py: ptr.y }, t);
      ctx.restore();
    };
    var loop = function (now) { if (!running) return; frame(now); raf = requestAnimationFrame(loop); };
    var sync = function () {
      var want = onScreen && !document.hidden && !reduced;
      if (want && !running) { running = true; last = 0; raf = requestAnimationFrame(loop); }
      else if (!want && running) { running = false; cancelAnimationFrame(raf); }
    };
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; sync(); }).observe(canvas);
    else onScreen = true;
    document.addEventListener("visibilitychange", sync);
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener("resize", resize);
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
    void t0;
    return { redraw: function () { if (!running) frame(performance.now()); } };
  }

  function boot() {
    [].forEach.call(document.querySelectorAll("canvas[data-fleet-world]"), function (c) {
      if (!c.__fw) c.__fw = mount(c, c.getAttribute("data-fleet-world"));
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  global.FleetWorlds = { mount: mount, boot: boot };
})(window);
