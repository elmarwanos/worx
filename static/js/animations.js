/* ============================================================
   Worx | animations.js
   GSAP-powered motion: hero word stagger, interior page-hero
   entrance, batched scroll reveals,
   stat counters and the client logo marquee.
   Requires gsap + ScrollTrigger (loaded from CDN in each page).
   ============================================================ */

(function () {
  "use strict";

  var root = document.documentElement;

  // CDN failed: flag it so animations.css shows everything that
  // would otherwise wait for GSAP to reveal it.
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    root.classList.add("no-gsap");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  var reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (reducedMotion) return;

  var EASE = "power3.out";

  // --- Interior page hero (.page-hero): a calm opening shot ------
  // Eyebrow, headline, then the intro line rise out of a soft blur
  // in sequence on load. Their initial state lives in animations.css
  // (.wx-motion .page-hero > *) so nothing flashes before this runs.
  root.classList.add("wx-motion");
  var pageHero = document.querySelector(".page-hero");
  if (pageHero) {
    var heroBits = Array.prototype.slice.call(pageHero.children);
    gsap.fromTo(
      heroBits,
      { opacity: 0, y: 28, filter: "blur(6px)" },
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 1.05,
        ease: EASE,
        stagger: 0.14,
        delay: 0.1,
        clearProps: "filter",
      }
    );
  }

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
  // Elements are batched as they cross the line, so siblings that
  // enter together stagger, while cards further down a stacked
  // (phone) grid wait for their own moment instead of playing
  // off-screen with the first one. The page hero is handled above.
  var reveals = gsap.utils.toArray("[data-reveal]").filter(function (el) {
    return !(pageHero && pageHero.contains(el));
  });

  if (reveals.length) {
    ScrollTrigger.batch(reveals, {
      start: "top 88%",
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: EASE,
          stagger: 0.1,
          overwrite: true,
        });
      },
    });

    // Anything sitting below the last reachable trigger line (e.g. a
    // short page on a very tall screen) still shows once the visitor
    // reaches the bottom.
    ScrollTrigger.create({
      trigger: document.body,
      start: "bottom bottom+=2",
      once: true,
      onEnter: function () {
        var late = reveals.filter(function (el) {
          return parseFloat(getComputedStyle(el).opacity) < 0.01 &&
            !gsap.isTweening(el);
        });
        if (late.length) {
          gsap.to(late, { opacity: 1, y: 0, duration: 0.9, ease: EASE, stagger: 0.08 });
        }
      },
    });
  }

  // Re-measure once fonts and images have settled so trigger lines
  // match the final layout.
  window.addEventListener("load", function () {
    ScrollTrigger.refresh();
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
