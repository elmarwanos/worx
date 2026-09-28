/* ============================================================
   Worx | about-story.js
   About page only: the Mars mission that tells the GLIMPSE →
   WORX BY GLIMPSE → WORX story, one chapter (SOL) per page.

     idx  SOL  shot                                  identity
      0   01   the landing (landing-fx.js)           GLIMPSE
      1   02   same shot, hatch open, crew out       WORX BY GLIMPSE
      2   03   the rover traverse                    WORX
      3   04   the build site                        WORX
      4   05   the crew's salute                     WORX
      5   06   the ascent, habitat online            WORX
      6   -    WORX + "Start your project"           (closing page)

   1. Scenes. Each .story-scene has an animation hook table,
      sceneAnimations[idx] = { onEnter(fromIndex, dir), onLeave(toIndex,
      dir) }. Pages 1 and 5 play on scene 0's terrain + the three landing
      canvases (visibleScene()), so between 0↔1 only the text changes:
      one continuous shot. Every hook knows where it came from, so going
      BACK to a page lands on its settled state instead of replaying its
      entrance (no second landing when you step back to SOL 01, no second
      launch when you step back to SOL 06). SOL 06 turns to the closing
      page on its own once its story is told (forward visits only).

   2. Chapters (runChapter()). Every SOL page tells its part of the
      story on one mission panel (.hud-story), everything at the panel's
      angle: the log (header, rows resolving one by one, footer) and,
      below it on the same panel, the chapter's story (.hud-caption:
      status, title, subtitle, supporting line). One GSAP timeline per
      chapter runs it:
        panel boots → rows resolve → story opens on the panel.
      On laptops and desktops the rows stay open above the story. On
      tablets and phones the rows fold away as the story opens (the panel
      never grows over the scene), and tapping the panel's header swaps
      them back in (the story folds while they're open), tap again to
      swap back. It all runs by itself: one gesture is always one
      chapter.

   3. Navigation, one authoritative state:
        currentIndex   the page on screen (the target, once a turn starts)
        isAnimating    a page turn is in flight (input lock)
        navMode        "story"     the story owns input (scrollY 0,
                                   html.story-locked: touch-action and
                                   overscroll locked, see about.css)
                       "leaving"   programmatic scroll into the page below
                       "page"      normal page scrolling (footer)
                       "returning" programmatic scroll back up into the story
      goToPage() locks, runs the turn, and unlocks from the timeline's
      onComplete, with a wall-clock failsafe (hidden tabs stall the GSAP
      ticker) and a token so a stale unlock can never release a newer
      turn. Input is read as GESTURES, not events:
        wheel  events are grouped into a gesture (a gap > WHEEL_GAP_MS
               ends it); a gesture fires at most one step, once its
               accumulated delta passes WHEEL_THRESHOLD; the rest of it
               (trackpad momentum) is swallowed, even after the turn ends.
               A fresh swipe during the momentum tail is recognised by its
               sudden delta jump.
        touch  a vertical swipe past a distance threshold (or a quick
               flick) fires one step; small moves, taps and horizontal
               moves are ignored; the finger then owns nothing until it
               lifts. While the story owns input the page can't pan at
               all (touch-action on #story + preventDefault elsewhere), so
               the browser never scrolls under a turn.
        keys   arrows / PageUp / PageDown / Space, one step per press.
      Boundaries: back on SOL 01 does nothing but a small nudge. Forward
      on the closing page hands over to the page (leaveStory(): a controlled scroll
      to the footer). From there, scrolling up into the story (wheel,
      key, or a touch scroll that settles part-way) returns cleanly to
      the closing page (returnToStory()).

   4. Star layer, the persistent canvas sky for the pages that don't play
      on the landing canvases (sky-fx.js night sky, stars, storm cell,
      the GLIMPSE orbiter and HOPE).

   Reduced motion keeps navigation but turns scenes over with a plain
   crossfade; the chapter timing is kept (it is timing, not motion) and
   CSS drops the boot/scan/row animations. If GSAP fails to load, #story
   falls back to a plain stacked scroll (about.css .story--fallback).
   ============================================================ */

