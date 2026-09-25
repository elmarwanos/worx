/* ============================================================
   Worx | jet-fire.js
   Live jetpack exhaust for the rocket man in the flight plan.
   A small additive particle system per nozzle: white-hot core at
   the nozzle, flame puffs that cool from yellow to orange to red
   and widen as they go, turbulence that grows with age, and embers
   that streak away. The canvas lives inside .cx-jet, so it banks,
   bobs and mirrors with the image for free. Throttle follows the
   --thrust value services.js sets from scroll speed.
   ============================================================ */

(function () {
  var jet = document.querySelector(".cx-jet");
  if (!jet) return;

  var canvas = document.createElement("canvas");
  canvas.className = "cx-jet-fire";
  canvas.setAttribute("aria-hidden", "true");
  var ctx = canvas.getContext("2d");
  if (!ctx) return;
  jet.insertBefore(canvas, jet.querySelector(".cx-jet-img"));
  jet.classList.add("has-fire");

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Canvas box relative to the jet box (see .cx-jet-fire in services.css)
  var BOX = { x: -0.8, y: -0.2, w: 1.8, h: 1.8 };
  // Nozzle exits (fractions of the image) and exhaust headings (deg, y down)
  var NOZZLES = [
    { x: 0.356, y: 0.461, a: 123 },
    { x: 0.649, y: 0.576, a: 111 }
  ];

  // Colour ramp from ignition to burn-out, pre-baked as soft sprites
  var RAMP = [
    [255, 252, 240], [255, 238, 190], [255, 214, 130], [255, 186, 80],
    [255, 156, 52], [252, 128, 38], [240, 100, 30], [220, 78, 26],
    [196, 60, 22], [160, 44, 18], [120, 32, 14], [80, 22, 10]
  ];
  var SPR = 64;
  var sprites = RAMP.map(function (c) {
    var s = document.createElement("canvas");
    s.width = s.height = SPR;
    var g = s.getContext("2d");
    var gr = g.createRadialGradient(SPR / 2, SPR / 2, 0, SPR / 2, SPR / 2, SPR / 2);
    gr.addColorStop(0, "rgba(" + c + ",1)");
    gr.addColorStop(0.35, "rgba(" + c + ",0.55)");
    gr.addColorStop(1, "rgba(" + c + ",0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, SPR, SPR);
    return s;
  });

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var U = 100, JH = 66, W = 0, H = 0;

  function resize() {
    U = jet.clientWidth || 100;
    JH = jet.clientHeight || U * 0.66;
    var cw = U * BOX.w, ch = JH * BOX.h;
    W = Math.round(cw * dpr);
    H = Math.round(ch * dpr);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
  }
  resize();
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(jet);
  else window.addEventListener("resize", resize);

  function nozzlePx(n) {
    return {
      x: ((n.x - BOX.x) * U) * dpr,
      y: ((n.y - BOX.y) * JH) * dpr
    };
  }

  var flames = [];
  var embers = [];
  var MAX = 700;

  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }

  function emit(dt, thrust) {
    var u = U * dpr;
    NOZZLES.forEach(function (n) {
      var o = nozzlePx(n);
      var rate = (150 + 170 * thrust) * dt; // puffs per nozzle this frame
      var count = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
      for (var i = 0; i < count && flames.length < MAX; i++) {
        var ang = (n.a + gauss() * 3.5) * Math.PI / 180;
        var sp = u * (1.45 + Math.random() * 0.55) * (1 + thrust * 0.6);
        var back = Math.random() * dt; // spread spawns across the frame, no banding
        flames.push({
          x: o.x + Math.cos(ang) * sp * back,
          y: o.y + Math.sin(ang) * sp * back,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          age: 0,
          life: 0.17 + Math.random() * 0.14 + thrust * 0.08,
          r0: u * (0.018 + Math.random() * 0.008),
          r1: u * (0.058 + Math.random() * 0.028),
          seed: Math.random() * 100
        });
      }
      if (Math.random() < (2 + 6 * thrust) * dt && embers.length < 30) {
        var ea = (n.a + gauss() * 9) * Math.PI / 180;
        var es = u * (1.2 + Math.random() * 0.8);
        embers.push({ x: o.x, y: o.y, vx: Math.cos(ea) * es, vy: Math.sin(ea) * es, age: 0, life: 0.3 + Math.random() * 0.4 });
      }
    });
  }

  function drawCore(thrust, t) {
    var u = U * dpr;
    NOZZLES.forEach(function (n, k) {
      var o = nozzlePx(n);
      var flick = 0.85 + Math.random() * 0.3;
      var len = u * 0.14 * (1 + thrust * 0.5) * flick;
      var wid = u * 0.03 * (0.9 + Math.random() * 0.2);
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(n.a * Math.PI / 180);
      // Engine thrust: a short orange tongue, a hot yellow sheath and a
      // blue-white Mach cone right at the nozzle, all flickering together
      var tongue = len * 1.9;
      var g0 = ctx.createLinearGradient(0, 0, tongue, 0);
      g0.addColorStop(0, "rgba(255,150,50,0.75)");
      g0.addColorStop(0.5, "rgba(240,90,25,0.35)");
      g0.addColorStop(1, "rgba(200,50,15,0)");
      ctx.fillStyle = g0;
      ctx.beginPath();
      ctx.moveTo(0, -wid * 1.35);
      ctx.bezierCurveTo(tongue * 0.3, -wid * 1.5, tongue * 0.7, -wid * 0.5 * flick, tongue, 0);
      ctx.bezierCurveTo(tongue * 0.7, wid * 0.5 * flick, tongue * 0.3, wid * 1.5, 0, wid * 1.35);
      ctx.closePath();
      ctx.fill();
      var g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, "rgba(255,255,250,0.95)");
      g.addColorStop(0.35, "rgba(255,236,180,0.8)");
      g.addColorStop(1, "rgba(255,170,60,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -wid);
      ctx.quadraticCurveTo(len * 0.45, -wid * 0.9, len, 0);
      ctx.quadraticCurveTo(len * 0.45, wid * 0.9, 0, wid);
      ctx.closePath();
      ctx.fill();
      var cone = len * 0.42;
      var g2 = ctx.createLinearGradient(0, 0, cone, 0);
      g2.addColorStop(0, "rgba(235,245,255,1)");
      g2.addColorStop(0.6, "rgba(170,205,255,0.6)");
      g2.addColorStop(1, "rgba(150,190,255,0)");
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.moveTo(0, -wid * 0.55);
      ctx.lineTo(cone, 0);
      ctx.lineTo(0, wid * 0.55);
      ctx.closePath();
      ctx.fill();
      // faint shock diamonds that shimmer with throttle
      for (var d = 1; d <= 2; d++) {
        var dx = len * (0.28 * d + 0.04 * Math.sin(t * 40 + k + d));
        ctx.globalAlpha = (0.35 - d * 0.1) * (0.6 + thrust * 0.6);
        ctx.drawImage(sprites[0], dx - wid, -wid, wid * 2, wid * 2);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      // nozzle bloom
      var b = u * 0.06 * flick;
      ctx.globalAlpha = 0.4 + thrust * 0.25;
      ctx.drawImage(sprites[2], o.x - b, o.y - b, b * 2, b * 2);
      ctx.globalAlpha = 1;
    });
  }

  var last = 0;
  var visible = true;
  var running = false;

  function step(now) {
    var dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    var thrust = parseFloat(jet.style.getPropertyValue("--thrust")) || 0;
    var t = now / 1000;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    emit(dt, thrust);
    var u = U * dpr;

    for (var i = flames.length - 1; i >= 0; i--) {
      var f = flames[i];
      f.age += dt;
      var k = f.age / f.life;
      if (k >= 1) { flames.splice(i, 1); continue; }
      // turbulence grows as the gas slows and spreads
      var turb = u * 2.4 * k;
      f.vx += (Math.sin(f.seed + t * 23) + gauss()) * turb * dt;
      f.vy += (Math.cos(f.seed * 1.7 + t * 19) + gauss()) * turb * dt;
      f.vx *= 1 - 1.6 * dt;
      f.vy *= 1 - 1.6 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      var r = f.r0 + (f.r1 - f.r0) * Math.pow(k, 0.7);
      var si = Math.min(RAMP.length - 1, Math.floor(Math.pow(k, 0.8) * RAMP.length));
      ctx.globalAlpha = 0.36 * Math.pow(1 - k, 1.4);
      ctx.drawImage(sprites[si], f.x - r, f.y - r, r * 2, r * 2);
    }

    for (var j = embers.length - 1; j >= 0; j--) {
      var e = embers[j];
      e.age += dt;
      var ek = e.age / e.life;
      if (ek >= 1) { embers.splice(j, 1); continue; }
      e.vx += gauss() * u * 1.5 * dt;
      e.vy += gauss() * u * 1.5 * dt;
      var px = e.x, py = e.y;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      ctx.globalAlpha = 0.9 * (1 - ek);
      ctx.strokeStyle = ek < 0.4 ? "#ffe2a6" : "#ff9a3c";
      ctx.lineWidth = Math.max(1, u * 0.008) * (1 - ek * 0.6);
      ctx.beginPath();
      ctx.moveTo(px - (e.x - px) * 0.6, py - (e.y - py) * 0.6);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    drawCore(thrust, t);
    ctx.globalCompositeOperation = "source-over";

    if (visible && !document.hidden && !reduced) requestAnimationFrame(step);
    else running = false;
  }

  function kick() {
    if (running) return;
    running = true;
    last = 0;
    requestAnimationFrame(step);
  }

  if (reduced) {
    // One settled, still frame: a steady burn with no motion
    for (var w = 0; w < 30; w++) step(w * 16);
    return;
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) kick();
    }).observe(jet.closest(".cx-flight") || jet);
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && visible) kick(); });
  kick();
})();
