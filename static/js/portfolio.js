/* ============================================================
   Worx | portfolio.js
   Portfolio page only. Small, self-contained pieces:

   1. initShots()    , one shared auto-scroll for every project
                        preview: duplicates the screenshot once
                        for a seamless loop, and only animates
                        cards near the viewport.
   1b-d. initCardVideos() / initReveal() / initHeroExit(), lazy
                        card clips, row-by-row card entrances and
                        the hero's caption hand-off on scroll.
   2. initHero()     , drifting-particle atmosphere over the
                        Mars hero image.
   3. initSky()      , the About page's night sky (stars,
                        storm cell, GLIMPSE orbiter) behind
                        the Mars terrain.
   4. initHud()      , the hero panel's mission clock.
   5. initArchive()  , the mission archive: the angled screens
                        (sides, reveals, the turn to face you),
                        their films and timecodes, the filter,
                        the comms tracker, the limb.
   6. initDeepSky()  , the About sky carried on behind the
                        archive (stars, storm, GLIMPSE, HOPE).

   All stand down for prefers-reduced-motion. No dependencies.
   ============================================================ */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // Full-hero canvases: 2x at most, and no more than ~4.5MP each on
  // big retina / ultra-wide screens (never below 1x).
  function heroDpr() {
    var d = Math.min(window.devicePixelRatio || 1, 2);
    var area = window.innerWidth * Math.max(window.innerHeight, 620);
    return Math.max(1, Math.min(d, Math.sqrt(4.5e6 / area)));
  }

  /* ----------------------------------------------------------
     1. Project preview auto-scroll
     ---------------------------------------------------------- */
  function initShots() {
    var cards = document.querySelectorAll(".folio-card[data-scroll]");
    if (!cards.length) return;

    // Duplicate each real screenshot once (same src → from cache)
    // so translateY(-50%) lands exactly on the seam.
    if (!reduceMotion) {
      document.querySelectorAll(".folio-card[data-scroll] .folio-shot").forEach(
        function (shot) {
          var img = shot.querySelector("img");
          if (!img) return;                 // still a placeholder
          var clone = img.cloneNode(true);
          clone.setAttribute("aria-hidden", "true");
          shot.appendChild(clone);
        }
      );
    }

    if (reduceMotion || !("IntersectionObserver" in window)) return;

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          entry.target.classList.toggle("is-live", entry.isIntersecting);
        });
      },
      { rootMargin: "240px 0px" }
    );

    cards.forEach(function (card) {
      if (card.querySelector(".folio-shot img")) io.observe(card);
    });
  }

  /* ----------------------------------------------------------
     1b. Project video previews, play only near/in view
     Videos keep autoplay's visible behaviour (muted/looping,
     starts as soon as it is near the viewport) but stop
     buffering and decoding while scrolled well away, instead of
     all 18 clips loading and playing at once on page load.

     The clips are preload="none" in the HTML, so nothing is
     fetched on page load; rootMargin is generous (600px) so
     play(), which is what starts the fetch/decode, fires well
     before a card is
     scrolled into view, giving it time to have a real frame ready
     instead of popping in on a black/blank frame.
     ---------------------------------------------------------- */
  function initCardVideos() {
    var videos = document.querySelectorAll(".folio-card-video");
    if (!videos.length) return;

    // Fade each clip up once it has a real frame (portfolio.css).
    videos.forEach(function (v) {
      function ready() { v.classList.add("is-ready"); }
      if (v.readyState >= 2) ready();
      v.addEventListener("loadeddata", ready, { once: true });
      v.addEventListener("playing", ready, { once: true });
    });

    // Reduced motion: no looping footage, just the opening frame.
    function still(v) {
      if (v.dataset.still) return;
      v.dataset.still = "1";
      v.preload = "auto";
      v.addEventListener("loadedmetadata", function () {
        try { v.currentTime = 0.05; } catch (e) {}
      }, { once: true });
      v.load();
    }

    if (!("IntersectionObserver" in window)) {
      videos.forEach(function (v) {
        if (reduceMotion) still(v);
        else v.play().catch(function () {});
      });
      return;
    }

    var near = new Set();

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var v = entry.target;
          if (reduceMotion) {
            if (entry.isIntersecting) { still(v); io.unobserve(v); }
            return;
          }
          if (entry.isIntersecting) {
            near.add(v);
            if (!document.hidden) v.play().catch(function () {}); // autoplay rejection is fine
          } else {
            near.delete(v);
            v.pause();
          }
        });
      },
      { rootMargin: "600px 0px" }
    );

    videos.forEach(function (v) { io.observe(v); });

    // Background tabs: stop decoding, pick up where they were on return.
    document.addEventListener("visibilitychange", function () {
      near.forEach(function (v) {
        if (document.hidden) v.pause();
        else v.play().catch(function () {});
      });
    });
  }

  /* ----------------------------------------------------------
     1c. Card entrance choreography
     Cards rise and their media unveils as they enter, one row
     at a time: --i is the card's column within its row, so a
     row cascades left to right and single-column phones get no
     artificial wait. Classes only; the look lives in
     portfolio.css (PREMIUM POLISH PASS).
     ---------------------------------------------------------- */
  function initReveal() {
    var grid = document.querySelector(".folio-editorial-grid");
    if (!grid || reduceMotion || !("IntersectionObserver" in window)) return;
    var cards = grid.querySelectorAll(".folio-card[data-folio-reveal]");
    if (!cards.length) return;

    function index() {
      var top = null, col = 0;
      cards.forEach(function (c) {
        var t = c.offsetTop;
        if (top === null || Math.abs(t - top) > 4) { top = t; col = 0; }
        c.style.setProperty("--i", col++);
      });
    }

    index();
    grid.classList.add("folio-reveal-armed");

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var c = entry.target;
          c.classList.add("is-in");
          io.unobserve(c);
          // drop the stagger delays once the entrance has played
          setTimeout(function () { c.classList.add("is-settled"); }, 1600);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );

    cards.forEach(function (c) { io.observe(c); });

    var t;
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(index, 200);
    });
  }

  /* ----------------------------------------------------------
     1d. Hero lift-off
     Scrolling out of the hero is the camera lifting off Mars: the
     page writes one number, --lift (0 on the surface, 1 as the hero
     leaves), and portfolio.css (HERO TITLE CARD) drops the ground
     away under the camera, tips the title back into the distance
     and closes the letterbox, while the viewfinder's altitude
     climbs to orbit, where the limb and the archive take over.
     ---------------------------------------------------------- */
  function initHeroExit() {
    var hero = document.querySelector(".folio-hero");
    var cap = hero && hero.querySelector(".folio-hero-caption");
    if (!cap || reduceMotion) return;
    var alt = hero.querySelector("[data-pf-alt]");
    var phase = hero.querySelector("[data-pf-phase]");
    var ticking = false, last = -1;

    function apply() {
      ticking = false;
      var h = hero.offsetHeight || 1;
      var p = Math.min(1, Math.max(0, window.scrollY / (h * 0.85)));
      if (Math.abs(p - last) < 0.001) return;
      last = p;
      hero.style.setProperty("--lift", p.toFixed(4));
      // an ascent: slow off the pad, then climbing fast
      if (alt) alt.textContent = (Math.pow(p, 1.8) * 412).toFixed(2);
      if (phase) phase.textContent = p < 0.02 ? "SURFACE" : p < 0.96 ? "ASCENT" : "ORBIT";
    }

    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    }, { passive: true });
    window.addEventListener("resize", apply);
    apply();
  }

  /* ----------------------------------------------------------
     2. Mars hero particles
     ---------------------------------------------------------- */
  function initHero() {
    var canvas = document.querySelector(".folio-hero-particles");
    if (!canvas) return;
    var hero = canvas.closest(".folio-hero");
    var ctx = canvas.getContext("2d");
    var dpr = heroDpr();
    var dots = [];
    var raf = 0;
    var running = false;

    function resize() {
      var r = hero.getBoundingClientRect();
      canvas.width = Math.max(1, r.width * dpr);
      canvas.height = Math.max(1, r.height * dpr);
    }

    function seed() {
      var count = Math.round((canvas.width * canvas.height) / (dpr * dpr * 13000));
      count = Math.max(24, Math.min(110, count));
      dots = [];
      for (var i = 0; i < count; i++) {
        dots.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: (Math.random() * 1.1 + 0.3) * dpr,
          a: Math.random() * 0.6 + 0.15,
          tw: (Math.random() * 0.6 + 0.2) * (Math.random() < 0.5 ? -1 : 1),
          vx: (-0.12 - Math.random() * 0.22) * dpr,
          warm: i % 6 === 0
        });
      }
    }

    function paint() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        ctx.globalAlpha = Math.max(0.06, Math.min(0.9, d.a));
        ctx.fillStyle = d.warm ? "#faa719" : "#feeecf";
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function step() {
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        d.x += d.vx;
        d.a += d.tw * 0.006;
        if (d.a < 0.08 || d.a > 0.85) d.tw *= -1;
        if (d.x < -4) {
          d.x = canvas.width + 4;
          d.y = Math.random() * canvas.height;
        }
      }
      paint();
      raf = requestAnimationFrame(step);
    }

    function start() {
      if (running) return;
      running = true;
      step();
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    resize();
    seed();

    if (reduceMotion) {
      paint();                              // one static starfield
      return;
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) {
        e[0].isIntersecting ? start() : stop();
      }).observe(hero);
    } else {
      start();
    }

    var t;
    var lastW = window.innerWidth;
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        // phones fire resize as the toolbar slides; the hero is
        // svh-sized, so only a width change needs a fresh field
        if (window.innerWidth === lastW) return;
        lastW = window.innerWidth;
        var was = running;
        stop();
        resize();
        seed();
        if (was) start(); else paint();   // stay idle while offscreen
      }, 200);
    });
  }

  /* ----------------------------------------------------------
     3. Mars hero sky, the About page's sky behind the terrain
     Same shared modules about-story.js draws on its star canvas:
     sky-fx.js (stars, Earth · Moon, Saturn, meteor), ambient-storm.js
     (the violet storm cell) and glimpse-orbiter.js (the GLIMPSE pass).
     The terrain photo sits above this canvas, so the ridge hides
     whatever falls behind it.
     ---------------------------------------------------------- */
  function initSky() {
    var canvas = document.querySelector(".folio-sky-canvas");
    if (!canvas || typeof MartianSky === "undefined") return;
    var hero = canvas.closest(".folio-hero");
    var ctx = canvas.getContext("2d");
    var dpr = heroDpr();
    var sky = new MartianSky({ reduceMotion: reduceMotion });
    var skyFx = { dpr: dpr, _cam: null, cameraOriginY: 0.62, horizonY: 0.5 };
    var rockLight = document.querySelector(".mars-terrain-fx__storm");
    var glow = 0;
    var raf = 0;
    var running = false;

    // Where the photo's ridge lands on screen: the terrain is a 3:2
    // image at background-size: cover, 54% down; the ridge averages
    // ~47% down the source image.
    function horizon(w, h) {
      var s = Math.max(w / 2400, h / 1600);
      var y = (h - 1600 * s) * 0.54 + 0.47 * 1600 * s;
      return Math.min(0.9, Math.max(0.2, y / h));
    }

    function resize() {
      var r = hero.getBoundingClientRect();
      canvas.width = Math.max(1, r.width * dpr);
      canvas.height = Math.max(1, r.height * dpr);
      skyFx.horizonY = horizon(r.width, r.height);
    }

    function paint() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sky.draw(ctx, skyFx);
      if (typeof AmbientStorm !== "undefined") AmbientStorm.draw(ctx, canvas.width, canvas.height, { alpha: 0.85 });
      // the GLIMPSE mothership and HOPE, the About page's passes
      if (typeof HopeProbe !== "undefined") HopeProbe.draw(ctx, canvas.width, canvas.height, { dpr: dpr });
      if (typeof GlimpseOrbiter !== "undefined") GlimpseOrbiter.draw(ctx, canvas.width, canvas.height, { dpr: dpr });
      sky.drawLabels(ctx, skyFx);
      // The storm's lightning bounces off the boulders below: snap up
      // with each flicker, fall off a little slower than the sky does.
      if (rockLight && typeof AmbientStorm !== "undefined") {
        var f = AmbientStorm.flash || 0;
        glow = f > glow ? f : glow * 0.88;
        rockLight.style.opacity = (glow * 0.9).toFixed(3);
      }
    }

    function step() {
      paint();
      raf = requestAnimationFrame(step);
    }

    function start() {
      if (running) return;
      running = true;
      step();
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    resize();

    if (reduceMotion) {
      paint();                              // one still sky
      // the orbiter's sprite loads async; repaint once it's in
      if (typeof GlimpseOrbiter !== "undefined") GlimpseOrbiter.image().addEventListener("load", paint);
    } else if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) {
        e[0].isIntersecting ? start() : stop();
      }).observe(hero);
    } else {
      start();
    }

    var t;
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        resize();
        if (reduceMotion) paint();
      }, 200);
    });
  }

  /* ----------------------------------------------------------
     4. The hero panel's mission clock: T+ since the page opened
     ---------------------------------------------------------- */
  function initHud() {
    var clock = document.querySelector("[data-pf-clock]");
    if (!clock) return;
    var t0 = performance.now();
    function p2(n) { return (n < 10 ? "0" : "") + n; }
    function tick() {
      var s = (performance.now() - t0) / 1000;
      clock.textContent = "T+" + p2(Math.floor(s / 60)) + ":" + p2(Math.floor(s % 60)) + "." + Math.floor((s % 1) * 10);
    }
    tick();
    if (reduceMotion) return;
    var hero = document.querySelector(".folio-hero");
    var timer = null;
    function run(on) { clearInterval(timer); timer = on ? setInterval(tick, 100) : null; }
    if ("IntersectionObserver" in window && hero) {
      new IntersectionObserver(function (e) { run(e[0].isIntersecting); }).observe(hero);
    } else run(true);
  }

  /* ----------------------------------------------------------
     5. The mission archive
     ---------------------------------------------------------- */
  function initArchive() {
    var reel = document.querySelector("[data-reel]");
    if (!reel) return;
    var archive = reel.closest(".pf-archive");
    var files = [].slice.call(reel.querySelectorAll(".pf-file"));
    var two = window.matchMedia("(min-width: 768px)");
    var p2 = function (n) { return (n < 10 ? "0" : "") + n; };

    files.forEach(function (f, i) {
      f.id = "file-" + p2(i + 1);
      f.__n = p2(i + 1);
    });

    // sides: left screens face right, right ones face left (one column: none)
    function layout() {
      var vis = files.filter(function (f) { return !f.hidden; });
      vis.forEach(function (f, i) {
        var right = two.matches && i % 2 === 1;
        f.classList.toggle("is-right", right);
        f.style.setProperty("--side", two.matches ? (right ? -1 : 1) : 0);
      });
      request();
    }

    // entrances
    if (reduceMotion || !("IntersectionObserver" in window)) {
      files.forEach(function (f) { f.classList.add("is-in"); });
    } else {
      var rio = new IntersectionObserver(function (en) {
        en.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("is-in"); rio.unobserve(e.target); }
        });
      }, { rootMargin: "0px 0px -10% 0px" });
      files.forEach(function (f) { rio.observe(f); });
    }

    // the limb draws itself in
    var limb = document.querySelector(".pf-limb");
    if (limb) {
      if (!("IntersectionObserver" in window) || reduceMotion) limb.classList.add("is-in");
      else new IntersectionObserver(function (e, o) {
        if (e[0].isIntersecting) { limb.classList.add("is-in"); o.disconnect(); }
      }, { threshold: 0.4 }).observe(limb);
    }

    // films: fetched only when first seen, played only while on screen,
    // timecode on the screen's bar
    function tc(sec) {
      var h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s2 = Math.floor(sec) % 60, fr = Math.floor((sec % 1) * 24);
      return p2(h) + ":" + p2(m) + ":" + p2(s2) + ":" + p2(fr);
    }
    var vids = files.map(function (f) { return f.querySelector(".pf-video"); }).filter(Boolean);
    vids.forEach(function (v) {
      var screen = v.closest(".pf-screen"), tcEl = screen.querySelector(".pf-tc");
      v.addEventListener("playing", function () { v.classList.add("is-playing"); screen.classList.add("is-live"); });
      v.addEventListener("pause", function () { screen.classList.remove("is-live"); });
      v.addEventListener("timeupdate", function () { tcEl.textContent = tc(v.currentTime); });
    });
    if (!reduceMotion && "IntersectionObserver" in window) {
      var vio = new IntersectionObserver(function (en) {
        en.forEach(function (e) {
          var v = e.target;
          if (e.isIntersecting) {
            if (!v.src && v.dataset.src) { v.src = v.dataset.src; v.preload = "auto"; }
            if (!document.hidden) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
          } else if (!v.paused) v.pause();
        });
      }, { threshold: 0.35 });
      vids.forEach(function (v) { vio.observe(v); });
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) vids.forEach(function (v) { if (!v.paused) v.pause(); });
      });
    }

    // the filter
    var btns = [].slice.call(document.querySelectorAll(".pf-filter [data-filter]"));
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-filter");
        btns.forEach(function (o) {
          var on = o === b;
          o.classList.toggle("is-on", on);
          o.setAttribute("aria-pressed", on ? "true" : "false");
        });
        files.forEach(function (f) {
          var show = k === "all" || f.getAttribute("data-type") === k;
          f.hidden = !show;
          if (show && !reduceMotion) {
            // re-run the entrance for the files that stay
            f.classList.remove("is-in");
            void f.offsetWidth;
            requestAnimationFrame(function () { f.classList.add("is-in"); });
          }
        });
        layout();
      });
    });

    // every frame the page moves: each screen turns to face you as it
    // nears the middle of the view; the comms tracker + deep sky come
    // on while the archive fills the screen
    var ticking = false, inArchive = false, skyOn = false;
    var skyEl = document.querySelector(".pf-deep-sky");
    var limbEl = document.querySelector(".pf-limb");
    function frame() {
      ticking = false;
      var vh = window.innerHeight;
      var ar = archive.getBoundingClientRect();
      var on = ar.top < vh * 0.55 && ar.bottom > vh * 0.45;
      if (on !== inArchive) {
        inArchive = on;
        document.body.classList.toggle("pf-in-archive", on);
      }
      // the deep sky's fade rides with the page: in from the limb, out
      // before the archive ends
      if (skyEl) {
        var top = limbEl ? limbEl.getBoundingClientRect().top : ar.top;
        skyEl.style.setProperty("--a", Math.round(top) + "px");
        skyEl.style.setProperty("--b", Math.round(top + vh * 0.45) + "px");
        skyEl.style.setProperty("--c", Math.round(ar.bottom - vh * 0.35) + "px");
        skyEl.style.setProperty("--d", Math.round(ar.bottom) + "px");
        var vis = top < vh && ar.bottom > 0;
        if (vis !== skyOn) { skyOn = vis; if (deepSky) deepSky.run(vis); }
      }
      if (ar.bottom < -200 || ar.top > vh + 200) return;
      files.forEach(function (f) {
        if (f.hidden) return;
        var r = f.getBoundingClientRect();
        var mid = r.top + r.height / 2;
        var d = (mid - vh / 2) / (vh * 0.7);
        var turn = reduceMotion ? 0.6 : Math.min(1, 0.3 + Math.abs(d) * 0.9);
        var key = turn.toFixed(3);
        if (f.__turn !== key) { f.__turn = key; f.style.setProperty("--turn", key); }
      });
    }
    function request() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    if (two.addEventListener) two.addEventListener("change", layout);

    // the comms FREQ readout drifts like a live channel
    var freq = document.querySelector(".pf-comms [data-freq]");
    if (freq && !reduceMotion) setInterval(function () {
      if (inArchive) freq.textContent = (97 + Math.random() * 0.4).toFixed(2);
    }, 1400);

    layout();
  }

  /* ----------------------------------------------------------
     6. The deep sky behind the archive: the hero's sky (sky-fx.js
     stars and bodies, ambient-storm.js, the GLIMPSE and HOPE passes)
     drawn full-screen with no horizon, running only while the
     archive is on screen
     ---------------------------------------------------------- */
  var deepSky = null;
  function initDeepSky() {
    var canvas = document.querySelector(".pf-deep-sky");
    if (!canvas || typeof MartianSky === "undefined") return;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var sky = new MartianSky({ reduceMotion: reduceMotion });
    var fx = { dpr: dpr, _cam: null, cameraOriginY: 0.62, horizonY: 1.25 };
    var raf = 0, running = false;
    function resize() {
      canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
      canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
    }
    function paint() {
      var w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      sky.draw(ctx, fx);
      if (typeof AmbientStorm !== "undefined") AmbientStorm.draw(ctx, w, h, { alpha: 0.4 });
      if (typeof GlimpseOrbiter !== "undefined") GlimpseOrbiter.draw(ctx, w, h, { dpr: dpr });
      if (typeof HopeProbe !== "undefined") HopeProbe.draw(ctx, w, h, { dpr: dpr });
      // (no body labels here: they would sit over the project copy)
    }
    function step() { paint(); raf = requestAnimationFrame(step); }
    resize();
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { resize(); if (!running) paint(); }, 200);
    });
    deepSky = {
      run: function (on) {
        if (reduceMotion) { if (on) paint(); return; }
        if (on && !running) { running = true; step(); }
        else if (!on && running) { running = false; cancelAnimationFrame(raf); }
      }
    };
  }

  initShots();
  initCardVideos();
  initReveal();
  initHeroExit();
  initHero();
  initSky();
  initHud();
  initDeepSky();
  initArchive();
})();
