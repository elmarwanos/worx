/* ============================================================
   Worx | crams.js
   The CRAMS film (crams/index.html, styles in crams.css).

   Where the page has the dashboard deck ([data-cr-deck], crams-deck.js)
   the deck plays the story and only the cosmos and the dust below are
   drawn here; the atom is the fallback for a page without it.

   THE SYSTEM: one canvas behind the page, drawn as an atom. CRAMS is
   the nucleus (a cluster of nucleons with a pulsar's beams sweeping out
   of it); the departments are electrons on three crossed shells; leads
   are particles; a quantum field of dust fills the dark and streaks
   with the speed of the scroll. The page's chapters each set how the
   system looks, and scrolling blends from one to the next, so the
   story plays out behind the words:
     ignition   the nucleus lit, the shells turning, leads streaming in
                and being handed on
     gap        fission: the nucleus splits, the electrons fly off their
                shells, leads fall between them (the lost glow ember red)
     connected  fusion: the nucleus reforms, the electrons snap back onto
                their shells, lines of light to each, every lead delivered
     lifecycle  the system to one side, the owner of each stage lit
     truth ...  the system settling behind, then a last full blaze
                under the launch
   Pointing at a department card lights its world.

   THE LIFECYCLE: seven stops; the one nearest the middle of the view
   is the lead's current stage, and the ticket (an illustration, not
   the product's own screens) updates to it.

   THE FORGE: the wordmark is made of leads. Signals stream in from the
   edges and settle into the letters, then the letters take over.

   QUANTUM TRANSITIONS: no cuts between chapters. Each chapter's
   content materializes out of a blur as it scrolls in and dissolves as
   it scrolls out, and every change of chapter throws a burst of
   particles out of the nucleus.

   THE HUD: fixed over the film; the chapter and its timecode, the
   chapter strip and the signal.

   Reduced motion or no GSAP: one still frame of the connected system,
   everything readable, nothing moves.
   ============================================================ */
