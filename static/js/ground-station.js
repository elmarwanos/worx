/* ============================================================
   Worx | ground-station.js
   The tuners under the partner field on the home page (index.html
   [data-gs], styles in home.css "THE TUNERS"): four tuners from a
   1960s ground-station receiver, one per real figure.

   Each is the same instrument: a knurled knob on an engraved ring (its
   name round the top, copied from the page's own text so it translates;
   a model code round the bottom), a ring of tick lines for its scale,
   and machined drums on its hub that show the figure.

   One still line joins them to the partner field. Coming into view
   each tuner wakes in turn: the knob searches the band, then turns to
   its figure, a little past and back, its ticks lighting behind the
   pointer and its drums rolling up, and it settles (a ring of light
   goes out from the hub). Phones see one tuner at a time, so each wakes as it is seen.
   Once locked, the knobs answer the scroll: they turn a few degrees
   with it, with some weight, and spring back.

   Every move is also published as a PHASE on gs.worxTelemetry (its
   name, the knob's from/to on the band, its duration, when it began),
   from the very calls that move the knob: the sound of the receivers
   (home-audio.js) follows these, so picture and sound share one clock
   and can never drift; it can also join a search already under way.
     search    the sweep up the band, past the figure
     slip      the fall back, across the figure and away
     approach  the turn to the figure, a hair past and back
     release   (a retune) easing back down the band
     hold      (a retune) the beat at the bottom
     lock      on the figure
   With the lock, the engraved name round the dial lights amber: dark
   while it searches, a flicker as the signal comes near (.is-near), a
   flare as it locks, then a steady glow.

   ONE SECTION, TWO ACTS. The partner logos above and this console share
   the section, and never at once: a FOCUS (0 the logos, 1 the console)
   is read from where the eye is between the logo band and the panel,
   and published (bus.focus, bus.owner) for the sound. The console only
   wakes when it becomes the subject, so its search is never missed
   behind the logos. The handoff is THE RELAY: the logo nearest the
   middle warms, a pulse of power drops down a hairline feed into the
   panel's vent, and the console takes power. Ownership turns at set
   points apart (hysteresis), so lingering on the line never flickers.

   On the plate at the foot of the panel, the years in orbit count up.
   The figures are in the page as text; all of this is decoration.
   Reduced motion: every tuner already locked, nothing moves.
   ============================================================ */
