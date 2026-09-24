/* ============================================================
   Worx by Glimpse — ambient-storm.js
   A small, procedural storm cell in the sky's top-right corner: no
   video, no stock footage. Five billows, each churning on its own
   two-term sine (an irregular "breathe" + drift, not one clean pulse),
   so the whole cell keeps reshaping — swelling, shrinking, drifting
   into and out of each other — instead of just scaling uniformly.
   The whole cell carries a purple tint (billows, under-glow, core and
   lightning glow) in every section it appears in. Lightning is a
   genuine multi-pulse strike (2-4 irregular flickers, not a single
   smooth double-blink) in that same violet family, plus an occasional
   forked bolt.

   Scope: every chapter — the plain star canvas (about-story.js,
   chapters 2+) and landing-fx.js's front canvas for chapters 0-1 (the
   landing shot and its still view), over their own storm wall.
   ============================================================ */

(function (global) {
  "use strict";

  function rng(seed) {
    var s = seed;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  function blob(ctx, cx, cy, rx, ry, stops) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.001, rx), Math.max(0.001, ry));
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  // One uniform violet tone for every billow — the ambient cell carries a
  // purple tint across every section it appears in. Distinct hues per
  // billow read as scattered "spotlights" rather than one storm mass, so
  // only opacity varies cell to cell.
  var CELL_RGB = [161, 71, 157];

  // Five billows, generated once: each has its own size-breathing period/
  // phase/amplitude (two summed sine terms) and its own slow drift, so
  // no two ever swell or move in lockstep — the silhouette is always
  // subtly reshaping.
  var seed = rng(90210);
  var CELLS = (function () {
    var cells = [];
    for (var i = 0; i < 5; i++) {
      cells.push({
        ux: (seed() - 0.5) * 1.7, uy: (seed() - 0.5) * 0.8,
        rx: 0.4 + seed() * 0.5, ry: 0.24 + seed() * 0.28,
        pA: 3200 + seed() * 4200, pB: 5600 + seed() * 6400,
        phA: seed() * 6.283, phB: seed() * 6.283,
        ampR: 0.16 + seed() * 0.16,
        dxP: 8000 + seed() * 6000, dyP: 10000 + seed() * 7000,
        dPhX: seed() * 6.283, dPhY: seed() * 6.283,
        dAmp: 0.1 + seed() * 0.12,
        rgb: CELL_RGB,
        baseA: 0.55 + seed() * 0.15
      });
    }
    return cells;
  })();

  function cellShape(t, c) {
    var breathe = 1 + c.ampR * (
      Math.sin(t / c.pA * 6.283 + c.phA) * 0.6 + Math.sin(t / c.pB * 6.283 + c.phB) * 0.4
    );
    var dx = Math.sin(t / c.dxP * 6.283 + c.dPhX) * c.dAmp;
    var dy = Math.cos(t / c.dyP * 6.283 + c.dPhY) * c.dAmp * 0.6;
    return { breathe: breathe, dx: dx, dy: dy };
  }

  // The whole cell's own slow breath — on top of each billow's small
  // independent churn above. Paced off a real reference clip (a cloud
  // bloom that takes ~3s to swell, ~6s to roll at full size, ~3s to
  // fade — about 12s end to end): quick to swell, slow to settle back,
  // and subtle rather than a rhythmic pulse, so it reads as weather
  // actually moving instead of a shape breathing in and out.
  var SURGE_PERIOD = 11000;
  var SURGE_AMP = 0.16;
  function globalSurge(t) {
    var ph = (t % SURGE_PERIOD) / SURGE_PERIOD;
    var warped = ph < 0.35 ? (ph / 0.35) * 0.5 : 0.5 + (ph - 0.35) / 0.65 * 0.5;
    return 1 - Math.cos(warped * 6.2832) * SURGE_AMP;
  }

  // Modeled on real Mars/desert lightning photos: a mostly-vertical main
  // stroke (real strikes fall, they don't wander sideways across the
  // sky) with a dense fan of thinner forks branching off it — mostly in
  // the lower half, occasionally forking again — rather than one or two
  // branches. Regenerated fresh per strike, seeded off the strike's own
  // trigger time, so no two flashes look alike.
  function buildBolt(rand) {
    var segs = 9 + Math.floor(rand() * 4);
    var bx = -0.05 + rand() * 0.1, by = -0.52;
    var path = [[bx, by]];
    var s;
    for (s = 0; s < segs; s++) {
      bx += (rand() - 0.5) * 0.09; // small jitter — it falls, it doesn't zigzag
      by += 0.07 + rand() * 0.035;
      path.push([bx, by]);
    }
    var branches = [], branchCount = 4 + Math.floor(rand() * 4);
    for (var bi = 0; bi < branchCount; bi++) {
      var idx = 1 + Math.floor(Math.pow(rand(), 0.6) * (segs - 1)); // biased lower
      var start = path[idx];
      var fx = start[0], fy = start[1], fdir = rand() < 0.5 ? -1 : 1;
      var branch = [[fx, fy]], blen = 2 + Math.floor(rand() * 3);
      for (var k = 0; k < blen; k++) {
        fx += fdir * (0.03 + rand() * 0.06);
        fy += 0.04 + rand() * 0.045;
        branch.push([fx, fy]);
        if (rand() < 0.4) fdir *= -1;
      }
      branches.push(branch);
      // Roughly half the time, a second-order fork off that branch —
      // the fine fractal detail real strikes show near their tips.
      if (rand() < 0.5 && branch.length > 2) {
        var s2 = branch[1];
        var gx = s2[0], gy = s2[1], gdir = rand() < 0.5 ? -1 : 1;
        var sub = [[gx, gy]], slen = 2 + Math.floor(rand() * 2);
        for (var k2 = 0; k2 < slen; k2++) {
          gx += gdir * (0.025 + rand() * 0.045);
          gy += 0.03 + rand() * 0.035;
          sub.push([gx, gy]);
        }
        branches.push(sub);
      }
    }
    return { path: path, branches: branches };
  }

  // A genuine strike: 2-4 irregular pulses (leader + restrikes), each
  // its own brief rise-and-fall — real lightning flickers unevenly, it
  // doesn't breathe in and out smoothly — plus a fresh bolt shape, cached
  // for the strike's lifetime so it flashes into place rather than
  // visibly crawling into shape frame to frame.
  function buildStrike(rand) {
    var n = 2 + Math.floor(rand() * 3);
    var pulses = [], t = 0;
    for (var i = 0; i < n; i++) {
      t += 30 + rand() * 170;
      pulses.push({ at: t, dur: 35 + rand() * 100, peak: i === 0 ? 1 : 0.35 + rand() * 0.55 });
    }
    return { pulses: pulses, bolt: buildBolt(rand), total: t + 120 };
  }

  function strikeIntensity(strike, e) {
    var v = 0;
    for (var i = 0; i < strike.pulses.length; i++) {
      var p = strike.pulses[i], d = e - p.at;
      if (d < 0 || d > p.dur) continue;
      v = Math.max(v, p.peak * Math.sin((d / p.dur) * Math.PI));
    }
    return v;
  }

  var AmbientStorm = {
    _lastFlash: -1e9,
    _nextFlash: 2200 + Math.random() * 2600,
    _strike: null,

    // ctx/w/h: canvas + its device-pixel size. opts: { x, y (0..1 of
    // w/h, cell center), scale (0..1 of min(w,h)), alpha }.
    draw: function (ctx, w, h, opts) {
      if (!w || !h) return;
      opts = opts || {};
      var alpha = opts.alpha != null ? opts.alpha : 1;
      var t = performance.now();
      var cx = w * (opts.x != null ? opts.x : 0.86);
      var cy = h * (opts.y != null ? opts.y : 0.16);
      var scale = Math.min(w, h) * (opts.scale != null ? opts.scale : 0.32);

      if (t - this._lastFlash > this._nextFlash) {
        this._lastFlash = t;
        this._nextFlash = 2200 + Math.random() * 2600;
        this._strike = buildStrike(rng((t | 0) + 7));
      }
      var flash = this._strike ? strikeIntensity(this._strike, t - this._lastFlash) : 0;
      var pulse = globalSurge(t);
      var es = scale * pulse; // effective scale: the whole cell's cinematic breath

      ctx.save();
      ctx.globalAlpha = alpha;

      // A dim, wide under-glow first — the sky up here (near the top of
      // .story-atmosphere's gradient) is close to black, so without a
      // brighter base light the billows below would blend straight into
      // it instead of reading as a lit storm cell.
      blob(ctx, cx, cy, es * 1.6, es * 0.95, [
        [0, "rgba(163, 83, 171, " + (0.22 + flash * 0.25).toFixed(3) + ")"], [1, "rgba(83, 34, 91, 0)"]
      ]);

      for (var i = 0; i < CELLS.length; i++) {
        var c = CELLS[i], sh = cellShape(t, c);
        var bx = cx + (c.ux + sh.dx) * es, by = cy + (c.uy + sh.dy) * es * 0.6;
        var rx = c.rx * es * sh.breathe, ry = c.ry * es * sh.breathe;
        var a = Math.min(0.92, c.baseA + flash * 0.35);
        var rgb = c.rgb;
        blob(ctx, bx, by, rx, ry, [
          [0, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a.toFixed(3) + ")"],
          [1, "rgba(" + Math.round(rgb[0] * 0.5) + "," + Math.round(rgb[1] * 0.5) + "," + Math.round(rgb[2] * 0.5) + ",0)"]
        ]);
      }
      // A denser, darker core so it reads as weather, not just a glow.
      blob(ctx, cx, cy + es * 0.06, es * 0.42, es * 0.24, [
        [0, "rgba(30, 11, 35, 0.55)"], [1, "rgba(30, 11, 35, 0)"]
      ]);

      // Lightning: lit through the planet's own dust rather than clean
      // air — violet throughout, never bright white, so even the
      // hottest instant still reads as this atmosphere, not a studio
      // flash bulb.
      if (flash > 0.02) {
        blob(ctx, cx, cy - es * 0.05, es * 0.95, es * 0.5, [
          [0, "rgba(227, 176, 215, " + (0.6 * flash).toFixed(3) + ")"],
          [0.4, "rgba(188, 113, 193, " + (0.35 * flash).toFixed(3) + ")"],
          [1, "rgba(155, 83, 168, 0)"]
        ]);
        if (flash > 0.6 && this._strike) {
          var k = (flash - 0.6) * 2.4;
          ctx.save();
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          // Every stroke gets a soft additive glow pass first, then a
          // thin bright core on top — a bolt reads as light, not a
          // drawn line. Real lightning is genuinely white-hot at the
          // core (reference photos confirm it, even lighting an orange
          // Mars sky) — the violet lives in the glow around it,
          // which is what ties it back into the cell's purple tint.
          var strokePath = function (pts, coreW, glowW, coreA, glowA) {
            ctx.beginPath();
            ctx.moveTo(cx + pts[0][0] * es, cy + pts[0][1] * es);
            for (var pi = 1; pi < pts.length; pi++) ctx.lineTo(cx + pts[pi][0] * es, cy + pts[pi][1] * es);
            ctx.globalCompositeOperation = "lighter";
            ctx.strokeStyle = "rgba(211, 149, 211, " + (glowA * k).toFixed(3) + ")";
            ctx.lineWidth = glowW;
            ctx.stroke();
            ctx.strokeStyle = "rgba(250, 244, 251, " + (coreA * k).toFixed(3) + ")";
            ctx.lineWidth = coreW;
            ctx.stroke();
          };
          strokePath(this._strike.bolt.path, Math.max(1, es * 0.006), Math.max(4, es * 0.032), alpha * 0.85, alpha * 0.5);
          for (var bi = 0; bi < this._strike.bolt.branches.length; bi++) {
            strokePath(this._strike.bolt.branches[bi], Math.max(0.7, es * 0.004), Math.max(3, es * 0.022), alpha * 0.55, alpha * 0.35);
          }
          ctx.restore();
        }
      }

      ctx.restore();
    }
  };

  global.AmbientStorm = AmbientStorm;
})(window);
