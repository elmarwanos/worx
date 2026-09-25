/* ============================================================
   Worx | sky-fx.js
   The Martian night sky above the landing site (Sections 1–2): a deep,
   layered, procedural star field plus Earth + Moon and Saturn, placed
   from the Martian celestial sphere for Sept 15, 2026 (reference graph):

       azimuth  15°  Jupiter (in Cancer)       , behind the camera
       azimuth  45°  Gemini                    , behind the camera
       azimuth 195°  Saturn (in Pisces)         , in view, subtle
       azimuth 240°  Earth & Moon (inner system), in view, bright

   The camera looks toward HEADING 218° with a ~110° horizontal field,
   so Earth·Moon and Saturn sit in this sky; Jupiter and Gemini are off
   behind us (the HUD heading line pins them at its edges).

   HOW IT'S BUILT (one canvas pass, no DOM stars)
   - Layer 1, distant: ~1–1.6k faint points, pre-rendered once per size
     into an offscreen canvas (one drawImage per frame).
   - Layer 2, mid: ~480 brighter points, each shining and dimming on its
     own period/phase (a smooth swell to a peak and back to a dim
     trough); ~20% stay nearly steady.
   - Layer 3, hero: a dozen sparse bright stars with a soft halo.
   - Distribution is not uniform: a faint galactic band, a few loose
     clusters and empty voids.
   - Planets: Earth = cool bluish-white point with restrained bloom and
     the Moon as a dim companion a few pixels off; Saturn = smaller warm
     point with very little glow.
   - Atmosphere IN FRONT: everything is composited through a vertical
     extinction ramp (clearer high up, fading to nothing just above the
     horizon so it never touches the hills), and it is drawn on the back
     canvas BEFORE the storm, so storm billows and haze obscure it.
   - Parallax: drawn through the inverse of the virtual camera with a
     2.5% residual, the world moves, the sky practically doesn't.
   - A single, rare, faint meteor now and then.
   ============================================================ */