(function () {
  "use strict";
  var gs = document.querySelector("[data-gs]");
  if (!gs) return;
  var $ = function (s, c) { return (c || gs).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || gs).querySelectorAll(s)); };
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NS = "http://www.w3.org/2000/svg";

  // the plate: years in orbit, counted up from 2019 to this year
  // when the strip is first seen
  var yrsEl = $("[data-gs-years]");
  if (yrsEl) {
    var YRS = Math.max(0, new Date().getFullYear() - 2019);
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var plate = $("[data-gs-plate]");
    var lit = function () { if (plate) plate.classList.add("is-lit"); };
    var count = function () {
      if (reduced) { yrsEl.textContent = pad(YRS); lit(); return; }
      var t0 = performance.now();
      (function step(now) {
        var k = Math.min(1, (now - t0) / 1800), e = 1 - Math.pow(1 - k, 3);
        yrsEl.textContent = pad(Math.round(YRS * e));
        if (k < 1) requestAnimationFrame(step); else setTimeout(lit, 160);
      })(t0);
    };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en, o) { if (en[0].isIntersecting) { o.disconnect(); count(); } }, { threshold: 0.6 }).observe(yrsEl);
    } else count();
  }
  // the panel: the light on the metal follows a mouse across it
  var board = $(".gs-board");
  if (board && !reduced && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    var sheenRaf = 0, mx = 0, my = 0;
    board.addEventListener("pointermove", function (e) {
      var r = board.getBoundingClientRect();
      mx = e.clientX - r.left; my = e.clientY - r.top;
      if (sheenRaf) return;
      sheenRaf = requestAnimationFrame(function () {
        sheenRaf = 0;
        board.style.setProperty("--mx", mx + "px");
        board.style.setProperty("--my", my + "px");
      });
    });
    board.addEventListener("pointerleave", function () { board.style.removeProperty("--mx"); board.style.removeProperty("--my"); });
  }

  // phones: the bank is a sideways row, so dots under it show which
  // tuner is in view and jump to another; while nobody touches it, the
  // row moves on by itself every few seconds (resting off screen)
  var dotsEl = $("[data-gs-dots]"), bankEl = $(".gs-bank");
  if (dotsEl && bankEl) (function () {
    var cells = $$(".gs-unit", bankEl), narrow = window.matchMedia("(max-width: 640px)");
    var cur = 0, idleUntil = 0, seen = false, autoT = null, raf = 0;
    var dots = cells.map(function (u, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "gs-dot-btn";
      b.setAttribute("aria-label", ($(".gs-label", u).firstChild.textContent || "").trim());
      b.addEventListener("click", function () { idleUntil = Date.now() + 9000; show(i, true); });
      dotsEl.appendChild(b);
      return b;
    });
    var mark = function (i) {
      cur = i;
      dots.forEach(function (d, j) {
        d.classList.toggle("is-on", j === i);
        if (j === i) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current");
      });
    };
    var show = function (i, smooth) {
      var u = cells[i];
      bankEl.scrollTo({ left: u.offsetLeft - (bankEl.clientWidth - u.offsetWidth) / 2, behavior: smooth && !reduced ? "smooth" : "auto" });
      mark(i);
    };
    // which tuner sits nearest the middle as the row scrolls
    bankEl.addEventListener("scroll", function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var mid = bankEl.scrollLeft + bankEl.clientWidth / 2, best = 0, bd = Infinity;
        cells.forEach(function (u, j) {
          var d = Math.abs(u.offsetLeft + u.offsetWidth / 2 - mid);
          if (d < bd) { bd = d; best = j; }
        });
        if (best !== cur) mark(best);
      });
    }, { passive: true });
    // a finger on the row holds the auto-advance for a while
    ["pointerdown", "touchstart", "wheel"].forEach(function (ev) {
      bankEl.addEventListener(ev, function () { idleUntil = Date.now() + 9000; }, { passive: true });
    });
    var step = function () {
      if (!narrow.matches || !seen || document.hidden || Date.now() < idleUntil) return;
      show((cur + 1) % cells.length, true);
    };
    var arm = function () {
      clearInterval(autoT);
      autoT = null;
      if (!reduced && narrow.matches && seen) autoT = setInterval(step, 5000);
    };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { seen = en[0].isIntersecting; arm(); }, { threshold: 0.5 }).observe(bankEl);
    }
    if (narrow.addEventListener) narrow.addEventListener("change", arm);
    mark(0);
  })();
  var later = function (ms, fn) { return setTimeout(fn, reduced ? 0 : ms); };
  var mk = function (tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  };

  /* the scale: 270 degrees, from bottom left round to bottom right */
  var A0 = -135, SWEEP = 270, DOTS = 41, C = 120;
  var angle = function (p) { return A0 + SWEEP * p; };
  var at = function (deg, r) { var a = (deg - 90) * Math.PI / 180; return [C + Math.cos(a) * r, C + Math.sin(a) * r]; };

  // the dial: engraved ring plate, its name round the top, the model
  // round the bottom, the lamp dots, the end numbers
  var dial = function (svg, label, code, max) {
    var uid = Math.random().toString(36).slice(2, 8);
    mk("circle", { class: "gs-plate-ring", cx: C, cy: C, r: 79 }, svg);
    mk("circle", { class: "gs-ring", cx: C, cy: C, r: 89 }, svg);
    // the name: along the top of the plate, reading left to right
    var top = mk("path", { id: "gs-t" + uid, d: "M " + (C - 76) + " " + C + " A 76 76 0 0 1 " + (C + 76) + " " + C, fill: "none" }, svg);
    var tt = mk("text", { class: "gs-arc", "text-anchor": "middle" }, svg);
    mk("textPath", { href: "#" + top.id, startOffset: "50%" }, tt).textContent = label;
    // the model: in the gap at the bottom, reading upright
    var bl = at(225, 82), br = at(135, 82);
    var bot = mk("path", { id: "gs-b" + uid, d: "M " + bl[0].toFixed(1) + " " + bl[1].toFixed(1) + " A 82 82 0 0 0 " + br[0].toFixed(1) + " " + br[1].toFixed(1), fill: "none" }, svg);
    var bt = mk("text", { class: "gs-arc gs-arc--code", "text-anchor": "middle" }, svg);
    mk("textPath", { href: "#" + bot.id, startOffset: "50%" }, bt).textContent = code;
    // the scale: fine tick lines, a longer one at each end and the middle
    var dots = [];
    for (var i = 0; i < DOTS; i++) {
      var major = i % 20 === 0, deg = angle(i / (DOTS - 1));
      var p1 = at(deg, major ? 93 : 96), p2 = at(deg, 106);
      dots.push(mk("line", { class: "gs-dot" + (major ? " is-major" : ""), x1: p1[0].toFixed(1), y1: p1[1].toFixed(1), x2: p2[0].toFixed(1), y2: p2[1].toFixed(1) }, svg));
    }
    [[0, "0"], [1, String(max)]].forEach(function (m) {
      var p = at(angle(m[0]), 114);
      mk("text", { class: "gs-num", x: p[0].toFixed(1), y: (p[1] + 3).toFixed(1) }, svg).textContent = m[1];
    });
    return dots;
  };

  /* drums: a strip of digits per wheel (three turns), rolled by translateY */
  var drums = function (host, digits) {
    var w = [];
    for (var i = 0; i < digits; i++) {
      var d = document.createElement("span"); d.className = "gs-drum";
      var s = document.createElement("span"); s.className = "gs-strip";
      for (var t = 0; t < 30; t++) { var n = document.createElement("span"); n.textContent = t % 10; s.appendChild(n); }
      d.appendChild(s); host.appendChild(d); w.push(s);
    }
    return w;
  };
  var showDigits = function (wheels, value, turns, dur) {
    var s = String(value).padStart(wheels.length, "0");
    wheels.forEach(function (strip, i) {
      var digit = +s.charAt(i), stop = digit + (turns ? Math.min(2, wheels.length - 1 - i + (digit ? 0 : 1)) * 10 : 0);
      strip.style.setProperty("--dur", (dur || 0) + (wheels.length - 1 - i) * 220 + "ms");
      strip.style.transform = "translateY(" + (-stop * (100 / 30)) + "%)";
    });
  };

  // the phases, published for the sound (see the header)
  var bus = gs.worxTelemetry = { units: [], onPhase: null, onPower: null, onRelay: null, live: false, focus: 0, owner: "logos" };
  var phase = function (u, name, from, to, dur) {
    u.phase = { name: name, from: from, to: to, dur: dur, t0: performance.now() };
    if (bus.onPhase) { try { bus.onPhase(u, u.phase); } catch (e) {} }
  };
  var near = function (u, on) { u.el.classList.toggle("is-near", on); };

  var units = $$("[data-gs-unit]").map(function (li) {
    var label = $(".gs-label", li).firstChild.textContent.trim();
    var u = {
      el: li, to: +li.dataset.to, max: +li.dataset.max,
      knurl: $("[data-gs-knurl]", li), wobble: $(".gs-wobble", li),
      done: false
    };
    u.dots = dial($("[data-gs-dial]", li), label, li.dataset.code || "", u.max);
    u.wheels = drums($("[data-gs-drums]", li), String(u.to).length);
    showDigits(u.wheels, 0);
    status(u, "standby");
    u.index = bus.units.length;
    bus.units.push(u);
    return u;
  });
  function status(u, s) {
    u.el.classList.remove("is-standby", "is-acquire", "is-lock");
    u.el.classList.add("is-" + s);
  }
  var turn = function (u, p, ms) {
    u.knurl.style.setProperty("--dur", ms + "ms");
    u.knurl.style.setProperty("--a", angle(p) + "deg");
  };
  // the dots behind the pointer: lit up to p, the head brightest
  var lightTo = function (u, p, head) {
    var n = Math.round(p * (DOTS - 1));
    u.dots.forEach(function (d, i) { d.classList.toggle("is-lit", i <= n); d.classList.toggle("is-head", !!head && i === n); d.classList.toggle("is-rest", !head && i === n); });
  };
  // the dots chase the pointer as it turns, on the same easing
  var chase = function (u, from, to, ms) {
    var t0 = null;
    (function step(now) {
      if (t0 === null) t0 = now;
      var k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      lightTo(u, from + (to - from) * e, k < 1);
      if (k < 1) requestAnimationFrame(step);
    })(performance.now());
  };

  /* waking: search the band, turn to the figure, lock */
  var wake = function (u, done) {
    if (u.done) return;
    u.done = true;
    u.el.classList.add("is-woken");
    var p = u.to / u.max;
    if (reduced) { turn(u, p, 0); lightTo(u, p); showDigits(u.wheels, u.to); status(u, "lock"); u.phase = { name: "lock", from: p, to: p, dur: 0, t0: 0 }; if (done) done(); return; }
    status(u, "acquire");
    // searching: a sweep up the band, a fall back, a hunt near the mark
    var hi = Math.min(0.9, p + 0.35);
    turn(u, hi, 700); chase(u, 0, hi, 700); phase(u, "search", 0, hi, 700);
    later(760, function () { turn(u, p * 0.4, 520); chase(u, hi, p * 0.4, 520); phase(u, "slip", hi, p * 0.4, 520); });
    later(1320, function () {
      // and on to the figure, the drums rolling up with it
      turn(u, p, 1700); chase(u, p * 0.4, p, 1500); phase(u, "approach", p * 0.4, p, 1700);
      u.el.classList.add("is-rolling");
      showDigits(u.wheels, u.to, true, 1500);
    });
    later(1320 + 520, function () { near(u, true); });
    later(2900, function () { u.el.classList.remove("is-rolling"); });
    later(3150, function () { near(u, false); status(u, "lock"); lightTo(u, p); phase(u, "lock", p, p, 0); u.ready = true; u.restUntil = Date.now() + 12000; if (done) done(); });
  };

  var powered = false;
  var power = function () {
    if (powered) return;
    powered = true;
    bus.live = true;
    if (bus.onPower) { try { bus.onPower(); } catch (e) {} }
    gs.classList.add("is-live");
    later(200, function () { gs.classList.add("is-signal"); });
  };

  if (reduced || !("IntersectionObserver" in window)) {
    gs.classList.add("is-live");
    units.forEach(function (u) { wake(u); });
    return;
  }

  var phone = window.matchMedia("(max-width: 640px)");
  var woken = false, waiting = [];

  // the console's first wake: on desktop the tuners one after another,
  // left to right; on phones (one tuner at a time) each as it is seen
  var start = function () {
    if (woken) return;
    woken = true;
    power();
    if (!phone.matches) { units.forEach(function (u, i) { later(700 + i * 1000, function () { wake(u); }); }); return; }
    waiting.forEach(function (u) { later(300, function () { wake(u); }); });
    waiting = [];
  };
  if (phone.matches) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (!e.isIntersecting) return;
        var u = units.filter(function (x) { return x.el === e.target; })[0];
        if (bus.owner !== "console") { if (waiting.indexOf(u) < 0) waiting.push(u); return; }
        io.unobserve(e.target);
        power();
        later(300, function () { wake(u); });
      });
    }, { threshold: 0.6 });
    units.forEach(function (u) { io.observe(u.el); });
  }

  /* the focus: 0 the logos, 1 this console; geometry read on layout
     changes, the eye (the middle of the viewport) on scroll */
  var bandEl = document.querySelector(".hm-marquee"), boardEl = $(".gs-board") || gs;
  var geo = { band: 0, board: 0 };
  var measureFocus = function () {
    var y = window.scrollY;
    var b = boardEl.getBoundingClientRect();
    geo.board = b.top + y + b.height / 2;
    if (bandEl) { var r = bandEl.getBoundingClientRect(); geo.band = r.top + y + r.height / 2; }
    else geo.band = geo.board - window.innerHeight;
  };
  // the feed: a hairline from the logo band down into the panel's vent
  var feed = document.createElement("span");
  feed.className = "gs-feed";
  feed.setAttribute("aria-hidden", "true");
  feed.appendChild(document.createElement("i"));
  gs.insertBefore(feed, gs.firstChild);
  var relay = function () {
    gs.classList.remove("is-relay"); void gs.offsetWidth; gs.classList.add("is-relay");
    if (warmPartner) warmPartner();      // defined further down; absent on a load already at the console
    if (bus.onRelay) { try { bus.onRelay(); } catch (e) {} }
  };
  var lastEye = 0, fRaf = 0;
  var readFocus = function () {
    fRaf = 0;
    var eye = window.scrollY + window.innerHeight / 2, span = geo.board - geo.band || 1;
    var raw = (eye - geo.band) / span;
    var k = Math.max(0, Math.min(1, (raw - 0.45) / 0.25));
    bus.focus = k * k * (3 - 2 * k);
    var down = eye >= lastEye;
    lastEye = eye;
    // ownership turns at points apart: no flicker on the line
    if (bus.owner !== "console" && raw > 0.62) {
      bus.owner = "console";
      if (!woken) { relay(); later(620, start); }
      else if (down) relay();
      else if (phone.matches) start();
    } else if (bus.owner === "console" && raw < 0.38) {
      bus.owner = "logos";
    }
  };
  var focusSoon = function () { if (!fRaf) fRaf = requestAnimationFrame(readFocus); };
  window.addEventListener("scroll", focusSoon, { passive: true });
  window.addEventListener("resize", function () { measureFocus(); focusSoon(); });
  window.addEventListener("load", function () { measureFocus(); focusSoon(); });
  if (window.ResizeObserver) new ResizeObserver(function () { measureFocus(); focusSoon(); }).observe(document.documentElement);
  measureFocus(); readFocus();
  // a screen that cannot bring the console to the middle: it wakes once
  // it has been in full view a while
  new IntersectionObserver(function (en) {
    if (!en[0].isIntersecting || woken) return;
    setTimeout(function () {
      var r = boardEl.getBoundingClientRect();
      if (!woken && r.top >= 0 && r.bottom <= window.innerHeight) { bus.owner = "console"; start(); }
    }, 2600);
  }, { threshold: 0.98 }).observe(boardEl);

  /* then they keep playing, one at a time, never all at once: a tuner
     eases back down its band (its drums spinning down), holds a beat,
     and climbs back to its figure with weight, a little past and back;
     its ring breathes out as it settles, and it rests there at least 20 s
     before it moves again (one tuner every 9 s at most). Only on screen, and only one
     moving at any moment, so it reads as a live instrument, not noise. */
  var turnN = 0, busy = false;
  var visible = function (u) {
    var r = u.el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  };
  var tiles = [].slice.call(document.querySelectorAll(".hm-marquee .bm"));
  var warmPartner = function () {
    var mid = window.innerWidth / 2, best = null, bd = 1e9;
    tiles.forEach(function (t) { var r = t.getBoundingClientRect(); if (r.bottom < 0 || r.top > window.innerHeight) return; var d = Math.abs(r.left + r.width / 2 - mid) + Math.random() * 160; if (d < bd) { bd = d; best = t; } });
    if (!best) return;
    best.classList.add("is-tuned");
    setTimeout(function () { best.classList.remove("is-tuned"); }, 2600);
  };
  var retune = function (u) {
    busy = true;
    var p = u.to / u.max;
    var low = p * (0.22 + Math.random() * 0.2), lowN = Math.max(1, Math.round(u.to * low / p));
    status(u, "acquire");
    u.el.classList.add("is-rolling");
    turn(u, low, 900); chase(u, p, low, 900); phase(u, "release", p, low, 900);
    showDigits(u.wheels, lowN, false, 700);
    setTimeout(function () { phase(u, "hold", low, low, 450); }, 900);
    setTimeout(function () {
      warmPartner();
      turn(u, p, 1900); chase(u, low, p, 1700); phase(u, "approach", low, p, 1900);
      showDigits(u.wheels, u.to, true, 1600);
    }, 1350);
    setTimeout(function () { near(u, true); }, 1350 + 600);
    setTimeout(function () { u.el.classList.remove("is-rolling"); }, 3200);
    // settled on its figure, it rests there a good while before it moves again
    setTimeout(function () { near(u, false); status(u, "lock"); lightTo(u, p); phase(u, "lock", p, p, 0); busy = false; u.restUntil = Date.now() + 20000; }, 3500);
  };
  setInterval(function () {
    if (busy || document.hidden || !onScreen || bus.owner !== "console") return;
    var now = Date.now();
    var ready = units.filter(function (u) { return u.ready && visible(u) && now > (u.restUntil || 0); });
    if (!ready.length) return;
    retune(ready[turnN++ % ready.length]);
  }, 9000);

  /* the scroll turns the locked knobs a little, with weight */
  var spin = 0, lastY = window.scrollY, raf = 0, onScreen = false;
  var settle = function () {
    raf = 0;
    spin *= 0.88;
    var s = Math.abs(spin) < 0.05 ? 0 : spin;
    units.forEach(function (u, i) { if (u.el.classList.contains("is-lock")) u.wobble.style.setProperty("--s", (i % 2 ? -s : s).toFixed(2) + "deg"); });
    if (s) raf = requestAnimationFrame(settle);
  };
  new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; }).observe(gs);
  window.addEventListener("scroll", function () {
    var y = window.scrollY, dy = y - lastY;
    lastY = y;
    if (!onScreen) return;
    spin = Math.max(-14, Math.min(14, spin + dy * 0.12));
    if (!raf) raf = requestAnimationFrame(settle);
  }, { passive: true });
})();