(function () {
  "use strict";

  var main = document.querySelector("[data-cr]");
  if (!main) return;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var mix = function (a, b, k) { return a + (b - a) * k; };
  var ease = function (x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

  // the wordmark and promise arrive once the page is up (after the forge
  // has made the letters, when it runs: see "the forge")
  var light = function () { main.classList.add("is-lit"); };
  var ready = function (fn) {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(fn, 120); });
    else setTimeout(fn, 300);
  };

  // the mission clock
  var clockEl = $("[data-cr-clock]"), t0 = Date.now();
  if (clockEl && !reduced) setInterval(function () {
    var ms = Date.now() - t0, s = Math.floor(ms / 1000), p = function (n) { return (n < 10 ? "0" : "") + n; };
    clockEl.textContent = p(Math.floor(s / 3600)) + ":" + p(Math.floor(s / 60) % 60) + ":" + p(s % 60) + ":" + p(Math.floor((ms % 1000) / 1000 * 24));
  }, 1000 / 24);

  /* ---------------------------------------------------------------
     THE SYSTEM
     --------------------------------------------------------------- */
  var cvs = $("[data-cr-system]");
  var ATOM = !document.querySelector("[data-cr-deck]");
  var ctx = cvs && cvs.getContext ? cvs.getContext("2d") : null;
  var W = 0, H = 0, dpr = 1;

  var DEPTS = [
    { name: "SALES", c: [250, 167, 25] },
    { name: "MARKETING", c: [229, 125, 35] },
    { name: "SERVICE", c: [254, 238, 207] },
    { name: "OPERATIONS", c: [192, 69, 39] },
    { name: "MANAGEMENT", c: [255, 208, 138] },
    { name: "EVERY TEAM", c: [217, 168, 120] }
  ];
  // each world: its place in orbit, and where it drifts to when the
  // system falls apart (the gap)
  var worlds = DEPTS.map(function (d, i) {
    return {
      d: d, i: i,
      // two electrons per shell, opposite each other
      shell: i % 3,
      a: (i % 3) * 1.1 + (i >= 3 ? Math.PI : 0),
      r: [0.8, 1.0, 0.9][i % 3],
      sz: 7 + (i % 3) * 1.6,
      driftA: (i / DEPTS.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.9,
      driftR: 1.15 + Math.random() * 0.4,
      ph: Math.random() * 6.28,
      x: 0, y: 0, hot: 0
    };
  });
  var hotDept = -1;
  // the three shells, crossed like an atom's
  var SHELLS = [-0.52, 0.52, 1.5708];

  // the nucleus: nucleons packed in a ball, turning (protons amber,
  // neutrons cream); in fission they fly apart
  var nucleons = [];
  for (var ni = 0; ni < 15; ni++) {
    var u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, rr = 0.35 + Math.random() * 0.65;
    var sq = Math.sqrt(1 - u * u);
    nucleons.push({ x: sq * Math.cos(th) * rr, y: u * rr, z: sq * Math.sin(th) * rr, p: ni % 2 === 0, ph: Math.random() * 6.28, fx: Math.random() * 2 - 1, fy: Math.random() * 2 - 1 });
  }

  // the quantum field: dust at three depths, drifting with the scroll
  var field = [];
  for (var fi = 0; fi < 150; fi++) field.push({ x: Math.random(), y: Math.random(), z: 0.25 + Math.random() * 0.75, ph: Math.random() * 6.28 });
  // particle pairs flashing in and out of the field, and bursts from the nucleus
  var pairs = [], sparks = [];
  var scrollV = 0, lastSY = window.scrollY;

  // how the system looks in each chapter
  //   cx, cy: its centre (share of the view); sc: its size; spread: 0 in
  //   orbit .. 1 adrift; core: the star; links: the lines of light;
  //   lost: leads falling between; flow: leads delivered; dim: all of it;
  //   tilt: how flat the orbit is seen; labels: the departments' names;
  //   atom: 0 all shells in one plane .. 1 crossed; beam: the pulsar's beams;
  //   neb: how bright the nebula behind burns
  var KEYS = {
    ignition:  { cx: 0.68, cy: 0.5,  sc: 0.5,  spread: 0.06, core: 0.85, links: 0.25, lost: 0,   flow: 1,   dim: 0.7,  tilt: 0.34, labels: 0, atom: 1,   beam: 0.6, neb: 0.95 },
    gap:       { cx: 0.7,  cy: 0.5,  sc: 0.34, spread: 1,    core: 0.06, links: 0,    lost: 1,   flow: 0,   dim: 0.95, tilt: 0.5,  labels: 1, atom: 0.5, beam: 0, neb: 0.8 },
    connected: { cx: 0.7,  cy: 0.44, sc: 0.3,  spread: 0,    core: 1,    links: 1,    lost: 0,   flow: 1,   dim: 1,    tilt: 0.42, labels: 1, atom: 1,   beam: 1, neb: 0.9 },
    lifecycle: { cx: 0.8,  cy: 0.5,  sc: 0.2,  spread: 0,    core: 0.7,  links: 0.6,  lost: 0,   flow: 0.5, dim: 0.35, tilt: 0.4,  labels: 0.6, atom: 0.9, beam: 0.35, neb: 0.55 },
    truth:     { cx: 0.5,  cy: 0.5,  sc: 0.48, spread: 0,    core: 0.55, links: 0.45, lost: 0,   flow: 0.6, dim: 0.4,  tilt: 0.3,  labels: 0, atom: 1,   beam: 0.5, neb: 0.7 },
    crew:      { cx: 0.5,  cy: 0.5,  sc: 0.58, spread: 0,    core: 0.4,  links: 0.3,  lost: 0,   flow: 0.4, dim: 0.28, tilt: 0.28, labels: 0, atom: 1,   beam: 0.3, neb: 0.55 },
    launch:    { cx: 0.5,  cy: 0.66, sc: 0.78, spread: 0,    core: 0.5,  links: 0.4,  lost: 0,   flow: 1,   dim: 0.7,  tilt: 0.3,  labels: 0, atom: 1,   beam: 1, neb: 1 }
  };
  var chapters = $$("[data-cr-chapter]").map(function (el) { var n = el.getAttribute("data-cr-chapter"); return { el: el, n: n, k: KEYS[n] || KEYS.connected }; });
  var nowChapter = "ignition", rings = [];
  var S = {}; Object.keys(KEYS.connected).forEach(function (k) { S[k] = KEYS.ignition[k]; });
  if (reduced) Object.keys(KEYS.connected).forEach(function (k) { S[k] = KEYS.connected[k]; });

  // the chapter the view is in, blended into the next as it passes
  var target = function () {
    var mid = window.innerHeight * 0.5, i = 0;
    for (var j = 0; j < chapters.length; j++) if (chapters[j].el.getBoundingClientRect().top <= mid) i = j;
    var a = chapters[i], b = chapters[Math.min(i + 1, chapters.length - 1)];
    // arriving at connected or the launch: the core sends out a shockwave
    if (a.n !== nowChapter) {
      if ((a.n === "connected" || a.n === "launch") && !reduced) rings.push({ r: 0, a: 1 }, { r: -0.18, a: 0.7 });
      // every change of chapter: a burst of particles out of the nucleus
      if (!reduced) for (var bi = 0; bi < 46; bi++) {
        var ba = Math.random() * Math.PI * 2, bs = 0.15 + Math.random() * 0.55;
        sparks.push({ x: coreX, y: coreY, vx: Math.cos(ba) * bs, vy: Math.sin(ba) * bs * 0.8, life: 1, hot: Math.random() < 0.3 });
      }
      nowChapter = a.n;
    }
    var r = a.el.getBoundingClientRect();
    // a chapter holds its look until well into it, then blends on
    var f = b === a ? 0 : ease(((mid - r.top) / Math.max(1, r.height) - 0.55) / 0.45);
    var out = {};
    Object.keys(a.k).forEach(function (k) { out[k] = mix(a.k[k], b.k[k], f); });
    return out;
  };

  // leads: signals from the edge of the view. Delivered ones fall into
  // the core and are handed on to a world; lost ones head for a world,
  // miss, and fall away into the dark
  var leads = [], spawnAcc = 0, lostAcc = 0;
  var edgePoint = function () {
    var side = Math.random() * 4 | 0;
    return side === 0 ? [Math.random() * W, -20] : side === 1 ? [W + 20, Math.random() * H] : side === 2 ? [Math.random() * W, H + 20] : [-20, Math.random() * H];
  };
  var spawn = function (lost) {
    var p = edgePoint();
    leads.push({ x: p[0], y: p[1], sx: p[0], sy: p[1], t: 0, sp: 0.35 + Math.random() * 0.3, stage: 0, w: (Math.random() * worlds.length) | 0, lost: lost, vx: 0, vy: 0, life: 1, trail: [] });
  };

  var coreX = 0, coreY = 0, R = 0;

  /* ---------------------------------------------------------------
     THE COSMOS: the site's sky behind the system. An ember nebula,
     painted once off screen (soft puffs of ember, orange and cocoa,
     dark lanes cut through them) and a starfield at three depths, the
     nearest drifting fastest as the page scrolls. The nebula runs hot
     (a red layer over it) while the system is in fission.
     --------------------------------------------------------------- */
  var cos = $("[data-cr-cosmos]"), cctx = cos && cos.getContext ? cos.getContext("2d") : null;
  var neb = null, nebHot = null, stars = [];
  var rnd = function (a2, b2) { return a2 + Math.random() * (b2 - a2); };
  var paintNebula = function (w, hh, hot) {
    var cv = document.createElement("canvas"); cv.width = w; cv.height = hh;
    var g = cv.getContext("2d");
    var cols = hot ? [[229, 72, 60], [192, 69, 39], [250, 110, 40]] : [[192, 69, 39], [229, 125, 35], [250, 167, 25], [120, 42, 18], [66, 29, 15]];
    // clouds hug the edges, as on the home page, leaving the middle clear
    var clouds = hot ? [[0.78, 0.3, 0.3], [0.2, 0.75, 0.28], [0.5, 0.5, 0.22]]
      : [[0.02, 0.22, 0.34], [0.98, 0.12, 0.3], [0.95, 0.62, 0.34], [0.06, 0.8, 0.3], [0.55, 1.0, 0.3], [0.6, 0.02, 0.22]];
    g.globalCompositeOperation = "lighter";
    clouds.forEach(function (cl) {
      for (var k = 0; k < 70; k++) {
        var x = (cl[0] + rnd(-1, 1) * cl[2] * 0.8) * w, y = (cl[1] + rnd(-1, 1) * cl[2] * 0.9) * hh;
        var r = rnd(0.04, 0.2) * Math.max(w, hh), col = cols[(Math.random() * cols.length) | 0];
        var gr = g.createRadialGradient(x, y, 0, x, y, r);
        var al = rnd(0.012, hot ? 0.05 : 0.04);
        gr.addColorStop(0, "rgba(" + col.join(",") + "," + al + ")");
        gr.addColorStop(0.6, "rgba(" + col.join(",") + "," + al * 0.35 + ")");
        gr.addColorStop(1, "rgba(" + col.join(",") + ",0)");
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      // a few hot cores inside the cloud
      for (var q = 0; q < 6; q++) {
        var qx = (cl[0] + rnd(-0.5, 0.5) * cl[2]) * w, qy = (cl[1] + rnd(-0.5, 0.5) * cl[2]) * hh, qr = rnd(0.02, 0.06) * w;
        var qg = g.createRadialGradient(qx, qy, 0, qx, qy, qr);
        qg.addColorStop(0, "rgba(255,214,150," + rnd(0.03, 0.07) + ")"); qg.addColorStop(1, "rgba(255,214,150,0)");
        g.fillStyle = qg; g.beginPath(); g.arc(qx, qy, qr, 0, Math.PI * 2); g.fill();
      }
    });
    // dark lanes of dust through the clouds
    g.globalCompositeOperation = "destination-out";
    for (var d = 0; d < 40; d++) {
      var dx = Math.random() * w, dy = Math.random() * hh, dr = rnd(0.03, 0.12) * w;
      var dg = g.createRadialGradient(dx, dy, 0, dx, dy, dr);
      dg.addColorStop(0, "rgba(0,0,0," + rnd(0.2, 0.5) + ")"); dg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = dg; g.beginPath(); g.arc(dx, dy, dr, 0, Math.PI * 2); g.fill();
    }
    return cv;
  };
  var sizeCosmos = function () {
    if (!cctx) return;
    cos.width = Math.round(W * dpr); cos.height = Math.round(H * dpr);
    // the nebula is taller than the view so it can drift with the scroll,
    // painted at half size (it is all soft light)
    var nw = Math.max(320, Math.round(W / 2)), nh = Math.round(H * 1.8 / 2);
    neb = paintNebula(nw, nh, false); nebHot = paintNebula(nw, nh, true);
    var n = Math.round(Math.min(520, W * H / 3200));
    stars = [];
    for (var s = 0; s < n; s++) {
      var z = Math.random();
      stars.push({ x: Math.random(), y: Math.random(), z: z, r: 0.35 + z * z * 1.3, ph: Math.random() * 6.28, sp: rnd(0.6, 2.2),
        warm: Math.random() < 0.35, flare: z > 0.988 });
    }
  };
  var drawCosmos = function (time) {
    if (!cctx) return;
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cctx.clearRect(0, 0, W, H);
    var doc = Math.max(1, document.documentElement.scrollHeight - H), prog = clamp(window.scrollY / doc, 0, 1);
    // the nebula drifts up through the page, slower than the words
    var ny = -prog * H * 0.8 - lean.y * 20, nx = -lean.x * 24;
    cctx.globalAlpha = S.neb;
    cctx.drawImage(neb, nx - 12, ny, W + 24, H * 1.8);
    if (S.spread > 0.02) { cctx.globalAlpha = S.spread * 0.9; cctx.drawImage(nebHot, nx - 12, ny, W + 24, H * 1.8); }
    cctx.globalAlpha = 1;
    // the stars, three depths of parallax, each twinkling on its own beat
    var sy = window.scrollY;
    for (var i2 = 0; i2 < stars.length; i2++) {
      var st2 = stars[i2];
      var y2 = ((st2.y * H - sy * (0.02 + st2.z * 0.12)) % H + H) % H;
      var x2 = st2.x * W - lean.x * st2.z * 30;
      var tw2 = reduced ? 0.8 : 0.55 + 0.45 * Math.sin(time * 0.001 * st2.sp + st2.ph);
      var al2 = (0.25 + st2.z * 0.7) * tw2;
      cctx.fillStyle = st2.warm ? "rgba(255,214,160," + al2.toFixed(3) + ")" : "rgba(254,244,228," + al2.toFixed(3) + ")";
      if (st2.r < 0.9) cctx.fillRect(x2, y2, st2.r * 1.4, st2.r * 1.4);
      else { cctx.beginPath(); cctx.arc(x2, y2, st2.r, 0, Math.PI * 2); cctx.fill(); }
      if (st2.flare) {
        // the brightest: a glow and four fine spikes
        var fl2 = 6 + st2.z * 5, fg = cctx.createRadialGradient(x2, y2, 0, x2, y2, fl2);
        fg.addColorStop(0, "rgba(255,226,180," + (0.5 * tw2).toFixed(3) + ")"); fg.addColorStop(1, "rgba(255,226,180,0)");
        cctx.fillStyle = fg; cctx.beginPath(); cctx.arc(x2, y2, fl2, 0, Math.PI * 2); cctx.fill();
        cctx.strokeStyle = "rgba(255,236,205," + (0.45 * tw2).toFixed(3) + ")"; cctx.lineWidth = 0.6;
        cctx.beginPath(); cctx.moveTo(x2 - fl2 * 1.6, y2); cctx.lineTo(x2 + fl2 * 1.6, y2); cctx.moveTo(x2, y2 - fl2); cctx.lineTo(x2, y2 + fl2); cctx.stroke();
      }
    }
  };
  var lean = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    lean.tx = e.clientX / window.innerWidth - 0.5; lean.ty = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });
  function frame(dt, time) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    lean.x += (lean.tx - lean.x) * Math.min(1, dt * 0.004); lean.y += (lean.ty - lean.y) * Math.min(1, dt * 0.004);
    coreX = W * S.cx - lean.x * 40; coreY = H * S.cy - lean.y * 26; R = Math.min(W, H) * S.sc;
    drawCosmos(time);
    var dim = S.dim;
    ctx.globalCompositeOperation = "lighter";

    // the quantum field: nearer dust drifts faster with the scroll and
    // stretches into streaks when the page moves quickly
    var sv = scrollV;
    for (var f = 0; f < field.length; f++) {
      var p = field[f];
      p.y -= (sv * p.z * 0.6) / H;
      p.x += Math.sin(time * 0.0003 + p.ph) * 0.00004 * dt * p.z;
      if (p.y < -0.02) p.y += 1.04; else if (p.y > 1.02) p.y -= 1.04;
      var fx = p.x * W, fy = p.y * H, tw = 0.5 + 0.5 * Math.sin(time * 0.002 + p.ph * 3);
      var fa = (0.12 + 0.28 * tw) * p.z * (0.5 + dim * 0.5);
      var len = clamp(sv * p.z * 1.4, -90, 90);
      if (Math.abs(len) > 2) {
        ctx.strokeStyle = "rgba(255,226,170," + (fa * 0.8).toFixed(3) + ")";
        ctx.lineWidth = p.z * 1.2;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy + len); ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(255,226,170," + fa.toFixed(3) + ")";
        ctx.fillRect(fx - p.z * 0.7, fy - p.z * 0.7, p.z * 1.4, p.z * 1.4);
      }
    }
    // particle pairs: born together, spinning apart, annihilating in a flash
    if (!reduced && Math.random() < dt * 0.0012) pairs.push({ x: Math.random() * W, y: Math.random() * H, t: 0, a: Math.random() * 6.28 });
    for (var pi = pairs.length - 1; pi >= 0; pi--) {
      var pr = pairs[pi]; pr.t += dt * 0.0009;
      if (pr.t >= 1) { pairs.splice(pi, 1); continue; }
      var sep = Math.sin(pr.t * Math.PI) * 14, ang = pr.a + pr.t * 5;
      var pa = Math.sin(pr.t * Math.PI) * 0.7;
      ctx.fillStyle = "rgba(255,214,150," + pa.toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(pr.x + Math.cos(ang) * sep, pr.y + Math.sin(ang) * sep, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(229,125,35," + pa.toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(pr.x - Math.cos(ang) * sep, pr.y - Math.sin(ang) * sep, 1.3, 0, Math.PI * 2); ctx.fill();
      if (pr.t > 0.9) {
        var fl = (1 - pr.t) * 10;
        var gf = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, 12);
        gf.addColorStop(0, "rgba(255,240,210," + (0.8 * (1 - fl)).toFixed(3) + ")");
        gf.addColorStop(1, "rgba(255,240,210,0)");
        ctx.fillStyle = gf; ctx.beginPath(); ctx.arc(pr.x, pr.y, 12, 0, Math.PI * 2); ctx.fill();
      }
    }

    // the atom gives way to the dashboard deck (crams-deck.js) where the
    // page has one: the cosmos and the dust above still play
    if (!ATOM) return;

    // the electron shells, crossed round the nucleus
    SHELLS.forEach(function (rot, k) {
      var rr = [0.8, 1.0, 0.9][k];
      ctx.beginPath();
      ctx.ellipse(coreX, coreY, R * rr, R * rr * S.tilt, rot * S.atom, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(250,167,25," + ((0.07 + 0.09 * S.links) * dim * (1 - S.spread * 0.85)).toFixed(3) + ")";
      ctx.lineWidth = 1;
      ctx.setLineDash(k === 1 ? [2, 7] : []);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // the pulsar's beams: two cones of light sweeping out of the nucleus
    if (S.beam > 0.02 && S.core > 0.1) {
      var bA = reduced ? 0.6 : time * 0.00045, bL = R * 1.7, bw = 0.03;
      for (var side = 0; side < 2; side++) {
        var th0 = bA + side * Math.PI;
        var gb = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, bL);
        gb.addColorStop(0, "rgba(255,236,205," + (0.2 * S.beam * dim * S.core).toFixed(3) + ")");
        gb.addColorStop(0.4, "rgba(250,167,25," + (0.05 * S.beam * dim * S.core).toFixed(3) + ")");
        gb.addColorStop(1, "rgba(250,167,25,0)");
        ctx.fillStyle = gb;
        ctx.beginPath(); ctx.moveTo(coreX, coreY);
        ctx.arc(coreX, coreY, bL, th0 - bw, th0 + bw); ctx.closePath(); ctx.fill();
      }
    }

    // bursts: particles thrown out of the nucleus at each change of chapter
    for (var si = sparks.length - 1; si >= 0; si--) {
      var sp = sparks[si];
      sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vx *= 0.985; sp.vy *= 0.985;
      sp.life -= dt * 0.0011;
      if (sp.life <= 0) { sparks.splice(si, 1); continue; }
      ctx.strokeStyle = "rgba(" + (sp.hot ? "255,240,210" : "250,167,25") + "," + (sp.life * 0.8).toFixed(3) + ")";
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(sp.x - sp.vx * 18, sp.y - sp.vy * 18); ctx.stroke();
    }

    // shockwaves from the core
    for (var ri = rings.length - 1; ri >= 0; ri--) {
      var rg = rings[ri];
      rg.r += dt * 0.0011; rg.a -= dt * 0.00055;
      if (rg.a <= 0) { rings.splice(ri, 1); continue; }
      if (rg.r <= 0) continue;
      ctx.beginPath();
      ctx.ellipse(coreX, coreY, R * rg.r * 1.8, R * rg.r * 1.8 * S.tilt, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,214,150," + (rg.a * 0.55 * dim).toFixed(3) + ")";
      ctx.lineWidth = 1 + rg.a * 3;
      ctx.stroke();
    }

    // the worlds: in orbit, or adrift
    worlds.forEach(function (w) {
      if (!reduced) w.a += dt * 0.00011 * (w.r < 0.85 ? 1.35 : w.r < 0.95 ? 1.15 : 1);
      var ex = Math.cos(w.a) * R * w.r, ey = Math.sin(w.a) * R * w.r * S.tilt, sr = SHELLS[w.shell] * S.atom;
      var ox = ex * Math.cos(sr) - ey * Math.sin(sr), oy = ex * Math.sin(sr) + ey * Math.cos(sr);
      var da = w.driftA + Math.sin(time * 0.00012 + w.ph) * 0.25;
      var dx = Math.cos(da) * R * w.driftR, dy = Math.sin(da) * R * w.driftR * 0.72 + Math.sin(time * 0.0004 + w.ph) * R * 0.05;
      var k = ease(S.spread);
      w.x = coreX + mix(ox, dx, k); w.y = coreY + mix(oy, dy, k);
      w.hot += ((hotDept === w.i ? 1 : 0) - w.hot) * Math.min(1, dt * 0.008);
    });

    // lines of light: the core to each world, and round the ring
    if (S.links > 0.01) worlds.forEach(function (w, i) {
      var a = S.links * dim * (0.18 + w.hot * 0.6) * (1 - S.spread);
      var g = ctx.createLinearGradient(coreX, coreY, w.x, w.y);
      g.addColorStop(0, "rgba(250,167,25," + (a * 1.4).toFixed(3) + ")");
      g.addColorStop(1, "rgba(" + w.d.c.join(",") + "," + (a * 0.6).toFixed(3) + ")");
      ctx.strokeStyle = g; ctx.lineWidth = 1 + w.hot * 1.2;
      ctx.beginPath(); ctx.moveTo(coreX, coreY);
      ctx.quadraticCurveTo((coreX + w.x) / 2, (coreY + w.y) / 2 - R * 0.12, w.x, w.y); ctx.stroke();
      var n = worlds[(i + 1) % worlds.length];
      ctx.strokeStyle = "rgba(254,238,207," + (S.links * dim * 0.06 * (1 - S.spread)).toFixed(3) + ")";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(n.x, n.y); ctx.stroke();
    });

    // the core: CRAMS
    var pulse = reduced ? 1 : 1 + Math.sin(time * 0.002) * 0.06;
    // the star keeps to a size, however wide the system is drawn
    var cr = Math.max(0.001, Math.min(R * 0.16, 44) * S.core * pulse);
    var halo = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, cr * 4.2);
    halo.addColorStop(0, "rgba(255,238,205," + (0.55 * S.core * dim).toFixed(3) + ")");
    halo.addColorStop(0.18, "rgba(250,167,25," + (0.35 * S.core * dim).toFixed(3) + ")");
    halo.addColorStop(0.5, "rgba(229,125,35," + (0.1 * S.core * dim).toFixed(3) + ")");
    halo.addColorStop(1, "rgba(192,69,39,0)");
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(coreX, coreY, cr * 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,248,232," + (0.9 * Math.min(1, S.core) * dim).toFixed(3) + ")";
    ctx.beginPath(); ctx.arc(coreX, coreY, cr * 0.32, 0, Math.PI * 2); ctx.fill();
    // the nucleons, turning; in fission (spread) they fly apart
    var nR = Math.max(cr, Math.min(R * 0.16, 44) * 0.5) * 0.62, spin = reduced ? 0.4 : time * 0.0005;
    var cs0 = Math.cos(spin), sn0 = Math.sin(spin), split = ease(S.spread);
    var drawn = nucleons.map(function (n) {
      var x = n.x * cs0 + n.z * sn0, z = -n.x * sn0 + n.z * cs0;
      var jig = reduced ? 0 : Math.sin(time * 0.006 + n.ph) * 0.05;
      return { x: coreX + (x + jig + n.fx * split * 5) * nR, y: coreY + (n.y + jig + n.fy * split * 3.5) * nR, z: z, p: n.p };
    }).sort(function (a2, b2) { return a2.z - b2.z; });
    var nA = dim * Math.max(S.core, split * 0.55);
    drawn.forEach(function (n) {
      var ns = nR * (0.3 + (n.z + 1) * 0.06);
      var gn = ctx.createRadialGradient(n.x - ns * 0.3, n.y - ns * 0.35, ns * 0.1, n.x, n.y, ns);
      gn.addColorStop(0, "rgba(255,248,232," + (nA * 0.95).toFixed(3) + ")");
      gn.addColorStop(0.5, n.p ? "rgba(250,167,25," + (nA * 0.9).toFixed(3) + ")" : "rgba(254,226,190," + (nA * 0.8).toFixed(3) + ")");
      gn.addColorStop(1, "rgba(120,40,14," + (nA * 0.2).toFixed(3) + ")");
      ctx.fillStyle = gn;
      ctx.beginPath(); ctx.arc(n.x, n.y, ns, 0, Math.PI * 2); ctx.fill();
    });
    // an anamorphic streak through the core
    if (S.core > 0.05) {
      var st = ctx.createLinearGradient(coreX - R * 1.3, 0, coreX + R * 1.3, 0);
      st.addColorStop(0, "rgba(255,214,150,0)");
      st.addColorStop(0.5, "rgba(255,236,205," + (0.4 * Math.min(1, S.core) * dim).toFixed(3) + ")");
      st.addColorStop(1, "rgba(255,214,150,0)");
      ctx.fillStyle = st;
      ctx.fillRect(coreX - R * 1.3, coreY - 0.6, R * 2.6, 1.2);
    }

    // the leads
    if (!reduced) {
      spawnAcc += dt * 0.0022 * S.flow;
      lostAcc += dt * 0.0016 * S.lost;
      while (spawnAcc > 1) { spawnAcc--; if (leads.length < 90) spawn(false); }
      while (lostAcc > 1) { lostAcc--; if (leads.length < 90) spawn(true); }
    }
    for (var i = leads.length - 1; i >= 0; i--) {
      var L = leads[i], w = worlds[L.w];
      var px = L.x, py = L.y;
      if (!L.lost) {
        L.t += dt * 0.00055 * L.sp;
        if (L.stage === 0) {
          // into the core
          var k0 = ease(L.t);
          L.x = mix(L.sx, coreX, k0); L.y = mix(L.sy, coreY, k0) - Math.sin(k0 * Math.PI) * R * 0.25;
          if (L.t >= 1) { L.stage = 1; L.t = 0; L.sx = coreX; L.sy = coreY; }
        } else {
          // handed on to a world
          var k1 = ease(L.t);
          L.x = mix(coreX, w.x, k1); L.y = mix(coreY, w.y, k1) - Math.sin(k1 * Math.PI) * R * 0.12;
          if (L.t >= 1) { w.hit = 1; leads.splice(i, 1); continue; }
        }
      } else {
        // aimed at a world, it misses and falls away
        L.t += dt * 0.0004 * L.sp;
        if (L.t < 0.75) {
          var kk = ease(L.t / 0.75) * 0.8;
          L.x = mix(L.sx, w.x, kk); L.y = mix(L.sy, w.y, kk);
          L.vx = (L.x - px) / Math.max(1, dt); L.vy = (L.y - py) / Math.max(1, dt);
        } else {
          L.vy += dt * 0.00005; L.x += L.vx * dt * 0.6; L.y += L.vy * dt;
          L.life -= dt * 0.0006;
          if (L.life <= 0 || L.y > H + 40) { leads.splice(i, 1); continue; }
        }
      }
      L.trail.push(L.x, L.y); if (L.trail.length > 16) L.trail.splice(0, 2);
      var falling = L.lost && L.t >= 0.75;
      var col = falling ? "229,72,60" : "255,226,170";
      var la = dim * (L.lost ? L.life : 1);
      ctx.strokeStyle = "rgba(" + col + "," + (0.35 * la).toFixed(3) + ")";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (var q = 0; q < L.trail.length; q += 2) { if (q) ctx.lineTo(L.trail[q], L.trail[q + 1]); else ctx.moveTo(L.trail[q], L.trail[q + 1]); }
      ctx.stroke();
      ctx.fillStyle = "rgba(" + col + "," + (0.95 * la).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(L.x, L.y, 1.7, 0, Math.PI * 2); ctx.fill();
    }

    // the worlds, drawn over their lines
    ctx.globalCompositeOperation = "source-over";
    worlds.forEach(function (w) {
      w.hit = Math.max(0, (w.hit || 0) - dt * 0.003);
      var s = w.sz * (0.85 + S.sc * 0.8) * (1 + w.hot * 0.5 + w.hit * 0.25);
      var gl = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, s * 3.4);
      gl.addColorStop(0, "rgba(" + w.d.c.join(",") + "," + ((0.28 + w.hot * 0.4 + w.hit * 0.3) * dim).toFixed(3) + ")");
      gl.addColorStop(1, "rgba(" + w.d.c.join(",") + ",0)");
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(w.x, w.y, s * 3.4, 0, Math.PI * 2); ctx.fill();
      var body = ctx.createRadialGradient(w.x - s * 0.35, w.y - s * 0.4, s * 0.1, w.x, w.y, s);
      body.addColorStop(0, "rgba(255,246,228," + dim.toFixed(3) + ")");
      body.addColorStop(0.45, "rgba(" + w.d.c.join(",") + "," + dim.toFixed(3) + ")");
      body.addColorStop(1, "rgba(40,16,8," + dim.toFixed(3) + ")");
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(w.x, w.y, s, 0, Math.PI * 2); ctx.fill();
      // its name
      ctx.font = "500 " + Math.round(9 + w.hot * 2) + "px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(254,238,207," + ((0.35 + w.hot * 0.6) * dim * Math.max(S.labels, w.hot)).toFixed(3) + ")";
      ctx.fillText(w.d.name, w.x, w.y + s + 16);
    });

    // the core's name, once it burns
    if (S.core > 0.5 && S.labels > 0.05) {
      ctx.font = "600 " + Math.round(10 + R * 0.02) + "px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(250,167,25," + ((S.core - 0.5) * 1.6 * dim * S.labels).toFixed(3) + ")";
      ctx.fillText("CRAMS", coreX, coreY + cr * 1.5 + 14);
    }
  }

  // phones resize the view as the address bar slides in and out: only a
  // real change (a new width, or a big jump in height) repaints the sky,
  // so it never flashes mid-scroll
  var lastW = 0, lastH = 0;
  function size() {
    var nw = window.innerWidth, nh = window.innerHeight;
    if (lastW && nw === lastW && Math.abs(nh - lastH) < 160) return;
    lastW = nw; lastH = nh;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = nw; H = nh;
    cvs.width = Math.round(W * dpr); cvs.height = Math.round(H * dpr);
    sizeCosmos();
  }

  if (ctx) {
    size();
    window.addEventListener("resize", size);
    if (reduced) {
      frame(16, 0);
      window.addEventListener("resize", function () { frame(16, 0); });
    } else {
      // on the page's own clock (gsap's ticker, as the other films), or
      // the browser's frames without it
      var last = 0, useGsap = typeof gsap !== "undefined" && gsap.ticker;
      var tick = function (now) {
        if (!useGsap) requestAnimationFrame(tick);
        if (document.hidden) { last = 0; return; }
        var dt = last ? Math.min(50, now - last) : 16; last = now;
        var sy = window.scrollY;
        scrollV += ((sy - lastSY) - scrollV) * 0.25; lastSY = sy;
        var T = target();
        // the system eases toward the chapter, like a camera move
        Object.keys(T).forEach(function (k) { S[k] += (T[k] - S[k]) * Math.min(1, dt * 0.0035); });
        frame(dt, now);
      };
      if (useGsap) gsap.ticker.add(function () { tick(performance.now()); });
      else requestAnimationFrame(tick);
    }
  }

  /* ---------------------------------------------------------------
     THE DEPARTMENTS: pointing at one lights its world
     --------------------------------------------------------------- */
  var depts = $("[data-cr-depts]");
  if (depts) {
    var showDepts = function () { depts.classList.add("is-in"); };
    if ("IntersectionObserver" in window && !reduced) {
      new IntersectionObserver(function (en, o) { if (en[0].isIntersecting) { showDepts(); o.disconnect(); } }, { rootMargin: "0px 0px -15% 0px" }).observe(depts);
    } else showDepts();
    $$(".cr-dept", depts).forEach(function (c) {
      var i = +c.getAttribute("data-dept");
      var on = function () { hotDept = i; c.classList.add("is-hot"); };
      var off = function () { if (hotDept === i) hotDept = -1; c.classList.remove("is-hot"); };
      c.addEventListener("pointerenter", on);
      c.addEventListener("pointerleave", off);
      c.addEventListener("focus", on);
      c.addEventListener("blur", off);
    });
  }

  /* ---------------------------------------------------------------
     THE LIFECYCLE: the stop nearest the middle of the view is the
     lead's stage; the ticket follows it
     --------------------------------------------------------------- */
  // what the illustrative record shows at each stage, and which
  // department's world lights for it
  var STAGES = [
    { owner: "Marketing", status: "New", next: "Assign to the right team", seen: "1 department", log: "Enquiry captured", dept: 1 },
    { owner: "Sales", status: "Assigned", next: "First follow-up", seen: "2 departments", log: "Assigned to sales", dept: 0 },
    { owner: "Sales", status: "In follow-up", next: "Update status", seen: "2 departments", log: "Follow-up scheduled", dept: 0 },
    { owner: "Sales", status: "Qualified", next: "Share with the teams", seen: "Every department", log: "Status updated", dept: 0 },
    { owner: "Management", status: "In reports", next: "Review the data", seen: "Every department", log: "Added to reports", dept: 4 },
    { owner: "Operations", status: "Record complete", next: "Monitor results", seen: "Every department", log: "Record verified", dept: 3 },
    { owner: "Management", status: "Tracked", next: "Keep improving", seen: "Every department", log: "Performance logged", dept: 4 }
  ];
  var path = $("[data-cr-path]"), ticket = $("[data-cr-ticket]");
  if (path && ticket) {
    var steps = $$("li[data-step]", path);
    var tStage = $("[data-t-stage]", ticket), tN = $("[data-t-stage-n]", ticket);
    var fields = { owner: $("[data-t-owner]", ticket), status: $("[data-t-status]", ticket), next: $("[data-t-next]", ticket), seen: $("[data-t-seen]", ticket) };
    var trail = $("[data-t-trail]", ticket), meter = $("[data-t-meter]", ticket);
    var lifeSec = path.closest("[data-cr-chapter]");
    var cur = -1, lifeHot = false, stacked = window.matchMedia("(max-width: 1000px)");
    var setStage = function (s) {
      if (s === cur) return;
      cur = s;
      var st = STAGES[s];
      steps.forEach(function (li, j) { li.classList.toggle("is-on", j === s); li.classList.toggle("is-past", j < s); });
      // the comet and the lit line end on the stop itself
      var y = steps[s].offsetTop + 13, full = Math.max(1, path.clientHeight - 28);
      path.style.setProperty("--cy", y + "px");
      path.style.setProperty("--p", Math.min(1, Math.max(0, (y - 14) / full)).toFixed(3));
      tStage.textContent = steps[s].querySelector("b").textContent;
      tN.textContent = "0" + (s + 1);
      Object.keys(fields).forEach(function (k) {
        if (fields[k].textContent === st[k]) return;
        fields[k].textContent = st[k];
        fields[k].classList.remove("is-fresh"); void fields[k].offsetWidth; fields[k].classList.add("is-fresh");
      });
      // the trail: every step so far, the newest last
      trail.innerHTML = "";
      STAGES.slice(Math.max(0, s - 3), s + 1).forEach(function (x) {
        var li = document.createElement("li"); li.textContent = x.log; trail.appendChild(li);
      });
      meter.style.setProperty("--m", ((s + 1) / STAGES.length * 100).toFixed(1) + "%");
      ticket.classList.remove("is-flash"); void ticket.offsetWidth; ticket.classList.add("is-flash");
    };
    var lifeTick = false;
    var pickStage = function () {
      lifeTick = false;
      var mid = window.innerHeight * 0.5, best = 0, bd = 1e9;
      // narrow screens: the ticket rides at the top, so the stage is read
      // in the view left below it
      if (stacked.matches) { var tb = ticket.getBoundingClientRect().bottom; mid = tb + (window.innerHeight - tb) * 0.35; }
      steps.forEach(function (li, j) {
        var r = li.getBoundingClientRect(), d = Math.abs(r.top + Math.min(r.height, 120) / 2 - mid);
        if (d < bd) { bd = d; best = j; }
      });
      setStage(best);
      // the stage's owner lights in the system, while the chapter is on
      var lr = lifeSec.getBoundingClientRect(), vm = window.innerHeight * 0.5;
      var inLife = lr.top < vm && lr.bottom > vm;
      if (inLife) { hotDept = STAGES[best].dept; lifeHot = true; }
      else if (lifeHot) { lifeHot = false; if (!$(".cr-dept.is-hot")) hotDept = -1; }
    };
    window.addEventListener("scroll", function () { if (!lifeTick) { lifeTick = true; requestAnimationFrame(pickStage); } }, { passive: true });
    window.addEventListener("resize", pickStage);
    setStage(0);
    pickStage();
  }

  /* ---------------------------------------------------------------
     THE HUD: the signal readout names the chapter you are in
     --------------------------------------------------------------- */
  var sigEl = $("[data-cr-signal]");
  var NAMES = { ignition: "ALL DEPARTMENTS", gap: "SIGNAL LOST · DATA SCATTERED", connected: "SYNCED · ONE DECK", lifecycle: "TRACKING LEAD", truth: "SINGLE SOURCE", crew: "BUILT IN-HOUSE", launch: "READY FOR LAUNCH" };
  if (sigEl && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) sigEl.textContent = NAMES[e.target.getAttribute("data-cr-chapter")] || sigEl.textContent; });
    }, { rootMargin: "-45% 0px -45% 0px" });
    chapters.forEach(function (c) { io.observe(c.el); });
  }

  /* ---------------------------------------------------------------
     THE FORGE: the wordmark made of leads
     Each letter of the DOM wordmark is drawn, off screen, where it sits;
     points are sampled from its shape, and every point is a lead that
     streams in from the edge of the view to settle on it. As the last
     ones land the real letters resolve over them (.is-forging holds
     them back) and the leads fade to embers.
     --------------------------------------------------------------- */
  var forgeCvs = $("[data-cr-forge]"), wordEl = $("[data-cr-word]");
  var runForge = function () {
    if (!forgeCvs || !wordEl || !forgeCvs.getContext) return false;
    var hero = forgeCvs.parentElement, hr = hero.getBoundingClientRect();
    var fw = hr.width, fh = hr.height, fd = Math.min(window.devicePixelRatio || 1, 2);
    if (!fw || !fh) return false;
    forgeCvs.width = Math.round(fw * fd); forgeCvs.height = Math.round(fh * fd);
    var fc = forgeCvs.getContext("2d");
    // the letters' shapes, where they sit
    var off = document.createElement("canvas"); off.width = Math.round(fw); off.height = Math.round(fh);
    var oc = off.getContext("2d");
    var cs = getComputedStyle(wordEl);
    oc.fillStyle = "#fff"; oc.textBaseline = "alphabetic";
    $$("span", wordEl).forEach(function (sp) {
      var r = sp.getBoundingClientRect();
      var fs = parseFloat(cs.fontSize);
      oc.font = cs.fontWeight + " " + fs + "px " + cs.fontFamily;
      // the span is hidden (opacity 0, lifted): place its glyph where it will land
      oc.fillText(sp.textContent, r.left - hr.left, r.top - hr.top + fs * 0.86 - fs * 0.18 * 0.9);
    });
    var img = oc.getImageData(0, 0, off.width, off.height).data, pts = [];
    var step = Math.max(3, Math.round(Math.min(fw, 1400) / 260));
    for (var y = 0; y < off.height; y += step) for (var x = 0; x < off.width; x += step) {
      if (img[(y * off.width + x) * 4 + 3] > 128) pts.push([x, y]);
    }
    if (!pts.length) return false;
    var parts = pts.map(function (p) {
      var a = Math.random() * Math.PI * 2, d = Math.max(fw, fh) * (0.6 + Math.random() * 0.5);
      return { tx: p[0], ty: p[1], sx: fw / 2 + Math.cos(a) * d, sy: fh * 0.45 + Math.sin(a) * d, delay: Math.random() * 700, dur: 900 + Math.random() * 700, tw: Math.random() * 6.28 };
    });
    var start = performance.now(), fading = 0;
    main.classList.add("is-forging");
    var draw = function () {
      var now = performance.now(), t = now - start;
      fc.setTransform(fd, 0, 0, fd, 0, 0);
      fc.clearRect(0, 0, fw, fh);
      fc.globalCompositeOperation = "lighter";
      // after the letters take over (~1.9s), the leads fade to embers
      var fade = t < 1900 ? 1 : Math.max(0, 1 - (t - 1900) / 1300);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i], k = clamp((t - p.delay) / p.dur, 0, 1);
        if (k <= 0) continue;
        var e = 1 - Math.pow(1 - k, 3);
        var x = mix(p.sx, p.tx, e), y = mix(p.sy, p.ty, e);
        var hot = k < 1 ? 1 : 0.55 + 0.45 * Math.sin(now * 0.006 + p.tw);
        fc.fillStyle = "rgba(255," + (k < 1 ? 214 : 190) + "," + (k < 1 ? 160 : 120) + "," + (0.9 * fade * hot).toFixed(3) + ")";
        var sz = k < 1 ? 1.6 : 1.3;
        fc.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        if (k < 1 && k > 0.05) {
          // its trail, back along the way it came
          var bx = mix(p.sx, p.tx, 1 - Math.pow(1 - Math.max(0, k - 0.08), 3)), by = mix(p.sy, p.ty, 1 - Math.pow(1 - Math.max(0, k - 0.08), 3));
          fc.strokeStyle = "rgba(250,167,25," + (0.35 * fade).toFixed(3) + ")";
          fc.lineWidth = 1;
          fc.beginPath(); fc.moveTo(bx, by); fc.lineTo(x, y); fc.stroke();
        }
      }
      fc.globalCompositeOperation = "source-over";
      if (fade > 0) requestAnimationFrame(draw);
      else { fc.clearRect(0, 0, fw, fh); forgeCvs.style.display = "none"; }
    };
    requestAnimationFrame(draw);
    return true;
  };
  if (reduced) light();
  else ready(function () { runForge(); light(); });

  /* ---------------------------------------------------------------
     QUANTUM TRANSITIONS: each chapter's content materializes as it
     scrolls in and dissolves as it scrolls out, both ways
     --------------------------------------------------------------- */
  var qs = $$(".cr-hero-grid, .cr-panel, .cr-depts, .cr-pillars, .cr-crew-grid, .cr-launch-inner");
  qs.forEach(function (el) { el.setAttribute("data-cr-q", ""); });
  // phones and tablets: the same rise and fade, without the blur (a
  // blur on every frame of a touch scroll is what makes it stutter)
  var lite = window.matchMedia("(max-width: 1024px), (hover: none)").matches;
  var quantum = function (vh) {
    if (reduced) return;
    qs.forEach(function (el) {
      var r = el.getBoundingClientRect();
      // in: from its top at the bottom of the view to 30% up it;
      // out: as its bottom climbs through the top quarter
      var qi = el.classList.contains("cr-hero-grid") ? 1 : ease((vh - r.top) / (vh * 0.32));
      var qo = ease(r.bottom / (vh * 0.28));
      var q = Math.min(qi, qo);
      if (q > 0.995) {
        if (el.style.opacity) { el.style.opacity = ""; el.style.translate = ""; el.style.scale = ""; el.style.filter = ""; }
        return;
      }
      el.style.opacity = (q * q).toFixed(3);
      el.style.translate = "0 " + ((1 - qi) * 60 - (1 - qo) * 40).toFixed(1) + "px";
      el.style.scale = (0.94 + 0.06 * q).toFixed(3);
      if (!lite) el.style.filter = "blur(" + ((1 - q) * 9).toFixed(1) + "px)";
    });
  };
  // the HUD
  var hud = $("[data-cr-hud]"), hudCh = $("[data-cr-hud-ch]"), hudName = $("[data-cr-hud-name]");
  var strip = hud ? $$("li", $("[data-cr-hud-strip]", hud)) : [];
  var ORDER = ["ignition", "gap", "connected", "lifecycle", "truth", "crew", "launch"];
  var LABEL = { ignition: "Ignition", gap: "The gap", connected: "Connected", lifecycle: "The lifecycle", truth: "One truth", crew: "In-house", launch: "Launch" };
  var SIG = { ignition: 4, gap: 1, connected: 5, lifecycle: 5, truth: 5, crew: 5, launch: 5 };
  var hudNow = "";
  var frameTick = false;
  var onScroll = function () {
    frameTick = false;
    var vh = window.innerHeight;
    quantum(vh);
    // past the film (the footer): the HUD steps aside
    main.classList.toggle("is-past", main.getBoundingClientRect().bottom < vh * 0.6);
    if (hud && nowChapter !== hudNow) {
      hudNow = nowChapter;
      var idx = ORDER.indexOf(nowChapter);
      if (hudCh) hudCh.textContent = "CH 0" + Math.max(0, idx);
      if (hudName) hudName.textContent = LABEL[nowChapter] || "";
      strip.forEach(function (li, j) { li.classList.toggle("is-on", j === idx); li.classList.toggle("is-past", j < idx); });
      hud.setAttribute("data-sig", SIG[nowChapter] || 5);
    }
  };
  var requestScroll = function () { if (!frameTick) { frameTick = true; requestAnimationFrame(onScroll); } };
  window.addEventListener("scroll", requestScroll, { passive: true });
  window.addEventListener("resize", requestScroll);
  // nowChapter follows the system's reading of the page; keep the HUD in
  // step even when the system is still (reduced motion)
  setInterval(function () { if (!document.hidden) { target(); onScroll(); } }, 400);
  onScroll();

  /* ---------------------------------------------------------------
     THE DEPARTMENT CARDS: they tilt under the pointer, a light following
     --------------------------------------------------------------- */
  if (!reduced && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    $$(".cr-dept").forEach(function (c) {
      c.addEventListener("pointermove", function (e) {
        var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        c.classList.add("is-tilt");
        c.style.setProperty("--ry", ((x - 0.5) * 10).toFixed(2) + "deg");
        c.style.setProperty("--rx", ((0.5 - y) * 8).toFixed(2) + "deg");
        c.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
        c.style.setProperty("--my", (y * 100).toFixed(1) + "%");
      });
      c.addEventListener("pointerleave", function () { c.classList.remove("is-tilt"); c.style.removeProperty("--rx"); c.style.removeProperty("--ry"); });
    });
  }

  /* ---------------------------------------------------------------
     THE TICKET: boots in (a flicker) as it comes into view
     --------------------------------------------------------------- */
  var glasses = $$(".cr-ticket");
  if ("IntersectionObserver" in window && !reduced) {
    var bio = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-boot"); bio.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -12% 0px" });
    glasses.forEach(function (g) { bio.observe(g); });
  } else glasses.forEach(function (g) { g.classList.add("is-boot"); });
})();
