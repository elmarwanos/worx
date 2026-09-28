/* ============================================================
   Worx | service-detail.js
   The service module pages (services/*.html, not the hub).

   1. The bay: the headline rises word by word, the mission clock
      runs, and the module's live instrument plays: a small
      simulation of the service at work (one builder per service,
      see SCENES). Instruments run only while they are on screen.
   2. The bay's backdrop: a cinematic motif of its own for every
      service (code rain, bokeh, a constellation, a holodeck...).
   3. Boot-ins as things arrive, the limbs drawing in, the systems'
      pointer light and their labels scrambling in.
   4. The mission logs: films fetched when first seen, played only
      while on screen, their timecodes on the bar.
   5. The comms tracker, once the bay is behind you.

   Everything stands down for prefers-reduced-motion: the
   instruments show their finished state, nothing loops.
   ============================================================ */
(function () {
  "use strict";

  var root = document.querySelector("[data-sd]");
  if (!root) return;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var q = function (s, el) { return (el || document).querySelector(s); };
  var qa = function (s, el) { return [].slice.call((el || document).querySelectorAll(s)); };
  var p2 = function (n) { return (n < 10 ? "0" : "") + n; };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var io = "IntersectionObserver" in window;

  function scramble(el, text, dur) {
    if (reduced) { el.textContent = text; return; }
    var glyphs = "01<>/\\#%&*+=?ABCDEFXYZ", t0 = performance.now();
    clearTimeout(el.__scr);
    (function run() {
      var k = Math.min(1, (performance.now() - t0) / dur), out = "";
      for (var i = 0; i < text.length; i++) {
        var c = text.charAt(i);
        out += c === " " || i / text.length < k ? c : glyphs.charAt((Math.random() * glyphs.length) | 0);
      }
      el.textContent = out;
      if (k < 1) el.__scr = setTimeout(run, 40);
    })();
  }

  function whenSeen(el, fn, opts) {
    if (!el) return;
    if (!io || reduced) { fn(); return; }
    var o = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { o.disconnect(); fn(); }
    }, opts || { rootMargin: "0px 0px -12% 0px" });
    o.observe(el);
  }

  // shared SVG paint: the brand gradient, for every instrument
  var defs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  defs.setAttribute("aria-hidden", "true");
  defs.setAttribute("width", "0");
  defs.setAttribute("height", "0");
  defs.style.position = "absolute";
  defs.innerHTML = '<defs><linearGradient id="sc-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c04527"/><stop offset=".55" stop-color="#e57d23"/><stop offset="1" stop-color="#faa719"/></linearGradient>' +
    '<linearGradient id="sc-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e57d23" stop-opacity=".45"/><stop offset="1" stop-color="#e57d23" stop-opacity="0"/></linearGradient></defs>';
  document.body.appendChild(defs);

  /* ----------------------------------------------------------
     1. The bay
     ---------------------------------------------------------- */
  // the headline, word by word (an inline element, like the gradient
  // word, rides as one piece so its paint stays whole)
  var title = q("[data-sd-title]");
  if (title) {
    var wi = 0, frag = document.createDocumentFragment();
    var wrap = function (node) {
      var w = document.createElement("span");
      w.className = "sd-w";
      var inner = document.createElement("span");
      inner.style.setProperty("--w", wi++);
      inner.appendChild(node);
      w.appendChild(inner);
      return w;
    };
    [].slice.call(title.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(" "));
          else frag.appendChild(wrap(document.createTextNode(part)));
        });
      } else frag.appendChild(wrap(n.cloneNode(true)));
    });
    title.innerHTML = "";
    title.appendChild(frag);
    requestAnimationFrame(function () { requestAnimationFrame(function () { title.classList.add("is-in"); }); });
  }

  // the mission clock
  var clock = q("[data-sd-clock]");
  if (clock) {
    var t0 = performance.now();
    var tick = function () {
      var s = Math.floor((performance.now() - t0) / 1000);
      clock.textContent = p2(Math.floor(s / 3600)) + ":" + p2(Math.floor(s / 60) % 60) + ":" + p2(s % 60);
    };
    tick();
    if (!reduced) setInterval(tick, 1000);
  }

  /* ----------------------------------------------------------
     The instruments. Each builder fills the stage and returns
     { start, stop, still }. A Runner loops an async script that
     any stop() cancels at its next wait().
     ---------------------------------------------------------- */
  function Runner(body) {
    var gen = 0, on = false;
    return {
      start: function () {
        if (on) return;
        on = true;
        var g = ++gen;
        var wait = function (ms) {
          return new Promise(function (res, rej) {
            setTimeout(function () { (gen === g && on) ? res() : rej("stop"); }, ms);
          });
        };
        (async function () {
          try { for (;;) await body(wait); } catch (e) { /* stopped */ }
        })();
      },
      stop: function () { on = false; gen++; },
    };
  }

  function Loop(frame) {
    var raf = 0, on = false, last = 0;
    return {
      start: function () {
        if (on) return;
        on = true; last = 0;
        (function step(now) {
          if (!on) return;
          var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
          last = now;
          frame(now, dt);
          raf = requestAnimationFrame(step);
        })(performance.now());
      },
      stop: function () { on = false; cancelAnimationFrame(raf); },
    };
  }

  function both(a, b) {
    return { start: function () { a.start(); b.start(); }, stop: function () { a.stop(); b.stop(); } };
  }

  var h = function (html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; };
  var bars = function (labels) {
    return labels.map(function (l) { return '<div><span class="sc-label">' + l + '</span><span class="sc-bar"><span class="sc-fill"></span></span></div>'; }).join("");
  };

  var SCENES = {};

  // WEB: the code types, the page builds itself, Lighthouse counts up
  SCENES.web = function (stage) {
    stage.classList.add("sc-web");
    stage.innerHTML =
      '<div class="sc-panel sc-code"><code></code></div>' +
      '<div class="sc-panel sc-page"><i class="pg-nav"></i><i class="pg-hero"></i><div class="pg-row"><b></b><b></b><b></b></div><i class="pg-cta"></i></div>' +
      '<div class="sc-panel sc-lh"><div class="sc-ring"><svg viewBox="0 0 60 60"><circle class="tr" cx="30" cy="30" r="26"/><circle class="fl" cx="30" cy="30" r="26" pathLength="1"/></svg><b>0</b></div>' +
      '<div class="sc-metrics">' + bars(["Performance", "Accessibility", "Best practices", "SEO"]) + "</div></div>";
    var code = q("code", stage), ring = q(".sc-ring", stage), num = q(".sc-ring b", stage);
    var fills = qa(".sc-fill", stage);
    var blocks = [q(".pg-nav", stage), q(".pg-hero", stage)].concat(qa(".pg-row b", stage), [q(".pg-cta", stage)]);
    var K = function (t) { return '<span class="k">' + t + "</span>"; }, S = function (t) { return '<span class="s">' + t + "</span>"; };
    var LINES = [
      [K("const") + " site = " + K("await") + " worx.build({", "const site = await worx.build({", 0],
      ["  stack: " + S('"headless"') + ",", '  stack: "headless",', 1],
      ["  pages: [" + S('"home"') + ", " + S('"work"') + ", " + S('"contact"') + "],", '  pages: ["home", "work", "contact"],', 2],
      ["  seo: " + K("true") + ", a11y: " + K("true") + ",", "  seo: true, a11y: true,", -1],
      ["  images: " + S('"avif"') + ", cache: " + S('"edge"') + ",", '  images: "avif", cache: "edge",', 5],
      ["});", "});", 6],
      ['<span class="c">// ship it</span>', "// ship it", -1],
      ["site.deploy();", "site.deploy();", -1],
    ];
    var paint = function (done, typing) {
      code.innerHTML = done.map(function (l, i) { return '<span class="ln">' + (i + 1) + "</span>" + l; }).join("\n") +
        (typing != null ? (done.length ? "\n" : "") + '<span class="ln">' + (done.length + 1) + "</span>" + typing.replace(/&/g, "&amp;").replace(/</g, "&lt;") + '<i class="sc-caret"></i>' : "");
    };
    var score = function (v) { ring.style.setProperty("--p", (v / 100).toFixed(3)); num.textContent = Math.round(v); };
    var reset = function () {
      blocks.forEach(function (b) { b.classList.remove("is-on"); });
      fills.forEach(function (f) { f.style.setProperty("--p", 0); });
      score(0); paint([], "");
    };
    var still = function () {
      paint(LINES.map(function (l) { return l[0]; }));
      blocks.forEach(function (b) { b.classList.add("is-on"); });
      fills.forEach(function (f) { f.style.setProperty("--p", 1); });
      score(100);
    };
    var r = Runner(async function (wait) {
      reset();
      await wait(500);
      var done = [];
      for (var i = 0; i < LINES.length; i++) {
        var plain = LINES[i][1];
        for (var c = 1; c <= plain.length; c++) { paint(done, plain.slice(0, c)); await wait(plain.charAt(c - 1) === " " ? 45 : 22 + Math.random() * 30); }
        done.push(LINES[i][0]);
        paint(done, "");
        var b = LINES[i][2];
        // each line builds its part of the page: nav, hero, the cards, the button
        if (b === 2) { blocks[2].classList.add("is-on"); await wait(120); blocks[3].classList.add("is-on"); await wait(120); blocks[4].classList.add("is-on"); }
        else if (b >= 0 && blocks[b]) blocks[b].classList.add("is-on");
        await wait(160);
      }
      paint(done);
      for (var v = 0; v <= 100; v += 4) { score(v); await wait(26); }
      for (var m = 0; m < fills.length; m++) { fills[m].style.setProperty("--p", 1); await wait(160); }
      await wait(3200);
    });
    return { start: r.start, stop: r.stop, still: still };
  };

  // PLATFORM / ERP: a core, its satellites, data flowing between them
  function network(stage, kind) {
    stage.classList.add("sc-net");
    var LAB = kind === "erp" ? ["FINANCE", "CRM", "SUPPLY", "HR", "SALES", "DATA"] : ["CRM", "ERP", "PAY", "PORTAL", "DATA", "AUTH"];
    var CORE = kind === "erp" ? "ERP" : "CORE";
    var cx = 200, cy = 128, rx = 150, ry = 92;
    var nodes = LAB.map(function (l, i) {
      var a = -Math.PI / 2 + (i / LAB.length) * Math.PI * 2;
      return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, l: l };
    });
    var svg = '<svg class="sc-svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" style="height:78%">' +
      nodes.map(function (n) { return '<line class="sc-link" x1="' + cx + '" y1="' + cy + '" x2="' + n.x.toFixed(1) + '" y2="' + n.y.toFixed(1) + '"/>'; }).join("") +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="none" stroke="rgba(254,238,207,.07)"/>' +
      '<g class="sc-core"><circle class="o" cx="' + cx + '" cy="' + cy + '" r="26"/><circle class="c" cx="' + cx + '" cy="' + cy + '" r="24"/><text x="' + cx + '" y="' + (cy + 1) + '">' + CORE + "</text></g>" +
      nodes.map(function (n, i) { return '<g class="sc-node" data-i="' + i + '"><circle cx="' + n.x.toFixed(1) + '" cy="' + n.y.toFixed(1) + '" r="25"/><text x="' + n.x.toFixed(1) + '" y="' + (n.y + 1).toFixed(1) + '">' + n.l + "</text></g>"; }).join("") +
      '<g class="sc-pks"></g></svg>';
    var K = kind === "erp" ? [["Records synced", "k1"], ["Invoices today", "k2"], ["Stock accuracy", "k3"]] : [["Events / s", "k1"], ["Uptime", "k2"], ["Systems in sync", "k3"]];
    stage.innerHTML = svg + '<div class="sc-panel sc-kpi">' + K.map(function (k) { return '<div><span class="sc-label">' + k[0] + '</span><b data-' + k[1] + '>0</b><span class="sc-bar"><span class="sc-fill"></span></span></div>'; }).join("") + "</div>";
    var g = q(".sc-pks", stage), els = qa(".sc-node", stage), fills = qa(".sc-fill", stage);
    var k1 = q("[data-k1]", stage), k2 = q("[data-k2]", stage), k3 = q("[data-k3]", stage);
    var NS = "http://www.w3.org/2000/svg", pks = [], acc = 0, count = kind === "erp" ? 18420 : 0;
    var spawn = function () {
      var c = document.createElementNS(NS, "circle");
      c.setAttribute("r", "3");
      var out = Math.random() < 0.5;
      c.setAttribute("class", "sc-pk" + (out ? " b" : ""));
      g.appendChild(c);
      pks.push({ el: c, n: (Math.random() * nodes.length) | 0, t: 0, out: out, v: 0.6 + Math.random() * 0.5 });
    };
    var settle = function () {
      if (kind === "erp") { k1.textContent = count.toLocaleString("en-US"); k2.textContent = "1,284"; k3.textContent = "99.9%"; }
      else { k1.textContent = "1,2" + (((Math.random() * 90) | 0) + 10); k2.textContent = "99.98%"; k3.textContent = "6 / 6"; }
      fills[0].style.setProperty("--p", 0.62 + Math.random() * 0.3);
      fills[1].style.setProperty("--p", 0.97);
      fills[2].style.setProperty("--p", kind === "erp" ? 0.94 : 1);
    };
    var lp = Loop(function (now, dt) {
      acc += dt;
      if (acc > 0.16 && pks.length < 16) { acc = 0; spawn(); }
      for (var i = pks.length - 1; i >= 0; i--) {
        var p = pks[i], n = nodes[p.n];
        p.t += dt * p.v;
        var k = p.out ? p.t : 1 - p.t;
        p.el.setAttribute("cx", (cx + (n.x - cx) * k).toFixed(1));
        p.el.setAttribute("cy", (cy + (n.y - cy) * k).toFixed(1));
        if (p.t >= 1) {
          if (p.out) { els[p.n].classList.add("is-hot"); (function (e) { setTimeout(function () { e.classList.remove("is-hot"); }, 260); })(els[p.n]); }
          p.el.remove(); pks.splice(i, 1); count += 7;
        }
      }
    });
    var ticker = Runner(async function (wait) { settle(); await wait(900); });
    var still = function () { settle(); };
    var s = both(lp, ticker);
    return { start: s.start, stop: s.stop, still: still };
  }
  SCENES.platform = function (stage) { return network(stage, "platform"); };
  SCENES.erp = function (stage) { return network(stage, "erp"); };

  // MOBILE: the phone turns, the app flips screens, a notification lands
  SCENES.mobile = function (stage) {
    stage.classList.add("sc-mobile");
    var app = function (g, on) {
      return '<div class="sc-app"><i class="a-hd"></i><i class="a-img" style="background:' + g + '"></i><i class="a-row"></i><i class="a-row"></i><i class="a-row"></i>' +
        '<div class="a-tab">' + [0, 1, 2, 3].map(function (k) { return '<i class="' + (k === on ? "on" : "") + '"></i>'; }).join("") + "</div></div>";
    };
    stage.innerHTML =
      '<div class="sc-side sc-side--l"><span class="sc-chip is-on"><i></i>iOS</span><span class="sc-chip is-on"><i></i>Android</span><span class="sc-chip" data-rev><i></i>Store review</span></div>' +
      '<div class="sc-phone"><div class="sc-toast"><i></i><span>New booking · just now</span></div><div class="sc-track">' +
      app("linear-gradient(135deg,#c04527,#faa719)", 0) + app("radial-gradient(circle at 30% 30%,#faa719,#7d2a0b)", 1) + app("linear-gradient(160deg,#3a1307,#e57d23)", 2) +
      "</div></div>" +
      '<div class="sc-side sc-side--r"><span class="sc-label">Build 2.4.1</span><span class="sc-bar"><span class="sc-fill"></span></span><span class="sc-label" data-pct>0%</span></div>';
    var track = q(".sc-track", stage), toast = q(".sc-toast", stage), rev = q("[data-rev]", stage), fill = q(".sc-fill", stage), pct = q("[data-pct]", stage);
    var go = function (i) { track.style.transform = "translateX(" + (-100 * i) + "%)"; };
    var prog = function (p) { fill.style.setProperty("--p", p); pct.textContent = Math.round(p * 100) + "%"; };
    var still = function () { go(0); prog(1); rev.classList.add("is-on"); };
    var r = Runner(async function (wait) {
      rev.classList.remove("is-on"); prog(0); go(0);
      for (var i = 0; i < 3; i++) {
        prog((i + 1) / 3);
        await wait(2200);
        if (i === 1) { toast.classList.add("is-on"); await wait(1600); toast.classList.remove("is-on"); await wait(400); }
        go((i + 1) % 3);
      }
      rev.classList.add("is-on");
      await wait(1800);
    });
    return { start: r.start, stop: r.stop, still: still };
  };

  // DESIGN: the cursor turns a wireframe into the finished page
  SCENES.design = function (stage) {
    stage.classList.add("sc-design");
    stage.innerHTML =
      '<div class="sc-panel sc-board"><i class="b-nav"></i><i class="b-hero"></i><div class="b-cards"><b></b><b></b><b></b></div><i class="b-cta"></i></div>' +
      '<div class="sc-panel sc-tokens"><span class="sc-label">Tokens</span><div class="sc-sw"><i style="background:#c04527"></i><i style="background:#e57d23"></i><i style="background:#faa719"></i><i style="background:#feeecf"></i><i style="background:#421d0f"></i><i style="background:#150905;border:1px solid rgba(254,238,207,.2)"></i></div>' +
      '<span class="sc-label">Type</span><div class="sc-type"><b>Aa</b><b>Aa</b><b>48 · 32 · 16</b></div><span class="sc-label">Spacing</span><div class="sc-space"><i style="width:30%"></i><i style="width:50%"></i><i style="width:80%"></i></div></div>' +
      '<svg class="sc-cursor" viewBox="0 0 18 18"><path d="M2 1l13 7-6 1.5L6 16z"/></svg>';
    var cur = q(".sc-cursor", stage);
    var parts = [q(".b-nav", stage), q(".b-hero", stage)].concat(qa(".b-cards b", stage), [q(".b-cta", stage)]);
    var to = function (el) {
      var r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
      cur.style.transform = "translate(" + (r.left - s.left + r.width * 0.55).toFixed(0) + "px," + (r.top - s.top + r.height * 0.5).toFixed(0) + "px)";
    };
    var still = function () { parts.forEach(function (p) { p.classList.add("is-hi"); }); };
    var r = Runner(async function (wait) {
      parts.forEach(function (p) { p.classList.remove("is-hi"); });
      await wait(700);
      for (var i = 0; i < parts.length; i++) {
        to(parts[i]); await wait(900);
        cur.classList.remove("is-click"); void cur.offsetWidth; cur.classList.add("is-click");
        parts[i].classList.add("is-hi");
        await wait(380);
      }
      cur.style.transform = "translate(88%,86%)";
      await wait(2800);
    });
    return { start: r.start, stop: r.stop, still: still };
  };

  // SEO: the query types, your result climbs to #1, traffic rises
  SCENES.seo = function (stage) {
    stage.classList.add("sc-seo");
    stage.innerHTML =
      '<div class="sc-panel sc-serp"><div class="sc-q"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><span data-qt></span><i class="sc-caret"></i></div><div class="sc-res">' +
      [0, 1, 2, 3, 4, 5].map(function (i) { return '<div class="sc-hit' + (i === 4 ? " is-us" : "") + '"><em></em><b>' + (i === 4 ? "yourbrand.com" : "") + "</b><i></i></div>"; }).join("") +
      "</div></div>" +
      '<div class="sc-panel sc-graph"><span class="sc-label">Organic traffic</span><svg viewBox="0 0 100 50" preserveAspectRatio="none"><path class="ga" d="M0 48 C 20 46, 30 40, 45 34 S 70 18, 100 4 L 100 50 L 0 50 Z"/><path class="gl" pathLength="1" d="M0 48 C 20 46, 30 40, 45 34 S 70 18, 100 4"/></svg></div>' +
      '<div class="sc-panel sc-vitals"><span class="sc-label">Core Web Vitals</span><span class="sc-chip"><i></i>LCP 1.2 s</span><span class="sc-chip"><i></i>INP 90 ms</span><span class="sc-chip"><i></i>CLS 0.01</span></div>';
    var qt = q("[data-qt]", stage), hits = qa(".sc-hit", stage), graph = q(".sc-graph", stage), chips = qa(".sc-vitals .sc-chip", stage);
    var us = hits[4], order = hits.slice();
    var place = function () { order.forEach(function (el, i) { el.style.top = (i * 100 / 6) + "%"; q("em", el).textContent = "#" + (i + 1); }); };
    var QS = ["web development dubai", "luxury e-commerce uae", "fastest website agency"];
    var qi = 0;
    var still = function () { order = [us].concat(hits.filter(function (x) { return x !== us; })); place(); qt.textContent = QS[0]; graph.style.setProperty("--p", 1); chips.forEach(function (c) { c.classList.add("is-on"); }); };
    var r = Runner(async function (wait) {
      order = hits.slice(); place();
      graph.style.setProperty("--p", 0); chips.forEach(function (c) { c.classList.remove("is-on"); });
      var text = QS[qi++ % QS.length];
      for (var c = 1; c <= text.length; c++) { qt.textContent = text.slice(0, c); await wait(55); }
      await wait(600);
      for (var step = 0; step < 4; step++) {
        var i = order.indexOf(us);
        order[i] = order[i - 1]; order[i - 1] = us; place();
        graph.style.setProperty("--p", (step + 1) / 4);
        if (chips[step]) chips[step].classList.add("is-on");
        await wait(900);
      }
      await wait(2600);
      for (var d = text.length; d >= 0; d--) { qt.textContent = text.slice(0, d); await wait(18); }
    });
    return { start: r.start, stop: r.stop, still: still };
  };

  // XR: a camera view finds the floor, locks an anchor, places a hologram
  SCENES.xr = function (stage) {
    stage.classList.add("sc-xr");
    stage.innerHTML = '<canvas></canvas><div class="sc-xr-hud"><span class="sc-chip" data-a><i></i>Plane detected</span><span class="sc-chip" data-b><i></i>Anchor locked</span><span class="sc-chip" data-c><i></i>Hologram live</span></div><span class="sc-chip is-on sc-xr-fps"><i></i>60 fps · 6DoF</span>';
    var cv = q("canvas", stage), ctx = cv.getContext("2d");
    var A = q("[data-a]", stage), B = q("[data-b]", stage), C = q("[data-c]", stage);
    var dpr = Math.min(window.devicePixelRatio || 1, 2), W = 0, H = 0;
    var size = function () { var r = stage.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; };
    // an icosahedron
    var t = (1 + Math.sqrt(5)) / 2;
    var V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    var Eg = [];
    for (var i = 0; i < 12; i++) for (var j = i + 1; j < 12; j++) {
      var d = Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]);
      if (Math.abs(d - 2) < 0.01) Eg.push([i, j]);
    }
    var T = 0;
    var draw = function (time) {
      if (!W) size();
      var cyc = 9, ph = time % cyc;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // camera haze
      var bg = ctx.createRadialGradient(W * 0.5, H * 0.75, 10, W * 0.5, H * 0.7, W * 0.7);
      bg.addColorStop(0, "rgba(125,42,11,0.35)"); bg.addColorStop(1, "rgba(10,4,2,0)");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      // the floor grid, fading in as the plane is found
      var gridA = clamp(ph / 1.4, 0, 1);
      var hz = H * 0.46, cxp = W * 0.5;
      ctx.strokeStyle = "rgba(250,167,25," + (0.28 * gridA).toFixed(3) + ")";
      ctx.lineWidth = 1;
      for (var k = -8; k <= 8; k++) { ctx.beginPath(); ctx.moveTo(cxp + k * W * 0.02, hz); ctx.lineTo(cxp + k * W * 0.16, H); ctx.stroke(); }
      for (var m = 1; m <= 7; m++) { var y = hz + (H - hz) * Math.pow(m / 7, 1.8); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      A.classList.toggle("is-on", ph > 1.2);
      // the reticle, searching then locking
      var lockT = clamp((ph - 1.6) / 0.6, 0, 1);
      var rx = cxp + Math.sin(time * 1.7) * W * 0.12 * (1 - lockT), ry = H * 0.72 + Math.cos(time * 1.3) * H * 0.04 * (1 - lockT);
      var rr = (W * 0.07) * (1.3 - lockT * 0.4);
      ctx.save(); ctx.translate(rx, ry); ctx.scale(1, 0.38);
      ctx.strokeStyle = "rgba(254,238,207,0.85)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, 6.2832); ctx.stroke();
      ctx.strokeStyle = "rgba(250,167,25,0.9)";
      ctx.beginPath(); ctx.arc(0, 0, rr * 0.55, time * 2, time * 2 + 4); ctx.stroke();
      ctx.restore();
      B.classList.toggle("is-on", lockT >= 1);
      // the hologram
      var s = clamp((ph - 2.3) / 0.8, 0, 1);
      C.classList.toggle("is-on", s >= 1);
      if (s > 0 && ph < cyc - 0.4) {
        var ease = 1 - Math.pow(1 - s, 3), R = W * 0.085 * ease;
        var oy = ry - R * 2.1 - Math.sin(time * 1.6) * 4;
        T += 0.012;
        var ca = Math.cos(time * 0.8), sa = Math.sin(time * 0.8), cb = Math.cos(0.5), sb = Math.sin(0.5);
        var P = V.map(function (v) {
          var x = v[0] * ca - v[2] * sa, z = v[0] * sa + v[2] * ca, yy = v[1];
          var y2 = yy * cb - z * sb, z2 = yy * sb + z * cb;
          var f = 4 / (4 + z2 * 0.35);
          return [rx + x * R * f * 0.62, oy + y2 * R * f * 0.62, z2];
        });
        // shadow on the floor
        ctx.save(); ctx.translate(rx, ry); ctx.scale(1, 0.3);
        var sh = ctx.createRadialGradient(0, 0, 1, 0, 0, R * 1.2);
        sh.addColorStop(0, "rgba(229,125,35," + (0.4 * ease) + ")"); sh.addColorStop(1, "rgba(229,125,35,0)");
        ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, R * 1.2, 0, 6.2832); ctx.fill(); ctx.restore();
        // beam from anchor
        ctx.strokeStyle = "rgba(250,167,25," + (0.25 * ease) + ")";
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx, oy); ctx.stroke();
        ctx.lineWidth = 1.2;
        Eg.forEach(function (e) {
          var a = P[e[0]], b = P[e[1]], back = (a[2] + b[2]) / 2 > 0;
          ctx.strokeStyle = back ? "rgba(254,238,207," + (0.25 * ease) + ")" : "rgba(250,167,25," + (0.95 * ease) + ")";
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        });
        ctx.fillStyle = "rgba(254,238,207," + ease + ")";
        P.forEach(function (p) { if (p[2] <= 0) { ctx.beginPath(); ctx.arc(p[0], p[1], 1.8, 0, 6.2832); ctx.fill(); } });
      }
    };
    window.addEventListener("resize", function () { W = 0; });
    var clock0 = performance.now();
    var lp = Loop(function (now) { draw((now - clock0) / 1000); });
    return { start: lp.start, stop: lp.stop, still: function () { draw(4.5); } };
  };

  // COMMERCE: add to cart, it flies in, the checkout moves on
  SCENES.commerce = function (stage) {
    stage.classList.add("sc-commerce");
    stage.innerHTML =
      '<div class="sc-panel sc-prod"><div class="p-img"></div><i class="p-name"></i><span class="p-price">AED 1,250</span><div class="sc-add">Add to cart</div></div>' +
      '<div class="sc-panel sc-cart"><div class="sc-cart-h"><span class="sc-label">Cart</span><b data-n>0</b></div><div class="sc-lines"></div></div>' +
      '<div class="sc-panel sc-check"><span class="sc-label">Checkout</span><div class="sc-steps"><span class="sc-chip"><i></i>Cart</span><span class="sc-chip"><i></i>Pay</span><span class="sc-chip"><i></i>Done</span></div>' +
      '<span class="sc-bar"><span class="sc-fill"></span></span><div class="sc-orders"><span class="sc-label">Orders today</span><b data-o>128</b></div></div><span class="sc-fly"></span>';
    var add = q(".sc-add", stage), n = q("[data-n]", stage), lines = q(".sc-lines", stage), fly = q(".sc-fly", stage);
    var steps = qa(".sc-steps .sc-chip", stage), fill = q(".sc-fill", stage), ord = q("[data-o]", stage), badge = n;
    var orders = 128;
    var still = function () { n.textContent = "3"; lines.innerHTML = "<i></i><i></i><i></i>"; steps.forEach(function (s) { s.classList.add("is-on"); }); fill.style.setProperty("--p", 1); };
    var shoot = async function (wait) {
      var s = stage.getBoundingClientRect(), a = add.getBoundingClientRect(), b = badge.getBoundingClientRect();
      var x0 = a.left - s.left + a.width / 2, y0 = a.top - s.top, x1 = b.left - s.left + b.width / 2, y1 = b.top - s.top + b.height / 2;
      fly.style.opacity = "1";
      for (var i = 0; i <= 20; i++) {
        var k = i / 20, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * s.height * 0.22;
        fly.style.transform = "translate(" + (x - 7).toFixed(0) + "px," + (y - 7).toFixed(0) + "px) scale(" + (1 - k * 0.4).toFixed(2) + ")";
        await wait(22);
      }
      fly.style.opacity = "0";
    };
    var r = Runner(async function (wait) {
      n.textContent = "0"; lines.innerHTML = ""; steps.forEach(function (s) { s.classList.remove("is-on"); }); fill.style.setProperty("--p", 0);
      await wait(700);
      for (var i = 1; i <= 3; i++) {
        add.classList.add("is-press"); await wait(160); add.classList.remove("is-press");
        await shoot(wait);
        n.textContent = String(i); n.classList.add("is-bump"); lines.appendChild(document.createElement("i"));
        await wait(220); n.classList.remove("is-bump");
        await wait(600);
      }
      steps[0].classList.add("is-on"); fill.style.setProperty("--p", 0.34); await wait(800);
      steps[1].classList.add("is-on"); fill.style.setProperty("--p", 0.67); await wait(900);
      steps[2].classList.add("is-on"); fill.style.setProperty("--p", 1); ord.textContent = String(++orders);
      await wait(2400);
    });
    return { start: r.start, stop: r.stop, still: still };
  };

  // BRAND: the mark is constructed on its grid, then the palette lands
  SCENES.brand = function (stage) {
    stage.classList.add("sc-brand");
    // the real Worx mark (the light logo: cream on the dark bay)
    var W = '<image class="sc-mark" href="../static/assets/worx-logo-light.webp" x="-69" y="-104" width="138" height="190" preserveAspectRatio="xMidYMid meet"/>';
    stage.innerHTML =
      '<svg class="sc-svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" style="height:78%"><g transform="translate(200 128)">' +
      '<circle class="sc-construct" pathLength="1" r="92"/><circle class="sc-construct" pathLength="1" r="64"/><circle class="sc-construct" pathLength="1" cx="-30" cy="0" r="46"/><circle class="sc-construct" pathLength="1" cx="30" cy="0" r="46"/>' +
      '<line class="sc-construct" pathLength="1" x1="-130" y1="0" x2="130" y2="0"/><line class="sc-construct" pathLength="1" x1="0" y1="-110" x2="0" y2="110"/>' +
      '<line class="sc-construct" pathLength="1" x1="-100" y1="-100" x2="100" y2="100"/><line class="sc-construct" pathLength="1" x1="100" y1="-100" x2="-100" y2="100"/>' +
      W + "</g></svg>" +
      '<div class="sc-side"><span class="sc-chip" data-s><i></i>Logo</span><span class="sc-chip" data-s><i></i>Identity</span><span class="sc-chip" data-s><i></i>Guidelines</span></div>' +
      '<div class="sc-panel sc-pal"><span class="sc-label">Palette</span><div class="sc-sw"><i style="background:#c04527"></i><i style="background:#e57d23"></i><i style="background:#faa719"></i><i style="background:#feeecf"></i><i style="background:#421d0f"></i><i style="background:#150905;border:1px solid rgba(254,238,207,.2)"></i></div></div>';
    var cons = qa(".sc-construct", stage), mark = q(".sc-mark", stage), sw = qa(".sc-pal .sc-sw i", stage), chips = qa("[data-s]", stage);
    var all = function (on) {
      cons.forEach(function (c) { c.classList.toggle("is-on", on); });
      mark.classList.toggle("is-on", on);
      sw.forEach(function (s) { s.classList.toggle("is-on", on); }); chips.forEach(function (c) { c.classList.toggle("is-on", on); });
    };
    var r = Runner(async function (wait) {
      all(false); await wait(600);
      for (var i = 0; i < cons.length; i++) { cons[i].classList.add("is-on"); await wait(220); }
      chips[0].classList.add("is-on");
      await wait(500); mark.classList.add("is-on"); await wait(900); chips[1].classList.add("is-on");
      for (var k = 0; k < sw.length; k++) { sw[k].classList.add("is-on"); await wait(140); }
      chips[2].classList.add("is-on");
      await wait(3000);
    });
    return { start: r.start, stop: r.stop, still: function () { all(true); } };
  };

  // MOTION: an actor keyframed across the viewport, the playhead running
  SCENES.motion = function (stage) {
    stage.classList.add("sc-motion");
    var tracks = [
      { keys: [0.05, 0.3, 0.55, 0.8], bar: [0.05, 0.8] },
      { keys: [0.1, 0.42, 0.7], bar: [0.1, 0.7] },
      { keys: [0.2, 0.5, 0.92], bar: [0.2, 0.92] },
    ];
    stage.innerHTML =
      '<div class="sc-panel sc-view"><span class="sc-ground"></span><span class="sc-shadow"></span><span class="sc-actor"></span></div>' +
      '<div class="sc-panel sc-tl"><div class="sc-tl-h"><span class="sc-label">explainer_v3 · 24 fps</span><b data-tc>00:00:00:00</b></div><div class="sc-tracks">' +
      tracks.map(function (t) { return '<div class="sc-track-row"><span style="left:' + t.bar[0] * 100 + "%;right:" + (100 - t.bar[1] * 100) + '%"></span>' + t.keys.map(function (k) { return '<i style="left:' + k * 100 + '%"></i>'; }).join("") + "</div>"; }).join("") +
      '<span class="sc-head"></span></div></div>';
    var actor = q(".sc-actor", stage), shadow = q(".sc-shadow", stage), headEl = q(".sc-head", stage), tcEl = q("[data-tc]", stage), view = q(".sc-view", stage);
    var DUR = 6;
    var frame = function (t) {
      var p = (t % DUR) / DUR;
      var vw = view.clientWidth, vh = view.clientHeight, a = actor.clientWidth;
      var x = 0.06 + p * 0.78;
      var bounce = Math.abs(Math.sin(p * Math.PI * 4));
      var ground = vh * 0.84 - a;
      var y = ground - bounce * vh * 0.42;
      var sq = 1 - (1 - bounce) * 0.28;
      actor.style.transform = "translate(" + (x * vw).toFixed(1) + "px," + y.toFixed(1) + "px) rotate(" + (p * 720).toFixed(0) + "deg) scale(" + (2 - sq).toFixed(2) + "," + sq.toFixed(2) + ")";
      shadow.style.left = (x * 100).toFixed(2) + "%";
      shadow.style.opacity = (0.3 + (1 - bounce) * 0.6).toFixed(2);
      headEl.style.left = (p * 100).toFixed(2) + "%";
      var sec = p * DUR, f = Math.floor((sec % 1) * 24);
      tcEl.textContent = "00:00:" + p2(Math.floor(sec)) + ":" + p2(f);
    };
    var c0 = performance.now();
    var lp = Loop(function (now) { frame((now - c0) / 1000); });
    return { start: lp.start, stop: lp.stop, still: function () { frame(DUR * 0.37); } };
  };

  // COPY: the line is written, a word struck and bettered
  SCENES.copy = function (stage) {
    stage.classList.add("sc-copy");
    stage.innerHTML =
      '<div class="sc-panel sc-doc"><span class="sc-label">Homepage · hero</span><div class="sc-lines-t" style="margin-top:14px"><p data-l1></p><p data-l2></p></div><div class="sc-ghost-lines"><i style="width:92%"></i><i style="width:80%"></i><i style="width:86%"></i><i style="width:60%"></i></div></div>' +
      '<div class="sc-panel sc-meter"><div><span class="sc-label">Readability</span><span class="sc-bar"><span class="sc-fill"></span></span><b data-g>—</b></div>' +
      '<div><span class="sc-label">Voice</span><span class="sc-chip" data-v><i></i>Confident</span><span class="sc-chip" data-v><i></i>Clear</span></div>' +
      '<div><span class="sc-label">Language</span><span class="sc-chip" data-v><i></i>EN · AR</span></div></div>';
    var l1 = q("[data-l1]", stage), l2 = q("[data-l2]", stage), fill = q(".sc-fill", stage), g = q("[data-g]", stage), vs = qa("[data-v]", stage);
    var caret = '<i class="sc-caret"></i>';
    var A = "We build websites.", B = "Fast to load. Easy to find. Hard to forget.";
    var still = function () { l1.innerHTML = "We build <del>websites</del> <ins>digital that Worx.</ins>"; l2.textContent = B; fill.style.setProperty("--p", 0.9); g.textContent = "Grade 7 · easy"; vs.forEach(function (v) { v.classList.add("is-on"); }); };
    var r = Runner(async function (wait) {
      l1.innerHTML = ""; l2.innerHTML = ""; fill.style.setProperty("--p", 0); g.textContent = "—"; vs.forEach(function (v) { v.classList.remove("is-on"); });
      await wait(500);
      for (var c = 1; c <= A.length; c++) { l1.innerHTML = A.slice(0, c) + caret; await wait(55 + Math.random() * 40); }
      await wait(700);
      l1.innerHTML = "We build <del>websites.</del>" + caret; await wait(600);
      var R = "digital that Worx.";
      for (var k = 1; k <= R.length; k++) { l1.innerHTML = "We build <del>websites.</del> <ins>" + R.slice(0, k) + "</ins>" + caret; await wait(60); }
      l1.innerHTML = "We build <del>websites.</del> <ins>" + R + "</ins>";
      fill.style.setProperty("--p", 0.5); vs[0].classList.add("is-on");
      await wait(400);
      for (var m = 1; m <= B.length; m++) { l2.innerHTML = B.slice(0, m) + caret; await wait(42); }
      l2.textContent = B;
      fill.style.setProperty("--p", 0.9); g.textContent = "Grade 7 · easy"; vs[1].classList.add("is-on"); vs[2].classList.add("is-on");
      await wait(3200);
    });
    return { start: r.start, stop: r.stop, still: still };
  };

  // AI: the assistant answers and books, the network lighting as it thinks
  SCENES.ai = function (stage) {
    stage.classList.add("sc-ai");
    var nodes = [], edges = "";
    [[20, [25, 50, 75]], [50, [15, 38, 62, 85]], [80, [30, 70]]].forEach(function (col, ci) {
      col[1].forEach(function (y) { nodes.push({ x: col[0], y: y, c: ci }); });
    });
    nodes.forEach(function (a, i) { nodes.forEach(function (b, j) { if (b.c === a.c + 1) edges += '<line class="ne" data-e="' + i + "-" + j + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>'; }); });
    stage.innerHTML =
      '<div class="sc-panel sc-chat"></div>' +
      '<div class="sc-panel sc-brain"><span class="sc-label">Model</span><svg viewBox="0 0 100 100">' + edges + nodes.map(function (n, i) { return '<circle class="nn" data-n="' + i + '" cx="' + n.x + '" cy="' + n.y + '" r="4"/>'; }).join("") + "</svg>" +
      '<span class="sc-chip" data-c><i></i>Intent · pricing</span><span class="sc-chip" data-c><i></i>Calendar · synced</span><span class="sc-chip is-on"><i></i>24 / 7</span></div>';
    var chat = q(".sc-chat", stage), ns = qa(".nn", stage), es = qa(".ne", stage), cs = qa("[data-c]", stage);
    var think = null;
    var brain = function (on) {
      clearInterval(think);
      if (!on) { ns.concat(es).forEach(function (e) { e.classList.remove("is-on"); }); return; }
      think = setInterval(function () {
        ns.concat(es).forEach(function (e) { e.classList.toggle("is-on", Math.random() < 0.35); });
      }, 160);
    };
    var say = function (who, html) { var m = document.createElement("div"); m.className = "sc-msg " + who; m.innerHTML = html; chat.appendChild(m); while (chat.children.length > 5) chat.removeChild(chat.firstChild); return m; };
    var CONVO = [
      ["u", "Which plan suits a 20-person team?"],
      ["a", "The Growth plan: shared inboxes, 20 seats and priority support. Want me to book a demo?"],
      ["u", "Yes, Thursday morning works."],
      ["a", "Booked for Thursday at 11:00. The invite is on its way."],
    ];
    var still = function () { chat.innerHTML = ""; CONVO.forEach(function (c) { say(c[0], c[1]); }); cs.forEach(function (c) { c.classList.add("is-on"); }); };
    var r = Runner(async function (wait) {
      chat.innerHTML = ""; cs.forEach(function (c) { c.classList.remove("is-on"); });
      await wait(600);
      for (var i = 0; i < CONVO.length; i++) {
        var c = CONVO[i];
        if (c[0] === "a") {
          var t = say("a", '<span class="sc-typing"><i></i><i></i><i></i></span>');
          brain(true); await wait(1300); brain(false);
          t.textContent = c[1];
          if (i === 1) cs[0].classList.add("is-on");
          if (i === 3) cs[1].classList.add("is-on");
        } else say("u", c[1]);
        await wait(1300);
      }
      await wait(2600);
    });
    return { start: r.start, stop: function () { r.stop(); brain(false); }, still: still };
  };

  // CREW: specialists leave the roster and dock into the squad
  SCENES.crew = function (stage) {
    stage.classList.add("sc-crew");
    var ROLES = ["Scrum master", "QA engineer", "React developer", "Node developer", ".NET developer", "Mobile developer"];
    stage.innerHTML =
      '<div class="sc-panel sc-roster"><span class="sc-label">Vetted roster</span>' + ROLES.map(function (r) { return '<div class="sc-role"><i></i>' + r + "</div>"; }).join("") + "</div>" +
      '<div class="sc-panel sc-squad"><span class="sc-label">Your squad</span><div class="sc-seats">' + ROLES.map(function () { return '<div class="sc-seat"><i></i><span>Open seat</span></div>'; }).join("") + '</div><div class="sc-squad-f"><span class="sc-label">Onboarding</span><b data-d>Day 0</b></div></div>';
    var roles = qa(".sc-role", stage), seats = qa(".sc-seat", stage), day = q("[data-d]", stage);
    var fill = function (i) { roles[i].classList.add("is-sent"); seats[i].classList.add("is-on"); q("span", seats[i]).textContent = ROLES[i]; };
    var clear = function () { roles.forEach(function (r) { r.classList.remove("is-sent"); }); seats.forEach(function (s) { s.classList.remove("is-on"); q("span", s).textContent = "Open seat"; }); };
    var still = function () { ROLES.forEach(function (_, i) { fill(i); }); day.textContent = "Day 3 · squad online"; };
    var r = Runner(async function (wait) {
      clear(); day.textContent = "Day 0"; await wait(700);
      for (var i = 0; i < ROLES.length; i++) { fill(i); day.textContent = "Day " + Math.min(3, Math.ceil((i + 1) / 2)); await wait(700); }
      day.textContent = "Day 3 · squad online";
      await wait(3000);
    });
    return { start: r.start, stop: r.stop, still: still };
  };

  // CLOUD: the racks go dark one by one as their work moves into orbit
  SCENES.cloud = function (stage) {
    stage.classList.add("sc-cloud");
    var R = [{ x: 170, y: 70, l: "AWS · ME" }, { x: 260, y: 48, l: "AZURE · UAE" }, { x: 340, y: 84, l: "EDGE" }];
    stage.innerHTML =
      '<svg class="sc-svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" style="height:62%"><ellipse class="sc-orbit" cx="255" cy="70" rx="120" ry="40"/>' +
      R.map(function (r, i) { return '<path class="sc-beam" data-b="' + i + '" pathLength="1" d="M70 280 C 90 180, ' + (r.x - 40) + " 140, " + r.x + " " + r.y + '"/>'; }).join("") +
      R.map(function (r, i) { return '<g><circle class="sc-region" data-r="' + i + '" cx="' + r.x + '" cy="' + r.y + '" r="16"/><text class="sc-region-t" x="' + r.x + '" y="' + (r.y - 24) + '">' + r.l + "</text></g>"; }).join("") +
      "</svg>" +
      '<div class="sc-panel sc-racks"><span class="sc-label">On-premise</span><i></i><i></i><i></i><i></i><i></i></div>' +
      '<div class="sc-panel sc-mig"><div class="sc-mig-h"><span class="sc-label">Migration</span><b data-p>0%</b></div><span class="sc-bar"><span class="sc-fill"></span></span>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap"><span class="sc-chip" data-c><i></i>Rollback ready</span><span class="sc-chip" data-c><i></i>Encrypted</span><span class="sc-chip" data-c><i></i>Auto-scaling</span></div></div>';
    var racks = qa(".sc-racks i", stage), beams = qa(".sc-beam", stage), regs = qa(".sc-region", stage), fill = q(".sc-fill", stage), pct = q("[data-p]", stage), cs = qa("[data-c]", stage);
    var set = function (p) { fill.style.setProperty("--p", p); pct.textContent = Math.round(p * 100) + "%"; };
    var reset = function () { racks.forEach(function (r) { r.classList.remove("is-gone"); }); beams.forEach(function (b) { b.classList.remove("is-on"); }); regs.forEach(function (r) { r.classList.remove("is-on"); }); cs.forEach(function (c) { c.classList.remove("is-on"); }); set(0); };
    var still = function () { racks.forEach(function (r) { r.classList.add("is-gone"); }); beams.forEach(function (b) { b.style.strokeDashoffset = 0; }); regs.forEach(function (r) { r.classList.add("is-on"); }); cs.forEach(function (c) { c.classList.add("is-on"); }); set(1); };
    var r = Runner(async function (wait) {
      reset(); await wait(700);
      cs[0].classList.add("is-on");
      for (var i = 0; i < racks.length; i++) {
        var k = i % R.length;
        beams[k].classList.remove("is-on"); void beams[k].getBoundingClientRect(); beams[k].classList.add("is-on");
        await wait(700);
        regs[k].classList.add("is-on"); racks[i].classList.add("is-gone");
        set((i + 1) / racks.length);
        if (i === 2) cs[1].classList.add("is-on");
        await wait(400);
      }
      cs[2].classList.add("is-on");
      await wait(3000);
    });
    return { start: r.start, stop: r.stop, still: still };
  };

  // mount the bay's instrument; it plays only while it's on screen
  var sceneEl = q("[data-sd-scene]");
  if (sceneEl) {
    var stage = q(".sd-scene-stage", sceneEl);
    var make = SCENES[sceneEl.getAttribute("data-sd-scene")];
    if (make && stage) {
      var inst = make(stage);
      if (reduced) inst.still();
      else if (io) {
        new IntersectionObserver(function (en) { en[0].isIntersecting && !document.hidden ? inst.start() : inst.stop(); }, { threshold: 0.15 }).observe(sceneEl);
        document.addEventListener("visibilitychange", function () { if (document.hidden) inst.stop(); else if (sceneEl.getBoundingClientRect().top < window.innerHeight) inst.start(); });
      } else inst.start();
    }
  }

  /* ----------------------------------------------------------
     2. The bay's backdrop: one cinematic motif per service, drawn
     on a canvas behind the bay in the brand's ember light (CSS adds
     the moving light, the grain and the vignette). It runs only while
     the bay is on screen.
     ---------------------------------------------------------- */
  var AMB = "250,167,25", ORA = "229,125,35", EMB = "192,69,39", CRM = "254,238,207";
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var BACKDROPS = {};

  // WEB: code rain, the glyphs of a build falling in columns
  BACKDROPS.web = function (ctx, W, H) {
    var G = "01{}<>/=;:()[]constletawaitbuildshipfunctionreturn", step = 18, cols = [];
    for (var x = 0; x < W; x += step) cols.push({ x: x, y: rnd(-H, H), v: rnd(30, 90), len: (rnd(8, 26)) | 0, ch: [] });
    ctx.font = "500 13px 'JetBrains Mono', monospace";
    return function (t, dt) {
      ctx.clearRect(0, 0, W, H);
      cols.forEach(function (c) {
        c.y += c.v * dt;
        if (c.y - c.len * step > H) { c.y = rnd(-200, 0); c.v = rnd(30, 90); }
        if (Math.random() < 0.08 || !c.ch.length) c.ch = Array.from({ length: c.len }, function () { return G.charAt((Math.random() * G.length) | 0); });
        for (var i = 0; i < c.len; i++) {
          var y = c.y - i * step;
          if (y < -step || y > H + step) continue;
          var a = i === 0 ? 0.9 : (1 - i / c.len) * 0.32;
          ctx.fillStyle = i === 0 ? "rgba(" + CRM + "," + a + ")" : "rgba(" + (i < 3 ? AMB : ORA) + "," + a + ")";
          ctx.fillText(c.ch[i], c.x, y);
        }
      });
    };
  };

  // COMMERCE: warm bokeh rising, like light off a shop window at night
  BACKDROPS.commerce = function (ctx, W, H) {
    var P = [];
    for (var i = 0; i < 70; i++) P.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(3, 34), v: rnd(6, 26), ph: rnd(0, 6.28), c: [AMB, ORA, EMB][(Math.random() * 3) | 0] });
    return function (t, dt) {
      ctx.clearRect(0, 0, W, H);
      P.forEach(function (p) {
        p.y -= p.v * dt;
        if (p.y < -p.r * 2) { p.y = H + p.r; p.x = rnd(0, W); }
        var a = (0.1 + 0.12 * Math.sin(t * 0.8 + p.ph)) * (p.r > 20 ? 0.7 : 1);
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, "rgba(" + p.c + "," + (a * 1.6).toFixed(3) + ")");
        g.addColorStop(0.65, "rgba(" + p.c + "," + a.toFixed(3) + ")");
        g.addColorStop(1, "rgba(" + p.c + ",0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      });
    };
  };

  // PLATFORM: a drifting constellation of systems, packets on the links
  BACKDROPS.platform = function (ctx, W, H) {
    var N = [], D = Math.min(170, W * 0.16), pk = [];
    for (var i = 0; i < Math.round(W * H / 18000); i++) N.push({ x: rnd(0, W), y: rnd(0, H), vx: rnd(-8, 8), vy: rnd(-6, 6) });
    return function (t, dt) {
      ctx.clearRect(0, 0, W, H);
      N.forEach(function (n) { n.x += n.vx * dt; n.y += n.vy * dt; if (n.x < 0 || n.x > W) n.vx *= -1; if (n.y < 0 || n.y > H) n.vy *= -1; });
      ctx.lineWidth = 1;
      for (var i = 0; i < N.length; i++) for (var j = i + 1; j < N.length; j++) {
        var dx = N[i].x - N[j].x, dy = N[i].y - N[j].y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < D) {
          ctx.strokeStyle = "rgba(" + ORA + "," + ((1 - d / D) * 0.28).toFixed(3) + ")";
          ctx.beginPath(); ctx.moveTo(N[i].x, N[i].y); ctx.lineTo(N[j].x, N[j].y); ctx.stroke();
          if (Math.random() < 0.0015 && pk.length < 30) pk.push({ a: N[i], b: N[j], k: 0 });
        }
      }
      N.forEach(function (n) { ctx.fillStyle = "rgba(" + CRM + ",0.5)"; ctx.fillRect(n.x - 1, n.y - 1, 2, 2); });
      for (var k = pk.length - 1; k >= 0; k--) {
        var p = pk[k]; p.k += dt * 0.8;
        if (p.k >= 1) { pk.splice(k, 1); continue; }
        var x = p.a.x + (p.b.x - p.a.x) * p.k, y = p.a.y + (p.b.y - p.a.y) * p.k;
        ctx.fillStyle = "rgba(" + AMB + ",0.95)"; ctx.shadowColor = "rgba(" + AMB + ",1)"; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(x, y, 2, 0, 6.2832); ctx.fill(); ctx.shadowBlur = 0;
      }
    };
  };

  // ERP: data lanes, records streaming between departments in sync
  BACKDROPS.erp = function (ctx, W, H) {
    var L = [], gap = 26;
    for (var y = gap; y < H; y += gap) L.push({ y: y, v: rnd(40, 140) * (Math.random() < 0.5 ? 1 : -1), o: rnd(0, 400), rec: [] });
    return function (t, dt) {
      ctx.clearRect(0, 0, W, H);
      L.forEach(function (l, li) {
        l.o += l.v * dt;
        ctx.strokeStyle = "rgba(" + CRM + ",0.07)"; ctx.setLineDash([2, 10]); ctx.lineDashOffset = -l.o;
        ctx.beginPath(); ctx.moveTo(0, l.y); ctx.lineTo(W, l.y); ctx.stroke();
        if (Math.random() < 0.012) l.rec.push({ x: l.v > 0 ? -60 : W + 60, w: rnd(20, 70) });
        ctx.setLineDash([]);
        l.rec = l.rec.filter(function (r) {
          r.x += l.v * dt * 1.6;
          var g = ctx.createLinearGradient(r.x - r.w * Math.sign(l.v), 0, r.x, 0);
          g.addColorStop(0, "rgba(" + EMB + ",0)"); g.addColorStop(1, "rgba(" + AMB + ",0.8)");
          ctx.strokeStyle = g; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(r.x - r.w * Math.sign(l.v), l.y); ctx.lineTo(r.x, l.y); ctx.stroke(); ctx.lineWidth = 1;
          return r.x > -100 && r.x < W + 100;
        });
      });
      // a sync pulse sweeping down the lanes
      var sy = (t * 120) % (H + 200) - 100;
      var sg = ctx.createLinearGradient(0, sy - 80, 0, sy);
      sg.addColorStop(0, "rgba(" + ORA + ",0)"); sg.addColorStop(1, "rgba(" + ORA + ",0.08)");
      ctx.fillStyle = sg; ctx.fillRect(0, sy - 80, W, 80);
    };
  };

  // MOBILE: a wall of app tiles scrolling past, a few lighting up
  BACKDROPS.mobile = function (ctx, W, H) {
    var S = 64, g = 18, cols = Math.ceil(W / (S + g)) + 1, rows = Math.ceil(H / (S + g)) + 2, lit = {};
    var rr = function (x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
    return function (t) {
      ctx.clearRect(0, 0, W, H);
      var off = (t * 18) % (S + g);
      if (Math.random() < 0.05) lit[((Math.random() * cols) | 0) + "," + ((Math.random() * (rows + 40)) | 0)] = t;
      for (var c = 0; c < cols; c++) for (var r = 0; r < rows; r++) {
        var row = r + Math.floor(t * 18 / (S + g));
        var x = c * (S + g) - (row % 2) * (S + g) / 2, y = r * (S + g) - off;
        var key = c + "," + (row % (rows + 40)), l = lit[key], a = 0.05;
        if (l != null) { var k = t - l; a = k < 2.5 ? 0.05 + 0.4 * Math.sin((k / 2.5) * Math.PI) : 0.05; if (k > 2.5) delete lit[key]; }
        rr(x, y, S, S, 16);
        ctx.strokeStyle = "rgba(" + CRM + "," + (0.07).toFixed(3) + ")"; ctx.stroke();
        if (a > 0.06) { ctx.fillStyle = "rgba(" + ORA + "," + a.toFixed(3) + ")"; ctx.fill(); }
      }
    };
  };

  // DESIGN: the blueprint, guides sweeping and a crosshair snapping
  BACKDROPS.design = function (ctx, W, H) {
    var tx = W * 0.7, ty = H * 0.4, cx = tx, cy = ty, next = 0;
    return function (t, dt) {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      for (var x = 0; x < W; x += 24) { ctx.strokeStyle = "rgba(" + CRM + "," + (x % 120 === 0 ? 0.08 : 0.03) + ")"; ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
      for (var y = 0; y < H; y += 24) { ctx.strokeStyle = "rgba(" + CRM + "," + (y % 120 === 0 ? 0.08 : 0.03) + ")"; ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
      if (t > next) { next = t + rnd(1.6, 2.6); tx = Math.round(rnd(W * 0.35, W * 0.95) / 24) * 24; ty = Math.round(rnd(H * 0.15, H * 0.85) / 24) * 24; }
      cx += (tx - cx) * Math.min(1, dt * 4); cy += (ty - cy) * Math.min(1, dt * 4);
      ctx.strokeStyle = "rgba(" + AMB + ",0.5)"; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(cx + 0.5, 0); ctx.lineTo(cx + 0.5, H); ctx.moveTo(0, cy + 0.5); ctx.lineTo(W, cy + 0.5); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(" + AMB + ",0.9)"; ctx.strokeRect(cx - 8, cy - 8, 16, 16);
      ctx.fillStyle = "rgba(" + AMB + ",0.8)"; ctx.font = "500 10px 'JetBrains Mono', monospace";
      ctx.fillText("x " + Math.round(cx) + "  y " + Math.round(cy), cx + 14, cy - 12);
      // rulers
      ctx.fillStyle = "rgba(" + CRM + ",0.25)";
      for (var r = 0; r < W; r += 12) ctx.fillRect(r, 0, 1, r % 120 === 0 ? 10 : 4);
      for (var s = 0; s < H; s += 12) ctx.fillRect(W - (s % 120 === 0 ? 10 : 4), s, 10, 1);
    };
  };

  // BRAND: vast construction circles turning slowly behind the bay
  BACKDROPS.brand = function (ctx, W, H) {
    var cx = W * 0.72, cy = H * 0.5, R = Math.max(W, H) * 0.5;
    return function (t) {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      var phi = 1.618;
      for (var i = 0; i < 9; i++) {
        var r = R / Math.pow(phi, i * 0.55);
        ctx.strokeStyle = "rgba(" + (i % 3 === 0 ? AMB : CRM) + "," + (i % 3 === 0 ? 0.16 : 0.07) + ")";
        ctx.setLineDash(i % 2 ? [2, 8] : []);
        ctx.beginPath(); ctx.arc(cx + Math.cos(t * 0.05 + i) * r * 0.08, cy + Math.sin(t * 0.05 + i) * r * 0.08, r, 0, 6.2832); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.03);
      for (var k = 0; k < 12; k++) {
        ctx.rotate(Math.PI / 6);
        ctx.strokeStyle = "rgba(" + CRM + ",0.05)";
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R * 1.2, 0); ctx.stroke();
      }
      // a golden spiral, drawn and undrawn
      var draw = (Math.sin(t * 0.35) + 1) / 2;
      ctx.strokeStyle = "rgba(" + AMB + ",0.45)"; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (var a = 0; a < 5.5 * Math.PI * draw; a += 0.05) {
        var rr = 4 * Math.pow(1.19, a * 1.2);
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.stroke(); ctx.restore();
    };
  };

  // MOTION: long-exposure streaks racing across the frame
  BACKDROPS.motion = function (ctx, W, H) {
    var S = [];
    for (var i = 0; i < 46; i++) S.push({ y: rnd(0, H), x: rnd(0, W), v: rnd(120, 520), len: rnd(80, 360), w: rnd(0.6, 2.2), c: [AMB, ORA, EMB, CRM][(Math.random() * 4) | 0] });
    return function (t, dt) {
      ctx.clearRect(0, 0, W, H);
      S.forEach(function (s) {
        s.x += s.v * dt;
        if (s.x - s.len > W) { s.x = rnd(-400, 0); s.y = rnd(0, H); }
        var g = ctx.createLinearGradient(s.x - s.len, 0, s.x, 0);
        g.addColorStop(0, "rgba(" + s.c + ",0)"); g.addColorStop(1, "rgba(" + s.c + "," + (s.c === CRM ? 0.35 : 0.55) + ")");
        ctx.strokeStyle = g; ctx.lineWidth = s.w;
        ctx.beginPath(); ctx.moveTo(s.x - s.len, s.y); ctx.lineTo(s.x, s.y); ctx.stroke();
      });
      // a frame counter ticking in the corner of the film
      ctx.fillStyle = "rgba(" + CRM + ",0.18)"; ctx.font = "500 10px 'JetBrains Mono', monospace";
      ctx.fillText("FRAME " + ("0000" + Math.floor(t * 24)).slice(-5), W - 130, H - 24);
    };
  };

  // COPY: huge, faint words drifting, one being written
  BACKDROPS.copy = function (ctx, W, H) {
    var WORDS = ["clarity", "voice", "story", "sell", "tone", "كلمة", "promise", "headline", "brand", "why", "rhythm", "صوت"];
    var P = WORDS.map(function (w, i) { return { w: w, x: rnd(0, W), y: rnd(H * 0.1, H), s: rnd(40, 140), v: rnd(4, 14) * (i % 2 ? 1 : -1), a: rnd(0.03, 0.08) }; });
    return function (t, dt) {
      ctx.clearRect(0, 0, W, H);
      P.forEach(function (p) {
        p.x += p.v * dt;
        ctx.font = "700 " + p.s + "px Jost, sans-serif";
        var w = ctx.measureText(p.w).width;
        if (p.x > W + 40) p.x = -w; if (p.x < -w - 40) p.x = W;
        ctx.fillStyle = "rgba(" + CRM + "," + p.a + ")";
        ctx.fillText(p.w, p.x, p.y);
      });
      // one word being typed, bright, with its caret
      var hero = "make it matter.", n = Math.floor((t * 7) % (hero.length + 14));
      var txt = hero.slice(0, Math.min(n, hero.length));
      ctx.font = "600 34px Jost, sans-serif";
      var x0 = W * 0.6, y0 = H * 0.9;
      ctx.fillStyle = "rgba(" + AMB + ",0.3)"; ctx.fillText(txt, x0, y0);
      if (Math.floor(t * 2) % 2) { var tw = ctx.measureText(txt).width; ctx.fillRect(x0 + tw + 4, y0 - 28, 3, 34); }
    };
  };

  // AI: a field of neurons, waves of thought passing through it
  BACKDROPS.ai = function (ctx, W, H) {
    var S = 34;
    return function (t) {
      ctx.clearRect(0, 0, W, H);
      var cx1 = W * (0.6 + 0.2 * Math.sin(t * 0.3)), cy1 = H * (0.5 + 0.3 * Math.cos(t * 0.23));
      for (var x = S / 2; x < W; x += S) for (var y = S / 2; y < H; y += S) {
        var d = Math.hypot(x - cx1, y - cy1);
        var w = Math.sin(d * 0.03 - t * 2.2) * 0.5 + 0.5;
        var k = Math.pow(w, 6) * Math.max(0, 1 - d / (W * 0.8));
        var r = 1 + k * 2.4;
        ctx.fillStyle = k > 0.25 ? "rgba(" + AMB + "," + (0.2 + k * 0.7).toFixed(3) + ")" : "rgba(" + CRM + ",0.1)";
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
        if (k > 0.55) {
          ctx.strokeStyle = "rgba(" + ORA + "," + (k * 0.35).toFixed(3) + ")";
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + S, y + (Math.sin(x + t) > 0 ? S : -S)); ctx.stroke();
        }
      }
    };
  };

  // XR: a holodeck floor rushing toward you, a horizon of light
  BACKDROPS.xr = function (ctx, W, H) {
    return function (t) {
      ctx.clearRect(0, 0, W, H);
      var hz = H * 0.52, vp = W * 0.66;
      var gl = ctx.createLinearGradient(0, hz - 60, 0, hz + 40);
      gl.addColorStop(0, "rgba(" + ORA + ",0)"); gl.addColorStop(0.6, "rgba(" + ORA + ",0.18)"); gl.addColorStop(1, "rgba(" + ORA + ",0)");
      ctx.fillStyle = gl; ctx.fillRect(0, hz - 60, W, 100);
      ctx.lineWidth = 1;
      for (var k = -24; k <= 24; k++) {
        ctx.strokeStyle = "rgba(" + AMB + ",0.16)";
        ctx.beginPath(); ctx.moveTo(vp + k * 14, hz); ctx.lineTo(vp + k * W * 0.12, H); ctx.stroke();
      }
      var off = (t * 0.6) % 1;
      for (var i = 0; i < 16; i++) {
        var z = (i + off) / 16, y = hz + (H - hz) * Math.pow(z, 2.2);
        ctx.strokeStyle = "rgba(" + AMB + "," + (0.04 + z * 0.22).toFixed(3) + ")";
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      // the ceiling, mirrored and fainter
      for (var j = 0; j < 10; j++) {
        var zz = (j + off) / 10, yy = hz - (hz) * Math.pow(zz, 2.2) * 0.9;
        ctx.strokeStyle = "rgba(" + CRM + "," + (zz * 0.05).toFixed(3) + ")";
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
      }
    };
  };

  // CREW: a hive of cells, squads forming and lighting together
  BACKDROPS.crew = function (ctx, W, H) {
    var R = 30, hw = Math.sqrt(3) * R, cells = [], teams = [];
    for (var y = 0, r = 0; y < H + R * 2; y += R * 1.5, r++) for (var x = (r % 2) * hw / 2; x < W + hw; x += hw) cells.push({ x: x, y: y, a: 0 });
    var hex = function (x, y) { ctx.beginPath(); for (var i = 0; i < 6; i++) { var a = Math.PI / 3 * i + Math.PI / 6; ctx.lineTo(x + Math.cos(a) * (R - 2), y + Math.sin(a) * (R - 2)); } ctx.closePath(); };
    return function (t, dt) {
      ctx.clearRect(0, 0, W, H);
      if (Math.random() < 0.03) { var c = cells[(Math.random() * cells.length) | 0]; teams.push({ c: c, t0: t }); }
      cells.forEach(function (c) { c.a *= 0.96; });
      teams = teams.filter(function (tm) {
        var k = t - tm.t0;
        cells.forEach(function (c) { var d = Math.hypot(c.x - tm.c.x, c.y - tm.c.y); if (d < hw * 1.1 && k < 2.2) c.a = Math.max(c.a, 0.5 * Math.sin(Math.min(1, k / 2.2) * Math.PI)); });
        return k < 2.4;
      });
      cells.forEach(function (c) {
        hex(c.x, c.y);
        ctx.strokeStyle = "rgba(" + CRM + ",0.06)"; ctx.stroke();
        if (c.a > 0.02) { ctx.fillStyle = "rgba(" + ORA + "," + c.a.toFixed(3) + ")"; ctx.fill(); ctx.strokeStyle = "rgba(" + AMB + "," + c.a.toFixed(3) + ")"; ctx.stroke(); }
      });
    };
  };

  // CLOUD: slow volumes of warm vapour, data rising through them
  BACKDROPS.cloud = function (ctx, W, H) {
    var B = [], D = [];
    for (var i = 0; i < 14; i++) B.push({ x: rnd(0, W), y: rnd(H * 0.1, H * 0.9), r: rnd(120, 320), v: rnd(6, 20), c: [ORA, EMB, AMB][i % 3] });
    for (var k = 0; k < 60; k++) D.push({ x: rnd(0, W), y: rnd(0, H), v: rnd(20, 70) });
    return function (t, dt) {
      ctx.clearRect(0, 0, W, H);
      B.forEach(function (b) {
        b.x += b.v * dt; if (b.x - b.r > W) b.x = -b.r;
        var g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, "rgba(" + b.c + ",0.1)"); g.addColorStop(1, "rgba(" + b.c + ",0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.fill();
      });
      D.forEach(function (d) {
        d.y -= d.v * dt; if (d.y < -10) { d.y = H + 10; d.x = rnd(0, W); }
        ctx.fillStyle = "rgba(" + AMB + ",0.5)"; ctx.fillRect(d.x, d.y, 1.5, 6);
      });
    };
  };

  // SEO: a signal broadcasting from the tower, a radar sweep finding you
  BACKDROPS.seo = function (ctx, W, H) {
    var cx = W * 0.74, cy = H * 0.52, R = Math.max(W, H) * 0.7, blips = [];
    return function (t, dt) {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      for (var i = 1; i <= 8; i++) { ctx.strokeStyle = "rgba(" + CRM + ",0.05)"; ctx.beginPath(); ctx.arc(cx, cy, i * R / 8, 0, 6.2832); ctx.stroke(); }
      for (var k = 0; k < 3; k++) {
        var r = ((t * 90 + k * R / 3) % R);
        ctx.strokeStyle = "rgba(" + AMB + "," + (0.35 * (1 - r / R)).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.stroke();
      }
      var a = t * 0.9;
      var sg = ctx.createConicGradient ? ctx.createConicGradient(a - 0.6, cx, cy) : null;
      if (sg) {
        sg.addColorStop(0, "rgba(" + ORA + ",0)"); sg.addColorStop(0.09, "rgba(" + ORA + ",0.16)"); sg.addColorStop(0.1, "rgba(" + ORA + ",0)"); sg.addColorStop(1, "rgba(" + ORA + ",0)");
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();
      }
      if (Math.random() < 0.04) blips.push({ a: a + rnd(-0.05, 0.05), r: rnd(R * 0.1, R * 0.8), t0: t });
      blips = blips.filter(function (b) {
        var k = t - b.t0; if (k > 2.5) return false;
        ctx.fillStyle = "rgba(" + AMB + "," + (0.9 * (1 - k / 2.5)).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(cx + Math.cos(b.a) * b.r, cy + Math.sin(b.a) * b.r, 2.5, 0, 6.2832); ctx.fill();
        return true;
      });
      ctx.fillStyle = "rgba(" + AMB + ",1)"; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 6.2832); ctx.fill();
    };
  };

  var heroBg = q("[data-sd-bg]", root), bgCanvas = heroBg && q(".sd-bg", heroBg);
  if (bgCanvas && BACKDROPS[heroBg.getAttribute("data-sd-bg")]) (function () {
    var kind = heroBg.getAttribute("data-sd-bg");
    var bctx = bgCanvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5), W = 0, H = 0, draw = null;
    var setup = function () {
      var r = heroBg.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      bgCanvas.width = W * dpr; bgCanvas.height = H * dpr;
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw = BACKDROPS[kind](bctx, W, H);
    };
    setup();
    var c0 = performance.now();
    var lp = Loop(function (now, dt) { draw((now - c0) / 1000, dt); });
    if (reduced) { for (var i = 0; i < 90; i++) draw(i / 30, 1 / 30); }
    else if (io) {
      new IntersectionObserver(function (en) { en[0].isIntersecting && !document.hidden ? lp.start() : lp.stop(); }).observe(heroBg);
      document.addEventListener("visibilitychange", function () { if (document.hidden) lp.stop(); else if (heroBg.getBoundingClientRect().bottom > 0) lp.start(); });
    } else lp.start();
    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(setup, 200); });
    // the backdrop drifts and dims as you leave the bay
    var tick = false;
    window.addEventListener("scroll", function () {
      if (tick || reduced) return; tick = true;
      requestAnimationFrame(function () {
        tick = false;
        var k = clamp(window.scrollY / Math.max(1, H), 0, 1);
        bgCanvas.style.transform = "translateY(" + (k * H * 0.25).toFixed(1) + "px)";
        bgCanvas.style.opacity = (1 - k * 0.9).toFixed(3);
      });
    }, { passive: true });
  })();

  /* ----------------------------------------------------------
     3. Boot-ins, limbs, the systems' pointer light
     ---------------------------------------------------------- */
  qa("[data-sd-in]").forEach(function (el) {
    whenSeen(el, function () {
      el.classList.add("is-in");
      var id = q("[data-sd-scr]", el);
      if (id) scramble(id, id.__t || (id.__t = id.textContent), 520);
    });
  });
  qa("[data-sd-limb]").forEach(function (l) { whenSeen(l, function () { l.classList.add("is-in"); }, { threshold: 0.4 }); });

  qa(".sd-sys-card").forEach(function (card) {
    var id = q("[data-sd-scr]", card);
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (e.clientX - r.left) + "px");
      card.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
    card.addEventListener("pointerenter", function () { if (id) scramble(id, id.__t || (id.__t = id.textContent), 380); });
  });

  /* ----------------------------------------------------------
     4. The mission logs on film
     ---------------------------------------------------------- */
  var tc = function (sec) {
    return p2(Math.floor(sec / 3600)) + ":" + p2(Math.floor(sec / 60) % 60) + ":" + p2(Math.floor(sec) % 60) + ":" + p2(Math.floor((sec % 1) * 24));
  };
  var vids = qa(".sd-video");
  vids.forEach(function (v) {
    var screen = v.closest(".sd-screen"), tcEl = q(".sd-tc", screen);
    v.addEventListener("playing", function () { v.classList.add("is-playing"); screen.classList.add("is-live"); });
    v.addEventListener("pause", function () { screen.classList.remove("is-live"); });
    v.addEventListener("timeupdate", function () { tcEl.textContent = tc(v.currentTime); });
  });
  if (!reduced && io && vids.length) {
    var vio = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (!v.src && v.dataset.src) { v.src = v.dataset.src; v.preload = "auto"; }
          if (!document.hidden) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
        } else if (!v.paused) v.pause();
      });
    }, { threshold: 0.35 });
    vids.forEach(function (v) { vio.observe(v); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) vids.forEach(function (v) { if (!v.paused) v.pause(); }); });
  }

  /* ----------------------------------------------------------
     5. The comms tracker, once the bay is behind you
     ---------------------------------------------------------- */
  var comms = q(".sd-comms", root), hero = q(".sd-hero", root);
  if (comms && hero) {
    var ct = false;
    var cf = function () {
      ct = false;
      comms.classList.toggle("is-on", hero.getBoundingClientRect().bottom < window.innerHeight * 0.6);
    };
    window.addEventListener("scroll", function () { if (!ct) { ct = true; requestAnimationFrame(cf); } }, { passive: true });
    cf();
  }
})();
