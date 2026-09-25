/* ============================================================
   Worx by Glimpse — blog-stars.js
   "Star wind" behind the blog index: fine orange dust streaming past
   on a slow Martian wind, drawn on one canvas over the page's blueprint
   grid and ember glow (blogs.css), which stay as they are.

   Soft orange and amber specks at three depths (far ones drift slowly
   and flicker, near ones move fastest and trail short streaks), a few
   big faint dust clouds rolling through, and now and then a warm streak
   cutting across. Kept low-key: it's there, not loud. The canvas fades
   out toward the bottom so the grid of posts stays calm.

   Pauses when the page is scrolled past or the tab is hidden;
   reduced motion gets a still star field.
   ============================================================ */
(function () {
  "use strict";

  var page = document.querySelector(".blog-page");
  if (!page) return;

  var CONFIG = {
    density: 0.00016, // stars per CSS px^2
    wind: { angle: 196, speed: 16 }, // degrees (0 = right), CSS px/s for the far layer
    // fine orange dust: soft specks at three depths, plus a few big
    // faint dust clouds (soft: true) drifting slowly through
    layers: [
      { share: 0.56, speed: 1, size: [0.6, 1.3], alpha: [0.12, 0.3], trail: 0 },
      { share: 0.28, speed: 2.2, size: [0.9, 1.8], alpha: [0.18, 0.38], trail: 0 },
      { share: 0.12, speed: 4.6, size: [1.1, 2.1], alpha: [0.22, 0.42], trail: 12 },
      { share: 0.04, speed: 0.7, size: [26, 70], alpha: [0.03, 0.07], trail: 0, soft: true }
    ],
    colours: ["229, 125, 35", "250, 167, 25", "214, 110, 50", "255, 176, 104"],
    shootingEvery: [8, 16], // seconds between shooting stars (dust streaks)
    maxStars: 520
  };

  var canvas = document.createElement("canvas");
  canvas.className = "blog-stars";
  canvas.setAttribute("aria-hidden", "true");
  page.insertBefore(canvas, page.firstChild);
  var ctx = canvas.getContext("2d");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W = 0, H = 0, dpr = 1;
  var stars = [];
  var shooting = null;
  var nextShot = 4;
  var rad = CONFIG.wind.angle * Math.PI / 180;
  var dirX = Math.cos(rad), dirY = -Math.sin(rad); // canvas y points down

  function rand(a, b) { return a + Math.random() * (b - a); }

  // one soft-edged dot per colour, so every speck reads as dust, not a
  // hard pixel star
  var sprites = {};
  function sprite(c) {
    if (sprites[c]) return sprites[c];
    var cv = document.createElement("canvas");
    cv.width = cv.height = 32;
    var g = cv.getContext("2d");
    var grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(" + c + ", 1)");
    grad.addColorStop(0.35, "rgba(" + c + ", 0.55)");
    grad.addColorStop(1, "rgba(" + c + ", 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    return (sprites[c] = cv);
  }

  function makeStar(layer, anywhere) {
    var L = CONFIG.layers[layer];
    return {
      layer: layer,
      x: anywhere ? Math.random() * W : (dirX < 0 ? W + 20 : -20),
      y: anywhere ? Math.random() * H : Math.random() * H,
      r: rand(L.size[0], L.size[1]),
      a: rand(L.alpha[0], L.alpha[1]),
      c: CONFIG.colours[Math.floor(Math.random() * CONFIG.colours.length)],
      tw: rand(0, Math.PI * 2),
      tws: rand(0.6, 1.8)
    };
  }

  function resize() {
    var rect = page.getBoundingClientRect();
    W = Math.round(rect.width);
    H = Math.round(Math.min(rect.height, Math.max(window.innerHeight * 1.6, 900)));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.height = H + "px";
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    var n = Math.min(CONFIG.maxStars, Math.round(W * H * CONFIG.density));
    stars = [];
    CONFIG.layers.forEach(function (L, li) {
      var count = Math.round(n * L.share);
      for (var i = 0; i < count; i++) stars.push(makeStar(li, true));
    });
    draw(0, 0);
  }

  function launchShot() {
    var fromTop = Math.random() < 0.6;
    shooting = {
      x: fromTop ? rand(W * 0.3, W * 1.05) : W + 10,
      y: fromTop ? -10 : rand(0, H * 0.4),
      vx: dirX * rand(520, 760),
      vy: rand(140, 240),
      life: 0,
      max: rand(0.9, 1.4)
    };
  }

  function draw(dt, t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var base = CONFIG.wind.speed;

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var L = CONFIG.layers[s.layer];
      var v = base * L.speed;
      s.x += dirX * v * dt;
      s.y += dirY * v * dt;
      // wrap round when it blows off an edge
      if (s.x < -30) { s.x = W + 20; s.y = Math.random() * H; }
      else if (s.x > W + 30) { s.x = -20; s.y = Math.random() * H; }
      if (s.y < -30) s.y = H + 20;
      else if (s.y > H + 30) s.y = -20;

      var twinkle = s.layer === 0 ? 0.65 + 0.35 * Math.sin(t * s.tws + s.tw) : 0.85 + 0.15 * Math.sin(t * s.tws + s.tw);
      var a = s.a * twinkle;

      if (L.trail && !reduceMotion) {
        var len = L.trail * (0.6 + s.r * 0.3);
        var g = ctx.createLinearGradient(s.x, s.y, s.x - dirX * len, s.y - dirY * len);
        g.addColorStop(0, "rgba(" + s.c + "," + a + ")");
        g.addColorStop(1, "rgba(" + s.c + ",0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = s.r;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - dirX * len, s.y - dirY * len);
        ctx.stroke();
      }
      var d = s.r * (L.soft ? 2 : 3.2); // soft halo around each speck
      ctx.globalAlpha = a;
      ctx.drawImage(sprite(s.c), s.x - d, s.y - d, d * 2, d * 2);
      ctx.globalAlpha = 1;
    }

    // shooting star: a bright head and a long fading tail
    if (!reduceMotion) {
      nextShot -= dt;
      if (!shooting && nextShot <= 0) {
        launchShot();
        nextShot = rand(CONFIG.shootingEvery[0], CONFIG.shootingEvery[1]);
      }
      if (shooting) {
        var sh = shooting;
        sh.life += dt;
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        var k = sh.life / sh.max;
        if (k >= 1) {
          shooting = null;
        } else {
          var fade = Math.sin(k * Math.PI);
          var sp = Math.hypot(sh.vx, sh.vy);
          var tx = sh.x - sh.vx / sp * 150, ty = sh.y - sh.vy / sp * 150;
          var sg = ctx.createLinearGradient(sh.x, sh.y, tx, ty);
          sg.addColorStop(0, "rgba(255, 190, 120," + 0.55 * fade + ")");
          sg.addColorStop(0.3, "rgba(229, 125, 35," + 0.22 * fade + ")");
          sg.addColorStop(1, "rgba(250, 167, 25, 0)");
          ctx.strokeStyle = sg;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(sh.x, sh.y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.fillStyle = "rgba(255, 200, 140," + 0.7 * fade + ")";
          ctx.beginPath();
          ctx.arc(sh.x, sh.y, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // ---- loop: only while the top of the page is on screen ----
  var running = false, inView = true, raf = 0, last = 0, t = 0;

  function tick(now) {
    raf = requestAnimationFrame(tick);
    var dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    t += dt;
    draw(dt, t);
  }

  function update() {
    var should = !reduceMotion && inView && !document.hidden;
    if (should && !running) { running = true; last = 0; raf = requestAnimationFrame(tick); }
    else if (!should && running) { running = false; cancelAnimationFrame(raf); }
  }

  resize();
  var resizeTimer = 0;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      update();
    }).observe(canvas);
  }
  document.addEventListener("visibilitychange", update);
  update();
})();
