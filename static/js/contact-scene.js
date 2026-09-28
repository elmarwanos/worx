/* ============================================================
   Worx | contact-scene.js
   The contact page's picture, drawn live. Decorative only: it
   listens to the planner (contact.js) and never touches it.
     - the sky: Dubai's radar, a slow sweep that lights the blips it
       crosses, rings pulsing out, and a relay line to Mars with a
       packet of light on its way. Every key and pick sends a ring.
     - the console's oscilloscope: calm at rest, it answers typing,
       carries a pulse across on each new question, and settles
       into a steady heartbeat once the enquiry is received.
     - the station readout: Dubai's time and the signal state
       (standing by, receiving, transmitting, locked).
   Reduced motion: one still frame, no loops.
   ============================================================ */

(function () {
  "use strict";

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var qa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var now = function () { return (window.performance && performance.now()) || Date.now(); };

  var AMBER = "250,167,25", ORANGE = "229,125,35", EMBER = "192,69,39", CREAM = "254,238,207";

  /* ---- signal state -------------------------------------------- */

  var statusEls = qa("[data-ct-status]");
  var signal = "idle";
  var LABELS = { idle: "STANDING BY", rx: "RECEIVING", tx: "TRANSMITTING", lock: "LOCKED" };
  function setSignal(s) {
    if (s === signal) return;
    signal = s;
    statusEls.forEach(function (el) { el.textContent = LABELS[s]; });
  }

  /* ---- Dubai clock ---------------------------------------------- */

  var clocks = qa("[data-ct-clock]");
  if (clocks.length) {
    var fmt = null;
    try { fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", hour12: false }); } catch (e) {}
    var tick = function () {
      if (!fmt) return;
      var t = fmt.format(new Date());
      clocks.forEach(function (el) { el.textContent = t; });
    };
    tick();
    setInterval(tick, 15000);
  }

  /* ---- canvas helper -------------------------------------------- */

  function fit(canvas) {
    var r = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w * DPR || canvas.height !== h * DPR) {
      canvas.width = w * DPR;
      canvas.height = h * DPR;
    }
    var ctx = canvas.getContext("2d");
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  // a loop that only runs while its canvas is on screen and the tab is visible
  function loop(canvas, draw) {
    var raf = 0, onScreen = true;
    function frame(t) { raf = 0; draw(t); schedule(); }
    function schedule() {
      if (!raf && onScreen && !document.hidden && !reduced) raf = requestAnimationFrame(frame);
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; schedule(); }).observe(canvas);
    }
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("resize", function () { if (reduced) draw(now()); });
    draw(now());
    schedule();
    return { wake: schedule };
  }

  /* ---- the sky ----------------------------------------------------
     The station's radar as a holographic table: the disc tilted into
     the scene, Worx's services as contacts hanging above it at their
     own altitudes (each on a stem down to its fix on the disc), the
     sweep throwing a curtain of light up off its edge. A contact the
     sweep finds is acquired: lock brackets and its bearing and range.
     The pointer locks the contact nearest it. Holding "Open the
     channel" charges the station (the sweep spins up, every contact
     lights); on lock a shockwave rolls out and the relay runs hot. */

  var sky = document.querySelector("[data-ct-sky]");
  var pulses = [];            // rings sent out from the station
  var lastKick = 0;
  function ring(strength) {
    var t = now();
    if (t - lastKick < 140 && strength < 1) return;
    lastKick = t;
    pulses.push({ t0: t, s: strength });
    if (pulses.length > 14) pulses.shift();
  }
  var charge = 0, surgeAt = -1e9;   // set by the channel key (below)

  if (sky) {
    var seed = 7;
    var rnd = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    var stars = [];
    for (var i = 0; i < 170; i++) stars.push({ x: rnd(), y: rnd(), r: rnd() * 1.1 + 0.2, d: rnd() * 0.8 + 0.2, p: rnd() * 6.28 });
    var SERVICES = ["WEB DEVELOPMENT", "E-COMMERCE", "CUSTOM PLATFORMS", "MOBILE APPS",
      "ARTIFICIAL INTELLIGENCE", "AR / VR", "UI / UX DESIGN", "BRANDING", "2D / 3D ANIMATION",
      "SEO & SEM", "ERP & CRM", "CLOUD", "COPYWRITING", "IT OUTSOURCING"];
    // each contact: a bearing, a range (fraction of the disc) and an
    // altitude; seeded, so the picture is the same every visit
    var s2 = 11, r2 = function () { s2 = (s2 * 16807) % 2147483647; return (s2 - 1) / 2147483646; };
    var contacts = SERVICES.map(function (name, i) {
      return { name: name, a: (i / SERVICES.length) * 6.283 + (r2() - 0.5) * 0.35, r: 0.28 + r2() * 0.64,
        alt: 0.05 + r2() * 0.22, hit: -1e9, id: "TGT-" + (100 + i * 7) };
    });

    var px = 0, py = 0, tx = 0, ty = 0, mx0 = -1e4, my0 = -1e4;
    window.addEventListener("pointermove", function (e) {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
      var rr = sky.getBoundingClientRect();
      mx0 = e.clientX - rr.left; my0 = e.clientY - rr.top;
    }, { passive: true });

    var SWEEP = 9000, PACKET = 5200;
    var lastSweep = 0, sweepAng = 0, lastT = 0;
    var t0 = now();

    // brackets round a point
    var brackets = function (c, x, y, s, a) {
      c.strokeStyle = "rgba(" + AMBER + "," + a.toFixed(3) + ")";
      c.lineWidth = 1.2;
      c.beginPath();
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) {
        c.moveTo(x + q[0] * s, y + q[1] * s - q[1] * s * 0.5);
        c.lineTo(x + q[0] * s, y + q[1] * s);
        c.lineTo(x + q[0] * s - q[0] * s * 0.5, y + q[1] * s);
      });
      c.stroke();
    };
    // where a contact's readout goes (whichever side has the room), as a
    // box the labels can be kept apart by
    var LABEL_GAP = 11;   // the brackets' settled size + a little air
    var labelBox = function (c, x, y, label, sub, wEdge) {
      c.font = "500 10px 'JetBrains Mono', monospace";
      var lw = Math.max(c.measureText(label).width, c.measureText(sub).width);
      var left = wEdge && x + LABEL_GAP + 8 + lw > wEdge - 12;
      var lx = left ? x - LABEL_GAP - 8 : x + LABEL_GAP + 8;
      return { left: left, lx: lx, y: y, l: left ? lx - lw : lx, r: left ? lx : lx + lw, t: y - 12, b: y + 14 };
    };
    var drawLabel = function (c, bx, a, label, sub) {
      c.font = "500 10px 'JetBrains Mono', monospace";
      c.textAlign = bx.left ? "right" : "left";
      c.fillStyle = "rgba(" + CREAM + "," + (0.95 * a).toFixed(3) + ")";
      c.fillText(label, bx.lx, bx.y - 2);
      c.fillStyle = "rgba(" + AMBER + "," + (0.8 * a).toFixed(3) + ")";
      c.fillText(sub, bx.lx, bx.y + 11);
      c.textAlign = "left";
    };
    var clash = function (bx, placed) {
      for (var i = 0; i < placed.length; i++) {
        var p = placed[i];
        if (bx.l < p.r + 10 && p.l < bx.r + 10 && bx.t < p.b + 4 && p.t < bx.b + 4) return true;
      }
      return false;
    };

    // where the title card sits, so the table takes the room it leaves:
    // beside it on wide screens, in the band under it when the hero
    // stacks (contact.css sets --ct-layout); re-read on resize and
    // every second while the card's fonts and boot settle
    var card = document.querySelector(".ct-card"), hero = sky.closest(".ct-hero");
    var box = null, stacked = false, boxAt = -1e9;
    var measure = function () {
      boxAt = now();
      stacked = !!hero && getComputedStyle(hero).getPropertyValue("--ct-layout").trim() === "stacked";
      if (!card) { box = null; return; }
      var s = sky.getBoundingClientRect(), b = card.getBoundingClientRect();
      box = { l: b.left - s.left, r: b.right - s.left, t: b.top - s.top, b: b.bottom - s.top };
    };
    window.addEventListener("resize", measure);

    loop(sky, function (t) {
      var f = fit(sky), c = f.ctx, w = f.w, h = f.h;
      if (now() - boxAt > 1000) measure();
      var el = t - t0;
      var dt = lastT ? Math.min(64, t - lastT) : 16;
      lastT = t;
      var mobile = w < 760;
      px += (tx - px) * 0.04; py += (ty - py) * 0.04;
      c.clearRect(0, 0, w, h);

      // stars, the far field
      for (var k = 0; k < stars.length; k++) {
        var st = stars[k];
        var tw = reduced ? 0.6 : 0.45 + 0.55 * Math.sin(el / 1400 * st.d + st.p);
        c.fillStyle = "rgba(" + CREAM + "," + (0.12 + 0.4 * tw * st.d).toFixed(3) + ")";
        c.beginPath();
        c.arc(st.x * w - px * 10 * st.d, st.y * h - py * 8 * st.d, st.r, 0, 6.283);
        c.fill();
      }

      // the table: tilted (K squashes the disc), turning a touch with the pointer
      var ox, oy, R, K = (mobile ? 0.5 : 0.4) + py * 0.03;
      var band = stacked && box ? h - box.b - 12 : 0;
      if (band > 200) {
        // stacked: the table fills the band under the card, clear of it
        // (its far contacts reach 0.68R up, its label 0.42R + 44 down)
        K = 0.42 + py * 0.03;
        R = Math.min(w * 0.46, (band - 44) / 1.1, 560);
        ox = w * 0.5 - px * 12;
        oy = box.b + 12 + Math.max(0, (band - 44 - R * 1.1) * 0.35) + R * 0.68 - py * 6;
      } else if (box && !stacked && w - box.r > 220) {
        // beside the card: sized to the room right of it, never under it
        R = Math.max(120, Math.min(w * 0.3, h * 0.6, (w - box.r - 24) * 0.48));
        ox = Math.min(Math.max(0.66 * w, box.r + 24 + R * 1.02), w - R * 0.9) - px * 16;
        oy = 0.56 * h - py * 10;
      } else {
        ox = 0.72 * w - px * 16;
        oy = 0.3 * h - py * 10;
        R = Math.min(w * 0.6, h * 0.6);
      }
      var P = function (a, r) { return [ox + Math.cos(a) * r * R, oy + Math.sin(a) * r * R * K]; };
      var surge = Math.max(0, 1 - (t - surgeAt) / 1600);
      var heat = Math.max(charge, surge);

      // the disc's light, under everything
      var dg = c.createRadialGradient(ox, oy, 0, ox, oy, R);
      dg.addColorStop(0, "rgba(" + ORANGE + "," + (0.1 + heat * 0.12).toFixed(3) + ")");
      dg.addColorStop(1, "rgba(" + ORANGE + ",0)");
      c.save(); c.translate(ox, oy); c.scale(1, K); c.translate(-ox, -oy);
      c.fillStyle = dg; c.beginPath(); c.arc(ox, oy, R, 0, 6.283); c.fill();
      c.restore();

      // range rings, crosshair, bearing ticks, on the tilted plane
      c.lineWidth = 1;
      for (var n = 1; n <= 5; n++) {
        c.strokeStyle = "rgba(" + CREAM + "," + (n === 5 ? 0.14 : 0.07) + ")";
        c.beginPath(); c.ellipse(ox, oy, R * n / 5, R * n / 5 * K, 0, 0, 6.283); c.stroke();
      }
      c.strokeStyle = "rgba(" + CREAM + ",0.06)";
      c.beginPath();
      c.moveTo(ox - R, oy); c.lineTo(ox + R, oy);
      c.moveTo(ox, oy - R * K); c.lineTo(ox, oy + R * K);
      c.stroke();
      c.strokeStyle = "rgba(" + CREAM + ",0.16)";
      c.beginPath();
      for (var b = 0; b < 72; b++) {
        var ba = b / 72 * 6.283, bl = b % 6 === 0 ? 0.05 : 0.02;
        var p1 = P(ba, 1), p2 = P(ba, 1 - bl);
        c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]);
      }
      c.stroke();
      // the rim, lit on the near side
      var rim = c.createLinearGradient(0, oy - R * K, 0, oy + R * K);
      rim.addColorStop(0, "rgba(" + AMBER + ",0.05)"); rim.addColorStop(1, "rgba(" + AMBER + ",0.45)");
      c.strokeStyle = rim; c.lineWidth = 1.4;
      c.beginPath(); c.ellipse(ox, oy, R, R * K, 0, 0, 6.283); c.stroke();

      // the sweep: charge spins it up
      if (!reduced) sweepAng += (dt / SWEEP) * 6.283 * (1 + heat * 5);
      var sa = reduced ? -0.9 : sweepAng;
      var TRAIL = 36;
      c.save(); c.translate(ox, oy); c.scale(1, K); c.translate(-ox, -oy);
      for (var q = 0; q < TRAIL; q++) {
        var a1 = sa - q * 0.022, a2 = a1 - 0.024;
        c.fillStyle = "rgba(" + ORANGE + "," + ((0.08 + heat * 0.05) * Math.pow(1 - q / TRAIL, 1.6)).toFixed(4) + ")";
        c.beginPath(); c.moveTo(ox, oy); c.arc(ox, oy, R, a2, a1); c.closePath(); c.fill();
      }
      c.restore();
      // the curtain of light standing up off the sweep's edge
      var ep = P(sa, 1), CH = R * (0.34 + heat * 0.2);
      var cg = c.createLinearGradient(0, oy, 0, oy - CH);
      cg.addColorStop(0, "rgba(" + AMBER + "," + (0.2 + heat * 0.2).toFixed(3) + ")");
      cg.addColorStop(1, "rgba(" + AMBER + ",0)");
      c.fillStyle = cg;
      c.beginPath(); c.moveTo(ox, oy); c.lineTo(ep[0], ep[1]); c.lineTo(ep[0], ep[1] - CH); c.lineTo(ox, oy - CH * 0.6); c.closePath(); c.fill();
      var edge = c.createLinearGradient(ox, oy, ep[0], ep[1]);
      edge.addColorStop(0, "rgba(" + AMBER + ",0.8)"); edge.addColorStop(1, "rgba(" + AMBER + ",0.1)");
      c.strokeStyle = edge; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(ox, oy); c.lineTo(ep[0], ep[1]); c.stroke();

      // the contacts: far first, so near ones sit in front
      var prev = ((lastSweep % 6.283) + 6.283) % 6.283, cur = ((sa % 6.283) + 6.283) % 6.283;
      var order = contacts.slice().sort(function (x, y) { return Math.sin(x.a) * x.r - Math.sin(y.a) * y.r; });
      var near = null, nearD = 1e9;
      // where each contact is, and how lit: worked out first, so the one
      // the pointer holds is known before anything is drawn
      order.forEach(function (ct) {
        var aa = ((ct.a % 6.283) + 6.283) % 6.283;
        var crossed = prev <= cur ? (aa > prev && aa <= cur) : (aa > prev || aa <= cur);
        if (crossed) ct.hit = t;
        ct.fix = P(ct.a, ct.r);
        ct.sx = ct.fix[0]; ct.sy = ct.fix[1] - ct.alt * R;
        var d = Math.hypot(ct.sx - mx0, ct.sy - my0);
        if (d < nearD) { nearD = d; near = ct; }
        // (a still frame shows the few the sweep has just passed)
        var behind = ((sa - ct.a) % 6.283 + 6.283) % 6.283;
        ct.age = reduced ? (behind < 1.6 ? 300 + behind * 3000 : 1e9) : t - ct.hit;
        ct.life = Math.max(heat, Math.max(0, 1 - ct.age / 5600));
      });
      var held = near && nearD < 90 && !mobile ? near : null;
      order.forEach(function (ct) {
        var fix = ct.fix, top = [ct.sx, ct.sy], age = ct.age, life = ct.life;
        var base = 0.16 + life * 0.84;
        // stem and its fix on the disc
        c.strokeStyle = "rgba(" + CREAM + "," + (0.12 + life * 0.3).toFixed(3) + ")";
        c.lineWidth = 1;
        c.setLineDash([2, 3]);
        c.beginPath(); c.moveTo(fix[0], fix[1]); c.lineTo(top[0], top[1]); c.stroke();
        c.setLineDash([]);
        c.strokeStyle = "rgba(" + AMBER + "," + (0.2 + life * 0.4).toFixed(3) + ")";
        c.beginPath(); c.ellipse(fix[0], fix[1], 5, 5 * K, 0, 0, 6.283); c.stroke();
        // the contact
        var cgl = c.createRadialGradient(top[0], top[1], 0, top[0], top[1], 14);
        cgl.addColorStop(0, "rgba(" + AMBER + "," + (0.55 * life).toFixed(3) + ")");
        cgl.addColorStop(1, "rgba(" + AMBER + ",0)");
        c.fillStyle = cgl; c.beginPath(); c.arc(top[0], top[1], 14, 0, 6.283); c.fill();
        c.fillStyle = "rgba(" + (life > 0.3 ? AMBER : CREAM) + "," + base.toFixed(3) + ")";
        c.beginPath(); c.arc(top[0], top[1], 2.4, 0, 6.283); c.fill();
        // just acquired: brackets close in (the held one gets its own)
        if (life > 0.02 && !mobile && ct !== held) {
          var closeIn = reduced ? 1 : Math.min(1, age / 380);
          brackets(c, top[0], top[1], 16 - closeIn * 7, Math.min(1, life * 1.3));
        }
      });
      // the pointer locks the contact nearest it
      if (held) {
        brackets(c, held.sx, held.sy, 11 + Math.sin(t / 180) * 1.5, 1);
        c.strokeStyle = "rgba(" + AMBER + ",0.35)"; c.lineWidth = 1;
        c.beginPath(); c.moveTo(ox, oy); c.lineTo(held.sx, held.sy); c.stroke();
      }
      // The readouts, one per contact, never on top of each other: the
      // held contact first, then the freshest from the sweep. A readout
      // that would land on one already placed eases out of the way (and
      // back in when there's room), so a new contact taking over from a
      // fading neighbour crossfades instead of printing over it.
      if (!mobile) {
        var placed = [];
        var lit = contacts.filter(function (ct) { return ct === held || ct.life > 0.02 || ct.la > 0.01; });
        lit.sort(function (x, y) { return (y === held) - (x === held) || y.life - x.life; });
        lit.forEach(function (ct) {
          var isHeld = ct === held;
          var brg = Math.round(((ct.a * 180 / Math.PI) + 450) % 360);
          var sub = isHeld ? ct.id + " · LOCKED" : "BRG " + ("00" + brg).slice(-3) + "° · RNG " + (ct.r * 40).toFixed(1);
          var bx = labelBox(c, ct.sx, ct.sy, ct.name, sub, w);
          var free = !clash(bx, placed);
          var want = isHeld ? 1 : free ? Math.min(1, ct.life * 1.3) : 0;
          var la = ct.la || 0;
          // quick to clear the way, a touch slower to come back
          la += (want - la) * (reduced ? 1 : want < la ? 0.35 : 0.2);
          ct.la = la;
          if (la > 0.01) drawLabel(c, bx, la, ct.name, sub);
          if (free && want > 0.02) placed.push(bx);
        });
      }
      lastSweep = sa;

      // rings on the plane: one on its own every few seconds, one per
      // key and pick, a shockwave on lock
      if (!reduced && (!pulses.length || t - pulses[pulses.length - 1].t0 > 4200)) pulses.push({ t0: t, s: 0.5 });
      for (var pI = pulses.length - 1; pI >= 0; pI--) {
        var pa = Math.max(0, (t - pulses[pI].t0) / (pulses[pI].s > 2 ? 2200 : 3600));
        if (pa >= 1) { pulses.splice(pI, 1); continue; }
        c.strokeStyle = "rgba(" + ORANGE + "," + (Math.min(1, 0.5 * pulses[pI].s) * (1 - pa) * (1 - pa)).toFixed(3) + ")";
        c.lineWidth = 1 + Math.min(3, pulses[pI].s);
        c.beginPath(); c.ellipse(ox, oy, 6 + pa * R * (pulses[pI].s > 2 ? 1.4 : 1), (6 + pa * R * (pulses[pI].s > 2 ? 1.4 : 1)) * K, 0, 0, 6.283); c.stroke();
      }

      // the station: a beacon standing on the table's centre
      var bh = R * (0.12 + heat * 0.1);
      var bg = c.createLinearGradient(0, oy, 0, oy - bh);
      bg.addColorStop(0, "rgba(" + AMBER + ",0.9)"); bg.addColorStop(1, "rgba(" + AMBER + ",0)");
      c.strokeStyle = bg; c.lineWidth = 2;
      c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox, oy - bh); c.stroke();
      var glow = c.createRadialGradient(ox, oy, 0, ox, oy, 60 + heat * 50);
      glow.addColorStop(0, "rgba(" + AMBER + "," + (0.45 + heat * 0.4).toFixed(3) + ")");
      glow.addColorStop(1, "rgba(" + AMBER + ",0)");
      c.fillStyle = glow;
      c.beginPath(); c.arc(ox, oy, 60 + heat * 50, 0, 6.283); c.fill();
      c.fillStyle = "rgba(" + CREAM + ",0.95)";
      c.beginPath(); c.arc(ox, oy, 3, 0, 6.283); c.fill();
      c.font = "500 10px 'JetBrains Mono', monospace";
      c.fillStyle = "rgba(" + CREAM + ",0.55)";
      c.textAlign = "center";
      c.fillText("DXB · 25.02°N 55.20°E", ox, oy + R * K + 22);
      c.textAlign = "left";

      // Mars, and the relay to it: top right on wide screens; beside the
      // card when the hero stacks and there's room; not on phones (the
      // headline needs the room)
      var mars = band > 200 ? (box && w - box.r > 130 ? [(box.r + w) / 2 + 10, box.t + 64] : null)
        : !mobile ? [w * 0.93, h * 0.15] : null;
      if (mars) {
        var mx = mars[0] - px * 26, my = mars[1] - py * 18;
        var cx = band > 200 ? mx + 36 : (ox + mx) / 2 + 40;
        var cy = band > 200 ? (my + oy - bh) / 2 : Math.min(oy - bh, my) - h * 0.12;
        c.setLineDash([2, 6]);
        c.strokeStyle = "rgba(" + CREAM + "," + (0.16 + heat * 0.3).toFixed(3) + ")";
        c.lineWidth = 1;
        c.beginPath(); c.moveTo(ox, oy - bh); c.quadraticCurveTo(cx, cy, mx, my); c.stroke();
        c.setLineDash([]);
        var mg = c.createRadialGradient(mx, my, 0, mx, my, 34);
        mg.addColorStop(0, "rgba(" + EMBER + ",0.5)");
        mg.addColorStop(1, "rgba(" + EMBER + ",0)");
        c.fillStyle = mg;
        c.beginPath(); c.arc(mx, my, 34, 0, 6.283); c.fill();
        var body = c.createRadialGradient(mx - 3, my - 3, 1, mx, my, 9);
        body.addColorStop(0, "#f08a4b");
        body.addColorStop(0.6, "#c04527");
        body.addColorStop(1, "#5a1c0c");
        c.fillStyle = body;
        c.beginPath(); c.arc(mx, my, 8, 0, 6.283); c.fill();
        c.fillStyle = "rgba(" + CREAM + ",0.55)";
        c.textAlign = "center"; c.fillText("WORX HQ", mx, my + 26); c.textAlign = "left";
        var period = heat > 0.5 ? 700 : signal === "lock" ? 1800 : signal === "tx" ? 1400 : PACKET;
        var u = reduced ? 0.62 : (el % period) / Math.min(period, 2600);
        if (u <= 1) {
          for (var z = 0; z < 14; z++) {
            var uu = u - z * 0.012;
            if (uu < 0) break;
            var ix = (1 - uu) * (1 - uu) * ox + 2 * (1 - uu) * uu * cx + uu * uu * mx;
            var iy = (1 - uu) * (1 - uu) * (oy - bh) + 2 * (1 - uu) * uu * cy + uu * uu * my;
            c.fillStyle = "rgba(" + AMBER + "," + (0.9 * (1 - z / 14)).toFixed(3) + ")";
            c.beginPath(); c.arc(ix, iy, z ? 1.6 : 2.6, 0, 6.283); c.fill();
          }
        }
      }
    });
  }

  /* ---- the channel key: hold to open ------------------------------
     Press and hold: the ring charges, the frequency climbs to lock, the
     relay reads LINKING; hold to the end and the channel opens (a
     shockwave off the radar) and you're taken to the brief. Let go
     early and it winds back down. A click or Enter opens it at once. */
  var key = document.querySelector("[data-ct-open]");
  if (key) (function () {
    var arc = key.querySelector(".ct-open-arc"), freq = key.querySelector("[data-ct-freq]"), say = key.querySelector("[data-ct-open-say]");
    var HOLD = 1100, v = 0, holding = false, raf = 0, last = 0, done = false, pressT = 0;
    var LEN = 2 * Math.PI * 22;
    if (arc) { arc.style.strokeDasharray = LEN; arc.style.strokeDashoffset = LEN; }
    var paint = function () {
      charge = v;
      if (arc) arc.style.strokeDashoffset = (LEN * (1 - v)).toFixed(1);
      if (freq) freq.textContent = (97.1 + v * 10.9).toFixed(2);
      key.style.setProperty("--v", v.toFixed(3));
    };
    var open = function () {
      done = true; v = 1; paint();
      key.classList.add("is-open");
      if (say) say.textContent = "Channel open";
      surgeAt = now(); ring(3);
      statusEls.forEach(function (el) { el.textContent = "CHANNEL OPEN"; });
      setTimeout(function () {
        var target = document.getElementById("contact-planner");
        if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 90, behavior: reduced ? "auto" : "smooth" });
      }, reduced ? 0 : 450);
      setTimeout(function () {
        done = false; v = 0; paint(); key.classList.remove("is-open", "is-holding");
        if (say) say.textContent = "Resume Journey";
        signal = ""; setSignal("idle");
      }, 2600);
    };
    var step = function (t) {
      raf = 0;
      var dt = last ? Math.min(64, t - last) : 16;
      last = t;
      if (done) return;
      v += (holding ? dt / HOLD : -dt / 500);
      v = Math.max(0, Math.min(1, v));
      paint();
      if (holding && v >= 1) { open(); return; }
      if (holding || v > 0) raf = requestAnimationFrame(step);
    };
    var start = function (e) {
      if (done || (e.button != null && e.button !== 0)) return;
      holding = true; pressT = now(); last = 0;
      key.classList.add("is-holding");
      if (say) say.textContent = "Linking…";
      statusEls.forEach(function (el) { el.textContent = "LINKING"; });
      if (reduced) { open(); return; }
      if (!raf) raf = requestAnimationFrame(step);
    };
    var stop = function () {
      if (!holding) return;
      holding = false;
      key.classList.remove("is-holding");
      if (!done) {
        if (say) say.textContent = "Resume Journey";
        statusEls.forEach(function (el) { el.textContent = LABELS[signal] || "STANDING BY"; });
        // a quick tap is a click: open straight away
        if (now() - pressT < 220) open();
        else if (!raf) raf = requestAnimationFrame(step);
      }
    };
    key.addEventListener("pointerdown", start);
    window.addEventListener("pointerup", stop);
    key.addEventListener("pointerleave", stop);
    key.addEventListener("pointercancel", stop);
    key.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!done) open(); } });
    key.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  })();

  /* ---- the console's oscilloscope -------------------------------- */

  var wave = document.querySelector("[data-ct-wave]");
  var energy = 0, sweepAt = -1e9;

  if (wave) {
    var wt0 = now();
    loop(wave, function (t) {
      var f = fit(wave), c = f.ctx, w = f.w, h = f.h, mid = h / 2;
      var el = (t - wt0) / 1000;
      energy *= 0.955;
      c.clearRect(0, 0, w, h);

      // baseline
      c.strokeStyle = "rgba(" + CREAM + ",0.08)";
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, mid); c.lineTo(w, mid); c.stroke();

      var g = c.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, "rgba(" + EMBER + ",0.1)");
      g.addColorStop(0.5, "rgba(" + ORANGE + ",0.9)");
      g.addColorStop(1, "rgba(" + AMBER + ",0.2)");
      c.strokeStyle = g;
      c.lineWidth = 1.4;
      c.beginPath();
      var amp = (0.08 + energy * 0.92) * (h / 2 - 2);
      var sweepX = ((t - sweepAt) / 900) * w;        // a pulse crossing on each new question
      for (var x = 0; x <= w; x += 2) {
        var y = Math.sin(x * 0.045 + el * 3.1) * 0.6 + Math.sin(x * 0.11 - el * 5.3) * 0.3 + Math.sin(x * 0.021 + el * 1.3) * 0.25;
        var v = y * amp * (0.35 + 0.65 * Math.sin(Math.PI * x / w));
        var d = x - sweepX;
        v += Math.exp(-(d * d) / 260) * Math.sin(d * 0.35) * (h / 2 - 2) * 0.9;
        if (signal === "lock") {                       // steady heartbeat once received
          var hb = (el % 1.6) / 1.6 * w, dd = x - hb;
          v = Math.exp(-(dd * dd) / 60) * Math.sin(dd * 0.5) * (h / 2 - 3) + v * 0.2;
        }
        if (x === 0) c.moveTo(x, mid + v); else c.lineTo(x, mid + v);
      }
      c.stroke();
    });
  }

  /* ---- listening to the planner ---------------------------------- */

  var mount = document.getElementById("contact-wizard");
  if (mount) {
    var touched = false;
    var interacted = function (strength) {
      energy = Math.min(1, energy + strength * 0.5);
      ring(strength);
      if (!touched && signal === "idle") { touched = true; setSignal("rx"); }
    };
    mount.addEventListener("input", function (e) {
      interacted(e.target.type === "range" ? 0.4 : 0.55);
    });
    mount.addEventListener("change", function (e) {
      if (e.target.type === "radio") interacted(1);
    });

    // new question, sending, received: read off the planner's DOM
    var legend = null;
    var read = function () {
      var lg = mount.querySelector(".cw-legend");
      if (lg && lg !== legend) {
        if (legend) { sweepAt = now(); ring(1); energy = Math.min(1, energy + 0.4); }
        legend = lg;
      }
      if (mount.querySelector(".cw-success-icon")) setSignal("lock");
      else {
        var next = mount.querySelector("[data-next]");
        if (next && next.disabled) setSignal("tx");
        else if (signal === "lock" || signal === "tx") setSignal(touched ? "rx" : "idle");
      }
    };
    new MutationObserver(read).observe(mount, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
    read();

    // a soft light follows the pointer across the answer cards
    mount.addEventListener("pointermove", function (e) {
      var card = e.target.closest && e.target.closest(".cw-option");
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (e.clientX - r.left) + "px");
      card.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  }

  qa(".ct-ch").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (e.clientX - r.left) + "px");
      card.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  });
})();
