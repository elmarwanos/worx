/* ============================================================
   Worx | animations.js
   GSAP-powered motion: hero word stagger, scroll reveals,
   stat counters and the client logo marquee.
   Requires gsap + ScrollTrigger (loaded from CDN in each page).
   ============================================================ */

(function () {
  "use strict";

  if (typeof gsap === "undefined") return; // CDN failed: CSS fallbacks apply

  gsap.registerPlugin(ScrollTrigger);

  var reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (reducedMotion) return;

  // --- Hero headline: split into words and stagger in ----------
  var heroTitle = document.querySelector(".hero h1");
  if (heroTitle) {
    var words = heroTitle.textContent.trim().split(/\s+/);
    heroTitle.innerHTML = words
      .map(function (w) {
        return '<span class="word">' + w + "</span>";
      })
      .join(" ");

    gsap.to(".hero h1 .word", {
      opacity: 1,
      y: 0,
      rotate: 0,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.08,
      delay: 0.15,
    });
  }

  // --- Generic scroll reveals ----------------------------------
  // Any element with [data-reveal] fades/slides in on entry.
  // Siblings inside the same parent stagger automatically.
  var revealGroups = new Map();
  document.querySelectorAll("[data-reveal]").forEach(function (el) {
    var parent = el.parentElement;
    if (!revealGroups.has(parent)) revealGroups.set(parent, []);
    revealGroups.get(parent).push(el);
  });

  revealGroups.forEach(function (els) {
    gsap.to(els, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: "power2.out",
      stagger: 0.12,
      scrollTrigger: {
        trigger: els[0],
        start: "top 86%",
      },
    });
  });

  // --- Stat counters -------------------------------------------
  // <strong data-count="300" data-suffix="+">0</strong>
  document.querySelectorAll("[data-count]").forEach(function (el) {
    var target = parseInt(el.dataset.count, 10);
    var suffix = el.dataset.suffix || "";
    var proxy = { value: 0 };

    gsap.to(proxy, {
      value: target,
      duration: 1.8,
      ease: "power1.out",
      scrollTrigger: {
        trigger: el,
        start: "top 88%",
      },
      onUpdate: function () {
        el.textContent = Math.round(proxy.value) + suffix;
      },
    });
  });

  // --- Client logo marquee --------------------------------------
  // The track content is duplicated once in the HTML; animating
  // to -50% then wrapping produces a seamless loop.
  var track = document.querySelector(".marquee-track");
  if (track) {
    gsap.to(track, {
      xPercent: -50,
      duration: 28,
      ease: "none",
      repeat: -1,
    });
  }

  // --- Subtle parallax on hero blobs -----------------------------
  gsap.utils.toArray(".hero-blob").forEach(function (blob, i) {
    gsap.to(blob, {
      yPercent: i % 2 === 0 ? 25 : -20,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });
  });
})();
