/* ============================================================
   Worx | services.js
   Drives the cinematic services page:
   starfield, intro (letterbox + countdown), HUD clock and rails,
   hero word slot, manifesto word scrub, horizontal fleet with
   six live scenes, star map, footage wall, velocity marquee,
   flight plan (the Worx sequence), mission builder, cursor.
   Service data comes from the #cx-catalogue JSON, which
   tools/services/build.js generates from catalogue.js.
   Needs gsap + ScrollTrigger; Lenis is optional.
   ============================================================ */

(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var hasGsap = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  var catalogue = [];
  try { catalogue = JSON.parse($("#cx-catalogue").textContent); } catch (e) {}
  var bySlug = {};
  catalogue.forEach(function (s) { bySlug[s.slug] = s; });

  // These work with or without motion
  setupStarMap();
  setupMission();

  // Without GSAP (CDN down) or with reduced motion, keep the page
  // static and fully readable; only lazy-load the videos.
  if (!hasGsap || reduced) {
    lazyVideos(false);
    staticStars();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  root.classList.add("cx-ready");

  // ---- Smooth scroll (Lenis) + scroll velocity --------------
  var velocity = 0;
  var lenis = null;
  if (typeof Lenis !== "undefined") {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on("scroll", function (e) {
      velocity = e.velocity || 0;
      ScrollTrigger.update();
    });
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  } else {
    var lastY = window.scrollY;
    window.addEventListener("scroll", function () {
      velocity = window.scrollY - lastY;
      lastY = window.scrollY;
    }, { passive: true });
  }

  function scrollToY(y) {
    if (lenis) lenis.scrollTo(y, { duration: 1.6 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  }

  // =============================================================
  // Starfield: 3D points flying toward the camera. Speed follows
  // scroll velocity, and "warp" boosts it (intro, ignite hover).
  // =============================================================
  var stars = (function () {
    var canvas = $(".cx-stars");
    var ctx = canvas.getContext("2d");
    var w, h, cx, cy, dpr;
    var list = [];
    var COUNT = window.innerWidth < 700 ? 260 : 520;
    var speed = 0.4;
    var state = { warp: 0 };
    var running = true;
    var mouseX = 0, mouseY = 0, driftX = 0, driftY = 0;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w / 2;
      cy = h / 2;
    }

    function spawn(s, far) {
      s.x = (Math.random() - 0.5) * w * 2;
      s.y = (Math.random() - 0.5) * h * 2;
      s.z = far ? w : Math.random() * w;
      s.pz = s.z;
      s.amber = Math.random() < 0.18;
      return s;
    }

    resize();
    for (var i = 0; i < COUNT; i++) list.push(spawn({}, false));
    window.addEventListener("resize", resize);

    window.addEventListener("pointermove", function (e) {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    document.addEventListener("visibilitychange", function () {
      running = !document.hidden;
    });

    function project(s, z) {
      var k = 128 / z * 0.004;
      var drift = 1 - z / w;
      return [s.x * k * w / 2 + cx - driftX * drift, s.y * k * h / 2 + cy - driftY * drift];
    }

    gsap.ticker.add(function () {
      if (!running) return;
      var target = 0.4 + Math.min(Math.abs(velocity) * 0.6, 26) + state.warp;
      speed += (target - speed) * 0.08;
      driftX += (mouseX * 30 - driftX) * 0.04;
      driftY += (mouseY * 20 - driftY) * 0.04;

      // Longer trails at speed: fade the previous frame less
      ctx.fillStyle = "rgba(21, 9, 5, " + (speed > 6 ? 0.28 : 0.9) + ")";
      ctx.fillRect(0, 0, w, h);

      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        s.pz = s.z;
        s.z -= speed;
        if (s.z < 1) { spawn(s, true); continue; }
        var p = project(s, s.z);
        var o = project(s, s.pz);
        if (p[0] < -50 || p[0] > w + 50 || p[1] < -50 || p[1] > h + 50) { spawn(s, true); continue; }
        var depth = 1 - s.z / w;
        var alpha = Math.min(1, depth * 1.4);
        ctx.strokeStyle = s.amber ? "rgba(250, 167, 25, " + alpha + ")" : "rgba(254, 238, 207, " + alpha + ")";
        ctx.lineWidth = Math.max(0.4, depth * 2.2);
        ctx.beginPath();
        ctx.moveTo(o[0], o[1]);
        ctx.lineTo(p[0] + 0.1, p[1] + 0.1);
        ctx.stroke();
      }
    });

    return {
      warpTo: function (v, dur) {
        gsap.to(state, { warp: v, duration: dur || 1, ease: "power2.out", overwrite: true });
      }
    };
  })();

  // =============================================================
  // Intro: letterbox + countdown + warp, then the title rises.
  // The countdown plays once per session; repeat visits get a
  // quick warp only.
  // =============================================================
  var countdown = $("[data-countdown]");
  var intro = gsap.timeline({ defaults: { ease: "power3.out" } });
  var seen = false;
  try { seen = sessionStorage.getItem("cx-intro") === "1"; } catch (e) {}

  if (!seen) {
    ["3", "2", "1"].forEach(function (n, i) {
      intro
        .set(countdown, { textContent: n })
        .fromTo(countdown, { scale: 1.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.28 })
        .to(countdown, i < 2 ? { opacity: 0, scale: 0.7, duration: 0.2 } : { opacity: 0, scale: 3, duration: 0.35, ease: "power2.in" }, "+=0.08");
    });
    intro
      .add(function () { stars.warpTo(40, 0.3); }, "<")
      .add(function () { stars.warpTo(0, 2.2); }, "+=0.35");
    try { sessionStorage.setItem("cx-intro", "1"); } catch (e) {}
  } else {
    intro.add(function () { stars.warpTo(18, 0.2); }).add(function () { stars.warpTo(0, 1.6); }, "+=0.3");
  }

  intro
    .to(".cx-letterbox span:first-child", { yPercent: -100, duration: 1.1, ease: "power4.inOut" }, seen ? 0 : "-=0.5")
    .to(".cx-letterbox span:last-child", { yPercent: 100, duration: 1.1, ease: "power4.inOut" }, "<")
    .to(".cx-title .cx-line > span", { yPercent: 0, y: 0, rotate: 0, duration: 1.2, stagger: 0.12 }, "-=0.6")
    .to(".cx-kicker", { opacity: 1, duration: 0.8 }, "-=0.9")
    .fromTo(".cx-hero-sub", { y: 20 }, { opacity: 1, y: 0, duration: 0.8 }, "-=0.7")
    .fromTo(".cx-hero-cta", { y: 20 }, { opacity: 1, y: 0, duration: 0.8 }, "-=0.6")
    .fromTo(".cx-hud", { scale: 1.04 }, { opacity: 1, scale: 1, duration: 1 }, "-=0.8")
    .fromTo(".cx-eclipse", { y: "22vh" }, { y: 0, duration: 1.8, ease: "power3.out" }, "-=1.6")
    .fromTo(".cx-comms", { x: -30 }, { opacity: 1, x: 0, duration: 0.8 }, "-=0.8")
    .fromTo(".cx-alt", { x: 30 }, { opacity: 1, x: 0, duration: 0.8 }, "<")
    .set(".cx-letterbox", { display: "none" })
    .add(startSlot, "-=1.2");

  // ---- Hero word slot: everything. everywhere. all at once.
  function startSlot() {
    var slot = $("[data-slot]");
    if (!slot) return;
    var words = $$("em", slot);
    var i = 0;
    root.classList.add("cx-slot-on");
    gsap.set(words, { yPercent: 110, opacity: 0 });
    gsap.set(words[0], { yPercent: 0, opacity: 1 });

    function next() {
      var cur = words[i];
      i = (i + 1) % words.length;
      var nxt = words[i];
      gsap.to(cur, { yPercent: -110, opacity: 0, duration: 0.55, ease: "power3.in" });
      gsap.fromTo(nxt, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: "power3.out", delay: 0.3 });
      // Linger on "all at once." before rolling again
      gsap.delayedCall(nxt.classList.contains("is-final") ? 4 : 1.5, next);
    }
    gsap.delayedCall(1.4, next);
  }

  // =============================================================
  // HUD: mission clock, frequency, cycling service, altimeter
  // =============================================================
  var clock = $("[data-clock]");
  var freq = $("[data-freq]");
  var hudService = $("[data-hud-service]");
  var t0 = Date.now();
  var tick = 0;
  setInterval(function () {
    var s = Math.floor((Date.now() - t0) / 1000);
    if (clock) clock.textContent = pad(Math.floor(s / 3600)) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60);
    if (freq) freq.textContent = (97 + Math.random() * 0.3).toFixed(2);
    if (hudService && catalogue.length && ++tick % 2 === 0) {
      hudService.textContent = catalogue[(tick / 2) % catalogue.length].name;
    }
  }, 1000);

  gsap.matchMedia().add("(max-width: 900px)", function () {
    var comms = $(".cx-comms");
    ScrollTrigger.create({
      trigger: ".cx-hero",
      start: "top top",
      end: "bottom 40%",
      onToggle: function (self) { comms.classList.toggle("is-away", !self.isActive); }
    });
    return function () { comms.classList.remove("is-away"); };
  });

  var altNum = $("[data-alt]");
  var altFill = $("[data-alt-fill]");
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: function (self) {
      if (altNum) altNum.textContent = (self.progress * 408).toFixed(1);
      if (altFill) altFill.style.setProperty("--p", self.progress);
    }
  });

  $$("[data-chapter-section]").forEach(function (sec) {
    var link = $('.cx-alt-list a[data-chapter="' + sec.getAttribute("data-chapter-section") + '"]');
    if (!link) return;
    ScrollTrigger.create({
      trigger: sec,
      start: "top 55%",
      end: "bottom 55%",
      onToggle: function (self) { link.classList.toggle("is-active", self.isActive); }
    });
  });

  // =============================================================
  // Launch scroll-out: text flies toward the camera, the planet rises
  // =============================================================
  gsap.timeline({
    scrollTrigger: { trigger: ".cx-hero", start: "top top", end: "bottom top", scrub: true }
  })
    .to(".cx-hero-copy", { scale: 1.35, opacity: 0, yPercent: -12, filter: "blur(6px)", ease: "none" }, 0)
    .to(".cx-eclipse", { y: "-18vh", ease: "none" }, 0)
    .to(".cx-hero-glow", { opacity: 0, ease: "none" }, 0)
    .to(".cx-hud", { opacity: 0, ease: "none" }, 0)
    .to(".cx-hero-sky", { opacity: 0, ease: "none" }, 0);

  // =============================================================
  // Manifesto: words light up as you scroll (pinned)
  // =============================================================
  var manifesto = $("[data-scrub-words]");
  if (manifesto) {
    splitWords(manifesto);
    gsap.to($$(".cx-w", manifesto), {
      opacity: 1,
      stagger: 0.1,
      ease: "none",
      scrollTrigger: {
        trigger: ".cx-manifesto",
        start: "top top",
        end: "+=120%",
        pin: ".cx-manifesto-pin",
        scrub: true
      }
    });
  }

  $$(".cx-tele").forEach(function (tele, i) {
    var num = $("[data-count]", tele);
    ScrollTrigger.create({
      trigger: tele,
      start: "top 90%",
      once: true,
      onEnter: function () {
        tele.classList.add("is-on");
        var end = parseInt(num.getAttribute("data-count"), 10);
        var o = { v: 0 };
        gsap.to(o, {
          v: end, duration: 2, delay: i * 0.12, ease: "power3.out",
          onUpdate: function () { num.textContent = Math.round(o.v); }
        });
      }
    });
  });

  // =============================================================
  // Fleet: horizontal ride on desktop, stacked on small screens
  // =============================================================
  var fleet = $(".cx-fleet");
  var track = $(".cx-fleet-track");
  var panels = $$(".cx-panel", track);
  var fleetFill = $("[data-fleet-fill]");
  var fleetCount = $("[data-fleet-count]");
  var divisions = panels.length - 1;
  var fleetTotal = $("[data-fleet-total]");
  if (fleetTotal) fleetTotal.textContent = pad(divisions);
  var scenes = setupScenes();
  var ride = null;

  function setLive(panel, on) {
    if (panel.classList.contains("is-live") === on) return;
    panel.classList.toggle("is-live", on);
    var key = panel.getAttribute("data-scene");
    if (key && scenes[key]) scenes[key][on ? "start" : "stop"]();
  }

  var mm = gsap.matchMedia();

  mm.add("(min-width: 901px)", function () {
    fleet.classList.add("cx-h");
    var distance = function () { return track.scrollWidth - window.innerWidth; };

    ride = gsap.to(track, {
      x: function () { return -distance(); },
      ease: "none",
      scrollTrigger: {
        trigger: fleet,
        start: "top top",
        end: function () { return "+=" + distance(); },
        pin: ".cx-fleet-pin",
        scrub: 1,
        invalidateOnRefresh: true,
        // Settle on whole panels so a division is never left half on screen
        snap: {
          snapTo: function (value) {
            var maxX = distance();
            var stops = panels.map(function (p) { return Math.min(1, p.offsetLeft / maxX); });
            return stops.reduce(function (a, b) { return Math.abs(b - value) < Math.abs(a - value) ? b : a; });
          },
          // Nearest panel only: no velocity projection, so a fast flick
          // or a jump from the menu never overshoots to the last division
          inertia: false,
          duration: { min: 0.3, max: 0.8 },
          delay: 0.08,
          ease: "power2.inOut"
        },
        onUpdate: function (self) {
          if (fleetFill) fleetFill.style.transform = "scaleX(" + self.progress + ")";
          if (fleetCount) fleetCount.textContent = pad(Math.min(divisions, Math.round(self.progress * divisions)));
        }
      }
    });

    panels.forEach(function (panel) {
      ScrollTrigger.create({
        trigger: panel,
        containerAnimation: ride,
        start: "left 62%",
        end: "right 38%",
        onToggle: function (self) { setLive(panel, self.isActive); }
      });

      // Big outlined number drifts against the travel direction
      var num = $(".cx-panel-bignum", panel);
      if (num) {
        gsap.fromTo(num, { xPercent: 30 }, {
          xPercent: -30, ease: "none",
          scrollTrigger: { trigger: panel, containerAnimation: ride, start: "left right", end: "right left", scrub: true }
        });
      }
    });

    return function () {
      ride = null;
      fleet.classList.remove("cx-h");
      gsap.set(track, { clearProps: "transform" });
    };
  });

  mm.add("(max-width: 900px)", function () {
    panels.forEach(function (panel) {
      ScrollTrigger.create({
        trigger: panel,
        start: "top 70%",
        end: "bottom 30%",
        onToggle: function (self) { setLive(panel, self.isActive); }
      });
    });
  });

  // Anchor links (menu, star map, rails). A #sys-* panel sits inside the
  // horizontal track, so its scroll position is worked out from the ride.
  function targetY(hash) {
    var el = hash && hash.length > 1 ? document.getElementById(hash.slice(1)) : null;
    if (!el) return null;
    if (ride && el.classList.contains("cx-panel")) {
      var st = ride.scrollTrigger;
      var maxX = track.scrollWidth - window.innerWidth;
      return st.start + Math.min(maxX, el.offsetLeft) / maxX * (st.end - st.start);
    }
    return el.getBoundingClientRect().top + window.scrollY;
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href*="#"]');
    if (!a) return;
    var url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname) return;
    var y = targetY(url.hash);
    if (y === null) return;
    e.preventDefault();
    history.replaceState(null, "", url.hash);
    scrollToY(y);
  });

  window.addEventListener("load", function () {
    ScrollTrigger.refresh();
    var y = targetY(location.hash);
    if (y !== null) setTimeout(function () { scrollToY(y); }, 400);
  });

  // =============================================================
  // Star map entrance: lines draw, stars ignite
  // =============================================================
  gsap.from(".cx-starmap-head > *", {
    y: 40, opacity: 0, stagger: 0.1, duration: 0.9, ease: "power3.out",
    scrollTrigger: { trigger: ".cx-starmap", start: "top 75%" }
  });
  ScrollTrigger.create({
    trigger: ".cx-map",
    start: "top 75%",
    once: true,
    onEnter: function () { $(".cx-map").classList.add("is-on"); }
  });

  // =============================================================
  // Field footage: the tilted wall flattens as it arrives
  // =============================================================
  gsap.fromTo(".cx-wall-grid",
    { rotateX: 38, rotateZ: -6, scale: 0.82, yPercent: 6 },
    {
      rotateX: 0, rotateZ: 0, scale: 1, yPercent: 0, ease: "none",
      scrollTrigger: { trigger: ".cx-wall", start: "top bottom", end: "top 20%", scrub: true }
    });

  gsap.from(".cx-field-head > *", {
    y: 40, opacity: 0, stagger: 0.1, duration: 0.9, ease: "power3.out",
    scrollTrigger: { trigger: ".cx-field-head", start: "top 80%" }
  });

  lazyVideos(true);

  // =============================================================
  // Marquee: endless, speeds up and skews with scroll velocity
  // =============================================================
  $$("[data-marquee]").forEach(function (row) {
    var dir = parseFloat(row.getAttribute("data-marquee"));
    var inner = $(".cx-marquee-inner", row);
    row.appendChild(inner.cloneNode(true)).setAttribute("aria-hidden", "true");
    var items = $$(".cx-marquee-inner", row);
    var loop = gsap.fromTo(items,
      { xPercent: dir > 0 ? 0 : -100 },
      { xPercent: dir > 0 ? -100 : 0, duration: 40, ease: "none", repeat: -1 });

    gsap.ticker.add(function () {
      loop.timeScale(1 + Math.min(Math.abs(velocity), 40) * 0.25);
      gsap.set(items, { skewX: -Math.max(-12, Math.min(12, velocity * 0.4)) * dir });
    });
  });

  // =============================================================
  // Flight plan: the ship flies the trajectory; stages ignite
  // =============================================================
  setupFlight();

  // =============================================================
  // Ignition
  // =============================================================
  gsap.to(".cx-ignite-title .cx-line > span", {
    yPercent: 0, y: 0, rotate: 0, duration: 1.2, stagger: 0.12, ease: "power4.out",
    scrollTrigger: { trigger: ".cx-ignite", start: "top 65%" }
  });

  gsap.from([".cx-cta-intro .eyebrow", ".cx-ignite-sub", ".cx-cta-steps", ".cx-cta-contact", ".cx-mission"], {
    y: 30, opacity: 0, stagger: 0.12, duration: 0.9, ease: "power3.out",
    scrollTrigger: { trigger: ".cx-ignite", start: "top 55%" }
  });

  $$("[data-warp]").forEach(function (el) {
    el.addEventListener("pointerenter", function () { stars.warpTo(22, 0.8); });
    el.addEventListener("pointerleave", function () { stars.warpTo(0, 1.4); });
    el.addEventListener("click", function () { stars.warpTo(60, 0.3); });
  });

  // =============================================================
  // Magnetic buttons, tilt scenes, custom cursor
  // =============================================================
  if (finePointer) {
    $$("[data-magnetic]").forEach(function (el) {
      var xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
      var yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.35);
        yTo((e.clientY - r.top - r.height / 2) * 0.35);
      });
      el.addEventListener("pointerleave", function () { xTo(0); yTo(0); });
    });

    $$("[data-tilt]").forEach(function (el) {
      var host = el.closest(".cx-panel") || el.parentElement;
      var rx = gsap.quickTo(el, "rotationX", { duration: 0.8, ease: "power3.out" });
      var ry = gsap.quickTo(el, "rotationY", { duration: 0.8, ease: "power3.out" });
      gsap.set(el, { transformPerspective: 1100 });
      host.addEventListener("pointermove", function (e) {
        var r = host.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 14);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 10);
      });
      host.addEventListener("pointerleave", function () { rx(0); ry(0); });
    });

    // Star map layers drift with the pointer for depth
    var map = $(".cx-map");
    if (map) {
      var layers = [[$(".cx-map-grid", map), 8], [$(".cx-map-stars", map), 18]];
      var movers = layers.map(function (l) {
        return [gsap.quickTo(l[0], "x", { duration: 1, ease: "power3.out" }), gsap.quickTo(l[0], "y", { duration: 1, ease: "power3.out" }), l[1]];
      });
      map.addEventListener("pointermove", function (e) {
        var r = map.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width - 0.5;
        var ny = (e.clientY - r.top) / r.height - 0.5;
        movers.forEach(function (m) { m[0](-nx * m[2]); m[1](-ny * m[2]); });
      });
    }

    setupCursor();
  }

  // =============================================================
  // Helpers
  // =============================================================

  function splitWords(el) {
    // Walk text nodes so <mark> highlights survive the split
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var span = document.createElement("span");
        span.className = "cx-w";
        span.textContent = part;
        frag.appendChild(span);
      });
      node.parentNode.replaceChild(frag, node);
    });
  }

  // Videos only load when they come near the viewport, and pause
  // when they leave, so the page never downloads all footage up front.
  function lazyVideos(autoplay) {
    var vids = $$("video[data-src]");
    if (!("IntersectionObserver" in window)) {
      vids.forEach(function (v) { v.src = v.getAttribute("data-src"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) {
          if (!v.getAttribute("src")) { v.src = v.getAttribute("data-src"); v.load(); }
          if (autoplay) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        } else if (!v.paused) {
          v.pause();
        }
      });
    }, { rootMargin: "200px 0px" });
    vids.forEach(function (v) { io.observe(v); });
  }

  function staticStars() {
    var canvas = $(".cx-stars");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    function draw() {
      var w = canvas.width = canvas.clientWidth;
      var h = canvas.height = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < 300; i++) {
        ctx.fillStyle = "rgba(254, 238, 207, " + (0.2 + Math.random() * 0.6) + ")";
        ctx.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2);
      }
    }
    draw();
    window.addEventListener("resize", draw);
  }

  function setupCursor() {
    var cursor = $(".cx-cursor");
    var dot = $(".cx-cursor-dot");
    var ring = $(".cx-cursor-ring");
    var label = $("[data-cursor-label]");
    if (!cursor) return;
    root.classList.add("cx-cursor-on");

    var dx = gsap.quickTo(dot, "x", { duration: 0.08 });
    var dy = gsap.quickTo(dot, "y", { duration: 0.08 });
    var rx = gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3.out" });
    var ry = gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3.out" });

    window.addEventListener("pointermove", function (e) {
      cursor.classList.add("is-moving");
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
    }, { passive: true });

    document.addEventListener("pointerover", function (e) {
      var t = e.target.closest("[data-cursor]");
      if (t) {
        label.textContent = t.getAttribute("data-cursor");
        cursor.classList.add("is-hover");
      } else if (e.target.closest("a, button")) {
        label.textContent = "";
        cursor.classList.add("is-hover");
      } else {
        cursor.classList.remove("is-hover");
      }
    });

    document.documentElement.addEventListener("pointerleave", function () { gsap.set([dot, ring], { opacity: 0 }); });
    document.documentElement.addEventListener("pointerenter", function () { gsap.set([dot, ring], { opacity: 1 }); });
  }

  // ---- The six fleet scenes: start when live, stop when not ----
  function setupScenes() {
    var list = {};
    var noop = { start: function () {}, stop: function () {} };

    // DEVELOPMENT: code types itself, URL types, Lighthouse ring counts up
    list.web = (function () {
      var code = $("[data-code]");
      var url = $("[data-type-url]");
      var score = $("[data-score]");
      var scoreBox = $(".sw-score");
      var snippet = [
        ["k", "const "], ["t", "site"], ["", " = "], ["k", "await "], ["t", "worx"], ["", ".build({\n"],
        ["", "  design: "], ["s", '"research-led"'], ["", ",\n"],
        ["", "  store: "], ["s", '"shopify-plus"'], ["", ",\n"],
        ["", "  secure: "], ["k", "true"], ["", ",\n"],
        ["", "  speed: "], ["s", '"lighthouse-grade"'], ["", ",\n"],
        ["", "});\n\n"],
        ["t", "site"], ["", ".launch();\n"],
        ["", "// "], ["s", "shipped."], ["", "\n"]
      ];
      var timers = [];
      var tween;
      function clear() { timers.forEach(clearTimeout); timers = []; if (tween) tween.kill(); }

      function start() {
        clear();
        url.textContent = "";
        "your-brand.com".split("").forEach(function (ch, i) {
          timers.push(setTimeout(function () { url.textContent += ch; }, i * 60));
        });
        code.innerHTML = "";
        var delay = 0;
        snippet.forEach(function (tok) {
          var span = document.createElement("span");
          if (tok[0]) span.className = tok[0];
          code.appendChild(span);
          tok[1].split("").forEach(function (ch) {
            delay += ch === "\n" ? 90 : 22;
            timers.push(setTimeout(function () { span.textContent += ch; }, delay));
          });
        });
        var o = { v: 0 };
        tween = gsap.to(o, {
          v: 100, duration: 2.4, delay: 1.2, ease: "power2.out",
          onUpdate: function () {
            score.textContent = Math.round(o.v);
            scoreBox.style.setProperty("--score", o.v);
          }
        });
        // Rebuild every so often while it's on screen
        timers.push(setTimeout(start, delay + 5000));
      }
      return { start: start, stop: clear };
    })();

    // MOBILE: a tap, then a swipe to the next imagined app screen
    list.mobile = (function () {
      var box = $(".sm-screens");
      if (!box) return noop;
      var screens = $$(".sm-screen", box);
      var tabs = $$(".sm-tabbar i");
      var bar = $(".sm-tabbar");
      var tap = $(".sm-tap");
      var cur = 0;
      var timers = [];
      function clear() { timers.forEach(clearTimeout); timers = []; }

      function show(i) {
        screens.forEach(function (sc, k) {
          sc.classList.toggle("is-out", k === cur && k !== i);
          sc.classList.toggle("is-on", k === i);
        });
        tabs.forEach(function (t, k) { t.classList.toggle("is-active", k === i); });
        bar.style.setProperty("--tab", i);
        cur = i;
      }

      function step() {
        // Tap somewhere believable (a card, a button, the tab bar), then swipe
        var spots = [[50, 30], [70, 78], [62, 90], [38, 55]];
        var sp = spots[cur % spots.length];
        tap.style.setProperty("--tx", sp[0] + "%");
        tap.style.setProperty("--ty", sp[1] + "%");
        tap.classList.remove("is-tapping");
        void tap.offsetWidth;
        tap.classList.add("is-tapping");
        timers.push(setTimeout(function () { show((cur + 1) % screens.length); }, 320));
        timers.push(setTimeout(step, 3400));
      }

      return {
        start: function () {
          clear();
          box.classList.add("is-running");
          show(cur);
          timers.push(setTimeout(step, 2600));
        },
        stop: clear
      };
    })();

    // CREATIVE and IT run on CSS / SVG animation alone
    list.uiux = noop;
    list.platform = noop;

    // EMERGING: cube faces need half the cube width as a real length
    list.arvr = (function () {
      var holo = $(".sa-holo");
      function size() { if (holo) holo.style.setProperty("--half", holo.offsetWidth / 2 + "px"); }
      window.addEventListener("resize", size);
      size();
      return { start: size, stop: function () {} };
    })();

    return list;
  }

  // ---- Flight plan -------------------------------------------
  function setupFlight() {
    var section = $(".cx-flight");
    if (!section) return;
    var map = $(".cx-flight-map", section);
    var svg = $(".cx-flight-svg", section);
    var guide = $(".cx-flight-guide", section);
    var trail = $(".cx-flight-trail", section);
    var ship = $(".cx-ship", section);
    var pointsBox = $(".cx-flight-points", section);
    var card = $(".cx-flight-card", section);
    var num = $("[data-stage-num]", card);
    var title = $("[data-stage-title]", card);
    var desc = $("[data-stage-desc]", card);
    var status = $("[data-stage-status]", card);
    var meter = $("[data-flight-fill]", card);
    var crew = $("[data-stage-crew]", card);
    var checks = $$(".cx-flight-checklist li", card);

    // name, description, status, services on deck (catalogue slugs)
    var STAGES = [
      ["Consultation", "We listen first. Goals, audience, constraints and ambitions, mapped before a single pixel moves.", "Ignition",
        ["ui-ux-design", "artificial-intelligence", "erp-crm"]],
      ["Deliberation", "We weigh every route: stack, scope, timeline and risk, so you never have to guess.", "Climbing",
        ["web-development", "custom-platforms", "cloud"]],
      ["Solutions", "Architecture, design direction and a clear plan, laid out on paper for you to see.", "Climbing",
        ["custom-platforms", "erp-crm", "branding"]],
      ["Evaluation", "You review, we refine. Nothing is locked until it is exactly right.", "Course check",
        ["ui-ux-design", "copywriting", "video-animation"]],
      ["Finalisation", "Scope, timeline and budget signed off. The flight path is set.", "Locked in",
        ["it-outsourcing", "erp-crm", "cloud"]],
      ["Execution", "Design, build, test and launch, with progress you can see every step of the way.", "Full thrust",
        ["web-development", "ecommerce", "mobile-apps", "branding", "ar-vr"]],
      ["Management", "Updates, security and growth for the long haul. We stay in orbit with you.", "In orbit",
        ["web-development", "mobile-apps", "it-outsourcing", "cloud", "artificial-intelligence"]]
    ];

    var len = 0;
    var wps = [];
    var fractions = [0.03, 0.18, 0.33, 0.49, 0.64, 0.8, 0.97];
    var current = -1;
    var lastProgress = 0;

    function buildPath() {
      var w = map.clientWidth;
      var h = map.clientHeight;
      if (!w || !h) return;
      svg.setAttribute("viewBox", "0 0 " + w + " " + h);
      var d;
      if (w > h * 1.1) {
        // Landscape: a climbing wave from bottom-left to top-right
        d = "M " + (w * 0.02) + " " + (h * 0.92) +
          " C " + (w * 0.2) + " " + (h * 0.95) + ", " + (w * 0.18) + " " + (h * 0.5) + ", " + (w * 0.34) + " " + (h * 0.56) +
          " S " + (w * 0.5) + " " + (h * 0.86) + ", " + (w * 0.62) + " " + (h * 0.5) +
          " S " + (w * 0.74) + " " + (h * 0.1) + ", " + (w * 0.98) + " " + (h * 0.08);
      } else {
        // Portrait: a zig-zag climb from the bottom to the top
        d = "M " + (w * 0.1) + " " + (h * 0.98) +
          " C " + (w * 0.9) + " " + (h * 0.9) + ", " + (w * 0.9) + " " + (h * 0.7) + ", " + (w * 0.5) + " " + (h * 0.62) +
          " S " + (w * 0.05) + " " + (h * 0.4) + ", " + (w * 0.45) + " " + (h * 0.3) +
          " S " + (w * 0.95) + " " + (h * 0.12) + ", " + (w * 0.9) + " " + (h * 0.02);
      }
      guide.setAttribute("d", d);
      trail.setAttribute("d", d);
      len = trail.getTotalLength();
      trail.style.strokeDasharray = len;

      pointsBox.innerHTML = "";
      wps = fractions.map(function (f, i) {
        var p = trail.getPointAtLength(len * f);
        var before = trail.getPointAtLength(Math.max(0, len * f - 20));
        var after = trail.getPointAtLength(Math.min(len, len * f + 20));
        var el = document.createElement("div");
        el.className = "cx-wp";
        // Labels go below where the path peaks, above where it dips
        if ((p.y <= before.y && p.y <= after.y) || p.y < 40) el.className += " is-below";
        el.style.left = p.x + "px";
        el.style.top = p.y + "px";
        el.innerHTML = '<span class="cx-wp-dot"></span><span class="cx-wp-label"><span>' + pad(i + 1) + "</span>" + STAGES[i][0] + "</span>";
        pointsBox.appendChild(el);
        return el;
      });
      current = -1;
      render(lastProgress);
    }

    function render(p) {
      lastProgress = p;
      if (!len) return;
      var at = Math.max(0.001, Math.min(0.999, p)) * len;
      trail.style.strokeDashoffset = len - at;
      var pt = trail.getPointAtLength(at);
      var ahead = trail.getPointAtLength(Math.min(len, at + 2));
      var angle = Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180 / Math.PI;
      ship.style.transform = "translate(" + pt.x + "px," + pt.y + "px) rotate(" + angle + "deg)";
      meter.style.transform = "scaleX(" + p + ")";

      var stage = 0;
      for (var i = 0; i < fractions.length; i++) if (p >= fractions[i] - 0.02) stage = i;
      wps.forEach(function (wp, i) {
        wp.classList.toggle("is-done", p >= fractions[i] - 0.02);
        wp.classList.toggle("is-current", i === stage);
      });
      if (stage !== current) setStage(stage);
    }

    function setStage(i) {
      current = i;
      checks.forEach(function (li, j) {
        li.classList.toggle("is-done", j < i);
        li.classList.toggle("is-current", j === i);
      });
      num.textContent = pad(i + 1);
      status.textContent = STAGES[i][2];
      card.classList.add("is-swapping");
      setTimeout(function () {
        title.textContent = STAGES[i][0];
        desc.textContent = STAGES[i][1];
        crew.innerHTML = "";
        STAGES[i][3].forEach(function (slug, k) {
          var s = bySlug[slug];
          if (!s) return;
          var li = document.createElement("li");
          li.innerHTML = '<a href="' + s.href + '">' + s.name + "</a>";
          li.style.animationDelay = k * 0.07 + "s";
          crew.appendChild(li);
        });
        card.classList.remove("is-swapping");
      }, 200);
    }

    requestAnimationFrame(buildPath);
    window.addEventListener("resize", function () { requestAnimationFrame(buildPath); });

    ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "+=260%",
      pin: ".cx-flight-pin",
      scrub: 0.6,
      onUpdate: function (self) { render(self.progress); },
      onRefresh: function () { requestAnimationFrame(buildPath); }
    });

    gsap.from([".cx-flight-head > *", ".cx-flight-card"], {
      y: 40, opacity: 0, stagger: 0.1, duration: 0.9, ease: "power3.out",
      scrollTrigger: { trigger: section, start: "top 70%" }
    });
  }

  // ---- Star map: hover / focus / tap a star to inspect it ------
  function setupStarMap() {
    var map = $(".cx-map");
    if (!map || !catalogue.length) return;
    var starBtns = $$(".cx-star", map);
    var card = $(".cx-map-card", map);
    var cDiv = $(".cx-map-card-div", card);
    var cName = $(".cx-map-card-name", card);
    var cShort = $(".cx-map-card-short", card);
    var cSubs = $(".cx-map-card-subs", card);
    var cLink = $(".cx-map-card-link", card);
    var count = $("[data-map-count]", map);
    var seenStars = {};
    var active = null;

    function show(btn) {
      var s = catalogue[+btn.getAttribute("data-star")];
      if (!s) return;
      if (active) active.classList.remove("is-active");
      active = btn;
      btn.classList.add("is-active");
      map.setAttribute("data-division", s.divIndex);
      cDiv.textContent = pad(s.divIndex + 1) + " · " + s.division;
      cName.textContent = s.name;
      cShort.textContent = s.short;
      cSubs.innerHTML = s.subs.map(function (x) { return "<li>" + x + "</li>"; }).join("");
      cLink.href = s.href;
      cLink.hidden = false;
      card.classList.remove("is-flash");
      void card.offsetWidth;
      card.classList.add("is-flash");
      seenStars[s.slug] = 1;
      if (count) count.textContent = Object.keys(seenStars).length + " / " + catalogue.length + " inspected";
    }

    starBtns.forEach(function (btn) {
      btn.addEventListener("mouseenter", function () { show(btn); });
      btn.addEventListener("focus", function () { show(btn); });
      btn.addEventListener("click", function () { show(btn); });
    });
    if (count) count.textContent = "0 / " + catalogue.length + " inspected";
  }

  // ---- Mission builder: arm services, carry them to contact ----
  function setupMission() {
    var chips = $$("[data-mission]");
    var payload = $("[data-payload]");
    var clear = $("[data-mission-clear]");
    var btn = $(".cx-ignite-btn");
    var label = $("[data-cta-label]");
    if (!chips.length || !btn) return;
    var base = btn.getAttribute("href");

    function update() {
      var picked = chips.filter(function (c) { return c.getAttribute("aria-pressed") === "true"; })
        .map(function (c) { return c.getAttribute("data-mission"); });
      payload.textContent = picked.length ? picked.length + " selected" : "Nothing selected yet";
      if (label) label.textContent = picked.length ? "Send my brief" : "Start a project";
      payload.parentNode.classList.toggle("is-armed", picked.length > 0);
      clear.hidden = !picked.length;
      btn.setAttribute("href", picked.length ? base + "?services=" + encodeURIComponent(picked.join(",")) : base);
      btn.classList.toggle("is-armed", picked.length > 0);
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chip.setAttribute("aria-pressed", chip.getAttribute("aria-pressed") === "true" ? "false" : "true");
        update();
      });
    });
    clear.addEventListener("click", function () {
      chips.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
      update();
    });
  }
})();
