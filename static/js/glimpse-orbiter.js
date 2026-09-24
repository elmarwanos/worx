/* ============================================================
   Worx by Glimpse — glimpse-orbiter.js
   The GLIMPSE mothership: a small, distant silhouette that drifts
   left-to-right across the sky, on loop, forever — the ship the
   lander (the "001-032" frames) undocked from before its descent,
   and will one day return to for ascent. Purely ambient: one shared,
   stateless, wall-clock-driven draw() call, so it stays in perfect
   sync no matter which of the two sky renderers is currently on
   screen:

     - about-story.js's plain star canvas (.story-stars, chapters
       2-9 — everything after the landing/summary pages)
     - landing-fx.js's front canvas (chapters 0-1 — the landing and
       its Mission Control summary), drawn straight in screen space
       so camera shake/push-in never touches it: it's meant to read
       as impossibly far away, well beyond the terrain and storm.

   Both call sites pass plain canvas-pixel dimensions and get back
   the same silhouette, at the same point in its pass, blinking in
   the same rhythm — because both just ask "where is it right now?"
   off performance.now(), with no per-caller state to fall out of
   sync.
   ============================================================ */

(function (global) {
  "use strict";

  var IMG_SRC = "../static/assets/about/glimpse_landing_frames_001-032/glimpse-landing-000.png";
  var PASS_MS = 84000;      // one full edge-to-edge pass — slow enough to feel orbital, not busy
  var BLINK_PERIOD = 1100;  // frequent satellite-style double-strobe, not a smooth breathing pulse

  var img = new Image();
  var ready = false;
  var aspect = 1780 / 1120; // fallback until the real image reports its size
  img.onload = function () {
    ready = true;
    aspect = img.naturalWidth / img.naturalHeight;
  };
  img.src = IMG_SRC;

  // Shared phase offset (ms) on the wall clock every renderer reads, so
  // one call to syncX() moves the orbiter's pass for all of them at once
  // (the ascent page times it to meet the ship) and they stay in sync.
  var offset = 0;
  function clock() { return performance.now() + offset; }

  // Where the orbiter is at wall-clock time t (canvas px of a w x h canvas).
  function positionAt(w, h, t) {
    var laneY = 0.15 * h + Math.sin(t * 0.00019) * h * 0.01;
    var span = w + h * 0.55;
    var x = -h * 0.28 + ((((t % PASS_MS) + PASS_MS) % PASS_MS) / PASS_MS) * span;
    var ih = Math.max(4.5 * Math.min(global.devicePixelRatio || 1, 2), h * 0.0075);   // same as draw()
    var iw = ih * aspect;
    return { x: x, y: laneY, iw: iw, ih: ih, node: { x: x - iw * 0.28, y: laneY + ih * 0.02 } };
  }

  function blinkStrength(t) {
    var ph = t % BLINK_PERIOD;
    if (ph < 90) return Math.sin((ph / 90) * Math.PI);
    if (ph > 210 && ph < 330) return Math.sin(((ph - 210) / 120) * Math.PI) * 0.65;
    return 0;
  }

  var GlimpseOrbiter = {
    // ctx: 2D context to draw into (device-pixel space).
    // w, h: that canvas's width/height in device px.
    // opts: { dpr, alpha, laneY (0..1, default 0.15) }
    draw: function (ctx, w, h, opts) {
      if (!ready || !w || !h) return;
      opts = opts || {};
      var dpr = opts.dpr || 1;
      var alpha = opts.alpha != null ? opts.alpha : 1;
      var t = clock();

      var laneY = (opts.laneY != null ? opts.laneY : 0.15) * h + Math.sin(t * 0.00019) * h * 0.01;
      var span = w + h * 0.55;
      var x = -h * 0.28 + ((((t % PASS_MS) + PASS_MS) % PASS_MS) / PASS_MS) * span;
      // Genuinely far: nearer than the fixed background bodies (Earth ·
      // Moon, Saturn — effectively at infinity) but still small enough
      // that it reads as a point with a shape, not a hero prop.
      var ih = Math.max(4.5 * dpr, h * 0.0075);
      var iw = ih * aspect;
      var tilt = Math.sin(t * 0.00015) * 0.05;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, laneY);
      ctx.rotate(tilt);
      ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
      ctx.restore();

      // Beacon: a warm strobe near the station's docking node, plus a
      // faint steady running light so it's findable between blinks.
      var bx = x - iw * 0.28, by = laneY + ih * 0.02;
      var blink = blinkStrength(t);
      if (blink > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = alpha;
        var g = ctx.createRadialGradient(bx, by, 0, bx, by, ih * 0.9);
        g.addColorStop(0, "rgba(255,226,140," + (0.85 * blink).toFixed(3) + ")");
        g.addColorStop(0.4, "rgba(255,196,90," + (0.45 * blink).toFixed(3) + ")");
        g.addColorStop(1, "rgba(255,180,60,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(bx, by, ih * 0.9, 0, 6.2832); ctx.fill();
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = alpha * 0.55;
      ctx.fillStyle = "#ffd77a";
      ctx.beginPath(); ctx.arc(bx, by, Math.max(0.8, ih * 0.05), 0, 6.2832); ctx.fill();
      ctx.restore();

      // Label, trailing behind its direction of travel — same family as
      // sky-fx.js's fixed star labels ("SATURN" / "EARTH · MOON"), sized
      // a step below them (it sits right next to its own small craft
      // icon rather than floating alone against empty sky, so the same
      // size reads as more prominent), in plain white rather than one of
      // the planets' tinted hues.
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = "500 " + (7 * dpr).toFixed(1) + "px 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";
      if ("letterSpacing" in ctx) ctx.letterSpacing = (1.4 * dpr).toFixed(1) + "px";
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("GLIMPSE", x + iw * 0.7 + 4 * dpr, laneY);
      ctx.restore();
    },

    // Where it is now (or `inMs` from now): { x, y, iw, ih, node } in
    // canvas px of a w x h canvas. node = its docking-node beacon.
    position: function (w, h, inMs) { return positionAt(w, h, clock() + (inMs || 0)); },

    // Shift the shared pass so that `inMs` from now the orbiter is at
    // x = xFrac of the canvas width (every renderer moves with it).
    syncX: function (xFrac, inMs, w, h) {
      var span = w + h * 0.55;
      var frac = (xFrac * w + h * 0.28) / span;
      var tNow = performance.now() + (inMs || 0);
      offset = frac * PASS_MS - tNow;
    },

    // For a one-off hero shot (the undock prologue in about-story.js):
    // whether the source image has finished loading, and its aspect.
    isReady: function () { return ready; },
    aspect: function () { return aspect; },
    image: function () { return img; },
  };

  global.GlimpseOrbiter = GlimpseOrbiter;
})(window);
