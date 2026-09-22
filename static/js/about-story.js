/* ============================================================
   Worx by Glimpse — about-story.js
   About page only. Four independent pieces:

   1. Landing frame sequence — a dedicated, EXTENDED span of scroll
      distance (LANDING.duration "slots") at the very start of the
      pinned timeline, before the Preface→01 chapter transition
      begins. Scroll progress across that span selects a frame
      (0-31) from LandingSequence (landing-sequence.js), which draws
      it onto .story-landing. This is separate from the chapter
      page-turn below on purpose: it needs far more scroll runway
      than a normal 1-slot transition to read as a real cinematic
      landing rather than a rushed swap.

   2. Page-turn timeline — pins #story for the length of the
      storybook and scrubs a GSAP timeline across it. Each chapter
      transition gets one "slot" of scroll distance (one viewport
      height) AFTER the landing span, so scroll position maps
      directly to story progress in both directions — this is
      scroll-DRIVEN, not a wheel event that plays a canned animation.
      Only the outgoing/incoming scene+text pair animates per slot;
      every other chapter sits at opacity 0 (autoAlpha, so it's also
      out of the tab order) the whole time, which is what keeps the
      rest of the stack from ever being visible — see about.css's
      flat z-index layering for why nothing "shows through" underneath.

   3. Star layer — same persistent canvas particle system as before
      (adapted from Portfolio's initHero()), now a child of #story so
      it can sit between the scene stack and the text stack in the
      same stacking context (position:fixed on #story during the pin
      would otherwise trap it below the pinned text).

   4. Reduced motion / no-GSAP fallback — reduced motion keeps the
      scroll-driven pin but swaps the turn down to a plain opacity
      crossfade (no rotateX/scale/shadow); the landing sequence itself
      is unaffected (it was already a plain frame-substitution, not a
      3D effect). If GSAP/ScrollTrigger fails to load at all, #story
      drops the pin entirely and falls back to a plain stacked scroll
      (about.css .story--fallback) so every chapter and the footer
      stay reachable; the landing canvas is simply left blank in that
      path (no frames are ever requested).
   ============================================================ */

