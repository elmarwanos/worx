/* ============================================================
   Worx | reticle.js
   The home page's targeting reticle, on every other page: four
   corner brackets and a glowing dot follow the pointer, a mono
   X/Y readout rides beside it, and over a link or button it locks
   on (wraps the target, scrambles in "LOCK · LABEL"). Fine pointers
   only, off for reduced motion; the header, the contact dock and
   text fields keep the normal cursor. Home runs its own copy
   (home.js), so this steps aside when .hm-reticle is on the page.

   It never takes a click (pointer-events: none, components.css).
   The dot sits exactly on the pointer every frame, so aiming never
   lags; only the brackets ease after it. A touch or pen hides it,
   leaving the window hides it, and the loop sleeps once settled.
   ============================================================ */
(function () {
  "use strict";

  if (document.querySelector(".hm-reticle")) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var ret = document.createElement("div");
  ret.className = "wx-reticle";
  ret.setAttribute("aria-hidden", "true");
  ret.innerHTML = "<i></i><i></i><i></i><i></i><b></b><span class=\"wx-reticle-read\"></span>";
  document.body.appendChild(ret);
  var readEl = ret.querySelector(".wx-reticle-read");
  var dot = ret.querySelector("b");
  var root = document.documentElement;

  function scramble(el, text, dur) {
    var glyphs = "01<>/\\#%&*+=?ABCDEFXYZ";
    var t0 = performance.now();
    clearTimeout(el.__scr);
    (function run() {
      var k = Math.min(1, (performance.now() - t0) / dur);
      var out = "";
      for (var i = 0; i < text.length; i++) {
        var c = text.charAt(i);
        out += c === " " || i / text.length < k ? c : glyphs.charAt((Math.random() * glyphs.length) | 0);
      }
      el.textContent = out;
      if (k < 1) el.__scr = setTimeout(run, 40);
    })();
  }

  var px = -100, py = -100, rx = -100, ry = -100, rw = 38, rh = 38;
  var target = null, inside = false, running = false, fresh = true, lastRead = "", lastT = 0;
  // catch-up time constants (ms): the brackets land ~0.1s after the
  // pointer stops, the same on a 60Hz or a 144Hz screen
  var MOVE_MS = 26, SIZE_MS = 36;
  var LOCKS = "a, button, [role=tab], summary, label, [data-reticle]";
  // over these the system cursor is the right one
  var PLAIN = ".site-header, .qc-dock, input, textarea, select, [contenteditable], iframe";

  function show(on) {
    if (on === inside) return;
    inside = on;
    root.classList.toggle("has-reticle", on);
    if (!on) setTarget(null);
  }

  function setTarget(t) {
    if (t === target) return;
    target = t;
    ret.classList.toggle("is-lock", !!t);
    if (t) {
      var label = (t.getAttribute("aria-label") || t.textContent || "").replace(/\s+/g, " ").trim().slice(0, 22).toUpperCase();
      scramble(readEl, "LOCK · " + label, 260);
    } else {
      clearTimeout(readEl.__scr);
    }
  }

  // what's under the pointer now (on move, and again after a scroll,
  // when the page slides under a still pointer)
  function probe(el) {
    if (!el || !el.closest) { show(false); return; }
    var ok = !el.closest(PLAIN);
    show(ok);
    setTarget(ok ? el.closest(LOCKS) : null);
    wake();
  }

  document.addEventListener("pointermove", function (e) {
    if (e.pointerType && e.pointerType !== "mouse") { show(false); return; }
    px = e.clientX; py = e.clientY;
    if (fresh) { rx = px; ry = py; fresh = false; }   // first sight: no fly-in from the corner
    probe(e.target);
  }, { passive: true });

  // a touch or pen on a hybrid laptop: step aside
  document.addEventListener("pointerdown", function (e) {
    if (e.pointerType && e.pointerType !== "mouse") show(false);
  }, { passive: true });

  // the pointer leaves the window / the tab loses focus
  document.addEventListener("mouseout", function (e) {
    if (!e.relatedTarget) { show(false); fresh = true; }
  });
  window.addEventListener("blur", function () { show(false); fresh = true; });

  var scrollTick = false;
  window.addEventListener("scroll", function () {
    if (!inside || scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(function () {
      scrollTick = false;
      probe(document.elementFromPoint(px, py));
    });
  }, { passive: true });

  function wake() {
    if (running) return;
    running = true;
    lastT = 0;
    requestAnimationFrame(aim);
  }

  function aim(now) {
    var dt = lastT ? Math.min(now - lastT, 64) : 16.7;
    lastT = now;
    var km = 1 - Math.exp(-dt / MOVE_MS), ks = 1 - Math.exp(-dt / SIZE_MS);
    var tw = 38, th = 38, cx = px, cy = py;
    if (target && target.isConnected) {
      var r = target.getBoundingClientRect();
      var big = r.width > 260 || r.height > 200;
      tw = big ? Math.min(r.width, 120) : r.width + 14;
      th = big ? Math.min(r.height, 90) : r.height + 10;
      if (!big) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
    } else if (inside) {
      var read = "X " + ("000" + Math.round(px)).slice(-4) + " · Y " + ("000" + Math.round(py)).slice(-4);
      if (read !== lastRead) { readEl.textContent = read; lastRead = read; }
    }
    if (target) lastRead = "";
    rx += (cx - rx) * km; ry += (cy - ry) * km;
    rw += (tw - rw) * ks; rh += (th - rh) * ks;
    ret.style.width = rw.toFixed(1) + "px";
    ret.style.height = rh.toFixed(1) + "px";
    ret.style.transform = "translate3d(" + (rx - rw / 2).toFixed(1) + "px," + (ry - rh / 2).toFixed(1) + "px,0)";
    // the dot rides the true pointer position, not the eased frame
    // (hidden while locked, components.css)
    dot.style.transform = "translate3d(" + (px - rx).toFixed(1) + "px," + (py - ry).toFixed(1) + "px,0)";

    var settled = Math.abs(cx - rx) < 0.3 && Math.abs(cy - ry) < 0.3 &&
      Math.abs(tw - rw) < 0.3 && Math.abs(th - rh) < 0.3;
    // a locked target may be moving (a carousel, a sticky bar): keep aiming
    if (settled && !(target && inside)) { running = false; return; }
    requestAnimationFrame(aim);
  }
  wake();
})();
