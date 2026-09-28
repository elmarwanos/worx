/* ============================================================
   Worx | services.js
   Drives the cinematic services page:
   starfield, intro (letterbox + warp), HUD clock and rails,
   hero word slot, manifesto word scrub, horizontal fleet with
   six live scenes, star map, footage wall, velocity marquee,
   flight plan (the Worx sequence), mission builder.
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
    // The flight plan still charts its full trajectory, just without the ride
    setupFlight(false);
    // SVG (SMIL) loops in the scenes hold still for reduced motion
    if (reduced) $$("svg").forEach(function (s) { if (s.pauseAnimations) s.pauseAnimations(); });
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
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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
  // Intro: letterbox + a quick warp, then the title rises.
  // =============================================================
  var intro = gsap.timeline({ defaults: { ease: "power3.out" } });
  intro.add(function () { stars.warpTo(18, 0.2); }).add(function () { stars.warpTo(0, 1.6); }, "+=0.3");

  intro
    .to(".cx-letterbox span:first-child", { yPercent: -100, duration: 1.1, ease: "power4.inOut" }, 0)
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
    .to(".cx-hero-copy", { scale: 1.25, opacity: 0, yPercent: -16, xPercent: -6, ease: "power1.in" }, 0)
    .to(".cx-eclipse", { y: "-18vh", ease: "none" }, 0)
    .to(".cx-hero-glow", { opacity: 0, ease: "none" }, 0)
    .to(".cx-hud", { opacity: 0, ease: "none" }, 0)
    .to(".cx-hero-sky", { opacity: 0, ease: "none" }, 0);

  // The hand-over: the sun's light washes the screen as the hero leaves,
  // peaks as the manifesto arrives, and is gone before its words light.
  // Fixed, so it bridges the two sections instead of scrolling with one.
  var transit = document.createElement("div");
  transit.className = "cx-transit";
  transit.setAttribute("aria-hidden", "true");
  document.body.appendChild(transit);
  ScrollTrigger.create({
    trigger: ".cx-hero", start: "top top", end: "bottom top",
    onUpdate: function (self) {
      var k = Math.max(0, Math.min(1, (self.progress - 0.4) / 0.6));
      var o = Math.sin(k * Math.PI) * 0.7;
      transit.style.opacity = o.toFixed(3);
      transit.style.visibility = o > 0.002 ? "visible" : "hidden";
    },
    onLeave: function () { transit.style.opacity = 0; transit.style.visibility = "hidden"; }
  });

  // =============================================================
  // Manifesto: words light up as you scroll (pinned)
  // =============================================================
  var manifesto = $("[data-scrub-words]");
  var teles = $$(".cx-tele");
  var counted = false;

  // The record rolls in once, as the last words light: each figure on
  // mechanical reels (a strip of digits per column behind a mask; the
  // ones column rolls farthest, so a figure settles left to right), its
  // trace drawing along the line, then one scan over the whole line.
  // The real figure stays in the markup for screen readers and no-JS.
  teles.forEach(function (tele, i) {
    var num = $("[data-count]", tele);
    if (!num) return;
    var digits = num.getAttribute("data-count").split("");
    var reels = document.createElement("span");
    reels.className = "cx-reels";
    reels.setAttribute("aria-hidden", "true");
    digits.forEach(function (d, j) {
      var laps = digits.length - 1 - j + 1;   // ones column: most laps
      var reel = document.createElement("span");
      reel.className = "cx-reel";
      var strip = document.createElement("span");
      var html = "";
      for (var k = 0; k <= laps * 10 + (+d); k++) html += "<i>" + (k % 10) + "</i>";
      strip.innerHTML = html;
      strip.style.setProperty("--to", laps * 10 + (+d));
      strip.style.setProperty("--d", (1.5 + laps * 0.35).toFixed(2) + "s");
      strip.style.setProperty("--dl", (i * 0.14 + j * 0.06).toFixed(2) + "s");
      reel.appendChild(strip);
      reels.appendChild(reel);
    });
    num.classList.add("cx-sr");
    num.parentNode.insertBefore(reels, num);
  });
  function countUp() {
    if (counted) return;
    counted = true;
    teles.forEach(function (tele) { tele.classList.add("is-on"); });
    var line = $(".cx-telemetry");
    if (line) setTimeout(function () { line.classList.add("is-done"); }, 1900);
  }

  if (manifesto) {
    splitWords(manifesto);
    var words = $$(".cx-w", manifesto);
    var span = words.length * 0.1;
    gsap.timeline({
      scrollTrigger: {
        trigger: ".cx-manifesto",
        start: "top top",
        end: "+=130%",
        pin: ".cx-manifesto-pin",
        scrub: true,
        onUpdate: function (self) { if (self.progress > 0.8) countUp(); },
        onLeave: countUp
      }
    })
      .to(words, { opacity: 1, stagger: 0.1, duration: 0.4, ease: "none" }, 0)
      // Telemetry rises in as the sentence completes, then a short hold
      .fromTo(teles, { opacity: 0, y: 40 }, { opacity: 1, y: 0, stagger: span * 0.04, duration: span * 0.18, ease: "power2.out" }, span * 0.74)
      .to({}, { duration: span * 0.12 });
  } else {
    teles.forEach(function (tele) {
      ScrollTrigger.create({ trigger: tele, start: "top 90%", once: true, onEnter: countUp });
    });
  }

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

  // Off-screen scenes hold still: CSS loops pause on panels that are not
  // live (services.css) and the SVG motion paths pause with them
  function smil(panel, on) {
    $$("svg", panel).forEach(function (s) {
      if (s.pauseAnimations) s[on ? "unpauseAnimations" : "pauseAnimations"]();
    });
  }
  panels.forEach(function (p) { smil(p, false); });

  function setLive(panel, on) {
    if (panel.classList.contains("is-live") === on) return;
    panel.classList.toggle("is-live", on);
    smil(panel, on);
    var key = panel.getAttribute("data-scene");
    if (key && scenes[key]) scenes[key][on ? "start" : "stop"]();
  }

  // Ride length from the panels themselves: the drifting outline numbers
  // overhang the track, and scrollWidth would count them, leaving the
  // last division parked short of its mark
  function fleetDistance() {
    var last = panels[panels.length - 1];
    return Math.max(1, last.offsetLeft + last.offsetWidth - window.innerWidth);
  }

  var mm = gsap.matchMedia();

  mm.add("(min-width: 901px)", function () {
    fleet.classList.add("cx-h");
    var distance = fleetDistance;

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

    // Tabbing into a division off to the side: the browser would scroll
    // the clipped pin sideways; instead ride the page to that panel
    var pin = $(".cx-fleet-pin");
    function onFocus(e) {
      var panel = e.target.closest(".cx-panel");
      pin.scrollLeft = 0;
      if (!panel || !ride) return;
      var st = ride.scrollTrigger;
      var maxX = distance();
      var y = st.start + Math.min(maxX, panel.offsetLeft) / maxX * (st.end - st.start);
      if (Math.abs(window.scrollY - y) < 4) return;
      if (lenis) lenis.scrollTo(y, { immediate: true });
      else window.scrollTo(0, y);
    }
    track.addEventListener("focusin", onFocus);

    return function () {
      track.removeEventListener("focusin", onFocus);
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

  // The fleet's opening title card rises in as the section arrives
  gsap.from($$(".cx-panel--intro > :not(.cx-panel-bignum)"), {
    y: 50, opacity: 0, stagger: 0.1, duration: 1, ease: "power3.out",
    scrollTrigger: { trigger: fleet, start: "top 72%" }
  });

  // Anchor links (menu, star map, rails). A #sys-* panel sits inside the
  // horizontal track, so its scroll position is worked out from the ride.
  function targetY(hash) {
    var el = hash && hash.length > 1 ? document.getElementById(hash.slice(1)) : null;
    if (!el) return null;
    if (ride && el.classList.contains("cx-panel")) {
      var st = ride.scrollTrigger;
      var maxX = fleetDistance();
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
  mm.add({ wide: "(min-width: 821px)", narrow: "(max-width: 820px)" }, function (ctx) {
    // A tall stacked wall on phones only needs a hint of the tilt
    var wide = ctx.conditions.wide;
    gsap.fromTo(".cx-wall-grid",
      wide ? { rotateX: 38, rotateZ: -6, scale: 0.82, yPercent: 6 } : { rotateX: 14, rotateZ: -2, scale: 0.94, yPercent: 2 },
      {
        rotateX: 0, rotateZ: 0, scale: 1, yPercent: 0, ease: "none",
        scrollTrigger: { trigger: ".cx-wall", start: "top bottom", end: wide ? "top 20%" : "top 45%", scrub: true }
      });
  });

  gsap.from(".cx-field-head > *", {
    y: 40, opacity: 0, stagger: 0.1, duration: 0.9, ease: "power3.out",
    scrollTrigger: { trigger: ".cx-field-head", start: "top 80%" }
  });

  lazyVideos(true);

  // Chapters off screen pause their CSS loops (sweep, twinkle, pings...)
  if ("IntersectionObserver" in window) {
    var offscreen = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle("is-offscreen", !en.isIntersecting); });
    }, { rootMargin: "120px 0px" });
    $$(".cx-hero, .cx-starmap, .cx-field, .cx-flight, .cx-ignite").forEach(function (el) { offscreen.observe(el); });
  }

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
      { xPercent: dir > 0 ? -100 : 0, duration: 40, ease: "none", repeat: -1, paused: true });
    var onScreen = false;
    var skew = 0;

    // Only run while the band is on screen
    ScrollTrigger.create({
      trigger: row,
      start: "top bottom",
      end: "bottom top",
      onToggle: function (self) {
        onScreen = self.isActive;
        if (onScreen) loop.play(); else loop.pause();
      }
    });

    gsap.ticker.add(function () {
      if (!onScreen) return;
      loop.timeScale(1 + Math.min(Math.abs(velocity), 40) * 0.25);
      var k = -Math.max(-12, Math.min(12, velocity * 0.4)) * dir;
      if (Math.abs(k - skew) > 0.05) { skew = k; gsap.set(items, { skewX: k }); }
    });
  });

  // =============================================================
  // Flight plan: the ship flies the trajectory; stages ignite
  // =============================================================
  setupFlight(true);

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
  // Magnetic buttons, tilt scenes, star-map parallax
  // =============================================================
  if (finePointer) {
    $$("[data-magnetic]").forEach(function (el) {
      var xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
      var yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.25);
        yTo((e.clientY - r.top - r.height / 2) * 0.25);
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

  // ---- The six fleet scenes: start when live, stop when not ----
  function setupScenes() {
    var list = {};
    var noop = { start: function () {}, stop: function () {} };
    // the fleet's worlds are canvases now (fleet-worlds.js), each running
    // itself while on screen; the old DOM scenes below only if they're back
    if (!$("[data-code]")) return list;

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
  function setupFlight(motion) {
    var section = $(".cx-flight");
    if (!section) return;
    var map = $(".cx-flight-map", section);
    var svg = $(".cx-flight-svg", section);
    var guide = $(".cx-flight-guide", section);
    var trail = $(".cx-flight-trail", section);
    var ship = $(".cx-ship", section);
    var jet = $(".cx-jet", section);
    var lastThrustP = 0;
    var thrustTimer;
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
      ["Imagine", "It starts as a spark. We dream it up with you: the idea, the audience and what success looks like.", "Ignition",
        ["branding", "ui-ux-design", "artificial-intelligence"]],
      ["Think", "We pressure-test the idea: research, users, market and risk, so every decision has a reason.", "Climbing",
        ["ui-ux-design", "copywriting", "erp-crm"]],
      ["Plan", "Scope, stack, timeline and budget, laid out as one clear flight plan you sign off.", "Course set",
        ["custom-platforms", "cloud", "it-outsourcing"]],
      ["Create", "Brand, interface, words and motion take shape. You see it, feel it and shape it with us.", "Taking shape",
        ["branding", "ui-ux-design", "video-animation", "copywriting"]],
      ["Build", "Engineers bring it to life: code, content, integrations and intelligence, tested at every step.", "Full thrust",
        ["web-development", "ecommerce", "mobile-apps", "ar-vr", "artificial-intelligence"]],
      ["Refine", "We tune speed, polish details and fix what data and real users tell us. Nothing ships half-done.", "Course check",
        ["web-development", "mobile-apps", "ui-ux-design"]],
      ["Deliver", "Launch day, and every day after: hosting, security, updates and growth. We stay in orbit with you.", "In orbit",
        ["cloud", "it-outsourcing", "web-development", "mobile-apps"]]
    ];

    // The flight: the path gives him a target, not a position. He flies
    // to it on a damped spring (so he carries momentum, overshoots a
    // touch and settles), leans into turns, stretches at speed, and the
    // marks are beats: a boost and a shockwave at each (the biggest at
    // Deliver), a smoke billow off the pad at liftoff.
    // flight-fx.js is the air behind him (contrail, streaks, beats).
    var fx = motion && typeof FlightFX !== "undefined" ? FlightFX.create(map) : null;
    var F = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, ta: 0, h: 0, lean: 0,
      roll: -1, seeded: false, onPad: true,
      // which way he's flying along the path (1 up it, -1 back down), the
      // way he's shown facing, and the turnaround between the two
      dir: 1, lastP: -1, acc: 0, ddir: 1, mir: false, turn: -1, turned: false };
    var heading = function (a) { return Math.atan2(Math.sin(a), Math.cos(a)); };

    var len = 0;
    var wps = [];
    var wpLen = [];
    var fractions = [0.004, 0.18, 0.33, 0.49, 0.64, 0.8, 0.97];
    var current = -1;
    var lastProgress = motion ? 0 : 1;

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
      wpLen = fractions.map(function (f) { return len * f; });
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
      F.tx = pt.x; F.ty = pt.y;
      F.ta = Math.atan2(ahead.y - pt.y, ahead.x - pt.x);
      // going back down the path: he turns round once to face it (only
      // after a clear change of direction, so a jitter never spins him)
      if (F.lastP >= 0 && p !== F.lastP) {
        var dp = p - F.lastP;
        F.acc = (dp > 0) === (F.acc > 0) ? F.acc + dp : dp;
        if (Math.abs(F.acc) > 0.006 && p > 0.002 && p < 0.998) F.dir = dp > 0 ? 1 : -1;
      }
      F.lastP = p;
      if (!F.seeded || !motion) { F.x = pt.x; F.y = pt.y; F.vx = F.vy = 0; F.h = F.ta; F.seeded = true; }
      if (!motion) place(0);
      else wakeFlight();
      // liftoff: leaving the pad (again) puts it in a billow
      if (fx && F.onPad && p > 0.012) { F.onPad = false; fx.liftoff(wps[0] ? parseFloat(wps[0].style.left) : pt.x, wps[0] ? parseFloat(wps[0].style.top) : pt.y); }
      if (p < 0.004) F.onPad = true;
      // Scrolling harder opens the throttle; the plumes ease back when you stop
      var thrust = Math.min(1, Math.abs(p - lastThrustP) * 40);
      lastThrustP = p;
      if (thrust > 0.05 && jet) {
        jet.style.setProperty("--thrust", thrust.toFixed(2));
        clearTimeout(thrustTimer);
        thrustTimer = setTimeout(function () { jet.style.setProperty("--thrust", 0); }, 160);
      }
      meter.style.transform = "scaleX(" + p + ")";

      // One source of truth: a mark is reached the instant the lit trail
      // (and the rocket man riding its tip) arrives at it. Dots, labels,
      // the card and the checklist all switch on that same frame.
      var stage = 0;
      for (var i = 0; i < wpLen.length; i++) if (at >= wpLen[i] - 1) stage = i;
      wps.forEach(function (wp, i) {
        var reached = at >= wpLen[i] - 1;
        if (reached && !wp.classList.contains("is-done") && current !== -1) {
          wp.classList.remove("is-arriving");
          void wp.offsetWidth;
          wp.classList.add("is-arriving");
          if (fx && i > 0) {
            fx.beat(parseFloat(wp.style.left), parseFloat(wp.style.top), i === wps.length - 1);
            if (F.roll < 0) F.roll = 0;
            if (jet) { jet.style.setProperty("--thrust", 1); clearTimeout(thrustTimer); thrustTimer = setTimeout(function () { jet.style.setProperty("--thrust", 0); }, 420); }
          }
        }
        wp.classList.toggle("is-done", reached);
        wp.classList.toggle("is-current", i === stage);
      });
      if (stage !== current) setStage(stage);
    }

    // his pose from the flight state (dt = 0: just draw where he is)
    function place(dt) {
      var sp = Math.sqrt(F.vx * F.vx + F.vy * F.vy);
      var ox = 0, oy = 0, extra = 0, sx = 1;
      // the path's tangent, smoothed
      var dh = heading(F.ta - F.h);
      F.h = heading(F.h + dh * Math.min(1, dt * 9 || 1));
      // lean into the turn (the rate the path is turning at), eased
      var lean = dt ? Math.max(-0.4, Math.min(0.4, dh * 2.2)) : 0;
      F.lean += (lean - F.lean) * Math.min(1, dt * 6 || 1);
      // the facing he should have: along the path, or back down it; the
      // image is mirrored whenever that facing points left, so he's
      // always upright
      var face = function (d) { return F.h + (d < 0 ? Math.PI : 0); };
      var wantMir = Math.cos(face(F.dir)) < 0;
      // the turnaround: his profile narrows to a sliver and opens again
      // facing the other way (the switch happens at its thinnest), once
      if (F.turn < 0 && (F.dir !== F.ddir || wantMir !== F.mir)) { F.turn = 0; F.turned = false; }
      if (F.turn >= 0) {
        F.turn += (dt || 1) / 0.42;
        if (!F.turned && F.turn >= 0.5) { F.ddir = F.dir; F.mir = Math.cos(face(F.ddir)) < 0; F.turned = true; }
        sx = Math.max(0.06, Math.abs(Math.cos(Math.min(1, F.turn) * Math.PI)));
        if (F.turn >= 1) F.turn = -1;
      }
      var fh = face(F.ddir);
      // the boost at a mark: a surge the way he faces, a wobble that settles
      if (F.roll >= 0) {
        F.roll += dt / 0.8;
        var r = F.roll >= 1 ? 1 : F.roll;
        var surge = Math.sin(r * Math.PI) * Math.max(10, (jet ? jet.clientWidth : 100) * 0.16);
        ox += Math.cos(fh) * surge; oy += Math.sin(fh) * surge;
        extra += Math.sin(r * Math.PI * 3) * (1 - r) * 0.14;
        if (F.roll >= 1) F.roll = -1;
      }
      var deg = (fh + extra + F.lean * (F.mir ? -1 : 1) * 0.35) * 180 / Math.PI - (F.mir ? 180 : 0);
      ship.classList.toggle("is-flipped", F.mir);
      var stretch = 1 + Math.min(0.08, sp / 9000);
      ship.style.transform = "translate(" + (F.x + ox).toFixed(1) + "px," + (F.y + oy).toFixed(1) + "px) rotate(" + deg.toFixed(2) + "deg) scale(" + (stretch * sx).toFixed(3) + "," + (1 / stretch).toFixed(3) + ")";
      if (fx && dt) fx.trail(F.x + ox, F.y + oy, fh + extra, sp, +(jet && jet.style.getPropertyValue("--thrust")) || 0, dt, jet ? jet.clientWidth : 100);
    }

    var flying = false, flightLast = 0, flightT = 0;
    function wakeFlight() {
      if (flying) return;
      flying = true; flightLast = 0;
      gsap.ticker.add(flightTick);
    }
    function flightTick() {
      var now = performance.now();
      var dt = flightLast ? Math.min(0.25, (now - flightLast) / 1000) : 1 / 60;
      flightLast = now; flightT += dt;
      // the spring: stiff enough to keep up with the scroll, a little
      // loose; fixed sub-steps, so a stuttering frame never slows him
      var k = 70, c = 2 * Math.sqrt(k) * 0.72;
      for (var left = dt; left > 1e-4; left -= 1 / 120) {
        var h = Math.min(1 / 120, left);
        F.vx += ((F.tx - F.x) * k - F.vx * c) * h;
        F.vy += ((F.ty - F.y) * k - F.vy * c) * h;
        F.x += F.vx * h; F.y += F.vy * h;
      }
      dt = Math.min(dt, 0.05);
      place(dt);
      if (fx) fx.frame(dt, flightT);
      var settled = Math.abs(F.tx - F.x) < 0.2 && Math.abs(F.ty - F.y) < 0.2 && Math.abs(F.vx) + Math.abs(F.vy) < 2;
      // keep breathing smoke while he's on screen; sleep when he's gone
      var inView = section.getBoundingClientRect().bottom > 0 && section.getBoundingClientRect().top < window.innerHeight;
      if ((settled && F.roll < 0 && F.turn < 0 && !(fx && fx.alive()) && !inView) || (!inView && !(fx && fx.alive()))) {
        flying = false; gsap.ticker.remove(flightTick);
      }
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

    // Reduced motion / no GSAP: the whole trajectory, flown and parked
    if (!motion) return;

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
