/* ============================================================
   Worx | main.js
   Page behaviours that aren't navigation or animation:
   FAQ accordion, footer year, footer wordmark, Back to top.
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

  // --- Back to top ----------------------------------------------
  // The link's #main jump works with no JS. With it: glide to the very
  // top (through Lenis where a page runs it, or Lenis snaps the page
  // back), keep #main out of the address bar, and hand focus to the
  // page so the next Tab starts from the top.
  document.querySelectorAll(".footer-top").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      var instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (window.wxLenis) window.wxLenis.scrollTo(0, { immediate: instant, force: true });
      else if (!instant && "scrollBehavior" in document.documentElement.style) window.scrollTo({ top: 0, behavior: "smooth" });
      else window.scrollTo(0, 0);
      var main = document.getElementById("main");
      if (main) {
        if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
        try { main.focus({ preventScroll: true }); } catch (err) {}
      }
    });
  });
})();