(function () {
  "use strict";

  var story = document.getElementById("story");
  if (!story) return;

  // Native smooth-scroll (base.css) fights ScrollTrigger's own scrub
  // smoothing, producing a laggy/mushy feel — this page drives its
  // own easing instead.
  document.documentElement.style.scrollBehavior = "auto";

  var reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  var isCompact = window.matchMedia("(max-width: 640px)").matches;

  var hasGsap = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";

  /* ----------------------------------------------------------
     1. Page-turn timeline
     ---------------------------------------------------------- */
  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);

    var scenes = gsap.utils.toArray(".story-scene");
    var texts = gsap.utils.toArray(".story-text");
    var shadow = document.querySelector(".story-turn-shadow");
    var count = scenes.length;

    // --- Landing frame sequence setup --------------------------
    var landingCanvas = document.querySelector(".story-landing");
    var landingSeq = null;
    var LANDING_DURATION = 3.5; // "slots" (viewport heights) of dedicated scroll runway

    if (landingCanvas && typeof LandingSequence !== "undefined") {
      landingSeq = new LandingSequence(landingCanvas, {
        basePath: landingCanvas.dataset.landingBase || "../static/assets/about/landing/glimpse-landing-",
        count: parseInt(landingCanvas.dataset.landingCount, 10) || 32,
        pad: parseInt(landingCanvas.dataset.landingPad, 10) || 3,
        frameWidth: parseInt(landingCanvas.dataset.landingWidth, 10) || 2400,
        frameHeight: parseInt(landingCanvas.dataset.landingHeight, 10) || 1350,
      });
      landingSeq.resize();
      landingSeq.preload().then(function (info) {
        console.info(
          "[about] landing sequence: " + info.loadedCount + "/" + info.total +
          " frame(s) found at " + (landingCanvas.dataset.landingBase || "(default path)") +
          (info.loadedCount < info.total ? " — drop the remaining PNGs in to complete it." : "")
        );
        landingSeq.refreshPending();
      });
    } else {
      LANDING_DURATION = 0; // no canvas / script missing: don't reserve scroll for nothing
    }

    // Resting state: only the first scene/text pair visible. autoAlpha
    // also sets visibility, so inactive chapters can't be tabbed into.
    gsap.set(scenes, { autoAlpha: 0, force3D: true });
    gsap.set(scenes[0], { autoAlpha: 1 });
    gsap.set(texts, { autoAlpha: 0, y: 22 });
    gsap.set(texts[0], { autoAlpha: 1, y: 0 });
    scenes[0].classList.add("is-active");
    texts[0].classList.add("is-active");
    if (landingCanvas) gsap.set(landingCanvas, { autoAlpha: 1 });

    var activeIndex = 0;
    function setActive(index) {
      if (index === activeIndex) return;
      activeIndex = index;
      scenes.forEach(function (s, idx) { s.classList.toggle("is-active", idx === index); });
      texts.forEach(function (t, idx) { t.classList.toggle("is-active", idx === index); });
    }

    var tlDuration = count - 1 + LANDING_DURATION;

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: story,
        start: "top top",
        end: function () { return "+=" + tlDuration * window.innerHeight; },
        scrub: 0.15,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          var t = self.progress * tlDuration;

          if (landingSeq) {
            var landingT = Math.max(0, Math.min(LANDING_DURATION, t));
            var landingProgress = LANDING_DURATION ? landingT / LANDING_DURATION : 1;
            landingSeq.setFrame(Math.round(landingProgress * (landingSeq.count - 1)));
          }

          setActive(Math.max(0, Math.round(t - LANDING_DURATION)));
        },
      },
      defaults: { ease: "power1.inOut" },
    });

    if (landingCanvas && LANDING_DURATION) {
      // Hold at full opacity through the landing, then release into
      // the normal chapter pacing so the landed ship doesn't linger
      // indefinitely once the story moves on.
      tl.to(landingCanvas, { autoAlpha: 0, duration: 1 }, LANDING_DURATION);
    }

    // Tuned down on narrow viewports per spec #20 — same transition,
    // smaller perspective displacement so it doesn't look broken on
    // a phone-width stage. Reduced motion drops rotate/scale/shadow
    // entirely and just crossfades (spec #21).
    var outRotate = reduceMotion ? 0 : isCompact ? -5 : -11;
    var inRotate = reduceMotion ? 0 : isCompact ? 2 : 5;
    var outScale = reduceMotion ? 1 : isCompact ? 0.97 : 0.94;
    var inScaleFrom = reduceMotion ? 1 : isCompact ? 1.025 : 1.05;

    for (var i = 0; i < count - 1; i++) {
      var pos = i + LANDING_DURATION;
      var outScene = scenes[i];
      var inScene = scenes[i + 1];
      var outText = texts[i];
      var inText = texts[i + 1];

      tl.to(outScene, {
        autoAlpha: 0,
        rotateX: outRotate,
        scale: outScale,
        transformOrigin: "50% 100%",
        duration: 1,
      }, pos);

      tl.fromTo(inScene,
        { autoAlpha: 0, rotateX: inRotate, scale: inScaleFrom, transformOrigin: "50% 0%" },
        { autoAlpha: 1, rotateX: 0, scale: 1, duration: 1 },
        pos);

      if (shadow && !reduceMotion) {
        tl.fromTo(shadow, { autoAlpha: 0 }, { autoAlpha: 0.28, duration: 0.5, ease: "power1.in" }, pos)
          .to(shadow, { autoAlpha: 0, duration: 0.5, ease: "power1.out" }, pos + 0.5);
      }

      tl.to(outText, { autoAlpha: 0, y: -16, duration: 0.55 }, pos);
      tl.fromTo(inText,
        { autoAlpha: 0, y: 22 },
        { autoAlpha: 1, y: 0, duration: 0.55 },
        pos + 0.4);
    }

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (landingSeq) landingSeq.resize();
        ScrollTrigger.refresh();
      }, 200);
    });
  } else {
    story.classList.add("story--fallback");
    document.querySelectorAll(".story-scene, .story-text").forEach(function (el) {
      el.classList.add("is-active");
    });
  }

  /* ----------------------------------------------------------
     2. Star layer (adapted from portfolio.js initHero())
     ---------------------------------------------------------- */
  var canvas = document.querySelector(".story-stars");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var dots = [];
  var raf = 0;
  var running = false;

  function resize() {
    canvas.width = Math.max(1, window.innerWidth * dpr);
    canvas.height = Math.max(1, window.innerHeight * dpr);
  }

  function seed() {
    var count = Math.round((canvas.width * canvas.height) / (dpr * dpr * 15000));
    count = Math.max(24, Math.min(90, count));
    dots = [];
    for (var i = 0; i < count; i++) {
      dots.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: (Math.random() * 1.1 + 0.3) * dpr,
        a: Math.random() * 0.6 + 0.15,
        tw: (Math.random() * 0.6 + 0.2) * (Math.random() < 0.5 ? -1 : 1),
        vx: (-0.1 - Math.random() * 0.18) * dpr,
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
    if (running || reduceMotion) return;
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
    paint(); // one static starfield, no drift/twinkle
  }

  // Only animate/paint while some part of the storybook is on
  // screen; fade the layer out once the visitor reaches the
  // footer so it never reads as "another chapter".
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      function (entries) {
        var visible = entries[0].isIntersecting;
        canvas.classList.toggle("is-hidden", !visible);
        if (visible) {
          start();
        } else {
          stop();
        }
      },
      { threshold: 0 }
    ).observe(story);
  } else {
    start();
  }

  var starResizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(starResizeTimer);
    starResizeTimer = setTimeout(function () {
      stop();
      resize();
      seed();
      if (!reduceMotion) start(); else paint();
    }, 200);
  });
})();
