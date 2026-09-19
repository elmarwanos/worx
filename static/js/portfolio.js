/* ============================================================
   Worx by Glimpse — portfolio.js
   Portfolio page only. Two small, self-contained pieces:

   1. initShots()     — one shared auto-scroll for every project
                        preview: duplicates the screenshot once
                        for a seamless loop, and only animates
                        cards near the viewport.
   2. initHero()      — drifting-particle atmosphere over the
                        Mars hero image.

   Both stand down for prefers-reduced-motion. No dependencies.
   ============================================================ */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

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
     1b. Project video previews — play only near/in view
     Videos keep autoplay's visible behaviour (muted/looping,
     starts as soon as it is near the viewport) but stop
     buffering and decoding while scrolled well away, instead of
     all 11 clips loading and playing at once on page load.
     ---------------------------------------------------------- */
  function initCardVideos() {
    var videos = document.querySelectorAll(".folio-card-video");
    if (!videos.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      // Still play so the card isn't left on a blank frame.
      videos.forEach(function (v) { v.play().catch(function () {}); });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var v = entry.target;
          if (entry.isIntersecting) {
            v.play().catch(function () {}); // autoplay rejection is fine
          } else {
            v.pause();
          }
        });
      },
      { rootMargin: "200px 0px" }
    );

    videos.forEach(function (v) { io.observe(v); });
  }

  /* ----------------------------------------------------------
     2. Mars hero particles
     ---------------------------------------------------------- */
  function initHero() {
    var canvas = document.querySelector(".folio-hero-particles");
    if (!canvas) return;
    var hero = canvas.closest(".folio-hero");
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        stop();
        resize();
        seed();
        start();
      }, 200);
    });
  }

  initShots();
  initCardVideos();
  initHero();
})();
