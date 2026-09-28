/* ============================================================
   Worx | living-covers.js
   Brings the blog's cover art to life wherever it appears (styles in
   living-covers.css): adds the ember and light layers to each cover,
   runs a cover's motion only while it is on screen, and shifts it with
   depth under the pointer.
   ============================================================ */
(function () {
  "use strict";
  var SEL = ".blog-card-media, .blog-featured-media, .blog-feature-art--image, .hm-note-img";
  var covers = [].slice.call(document.querySelectorAll(SEL));
  if (!covers.length) return;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var io = "IntersectionObserver" in window && !reduced ? new IntersectionObserver(function (en) {
    en.forEach(function (e) { e.target.classList.toggle("lc-on", e.isIntersecting); });
  }, { rootMargin: "60px" }) : null;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  covers.forEach(function (c, i) {
    c.classList.add("lc");
    c.style.setProperty("--lc-i", i);
    var glow = document.createElement("span");
    glow.className = "lc-glow";
    glow.setAttribute("aria-hidden", "true");
    var fx = document.createElement("span");
    fx.className = "lc-fx";
    fx.setAttribute("aria-hidden", "true");
    // above the picture, under any frame layers that come after it
    var pic = c.querySelector("picture") || c.querySelector("img");
    if (pic && pic.nextSibling) { c.insertBefore(glow, pic.nextSibling); c.insertBefore(fx, glow.nextSibling); }
    else { c.appendChild(glow); c.appendChild(fx); }
    if (io) io.observe(c);
    if (fine && !reduced) {
      c.addEventListener("pointermove", function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 2 - 1).toFixed(3));
        c.style.setProperty("--my", ((e.clientY - r.top) / r.height * 2 - 1).toFixed(3));
      }, { passive: true });
      c.addEventListener("pointerleave", function () { c.style.setProperty("--mx", 0); c.style.setProperty("--my", 0); });
    }
  });
})();
