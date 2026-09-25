/* ============================================================
   Worx | landing-sequence.js
   Generic scroll-scrubbed PNG frame-sequence controller. Used by
   the About storybook's GLIMPSE landing chapter (about-story.js);
   written with no page-specific assumptions so it isn't tied to
   spacecraft frames specifically.

   WHY CANVAS, NOT STACKED <img> FRAMES:
   Stacking every frame as its own <img> and toggling CSS opacity
   works for a small, continuously-looping, TIME-based cycle. This
   sequence is scroll-SCRUBBED: the frame
   index can jump around non-monotonically as fast as the user
   flings the wheel, across up to 32 frames. Drawing the current
   frame onto one <canvas> via drawImage() avoids ever creating 32
   simultaneous DOM image layers, and, because the source images
   are decoded once into memory during preload, each frame swap is
   a single cheap bitmap blit with no img.src reassignment, so there
   is no network re-fetch, no broken-image flash, and no layout
   thrash while scrubbing quickly in either direction.

   USAGE
     var seq = new LandingSequence(canvasEl, {
       basePath: "../static/assets/about/landing/glimpse-landing-",
       count: 32,          // total frame files
       pad: 3,              // glimpse-landing-001.png
       ext: ".png",
       frameWidth: 2400,    // authoring canvas, must match every
       frameHeight: 1350,   // exported frame exactly (16:9)
     });
     seq.preload().then(function (info) {
       console.info("landing frames found:", info.loadedCount + "/" + info.total);
     });
     seq.resize();                // call on init + on debounced resize
     seq.setFrame(frameIndex);    // call on every scroll update (0-based)

   MISSING FRAMES (expected until final artwork lands):
   preload() never rejects, a 404 just marks that index as
   unavailable. setFrame() only draws indices that loaded; asking
   for a missing one leaves whatever was last successfully drawn on
   screen (never flashes to a broken-image icon or a blank canvas
   from a single missing frame), so the page stays visually correct
   before/while production frames are dropped in.

   VERTICAL ANCHOR
   Frames are drawn "contain"-fit (never stretched/distorted) and
   positioned via the --landing-anchor-y custom property read from
   the canvas element's computed style: 0 = top of the canvas box,
   1 = bottom, 0.5 = centered. This is the single knob for lining
   the artwork's own ground-contact line up with the live terrain
   once real frames exist, no JS change needed, just that one CSS
   value (about.css / an inline style override).
   ============================================================ */

