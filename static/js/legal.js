/* ============================================================
   Worx | legal.js
   The reading pages (faq/, privacy-policy/, terms-of-use/); the bay's
   letterbox, frame and rails come from blog-cinema.js.
     1. the sky: stars drifting in three depths over the bay, twinkling,
        a shooting star now and then (paused off screen)
     2. sections and FAQ rows rise in as you reach them
     3. the index panel stays open beside the text and folds into a
        drop-down on phones; the log being read is marked in it and
        lit along its top
     4. FAQ: "Expand all" / "Collapse all", and a link to a question
        (#q-...) opens it
   Everything reads fine without this file.
   ============================================================ */

(function () {
  "use strict";

  var q = function (s, r) { return (r || document).querySelector(s); };
  var qa = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasIO = "IntersectionObserver" in window;

  /* 1. the sky ---------------------------------------------------- */
  var sky = q("[data-lg-sky]");
  if (sky) (function () {
    var cv = document.createElement("canvas");
    sky.appendChild(cv);
    var g = cv.getContext("2d"), stars = [], meteor = null, W = 0, H = 0, dpr = 1, raf = 0, on = true, t0 = 0, nextMeteor = 0;
    function fit() {
      var r = sky.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      var n = Math.round(Math.min(260, W * H / 5200));
      stars = [];
      for (var i = 0; i < n; i++) {
        var z = Math.random();
        stars.push({ x: Math.random() * W, y: Math.random() * H, z: z, r: 0.4 + z * 1.3, ph: Math.random() * 6.3, warm: Math.random() < 0.18 });
      }
      if (reduced) draw(0);
    }
    function draw(t) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        // the near ones drift faster: depth
        var x = (s.x - t * 0.004 * (0.3 + s.z * 1.4)) % W;
        if (x < 0) x += W;
        var a = 0.25 + s.z * 0.55 + Math.sin(t * 0.0015 + s.ph) * 0.2 * s.z;
        g.globalAlpha = Math.max(0.05, a);
        g.fillStyle = s.warm ? "#ffcf87" : "#fff3dc";
        g.beginPath(); g.arc(x, s.y, s.r, 0, 6.283); g.fill();
      }
      g.globalAlpha = 1;
      // a shooting star across the top of the sky
      if (!reduced) {
        if (!meteor && t > nextMeteor) {
          meteor = { x: W * (0.3 + Math.random() * 0.7), y: H * Math.random() * 0.35, vx: -(5 + Math.random() * 4), vy: 2 + Math.random() * 1.5, life: 1 };
          nextMeteor = t + 4500 + Math.random() * 7000;
        }
        if (meteor) {
          meteor.x += meteor.vx; meteor.y += meteor.vy; meteor.life -= 0.018;
          var gr = g.createLinearGradient(meteor.x, meteor.y, meteor.x - meteor.vx * 14, meteor.y - meteor.vy * 14);
          gr.addColorStop(0, "rgba(255,243,220," + (meteor.life * 0.9).toFixed(2) + ")");
          gr.addColorStop(1, "rgba(250,167,25,0)");
          g.strokeStyle = gr; g.lineWidth = 1.4;
          g.beginPath(); g.moveTo(meteor.x, meteor.y); g.lineTo(meteor.x - meteor.vx * 14, meteor.y - meteor.vy * 14); g.stroke();
          if (meteor.life <= 0) meteor = null;
        }
      }
    }
    function loop(now) {
      raf = 0;
      if (!t0) t0 = now;
      draw(now - t0);
      if (on) raf = requestAnimationFrame(loop);
    }
    fit();
    window.addEventListener("resize", function () { fit(); });
    if (reduced) return;
    if (hasIO) new IntersectionObserver(function (en) {
      on = en[0].isIntersecting;
      if (on && !raf) raf = requestAnimationFrame(loop);
    }).observe(sky);
    raf = requestAnimationFrame(loop);
  })();

  // the emblems move by SVG animation too: hold them still when asked
  if (reduced) qa(".lg-mon svg").forEach(function (s) { if (s.pauseAnimations) s.pauseAnimations(); });

  /* 2. arrivals ---------------------------------------------------- */
  if (hasIO && !reduced) {
    var rise = qa(".lg-sec, .fq-group > h2, .fq-item, .lg-cta, .lg-intro");
    var batch = 0, batchT = 0;
    rise.forEach(function (el) { el.classList.add("lg-rise"); });
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (!e.isIntersecting) return;
        // rows arriving together come in one after another
        var now = performance.now();
        if (now - batchT > 300) batch = 0;
        batchT = now;
        e.target.style.setProperty("--k", batch++);
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    rise.forEach(function (el) { io.observe(el); });
  }

  /* 3. the index panel -------------------------------------------- */
  var toc = q(".lg-toc");
  if (toc) {
    var narrow = window.matchMedia("(max-width: 960px)");
    var fit = function () { toc.open = !narrow.matches; };
    fit();
    if (narrow.addEventListener) narrow.addEventListener("change", fit);

    var links = qa("a[href^='#']", toc);
    links.forEach(function (a) {
      a.addEventListener("click", function () { if (narrow.matches) toc.open = false; });
    });

    if (hasIO) {
      var byId = {};
      links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
      var mark = function (id) {
        links.forEach(function (a) { a.classList.toggle("is-active", a === byId[id]); });
        qa(".lg-sec").forEach(function (s) { s.classList.toggle("is-reading", s.id === id); });
      };
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) mark(e.target.id); });
      }, { rootMargin: "-20% 0px -70% 0px" });
      Object.keys(byId).forEach(function (id) {
        var s = document.getElementById(id);
        if (s) spy.observe(s);
      });
    }
  }

  /* 4. FAQ ------------------------------------------------------- */
  var items = qa(".fq-item");
  if (!items.length) return;

  var btn = q(".fq-expand");
  var sync = function () {
    if (!btn) return;
    var all = items.every(function (d) { return d.open; });
    btn.textContent = all ? "Collapse all" : "Expand all";
    btn.setAttribute("aria-pressed", all ? "true" : "false");
  };
  if (btn) {
    btn.hidden = false;
    btn.addEventListener("click", function () {
      var open = !items.every(function (d) { return d.open; });
      items.forEach(function (d) { d.open = open; });
      sync();
    });
  }
  items.forEach(function (d) { d.addEventListener("toggle", sync); });

  // a shared link to one question opens it
  var openHash = function () {
    var t = location.hash && document.getElementById(location.hash.slice(1));
    if (t && t.classList.contains("fq-item")) t.open = true;
  };
  openHash();
  window.addEventListener("hashchange", openHash);
  sync();
})();
