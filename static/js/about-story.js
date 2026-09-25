/* ============================================================
   Worx | about-story.js
   About page only. Four independent pieces:

   1. Scene animation lifecycle, each .story-scene can own an
      animation that plays while that scene is active. Right now
      only scene 0 (the GLIMPSE landing) has one: a 32-frame
      autoplay sequence, drawn onto .story-landing via
      LandingSequence (landing-sequence.js). It is driven by a
      requestAnimationFrame clock (time-based, not scroll-based),
      so it plays on its own the moment the scene becomes active,
      and it is cancelled the instant the scene stops being active.
      sceneAnimations[] below is the reusable hook table, future
      chapters (rover deployment, base construction, etc.) plug in
      the same way: { onEnter, onLeave }. onEnter also serves as
      "onReEnter", re-entering a scene just calls onEnter again,
      which is why the landing resets to frame 0 and replays every
      time the visitor scrolls back up to it.

   2. Page-turn navigation, scrolling no longer scrubs anything.
      One wheel/trackpad gesture (or touch swipe) advances or
      retreats exactly one story page; goToPage() plays a fixed-
      duration GSAP tween (not a scrub) between the outgoing and
      incoming scene+text pair. Every other chapter sits at
      opacity 0 (autoAlpha, so it's also out of the tab order) the
      whole time, see about.css's flat z-index layering for why
      nothing "shows through" underneath.

   3. Scroll capture, while the story is showing (window is at
      the very top of the page), wheel/touch input is intercepted
      and converted into goToPage() calls instead of scrolling the
      document. The one exception: scrolling forward from the last
      page is allowed to fall through as a normal scroll, so the
      visitor reaches the footer naturally. Scrolling back up from
      the footer is likewise normal scroll until the page returns
      to scrollY 0, at which point wheel input is captured again
      (already sitting on the last story page, ready to step back).
      A single isAnimating lock (transition duration + a short
      buffer) makes one gesture equal one page, even under a fast
      or "flung" trackpad gesture that fires many wheel events.

   4. Star layer, same persistent canvas particle system as
      before (adapted from Portfolio's initHero()), a child of
      #story so it can sit between the scene stack and the text
      stack in the same stacking context.

   5. Landing composite, landing-fx.js (LandingFX) owns the landing
      clock: it grounds the ship on the terrain's calibrated line,
      cross-dissolves neighbouring frames for smooth motion, and adds
      the contact shadow / engine light on the terrain (flames and the
      main dust cloud are baked into the frames). This file just ticks
      it and uses the returned frame number to drive the bottom-left
      descent narration (DESCENT_NARRATION), the only HUD location on
      this page; there is no separate top-right panel.

   Reduced motion / no-GSAP fallback: reduced motion keeps page
   navigation but swaps the turn down to a plain opacity crossfade
   (no rotateX/scale/shadow); the landing sequence itself is
   unaffected (it was already a plain frame-substitution, not a 3D
   effect). If GSAP fails to load at all, #story drops the whole
   interaction model and falls back to a plain stacked scroll
   (about.css .story--fallback) so every chapter and the footer
   stay reachable; the landing canvas is simply left blank in that
   path (no frames are ever requested).
   ============================================================ */