(function (global) {
  "use strict";

  function LandingSequence(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.count = opts.count || 32;
    this.basePath = opts.basePath || "";
    this.pad = opts.pad != null ? opts.pad : 3;
    this.ext = opts.ext || ".png";
    this.frameWidth = opts.frameWidth || 2400;
    this.frameHeight = opts.frameHeight || 1350;
    this.dpr = Math.min(global.devicePixelRatio || 1, 2);

    this.images = new Array(this.count);
    this.loaded = new Array(this.count).fill(false);
    this.currentIndex = -1;
    this.pendingIndex = 0;
    this.ready = false;
    this.rect = null; // last computed "contain" placement, in canvas px
  }

  LandingSequence.prototype._frameUrl = function (i) {
    var n = String(i + 1);
    while (n.length < this.pad) n = "0" + n;
    return this.basePath + n + this.ext;
  };

  LandingSequence.prototype.preload = function () {
    var self = this;
    var settled = 0;
    var loadedCount = 0;

    return new Promise(function (resolve) {
      if (self.count === 0) {
        self.ready = true;
        resolve({ total: 0, loadedCount: 0 });
        return;
      }

      for (var i = 0; i < self.count; i++) {
        (function (index) {
          var img = new Image();
          img.decoding = "async";
          img.onload = function () {
            self.images[index] = img;
            self.loaded[index] = true;
            loadedCount++;
            settle();
          };
          img.onerror = function () {
            self.loaded[index] = false;
            settle();
          };
          img.src = self._frameUrl(index);
        })(i);
      }

      function settle() {
        settled++;
        if (settled === self.count) {
          self.ready = true;
          resolve({ total: self.count, loadedCount: loadedCount });
        }
      }
    });
  };

  LandingSequence.prototype._anchorY = function () {
    var raw = getComputedStyle(this.canvas).getPropertyValue("--landing-anchor-y").trim();
    var v = parseFloat(raw);
    return isNaN(v) ? 1 : Math.min(1, Math.max(0, v));
  };

  LandingSequence.prototype.resize = function () {
    var box = this.canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(box.width * this.dpr));
    var h = Math.max(1, Math.round(box.height * this.dpr));
    this.canvas.width = w;
    this.canvas.height = h;

    var frameAspect = this.frameWidth / this.frameHeight;
    var boxAspect = w / h;
    var containW, containH;
    if (boxAspect > frameAspect) {
      containH = h;
      containW = h * frameAspect;
    } else {
      containW = w;
      containH = w / frameAspect;
    }
    var anchorY = this._anchorY();
    this.rect = {
      x: (w - containW) / 2,
      y: (h - containH) * anchorY,
      w: containW,
      h: containH,
    };

    // Re-draw whatever frame was last requested so a resize never
    // leaves the canvas blank or mis-scaled until the next scroll tick.
    if (this.currentIndex >= 0) {
      var idx = this.currentIndex;
      this.currentIndex = -1;
      this.setFrame(idx);
    }
  };

  LandingSequence.prototype.setFrame = function (index) {
    index = Math.max(0, Math.min(this.count - 1, index));
    this.pendingIndex = index;
    if (index === this.currentIndex) return;
    if (!this.loaded[index]) return; // keep last good frame on screen
    if (!this.rect) this.resize();

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.images[index], this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    this.currentIndex = index;
  };

  // Call after preload() resolves, in case scroll already moved past
  // frame 0 while frames were still loading.
  LandingSequence.prototype.refreshPending = function () {
    var idx = this.pendingIndex;
    this.currentIndex = -1;
    this.setFrame(idx);
  };

  // Draws a given frame at an explicit rect instead of the automatic
  // "contain, anchored by --landing-anchor-y" placement setFrame()
  // uses. For callers (e.g. a compositor) that need the frame
  // positioned by their own logic, perspective, centering, a
  // calibrated ground line, while still getting setFrame()'s
  // preload/decode/"keep last good frame" guarantees for free. Always
  // redraws (no currentIndex short-circuit): a caller passing a custom
  // rect is by definition placing the frame somewhere setFrame()
  // wouldn't, so the dedupe that makes sense for setFrame's own
  // repeated-index calls doesn't apply here.
  LandingSequence.prototype.drawCustom = function (index, rect) {
    index = Math.max(0, Math.min(this.count - 1, index));
    if (!this.loaded[index]) return; // keep last good frame on screen
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.images[index], rect.x, rect.y, rect.w, rect.h);
    this.currentIndex = index;
  };

  // Cross-dissolves frame a (at rectA) into frame b (at rectB) by t.
  // Both are drawn additively ("lighter") at (1-t) and t alpha onto the
  // cleared canvas, which is an exact premultiplied blend, no double-
  // dense overlap where both frames are opaque. opts:
  //   alpha       overall opacity (fade-in)
  //   filter      ctx.filter string applied to both draws
  //   fadeX       fraction of frame width feathered away at each side
  //   fadeBottom  fraction of frame height feathered away at the bottom
  //   fadeA/fadeB { x, bottom }, feather each frame at its own rect
  //   mode        "over": layered dissolve (b over a) using alphaA/alphaB
  //   transform   [a, b, c, d, e, f] extra transform for the whole draw
  //   rotate      { angle, x, y }, rotate the whole draw about (x, y)
  // The feathering removes the hard line where baked-in dust meets the
  // frame's own edge (see landing-fx.js).
  LandingSequence.prototype.drawBlend = function (a, rectA, b, rectB, t, opts) {
    opts = opts || {};
    if (!this.loaded[a]) { a = b; rectA = rectB; t = 0; }
    if (!this.loaded[b]) { b = a; rectB = rectA; t = 0; }
    if (!this.loaded[a]) return; // keep last good frame on screen
    var ctx = this.ctx;
    var alpha = opts.alpha != null ? opts.alpha : 1;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // opts.transform: [a, b, c, d, e, f] applied to everything drawn
    // (e.g. a camera-angle pose), after the canvas has been cleared.
    var xf = opts.transform;
    if (xf) { ctx.save(); ctx.transform(xf[0], xf[1], xf[2], xf[3], xf[4], xf[5]); }
    var rot = opts.rotate;
    if (rot) {
      ctx.save();
      ctx.translate(rot.x, rot.y);
      ctx.rotate(rot.angle);
      ctx.translate(-rot.x, -rot.y);
    }
    ctx.save();
    ctx.filter = opts.filter || "none";
    if (opts.mode === "over" && a !== b) {
      // Layered dissolve: b drawn normally over a, each with its own alpha.
      ctx.globalAlpha = alpha * (opts.alphaA != null ? opts.alphaA : 1 - t);
      if (ctx.globalAlpha > 0.002) ctx.drawImage(this.images[a], rectA.x, rectA.y, rectA.w, rectA.h);
      ctx.globalAlpha = alpha * (opts.alphaB != null ? opts.alphaB : t);
      if (ctx.globalAlpha > 0.002) ctx.drawImage(this.images[b], rectB.x, rectB.y, rectB.w, rectB.h);
    } else if (a === b || t <= 0.002) {
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.images[a], rectA.x, rectA.y, rectA.w, rectA.h);
    } else if (t >= 0.998) {
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.images[b], rectB.x, rectB.y, rectB.w, rectB.h);
    } else {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha * (1 - t);
      ctx.drawImage(this.images[a], rectA.x, rectA.y, rectA.w, rectA.h);
      ctx.globalAlpha = alpha * t;
      ctx.drawImage(this.images[b], rectB.x, rectB.y, rectB.w, rectB.h);
    }
    ctx.restore();

    // Edge feathering: per frame (fadeA / fadeB = { x, bottom }) when the
    // two frames differ in size, else fadeX/fadeBottom on the dominant one.
    if (opts.fadeA || opts.fadeB) {
      if (opts.fadeA && t < 0.998) this._feather(rectA, opts.fadeA.x, opts.fadeA.bottom);
      if (opts.fadeB && t > 0.002) this._feather(rectB, opts.fadeB.x, opts.fadeB.bottom);
    } else if (opts.fadeX || opts.fadeBottom) {
      this._feather(t < 0.5 ? rectA : rectB, opts.fadeX, opts.fadeBottom);
    }
    if (rot) ctx.restore();
    if (xf) ctx.restore();
    this.currentIndex = t < 0.5 ? a : b;
  };

  LandingSequence.prototype._feather = function (r, fadeX, fadeBottom) {
    var ctx = this.ctx;
    var g;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    if (fadeX) {
      var fx = r.w * fadeX;
      g = ctx.createLinearGradient(r.x, 0, r.x + fx, 0);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(r.x - 1, r.y, fx + 1, r.h);
      g = ctx.createLinearGradient(r.x + r.w, 0, r.x + r.w - fx, 0);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(r.x + r.w - fx, r.y, fx + 1, r.h);
    }
    if (fadeBottom) {
      var fb = r.h * fadeBottom;
      var y1 = r.y + r.h;
      g = ctx.createLinearGradient(0, y1, 0, y1 - fb);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(0.35, "rgba(0,0,0,0.7)");
      g.addColorStop(0.7, "rgba(0,0,0,0.25)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(r.x, y1 - fb, r.w, fb + 2);
    }
    ctx.restore();
  };

  global.LandingSequence = LandingSequence;
})(window);
