/* ============================================================
   Worx | about-cinema.js
   The director's layer over the About story (about-story.js runs the
   story; this only watches it, never drives it). Styles: about.css
   "Director's layer".
     - the air: Martian dust hanging in the light at three depths,
       drifting on the wind, a few out-of-focus motes near the lens,
       all leaning with the pointer (depth parallax);
     - the gust: each cut to a new shot is carried by a sweep of dust
       and light across the frame, in the direction of travel;
     - handheld: the shot breathes, a few pixels, never more.
   The story's chapter is read from .story-text.is-active, so the
   layer follows every way the story moves (wheel, keys, touch, its own
   auto-advance). Pauses off screen and in a hidden tab; reduced motion
   keeps a still frame of the air, nothing moves.
   ============================================================ */
(function () {
  "use strict";
  var story = document.getElementById("story");
  if (!story || story.classList.contains("story--fallback")) return;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var texts = [].slice.call(story.querySelectorAll(".story-texts > .story-text"));
  if (!texts.length) return;
  var TAU = Math.PI * 2;
  var el = function (tag, cls, html) { var e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; e.setAttribute("aria-hidden", "true"); return e; };

  /* ---- layers ------------------------------------------------------ */
  var air = el("canvas", "story-air");
  var gust = el("canvas", "story-gust");
  var stars = story.querySelector(".story-stars");
  // under the stars, so the sky always reads through the dust
  story.insertBefore(air, stars || story.firstChild);
  story.appendChild(gust);

  var ax = air.getContext("2d"), gx = gust.getContext("2d");
  var W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = story.clientWidth; H = story.clientHeight;
    [air, gust].forEach(function (c) {
      var cw = Math.round(W * dpr), ch = Math.round(H * dpr);
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    });
    if (!running) drawAir(0, 0);
  }

  /* ---- sprites --------------------------------------------------- */
  function sprite(stops) {
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  }
  var MOTE = sprite([[0, "rgba(255,224,170,1)"], [0.35, "rgba(250,167,25,0.45)"], [1, "rgba(229,125,35,0)"]]);
  var BOKEH = sprite([[0, "rgba(255,196,120,0.0)"], [0.62, "rgba(255,196,120,0.18)"], [0.7, "rgba(255,210,150,0.35)"], [0.78, "rgba(255,196,120,0.1)"], [1, "rgba(255,196,120,0)"]]);
  var DUST = sprite([[0, "rgba(214,140,80,0.5)"], [0.5, "rgba(180,100,55,0.2)"], [1, "rgba(150,80,40,0)"]]);

  /* ---- the air ------------------------------------------------------ */
  var seed = 17, rnd = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  var motes = [];
  for (var i = 0; i < 110; i++) {
    var d = i < 70 ? 0.25 + rnd() * 0.3 : i < 102 ? 0.6 + rnd() * 0.3 : 1.2 + rnd() * 0.5;
    // the big out-of-focus motes stay low in frame, clear of the sky
    motes.push({ x: rnd(), y: i >= 102 ? 0.55 + rnd() * 0.4 : rnd(), d: d, s: rnd() * 6.28, big: i >= 102 });
  }
  var ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("pointermove", function (e) {
    ptr.tx = e.clientX / window.innerWidth - 0.5;
    ptr.ty = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  function drawAir(t, dt) {
    if (!W) return;
    ax.setTransform(dpr, 0, 0, dpr, 0, 0);
    ax.clearRect(0, 0, W, H);
    ax.globalCompositeOperation = "lighter";
    var wind = 0.012;
    for (var k = 0; k < motes.length; k++) {
      var m = motes[k];
      if (!reduced) {
        m.x += (wind * m.d + Math.sin(t * 0.3 + m.s) * 0.002) * dt;
        m.y += (Math.cos(t * 0.21 + m.s) * 0.003 - 0.001 * m.d) * dt;
        if (m.x > 1.05) m.x -= 1.1;
        if (m.big) { if (m.y < 0.5) m.y = 0.95; else if (m.y > 1.02) m.y = 0.55; }
        else if (m.y < -0.05) m.y += 1.1; else if (m.y > 1.05) m.y -= 1.1;
      }
      var px = m.x * W - ptr.x * 60 * m.d, py = m.y * H - ptr.y * 36 * m.d;
      if (m.big) {
        var r = 26 + m.d * 30;
        ax.globalAlpha = 0.22 + 0.12 * Math.sin(t * 0.5 + m.s);
        ax.drawImage(BOKEH, px - r, py - r, r * 2, r * 2);
      } else {
        var rr = (0.8 + m.d * 2.2) * (1 + 0.25 * Math.sin(t * 1.3 + m.s * 3));
        ax.globalAlpha = 0.18 + 0.4 * m.d;
        ax.drawImage(MOTE, px - rr * 3, py - rr * 3, rr * 6, rr * 6);
      }
    }
    ax.globalAlpha = 1;
    ax.globalCompositeOperation = "source-over";
  }

  /* ---- the gust: the cut, carried by weather ----------------------- */
  var gusts = [];
  function cut(dir) {
    if (reduced || !W) return;
    var g = { t0: performance.now(), dir: dir, parts: [] };
    for (var i = 0; i < 90; i++) {
      g.parts.push({ y: rnd(), d: 0.3 + rnd() * 0.9, off: rnd() * 0.5, len: 0.05 + rnd() * 0.16, dust: rnd() < 0.55 });
    }
    gusts.push(g);
    story.classList.remove("is-cutting"); void story.offsetWidth; story.classList.add("is-cutting");
    setTimeout(function () { story.classList.remove("is-cutting"); }, 1300);
  }
  function drawGust(now) {
    gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gx.clearRect(0, 0, W, H);
    for (var gi = gusts.length - 1; gi >= 0; gi--) {
      var g = gusts[gi], u = (now - g.t0) / 1400;
      if (u >= 1) { gusts.splice(gi, 1); continue; }
      var e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      // the haze band: a soft wall of lit dust crossing the frame
      var bx = g.dir > 0 ? mix(-0.4, 1.4, e) * W : mix(1.4, -0.4, e) * W;
      var band = gx.createLinearGradient(bx - W * 0.35, 0, bx + W * 0.35, 0);
      var a = Math.sin(u * Math.PI);
      band.addColorStop(0, "rgba(120,52,22,0)");
      band.addColorStop(0.45, "rgba(170,82,38," + (0.32 * a).toFixed(3) + ")");
      band.addColorStop(0.55, "rgba(230,140,70," + (0.28 * a).toFixed(3) + ")");
      band.addColorStop(1, "rgba(120,52,22,0)");
      gx.fillStyle = band;
      gx.fillRect(0, 0, W, H);
      // streaks and grit riding it
      gx.globalCompositeOperation = "lighter";
      for (var k = 0; k < g.parts.length; k++) {
        var p = g.parts[k];
        var pu = clamp((u - p.off * 0.4) / 0.7, 0, 1);
        if (pu <= 0 || pu >= 1) continue;
        var x = g.dir > 0 ? mix(-0.2, 1.2, pu) * W : mix(1.2, -0.2, pu) * W;
        var y = p.y * H + Math.sin(pu * 6 + p.off * 10) * 8;
        var fa = Math.sin(pu * Math.PI) * a;
        if (p.dust) {
          var r = 6 + p.d * 16;
          gx.globalAlpha = 0.35 * fa;
          gx.drawImage(DUST, x - r, y - r, r * 2, r * 2);
        } else {
          var L = p.len * W * p.d;
          var gr = gx.createLinearGradient(x, y, x - g.dir * L, y);
          gr.addColorStop(0, "rgba(255,214,150," + (0.55 * fa).toFixed(3) + ")");
          gr.addColorStop(1, "rgba(250,167,25,0)");
          gx.globalAlpha = 1;
          gx.strokeStyle = gr; gx.lineWidth = 0.8 + p.d;
          gx.beginPath(); gx.moveTo(x, y); gx.lineTo(x - g.dir * L, y); gx.stroke();
        }
      }
      gx.globalAlpha = 1;
      gx.globalCompositeOperation = "source-over";
    }
  }
  function mix(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // the chapter, as the story sets it (-1 until it is first read)
  var chapter = -1;
  function readChapter() {
    var idx = -1;
    texts.forEach(function (t, k) { if (t.classList.contains("is-active")) idx = k; });
    if (idx < 0) idx = 0;
    if (idx === chapter) return;
    var from = chapter;
    if (from === -1) { chapter = idx; story.dataset.chapter = idx; return; }
    chapter = idx;
    story.dataset.chapter = idx;
    // SOL 01 and 02 are one continuous shot: no cut between them
    if (from >= 0 && !((from <= 1) && (idx <= 1))) cut(idx > from ? 1 : -1);
  }
  new MutationObserver(readChapter).observe(story.querySelector(".story-texts"), { attributes: true, subtree: true, attributeFilter: ["class"] });
  readChapter();

  /* ---- the loop ----------------------------------------------------- */
  var running = false, raf = 0, last = 0, onScreen = true, t = 0;
  function loop(now) {
    if (!running) return;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now; t += dt;
    ptr.x += (ptr.tx - ptr.x) * 0.05; ptr.y += (ptr.ty - ptr.y) * 0.05;
    drawAir(t, dt);
    drawGust(now);
    raf = requestAnimationFrame(loop);
  }
  function sync() {
    var want = onScreen && !document.hidden && !reduced;
    if (want && !running) { running = true; last = 0; raf = requestAnimationFrame(loop); }
    else if (!want && running) { running = false; cancelAnimationFrame(raf); }
  }
  if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; sync(); }).observe(story);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("resize", resize);
  resize();
  if (reduced) drawAir(0, 0);
  sync();
})();
