/* ============================================================
   Worx | ignite.js
   Builds the ignition's ring (ticks, charge track, pressure wave) for
   every .ig-btn on the page, and runs the liftoff: a click kicks the
   core and sends the wave out, then the page goes where the button
   points (its href as it is at that moment, so a page that updates
   the link, like the services mission builder, is honoured). A new-tab
   or modified click just goes. Styles in ignite.css.
   ============================================================ */
(function () {
  "use strict";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NS = "http://www.w3.org/2000/svg", n = 0;

  function ring() {
    var id = "ig-g-" + (++n);
    var ticks = "";
    for (var a = 0; a < 360; a += 5) {
      var maj = a % 30 === 0;
      ticks += '<line x1="100" y1="' + (maj ? 4 : 7) + '" x2="100" y2="12" transform="rotate(' + a + ' 100 100)"' + (maj ? ' class="maj"' : "") + "/>";
    }
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "ig-ring");
    svg.setAttribute("viewBox", "0 0 200 200");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c04527"/><stop offset=".55" stop-color="#e57d23"/><stop offset="1" stop-color="#faa719"/></linearGradient></defs>' +
      '<g class="ig-ticks">' + ticks + '</g><circle class="ig-track" cx="100" cy="100" r="86"/><circle class="ig-charge" cx="100" cy="100" r="86" pathLength="1" stroke="url(#' + id + ')"/>';
    return svg;
  }

  function build(btn) {
    if (btn.__ig) return;
    btn.__ig = true;
    btn.insertBefore(ring(), btn.firstChild);
    var wave = document.createElement("span");
    wave.className = "ig-wave";
    wave.setAttribute("aria-hidden", "true");
    btn.appendChild(wave);
    btn.addEventListener("click", function (e) {
      if (reduced || e.metaKey || e.ctrlKey || e.shiftKey || e.button || btn.target === "_blank") return;
      e.preventDefault();
      btn.classList.add("is-launch");
      var to = btn.href;
      setTimeout(function () { location.href = to; }, 760);
    });
  }

  function all() { [].forEach.call(document.querySelectorAll(".ig-btn"), build); }
  all();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", all);
  // coming back with the browser's back button: ready again
  window.addEventListener("pageshow", function () {
    [].forEach.call(document.querySelectorAll(".ig-btn.is-launch"), function (b) { b.classList.remove("is-launch"); });
  });
})();
