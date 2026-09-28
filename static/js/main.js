/* ============================================================
   Worx | main.js
   Page behaviours that aren't navigation or animation:
   FAQ accordion, footer year, footer clock + wordmark.
   (The /contact page has its own planner, static/js/contact.js.)
   ============================================================ */

(function () {
  "use strict";

  // --- FAQ accordion -------------------------------------------
  document.querySelectorAll(".faq-item").forEach(function (item) {
    var question = item.querySelector(".faq-question");
    var answer = item.querySelector(".faq-answer");
    if (!question || !answer) return;

    question.addEventListener("click", function () {
      var isOpen = item.classList.contains("is-open");

      // Close any other open item first
      document.querySelectorAll(".faq-item.is-open").forEach(function (open) {
        open.classList.remove("is-open");
        open.querySelector(".faq-answer").style.maxHeight = null;
        open.querySelector(".faq-question")
          .setAttribute("aria-expanded", "false");
      });

      if (!isOpen) {
        item.classList.add("is-open");
        answer.style.maxHeight = answer.scrollHeight + "px";
        question.setAttribute("aria-expanded", "true");
      }
    });
  });

  // --- Footer year -----------------------------------------------
  var year = document.querySelector("#footer-year");
  if (year) year.textContent = new Date().getFullYear();

  // --- Footer clock: the studio's local time in Dubai --------------
  var clock = document.querySelector(".footer-clock");
  if (clock) {
    var fmt = null;
    try {
      fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: clock.dataset.tz || "Asia/Dubai" });
    } catch (e) { /* very old browser: leave the placeholder */ }
    var tick = function () { if (fmt) clock.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 15000);
  }

  // --- Footer wordmark: a type-design wireframe on every letter --------
  // The R shows faint construction lines of its own (its overlapping
  // shapes, just traced through the knock-out, layout.css). Every letter
  // gets the same draughtsman's frame, placed from the glyphs themselves:
  // its box from baseline to cap height, the centre lines, a cross to the
  // corners and ticks at the corners. Re-drawn once the font has loaded.
  var markSvg = document.querySelector(".footer-mark-svg");
  var markBase = markSvg && markSvg.querySelector(".footer-mark-base");
  if (markBase && markBase.getExtentOfChar) {
    var NS = "http://www.w3.org/2000/svg";
    var wire = document.createElementNS(NS, "g");
    wire.setAttribute("class", "footer-mark-wire");
    markSvg.appendChild(wire);
    var line = function (x1, y1, x2, y2, cls) {
      return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"' + (cls ? ' class="' + cls + '"' : "") + "/>";
    };
    var drawWire = function () {
      var n = (markBase.textContent || "").length, out = "";
      var size = parseFloat(getComputedStyle(markBase).fontSize) || 330;
      var baseY = parseFloat(markBase.getAttribute("y")) || 262;
      var top = baseY - size * 0.7;   // Jost's cap height, ~0.7em
      for (var i = 0; i < n; i++) {
        var e;
        try { e = markBase.getExtentOfChar(i); } catch (err) { return; }
        var inset = e.width * 0.06;
        var x0 = e.x + inset, x1 = e.x + e.width - inset, w = x1 - x0, h = baseY - top;
        var cx = x0 + w / 2, my = top + h / 2, t = Math.min(w, h) * 0.08;
        out += '<rect x="' + x0.toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '"/>';
        out += line(x0, my, x1, my) + line(cx, top, cx, baseY);
        out += line(x0, top, x1, baseY, "d") + line(x1, top, x0, baseY, "d");
        // corner ticks, just outside the box
        out += line(x0 - t, top, x0, top, "k") + line(x0, top - t, x0, top, "k") + line(x1, top, x1 + t, top, "k") + line(x1, top - t, x1, top, "k");
      }
      wire.innerHTML = out;
    };
    drawWire();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawWire);
  }

  // --- Footer wordmark: the outline letters fill in under the pointer --
  var mark = document.querySelector(".footer-mark");
  if (mark && window.matchMedia("(hover: hover)").matches) {
    var raf = 0, px = 0, py = 0;
    mark.addEventListener("pointermove", function (e) {
      var r = mark.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width) * 100;
      py = ((e.clientY - r.top) / r.height) * 100;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        mark.style.setProperty("--mx", px.toFixed(1) + "%");
        mark.style.setProperty("--my", py.toFixed(1) + "%");
      });
    });
    mark.addEventListener("pointerenter", function () { mark.classList.add("is-lit"); });
    mark.addEventListener("pointerleave", function () { mark.classList.remove("is-lit"); });
  }
})();
