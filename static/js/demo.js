/* ============================================================
   Worx | demo.js
   The Book a Demo page: the Worx eye rises over Mars.
   Styles in demo.css; the design package is .claude/demo/.

   THE SHOT, "First Sight" (on load, then idle)
     0.0s  DARK    the night sky (MartianSky, the storm cell and the
                   GLIMPSE orbiter, as on the Portfolio page); the
                   cinema frame's letterbox opens (blog-cinema.js)
     0.4s  DAWN    a warm glow blooms behind the ridge, rays turning
     0.8s  RISE    the mark rises from behind the land, slow and heavy
                   (2.2s, no bounce), coming up out of its own light,
                   shedding dust off its lower edge
     3.0s  SETTLE  it comes to rest over the ridge; the copy rises in
     3.2s  AWAKE   the eye blinks once, the crescent starts following
                   the pointer, the invite ring breathes, OPEN THE EYE
     idle          a blink every 7 to 11 s; motes drift on the wind

   The eye is a link to #glimpse (the booking panel), so it works
   with no JS at all. Shot 2, "The Opening", replaces that jump.

   Degrades: no GSAP = the settled mark (no .dm-live); reduced
   motion = one still sky, the settled mark, no blink, no follow.
   Every loop runs only while the stage is on screen and the tab
   is visible.
   ============================================================ */