(function (global) {
  "use strict";

  var HEADING = 218;          // azimuth at the centre of the frame
  var FOV = 110;              // horizontal degrees across the viewport
  var ALT_TOP = 70;           // altitude (deg) at the top edge of the frame
  var PARALLAX = 0.025;       // how much of the camera's motion the sky follows

  var BODIES = {
    jupiter: { az: 15, label: "Jupiter" },
    gemini: { az: 45, label: "Gemini" },
    saturn: { az: 195, alt: 37, label: "Saturn" },
    earth: { az: 240, alt: 27, label: "Earth · Moon" }
  };

  function wrap180(d) { d = ((d + 180) % 360 + 360) % 360 - 180; return d; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function rng(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  // Screen x fraction (0..1 across the viewport) for an azimuth.
  function azToX(az) { return 0.5 + wrap180(az - HEADING) / FOV; }

  function MartianSky(opts) {
    opts = opts || {};
    this.reduceMotion = !!opts.reduceMotion;
    this._w = 0; this._h = 0;
    this._far = null;       // layer 1 bitmap
    this._mid = []; this._hero = [];
    this._comp = document.createElement("canvas");
    this._halo = null;
  }

  MartianSky.HEADING = HEADING;
  MartianSky.FOV = FOV;
  MartianSky.BODIES = BODIES;
  MartianSky.azToX = azToX;

  // Star density: faint galactic band + loose clusters - voids.
  function density(u, v, clusters, voids) {
    var band = Math.exp(-Math.pow((v - (0.95 - u * 0.85)) / 0.16, 2)) * 0.9;
    var d = 0.35 + band;
    for (var i = 0; i < clusters.length; i++) {
      var c = clusters[i], dx = u - c[0], dy = v - c[1];
      d += c[2] * Math.exp(-(dx * dx + dy * dy) / (c[3] * c[3]));
    }
    for (var j = 0; j < voids.length; j++) {
      var q = voids[j], ex = u - q[0], ey = v - q[1];
      d *= 1 - 0.85 * Math.exp(-(ex * ex + ey * ey) / (q[2] * q[2]));
    }
    return d;
  }

  MartianSky.prototype._build = function (w, h, dpr) {
    this._w = w; this._h = h;
    var r = rng(20260915);
    var clusters = [], voids = [], i;
    for (i = 0; i < 6; i++) clusters.push([r(), r() * 0.9, 0.8 + r() * 1.4, 0.03 + r() * 0.06]);
    for (i = 0; i < 4; i++) voids.push([r(), r() * 0.9, 0.08 + r() * 0.12]);
    var area = (w / dpr) * (h / dpr);
    var mobile = w / dpr < 700;
    var nFar = Math.min(mobile ? 700 : 1600, Math.round(area / 900));
    var nMid = Math.round(nFar * 0.3);

    function sample() {
      for (var k = 0; k < 30; k++) {
        var u = r(), v = r();
        if (r() * 2.4 < density(u, v, clusters, voids)) return [u, v];
      }
      return [r(), r()];
    }

    // Layer 1, distant: baked once.
    var far = document.createElement("canvas");
    far.width = w; far.height = h;
    var fx = far.getContext("2d");
    for (i = 0; i < nFar; i++) {
      var p = sample();
      var tint = r();
      fx.fillStyle = tint < 0.15 ? "rgba(200,215,255," : tint < 0.3 ? "rgba(255,225,190," : "rgba(250,244,232,";
      fx.fillStyle += (0.3 + r() * 0.45).toFixed(3) + ")";
      var s = (0.45 + r() * 0.6) * dpr;
      fx.fillRect(p[0] * w, p[1] * h, s, s);
    }
    this._far = far;

    // Layer 2, mid, individually breathing.
    this._mid = [];
    for (i = 0; i < nMid; i++) {
      var m = sample();
      this._mid.push({
        u: m[0], v: m[1], r: (0.8 + r() * 0.9) * dpr, a: 0.65 + r() * 0.35,
        // shine-and-dim depth: a few stay steady, most breathe clearly
        amp: r() < 0.2 ? 0.08 : 0.4 + r() * 0.45, per: 2400 + r() * 5200, ph: r() * 6.283,
        warm: r() < 0.2, cool: r() < 0.15
      });
    }
    // Layer 3, hero: sparse, compositional.
    this._hero = [];
    for (i = 0; i < 12; i++) {
      this._hero.push({
        u: 0.06 + r() * 0.88, v: 0.05 + r() * 0.6, r: (1.1 + r() * 0.8) * dpr, a: 0.75 + r() * 0.25,
        amp: 0.3 + r() * 0.3, per: 3200 + r() * 5000, ph: r() * 6.283, cool: r() < 0.4
      });
    }
    // soft halo sprite
    var hs = 64, halo = document.createElement("canvas");
    halo.width = halo.height = hs;
    var hx = halo.getContext("2d"), g = hx.createRadialGradient(hs / 2, hs / 2, 0, hs / 2, hs / 2, hs / 2);
    g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.18, "rgba(255,255,255,0.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
    hx.fillStyle = g; hx.fillRect(0, 0, hs, hs);
    this._halo = halo;
  };

  // Shine and dim: a smooth swell to a bright peak and back down to a
  // dim trough (0..1), each star on its own period and phase.
  function breathe(t, per, ph) {
    var s = 0.5 + 0.5 * Math.sin(t / per * 6.283 + ph);
    return s * s * (3 - 2 * s);
  }

  MartianSky.prototype._drawBody = function (ctx, x, y, core, glow, rgb, coreA, glowA) {
    ctx.globalAlpha = glowA;
    ctx.drawImage(this._halo, x - glow, y - glow, glow * 2, glow * 2);
    ctx.globalAlpha = coreA;
    ctx.fillStyle = "rgb(" + rgb + ")";
    ctx.beginPath(); ctx.arc(x, y, core, 0, 6.283); ctx.fill();
  };

  // Draw the sky into ctx (the back canvas, BEFORE the storm).
  MartianSky.prototype.draw = function (ctx, fx) {
    var cw = ctx.canvas.width, ch = ctx.canvas.height, dpr = fx.dpr;
    if (cw !== this._w || ch !== this._h || !this._far) this._build(cw, ch, dpr);
    var t = this.reduceMotion ? 0 : performance.now();
    var cam = fx._cam && !this.reduceMotion ? fx._cam : null;

    // horizon on screen (world horizon through the camera)
    var ox = cw * 0.5, oy = ch * fx.cameraOriginY;
    var hzWorld = ch * fx.horizonY;
    var hzS = cam ? oy + cam.ty * dpr + cam.scale * (hzWorld - oy) : hzWorld;

    var c = this._comp;
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    var x = c.getContext("2d");
    x.globalCompositeOperation = "source-over";
    x.globalAlpha = 1;
    x.clearRect(0, 0, cw, ch);
    x.drawImage(this._far, 0, 0);

    var i, s, a;
    for (i = 0; i < this._mid.length; i++) {
      s = this._mid[i];
      a = s.a * (1 - s.amp + s.amp * breathe(t, s.per, s.ph));    // dims down, shines back up
      x.globalAlpha = Math.min(1, a);
      x.fillStyle = s.warm ? "#ffe2c0" : s.cool ? "#d8e4ff" : "#fbf5ea";
      x.fillRect(s.u * cw, s.v * ch, s.r, s.r);
    }
    for (i = 0; i < this._hero.length; i++) {
      s = this._hero[i];
      a = s.a * (1 - s.amp + s.amp * breathe(t, s.per, s.ph));
      x.globalAlpha = 0.5 * a;
      x.drawImage(this._halo, s.u * cw - s.r * 5, s.v * ch - s.r * 5, s.r * 10, s.r * 10);
      x.globalAlpha = Math.min(1, a);
      x.fillStyle = s.cool ? "#e4ecff" : "#fff8ec";
      x.beginPath(); x.arc(s.u * cw, s.v * ch, s.r * 0.6, 0, 6.283); x.fill();
    }

    // Planets (effectively infinite distance: fixed in the sky)
    var ey = hzS * (1 - BODIES.earth.alt / ALT_TOP), ex = azToX(BODIES.earth.az) * cw;
    this._drawBody(x, ex, ey, 1.9 * dpr, 11 * dpr, "225,236,255", 1, 0.42);
    this._drawBody(x, ex + 6 * dpr, ey + 2.5 * dpr, 0.75 * dpr, 2.5 * dpr, "235,232,226", 0.55, 0.18); // the Moon
    var sy = hzS * (1 - BODIES.saturn.alt / ALT_TOP), sx = azToX(BODIES.saturn.az) * cw;
    this._labels = [{ x: ex, y: ey, text: "EARTH · MOON", color: "216,230,255" }, { x: sx, y: sy, text: "SATURN", color: "242,207,150" }];
    this._drawBody(x, sx, sy, 1.35 * dpr, 6 * dpr, "255,228,176", 0.85, 0.22);

    // A rare, faint meteor (one every ~47s, 700ms, high in the sky).
    if (!this.reduceMotion) {
      var mp = (t % 47000) / 700;
      if (mp < 1) {
        var seed = Math.floor(t / 47000);
        var mr = rng(seed * 97 + 11);
        var mx0 = cw * (0.25 + mr() * 0.5), my0 = hzS * (0.12 + mr() * 0.25);
        var len = cw * 0.12, ang = 0.5 + mr() * 0.3;
        var hx = mx0 + Math.cos(ang) * len * mp, hy = my0 + Math.sin(ang) * len * mp;
        var tg = x.createLinearGradient(hx, hy, hx - Math.cos(ang) * len * 0.35, hy - Math.sin(ang) * len * 0.35);
        tg.addColorStop(0, "rgba(255,248,236," + (0.55 * Math.sin(mp * Math.PI)).toFixed(3) + ")");
        tg.addColorStop(1, "rgba(255,248,236,0)");
        x.globalAlpha = 1;
        x.strokeStyle = tg; x.lineWidth = Math.max(1, 0.9 * dpr);
        x.beginPath(); x.moveTo(hx, hy); x.lineTo(hx - Math.cos(ang) * len * 0.35, hy - Math.sin(ang) * len * 0.35); x.stroke();
      }
    }

    // Atmospheric extinction: clearer high up, dimming toward the horizon,
    // gone just above it (never over the hills).
    x.globalAlpha = 1;
    x.globalCompositeOperation = "destination-in";
    var ext = x.createLinearGradient(0, 0, 0, hzS);
    ext.addColorStop(0, "rgba(0,0,0,1)");
    ext.addColorStop(0.55, "rgba(0,0,0,0.95)");
    ext.addColorStop(0.8, "rgba(0,0,0,0.4)");
    ext.addColorStop(0.9, "rgba(0,0,0,0)");
    x.fillStyle = ext;
    x.fillRect(0, 0, cw, ch);

    // Composite through the inverse camera (+ a 2.5% residual parallax).
    ctx.save();
    if (cam) {
      var k = 1 - PARALLAX;
      ctx.translate(ox, oy);
      ctx.rotate(-(cam.rot || 0) * Math.PI / 180);
      ctx.scale(1 / cam.scale, 1 / cam.scale);
      ctx.translate(-ox - k * (cam.tx + (cam.sx || 0)) * dpr, -oy - k * (cam.ty + (cam.sy || 0)) * dpr);
    }
    ctx.drawImage(c, 0, 0);
    ctx.restore();
    this._lastCam = cam; this._lastO = [ox, oy];
  };

  // Names written in the sky just above Earth·Moon and Saturn (front
  // layer, so the storm never hides them), through the same camera-
  // cancelling transform as the sky so they stay on their points.
  MartianSky.prototype.drawLabels = function (ctx, fx) {
    if (!this._labels) return;
    var dpr = fx.dpr, cam = this._lastCam, o = this._lastO || [0, 0];
    ctx.save();
    if (cam) {
      var k = 1 - PARALLAX;
      ctx.translate(o[0], o[1]);
      ctx.rotate(-(cam.rot || 0) * Math.PI / 180);
      ctx.scale(1 / cam.scale, 1 / cam.scale);
      ctx.translate(-o[0] - k * (cam.tx + (cam.sx || 0)) * dpr, -o[1] - k * (cam.ty + (cam.sy || 0)) * dpr);
    }
    ctx.font = "500 " + (9.5 * dpr).toFixed(1) + "px 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";
    if ("letterSpacing" in ctx) ctx.letterSpacing = (2 * dpr).toFixed(1) + "px";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    for (var i = 0; i < this._labels.length; i++) {
      var l = this._labels[i];
      ctx.strokeStyle = "rgba(" + l.color + ",0.35)";
      ctx.lineWidth = Math.max(1, dpr * 0.8);
      ctx.beginPath(); ctx.moveTo(l.x, l.y - 7 * dpr); ctx.lineTo(l.x, l.y - 15 * dpr); ctx.stroke();
      ctx.fillStyle = "rgba(" + l.color + ",0.78)";
      ctx.fillText(l.text, l.x, l.y - 19 * dpr);
    }
    ctx.restore();
  };

  global.MartianSky = MartianSky;
})(window);
