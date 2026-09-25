/* ============================================================
   Worx | landing-fx.js
   "Sol 1, First Light": the About storybook's opening shot.
   Owns the landing's clock, a virtual camera, where (and how big)
   the ship frame is drawn, and every effect the frames can't carry.

   THE SHOT
     0.0s  ENTRY       A fireball tears across the far sky from the
                       upper right: plasma head, glowing wake that
                       cools into a lingering smoke trail.
     6.3s  STORM SKY  Kicked up by the jets as they near the ground (the
                       sky before that is the same clear night sky as every
                       other chapter). A planetary storm seen from the surface:
                       a cloud ceiling in true perspective (big, fast
                       billows overhead; small, flat, slow ones converging
                       on the horizon) rolling in toward the camera, and a
                       towering storm wall churning along the horizon.
                       Once risen it stays, always orange, never still:
                       every billow slowly swells and shrinks as it drifts.
                       Faint lightning pulses deep inside the wall.
     2.6s  SEPARATION  A flash lights the storm clouds from within, pyro
                       bolts fire and ablator embers shed as the real
                       aeroshell photo (glimpse-landing-00.png) peels
                       away, tumbling, rim glowing hot, cooling as it
                       falls behind and to the side, out of frame, then
                       impacting the ground in the middle distance in a
                       flash + dust plume + kicked-up embers. The ship
                       emerges still hot, engines igniting. Set
                       CLEAN_SEPARATION = true for the flash alone, no
                       shield/debris.
     2.6s  GLIDE       Powered descent down a straight glide slope
                       toward the camera, braking so it looms without
                       lunging; braking lean, attitude wobble, exhaust
                       trail, beacon, engine bloom + anamorphic flare,
                       live exhaust (flicker, shock diamonds, flowing
                       burning gas) over the baked flames.
     6.8s  FINAL       Hover over the foreground pad, vertical descent;
                       the jets hit the ground and splash.
     8.7s  TOUCHDOWN   Camera shake, warm flash, dust shockwave ring,
                       rocks thrown in arcs, and a dust wall that rolls
                       out past both edges of the frame (big impact).
    10.2s  SETTLE      Dust burst plays out (frames 24-32), then clears
                       (dissolve into frame 33): the ship is revealed
                       standing on its legs, pads in contact shadow,
                       dust wisps drifting across the feet, beacon on.
   Throughout, the camera (CSS transform on the terrain + landing
   canvases) tilts down to follow the ship, pans with it, pushes in
   slowly and drifts like a handheld rig. Every frame reports the
   ship's on-screen position + telemetry (opts.onFrame) so the HUD can
   track it, see about-story.js.

   THE FRAMES (static/assets/about/glimpse_landing_frames_001-032)
   001-032: 2560x1440, ship centered, same size in every frame, only
   translating down (SHIP_TOPS, measured from the alpha channel);
   touchdown at 024. Flames, glow, dust and debris are baked in.
   033: 1800x1500, landed, dust settling, legs visible (F33). It is
   drawn with a slight roll correction (baked once on load) so both
   foot pads sit on one ground line, and scaled so its hull matches.

   DEPTH
   Pinhole camera: distance z (1 = foreground pad), altitude h, lateral
   X project to  scale = 1/z,  y = horizon + (ground - horizon - h)/z,
   x = center + X/z  (--story-ground-y / --story-horizon-y, about.css).
   ============================================================ */

