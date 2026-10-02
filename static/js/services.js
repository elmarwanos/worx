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
    setupBelt(false);
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
    window.wxLenis = lenis; // main.js "Back to top" scrolls through it
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
    // the rail rides the hero only; it also has to know where the page
    // opened (an anchor, a refresh or the back button can land mid-page)
    var away = function (self) { comms.classList.toggle("is-away", !self.isActive); };
    ScrollTrigger.create({
      trigger: ".cx-hero",
      start: "top bottom",
      end: "bottom 40%",
      onToggle: away,
      onRefresh: away
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
  // The WORX BELT: two arcs of names drifting in opposite directions, the
  // near one faster. Scrolling lends them a little speed, eased in and
  // out, never a jolt. The ring of bodies behind them: setupBelt().
  // =============================================================
  var beltBoost = 0;
  $$("[data-marquee]").forEach(function (row) {
    var dir = parseFloat(row.getAttribute("data-marquee"));
    var inner = $(".cx-marquee-inner", row);
    var copy = row.appendChild(inner.cloneNode(true));
    copy.setAttribute("aria-hidden", "true");
    // the copy is only there for the loop: its links (CRAMS) stay out of the tab order
    $$("a", copy).forEach(function (l) { l.setAttribute("tabindex", "-1"); });
    var items = $$(".cx-marquee-inner", row);
    var loop = gsap.fromTo(items,
      { xPercent: dir > 0 ? 0 : -100 },
      { xPercent: dir > 0 ? -100 : 0, duration: dir > 0 ? 70 : 110, ease: "none", repeat: -1, paused: true });
    var onScreen = false, speed = 1;

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
      var target = 1 + Math.min(Math.abs(velocity), 40) * 0.08;
      speed += (target - speed) * 0.04;
      loop.timeScale(speed);
      if (dir > 0) beltBoost = speed - 1;
    });
  });
  setupBelt(true, function () { return beltBoost; });

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

  gsap.from(".cx-chip", {
    opacity: 0, y: 10, scale: 0.94, duration: 0.5, ease: "power3.out", stagger: 0.035, clearProps: "transform,opacity",
    scrollTrigger: { trigger: ".cx-mission", start: "top 70%" }
  });
  gsap.from([".cx-cta-intro .eyebrow", ".cx-ignite-sub", ".cx-path", ".cx-cta-contact", ".cx-mission"], {
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

  // ---- The WORX BELT: the tools we build with, as a Kuiper Belt ----
  // A tilted ring of dust and rocks. The near arc runs across the top
  // (the camera sits a little below the plane), sweeping left; the far
  // arc runs underneath, drifting right: each row of names rides its arc.
  // Each rock has its own lumpy outline and slow spin, lit from a far
  // light off to the upper right. Every body keeps its own orbit, the inner edge
  // moving faster than the outer (as orbits do), so the ring slowly
  // shears instead of sliding as one sheet; a few tumble, their light
  // rising and falling. No frame of its own: the canvas bleeds past the
  // band and fades into the page's sky. Scrolling flies the camera by:
  // arriving, the ring swells out of the dark and the names condense out
  // of the dust; leaving, the camera rises through the belt's plane and
  // the ring thins to a streak of light. Once in a long while a faint
  // comet drifts through. The flight's progress is --belt-in on the band
  // (0 far, 1 here), for the CSS. motion false: one still frame, arrived.
  // boost: extra speed from scrolling (0 at rest).
  function setupBelt(motion, boost) {
    var sec = $(".cx-belt");
    var cvs = sec && $(".cx-belt-sky", sec);
    if (!cvs || !cvs.getContext) return;
    var ctx = cvs.getContext("2d");
    var rows = $$(".cx-marquee-row", sec);
    var W = 0, H = 0, dpr = 1, bodies = [], running = false, last = 0, t = 0;
    var cy = 0, arcB = 0, bleed = 0, lastIn = -1;
    var comet = null, nextComet = 12 + Math.random() * 10;
    var rnd = function (a, b) { return a + Math.random() * (b - a); };
    var ease = function (x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

    function build() {
      var r = cvs.getBoundingClientRect(), sr = sec.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      if (!W || !H) return;
      bleed = sr.top - r.top;
      seps.forEach(function (sp) { sp.px = 0; });
      cvs.width = Math.round(W * dpr); cvs.height = Math.round(H * dpr);
      // the ring's centre between the rows; the arcs through their middles
      var y1 = sr.height * 0.4, y2 = sr.height * 0.62;
      if (rows.length > 1) {
        var a1 = rows[0].getBoundingClientRect(), a2 = rows[1].getBoundingClientRect();
        y1 = a1.top + a1.height / 2 - sr.top; y2 = a2.top + a2.height / 2 - sr.top;
      }
      cy = bleed + (y1 + y2) / 2;
      arcB = (y2 - y1) / 2;
      var n = Math.round(Math.max(420, Math.min(1500, W * 0.8)));
      bodies = [];
      for (var i = 0; i < n; i++) {
        var ring = Math.pow(Math.random(), 0.8);        // 0 inner edge .. 1 outer
        bodies.push({
          th: Math.random() * Math.PI * 2,
          r: 0.84 + ring * 0.34 + rnd(-0.03, 0.03),
          z: rnd(-1, 1) * rnd(0.1, 0.45),                 // height off the plane
          sz: Math.pow(Math.random(), 3.2) * 1.9 + 0.35,
          red: Math.random(),                              // ice to reddish
          tumble: Math.random() < 0.18 ? rnd(0.4, 1.6) : 0,
          ph: Math.random() * 6.28
        });
        // about one body in four is an asteroid big enough to see: one of
        // the ASTEROIDS shapes, tumbling at its own pace (the odd big one
        // rarer)
        if (Math.random() < 0.26) {
          bodies[bodies.length - 1].rock = {
            mesh: Math.floor(Math.random() * ASTEROIDS), ph: Math.random() * SPIN_FRAMES,
            spin: rnd(1.2, 4) * (Math.random() < 0.5 ? -1 : 1),
            sz: Math.random() < 0.1 ? rnd(9, 16) : rnd(3.5, 7.5)
          };
        }
      }
    }

    // ---- The asteroids: real 3D rocks, rendered once, then tumbled --
    // Each of the ASTEROIDS shapes starts as a sphere (an icosahedron
    // split twice, 320 faces), knocked into a rock: stretched into a
    // potato along its own axes, lumped by a few broad swells, and pitted
    // with craters (a dent with a raised rim). Every face is lit by the
    // far light off to the upper right (warm), with a faint cool fill
    // from the other side, drawn far faces first. Each shape is rendered
    // at SPIN_FRAMES steps of a turn about its own tilted axis, into small
    // sprites, a shape per clock tick so nothing stalls; a body then just
    // shows the step its tumble has reached.
    function icosphere() {
      var p = (1 + Math.sqrt(5)) / 2;
      var V = [[-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0], [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p], [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1]];
      var F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
        [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
      var norm = function (v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
      V = V.map(norm);
      for (var it = 0; it < 2; it++) {
        var cache = {}, NF = [];
        var mid = function (i, j) {
          var key = i < j ? i + "_" + j : j + "_" + i;
          if (cache[key] == null) { V.push(norm([(V[i][0] + V[j][0]) / 2, (V[i][1] + V[j][1]) / 2, (V[i][2] + V[j][2]) / 2])); cache[key] = V.length - 1; }
          return cache[key];
        };
        F.forEach(function (t3) {
          var ab = mid(t3[0], t3[1]), bc = mid(t3[1], t3[2]), ca = mid(t3[2], t3[0]);
          NF.push([t3[0], ab, ca], [t3[1], bc, ab], [t3[2], ca, bc], [ab, bc, ca]);
        });
        F = NF;
      }
      return { V: V, F: F };
    }
    var dirRnd = function () { var z = rnd(-1, 1), a2 = rnd(0, 6.2832), q = Math.sqrt(1 - z * z); return [q * Math.cos(a2), q * Math.sin(a2), z]; };
    function asteroidMesh() {
      var base = icosphere();
      var swells = [], craters = [];
      for (var k = 0; k < 5; k++) swells.push({ d: dirRnd(), a: rnd(0.08, 0.22), p: rnd(2, 5) });
      for (var c2 = 0; c2 < 5 + Math.floor(Math.random() * 4); c2++) craters.push({ d: dirRnd(), r: rnd(0.22, 0.5), h: rnd(0.08, 0.16) });
      var ax = [rnd(1.25, 1.7), rnd(0.8, 1.05), rnd(0.62, 0.85)];
      var V = base.V.map(function (v) {
        var r = 1;
        swells.forEach(function (w) { var d = v[0] * w.d[0] + v[1] * w.d[1] + v[2] * w.d[2]; if (d > 0) r += w.a * Math.pow(d, w.p); });
        craters.forEach(function (c3) {
          var d = v[0] * c3.d[0] + v[1] * c3.d[1] + v[2] * c3.d[2], ang = Math.acos(Math.max(-1, Math.min(1, d)));
          var u = ang / c3.r;
          if (u < 1) r -= c3.h * (1 - u * u);                 // the dent
          else if (u < 1.35) r += c3.h * 0.35 * (1 - (u - 1) / 0.35);   // its rim
        });
        r *= 1 + rnd(-0.025, 0.025);                           // grit
        return [v[0] * r * ax[0], v[1] * r * ax[1], v[2] * r * ax[2]];
      });
      var ext = V.reduce(function (m, v) { return Math.max(m, Math.hypot(v[0], v[1], v[2])); }, 0);
      V = V.map(function (v) { return [v[0] / ext, v[1] / ext, v[2] / ext]; });
      var tone = base.F.map(function () { return rnd(0.86, 1.08); });   // patchy surface
      return { V: V, F: base.F, tone: tone, axis: dirRnd(), start: [rnd(0, 6.28), rnd(0, 6.28)], red: Math.random() };
    }
    var ASTEROIDS = 8, SPIN_FRAMES = 48, SPR = 80, sprites = [], meshQueue = 0;
    var LIGHT = (function () { var l = [0.62, -0.5, 0.6], n = Math.hypot(l[0], l[1], l[2]); return [l[0] / n, l[1] / n, l[2] / n]; })();
    function rotate(v, ax, ang) {          // Rodrigues: v turned ang about the unit axis ax
      var c = Math.cos(ang), sn = Math.sin(ang), d = v[0] * ax[0] + v[1] * ax[1] + v[2] * ax[2];
      return [v[0] * c + (ax[1] * v[2] - ax[2] * v[1]) * sn + ax[0] * d * (1 - c),
        v[1] * c + (ax[2] * v[0] - ax[0] * v[2]) * sn + ax[1] * d * (1 - c),
        v[2] * c + (ax[0] * v[1] - ax[1] * v[0]) * sn + ax[2] * d * (1 - c)];
    }
    function renderAsteroid(m) {
      var frames = [];
      for (var fr = 0; fr < SPIN_FRAMES; fr++) {
        var cv = document.createElement("canvas"); cv.width = cv.height = SPR;
        var g = cv.getContext("2d"), R = SPR * 0.44, C = SPR / 2, ang = (fr / SPIN_FRAMES) * 6.2832;
        var P = m.V.map(function (v) {
          var w = rotate(rotate(v, [1, 0, 0], m.start[0]), [0, 1, 0], m.start[1]);
          return rotate(w, m.axis, ang);
        });
        var faces = [];
        m.F.forEach(function (t3, fi) {
          var A = P[t3[0]], B = P[t3[1]], Cc = P[t3[2]];
          var ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = Cc[0] - A[0], vy = Cc[1] - A[1], vz = Cc[2] - A[2];
          var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz) || 1;
          nx /= nl; ny /= nl; nz /= nl;
          if (nz <= 0) return;                                  // facing away
          var lit = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
          var fill = Math.max(0, -nx * 0.6 + ny * 0.3 + nz * 0.25) * 0.12;
          faces.push({ t: t3, z: (A[2] + B[2] + Cc[2]) / 3, lit: lit, fill: fill, tone: m.tone[fi] });
        });
        faces.sort(function (p1, p2) { return p1.z - p2.z; });
        faces.forEach(function (fc) {
          var k2 = (0.07 + 0.93 * Math.pow(fc.lit, 0.9)) * fc.tone;
          var r = Math.round(Math.min(255, (150 + 40 * m.red) * k2 + 38 * fc.fill));
          var gg = Math.round(Math.min(255, (116 + 6 * m.red) * k2 + 34 * fc.fill));
          var bb = Math.round(Math.min(255, (94 - 18 * m.red) * k2 + 52 * fc.fill));
          g.fillStyle = g.strokeStyle = "rgb(" + r + "," + gg + "," + bb + ")";
          g.lineWidth = 0.6;
          g.beginPath();
          for (var q = 0; q < 3; q++) { var pt = P[fc.t[q]], px = C + pt[0] * R, py = C + pt[1] * R; if (q) g.lineTo(px, py); else g.moveTo(px, py); }
          g.closePath(); g.fill(); g.stroke();
        });
        frames.push(cv);
      }
      return frames;
    }
    // one shape per call, until all are made. The separators between the
    // names (.cx-kbo, data-km naming the shape) each get a small canvas
    // of their own once their shape exists; tumbleSeparators() shows each
    // one's turn, at its own pace (--kt, a full turn) and direction (--kd)
    var seps = [];
    function growAsteroids() {
      if (meshQueue >= ASTEROIDS) return;
      var mi = meshQueue;
      sprites[mi] = renderAsteroid(asteroidMesh());
      meshQueue++;
      $$('.cx-kbo[data-km="' + mi + '"]', sec).forEach(function (el) {
        var cv = document.createElement("canvas");
        el.appendChild(cv);
        el.classList.add("is-rock");
        var turn = parseFloat(el.style.getPropertyValue("--kt")) || 10;
        var rev = el.style.getPropertyValue("--kd").trim() === "reverse";
        seps.push({ el: el, cv: cv, g: cv.getContext("2d"), mesh: mi, fps: (rev ? -1 : 1) * SPIN_FRAMES / turn, ph: Math.random() * SPIN_FRAMES, fi: -1, px: 0 });
      });
    }
    function tumbleSeparators() {
      for (var i = 0; i < seps.length; i++) {
        var sp = seps[i];
        // measured once (and again after a resize, build() clears it)
        if (!sp.px) {
          var m = Math.round(sp.el.clientWidth * dpr);
          if (!m) continue;
          sp.px = sp.cv.width = sp.cv.height = m; sp.fi = -1;
        }
        var px = sp.px;
        var fi = Math.floor(((sp.ph + t * sp.fps) % SPIN_FRAMES + SPIN_FRAMES) % SPIN_FRAMES);
        if (fi === sp.fi) continue;
        sp.fi = fi;
        sp.g.clearRect(0, 0, px, px);
        sp.g.drawImage(sprites[sp.mesh][fi], 0, 0, px, px);
      }
    }

    // how far the flight is: 0 the band below the view, 1 above it
    function progress() {
      var sr = sec.getBoundingClientRect(), vh = window.innerHeight;
      return Math.max(0, Math.min(1, (vh - sr.top) / (vh + sr.height)));
    }

    function frame(now) {
      if (!W) return;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now; t += dt;
      var p = motion ? progress() : 0.5;
      // arriving (p 0.1 .. 0.42), here, then rising through the plane
      var arrive = ease((p - 0.1) / 0.32), leave = ease((p - 0.6) / 0.34);
      var k = arrive * (1 - leave * 0.85);
      if (Math.abs(k - lastIn) > 0.004) { lastIn = k; sec.style.setProperty("--belt-in", k.toFixed(3)); }
      var scale = 0.55 + 0.45 * arrive + 0.35 * leave;    // the ring swells as we close in
      var flat = 1 - 0.9 * leave;                          // and thins as we rise through it
      var a = W * 0.44 * scale, b = arcB * scale * flat;
      var extra = motion && boost ? boost() : 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (k < 0.01) return;
      ctx.globalCompositeOperation = "lighter";
      var farRocks = [], nearRocks = [];
      for (var i = 0; i < bodies.length; i++) {
        var o = bodies[i];
        // Kepler: the inner edge moves faster than the outer
        if (motion) o.th += dt * (0.02 + extra * 0.05) / Math.pow(o.r, 1.5);
        var s = Math.sin(o.th), near = (s + 1) / 2, depth = 0.4 + 0.6 * near;
        var x = W / 2 + a * o.r * Math.cos(o.th);
        var y = cy - b * o.r * s + o.z * arcB * scale * (0.4 + 0.6 * flat);
        if (x < -4 || x > W + 4 || y < -4 || y > H + 4) continue;
        var tum = o.tumble ? 0.55 + 0.45 * Math.sin(t * o.tumble + o.ph) : 1;
        // the bleed above and below the band fades into the page
        var edge = Math.min(1, Math.min(y, H - y) / (bleed || 1));
        var alpha = Math.min(1, (0.14 + 0.62 * depth) * tum * k * edge);
        if (alpha < 0.02) continue;
        var size = o.sz * (0.5 + 0.8 * depth) * (0.8 + 0.3 * scale);
        if (o.rock) {
          o.px = x; o.py = y; o.pa = alpha; o.pd = depth;
          o.ps = o.rock.sz * (0.45 + 0.75 * depth) * (0.8 + 0.3 * scale);
          if (!sprites[o.rock.mesh]) continue;
          (near < 0.5 ? farRocks : nearRocks).push(o);
          continue;
        }
        var gC = Math.round(238 - o.red * 90), bC = Math.round(207 - o.red * 140);
        ctx.fillStyle = "rgba(254," + gC + "," + bC + "," + alpha.toFixed(3) + ")";
        if (size > 1.4) {
          ctx.beginPath(); ctx.arc(x, y, size * 0.6, 0, 6.2832); ctx.fill();
          ctx.fillStyle = "rgba(250,167,25," + (alpha * 0.12).toFixed(3) + ")";
          ctx.beginPath(); ctx.arc(x, y, size * 2.2, 0, 6.2832); ctx.fill();
        } else {
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
      ctx.globalCompositeOperation = "source-over";
      var drawRocks = function (list) {
        for (var j = 0; j < list.length; j++) {
          var q = list[j], rk = q.rock, n2 = SPIN_FRAMES;
          var fi = Math.floor(((rk.ph + t * rk.spin) % n2 + n2) % n2);
          ctx.globalAlpha = Math.min(1, q.pa * 1.15);
          ctx.drawImage(sprites[rk.mesh][fi], q.px - q.ps, q.py - q.ps, q.ps * 2, q.ps * 2);
        }
        ctx.globalAlpha = 1;
      };
      drawRocks(farRocks);
      drawRocks(nearRocks);
      ctx.globalCompositeOperation = "lighter";
      // a comet, once in a long while: slow and faint, its tail pointing
      // away from the far light
      if (motion && k > 0.5) {
        nextComet -= dt;
        if (!comet && nextComet <= 0) {
          var fromLeft = Math.random() < 0.5;
          comet = { x: (fromLeft ? rnd(0.04, 0.2) : rnd(0.8, 0.96)) * W, y: cy - arcB * rnd(1.6, 2.4),
            vx: (fromLeft ? 1 : -1) * rnd(0.018, 0.03) * W, vy: arcB * rnd(0.12, 0.2), age: 0, life: rnd(6, 9) };
        }
        if (comet) {
          comet.age += dt; comet.x += comet.vx * dt; comet.y += comet.vy * dt;
          var ca = Math.sin(Math.min(1, comet.age / comet.life) * Math.PI) * 0.5 * k;
          var dx = -0.83, dy = 0.56, dl = 1;
          var tx = comet.x + dx / dl * W * 0.06, ty = comet.y + dy / dl * W * 0.06;
          var cg = ctx.createLinearGradient(comet.x, comet.y, tx, ty);
          cg.addColorStop(0, "rgba(255,236,200," + ca.toFixed(3) + ")");
          cg.addColorStop(1, "rgba(255,236,200,0)");
          ctx.strokeStyle = cg; ctx.lineWidth = 1.2; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(comet.x, comet.y); ctx.lineTo(tx, ty); ctx.stroke();
          ctx.fillStyle = "rgba(255,248,232," + Math.min(1, ca * 1.6).toFixed(3) + ")";
          ctx.beginPath(); ctx.arc(comet.x, comet.y, 1.3, 0, 6.2832); ctx.fill();
          if (comet.age > comet.life) { comet = null; nextComet = rnd(22, 38); }
        }
      }
      ctx.globalCompositeOperation = "source-over";
    }

    build();
    var rt = 0;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { build(); lastIn = -1; frame(performance.now()); }, 150);
    });
    if (!motion) {
      while (meshQueue < ASTEROIDS) growAsteroids();
      sec.style.setProperty("--belt-in", "1"); frame(performance.now()); tumbleSeparators(); return;
    }
    // on the page's own clock (gsap's ticker), only while the band is
    // near the view, as the rows are
    ScrollTrigger.create({
      trigger: sec,
      start: "top bottom",
      end: "bottom top",
      onToggle: function (self) {
        running = self.isActive;
        sec.classList.toggle("is-offscreen", !running);
        last = 0;
      },
      onRefresh: function () { build(); }
    });
    gsap.ticker.add(function () {
      if (!running) return;
      growAsteroids();
      frame(performance.now());
      tumbleSeparators();
    });
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
    // each division's constellation, in division order (the labels on
    // the map come from tools/services/build.js, which names them too)
    var CONSTELLATIONS = ["Fornax", "Pyxis", "Pictor", "Nova", "Norma"];
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
      cDiv.textContent = (CONSTELLATIONS[s.divIndex] ? CONSTELLATIONS[s.divIndex] + " · " : "") + s.division;
      cName.textContent = s.name;
      cShort.textContent = s.short;
      // the board shows the first capabilities and a count of the rest (the
      // service page has them all): it never scrolls
      // (a budget of text rather than a count, so long names show fewer)
      var BUDGET = 96, used = 0, shown = 0;
      while (shown < s.subs.length && used + s.subs[shown].length <= BUDGET) used += s.subs[shown++].length;
      if (s.subs.length - shown === 1) shown++;   // never "+1 more": just show it
      var more = s.subs.length - shown;
      cSubs.innerHTML = s.subs.slice(0, shown).map(function (x) { return "<li>" + x + "</li>"; }).join("") +
        (more > 0 ? '<li class="is-more">+' + more + " more</li>" : "");
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
  // The brief builder. Picking services lights the flight path's first
  // stage, counts them onto the payload bar and arms the ignition, whose
  // link carries them to the contact page (?services=a,b), where the
  // planner shows them and sends them with the enquiry. Reaching the
  // button lights "transmit"; the click lights "launch" as the ignition
  // (ignite.js) lifts off.
  function setupMission() {
    var chips = $$("[data-mission]");
    var payload = $("[data-payload]");
    var clear = $("[data-mission-clear]");
    var btn = $(".cx-ignite-btn");
    var label = $("[data-cta-label]");
    var hint = $("[data-cta-hint]");
    var count = $("[data-mission-count]");
    var bar = $("[data-mission-bar]");
    var path = $("[data-path]");
    if (!chips.length || !btn) return;
    var base = btn.getAttribute("href");

    function update() {
      var picked = chips.filter(function (c) { return c.getAttribute("aria-pressed") === "true"; })
        .map(function (c) { return c.getAttribute("data-mission"); });
      var n = picked.length;
      payload.textContent = n ? n + (n === 1 ? " service" : " services") + " on board" : "Nothing selected yet";
      if (label) label.textContent = n ? "Send my brief" : "Start a project";
      if (hint) {
        hint.textContent = n ? "Opens the planner with your " + (n === 1 ? "service" : n + " services") : "Pick a service or two, then launch.";
        hint.classList.toggle("is-armed", n > 0);
      }
      if (count && count.textContent !== String(n)) {
        count.textContent = n;
        count.classList.remove("is-tick"); void count.offsetWidth; count.classList.add("is-tick");
      }
      if (bar) bar.style.setProperty("--fill", (n / chips.length * 100).toFixed(1) + "%");
      if (path) path.classList.toggle("is-select", n > 0);
      payload.parentNode.classList.toggle("is-armed", n > 0);
      clear.hidden = !n;
      btn.setAttribute("href", n ? base + "?services=" + encodeURIComponent(picked.join(",")) : base);
      btn.classList.toggle("is-armed", n > 0);
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var on = chip.getAttribute("aria-pressed") !== "true";
        chip.setAttribute("aria-pressed", on ? "true" : "false");
        chip.classList.remove("is-pop");
        if (on) { void chip.offsetWidth; chip.classList.add("is-pop"); }
        update();
      });
      chip.addEventListener("animationend", function () { chip.classList.remove("is-pop"); });
    });
    clear.addEventListener("click", function () {
      chips.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
      update();
    });

    // the path follows the pointer (or keyboard) to the ignition, and the launch
    if (path) {
      var near = function (on) { path.classList.toggle("is-transmit", on); };
      btn.addEventListener("pointerenter", function () { near(true); });
      btn.addEventListener("pointerleave", function () { near(false); });
      btn.addEventListener("focus", function () { near(true); });
      btn.addEventListener("blur", function () { near(false); });
      btn.addEventListener("click", function () { path.classList.add("is-transmit", "is-launch"); });
      // coming back to the page (the back button), the launch is over
      window.addEventListener("pageshow", function () { path.classList.remove("is-launch", "is-transmit"); });
    }
    update();
  }
})();