(function () {
  "use strict";

  var story = document.getElementById("story");
  if (!story) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Same shapes as about.css's stacked HUD layouts.
  var stackedMQ = window.matchMedia(
    "(max-width: 900px) and (max-aspect-ratio: 5/4), (max-aspect-ratio: 4/5), (orientation: landscape) and (max-height: 540px)"
  );
  function isStacked() { return stackedMQ.matches; }
  // Tablets and phones: stacked shapes, plus touch-first screens of any
  // shape (a landscape tablet keeps the side-by-side layout, but its log
  // still collapses to the tappable chip). Laptops/desktops never do.
  var touchMQ = window.matchMedia("(hover: none) and (pointer: coarse)");
  function canCollapse() { return stackedMQ.matches || touchMQ.matches; }

  var hasGsap = typeof gsap !== "undefined";
  var html = document.documentElement;

  // Shared with the star layer below: text panels the sky labels dim under.
  var occluders = [];
  var skyFx = null;

  if (hasGsap) {
    var scenes = gsap.utils.toArray(".story-scene");
    var texts = gsap.utils.toArray(".story-text");
    var shadow = document.querySelector(".story-turn-shadow");
    var sceneCount = scenes.length;
    var LAST = sceneCount - 1;

    var currentIndex = 0;
    var isAnimating = false;
    var navMode = "story";

    var ASCENT_IDX = scenes.indexOf(document.querySelector(".story-scene--ascent"));

    /* ----------------------------------------------------------
       Chapter engine (HUD story loop → dock → card)
       ---------------------------------------------------------- */
    var ROW_START = 0.3;   // s after the HUD boots: first row
    var ROW_STEP = 0.13;   // s between rows
    var ROW_SET = 0.28;    // s a row scans before its value resolves
    var HOLD = 1.1;        // s the full log holds before it docks (stacked)

    function makeChapter(el) {
      var c = {
        el: el,
        hud: el.querySelector(".hud-story"),
        card: el.querySelector(".hud-caption"),
        rows: [],
        tl: null,
      };
      if (c.hud) c.hud.querySelectorAll(".hud-summary-rows li").forEach(function (li) { c.rows.push(li); });
      return c;
    }
    var chapters = texts.map(makeChapter);

    function textParts(el) {
      return {
        status: el.querySelector(".story-status"),
        titleInner: el.querySelector(".story-title-inner"),
        subtitle: el.querySelector(".story-subtitle"),
        support: el.querySelector(".story-support"),
        extra: [],
      };
    }

    function hideTextParts(parts) {
      if (parts.status) gsap.set(parts.status, { autoAlpha: 0, y: -6 });
      if (parts.titleInner) gsap.set(parts.titleInner, { yPercent: 100, autoAlpha: 0, letterSpacing: "0.05em" });
      if (parts.subtitle) gsap.set(parts.subtitle, { autoAlpha: 0, y: 14 });
      if (parts.support) gsap.set(parts.support, { autoAlpha: 0, y: 12 });
      if (parts.extra.length) gsap.set(parts.extra, { autoAlpha: 0, y: 12 });
    }

    // at: when each part lands, in s from the start (a chapter can time
    // its copy to its HUD, see SOL 01).
    var TEXT_AT = { status: 0, title: 0.16, subtitle: 0.34, support: 0.5 };
    function playTextReveal(el, delay, at) {
      at = at || TEXT_AT;
      var parts = textParts(el);
      if (!parts.status) return;
      var all = [parts.status, parts.titleInner, parts.subtitle, parts.support].concat(parts.extra).filter(Boolean);
      gsap.killTweensOf(all);
      if (reduceMotion) {
        gsap.set(all, { autoAlpha: 1, y: 0 });
        if (parts.titleInner) gsap.set(parts.titleInner, { yPercent: 0, letterSpacing: "-0.02em" });
        return;
      }
      hideTextParts(parts);
      var tl = gsap.timeline({ delay: delay || 0 });
      tl.to(parts.status, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power1.out" }, at.status);
      tl.call(function () {
        parts.status.classList.remove("is-scanned");
        void parts.status.offsetWidth; // restart the CSS scan-line keyframe
        parts.status.classList.add("is-scanned");
      }, null, at.status);
      if (parts.titleInner) tl.to(parts.titleInner, { yPercent: 0, autoAlpha: 1, letterSpacing: "-0.02em", duration: 0.65, ease: "power3.out" }, at.title);
      if (parts.subtitle) tl.to(parts.subtitle, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power1.out" }, at.subtitle);
      if (parts.support) tl.to(parts.support, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power1.out" }, at.support);
    }

    function resetChapter(c) {
      if (c.tl) { c.tl.kill(); c.tl = null; }
      c.el.classList.remove("is-live", "is-revealed", "is-docked", "is-origin", "is-complete", "is-hud-open");
      syncChip(c);
      c.rows.forEach(function (li) { li.classList.remove("is-in", "is-set"); });
      hideTextParts(textParts(c.el));
    }

    // The docked chip is a toggle on stacked layouts: tap to open the full
    // log (the card steps aside while it's open), tap again to close.
    function syncChip(c) {
      if (!c.hud) return;
      var chip = c.el.classList.contains("is-docked") && canCollapse();
      if (chip) {
        c.hud.setAttribute("role", "button");
        c.hud.setAttribute("tabindex", "0");
        c.hud.setAttribute("aria-expanded", c.el.classList.contains("is-hud-open") ? "true" : "false");
      } else {
        c.hud.removeAttribute("tabindex");
        c.hud.removeAttribute("aria-expanded");
        c.hud.setAttribute("role", "group");
      }
    }
    function toggleChip(c) {
      if (!c.el.classList.contains("is-docked") || !canCollapse()) return;
      c.el.classList.toggle("is-hud-open");
      syncChip(c);
      scheduleOccluders();
    }
    chapters.forEach(function (c) {
      if (!c.hud) return;
      c.hud.addEventListener("click", function () { toggleChip(c); });
      c.hud.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (!c.el.classList.contains("is-docked")) return;
        e.preventDefault();
        e.stopPropagation();
        toggleChip(c);
      });
    });

    // Fold the rows away (tablets/phones): the panel keeps its header and
    // footer, and the chapter's story opens in their place.
    function dockChapter(c) {
      var el = c.el;
      el.classList.add("is-docked");
      el.classList.remove("is-hud-open");
      syncChip(c);
      scheduleOccluders();
    }

    function revealCard(c, at) {
      c.el.classList.add("is-revealed");
      playTextReveal(c.el, 0, at);
      scheduleOccluders();
    }

    // o: { hudAt, rows (false: rows are driven elsewhere), cardAt and
    //      textAt (side-by-side layouts), hold, dock (force),
    //      step / set (row pacing), keyBeat (extra scan on the
    //      li[data-key] row the chapter builds up to) }
    function runChapter(c, o) {
      o = o || {};
      if (c.tl) c.tl.kill();
      var tl = c.tl = gsap.timeline();
      var t0 = o.hudAt || 0;
      var dock = !!c.hud && (o.dock || canCollapse());
      if (c.hud) tl.call(function () { c.el.classList.add("is-live"); scheduleOccluders(); }, null, t0);
      var t = t0 + ROW_START;
      if (c.hud && o.rows !== false) {
        var step = o.step || ROW_STEP, set = o.set || ROW_SET, beat = o.keyBeat || 0;
        var at = t, lastSet = t;
        c.rows.forEach(function (li) {
          var key = li.hasAttribute("data-key");
          if (key) at += beat * 0.4;                 // a breath before it
          var tIn = at, tSet = at + set + (key ? beat : 0);
          tl.call(function () { li.classList.add("is-in"); }, null, tIn);
          tl.call(function () { li.classList.add("is-set"); }, null, tSet);
          lastSet = tSet;
          at = key ? tSet + beat * 0.5 : at + step;  // and a beat after it lands
        });
        t = lastSet;
      }
      if (c.hud) tl.call(function () { c.el.classList.add("is-complete"); }, null, t + 0.25);
      var cardAt;
      if (dock) {
        var dockAt = t + (o.hold != null ? o.hold : HOLD);
        tl.call(function () { dockChapter(c); }, null, dockAt);
        cardAt = dockAt + 0.15;
      } else {
        cardAt = t0 + (o.cardAt != null ? o.cardAt : 0.55);
      }
      if (c.card) tl.call(function () { revealCard(c, dock ? null : o.textAt); }, null, cardAt);
      return tl;
    }

    // The layout changed mid-chapter (rotation, resize): stacked docks any
    // log still open over a revealed card; laptop/desktop opens it again.
    function redockActive() {
      var c = chapters[currentIndex];
      if (!c || !c.hud) return;
      if (canCollapse()) {
        if (c.el.classList.contains("is-revealed") && !c.el.classList.contains("is-docked")) dockChapter(c);
      } else {
        c.el.classList.remove("is-docked", "is-hud-open");
        syncChip(c);
      }
    }

    /* ----------------------------------------------------------
       Sky-label occluders: the active page's visible text panels
       ---------------------------------------------------------- */
    var occTimers = [];
    function refreshOccluders() {
      var el = texts[currentIndex];
      var sr = story.getBoundingClientRect();
      var list = [];
      if (el && navMode !== "page") {
        el.querySelectorAll(".hud-panel, .story-title--worx, .story-cta, .story-ignite").forEach(function (p) {
          var cs = getComputedStyle(p);
          if (cs.display === "none" || cs.visibility === "hidden") return;
          var host = p.closest(".landing-hud");
          var shown = host ? el.classList.contains("is-live") : el.classList.contains("is-revealed") || !p.classList.contains("hud-panel");
          if (!shown) return;
          var r = p.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return;
          list.push({ l: r.left - sr.left - 8, t: r.top - sr.top - 6, r: r.right - sr.left + 8, b: r.bottom - sr.top + 6 });
        });
      }
      occluders.length = 0;
      Array.prototype.push.apply(occluders, list);
    }
    function scheduleOccluders() {
      occTimers.forEach(clearTimeout);
      occTimers = [60, 700, 1500].map(function (ms) { return setTimeout(refreshOccluders, ms); });
    }

    /* ----------------------------------------------------------
       1. Landing frame sequence (SOL 01)
       ---------------------------------------------------------- */
    var landingCanvas = document.querySelector(".story-landing");
    var landingBackCanvas = document.querySelector(".story-landing-back");
    var landingFrontCanvas = document.querySelector(".story-landing-front");
    var landingSeq = null;
    var landingFX = null;
    var LANDING_DURATION_MS = 4000; // fallback clock when LandingFX is unavailable
    var ORIGIN_DELAY_MS = 1200;     // after the dust burst: the log turns into the origin log as the legs come through the dust
    var FRAMES_TIMEOUT_MS = 8000;   // never hold the opening on black longer than this
    var landingRAF = 0;
    var landingTextTimer = null;
    var landingReady = null;

    if (landingCanvas && typeof LandingSequence !== "undefined") {
      landingSeq = new LandingSequence(landingCanvas, {
        basePath: landingCanvas.dataset.landingBase || "../static/assets/about/glimpse_landing_frames_001-032/glimpse-landing-",
        count: parseInt(landingCanvas.dataset.landingCount, 10) || 32,
        pad: parseInt(landingCanvas.dataset.landingPad, 10) || 3,
        frameWidth: parseInt(landingCanvas.dataset.landingWidth, 10) || 2560,
        frameHeight: parseInt(landingCanvas.dataset.landingHeight, 10) || 1440,
      });
      landingSeq.resize();
      var framesLoaded = landingSeq.preload();
      framesLoaded.then(function (info) {
        console.info(
          "[about] landing sequence: " + info.loadedCount + "/" + info.total +
          " frame(s) found at " + (landingCanvas.dataset.landingBase || "(default path)") +
          (info.loadedCount < info.total ? ", drop the remaining PNGs in to complete it." : "")
        );
        if (!landingFX) landingSeq.refreshPending();
      });
      // Slow or failing frames never trap the opening on black.
      landingReady = Promise.race([framesLoaded, new Promise(function (r) { setTimeout(r, FRAMES_TIMEOUT_MS); })]);
    }

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
          if (currentIndex === 0) updateHud(info);
        },
        reduceMotion: reduceMotion,
      });
      landingFX.occluders = occluders;
      landingFX.resize();
      if (typeof MartianSky !== "undefined") landingFX.sky = new MartianSky({ reduceMotion: reduceMotion });
    }

    // SOL 02's camera angle on the landed ship: left third, turned to
    // face right. Narrow/portrait screens shift less.
    function summaryPose() {
      var wide = story.clientWidth / Math.max(1, story.clientHeight) > 1.1;
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

    var landingTextEl = texts[0];
    var landingChapter = chapters[0];
    var hud = {
      stages: [],
      stage: -1,
      lastText: 0,
      root: landingTextEl.querySelector(".landing-hud"),
      log: landingTextEl.querySelector(".hud-log"),
      head: landingTextEl.querySelector(".hud-head"),
      target: landingTextEl.querySelector(".hud-target"),
      label: landingTextEl.querySelector(".hud-target-label"),
      line: landingTextEl.querySelector(".hud-leader-line"),
      accent: landingTextEl.querySelector(".hud-leader-accent"),
      alt: landingTextEl.querySelector('[data-hud="alt"]'),
      vel: landingTextEl.querySelector('[data-hud="vel"]'),
      dist: landingTextEl.querySelector('[data-hud="dist"]'),
      clock: landingTextEl.querySelector('[data-hud="t"]'),
    };
    (function buildStages() {
      var list = landingTextEl.querySelector(".hud-stages");
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
      if (hud.label) hud.label.textContent = "GLIMPSE";
      if (hud.clock) hud.clock.textContent = "T+00:00.0";
      resetChapter(landingChapter);
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
      var origin = landingTextEl.classList.contains("is-origin");
      if (!origin) {
        var stage = 0;
        for (var i = 0; i < DESCENT_NARRATION.length; i++) if (e >= DESCENT_NARRATION[i].at) stage = i;
        if (stage !== hud.stage) {
          hud.stage = stage;
          hud.stages.forEach(function (li, j) {
            li.classList.toggle("is-done", j < stage);
            li.classList.toggle("is-active", j === stage);
          });
          if (hud.label && e >= MARKS.touchdown) hud.label.textContent = "GLIMPSE · LANDED";
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
      }
      // The HUD rides the touchdown shake a little: it's part of the shot.
      if (hud.root) hud.root.style.transform = (info.shake.x || info.shake.y)
        ? "translate(" + (info.shake.x * 0.35).toFixed(1) + "px," + (info.shake.y * 0.35).toFixed(1) + "px)" : "";
      // Target marker + leader line from the active stage (then the log's
      // header, once it is the origin log) to the ship.
      var tx = info.ship.x, ty = info.ship.y;
      if (hud.target) hud.target.style.transform = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px)";
      var li = origin ? hud.head : hud.stages[hud.stage];
      if (li && hud.line && hud.accent && hud.log && !isStacked()) {
        var base = story.getBoundingClientRect();
        var lr = hud.log.getBoundingClientRect();
        var r = li.getBoundingClientRect();
        var ax = lr.right - base.left, ay = r.top + r.height / 2 - base.top;
        var kx = ax + Math.min(60, Math.max(24, (tx - ax) * 0.18));
        var ex = tx - 20 * (tx >= kx ? 1 : -1), ey = ty;
        hud.accent.setAttribute("points", ax.toFixed(1) + "," + ay.toFixed(1) + " " + kx.toFixed(1) + "," + ay.toFixed(1));
        hud.line.setAttribute("points", kx.toFixed(1) + "," + ay.toFixed(1) + " " + ex.toFixed(1) + "," + ey.toFixed(1));
      }
    }

    // Time-based, not scroll-based: plays 0→last once and stops. Always
    // cancels any previous run first, so returning to the scene mid-flight
    // never stacks up duplicate loops.
    function playLanding() {
      if (!landingSeq) { revealOrigin(); return; }
      cancelAnimationFrame(landingRAF);
      clearTimeout(landingTextTimer);
      if (landingFX) landingFX.reset();
      resetHud();
      // Hold on black until the frames are decoded (or the timeout),
      // so the ship can never arrive missing; then fade up and roll.
      story.classList.add("is-cinema", "is-blackout");
      var token = (playLanding.token = (playLanding.token || 0) + 1);
      (landingReady || Promise.resolve()).then(function () {
        if (token !== playLanding.token) return; // left/re-entered meanwhile
        requestAnimationFrame(function () { story.classList.remove("is-blackout"); });
        landingTextEl.classList.add("is-live");
        rollLanding();
      });
    }

    function rollLanding() {
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
          landingTextTimer = setTimeout(revealOrigin, ORIGIN_DELAY_MS);
        }
      }
      landingRAF = requestAnimationFrame(tick);
    }

    // SOL 01's one reveal: the descent log becomes the GLIMPSE origin log
    // and runs its rows while "SITE SECURED" / the title / the subtitle
    // boot in on the card, as one sequence.
    function revealOrigin() {
      if (currentIndex !== 0) return;
      story.classList.remove("is-cinema", "is-blackout"); // vignette eases back as the title lands
      landingTextEl.classList.add("is-origin");
      if (hud.clock) hud.clock.textContent = "SOL 01";
      if (hud.label) hud.label.textContent = "GLIMPSE · LANDED";
      runChapter(landingChapter, originTiming());
    }

    // SOL 01's origin log is the opening's main beat: its rows tell how
    // WORX BY GLIMPSE grew from within GLIMPSE, holding on MISSION before
    // it resolves. Side by side, the card lands in step with it: SITE
    // SECURED with the log's header, the title as ORIGIN resolves to
    // GLIMPSE, the subtitle ("Ours started with Glimpse.") with
    // EXPERIENCE. Stacked, the log tells it first (a little quicker),
    // docks, then the card takes the screen.
    function originTiming(quick) {
      if (canCollapse()) return { hudAt: 0.05, step: quick ? 0.2 : 0.34, set: quick ? 0.18 : 0.26, keyBeat: quick ? 0.25 : 0.6, hold: quick ? 0.5 : 1 };
      return {
        hudAt: 0.05, step: quick ? 0.22 : 0.46, set: quick ? 0.2 : 0.32, keyBeat: quick ? 0.3 : 0.8,
        cardAt: 0.1, textAt: { status: 0, title: 0.5, subtitle: 1.35, support: 1.6 },
      };
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

    // Back on SOL 01 from a later page: the landed ship at rest (frame
    // 033, dust settled, beacon on), no second landing. The shot dips
    // briefly while the camera "cuts" back to the landing angle.
    function showLanded(landingLayers) {
      stopLanding();
      if (!landingFX) { revealOrigin(); return; }
      landingFX._lastElapsed = MARKS.clear + 400;
      landingFX.runIdle();
      landingTextEl.classList.add("is-live", "is-origin");
      if (hud.clock) hud.clock.textContent = "SOL 01";
      if (hud.label) hud.label.textContent = "GLIMPSE · LANDED";
      runChapter(landingChapter, originTiming(true));
      gsap.to(landingLayers, { autoAlpha: 1, duration: reduceMotion ? 0.2 : 0.6, ease: "power1.out", overwrite: true });
    }

    /* ----------------------------------------------------------
       2. Per-scene hooks, directed one by one
       ---------------------------------------------------------- */
    var SCENE_DUR = reduceMotion ? 0.4 : 0.95;

    // Default: the page's chapter runs as it arrives, resets as it leaves.
    var sceneAnimations = scenes.map(function (_, idx) {
      var c = chapters[idx];
      return {
        onEnter: function () { if (c) runChapter(c, { hudAt: 0.2 }); },
        onLeave: function () { if (c) resetChapter(c); },
      };
    });

    function chain(idx, extra) {
      var base = sceneAnimations[idx];
      sceneAnimations[idx] = {
        onEnter: function (from, dir) { base.onEnter(from, dir); if (extra.onEnter) extra.onEnter(from, dir); },
        onLeave: function (to, dir) { base.onLeave(to, dir); if (extra.onLeave) extra.onLeave(to, dir); },
      };
    }

    // SOL 03 · the traverse: the rover drives in across the plain while
    // the camera pans with it (far ship and terrain slide the other way,
    // at their own depths). Going on, it pulls away to the right toward
    // the build site; coming back, it rolls back in from there.
    var traverse = scenes[2];
    if (traverse && traverse.querySelector(".story-rover")) chain(2, {
      onEnter: function (from, dir) {
        gsap.killTweensOf(traverse);
        if (reduceMotion) { gsap.set(traverse, { "--drive": 0, "--pan": 0 }); return; }
        if (dir < 0) {
          gsap.fromTo(traverse, { "--drive": 0.5, "--pan": -0.5 }, { "--drive": 0, "--pan": 0, duration: 1.6, ease: "power2.out" });
        } else {
          gsap.fromTo(traverse, { "--drive": -1.25, "--pan": 1 }, { "--drive": 0, "--pan": 0, duration: 2.8, ease: "power3.out" });
        }
      },
      onLeave: function (to, dir) {
        if (reduceMotion) return;
        gsap.killTweensOf(traverse);
        if (dir > 0) gsap.to(traverse, { "--drive": 0.9, "--pan": -0.4, duration: SCENE_DUR, ease: "power2.in" });
      },
    });

    // SOL 04 · the build site powers up in stages: it rises into place,
    // the floodlights and beacons come on, then the work starts (sparks,
    // drone, crew footfall). Coming back, it's already working.
    var build = scenes[3];
    var buildTimers = [];
    if (build && build.querySelector(".story-site")) chain(3, {
      onEnter: function (from, dir) {
        buildTimers.forEach(clearTimeout);
        gsap.killTweensOf(build);
        if (dir < 0 || reduceMotion) {
          build.classList.add("is-power", "is-work");
          gsap.set(build, { "--rise": 0 });
          return;
        }
        build.classList.remove("is-power", "is-work");
        gsap.fromTo(build, { "--rise": 1 }, { "--rise": 0, duration: 2, ease: "power3.out" });
        buildTimers = [
          setTimeout(function () { build.classList.add("is-power"); }, 650),
          setTimeout(function () { build.classList.add("is-work"); }, 1400),
        ];
      },
      onLeave: function () { buildTimers.forEach(clearTimeout); },
    });

    // SOL 05 · the salute: the hatch light comes up and falls on the
    // crew as they stand to attention; the camera settles in on the ship.
    var tribute = scenes[4];
    var tributeTimer = null;
    if (tribute && tribute.querySelector(".story-tribute")) chain(4, {
      onEnter: function (from, dir) {
        clearTimeout(tributeTimer);
        gsap.killTweensOf(tribute);
        if (dir < 0 || reduceMotion) {
          tribute.classList.add("is-lit");
          gsap.set(tribute, { "--push": 0 });
          return;
        }
        tribute.classList.remove("is-lit");
        gsap.fromTo(tribute, { "--push": 1 }, { "--push": 0, duration: 4, ease: "power1.out" });
        tributeTimer = setTimeout(function () { tribute.classList.add("is-lit"); }, 450);
      },
      onLeave: function () { clearTimeout(tributeTimer); },
    });

    if (landingCanvas) {
      var landingLayers = [landingCanvas];
      if (landingBackCanvas) landingLayers.push(landingBackCanvas);
      if (landingFrontCanvas) landingLayers.push(landingFrontCanvas);

      var fadeLayersIn = function (fromIndex) {
        gsap.killTweensOf(landingLayers);
        var sameShot = fromIndex === 0 || fromIndex === 1 || fromIndex === ASCENT_IDX;
        if (sameShot || reduceMotion) gsap.set(landingLayers, { autoAlpha: 1 });
        else gsap.fromTo(landingLayers, { autoAlpha: 0 }, { autoAlpha: 1, duration: SCENE_DUR, delay: SCENE_DUR * 0.12, ease: "power2.out" });
      };
      var fadeLayersOut = function (keepIdx) {
        gsap.to(landingLayers, {
          autoAlpha: 0, duration: 0.35, overwrite: true,
          onComplete: function () { if (landingFX && keepIdx.indexOf(currentIndex) < 0) landingFX.reset(); },
        });
      };
      var SHOT_PAGES = [0, 1, ASCENT_IDX];

      sceneAnimations[0] = {
        // First visit: the full landing, its caption held until touchdown +
        // settle (revealOrigin()). Coming back: the landed ship at rest.
        onEnter: function (fromIndex) {
          if (fromIndex == null) {
            gsap.killTweensOf(landingLayers);
            gsap.set(landingLayers, { autoAlpha: 1 });
            playLanding();
            return;
          }
          resetChapter(landingChapter);
          gsap.to(landingLayers, {
            autoAlpha: 0, duration: reduceMotion ? 0.1 : 0.28, overwrite: true,
            onComplete: function () { if (currentIndex === 0) showLanded(landingLayers); },
          });
        },
        onLeave: function (toIndex) {
          if (toIndex === 1 && landingFX) {
            // Into SOL 02: same shot, no teardown, stop the landing's
            // clock, keep the ship + sky alive, and cut to the new angle.
            playLanding.token = (playLanding.token || 0) + 1;
            cancelAnimationFrame(landingRAF);
            landingRAF = 0;
            clearTimeout(landingTextTimer);
            story.classList.remove("is-cinema", "is-blackout");
            resetHud();
            landingFX.setStill(true);
            landingFX.runIdle();
            landingFX.setPose(summaryPose(), 700, true);
            return;
          }
          stopLanding();
          fadeLayersOut(SHOT_PAGES);
        },
      };

      // SOL 02: the ship on the left third, hatch open, crew out. The
      // airlock lights flicker on as the pose settles; the readiness log
      // boots with them and the card follows: one event.
      var summaryChapter = chapters[1];
      if (summaryChapter && landingFX) {
        sceneAnimations[1] = {
          onEnter: function (fromIndex) {
            fadeLayersIn(fromIndex);
            if (fromIndex !== 0) {
              landingFX.setStill(true);
              landingFX.runIdle();
              landingFX.setPose(summaryPose(), 0);
            }
            runChapter(summaryChapter, { hudAt: fromIndex === 0 ? 0.8 : 0.3, cardAt: 0.75 });
          },
          onLeave: function (toIndex) {
            resetChapter(summaryChapter);
            if (toIndex !== 0) fadeLayersOut(SHOT_PAGES);
          },
        };
      }
    }

    /* ----------------------------------------------------------
       2b. SOL 06 (ascent, habitat online): the landing shot flown the
       other way (landing-fx.js playAscent()). The ship returns to the
       GLIMPSE orbiter while the habitat powers up below and links up to
       it; the operations log brings each capability online with it.
       Once the caption has landed the story turns to the closing page on
       its own, as it always has (forward visits only: stepping back from
       the closing page lands on the settled shot and stays there).
       ---------------------------------------------------------- */
    var ascentText = texts[ASCENT_IDX];
    // after the caption lands: long enough to read the chapter's story
    // (title, subtitle and supporting line) before the closing page
    var AUTO_ADVANCE_MS = 4200;

    if (ascentText && landingFX && typeof LandingFX !== "undefined" && LandingFX.ASCENT) {
      var AS = LandingFX.ASCENT;
      var ascentChapter = chapters[ASCENT_IDX];
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
      // When each operations-log row resolves, in ascent time.
      var WORX_AT = { base: 0, web: AS.pitch, soft: AS.insert, ux: AS.rendezvous, flow: AS.dock, client: AS.link, global: AS.link + 600 };
      var q = function (sel) { return ascentText.querySelector(sel); };
      var ahud = {
        root: q(".ascent-hud"), log: q(".ascent-log"), worx: q(".worx-log"),
        stages: [], stage: -1, lastText: -1e9,
        clock: q('[data-asc="t"]'), alt: q('[data-asc="alt"]'), vel: q('[data-asc="vel"]'), dist: q('[data-asc="dist"]'),
        shipT: q('[data-target="ship"]'), habT: q('[data-target="hab"]'),
        shipLabel: q('[data-target="ship"] .hud-target-label'),
        shipLine: q('[data-leader="ship-line"]'), shipAccent: q('[data-leader="ship-accent"]'),
        habLine: q('[data-leader="hab-line"]'), habAccent: q('[data-leader="hab-accent"]'),
        rows: [], status: q('[data-worx="status"]'),
        caption: false, opened: false, advance: false, advanceTimer: null,
      };
      ascentText.querySelectorAll("li [data-worx]").forEach(function (b) {
        ahud.rows.push({ li: b.parentNode, at: WORX_AT[b.dataset.worx] || 0 });
      });
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

      // The operations log's rows, as a function of ascent time: each
      // capability comes online as the habitat powers up.
      var updateWorx = function (a) {
        ahud.rows.forEach(function (r, i) {
          if (a >= 300 + i * 120) r.li.classList.add("is-in");
          r.li.classList.toggle("is-set", a >= r.at);
        });
        var go = a >= AS.link + 600;
        var txt = go ? "WORX · ALL SYSTEMS GO" : "WORX · SYSTEMS COMING ONLINE";
        if (ahud.status && ahud.status.textContent !== txt) ahud.status.textContent = txt;
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

      // Stacked layouts: the operations log flies as a docked chip (the sky
      // stays clear for the launch), opens as the links come up to tell its
      // part, then docks again for the card.
      var openAscentLog = function () {
        if (ahud.opened || !canCollapse()) return;
        ahud.opened = true;
        ascentText.classList.remove("is-docked");
      };

      // Turn to the closing page on its own, AUTO_ADVANCE_MS after the
      // caption has landed. Never fights a turn in flight or a visitor who
      // has already moved on.
      var scheduleAdvance = function (afterMs) {
        clearTimeout(ahud.advanceTimer);
        if (!ahud.advance) return;
        ahud.advanceTimer = setTimeout(function autoAdvance() {
          if (currentIndex !== ASCENT_IDX || navMode !== "story" || !ahud.advance) return;
          if (isAnimating || document.hidden) { ahud.advanceTimer = setTimeout(autoAdvance, 200); return; }
          goToPage(ASCENT_IDX + 1, 1);
        }, afterMs);
      };

      var revealAscentCaption = function () {
        if (ahud.caption) return;
        ahud.caption = true;
        story.classList.remove("is-cinema");
        var tl = runChapter(ascentChapter, { rows: false, hudAt: 0, cardAt: 0.1, hold: 0.5 });
        // the card's reveal is the timeline's last step, its text takes ~1.1s
        scheduleAdvance((tl.duration() + 1.1) * 1000 + AUTO_ADVANCE_MS);
      };

      var updateAscentHud = function (info) {
        if (currentIndex !== ASCENT_IDX) return;
        var a = info.elapsed;
        var stage = 0;
        for (var i = 0; i < ASCENT_NARRATION.length; i++) if (a >= ASCENT_NARRATION[i].at) stage = i;
        if (stage !== ahud.stage) {
          ahud.stage = stage;
          ahud.stages.forEach(function (li, j) {
            li.classList.toggle("is-done", j < stage);
            li.classList.toggle("is-active", j === stage);
          });
          if (ahud.shipLabel) ahud.shipLabel.textContent = a >= AS.dock ? "GLIMPSE · RENDEZVOUS" : a >= AS.lift ? "GLIMPSE · ASCENT" : "GLIMPSE";
        }
        if (a - ahud.lastText > 66 || a < ahud.lastText) {
          ahud.lastText = a;
          var t = info.telemetry;
          if (ahud.alt) ahud.alt.textContent = fmtAlt(t.alt);
          if (ahud.vel) ahud.vel.textContent = fmtVel(t.vel);
          if (ahud.dist) ahud.dist.textContent = fmtDist(t.dist);
          if (ahud.clock) ahud.clock.textContent = fmtClock(a);
          updateWorx(a);
        }
        if (a >= AS.link) openAscentLog();
        if (ahud.root) ahud.root.style.transform = (info.shake.x || info.shake.y)
          ? "translate(" + (info.shake.x * 0.35).toFixed(1) + "px," + (info.shake.y * 0.35).toFixed(1) + "px)" : "";
        // GLIMPSE target: the ship, then the orbiter it has rejoined
        var sp = info.shipVisible ? info.ship : info.orbiter;
        if (ahud.shipT) ahud.shipT.style.transform = "translate(" + sp.x.toFixed(1) + "px," + sp.y.toFixed(1) + "px)";
        var side = !isStacked();
        if (side) leader(ahud.log, false, ahud.stages[ahud.stage], sp.x, sp.y, ahud.shipLine, ahud.shipAccent);
        // WORX target: the habitat, once it's out of the dust
        var habOn = info.habitat && info.habitatAlpha > 0.6;
        if (ahud.habT) {
          ahud.habT.style.opacity = habOn ? "1" : "0";
          if (info.habitat) ahud.habT.style.transform = "translate(" + info.habitat.x.toFixed(1) + "px," + info.habitat.y.toFixed(1) + "px)";
        }
        if (habOn && side) leader(ahud.worx, true, ahud.worx.querySelector(".hud-head"), info.habitat.x, info.habitat.y, ahud.habLine, ahud.habAccent);
        else clearLeader(ahud.habLine, ahud.habAccent);
        if (a >= AS.done) revealAscentCaption();
      };

      var resetAscentHud = function () {
        ahud.stage = -1;
        ahud.caption = false;
        ahud.opened = false;
        ahud.advance = false;
        clearTimeout(ahud.advanceTimer);
        ahud.lastText = -1e9;
        ahud.stages.forEach(function (li) { li.classList.remove("is-done", "is-active"); });
        clearLeader(ahud.shipLine, ahud.shipAccent);
        clearLeader(ahud.habLine, ahud.habAccent);
        if (ahud.habT) ahud.habT.style.opacity = "0";
        resetChapter(ascentChapter);
      };

      sceneAnimations[ASCENT_IDX] = {
        onEnter: function (fromIndex, dir) {
          fadeLayersIn(fromIndex);
          resetAscentHud();
          ascentText.classList.add("is-live", "is-complete");
          if (dir < 0) {
            // Back from the closing page: the settled end shot, no second
            // launch and no auto-advance (the visitor chose to be here).
            landingFX.playAscent(updateAscentHud, AS.done + 3000);
            return;
          }
          ahud.advance = true;
          story.classList.add("is-cinema");
          if (canCollapse()) { ascentText.classList.add("is-docked"); syncChip(ascentChapter); }
          landingFX.playAscent(updateAscentHud, 0);
        },
        onLeave: function () {
          resetAscentHud();
          story.classList.remove("is-cinema");
          fadeLayersOut(SHOT_PAGES);
        },
      };

      // Warm the ascent art up a page early, so it's decoded on arrival.
      if (ASCENT_IDX > 0 && sceneAnimations[ASCENT_IDX - 1]) {
        var prevEnter = sceneAnimations[ASCENT_IDX - 1].onEnter;
        sceneAnimations[ASCENT_IDX - 1].onEnter = function (fromIndex, dir) {
          LandingFX.preloadAscent();
          prevEnter(fromIndex, dir);
        };
      }
    }

    /* ----------------------------------------------------------
       3. Page turns (fixed-duration timeline, never scrubbed)
       ---------------------------------------------------------- */

    // Resting state: only scene 0 / text 0 visible. autoAlpha also sets
    // visibility, so inactive chapters can't be tabbed into.
    gsap.set(scenes, { autoAlpha: 0, force3D: true, transformOrigin: "50% 58%" });
    gsap.set(scenes[0], { autoAlpha: 1 });
    gsap.set(texts, { autoAlpha: 0, y: 22 });
    gsap.set(texts[0], { autoAlpha: 1, y: 0 });
    scenes[0].classList.add("is-active");
    texts[0].classList.add("is-active");
    scenes.forEach(function (s, idx) { if (idx) s.classList.add("is-parked"); });
    story.classList.add("has-sky");
    chapters.forEach(function (c) { hideTextParts(textParts(c.el)); });

    // Depth, not a page flip: going forward the camera moves on through
    // the old shot (it swells past the lens) and the new one comes up
    // from a little further off; going back, the old shot recedes and the
    // previous one returns from just in front. A touch of vertical travel
    // follows the same direction as the gesture.
    var D_NEAR = reduceMotion ? 1 : 1.055;
    var D_FAR = reduceMotion ? 1 : 0.965;
    var D_Y = reduceMotion ? 0 : 1.6;

    function visibleScene(idx) { return idx === 1 || idx === ASCENT_IDX ? scenes[0] : scenes[idx]; }

    var navToken = 0;
    var navTl = null;
    var navFailsafe = null;

    // Scenes off screen hold their CSS loops (dust, beacons, drone,
    // motes...) still: .is-parked in about.css. Only the shot on screen
    // (and, mid-turn, the one it's turning from) keeps running.
    function parkScenes() {
      var live = visibleScene(currentIndex);
      scenes.forEach(function (s) { s.classList.toggle("is-parked", s !== live); });
    }

    function releaseNav(token) {
      if (token !== navToken) return;
      clearTimeout(navFailsafe);
      navTl = null;
      isAnimating = false;
      parkScenes();
    }

    function callHook(idx, name, arg, dir) {
      var h = sceneAnimations[idx];
      if (!h || !h[name]) return;
      try { h[name](arg, dir); } catch (err) { console.error("[about] scene " + idx + " " + name + " failed", err); }
    }

    function goToPage(targetIndex, direction) {
      if (isAnimating || navMode !== "story" || targetIndex === currentIndex) return false;
      if (targetIndex < 0 || targetIndex > LAST) return false;

      var token = ++navToken;
      isAnimating = true;
      var fromIndex = currentIndex;
      var toIndex = targetIndex;
      currentIndex = toIndex;

      scenes.forEach(function (s, idx) { s.classList.toggle("is-active", idx === toIndex); });
      texts.forEach(function (t, idx) { t.classList.toggle("is-active", idx === toIndex); });

      callHook(fromIndex, "onLeave", toIndex, direction);
      callHook(toIndex, "onEnter", fromIndex, direction);
      scheduleOccluders();

      story.classList.toggle("has-sky", toIndex <= 1 || toIndex === ASCENT_IDX);
      var outScene = visibleScene(fromIndex);
      var inScene = visibleScene(toIndex);
      var sameShot = outScene === inScene;
      var outText = texts[fromIndex];
      var inText = texts[toIndex];
      var fwd = direction === 1;
      inScene.classList.remove("is-parked");

      // Unlock from the timeline, with a wall-clock failsafe: a hidden
      // tab suspends GSAP's ticker, and a missed onComplete must never
      // leave navigation locked.
      clearTimeout(navFailsafe);
      navFailsafe = setTimeout(function () { releaseNav(token); }, SCENE_DUR * 1000 + 700);
      var tl = navTl = gsap.timeline({ defaults: { ease: "power2.inOut" }, onComplete: function () { releaseNav(token); } });

      if (!sameShot) {
        tl.to(outScene, {
          autoAlpha: 0, scale: fwd ? D_NEAR : D_FAR, yPercent: fwd ? -D_Y : D_Y,
          duration: SCENE_DUR, ease: "power2.in",
        }, 0);
        tl.fromTo(inScene,
          { autoAlpha: 0, scale: fwd ? D_FAR : D_NEAR, yPercent: fwd ? D_Y : -D_Y },
          { autoAlpha: 1, scale: 1, yPercent: 0, duration: SCENE_DUR, ease: "power2.out" },
          SCENE_DUR * 0.1);
        if (shadow && !reduceMotion) {
          tl.fromTo(shadow, { autoAlpha: 0 }, { autoAlpha: 0.32, duration: SCENE_DUR * 0.45, ease: "power1.in" }, 0)
            .to(shadow, { autoAlpha: 0, duration: SCENE_DUR * 0.5, ease: "power1.out" }, SCENE_DUR * 0.5);
        }
      }

      tl.to(outText, { autoAlpha: 0, y: fwd ? -18 : 18, duration: SCENE_DUR * 0.5 }, 0);
      tl.fromTo(inText,
        { autoAlpha: 0, y: fwd ? 22 : -22 },
        { autoAlpha: 1, y: 0, duration: SCENE_DUR * 0.55 },
        SCENE_DUR * (sameShot ? 0.3 : 0.4));
      return true;
    }

    // First scene, gesture backward: a small give, nothing moves on.
    function nudge(dir) {
      if (reduceMotion || isAnimating) return;
      var el = texts[currentIndex];
      gsap.fromTo(el, { y: dir < 0 ? 10 : -10 }, { y: 0, duration: 0.6, ease: "elastic.out(1, 0.5)", overwrite: "auto" });
    }

    /* ----------------------------------------------------------
       Story ↔ page boundary
       ---------------------------------------------------------- */
    var scrollTw = null;
    var scrollDone = null;
    var scrollFailsafe = null;

    function setLocked(on) { html.classList.toggle("story-locked", on); }
    function storyBottom() { return story.offsetTop + story.offsetHeight; }
    function maxScroll() { return Math.max(0, html.scrollHeight - window.innerHeight); }
    function exitTarget() { return Math.min(storyBottom(), maxScroll()); }
    function jumpTo(y) {
      html.style.scrollBehavior = "auto";
      window.scrollTo(0, y);
      html.style.scrollBehavior = "";
    }

    function finishScroll() {
      clearTimeout(scrollFailsafe);
      if (scrollTw) { scrollTw.kill(); scrollTw = null; }
      html.style.scrollBehavior = "";
      var d = scrollDone; scrollDone = null;
      if (d) d();
    }

    // A controlled scroll (base.css scroll-behavior: smooth is suspended
    // so the browser doesn't smooth every step again).
    function scrollToY(to, dur, done) {
      finishScroll();
      var st = { y: window.scrollY };
      html.style.scrollBehavior = "auto";
      scrollDone = function () { jumpTo(to); if (done) done(); };
      scrollTw = gsap.to(st, {
        y: to, duration: dur, ease: "power2.inOut",
        onUpdate: function () { window.scrollTo(0, st.y); },
        onComplete: finishScroll,
      });
      scrollFailsafe = setTimeout(finishScroll, dur * 1000 + 800);
    }

    // Closing page, forward: hand over to the page below. The final chapter
    // lifts away a little faster than the page scrolls (parallax).
    function leaveStory() {
      if (navMode !== "story" || isAnimating) return false;
      var target = exitTarget();
      if (target < 2) return false;
      navMode = "leaving";
      setLocked(false);
      occluders.length = 0;
      var dur = reduceMotion ? 0.3 : 1.1;
      if (!reduceMotion) gsap.to(texts[LAST], { y: -60, duration: dur, ease: "power2.in", overwrite: "auto" });
      scrollToY(target, dur, function () { navMode = "page"; });
      return true;
    }

    // Back up into the story from the page: settle on the closing page.
    function returnToStory() {
      if (navMode !== "page" && navMode !== "leaving") return false;
      navMode = "returning";
      var dur = reduceMotion ? 0.3 : Math.min(1.1, 0.5 + window.scrollY / Math.max(1, story.offsetHeight) * 0.7);
      gsap.to(texts[LAST], { y: 0, duration: dur, ease: "power2.out", overwrite: "auto" });
      scrollToY(0, dur, enterStoryMode);
      return true;
    }

    function enterStoryMode() {
      navMode = "story";
      setLocked(true);
      if (window.scrollY !== 0) jumpTo(0);
      gsap.set(texts[currentIndex], { y: 0 });
      scheduleOccluders();
    }

    // One step in a direction, wherever the visitor is.
    function requestStep(dir) {
      if (navMode === "story") {
        if (isAnimating) return false;
        if (dir > 0 && currentIndex === LAST) return leaveStory();
        if (dir < 0 && currentIndex === 0) { nudge(dir); return true; }
        return goToPage(currentIndex + dir, dir);
      }
      if (navMode === "page" && dir < 0 && window.scrollY <= exitTarget() + 1) return returnToStory();
      return false;
    }

    // Input from UI that must keep its own gestures (open menu, chat dock).
    function uiOwns(target) {
      if (document.querySelector(".site-header.menu-open, .site-header.mega-open")) return true;
      return !!(target && target.closest && target.closest(".qc-dock, .mega, .nav-links"));
    }

    // Kick off the landing on load; never restore a mid-page scroll.
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    jumpTo(0);
    setLocked(true);
    callHook(0, "onEnter", undefined, 1);

    /* ----------------------------------------------------------
       4. Gestures → steps
       ---------------------------------------------------------- */
    var WHEEL_GAP_MS = 220;      // silence that ends a wheel gesture
    var WHEEL_THRESHOLD = 28;    // px of intent before a gesture fires
    var WHEEL_REKICK = 2.2;      // delta jump that marks a new swipe inside a momentum tail
    var wheel = { last: 0, accum: 0, used: false, usedAt: 0, lastAbs: 0 };

    function wheelDelta(e) {
      var d = e.deltaY;
      if (e.deltaMode === 1) d *= 16;
      else if (e.deltaMode === 2) d *= window.innerHeight;
      return d;
    }

    window.addEventListener("wheel", function (e) {
      if (e.ctrlKey || uiOwns(e.target)) return;                // pinch-zoom, menus
      // The event's own timestamp, not the time we got to handle it: a
      // busy frame must not make one swipe look like two.
      var now = e.timeStamp || performance.now();
      var dy = wheelDelta(e);
      var ady = Math.abs(dy);
      if (Math.abs(e.deltaX) > ady) return;                     // horizontal
      if (now - wheel.last > WHEEL_GAP_MS) {
        // A quiet, still-decaying tail soon after a turn is the same
        // swipe's momentum resurfacing, not a new gesture. (A new swipe
        // or a mouse notch arrives with a bigger delta.)
        var tail = wheel.used && now - wheel.usedAt < 1600 && ady < 40 && ady <= Math.max(3, wheel.lastAbs * 1.25);
        if (!tail) { wheel.accum = 0; wheel.used = false; }
      } else if (wheel.used && !isAnimating && navMode === "story" &&
        ady > 14 && ady > wheel.lastAbs * WHEEL_REKICK && now - wheel.usedAt > 350) {
        wheel.accum = 0; wheel.used = false;                    // a fresh swipe over the tail
      }
      wheel.last = now;
      wheel.lastAbs = ady;

      var owned = navMode !== "page" || (dy < 0 && window.scrollY <= exitTarget() + 1);
      if (!owned) return;                                       // normal page scroll
      e.preventDefault();
      if (navMode === "leaving" || navMode === "returning") { wheel.used = true; return; }
      if (wheel.used) return;
      if (isAnimating) { wheel.used = true; wheel.usedAt = now; return; }  // no queued turns
      if (ady < 1) return;
      if (wheel.accum && (wheel.accum > 0) !== (dy > 0)) wheel.accum = 0;
      wheel.accum += dy;
      // a mouse notch (line mode or one big step) is intent on its own
      if (Math.abs(wheel.accum) >= WHEEL_THRESHOLD || e.deltaMode === 1) {
        requestStep(wheel.accum > 0 ? 1 : -1);
        wheel.used = true;
        wheel.usedAt = now;
        wheel.accum = 0;
      }
    }, { passive: false });

    var touch = { active: false, state: "idle", x: 0, y: 0, t: 0, native: false };
    function touchThreshold() { return Math.max(34, Math.min(64, window.innerHeight * 0.06)); }
    function zoomed() { return !!(window.visualViewport && window.visualViewport.scale > 1.05); }

    window.addEventListener("touchstart", function (e) {
      touch.active = true;
      if (e.touches.length !== 1 || uiOwns(e.target) || zoomed()) { touch.state = "ignore"; return; }
      // the visitor takes over a boundary scroll: hand it to them
      if (navMode === "leaving" || navMode === "returning") { finishScroll(); navMode = "page"; setLocked(false); }
      touch.state = "pending";
      touch.x = e.touches[0].clientX;
      touch.y = e.touches[0].clientY;
      touch.t = performance.now();
      touch.native = navMode === "page";
    }, { passive: true });

    window.addEventListener("touchmove", function (e) {
      if (touch.state === "ignore" || touch.native || e.touches.length !== 1) return;
      // While the story owns input the page must not move under it.
      if (navMode === "story" && e.cancelable) e.preventDefault();
      if (touch.state === "done" || touch.state === "idle") return;
      var dx = e.touches[0].clientX - touch.x;
      var dy = touch.y - e.touches[0].clientY;   // + = swipe up = forward
      if (touch.state === "pending") {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;   // still a tap
        if (Math.abs(dx) > Math.abs(dy) * 1.3) { touch.state = "done"; return; } // horizontal
        touch.state = "track";
      }
      if (Math.abs(dy) >= touchThreshold()) {
        touch.state = "done";                   // this finger has had its turn
        if (!isAnimating) requestStep(dy > 0 ? 1 : -1);
      }
    }, { passive: false });

    window.addEventListener("touchend", function (e) {
      if (touch.state === "track" && !touch.native && e.changedTouches.length) {
        // a short, quick flick counts too
        var dy = touch.y - e.changedTouches[0].clientY;
        var dt = Math.max(1, performance.now() - touch.t);
        if (Math.abs(dy) >= 22 && Math.abs(dy) / dt > 0.45 && !isAnimating) requestStep(dy > 0 ? 1 : -1);
      }
      touch.state = "idle";
      touch.active = e.touches.length > 0;
      if (!touch.active && navMode === "page") scheduleSettle();
    }, { passive: true });

    window.addEventListener("touchcancel", function () {
      touch.state = "idle";
      touch.active = false;
    }, { passive: true });

    // Keyboard: one step per press (a held key doesn't skim chapters).
    var NAV_KEYS = { ArrowDown: 1, PageDown: 1, " ": 1, Spacebar: 1, ArrowUp: -1, PageUp: -1 };
    var FOCUSABLE = /^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/;
    window.addEventListener("keydown", function (e) {
      var dir = NAV_KEYS[e.key];
      if (!dir || e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.activeElement && (FOCUSABLE.test(document.activeElement.tagName) || document.activeElement.getAttribute("role") === "button")) return;
      if (e.key === " " && e.shiftKey) dir = -1;
      var owned = navMode !== "page" || (dir < 0 && window.scrollY <= exitTarget() + 1);
      if (!owned) return;
      e.preventDefault();
      if (e.repeat) return;
      requestStep(dir);
    });

    // Scroll that didn't come through the gestures above (scrollbar drag,
    // End key, find-in-page, restoration, the address bar settling):
    //  - in the story: put the page back, no page turn;
    //  - on the page, back at the very top: the story takes over again;
    //  - on the page, stopped part-way over the story: finish the move in
    //    the direction it was going (never leave the two half-and-half).
    var lastY = 0, lastDir = 0, settleTimer = null;
    function scheduleSettle() {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, 160);
    }
    function settle() {
      if (navMode !== "page" || touch.active) return;
      var y = window.scrollY, target = exitTarget();
      if (y <= 0) { enterStoryMode(); return; }
      if (y < target - 2) {
        if (lastDir < 0) returnToStory();
        else { navMode = "leaving"; scrollToY(target, 0.6, function () { navMode = "page"; }); }
      }
    }
    window.addEventListener("scroll", function () {
      var y = window.scrollY;
      if (y !== lastY) lastDir = y > lastY ? 1 : -1;
      lastY = y;
      if (navMode === "leaving" || navMode === "returning") return;
      if (navMode === "story") {
        if (y <= 0) return;
        if (currentIndex === LAST && lastDir > 0) { navMode = "page"; setLocked(false); scheduleSettle(); return; }
        jumpTo(0);
        return;
      }
      if (y <= 0) { enterStoryMode(); return; }
      scheduleSettle();
    }, { passive: true });

    // Hidden tab: finish whatever is in flight so nothing resumes half-way
    // (or stays locked) when the visitor comes back.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) return;
      if (navTl) navTl.progress(1);
      releaseNav(navToken);
      if (scrollTw || scrollDone) finishScroll();
      wheel.used = false; wheel.accum = 0;
      touch.state = "idle"; touch.active = false;
    });
    window.addEventListener("blur", function () { touch.state = "idle"; touch.active = false; });

    var resizeTimer;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (landingSeq) landingSeq.resize();
        syncCameraOrigin();
        if (landingFX) landingFX.resize();
        if (navMode === "story" && window.scrollY !== 0) jumpTo(0);
        redockActive();
        scheduleOccluders();
      }, 200);
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", onResize);
  } else {
    story.classList.add("story--fallback");
    document.querySelectorAll(".story-scene, .story-text").forEach(function (el) {
      el.classList.add("is-active", "is-live", "is-revealed", "is-origin", "is-complete", "is-power", "is-work", "is-lit");
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
  // The landing's Martian night sky (sky-fx.js: star field, Earth · Moon,
  // Jupiter, Phobos, Deimos, the odd meteor) on every other page too, so
  // the whole story shares one sky, drawn with a still camera, its
  // horizon set just above the plain's hill line.
  var nightSky = typeof MartianSky !== "undefined" ? new MartianSky({ reduceMotion: reduceMotion }) : null;
  skyFx = { dpr: dpr, _cam: null, cameraOriginY: 0.62, horizonY: 0.37, occluders: occluders };
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
    canvas.width = Math.max(1, story.clientWidth * dpr);
    canvas.height = Math.max(1, story.clientHeight * dpr);
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
    // The sky pages (#story.has-sky) draw the storm cell, the orbiters and
    // the labels on landing-fx.js's canvas instead; only stars go on here.
    if (!ownSky) return;
    if (typeof AmbientStorm !== "undefined") AmbientStorm.draw(ctx, canvas.width, canvas.height, { alpha: 0.85 });
    // The GLIMPSE mothership and the HOPE probe, the same shared, wall-clock-driven
    // passes landing-fx.js draws on the sky pages, so they read as one
    // continuous pass overhead whichever page you're on.
    var o = { dpr: dpr, occluders: occluders };
    if (typeof HopeProbe !== "undefined") HopeProbe.draw(ctx, canvas.width, canvas.height, o);
    if (typeof GlimpseOrbiter !== "undefined") GlimpseOrbiter.draw(ctx, canvas.width, canvas.height, o);
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
    setInterval(function () { if (!document.hidden) paint(); }, 1000); // keeps page-dependent labels right
  }

  // Only animate/paint while some part of the story is on screen; fade the
  // layer out once the visitor reaches the footer.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      function (entries) {
        var visible = entries[0].isIntersecting;
        canvas.classList.toggle("is-hidden", !visible);
        story.classList.toggle("is-offscreen", !visible); // about.css: CSS loops hold still
        if (visible) start(); else stop();
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
