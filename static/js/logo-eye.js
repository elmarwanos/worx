/* ============================================================
   Worx by Glimpse — logo-eye.js
   The crescent in the logo's eye follows the pointer, everywhere
   on the site: the header mark (mark.png) and the footer logo
   (logo-light.png).

   Each logo <img> is swapped for a small inline SVG built from
   static/assets/logo-eye/:
     <name>-base.png      the logo with the eye filled solid black
     <name>-crescent.png  the crescent on its own
   The crescent sits in a clipPath traced from the eye's outline, so
   it slides around inside the eye and never over its edge. (An SVG
   clip rather than a CSS mask: masks fail on file:// pages and would
   hide the crescent entirely.) If anything fails to load, the
   original <img> simply stays.

   The pupil eases toward the pointer on an ellipse that fits the
   almond, reaching full deflection as the pointer moves away. One
   rAF loop drives every logo and idles once they've settled.
   ============================================================ */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SVGNS = "http://www.w3.org/2000/svg";

  // Geometry in each source image's own pixels (viewBox units).
  //   cx, cy  centre of the eye
  //   mx, my  how far the crescent may travel (ellipse radii)
  //   eye     the eye's outline, traced from the artwork
  var LOGOS = {
    "mark.png": {
      name: "mark", w: 255, h: 256, cx: 127, cy: 154, mx: 32, my: 9,
      eye: "M24 154L30 147L36 142L42 137L48 132L54 127L60 123L66 120L72 116L78 114L84 111L90 109L96 107L102 106L108 105L114 104L120 104L126 104L132 104L138 104L144 105L150 106L156 107L162 109L168 111L174 113L180 116L186 119L192 123L198 127L204 131L210 136L216 142L222 147L228 152L230 154L228 155L222 160L216 165L210 170L204 175L198 180L192 184L186 188L180 191L174 193L168 196L162 198L156 199L150 201L144 202L138 203L132 203L126 203L120 203L114 202L108 202L102 201L96 199L90 197L84 195L78 193L72 190L66 187L60 183L54 179L48 175L42 169L36 164L30 159Z"
    },
    "logo-light.png": {
      name: "logo-light", w: 582, h: 800, cx: 289, cy: 350, mx: 72, my: 20,
      eye: "M51 350L63 339L75 329L87 319L99 309L111 298L123 289L135 281L147 273L159 267L171 261L183 256L195 251L207 247L219 244L231 241L243 239L255 237L267 236L279 235L291 235L303 235L315 236L327 237L339 239L351 242L363 245L375 248L387 252L399 257L411 262L423 269L435 275L447 283L459 292L471 301L483 312L495 322L507 332L519 342L528 350L519 358L507 368L495 378L483 389L471 399L459 409L447 417L435 425L423 432L411 438L399 443L387 448L375 452L363 456L351 459L339 461L327 463L315 464L303 465L291 466L279 465L267 465L255 464L243 462L231 460L219 457L207 453L195 449L183 445L171 440L159 434L147 427L135 420L123 411L111 402L99 392L87 382L75 371L63 361Z"
    }
  };

  var eyes = [];
  var pointer = null;   // last pointer position (client px), null until one moves
  var raf = 0;
  var uid = 0;

  function load(src) {
    return new Promise(function (resolve, reject) {
      var i = new Image();
      i.onload = function () { resolve(src); };
      i.onerror = reject;
      i.src = src;
    });
  }

  function el(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function upgrade(img, cfg) {
    var dir = new URL("logo-eye/", img.src).href;
    var baseSrc = dir + cfg.name + "-base.png";
    var cresSrc = dir + cfg.name + "-crescent.png";

    Promise.all([load(baseSrc), load(cresSrc)]).then(function () {
      var id = "logo-eye-clip-" + (++uid);
      var svg = el("svg", {
        viewBox: "0 0 " + cfg.w + " " + cfg.h,
        width: img.getAttribute("width") || cfg.w,
        height: img.getAttribute("height") || cfg.h,
        "class": ((img.getAttribute("class") || "") + " logo-eye").trim()
      });
      var alt = img.getAttribute("alt");
      if (alt) { svg.setAttribute("role", "img"); svg.setAttribute("aria-label", alt); }
      else svg.setAttribute("aria-hidden", "true");

      var clip = el("clipPath", { id: id });
      clip.appendChild(el("path", { d: cfg.eye }));
      svg.appendChild(clip);
      svg.appendChild(el("image", { href: baseSrc, width: cfg.w, height: cfg.h }));
      var g = el("g", { "clip-path": "url(#" + id + ")" });
      var cres = el("image", { href: cresSrc, width: cfg.w, height: cfg.h });
      g.appendChild(cres);
      svg.appendChild(g);

      img.replaceWith(svg);
      eyes.push({ svg: svg, cres: cres, cfg: cfg, x: 0, y: 0 });
      kick();
    }).catch(function () { /* keep the original <img> */ });
  }

  // Where the crescent wants to be for the current pointer.
  function target(e) {
    if (!pointer) return { x: 0, y: 0 };
    var r = e.svg.getBoundingClientRect();
    if (!r.width) return { x: e.x, y: e.y };
    var cfg = e.cfg, s = r.width / cfg.w;           // screen px per viewBox unit
    var ex = r.left + cfg.cx * s, ey = r.top + cfg.cy * s;
    var dx = pointer.x - ex, dy = pointer.y - ey;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.5) return { x: 0, y: 0 };
    // full deflection once the pointer is a few eye-widths away
    var reach = Math.min(1, dist / (cfg.mx * s * 6 + 60));
    return { x: dx / dist * cfg.mx * reach, y: dy / dist * cfg.my * reach };
  }

  function tick() {
    raf = 0;
    var moving = false;
    for (var i = 0; i < eyes.length; i++) {
      var e = eyes[i], t = target(e);
      var k = reduceMotion ? 1 : 0.16;
      e.x += (t.x - e.x) * k;
      e.y += (t.y - e.y) * k;
      if (Math.abs(t.x - e.x) > 0.05 || Math.abs(t.y - e.y) > 0.05) moving = true;
      else { e.x = t.x; e.y = t.y; }
      e.cres.setAttribute("transform", "translate(" + e.x.toFixed(2) + " " + e.y.toFixed(2) + ")");
    }
    if (moving) kick();
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function onPointer(ev) {
    pointer = { x: ev.clientX, y: ev.clientY };
    kick();
  }

  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("pointerdown", onPointer, { passive: true });
  // the logo moves under a still pointer when the page scrolls/resizes
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", kick);

  document.querySelectorAll("img").forEach(function (img) {
    var file = (img.getAttribute("src") || "").split("/").pop();
    if (LOGOS[file]) upgrade(img, LOGOS[file]);
  });
})();