(function () {
  "use strict";

  var stage = document.querySelector(".dm-stage");
  if (!stage) return;

  var root = document.documentElement;
  var rmq = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduced = rmq.matches;                                     // at load (the rise, the journey's setup)
  var hasGsap = typeof gsap !== "undefined";
  var q = function (s, r) { return (r || document).querySelector(s); };
  var qa = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  var mark = q(".dm-mark", stage);
  var pupils = qa(".dm-pupil", mark);
  var crescents = qa(".dm-crescent", mark), slits = qa(".dm-slit", mark);

  // the burning iris (demo-space.js): drawn under the pupil, masked to the almond
  var fireCanvas = q(".dm-fire", mark);
  var fire = fireCanvas && typeof WorxSpace !== "undefined" ? WorxSpace.fireEye(fireCanvas) : null;
  if (fire) mark.classList.add("has-fire");
  var gaze = 0, gazeTarget = 0, gazeHold = 0;                    // 1 = the eye has found you
  var skyCanvas = q(".dm-sky", stage);
  var dustCanvas = q(".dm-dust", stage);
  var terrain = q(".dm-terrain", stage);

  var CONFIG = {
    rise: { at: 0.8, dur: 2.2 },
    dawn: { at: 0.4, dur: 1.4 },
    blinkEvery: [7, 11],          // seconds between idle blinks
    pupil: { rx: 620, ry: 170 },  // how far the crescent travels, in logo units
    motes: 70,                    // ambient dust at rest
    shed: 9,                      // dust specks per frame off the rising mark
  };

  var onScreen = true, running = false, raf = 0, last = 0;
  var rising = false, awake = false;
  // the rise (GSAP, on load) and the journey (scroll) both move the mark.
  // If the visitor scrolls during the rise, GSAP would fold the journey's
  // zoom into the mark's transform and leave it there, so coming back up
  // the logo stayed blown up off screen. So: the first scroll into the
  // journey finishes the rise at once, and once it's done the journey
  // clears any transform it left behind.
  var riseTl = null, riseDone = !hasGsap || reduced;

  /* ----------------------------------------------------------
     The sky and the dust: one loop, two canvases
     ---------------------------------------------------------- */

  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  var sky = typeof MartianSky !== "undefined" ? new MartianSky({ reduceMotion: reduced, warm: true }) : null;
  var skyCtx = skyCanvas.getContext("2d");
  var dustCtx = dustCanvas.getContext("2d");
  var skyFx = { dpr: dpr, _cam: null, cameraOriginY: 0.62, horizonY: 0.6 };
  var W = 0, H = 0;
  var motes = [], specks = [];
  var sprite = (function () {
    var c = document.createElement("canvas");
    c.width = c.height = 32;
    var g = c.getContext("2d");
    var gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, "rgba(255,214,160,1)");
    gr.addColorStop(0.3, "rgba(250,167,25,0.5)");
    gr.addColorStop(1, "rgba(229,125,35,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 32);
    return c;
  })();
  var rand = function (a, b) { return a + Math.random() * (b - a); };

  // the stars inside the eye: cool white, unlike the warm surface dust
  var starSprite = (function () {
    var c = document.createElement("canvas");
    c.width = c.height = 32;
    var g = c.getContext("2d");
    var gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, "rgba(255,250,240,1)");
    gr.addColorStop(0.25, "rgba(255,236,205,0.55)");
    gr.addColorStop(1, "rgba(255,220,180,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 32);
    return c;
  })();
  var voidStars = null;
  function makeVoidStars() {
    var list = [], n = W < 700 ? 160 : 300, rMax = Math.hypot(W / 2, H / 2);
    for (var i = 0; i < n; i++) {
      list.push({ th: rand(0, 6.283), r: rand(0, rMax), v: rand(8, 40), s: rand(0.6, 2.2), a: rand(0.3, 1), a0: 1, tws: rand(0.8, 3), ph: rand(0, 6.283) });
    }
    return list;
  }

  // the terrain plate (2400x1600) has its peak 36.5% down, centred.
  // Fit it so the peak lands just under the settled mark on any screen,
  // and the plate still reaches the bottom of the stage.
  var PLATE = { aspect: 1.5, peak: 0.365 };
  var ridgeY = 0;

  function fitTerrain() {
    var markBottom = mark.offsetTop + mark.offsetHeight;   // layout box: the rise transform doesn't count
    ridgeY = Math.min(H * 0.86, markBottom + H * 0.045);
    var imgH = Math.max(W / PLATE.aspect, (H - ridgeY) / (1 - PLATE.peak));
    var top = ridgeY - PLATE.peak * imgH;
    terrain.style.backgroundSize = Math.round(imgH * PLATE.aspect) + "px " + Math.round(imgH) + "px";
    terrain.style.backgroundPosition = "center " + Math.round(top) + "px";
    stage.style.setProperty("--ridge", Math.round(ridgeY) + "px");
    skyFx.horizonY = ridgeY / H;
  }

  function resize() {
    var r = stage.getBoundingClientRect();
    W = r.width; H = r.height;
    [skyCanvas, dustCanvas].forEach(function (c) {
      c.width = Math.max(1, Math.round(W * dpr));
      c.height = Math.max(1, Math.round(H * dpr));
    });
    fitTerrain();
    sizeDeep();
    if (fire) fire.resize(mark.offsetWidth * 0.8257, mark.offsetHeight * 0.4006, Math.min(window.devicePixelRatio || 1, 2));
    motes = [];
    voidStars = null;
    for (var i = 0; i < CONFIG.motes; i++) motes.push(mote(true));
    paint(0);
  }

  function mote(anywhere) {
    var z = Math.random();                       // depth: 0 far, 1 near
    return {
      x: rand(0, W), y: anywhere ? rand(H * 0.25, H) : H + 10,
      r: 0.5 + z * 1.8, a: 0.15 + z * 0.45, v: 6 + z * 26, z: z,
      ph: rand(0, 6.28),
    };
  }

  // dust shed where the mark breaks out of the land: along the ridge
  // line while its lower edge is still behind it, then off that edge
  function shed() {
    var r = mark.getBoundingClientRect(), s = stage.getBoundingClientRect();
    var bottom = r.bottom - s.top, left = r.left - s.left, cx = W / 2;
    for (var i = 0; i < CONFIG.shed; i++) {
      var x = left + rand(0.05, 0.95) * r.width;
      var ridgeHere = ridgeY + Math.abs(x - cx) * 0.22;   // the ridge falls away from its peak
      specks.push({
        x: x, y: Math.min(bottom, ridgeHere) - rand(0, 10),
        vx: rand(-40, 40), vy: rand(10, 70), life: 0, max: rand(0.8, 1.8),
        r: rand(0.6, 2.2),
      });
    }
  }

  function paint(dt) {
    // the sky
    skyCtx.clearRect(0, 0, skyCanvas.width, skyCanvas.height);
    if (sky && (pullK || 0) < 0.8) {                  // gone from view past that: don't draw it
      sky.draw(skyCtx, skyFx);
      if (typeof AmbientStorm !== "undefined") AmbientStorm.draw(skyCtx, skyCanvas.width, skyCanvas.height, { alpha: 0.7, palette: "ember" });
      if (typeof GlimpseOrbiter !== "undefined") GlimpseOrbiter.draw(skyCtx, skyCanvas.width, skyCanvas.height, { dpr: dpr });
    }

    // the dust (additive, CSS pixels)
    dustCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dustCtx.clearRect(0, 0, W, H);
    dustCtx.globalCompositeOperation = "lighter";
    var t = performance.now() / 1000;
    var air = 1 - (pullK || 0);                    // the dust thins as we leave the surface
    for (var i = 0; air > 0.01 && i < motes.length; i++) {
      var m = motes[i];
      m.x -= m.v * dt;                             // the wind blows right to left
      m.y += Math.sin(t * 0.6 + m.ph) * 4 * dt;
      if (m.x < -10) { m.x = W + 10; m.y = rand(H * 0.25, H); }
      var d = m.r * 3;
      dustCtx.globalAlpha = m.a * air;
      dustCtx.drawImage(sprite, m.x - d, m.y - d, d * 2, d * 2);
    }

    // inside the eye: stars kindle in the black, drifting out from the
    // centre as if we are falling toward it
    var inBlack = (deep || 0) * (1 - (warpVis || 0));  // the warp takes over from them
    if (inBlack > 0.001) {
      if (!voidStars) voidStars = makeVoidStars();
      var cxs = W / 2, cys = H / 2, rMax = Math.hypot(cxs, cys);
      for (var v = 0; v < voidStars.length; v++) {
        var st = voidStars[v];
        st.r += st.v * (0.3 + deep) * (voidBoost || 1) * dt;
        if (st.r > rMax) { st.r = rand(0, rMax * 0.3); st.a0 = 0; }
        st.a0 = Math.min(1, st.a0 + dt * 0.8);
        var sx = cxs + Math.cos(st.th) * st.r, sy = cys + Math.sin(st.th) * st.r;
        var tw = 0.7 + 0.3 * Math.sin(t * st.tws + st.ph);
        var sz = st.s * (0.6 + st.r / rMax);
        dustCtx.globalAlpha = inBlack * st.a0 * st.a * tw;
        dustCtx.drawImage(starSprite, sx - sz, sy - sz, sz * 2, sz * 2);
      }
    }
    for (var j = specks.length - 1; j >= 0; j--) {
      var p = specks[j];
      p.life += dt;
      if (p.life >= p.max) { specks.splice(j, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.985; p.vy *= 0.97;
      var k = p.life / p.max, dd = p.r * 3 * (1 + k);
      dustCtx.globalAlpha = 0.7 * (1 - k);
      dustCtx.drawImage(sprite, p.x - dd, p.y - dd, dd * 2, dd * 2);
    }
    dustCtx.globalAlpha = 1;
    dustCtx.globalCompositeOperation = "source-over";
    if (fire && (pullK || 0) < 0.4) {
      var fade = 1 - (pullK || 0) * 2.5;
      fire.draw(t, [(px || 0) * CONFIG.pupil.rx * fade / 2296, -(py || 0) * CONFIG.pupil.ry * fade / 2296], (gaze || 0) * fade);
    }
    drawDeep(dt);
  }

  function frame(now) {
    if (!running) return;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    if (rising) shed();
    paint(dt);
    raf = requestAnimationFrame(frame);
  }

  function sync() {
    var want = onScreen && !document.hidden && !rmq.matches;
    if (want && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
    else if (!want && running) { running = false; cancelAnimationFrame(raf); }
    document.body.classList.toggle("dm-paused", document.hidden || !onScreen);
  }

  resize();
  if (reduced) {
    paint(0);
    if (typeof GlimpseOrbiter !== "undefined" && GlimpseOrbiter.image) GlimpseOrbiter.image().addEventListener("load", function () { paint(0); });
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; sync(); }).observe(stage);
  }
  document.addEventListener("visibilitychange", sync);
  sync();

  var rsW = window.innerWidth, rsT = 0;
  window.addEventListener("resize", function () {
    if (window.innerWidth === rsW && Math.abs(stage.offsetHeight - H) < 120) return; // a phone toolbar, not a real resize
    rsW = window.innerWidth;
    clearTimeout(rsT);
    rsT = setTimeout(resize, 150);
  });

  /* ----------------------------------------------------------
     The eye: blink, and a pupil that follows the pointer
     ---------------------------------------------------------- */

  function blink() {
    if (rmq.matches) return;
    mark.classList.remove("is-blink");
    void mark.offsetWidth;
    mark.classList.add("is-blink");
  }
  mark.addEventListener("animationend", function (e) {
    if (e.animationName === "dm-blink") mark.classList.remove("is-blink");
  });

  var blinkT = 0;
  function scheduleBlink() {
    clearTimeout(blinkT);
    blinkT = setTimeout(function () {
      if (!document.hidden && onScreen && pullK < 0.02) blink();
      scheduleBlink();
    }, rand(CONFIG.blinkEvery[0], CONFIG.blinkEvery[1]) * 1000);
  }

  // the crescent eases toward the pointer on an ellipse that fits the
  // almond, reaching full deflection as the pointer moves away (the
  // same feel as the header logo, logo-eye.js); the loop rests once settled
  var px = 0, py = 0, tx = 0, ty = 0, eyeRaf = 0, eyeLast = 0;
  function aimAt(clientX, clientY) {
    var r = mark.getBoundingClientRect();
    var cx = r.left + r.width * 0.498, cy = r.top + r.height * 0.601;
    var dx = clientX - cx, dy = clientY - cy;
    var dist = Math.hypot(dx, dy) || 1;
    // within reach it looks at you: the crescent draws in to a burning slit
    var near = 1 - Math.min(1, Math.max(0, (dist - r.width * 0.35) / (r.width * 0.55)));
    if (Date.now() > gazeHold) gazeTarget = near * near * (3 - 2 * near);
    var reach = Math.min(1, dist / (r.width * 0.9));
    tx = (dx / dist) * reach;
    ty = (dy / dist) * reach;
    if (!eyeRaf) { eyeLast = 0; eyeRaf = requestAnimationFrame(eyeStep); }
  }
  function eyeStep(now) {
    var dt = eyeLast ? Math.min(64, now - eyeLast) : 16.7;
    eyeLast = now;
    var k = 1 - Math.exp(-dt / 140);
    px += (tx - px) * k; py += (ty - py) * k;
    gaze += (gazeTarget - gaze) * (1 - Math.exp(-dt / 220));
    writePupil();
    if (Math.abs(tx - px) < 0.002 && Math.abs(ty - py) < 0.002 && Math.abs(gazeTarget - gaze) < 0.003) { eyeRaf = 0; return; }
    eyeRaf = requestAnimationFrame(eyeStep);
  }

  function wake() {
    if (awake) return;
    awake = true;
    stage.classList.add("is-awake");
    if (reduced) return;
    blink();
    scheduleBlink();
    window.addEventListener("pointermove", function (e) {
      if (onScreen) aimAt(e.clientX, e.clientY);
    }, { passive: true });
    // touch screens: the eye glances toward where you touch, and if that's
    // near it, it holds your gaze for a moment
    window.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return;
      gazeHold = 0;
      aimAt(e.clientX, e.clientY);
      if (gazeTarget > 0.3) {
        gazeTarget = 1;
        gazeHold = Date.now() + 2600;
        setTimeout(function () { gazeTarget = 0; if (!eyeRaf) { eyeLast = 0; eyeRaf = requestAnimationFrame(eyeStep); } }, 2700);
      }
    }, { passive: true });
    // the pointer leaves the window: it looks away
    document.addEventListener("mouseout", function (e) {
      if (!e.relatedTarget) { gazeTarget = 0; if (!eyeRaf) { eyeLast = 0; eyeRaf = requestAnimationFrame(eyeStep); } }
    });
  }

  /* ----------------------------------------------------------
     THE JOURNEY (scroll). The stage is pinned inside .dm-journey;
     each chapter owns a stretch of scroll (vh) and gets a local
     progress k (0..1). Progress is eased toward the scroll position
     (frame-rate independent) and the loop rests once it arrives.

     Chapter 1, "Pull-in" (0 to 320vh): the eye is the black hole
       the whole mark swells around the eye, slowly and then faster,
       as if pulled; the eye drifts to the centre of the frame; the
       land drops away and the sky dims; the cream tile and the gold
       mark sweep past the edges until only the black of the eye is
       left. The crescent grows far less than the rest (it is being
       pulled in ahead of us), so it ends centred and lit, about a
       third of the screen tall: chapter 2 stretches it. Stars
       kindle in the black.

     Chapter 2, "Stretch" (320 to 460vh)
       spaghettification: the crescent is pulled wider and thinner
       until it is a hairline, its light running off both edges of
       the frame; then it snaps to a point in a flash. The stars in
       the black race outward.

     Chapter 3, "Warp" (460 to 780vh)
       the snap is the jump: the Services page's starfield (services.js)
       at full warp, long trails, easing down to a cruise. The scroll
       sets the target speed; the stars themselves fly on time. Once the
       warp is running, the client logos come through it one after
       another: each appears near the centre, readable, then stretches
       right across the screen into a streak as it rushes past with the
       stars, heating cream to amber to white-hot, then gone.

     Chapter 4, "Belt" (780 to 980vh)
       the WORX BELT (demo-belt.js, from services.js) swells out of the
       dark, its asteroids tumbling; scrolling turns the ring; then the
       camera rises through the ring's plane and it thins to a streak.

     Chapters 5 and 6, after Interstellar's tesseract (demo-space.js)
       Tesseract (980 to 1300vh): the warp's stars fade into the dark and
         a corridor of glowing frames appears, flown slowly toward its
         vanishing point, where the airlock appears and grows until it
         fills the view.
       Arrival (1300 to 1560vh): the hatch splits through the logo's
         eye, light pours through, the whole new planet framed in the
         gap; we push through the ring, the planet settles huge and low,
         and the booking form comes forward out of the light, right
         there (the page's own form, moved into .dm-arrival; with no
         journey it stays in the section below).
     ---------------------------------------------------------- */

  var journey = document.getElementById("demo-bay");
  var CHAPTERS = [
    { id: "pull", vh: 320 },
    { id: "stretch", vh: 140 },
    { id: "warp", vh: 320 },                // long enough for the logos to come through
    { id: "belt", vh: 200 },
    { id: "tesseract", vh: 320 },           // a slow approach to the door
    { id: "arrive", vh: 260 },
  ];
  // caption bands: [chapter, appear, disappear], in vh from that chapter's
  // start, so changing a chapter's length never moves another's captions
  var BANDS = {
    pull: ["pull", 206, 356],               // once the black of the eye has the screen
    stretch: ["stretch", 36, 141],          // gone by the snap
    warp: ["warp", 40, 150],
    brands: ["warp", 168, 312],             // while the logos come through
    tesseract: ["tesseract", 24, 230],
    docking: ["arrive", 4, 92],             // gone as the booking form comes forward
  };
  // the client logos that streak through the warp (static/assets/clients)
  var CLIENTS = [
    ["chaumet", "svg"], ["hyundai", "svg"], ["modon", "svg"], ["genesis", "png"],
    ["kia", "svg"], ["uae-pavilion", "png"], ["hudayriyat", "svg"], ["wealthface", "png"],
    ["hisense", "svg"], ["unicef", "svg"], ["universal-pictures", "svg"], ["roxy-cinemas", "png"],
    ["lg", "svg"], ["tiara-dream", "svg"], ["duni", "png"], ["glimpse", "png"],
  ];
  var CRESCENT = { cx: 2852, cy: 3455, h: 1780 / 5731 };  // logo units; its height as a share of the tile
  var EYE = { h: 2296 / 5732, w: 4732 / 5731, y: 0.601 };

  var chStart = {}, chLen = {}, totalVh = 0;
  CHAPTERS.forEach(function (c) { chStart[c.id] = totalVh; chLen[c.id] = c.vh; totalVh += c.vh; });
  var journeyOn = !reduced && !!journey;
  var pullK = 0, deep = 0, pupilScale = 1;
  var stretchK = 0, stretchX = 1, stretchY = 1, pupilFade = 1, voidBoost = 1, flash = 0;
  var warpVis = 0, warpTarget = 0.4, warpSpeed = 0.4;
  var beltK = 0, beltPresence = 0, beltSpin = 0, beltDrift = 0, beltGeo = null;
  var tess = { a: 0, z: 0, drift: 0 }, world = { a: 0, cx: 0, cy: 0, r: 0 };
  var formIn = -1, formLive = false;
  var doorView = 0, doorOpen = 0, push = 0, warpFade = 1;
  var jTarget = 0, jShown = -1, jRaf = 0, jLast = 0;
  var jRange = 1;
  var halo = document.createElement("div");
  halo.className = "dm-halo";
  halo.setAttribute("aria-hidden", "true");
  stage.insertBefore(halo, dustCanvas);
  var dawnEl = q(".dm-dawn", stage), copyEl = q(".dm-copy", stage), cueEl = q(".dm-scroll", stage);
  var streak = document.createElement("div");
  streak.className = "dm-streak";
  streak.setAttribute("aria-hidden", "true");
  stage.insertBefore(streak, dustCanvas);
  var warpCanvas = q(".dm-warp", stage), beltCanvas = q(".dm-belt", stage), fallLayer = q(".dm-falls", stage);
  var spaceCanvas = q(".dm-space", stage), planetCanvas = q(".dm-planet", stage), doorEl = q(".dm-door", stage);
  var arrival = q(".dm-arrival", stage);                        // where the booking form comes forward
  var spaceCtx = spaceCanvas.getContext("2d"), spaceDrawn = false, planetDrawn = false;
  var hasSpace = typeof WorxSpace !== "undefined";
  var planetGL = hasSpace ? WorxSpace.planet(planetCanvas) : null;
  if (!planetGL) planetCanvas.classList.add("is-fallback");      // no WebGL: a CSS disc stands in
  var hatchWhole = null, hatchTop = null, hatchBot = null, doorLight = null;
  if (hasSpace && journeyOn) {
    doorEl.innerHTML = WorxSpace.door();
    hatchWhole = q(".dm-hatch--whole", doorEl);
    hatchTop = q(".dm-hatch-half--top", doorEl);
    hatchBot = q(".dm-hatch-half--bot", doorEl);
    doorLight = q(".dm-door-light", doorEl);
  }
  // each logo: a glow wrapper (so the glow follows the logo's own shape)
  // round a cream silhouette of the logo file (a CSS mask)
  var falls = CLIENTS.map(function (c, i) {
    var el = document.createElement("span");
    el.className = "dm-fall";
    var ink = document.createElement("i");
    var url = "../static/assets/clients/" + c[0] + "." + c[1];
    ink.style.webkitMaskImage = ink.style.maskImage = "url('" + url + "')";
    el.appendChild(ink);
    fallLayer.appendChild(el);
    // each leaves by its own side (alternating left and right), on its own
    // lane a little above or below the centre
    return { el: el, ink: ink, op: -1, heat: -1, side: i % 2 ? 1 : -1,
      lane: (Math.floor(i / 2) % 2 ? 1 : -1) * (0.12 + ((i * 0.618034) % 1) * 0.7), dx: ((i * 0.381966) % 1) - 0.5 };
  });
  var bands = qa(".dm-band", stage).map(function (el) { return { el: el, ch: el.dataset.ch, op: -1, k: -1 }; });

  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var smooth = function (t) { return t * t * (3 - 2 * t); };
  var local = function (vhPos, id) { return clamp01((vhPos - chStart[id]) / chLen[id]); };

  if (journeyOn) {
    journey.style.setProperty("--journey", "calc(" + totalVh + "vh + 100svh)");
    root.classList.add("dm-journey-on");                        // the panel overlaps the journey's end (demo.css)
  }

  function measureJourney() {
    jRange = Math.max(1, journey.offsetHeight - stage.offsetHeight);
  }
  function scrollProgress() {
    return clamp01(-journey.getBoundingClientRect().top / jRange);
  }

  // the crescent's transform: the pointer follow (fading out as we're
  // pulled in) and the counter-scale that holds its size back
  function writePupil() {
    var f = 1 - pullK;
    var tr = "translate(" + (px * CONFIG.pupil.rx * f).toFixed(1) + " " + (py * CONFIG.pupil.ry * f).toFixed(1) + ")";
    if (pupilScale !== 1 || stretchX !== 1) {
      tr += " translate(" + CRESCENT.cx + " " + CRESCENT.cy + ") scale(" + (pupilScale * stretchX).toFixed(4) + " " + (pupilScale * stretchY).toFixed(4) + ") translate(" + -CRESCENT.cx + " " + -CRESCENT.cy + ")";
    }
    for (var i = 0; i < pupils.length; i++) {
      pupils[i].setAttribute("transform", tr);
      pupils[i].style.opacity = pupilFade < 1 ? pupilFade.toFixed(3) : "";
    }
    var g = gaze * Math.max(0, 1 - pullK * 4);
    g = g * g * (3 - 2 * g);
    var C = CRESCENT.cx + " " + CRESCENT.cy, nC = -CRESCENT.cx + " " + -CRESCENT.cy;
    for (var j = 0; j < crescents.length; j++) {
      crescents[j].setAttribute("transform", g ? "translate(" + C + ") scale(" + (1 - 0.72 * g).toFixed(3) + " 1) translate(" + nC + ")" : "");
      crescents[j].setAttribute("opacity", (1 - g).toFixed(3));
      slits[j].setAttribute("transform", "translate(" + C + ") scale(" + (0.3 + 0.7 * g).toFixed(3) + " " + (0.65 + 0.35 * g).toFixed(3) + ") translate(" + nC + ")");
      slits[j].setAttribute("opacity", g.toFixed(3));
    }
  }

  function pullIn(k) {
    pullK = k;
    if (riseDone && mark.style.transform) mark.style.transform = "";
    var mk = mark.offsetWidth;
    var e = Math.pow(k, 2.4);                                   // slow, then the pull
    var sEnd = Math.max(2.4 * H / (mk * EYE.h), 2.4 * W / (mk * EYE.w));
    var S = 1 + (sEnd - 1) * e;
    var eyeY = mark.offsetTop + mk * EYE.y;
    var dy = (H * 0.5 - eyeY) * smooth(k);
    mark.style.translate = k ? "0 " + dy.toFixed(1) + "px" : "";
    mark.style.scale = k ? S.toFixed(4) : "";
    mark.style.setProperty("--glow", (1 - clamp01(k * 3)).toFixed(3));
    mark.style.setProperty("--fire", (1 - clamp01(k * 2.5)).toFixed(3));

    var base = mk * CRESCENT.h;
    var want = base + (H * 0.34 - base) * smooth(k);
    pupilScale = k ? want / (base * S) : 1;
    writePupil();

    // the land drops away, the air thins, the surface copy goes
    var fall = clamp01(k * 1.6);
    terrain.style.translate = k ? "0 " + (H * 0.75 * fall * fall).toFixed(1) + "px" : "";
    terrain.style.opacity = (1 - clamp01(k * 2.2)).toFixed(3);
    skyCanvas.style.opacity = (1 - clamp01((k - 0.15) * 1.8)).toFixed(3);
    dawnEl.style.opacity = (1 - clamp01(k * 2.5)).toFixed(3);
    copyEl.style.opacity = cueEl.style.opacity = (1 - clamp01(k * 7)).toFixed(3);
    stage.classList.toggle("is-travelling", k > 0.02);

    // inside the eye: stars, and the crescent's own light
    deep = smooth(clamp01((k - 0.55) / 0.4));
    halo.style.opacity = deep.toFixed(3);
  }

  // Chapter 2: the crescent stretches into a hairline, which snaps
  function stretchOut(k) {
    stretchK = k;
    var e = Math.pow(clamp01(k / 0.62), 1.7);
    stretchX = 1 + 5 * e;                                       // wider...
    stretchY = 1 - 0.965 * e;                                   // ...and thinner
    pupilFade = 1 - smooth(clamp01((k - 0.5) / 0.25));          // the light takes over from the shape
    writePupil();

    // the streak: the stretched crescent's light, running off the edges, then the snap
    var cw = H * 0.34 * 1.007;                                  // the crescent's width at the end of the pull
    var len = k < 0.62 ? cw * stretchX : cw * 6 + (W * 1.7 - cw * 6) * smooth((k - 0.62) / 0.24);
    if (k > 0.86) len = W * 1.7 * (1 - smooth(clamp01((k - 0.86) / 0.1)));
    var on = smooth(clamp01((k - 0.18) / 0.25)) * (1 - clamp01((k - 0.96) / 0.04));
    streak.style.opacity = on.toFixed(3);
    streak.style.transform = "translate(-50%, -50%) scaleX(" + Math.max(0.0005, len / W).toFixed(4) + ")";

    // the snap's flash, and the stars in the black racing outward
    flash = Math.sin(Math.PI * clamp01((k - 0.9) / 0.1));
    voidBoost = 1 + 7 * smooth(k);
    halo.style.opacity = Math.max(deep * (1 - smooth(clamp01((k - 0.6) / 0.3))), flash).toFixed(3);
    halo.style.scale = (1 + flash * 1.8).toFixed(3);
    mark.style.visibility = k > 0.97 ? "hidden" : "";          // nothing left of it to see
  }

  // Chapter 3: warp. The snap throws the starfield to full speed, which
  // eases down to a cruise; the belt then slows it further
  function warpOut(k, belt) {
    placeFalls(stretchK >= 1 ? k : 0);                          // the logos only ride the running warp
    var into = smooth(clamp01((stretchK - 0.9) / 0.1));        // it appears with the snap
    warpVis = into * warpFade;
    warpCanvas.style.opacity = warpVis.toFixed(3);
    if (belt > 0) warpTarget = 0.5;                             // the belt: a slow drift
    else if (stretchK < 0.9) warpTarget = 0.4;                  // not yet (and not visible)
    else warpTarget = 0.4 + 38 * (1 - smooth(clamp01((k - 0.08) / 0.92)));  // full warp, easing down
  }

  // Chapter 4: the belt, and the client logos riding it
  function beltIn(k) {
    beltK = k;
    var arrive = smooth(clamp01(k / 0.3)), leave = smooth(clamp01((k - 0.72) / 0.28));
    beltPresence = arrive * (1 - leave * 0.85) * (1 - smooth(clamp01((k - 0.9) / 0.1)));
    var scale = 0.55 + 0.45 * arrive + 0.35 * leave;
    var arcB = Math.min(H * 0.16, W * 0.2);
    beltGeo = {
      cx: W / 2, cy: H * 0.47, a: Math.max(W * 0.44, 300) * scale, b: arcB * scale,
      flat: 1 - 0.9 * leave, k: beltPresence, scale: 0.8 + 0.3 * scale,
    };
    beltSpin = k * 2.6;                                         // scrolling turns the ring
    beltCanvas.style.opacity = beltPresence > 0.005 ? "1" : "0";
  }

  // Chapter 5: the tesseract, and the airlock at the end of it. The
  // warp's stars fade into the dark as the lattice comes in.
  function tesseractIn(k, ak) {
    var through = smooth(clamp01((ak - 0.32) / 0.3));             // as arrival pushes through the ring
    tess.a = smooth(clamp01(k / 0.14)) * (1 - through);
    warpFade = 1 - smooth(clamp01(k / 0.16));
    tess.z = k * 9;
    doorView = k < 0.35 ? 0 : Math.pow((k - 0.35) / 0.65, 2.2);   // out of the vanishing point
  }

  // Chapter 6: arrival
  function arriveIn(k) {
    doorOpen = smooth(clamp01((k - 0.04) / 0.26));
    push = smooth(clamp01((k - 0.22) / 0.3));
    var size = doorEl.offsetWidth || Math.min(H * 0.78, W * 0.88);
    var scale = (k > 0 ? 1 : doorView) * (1 + 5 * push * push);
    var dop = (doorView > 0.001 || k > 0 ? smooth(clamp01(doorView * 4)) : 0) * (1 - smooth(clamp01((k - 0.42) / 0.12)));
    doorEl.style.transform = "translate(-50%, -50%) scale(" + Math.max(0.001, scale).toFixed(4) + ")";
    doorEl.style.opacity = dop.toFixed(3);
    doorEl.style.visibility = dop > 0.001 ? "visible" : "hidden";
    if (hatchWhole) {
      var open = doorOpen > 0.001;
      hatchWhole.style.visibility = open ? "hidden" : "";
      hatchTop.style.visibility = hatchBot.style.visibility = open ? "visible" : "hidden";
      var gap = doorOpen * 430;
      hatchTop.setAttribute("transform", "translate(0 " + (-gap).toFixed(1) + ")");
      hatchBot.setAttribute("transform", "translate(0 " + gap.toFixed(1) + ")");
      doorLight.setAttribute("y", (WorxSpace.SPLIT_Y - gap).toFixed(1));
      doorLight.setAttribute("height", Math.max(2, gap * 2).toFixed(1));
      doorLight.setAttribute("opacity", (open ? 0.85 * (1 - push) : 0).toFixed(3));
    }

    // the planet: first seen whole through the parted hatch, then, as we
    // push through, huge and low in the view
    var inner = size * 0.446 * scale;                              // the hatch opening, on screen
    var big = Math.max(W, H) * 0.9;
    world.a = smooth(clamp01((k - 0.1) / 0.15));
    world.r = inner * 0.72 + (big - inner * 0.72) * push;
    world.cx = W / 2;
    world.cy = H / 2 + (H * 0.56 + big - H / 2) * push;           // horizon at 56% of the view
    planetCanvas.style.clipPath = dop > 0.02 && push < 0.98 ? "circle(" + Math.max(0, inner).toFixed(1) + "px at 50% 50%)" : "none";
    planetCanvas.style.opacity = world.a.toFixed(3);
    if (k > 0) warpFade = Math.max(warpFade, push * 0.7);          // the new world's sky: faint stars

    // the booking form comes forward out of the light, right here
    var f = smooth(clamp01((k - 0.3) / 0.2));
    if (Math.abs(f - formIn) > 0.003) {
      formIn = f;
      arrival.style.opacity = f.toFixed(3);
      arrival.style.transform = "translate(-50%, -50%) translateY(" + ((1 - f) * 34).toFixed(1) + "px) scale(" + (0.94 + 0.06 * f).toFixed(4) + ")";
      var live = f > 0.6;
      if (live !== formLive) {
        formLive = live;
        arrival.style.pointerEvents = live ? "auto" : "none";
        if (live) arrival.removeAttribute("inert"); else arrival.setAttribute("inert", "");
      }
    }
  }

  // the logos, through the warp (k: the warp's progress). One after
  // another each appears near the centre, where the stars stream from,
  // readable as the brand, then stretches into a thick streak and rushes
  // off its side of the screen (alternating left and right) with the
  // stars, heating cream -> amber -> white-hot, then gone. The last one
  // is through well before the warp ends, so none is ever left hanging
  // across the screen in the chapters after it.
  var FALL = { first: 0.08, every: 0.048, span: 0.15 };
  var heatAt = function (u) {                                   // cream -> amber -> white-hot
    var a = [254, 238, 207], b = [250, 167, 25], c = [255, 249, 234];
    var f = u < 0.55 ? u / 0.55 : (u - 0.55) / 0.45, x = u < 0.55 ? a : b, y = u < 0.55 ? b : c;
    return "rgb(" + [0, 1, 2].map(function (j) { return Math.round(x[j] + (y[j] - x[j]) * f); }).join(",") + ")";
  };
  function placeFalls(k) {
    var any = false, base = Math.min(170, Math.max(96, W * 0.11));
    for (var i = 0; i < falls.length; i++) {
      var L = falls[i], u = (k - (FALL.first + i * FALL.every)) / FALL.span;
      var op = u <= 0 || u >= 1 ? 0 : smooth(clamp01(u / 0.12)) * (1 - smooth(clamp01((u - 0.9) / 0.1)));
      if (Math.abs(op - L.op) > 0.005 || (op === 0 && L.op !== 0)) { L.op = op; L.el.style.opacity = op.toFixed(3); }
      if (op <= 0) continue;
      any = true;
      var e = smooth(u);
      var w = base / 160 * (0.9 + 0.3 * e);
      // it arrives readable as the brand, then is stretched out as it goes:
      // about 0.9x the view wide, thinning a little but staying thick
      var st = Math.pow(e, 1.4);
      var sx = 1 + (W * 0.9 / (160 * w) - 1) * st, sy = 1 - 0.5 * st;
      // ...and off to its side: by the end its inner edge is past the screen's edge
      var half = 80 * sx * w;
      var x = W / 2 + L.dx * W * 0.08 + L.side * (W / 2 + half) * Math.pow(e, 1.7);
      var y = H / 2 + L.lane * H * 0.26 * (0.45 + 0.55 * e);
      L.el.style.transform = "translate3d(" + (x - 80).toFixed(1) + "px," + (y - 32).toFixed(1) + "px,0) scale(" + (sx * w).toFixed(3) + "," + (sy * w).toFixed(3) + ")";
      var heat = clamp01((u - 0.2) / 0.75);
      if (Math.abs(heat - L.heat) > 0.02) {
        L.heat = heat;
        L.ink.style.background = heatAt(heat);
        L.el.style.setProperty("--glow", (2 + 16 * heat).toFixed(1) + "px");
      }
    }
    fallLayer.style.visibility = any ? "visible" : "hidden";
  }

  // ---- the warp's starfield (services.js's, flown by the journey) ----
  // 3D points flying at the camera; the faster they go, the less of the
  // last frame is wiped, so the trails stretch
  var warpCtx = warpCanvas.getContext("2d"), warpStars = [], warpDrawn = false;
  var belt = typeof WorxBelt !== "undefined" ? WorxBelt.create(beltCanvas) : null, beltDrawn = false;

  function spawnWarp(st, far) {
    st.x = (Math.random() - 0.5) * W * 2;
    st.y = (Math.random() - 0.5) * H * 2;
    st.z = far ? W : Math.random() * W;
    st.pz = st.z;
    st.amber = Math.random() < 0.18;
    return st;
  }
  function projectWarp(st, z) {
    var k = 128 / z * 0.004;
    return [st.x * k * W / 2 + W / 2, st.y * k * H / 2 + H / 2];
  }

  // called by resize() (which also runs before this section is set up)
  function sizeDeep() {
    if (!warpCanvas || !journeyOn) return;
    var d = Math.min(window.devicePixelRatio || 1, 1.5);
    warpCanvas.width = Math.max(1, Math.round(W * d));
    warpCanvas.height = Math.max(1, Math.round(H * d));
    warpCtx.setTransform(d, 0, 0, d, 0, 0);
    warpStars = [];
    for (var i = 0, n = W < 700 ? 260 : 520; i < n; i++) warpStars.push(spawnWarp({}, false));
    warpDrawn = false;
    if (belt) belt.resize(W, H, Math.min(window.devicePixelRatio || 1, 2));
    spaceCanvas.width = Math.max(1, Math.round(W * d));
    spaceCanvas.height = Math.max(1, Math.round(H * d));
    spaceCtx.setTransform(d, 0, 0, d, 0, 0);
    spaceDrawn = false;
    if (planetGL) planetGL.resize(W, H, d);
  }
  sizeDeep();

  function drawWarp(dt) {
    var f = dt * 60;
    warpCtx.fillStyle = "rgba(10, 5, 7, " + (warpSpeed > 6 ? 0.28 : 0.9) + ")";
    warpCtx.fillRect(0, 0, W, H);
    for (var i = 0; i < warpStars.length; i++) {
      var st = warpStars[i];
      st.pz = st.z;
      st.z -= warpSpeed * f;
      if (st.z < 1) { spawnWarp(st, true); continue; }
      var a = projectWarp(st, st.z), o = projectWarp(st, st.pz);
      if (a[0] < -50 || a[0] > W + 50 || a[1] < -50 || a[1] > H + 50) { spawnWarp(st, true); continue; }
      var depth = 1 - st.z / W, alpha = Math.min(1, 0.35 + depth * 1.6);
      warpCtx.strokeStyle = st.amber ? "rgba(250, 167, 25, " + alpha + ")" : "rgba(254, 238, 207, " + alpha + ")";
      warpCtx.lineWidth = Math.max(1, depth * 3.4);
      warpCtx.beginPath();
      warpCtx.moveTo(o[0], o[1]);
      warpCtx.lineTo(a[0] + 0.1, a[1] + 0.1);
      warpCtx.stroke();
    }
    warpDrawn = true;
  }

  // the journey's per-frame layers (called from paint)
  function drawDeep(dt) {
    if (!warpCanvas || !journeyOn) return;
    warpSpeed += (warpTarget - warpSpeed) * Math.min(1, 0.08 * dt * 60);
    if (warpVis > 0.01) drawWarp(dt);
    else if (warpDrawn) { warpCtx.clearRect(0, 0, W, H); warpDrawn = false; }
    if (belt && beltGeo && beltPresence > 0.005) {
      beltDrift += dt * 0.035;                                  // the ring's own slow turn
      belt.draw(dt, { cx: beltGeo.cx, cy: beltGeo.cy, a: beltGeo.a, b: beltGeo.b, flat: beltGeo.flat,
        k: beltGeo.k, scale: beltGeo.scale, spin: beltSpin + beltDrift, boost: 0 });
      beltDrawn = true;
    } else if (beltDrawn && belt) { belt.clear(); beltDrawn = false; }

    // the tesseract
    var now = performance.now() / 1000;
    if (hasSpace && tess.a > 0.001) {
      spaceCtx.clearRect(0, 0, W, H);
      tess.drift += dt * 0.12;
      WorxSpace.tesseract(spaceCtx, { W: W, H: H, z: tess.z + tess.drift, a: tess.a, t: now });
      spaceCanvas.style.opacity = "1";
      spaceDrawn = true;
    } else if (spaceDrawn) { spaceCtx.clearRect(0, 0, W, H); spaceCanvas.style.opacity = "0"; spaceDrawn = false; }
    if (planetGL && world.a > 0.001) { planetGL.draw(now, world); planetDrawn = true; }
    else if (planetGL && planetDrawn) { planetGL.draw(now, { a: 0 }); planetDrawn = false; }
  }

  function applyBands(vhPos) {
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i], def = BANDS[b.ch];
      if (!def) continue;
      var r = [chStart[def[0]] + def[1], chStart[def[0]] + def[2]];
      var f = 18;                                               // ramp, in vh
      var op = smooth(clamp01((vhPos - r[0]) / f)) * (1 - smooth(clamp01((vhPos - (r[1] - f)) / f)));
      var k = clamp01((vhPos - r[0]) / 26);
      if (Math.abs(op - b.op) > 0.004) { b.op = op; b.el.style.opacity = op.toFixed(3); }
      if (Math.abs(k - b.k) > 0.008) { b.k = k; b.el.style.setProperty("--k", k.toFixed(3)); }
    }
  }

  function applyJourney(p) {
    var vhPos = p * totalVh;
    pullIn(local(vhPos, "pull"));
    stretchOut(local(vhPos, "stretch"));
    var bk = local(vhPos, "belt");
    var tk = local(vhPos, "tesseract"), ak = local(vhPos, "arrive");
    tesseractIn(tk, ak);
    arriveIn(ak);
    warpOut(local(vhPos, "warp"), bk);
    if (ak > 0) warpTarget = 0.12;                                // the new world's sky: barely drifting
    beltIn(bk);
    applyBands(vhPos);
    if (!running && deep > 0) paint(0);                         // stars need a frame even when the loop sleeps
  }

  function jTick(now) {
    var dt = jLast ? Math.min(100, now - jLast) : 16.7;
    jLast = now;
    jShown += (jTarget - jShown) * (1 - Math.pow(1 - 0.14, dt / 16.667));
    if (Math.abs(jTarget - jShown) < 0.0004) { jShown = jTarget; jRaf = 0; jLast = 0; }
    else jRaf = requestAnimationFrame(jTick);
    applyJourney(jShown);
  }

  function onJourneyScroll() {
    if (journeyPaused) return;
    jTarget = scrollProgress();
    if (riseTl && !riseDone && jTarget > 0) riseTl.progress(1);   // finish the rise before the journey moves the mark
    if (jShown < 0) { jShown = jTarget; applyJourney(jShown); return; }
    if (!jRaf && Math.abs(jTarget - jShown) > 0.0004) { jLast = 0; jRaf = requestAnimationFrame(jTick); }
  }

  var journeyPaused = false;
  if (journeyOn) {
    measureJourney();
    onJourneyScroll();
    window.addEventListener("scroll", onJourneyScroll, { passive: true });
    window.addEventListener("resize", function () { measureJourney(); jShown = -1; onJourneyScroll(); });

    // reduced motion, honoured live in both directions. On: the journey
    // collapses (demo.css), so put the scene back to its surface state,
    // stop driving it, and keep the visitor at the eye instead of wherever
    // their old scroll position now lands. Off: re-measure and fly again.
    rmq.addEventListener("change", function (e) {
      if (e.matches) {
        if (jRaf) { cancelAnimationFrame(jRaf); jRaf = 0; }
        if (flight) { flight.kill(); flight = null; }
        applyJourney(0);
        jShown = 0;
        journeyPaused = true;
        root.classList.remove("dm-journey-on");
        dockForm(false);
        window.scrollTo({ top: journey.offsetTop, behavior: "instant" });
      } else {
        journeyPaused = false;
        root.classList.add("dm-journey-on");
        dockForm(true);
        measureJourney();
        jShown = -1;
        onJourneyScroll();
        blink();
        scheduleBlink();
      }
      sync();
    });
  }

  // the eye: "take me in", a flight through the journey to the form
  var eyeBtn = q(".dm-eye-btn", mark);
  var glimpse = document.getElementById("glimpse");
  var flight = null;

  // the booking form: one form, in one of two places. While the journey
  // runs it sits at the door (.dm-arrival); with no journey (reduced motion)
  // it stays in the page's section, as written.
  var formHead = glimpse && q(".dm-glimpse-head", glimpse), formCards = glimpse && q(".dm-cards", glimpse);
  var formSteps = glimpse && q(".dm-steps", glimpse);
  function dockForm(atDoor) {
    if (!arrival || !formHead || !formCards) return;
    if (atDoor) { arrival.appendChild(formHead); arrival.appendChild(formCards); }
    else { formSteps.parentNode.insertBefore(formHead, formSteps); formSteps.parentNode.insertBefore(formCards, formSteps); }
  }
  if (journeyOn) dockForm(true);
  // where the flight ends: the form fully forward at the door
  function formScrollY() {
    return journey.offsetTop + (chStart.arrive + chLen.arrive * 0.56) / totalVh * jRange;
  }

  function goToPanel() {
    if (!glimpse) return;
    var y = glimpse.getBoundingClientRect().top + window.pageYOffset;
    window.scrollTo({ top: y, behavior: "instant" });
    glimpse.classList.add("is-in");
    glimpse.focus({ preventScroll: true });
  }

  function flyIn() {
    var from = window.pageYOffset;
    var to = formScrollY();
    var seconds = Math.min(12, 1.2 + (to - from) / window.innerHeight * 0.9);
    var pos = { y: from };
    var stop = function () { if (flight) { flight.kill(); flight = null; } off(); };
    var off = function () { ["wheel", "touchstart", "keydown"].forEach(function (t) { window.removeEventListener(t, stop); }); };
    ["wheel", "touchstart", "keydown"].forEach(function (t) { window.addEventListener(t, stop, { passive: true }); });
    flight = gsap.to(pos, {
      y: to, duration: seconds, ease: "power1.inOut",
      onUpdate: function () { window.scrollTo({ top: pos.y, behavior: "instant" }); },
      onComplete: function () { flight = null; off(); arrival.focus({ preventScroll: true }); },
    });
  }

  eyeBtn.addEventListener("click", function (e) {
    e.preventDefault();
    if (!journeyOn || !hasGsap) { goToPanel(); return; }
    if (!flight) flyIn();
  });

  // the panel waits a little way back, and comes forward when it's reached
  if (glimpse) {
    root.classList.add("dm-live-panel");
    if ("IntersectionObserver" in window) {
      var pio = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { glimpse.classList.add("is-in"); pio.disconnect(); }
      }, { threshold: 0.12 });
      pio.observe(glimpse);
    } else {
      glimpse.classList.add("is-in");
    }
  }

  /* ----------------------------------------------------------
     The booking form: calendar + "we call you".
     Sending is the Quick Enquiry's pair (contact-widget.js): Formspree
     drops the lead in the Worx inbox, then EmailJS sends the visitor
     their confirmation through the same template (template_j30lcxg),
     with the same {{variables}}; what this form doesn't ask goes in
     as "-". The EmailJS SDK is fetched on the first send.
     ---------------------------------------------------------- */

  var BACKEND = {
    calendlyUrl: "",            // TODO: the Calendly link, when there is one
    formspree: "https://formspree.io/f/xeaojvzn",
    emailjs: {
      sdk: "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js",
      publicKey: "wm49sHmSgdQ04r0O-",
      serviceId: "service_5rgzqe1",
      templateId: "template_j30lcxg",
    },
    recipient: "hello@worxbyglimpse.com",
  };

  var cal = q(".dm-cal");
  if (cal) {
    if (BACKEND.calendlyUrl) {
      cal.href = BACKEND.calendlyUrl;
    } else {
      cal.addEventListener("click", function (e) {
        e.preventDefault();
        console.warn("demo.js: BACKEND.calendlyUrl is not set yet.");
      });
    }
  }

  var sdkLoading = null;
  function loadEmailJs() {
    if (window.emailjs) return Promise.resolve(window.emailjs);
    if (sdkLoading) return sdkLoading;
    sdkLoading = new Promise(function (resolve, reject) {
      var sc = document.createElement("script");
      sc.src = BACKEND.emailjs.sdk;
      sc.async = true;
      sc.onload = function () { if (window.emailjs) resolve(window.emailjs); else reject(new Error("EmailJS SDK missing")); };
      sc.onerror = function () { sdkLoading = null; reject(new Error("EmailJS SDK failed to load")); };
      document.head.appendChild(sc);
    });
    return sdkLoading;
  }

  function sendConfirmation(d) {
    var EJ = BACKEND.emailjs;
    var note = "Demo request. Phone / WhatsApp: " + d.phone;
    loadEmailJs()
      .then(function (emailjs) {
        return emailjs.send(EJ.serviceId, EJ.templateId, {
          to_name: d.name,
          to_email: d.email,
          reply_to: d.email,
          company_name: "The Worx Team",
          client_company: "-",
          services: "Book a demo",
          build_type: "-",
          message: note,
          idea: note,
          goal: "-",
          timeline: "-",
          budget: "-",
        }, { publicKey: EJ.publicKey });
      })
      .catch(function (err) {
        // best effort: Formspree already has the lead, so a failed
        // confirmation never turns the send into an error
        console.error("EmailJS confirmation failed:", err);
      });
  }

  var form = q(".dm-form");
  if (form) {
    var msg = q(".dm-form-msg", form);
    var send = q("button[type=submit]", form);
    var sending = false;
    var say = function (text, isError) {
      msg.hidden = false;
      msg.textContent = text;
      msg.classList.toggle("is-error", !!isError);
    };
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sending) return;
      var d = { name: form.name.value.trim(), email: form.email.value.trim(), phone: form.phone.value.trim() };
      if (!d.name) { say("Please add your name.", true); form.name.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) { say("That email doesn't look right, please check it.", true); form.email.focus(); return; }
      if ((d.phone.match(/\d/g) || []).length < 7) { say("Please add a phone or WhatsApp number we can call.", true); form.phone.focus(); return; }
      sending = true;
      send.disabled = true;
      send.textContent = "Sending…";
      msg.hidden = true;
      loadEmailJs().catch(function () {});                         // warm the SDK up while Formspree works
      fetch(BACKEND.formspree, {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          _subject: "Demo request from " + d.name,
          _replyto: d.email,
          source: "Book a Demo · " + location.pathname,
          services: "Book a demo",
          name: d.name,
          email: d.email,
          phone: d.phone,
        }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("Formspree responded with " + res.status);
          sendConfirmation(d);
          say("Signal received, " + d.name + ". We'll be in touch within one working day. A confirmation is on its way to " + d.email + ".");
          form.reset();
          // the send-off: stars into the Worx eye, then WORX (form-finale.js)
          if (window.WorxFinale) WorxFinale.play({ name: d.name, onClose: function () { msg.tabIndex = -1; msg.focus(); } });
        })
        .catch(function () {
          say("That did not go through. Try again, or email " + BACKEND.recipient + ".", true);
        })
        .then(function () {
          sending = false;
          send.disabled = false;
          send.textContent = "Send my details";
        });
    });
  }

  /* ----------------------------------------------------------
     The rise
     ---------------------------------------------------------- */

  var copy = qa(".dm-copy > *", stage);
  var dawn = q(".dm-dawn", stage);

  // no GSAP, reduced motion, or the page opened part-way down the journey
  // (a reload keeps the scroll): the settled mark, no rise
  if (!hasGsap || reduced || (journeyOn && jShown > 0)) {
    riseDone = true;
    wake();
    return;
  }

  root.classList.add("dm-live");
  var drop = mark.offsetHeight * 1.15;
  var tl = riseTl = gsap.timeline({ delay: 0.15 });
  tl.fromTo(dawn, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: CONFIG.dawn.dur, ease: "power2.out" }, CONFIG.dawn.at)
    .fromTo(mark, { y: drop, opacity: 0 }, {
      y: 0, duration: CONFIG.rise.dur, ease: "power3.out",
      onStart: function () { rising = true; },
      onComplete: function () { rising = false; },
    }, CONFIG.rise.at)
    // it comes up out of its own light: visible well before it clears the ridge
    .to(mark, { opacity: 1, duration: 0.9, ease: "power1.out" }, CONFIG.rise.at)
    .fromTo(terrain, { scale: 1 }, { scale: 1.03, duration: 3.2, ease: "power2.out" }, 0)
    .to(copy, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.12 }, CONFIG.rise.at + 1.6)
    .add(wake, CONFIG.rise.at + CONFIG.rise.dur + 0.2)
    .add(function () {
      // hand the mark back to CSS: no inline transform left fighting later states
      gsap.set([mark, dawn, copy], { clearProps: "transform,opacity" });
      mark.style.transform = "";
      riseDone = true;
      root.classList.remove("dm-live");
      // if the visitor already started the journey during the rise,
      // put the journey's own state back over what was just cleared
      if (journeyOn && jShown > 0) applyJourney(jShown);
    });
})();
