/* ============================================================
   Worx | nav.js
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

  // --- Services mega menu --------------------------------------
  // Markup comes from tools/services/build.js. Desktop opens on hover
  // (with a short close delay so the pointer can travel) or focus;
  // mobile opens with the chevron button beside "Services".
  var mega = document.querySelector(".nav-item--mega");
  if (mega) {
    var trigger = mega.querySelector(".nav-mega-trigger");
    var subToggle = mega.querySelector(".nav-sub-toggle");
    var side = mega.querySelector(".mega-side");
    var defaultView = mega.querySelector(".mega-default");
    var preview = mega.querySelector(".mega-preview");
    var closeTimer = null;
    var desktop = window.matchMedia("(min-width: 861px)");

    var setOpen = function (open) {
      clearTimeout(closeTimer);
      mega.classList.toggle("is-open", open);
      header.classList.toggle("mega-open", open && desktop.matches);
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      if (subToggle) subToggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (!open) showDefault();
    };

    var showDefault = function () {
      if (!preview) return;
      preview.hidden = true;
      defaultView.hidden = false;
      var cur = mega.querySelector(".is-previewing");
      if (cur) cur.classList.remove("is-previewing");
    };

    var showPreview = function (item) {
      if (!preview) return;
      var cur = mega.querySelector(".is-previewing");
      if (cur === item) return;
      if (cur) cur.classList.remove("is-previewing");
      item.classList.add("is-previewing");
      preview.querySelector(".mega-preview-div").textContent = item.dataset.division;
      preview.querySelector(".mega-preview-name").textContent = item.querySelector("span").textContent;
      preview.querySelector(".mega-preview-short").textContent = item.dataset.short;
      var subs = preview.querySelector(".mega-preview-subs");
      subs.innerHTML = "";
      item.dataset.subs.split("|").forEach(function (s) {
        var li = document.createElement("li");
        li.textContent = s;
        subs.appendChild(li);
      });
      if (+item.dataset.more > 0) {
        var more = document.createElement("li");
        more.className = "is-more";
        more.textContent = "+" + item.dataset.more + " more";
        subs.appendChild(more);
      }
      defaultView.hidden = true;
      // Re-trigger the slide-in animation
      preview.hidden = true;
      void preview.offsetWidth;
      preview.hidden = false;
    };

    mega.addEventListener("mouseenter", function () {
      if (desktop.matches) setOpen(true);
    });
    mega.addEventListener("mouseleave", function () {
      if (!desktop.matches) return;
      closeTimer = setTimeout(function () { setOpen(false); }, 180);
    });
    mega.addEventListener("focusin", function () {
      if (desktop.matches) setOpen(true);
    });
    mega.addEventListener("focusout", function (e) {
      if (desktop.matches && !mega.contains(e.relatedTarget)) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mega.classList.contains("is-open")) {
        setOpen(false);
        trigger.focus();
      }
    });

    mega.querySelectorAll("[data-mega-item]").forEach(function (item) {
      item.addEventListener("mouseenter", function () { showPreview(item); });
      item.addEventListener("focus", function () { showPreview(item); });
    });
    var cols = mega.querySelector(".mega-cols");
    if (cols && side) {
      // Leaving the list for the preview keeps it; leaving elsewhere resets
      cols.addEventListener("mouseleave", function (e) {
        if (!side.contains(e.relatedTarget)) showDefault();
      });
    }

    if (subToggle) {
      subToggle.addEventListener("click", function () {
        setOpen(!mega.classList.contains("is-open"));
      });
    }
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
