/* ============================================================
   Worx by Glimpse — landing-sequence.js
   Generic scroll-scrubbed PNG frame-sequence controller. Used by
   the About storybook's GLIMPSE landing chapter (about-story.js);
   written with no page-specific assumptions so it isn't tied to
   spacecraft frames specifically.

   WHY CANVAS, NOT STACKED <img> FRAMES:
   Portfolio's astronaut (static/css/portfolio.css) swaps frames by
   stacking every frame as its own <img> and toggling CSS opacity —
   that works well for a small (10-frame), continuously-looping,
   TIME-based cycle. This sequence is scroll-SCRUBBED: the frame
   index can jump around non-monotonically as fast as the user
   flings the wheel, across up to 32 frames. Drawing the current
   frame onto one <canvas> via drawImage() avoids ever creating 32
   simultaneous DOM image layers, and — because the source images
   are decoded once into memory during preload — each frame swap is
   a single cheap bitmap blit with no img.src reassignment, so there
   is no network re-fetch, no broken-image flash, and no layout
   thrash while scrubbing quickly in either direction.

   USAGE
     var seq = new LandingSequence(canvasEl, {
       basePath: "../static/assets/about/landing/glimpse-landing-",
       count: 32,          // total frame files
       pad: 3,              // glimpse-landing-001.png
       ext: ".png",
       frameWidth: 2400,    // authoring canvas — must match every
       frameHeight: 1350,   // exported frame exactly (16:9)
     });
     seq.preload().then(function (info) {
       console.info("landing frames found:", info.loadedCount + "/" + info.total);
     });
     seq.resize();                // call on init + on debounced resize
     seq.setFrame(frameIndex);    // call on every scroll update (0-based)

   MISSING FRAMES (expected until final artwork lands):
   preload() never rejects — a 404 just marks that index as
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
   once real frames exist — no JS change needed, just that one CSS
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

  global.LandingSequence = LandingSequence;
})(window);
