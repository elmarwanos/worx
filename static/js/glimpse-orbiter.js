/* ============================================================
   Worx | glimpse-orbiter.js
   The GLIMPSE mothership: a small, distant silhouette that drifts
   left-to-right across the sky, on loop, forever, the ship the
   lander (the "001-032" frames) undocked from before its descent,
   and will one day return to for ascent. Purely ambient: one shared,
   stateless, wall-clock-driven draw() call, so it stays in perfect
   sync no matter which of the two sky renderers is currently on
   screen:

     - about-story.js's plain star canvas (.story-stars, chapters
       2-9, everything after the landing/summary pages)
     - landing-fx.js's front canvas (chapters 0-1, the landing and
       its Mission Control summary), drawn straight in screen space
       so camera shake/push-in never touches it: it's meant to read
       as impossibly far away, well beyond the terrain and storm.

   Both call sites pass plain canvas-pixel dimensions and get back
   the same silhouette, at the same point in its pass, blinking in
   the same rhythm, because both just ask "where is it right now?"
   off performance.now(), with no per-caller state to fall out of
   sync.
   ============================================================ */

(function (global) {
  "use strict";

  var IMG_SRC = "../static/assets/about/glimpse_landing_frames_001-032/glimpse-landing-000.png";
  var PASS_MS = 84000;      // one full edge-to-edge pass, slow enough to feel orbital, not busy
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

  // Pick where a craft's name goes: the first of the candidate x
  // positions (label's left edge, canvas px) that is on the canvas and
  // clear of the HUD panels (opts.occluders, CSS px); if none is clear,
  // the first on-canvas one. The name is always drawn, never hidden.
  function placeLabel(cands, lw, ly, w, opts, dpr) {
    var edge = 6 * dpr, occ = opts.occluders, onCanvas = [];
    for (var i = 0; i < cands.length; i++) {
      if (cands[i] >= edge && cands[i] + lw <= w - edge) onCanvas.push(cands[i]);
    }
    if (!onCanvas.length) onCanvas = cands;
    if (occ && typeof MartianSky !== "undefined" && MartianSky.occluded) {
      for (var j = 0; j < onCanvas.length; j++) {
        if (!MartianSky.occluded(occ, (onCanvas[j] + lw / 2) / dpr, ly / dpr + 12, lw / dpr + 16)) return onCanvas[j];
      }
    }
    return onCanvas[0];
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
      // Moon, Jupiter, effectively at infinity) but still small enough
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

      // Label, trailing behind its direction of travel, same family as
      // sky-fx.js's fixed star labels ("JUPITER" / "EARTH · MOON"), sized
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
      // The name is always shown. It sits behind the ship, and hops to
      // the other side when that one runs off the canvas or under a HUD
      // panel.
      var gw = ctx.measureText("GLIMPSE").width;
      var lx = placeLabel([x + iw * 0.7 + 4 * dpr, x - iw * 0.7 - 4 * dpr - gw], gw, laneY, w, opts, dpr);
      ctx.fillText("GLIMPSE", lx, laneY);
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

  /* ------------------------------------------------------------
     HOPE, مسبار الأمل: the Emirates Mars Mission's probe, GLIMPSE's
     companion in the sky and the one the UAE is proud of. Same label
     type as GLIMPSE, drawn from its own render (the gold bus, the
     high-gain dish, the two solar wings), smaller so it reads farther
     off. It flies the high lane above GLIMPSE's, left to right, then
     back right to left, turning every pass, so the two never touch; its
     beacon holds each colour of the UAE flag in turn: red, green,
     white, black. Same stateless wall-clock draw().
     ------------------------------------------------------------ */
  var HOPE_SRC = "../static/assets/about/hope-probe.png";
  // the lane MRO used to fly: the high one, above GLIMPSE's (0.15), with
  // room for the wobble and both crafts' size, so the two never touch
  var HOPE_PASS_MS = 70000;
  var HOPE_LANE = 0.105;
  var HOPE_FLAG = ["#ff3b30", "#22c55e", "#ffffff", "#0b0b0b"];
  var HOPE_STEP = 900;          // ms per colour: long enough to read each one

  var hopeImg = new Image();
  var hopeReady = false;
  var hopeAspect = 200 / 95;
  hopeImg.onload = function () { hopeReady = true; hopeAspect = hopeImg.naturalWidth / hopeImg.naturalHeight; };
  hopeImg.src = HOPE_SRC;

  // Where it is at time t. Every pass it turns round: left to right, then
  // right to left, then back, on the same lane.
  function hopeAt(w, h, t) {
    var tt = t + 23000;
    var n = Math.floor(tt / HOPE_PASS_MS);
    var p = (((tt % HOPE_PASS_MS) + HOPE_PASS_MS) % HOPE_PASS_MS) / HOPE_PASS_MS;
    var dir = n % 2 === 0 ? 1 : -1;
    var laneY = HOPE_LANE * h + Math.sin(t * 0.00023 + 1.7) * h * 0.006;
    var span = w + h * 0.6;
    var x = dir > 0 ? -h * 0.3 + p * span : w + h * 0.3 - p * span;
    // farther than GLIMPSE: a small bus; the render is ~2.1 : 1 wing to wing
    var s = Math.max(2.8 * Math.min(global.devicePixelRatio || 1, 2), h * 0.0046);
    var ih = s * 2.3, iw = ih * hopeAspect;
    return { x: x, y: laneY, s: s, iw: iw, ih: ih, dir: dir };
  }

  var HopeProbe = {
    draw: function (ctx, w, h, opts) {
      if (!w || !h || !hopeReady) return;
      opts = opts || {};
      var dpr = opts.dpr || 1;
      var alpha = opts.alpha != null ? opts.alpha : 1;
      var t = performance.now();
      var m = hopeAt(w, h, t);
      if (m.x < -m.iw * 2 - 200 * dpr || m.x > w + m.iw * 2 + 200 * dpr) return;
      var tilt = m.dir * (0.08 + Math.sin(t * 0.00011 + 2) * 0.035);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(m.x, m.y);
      ctx.rotate(tilt);
      ctx.scale(m.dir, 1);           // it faces the way it flies
      ctx.drawImage(hopeImg, -m.iw / 2, -m.ih / 2, m.iw, m.ih);
      ctx.restore();

      // the beacon on top of the bus, the UAE flag in turn: each colour
      // holds, lit, then dims before the next, with a wide halo so the
      // colour reads even this small; black is a dark pip in a bright
      // cream ring, so it still shows against the night
      var k = Math.floor(t / HOPE_STEP) % HOPE_FLAG.length;
      var ph = (t % HOPE_STEP) / HOPE_STEP;
      var on = ph < 0.62 ? 1 : 0.3;
      var bx = m.x + m.dir * m.iw * 0.08, by = m.y - m.ih * 0.36;
      var r = Math.max(1.6 * dpr, m.s * 0.34);
      ctx.save();
      ctx.globalAlpha = alpha * on;
      if (k === 3) {
        ctx.fillStyle = "rgba(254,238,207,0.35)";
        ctx.beginPath(); ctx.arc(bx, by, r * 2.6, 0, 6.2832); ctx.fill();
        ctx.fillStyle = HOPE_FLAG[3];
        ctx.beginPath(); ctx.arc(bx, by, r * 1.25, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = "rgba(254,238,207,0.95)";
        ctx.lineWidth = Math.max(1, r * 0.55);
        ctx.stroke();
      } else {
        var glow = ctx.createRadialGradient(bx, by, 0, bx, by, r * 7);
        glow.addColorStop(0, HOPE_FLAG[k]);
        glow.addColorStop(0.35, HOPE_FLAG[k] + "66");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(bx, by, r * 7, 0, 6.2832); ctx.fill();
        ctx.fillStyle = HOPE_FLAG[k];
        ctx.beginPath(); ctx.arc(bx, by, r * 1.2, 0, 6.2832); ctx.fill();
      }
      ctx.restore();

      // label, trailing behind it (so it swaps sides when it turns), in
      // the GLIMPSE label style: two lines, the Arabic name on top (set
      // right to left) and Proud of UAE under it (left to right), each
      // centred on the other; no separator.
      var AR = "\u0645\u0633\u0628\u0627\u0631 \u0627\u0644\u0623\u0645\u0644", EN = "Proud of UAE";
      var arFont = "600 " + (8.5 * dpr).toFixed(1) + "px 'Noto Kufi Arabic', 'Geeza Pro', 'Segoe UI', Tahoma, sans-serif";
      var enFont = "500 " + (7 * dpr).toFixed(1) + "px 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";
      ctx.save();
      ctx.textBaseline = "middle";
      ctx.font = arFont;
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
      ctx.direction = "rtl";
      var aw = ctx.measureText(AR).width;
      ctx.direction = "ltr";
      ctx.font = enFont;
      if ("letterSpacing" in ctx) ctx.letterSpacing = (1 * dpr).toFixed(1) + "px";
      var ew = ctx.measureText(EN).width;
      var total = Math.max(aw, ew), lineGap = 6.5 * dpr;
      var pad = m.iw * 0.62 + 4 * dpr;
      // trailing, unless that side is off the canvas or under a HUD
      // panel: then it leads. Always drawn, for as long as the probe shows.
      var ly = m.y, behind = m.x - pad - total, ahead = m.x + pad;
      var lx = placeLabel(m.dir > 0 ? [behind, ahead] : [ahead, behind], total, ly, w, opts, dpr);
      var mid = lx + total / 2;
      ctx.globalAlpha = alpha;
      // the Arabic, right to left, centred
      ctx.font = arFont;
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
      ctx.direction = "rtl";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.fillText(AR, mid, ly - lineGap);
      // Proud of UAE under it, left to right, centred
      ctx.direction = "ltr";
      ctx.textAlign = "center";
      ctx.font = enFont;
      if ("letterSpacing" in ctx) ctx.letterSpacing = (1 * dpr).toFixed(1) + "px";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText(EN, mid + (1 * dpr) / 2, ly + lineGap);
      ctx.restore();
    },

    // Where it is now: { x, y, s, dir, visible } in canvas px of a w x h canvas.
    position: function (w, h) {
      var m = hopeAt(w, h, performance.now());
      m.visible = m.x > w * 0.04 && m.x < w * 0.96;
      return m;
    },
  };

  global.HopeProbe = HopeProbe;
})(window);
