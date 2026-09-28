/* ============================================================
   Worx | nav.js
   Header scroll state (full-width bar over the hero, floating glass
   pill once scrolled, with a progress hairline), mobile menu panel,
   EN / AR switch, Services mega menu, active link marking.
   ============================================================ */

(function () {
  "use strict";

  // Mark the document as JS-enabled so animations.css can hide
  // reveal elements without breaking the no-JS experience.
  document.documentElement.classList.add("js");

  var header = document.querySelector(".site-header");
  if (!header) return;
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelectorAll(".nav-links a");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // matchMedia change listener, with the old Safari (< 14) fallback
  function onMedia(mq, fn) {
    if (mq.addEventListener) mq.addEventListener("change", fn);
    else if (mq.addListener) mq.addListener(fn);
  }

  // --- The pill once the page is scrolled, + page progress -----
  // (The About page treats every story chapter as a hero: no progress
  // line there, about.css / layout.css.)
  var root = document.documentElement;
  var ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.scrollY;
    header.classList.toggle("is-scrolled", y > 24);
    var max = root.scrollHeight - window.innerHeight;
    root.style.setProperty("--nav-progress", max > 0 ? Math.min(1, y / max).toFixed(4) : "0");
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener("resize", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  // --- Mobile menu panel -----------------------------------------
  // Open: the page behind is locked (html + body, so iOS doesn't
  // scroll it either) and made inert, Tab cycles inside the header,
  // Escape closes and hands focus back to the toggle.
  var menuOpen = false;
  function setMenu(open) {
    if (open === menuOpen) return;
    menuOpen = open;
    header.classList.toggle("menu-open", open);
    if (!toggle) return;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    root.style.overflow = open ? "hidden" : "";
    document.body.style.overflow = open ? "hidden" : "";
    document.body.classList.toggle("nav-open", open);
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el === header || el.contains(header) || el.tagName === "SCRIPT") return;
      if (open) {
        if (el.inert) return;
        el.inert = true;
        el.setAttribute("data-nav-inert", "");
      } else if (el.hasAttribute("data-nav-inert")) {
        el.inert = false;
        el.removeAttribute("data-nav-inert");
      }
    });
    // fold Services back up once the panel has slid away, so the menu
    // reopens clean
    if (!open && typeof closeMobileMega === "function") {
      setTimeout(function () { if (!menuOpen) closeMobileMega(true); }, reduceMotion ? 0 : 650);
    }
  }

  // every control in the header a keyboard can reach right now
  function headerFocusables() {
    return Array.prototype.filter.call(
      header.querySelectorAll("a[href], button:not([disabled])"),
      function (el) { return el.getClientRects().length && getComputedStyle(el).visibility !== "hidden"; }
    );
  }

  var closeMobileMega = null;
  if (toggle) {
    toggle.addEventListener("click", function () {
      setMenu(!menuOpen);
    });

    // Close the menu when a link is chosen, or on Escape
    links.forEach(function (link) {
      link.addEventListener("click", function () { setMenu(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (!menuOpen) return;
      if (e.key === "Escape") { setMenu(false); toggle.focus(); return; }
      if (e.key === "Tab") {
        var items = headerFocusables();
        if (!items.length) return;
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || !header.contains(document.activeElement))) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    });
    // back to the desktop bar with the panel open: close it
    onMedia(window.matchMedia("(min-width: 981px)"), function (m) {
      if (m.matches) setMenu(false);
    });
  }

  // --- EN / AR --------------------------------------------------
  // Every page is English today. If a page links its Arabic edition
  // (<link rel="alternate" hreflang="ar" href="...">), AR goes there;
  // otherwise the thumb slides over, a short note says the Arabic
  // edition is on its way, and it slides back to EN.
  var arAlt = document.querySelector('link[rel="alternate"][hreflang="ar"]');
  var enAlt = document.querySelector('link[rel="alternate"][hreflang="en"]');
  var pageLang = (root.getAttribute("lang") || "en").slice(0, 2);
  document.querySelectorAll(".lang-switch").forEach(function (sw) {
    var note = document.createElement("span");
    note.className = "lang-note";
    note.setAttribute("role", "status");
    note.innerHTML = '<b lang="ar" dir="rtl">النسخة العربية قريباً</b>Arabic edition coming soon';
    sw.appendChild(note);
    var noteTimer = null;
    var mark = function (lang) {
      sw.dataset.active = lang;
      sw.querySelectorAll(".lang-opt").forEach(function (b) {
        var on = b.dataset.lang === lang;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    };
    mark(pageLang === "ar" ? "ar" : "en");
    sw.addEventListener("click", function (e) {
      var b = e.target.closest(".lang-opt");
      if (!b || b.dataset.lang === sw.dataset.active) return;
      var alt = b.dataset.lang === "ar" ? arAlt : enAlt;
      if (alt) { window.location.href = alt.href; return; }
      mark(b.dataset.lang);
      sw.classList.add("is-noting");
      clearTimeout(noteTimer);
      noteTimer = setTimeout(function () {
        sw.classList.remove("is-noting");
        mark(pageLang === "ar" ? "ar" : "en");
      }, 2600);
    });
  });

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
    var panelEl = mega.querySelector(".mega");
    var closeTimer = null;
    var openTimer = null;
    var anim = null;
    var desktop = window.matchMedia("(min-width: 981px)");
    var EASE = "cubic-bezier(0.135, 0.9, 0.15, 1)";   // --nav-ease

    var setOpen = function (open) {
      clearTimeout(closeTimer);
      clearTimeout(openTimer);
      mega.classList.toggle("is-open", open);
      header.classList.toggle("mega-open", open && desktop.matches);
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      if (subToggle) subToggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (!open) showDefault();
    };

    // Mobile accordion: the panel eases its height open and shut
    // (display toggles with .is-open, so measure, then animate).
    var toggleMobile = function (open, instant) {
      if (anim) { anim.cancel(); anim = null; }
      if (!panelEl || instant || reduceMotion || !panelEl.animate) { setOpen(open); return; }
      var from, to;
      if (open) {
        setOpen(true);
        to = panelEl.offsetHeight;
        from = 0;
      } else {
        from = panelEl.offsetHeight;
        to = 0;
      }
      anim = panelEl.animate(
        [{ height: from + "px", opacity: open ? 0 : 1 }, { height: to + "px", opacity: open ? 1 : 0 }],
        { duration: open ? 520 : 380, easing: EASE }
      );
      anim.onfinish = function () {
        anim = null;
        if (!open) setOpen(false);
      };
    };
    closeMobileMega = function (instant) {
      if (!desktop.matches && mega.classList.contains("is-open")) toggleMobile(false, instant);
    };
    onMedia(desktop, function () {
      if (anim) { anim.cancel(); anim = null; }
      setOpen(false);
    });

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

    // Hover intent: a short pause before opening, so a pointer just
    // passing over "Services" on its way elsewhere doesn't flash the
    // panel; a longer grace before closing so it can travel into it.
    mega.addEventListener("mouseenter", function () {
      if (!desktop.matches) return;
      escaped = false;
      clearTimeout(closeTimer);
      if (mega.classList.contains("is-open")) return;
      clearTimeout(openTimer);
      openTimer = setTimeout(function () { setOpen(true); }, 90);
    });
    mega.addEventListener("mouseleave", function () {
      if (!desktop.matches) return;
      clearTimeout(openTimer);
      closeTimer = setTimeout(function () { setOpen(false); }, 220);
    });
    // Arrow down on the trigger steps into the panel
    trigger.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowDown" || !desktop.matches) return;
      var firstItem = mega.querySelector(".mega a");
      if (!firstItem) return;
      e.preventDefault();
      setOpen(true);
      firstItem.focus();
    });
    // After Escape, focus goes back to the trigger without reopening
    // the panel; Arrow down, a new hover, or leaving and coming back
    // opens it again.
    var escaped = false;
    mega.addEventListener("focusin", function (e) {
      if (!desktop.matches) return;
      if (escaped && e.target === trigger) return;
      setOpen(true);
    });
    mega.addEventListener("focusout", function (e) {
      if (mega.contains(e.relatedTarget)) return;
      escaped = false;
      if (desktop.matches) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mega.classList.contains("is-open") && desktop.matches) {
        escaped = true;
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
        var open = !mega.classList.contains("is-open");
        if (desktop.matches) setOpen(open);
        else toggleMobile(open);
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
