/* ============================================================
   Worx | flight-fx.js
   The air the rocket man flies through, in the Worx sequence
   (services.js drives it from his flight, jet-fire.js is the flame
   at his nozzles). One canvas under him, over the flight path:
     - a contrail: warm smoke shed from the pack that lingers, spreads,
       curls and cools, so his route hangs in the sky behind him;
     - speed streaks when he's really moving;
     - the beats: a shockwave, a flash and a spray of sparks when he
       hits a mark, a smoke billow off the pad at liftoff.
   Everything is additive sprites (no blur filters); it sleeps when
   nothing is alive and the section is off screen.
   ============================================================ */
(function (global) {
  "use strict";

  var TAU = Math.PI * 2;

  function sprite(stops) {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return c;
  }
  // vapour, lit warm by the sky: added as light, faint, never a dark fog
  var SMOKE = sprite([[0, "rgba(120,86,66,0.5)"], [0.45, "rgba(90,62,48,0.22)"], [1, "rgba(60,40,30,0)"]]);
  var LITSMOKE = sprite([[0, "rgba(255,170,90,0.6)"], [0.5, "rgba(210,110,50,0.22)"], [1, "rgba(160,70,30,0)"]]);
  var HOT = sprite([[0, "rgba(255,250,235,1)"], [0.2, "rgba(255,200,110,0.7)"], [0.55, "rgba(240,120,40,0.18)"], [1, "rgba(200,70,20,0)"]]);

  function create(host) {
    var canvas = document.createElement("canvas");
    canvas.className = "cx-flight-fx";
    canvas.setAttribute("aria-hidden", "true");
    host.insertBefore(canvas, host.querySelector(".cx-flight-points"));
    var ctx = canvas.getContext("2d");
    // the canvas bleeds past the map (soft-masked in CSS), so smoke
    // drifting off the route never meets a hard edge
    var PAD = 120, W = 0, H = 0, dpr = 1;
    var smoke = [], sparks = [], rings = [], streaks = [];
    var MAXS = 520;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      W = host.clientWidth + PAD * 2; H = host.clientHeight + PAD * 2;
      var cw = Math.round(W * dpr), ch = Math.round(H * dpr);
      // (re-assigning the size clears the canvas: only when it changed)
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    }
    resize();
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(host);

    // the pack sheds smoke behind him: more the faster he flies
    function trail(x, y, heading, speed, thrust, dt, scale) {
      var bx = x - Math.cos(heading) * scale * 0.42, by = y - Math.sin(heading) * scale * 0.42;
      var rate = (9 + speed * 0.04 + thrust * 24) * dt;
      var n = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
      for (var i = 0; i < n && smoke.length < MAXS; i++) {
        var side = (Math.random() - 0.5) * scale * 0.18;
        var back = 30 + Math.random() * 40;
        smoke.push({
          x: bx - Math.sin(heading) * side, y: by + Math.cos(heading) * side,
          vx: -Math.cos(heading) * back + (Math.random() - 0.5) * 14,
          vy: -Math.sin(heading) * back + (Math.random() - 0.5) * 14 - 6,
          age: 0, life: 2.2 + Math.random() * 1.6,
          r0: scale * (0.05 + Math.random() * 0.04), r1: scale * (0.34 + Math.random() * 0.3),
          spin: (Math.random() - 0.5) * 0.8, seed: Math.random() * 100,
        });
      }
      // streaks: only at real speed
      if (speed > 520 && Math.random() < speed / 2400) {
        var off = (Math.random() - 0.5) * scale * 1.2;
        streaks.push({
          x: x - Math.sin(heading) * off, y: y + Math.cos(heading) * off,
          a: heading, len: scale * (0.8 + Math.random() * 1.4) * Math.min(2, speed / 700), age: 0, life: 0.28,
        });
      }
    }

    // a mark hit: shockwave, flash, sparks
    function beat(x, y, big) {
      rings.push({ x: x, y: y, age: 0, life: big ? 1.3 : 0.9, r1: big ? 170 : 110 });
      rings.push({ x: x, y: y, age: -0.08, life: big ? 1.1 : 0.7, r1: big ? 110 : 70 });
      var n = big ? 46 : 26;
      for (var i = 0; i < n; i++) {
        var a = Math.random() * TAU, s = 90 + Math.random() * (big ? 320 : 220);
        sparks.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, age: 0, life: 0.5 + Math.random() * 0.6 });
      }
      sparks.push({ x: x, y: y, vx: 0, vy: 0, age: 0, life: 0.35, flash: big ? 130 : 80 });
    }

    // liftoff: the pad disappears in a billow that rolls outward
    function liftoff(x, y) {
      for (var i = 0; i < 42 && smoke.length < MAXS; i++) {
        var a = Math.PI + (Math.random() - 0.5) * Math.PI * 0.9 + Math.PI / 2 * (Math.random() < 0.5 ? -1 : 1) * 0.55;
        var s = 40 + Math.random() * 170;
        smoke.push({
          x: x + (Math.random() - 0.5) * 20, y: y + Math.random() * 6,
          vx: Math.cos(a) * s, vy: -Math.abs(Math.sin(a)) * s * 0.35 - Math.random() * 20,
          age: 0, life: 2.4 + Math.random() * 1.8,
          r0: 10 + Math.random() * 10, r1: 60 + Math.random() * 70,
          spin: (Math.random() - 0.5) * 0.8, seed: Math.random() * 100, lit: 1,
        });
      }
      beat(x, y, false);
    }

    function alive() { return smoke.length + sparks.length + rings.length + streaks.length > 0; }

    function frame(dt, t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.setTransform(dpr, 0, 0, dpr, PAD * dpr, PAD * dpr);
      var i, p, k;
      // smoke: normal blend, it's matter, not light
      for (i = smoke.length - 1; i >= 0; i--) {
        p = smoke[i];
        p.age += dt;
        if (p.age >= p.life) { smoke.splice(i, 1); continue; }
        k = p.age / p.life;
        var drag = Math.pow(0.12, dt);
        p.vx *= drag; p.vy *= drag;
        // it curls: a slow turbulence that grows with age
        p.vx += Math.sin(t * 0.9 + p.seed) * 22 * k * dt * 10;
        p.vy += (Math.cos(t * 0.7 + p.seed * 1.3) * 16 * k - 8) * dt * 10;
        p.x += p.vx * dt; p.y += p.vy * dt;
        var r = p.r0 + (p.r1 - p.r0) * (1 - Math.pow(1 - k, 2.2));
        var a = (k < 0.08 ? k / 0.08 : 1) * Math.pow(1 - k, 1.6);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = a * (p.lit ? 0.2 : 0.55);
        ctx.drawImage(SMOKE, p.x - r, p.y - r, r * 2, r * 2);
        ctx.globalCompositeOperation = "source-over";
        // the young smoke still carries the flame's light
        var lit = p.lit ? 0.9 : 1;
        if (k < 0.35 * lit) {
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = (1 - k / (0.35 * lit)) * (p.lit ? 0.16 : 0.5);
          ctx.drawImage(LITSMOKE, p.x - r * 0.8, p.y - r * 0.8, r * 1.6, r * 1.6);
          ctx.globalCompositeOperation = "source-over";
        }
      }
      ctx.globalCompositeOperation = "lighter";
      for (i = streaks.length - 1; i >= 0; i--) {
        p = streaks[i];
        p.age += dt;
        if (p.age >= p.life) { streaks.splice(i, 1); continue; }
        k = p.age / p.life;
        var ex = p.x - Math.cos(p.a) * p.len, ey = p.y - Math.sin(p.a) * p.len;
        var g = ctx.createLinearGradient(p.x, p.y, ex, ey);
        g.addColorStop(0, "rgba(255,226,170," + (0.55 * (1 - k)).toFixed(3) + ")");
        g.addColorStop(1, "rgba(255,160,80,0)");
        ctx.globalAlpha = 1;
        ctx.strokeStyle = g; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ex, ey); ctx.stroke();
      }
      for (i = rings.length - 1; i >= 0; i--) {
        p = rings[i];
        p.age += dt;
        if (p.age < 0) continue;
        if (p.age >= p.life) { rings.splice(i, 1); continue; }
        k = p.age / p.life;
        var e = 1 - Math.pow(1 - k, 3);
        ctx.globalAlpha = (1 - k) * 0.9;
        ctx.strokeStyle = "rgba(255,196,110,1)";
        ctx.lineWidth = 2.4 * (1 - k) + 0.4;
        ctx.beginPath(); ctx.arc(p.x, p.y, 8 + p.r1 * e, 0, TAU); ctx.stroke();
        // the refracted edge: a faint second ring just inside
        ctx.globalAlpha = (1 - k) * 0.35;
        ctx.strokeStyle = "rgba(161,71,157,1)";
        ctx.beginPath(); ctx.arc(p.x, p.y, 4 + p.r1 * e * 0.93, 0, TAU); ctx.stroke();
      }
      for (i = sparks.length - 1; i >= 0; i--) {
        p = sparks[i];
        p.age += dt;
        if (p.age >= p.life) { sparks.splice(i, 1); continue; }
        k = p.age / p.life;
        if (p.flash) {
          ctx.globalAlpha = (1 - k) * 0.9;
          ctx.drawImage(HOT, p.x - p.flash, p.y - p.flash, p.flash * 2, p.flash * 2);
          continue;
        }
        var d = Math.pow(0.05, dt);
        p.vx *= d; p.vy = p.vy * d + 60 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        var sz = 7 * (1 - k) + 2;
        ctx.globalAlpha = 1 - k;
        ctx.drawImage(HOT, p.x - sz, p.y - sz, sz * 2, sz * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    return { trail: trail, beat: beat, liftoff: liftoff, frame: frame, alive: alive, resize: resize };
  }

  global.FlightFX = { create: create };
})(window);