(function () {
  "use strict";

  var story = document.getElementById("story");
  if (!story) return;

  var reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  var isCompact = window.matchMedia("(max-width: 640px)").matches;

  var hasGsap = typeof gsap !== "undefined";

  if (hasGsap) {
    var scenes = gsap.utils.toArray(".story-scene");
    var texts = gsap.utils.toArray(".story-text");
    var shadow = document.querySelector(".story-turn-shadow");
    var sceneCount = scenes.length;

    /* ----------------------------------------------------------
       1. Landing frame sequence (scene 0's animation)
       ---------------------------------------------------------- */
    var landingCanvas = document.querySelector(".story-landing");
    var landingBackCanvas = document.querySelector(".story-landing-back");
    var landingFrontCanvas = document.querySelector(".story-landing-front");
    var landingStatusEl = document.querySelector(".story-text--landing .story-status");
    var landingStatusTextEl = landingStatusEl && landingStatusEl.querySelector(".story-status-text");
    var landingSeq = null;
    var landingFX = null;
    var LANDING_DURATION_MS = 4000; // fallback clock when LandingFX is unavailable
    var LANDING_TEXT_DELAY_MS = 1600; // after the dust burst: card boots in as the legs come through the clearing dust
    var TEXT_REVEAL_DELAY = 0.2; // seconds; beat between a page becoming active and its mission text starting
    var landingRAF = 0;
    var landingTextTimer = null;

    if (landingCanvas && typeof LandingSequence !== "undefined") {
      landingSeq = new LandingSequence(landingCanvas, {
        basePath: landingCanvas.dataset.landingBase || "../static/assets/about/glimpse_landing_frames_001-032/glimpse-landing-",
        count: parseInt(landingCanvas.dataset.landingCount, 10) || 32,
        pad: parseInt(landingCanvas.dataset.landingPad, 10) || 3,
        frameWidth: parseInt(landingCanvas.dataset.landingWidth, 10) || 2560,
        frameHeight: parseInt(landingCanvas.dataset.landingHeight, 10) || 1440,
      });
      landingSeq.resize();
      var landingReady = landingSeq.preload();
      landingReady.then(function (info) {
        console.info(
          "[about] landing sequence: " + info.loadedCount + "/" + info.total +
          " frame(s) found at " + (landingCanvas.dataset.landingBase || "(default path)") +
          (info.loadedCount < info.total ? ", drop the remaining PNGs in to complete it." : "")
        );
        if (!landingFX) landingSeq.refreshPending();
      });
    }

    // Cinematic layers for the landing shot (about.css):
    // grain, vignette, touchdown flash, fade-from-black.
    var landingTerrain = document.querySelector(".story-scene--landing .story-terrain");
    var flashEl = document.querySelector(".story-flash");
    var grainEl = document.querySelector(".story-grain");

    // The virtual camera moves the terrain and the three landing
    // canvases together. They must share one transform origin in
    // viewport space, or the push-in would slide them apart.
    var CAMERA_ORIGIN_Y = 0.62;
    function syncCameraOrigin() {
      var h = story.clientHeight;
      [landingBackCanvas, landingCanvas, landingFrontCanvas].forEach(function (el) {
        if (el) el.style.transformOrigin = "50% " + (CAMERA_ORIGIN_Y * 100) + "%";
      });
      if (landingTerrain) {
        landingTerrain.__camBase = "translateX(-50%)"; // its resting CSS transform
        landingTerrain.style.transformOrigin = "50% " + (CAMERA_ORIGIN_Y * h - landingTerrain.offsetTop) + "px";
      }
    }
    syncCameraOrigin();

    if (grainEl && typeof LandingFX !== "undefined") {
      grainEl.style.backgroundImage = "url(" + LandingFX.grainDataURL(180) + ")";
    }

    if (landingBackCanvas && landingFrontCanvas && typeof LandingFX !== "undefined") {
      landingFX = new LandingFX(landingBackCanvas, landingFrontCanvas, {
        sequence: landingSeq,
        camera: [landingTerrain, landingBackCanvas, landingCanvas, landingFrontCanvas].filter(Boolean),
        cameraOriginY: CAMERA_ORIGIN_Y,
        flash: flashEl,
        onFrame: function (info) {
          if (currentIndex !== 1) updateHud(info);
        },
        reduceMotion: reduceMotion,
      });
      landingFX.resize();
      if (typeof MartianSky !== "undefined") landingFX.sky = new MartianSky({ reduceMotion: reduceMotion });
    }

    // Section 2's camera angle on the landed ship: left third, turned to
    // face right (perspective warp, LandingFX still mode, a clean,
    // stationary ship with no dust). Narrow/portrait screens shift less.
    function summaryPose() {
      var wide = story.clientWidth / Math.max(1, story.clientHeight) > 1.1;
      // A few degrees of yaw, a ship parked dead square to the camera
      // reads as a flat cutout; sitting very slightly turned toward the
      // hatch is what makes it look like it's actually resting on the
      // ground. dx keeps it left-of-centre without ever touching either
      // edge, 034's own framing matches 033's almost exactly.
      return { dx: wide ? -0.14 : -0.05, yaw: wide ? 4 : 2 };
    }

    var MARKS = typeof LandingFX !== "undefined" ? LandingFX.MARKS
      : { separation: 0, hover: LANDING_DURATION_MS * 0.6, touchdown: LANDING_DURATION_MS * 0.75, landed: LANDING_DURATION_MS, clear: LANDING_DURATION_MS };
    var DESCENT_NARRATION = [
      { at: 0, text: "Atmospheric entry" },
      { at: MARKS.separation - 1200, text: "Peak heating" },
      { at: MARKS.separation, text: "Heat shield sep" },
      { at: MARKS.separation + 1400, text: "Powered descent" },
      { at: MARKS.hover - 500, text: "Surface acquired" },
      { at: MARKS.touchdown, text: "Touchdown" },
      { at: MARKS.clear - 600, text: "Site secured" },
    ];

    var landingTextEl = document.querySelector(".story-text--landing");
    var hud = {
      stages: [],
      stage: -1,
      lastText: 0,
      root: document.querySelector(".landing-hud"),
      log: document.querySelector(".hud-log"),
      target: document.querySelector(".hud-target"),
      label: document.querySelector(".hud-target-label"),
      line: document.querySelector(".hud-leader-line"),
      accent: document.querySelector(".hud-leader-accent"),
      alt: document.querySelector('[data-hud="alt"]'),
      vel: document.querySelector('[data-hud="vel"]'),
      dist: document.querySelector('[data-hud="dist"]'),
      clock: document.querySelector('[data-hud="t"]'),
    };
    (function buildStages() {
      var list = document.querySelector(".hud-stages");
      if (!list) return;
      DESCENT_NARRATION.forEach(function (n) {
        var li = document.createElement("li");
        li.textContent = n.text;
        list.appendChild(li);
        hud.stages.push(li);
      });
    })();

    function resetHud() {
      hud.stage = -1;
      hud.stages.forEach(function (li) { li.classList.remove("is-done", "is-active"); });
      if (hud.label) hud.label.textContent = "GLIMPSE-01";
      if (landingTextEl) landingTextEl.classList.remove("is-live", "is-revealed");
    }

    function fmtAlt(m) { return m >= 1000 ? (m / 1000).toFixed(2) + " KM" : Math.round(m) + " M"; }
    function fmtVel(v) { return (v >= 10 ? Math.round(v) : v.toFixed(1)) + " M/S"; }
    function fmtDist(km) { return km >= 1 ? km.toFixed(1) + " KM" : Math.round(km * 1000) + " M"; }
    function fmtClock(ms) {
      var sec = ms / 1000, m = Math.floor(sec / 60);
      sec = sec - m * 60;
      return "T+" + (m < 10 ? "0" : "") + m + ":" + (sec < 10 ? "0" : "") + sec.toFixed(1);
    }

    function updateHud(info) {
      var e = info.elapsed;
      // Stage list.
      var stage = 0;
      for (var i = 0; i < DESCENT_NARRATION.length; i++) if (e >= DESCENT_NARRATION[i].at) stage = i;
      if (stage !== hud.stage) {
        hud.stage = stage;
        hud.stages.forEach(function (li, j) {
          li.classList.toggle("is-done", j < stage);
          li.classList.toggle("is-active", j === stage);
        });
        if (hud.label && e >= MARKS.touchdown) hud.label.textContent = "GLIMPSE-01 · LANDED";
      }
      // Telemetry, ~15 Hz so the digits stay readable.
      if (e - hud.lastText > 66 || e < hud.lastText) {
        hud.lastText = e;
        var t = info.telemetry;
        if (hud.alt) hud.alt.textContent = fmtAlt(t.alt);
        if (hud.vel) hud.vel.textContent = fmtVel(t.vel);
        if (hud.dist) hud.dist.textContent = fmtDist(t.dist);
        if (hud.clock) hud.clock.textContent = fmtClock(e);
      }
      // The HUD rides the touchdown shake a little: it's part of the shot.
      if (hud.root) hud.root.style.transform = (info.shake.x || info.shake.y)
        ? "translate(" + (info.shake.x * 0.35).toFixed(1) + "px," + (info.shake.y * 0.35).toFixed(1) + "px)" : "";
      // Target marker + leader line from the active stage to the ship.
      var tx = info.ship.x, ty = info.ship.y;
      if (hud.target) hud.target.style.transform = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px)";
      var li = hud.stages[hud.stage];
      if (li && hud.line && hud.accent && hud.log) {
        var base = story.getBoundingClientRect();
        var lr = hud.log.getBoundingClientRect();
        var r = li.getBoundingClientRect();
        var ax = lr.right - base.left, ay = r.top + r.height / 2 - base.top;
        var kx = ax + Math.min(60, Math.max(24, (tx - ax) * 0.18));
        var ex = tx - 20 * (tx >= kx ? 1 : -1), ey = ty; // stop at the outer ring
        hud.accent.setAttribute("points", ax.toFixed(1) + "," + ay.toFixed(1) + " " + kx.toFixed(1) + "," + ay.toFixed(1));
        hud.line.setAttribute("points", kx.toFixed(1) + "," + ay.toFixed(1) + " " + ex.toFixed(1) + "," + ey.toFixed(1));
      }
    }

    function setLandingStatus(text) {
      if (!landingStatusTextEl) return;
      landingStatusTextEl.textContent = text;
      if (landingStatusEl) {
        landingStatusEl.classList.remove("is-scanned");
        void landingStatusEl.offsetWidth; // restart the CSS scan-line keyframe
        landingStatusEl.classList.add("is-scanned");
      }
    }

    // Time-based, not scroll-based: plays 0→last once and stops. Always
    // cancels any previous run first, so returning to the scene mid-flight
    // (or fast back-and-forth navigation) never stacks up duplicate loops.
    function playLanding() {
      if (!landingSeq) return;
      cancelAnimationFrame(landingRAF);
      clearTimeout(landingTextTimer);
      if (landingFX) landingFX.reset();
      resetHud();
      // Hold on black until the frames are decoded,
      // so the ship can never arrive missing; then fade up and roll.
      story.classList.add("is-cinema", "is-blackout");
      var token = (playLanding.token = (playLanding.token || 0) + 1);
      (landingReady || Promise.resolve()).then(function () {
        if (token !== playLanding.token) return; // left/re-entered meanwhile
        requestAnimationFrame(function () { story.classList.remove("is-blackout"); });
        if (landingTextEl) landingTextEl.classList.add("is-live");
        rollLanding();
      });
    }

    function rollLanding() {
      if (landingStatusEl) gsap.set(landingStatusEl, { autoAlpha: 1, y: 0 });
      var titleInner = document.querySelector(".story-text--landing .story-title-inner");
      var subtitle = document.querySelector(".story-text--landing .story-subtitle");
      if (titleInner) gsap.set(titleInner, { yPercent: 100, autoAlpha: 0, letterSpacing: "0.05em" });
      if (subtitle) gsap.set(subtitle, { autoAlpha: 0, y: 14 });

      var start = null;
      var last = landingSeq.count - 1;

      function tick(ts) {
        if (start === null) start = ts;
        var elapsed = ts - start;
        var done;
        if (landingFX) {
          done = landingFX.update(elapsed).done;
        } else {
          var progress = Math.min(1, elapsed / LANDING_DURATION_MS);
          landingSeq.setFrame(Math.round(progress * last));
          done = progress >= 1;
        }


        if (!done) {
          landingRAF = requestAnimationFrame(tick);
        } else {
          landingRAF = 0;
          if (landingFX) landingFX.runIdle();
          landingTextTimer = setTimeout(revealFinalCaption, LANDING_TEXT_DELAY_MS);
        }
      }
      landingRAF = requestAnimationFrame(tick);
    }

    // Clears the temporary descent narration and reveals the
    // persistent opening caption, status swaps to its resting copy,
    // title/subtitle play their staggered reveal for the first time.
    function revealFinalCaption() {
      var el = document.querySelector(".story-text--landing");
      if (!el) return;
      story.classList.remove("is-cinema"); // vignette eases back as the title lands
      el.classList.add("is-revealed");
      setLandingStatus("SOL 1 · SITE SECURED");
      var titleInner = el.querySelector(".story-title-inner");
      var subtitle = el.querySelector(".story-subtitle");
      if (reduceMotion) {
        if (titleInner) gsap.set(titleInner, { yPercent: 0, autoAlpha: 1, letterSpacing: "-0.02em" });
        if (subtitle) gsap.set(subtitle, { autoAlpha: 1, y: 0 });
        return;
      }
      var tl = gsap.timeline();
      if (titleInner) tl.to(titleInner, { yPercent: 0, autoAlpha: 1, letterSpacing: "-0.02em", duration: 0.6, ease: "power3.out" }, 0);
      if (subtitle) tl.to(subtitle, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power1.out" }, 0.2);
    }

    function stopLanding() {
      playLanding.token = (playLanding.token || 0) + 1;
      cancelAnimationFrame(landingRAF);
      landingRAF = 0;
      clearTimeout(landingTextTimer);
      story.classList.remove("is-cinema", "is-blackout");
      if (landingFX) landingFX.reset();
      resetHud();
    }

    // ----------------------------------------------------------
    // Staggered "mission text" reveal for the 8 story pages: status
    // line, then title (line-mask clip reveal), then subtitle. Pages
    // without a .story-status (the closing CTA scene) are left to the
    // plain container fade goToPage() already does, nothing to stagger.
    // ----------------------------------------------------------
    function textParts(el) {
      return {
        status: el.querySelector(".story-status"),
        titleInner: el.querySelector(".story-title-inner"),
        subtitle: el.querySelector(".story-subtitle"),
      };
    }

    function hideTextParts(parts) {
      if (parts.status) gsap.set(parts.status, { autoAlpha: 0, y: -6 });
      if (parts.titleInner) gsap.set(parts.titleInner, { yPercent: 100, autoAlpha: 0, letterSpacing: "0.05em" });
      if (parts.subtitle) gsap.set(parts.subtitle, { autoAlpha: 0, y: 14 });
    }

    function playTextReveal(el, delay) {
      var parts = textParts(el);
      if (!parts.status) return; // legacy/CTA page: nothing to stagger
      gsap.killTweensOf([parts.status, parts.titleInner, parts.subtitle].filter(Boolean));
      hideTextParts(parts);

      if (reduceMotion) {
        gsap.set(parts.status, { autoAlpha: 1, y: 0 });
        if (parts.titleInner) gsap.set(parts.titleInner, { yPercent: 0, autoAlpha: 1, letterSpacing: "-0.02em" });
        if (parts.subtitle) gsap.set(parts.subtitle, { autoAlpha: 1, y: 0 });
        return;
      }

      var tl = gsap.timeline({ delay: delay || 0 });
      tl.to(parts.status, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power1.out" }, 0);
      tl.call(function () {
        parts.status.classList.remove("is-scanned");
        void parts.status.offsetWidth; // restart the CSS scan-line keyframe
        parts.status.classList.add("is-scanned");
      }, null, 0);
      if (parts.titleInner) tl.to(parts.titleInner, { yPercent: 0, autoAlpha: 1, letterSpacing: "-0.02em", duration: 0.6, ease: "power3.out" }, 0.16);
      if (parts.subtitle) tl.to(parts.subtitle, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power1.out" }, 0.3);
    }

    /* ----------------------------------------------------------
       2. Per-scene animation hooks (reusable for future chapters)
       ---------------------------------------------------------- */
    // Pages whose text sits on a HUD card (about.css "Caption card") boot
    // the card in as the page arrives and power it down when it leaves,
    // so it re-boots on every visit. Pages with their own mission log
    // (.landing-hud) boot it the same way and count its [data-count]
    // readouts up from zero.
    var sceneAnimations = scenes.map(function (_, idx) {
      var el = texts[idx];
      var hasCard = !!(el && el.querySelector(".hud-card"));
      var hasHud = !!(el && el.querySelector(".landing-hud"));
      var counts = hasHud ? Array.prototype.slice.call(el.querySelectorAll("[data-count]")) : [];
      var timer = null;
      var showCount = function (node, k) {
        var dec = parseInt(node.dataset.dec || "0", 10);
        node.textContent = (parseFloat(node.dataset.count) * k).toFixed(dec) + (node.dataset.unit || "");
      };
      return {
        onEnter: function () {
          if (hasCard) el.classList.add("is-revealed");
          if (hasHud) {
            el.classList.add("is-live");
            clearInterval(timer);
            if (reduceMotion) counts.forEach(function (n) { showCount(n, 1); });
            else {
              var t0 = performance.now();
              timer = setInterval(function () {
                var k = Math.min(1, (performance.now() - t0) / 1200);
                var ez = 1 - Math.pow(1 - k, 3);
                counts.forEach(function (n) { showCount(n, ez); });
                if (k >= 1) clearInterval(timer);
              }, 40);
            }
          }
          playTextReveal(el, hasHud ? 0 : TEXT_REVEAL_DELAY); // HUD pages: caption lands with the log
        },
        onLeave: function () {
          if (hasCard) el.classList.remove("is-revealed");
          if (hasHud) { clearInterval(timer); el.classList.remove("is-live"); }
        },
      };
    });

    if (landingCanvas) {
      var landingLayers = [landingCanvas];
      if (landingBackCanvas) landingLayers.push(landingBackCanvas);
      if (landingFrontCanvas) landingLayers.push(landingFrontCanvas);
      sceneAnimations[0] = {
        // Deliberately does NOT call playTextReveal: the landing page's
        // title/subtitle stay hidden until touchdown + settle, driven
        // by playLanding()/revealFinalCaption() instead, see §25 of
        // the approved landing spec (temporary descent narration first,
        // persistent caption only once the ship has stopped moving).
        onEnter: function () {
          gsap.killTweensOf(landingLayers);
          gsap.set(landingLayers, { autoAlpha: 1 });
          playLanding();
        },
        onLeave: function (toIndex) {
          if (toIndex === 1 && landingFX) {
            // Into Section 2: same shot, no teardown, stop the landing's
            // clock, keep frame 033 + storm alive, and cut to the new angle.
            playLanding.token = (playLanding.token || 0) + 1;
            cancelAnimationFrame(landingRAF);
            landingRAF = 0;
            clearTimeout(landingTextTimer);
            story.classList.remove("is-cinema", "is-blackout");
            resetHud();
            landingFX.setStill(true);
            landingFX.runIdle();
            landingFX.setPose(summaryPose(), 700, true); // only the left-hand ship: it fades in there
            return;
          }
          stopLanding();
          if (landingFX) landingFX.reset();
          gsap.to(landingLayers, { autoAlpha: 0, duration: 0.3, overwrite: true });
        },
      };

      // Section 2: frame 033 on the left third, turned to face right,
      // with the Mission Control summary HUD on the right.
      var summaryText = texts[1];
      if (summaryText && landingFX) {
        var sum = {
          counts: Array.prototype.slice.call(summaryText.querySelectorAll("[data-count]")),
          countTimer: null,
        };

        var countUp = function () {
          clearInterval(sum.countTimer);
          var t0 = performance.now();
          sum.countTimer = setInterval(function () {
            var k = Math.min(1, (performance.now() - t0) / 1200);
            var ez = 1 - Math.pow(1 - k, 3);
            sum.counts.forEach(function (el) {
              var v = parseFloat(el.dataset.count) * ez, dec = parseInt(el.dataset.dec || "0", 10);
              el.textContent = v.toFixed(dec) + (el.dataset.unit || "");
            });
            if (k >= 1) clearInterval(sum.countTimer);
          }, 40);
        };

        sceneAnimations[1] = {
          onEnter: function (fromIndex) {
            gsap.killTweensOf(landingLayers);
            gsap.set(landingLayers, { autoAlpha: 1 });
            if (fromIndex !== 0) {
              // arriving from further down: show the landed ship directly
              landingFX.setStill(true);
              landingFX.runIdle();
              landingFX.setPose(summaryPose(), 0);
            }
            summaryText.classList.add("is-live", "is-revealed");
            playTextReveal(summaryText, 0.5);
            if (reduceMotion) sum.counts.forEach(function (el) {
              el.textContent = (+el.dataset.count).toFixed(parseInt(el.dataset.dec || "0", 10)) + (el.dataset.unit || "");
            });
            else countUp();
          },
          onLeave: function (toIndex) {
            clearInterval(sum.countTimer);
            summaryText.classList.remove("is-live", "is-revealed");
            if (toIndex !== 0) {
              gsap.to(landingLayers, {
                autoAlpha: 0, duration: 0.3, overwrite: true,
                onComplete: function () { if (landingFX) landingFX.reset(); },
              });
            }
          },
        };
      }
    }

    /* ----------------------------------------------------------
       2b. Ascent page ("Link established" -> "Habitat online"): the
       landing shot flown the other way (landing-fx.js playAscent()).
       Plays on scene 0 + the landing canvases like Section 2 does. Two
       live logs ride it, GLIMPSE-01's ascent log with a leader line to
       the ship (then to the orbiter it rejoins), and the WORX
       surface log with one to the habitat. When the links are up the
       caption lands like Section 1's, and two seconds later the story
       turns to the final page on its own.
       ---------------------------------------------------------- */
    var ascentText = document.querySelector(".story-text--ascent");
    var ASCENT_IDX = ascentText ? texts.indexOf(ascentText) : -1;
    var AUTO_ADVANCE_MS = 2000;

    if (ascentText && landingFX && typeof LandingFX !== "undefined" && LandingFX.ASCENT) {
      var AS = LandingFX.ASCENT;
      var ASCENT_NARRATION = [
        { at: 0, text: "Go for launch" },
        { at: AS.ignite, text: "Main engine start" },
        { at: AS.lift, text: "Liftoff" },
        { at: AS.pitch, text: "Pitch program" },
        { at: AS.insert, text: "Orbit insertion" },
        { at: AS.rendezvous, text: "Coast to GLIMPSE" },
        { at: AS.dock, text: "Rendezvous" },
        { at: AS.link, text: "Link established" },
      ];
      var q = function (sel) { return ascentText.querySelector(sel); };
      var ahud = {
        root: q(".ascent-hud"), log: q(".ascent-log"), worx: q(".worx-log"),
        stages: [], stage: -1, lastText: -1e9,
        clock: q('[data-asc="t"]'), alt: q('[data-asc="alt"]'), vel: q('[data-asc="vel"]'), dist: q('[data-asc="dist"]'),
        shipT: q('[data-target="ship"]'), habT: q('[data-target="hab"]'),
        shipLabel: q('[data-target="ship"] .hud-target-label'),
        shipLine: q('[data-leader="ship-line"]'), shipAccent: q('[data-leader="ship-accent"]'),
        habLine: q('[data-leader="hab-line"]'), habAccent: q('[data-leader="hab-accent"]'),
        worxRows: {}, caption: false, advanceTimer: null,
      };
      ascentText.querySelectorAll("[data-worx]").forEach(function (el) { ahud.worxRows[el.dataset.worx] = el; });
      (function () {
        var list = q(".hud-stages");
        if (!list) return;
        ASCENT_NARRATION.forEach(function (n) {
          var li = document.createElement("li");
          li.textContent = n.text;
          list.appendChild(li);
          ahud.stages.push(li);
        });
      })();

      var setWorx = function (key, text) {
        var el = ahud.worxRows[key];
        if (el && el.textContent !== text) el.textContent = text;
      };

      // The WORX log's statuses, as a function of ascent time.
      var updateWorx = function (a, tele) {
        setWorx("poll", a < AS.ignite ? "POLLING" : "ALL GO");
        setWorx("pad", a < AS.ignite ? "ARMED" : a < AS.pitch ? "HOT" : "CLEAR");
        var pw = a < AS.pitch ? 12 : Math.round(12 + 88 * Math.min(1, (a - AS.pitch) / (AS.link + 600 - AS.pitch)));
        setWorx("power", pw + "%");
        setWorx("dish", a < AS.insert ? "STOWED" : a < AS.rendezvous ? "SLEWING" : "TRACKING");
        setWorx("range", a >= AS.dock ? "RENDEZVOUS" : fmtDist(tele.dist));
        setWorx("uplink", a < AS.dock ? "STANDBY" : a < AS.link ? "ACQUIRING" : "LOCKED");
        if (a < AS.dock) setWorx("signal", "-");
        else if (a < AS.link) setWorx("signal", "-" + (96 + Math.round(Math.random() * 14)) + " DBM");
        else setWorx("signal", "-" + Math.round(64 + 22 * Math.max(0, 1 - (a - AS.link) / 900)) + " DBM");
        setWorx("habitat", a < AS.link + 600 ? "STANDBY" : "ONLINE");
        setWorx("status", a < AS.link + 600 ? "Worx Crew 2/2 · Ascent GO" : "Worx Crew 2/2 · Habitat ONLINE");
      };

      var leader = function (fromEl, fromRight, rowEl, tx, ty, line, accent) {
        if (!fromEl || !line || !accent) return;
        var base = story.getBoundingClientRect();
        var lr = fromEl.getBoundingClientRect();
        var r = (rowEl || fromEl).getBoundingClientRect();
        var ax = (fromRight ? lr.left : lr.right) - base.left, ay = r.top + r.height / 2 - base.top;
        var dir = tx >= ax ? 1 : -1;
        var kx = ax + dir * Math.min(60, Math.max(24, Math.abs(tx - ax) * 0.18));
        var ex = tx - 20 * dir, ey = ty;
        accent.setAttribute("points", ax.toFixed(1) + "," + ay.toFixed(1) + " " + kx.toFixed(1) + "," + ay.toFixed(1));
        line.setAttribute("points", kx.toFixed(1) + "," + ay.toFixed(1) + " " + ex.toFixed(1) + "," + ey.toFixed(1));
      };
      var clearLeader = function (line, accent) {
        if (line) line.setAttribute("points", "");
        if (accent) accent.setAttribute("points", "");
      };

      var revealAscentCaption = function () {
        if (ahud.caption) return;
        ahud.caption = true;
        story.classList.remove("is-cinema");
        ascentText.classList.add("is-revealed");
        playTextReveal(ascentText, 0);
        clearTimeout(ahud.advanceTimer);
        ahud.advanceTimer = setTimeout(function autoAdvance() {
          if (currentIndex !== ASCENT_IDX) return;
          if (isAnimating) { ahud.advanceTimer = setTimeout(autoAdvance, 150); return; }
          goToPage(ASCENT_IDX + 1, 1);
        }, AUTO_ADVANCE_MS + 700);
      };

      var updateAscentHud = function (info) {
        var a = info.elapsed;
        var stage = 0;
        for (var i = 0; i < ASCENT_NARRATION.length; i++) if (a >= ASCENT_NARRATION[i].at) stage = i;
        if (stage !== ahud.stage) {
          ahud.stage = stage;
          ahud.stages.forEach(function (li, j) {
            li.classList.toggle("is-done", j < stage);
            li.classList.toggle("is-active", j === stage);
          });
          if (ahud.shipLabel) ahud.shipLabel.textContent = a >= AS.dock ? "GLIMPSE · RENDEZVOUS" : a >= AS.lift ? "GLIMPSE-01 · ASCENT" : "GLIMPSE-01";
        }
        if (a - ahud.lastText > 66 || a < ahud.lastText) {
          ahud.lastText = a;
          var t = info.telemetry;
          if (ahud.alt) ahud.alt.textContent = fmtAlt(t.alt);
          if (ahud.vel) ahud.vel.textContent = fmtVel(t.vel);
          if (ahud.dist) ahud.dist.textContent = fmtDist(t.dist);
          if (ahud.clock) ahud.clock.textContent = fmtClock(a);
          updateWorx(a, t);
        }
        if (ahud.root) ahud.root.style.transform = (info.shake.x || info.shake.y)
          ? "translate(" + (info.shake.x * 0.35).toFixed(1) + "px," + (info.shake.y * 0.35).toFixed(1) + "px)" : "";
        // GLIMPSE target: the ship, then the orbiter it has rejoined
        var sp = info.shipVisible ? info.ship : info.orbiter;
        if (ahud.shipT) ahud.shipT.style.transform = "translate(" + sp.x.toFixed(1) + "px," + sp.y.toFixed(1) + "px)";
        leader(ahud.log, false, ahud.stages[ahud.stage], sp.x, sp.y, ahud.shipLine, ahud.shipAccent);
        // WORX target: the habitat, once it's out of the dust
        var habOn = info.habitat && info.habitatAlpha > 0.6;
        if (ahud.habT) {
          ahud.habT.style.opacity = habOn ? "1" : "0";
          if (info.habitat) ahud.habT.style.transform = "translate(" + info.habitat.x.toFixed(1) + "px," + info.habitat.y.toFixed(1) + "px)";
        }
        if (habOn) {
          var row = ahud.worxRows[a < AS.link ? "power" : "habitat"];
          leader(ahud.worx, true, row && row.parentNode, info.habitat.x, info.habitat.y, ahud.habLine, ahud.habAccent);
        } else clearLeader(ahud.habLine, ahud.habAccent);
        if (a >= AS.done) revealAscentCaption();
      };

      var resetAscentHud = function () {
        ahud.stage = -1;
        ahud.caption = false;
        ahud.lastText = -1e9;
        clearTimeout(ahud.advanceTimer);
        ahud.stages.forEach(function (li) { li.classList.remove("is-done", "is-active"); });
        clearLeader(ahud.shipLine, ahud.shipAccent);
        clearLeader(ahud.habLine, ahud.habAccent);
        if (ahud.habT) ahud.habT.style.opacity = "0";
        ascentText.classList.remove("is-live", "is-revealed");
        hideTextParts(textParts(ascentText));
      };

      sceneAnimations[ASCENT_IDX] = {
        onEnter: function () {
          gsap.killTweensOf(landingLayers);
          gsap.set(landingLayers, { autoAlpha: 1 });
          resetAscentHud();
          story.classList.add("is-cinema");
          ascentText.classList.add("is-live");
          landingFX.playAscent(updateAscentHud);
        },
        onLeave: function () {
          resetAscentHud();
          story.classList.remove("is-cinema");
          gsap.to(landingLayers, {
            autoAlpha: 0, duration: 0.3, overwrite: true,
            onComplete: function () { if (landingFX && currentIndex !== ASCENT_IDX && currentIndex > 1) landingFX.reset(); },
          });
        },
      };

      // Warm the ascent art up a page early, so it's decoded on arrival.
      if (ASCENT_IDX > 0 && sceneAnimations[ASCENT_IDX - 1]) {
        var prevEnter = sceneAnimations[ASCENT_IDX - 1].onEnter;
        sceneAnimations[ASCENT_IDX - 1].onEnter = function (fromIndex) {
          LandingFX.preloadAscent();
          prevEnter(fromIndex);
        };
      }
    }

    /* ----------------------------------------------------------
       3. Page-turn navigation (fixed-duration tween, not scrubbed)
       ---------------------------------------------------------- */

    // Resting state: only scene 0 / text 0 visible. autoAlpha also sets
    // visibility, so inactive chapters can't be tabbed into.
    gsap.set(scenes, { autoAlpha: 0, force3D: true });
    gsap.set(scenes[0], { autoAlpha: 1 });
    gsap.set(texts, { autoAlpha: 0, y: 22 });
    gsap.set(texts[0], { autoAlpha: 1, y: 0 });
    scenes[0].classList.add("is-active");
    texts[0].classList.add("is-active");
    story.classList.add("has-sky");

    // Mission-text inner elements (status/title/subtitle) start hidden
    // regardless of their .story-text container's own autoAlpha, so the
    // very first paint never flashes fully-revealed text before
    // playTextReveal() runs it. Pages without the mission-text pattern
    // (the closing CTA scene) have no .story-status and are skipped.
    texts.forEach(function (t) {
      var parts = textParts(t);
      if (parts.status) hideTextParts(parts);
    });

    var currentIndex = 0;
    var isAnimating = false;

    // Tuned down on narrow viewports so it doesn't look broken on a
    // phone-width stage. Reduced motion drops rotate/scale/shadow
    // entirely and just crossfades.
    var outRotate = reduceMotion ? 0 : isCompact ? -5 : -11;
    var inRotate = reduceMotion ? 0 : isCompact ? 2 : 5;
    var outScale = reduceMotion ? 1 : isCompact ? 0.97 : 0.94;
    var inScaleFrom = reduceMotion ? 1 : isCompact ? 1.025 : 1.05;
    var SCENE_DUR = reduceMotion ? 0.35 : 0.75; // spec target: 0.6–0.9s
    var COOLDOWN_MS = 70; // swallows trailing momentum ticks from one gesture

    // Section 2 and the ascent page both play on the landing shot.
    function visibleScene(idx) { return idx === 1 || idx === ASCENT_IDX ? scenes[0] : scenes[idx]; }

    function goToPage(targetIndex, direction) {
      if (isAnimating || targetIndex === currentIndex) return;
      if (targetIndex < 0 || targetIndex > sceneCount - 1) return;

      isAnimating = true;
      var fromIndex = currentIndex;
      var toIndex = targetIndex;
      currentIndex = toIndex;

      scenes.forEach(function (s, idx) { s.classList.toggle("is-active", idx === toIndex); });
      texts.forEach(function (t, idx) { t.classList.toggle("is-active", idx === toIndex); });

      if (sceneAnimations[fromIndex]) sceneAnimations[fromIndex].onLeave(toIndex);
      if (sceneAnimations[toIndex]) sceneAnimations[toIndex].onEnter(fromIndex);

      // Section 2 (index 1) continues Section 1's shot on the same terrain
      // (scene 0 stays up): between them only the text changes, no page
      // turn on the picture, so it plays as one continuous film.
      story.classList.toggle("has-sky", toIndex <= 1 || toIndex === ASCENT_IDX);
      var outScene = visibleScene(fromIndex);
      var inScene = visibleScene(toIndex);
      var sameShot = outScene === inScene;
      var outText = texts[fromIndex];
      var inText = texts[toIndex];
      var fwd = direction === 1;

      // Forward: the leaving page peels down/away, the new page rises up
      // into place. Backward: mirrored, so it reads as turning back to a
      // previous page rather than replaying the forward turn in reverse.
      var outTo = fwd
        ? { rotateX: outRotate, scale: outScale, transformOrigin: "50% 100%" }
        : { rotateX: -inRotate, scale: inScaleFrom, transformOrigin: "50% 0%" };
      var inFrom = fwd
        ? { rotateX: inRotate, scale: inScaleFrom, transformOrigin: "50% 0%" }
        : { rotateX: -outRotate, scale: outScale, transformOrigin: "50% 100%" };

      // Wall-clock timeout, not GSAP's onComplete: onComplete depends on
      // the rAF-driven ticker, which browsers fully suspend on a
      // backgrounded/hidden tab. If the visitor alt-tabs away mid-turn,
      // an onComplete-based unlock would never fire and permanently
      // lock page navigation; setTimeout still fires (throttled, but
      // never stalled) regardless of tab visibility.
      setTimeout(function () { isAnimating = false; }, SCENE_DUR * 1000 + COOLDOWN_MS);

      var tl = gsap.timeline({ defaults: { ease: "power1.inOut" } });

      if (!sameShot) tl.to(outScene, {
        autoAlpha: 0,
        rotateX: outTo.rotateX,
        scale: outTo.scale,
        transformOrigin: outTo.transformOrigin,
        duration: SCENE_DUR,
      }, 0);

      if (!sameShot) tl.fromTo(inScene,
        { autoAlpha: 0, rotateX: inFrom.rotateX, scale: inFrom.scale, transformOrigin: inFrom.transformOrigin },
        { autoAlpha: 1, rotateX: 0, scale: 1, duration: SCENE_DUR },
        0);

      if (shadow && !reduceMotion && !sameShot) {
        tl.fromTo(shadow, { autoAlpha: 0 }, { autoAlpha: 0.28, duration: SCENE_DUR * 0.4, ease: "power1.in" }, 0)
          .to(shadow, { autoAlpha: 0, duration: SCENE_DUR * 0.4, ease: "power1.out" }, SCENE_DUR * 0.5);
      }

      tl.to(outText, { autoAlpha: 0, y: fwd ? -16 : 16, duration: SCENE_DUR * 0.55 }, 0);
      tl.fromTo(inText,
        { autoAlpha: 0, y: fwd ? 22 : -22 },
        { autoAlpha: 1, y: 0, duration: SCENE_DUR * 0.55 },
        SCENE_DUR * 0.35);
    }

    // Kick off the landing scene's own animation immediately on load,
    // no scroll required to see the story "come alive".
    if (sceneAnimations[0]) sceneAnimations[0].onEnter();

    /* ----------------------------------------------------------
       4. Wheel / touch capture → page navigation
       ---------------------------------------------------------- */
    var WHEEL_MIN_DELTA = 2; // ignores trackpad idle jitter

    // Story only ever occupies the top viewport of the page (it's the
    // first thing in #main, and the header floats over it), so scrollY
    // is 0 exactly when the story is what's on screen. Forward input on
    // the last page, and backward input once the footer has scrolled
    // into view, is left alone so native scrolling takes over.
    function shouldIntercept(deltaY) {
      if (window.scrollY > 0) return false;
      if (deltaY > 0 && currentIndex === sceneCount - 1) return false;
      return true;
    }

    function attemptNavigate(deltaY) {
      if (isAnimating) return;
      goToPage(currentIndex + (deltaY > 0 ? 1 : -1), deltaY > 0 ? 1 : -1);
    }

    window.addEventListener("wheel", function (e) {
      if (!shouldIntercept(e.deltaY)) return;
      // Always swallow the event while we're capturing, even a
      // sub-threshold tick, a trackpad fires dozens of tiny-delta wheel
      // events per gesture, and leaving any of them unprevented lets the
      // browser scroll the document by a pixel or two. The "scroll"
      // safety net below then mistakes that leak for input that bypassed
      // capture and fires an extra, unwanted page turn, the trackpad
      // feels like it's double/triple-navigating on a single swipe.
      e.preventDefault();
      if (Math.abs(e.deltaY) < WHEEL_MIN_DELTA) return;
      attemptNavigate(e.deltaY);
    }, { passive: false });

    var touchStartY = 0;
    var touchTracking = false;
    var TOUCH_THRESHOLD = 40;

    window.addEventListener("touchstart", function (e) {
      touchStartY = e.touches[0].clientY;
      touchTracking = true;
    }, { passive: true });

    window.addEventListener("touchmove", function (e) {
      if (!touchTracking) return;
      var dy = touchStartY - e.touches[0].clientY;
      if (!shouldIntercept(dy)) { touchTracking = false; return; }
      e.preventDefault();
      if (Math.abs(dy) > TOUCH_THRESHOLD) {
        attemptNavigate(dy);
        touchTracking = false; // one nav per swipe; next touchstart resets
      }
    }, { passive: false });

    window.addEventListener("touchend", function () {
      touchTracking = false;
    }, { passive: true });

    // Keyboard: PageDown/Space/ArrowDown and PageUp/ArrowUp turn a page
    // the same way a wheel/swipe gesture does. Without this, a keyboard
    // (or scrollbar-thumb drag, see the "scroll" listener below) bypasses
    // the wheel/touch capture entirely, the browser just scrolls the
    // document past the pinned #story straight to the footer, so every
    // chapter after the first is silently skipped.
    var NAV_KEYS = { ArrowDown: 1, PageDown: 1, " ": 1, Spacebar: 1, ArrowUp: -1, PageUp: -1 };
    var FOCUSABLE = /^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/;

    window.addEventListener("keydown", function (e) {
      var dir = NAV_KEYS[e.key];
      if (!dir) return;
      if (document.activeElement && FOCUSABLE.test(document.activeElement.tagName)) return;
      if (!shouldIntercept(dir)) return;
      e.preventDefault();
      attemptNavigate(dir);
    });

    // Safety net: anything that moves scrollY without going through the
    // wheel/touch/keyboard capture above (scrollbar-thumb drag, Home/End,
    // browser scroll restoration, assistive input) would otherwise carry
    // the visitor past the pinned story and straight into the footer.
    // Snap back to the top and replay it as a single page turn instead.
    // behavior: "instant" matters here, base.css sets smooth scrolling
    // globally, and a smooth scrollTo(0,0) racing an in-flight smooth
    // scroll (e.g. a dragged scrollbar thumb) settles somewhere between
    // the two instead of cleanly back at the top.
    window.addEventListener("scroll", function () {
      if (window.scrollY === 0 || currentIndex >= sceneCount - 1) return;
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      attemptNavigate(1);
    });

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (landingSeq) landingSeq.resize();
        syncCameraOrigin();
        if (landingFX) landingFX.resize();
      }, 200);
    });
  } else {
    story.classList.add("story--fallback");
    document.querySelectorAll(".story-scene, .story-text").forEach(function (el) {
      el.classList.add("is-active");
    });
  }

  /* ----------------------------------------------------------
     Star layer (adapted from portfolio.js initHero())
     ---------------------------------------------------------- */
  var canvas = document.querySelector(".story-stars");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var dots = [];
  // Section 1's Martian night sky (sky-fx.js: the deep star field, Earth ·
  // Moon, Saturn, the odd meteor) on every other page too, so the whole
  // story shares one sky. The sky pages draw it on landing-fx.js's canvas;
  // here it's drawn with a still camera, its horizon set just above the
  // plain's hill line so it never paints over the terrain.
  var nightSky = typeof MartianSky !== "undefined" ? new MartianSky({ reduceMotion: reduceMotion }) : null;
  var skyFx = { dpr: dpr, _cam: null, cameraOriginY: 0.62, horizonY: 0.37 };
  function skyHorizon() {
    var t = story.querySelector(".story-scene:not(.story-scene--landing) .story-terrain");
    var sr = story.getBoundingClientRect();
    if (!t || !sr.height) return 0.37;
    // the terrain's mask fades its top 22%: the ridge reads from ~10% down
    var top = sr.height - t.offsetHeight;
    return Math.min(0.9, Math.max(0.2, (top + t.offsetHeight * 0.1) / sr.height));
  }
  var raf = 0;
  var running = false;

  function resize() {
    canvas.width = Math.max(1, window.innerWidth * dpr);
    canvas.height = Math.max(1, window.innerHeight * dpr);
    skyFx.horizonY = skyHorizon();
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
    var ownSky = !story.classList.contains("has-sky");
    if (ownSky && nightSky) nightSky.draw(ctx, skyFx);
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      ctx.globalAlpha = Math.max(0.06, Math.min(0.9, d.a));
      ctx.fillStyle = d.warm ? "#faa719" : "#feeecf";
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // A small, distant storm cell low on the horizon, procedural, not
    // video, so its colour always matches the planet. The sky pages
    // (chapters 0-1, #story.has-sky) draw it and the orbiter on
    // landing-fx.js's canvas instead, so only the stars go on here.
    if (!ownSky) return;
    if (typeof AmbientStorm !== "undefined") AmbientStorm.draw(ctx, canvas.width, canvas.height, { alpha: 0.85 });
    // The GLIMPSE mothership drifting past, same shared, wall-clock-driven
    // sprite landing-fx.js draws during the landing/summary chapters, so it
    // reads as one continuous pass overhead no matter which chapter you're on.
    if (typeof GlimpseOrbiter !== "undefined") GlimpseOrbiter.draw(ctx, canvas.width, canvas.height, { dpr: dpr });
    if (nightSky) nightSky.drawLabels(ctx, skyFx);
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
