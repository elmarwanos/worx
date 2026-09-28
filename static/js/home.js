/* ============================================================
   Worx | home.js
   The home page's choreography (home.css draws it, cosmos.js renders
   the films and worlds):
     hero       THE GRAND TOUR film; its HUD (NOW PASSING / AU / reel)
                follows the film; the letterbox closes for the Big Bang
                and the Big Crunch; scrolling adds thrust and gathers
                the frame into a floating window (--hx)
     headlines  [data-split] set line by line, rising into view
     partners   two marquee rows, drifting in opposite directions,
                quickening with scroll speed
     archive    pinned: vertical scroll carries the track sideways;
                each project film loads + plays only while on screen
     modules    a tab per division, each with its own world; auto-
                advances while in view until the visitor takes over
     telemetry  counters + gauges on arrival
     flight     stacked stage cards; the T-minus clock follows them
     comms      testimonial carousel
     launch     a launch console under a craft on its way up
   And the instrument layer that makes it mission control: the stage
   rail, ruled + coordinate-stamped headers, atmosphere-entry arcs,
   drifting Martian dust, the targeting reticle, viewfinder frames with
   live timecode on every film, and signals that decode as they land.
   Everything degrades: no WebGL = the CSS stills; reduced motion =
   no film (one still frame), no marquee drift, no auto-advance.
   ============================================================ */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasCosmos = typeof Cosmos !== "undefined";
  var q = function (sel, root) { return (root || document).querySelector(sel); };
  var qa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  // one scroll/resize loop for everything that follows the page
  var onFrame = [];
  var scrollV = 0, lastY = window.scrollY, ticking = false;
  function loop() {
    ticking = false;
    var y = window.scrollY;
    scrollV = scrollV * 0.8 + (y - lastY) * 0.2;
    lastY = y;
    for (var i = 0; i < onFrame.length; i++) onFrame[i](y);
  }
  function request() { if (!ticking) { ticking = true; requestAnimationFrame(loop); } }
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);

  // in-view flags (.is-inview), once
  var seen = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-inview");
      if (e.target.__onView) e.target.__onView();
      seen.unobserve(e.target);
    });
  }, { threshold: 0.2 }) : null;
  function whenSeen(el, fn) {
    if (!el) return;
    el.__onView = fn || null;
    if (seen) seen.observe(el); else { el.classList.add("is-inview"); if (fn) fn(); }
  }

  // on screen or not, continuously: the loops below (marquee, gauges,
  // carousels, SVG flights) rest while their section is out of view
  function whileVisible(el, fn, margin) {
    if (!el) return;
    if (!("IntersectionObserver" in window)) { fn(true); return; }
    new IntersectionObserver(function (en) { fn(en[0].isIntersecting); }, { rootMargin: margin || "0px" }).observe(el);
  }

  // Page geometry, read once per layout change instead of every scroll
  // frame (the frame loop then only writes, never forces a reflow).
  var geo = [];
  function geoOf(el) {
    var g = { el: el, top: 0, h: 0 };
    geo.push(g);
    return g;
  }
  function measureGeo() {
    for (var i = 0; i < geo.length; i++) {
      var el = geo[i].el, t = 0, n = el;
      while (n) { t += n.offsetTop; n = n.offsetParent; }
      geo[i].top = t; geo[i].h = el.offsetHeight;
    }
  }
  var geoT = null;
  function remeasure() { if (geoT) return; geoT = requestAnimationFrame(function () { geoT = null; measureGeo(); request(); }); }
  window.addEventListener("resize", remeasure);
  window.addEventListener("load", remeasure);
  if ("ResizeObserver" in window) new ResizeObserver(remeasure).observe(document.body);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);

  /* ----------------------------------------------------------
     Headlines: split into the lines the browser actually wrapped
     ---------------------------------------------------------- */
  function splitLines(el) {
    var text = el.__text || (el.__text = el.textContent.trim().replace(/\s+/g, " "));
    el.textContent = "";
    var words = text.split(" ").map(function (w) {
      var s = document.createElement("span");
      s.textContent = w + " ";
      el.appendChild(s);
      return s;
    });
    var lines = [], top = null;
    words.forEach(function (s) {
      if (s.offsetTop !== top) { top = s.offsetTop; lines.push([]); }
      lines[lines.length - 1].push(s.textContent);
    });
    el.textContent = "";
    lines.forEach(function (ws) {
      var line = document.createElement("span");
      line.className = "hm-split-line";
      var inner = document.createElement("span");
      inner.textContent = ws.join("").trim();
      line.appendChild(inner);
      el.appendChild(line);
    });
    el.setAttribute("aria-label", text);
  }
  var splits = qa("[data-split]");
  function splitAll() { splits.forEach(splitLines); }
  if (!reduced) {
    splitAll();
    // re-set on a real width change only (a phone's toolbar sliding in
    // and out changes the height, and must not re-run the reveal)
    var rsT, splitW = window.innerWidth;
    window.addEventListener("resize", function () {
      if (window.innerWidth === splitW) return;
      splitW = window.innerWidth;
      clearTimeout(rsT); rsT = setTimeout(splitAll, 200);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(splitAll);
  }
  splits.forEach(function (el) { whenSeen(el); });

  /* ----------------------------------------------------------
     00 · Hero
     ---------------------------------------------------------- */
  var hx = q(".hx");
  if (hx) {
    // (hxStage, not "stage": the modules block below has its own)
    var hxStage = q(".hx-stage", hx);
    var labelEl = q("[data-hx-label]", hx);
    var auEl = q("[data-hx-au]", hx);
    var reelEl = q("[data-hx-reel]", hx);
    var clockEl = q("[data-hx-clock]", hx);
    var auShown = 0, auTarget = 0, lastLabel = "";
    var freeze = (location.search.match(/[?&]cosmos=([\d.]+)/) || [])[1];

    if (hasCosmos) {
      var film = Cosmos.mount(q(".hx-gl", hx), {
        mode: "journey",
        scale: 0.72,
        freezeAt: freeze != null ? parseFloat(freeze) : null,
        // scrolling down adds thrust
        boost: function () { return Math.min(1.1, Math.max(0, scrollV) * 0.03); },
        onTick: function (info) {
          if (filmOn) return;
          if (info.label !== lastLabel) { lastLabel = info.label; labelEl.textContent = info.label; }
          auTarget = info.au;
          auShown += (auTarget - auShown) * 0.06;
          auEl.textContent = auShown.toFixed(2);
          reelEl.style.transform = "scaleX(" + (info.t / Cosmos.LOOP).toFixed(4) + ")";
        },
      });
      if (film) hx.classList.add("has-gl");
    }

    // ---- THE FILM ------------------------------------------------
    var video = q(".hx-video", hx);
    var pointEl = q(".hx-point", hx);
    var flashEl = q(".hx-flash", hx);
    // The film's journey, as the flight recorder reads it: from the
    // pen-point singularity, through the expansion, down to the inner
    // solar system. [film s, chapter, cosmic seconds, scale in AU]
    var YR = 3.156e7;
    var CHAPTERS = [
      [0.0, "BIG BANG", 5.4e-44, 1e-30],
      [1.5, "PRIMORDIAL NEBULA", 3.8e5 * YR, 2.7e12],
      [3.5, "GALAXY FORMING", 1.0e9 * YR, 6.3e13],
      [5.0, "PROTOPLANETS COLLIDE", 9.2e9 * YR, 5.0e3],
      [6.6, "THE SUN IGNITES", 9.21e9 * YR, 1.0e2],
      [7.25, "INNER SOLAR SYSTEM", 13.8e9 * YR, 1.0],
    ];
    var smooth = function (x) { x = clamp01(x); return x * x * (3 - 2 * x); };
    var logLerp = function (a, b, k) { return Math.pow(10, Math.log10(a) + (Math.log10(b) - Math.log10(a)) * k); };
    var fmtTime = function (sec) {
      if (sec < 1e-3) return "10" + supExp(Math.round(Math.log10(sec))) + " s";
      if (sec < 60) return sec.toFixed(sec < 10 ? 2 : 0) + " s";
      var y = sec / YR;
      if (y < 1) return Math.round(sec / 86400) + " days";
      if (y < 1e3) return Math.round(y) + " yr";
      if (y < 1e6) return (y / 1e3).toFixed(0) + " kyr";
      if (y < 1e9) return (y / 1e6).toFixed(y < 1e7 ? 1 : 0) + " Myr";
      return (y / 1e9).toFixed(2) + " Gyr";
    };
    var SUP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
    var supExp = function (n) { return String(n).split("").map(function (c) { return SUP[c] || c; }).join(""); };
    var fmtAU = function (au) {
      if (au < 0.005) return "0.00";
      if (au < 10) return au.toFixed(2);
      if (au < 1e3) return au.toFixed(1);
      var u = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "k"]];
      for (var i = 0; i < u.length; i++) if (au >= u[i][0]) return (au / u[i][0]).toFixed(au / u[i][0] < 10 ? 2 : 1) + " " + u[i][1];
      return au.toFixed(0);
    };
    var timeEl = q("[data-hx-time]", hx);
    var ticksEl = q("[data-hx-ticks]", hx);
    var headEl = q("[data-hx-head]", hx);
    var ticks = [];
    var filmOn = false;

    // ---- cinematic layers --------------------------------------------
    var dustCv = q(".hx-dust", hx), flareEl = q(".hx-flare", hx), grainEl = q(".hx-grain", hx);
    if (grainEl) {
      var gc = document.createElement("canvas"); gc.width = gc.height = 160;
      var gx = gc.getContext("2d"), gi = gx.createImageData(160, 160);
      for (var gi2 = 0; gi2 < gi.data.length; gi2 += 4) { var gv = (Math.random() * 255) | 0; gi.data[gi2] = gi.data[gi2 + 1] = gi.data[gi2 + 2] = gv; gi.data[gi2 + 3] = 255; }
      gx.putImageData(gi, 0, 0);
      grainEl.style.backgroundImage = "url(" + gc.toDataURL() + ")";
    }
    // three depths of dust: far specks, mid motes, near out-of-focus bokeh
    var dust = [], dctx = dustCv ? dustCv.getContext("2d") : null, dW = 0, dH = 0;
    var seedDust = function () {
      if (!dustCv) return;
      dW = dustCv.width = Math.round(dustCv.clientWidth);
      dH = dustCv.height = Math.round(dustCv.clientHeight);
      dust = [];
      var n = Math.min(220, Math.round(dW * dH / 7000));
      for (var i = 0; i < n; i++) {
        var z = Math.random();
        dust.push({ x: Math.random() * dW, y: Math.random() * dH, z: z < 0.62 ? 0.2 + Math.random() * 0.3 : z < 0.93 ? 0.5 + Math.random() * 0.3 : 0.85 + Math.random() * 0.15, p: Math.random() * 6.28 });
      }
    };
    seedDust();
    var dustW = window.innerWidth;
    window.addEventListener("resize", function () { if (window.innerWidth !== dustW) { dustW = window.innerWidth; seedDust(); } });
    var ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener("pointermove", function (e) {
      ptr.tx = e.clientX / window.innerWidth * 2 - 1;
      ptr.ty = e.clientY / window.innerHeight * 2 - 1;
    }, { passive: true });
    var drawDust = function (now, surge, dt) {
      if (!dctx) return;
      dctx.clearRect(0, 0, dW, dH);
      var cx = dW / 2, cy = dH / 2;
      for (var i = 0; i < dust.length; i++) {
        var m = dust[i];
        // drift + a surge that throws everything outward from the centre
        var dx = m.x - cx, dy = m.y - cy, dl = Math.sqrt(dx * dx + dy * dy) + 1;
        var v = (6 + Math.abs(surge) * 900) * m.z * dt;
        var dir = surge < 0 ? -1 : 1;
        m.x += dx / dl * v * (0.3 + Math.abs(surge)) * dir - 10 * m.z * dt;
        m.y += dy / dl * v * (0.3 + Math.abs(surge)) * dir - 3 * m.z * dt + Math.sin(now * 0.0005 + m.p) * 0.08;
        if (surge < -0.2 && dl < 24) {
          // swallowed by the point: reborn at the edge of the frame
          var ang = Math.random() * 6.283, rr = Math.max(dW, dH) * 0.6;
          m.x = cx + Math.cos(ang) * rr; m.y = cy + Math.sin(ang) * rr;
        }
        if (m.x < -30 || m.x > dW + 30 || m.y < -30 || m.y > dH + 30) {
          // reborn near the centre during a surge (streaming out), else anywhere
          if (surge > 0.2) { m.x = cx + (Math.random() - 0.5) * dW * 0.3; m.y = cy + (Math.random() - 0.5) * dH * 0.3; }
          else { m.x = dW + 20; m.y = Math.random() * dH; }
        }
        // parallax: nearer dust slides further with the pointer
        var px2 = m.x - ptr.x * 60 * m.z * m.z, py2 = m.y - ptr.y * 36 * m.z * m.z;
        var tw = 0.6 + 0.4 * Math.sin(now * 0.0021 + m.p);
        if (m.z > 0.85) {
          var r = 10 + (m.z - 0.85) * 160;
          var g = dctx.createRadialGradient(px2, py2, 0, px2, py2, r);
          g.addColorStop(0, "rgba(255,196,130," + (0.12 * tw).toFixed(3) + ")");
          g.addColorStop(0.6, "rgba(229,125,35," + (0.05 * tw).toFixed(3) + ")");
          g.addColorStop(1, "rgba(229,125,35,0)");
          dctx.fillStyle = g;
          dctx.beginPath(); dctx.arc(px2, py2, r, 0, 6.283); dctx.fill();
        } else {
          var a2 = (0.18 + 0.5 * m.z) * tw;
          dctx.fillStyle = "rgba(255," + (170 + (m.z * 60 | 0)) + ",110," + a2.toFixed(3) + ")";
          var sz = 0.6 + m.z * 2.2;
          if (Math.abs(surge) > 0.3) {
            // streaks while the universe is flung outward
            dctx.strokeStyle = dctx.fillStyle; dctx.lineWidth = sz;
            dctx.beginPath(); dctx.moveTo(px2, py2); dctx.lineTo(px2 - dx / dl * v * 3 * dir, py2 - dy / dl * v * 3 * dir); dctx.stroke();
          } else dctx.fillRect(px2, py2, sz, sz);
        }
      }
    };
    var shakeAt = function (t) {
      // violent moments in the film: the Bang, the collisions, ignition
      var s2 = Math.max(0, 1 - t / 0.9) * 14;
      if (t > 5.2 && t < 6.6) s2 = Math.max(s2, 4 + 3 * Math.sin((t - 5.2) * 9));
      if (t > 6.8 && t < 7.3) s2 = Math.max(s2, 7 * (1 - (t - 6.8) / 0.5));
      return s2;
    };
    var flareAt = function (t) {
      return Math.max(0, 1 - Math.abs(t - 0.12) / 0.7) * 1.0 + Math.max(0, 1 - Math.abs(t - 7.0) / 0.5) * 0.6;
    };

    if (video && !reduced && freeze == null) {
      var wpx = window.innerWidth * Math.min(window.devicePixelRatio || 1, 2);
      video.src = video.getAttribute(wpx > 2200 ? "data-src-1440" : wpx > 1100 ? "data-src-1080" : "data-src-720");
      video.load();
      var state = "wait", inView = true, lastNow = 0;
      var setState = function (st) { state = st; };
      // the film plays once and rests on its last frame
      var endFilm = function () {
        setState("end");
        pointEl.style.setProperty("--s", "0");
        flashEl.style.opacity = "0";
        flareEl.style.opacity = "0";
        hxStage.style.setProperty("--glare", "0");
      };
      var playFilm = function () {
        try { video.currentTime = 0; } catch (e) {}
        var p2 = video.play();
        if (p2 && p2.catch) p2.catch(function () {});
        setState("film");
      };
      video.addEventListener("playing", function () {
        if (filmOn) return;
        filmOn = true;
        hx.classList.add("has-film");
        setTimeout(function () { if (film) film.pause(); }, 1500);   // the generated film rests
      });
      // the opening is the film itself, from its Big Bang
      var begin = function () { if (state === "wait") { hx.classList.add("has-film"); if (film) film.pause(); playFilm(); } };
      video.addEventListener("canplaythrough", begin);
      setTimeout(function () { if (video.readyState >= 3) begin(); }, 2500);
      video.addEventListener("ended", function () { if (state === "film") endFilm(); });
      if ("IntersectionObserver" in window) new IntersectionObserver(function (en) {
        inView = en[0].isIntersecting;
        if (!inView) video.pause(); else if (state === "film") { var p3 = video.play(); if (p3 && p3.catch) p3.catch(function () {}); }
      }).observe(hx);

      (function direct(now) {
        var dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016;
        lastNow = now;
        if (!inView || document.hidden) { requestAnimationFrame(direct); return; }   // resting off screen
        ptr.x += (ptr.tx - ptr.x) * 0.05; ptr.y += (ptr.ty - ptr.y) * 0.05;
        video.style.setProperty("--rx", ptr.x.toFixed(3));
        video.style.setProperty("--ry", ptr.y.toFixed(3));
        var surge = 0;

        if (state === "film" && !video.paused) {
          var t = video.currentTime, d = video.duration || 11.05;
          var eruptS = t < 0.55 ? 1.3 * (1 - smooth(t / 0.55)) : 0;
          pointEl.style.setProperty("--s", eruptS.toFixed(4));
          // eruption flash as the film begins
          var e = t < 0.5 ? 1 - t / 0.5 : 0;
          flashEl.style.opacity = (e * e).toFixed(3);
          flareEl.style.opacity = Math.min(1, flareAt(t)).toFixed(3);
          surge = Math.max(t < 1.2 ? 1 - t / 1.2 : 0, t > 5.2 && t < 6.4 ? 0.35 : 0);
          var sh = shakeAt(t);
          video.style.setProperty("--sx", (Math.sin(now * 0.09) * Math.cos(now * 0.043) * sh).toFixed(2) + "px");
          video.style.setProperty("--sy", (Math.cos(now * 0.077) * Math.sin(now * 0.051) * sh).toFixed(2) + "px");
          var glare = t < 1.9 ? 1 - smooth((t - 1.1) / 0.8) : 0;
          hxStage.style.setProperty("--glare", glare.toFixed(3));
          // the flight recorder: chapter, cosmic age, scale
          var ci = 0;
          for (var i = 0; i < CHAPTERS.length; i++) if (t >= CHAPTERS[i][0]) ci = i;
          var c0 = CHAPTERS[ci], c1 = CHAPTERS[Math.min(ci + 1, CHAPTERS.length - 1)];
          var span = c1[0] > c0[0] ? c1[0] - c0[0] : 1;
          var kk = ci === CHAPTERS.length - 1 ? 1 : smooth((t - c0[0]) / span);
          var cosmic = logLerp(c0[2], c1[2], kk), au = logLerp(c0[3], c1[3], kk);
          if (t < 0.25) { cosmic = logLerp(5.4e-44, 1e-32, t / 0.25); au = logLerp(1e-30, 1e-6, t / 0.25); }
          var label = c0[1];
          if (label !== lastLabel) { lastLabel = label; scramble(labelEl, label, 520); }
          timeEl.textContent = fmtTime(cosmic);
          auEl.textContent = fmtAU(au);
          var f = t / d;
          reelEl.style.transform = "scaleX(" + f.toFixed(4) + ")";
          headEl.style.left = (f * 100).toFixed(2) + "%";
          if (!ticks.length && d) {
            CHAPTERS.forEach(function (c) {
              var em = document.createElement("em");
              em.style.left = (c[0] / d * 100).toFixed(2) + "%";
              ticksEl.appendChild(em);
              ticks.push(em);
            });
          }
          ticks.forEach(function (em, j) {
            em.classList.toggle("is-past", j < ci);
            em.classList.toggle("is-now", j === ci);
          });
        }
        if (inView && state !== "wait") drawDust(now, surge, dt);
        requestAnimationFrame(direct);
      })(performance.now());
    }

    // the copy arrives with the film's first light
    setTimeout(function () { hx.classList.add("is-ready"); }, reduced ? 0 : 900);

    // The CTA headline: one line of code, edited by hand. It only runs
    // while the headline is on screen with the two actions (the hero is
    // .is-ready); each time they arrive it starts
    // again from the plain sentence. A chain of timeouts, one per key.
    //   NATURAL -> DELETING -> BRANDED TYPING -> BRANDED -> DELETING ->
    //   NATURAL TYPING -> NATURAL -> ...
    // (its own scope: home.js is one function, and names like "cycle" and
    // "stop" are taken further down)
    var say = q("[data-hx-say]", hx);
    if (say) (function () {
      var typedEl = q("[data-hx-typed]", say);
      var NATURAL = "Works, Like Magic.", BRANDED = "Worx, <like/magic>";
      // both lines start "Wor": the backspace stops there, so the edit
      // turns on one letter, Works -> Worx
      var KEEP = 0;
      while (NATURAL.charAt(KEEP) === BRANDED.charAt(KEEP)) KEEP++;
      var esc = function (t) { return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
      // from the "<" on, the text is code (mono, brand orange)
      var paint = function (str) {
        var k = str.indexOf("<");
        typedEl.innerHTML = k < 0 ? esc(str) : esc(str.slice(0, k)) + '<span class="hx-say-code">' + esc(str.slice(k)) + "</span>";
      };
      if (reduced) {
        paint(BRANDED);
      } else {
        var sayT = null, text = NATURAL, running = false, heroSeen = true;
        var later = function (fn, ms) { sayT = setTimeout(fn, ms); };
        var jitter = function (ms, spread) { return ms + (Math.random() * 2 - 1) * spread; };
        // how long a key takes to type: a hand, not a metronome. Word
        // starts and code punctuation get a beat of thought; the rest runs.
        var keyDelay = function (next, prev) {
          if (next === "<") return jitter(230, 30);   // a beat before opening the tag
          if (prev === " ") return jitter(150, 30);
          if (prev === "<" || prev === "/") return jitter(120, 25);
          if (next === ">") return jitter(140, 25);   // closing it is a decision
          return jitter(82, 26);
        };
        var backspace = function (done) {
          var n = 0;
          (function step() {
            if (text.length <= KEEP) { done(); return; }
            text = text.slice(0, -1); paint(text);
            // a held backspace: the first press, then it repeats and quickens
            later(step, n++ === 0 ? 150 : Math.max(34, 58 - n * 2));
          })();
        };
        var type = function (target, done) {
          (function step() {
            if (text === target) { done(); return; }
            var prev = text.charAt(text.length - 1);
            text = target.slice(0, text.length + 1); paint(text);
            // the brand word lands: let "Worx" sit a moment on its own
            if (text === "Worx") { later(step, jitter(560, 40)); return; }
            later(step, keyDelay(target.charAt(text.length), prev));
          })();
        };
        var typing = function (on) { say.classList.toggle("is-typing", on); };
        var cycle = function (holdNatural) {
          typing(false);
          later(function () {                      // NATURAL, read it
            typing(true);
            backspace(function () {                // DELETING
              later(function () {
                type(BRANDED, function () {        // BRANDED TYPING
                  typing(false);
                  // BRANDED, the brand line, held longest
                  var hold = 3400;
                  later(function () {
                    typing(true);
                    backspace(function () {        // DELETING
                      later(function () {
                        type(NATURAL, function () { cycle(2600); });   // NATURAL TYPING
                      }, 280);
                    });
                  }, hold);
                });
              }, 320);
            });
          }, holdNatural);
        };
        var stop = function () {
          clearTimeout(sayT); running = false;
          text = NATURAL; paint(text); typing(false);
        };
        var shown = function () { return hx.classList.contains("is-ready") && heroSeen && !document.hidden; };
        var sync = function () {
          if (shown() && !running) { running = true; cycle(2200); }   // first read, while the reveal settles
          else if (!shown() && running) stop();
        };
        new MutationObserver(sync).observe(hx, { attributes: true, attributeFilter: ["class"] });
        document.addEventListener("visibilitychange", sync);
        if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { heroSeen = en[0].isIntersecting; sync(); }).observe(say);
      }
    })();

    if (clockEl) {
      var fmt = null;
      try { fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dubai" }); } catch (e) {}
      var tick = function () { if (fmt) clockEl.textContent = fmt.format(new Date()); };
      tick(); setInterval(tick, 15000);
    }

    // the exit: over the hero's held scroll the copy lifts away and the
    // film sinks toward the page ink, so Partners rises out of the dark
    var hxGeo = geoOf(hx), hxLast = "", hxAway = null;
    onFrame.push(function (y) {
      var span = hxGeo.h - window.innerHeight;
      var p = span > 0 ? clamp01((y - hxGeo.top) / span) : 0;
      var v = (reduced ? 0 : p * p * (3 - 2 * p)).toFixed(4);
      if (v !== hxLast) { hxLast = v; hxStage.style.setProperty("--hx", v); }
      // faded out, the actions leave the tab order and the pointer's way
      var away = !reduced && p > 0.45;
      if (away !== hxAway) { hxAway = away; hx.classList.toggle("is-away", away); }
    });
  }

  /* ----------------------------------------------------------
     01 · Partners marquee
     ---------------------------------------------------------- */
  var rows = qa(".hm-marquee-row");
  rows.forEach(function (row) { row.innerHTML += row.innerHTML; });   // seamless loop
  if (rows.length && !reduced) {
    var mpos = 0;
    var hovering = false;
    var marquee = q(".hm-marquee");
    marquee.addEventListener("pointerenter", function () { hovering = true; });
    marquee.addEventListener("pointerleave", function () { hovering = false; });
    var mLast = 0, mOn = false, mRaf = 0, speed = 42;
    // each row's loop length, measured on layout changes, not per frame
    var halves = [];
    var measureRows = function () { halves = rows.map(function (row) { return row.scrollWidth / 2; }); };
    measureRows();
    window.addEventListener("resize", measureRows);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureRows);
    var step = function (now) {
      mRaf = 0;
      if (!mOn) return;
      var dt = mLast ? Math.min(0.05, (now - mLast) / 1000) : 0.016;
      mLast = now;
      // the drift eases between its cruising and hovered speeds, so a
      // pointer arriving slows the logos instead of braking them
      speed += ((hovering ? 12 : 42) - speed) * Math.min(1, dt * 4);
      mpos += (speed + Math.min(260, Math.abs(scrollV) * 6)) * dt;
      rows.forEach(function (row, i) {
        var half = halves[i];
        if (!half) return;
        var o = mpos % half;
        // +1 drifts left, -1 drifts right; both always cover the frame
        var x = (+row.dataset.dir || 1) > 0 ? -o : o - half;
        row.style.transform = "translate3d(" + x.toFixed(1) + "px,0,0)";
      });
      mRaf = requestAnimationFrame(step);
    };
    whileVisible(marquee, function (on) {
      mOn = on; mLast = 0;
      if (on && !mRaf) { measureRows(); mRaf = requestAnimationFrame(step); }
    }, "100px");
  }

  /* ----------------------------------------------------------
     02 · Mission archive
     ---------------------------------------------------------- */
  var archive = q(".hm-archive");
  if (archive) {
    var track = q(".hm-track", archive);
    var wrap = q(".hm-track-wrap", archive);
    var nowEl = q("[data-track-now]", archive);
    var barEl = q("[data-track-bar]", archive);
    var cases = qa(".hm-case", archive);
    var pinMQ = window.matchMedia("(min-width: 900px) and (hover: hover)");
    var travel = 0;

    var layout = function () {
      var pinned = pinMQ.matches && !reduced;
      archive.classList.toggle("is-pinned", pinned);
      if (!pinned) { track.style.setProperty("--tx", "0px"); archive.style.height = ""; return; }
      travel = Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
      archive.style.height = (window.innerHeight + travel) + "px";
      arLast = ""; remeasure();
    };
    layout();
    window.addEventListener("resize", layout);
    pinMQ.addEventListener("change", layout);
    window.addEventListener("load", layout);

    var setProgress = function (p) {
      var n = Math.min(cases.length - 1, Math.round(p * (cases.length - 1)));
      if (nowEl) nowEl.textContent = (n + 1 < 10 ? "0" : "") + Math.min(8, n + 1);
      if (barEl) barEl.style.setProperty("--p", Math.max(0.04, p).toFixed(3));
    };

    var arGeo = geoOf(archive), arLast = "";
    onFrame.push(function (y) {
      if (!archive.classList.contains("is-pinned")) return;
      var span = arGeo.h - window.innerHeight;
      var p = span > 0 ? clamp01((y - arGeo.top) / span) : 0;
      var tx = (-p * travel).toFixed(1);
      if (tx === arLast) return;
      arLast = tx;
      track.style.setProperty("--tx", tx + "px");
      setProgress(p);
    });
    if (wrap) wrap.addEventListener("scroll", function () {
      var max = wrap.scrollWidth - wrap.clientWidth;
      setProgress(max > 0 ? wrap.scrollLeft / max : 0);
    }, { passive: true });

    // project films: fetched on first approach, playing only on screen
    var vids = qa("video[data-src]", archive);
    if ("IntersectionObserver" in window && !reduced) {
      var vio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var v = e.target;
          if (e.isIntersecting) {
            if (!v.src) { v.src = v.dataset.src; v.load(); }
            var pr = v.play();
            if (pr && pr.catch) pr.catch(function () {});
          } else if (!v.paused) v.pause();
        });
      }, { threshold: 0.35 });
      vids.forEach(function (v) {
        v.addEventListener("playing", function () { v.classList.add("is-playing"); });
        vio.observe(v);
      });
    }
  }

  /* ----------------------------------------------------------
     03 · Mission modules
     ---------------------------------------------------------- */
  var mod = q("[data-mod]");
  if (mod) {
    var tabs = qa("[role=tab]", mod);
    var panels = qa("[role=tabpanel]", mod);
    var visual = q(".hm-mod-visual", mod);
    var worldEl = q("[data-mod-world]", mod);
    var capEl = q("[data-mod-caption]", mod);
    // each division is its own computer-science world (code-worlds.js)
    var WORLDS = [
      { name: "SRC / CORE", cap: "Where code compiles into product" },
      { name: "APP / VIEW TREE", cap: "From source to your pocket" },
      { name: "UI / GRID SYSTEM", cap: "Where code meets craft" },
      { name: "AI / LATENT SPACE", cap: "The next frontier" },
      { name: "INFRA / TOPOLOGY", cap: "The power core" },
    ];
    // The plate: on wide screens the world sits left of centre and every
    // service of the division is pinned to its port in it, a leader line
    // out to the label.
    var stage = q(".hm-mod-stage", mod);
    var wide = window.matchMedia("(min-width: 1181px)");
    var R = 0.31;
    var offX = function () {
      var c = q(".hm-mod-gl", mod);
      return wide.matches && c && c.clientHeight ? -0.2 * c.clientWidth / c.clientHeight : 0;
    };
    var world = typeof CodeWorlds !== "undefined" ? CodeWorlds.mount(q(".hm-mod-gl", mod), {
      radius: R, offsetX: offX, ports: function (i) { return qa("a", panels[i]).length; },
    }) : null;
    var current = 0, auto = null, held = false, DUR = 7000, swapT = null;
    mod.style.setProperty("--mod-dur", DUR / 1000 + "s");
    // phones fly through every module instead of tabbing between them
    // (home.css "the flight through the modules"): all divisions are in
    // the page, and the scroll, not a timer, picks the world
    var phone = window.matchMedia("(max-width: 700px)");
    var nEl = q("[data-mod-n]", mod);
    var ticks = qa(".hm-mod-ticks i", mod);
    var flightMarks = function () {
      if (nEl) nEl.textContent = ("0" + (current + 1)).slice(-2);
      ticks.forEach(function (t, j) { t.classList.toggle("is-on", j === current); t.classList.toggle("is-past", j < current); });
      panels.forEach(function (p, j) { p.classList.toggle("is-current", j === current); });
    };

    var SVGNS = "http://www.w3.org/2000/svg";
    var lines = document.createElementNS(SVGNS, "svg");
    lines.setAttribute("class", "hm-mod-lines");
    lines.setAttribute("aria-hidden", "true");
    lines.innerHTML = '<defs><linearGradient id="mod-lg" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#c04527"/><stop offset=".55" stop-color="#e57d23"/><stop offset="1" stop-color="#faa719"/></linearGradient></defs><g></g>';
    visual.appendChild(lines);
    var lineG = q("g", lines), lineGrad = q("#mod-lg", lines);

    var pin = function (draw) {
      lineG.innerHTML = "";
      if (!world || !wide.matches) return;
      var vr = visual.getBoundingClientRect();
      var W = vr.width, H = vr.height;
      var cx = W / 2 + offX() * H;
      var rb = world.radius();
      lines.setAttribute("viewBox", "0 0 " + W + " " + H);
      var links = qa("a", panels[current]);
      var n = links.length, ports = world.anchors(n);
      lineGrad.setAttribute("x1", cx); lineGrad.setAttribute("x2", W * 0.62);
      links.forEach(function (a, i) {
        var ar = a.getBoundingClientRect();
        var ax = ar.left - vr.left - 12, ay = ar.top - vr.top + 11;
        var mx = ports[i][0], my = ports[i][1];
        var ex = cx + rb * 1.1 + 26 + i * 6;
        var g = document.createElementNS(SVGNS, "g");
        g.setAttribute("class", "hm-mod-pin" + (draw ? " is-drawing" : ""));
        g.style.setProperty("--d", (0.15 + i * 0.09) + "s");
        g.innerHTML = '<path pathLength="1" d="M' + mx.toFixed(1) + " " + my.toFixed(1) + "L" + ex.toFixed(1) + " " + ay.toFixed(1) + "L" + ax.toFixed(1) + " " + ay.toFixed(1) + '"/>' +
          '<circle class="hm-mod-pin-ring" cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="7"/>' +
          '<circle class="hm-mod-pin-dot" cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="2.4"/>' +
          '<circle class="hm-mod-pin-end" cx="' + ax.toFixed(1) + '" cy="' + ay.toFixed(1) + '" r="1.8"/>';
        lineG.appendChild(g);
        a.__pin = g;
      });
      if (draw) requestAnimationFrame(function () { requestAnimationFrame(function () {
        qa(".hm-mod-pin", lineG).forEach(function (g) { g.classList.remove("is-drawing"); });
      }); });
    };
    panels.forEach(function (p) {
      qa("a", p).forEach(function (a, i) {
        // the service lights its part of the world, and its traffic runs
        var on = function () { if (a.__pin) a.__pin.classList.add("is-hot"); if (world) world.hot(i); };
        var off = function () { if (a.__pin) a.__pin.classList.remove("is-hot"); if (world) world.hot(-1); };
        a.addEventListener("pointerenter", on); a.addEventListener("focus", on);
        a.addEventListener("pointerleave", off); a.addEventListener("blur", off);
      });
    });
    if ("ResizeObserver" in window) new ResizeObserver(function () { pin(false); }).observe(stage);
    else window.addEventListener("resize", function () { pin(false); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { pin(false); });
    pin(true);

    var select = function (i, focus) {
      if (i === current && !focus) return;
      current = (i + tabs.length) % tabs.length;
      tabs.forEach(function (t, j) {
        var on = j === current;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        // restart the timer underline
        if (on) { t.classList.remove("is-active"); void t.offsetWidth; t.classList.add("is-active"); }
      });
      panels.forEach(function (p, j) { p.hidden = !phone.matches && j !== current; });
      flightMarks();
      if (focus) tabs[current].focus();
      // the pill row (narrow screens) glides the chosen division into view,
      // without moving the page
      var list = tabs[current].closest(".hm-mod-list");
      if (list && list.scrollWidth > list.clientWidth + 1) {
        var li = tabs[current].parentNode;
        var to = li.offsetLeft - (list.clientWidth - li.offsetWidth) / 2;
        list.scrollTo({ left: Math.max(0, to), behavior: reduced ? "auto" : "smooth" });
      }
      var w = WORLDS[current];
      visual.classList.add("is-switching");
      lineG.innerHTML = "";
      clearTimeout(swapT);
      swapT = setTimeout(function () {
        if (world) { world.hot(-1); world.set(current); }
        worldEl.textContent = w.name;
        capEl.textContent = w.cap;
        visual.classList.remove("is-switching");
        pin(true);
      }, 420);
    };

    var modSeen = false, modOn = false;
    // the underline is the timer: it restarts with it, and freezes while
    // the visitor is reading (pointer or focus inside)
    var restartLine = function () {
      var t = tabs[current];
      t.classList.remove("is-active"); void t.offsetWidth; t.classList.add("is-active");
    };
    var pauseAuto = function () { clearInterval(auto); mod.classList.add("is-paused"); };
    var startAuto = function () {
      clearInterval(auto);
      mod.classList.remove("is-paused");
      if (held || reduced || !modOn || phone.matches) return;
      restartLine();
      auto = setInterval(function () { select(current + 1); }, DUR);
    };
    var hold = function () { held = true; mod.classList.add("is-held"); clearInterval(auto); };
    // only the active tab is in the tab order; arrows move between them
    tabs.forEach(function (t, j) { t.tabIndex = j === current ? 0 : -1; });
    // the timer rests while the section is off screen, and starts its
    // division afresh (the underline with it) when it comes back
    whileVisible(mod, function (on) {
      modOn = on;
      if (!on) { clearInterval(auto); return; }
      if (phone.matches) { flight(); return; }
      if (!modSeen || held) return;
      startAuto();
    });

    // phones: the plate docks under the header; whichever module's head
    // has reached its lower edge is the one on screen, and every service
    // (and head) that slides under the plate fades out of its way
    var docks = qa(".hm-mod-panel-head, .hm-mod-panel a", mod);
    var plateTop = function () { return parseFloat(getComputedStyle(visual).top) || 0; };
    var flightT = 0;
    var flight = function () {
      flightT = 0;
      if (!phone.matches) return;
      var sr = stage.getBoundingClientRect();
      if (sr.bottom < 0 || sr.top > window.innerHeight) return;
      // short screens (phones on their side) keep the plate in the flow:
      // there the switch line is mid-screen and nothing docks
      var stuck = getComputedStyle(visual).position === "sticky";
      var line = stuck ? visual.getBoundingClientRect().bottom : window.innerHeight * 0.5;
      var at = 0;
      panels.forEach(function (p, j) { if (p.getBoundingClientRect().top <= line + 60) at = j; });
      if (at !== current) select(at);
      docks.forEach(function (d) { d.classList.toggle("is-docked", stuck && d.getBoundingClientRect().top < line - 4); });
    };
    window.addEventListener("scroll", function () {
      if (phone.matches && !flightT) flightT = requestAnimationFrame(flight);
    }, { passive: true });
    // a pill (or an arrow key) on a phone flies the page to its module
    var flyTo = function (i) {
      var head = panels[i].getBoundingClientRect().top + window.scrollY;
      var stuck = getComputedStyle(visual).position === "sticky";
      var to = head - (stuck ? plateTop() + visual.offsetHeight + 16 : 88);
      // the first module sits right under the plate: fly to the plate itself
      if (!i && stuck) to = Math.min(to, stage.getBoundingClientRect().top + window.scrollY - plateTop());
      window.scrollTo({ top: to, behavior: reduced ? "auto" : "smooth" });
    };
    var setMode = function () {
      if (phone.matches) {
        clearInterval(auto);
        panels.forEach(function (p) { p.hidden = false; });
        flight();
      } else {
        docks.forEach(function (d) { d.classList.remove("is-docked"); });
        panels.forEach(function (p, j) { p.hidden = j !== current; });
        if (modSeen && modOn) startAuto();
      }
      flightMarks();
    };
    if (phone.addEventListener) phone.addEventListener("change", setMode); else if (phone.addListener) phone.addListener(setMode);
    setMode();

    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () {
        if (phone.matches) { flyTo(i); return; }
        hold(); select(i);
      });
      t.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        if (phone.matches) { var to = (current + d + tabs.length) % tabs.length; tabs[to].focus(); flyTo(to); return; }
        hold(); select(current + d, true);
      });
    });
    mod.addEventListener("pointerenter", function (e) { if (!held && e.pointerType === "mouse") pauseAuto(); });
    mod.addEventListener("pointerleave", function (e) { if (!held && e.pointerType === "mouse") startAuto(); });
    // keyboard focus inside the module holds the timer too
    mod.addEventListener("focusin", function () { if (!held) pauseAuto(); });
    mod.addEventListener("focusout", function (e) { if (!held && !mod.contains(e.relatedTarget)) startAuto(); });
    whenSeen(mod, function () { modSeen = true; modOn = true; startAuto(); });
  }

  /* ----------------------------------------------------------
     04 · Why Worx: the star chart. An ecliptic is strung through the
     hearts of the four constellations (wherever the layout puts them),
     then the chart draws itself in when it comes into view.
     ---------------------------------------------------------- */
  var chart = q("[data-chart]");
  if (chart) {
    var eNS = "http://www.w3.org/2000/svg";
    var ecl = document.createElementNS(eNS, "svg");
    ecl.setAttribute("class", "hm-chart-ecl");
    ecl.setAttribute("aria-hidden", "true");
    chart.insertBefore(ecl, q(".hm-chart-list", chart));
    var strung = function () {
      var cr = chart.getBoundingClientRect();
      var figs = qa(".hm-star-fig", chart);
      var pts = figs.map(function (f) {
        var r = f.getBoundingClientRect();
        return [r.left - cr.left + r.width / 2, r.top - cr.top + r.height / 2];
      });
      // one row: the line runs across the sky. The phone legend (figures
      // left, right, left, right) gets a meander falling down the sheet.
      // The 2x2 tablet grid gets neither: there it would only cross the text.
      var oneRow = pts.length > 1 && pts[pts.length - 1][0] > pts[0][0] + cr.width * 0.5 && pts.every(function (p, i) { return !i || p[0] > pts[i - 1][0]; });
      var zig = !oneRow && pts.length > 2 && window.matchMedia("(max-width: 560px)").matches && pts.every(function (p, i) {
        return !i || (p[1] > pts[i - 1][1] + 20 && Math.abs(p[0] - pts[i - 1][0]) > cr.width * 0.3);
      });
      if (!oneRow && !zig) { ecl.innerHTML = ""; return; }
      var last = pts[pts.length - 1];
      var ext = zig ?
        [[pts[0][0], -30]].concat(pts, [[last[0], cr.height + 30]]) :
        [[-40, pts[0][1] + 40]].concat(pts, [[cr.width + 40, last[1] - 30]]);
      // Catmull-Rom through the points, as cubic Beziers
      var d = "M" + ext[0][0].toFixed(1) + " " + ext[0][1].toFixed(1);
      for (var i = 0; i < ext.length - 1; i++) {
        var p0 = ext[i - 1] || ext[i], p1 = ext[i], p2 = ext[i + 1], p3 = ext[i + 2] || p2;
        d += "C" + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + " " + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + " " +
          (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + " " + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + " " +
          p2[0].toFixed(1) + " " + p2[1].toFixed(1);
      }
      ecl.setAttribute("viewBox", "0 0 " + cr.width + " " + cr.height);
      ecl.classList.toggle("is-zig", zig);
      var gAxis = zig ? 'x1="0" x2="0" y1="0" y2="' + cr.height + '"' : 'x1="0" x2="' + cr.width + '"';
      ecl.innerHTML = '<defs><linearGradient id="ecl-g" gradientUnits="userSpaceOnUse" ' + gAxis + '><stop offset="0" stop-color="#c04527" stop-opacity="0"/><stop offset=".25" stop-color="#e57d23"/><stop offset=".75" stop-color="#faa719"/><stop offset="1" stop-color="#c04527" stop-opacity="0"/></linearGradient></defs>' +
        '<path pathLength="1" d="' + d + '"/>' + (zig ? "" :
        '<text x="' + ((pts[1][0] + pts[2][0]) / 2).toFixed(1) + '" y="' + (Math.max(pts[1][1], pts[2][1]) + 4).toFixed(1) + '" text-anchor="middle">ECLIPTIC · 23.4°</text>');
    };
    strung();
    if ("ResizeObserver" in window) new ResizeObserver(strung).observe(chart);
    else window.addEventListener("resize", strung);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(strung);
    whenSeen(chart);
  }

  /* ----------------------------------------------------------
     05 · Telemetry counters
     ---------------------------------------------------------- */
  var tele = q(".hm-telemetry");
  whenSeen(tele, function () {
    qa("[data-tele]", tele).forEach(function (el) {
      var to = +el.dataset.tele, t0 = null, dur = reduced ? 0 : 1800;
      (function up(now) {
        if (t0 === null) t0 = now;
        var k = dur ? clamp01((now - t0) / dur) : 1;
        el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(up);
      })(performance.now());
    });
  });

  // The mission odometer: wheels roll from the 2019 launch to this year.
  var odo = q("[data-odo]");
  if (tele && odo) {
    var FROM = "2019", NOW = String(new Date().getFullYear());
    var strips = [];
    for (var oi = 0; oi < 4; oi++) {
      var wheel = document.createElement("span");
      wheel.className = "hm-odo-wheel";
      var strip = document.createElement("span");
      strip.className = "hm-odo-strip";
      for (var cyc = 0; cyc < 3; cyc++) for (var dg = 0; dg < 10; dg++) {
        var sp = document.createElement("span"); sp.textContent = dg; strip.appendChild(sp);
      }
      var f = +FROM.charAt(oi);
      strip.style.transform = "translateY(" + (-f / 30 * 100) + "%)";
      wheel.appendChild(strip); odo.appendChild(wheel);
      strips.push({ el: strip, from: f, to: +NOW.charAt(oi) });
    }
    odo.setAttribute("aria-label", FROM + " to " + NOW);
    var nowMark = q("[data-tl-now]");
    if (nowMark) nowMark.textContent = NOW;
    var elapsedEl = q("[data-odo-elapsed]");
    var prevView = tele.__onView;
    tele.__onView = function () {
      if (prevView) prevView();
      strips.forEach(function (st, i) {
        // unchanged digits hold; changing ones spin a full turn past
        var target = st.to === st.from ? st.from : (st.to > st.from ? st.to + 10 : st.to + 10);
        st.el.style.transitionDuration = (1.6 + i * 0.45) + "s";
        st.el.style.transform = "translateY(" + (-target / 30 * 100) + "%)";
      });
      var yrs = +NOW - +FROM, e0 = null;
      (function up(t) {
        if (e0 === null) e0 = t;
        var k = reduced ? 1 : clamp01((t - e0) / 2400);
        if (elapsedEl) elapsedEl.textContent = Math.round(yrs * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(up);
      })(performance.now());
    };
  }

  // Live gauges: once swept in, each dial breathes around its true
  // reading like a live sensor, and every few seconds re-samples (the
  // number flickers through a quick count and settles back on the real
  // figure). The resting values are always the real ones.
  var dials = qa(".hm-dial");
  if (tele && dials.length && !reduced) {
    var live = dials.map(function (d, i) {
      var num = q("[data-tele]", d);
      return {
        el: d, p: parseFloat(d.style.getPropertyValue("--p")) || 0.5,
        arc: q(".hm-dial-arc", d), needle: q(".hm-dial-needle", d),
        num: num, val: +num.dataset.tele, ph: i * 1.7, next: 0,
      };
    });
    var teleOn = true, breatheRaf = 0, breatheFn = null;
    var goLive = function () {
      var t0 = performance.now();
      live.forEach(function (g, i) { g.el.classList.add("is-live"); g.next = t0 + 1800 + i * 900; });
      (breatheFn = function breathe(now) {
        breatheRaf = 0;
        if (!teleOn) return;   // resting off screen (whileVisible restarts it)
        var ts = (now - t0) / 1000;
        live.forEach(function (g) {
          // two slow drifts and a little sensor jitter around the reading
          var v = g.p + Math.sin(ts * 0.9 + g.ph) * 0.018 + Math.sin(ts * 2.3 + g.ph * 2) * 0.008 + (Math.random() - 0.5) * 0.004;
          v = Math.max(0.02, Math.min(0.995, v));
          g.arc.style.strokeDasharray = (v * 100).toFixed(2) + " 100";
          g.needle.style.transform = "rotate(" + (v * 360).toFixed(2) + "deg)";
          if (now > g.next && !g.sampling) {
            // re-sample: flicker through a quick count, settle on the truth
            g.sampling = true;
            g.el.classList.add("is-sampling");
            var s0 = now, span = Math.max(2, Math.round(g.val * 0.06));
            (function sample(t) {
              var k = (t - s0) / 650;
              if (k < 1) {
                g.num.textContent = Math.max(0, g.val - span + Math.round(Math.random() * span * 1.4));
                requestAnimationFrame(sample);
              } else {
                g.num.textContent = g.val;
                g.el.classList.remove("is-sampling");
                g.sampling = false;
                g.next = t + 3500 + Math.random() * 3000;
              }
            })(now);
          }
        });
        breatheRaf = requestAnimationFrame(breathe);
      })(t0);
    };
    whileVisible(tele, function (on) {
      teleOn = on;
      if (on && breatheFn && !breatheRaf) breatheRaf = requestAnimationFrame(breatheFn);
    });
    var prevTele = tele.__onView;
    tele.__onView = function () {
      if (prevTele) prevTele();
      setTimeout(goLive, 2700);   // after the sweep-in and the count-up
    };
  }

  // The comet riding the trajectory from the launch to now, with scroll.
  var orbitPath = q("#orbit-path"), comet = q(".hm-tl-comet"), orbitSvg = q(".hm-tl-orbit");
  if (tele && orbitPath && comet && orbitPath.getTotalLength) {
    var olen = orbitPath.getTotalLength();
    var teGeo = geoOf(tele), orb = { w: 0, h: 0, x: 0, y: 0 }, cometLast = -1;
    var measureOrbit = function () { orb.w = orbitSvg.clientWidth; orb.h = orbitSvg.clientHeight; orb.x = orbitSvg.offsetLeft; orb.y = orbitSvg.offsetTop; cometLast = -1; };
    measureOrbit();
    if ("ResizeObserver" in window) new ResizeObserver(measureOrbit).observe(tele); else window.addEventListener("resize", measureOrbit);
    onFrame.push(function (y) {
      var top = teGeo.top, h = teGeo.h, vh = window.innerHeight;
      if (y + vh < top - 100 || y > top + h + 100 || !orb.w) return;   // off screen / hidden (phones)
      var p = clamp01((y + vh - top) / (h + vh * 0.6));
      if (Math.abs(p - cometLast) < 0.0005) return;
      cometLast = p;
      var pt = orbitPath.getPointAtLength(p * olen), pt2 = orbitPath.getPointAtLength(Math.min(olen, p * olen + 2));
      var bw = orb.w / 1600, bh = orb.h / 600;
      var ox = orb.x, oy = orb.y;
      var cx2 = ox + pt.x * bw, cy2 = oy + pt.y * bh;
      var ang = Math.atan2((pt2.y - pt.y) * bh, (pt2.x - pt.x) * bw) * 180 / Math.PI;
      comet.style.transform = "translate3d(" + cx2.toFixed(1) + "px," + cy2.toFixed(1) + "px,0)";
      comet.style.setProperty("--ang", ang.toFixed(1) + "deg");
    });
  }

  /* ----------------------------------------------------------
     06 · Flight plan. The stage cards stack as you scroll; each one the
     next lands on tips back and sinks into the deck, the live card's
     edge fills as the next closes in, and the countdown board flips to
     the live stage, clicking through every number on the way.
     ---------------------------------------------------------- */
  var stages = qa(".hm-stage");
  var fboard = q("[data-fclock]");
  stages.forEach(function (s, i) { s.style.setProperty("--i", i); });
  if (stages.length) (function () {
    var flight = q(".hm-flight");
    var STEP = 14;                              // how far each stuck card peeks (CSS; read back below)
    var stuck = [], live = -1;
    var measure = function () {
      stuck = stages.map(function (s) { return parseFloat(getComputedStyle(s).top) || 0; });
      if (stuck.length > 1 && stuck[1] > stuck[0]) STEP = stuck[1] - stuck[0];
    };
    measure();
    window.addEventListener("resize", measure);

    // the board
    var flaps = fboard ? qa("[data-flap]", fboard) : [];
    var nEl = fboard && q("[data-fclock-n]", fboard), nameEl = fboard && q("[data-fclock-name]", fboard);
    var rungs = fboard ? qa(".hm-fclock-ladder li", fboard) : [];
    var NAMES = stages.map(function (s, i) {
      return i === stages.length - 1 ? "LIFTOFF" : q("h3", s).firstChild.textContent.trim().toUpperCase();
    });
    var shown = 6, want = 6, flipT = null;
    var setLeaf = function (flap, part, d) { q(".hm-flap-" + part + " i", flap).textContent = d; };
    var flipTo = function (flap, d, dur) {
      var old = q(".hm-flap-top i", flap).textContent;
      if (old === d) return;
      if (reduced) { ["top", "bot", "fall", "rise"].forEach(function (k) { setLeaf(flap, k, d); }); return; }
      flap.classList.remove("is-flip");
      flap.style.setProperty("--fd", dur + "ms");
      setLeaf(flap, "top", d); setLeaf(flap, "rise", d);
      setLeaf(flap, "fall", old); setLeaf(flap, "bot", old);
      void flap.offsetWidth;
      flap.classList.add("is-flip");
      clearTimeout(flap.__t);
      flap.__t = setTimeout(function () { setLeaf(flap, "bot", d); }, dur * 2);
    };
    var two = function (n) { return (n < 10 ? "0" : "") + n; };
    // one number per click; a long way to go runs fast, the last one lands
    var tick = function () {
      flipT = null;
      if (shown === want) return;
      shown += want < shown ? -1 : 1;
      var far = Math.abs(want - shown) > 0;
      var dur = far ? 90 : 190;
      var str = two(shown);
      flipTo(flaps[0], str.charAt(0), dur);
      flipTo(flaps[1], str.charAt(1), dur);
      if (shown !== want) flipT = setTimeout(tick, dur * 2 + 20);
    };
    var board = function (i) {
      if (!fboard) return;
      want = stages.length - 1 - i;
      if (!flipT) tick();
      nEl.textContent = "STAGE " + two(i + 1) + " / " + two(stages.length);
      if (reduced) nameEl.textContent = NAMES[i]; else scramble(nameEl, NAMES[i], 420);
      rungs.forEach(function (r, j) { r.classList.toggle("is-past", j < i); r.classList.toggle("is-now", j === i); });
      fboard.classList.toggle("is-go", i === stages.length - 1);
    };

    var last = [], flGeo = geoOf(flight);
    onFrame.push(function (y) {
      if (y + window.innerHeight < flGeo.top - 200 || y > flGeo.top + flGeo.h + 200) return;
      var r = stages.map(function (s) { return s.getBoundingClientRect(); });
      // how far each card has landed on the one before it (0..1)
      var land = [0];
      for (var j = 1; j < stages.length; j++) {
        var open = r[j - 1].height + 18, d = r[j].top - r[j - 1].top;
        land.push(Math.max(0, Math.min(1, (open - d) / (open - STEP))));
      }
      var cur = 0;
      for (var i = 0; i < stages.length; i++) if (r[i].top <= stuck[i] + 4) cur = i;
      for (i = 0; i < stages.length; i++) {
        var sink = 0;
        for (j = i + 1; j < stages.length; j++) sink += land[j];
        var tip = reduced ? 0 : Math.min(1, sink);
        var fuel = i === cur ? (i === stages.length - 1 ? 1 : land[i + 1]) : i < cur ? 1 : 0;
        var key = sink.toFixed(3) + "|" + tip.toFixed(3) + "|" + fuel.toFixed(3);
        if (last[i] !== key) {
          last[i] = key;
          stages[i].style.setProperty("--sink", sink.toFixed(3));
          stages[i].style.setProperty("--tip", tip.toFixed(3));
          stages[i].style.setProperty("--fuel", fuel.toFixed(3));
        }
      }
      if (cur !== live) {
        live = cur;
        stages.forEach(function (s, k) { s.classList.toggle("is-live", k === cur); s.classList.toggle("is-done", k < cur); });
        board(cur);
      }
    });
    request();
  })();

  /* ----------------------------------------------------------
     07 · Transmissions
     ---------------------------------------------------------- */
  var deck = q("[data-tx]");
  if (deck) {
    var cards = qa(".hm-tx-card", deck);
    var dots = qa(".hm-tx-dots i");
    var ti = 0, tTimer = null;
    var SIG = [["98", "HYUNDAI"], ["96", "CHAUMET"], ["99", "MODON"]];
    var show = function (i) {
      ti = (i + cards.length) % cards.length;
      cards.forEach(function (c, j) { c.classList.toggle("is-active", j === ti); });
      dots.forEach(function (d, j) { d.classList.toggle("is-active", j === ti); });
      var b = q("[data-decode]", cards[ti]);
      if (b) scramble(b, "SIGNAL " + SIG[ti % SIG.length][0] + "% · " + SIG[ti % SIG.length][1]);
    };
    // it turns by itself only while on screen and not being read (pointer
    // or keyboard focus on the deck); screen readers hear a message when
    // the visitor turns to it, not every seven seconds
    var txOn = false, txHold = false;
    var cycle = function () {
      clearInterval(tTimer);
      if (!reduced && txOn && !txHold) tTimer = setInterval(function () { deck.setAttribute("aria-live", "off"); show(ti + 1); }, 7000);
    };
    var prev = q("[data-tx-prev]"), next = q("[data-tx-next]");
    var turn = function (d) { deck.setAttribute("aria-live", "polite"); show(ti + d); cycle(); };
    if (prev) prev.addEventListener("click", function () { turn(-1); });
    if (next) next.addEventListener("click", function () { turn(1); });
    var txZone = deck.closest(".hm-tx") || deck;
    txZone.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") { txHold = true; cycle(); } });
    txZone.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") { txHold = false; cycle(); } });
    deck.addEventListener("focusin", function () { txHold = true; cycle(); });
    deck.addEventListener("focusout", function () { txHold = false; cycle(); });
    // a swipe across the card turns it on touch screens
    var sx = null, sy = 0;
    deck.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    deck.addEventListener("touchend", function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      sx = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) turn(dx < 0 ? 1 : -1);
    }, { passive: true });
    whileVisible(deck, function (on) { txOn = on; cycle(); });
  }

  /* ----------------------------------------------------------
     09 · Briefing: pick a question, its answer decrypts onto the
     screen. Wide screens always show one; narrow ones are an
     accordion (tap the open one again to close it).
     ---------------------------------------------------------- */
  var brf = q("[data-brf]");
  if (brf) (function () {
    var items = qa(".brf-item", brf);
    var status = q("[data-brf-status]", brf), prog = q("[data-brf-prog]", brf), count = q("[data-brf-count]", brf);
    var wideB = window.matchMedia("(min-width: 901px)");
    var two = function (n) { return (n < 10 ? "0" : "") + n; };
    var decT = null;
    var open = function (i, user) {
      var it = items[i], wasOpen = it.classList.contains("is-open");
      if (wasOpen && (wideB.matches || !user)) return;
      items.forEach(function (o, k) {
        var on = k === i && !wasOpen;
        o.classList.toggle("is-open", on);
        q(".brf-q", o).setAttribute("aria-expanded", on ? "true" : "false");
        var a = q(".brf-a", o);
        a.hidden = !on;
        a.classList.remove("is-in");
        if (on) { void a.offsetWidth; a.classList.add("is-in"); }
      });
      if (wasOpen) return;
      var h = q(".brf-a-ht", it);
      if (h && !reduced && wideB.matches) scramble(h, h.__t || (h.__t = h.textContent), 520);
      count.textContent = "BRIEFING " + two(i + 1) + " / " + two(items.length);
      status.textContent = "DECRYPTING";
      prog.classList.remove("is-run"); void prog.offsetWidth; prog.classList.add("is-run");
      clearTimeout(decT);
      decT = setTimeout(function () { status.textContent = "DECRYPTED"; }, reduced ? 0 : 640);
    };
    items.forEach(function (it, i) {
      var btn = q(".brf-q", it);
      btn.addEventListener("click", function () { open(i, true); });
      btn.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = (i + d + items.length) % items.length;
        q(".brf-q", items[n]).focus();
        if (wideB.matches) open(n, true);
      });
    });
    // back to a wide screen with everything closed: show the first
    wideB.addEventListener && wideB.addEventListener("change", function () {
      if (wideB.matches && !q(".brf-item.is-open", brf)) open(0);
    });
  })();

  /* ----------------------------------------------------------
     10 · Launch: the console under a launch in progress
     ---------------------------------------------------------- */
  var launch = q("[data-launch]");
  if (launch) (function () {
    whenSeen(launch);

    // hover / focus arms the ignition; the poll's last call goes GO
    var btn = q("[data-ignite]", launch), you = q("[data-poll-you]", launch);
    var arm = function (on) {
      launch.classList.toggle("is-armed", on);
      if (you) you.textContent = on ? "GO" : "AWAITING";
    };
    if (btn) {
      btn.addEventListener("pointerenter", function () { arm(true); });
      btn.addEventListener("pointerleave", function () { if (!btn.classList.contains("is-launch")) arm(false); });
      btn.addEventListener("focus", function () { arm(true); });
      btn.addEventListener("blur", function () { arm(false); });
      // a click lifts off, then Contact opens (a new-tab click just goes)
      btn.addEventListener("click", function (e) {
        if (reduced || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
        e.preventDefault();
        arm(true);
        btn.classList.add("is-launch");
        launch.classList.add("is-lift");
        setTimeout(function () { location.href = btn.href; }, 760);
      });
      // coming back from Contact with the browser's back button
      window.addEventListener("pageshow", function () {
        btn.classList.remove("is-launch"); launch.classList.remove("is-lift"); arm(false);
      });
    }

    // the next kickoff window: the next weekday at 10:00 in Dubai (GST,
    // UTC+4, Saturday and Sunday off), counted down to the second
    var tEl = q("[data-window-t]", launch), dEl = q("[data-window-d]", launch);
    if (tEl) {
      var GST = 4 * 3600e3, DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      var MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      var nextWindow = function (now) {
        var d = new Date(now + GST);
        var t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 10) - GST;
        while (t <= now || [0, 6].indexOf(new Date(t + GST).getUTCDay()) >= 0) t += 864e5;
        return t;
      };
      var p2 = function (n) { return (n < 10 ? "0" : "") + n; };
      var target = 0, winT = null;
      var paint = function () {
        var now = Date.now();
        if (now >= target) {
          target = nextWindow(now);
          var g = new Date(target + GST);
          dEl.textContent = DAYS[g.getUTCDay()] + " " + p2(g.getUTCDate()) + " " + MONTHS[g.getUTCMonth()] + " · 10:00 GST";
        }
        var left = Math.floor((target - now) / 1000);
        var dd = Math.floor(left / 86400), hh = Math.floor(left / 3600) % 24, mm = Math.floor(left / 60) % 60, ss = left % 60;
        tEl.textContent = (dd ? dd + "d " : "") + p2(hh) + ":" + p2(mm) + ":" + p2(ss);
      };
      paint();
      // it only ticks while you can see it
      var runWin = function (on) { clearInterval(winT); winT = on ? setInterval(paint, 1000) : null; if (on) paint(); };
      if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { runWin(en[0].isIntersecting); }).observe(tEl);
      else runWin(true);
    }
  })();

  /* ==========================================================
     THE INSTRUMENT LAYER
     ========================================================== */

  // Characters settle into place like a decoding signal.
  function scramble(el, text, dur) {
    if (reduced) { el.textContent = text; return; }
    var glyphs = "01<>/\\#%&*+=?ABCDEFXYZ";
    var t0 = performance.now();
    dur = dur || 900;
    clearTimeout(el.__scr);
    (function run() {
      var k = clamp01((performance.now() - t0) / dur);
      var out = "";
      for (var i = 0; i < text.length; i++) {
        var c = text.charAt(i);
        out += c === " " || i / text.length < k ? c : glyphs.charAt((Math.random() * glyphs.length) | 0);
      }
      el.textContent = out;
      if (k < 1) el.__scr = setTimeout(run, 40);
    })();
  }
  window.__hmScramble = scramble;

  // Headers: an instrument ruler and a coordinate stamp per stage.
  qa(".hm-kicker").forEach(function (k, ki) {
    var n = (ki + 1 < 10 ? "0" : "") + (ki + 1);
    var ruler = document.createElement("i");
    ruler.className = "hm-ruler";
    var coord = document.createElement("em");
    coord.className = "hm-coord";
    var lat = (25.2048 + (+n) * 0.0137).toFixed(4), lon = (55.2708 + (+n) * 0.0091).toFixed(4);
    var stamp = "WX-" + n + " · " + lat + "° N · " + lon + "° E";
    coord.textContent = stamp;
    coord.setAttribute("aria-hidden", "true");
    ruler.setAttribute("aria-hidden", "true");
    // the dot, the stage name and the ruler travel as one line
    var row = document.createElement("span");
    row.className = "hm-kicker-row";
    while (k.firstChild) row.appendChild(k.firstChild);
    row.appendChild(ruler);
    k.appendChild(row);
    k.appendChild(coord);
    whenSeen(k, function () { scramble(coord, stamp, 1100); });
  });

  qa(".hm-limb").forEach(function (l) { whenSeen(l); });

  // The mission rail: one node per stage, a live marker.
  var rail = q(".hm-rail");
  var stagesEls = qa("[data-stage]");
  if (rail && stagesEls.length) {
    var ol = q("ol", rail);
    var links = stagesEls.map(function (sec) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + sec.id;
      a.innerHTML = "<span>" + sec.dataset.stageName + "</span>" + sec.dataset.stage;
      a.setAttribute("aria-label", "Stage " + sec.dataset.stage + ": " + sec.dataset.stageName);
      li.appendChild(a);
      ol.appendChild(li);
      return a;
    });
    var railCur = -1;
    var comms = q(".hm-comms");
    var freqEl = q("[data-freq]");
    if (freqEl && !reduced) setInterval(function () { freqEl.textContent = (97 + Math.random() * 0.3).toFixed(2); }, 1000);
    var stGeo = stagesEls.map(geoOf), railOn = null;
    onFrame.push(function (y) {
      var on = hx ? y > stGeo[0].h * 0.45 : y > 200;
      if (on !== railOn) {
        railOn = on;
        rail.classList.toggle("is-on", on);
        if (comms) comms.classList.toggle("is-on", on);
      }
      var mark = y + window.innerHeight * 0.45, cur = 0;
      for (var i = 0; i < stGeo.length; i++) if (stGeo[i].top <= mark) cur = i;
      if (cur !== railCur) {
        railCur = cur;
        links.forEach(function (a, j) {
          a.classList.toggle("is-current", j === cur);
          a.classList.toggle("is-past", j < cur);
          if (j === cur) a.setAttribute("aria-current", "step"); else a.removeAttribute("aria-current");
        });
        rail.style.setProperty("--rail", (cur / (stagesEls.length - 1)).toFixed(3));
        if (dock) dock.stage(cur);
      }
      if (dock) dock.frame(y, on);
    });

    // The mission dock: the rail for touch and narrow screens (where the
    // rail hides). A pill bottom-left with the live stage and a progress
    // ring; tapping it opens a sheet with every stage, a line on what
    // each one holds, the comms channels and the launch CTA.
    var dock = (function () {
      var HINT = {
        "launch-pad": "The opening film",
        partners: "Brands we fly with",
        archive: "Case studies",
        modules: "13 services, one crew",
        why: "Four reasons",
        telemetry: "The numbers since 2019",
        flight: "Our seven stages",
        comms: "What clients say",
        notes: "Articles from the crew",
        briefing: "Questions, answered",
        liftoff: "Start your project"
      };
      var lastStage = stagesEls[stagesEls.length - 1].dataset.stage;
      var R = 15, C = 2 * Math.PI * R;

      var wrap = document.createElement("div");
      wrap.className = "hm-dock";
      wrap.innerHTML =
        '<button class="hm-dock-btn" type="button" aria-expanded="false" aria-controls="hm-sheet">' +
          '<span class="hm-dock-ring" aria-hidden="true"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="' + R + '"/><circle class="hm-dock-arc" cx="18" cy="18" r="' + R + '" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + C.toFixed(2) + '"/></svg><b data-dock-pct>0</b></span>' +
          '<span class="hm-dock-txt"><small>Stage <span data-dock-of></span></small><span data-dock-name></span></span>' +
          '<svg class="hm-dock-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>' +
        '</button>';

      var sheet = document.createElement("div");
      sheet.className = "hm-sheet";
      sheet.id = "hm-sheet";
      sheet.hidden = true;
      sheet.setAttribute("role", "dialog");
      sheet.setAttribute("aria-modal", "true");
      sheet.setAttribute("aria-labelledby", "hm-sheet-title");
      var items = stagesEls.map(function (sec, i) {
        return '<li style="--n:' + i + '"><a href="#' + sec.id + '"><b>' + sec.dataset.stage + '</b><span>' + sec.dataset.stageName +
          '<small>' + (HINT[sec.id] || "") + '</small></span></a></li>';
      }).join("");
      var socials = qa(".hm-comms-list a").map(function (a) {
        var c = a.cloneNode(true);
        var tip = q(".hm-comms-tip", c);
        if (tip) tip.parentNode.removeChild(tip);
        return c.outerHTML;
      }).join("");
      sheet.innerHTML =
        '<div class="hm-sheet-scrim" data-sheet-close></div>' +
        '<div class="hm-sheet-panel">' +
          '<span class="hm-sheet-grab" aria-hidden="true"></span>' +
          '<div class="hm-sheet-head">' +
            '<p class="hm-sheet-kicker"><i aria-hidden="true"></i>Mission stages</p>' +
            '<h2 id="hm-sheet-title">Jump to any part of the flight</h2>' +
            '<button class="hm-sheet-x" type="button" data-sheet-close aria-label="Close stages"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
          '</div>' +
          '<ol class="hm-sheet-list">' + items + '</ol>' +
          '<div class="hm-sheet-foot">' +
            '<ul class="hm-sheet-comms" aria-label="Worx on social media">' + socials.replace(/<a /g, "<li><a ").replace(/<\/a>/g, "</a></li>") + '</ul>' +
            '<a class="hm-sheet-cta" href="contact/index.html">Start a project<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>' +
          '</div>' +
        '</div>';

      document.body.appendChild(wrap);
      document.body.appendChild(sheet);

      var btn = q(".hm-dock-btn", wrap), arc = q(".hm-dock-arc", wrap);
      var pctEl = q("[data-dock-pct]", wrap), nameEl = q("[data-dock-name]", wrap), ofEl = q("[data-dock-of]", wrap);
      var panel = q(".hm-sheet-panel", sheet);
      var sLinks = qa(".hm-sheet-list a", sheet);
      var isOpen = false, lastOn = null, lastP = -1, closeT = null;

      // keep out of the footer's way (it carries the same links)
      var foot = q(".site-footer");
      whileVisible(foot, function (v) { wrap.classList.toggle("is-tucked", v); });

      function stage(i) {
        var sec = stagesEls[i];
        nameEl.textContent = sec.dataset.stageName;
        ofEl.textContent = sec.dataset.stage + " / " + lastStage;
        btn.setAttribute("aria-label", "Stage " + sec.dataset.stage + ", " + sec.dataset.stageName + ". Show all stages");
        sLinks.forEach(function (a, j) {
          a.classList.toggle("is-current", j === i);
          a.classList.toggle("is-past", j < i);
          if (j === i) a.setAttribute("aria-current", "step"); else a.removeAttribute("aria-current");
        });
        if (!reduced && lastOn) {
          wrap.classList.remove("is-tick");
          void wrap.offsetWidth;
          wrap.classList.add("is-tick");
        }
      }
      // reading on the way down: fold to the ring alone; scrolling back
      // up or pausing unfolds the name again
      var lastY = window.scrollY, shy = false, shyT = null;
      function setShy(v) { if (v !== shy) { shy = v; wrap.classList.toggle("is-shy", v); } }
      function frame(y, on) {
        if (on !== lastOn) { lastOn = on; wrap.classList.toggle("is-on", on); }
        var dY = y - lastY;
        lastY = y;
        if (!isOpen && Math.abs(dY) > 2) {
          setShy(dY > 0);
          clearTimeout(shyT);
          shyT = setTimeout(function () { setShy(false); }, 1100);
        }
        var max = document.documentElement.scrollHeight - window.innerHeight;
        var p = max > 0 ? clamp01(y / max) : 0;
        if (Math.abs(p - lastP) > 0.002) {
          lastP = p;
          arc.style.strokeDashoffset = (C * (1 - p)).toFixed(2);
          pctEl.textContent = Math.round(p * 100);
        }
      }

      function open() {
        if (isOpen) return;
        isOpen = true;
        clearTimeout(closeT);
        sheet.hidden = false;
        document.documentElement.classList.add("hm-sheet-lock");
        btn.setAttribute("aria-expanded", "true");
        requestAnimationFrame(function () { requestAnimationFrame(function () { sheet.classList.add("is-open"); }); });
        var cur = q(".is-current", sheet) || sLinks[0];
        setTimeout(function () { (cur || q(".hm-sheet-x", sheet)).focus({ preventScroll: true }); }, reduced ? 0 : 60);
      }
      function close(then) {
        if (!isOpen) return;
        isOpen = false;
        sheet.classList.remove("is-open");
        panel.style.transform = "";
        document.documentElement.classList.remove("hm-sheet-lock");
        btn.setAttribute("aria-expanded", "false");
        closeT = setTimeout(function () { sheet.hidden = true; }, reduced ? 0 : 420);
        if (typeof then === "function") then(); else btn.focus({ preventScroll: true });
      }

      btn.addEventListener("click", function () { if (isOpen) close(); else open(); });
      sheet.addEventListener("click", function (e) {
        if (e.target.closest("[data-sheet-close]")) { close(); return; }
        var a = e.target.closest(".hm-sheet-list a");
        if (!a) return;
        e.preventDefault();
        var target = q(a.getAttribute("href"));
        // unlock the page first, then fly there
        close(function () {
          if (!target) return;
          btn.focus({ preventScroll: true });
          // one frame for the page to take its scrollbar back
          requestAnimationFrame(function () {
            var top = target === stagesEls[0] ? 0 : target.getBoundingClientRect().top + window.scrollY - 56;
            window.scrollTo({ top: top, behavior: reduced ? "auto" : "smooth" });
            if (history.replaceState) history.replaceState(null, "", a.getAttribute("href"));
          });
        });
      });
      document.addEventListener("keydown", function (e) {
        if (!isOpen) return;
        if (e.key === "Escape") { e.preventDefault(); close(); return; }
        if (e.key !== "Tab") return;
        // keep focus inside the sheet while it is open
        var f = qa("a[href], button", panel);
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });

      // a swipe down on the sheet puts it away
      var sy = null, dy = 0;
      panel.addEventListener("touchstart", function (e) {
        if (panel.scrollTop > 0) { sy = null; return; }
        sy = e.touches[0].clientY; dy = 0;
        panel.classList.add("is-drag");
      }, { passive: true });
      panel.addEventListener("touchmove", function (e) {
        if (sy === null) return;
        dy = Math.max(0, e.touches[0].clientY - sy);
        // tablets float the card from the centre: keep its x offset
        panel.style.transform = (window.innerWidth >= 640 ? "translate(-50%, " : "translate(0, ") + dy + "px)";
      }, { passive: true });
      panel.addEventListener("touchend", function () {
        if (sy === null) return;
        sy = null;
        panel.classList.remove("is-drag");
        if (dy > 90) close(); else panel.style.transform = "";
      });

      // if the layout grows back past the rail's breakpoint, put it away
      var wide = window.matchMedia("(min-width: 1101px) and (hover: hover)");
      var onWide = function () { if (wide.matches) close(); };
      if (wide.addEventListener) wide.addEventListener("change", onWide); else wide.addListener(onWide);

      return { stage: stage, frame: frame };
    })();
    dock.stage(0);
  }

  // Viewfinder frames + live timecode on the films and the worlds.
  function tc(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s2 = Math.floor(sec) % 60, f = Math.floor((sec % 1) * 24);
    var p2 = function (n) { return (n < 10 ? "0" : "") + n; };
    return p2(h) + ":" + p2(m) + ":" + p2(s2) + ":" + p2(f);
  }
  qa(".hm-case-media, .hm-mod-visual").forEach(function (m) {
    var vf = document.createElement("span");
    vf.className = "hm-vf";
    vf.setAttribute("aria-hidden", "true");
    m.appendChild(vf);
    var v = q("video", m);
    if (!v) return;
    var rec = document.createElement("span");
    rec.className = "hm-vf-rec";
    rec.setAttribute("aria-hidden", "true");
    rec.innerHTML = "REC <b>00:00:00:00</b>";
    m.appendChild(rec);
    var tcEl = q("b", rec);
    v.addEventListener("playing", function () { m.classList.add("is-live"); });
    v.addEventListener("pause", function () { m.classList.remove("is-live"); });
    v.addEventListener("timeupdate", function () { tcEl.textContent = tc(v.currentTime); });
  });

  // Martian dust: slow embers on a thin wind, quickening with scroll.
  // (its own scope: the hero's film dust above uses the same names)
  (function () {
    var dust = q(".hm-dust");
    if (dust && !reduced) {
      var dctx = dust.getContext("2d");
      var motes = [], dw = 0, dh = 0;
      var seedDust = function () {
        var w = window.innerWidth, h = window.innerHeight;
        // a phone's toolbar changing the height just stretches the sky; a
        // new width sows it again
        var resow = w !== dw || !motes.length;
        dw = dust.width = w;
        dh = dust.height = h;
        if (!resow) return;
        var n = Math.min(150, Math.round(dw * dh / 11000));
        motes = [];
        for (var i = 0; i < n; i++) motes.push({ x: Math.random() * dw, y: Math.random() * dh, z: 0.25 + Math.random() * 0.75, p: Math.random() * 6.28 });
      };
      seedDust();
      window.addEventListener("resize", seedDust);
      var dLast = 0;
      (function drift(now) {
        var dt = dLast ? Math.min(0.05, (now - dLast) / 1000) : 0.016;
        dLast = now;
        if (!document.hidden) {
          dctx.clearRect(0, 0, dw, dh);
          var wind = 14 + Math.min(220, Math.abs(scrollV) * 5);
          for (var i = 0; i < motes.length; i++) {
            var m = motes[i];
            m.x -= wind * m.z * dt;
            m.y -= (scrollV * 0.35 + 3) * m.z * dt * 2 + Math.sin(now * 0.0006 + m.p) * 0.12;
            if (m.x < -4) { m.x = dw + 4; m.y = Math.random() * dh; }
            if (m.y < -4) m.y = dh + 4; else if (m.y > dh + 4) m.y = -4;
            var a = (0.16 + 0.34 * m.z) * (0.6 + 0.4 * Math.sin(now * 0.002 + m.p));
            dctx.fillStyle = m.z > 0.8 ? "rgba(250,167,25," + a.toFixed(3) + ")" : "rgba(229,125,35," + (a * 0.8).toFixed(3) + ")";
            var r = 0.5 + m.z * 1.3;
            dctx.fillRect(m.x, m.y, r, r);
          }
        }
        requestAnimationFrame(drift);
      })(0);
    }
  })();

  // (the targeting reticle is reticle.js, shared with every page)

  // The hover ring (home.css ONE HOVER LANGUAGE) on the project films,
  // whose own pseudo-elements are already the grade and the scan.
  qa(".hm-case-media").forEach(function (m) {
    var ring = document.createElement("span");
    ring.className = "hm-ring";
    ring.setAttribute("aria-hidden", "true");
    m.appendChild(ring);
  });

  // Entrance choreography: each stage's body rises in after its headline,
  // siblings a beat apart. Only with motion welcome, and only once.
  if (!reduced && "IntersectionObserver" in window) (function () {
    var GROUPS = [
      [".hm-marquee"], [".hm-regions li", 0.05],
      [".hm-head-aside"],
      [".hm-track-wrap"], [".hm-track-foot"],
      [".hm-mod-list li", 0.06], [".hm-mod-stage"],
      [".hm-tl-head > p:last-child"], [".hm-odo"], [".hm-dial", 0.1],
      [".hm-flight-lead > p:not(.hm-kicker)"], [".hm-fclock"],
      [".hm-tx-nav"], [".hm-tx-deck"], [".hm-tx-dots"],
      [".hm-note", 0.12],
      [".hm-faq-lead > p:last-child"], [".brf"],
      [".hm-launch-copy > p:not(.hm-kicker)"], [".hm-console > *", 0.12],
    ];
    var rise = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-risen");
        rise.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    GROUPS.forEach(function (g) {
      qa(g[0]).forEach(function (el, i) {
        el.classList.add("hm-rise");
        // a small lead after the headline, then the stagger
        el.style.setProperty("--rd", (0.12 + (g[1] || 0) * i).toFixed(2) + "s");
        rise.observe(el);
      });
    });
  })();

  // SVG flights (the craft on its trajectory, the runner on the loop
  // constellation) pause their SMIL clocks while off screen
  qa(".hm-launch-arc, .hm-star-fig").forEach(function (svg) {
    if (!svg.pauseAnimations || !q("animateMotion", svg)) return;
    if (reduced) { svg.pauseAnimations(); return; }
    whileVisible(svg, function (on) { if (on) svg.unpauseAnimations(); else svg.pauseAnimations(); }, "80px");
  });

  request();
})();