(function (global) {
  "use strict";

  var FRAME_W = 2560;
  var FRAME_H = 1440;
  var SHIP_TOPS = [
    24, 50, 78, 104, 130, 156, 182, 208, 236, 262, 288, 314,
    340, 368, 394, 420, 446, 472, 498, 520, 538, 552, 560, 564,
    564, 564, 564, 564, 564, 564, 564, 564
  ];
  var SHIP_HEIGHT = 834;            // antenna tip -> foot pads (frame px)
  var HULL_PX = 1420;               // hull width in 001-032 (frame px)
  var SHIP_W = HULL_PX / FRAME_W;   // hull width, fraction of frame width
  var SPIRE = [1167, 3];            // beacon on the tall spire: x, y below the ship top (001-032)
  var TOUCHDOWN = 23;               // 0-based index of frame 024
  var LAST_SEQ = 31;                // frame 032
  var FINAL_IDX = 32;               // frame 033
  var NOZZLES = [-0.1824, 0.1458];  // nozzle x, fraction of hull width from center (measured: x 1021 / 1487)
  var NOZZLE_UP = 179;              // nozzle exit sits this far above the feet (frame px)
  // Baked flame length below the nozzle exit per frame (frame px),
  // measured from the white-hot pixels of each PNG. 001-008: nozzle glow
  // only; the burn starts at 009, peaks at 015, is squashed by the ground
  // from 020, gutters out at 027. The live fire is fitted to this so it
  // sits exactly on (and animates) the painted flames.
  var FLAME_LEN = [
    0, 0, 0, 0, 0, 0, 0, 0,
    70, 106, 128, 162, 200, 243, 258, 220, 231, 216, 197, 240,
    222, 209, 202, 199, 203, 172, 100, 0, 0, 0, 0, 0
  ];
  var FLAME_W = 150;                // baked plume width at its widest (frame px)

  // Frame 033 (landed). Measured from the PNG: hull 120..1690, pads
  // bottoming out at (270,1398) and (1530,1438) -> rolled by `roll`
  // about the pad midpoint so both touch y = feet.
  var F33 = {
    w: 1800, h: 1500, cx: 905, feet: 1419, hull: 1570,
    roll: -Math.atan2(1438 - 1398, 1530 - 270), pivot: [900, 1419],
    pads: [270, 1530], spire: [782, 516],
    // Hull logo square (after the roll bake) and its size relative to
    // 032's: 033 was shot a touch closer, so logo and feet can't both
    // match 032. 033 stays locked to 032's position (logo-aligned, no
    // movement at all through the dissolve); the few px its pads then
    // sit above the descent's terrain line just stand a little further
    // back on the (continuous) terrain photo, see _drawPadContact.
    logo: [852, 903.3], scale: 1.14, padW: [260, 280]
  };
  var SEQ_LOGO = [-31, -486.5];      // 001-032 logo square, relative to (hull center, feet)

  // Frame 034 (Section 2 only, about-story.js): same ship, hatch + ramp
  // open, crew on the ramp. Its own art (levelled by 4.7° from the
  // source so all three pads share one ground line), sized via `scale`
  // relative to F33 so the hull reads at the same on-screen width.
  var F34 = {
    w: 1432, h: 1153, cx: 730, feet: 1055, roll: 0, pivot: [730, 1055],
    // three legs (left, centre, right), pads seated in the soil at y = feet;
    // the ramp lip and the captain's front boot touch down on that same line
    pads: [196, 723, 1231], spire: [572, 112],
    scale: 0.99, padW: [251, 225, 262], // hull reads the same on-screen width as frame 033 in Section 1
    hatch: [1038, 716] // the open doorway, for the HUD leader line target
  };

  // Flight path (world units: fractions of viewport height at z = 1).
  var Z_FAR = 26;
  var START_SCREEN_Y = 0.2;
  var START_X = 0.27;
  var HOVER_ALT = 0.2;
  var LOW_ALT = 0.3;
  var MAX_TILT = 6 * Math.PI / 180;

  // Timeline (ms).
  var ENTRY_MS = 2600;
  var GLIDE_MS = 4200;
  var FINAL_MS = 1900;
  var SETTLE_MS = 2300;
  var CLEAR_MS = 2600;              // dust clears: 032 -> 033 (runs in the idle phase)
  var SEP = ENTRY_MS;
  var HOVER = SEP + GLIDE_MS;
  var TOUCH = HOVER + FINAL_MS;
  var DURATION_MS = TOUCH + SETTLE_MS;

  var SHIELD_FALL_MS = 2400;
  var CLEAN_SEPARATION = false;     // true: no falling heat shield / debris at separation
  var TRAIL_LIFE_MS = 1800;
  var WAKE_LIFE_MS = 900;
  var SMOKE_LIFE_MS = 5200;

  var DUST_COLORS = ["#5c210d", "#7a2f13", "#c04527", "#e57d23", "#d99a5c"];
  var ROCK_COLORS = ["#2a130a", "#3b1b0d", "#4d2410", "#1d0d06"];

  // The real aeroshell photo, tumbling away at separation (_drawShield).
  // Falls back to the old procedural dish (further down) if it hasn't
  // decoded yet, separation never waits on it and never flashes a
  // broken image.
  var SHIELD_IMG_SRC = "../static/assets/about/glimpse_landing_frames_001-032/glimpse-landing-00.png";
  var shieldImg = new Image();
  var shieldImgReady = false;
  var shieldImgAspect = 1.55;
  shieldImg.onload = function () {
    shieldImgReady = true;
    shieldImgAspect = shieldImg.naturalWidth / shieldImg.naturalHeight;
  };
  shieldImg.src = SHIELD_IMG_SRC;

  // Frame 034, Section 2's ship, hatch open. Falls back to frame 033
  // (via the sequence, already loaded) if it hasn't decoded yet.
  var F34_IMG_SRC = "../static/assets/about/glimpse-landing-034-level.png";
  var f34Img = new Image();
  var f34ImgReady = false;
  f34Img.onload = function () { f34ImgReady = true; };
  f34Img.src = F34_IMG_SRC;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutPow(t, p) { return 1 - Math.pow(1 - t, p); }
  function easeInOutSine(t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function hexA(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + "," + Math.max(0, Math.min(1, a)).toFixed(3) + ")";
  }
  function rgba(r, g, b, a) {
    return "rgba(" + Math.round(r) + "," + Math.round(g) + "," + Math.round(b) + "," + Math.max(0, Math.min(1, a)).toFixed(3) + ")";
  }
  // Blackbody-ish cooling ramp: 1 = white-hot, 0 = cold dark.
  function heatColor(t, a) {
    t = clamp01(t);
    if (t > 0.66) return rgba(255, lerp(214, 250, (t - 0.66) / 0.34), lerp(140, 230, (t - 0.66) / 0.34), a);
    if (t > 0.33) return rgba(255, lerp(110, 214, (t - 0.33) / 0.33), lerp(30, 140, (t - 0.33) / 0.33), a);
    return rgba(lerp(40, 255, t / 0.33), lerp(18, 110, t / 0.33), lerp(10, 30, t / 0.33), a);
  }
  function wobble(t, amp) {
    return amp * (Math.sin(t * 0.0023) * 0.6 + Math.sin(t * 0.0051 + 1.3) * 0.4);
  }
  function noise(t, seed) {
    return Math.sin(t * 0.071 + seed) * 0.5 + Math.sin(t * 0.113 + seed * 2.1) * 0.3 + Math.sin(t * 0.191 + seed * 3.7) * 0.2;
  }
  function rotAbout(x, y, px, py, a) {
    var c = Math.cos(a), s = Math.sin(a), dx = x - px, dy = y - py;
    return [px + dx * c - dy * s, py + dx * s + dy * c];
  }
  var F33_SPIRE = rotAbout(F33.spire[0], F33.spire[1], F33.pivot[0], F33.pivot[1], F33.roll);
  var F34_SPIRE = rotAbout(F34.spire[0], F34.spire[1], F34.pivot[0], F34.pivot[1], F34.roll);

  // Flight state at elapsed ms. G = ground - horizon, horizon = y fraction.
  function stateAt(e, G, horizon) {
    var h0 = G + (horizon - START_SCREEN_Y) * Z_FAR;
    var X0 = START_X * Z_FAR;
    if (e < SEP) {
      return { phase: "entry", v: 8.5, z: Z_FAR, h: h0, X: X0, tilt: MAX_TILT, h0: h0 };
    }
    if (e < HOVER) {
      var u = easeOutPow((e - SEP) / GLIDE_MS, 1.9);
      return {
        phase: "glide", u: u, h0: h0,
        v: lerp(8.5, 18, u),
        z: 1 + (Z_FAR - 1) * (1 - u),
        h: HOVER_ALT + (h0 - HOVER_ALT) * (1 - u),
        X: X0 * (1 - u),
        tilt: MAX_TILT * Math.pow(1 - u, 0.6) + wobble(e, 0.006)
      };
    }
    if (e < TOUCH) {
      var f = easeInOutSine((e - HOVER) / FINAL_MS);
      return { phase: "final", f: f, h0: h0, v: lerp(18, TOUCHDOWN, f), z: 1, h: HOVER_ALT * (1 - f), X: 0, tilt: wobble(e, 0.006) * (1 - f) };
    }
    if (e <= DURATION_MS) {
      return { phase: "landed", h0: h0, v: lerp(TOUCHDOWN, LAST_SEQ, easeOutPow(clamp01((e - TOUCH) / SETTLE_MS), 1.6)), z: 1, h: 0, X: 0, tilt: 0 };
    }
    // Dust clears: dissolve 032 -> 033, then hold 033.
    var c = clamp01((e - DURATION_MS) / CLEAR_MS);
    return { phase: "landed", h0: h0, v: LAST_SEQ + easeInOutSine(c), z: 1, h: 0, X: 0, tilt: 0, clear: c };
  }

  function flameLenAt(v) {
    var c = Math.max(0, Math.min(LAST_SEQ, v));
    var i = Math.floor(c), j = Math.min(LAST_SEQ, i + 1);
    return lerp(FLAME_LEN[i], FLAME_LEN[j], c - i);
  }

  function engineAt(frameNum) {
    if (frameNum < 9) return 0;
    if (frameNum < 13) return easeOutCubic((frameNum - 9) / 4);
    if (frameNum < 24.5) return 1;
    if (frameNum < 27) return 1 - (frameNum - 24.5) / 2.5;
    return 0;
  }

  function dustSpawnRate(frameNum) {
    if (frameNum < 19) return 0;
    if (frameNum < 24) return lerp(0.5, 4, (frameNum - 19) / 5);
    if (frameNum < 25) return 16;
    if (frameNum < 28) return 2.5;
    return 0;
  }

  function fillSoftEllipse(ctx, cx, cy, rx, ry, stops, compositeOp) {
    ctx.save();
    if (compositeOp) ctx.globalCompositeOperation = compositeOp;
    ctx.translate(cx, cy);
    ctx.scale(rx, ry);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Anamorphic lens flare: long thin horizontal streak, warm core, cool fringe.
  function drawStreak(ctx, x, y, len, thick, a) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    var g = ctx.createLinearGradient(x - len, 0, x + len, 0);
    g.addColorStop(0, "rgba(120,190,255,0)");
    g.addColorStop(0.35, rgba(140, 190, 255, a * 0.12));
    g.addColorStop(0.5, rgba(255, 228, 190, a));
    g.addColorStop(0.65, rgba(140, 190, 255, a * 0.12));
    g.addColorStop(1, "rgba(120,190,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - len, y - thick * 3, len * 2, thick * 6);
    ctx.globalAlpha = 0.9;
    var c = ctx.createLinearGradient(x - len * 0.6, 0, x + len * 0.6, 0);
    c.addColorStop(0, "rgba(255,240,220,0)");
    c.addColorStop(0.5, rgba(255, 246, 232, a));
    c.addColorStop(1, "rgba(255,240,220,0)");
    ctx.fillStyle = c;
    ctx.fillRect(x - len * 0.6, y - thick * 0.5, len * 1.2, thick);
    ctx.restore();
  }

  function LandingFX(backCanvas, frontCanvas, opts) {
    opts = opts || {};
    this.backCanvas = backCanvas;
    this.frontCanvas = frontCanvas;
    this.backCtx = backCanvas.getContext("2d");
    this.frontCtx = frontCanvas.getContext("2d");
    this.sequence = opts.sequence || null;
    this.cameraEls = opts.camera || [];
    this.cameraOriginY = opts.cameraOriginY != null ? opts.cameraOriginY : 0.62;
    this.flashEl = opts.flash || null;
    this.onFrame = opts.onFrame || null;
    this.reduceMotion = !!opts.reduceMotion;
    this.dpr = Math.min(global.devicePixelRatio || 1, 2);
    this.groundY = 0.82;
    this.horizonY = 0.4;
    this.scale = 0.9;
    this._finalReady = false;
    this._clear();
    this._idleRAF = 0;
    this._poseFrom = this._poseTo = { dx: 0, yaw: 0 };
    this._poseT0 = 0; this._poseDur = 0;
  }

  /* ---------------------------------------------------------------
     POSE, a new camera angle on the landed ship (Section 2 uses it to
     put frame 033 on the left third, turned to face right). A 2D frame
     can't truly rotate, so the turn is an affine approximation around
     the ship's ground point: horizontal foreshortening (cos yaw) plus a
     slight vertical skew so the receding side sits a touch higher.
     Changes are a soft dissolve ("cut" to the new angle), never a slide:
     the ship is landed, it doesn't move, the camera does.
     pose = { dx: shift as a fraction of the frame width, yaw: degrees }
     --------------------------------------------------------------- */
  // fadeInOnly: skip the old angle entirely, the ship simply fades in at
  // the new one (no moment where both framings are visible).
  LandingFX.prototype.setPose = function (pose, dissolveMs, fadeInOnly) {
    var now = performance.now();
    this._poseFadeIn = !!fadeInOnly;
    this._poseFrom = this._poseState(now).pose;
    this._poseTo = { dx: pose.dx || 0, yaw: pose.yaw || 0 };
    this._poseT0 = now;
    this._poseDur = dissolveMs || 0;
  };

  LandingFX.prototype._poseState = function (now) {
    var p = this._poseDur ? clamp01((now - this._poseT0) / this._poseDur) : 1;
    if (p >= 1) return { pose: this._poseTo, alpha: 1 };
    if (this._poseFadeIn) return { pose: this._poseTo, alpha: p * p * (3 - 2 * p) };
    return p < 0.5 ? { pose: this._poseFrom, alpha: 1 - p * 2 } : { pose: this._poseTo, alpha: p * 2 - 1 };
  };

  // [a, b, c, d, e, f] for the current pose around the ship's ground point, or null.
  LandingFX.prototype._poseMatrix = function (L, pose) {
    if (!pose || (!pose.dx && !pose.yaw)) return null;
    var yaw = pose.yaw * Math.PI / 180;
    var sx = Math.cos(yaw), ky = -Math.sin(yaw) * 0.12;
    var gx = L.shipCX, dx = pose.dx * this.backCanvas.width;
    return [sx, ky, 0, 1, gx + dx - sx * gx, -ky * gx];
  };

  function applyM(m, x, y) { return m ? { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] } : { x: x, y: y }; }

  // Screen (CSS px) position of a point on the landed ship, given in
  // frame-033 pixels, follows the pose and the camera. For HUD markers.
  // still: px/py are frame-034 px (Section 2's own ship art). Otherwise:
  // frame-033 px, as the rest of the landing sequence always was.
  LandingFX.prototype.shipPoint = function (px, py) {
    var L = this._layout({ z: 1, h: 0, X: 0, tilt: 0, clear: 1, v: FINAL_IDX });
    if (this.still) {
      var w = this._warpPoint34(L, this._poseState(performance.now()).pose, px, py);
      return this._toScreen(w.x, w.y);
    }
    var r = L.rectFor(FINAL_IDX);
    var q = applyM(this._poseMatrix(L, this._poseState(performance.now()).pose), r.x + px * L.k33, r.y + py * L.k33);
    return this._toScreen(q.x, q.y);
  };

  LandingFX.DURATION_MS = DURATION_MS;
  LandingFX.MARKS = { separation: SEP, hover: HOVER, touchdown: TOUCH, landed: DURATION_MS, clear: DURATION_MS + CLEAR_MS };

  LandingFX.prototype._clear = function () {
    this.particles = [];
    this.trail = [];
    this.wake = [];
    this.smoke = [];
    this.sparks = [];
    this.puffs = [];
    this.plumes = [];
    this.rocks = [];
    this.shield = null;
    this._sepDone = false;
    this._rocksSpawned = false;
    this._lastTs = null;
    this._lastElapsed = null;
    this._camX = null;
    this._cam = null;
  };

  LandingFX.prototype.resize = function () {
    var box = this.backCanvas.getBoundingClientRect();
    this._cssW = box.width; this._cssH = box.height;
    var w = Math.max(1, Math.round(box.width * this.dpr));
    var h = Math.max(1, Math.round(box.height * this.dpr));
    this.backCanvas.width = w; this.backCanvas.height = h;
    this.frontCanvas.width = w; this.frontCanvas.height = h;
    var cs = getComputedStyle(this.backCanvas);
    var g = parseFloat(cs.getPropertyValue("--story-ground-y"));
    if (!isNaN(g)) this.groundY = Math.min(0.96, Math.max(0.5, g));
    var hz = parseFloat(cs.getPropertyValue("--story-horizon-y"));
    if (!isNaN(hz)) this.horizonY = Math.min(this.groundY - 0.1, Math.max(0.1, hz));
    var s = parseFloat(cs.getPropertyValue("--landing-scale"));
    if (!isNaN(s)) this.scale = Math.min(1.8, Math.max(0.3, s));
    if (this.sequence) this.sequence.resize();
    if (this.ascent) { this._renderAscent(this._lastAscent || 0, 0); return; }
    if (this._lastElapsed != null) this._render(this._lastElapsed, 0);
  };

  LandingFX.prototype.reset = function () {
    cancelAnimationFrame(this._idleRAF);
    this._idleRAF = 0;
    this.still = false;
    this.ascent = null;
    this._clear();
    this.backCtx.clearRect(0, 0, this.backCanvas.width, this.backCanvas.height);
    this.frontCtx.clearRect(0, 0, this.frontCanvas.width, this.frontCanvas.height);
    if (this.sequence) this.sequence.ctx.clearRect(0, 0, this.sequence.canvas.width, this.sequence.canvas.height);
    for (var i = 0; i < this.cameraEls.length; i++) this.cameraEls[i].style.transform = "";
    if (this.flashEl) this.flashEl.style.opacity = "0";
    this._poseFrom = this._poseTo = { dx: 0, yaw: 0 };
    this._poseDur = 0;
  };

  // Frame 033 roll correction + edge feathering, baked once into an
  // offscreen canvas that replaces the image in the sequence.
  LandingFX.prototype._prepareFinal = function () {
    var seq = this.sequence;
    if (this._finalReady || !seq || !seq.loaded[FINAL_IDX]) return this._finalReady;
    var img = seq.images[FINAL_IDX];
    var c = document.createElement("canvas");
    c.width = F33.w; c.height = F33.h;
    var x = c.getContext("2d");
    x.translate(F33.pivot[0], F33.pivot[1]);
    x.rotate(F33.roll);
    x.translate(-F33.pivot[0], -F33.pivot[1]);
    // 033 comes in slightly hazier than 001-032: lift contrast to match.
    x.filter = "contrast(1.12) saturate(1.06) brightness(1.02)";
    x.drawImage(img, 0, 0, F33.w, F33.h);
    x.filter = "none";
    x.setTransform(1, 0, 0, 1, 0, 0);
    // The PNG carries a near-invisible tint (alpha ~4) over its whole
    // canvas, which reads as a faint box once composited over the scene.
    // Drop it: pixels under a small alpha threshold become fully clear,
    // with a short ramp above it so real soft edges stay soft.
    try {
      var id = x.getImageData(0, 0, F33.w, F33.h), px = id.data;
      // Its thin baked haze also runs to the canvas' side edges; fade
      // just the thin stuff out toward the sides (dense dust and the
      // solid ship/pads keep full strength) so no vertical edge remains.
      for (var i = 3; i < px.length; i += 4) {
        var al = px[i];
        if (al < 14) { px[i] = 0; continue; }
        if (al < 40) al = Math.round((al - 14) * 40 / 26);
        var xx = ((i - 3) / 4) % F33.w;
        var side = clamp01((860 - Math.abs(xx - F33.cx)) / 300);
        side = side * side * (3 - 2 * side);
        var dense = clamp01((al - 70) / 110);
        px[i] = Math.round(al * (side + (1 - side) * dense));
      }
      x.putImageData(id, 0, 0);
    } catch (err) { /* tainted canvas (file://): keep the tint rather than fail */ }
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = "destination-out";
    // Eased (not linear) feathers so no edge of the PNG can read as a line;
    // the persistent ground haze carries the dust on past them.
    function feather(x0, y0, x1, y1, rx, ry, rw, rh) {
      var fg = x.createLinearGradient(x0, y0, x1, y1);
      fg.addColorStop(0, "rgba(0,0,0,1)");
      fg.addColorStop(0.3, "rgba(0,0,0,0.78)");
      fg.addColorStop(0.65, "rgba(0,0,0,0.3)");
      fg.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = fg; x.fillRect(rx, ry, rw, rh);
    }
    feather(0, 0, 150, 0, 0, 0, 150, F33.h);
    feather(F33.w, 0, F33.w - 150, 0, F33.w - 150, 0, 150, F33.h);
    feather(0, 1476, 0, 1421, 0, 1421, F33.w, F33.h - 1421);
    seq.images[FINAL_IDX] = c;

    // 032 feathered once, too (eased sides + bottom), so the 032 -> 033
    // dissolve needs no on-the-fly feathering that would also eat into
    // 033's foot pads.
    if (seq.loaded[LAST_SEQ] && !(seq.images[LAST_SEQ] instanceof HTMLCanvasElement)) {
      var c2 = document.createElement("canvas");
      c2.width = FRAME_W; c2.height = FRAME_H;
      var y = c2.getContext("2d");
      y.drawImage(seq.images[LAST_SEQ], 0, 0);
      y.globalCompositeOperation = "destination-out";
      var fw = FRAME_W * 0.16, fb = FRAME_H * 0.14;
      [[0, 0, fw, 0, 0, 0, fw, FRAME_H], [FRAME_W, 0, FRAME_W - fw, 0, FRAME_W - fw, 0, fw, FRAME_H],
       [0, FRAME_H, 0, FRAME_H - fb, 0, FRAME_H - fb, FRAME_W, fb]].forEach(function (q) {
        var g2 = y.createLinearGradient(q[0], q[1], q[2], q[3]);
        g2.addColorStop(0, "rgba(0,0,0,1)");
        g2.addColorStop(0.3, "rgba(0,0,0,0.78)");
        g2.addColorStop(0.65, "rgba(0,0,0,0.3)");
        g2.addColorStop(1, "rgba(0,0,0,0)");
        y.fillStyle = g2; y.fillRect(q[4], q[5], q[6], q[7]);
      });
      seq.images[LAST_SEQ] = c2;
    }
    this._finalReady = true;
    return true;
  };

  // Screen layout for flight state st (canvas px).
  LandingFX.prototype._layout = function (st) {
    var cw = this.backCanvas.width, ch = this.backCanvas.height;
    var aspect = FRAME_W / FRAME_H;
    var w1, h1;
    if (cw / ch > aspect) { h1 = ch; w1 = h1 * aspect; } else { w1 = cw; h1 = w1 / aspect; }
    w1 *= this.scale; h1 *= this.scale;
    var inv = 1 / st.z;
    var s = (h1 / FRAME_H) * inv;
    var k33 = s / F33.scale;
    var horizonPx = ch * this.horizonY;
    var G = (this.groundY - this.horizonY) * ch;
    var feetY = horizonPx + (G - st.h * ch) * inv;
    var cx = cw * (0.5 + st.X * inv);
    return {
      s: s, k33: k33, feetY: feetY,
      nozzleY: feetY - NOZZLE_UP * s,
      pivotY: feetY - (SHIP_HEIGHT * 0.45) * s,
      tilt: st.tilt || 0,
      groundPx: horizonPx + G * inv,
      shipCX: cx,
      shipW: SHIP_W * w1 * inv,
      rectFor: function (k) {
        if (k === FINAL_IDX) {
          return {
            x: cx + SEQ_LOGO[0] * s - F33.logo[0] * k33,
            y: feetY + SEQ_LOGO[1] * s - F33.logo[1] * k33,
            w: F33.w * k33, h: F33.h * k33
          };
        }
        return { x: cx - (FRAME_W / 2) * s, y: feetY - (SHIP_TOPS[k] + SHIP_HEIGHT) * s, w: FRAME_W * s, h: FRAME_H * s };
      }
    };
  };

  // World point -> canvas px (unit = hull width at that distance).
  LandingFX.prototype._project = function (z, h, X) {
    var cw = this.backCanvas.width, ch = this.backCanvas.height;
    var aspect = FRAME_W / FRAME_H;
    var w1 = (cw / ch > aspect ? ch * aspect : cw) * this.scale;
    var G = (this.groundY - this.horizonY) * ch;
    return {
      x: cw * (0.5 + X / z),
      y: ch * this.horizonY + (G - h * ch) / z,
      ground: ch * this.horizonY + G / z,
      unit: SHIP_W * w1 / z
    };
  };

  /* ---------------------------------------------------------------
     ENTRY: fireball, plasma wake, smoke trail
     --------------------------------------------------------------- */
  LandingFX.prototype._entryPoint = function (e) {
    var cw = this.backCanvas.width, ch = this.backCanvas.height;
    var end = this._layout(stateAt(SEP, this.groundY - this.horizonY, this.horizonY));
    var x1 = end.shipCX, y1 = end.nozzleY;
    // Enters just past the right edge, clear of the nav bar, on a
    // shallow entry angle that bows down as gravity takes over.
    var x0 = cw * 1.06, y0 = ch * 0.1;
    var cx = lerp(x0, x1, 0.5), cy = y0 - ch * 0.02;
    var t = easeOutPow(clamp01(e / SEP), 1.35);
    var it = 1 - t;
    return {
      x: it * it * x0 + 2 * it * t * cx + t * t * x1,
      y: it * it * y0 + 2 * it * t * cy + t * t * y1,
      r: end.shipW * lerp(0.22, 0.3, t),
      t: t
    };
  };

  LandingFX.prototype._updateEntry = function (e) {
    if (e < SEP) {
      var hd = this._entryPoint(e);
      var last = this.wake[this.wake.length - 1];
      if (!last || e - last.t >= 16) {
        this.wake.push({ x: hd.x, y: hd.y, t: e, r: hd.r });
        this.smoke.push({ x: hd.x, y: hd.y, t: e, r: hd.r * 0.9, seed: Math.random() * 10 });
      }
    }
    while (this.wake.length && e - this.wake[0].t > WAKE_LIFE_MS) this.wake.shift();
    while (this.smoke.length && e - this.smoke[0].t > SMOKE_LIFE_MS) this.smoke.shift();
  };

  LandingFX.prototype._drawSmoke = function (ctx, e) {
    for (var i = 0; i < this.smoke.length; i++) {
      var d = this.smoke[i];
      var age = (e - d.t) / SMOKE_LIFE_MS;
      if (age < 0.03) continue;
      var r = d.r * (1 + age * 5);
      var a = (d.a || 0.16) * Math.pow(1 - age, 1.6) * clamp01(age / 0.08);
      var x = d.x - age * d.r * 6 + noise(e * 0.02, d.seed) * d.r * age * 2;
      var y = d.y + age * d.r * 2.5;
      fillSoftEllipse(ctx, x, y, r, r * 0.7, [
        [0, rgba(lerp(250, 190, age), lerp(190, 150, age), lerp(150, 135, age), a)],
        [1, "rgba(170,130,120,0)"]
      ]);
    }
  };

  LandingFX.prototype._drawEntryHead = function (ctx, e) {
    if (e >= SEP) return;
    var hd = this._entryPoint(e);
    var fl = 0.85 + 0.15 * noise(e, 3);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (var i = 1; i < this.wake.length; i++) {
      var a0 = this.wake[i - 1], a1 = this.wake[i];
      var age = (e - a1.t) / WAKE_LIFE_MS;
      if (age >= 1) continue;
      var k = 1 - age;
      ctx.strokeStyle = rgba(255, lerp(90, 170, k), lerp(30, 70, k), 0.35 * k * k);
      ctx.lineWidth = a1.r * 2.2 * k;
      ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke();
      if (age < 0.35) {
        ctx.strokeStyle = rgba(255, 236, 200, 0.7 * (1 - age / 0.35));
        ctx.lineWidth = a1.r * 0.6 * k;
        ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke();
      }
    }
    ctx.restore();
    var prev = this._entryPoint(Math.max(0, e - 30));
    var ang = Math.atan2(hd.y - prev.y, hd.x - prev.x);
    fillSoftEllipse(ctx, hd.x, hd.y, hd.r * 7 * fl, hd.r * 7 * fl, [
      [0, "rgba(255,150,70,0.28)"], [0.4, "rgba(229,90,35,0.1)"], [1, "rgba(192,69,39,0)"]
    ], "lighter");
    ctx.save();
    ctx.translate(hd.x, hd.y);
    ctx.rotate(ang);
    fillSoftEllipse(ctx, -hd.r * 0.9, 0, hd.r * 2.6, hd.r * 1.1, [
      [0, "rgba(255,210,140,0.75)"], [0.6, "rgba(255,120,50,0.25)"], [1, "rgba(255,90,40,0)"]
    ], "lighter");
    ctx.restore();
    fillSoftEllipse(ctx, hd.x, hd.y, hd.r * 1.1, hd.r * 1.1, [
      [0, "rgba(255,255,248,1)"], [0.5, "rgba(255,236,200,0.8)"], [1, "rgba(255,200,140,0)"]
    ], "lighter");
    drawStreak(ctx, hd.x, hd.y, this.backCanvas.width * 0.32, Math.max(1.5 * this.dpr, hd.r * 0.16), 0.55 * fl);
  };

  /* ---------------------------------------------------------------
     SEPARATION: flash, pyro puffs, sparks, the heat shield itself
     --------------------------------------------------------------- */
  LandingFX.prototype._separate = function (e) {
    if (e < SEP || this._sepDone) return;
    this._sepDone = true;
    var st = stateAt(SEP, this.groundY - this.horizonY, this.horizonY);
    var L = this._layout(st);
    // Kept clean: separation reads as the flash alone, no shield body,
    // embers, pyro puffs or impact plume (spawners below are disabled).
    if (CLEAN_SEPARATION) return;
    // Pyro bolts at the shield's attach points.
    for (var i = -1; i <= 1; i++) {
      this.puffs.push({ x: L.shipCX + i * 0.36 * L.shipW, y: L.nozzleY + L.shipW * 0.02, r: L.shipW * 0.05, t: e + Math.abs(i) * 40 });
    }
    // Ablator embers shed from the hot rim.
    for (var k = 0; k < 16; k++) {
      var a = rand(0, Math.PI * 2);
      var sp = L.shipW * rand(0.0003, 0.0012);
      this.sparks.push({
        x: L.shipCX + Math.cos(a) * L.shipW * 0.4, y: L.nozzleY + Math.sin(a) * L.shipW * 0.08,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 - L.shipW * 0.0002,
        g: L.shipW * 0.0000012, t: e, life: rand(800, 1600), size: Math.max(1, this.dpr * rand(0.8, 1.6))
      });
    }
    // The shield: world-space body on its own ballistic path.
    this.shield = { t0: e, h: st.h - 0.004 * Z_FAR, z: Z_FAR, X: START_X * Z_FAR, lastSmoke: e, impacted: false };
  };

  // Shield world state at elapsed e. It shares the ship's momentum at
  // separation (same glide path), lags slightly (no engines, more drag)
  // and drops away beneath it, accelerating, until it hits the ground
  // well clear of the frame, off to the side of the landing site, it
  // reads as background debris, never close enough to compete with the
  // ship for attention.
  LandingFX.prototype._shieldState = function (e) {
    var sh = this.shield;
    var t = e - sh.t0;
    var q = clamp01(t / SHIELD_FALL_MS);
    var ship = stateAt(e, this.groundY - this.horizonY, this.horizonY);
    return {
      t: t, q: q,
      z: ship.z * (1 + 0.6 * q),
      h: Math.max(0, ship.h - 0.03 * Z_FAR * 0.02) * (1 - Math.pow(q, 1.6)),
      X: ship.X * (1 + 0.6 * q) + START_X * Z_FAR * 0.6 * q,
      heat: Math.exp(-t / 1150),
      phi: 0.35 + t * 0.0019,                   // tumble about a horizontal axis
      roll: 0.18 + 0.22 * Math.sin(t * 0.0012)
    };
  };

  LandingFX.prototype._updateSeparation = function (e, dt) {
    var next = [];
    for (var i = 0; i < this.sparks.length; i++) {
      var s = this.sparks[i];
      if (e - s.t > s.life) continue;
      s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      next.push(s);
    }
    this.sparks = next;
    this.puffs = this.puffs.filter(function (p) { return e - p.t < 900; });
    this.plumes = this.plumes.filter(function (p) { return e - p.t < 3400; });

    var sh = this.shield;
    if (!sh || sh.impacted) return;
    var ss = this._shieldState(e);
    var p = this._project(ss.z, ss.h, ss.X);
    if (ss.heat > 0.12 && e - sh.lastSmoke >= 45) {
      sh.lastSmoke = e;
      this.smoke.push({ x: p.x, y: p.y, t: e, r: p.unit * 0.22, a: 0.12 * ss.heat + 0.03, seed: Math.random() * 10 });
    }
    // No ground-impact effect by design: the shield simply falls out of
    // frame, well off to the side, it's gone before it would need one.
    if (ss.q >= 1) sh.impacted = true;
  };

  LandingFX.prototype._drawSeparation = function (ctx, e) {
    var age = e - SEP;
    if (age < 0 || age > 900) return;
    var L = this._layout(stateAt(SEP, this.groundY - this.horizonY, this.horizonY));
    // Small and quick: it's kilometres away, so the glow stays subtle.
    var k = Math.exp(-age / 150);
    var r = L.shipW * lerp(2.2, 1.1, k);
    fillSoftEllipse(ctx, L.shipCX, L.nozzleY, r, r, [
      [0, rgba(255, 244, 228, 0.6 * k)], [0.3, rgba(255, 180, 110, 0.28 * k)], [1, "rgba(229,125,35,0)"]
    ], "lighter");
    drawStreak(ctx, L.shipCX, L.nozzleY, this.backCanvas.width * 0.3, Math.max(1.5 * this.dpr, L.shipW * 0.035), 0.35 * k);
  };

  /* ---------------------------------------------------------------
     DISTANT BURST: volumetric smoke bloom at separation
     Pre-rendered "cauliflower" puff sprites (clusters of lit sub-
     billows: pale highlight up top, plum shadow beneath, soft edge),
     instanced ~28x with their own expansion, growth, wind drift, spin
     and fade. Drawn into a low-res offscreen layer (distance softness
     for free), hazed with the sky colour so the environment dominates,
     lit briefly from inside, then composited behind the ship.
     --------------------------------------------------------------- */

  function makePuffSprite(size, seed) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var x = c.getContext("2d");
    var rnd = (function (s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })(seed * 7919 + 13);
    var R = size / 2;
    for (var i = 0; i < 46; i++) {
      var a = rnd() * Math.PI * 2;
      var d = Math.pow(rnd(), 0.65) * R * 0.5;
      var bx = R + Math.cos(a) * d, by = R + Math.sin(a) * d * 0.85;
      var br = R * (0.16 + rnd() * 0.2) * (1 - d / (R * 0.9));
      if (br < 2) continue;
      // light from above-left: highlight offset toward the light
      var g = x.createRadialGradient(bx - br * 0.35, by - br * 0.45, br * 0.05, bx, by, br);
      g.addColorStop(0, "rgba(255,204,150,0.95)");
      g.addColorStop(0.45, "rgba(206,116,62,0.85)");
      g.addColorStop(0.85, "rgba(110,46,22,0.55)");
      g.addColorStop(1, "rgba(84,34,16,0)");
      x.fillStyle = g;
      x.beginPath(); x.arc(bx, by, br, 0, Math.PI * 2); x.fill();
    }
    // self-shadowing: darker, cooler underside
    x.globalCompositeOperation = "source-atop";
    var sh = x.createLinearGradient(0, R * 0.4, 0, size);
    sh.addColorStop(0, "rgba(46,18,8,0)");
    sh.addColorStop(1, "rgba(46,18,8,0.5)");
    x.fillStyle = sh; x.fillRect(0, 0, size, size);
    // soft outer boundary so no puff has a readable edge
    x.globalCompositeOperation = "destination-in";
    var m = x.createRadialGradient(R, R, R * 0.2, R, R, R);
    m.addColorStop(0, "rgba(0,0,0,1)");
    m.addColorStop(0.7, "rgba(0,0,0,0.85)");
    m.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = m; x.fillRect(0, 0, size, size);
    return c;
  }

  LandingFX.prototype._burstSprites = function () {
    if (!this._puffSprites) {
      this._puffSprites = [];
      for (var i = 0; i < 5; i++) this._puffSprites.push(makePuffSprite(192, i + 1));
    }
    return this._puffSprites;
  };

  /* ---------------------------------------------------------------
     STORM SKY: a planetary storm seen from the surface
     Cloud ceiling: puffs live on a plane at altitude hgt in world
     space and move toward the camera (z falls, wrapping far -> near),
     projected like everything else: y = horizon - hgt / z, x = X / z,
     size = 1 / z, so near billows are big and race overhead while far
     ones crawl, flatten and converge on the horizon (real parallax).
     Storm wall: big billows churning along the horizon line.
     Drawn into a low-res offscreen layer (distance softness, cheap),
     hazed with the sky colour, lit by the separation flash and by rare,
     faint lightning, then composited as the farthest layer.
     --------------------------------------------------------------- */
  var STORM_Z_NEAR = 1.1, STORM_Z_FAR = 16;
  // The storm is dust thrown up by the descent: none while the ship is
  // still high, rising as the jets near the ground (just before the final
  // hover) and fully up by touchdown.
  var STORM_RISE_AT = HOVER - 500, STORM_RISE_MS = 2400;
  function stormRiseAt(e) { return easeInOutSine(clamp01((e - STORM_RISE_AT) / STORM_RISE_MS)); }
  var LIGHTNING_AT = [4300, 7900, 12600, 17900];   // then every ~6.7s

  LandingFX.prototype._stormModel = function () {
    if (this._storm) return this._storm;
    var sprites = this._burstSprites();
    var deck = [], wall = [], i;
    for (i = 0; i < 36; i++) {
      deck.push({
        sprite: sprites[i % sprites.length],
        X: rand(-1.9, 1.9), phase: Math.random(), speed: rand(0.85, 1.25),
        size: rand(0.3, 0.52), a: rand(0.13, 0.24), hgt: rand(0.5, 0.72), breathe: rand(0, 6.28),
        rot: rand(0, Math.PI * 2), spin: rand(-0.00004, 0.00004)
      });
    }
    for (i = 0; i < 16; i++) {
      wall.push({
        sprite: sprites[(i + 2) % sprites.length],
        fx: i / 15 + rand(-0.03, 0.03), size: rand(0.14, 0.26), a: rand(0.18, 0.3),
        lift: rand(0.15, 0.55), drift: rand(0.0035, 0.008), pulse: rand(0, 6.28),
        rot: rand(0, Math.PI * 2), spin: rand(-0.00002, 0.00002)
      });
    }
    this._storm = { deck: deck, wall: wall };
    return this._storm;
  };

  function lightningAt(e) {
    var list = LIGHTNING_AT, last = list[list.length - 1];
    var t = null;
    for (var i = 0; i < list.length; i++) if (e >= list[i]) t = list[i];
    if (e > last) t = last + Math.floor((e - last) / 6700) * 6700;
    if (t == null) return null;
    var dt = e - t;
    if (dt > 700) return null;
    var I = Math.exp(-dt / 70) + (dt > 150 ? 0.6 * Math.exp(-(dt - 150) / 90) : 0);
    return { I: I, seed: t };
  }

  LandingFX.prototype._drawStorm = function (ctx, e, strength) {
    if (strength == null) strength = 1;
    if (strength <= 0.003) return;
    var model = this._stormModel();
    var cw = this.backCanvas.width, ch = this.backCanvas.height;
    var hz = ch * this.horizonY;
    var K = 0.26; // lower-res than the other layers: softer, more atmospheric
    var lw = Math.max(1, Math.round(cw * K)), lh = Math.max(1, Math.round(ch * K));
    if (!this._stormCanvas) this._stormCanvas = document.createElement("canvas");
    var sc = this._stormCanvas;
    if (sc.width !== lw || sc.height !== lh) { sc.width = lw; sc.height = lh; }
    var x = sc.getContext("2d");
    x.globalCompositeOperation = "source-over";
    x.clearRect(0, 0, lw, lh);

    // One continuous body of dust haze behind the billows, so they merge
    // into a single atmosphere instead of reading as separate puffs. It
    // breathes slowly too.
    var br0 = 1 + 0.08 * Math.sin(e * 0.00035);
    var band = x.createLinearGradient(0, (hz - ch * 0.34 * br0) * K, 0, hz * K);
    band.addColorStop(0, "rgba(150,70,34,0)");
    band.addColorStop(0.55, "rgba(160,78,38,0.22)");
    band.addColorStop(1, "rgba(176,92,46,0.34)");
    x.fillStyle = band;
    x.fillRect(0, 0, lw, hz * K + 1);

    // Storm wall on the horizon (farthest).
    for (var w = 0; w < model.wall.length; w++) {
      var q = model.wall[w];
      var fx = ((q.fx + q.drift * e / 1000) % 1.2 + 1.2) % 1.2 - 0.1;
      var sz = q.size * cw * (1 + 0.14 * Math.sin(e * 0.00045 + q.pulse) + 0.05 * Math.sin(e * 0.0011 + q.pulse * 2));
      var wx = fx * cw, wy = hz - sz * (0.18 + 0.2 * q.lift);
      x.save();
      x.globalAlpha = q.a;
      x.translate(wx * K, wy * K);
      x.rotate(q.rot + q.spin * e);
      x.scale(1.25, 0.8);
      var d = sz * K * 1.2;
      x.drawImage(q.sprite, -d / 2, -d / 2, d, d);
      x.restore();
    }

    // Cloud ceiling, far -> near.
    var range = STORM_Z_FAR - STORM_Z_NEAR, items = [];
    for (var i = 0; i < model.deck.length; i++) {
      var c = model.deck[i];
      var z = STORM_Z_FAR - ((c.phase * range + c.speed * e * 0.0011) % range);
      items.push({ c: c, z: z });
    }
    items.sort(function (a, b) { return b.z - a.z; });
    for (var k = 0; k < items.length; k++) {
      var it = items[k], cc = it.c, zz = it.z;
      var Xw = ((cc.X + 0.00005 * e + 2) % 4 + 4) % 4 - 2;       // slow crosswind, wrapped
      var px = cw * (0.5 + Xw * 0.9 / zz);
      var py = hz - cc.hgt * ch / zz;
      var psz = cc.size * cw / zz * (1 + 0.13 * Math.sin(e * 0.0005 + cc.breathe) + 0.05 * Math.sin(e * 0.0013 + cc.breathe * 1.7));
      var far = zz / STORM_Z_FAR;
      var al = cc.a
        * clamp01((STORM_Z_FAR - zz) / 2.5)                         // fades in out of the haze
        * clamp01((zz - STORM_Z_NEAR) / 1.0)                        // and out as it passes overhead
        * lerp(1, 0.6, far);
      // storm seen from the ground: the ceiling thins out toward the zenith,
      // leaving the upper sky (and its stars) open
      var zen = clamp01((py - hz * 0.3) / (hz * 0.45));
      al *= zen * zen * (3 - 2 * zen);
      if (al < 0.01 || py + psz < 0 || px + psz < 0 || px - psz > cw) continue;
      x.save();
      x.globalAlpha = al;
      x.translate(px * K, py * K);
      x.rotate(cc.rot + cc.spin * e);
      x.scale(1.35, lerp(0.78, 0.42, far));                         // foreshortened from below
      var dd = psz * K * 1.2;
      x.drawImage(cc.sprite, -dd / 2, -dd / 2, dd, dd);
      x.restore();
    }

    // Aerial perspective: the orange haze over everything, heavier low down.
    x.globalCompositeOperation = "source-atop";
    var hg = x.createLinearGradient(0, 0, 0, hz * K);
    hg.addColorStop(0, "rgba(96,40,24,0.26)");
    hg.addColorStop(1, "rgba(132,62,36,0.46)");
    x.fillStyle = hg;
    x.fillRect(0, 0, lw, lh);

    // Separation flash lights the storm from within, briefly.
    if (e >= SEP) {
      var lit = Math.exp(-(e - SEP) / 520);
      if (lit > 0.01) {
        var L0 = this._layout(stateAt(SEP, this.groundY - this.horizonY, this.horizonY));
        var R = cw * 0.14 * K;
        var lg = x.createRadialGradient(L0.shipCX * K, L0.nozzleY * K, 0, L0.shipCX * K, L0.nozzleY * K, R);
        lg.addColorStop(0, rgba(255, 222, 180, 0.6 * lit));
        lg.addColorStop(0.5, rgba(240, 150, 80, 0.24 * lit));
        lg.addColorStop(1, "rgba(220,110,50,0)");
        x.fillStyle = lg;
        x.fillRect(0, 0, lw, lh);
      }
    }
    // Faint lightning deep inside the storm wall.
    var bolt = lightningAt(e);
    if (bolt && bolt.I > 0.01) {
      var bx = cw * (0.15 + ((bolt.seed * 9301 + 49297) % 233280) / 233280 * 0.7);
      var by = hz - ch * 0.06;
      var br = cw * 0.13 * K;
      var bg = x.createRadialGradient(bx * K, by * K, 0, bx * K, by * K, br);
      bg.addColorStop(0, rgba(255, 232, 200, 0.45 * bolt.I));
      bg.addColorStop(0.5, rgba(240, 170, 100, 0.16 * bolt.I));
      bg.addColorStop(1, "rgba(220,120,60,0)");
      x.fillStyle = bg;
      x.fillRect(0, 0, lw, lh);
    }

    ctx.save();
    ctx.globalAlpha = 0.95 * strength;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sc, 0, 0, cw, ch);
    ctx.restore();
  };

  LandingFX.prototype._drawPuffs = function (ctx, e) {
    for (var i = 0; i < this.puffs.length; i++) {
      var p = this.puffs[i];
      var age = (e - p.t) / 900;
      if (age < 0) continue;
      var r = p.r * (1 + easeOutCubic(age) * 5);
      fillSoftEllipse(ctx, p.x, p.y + r * 0.2, r, r * 0.8, [
        [0, rgba(236, 222, 206, 0.55 * (1 - age))], [1, "rgba(200,180,160,0)"]
      ]);
    }
  };

  LandingFX.prototype._drawSparks = function (ctx, e) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < this.sparks.length; i++) {
      var s = this.sparks[i];
      var h = 1 - (e - s.t) / s.life;
      ctx.fillStyle = heatColor(h, h);
      ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
      fillSoftEllipse(ctx, s.x, s.y, s.size * 3, s.size * 3, [[0, heatColor(h, 0.35 * h)], [1, heatColor(h, 0)]], "lighter");
    }
    ctx.restore();
  };

  LandingFX.prototype._drawShield = function (ctx, e) {
    var sh = this.shield;
    if (!sh || sh.impacted) return;
    if (!shieldImgReady) return this._drawShieldProcedural(ctx, e);
    var ss = this._shieldState(e);
    var p = this._project(ss.z, ss.h, ss.X);
    var r = p.unit * 0.5;
    if (r < 0.6) return;
    var fade = ss.q > 0.9 ? 1 - (ss.q - 0.9) / 0.1 * 0.6 : 1;
    this._drawShieldPhoto(ctx, p, ss, r, fade, ss.heat);
  };

  // Uneven ablation char + handling scuffs baked once into an offscreen
  // texture (same recipe as makePuffSprite): heavier charring toward the
  // rim (ablation eats the edge first, never symmetrically), scattered
  // dark blotches and fine scratches, a flown, beaten-up aeroshell, not
  // a showroom render.
  var shieldScorchCanvas = null;
  function shieldScorchTexture() {
    if (shieldScorchCanvas) return shieldScorchCanvas;
    var size = 256;
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var x = c.getContext("2d");
    var rnd = (function (s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })(50321);
    var rim = x.createRadialGradient(size * 0.5, size * 0.52, size * 0.14, size * 0.5, size * 0.5, size * 0.54);
    rim.addColorStop(0, "rgba(20,14,10,0)");
    rim.addColorStop(0.65, "rgba(20,14,10,0.22)");
    rim.addColorStop(1, "rgba(8,5,4,0.8)");
    x.fillStyle = rim;
    x.fillRect(0, 0, size, size);
    for (var i = 0; i < 60; i++) {
      var a = rnd() * Math.PI * 2, d = Math.pow(rnd(), 0.55) * size * 0.5;
      var bx = size / 2 + Math.cos(a) * d, by = size / 2 + Math.sin(a) * d * 0.92;
      var br = size * (0.025 + rnd() * 0.09);
      x.beginPath();
      x.fillStyle = "rgba(12,8,6," + (0.14 + rnd() * 0.32).toFixed(3) + ")";
      x.arc(bx, by, br, 0, 6.2832);
      x.fill();
    }
    x.strokeStyle = "rgba(0,0,0,0.22)";
    x.lineWidth = 1;
    for (var s = 0; s < 36; s++) {
      var sx = rnd() * size, sy = rnd() * size, ang = rnd() * Math.PI * 2, len = 5 + rnd() * 20;
      x.beginPath();
      x.moveTo(sx, sy);
      x.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
      x.stroke();
    }
    shieldScorchCanvas = c;
    return c;
  }

  // The shield + its weathering/heat tint, composited on an isolated,
  // fully-transparent offscreen buffer before ever touching the scene.
  // "source-atop" only masks to whatever's already ON THAT CANVAS, the
  // main scene canvas behind the shield is already fully opaque (sky,
  // storm, terrain), so tinting straight onto it would smear a faint
  // rectangle onto the background instead of hugging the shield's own
  // silhouette. Compositing here first, then drawing the one finished,
  // correctly-alpha-shaped sprite onto the scene, keeps the edge
  // transparent and seamless. Fixed resolution, this is the source
  // photo's own aspect ratio, not the on-screen size, which changes
  // every frame as the shield recedes.
  var shieldBuf = null;
  function shieldBuffer() {
    if (!shieldBuf) {
      shieldBuf = document.createElement("canvas");
      shieldBuf.width = 320;
      shieldBuf.height = Math.round(320 / shieldImgAspect);
    }
    return shieldBuf;
  }

  // The real aeroshell photo (glimpse-landing-00.png), tumbling end over
  // end as it falls away: a slow in-plane roll plus a vertical squash
  // that stands in for the tumble's other axis (a flat photo can't truly
  // turn in 3D). Desaturated and darkened first, then scuffed with the
  // scorch texture above, the flight-worn look the ask was for, rather
  // than the clean manufacturing-photo original. A soft plasma-glow halo
  // trails it, and a radial heat tint, cooling on the same exp() curve
  // as the engine flames/embers elsewhere in this file, washes hottest
  // at the rim.
  LandingFX.prototype._drawShieldPhoto = function (ctx, p, ss, r, fade, heat) {
    var w = r * 2.5, h = w / shieldImgAspect;
    if (heat > 0.06) {
      fillSoftEllipse(ctx, p.x, p.y, r * 2.3, r * 2.3 * (0.3 + 0.34 * Math.abs(Math.cos(ss.phi))), [
        [0, heatColor(heat, 0.32 * heat)], [1, heatColor(heat, 0)]
      ], "lighter");
    }

    var buf = shieldBuffer(), bw = buf.width, bh = buf.height;
    var bctx = buf.getContext("2d");
    bctx.clearRect(0, 0, bw, bh);
    // Light weathering, just enough to read as flown hardware, matching
    // the ship's own subtle dirt/scuff rather than a heavily charred prop.
    if ("filter" in bctx) bctx.filter = "saturate(0.78) contrast(1.05) brightness(0.9)";
    bctx.drawImage(shieldImg, 0, 0, bw, bh);
    if ("filter" in bctx) bctx.filter = "none";
    bctx.globalCompositeOperation = "source-atop";
    bctx.globalAlpha = 0.5;
    bctx.drawImage(shieldScorchTexture(), 0, 0, bw, bh);
    bctx.globalAlpha = 1;
    if (heat > 0.02) {
      var hg = bctx.createRadialGradient(bw * 0.5, bh * 0.5, 0, bw * 0.5, bh * 0.5, bw * 0.62);
      hg.addColorStop(0, heatColor(heat * 0.85, 0));
      hg.addColorStop(0.55, heatColor(heat * 0.85, 0.1 * heat));
      hg.addColorStop(0.85, heatColor(heat, 0.55 * heat));
      hg.addColorStop(1, heatColor(Math.min(1, heat * 1.15), 0.8 * heat));
      bctx.fillStyle = hg;
      bctx.fillRect(0, 0, bw, bh);
    }
    bctx.globalCompositeOperation = "source-over";

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(p.x, p.y);
    ctx.rotate(ss.roll);
    ctx.scale(1, 0.32 + 0.68 * Math.abs(Math.cos(ss.phi)));
    ctx.drawImage(buf, -w / 2, -h / 2, w, h);
    ctx.restore();
  };

  // Charred ablative dish seen from below: dark, faintly tiled face with
  // concentric ablation bands, metallic rim catching the sky, stagnation
  // face glowing dull orange and cooling from the edge inward. Fallback
  // for the rare case the real photo (glimpse-landing-00.png) hasn't
  // decoded yet by the time separation fires, separation never waits on
  // it and never flashes a broken image.
  LandingFX.prototype._drawShieldProcedural = function (ctx, e) {
    var sh = this.shield;
    if (!sh || sh.impacted) return;
    var ss = this._shieldState(e);
    var p = this._project(ss.z, ss.h, ss.X);
    var r = p.unit * 0.5;
    if (r < 0.6) return;
    var aspect = 0.16 + 0.34 * Math.abs(Math.cos(ss.phi));
    var fade = ss.q > 0.9 ? 1 - (ss.q - 0.9) / 0.1 * 0.6 : 1;
    var heat = ss.heat;
    if (heat > 0.08) {
      fillSoftEllipse(ctx, p.x, p.y, r * 2.2, r * 2.2 * (aspect + 0.3), [
        [0, heatColor(heat, 0.3 * heat)], [1, heatColor(heat, 0)]
      ], "lighter");
    }
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(p.x, p.y);
    ctx.rotate(ss.roll);
    // Depth of the dish: the back of the rim shows as a darker crescent.
    ctx.save();
    ctx.scale(1, aspect);
    ctx.beginPath();
    ctx.arc(0, r * 0.14, r, 0, Math.PI * 2);
    ctx.fillStyle = "#120805";
    ctx.fill();
    ctx.restore();
    ctx.scale(1, aspect);
    var g = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.05, 0, 0, r);
    g.addColorStop(0, "#4a3022");
    g.addColorStop(0.55, "#2e1c13");
    g.addColorStop(0.9, "#1f120b");
    g.addColorStop(1, "#150b07");
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(0.6, r * 0.028);
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    for (var ring = 1; ring <= 3; ring++) {
      ctx.beginPath(); ctx.arc(0, 0, r * (0.25 + ring * 0.2), 0, Math.PI * 2); ctx.stroke();
    }
    if (r > 6) { // tile seams only once it's big enough to read
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      for (var sp = 0; sp < 8; sp++) {
        var a = sp * Math.PI / 4 + ss.t * 0.0004;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25);
        ctx.lineTo(Math.cos(a) * r * 0.96, Math.sin(a) * r * 0.96);
        ctx.stroke();
      }
    }
    if (heat > 0.03) {
      var hg = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      hg.addColorStop(0, heatColor(heat * 0.9, 0.75 * heat));
      hg.addColorStop(Math.max(0.05, 0.75 * heat), heatColor(heat * 0.7, 0.45 * heat));
      hg.addColorStop(1, heatColor(heat * 0.5, 0));
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.lineWidth = Math.max(0.8, r * 0.07);
    ctx.strokeStyle = heat > 0.2 ? heatColor(heat, 0.9) : "rgba(128,100,82,0.85)";
    ctx.beginPath(); ctx.arc(0, 0, r * 0.97, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = Math.max(0.6, r * 0.05);
    ctx.strokeStyle = "rgba(255,226,196,0.28)";
    ctx.beginPath(); ctx.arc(0, 0, r * 0.97, Math.PI * 1.1, Math.PI * 1.85); ctx.stroke();
    ctx.restore();
  };

  LandingFX.prototype._drawPlumes = function (ctx, e) {
    for (var i = 0; i < this.plumes.length; i++) {
      var p = this.plumes[i];
      var age = (e - p.t) / 3400;
      var R = p.unit * lerp(0.15, 1.5, easeOutCubic(age));
      var a = 0.5 * Math.pow(1 - age, 1.3);
      fillSoftEllipse(ctx, p.x, p.y - R * 0.35, R, R * 0.6, [
        [0, rgba(196, 128, 86, a)], [0.6, rgba(170, 100, 64, a * 0.5)], [1, "rgba(150,90,60,0)"]
      ]);
      fillSoftEllipse(ctx, p.x, p.y, R * 1.6, R * 0.22, [
        [0, rgba(180, 110, 70, a * 0.7)], [1, "rgba(160,90,60,0)"]
      ]);
    }
  };

  /* ---------------------------------------------------------------
     SHIP
     --------------------------------------------------------------- */
  LandingFX.prototype._shipIndex = function (st) {
    var maxV = this._prepareFinal() ? FINAL_IDX : LAST_SEQ;
    return Math.max(0, Math.min(maxV, st.v));
  };

  LandingFX.prototype._drawShip = function (e, st, L) {
    var seq = this.sequence;
    if (!seq) return;
    if (e < SEP) { seq.ctx.clearRect(0, 0, seq.canvas.width, seq.canvas.height); return; }
    var v = this._shipIndex(st);
    var i0 = Math.floor(v), i1 = Math.min(FINAL_IDX, i0 + 1);
    if (i1 === FINAL_IDX && !this._finalReady) i1 = i0;
    var t = v - i0;
    var far = clamp01((st.z - 1) / (Z_FAR - 1));
    var haze = Math.pow(far, 0.6);
    var heat = Math.exp(-(e - SEP) / 600);
    var filter = "none";
    if (haze > 0.02 || heat > 0.02) {
      filter = "brightness(" + (lerp(1, 0.78, haze) + heat * 0.9).toFixed(3) +
        ") contrast(" + lerp(1, 0.62, haze).toFixed(3) +
        ") saturate(" + (lerp(1, 0.55, haze) + heat * 1.6).toFixed(3) +
        ") sepia(" + Math.min(1, lerp(0, 0.35, haze) + heat * 0.8).toFixed(3) + ")" +
        (haze > 0.15 ? " blur(" + (lerp(0, 1.1, haze) * this.dpr).toFixed(2) + "px)" : "");
    }
    var ps = this._poseState(performance.now());
    var opts = {
      alpha: clamp01((e - SEP) / 260) * ps.alpha,
      transform: this._poseMatrix(L, ps.pose),
      filter: filter,
      rotate: L.tilt ? { angle: L.tilt, x: L.shipCX, y: L.pivotY } : null
    };
    if (i1 === FINAL_IDX) {
      // 032 (dust storm, full width) -> 033 (settled, narrower): 033 is
      // laid OVER 032 rather than cross-added, and 032's wide dust fades
      // late, so it still surrounds 033 while 033 arrives, and no edge
      // of 033's canvas can read against the scene. Both are pre-feathered.
      opts.mode = "over";
      opts.alphaA = 1 - Math.pow(t, 2.2);
      opts.alphaB = clamp01(t * 1.2);
    } else {
      opts.fadeX = lerp(0.08, 0.16, clamp01((v - 21) / 4));
      opts.fadeBottom = lerp(0.035, 0.14, clamp01((v - 22) / 3));
    }
    seq.drawBlend(i0, L.rectFor(i0), i1, L.rectFor(i1), t, opts);
  };

  // Screen position of the spire beacon for frame index k.
  LandingFX.prototype._beaconAt = function (L, k) {
    var r = L.rectFor(k);
    if (k === FINAL_IDX) return { x: r.x + F33_SPIRE[0] * L.k33, y: r.y + F33_SPIRE[1] * L.k33 };
    return { x: r.x + SPIRE[0] * L.s, y: r.y + (SHIP_TOPS[k] + SPIRE[1]) * L.s };
  };

  // Red anti-collision strobe on the spire: double blink, every 1.8s.
  LandingFX.prototype._drawBeacon = function (ctx, L, st, e) {
    if (e < SEP + 500) return;
    var ph = e % 1800;
    var on = ph < 70 ? 1 - ph / 70 * 0.3 : (ph > 230 && ph < 300 ? 1 - (ph - 230) / 70 * 0.3 : 0);
    if (!on) return;
    var k = Math.round(this._shipIndex(st));
    var ps = this._poseState(performance.now());
    var p = applyM(this._poseMatrix(L, ps.pose), this._beaconAt(L, k).x, this._beaconAt(L, k).y);
    on *= ps.alpha;
    if (L.tilt) {
      var q = rotAbout(p.x, p.y, L.shipCX, L.pivotY, L.tilt);
      p = { x: q[0], y: q[1] };
    }
    var far = clamp01((st.z - 1) / (Z_FAR - 1));
    var r = Math.max(2 * this.dpr, L.shipW * 0.018) * lerp(1, 2.2, far);
    fillSoftEllipse(ctx, p.x, p.y, r * 4, r * 4, [[0, rgba(255, 60, 40, 0.45 * on)], [1, "rgba(255,40,30,0)"]], "lighter");
    fillSoftEllipse(ctx, p.x, p.y, r, r, [[0, rgba(255, 235, 225, on)], [0.5, rgba(255, 80, 60, 0.8 * on)], [1, "rgba(255,40,30,0)"]], "lighter");
    drawStreak(ctx, p.x, p.y, r * 14, Math.max(1, r * 0.18), 0.35 * on);
  };

  /* ---------------------------------------------------------------
     THRUST: live exhaust over the baked flames, flickering white-hot
     core, shock diamonds, turbulent burning gas flowing down the
     plume, ground splash once the jets reach the surface.
     --------------------------------------------------------------- */
  LandingFX.prototype._drawThrust = function (ctx, L, st, e) {
    if (e < SEP) return;
    var ramp = clamp01((e - SEP) / 320);
    var v = Math.max(0, Math.min(LAST_SEQ, st.v));
    var baked = flameLenAt(v);                      // painted flame length (frame px)
    if (baked < 4 || ramp <= 0) return;
    var eng = clamp01(baked / 120) * ramp;
    var seq = this.sequence;
    var i0 = Math.floor(v), i1 = Math.min(LAST_SEQ, i0 + 1), t = v - i0;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (L.tilt) { ctx.translate(L.shipCX, L.pivotY); ctx.rotate(L.tilt); ctx.translate(-L.shipCX, -L.pivotY); }
    for (var n = 0; n < NOZZLES.length; n++) {
      var seed = n * 17 + 3;
      var nx = L.shipCX + NOZZLES[n] * L.shipW;
      var ny = L.nozzleY;
      var flick = 0.84 + 0.16 * noise(e * 0.9, seed);         // combustion flicker
      var pump = 1 + 0.1 * noise(e * 0.33, seed + 5);          // slow length pulsing
      var len = baked * L.s * pump;
      var w0 = Math.max(1.2 * this.dpr, FLAME_W * 0.34 * L.s);  // core-plume half width
      var toGround = L.groundPx - ny;
      var impinge = baked * L.s > toGround * 0.9;
      if (len > toGround) len = toGround;

      // 1) Re-fire the PAINTED flame: the flame pixels of the current
      //    frames drawn back over themselves additively, stretched and
      //    swayed by the flicker, the artwork itself now burns.
      if (seq) {
        for (var q = 0; q < 2; q++) {
          var k = q ? i1 : i0, wgt = q ? t : 1 - t;
          if (wgt < 0.02 || !seq.loaded[k] || !FLAME_LEN[k]) continue;
          var r = L.rectFor(k);
          var fx = FRAME_W / 2 + NOZZLES[n] * HULL_PX;
          var noz = SHIP_TOPS[k] + SHIP_HEIGHT - NOZZLE_UP;
          var sx = fx - FLAME_W * 0.62, sy = noz - 18;
          var sw = FLAME_W * 1.24, sh = Math.min(FRAME_H - sy, FLAME_LEN[k] + 70);
          var dx = r.x + sx * L.s, dy = r.y + sy * L.s, dw = sw * L.s, dh = sh * L.s;
          var sway = noise(e * 0.12, seed + 9) * dw * 0.03;
          ctx.save();
          ctx.translate(nx, ny);
          ctx.transform(1 + 0.05 * noise(e * 0.5, seed + 2), 0, sway / Math.max(1, dh), pump * (1 + 0.08 * noise(e * 0.7, seed + 4)), 0, 0);
          ctx.translate(-nx, -ny);
          ctx.globalAlpha = 0.34 * wgt * flick * ramp;
          ctx.drawImage(seq.images[k], sx, sy, sw, sh, dx, dy, dw, dh);
          // a longer, fainter lick trailing off the end
          ctx.translate(nx, ny); ctx.scale(1.08, 1.22); ctx.translate(-nx, -ny);
          ctx.globalAlpha = 0.14 * wgt * flick * ramp;
          ctx.drawImage(seq.images[k], sx, sy, sw, sh, dx, dy, dw, dh);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }

      // 2) Outer glow fitted to the painted plume.
      fillSoftEllipse(ctx, nx, ny + len * 0.5, w0 * 2.4, len * 0.62, [
        [0, rgba(255, 150, 60, 0.24 * eng * flick)], [1, "rgba(229,90,30,0)"]
      ]);
      // 3) Turbulent burning gas flowing down the plume: born white-hot at
      //    the nozzle, growing, cooling to orange and deep red, wandering.
      var N = 12;
      for (var i = 0; i < N; i++) {
        var f = ((i / N) + e * 0.0036 + n * 0.37) % 1;
        var jx = noise(e * 0.06 + i * 7.3, seed + i) * w0 * 0.6 * (0.2 + f);
        var by = ny + f * len;
        var br = w0 * (0.45 + f * 1.05) * (0.85 + 0.3 * noise(e * 0.2, i + seed));
        var ba = eng * Math.pow(1 - f, 1.25) * 0.48 * flick;
        fillSoftEllipse(ctx, nx + jx, by, br, br * 1.3, [
          [0, heatColor(lerp(0.97, 0.35, f), ba)], [1, heatColor(lerp(0.8, 0.2, f), 0)]
        ]);
      }
      // 4) White-hot core.
      var coreLen = len * 0.58 * flick;
      var cg = ctx.createLinearGradient(nx, ny, nx, ny + coreLen);
      cg.addColorStop(0, rgba(235, 244, 255, 0.95 * eng));
      cg.addColorStop(0.25, rgba(255, 246, 225, 0.85 * eng));
      cg.addColorStop(1, "rgba(255,200,120,0)");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(nx - w0 * 0.3, ny);
      ctx.quadraticCurveTo(nx - w0 * 0.18, ny + coreLen * 0.6, nx, ny + coreLen);
      ctx.quadraticCurveTo(nx + w0 * 0.18, ny + coreLen * 0.6, nx + w0 * 0.3, ny);
      ctx.closePath();
      ctx.fill();
      // 5) Shock diamonds.
      for (var d = 0; d < 4; d++) {
        var dy2 = ny + len * (0.13 + d * 0.15) * (1 + 0.03 * noise(e * 0.5, d));
        if (dy2 > ny + len * 0.8) break;
        var da = eng * [0.85, 0.6, 0.38, 0.2][d] * flick;
        fillSoftEllipse(ctx, nx, dy2, w0 * (0.28 - d * 0.03), w0 * 0.18, [
          [0, rgba(240, 246, 255, da)], [0.6, rgba(255, 220, 170, da * 0.4)], [1, "rgba(255,200,140,0)"]
        ]);
      }
      // 6) Nozzle exit.
      fillSoftEllipse(ctx, nx, ny, w0 * 0.55, w0 * 0.2, [[0, rgba(255, 255, 245, eng)], [1, "rgba(255,220,170,0)"]]);
      // 7) Ground splash once the jet reaches the regolith.
      if (impinge) {
        var sy2 = L.groundPx;
        var spl = eng * flick;
        fillSoftEllipse(ctx, nx, sy2, w0 * 3.4, w0 * 0.55, [
          [0, rgba(255, 238, 200, 0.75 * spl)], [0.4, rgba(255, 170, 80, 0.4 * spl)], [1, "rgba(229,100,30,0)"]
        ]);
        for (var j = -1; j <= 1; j += 2) {
          var jl = w0 * (2.8 + 0.9 * noise(e * 0.3, seed + j));
          fillSoftEllipse(ctx, nx + j * jl * 0.7, sy2 - w0 * 0.1, jl, w0 * 0.3, [
            [0, rgba(255, 190, 110, 0.35 * spl)], [1, "rgba(229,100,30,0)"]
          ]);
        }
      }
    }
    ctx.restore();
  };

  /* ---------------------------------------------------------------
     GLIDE / FINAL: exhaust trail, bloom, flare, ground light, shadow
     --------------------------------------------------------------- */
  LandingFX.prototype._updateTrail = function (L, st, e) {
    var last = this.trail[this.trail.length - 1];
    if (e >= SEP && st.h > HOVER_ALT * 0.6 && (!last || e - last.t >= 40)) {
      this.trail.push({ x: L.shipCX, y: L.nozzleY, t: e, r: Math.max(3 * this.dpr, L.shipW * 0.12) });
    }
    while (this.trail.length && e - this.trail[0].t > TRAIL_LIFE_MS) this.trail.shift();
  };

  LandingFX.prototype._drawTrail = function (ctx, e) {
    for (var i = 0; i < this.trail.length; i++) {
      var d = this.trail[i];
      var age = (e - d.t) / TRAIL_LIFE_MS;
      if (age < 0.04) continue;
      var r = d.r * (1 + age * 3);
      var a = 0.2 * (1 - age) * (1 - age);
      fillSoftEllipse(ctx, d.x, d.y + d.r * age * 0.8, r, r * 0.8, [
        [0, rgba(lerp(255, 226, age), lerp(214, 196, age), lerp(170, 176, age), a)],
        [1, "rgba(200,160,140,0)"]
      ]);
    }
  };

  LandingFX.prototype._drawBloom = function (ctx, L, st, e) {
    if (e < SEP) return;
    var eng = engineAt(st.v + 1);
    if (eng <= 0.01) return;
    var far = clamp01((st.z - 1) / (Z_FAR - 1));
    var ignite = 1 + 1.6 * Math.exp(-(e - SEP) / 260);
    var fl = 0.9 + 0.1 * noise(e * 0.6, 7);
    var a = Math.min(1, eng * lerp(0.1, 0.85, Math.pow(far, 0.5)) * fl * ignite);
    ctx.save();
    if (L.tilt) { ctx.translate(L.shipCX, L.pivotY); ctx.rotate(L.tilt); ctx.translate(-L.shipCX, -L.pivotY); }
    for (var n = 0; n < NOZZLES.length; n++) {
      var r = Math.max(5 * this.dpr, L.shipW * 0.1) * lerp(1, 2.4, far);
      fillSoftEllipse(ctx, L.shipCX + NOZZLES[n] * L.shipW, L.nozzleY + r * 0.25, r, r * 1.2, [
        [0, rgba(255, 246, 220, a)],
        [0.25, rgba(255, 196, 110, a * 0.6)],
        [1, "rgba(229,125,35,0)"]
      ], "lighter");
    }
    ctx.restore();
    var sa = eng * (0.16 + 0.32 * Math.pow(far, 0.4)) * fl * Math.min(2, ignite);
    drawStreak(ctx, L.shipCX, L.nozzleY, this.backCanvas.width * lerp(0.22, 0.38, far),
      Math.max(1.5 * this.dpr, L.shipW * 0.012), sa);
  };

  LandingFX.prototype._drawShadow = function (ctx, L, st) {
    var near = 1 - clamp01(st.h / LOW_ALT);
    if (near <= 0.01 || st.z > 1.6) return;
    var ps = this._poseState(performance.now()), m = this._poseMatrix(L, ps.pose);
    if (m || ps.alpha < 1) {
      ctx.save();
      if (m) ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      ctx.globalAlpha = ps.alpha;
      this._drawShadowInner(ctx, L, near);
      ctx.restore();
      return;
    }
    this._drawShadowInner(ctx, L, near);
  };

  LandingFX.prototype._drawShadowInner = function (ctx, L, near) {
    var rx = L.shipW * lerp(0.3, 0.52, near);
    var a = lerp(0.03, 0.5, near * near);
    fillSoftEllipse(ctx, L.shipCX, L.groundPx, rx, rx * 0.14, [
      [0, rgba(26, 12, 7, a)], [0.6, rgba(26, 12, 7, a * 0.5)], [1, "rgba(26,12,7,0)"]
    ]);
  };

  // 033 keeps 032's exact position (no movement through the dissolve),
  // which puts its pad soles a touch above the terrain line used by the
  // descent. The terrain photo is continuous, so the pads simply stand a
  // little further back, the contact shadows go exactly under the soles.
  LandingFX.prototype._padSoleY = function (L) {
    return L.rectFor(FINAL_IDX).y + F33.feet * L.k33;
  };

  LandingFX.prototype._drawPadContact = function (ctx, L, st) {
    if (st.clear == null || !this._finalReady) return;
    var ps = this._poseState(performance.now()), m = this._poseMatrix(L, ps.pose);
    if (m) { ctx.save(); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]); }
    this._drawPadContactInner(ctx, L, st, ps.alpha);
    if (m) ctx.restore();
  };

  LandingFX.prototype._drawPadContactInner = function (ctx, L, st, poseAlpha) {
    var a = 0.62 * easeInOutSine(clamp01(st.clear * 1.3)) * poseAlpha;
    var r33 = L.rectFor(FINAL_IDX), sole = this._padSoleY(L);
    for (var i = 0; i < 2; i++) {
      var x = r33.x + F33.pads[i] * L.k33;
      var rx = F33.padW[i] * L.k33 * 0.62;
      fillSoftEllipse(ctx, x, sole + rx * 0.02, rx, rx * 0.18, [
        [0, rgba(14, 6, 3, a)], [0.55, rgba(20, 9, 5, a * 0.5)], [1, "rgba(20,9,5,0)"]
      ]);
    }
  };

  // Ground integration (front layer): a soft band of terrain-coloured
  // haze hugging the ground line across the ship's base, so the bottom
  // edge of the PNG (its dust band, the rock bases) melts into the
  // surface instead of ending on it. Builds in as the ship gets low.
  LandingFX.prototype._drawGroundBlend = function (ctx, L, st, e) {
    if (e < HOVER) return;
    var ps = this._poseState(performance.now()), m = this._poseMatrix(L, ps.pose);
    if (m || ps.alpha < 1) {
      ctx.save();
      if (m) ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      ctx.globalAlpha = ps.alpha;
      this._drawGroundBlendInner(ctx, L, st, e);
      ctx.restore();
      return;
    }
    this._drawGroundBlendInner(ctx, L, st, e);
  };

  LandingFX.prototype._drawGroundBlendInner = function (ctx, L, st, e) {
    var a = e < TOUCH ? 0.5 * easeInOutSine((e - HOVER) / FINAL_MS) : 0.5 + 0.5 * clamp01((e - TOUCH) / 1500);
    var W = L.shipW, gy = L.groundPx;
    if (st.clear != null && this._finalReady) gy = lerp(gy, this._padSoleY(L), easeInOutSine(clamp01(st.clear * 1.3)));
    var top = gy - W * 0.07, bot = gy + W * 0.13;
    ctx.save();
    // horizontal falloff via an elliptical mask so the band has no ends
    ctx.translate(L.shipCX, gy);
    ctx.scale(W * 1.35, (bot - top));
    var g = ctx.createRadialGradient(0, 0.1, 0, 0, 0.1, 1);
    g.addColorStop(0, rgba(150, 82, 48, 0.6 * a));
    g.addColorStop(0.5, rgba(140, 74, 42, 0.38 * a));
    g.addColorStop(1, "rgba(130,68,38,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0.1, 1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // a thinner, denser seam right at the contact line
    fillSoftEllipse(ctx, L.shipCX, gy + W * 0.015, W * 0.95, W * 0.035, [
      [0, rgba(160, 92, 56, 0.45 * a)], [1, "rgba(150,82,48,0)"]
    ]);
  };

  LandingFX.prototype._drawGroundLight = function (ctx, L, st, e) {
    if (e < SEP) return;
    var eng = engineAt(st.v + 1);
    if (eng <= 0.01) return;
    var near = 1 - clamp01(st.h / (LOW_ALT * 1.6));
    var amt = eng * near * near;
    if (amt <= 0.01) return;
    var fl = 0.9 + 0.1 * noise(e * 0.9, 11);
    var r = L.shipW * lerp(0.9, 0.62, near);
    fillSoftEllipse(ctx, L.shipCX, L.groundPx, r, r * 0.26, [
      [0, rgba(255, 170, 80, 0.3 * amt * fl)],
      [0.45, rgba(229, 125, 35, 0.13 * amt * fl)],
      [1, "rgba(192,69,39,0)"]
    ], "lighter");
  };

  /* ---------------------------------------------------------------
     TOUCHDOWN: shockwave ring, ballistic rocks, dust streaks, wisps
     --------------------------------------------------------------- */
  LandingFX.prototype._drawShockwave = function (ctx, L, e) {
    for (var w = 0; w < 2; w++) {
      var age = (e - TOUCH - w * 140) / 1500;
      if (age < 0 || age > 1) continue;
      var r = L.shipW * (0.45 + (w ? 2.1 : 3) * easeOutCubic(age));
      var a = (w ? 0.22 : 0.4) * Math.pow(1 - age, 1.4);
      fillSoftEllipse(ctx, L.shipCX, L.groundPx, r, r * 0.15, [
        [0, "rgba(160,80,40,0)"],
        [0.62, rgba(170, 92, 50, a * 0.25)],
        [0.86, rgba(214, 150, 100, a)],
        [1, "rgba(200,130,90,0)"]
      ]);
    }
  };

  LandingFX.prototype._updateRocks = function (L, e, dt) {
    if (e >= TOUCH && !this._rocksSpawned && !this.reduceMotion) {
      this._rocksSpawned = true;
      this._spawnImpactStorm(L);
      var W = L.shipW;
      for (var i = 0; i < 42; i++) {
        var nz = pick(NOZZLES);
        var dir = Math.random() < 0.5 ? -1 : 1;
        var depth = rand(-0.03, 0.05) * W;
        this.rocks.push({
          x: L.shipCX + nz * W + rand(-0.05, 0.05) * W,
          y: L.groundPx + depth, ground: L.groundPx + depth,
          vx: dir * W * rand(0.0002, 0.0011), vy: -W * rand(0.0005, 0.0016),
          g: W * 0.0000032, size: Math.max(1 * this.dpr, W * rand(0.0025, 0.008)),
          rot: rand(0, 6.28), vr: rand(-0.02, 0.02), color: pick(ROCK_COLORS),
          front: depth > 0, px: null, py: null
        });
      }
    }
    var next = [];
    for (var k = 0; k < this.rocks.length; k++) {
      var r = this.rocks[k];
      r.px = r.x; r.py = r.y;
      r.vy += r.g * dt;
      r.x += r.vx * dt; r.y += r.vy * dt;
      r.rot += r.vr * dt;
      if (r.y > r.ground && r.vy > 0) continue;
      next.push(r);
    }
    this.rocks = next;
  };

  LandingFX.prototype._drawRocks = function (ctx, front) {
    for (var i = 0; i < this.rocks.length; i++) {
      var r = this.rocks[i];
      if (r.front !== front) continue;
      if (r.px != null) {
        ctx.strokeStyle = hexA(r.color, 0.2);
        ctx.lineWidth = r.size * 0.5;
        ctx.beginPath(); ctx.moveTo(r.px, r.py); ctx.lineTo(r.x, r.y); ctx.stroke();
      }
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.rot);
      ctx.fillStyle = r.color;
      ctx.beginPath(); // irregular chunk, not a tile
      ctx.moveTo(-r.size, -r.size * 0.3);
      ctx.lineTo(-r.size * 0.2, -r.size * 0.75);
      ctx.lineTo(r.size, -r.size * 0.2);
      ctx.lineTo(r.size * 0.5, r.size * 0.6);
      ctx.lineTo(-r.size * 0.7, r.size * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  };

  LandingFX.prototype._spawnDust = function (L, rate, dt) {
    if (this.reduceMotion || rate <= 0) return;
    var expected = rate * (dt / 1000);
    var count = Math.floor(expected) + (Math.random() < (expected % 1) ? 1 : 0);
    for (var i = 0; i < count; i++) {
      var nozzle = pick(NOZZLES);
      var dir = nozzle < 0 ? -1 : 1;
      if (Math.random() < 0.25) dir = -dir;
      var haze = Math.random() < 0.25;
      var x = L.shipCX + nozzle * L.shipW + rand(-0.03, 0.03) * L.shipW;
      this.particles.push({
        x: x, spawnX: x,
        y: L.groundPx - Math.random() * 0.015 * L.shipW,
        vx: dir * L.shipW * (haze ? 0.012 : rand(0.03, 0.07)),
        vy: -L.shipW * 0.0012 * Math.random(),
        size: L.shipW * (haze ? 0.05 : rand(0.02, 0.035)),
        maxSize: L.shipW * (haze ? 0.2 : rand(0.08, 0.15)),
        age: 0,
        maxAge: haze ? rand(2000, 2900) : rand(900, 1600),
        color: pick(DUST_COLORS),
        alpha0: (haze ? 0.1 : 0.2) + Math.random() * 0.12,
        layer: Math.random() < 0.4 ? "front" : "back"
      });
    }
    if (this.particles.length > 300) this.particles.splice(0, this.particles.length - 300);
  };

  // Touchdown dust wall: big billows thrown outward from the pads fast
  // enough to reach past both screen edges, rising and thinning slowly.
  LandingFX.prototype._spawnImpactStorm = function (L) {
    var cw = this.backCanvas.width;
    for (var i = 0; i < 90; i++) {
      var dir = i % 2 ? 1 : -1;
      var reach = Math.max(cw * 0.5 + L.shipW * 0.3, Math.abs((dir > 0 ? cw : 0) - L.shipCX)) * rand(0.35, 1.25);
      var x = L.shipCX + dir * L.shipW * rand(0.05, 0.45);
      this.particles.push({
        x: x, spawnX: x,
        y: L.groundPx - L.shipW * rand(-0.01, 0.06),
        // drag 0.975/frame -> total travel ~ 40 * v0, so v0 = reach / 40
        vx: dir * reach / 40, vy: -L.shipW * rand(0.0005, 0.003),
        size: L.shipW * rand(0.08, 0.18), maxSize: L.shipW * rand(0.35, 0.8),
        age: -rand(0, 180), maxAge: rand(3600, 6200),
        color: pick(["#7a3a1c", "#8f4a26", "#a95f36", "#c07a4c", "#6a2f16"]),
        alpha0: rand(0.22, 0.4), layer: Math.random() < 0.45 ? "front" : "back", billow: true
      });
    }
  };

  // Low haze band over the whole frame width after the impact, thinning
  // away as the dust clears to frame 033.
  LandingFX.prototype._drawImpactHaze = function (ctx, L, e, strength) {
    if (e < TOUCH) return;
    var up = clamp01((e - TOUCH) / 700);
    var down = 1 - clamp01((e - DURATION_MS - CLEAR_MS * 0.2) / (CLEAR_MS * 1.3));
    // Settles to a thin permanent layer (not zero): it's what the settled
    // dust around the pads blends into, edge to edge.
    var a = 0.5 * strength * easeOutCubic(up) * lerp(0.26, 1, down);
    if (a <= 0.005) return;
    var cw = this.backCanvas.width, ch = this.backCanvas.height;
    var top = L.groundPx - L.shipW * lerp(0.1, 0.32, up);
    var g = ctx.createLinearGradient(0, top, 0, ch);
    g.addColorStop(0, "rgba(150,80,44,0)");
    g.addColorStop(0.35, rgba(158, 88, 50, a));
    g.addColorStop(1, rgba(120, 60, 32, a * 0.8));
    ctx.fillStyle = g;
    ctx.fillRect(0, top, cw, ch - top);
  };

  // After the dust clears: slow, low wisps drifting across the feet on
  // the wind, so the settled scene keeps breathing.
  LandingFX.prototype._spawnWisps = function (L, dt) {
    if (this.reduceMotion) return;
    if (Math.random() >= 1.4 * (dt / 1000)) return;
    var x = L.shipCX + this._poseState(performance.now()).pose.dx * this.backCanvas.width + rand(-1.3, 0.9) * L.shipW;
    this.particles.push({
      x: x, spawnX: x,
      y: L.groundPx + rand(-0.015, 0.02) * L.shipW,
      vx: L.shipW * rand(0.0015, 0.0035), vy: -L.shipW * 0.0001,
      size: L.shipW * rand(0.1, 0.16), maxSize: L.shipW * rand(0.3, 0.45),
      age: 0, maxAge: rand(4200, 6500),
      color: pick(["#8a4a2a", "#a0593a", "#c07a54"]),
      alpha0: rand(0.07, 0.13), layer: Math.random() < 0.55 ? "front" : "back", wisp: true
    });
  };

  LandingFX.prototype._advanceDust = function (dt) {
    var next = [];
    for (var i = 0; i < this.particles.length; i++) {
      var d = this.particles[i];
      d.age += dt;
      if (d.age >= d.maxAge) continue;
      if (d.age < 0) { next.push(d); d.curAlpha = 0; d.curSize = d.size; d.stretch = 1; continue; }
      var k = dt / 16.6667;
      d.x += d.vx * k;
      d.y += d.vy * k;
      if (d.billow) { d.vx *= Math.pow(0.975, k); d.vy *= Math.pow(0.985, k); }
      else if (!d.wisp) { d.vx *= 0.983; d.vy *= 0.96; }
      var lt = d.age / d.maxAge;
      d.curSize = lerp(d.size, d.maxSize, easeOutCubic(clamp01(lt / 0.65)));
      d.curAlpha = d.alpha0 * (d.wisp ? Math.sin(Math.PI * lt) : d.billow ? Math.pow(1 - lt, 1.5) * clamp01(d.age / 200) : (1 - easeOutCubic(lt)) * clamp01(d.age / 120));
      d.stretch = d.wisp ? 1.6 : d.billow ? 0.9 : Math.min(2.4, Math.abs(d.x - d.spawnX) / Math.max(1, d.curSize));
      next.push(d);
    }
    this.particles = next;
  };

  LandingFX.prototype._drawDust = function (ctx, layer) {
    for (var i = 0; i < this.particles.length; i++) {
      var d = this.particles[i];
      if (d.layer !== layer) continue;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.scale(1 + d.stretch * 0.6, d.billow ? 0.62 : 0.34);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, d.curSize);
      g.addColorStop(0, hexA(d.color, d.curAlpha));
      g.addColorStop(0.55, hexA(d.color, d.curAlpha * 0.5));
      g.addColorStop(1, hexA(d.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, d.curSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  /* ---------------------------------------------------------------
     CAMERA
     --------------------------------------------------------------- */
  LandingFX.prototype._camera = function (e, L) {
    var flash = 0;
    var ts = e - TOUCH;
    if (ts >= 0 && ts < 700) flash = 0.35 * Math.exp(-ts / 140);
    var sepAge = e - SEP;
    if (sepAge >= 0 && sepAge < 500) flash = Math.max(flash, 0.04 * Math.exp(-sepAge / 120));
    if (this.flashEl) this.flashEl.style.opacity = flash.toFixed(3);

    var cam = { tx: 0, ty: 0, rot: 0, scale: 1, sx: 0, sy: 0 };
    if (!this.reduceMotion && this.cameraEls.length) {
      var W = this._cssW || 1, H = this._cssH || 1;
      var c = clamp01(e / TOUCH);
      // 1.08 base = overscan: the storm fills the sky edge to edge, so the
      // world layers must always cover the frame through pan, tilt and shake.
      cam.scale = 1.08 + 0.06 * easeInOutSine(c);
      cam.ty = H * 0.045 * (1 - easeInOutSine(clamp01(e / (HOVER + 400))));
      var targetX = e < SEP ? this._entryPoint(e).x : L.shipCX;
      var tgt = -((targetX / this.dpr) / W - 0.5) * W * 0.06;
      this._camX = this._camX == null ? tgt : lerp(this._camX, tgt, 0.06);
      cam.tx = this._camX + noise(e * 0.01, 1) * 2.2;
      cam.ty += noise(e * 0.01, 5) * 1.6;
      cam.rot = noise(e * 0.006, 9) * 0.08;
      // Section 2 still: a slow dolly push-in toward the open hatch
      if (this.still && this._stillT0) {
        var dk = easeInOutSine(clamp01((performance.now() - this._stillT0) / 18000));
        cam.scale += 0.06 * dk;
        cam.tx -= W * 0.012 * dk;
        cam.ty -= H * 0.012 * dk;
      }
      if (ts >= 0 && ts < 1100) {
        var amp = Math.exp(-ts / 230);
        cam.sx = noise(e * 1.4, 2) * 7 * amp;
        cam.sy = noise(e * 1.7, 4) * 12 * amp;
        cam.rot += noise(e * 1.2, 6) * 0.35 * amp;
      }
      var tr = "translate3d(" + (cam.tx + cam.sx).toFixed(2) + "px," + (cam.ty + cam.sy).toFixed(2) + "px,0) rotate(" +
        cam.rot.toFixed(3) + "deg) scale(" + cam.scale.toFixed(4) + ")";
      for (var i = 0; i < this.cameraEls.length; i++) {
        var el = this.cameraEls[i];
        el.style.transform = (el.__camBase ? el.__camBase + " " : "") + tr; // keep any resting CSS transform
      }
    }
    this._cam = cam;
  };

  // Canvas px -> on-screen CSS px, through the camera transform.
  LandingFX.prototype._toScreen = function (x, y) {
    var px = x / this.dpr, py = y / this.dpr;
    var cam = this._cam;
    if (!cam) return { x: px, y: py };
    var ox = (this._cssW || 0) * 0.5, oy = (this._cssH || 0) * this.cameraOriginY;
    var a = cam.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    var dx = (px - ox) * cam.scale, dy = (py - oy) * cam.scale;
    return { x: ox + cam.tx + cam.sx + dx * c - dy * s, y: oy + cam.ty + cam.sy + dx * s + dy * c };
  };

  // Plausible mission telemetry for the HUD.
  LandingFX.prototype._telemetry = function (e, st) {
    var alt, vel, dist;
    if (e < SEP) {
      var q = clamp01(e / SEP);
      alt = lerp(12400, 7600, q);
      vel = lerp(1460, 420, easeOutPow(q, 1.3));
      dist = lerp(64, 11.5, easeOutPow(q, 1.2));
    } else if (st.phase === "glide") {
      alt = 7600 * Math.pow(st.h / st.h0, 1.8);
      vel = 420 * Math.pow(1 - st.u, 1.4) + 1.8;
      dist = (st.z - 1) * 0.46;
    } else if (st.phase === "final") {
      alt = 7600 * Math.pow(st.h / st.h0, 1.8);
      vel = lerp(1.8, 0.4, st.f);
      dist = 0;
    } else {
      alt = 0; vel = 0; dist = 0;
    }
    return { alt: alt, vel: vel, dist: dist, t: e };
  };

  /* ---------------------------------------------------------------
     Frame
     --------------------------------------------------------------- */
  /* ---------------------------------------------------------------
     STILL, the landed ship alone, for a composed shot (Section 2):
     frame 033 standing clean on the ground, no dust, debris, wisps,
     shockwave or haze; only the storm sky keeps drifting. The camera
     angle (pose) is a true perspective warp here, not the affine
     approximation: the frame is drawn in thin vertical slices, each
     scaled for its depth after a yaw about the ship's ground centre, so
     the receding side shrinks toward the horizon and the near side
     grows, a far more convincing turn at larger angles.
     --------------------------------------------------------------- */
  LandingFX.prototype.setStill = function (on) {
    var was = this.still;
    this.still = !!on;
    if (this.still) { this.particles = []; this.rocks = []; this.trail = []; this.wake = []; this.smoke = []; }
    if (this.still && !was) { this._stillT0 = performance.now(); this._motes = []; }
  };

  /* ---------------------------------------------------------------
     HATCH SCENE (Section 2 still): the cinematic layer around frame
     034's open hatch, all in frame-034 px run through the same
     perspective warp as the ship, so it holds to the camera angle.
       - lights-on: the airlock interior flickers on as the shot opens
       - vent: vapour bursts from both sides of the hatch as it
         equalises, then a smaller vent every few seconds
       - beam: a warm volumetric spill from the doorway down the ramp
         to the soil, with slowly shifting rays + a light pool below
       - motes: dust drifting through the beam, twinkling in the light
       - flare: a soft anamorphic streak on the hatch's top light strip
       - ground haze: low dust rolling across in front of the ship
     t = ms since the still shot started.
     --------------------------------------------------------------- */
  var HATCH = {
    top: 600, sill: 835, left: 950, right: 1165,       // doorway opening
    groundY: 1090, groundL: 880, groundR: 1560,         // where the beam lands
    lights: [1058, 578]                                 // top light strip centre
  };

  function hatchLightsOn(t) {
    if (t < 250) return 0;
    if (t < 330) return 0.9;
    if (t < 470) return 0.15;
    if (t < 540) return 1;
    if (t < 640) return 0.35;
    return 0.55 + 0.45 * easeOutCubic(clamp01((t - 640) / 800));
  }

  // cone (u across 0..1, v down 0..1) -> frame-034 px
  function hatchCone(u, v) {
    var y = HATCH.top + (HATCH.groundY - HATCH.top) * v;
    var l = HATCH.left + (HATCH.groundL - HATCH.left) * v;
    var r = HATCH.right + (HATCH.groundR - HATCH.right) * v;
    return [l + (r - l) * u, y];
  }

  LandingFX.prototype._hatchT = function () {
    return this.reduceMotion ? 1e5 : performance.now() - (this._stillT0 || performance.now());
  };

  // Behind the ship: the pool of hatch light where the ramp meets the soil.
  LandingFX.prototype._drawHatchGround = function (b, L, pose, alpha) {
    var t = this._hatchT(), on = hatchLightsOn(t) * alpha;
    if (on <= 0.01) return;
    var k = this._rectFor34(L).k;
    var c = this._warpPoint34(L, pose, 1175, HATCH.groundY - 12);
    fillSoftEllipse(b, c.x, c.y, 330 * k * c.s, 52 * k * c.s, [
      [0, rgba(255, 176, 98, 0.55 * on)], [0.5, rgba(240, 132, 62, 0.22 * on)], [1, "rgba(220,110,50,0)"]
    ], "lighter");
  };

  // In front of the ship: beam, rays, motes, vent vapour, flare, haze.
  LandingFX.prototype._drawHatchFX = function (f, L, pose, alpha, dt) {
    var t = this._hatchT();
    var k = this._rectFor34(L).k, self = this;
    var flick = 0.94 + 0.06 * noise(t * 0.01, 11);
    var on = hatchLightsOn(t) * flick * alpha;
    function P(x, y) { return self._warpPoint34(L, pose, x, y); }

    f.save();
    f.globalCompositeOperation = "lighter";

    // interior glow in the doorway
    var dc = P((HATCH.left + HATCH.right) / 2, (HATCH.top + HATCH.sill) / 2);
    fillSoftEllipse(f, dc.x, dc.y, 300 * k * dc.s, 250 * k * dc.s, [
      [0, rgba(255, 176, 96, 0.4 * on)], [0.45, rgba(245, 136, 64, 0.16 * on)], [1, "rgba(220,110,50,0)"]
    ]);

    // volumetric beam: one soft cone + a few drifting rays
    if (on > 0.01) {
      var q = [hatchCone(0, 0.3), hatchCone(1, 0.3), hatchCone(1, 1), hatchCone(0, 1)].map(function (pt) { return P(pt[0], pt[1]); });
      var g = f.createLinearGradient(0, q[0].y, 0, q[2].y);
      g.addColorStop(0, "rgba(255,180,104,0)");
      g.addColorStop(0.25, rgba(255, 184, 108, 0.32 * on));
      g.addColorStop(0.7, rgba(245, 140, 70, 0.16 * on));
      g.addColorStop(1, "rgba(230,120,55,0)");
      f.fillStyle = g;
      f.beginPath(); f.moveTo(q[0].x, q[0].y); f.lineTo(q[1].x, q[1].y); f.lineTo(q[2].x, q[2].y); f.lineTo(q[3].x, q[3].y); f.closePath(); f.fill();
      for (var i = 0; i < 6; i++) {
        var u = 0.1 + i * 0.16 + 0.03 * Math.sin(t / 2600 + i * 1.7);
        var w = 0.035 + 0.02 * Math.sin(t / 3100 + i);
        var ra = (0.14 + 0.1 * Math.sin(t / 1900 + i * 2.3)) * on;
        var a0 = P.apply(null, hatchCone(u - w, 0.32)), a1 = P.apply(null, hatchCone(u + w, 0.32));
        var b1 = P.apply(null, hatchCone(u + w * 1.8, 1)), b0 = P.apply(null, hatchCone(u - w * 1.8, 1));
        var rg = f.createLinearGradient(0, a0.y, 0, b0.y);
        rg.addColorStop(0, "rgba(255,196,128,0)");
        rg.addColorStop(0.2, rgba(255, 200, 134, ra));
        rg.addColorStop(1, "rgba(240,140,70,0)");
        f.fillStyle = rg;
        f.beginPath(); f.moveTo(a0.x, a0.y); f.lineTo(a1.x, a1.y); f.lineTo(b1.x, b1.y); f.lineTo(b0.x, b0.y); f.closePath(); f.fill();
      }
    }

    // dust motes in the beam
    if (!this.reduceMotion && on > 0.01) {
      var motes = this._motes || (this._motes = []);
      var sec = (dt || 16.7) / 1000;
      while (motes.length < 80) motes.push({ u: Math.random(), v: 0.42 + Math.random() * 0.58, vu: rand(-0.012, 0.012), vv: rand(-0.02, 0.01), age: 0, life: rand(3, 8), sz: rand(1, 2.6), ph: Math.random() * 6.28 });
      for (var m = motes.length - 1; m >= 0; m--) {
        var d = motes[m];
        d.age += sec;
        d.u += (d.vu + 0.006 * Math.sin(t / 1500 + d.ph)) * sec;
        d.v += d.vv * sec;
        if (d.age > d.life || d.u < 0 || d.u > 1 || d.v < 0.4 || d.v > 1) { motes.splice(m, 1); continue; }
        var mp = P.apply(null, hatchCone(d.u, d.v));
        var edge = Math.min(d.u, 1 - d.u) * 5;
        var ma = Math.sin(Math.PI * d.age / d.life) * clamp01(edge) * (0.35 + 0.65 * (1 - d.v)) *
          (0.55 + 0.45 * Math.sin(t / 260 + d.ph * 3)) * on;
        var rr = d.sz * this.dpr * mp.s;
        f.fillStyle = rgba(255, 230, 190, ma);
        f.beginPath(); f.arc(mp.x, mp.y, rr, 0, 6.2832); f.fill();
        if (d.sz > 1.7) fillSoftEllipse(f, mp.x, mp.y, rr * 4, rr * 4, [[0, rgba(255, 196, 130, 0.4 * ma)], [1, "rgba(255,170,90,0)"]]);
      }
    }

    // anamorphic flare on the top light strip
    var lp = P(HATCH.lights[0], HATCH.lights[1]);
    drawStreak(f, lp.x, lp.y, 420 * k * lp.s, Math.max(1, 2.6 * k * lp.s), 0.55 * on * (0.8 + 0.2 * Math.sin(t / 1300)));
    f.restore();

    // vent vapour: a strong burst as the hatch equalises, then smaller
    // vents on a loop; pale, not additive, so it reads as vapour
    if (!this.reduceMotion) {
      var cycle = 9000, first = t < cycle;
      var ct = first ? t - 700 : (t - 700) % cycle;
      var strength = first ? 1 : 0.55;
      var sides = [[930, 1000, -1], [1330, 1010, 1]];     // under the hull, either side of the ramp
      for (var sI = 0; sI < 2; sI++) {
        for (var j = 0; j < 9; j++) {
          var age = ct - j * 90 - sI * 70;
          if (age < 0 || age > 3600) continue;
          var pr = age / 3600;
          var jit = Math.sin(j * 12.9898 + sI * 78.233) * 0.5 + 0.5;   // stable per-puff variety
          var out = easeOutPow(pr, 2.2) * (220 + jit * 200);           // rolls out along the soil
          var sx = sides[sI][0] + sides[sI][2] * out + Math.sin(t / 400 + j) * 6;
          var sy = sides[sI][1] + jit * 50 - easeOutPow(pr, 1.3) * (40 + jit * 90);  // hugs the ground, lifts late
          var vp = P(sx, sy);
          var vr = (22 + pr * (110 + jit * 80)) * k * vp.s;
          var fin = clamp01(age / 600); fin = fin * fin * (3 - 2 * fin);
          var va = Math.pow(1 - pr, 1.4) * fin * 0.42 * strength * alpha;
          fillSoftEllipse(f, vp.x, vp.y, vr * (1.3 + jit * 0.6), vr * (0.7 + jit * 0.3), [
            [0, rgba(232, 208, 186, va)], [0.4, rgba(218, 186, 160, va * 0.55)], [1, "rgba(200,160,130,0)"]
          ]);
        }
      }

      // low ground haze rolling across the front of the shot
      var W = this.frontCanvas.width, Hh = this.frontCanvas.height;
      for (var h = 0; h < 3; h++) {
        var hx = ((t * 0.018 * (1 + h * 0.4) * this.dpr + h * W * 0.47) % (W * 1.7)) - W * 0.35;
        var hy = L.feetY + (h - 0.6) * Hh * 0.025;
        fillSoftEllipse(f, hx, hy, W * 0.34, Hh * 0.04, [
          [0, rgba(186, 112, 66, 0.12 * alpha)], [0.6, rgba(170, 98, 56, 0.05 * alpha)], [1, "rgba(160,90,50,0)"]
        ]);
      }
    }
  };

  // Frame-033 pixel -> canvas px under the pose, with perspective.
  LandingFX.prototype._warpPoint = function (L, pose, px, py) {
    var r = L.rectFor(FINAL_IDX), k = L.k33;
    var gx = r.x + F33.cx * k, gy = r.y + F33.feet * k;
    var X = r.x + px * k, Y = r.y + py * k;
    var yaw = (pose && pose.yaw || 0) * Math.PI / 180;
    var dx = (pose && pose.dx || 0) * this.backCanvas.width;
    var focal = L.shipW * 2.6;
    var xr = X - gx;
    var sc = focal / Math.max(focal * 0.2, focal + xr * Math.sin(yaw));
    var hz = this.backCanvas.height * this.horizonY;
    var ground = hz + (gy - hz) * sc;                 // the ground line at that depth
    return { x: gx + dx + xr * Math.cos(yaw) * sc, y: ground - (gy - Y) * sc, s: sc };
  };

  // Same idea as rectFor(FINAL_IDX), but for frame 034 (Section 2 only):
  // its own (cx, feet) land on the layout's screen hull-centre/feet,
  // no SEQ_LOGO dissolve-continuity math, since 034 never dissolves in
  // from frame 032, it just appears.
  LandingFX.prototype._rectFor34 = function (L) {
    var k = L.k33 * (F33.scale / F34.scale);
    return { x: L.shipCX - F34.cx * k, y: L.feetY - F34.feet * k, w: F34.w * k, h: F34.h * k, k: k };
  };

  // Frame-034 pixel -> canvas px under the pose, with perspective,
  // identical math to _warpPoint, just against F34's own rect/cx/feet.
  LandingFX.prototype._warpPoint34 = function (L, pose, px, py) {
    var r = this._rectFor34(L), k = r.k;
    var gx = r.x + F34.cx * k, gy = r.y + F34.feet * k;
    var X = r.x + px * k, Y = r.y + py * k;
    var yaw = (pose && pose.yaw || 0) * Math.PI / 180;
    var dx = (pose && pose.dx || 0) * this.backCanvas.width;
    var focal = L.shipW * 2.6;
    var xr = X - gx;
    var sc = focal / Math.max(focal * 0.2, focal + xr * Math.sin(yaw));
    var hz = this.backCanvas.height * this.horizonY;
    var ground = hz + (gy - hz) * sc;
    return { x: gx + dx + xr * Math.cos(yaw) * sc, y: ground - (gy - Y) * sc, s: sc };
  };

  // Frame 034, warped the same way frame 033 is (see _drawShipWarped),
  // sliced into vertical strips so the "turn to face right" pose reads
  // as perspective, not a flat skew. No dust-mask cleanup needed: unlike
  // 033's photographed dust, 034 is a clean render.
  LandingFX.prototype._drawShip34Warped = function (ctx, L, pose, alpha) {
    if (!f34ImgReady) return this._drawShipWarped(ctx, L, pose, alpha); // frame 033 until it decodes
    var r = this._rectFor34(L);
    var N = 96, sw = F34.w / N;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (var i = 0; i < N; i++) {
      var a = this._warpPoint34(L, pose, i * sw, 0), b = this._warpPoint34(L, pose, (i + 1) * sw, 0);
      var m = this._warpPoint34(L, pose, (i + 0.5) * sw, 0);
      var w = b.x - a.x;
      if (w <= 0) continue;
      ctx.drawImage(f34Img, i * sw, 0, sw, F34.h, a.x, m.y, w + 0.8, r.h * m.s);
    }
    ctx.restore();
  };

  // A clean copy of frame 033 for the still shot: the painted dust band
  // and flying debris removed. Done with a SHAPE mask, not by colour
  // (the legs/pads are dust-tinted and would go too): everything above
  // the rim is kept, plus the hull underside, the two leg struts and the
  // foot pads (frame-033 px, after its roll bake); everything else below
  // the rim, which is only dust and debris, is cut away, with a soft
  // (blurred) mask edge so nothing looks clipped.
  LandingFX.prototype._cleanFinal = function () {
    if (this._cleanF33) return this._cleanF33;
    var seq = this.sequence;
    if (!seq || !this._prepareFinal()) return null;
    var W = F33.w, H = F33.h;
    var m = document.createElement("canvas");
    m.width = W; m.height = H;
    var mx = m.getContext("2d");
    mx.filter = "blur(6px)";
    mx.fillStyle = mx.strokeStyle = "#fff";
    mx.fillRect(90, 0, W - 180, 1150);                       // everything above the rim
    mx.beginPath();                                          // hull underside
    [[90, 1150], [110, 1195], [300, 1275], [520, 1325], [905, 1350], [1300, 1325], [1530, 1275], [1710, 1205], [1730, 1150]]
      .forEach(function (q, i) { if (i) mx.lineTo(q[0], q[1]); else mx.moveTo(q[0], q[1]); });
    mx.closePath(); mx.fill();
    mx.lineCap = "round"; mx.lineWidth = 125;                   // leg struts
    mx.beginPath(); mx.moveTo(400, 1200); mx.lineTo(285, 1335); mx.stroke();
    mx.beginPath(); mx.moveTo(1370, 1210); mx.lineTo(1495, 1350); mx.stroke();
    mx.beginPath(); mx.ellipse(272, 1368, 138, 46, 0, 0, Math.PI * 2); mx.fill();   // foot pads
    mx.beginPath(); mx.ellipse(1522, 1398, 136, 48, 0, 0, Math.PI * 2); mx.fill();
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var x = c.getContext("2d");
    x.drawImage(seq.images[FINAL_IDX], 0, 0);
    x.globalCompositeOperation = "destination-in";
    x.drawImage(m, 0, 0);
    this._cleanF33 = c;
    return c;
  };

  LandingFX.prototype._drawShipWarped = function (ctx, L, pose, alpha) {
    var seq = this.sequence;
    if (!seq || !this._prepareFinal()) return;
    var img = this._cleanFinal() || seq.images[FINAL_IDX];
    var r = L.rectFor(FINAL_IDX);
    var N = 96, sw = F33.w / N;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (var i = 0; i < N; i++) {
      var a = this._warpPoint(L, pose, i * sw, 0), b = this._warpPoint(L, pose, (i + 1) * sw, 0);
      var m = this._warpPoint(L, pose, (i + 0.5) * sw, 0);
      var w = b.x - a.x;
      if (w <= 0) continue;
      ctx.drawImage(img, i * sw, 0, sw, F33.h, a.x, m.y, w + 0.8, r.h * m.s);   // +0.8: no hairline seams
    }
    ctx.restore();
  };

  // The GLIMPSE mothership, drifting past in the far sky (glimpse-orbiter.js).
  // Drawn straight in screen space, no camera transform, since at that
  // distance the terrain's push-in/shake would never actually move it.
  LandingFX.prototype._drawOrbiter = function (ctx) {
    if (this.reduceMotion || typeof GlimpseOrbiter === "undefined") return;
    GlimpseOrbiter.draw(ctx, this.frontCanvas.width, this.frontCanvas.height, { dpr: this.dpr });
  };

  LandingFX.prototype._renderStill = function (e, dt) {
    this._lastElapsed = e;
    var st = { phase: "landed", v: FINAL_IDX, z: 1, h: 0, X: 0, tilt: 0, clear: 1 };
    var L = this._layout(st);
    var ps = this._poseState(performance.now());
    var pose = ps.pose;
    var b = this.backCtx, f = this.frontCtx;

    b.clearRect(0, 0, this.backCanvas.width, this.backCanvas.height);
    if (this.sky) this.sky.draw(b, this);   // Martian night sky (sky-fx.js)
    // No storm wall here by design: that belongs to the active landing
    // shot (Section 1) alone. Section 2's calm, already-landed view
    // matches every later chapter, sky + terrain, no swirling "smoke"
    // behind the ship.
    // soft ground shadow + contact shadows under the (warped) pads,
    // frame 034's own three legs.
    var c = this._warpPoint34(L, pose, F34.cx, F34.feet);
    fillSoftEllipse(b, c.x, c.y, L.shipW * 0.52 * c.s, L.shipW * 0.07 * c.s, [
      [0, rgba(26, 12, 7, 0.42 * ps.alpha)], [0.6, rgba(26, 12, 7, 0.2 * ps.alpha)], [1, "rgba(26,12,7,0)"]
    ]);
    for (var i = 0; i < F34.pads.length; i++) {
      var pp = this._warpPoint34(L, pose, F34.pads[i], F34.feet);
      var rx = F34.padW[i] * L.k33 * (F33.scale / F34.scale) * 0.62 * pp.s;
      fillSoftEllipse(b, pp.x, pp.y + rx * 0.02, rx, rx * 0.18, [
        [0, rgba(14, 6, 3, 0.62 * ps.alpha)], [0.55, rgba(20, 9, 5, 0.3 * ps.alpha)], [1, "rgba(20,9,5,0)"]
      ]);
    }

    this._drawHatchGround(b, L, pose, ps.alpha);

    var sctx = this.sequence.ctx;
    sctx.clearRect(0, 0, sctx.canvas.width, sctx.canvas.height);
    this._drawShip34Warped(sctx, L, pose, ps.alpha);

    f.clearRect(0, 0, this.frontCanvas.width, this.frontCanvas.height);
    if (f34ImgReady) this._drawHatchFX(f, L, pose, ps.alpha, dt);
    // anti-collision strobe on the spire, same double blink
    var ph = e % 1800;
    var on = (ph < 70 ? 1 - ph / 70 * 0.3 : (ph > 230 && ph < 300 ? 1 - (ph - 230) / 70 * 0.3 : 0)) * ps.alpha;
    if (on) {
      var bp = this._warpPoint34(L, pose, F34_SPIRE[0], F34_SPIRE[1]);
      var br = Math.max(2 * this.dpr, L.shipW * 0.018) * bp.s;
      fillSoftEllipse(f, bp.x, bp.y, br * 4, br * 4, [[0, rgba(255, 60, 40, 0.45 * on)], [1, "rgba(255,40,30,0)"]], "lighter");
      fillSoftEllipse(f, bp.x, bp.y, br, br, [[0, rgba(255, 235, 225, on)], [0.5, rgba(255, 80, 60, 0.8 * on)], [1, "rgba(255,40,30,0)"]], "lighter");
      drawStreak(f, bp.x, bp.y, br * 14, Math.max(1, br * 0.18), 0.35 * on);
    }

    if (this.sky) this.sky.drawLabels(f, this);
    this._drawOrbiter(f);
    // The ambient storm cell (glimpse-orbiter.js's sibling, ambient-
    // storm.js), same top-right spot as every chapter.
    if (typeof AmbientStorm !== "undefined" && !this.reduceMotion) {
      AmbientStorm.draw(f, this.frontCanvas.width, this.frontCanvas.height);
    }
    this._camera(e, L);
    var info = { elapsed: e, phase: "still", ship: this._toScreen(c.x, c.y), shipWidth: L.shipW / this.dpr, shake: { x: 0, y: 0 }, telemetry: { alt: 0, vel: 0, dist: 0, t: e } };
    if (this.onFrame) this.onFrame(info);
    return info;
  };

  LandingFX.prototype._render = function (e, dt) {
    if (this.still) return this._renderStill(e, dt);
    this._lastElapsed = e;
    var st = stateAt(e, this.groundY - this.horizonY, this.horizonY);
    var L = this._layout(st);

    this._updateEntry(e);
    this._separate(e);
    this._updateSeparation(e, dt);
    this._updateTrail(L, st, e);
    this._updateRocks(L, e, dt);
    this._spawnDust(L, e <= DURATION_MS && st.phase !== "entry" ? dustSpawnRate(st.v + 1) : 0, dt);
    if (e > DURATION_MS) this._spawnWisps(L, dt);
    this._advanceDust(dt);

    // Right after separation the shield is between the camera and the
    // ship; once it falls away it's behind the approaching ship.
    var shieldInFront = this.shield && e - this.shield.t0 < 520;
    var b = this.backCtx, f = this.frontCtx;
    b.clearRect(0, 0, this.backCanvas.width, this.backCanvas.height);
    if (this.sky) this.sky.draw(b, this);   // Martian night sky (sky-fx.js), behind the storm
    this._drawStorm(b, e, stormRiseAt(e));
    this._drawSmoke(b, e);
    this._drawPlumes(b, e);
    this._drawTrail(b, e);
    if (!shieldInFront) this._drawShield(b, e);
    this._drawShadow(b, L, st);
    this._drawPadContact(b, L, st);
    this._drawGroundLight(b, L, st, e);
    this._drawShockwave(b, L, e);
    this._drawImpactHaze(b, L, e, 1);
    this._drawDust(b, "back");
    this._drawRocks(b, false);

    this._drawShip(e, st, L);

    f.clearRect(0, 0, this.frontCanvas.width, this.frontCanvas.height);
    this._drawEntryHead(f, e);
    this._drawThrust(f, L, st, e);
    this._drawSeparation(f, e);
    if (shieldInFront) this._drawShield(f, e);
    this._drawPuffs(f, e);
    this._drawSparks(f, e);
    this._drawBloom(f, L, st, e);
    this._drawBeacon(f, L, st, e);
    this._drawGroundBlend(f, L, st, e);
    this._drawImpactHaze(f, L, e, 0.35);
    this._drawDust(f, "front");
    this._drawRocks(f, true);
    if (this.sky) this.sky.drawLabels(f, this);
    this._drawOrbiter(f);
    // The ambient storm cell also rides over the landing shot, same
    // top-right spot as every other chapter, so it's there from the very
    // first section and carries straight through.
    if (typeof AmbientStorm !== "undefined" && !this.reduceMotion) {
      AmbientStorm.draw(f, this.frontCanvas.width, this.frontCanvas.height);
    }

    this._camera(e, L);

    // HUD target: the fireball during entry, then the top of the ship
    // (above the hull, so the marker and its label sit against the sky).
    var target = e < SEP ? this._entryPoint(e) : { x: L.shipCX + L.shipW * 0.05, y: L.feetY - SHIP_HEIGHT * 0.86 * L.s };
    var info = {
      elapsed: e, phase: st.phase,
      ship: this._toScreen(target.x, target.y),
      shipWidth: (e < SEP ? target.r * 4 : L.shipW) / this.dpr * ((this._cam && this._cam.scale) || 1),
      shake: this._cam ? { x: this._cam.sx, y: this._cam.sy } : { x: 0, y: 0 },
      telemetry: this._telemetry(e, st)
    };
    if (this.onFrame) this.onFrame(info);
    return info;
  };

  LandingFX.prototype.update = function (elapsed) {
    cancelAnimationFrame(this._idleRAF);
    this._idleRAF = 0;
    var dt = this._lastTs == null ? 16.6667 : Math.max(0, Math.min(100, elapsed - this._lastTs));
    this._lastTs = elapsed;
    var out = this._render(Math.min(elapsed, DURATION_MS), dt);
    out.done = elapsed >= DURATION_MS;
    return out;
  };

  // After touchdown: dust clears to frame 033, wisps drift, beacon
  // blinks, camera keeps drifting, until reset().
  LandingFX.prototype.runIdle = function () {
    cancelAnimationFrame(this._idleRAF);
    if (this.reduceMotion) { this._render(DURATION_MS + CLEAR_MS, 0); return; }
    var self = this;
    var start = null, last = null;
    var from = Math.max(DURATION_MS, this._lastElapsed || 0);   // continue, never replay
    function tick(ts) {
      if (start === null) start = ts;
      var dt = last == null ? 16.6667 : Math.min(100, ts - last);
      last = ts;
      self._render(from + (ts - start), dt);
      self._idleRAF = requestAnimationFrame(tick);
    }
    this._idleRAF = requestAnimationFrame(tick);
  };

  /* ===============================================================
     ASCENT, "Link established": the landing played back the other way.
     The About storybook's second-to-last page (about-story.js) reuses
     this whole compositor (same sky, storm, camera rig, calibrated
     ground line and ship placement) and flies the ship home:

       0.0s  PAD         Frame 033 on the pad, beacon blinking.
       1.6s  IGNITION    Main engines light: 033 dissolves into the
                         burning frames, dust boils off the pad.
       2.8s  LIFTOFF     Frames run 022 -> 001 as the ship climbs; the
                         launch throws a dust wall across the plain.
                         Exhaust trail, shake, flash.
       5.2s  PITCH       The ship arcs up toward the GLIMPSE orbiter (the
                         same small ship that drifts through every page),
                         shrinking into the distance on its own plume; the
                         habitat (frame 039) emerges from the settling
                         dust where the ship stood.
      10.6s  RENDEZVOUS  The ship reaches the exact point in the sky where
                         Section 1's descent began (frame 001's start),
                         just as the orbiter's pass crosses it
                         (GlimpseOrbiter.syncX), and joins it, no
                         docking close-up.
      11.4s  BOOM IN     Rendezvous confirmed: the whole shot booms in on
                         the habitat, a ~2x dolly push with a crane arc
                         and a settling roll, dust streaking past the lens,
                         the dome lights blooming as it lands. The sky
                         (stars, orbiter, storm cell) stays put, as far
                         things do, so the links stretch up to it.
      12.0s  LINK        The habitat's dishes throw live data links up to
                         the orbiter, locked on it as it drifts on.
      13.8s  DONE        Caption time (about-story.js); links keep
                         pulsing until reset().
     Every frame reports the ship / habitat / orbiter screen points and
     telemetry to the callback passed to playAscent(), for the HUD.
     =============================================================== */
  var ASCENT = {
    ignite: 1600, lift: 2800, pitch: 5200, insert: 7600, rendezvous: 9000,
    dock: 10600, merge: 11200, link: 12000, approach: 11400, done: 14200
  };
  var BOOM_MS = 2700;                 // the camera's boom-in to the habitat once the rendezvous is confirmed
  var BOOM_ZOOM = 1.85;               // how far it pushes in (whole frame)
  var ASC_E = 1e6;                    // landing-clock offset: every "after touchdown" effect is fully on
  var ASC_IGNITE_IDX = 21;            // frame 022: engines at full burn, ship still on the pad
  var ASC_CLIMB_IDX = 12;             // frame 013: where the lift-off hands over to the climb

  var HAB_IMG_SRC = "../static/assets/about/glimpse-habitat-039.png";
  var HAB = {
    w: 1525, h: 975, z: 2.4, X: -0.04, width: 1.25, base: 0.985,            // width: hull widths
    dishes: [[0.8156, 0.1484], [0.106, 0.313], [0.3605, 0.3518], [0.301, 0.535]],
    beacons: [[0.2112, 0.094], [0.2525, 0.1384], [0.4355, 0.22], [0.6508, 0.1269], [0.6919, 0.0452], [0.916, 0.442], [0.323, 0.3805]],
    dome: [0.628, 0.52], door: [0.641, 0.707], top: [0.637, 0.26]
  };
  var habImg = null;
  function loadAscentArt() {
    if (habImg) return;
    habImg = new Image(); habImg.decoding = "async"; habImg.src = HAB_IMG_SRC;
  }
  function imgReady(img) { return img && img.complete && img.naturalWidth > 0; }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeInPow(t, p) { return Math.pow(t, p); }

  LandingFX.ASCENT = ASCENT;
  LandingFX.preloadAscent = loadAscentArt;

  // Start the ascent shot. onFrame(info) is called every frame.
  LandingFX.prototype.playAscent = function (onFrame) {
    loadAscentArt();
    this.reset();
    this._prepareFinal();
    this.ascent = { onFrame: onFrame || null, trail: [], stormed: false, lastTrail: -1e9 };
    // Time the orbiter's pass so it crosses the descent's start point just
    // as the ship gets there.
    if (typeof GlimpseOrbiter !== "undefined") {
      var m = this._descentStart();
      GlimpseOrbiter.syncX(m.x / this.frontCanvas.width, this.reduceMotion ? 0 : ASCENT.dock, this.frontCanvas.width, this.frontCanvas.height);
    }
    var self = this;
    if (this.reduceMotion) { this._renderAscent(ASCENT.done + 4000, 0); return; }
    var start = null, last = null;
    function tick(ts) {
      if (!self.ascent) return;
      if (start === null) start = ts;
      var dt = last == null ? 16.6667 : Math.min(100, ts - last);
      last = ts;
      self._renderAscent(ts - start, dt);
      self._idleRAF = requestAnimationFrame(tick);
    }
    this._idleRAF = requestAnimationFrame(tick);
  };

  // Where Section 1's descent begins: the ship's screen point (and hull
  // width) at the start of the glide, frame 001. Canvas px.
  LandingFX.prototype._descentStart = function () {
    var L = this._layout(stateAt(SEP, this.groundY - this.horizonY, this.horizonY));
    return { x: L.shipCX, y: L.pivotY, w: L.shipW };
  };

  // The GLIMPSE orbiter (glimpse-orbiter.js, its usual size and pass):
  // where it is now, and where it will be at the rendezvous, the point
  // the ship flies to. Canvas px.
  LandingFX.prototype._ascentOrbiter = function (a) {
    var cw = this.frontCanvas.width, ch = this.frontCanvas.height;
    if (typeof GlimpseOrbiter === "undefined") {
      var m = this._descentStart();
      var fixed = { x: m.x, y: m.y, iw: m.w, ih: m.w * 0.6, node: { x: m.x, y: m.y } };
      return { live: fixed, meet: { x: m.x, y: m.y, w: m.w * 0.4 } };
    }
    // It's drawn in screen space (it's in the sky: the camera never moves
    // it), so its points are mapped back through the camera into the
    // world layers the ship and the links are drawn in.
    var live = GlimpseOrbiter.position(cw, ch);
    var at = GlimpseOrbiter.position(cw, ch, Math.max(0, ASCENT.dock - a));
    var ln = this._unCam(live.node.x, live.node.y), lc = this._unCam(live.x, live.y), mt = this._unCam(at.node.x, at.node.y);
    // the ship arrives a touch smaller than the orbiter it's rejoining
    return { live: { x: lc.x, y: lc.y, iw: live.iw, ih: live.ih, node: ln, screenNode: live.node },
      meet: { x: mt.x, y: mt.y, w: at.iw * 0.42 } };
  };

  // Flight state for ascent time a: a landing-style state (so every
  // existing effect can draw from it) plus ship alpha / dock progress.
  LandingFX.prototype._ascentState = function (a, orb) {
    var cw = this.backCanvas.width, ch = this.backCanvas.height;
    var G = (this.groundY - this.horizonY) * ch, hor = ch * this.horizonY;
    var st = { phase: "landed", v: FINAL_IDX, z: 1, h: 0, X: 0, tilt: 0, clear: 1 };
    var out = { st: st, alpha: 1, ignite: 0, dock: 0, flying: false };
    if (a < ASCENT.ignite) return out;
    if (a < ASCENT.lift) {
      out.ignite = easeInOutSine(clamp01((a - ASCENT.ignite) / 700));
      st.v = ASC_IGNITE_IDX; st.clear = null;
      st.tilt = wobble(a, 0.002) * out.ignite;
      return out;
    }
    out.ignite = 1; out.flying = true; st.clear = null;
    var L0 = this._layout({ z: 1, h: 0, X: 0, tilt: 0 });
    var W0 = L0.shipW;
    // lift-off: straight up off the pad, accelerating
    var u = clamp01((a - ASCENT.lift) / (ASCENT.pitch - ASCENT.lift));
    var hL = 0.3 * easeInPow(u, 1.8);
    var zL = 1 + 0.4 * u * u;
    if (a < ASCENT.pitch) {
      st.v = lerp(ASC_IGNITE_IDX, ASC_CLIMB_IDX, u);
      st.h = hL; st.z = zL; st.X = 0; st.tilt = wobble(a, 0.004);
      return out;
    }
    // climb: a curve from the top of the lift-off up to the docking node,
    // the hull shrinking (log scale) from its lift-off size to a speck
    var Le = this._layout({ z: 1.4, h: 0.3, X: 0, tilt: 0 });
    var p0 = { x: Le.shipCX, y: Le.pivotY };
    var Wd = orb.meet.w;                // frame 001's size at the start of the descent
    var p2 = { x: orb.meet.x, y: orb.meet.y };
    var p1 = { x: lerp(p0.x, p2.x, 0.08), y: lerp(p0.y, p2.y, 0.72) };
    var w = clamp01((a - ASCENT.pitch) / (ASCENT.dock - ASCENT.pitch));
    var k = easeInOutCubic(w);
    var q = 1 - k;
    var sx = q * q * p0.x + 2 * q * k * p1.x + k * k * p2.x;
    var sy = q * q * p0.y + 2 * q * k * p1.y + k * k * p2.y;
    var tx = 2 * q * (p1.x - p0.x) + 2 * k * (p2.x - p1.x);
    var ty = 2 * q * (p1.y - p0.y) + 2 * k * (p2.y - p1.y);
    var W1 = Le.shipW;
    var Wk = W1 * Math.pow(Wd / W1, easeOutPow(w, 1.35));
    if (a >= ASCENT.dock) {
      // rendezvous: it simply joins the orbiter at that point
      var m = clamp01((a - ASCENT.dock) / (ASCENT.merge - ASCENT.dock));
      out.dock = m;
      out.alpha = 1 - easeInOutSine(m);
      sx = orb.live.node.x; sy = orb.live.node.y; tx = 0.3; ty = -1;
      if (a >= ASCENT.merge) out.alpha = 0;
    }
    var z = W0 / Math.max(1e-3, Wk);
    var s = (this._layout({ z: 1, h: 0, X: 0 }).s) / z;
    var feetY = sy + SHIP_HEIGHT * 0.45 * s;
    st.z = z;
    st.X = (sx / cw - 0.5) * z;
    st.h = (G - (feetY - hor) * z) / ch;
    st.v = lerp(ASC_CLIMB_IDX, 0, clamp01(w * 1.25));
    var lean = Math.atan2(tx, -ty);
    st.tilt = Math.max(-0.2, Math.min(0.2, lean * 0.3)) * (1 - out.dock) + wobble(a, 0.003);
    return out;
  };

  // The ship: 033 on the pad, dissolving into the burning frames at
  // ignition, then the sequence played backwards as it climbs.
  LandingFX.prototype._drawAscentShip = function (a, S, L) {
    var seq = this.sequence;
    if (!seq) return;
    if (S.alpha <= 0.002) { seq.ctx.clearRect(0, 0, seq.canvas.width, seq.canvas.height); return; }
    var fin = this._finalReady ? FINAL_IDX : LAST_SEQ;
    var st = S.st;
    var rot = L.tilt ? { angle: L.tilt, x: L.shipCX, y: L.pivotY } : null;
    if (S.ignite <= 0) {
      seq.drawBlend(fin, L.rectFor(fin), fin, L.rectFor(fin), 0, { alpha: S.alpha });
      return;
    }
    if (!S.flying) {
      seq.drawBlend(fin, L.rectFor(fin), ASC_IGNITE_IDX, L.rectFor(ASC_IGNITE_IDX), S.ignite, {
        mode: "over", alphaA: 1 - Math.pow(S.ignite, 1.6), alphaB: clamp01(S.ignite * 1.4),
        fadeB: { x: 0.14, bottom: 0.12 }, rotate: rot
      });
      return;
    }
    var v = Math.max(0, Math.min(ASC_IGNITE_IDX, st.v));
    var i1 = Math.ceil(v), i0 = Math.max(0, i1 - 1), t = v - i0;
    if (i1 === i0) t = 0;
    var far = clamp01((st.z - 1) / (Z_FAR - 1));
    var haze = Math.pow(far, 0.6) * 0.7;
    var filter = haze > 0.02
      ? "brightness(" + lerp(1, 0.82, haze).toFixed(3) + ") contrast(" + lerp(1, 0.7, haze).toFixed(3) +
        ") saturate(" + lerp(1, 0.6, haze).toFixed(3) + ") sepia(" + lerp(0, 0.3, haze).toFixed(3) + ")"
      : "none";
    var lowFade = 1 - clamp01(st.h / 0.2);
    seq.drawBlend(i0, L.rectFor(i0), i1, L.rectFor(i1), t, {
      alpha: S.alpha, filter: filter, rotate: rot,
      fadeX: lerp(0.08, 0.14, lowFade), fadeBottom: lerp(0.03, 0.12, lowFade)
    });
  };

  // Far-flight plume: once the baked flames run out (frames 001-008)
  // the ship keeps burning on a live plume, bloom and streak.
  LandingFX.prototype._drawAscentPlume = function (ctx, L, st, a, alpha) {
    var baked = flameLenAt(Math.max(0, Math.min(LAST_SEQ, st.v)));
    var amt = clamp01((150 - baked) / 110) * alpha;
    if (amt <= 0.01) return;
    var far = clamp01((st.z - 1) / (Z_FAR - 1));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (L.tilt) { ctx.translate(L.shipCX, L.pivotY); ctx.rotate(L.tilt); ctx.translate(-L.shipCX, -L.pivotY); }
    for (var n = 0; n < NOZZLES.length; n++) {
      var nx = L.shipCX + NOZZLES[n] * L.shipW, ny = L.nozzleY;
      var fl = 0.85 + 0.15 * noise(a * 0.9, n * 7 + 1);
      var len = L.shipW * lerp(0.55, 1.4, far) * fl;
      var wid = Math.max(1.2 * this.dpr, L.shipW * 0.05);
      var g = ctx.createLinearGradient(0, ny, 0, ny + len);
      g.addColorStop(0, rgba(255, 250, 235, 0.95 * amt));
      g.addColorStop(0.12, rgba(255, 214, 140, 0.8 * amt));
      g.addColorStop(0.45, rgba(255, 140, 50, 0.4 * amt));
      g.addColorStop(1, "rgba(229,90,30,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(nx - wid, ny);
      ctx.quadraticCurveTo(nx - wid * 1.6, ny + len * 0.35, nx, ny + len);
      ctx.quadraticCurveTo(nx + wid * 1.6, ny + len * 0.35, nx + wid, ny);
      ctx.closePath();
      ctx.fill();
      var r = Math.max(3 * this.dpr, L.shipW * 0.12) * lerp(1, 2.6, far);
      fillSoftEllipse(ctx, nx, ny + r * 0.2, r, r * 1.3, [
        [0, rgba(255, 244, 220, 0.8 * amt * fl)], [0.3, rgba(255, 190, 100, 0.4 * amt)], [1, "rgba(229,125,35,0)"]
      ]);
    }
    ctx.restore();
    drawStreak(ctx, L.shipCX, L.nozzleY, this.backCanvas.width * lerp(0.08, 0.22, far),
      Math.max(1.2 * this.dpr, L.shipW * 0.012), 0.45 * amt);
  };

  // Exhaust column: puffs laid along the flight path that swell, drift
  // and cool, a smoke trail hanging in the sky behind the ship.
  LandingFX.prototype._updateAscentTrail = function (a, L, st, S) {
    var tr = this.ascent.trail;
    if (S.flying && S.alpha > 0.3 && a - this.ascent.lastTrail > 45) {
      this.ascent.lastTrail = a;
      tr.push({ x: L.shipCX, y: L.nozzleY + L.shipW * 0.2, t: a, r: Math.max(2.5 * this.dpr, L.shipW * 0.16), low: st.h < 0.35 });
    }
    while (tr.length && a - tr[0].t > 7000) tr.shift();
  };

  LandingFX.prototype._drawAscentTrail = function (ctx, a) {
    var tr = this.ascent.trail;
    for (var i = 0; i < tr.length; i++) {
      var d = tr[i], age = (a - d.t) / 7000;
      if (age < 0.01) continue;
      var r = d.r * (1 + age * (d.low ? 5 : 3.2));
      var al = (d.low ? 0.2 : 0.16) * Math.pow(1 - age, 1.6) * clamp01(age * 12);
      fillSoftEllipse(ctx, d.x + age * r * 0.4, d.y + age * d.r * 0.6, r, r * 0.85, [
        [0, rgba(lerp(250, 196, age), lerp(200, 150, age), lerp(160, 128, age), al)],
        [0.6, rgba(180, 130, 110, al * 0.4)],
        [1, "rgba(160,110,90,0)"]
      ]);
    }
  };

  // Ground-plane art at world depth z / lateral X (feet on the terrain).
  LandingFX.prototype._groundArt = function (img, z, X, widthUnits, imgW, imgH, base) {
    var p = this._project(z, 0, X);
    var w = p.unit * widthUnits, h = w * imgH / imgW;
    return { x: p.x - w / 2, y: p.ground - h * (base || 1), w: w, h: h, unit: p.unit, ground: p.ground, cx: p.x };
  };

  LandingFX.prototype._drawHabitatAscent = function (b, a) {
    if (!imgReady(habImg)) return null;
    var al = easeInOutSine(clamp01((a - (ASCENT.lift + 900)) / 3400));
    var r = this._groundArt(habImg, HAB.z, HAB.X, HAB.width, HAB.w, HAB.h, HAB.base);
    r.alpha = al;
    if (al <= 0.01) return r;
    b.save();
    b.globalAlpha = al;
    fillSoftEllipse(b, r.cx, r.ground, r.w * 0.56, r.w * 0.05, [[0, "rgba(24,10,5,0.6)"], [1, "rgba(24,10,5,0)"]]);
    b.filter = "brightness(0.88) saturate(0.84) contrast(0.95) sepia(0.12)";
    b.drawImage(habImg, r.x, r.y, r.w, r.h);
    b.filter = "none";
    b.restore();
    return r;
  };

  // Habitat lights on the front layer: dome glow, red mast strobes.
  LandingFX.prototype._drawHabitatLights = function (f, r, a) {
    if (!r || !(r.alpha > 0.01)) return;
    var al = r.alpha;
    var pt = function (q) { return { x: r.x + q[0] * r.w, y: r.y + q[1] * r.h }; };
    var dome = pt(HAB.dome);
    var land = this._boom ? Math.max(0, 1 - Math.abs(this._boom - 0.92) / 0.3) : 0;   // arrival swell
    var br = 0.75 + 0.25 * Math.sin(a * 0.0016) + 1.2 * land;
    fillSoftEllipse(f, dome.x, dome.y, r.w * 0.24, r.w * 0.2, [
      [0, rgba(255, 196, 110, 0.18 * al * br)], [1, "rgba(255,160,70,0)"]
    ], "lighter");
    var door = pt(HAB.door);
    fillSoftEllipse(f, door.x, door.y + r.h * 0.12, r.w * 0.12, r.w * 0.04, [
      [0, rgba(255, 206, 130, 0.35 * al)], [1, "rgba(255,160,70,0)"]
    ], "lighter");
    if (land > 0.01) drawStreak(f, door.x, door.y - r.h * 0.05, r.w * 0.9, Math.max(1.5 * this.dpr, r.w * 0.006), 0.7 * land * al);
    for (var i = 0; i < HAB.beacons.length; i++) {
      var p = pt(HAB.beacons[i]);
      var ph = (a + i * 410) % 1800;
      var on = ph < 70 ? 1 - ph / 70 * 0.3 : (ph > 230 && ph < 300 ? 1 - (ph - 230) / 70 * 0.3 : 0);
      if (!on) continue;
      var rr = Math.max(1.5 * this.dpr, r.w * 0.006);
      fillSoftEllipse(f, p.x, p.y, rr * 5, rr * 5, [[0, rgba(255, 60, 40, 0.5 * on * al)], [1, "rgba(255,40,30,0)"]], "lighter");
      fillSoftEllipse(f, p.x, p.y, rr, rr, [[0, rgba(255, 235, 225, on * al)], [1, "rgba(255,60,40,0)"]], "lighter");
    }
  };

  // Data links: each dish throws a beam up to the orbiter, locked on it,
  // following it as it drifts along its pass, then packets stream along
  // it and the dishes ping.
  LandingFX.prototype._drawLinks = function (f, r, orb, a) {
    if (!r || !(r.alpha > 0.5) || a < ASCENT.link) return;
    var target = { x: orb.live.x, y: orb.live.y };
    f.save();
    f.globalCompositeOperation = "lighter";
    for (var i = 0; i < HAB.dishes.length; i++) {
      var d = { x: r.x + HAB.dishes[i][0] * r.w, y: r.y + HAB.dishes[i][1] * r.h };
      var p = easeOutCubic(clamp01((a - ASCENT.link - i * 260) / 900));
      if (p <= 0) continue;
      var ex = lerp(d.x, target.x, p), ey = lerp(d.y, target.y, p);
      var g = f.createLinearGradient(d.x, d.y, ex, ey);
      g.addColorStop(0, "rgba(255,214,150,0.55)");
      g.addColorStop(1, "rgba(255,236,200,0.2)");
      f.strokeStyle = "rgba(255,170,80,0.08)";
      f.lineWidth = 6 * this.dpr;
      f.beginPath(); f.moveTo(d.x, d.y); f.lineTo(ex, ey); f.stroke();
      f.strokeStyle = g;
      f.lineWidth = Math.max(1, 1 * this.dpr);
      f.setLineDash([6 * this.dpr, 5 * this.dpr]);
      f.lineDashOffset = -a * 0.04 * this.dpr;
      f.beginPath(); f.moveTo(d.x, d.y); f.lineTo(ex, ey); f.stroke();
      f.setLineDash([]);
      // packets
      if (p >= 1) {
        for (var k = 0; k < 3; k++) {
          var u = ((a * 0.00042 + i * 0.29 + k / 3) % 1);
          var px = lerp(d.x, target.x, u), py = lerp(d.y, target.y, u);
          fillSoftEllipse(f, px, py, 3.5 * this.dpr, 3.5 * this.dpr, [[0, "rgba(255,246,225,0.95)"], [1, "rgba(255,200,120,0)"]]);
        }
        var ping = ((a - ASCENT.link) % 1700) / 1700;
        f.strokeStyle = rgba(255, 214, 150, 0.6 * (1 - ping));
        f.lineWidth = Math.max(1, this.dpr);
        f.beginPath(); f.ellipse(d.x, d.y, r.w * 0.05 * (0.3 + ping), r.w * 0.02 * (0.3 + ping), 0, 0, Math.PI * 2); f.stroke();
      }
      fillSoftEllipse(f, d.x, d.y, 5 * this.dpr, 5 * this.dpr, [[0, "rgba(255,236,190,0.9)"], [1, "rgba(255,190,100,0)"]]);
    }
    f.restore();
  };

  LandingFX.prototype._cameraAscent = function (a, L, S) {
    var flash = 0;
    var ig = a - ASCENT.ignite;
    if (ig >= 0 && ig < 900) flash = 0.12 * Math.exp(-ig / 260);
    var lf = a - ASCENT.lift;
    if (lf >= 0 && lf < 900) flash = Math.max(flash, 0.18 * Math.exp(-lf / 200));
    if (this.flashEl) this.flashEl.style.opacity = flash.toFixed(3);
    var cam = { tx: 0, ty: 0, rot: 0, scale: 1, sx: 0, sy: 0 };
    var boom = this.reduceMotion ? 1 : clamp01((a - ASCENT.approach) / BOOM_MS);
    this._boom = boom;
    if (this.cameraEls.length) {
      var W = this._cssW || 1, H = this._cssH || 1;
      // follow the climb: tilt up (world drifts down) and ease back out
      var up = easeInOutSine(clamp01((a - ASCENT.lift) / 6000));
      cam.scale = 1.1 + 0.04 * easeInOutSine(clamp01(a / ASCENT.lift)) - 0.03 * up;
      cam.ty = H * 0.032 * up;
      var tgt = S.alpha > 0.05 ? -((L.shipCX / this.dpr) / W - 0.5) * W * 0.05 : 0;
      this._camX = this._camX == null ? tgt : lerp(this._camX, tgt, 0.04);
      cam.tx = this._camX + noise(a * 0.01, 1) * 2.2;
      cam.ty += noise(a * 0.01, 5) * 1.6;
      cam.rot = noise(a * 0.006, 9) * 0.08;
      // engine rumble: builds at ignition, peaks at lift-off, fades with height
      var rumble = 0;
      if (a >= ASCENT.ignite && a < ASCENT.pitch + 1500) {
        rumble = clamp01((a - ASCENT.ignite) / 900) * (1 - clamp01((a - ASCENT.lift - 600) / 3200));
        if (lf >= 0 && lf < 700) rumble += 1.4 * Math.exp(-lf / 240);
      }
      if (rumble > 0.01) {
        cam.sx = noise(a * 1.4, 2) * 4 * rumble;
        cam.sy = noise(a * 1.7, 4) * 6 * rumble;
        cam.rot += noise(a * 1.2, 6) * 0.2 * rumble;
      }
      if (this.reduceMotion) { cam.tx = cam.ty = cam.rot = 0; cam.scale = 1.1; }
      // BOOM IN: the whole frame pushes in on the habitat. Its focus point
      // travels from where it sits on screen to just above centre while
      // the scale grows about it; a crane arc lifts and settles the frame
      // and a small roll comes out as it lands; then a slow creep.
      if (boom > 0) {
        var k = easeInOutCubic(boom);
        var creep = this.reduceMotion ? 0 : easeInOutSine(clamp01((a - ASCENT.approach - BOOM_MS) / 9000));
        var hr = this._groundArt(null, HAB.z, HAB.X, HAB.width, HAB.w, HAB.h, HAB.base);
        var fx = (hr.x + hr.w * 0.55) / this.dpr, fy = (hr.y + hr.h * 0.5) / this.dpr;
        var ox = W * 0.5, oy = H * this.cameraOriginY;
        var s0 = cam.scale;
        var f0x = ox + cam.tx + s0 * (fx - ox), f0y = oy + cam.ty + s0 * (fy - oy);
        var S = s0 * lerp(1, BOOM_ZOOM, k) * (1 + 0.035 * creep);
        var arc = Math.sin(Math.PI * k);
        var cx = lerp(f0x, W * (W > H ? 0.54 : 0.5), k), cy = lerp(f0y, H * (W > H ? 0.53 : 0.5), k) - H * 0.05 * arc;
        cam.scale = S;
        cam.tx = cx - ox - S * (fx - ox);
        cam.ty = cy - oy - S * (fy - oy);
        cam.rot += 0.9 * arc * (1 - k) - 0.25 * arc;
      }
      var tr = "translate3d(" + (cam.tx + cam.sx).toFixed(2) + "px," + (cam.ty + cam.sy).toFixed(2) + "px,0) rotate(" +
        cam.rot.toFixed(3) + "deg) scale(" + cam.scale.toFixed(4) + ")";
      for (var i = 0; i < this.cameraEls.length; i++) {
        var el = this.cameraEls[i];
        el.style.transform = (el.__camBase ? el.__camBase + " " : "") + tr;
      }
    }
    this._cam = cam;
  };

  // Canvas px on screen -> canvas px in the camera-moved world layers.
  LandingFX.prototype._unCam = function (x, y) {
    var cam = this._cam;
    if (!cam) return { x: x, y: y };
    var d = this.dpr, ox = (this._cssW || 0) * 0.5 * d, oy = (this._cssH || 0) * this.cameraOriginY * d;
    var qx = x - ox - (cam.tx + cam.sx) * d, qy = y - oy - (cam.ty + cam.sy) * d;
    var r = -cam.rot * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
    return { x: ox + (qx * c - qy * sn) / cam.scale, y: oy + (qx * sn + qy * c) / cam.scale };
  };

  // Draw fn() in screen space on a camera-moved canvas (the sky: things
  // at infinity the camera move must not carry).
  LandingFX.prototype._inScreenSpace = function (ctx, fn) {
    var cam = this._cam;
    ctx.save();
    if (cam) {
      var d = this.dpr, ox = (this._cssW || 0) * 0.5 * d, oy = (this._cssH || 0) * this.cameraOriginY * d;
      ctx.translate(ox, oy);
      ctx.rotate(-cam.rot * Math.PI / 180);
      ctx.scale(1 / cam.scale, 1 / cam.scale);
      ctx.translate(-ox - (cam.tx + cam.sx) * d, -oy - (cam.ty + cam.sy) * d);
    }
    fn.call(this);
    ctx.restore();
  };

  // The boom-in's rush: dust streaking past the lens, radiating from the
  // habitat, strongest mid-move. Screen space.
  LandingFX.prototype._drawBoomStreaks = function (f, a) {
    var b = clamp01((a - ASCENT.approach) / BOOM_MS);
    var v = Math.sin(Math.PI * b);
    if (v <= 0.02 || this.reduceMotion) return;
    var cw = this.frontCanvas.width, ch = this.frontCanvas.height;
    var cx = cw * 0.5, cy = ch * 0.5, R = Math.hypot(cw, ch) * 0.6;
    var k = easeInOutCubic(b);
    f.save();
    f.lineCap = "round";
    for (var i = 0; i < 70; i++) {
      var ang = i * 2.39996 + 0.3;
      var rr = ((i * 0.1379 + k * 1.3) % 1);
      var r0 = R * (0.18 + 0.82 * rr * rr);
      var len = R * 0.09 * v * (0.4 + rr);
      var x0 = cx + Math.cos(ang) * r0, y0 = cy + Math.sin(ang) * r0 * 0.7;
      var x1 = cx + Math.cos(ang) * (r0 + len), y1 = cy + Math.sin(ang) * (r0 + len) * 0.7;
      f.strokeStyle = rgba(236, 188, 142, (0.08 + 0.2 * rr) * v);
      f.lineWidth = Math.max(1, this.dpr * (0.6 + 2.2 * rr));
      f.beginPath(); f.moveTo(x0, y0); f.lineTo(x1, y1); f.stroke();
    }
    f.restore();
  };

  // Plausible ascent telemetry: altitude, speed, range to the orbiter.
  function ascentTelemetry(a) {
    var alt, vel;
    if (a < ASCENT.lift) { alt = 0; vel = 0; }
    else if (a < ASCENT.pitch) {
      var u = (a - ASCENT.lift) / (ASCENT.pitch - ASCENT.lift);
      alt = 420 * Math.pow(u, 1.8); vel = 95 * Math.pow(u, 1.2);
    } else if (a < ASCENT.dock) {
      var w = (a - ASCENT.pitch) / (ASCENT.dock - ASCENT.pitch);
      alt = lerp(420, 318000, Math.pow(w, 1.6)); vel = lerp(95, 3410, easeOutPow(w, 1.4));
    } else { alt = 318000; vel = 3410; }
    var dist = a < ASCENT.dock ? lerp(1240, 0, easeInOutCubic(clamp01(a / ASCENT.dock))) : 0;
    return { alt: alt, vel: vel, dist: dist, t: a };
  }

  LandingFX.prototype._renderAscent = function (a, dt) {
    var A = this.ascent;
    if (!A) return;
    this._lastAscent = a;
    var e = ASC_E + a;
    var orb = this._ascentOrbiter(a);
    var S = this._ascentState(a, orb);
    var st = S.st;
    var L = this._layout(st);
    this._cameraAscent(a, L, S);   // first: the sky layers below draw through it

    // launch dust: the pad boils at ignition, a dust wall at lift-off
    var rate = 0;
    if (a >= ASCENT.ignite && a < ASCENT.pitch) {
      rate = st.h < 0.22 ? lerp(3, 16, clamp01((a - ASCENT.ignite) / 800)) * (1 - clamp01(st.h / 0.22)) : 0;
    }
    if (rate > 0) this._spawnDust(this._layout({ z: 1, h: 0, X: 0, tilt: 0 }), rate, dt);
    if (!A.stormed && a >= ASCENT.lift + 150) { A.stormed = true; if (!this.reduceMotion) this._spawnImpactStorm(this._layout({ z: 1, h: 0, X: 0, tilt: 0 })); }
    this._advanceDust(dt);
    this._updateAscentTrail(a, L, st, S);

    var b = this.backCtx, f = this.frontCtx;
    b.clearRect(0, 0, this.backCanvas.width, this.backCanvas.height);
    if (this.sky) this.sky.draw(b, this);
    this._drawStorm(b, e);
    this._drawAscentTrail(b, a);
    var hab = this._drawHabitatAscent(b, a);
    if (!S.flying) this._drawPadContact(b, L, { clear: 1, v: FINAL_IDX });
    if (S.alpha > 0) {
      this._drawShadow(b, L, st);
      if (S.ignite > 0) {
        b.save(); b.globalAlpha = S.ignite;
        this._drawGroundLight(b, L, st, e);
        b.restore();
      }
    }
    this._drawDust(b, "back");

    this._drawAscentShip(a, S, L);

    f.clearRect(0, 0, this.frontCanvas.width, this.frontCanvas.height);
    if (S.ignite > 0.3 && S.alpha > 0) {
      f.save(); f.globalAlpha = clamp01((S.ignite - 0.3) / 0.7) * S.alpha;
      this._drawThrust(f, L, st, e);
      this._drawBloom(f, L, st, e);
      f.restore();
    }
    if (S.flying) this._drawAscentPlume(f, L, st, a, S.alpha);
    if (S.alpha > 0.05) this._drawBeacon(f, L, st, e);
    if (!S.flying && a < ASCENT.lift) this._drawGroundBlend(f, L, { clear: 1, v: FINAL_IDX }, e);
    this._drawDust(f, "front");
    this._drawHabitatLights(f, hab, a);
    if (this.sky) this.sky.drawLabels(f, this);
    this._inScreenSpace(f, function () {
      this._drawOrbiter(f);
      if (typeof AmbientStorm !== "undefined" && !this.reduceMotion) {
        AmbientStorm.draw(f, this.frontCanvas.width, this.frontCanvas.height);
      }
    });
    this._drawLinks(f, hab, orb, a);
    this._inScreenSpace(f, function () { this._drawBoomStreaks(f, a); });

    if (A.onFrame) {
      var shipPt = S.alpha > 0.05
        ? { x: L.shipCX + L.shipW * 0.05, y: L.feetY - SHIP_HEIGHT * 0.86 * L.s }
        : orb.live.node;
      var habPt = hab ? { x: hab.x + HAB.top[0] * hab.w, y: hab.y + HAB.top[1] * hab.h } : null;
      A.onFrame({
        elapsed: a,
        ship: this._toScreen(shipPt.x, shipPt.y),
        shipVisible: S.alpha > 0.05,
        habitat: habPt ? this._toScreen(habPt.x, habPt.y) : null,
        habitatAlpha: hab ? hab.alpha || 0 : 0,
        orbiter: { x: orb.live.screenNode.x / this.dpr, y: orb.live.screenNode.y / this.dpr },
        shake: this._cam ? { x: this._cam.sx, y: this._cam.sy } : { x: 0, y: 0 },
        telemetry: ascentTelemetry(a)
      });
    }
  };

  // Film grain tile (generated once) for a CSS-animated overlay.
  LandingFX.grainDataURL = function (size) {
    size = size || 160;
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var x = c.getContext("2d");
    var img = x.createImageData(size, size);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = (Math.random() * 255) | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  };

  global.LandingFX = LandingFX;
})(window);
