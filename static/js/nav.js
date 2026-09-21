/* ============================================================
   Worx by Glimpse — nav.js
   Header scroll state, mobile menu toggle, active link marking.
   ============================================================ */

(function () {
  "use strict";

  // Mark the document as JS-enabled so animations.css can hide
  // reveal elements without breaking the no-JS experience.
  document.documentElement.classList.add("js");

  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelectorAll(".nav-links a");

  // --- Solid header once the page is scrolled -----------------
  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // --- Mobile menu --------------------------------------------
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = header.classList.toggle("menu-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });

    // Close the menu when a link is chosen
    links.forEach(function (link) {
      link.addEventListener("click", function () {
        header.classList.remove("menu-open");
        document.body.style.overflow = "";
      });
    });
  }

  // --- Highlight the link matching the current section ---------
  // Each page sets <body data-page="..."> and nav links carry
  // matching data-nav values.
  var page = document.body.dataset.page;
  if (page) {
    links.forEach(function (link) {
      if (link.dataset.nav === page) link.classList.add("is-active");
    });
  }
})();
