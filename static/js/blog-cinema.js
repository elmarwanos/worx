/* ============================================================
   Worx | blog-cinema.js
   The blog's cinematic layer (index and articles; styles in
   blog-cinema.css). It only adds, never rebuilds, so the pages that
   tools/blog-covers/build-posts.js writes stay as they are:
     1. the bay: letterbox bars, ember light, grain and the HUD frame
        (with its clock) in the hero;
     2. the index's channels: the tuner band glides to the chosen one,
        each meter shows its share of the logs;
     3. the article's monitor: its feed bar and viewfinder, levelling
        out as you scroll into the article;
     4. the logs and sections boot / rise in as you reach them;
     5. the rails: comms (the footer's own social links) on the left,
        the tracker (how far through, and the chapters) on the right,
        both once the bay is behind you.
   ============================================================ */
(function () {
  "use strict";
  var q = function (s, r) { return (r || document).querySelector(s); };
  var qa = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var p2 = function (n) { return (n < 10 ? "0" : "") + n; };
  var el = function (tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  // any other page opts in with data-cinema on its hero (the contact
  // page), naming its frame with data-cinema-tl / -tl2 / -bl and its
  // tracker chapters with data-chapter
  var hero = q(".bl-hero") || q(".blog-post-hero") || q("[data-cinema]");
  var isIndex = !!q(".bl-hero");
  if (!hero) return;

  /* 1. the bay ------------------------------------------------------ */
  var category = (q(".blog-post-category") || {}).textContent || "";
  var readTime = "";
  qa(".blog-post-meta-item").forEach(function (m) {
    if (/reading/i.test(m.textContent)) readTime = (q("strong", m) || {}).textContent || "";
  });
  var bars = el("div", "bc-bars", "<i></i><i></i>");
  bars.setAttribute("aria-hidden", "true");
  var light = el("span", "bc-light"); light.setAttribute("aria-hidden", "true");
  var grain = el("span", "bc-grain"); grain.setAttribute("aria-hidden", "true");
  var frame = el("div", "bc-frame",
    '<span class="bc-frame-tl"><b>' + (hero.dataset.cinemaTl || (isIndex ? "LOGBOOK" : "FIELD NOTE")) + "</b> // " + (hero.dataset.cinemaTl2 || (isIndex ? "WORX · FIELD NOTES" : category.trim())) + "</span>" +
    '<span class="bc-frame-tr">T+ <b data-bc-clock>00:00:00</b></span>' +
    '<span class="bc-frame-bl">' + (hero.dataset.cinemaBl || (isIndex ? "ARCHIVE" : readTime.trim())) + " · 25.2048° N · 55.2708° E · DUBAI</span>" +
    '<span class="bc-frame-br">SCROLL TO READ <i></i></span>');
  frame.setAttribute("aria-hidden", "true");
  hero.insertBefore(grain, hero.firstChild);
  hero.insertBefore(light, hero.firstChild);
  hero.appendChild(frame);
  if (!reduced) {
    hero.appendChild(bars);
    setTimeout(function () { bars.remove(); }, 1800);
  }
  var clock = q("[data-bc-clock]", frame), t0 = Date.now();
  var tick = function () {
    var s = Math.floor((Date.now() - t0) / 1000);
    clock.textContent = p2(Math.floor(s / 3600)) + ":" + p2(Math.floor(s / 60) % 60) + ":" + p2(s % 60);
  };
  tick();
  if (!reduced) setInterval(tick, 1000);

  /* 2. the channels --------------------------------------------------- */
  var cats = q(".bl-card .blog-cats");
  if (cats) {
    var btns = qa(".blog-cat", cats);
    var max = 1;
    btns.forEach(function (b) { var n = parseInt((q(".blog-cat-n", b) || {}).textContent, 10) || 0; b.__n = n; if (b.dataset.filter !== "all") max = Math.max(max, n); });
    btns.forEach(function (b, i) {
      b.style.setProperty("--share", b.dataset.filter === "all" ? 1 : (b.__n / max).toFixed(2));
      b.addEventListener("click", function () { cats.style.setProperty("--row", i); });
      if (b.classList.contains("is-active")) cats.style.setProperty("--row", i);
    });
  }

  /* 2b. the transmission deck (index): the monitor cycles through the
     latest logs, tuning between them through static; pointing at a
     channel tunes it to that channel's newest log; picking a channel
     filters the logs and takes you down to them. */
  var deck = q(".bl-hero .blog-featured");
  if (deck) (function () {
    var media = q(".blog-featured-media", deck), pill = q(".blog-pill", deck), ttl = q(".blog-featured-title a", deck);
    var by = q(".blog-byline", deck), label = q(".bl-tx-bar > span:nth-child(2)", deck), fresh = q(".bl-tx-new", deck);
    var read = function (art, i) {
      var pic = q("picture", art), src = q("source", pic), img = q("img", pic), a = q("h2 a, h3 a", art);
      return { href: a.getAttribute("href"), title: a.innerHTML, cat: q(".blog-pill", art).innerHTML, filter: art.dataset.category,
        webp: src ? src.getAttribute("srcset") : "", img: img.getAttribute("src"), by: q(".blog-byline", art).innerHTML, log: i + 1 };
    };
    var items = [read(deck, 0)].concat(qa(".blog-card").map(function (c, i) { return read(c, i + 1); }));
    var cur = 0, busy = false, auto = null, hold = false, seen = true;
    // the monitor's own controls and the static it tunes through
    var ctl = el("span", "bl-tx-ctl",
      '<button type="button" data-d="-1" aria-label="Previous log">\u2039</button><b data-bl-n>01 / ' + p2(items.length) + '</b><button type="button" data-d="1" aria-label="Next log">\u203A</button>');
    fresh.parentNode.insertBefore(ctl, fresh);
    var stat = el("span", "bl-static"); stat.setAttribute("aria-hidden", "true");
    media.appendChild(stat);
    var nEl = q("[data-bl-n]", ctl);
    var show = function (i) {
      var it = items[i];
      media.setAttribute("href", it.href);
      var pic = q("picture", media), src = q("source", pic), img = q("img", pic);
      if (src) src.setAttribute("srcset", it.webp);
      img.setAttribute("src", it.img);
      pill.innerHTML = it.cat; ttl.innerHTML = it.title; ttl.setAttribute("href", it.href); by.innerHTML = it.by;
      deck.dataset.category = it.filter;
      label.textContent = "LOG " + p2(it.log) + " \u00B7 " + (i ? "TRANSMISSION" : "INCOMING TRANSMISSION");
      fresh.style.visibility = i ? "hidden" : "visible";
      nEl.textContent = p2(i + 1) + " / " + p2(items.length);
    };
    var tune = function (i) {
      i = (i + items.length) % items.length;
      if (i === cur || busy) return;
      cur = i;
      if (reduced) { show(i); return; }
      busy = true;
      deck.classList.remove("is-tuning"); void deck.offsetWidth; deck.classList.add("is-tuning");
      setTimeout(function () { show(i); }, 230);
      setTimeout(function () { deck.classList.remove("is-tuning"); busy = false; }, 620);
    };
    var loop = function () {
      clearInterval(auto);
      if (reduced) return;
      auto = setInterval(function () { if (!hold && seen && !document.hidden) tune(cur + 1); }, 6500);
    };
    qa("button", ctl).forEach(function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); tune(cur + (+b.dataset.d)); loop(); });
    });
    deck.addEventListener("pointerenter", function () { hold = true; });
    deck.addEventListener("pointerleave", function () { hold = false; });
    deck.addEventListener("focusin", function () { hold = true; });
    deck.addEventListener("focusout", function () { hold = false; });
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { seen = en[0].isIntersecting; }).observe(deck);
    // the channels tune it; picking one takes you to its logs
    var newest = function (f) { for (var k = 0; k < items.length; k++) if (f === "all" || items[k].filter === f) return k; return -1; };
    qa(".blog-cat").forEach(function (b) {
      var preview = function () { var k = newest(b.dataset.filter); if (k >= 0) tune(k); };
      b.addEventListener("pointerenter", preview);
      b.addEventListener("focus", preview);
      b.addEventListener("click", function () {
        preview();
        var list = q(".blog-list");
        if (!list) return;
        setTimeout(function () {
          var y = list.getBoundingClientRect().top + window.scrollY - 110;
          window.scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
        }, 60);
      });
    });
    loop();
  })();

  /* 3. the article's monitor ------------------------------------------ */
  var art = q(".blog-post-hero .blog-feature-art");
  var wrap = q(".blog-post-hero .blog-feature-wrap");
  if (art) {
    var bar = el("div", "bp-mon-bar", '<span class="bp-rec"></span><span>' + category.trim() + ' · COVER FEED</span><span class="bp-mon-live">LIVE</span>');
    bar.setAttribute("aria-hidden", "true");
    art.insertBefore(bar, art.firstChild);
    var vf = el("span", "bp-mon-vf"); vf.setAttribute("aria-hidden", "true");
    art.appendChild(vf);
    if (wrap && !reduced) {
      var ft = false;
      var flat = function () {
        ft = false;
        var k = Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight * 0.6)));
        wrap.style.setProperty("--flat", k.toFixed(3));
      };
      window.addEventListener("scroll", function () { if (!ft) { ft = true; requestAnimationFrame(flat); } }, { passive: true });
    }
  }

  /* 4. arrivals --------------------------------------------------------- */
  if ("IntersectionObserver" in window && !reduced) {
    var cards = qa(".blog-card");
    cards.forEach(function (c) { c.classList.add("bc-wait"); });
    var batch = 0, batchT = 0;
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (!e.isIntersecting) return;
        var c = e.target;
        io.unobserve(c);
        // cards arriving together boot one after another
        var now = performance.now();
        if (now - batchT > 400) batch = 0;
        batchT = now;
        c.style.setProperty("--k", batch++);
        c.classList.remove("bc-wait");
        c.classList.add("is-booting");
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    cards.forEach(function (c) { io.observe(c); });

    var rise = qa(".blog-article-content > section, .blog-article-content > .article-cta, .related-card");
    rise.forEach(function (s) { s.classList.add("bc-rise"); });
    var io2 = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io2.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -12% 0px" });
    rise.forEach(function (s) { io2.observe(s); });
  } else {
    qa(".blog-article-content > section").forEach(function (s) { s.classList.add("is-in"); });
  }

  /* 5. the rails ---------------------------------------------------------- */
  // comms: the footer's own social links, so there is one list to keep
  var social = qa(".footer-social a");
  var comms = el("aside", "bc-comms");
  comms.setAttribute("aria-label", "Worx on social media");
  comms.innerHTML = '<span class="bc-comms-tag" aria-hidden="true">COMMS</span>' +
    '<span class="bc-comms-signal" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' +
    '<span class="bc-comms-line" aria-hidden="true"></span><ul class="bc-comms-list"></ul>' +
    '<span class="bc-comms-line" aria-hidden="true"></span>' +
    '<span class="bc-comms-status" aria-hidden="true"><i></i>OPEN CHANNEL</span>';
  var list = q(".bc-comms-list", comms);
  social.forEach(function (a) { var li = document.createElement("li"); li.appendChild(a.cloneNode(true)); list.appendChild(li); });
  if (social.length) document.body.appendChild(comms);

  // the tracker: the page's chapters
  var chapters = [];
  if (isIndex) {
    chapters = [["Archive", hero], ["Logs", q(".blog-list")], ["Contact", q(".site-footer")]];
  } else if (!q(".blog-toc")) {
    chapters = qa("[data-chapter]").map(function (c) { return [c.dataset.chapter, c]; });
  } else {
    qa(".blog-toc a[href^='#']").forEach(function (a) {
      var t = document.getElementById(a.getAttribute("href").slice(1));
      if (t) chapters.push([a.textContent.trim(), t]);
    });
    var rel = q(".related-posts");
    if (rel) chapters.push(["Next logs", rel]);
  }
  chapters = chapters.filter(function (c) { return c[1]; });
  var track = el("nav", "bc-track");
  track.setAttribute("aria-label", "Page chapters");
  track.innerHTML = '<span class="bc-track-read" aria-hidden="true">' + (isIndex ? "ARCHIVE" : hero.dataset.cinemaRead || "READ") + ' <b data-bc-read>000</b>%</span>' +
    '<div class="bc-track-body"><ol class="bc-track-list"></ol><span class="bc-track-scale" aria-hidden="true"><i></i></span></div>';
  var tl = q(".bc-track-list", track);
  chapters.forEach(function (c, i) {
    if (!c[1].id) c[1].id = "bc-ch-" + i;
    var li = document.createElement("li");
    li.innerHTML = '<a href="#' + c[1].id + '"><span>' + p2(i) + "</span>" + c[0] + "</a>";
    tl.appendChild(li);
    c.push(q("a", li));
  });
  if (chapters.length) document.body.appendChild(track);
  var readEl = q("[data-bc-read]", track), scale = q(".bc-track-scale", track);

  var rt = false;
  var rails = function () {
    rt = false;
    var on = hero.getBoundingClientRect().bottom < window.innerHeight * 0.6;
    comms.classList.toggle("is-on", on);
    track.classList.toggle("is-on", on);
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var p = Math.min(1, window.scrollY / max);
    readEl.textContent = ("00" + Math.round(p * 100)).slice(-3);
    scale.style.setProperty("--p", p.toFixed(3));
    var cur = -1;
    chapters.forEach(function (c, i) { if (c[1].getBoundingClientRect().top < window.innerHeight * 0.45) cur = i; });
    chapters.forEach(function (c, i) { c[2].classList.toggle("is-active", i === cur); });
  };
  window.addEventListener("scroll", function () { if (!rt) { rt = true; requestAnimationFrame(rails); } }, { passive: true });
  window.addEventListener("resize", rails);
  rails();
})();
