/* ============================================================
   Worx | portfolio-hero.js
   The hero's words, directed like the other pages' HUDs:
     - readouts type themselves in, like the About log booting
       ([data-type-in="<s>"], seconds after the open starts)
     - the subline resolves word by word ([data-words-in="<s>"])
     - the summit log follows the rover's own story, the About
       mission log recipe: done lines dim, the live one lit, with
       speed, EVA time and flags planted
     - the camera tracks it: a bracket locked on the rover, and
       during the EVA the feed cuts to the astronaut (a tear across
       the picture, the bracket snaps to him, the camera eases in,
       rings of transmission off his helmet, TX · LIVE TO EARTH)
   The story comes from rover-scene.js (window.worxRoverFeed).
   The open waits for html.pf-wait to clear (the inline script
   after the hero), like the CSS sequence does.
   Reduced motion: text is shown whole, the log still reads out.
   ============================================================ */

(function () {
  "use strict";

  var hero = document.querySelector(".folio-hero");
  if (!hero) return;
  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var qa = function (sel, r) { return Array.prototype.slice.call((r || document).querySelectorAll(sel)); };

  function whenOpen(fn) {
    if (!root.classList.contains("pf-wait")) return fn();
    var mo = new MutationObserver(function () {
      if (!root.classList.contains("pf-wait")) { mo.disconnect(); fn(); }
    });
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
  }

  /* ---- typing: every text node in turn, live readouts held back --- */

  function typeIn(el) {
    var nodes = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        return n.parentNode.closest("[data-live]") || !n.nodeValue.trim() ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) nodes.push({ n: walker.currentNode, v: walker.currentNode.nodeValue });
    if (!nodes.length) return;
    el.classList.add("is-typing");
    nodes.forEach(function (o) { o.n.nodeValue = ""; });
    var delay = parseFloat(el.getAttribute("data-type-in")) * 1000 || 0;
    var i = 0, k = 0;
    setTimeout(function step() {
      var o = nodes[i];
      k += 2;                                   // two characters a tick: a terminal, not a typist
      o.n.nodeValue = o.v.slice(0, k);
      if (k >= o.v.length) { i++; k = 0; }
      if (i < nodes.length) setTimeout(step, 22);
      else el.classList.remove("is-typing");
    }, delay);
  }

  function wordsIn(el) {
    var delay = parseFloat(el.getAttribute("data-words-in")) || 0;
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    words.forEach(function (w, i) {
      var s = document.createElement("span");
      s.className = "pf-word";
      s.textContent = w;
      s.style.animationDelay = (delay + i * 0.035).toFixed(3) + "s";
      el.appendChild(s);
      el.appendChild(document.createTextNode(" "));
    });
  }

  if (!reduced) {
    // blank them now, so nothing flashes before the open
    var typed = qa("[data-type-in]", hero);
    typed.forEach(function (el) { el.classList.add("is-held"); });
    qa("[data-words-in]", hero).forEach(wordsIn);
    whenOpen(function () {
      typed.forEach(function (el) { typeIn(el); el.classList.remove("is-held"); });
    });
  }

  /* ---- the summit log + tracking ----------------------------------- */

  var log = hero.querySelector(".pf-stages");
  var items = log ? qa("[data-ph]", log) : [];
  var spd = hero.querySelector("[data-log-spd]");
  var eva = hero.querySelector("[data-log-eva]");
  var flags = hero.querySelector("[data-log-flags]");
  var track = hero.querySelector(".pf-track");
  var tx = hero.querySelector(".pf-tx");
  var feed = hero.querySelector(".pf-feed");
  var camera = hero.querySelector(".folio-camera");
  var feedName = hero.querySelector("[data-feed-name]");
  var feedTc = hero.querySelector("[data-feed-tc]");
  var evaOn = null, switchT = 0, snapT = 0, hk = 1;

  // the camera cuts between the wide shot and the EVA feed: a tear
  // across the picture, and the bracket snaps to its new mark
  function cut(on) {
    hero.classList.toggle("is-eva", on);
    if (feedName) feedName.textContent = on ? "EVA FEED" : "SURFACE";
    if (reduced) return;
    if (feed) {
      feed.classList.remove("is-switch");
      void feed.offsetWidth;
      feed.classList.add("is-switch");
      clearTimeout(switchT);
      switchT = setTimeout(function () { feed.classList.remove("is-switch"); }, 520);
    }
    if (track) {
      track.classList.add("is-snap");
      clearTimeout(snapT);
      snapT = setTimeout(function () { track.classList.remove("is-snap"); }, 560);
    }
  }

  var STEP = {
    driveIn: "in", settle: "hold",
    getOut: "eva", walkOut: "eva",
    kneelDown: "flag", plant: "flag", standUp: "flag", beat: "flag",
    walkBack: "back", getIn: "back",
    ignition: "go", driveOut: "go", empty: "clear"
  };
  var ORDER = ["in", "hold", "eva", "flag", "back", "go", "clear"];

  var lastStep = null, lastStamp = -1, raf = 0, onScreen = true;
  var p2 = function (n) { return (n < 10 ? "0" : "") + n; };

  function frame() {
    raf = 0;
    var F = window.worxRoverFeed;
    if (F && F.phase && F.stamp !== lastStamp) {
      lastStamp = F.stamp;
      var step = STEP[F.phase] || "clear";

      // the log: lines before the live one are done, the live one lit
      if (step !== lastStep) {
        lastStep = step;
        var at = ORDER.indexOf(step);
        items.forEach(function (li) {
          var i = ORDER.indexOf(li.getAttribute("data-ph"));
          li.classList.toggle("is-done", i < at);
          li.classList.toggle("is-now", i === at);
        });
      }
      if (spd) spd.textContent = (Math.max(0, F.vel) * 3.6).toFixed(1);
      if (eva) {
        var e = Math.max(0, Math.min(F.t, F.evaEnd) - F.evaStart);
        if (F.t < F.evaStart) e = 0;
        eva.textContent = p2(Math.floor(e / 60)) + ":" + p2(Math.floor(e % 60));
      }
      if (flags) flags.textContent = String(F.loop + (F.t >= F.plantAt ? 1 : 0));

      // the EVA: while he's out, the feed is his
      var out = F.ax != null;
      if (out !== evaOn) {
        if (out && camera) {
          // zoom toward the middle of his walk, set once as he steps out
          var mx = (F.exitX + F.kneelX) / 2;
          camera.style.transformOrigin = (mx / F.w * 100).toFixed(2) + "% " + ((F.ay - F.ah * 0.5) / F.h * 100).toFixed(2) + "%";
        }
        if (evaOn !== null || out) cut(out);
        evaOn = out;
      }

      // his height in shot: lower while he kneels to plant the flag
      var low = F.phase === "kneelDown" || F.phase === "plant" || F.phase === "standUp";
      hk += ((low ? 0.7 : 1) - hk) * 0.08;

      // the bracket: on the astronaut during the EVA, else on the rover
      if (track) {
        var cx, cy, bw, bh;
        if (out) {
          bw = F.ah * 0.72; bh = F.ah * 1.12 * hk;
          cx = F.ax; cy = F.ay - bh * 0.98;
        } else if (F.x != null) {
          bw = 1180 * F.s; bh = 760 * F.s;
          cx = F.x; cy = F.y - bh * 0.92;
        }
        var on = cx != null && cx > -40 && cx < F.w + 40;
        track.classList.toggle("is-on", on);
        if (on) {
          track.style.setProperty("--w", bw.toFixed(1) + "px");
          track.style.setProperty("--h", bh.toFixed(1) + "px");
          track.style.transform = "translate3d(" + (cx - bw / 2).toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
        }
      }

      // his signal: rings off the helmet
      if (tx) {
        tx.classList.toggle("is-on", out);
        if (out) tx.style.transform = "translate3d(" + F.ax.toFixed(1) + "px," + (F.ay - F.ah * 0.9 * hk).toFixed(1) + "px,0)";
      }

      // the feed's timecode, off the scene clock
      if (feedTc) {
        var sc = F.stamp, fr = Math.floor((sc % 1) * 24);
        feedTc.textContent = p2(Math.floor(sc / 3600)) + ":" + p2(Math.floor(sc / 60) % 60) + ":" + p2(Math.floor(sc) % 60) + ":" + p2(fr);
      }
    }
    schedule();
  }

  function schedule() {
    if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
  }

  if (log || track || tx) {
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; schedule(); }).observe(hero);
    }
    document.addEventListener("visibilitychange", schedule);
    whenOpen(function () { setTimeout(schedule, reduced ? 0 : 3200); });
  }
})();
