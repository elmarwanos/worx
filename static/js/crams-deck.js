/* ============================================================
   Worx | crams-deck.js
   The CRAMS dashboard, rebuilt as a hologram: one screen that plays
   the whole film of crams/index.html behind the words (styles in
   crams.css "THE DECK"; crams.js keeps the cosmos and the HUD).

     arrival    the page opens on scattered panels deep in space; they
                fly in, turning, and lock together into the screen,
                which powers on as the last ones land
     ignition   the screen at an angle behind the wordmark
     gap        it breaks apart: the panels drift out of true, each a
                silo with its signal lost
     connected  the pieces snap back together and glow as they sync
     tour       it flies into the frame in "Inside CRAMS" and lies flat
                there, riding with the page; a frame of light settles
                on one feature at a time with its name on a HUD tag,
                and the list beside it says what it does
     lifecycle  the camera moves in on the lead table; the tracked
                lead's status follows the ticket on the page
     truth      exploded into its layers, seen from above
     crew       far back, dimmed
     launch     laid out under the call to action
   Pointing at a department card lights the panels that team uses. The
   footer's social links ride on the right once the hero is behind.

   Every name, figure and contact is sample data, masked the way CRAMS
   masks contacts outside the team: no real lead appears.
   Reduced motion: the screen is simply there; nothing flies or streams.
   ============================================================ */
(function () {
  "use strict";
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };

  // a seeded random, so the deck looks the same on every visit
  var seed = 7;
  var rnd = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  var DW = 1280, DH = 1200; // the dashboard's own pixels
  var C = { amber: "#faa719", orange: "#e57d23", ember: "#c04527", cream: "#feeecf", cocoa: "#8a4a2a", gold: "#ffd27a", rust: "#a8361b", sand: "#d9a878" };

  /* ---------------------------------------------------------------
     SAMPLE DATA
     --------------------------------------------------------------- */
  var DAYS = ["11 Jun", "13 Jun", "15 Jun", "17 Jun", "19 Jun", "21 Jun", "23 Jun", "25 Jun", "26 Jun", "28 Jun", "30 Jun", "1 Jul", "3 Jul", "5 Jul", "7 Jul", "8 Jul"];
  var SOURCE = DAYS.map(function () { var a = 1 + Math.round(rnd() * 3), b = rnd() < 0.35 ? 1 : 0; return [a, b]; });
  SOURCE[3] = [3, 1]; SOURCE[12] = [5, 0]; SOURCE[15] = [4, 0];
  var BRANCH = DAYS.map(function () { return [Math.round(rnd() * 2), 1 + Math.round(rnd() * 2), rnd() < 0.25 ? 1 : 0]; });
  var PRODUCT = [["Model A", 1], ["Model B", 2], ["Model C", 3], ["Model D", 1], ["Model E", 1.5]];
  var DONUTS = {
    channel: { title: "Preferred channel", parts: [["WhatsApp", 82, C.amber], ["Call", 10, C.orange], ["Email", 5, C.ember], ["In person", 3, C.cream]] },
    ratio: { title: "Sources ratio", parts: [["Instagram", 84, C.orange], ["Facebook", 16, C.cream]] },
    strength: { title: "Lead strength", pie: true, parts: [["Low", 58, C.sand], ["Mild", 30, C.amber], ["Hot", 12, C.ember]] },
    time: { title: "Preferred time", parts: [["Morning", 41, C.gold], ["Afternoon", 37, C.orange], ["Evening", 22, C.rust]] },
    status: { title: "Status ratio", parts: [["Waiting to be contacted", 68, C.orange], ["Contacted", 12, C.amber], ["Qualified", 7, C.gold], ["Not qualified", 6, C.cocoa], ["Invoiced", 3, C.cream], ["Lost sale", 4, C.ember]] }
  };
  var NAMES = ["Sara M.", "Khalid A.", "Noor S.", "Daniel P.", "Mariam T.", "Faisal K.", "Aisha B.", "Yousef N.", "Hessa R.", "Ravi S.", "Lina F.", "Hamad J.", "Zainab Q.", "Chris W.", "Reem D.", "Tariq L."];
  var SOURCES = ["Instagram", "Instagram", "Instagram", "Facebook"];
  var CHANNELS = ["WhatsApp", "WhatsApp", "WhatsApp", "Call", "Email"];
  var TIMES = ["Morning", "Afternoon", "Evening"];
  var STATUSES = ["Waiting to be contacted", "Waiting to be contacted", "Contacted & in progress", "Qualified"];
  var EXECS = ["", "", "A. Rahman", "J. Cole", ""];
  var pick = function (a) { return a[(rnd() * a.length) | 0]; };
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var clock = new Date(2026, 6, 8, 17, 20);
  var lead = function () {
    clock = new Date(clock.getTime() - (20 + rnd() * 240) * 60000);
    var name = pick(NAMES), first = name.charAt(0).toLowerCase();
    return {
      at: clock.getFullYear() + "-" + pad(clock.getMonth() + 1) + "-" + pad(clock.getDate()) + " " + pad(clock.getHours()) + ":" + pad(clock.getMinutes()),
      src: pick(SOURCES), status: pick(STATUSES), exec: pick(EXECS), name: name,
      mail: first + "•••@mail.com", phone: "+971 5" + ((rnd() * 9) | 0) + " ••• ••" + pad((rnd() * 99) | 0),
      ch: pick(CHANNELS), time: pick(TIMES)
    };
  };
  var freshLead = function () {
    var now = new Date(2026, 6, 8, 17, 24 + ((rnd() * 30) | 0));
    var l = lead();
    l.at = "2026-07-08 " + pad(now.getHours()) + ":" + pad(now.getMinutes());
    l.status = "Waiting to be contacted"; l.exec = "";
    return l;
  };

  /* ---------------------------------------------------------------
     THE BUILDER
     --------------------------------------------------------------- */
  // panel boxes, in the dashboard's pixels: [key, x, y, w, h]
  var CW = 302, CH = 262, G = 12, X0 = 16;
  var col = function (i) { return X0 + i * (CW + G); };
  var BOXES = [
    ["top", 16, 16, DW - 32, 88],
    ["c-source", col(0), 116, CW, CH], ["c-product", col(1), 116, CW, CH], ["c-channel", col(2), 116, CW, CH], ["c-branch", col(3), 116, CW, CH],
    ["c-ratio", col(0), 116 + CH + G, CW, CH], ["c-strength", col(1), 116 + CH + G, CW, CH], ["c-time", col(2), 116 + CH + G, CW, CH], ["c-status", col(3), 116 + CH + G, CW, CH],
    ["filters", 16, 116 + 2 * (CH + G), DW - 32, 136],
    ["table", 16, 116 + 2 * (CH + G) + 148, DW - 32, DH - (116 + 2 * (CH + G) + 148) - 16]
  ];
  var LAYER = { top: 0, "c-source": 1, "c-product": 1, "c-channel": 1, "c-branch": 1, "c-ratio": 1, "c-strength": 1, "c-time": 1, "c-status": 1, filters: 2, table: 3 };

  var legend = function (items) {
    return '<p class="dk-leg">' + items.map(function (it) { return '<span><i style="background:' + it[1] + '"></i>' + esc(it[0]) + "</span>"; }).join("") + "</p>";
  };
  var bars = function (title, data, series, max) {
    var w = CW - 24, h = 170, pl = 18, pb = 30, bw = (w - pl) / data.length;
    var s = '<svg viewBox="0 0 ' + w + " " + h + '" class="dk-chart">';
    for (var g = 0; g <= max; g++) {
      var gy = (h - pb) - g / max * (h - pb - 8);
      s += '<line x1="' + pl + '" x2="' + w + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '" class="dk-grid"/><text x="0" y="' + (gy + 3).toFixed(1) + '" class="dk-ax">' + g + "</text>";
    }
    data.forEach(function (d, i) {
      // a day's stack of values, or a labelled bar ["Model A", 2]
      var labelled = typeof d[0] === "string";
      var vals = labelled ? [d[1]] : d, y = h - pb;
      vals.forEach(function (v, k) {
        if (!v) return;
        var bh = v / max * (h - pb - 8);
        y -= bh;
        s += '<rect class="dk-bar" style="--i:' + i + '" x="' + (pl + i * bw + bw * 0.16).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw * 0.68).toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="1.5" fill="' + series[k][1] + '"/>';
      });
      if (data.length <= 6 || i % 2 === 0) {
        var lx = pl + i * bw + bw / 2, lbl = labelled ? d[0] : DAYS[i];
        s += '<text class="dk-ax" text-anchor="end" transform="translate(' + lx.toFixed(1) + " " + (h - pb + 12) + ') rotate(-40)">' + esc(lbl) + "</text>";
      }
    });
    return '<h4 class="dk-h">' + esc(title) + "</h4>" + s + "</svg>" + legend(series);
  };
  var donut = function (d) {
    var r = d.pie ? 34 : 62, sw = d.pie ? 68 : 30, cx = 100, cy = 92, off = 0, s = '<svg viewBox="0 0 200 184" class="dk-chart dk-chart--round">';
    d.parts.forEach(function (p) {
      s += '<circle class="dk-arc" cx="' + cx + '" cy="' + cy + '" r="' + r + '" pathLength="100" stroke="' + p[2] + '" stroke-width="' + sw + '" style="--p:' + p[1] + ";--o:" + (-off) + '" transform="rotate(-90 ' + cx + " " + cy + ')"/>';
      if (p[1] >= 5) {
        var a = (off + p[1] / 2) / 100 * Math.PI * 2 - Math.PI / 2, lr = d.pie ? 46 : r;
        s += '<text class="dk-pct" x="' + (cx + Math.cos(a) * lr).toFixed(1) + '" y="' + (cy + Math.sin(a) * lr + 3).toFixed(1) + '" text-anchor="middle">' + p[1] + "%</text>";
      }
      off += p[1];
    });
    return '<h4 class="dk-h">' + esc(d.title) + "</h4>" + s + "</svg>" + legend(d.parts.map(function (p) { return [p[0], p[2]]; }));
  };
  var row = function (l, cls) {
    return '<div class="dk-tr' + (cls ? " " + cls : "") + '"><span>' + esc(l.at) + "</span><span>" + esc(l.src) + '</span><span class="dk-st" data-st="' + esc(l.status) + '">' + esc(l.status) + "</span><span>" + esc(l.exec) + "</span><span>" + esc(l.name) + "</span><span>" + esc(l.mail) + '</span><span class="dk-ltr">' + esc(l.phone) + "</span><span>" + esc(l.ch) + "</span><span>" + esc(l.time) + "</span></div>";
  };
  var select = function (label, value) { return '<div class="dk-sel"><small>' + esc(label) + "</small><span>" + esc(value) + '<svg viewBox="0 0 12 12"><path d="M2 4l4 4 4-4"/></svg></span></div>'; };

  var PANEL = {
    top: function () {
      return '<div class="dk-brand"><b>CRAMS</b><span>Sample workspace</span></div>' +
        '<div class="dk-dates"><small>Filter by date</small><span class="dk-btn is-on">Start date</span><span class="dk-btn">End date</span><span class="dk-btn">All dates</span><span class="dk-btn is-on">Last month</span><span class="dk-btn">Last 2 weeks</span><span class="dk-btn">Last 1 week</span></div>' +
        '<div class="dk-me"><span class="dk-live"><i></i>LIVE · <b data-dk-today>23</b> today</span><span class="dk-out">Log out</span><b class="dk-date">8 July 2026</b></div>' +
        '<span class="dk-toast" data-dk-toast></span>';
    },
    "c-source": function () { return bars("Source by day", SOURCE, [["Instagram", C.orange], ["Facebook", C.cream]], 5); },
    "c-product": function () { return bars("Product by day", PRODUCT, [["Models", C.amber]], 3); },
    "c-channel": function () { return donut(DONUTS.channel); },
    "c-branch": function () { return bars("Branch by day", BRANCH, [["Abu Dhabi", C.ember], ["Dubai", C.amber], ["Al Ain", C.cream]], 5); },
    "c-ratio": function () { return donut(DONUTS.ratio); },
    "c-strength": function () { return donut(DONUTS.strength); },
    "c-time": function () { return donut(DONUTS.time); },
    "c-status": function () { return donut(DONUTS.status); },
    filters: function () {
      return '<div class="dk-frow"><div class="dk-tog"><small>Table view</small><span><i></i>Simple view</span></div>' +
        select("Filter by campaign", "Select campaign") + select("Filter by branch", "Select branch") + select("Filter by product", "Select product") + select("Filter by source", "Select source") + select("Sort by date", "Newest first") + "</div>" +
        '<div class="dk-frow dk-frow--b"><span class="dk-act">Generate CSV</span><div class="dk-tog dk-tog--c"><small>Leads visibility</small><span><i></i>Assigned</span></div><span class="dk-act">Clear filters</span></div>';
    },
    table: function () {
      var rows = "";
      for (var i = 0; i < 9; i++) rows += row(lead());
      return '<div class="dk-th"><span>Created</span><span>Source</span><span>Status</span><span>Sales exec</span><span>Name</span><span>Email</span><span>Phone</span><span>Pref. channel</span><span>Pref. time</span></div><div class="dk-rows" data-dk-rows>' + rows + "</div>";
    }
  };

  function build(root) {
    seed = 7; clock = new Date(2026, 6, 8, 17, 20);
    var html = "";
    BOXES.forEach(function (b, i) {
      html += '<div class="dk-p dk-p--' + b[0] + '" data-region="' + b[0] + '" data-layer="' + LAYER[b[0]] + '" style="--d:' + i + ";left:" + b[1] + "px;top:" + b[2] + "px;width:" + b[3] + "px;height:" + b[4] + 'px"><div class="dk-in">' + PANEL[b[0]]() + "</div></div>";
    });
    root.innerHTML = html;
    root.classList.add("dk");
    var api = {
      root: root,
      panels: $$(".dk-p", root),
      rows: $("[data-dk-rows]", root),
      today: $("[data-dk-today]", root),
      toast: $("[data-dk-toast]", root),
      n: 23
    };
    // a new lead lands: it slides in at the top, the counter ticks, the
    // top bar says where it came from
    api.add = function () {
      var l = freshLead();
      var tmp = document.createElement("div");
      tmp.innerHTML = row(l, "is-new");
      var tr = tmp.firstChild;
      var tracked = $(".dk-tr.is-tracked", api.rows);
      api.rows.insertBefore(tr, tracked ? tracked.nextSibling : api.rows.firstChild);
      var all = $$(".dk-tr", api.rows);
      if (all.length > 9) all[all.length - 1].remove();
      api.today.textContent = ++api.n;
      api.toast.innerHTML = "<i></i>NEW LEAD · " + esc(l.src) + " · " + esc(l.ch);
      api.toast.classList.remove("is-on"); void api.toast.offsetWidth; api.toast.classList.add("is-on");
    };
    api.boot = function () { root.classList.add("is-on"); };
    return api;
  }

  var streams = [];
  var stream = function (api, isOn) {
    if (reduced) return;
    streams.push({ api: api, on: isOn });
  };
  if (!reduced) setInterval(function () {
    if (document.hidden) return;
    streams.forEach(function (s) { if (s.on()) s.api.add(); });
  }, 3600);

  /* ---------------------------------------------------------------
     THE DECK: one dashboard, the whole film
     --------------------------------------------------------------- */
  var deckEl = $("[data-cr-deck]");
  if (!deckEl) return;
  var main = deckEl.closest("[data-cr]") || document.body;
  var stage = $(".cr-deck-stage", deckEl);
  var dash = build($(".cr-deck-dash", deckEl));
  var chapters = $$("[data-cr-chapter]");
  var tourSec = $("[data-cr-tour-sec]"), dock = $("[data-cr-dock]");
  var heroSec = $(".cr-hero");
  var scene = "", W = 0, H = 0, docked = false, dockT = 0;
  // phones and tablets: no screen behind the page (a fixed 3D layer fights
  // a touch scroll); the dashboard lives in the "Inside CRAMS" frame,
  // moving with the page, and makes its entrance there
  var compact = !!dock && window.matchMedia("(max-width: 1024px), (hover: none)").matches;
  var inlineDone = false, inner = null;

  // where the screen sits in each chapter: x, y as parts of the view,
  // s as a part of what fits, the angles in degrees, o its opacity
  var SC = {
    ignition:  { x: 0.2, y: 0.03, s: 0.8, rx: 9, ry: -26, rz: -2, o: 0.32 },
    gap:       { x: 0.17, y: 0.0, s: 0.66, rx: 6, ry: -12, rz: 0, o: 0.55 },
    connected: { x: 0.2, y: 0.02, s: 0.66, rx: 7, ry: -18, rz: -1, o: 0.55 },
    lifecycle: { x: 0.24, y: 0.1, s: 0.92, rx: 16, ry: -24, rz: -2, o: 0.34 },
    truth:     { x: 0.08, y: 0.1, s: 0.64, rx: 56, ry: 0, rz: -32, o: 0.36 },
    crew:      { x: 0.26, y: 0.0, s: 0.5, rx: 6, ry: -30, rz: 0, o: 0.14 },
    // the launch keeps its stage to itself: the screen has gone
    launch:    { x: 0.0, y: 0.4, s: 0.96, rx: 38, ry: 0, rz: 0, o: 0 }
  };
  // the panels' own moves: deep space (where they fly in from) and the
  // gap (where they drift apart to)
  var DEEP = dash.panels.map(function () {
    var a = rnd() * Math.PI * 2, d = 600 + rnd() * 900;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.7, z: -2200 - rnd() * 2400, rx: (rnd() - 0.5) * 140, ry: (rnd() - 0.5) * 180, rz: (rnd() - 0.5) * 110 };
  });
  var SCATTER = dash.panels.map(function () {
    return { x: (rnd() - 0.5) * 1500, y: (rnd() - 0.5) * 950, z: -520 + rnd() * 800, rx: (rnd() - 0.5) * 50, ry: (rnd() - 0.5) * 70, rz: (rnd() - 0.5) * 34 };
  });
  var tf = function (q, k) {
    return "translate3d(" + (q.x * k).toFixed(0) + "px," + (q.y * k).toFixed(0) + "px," + (q.z * k).toFixed(0) + "px) rotateX(" + (q.rx * k).toFixed(1) + "deg) rotateY(" + (q.ry * k).toFixed(1) + "deg) rotateZ(" + (q.rz * k).toFixed(1) + "deg)";
  };
  var place = function (name, small) {
    dash.panels.forEach(function (p, i) {
      var key = p.getAttribute("data-region"), layer = +p.getAttribute("data-layer"), t = "none", o = 1;
      if (name === "ignition") t = "translate3d(0,0," + [46, 74, 30, 0][layer] + "px)";
      else if (name === "gap") { t = tf(SCATTER[i], small ? 0.45 : 1); o = 0.75; }
      else if (name === "lifecycle") { if (key === "table") t = "translate3d(0,-40px,140px) scale(1.04)"; else { t = "translate3d(0,0,-280px)"; o = 0.3; } }
      else if (name === "truth") t = "translate3d(0,0," + [330, 210, 90, -40][layer] + "px)";
      p.style.transform = t;
      p.style.opacity = o;
    });
  };
  // docked: the screen sits flat in the tour's frame, tracking it
  var dockTo = function () {
    var r = dock.getBoundingClientRect(), s = r.width / DW;
    stage.style.transform = "translate(" + (r.left + r.width / 2 - W / 2).toFixed(1) + "px," + (r.top + r.height / 2 - H / 2).toFixed(1) + "px) scale(" + s.toFixed(4) + ")";
  };
  var apply = function (name, force) {
    if (name === scene && !force) return;
    var was = scene;
    scene = name;
    if (compact) {
      // its entrance, once: the panels fly in out of the depth of the
      // frame, lock together, and the screen powers on
      if (name === "tour" && !inlineDone) {
        inlineDone = true;
        dock.classList.add("is-flying");
        place("tour", true);
        setTimeout(function () { dash.boot(); dock.classList.add("is-live"); if (cur < 0) show(0); }, reduced ? 0 : 1900);
      }
      return;
    }
    var small = W < 760;
    deckEl.setAttribute("data-scene", name);
    clearTimeout(dockT);
    if (name === "tour" && dock) {
      // fly into the frame, then ride with it as the page scrolls
      docked = false;
      deckEl.classList.remove("is-docked");
      dockTo();
      deckEl.style.opacity = 1;
      place("tour", small);
      dockT = setTimeout(function () { docked = true; deckEl.classList.add("is-docked"); }, reduced ? 0 : 1500);
      if (cur < 0) show(0);
      return;
    }
    docked = false;
    deckEl.classList.remove("is-docked");
    var k = SC[name] || SC.connected, fit = Math.min(W / DW, H / DH);
    var s = small ? Math.max(W / DW * 1.05, fit) * (name === "truth" ? 0.9 : 1) : fit * k.s;
    var x = small ? 0 : k.x * W, y = small ? (name === "launch" ? 0.34 : 0.16) * H : k.y * H;
    var rx = small ? Math.max(10, k.rx * 0.7) : k.rx, ry = small ? k.ry * 0.4 : k.ry;
    stage.style.transform = "translate(" + x.toFixed(0) + "px," + y.toFixed(0) + "px) scale(" + s.toFixed(4) + ") rotateX(" + rx + "deg) rotateY(" + ry + "deg) rotateZ(" + k.rz + "deg)";
    deckEl.style.opacity = (k.o * (small ? 0.55 : 1)).toFixed(3);
    place(name, small);
    // pieces back together: every panel glows as it syncs
    if (name === "connected" && was === "gap" && !reduced) { deckEl.classList.remove("is-sync"); void deckEl.offsetWidth; deckEl.classList.add("is-sync"); }
  };
  var read = function () {
    var mid = H * 0.5, name = "ignition";
    chapters.forEach(function (c) { if (c.getBoundingClientRect().top <= mid) name = c.getAttribute("data-cr-chapter"); });
    if (tourSec && dock) { var tr = dock.getBoundingClientRect(); if (tr.top < H * 0.75 && tr.bottom > H * 0.25) name = "tour"; }
    apply(name);
    if (scene === "tour" && docked) dockTo();
    // the comms rail, once the hero is behind
    if (comms && heroSec) comms.classList.toggle("is-on", heroSec.getBoundingClientRect().bottom < H * 0.6 && main.getBoundingClientRect().bottom > H * 0.6);
  };

  /* THE TOUR: the docked screen walks its features. A frame of light
     settles on each part in turn, with its name on a HUD tag; the list
     beside it says what that part does. */
  var items = tourSec ? $$("[data-tour-item]", tourSec) : [];
  var spot = document.createElement("span");
  spot.className = "dk-spot";
  spot.innerHTML = '<span class="dk-tag"><i></i><b data-dk-tag></b></span>';
  dash.root.appendChild(spot);
  var tag = $("[data-dk-tag]", spot);
  var REG = {};
  BOXES.forEach(function (b) { REG[b[0]] = { x: b[1], y: b[2], w: b[3], h: b[4] }; });
  REG.dates = { x: 300, y: 22, w: 690, h: 76 };
  REG.actions = { x: 16, y: REG.filters.y + 74, w: DW - 32, h: 62 };
  REG.filters = { x: 16, y: REG.filters.y, w: DW - 32, h: 72 };
  var cur = -1, hold = 0, seen = false;
  var show = function (i) {
    if (!items.length) return;
    cur = (i + items.length) % items.length;
    var it = items[cur], r = REG[it.getAttribute("data-tour-item")];
    items.forEach(function (x, j) { x.classList.toggle("is-on", j === cur); x.querySelector("button").setAttribute("aria-current", j === cur ? "true" : "false"); });
    spot.style.left = (r.x - 8) + "px"; spot.style.top = (r.y - 8) + "px"; spot.style.width = (r.w + 16) + "px"; spot.style.height = (r.h + 16) + "px";
    tag.textContent = $("b", it).textContent;
    // the tag sits above the frame, or inside it when there is no room
    spot.classList.toggle("is-low", r.y < 60);
    spot.classList.remove("is-new"); void spot.offsetWidth; spot.classList.add("is-new");
  };
  items.forEach(function (it, i) {
    var b = it.querySelector("button");
    b.addEventListener("click", function () { hold = Date.now() + 12000; show(i); });
    b.addEventListener("pointerenter", function () { hold = Date.now() + 6000; show(i); });
    b.addEventListener("focus", function () { hold = Date.now() + 12000; show(i); });
  });
  if (!reduced) setInterval(function () { if (scene === "tour" && !document.hidden && Date.now() > hold) show(cur + 1); }, 3800);

  /* THE COMMS RAIL: the footer's own social links, on the right */
  var comms = $("[data-cr-comms]");

  // the size of the view, and the first frame
  // the inline screen is scaled to its frame
  var fitInline = function () { if (inner) inner.style.transform = "scale(" + (dock.clientWidth / DW).toFixed(4) + ")"; };
  var size = function () {
    var nw = window.innerWidth, nh = window.innerHeight;
    // an address bar sliding on a phone is not a new layout
    var same = nw === W && Math.abs(nh - H) < 160;
    W = nw; H = nh;
    if (compact) { fitInline(); return; }
    if (!same) apply(scene || "ignition", true);
    read();
  };
  W = window.innerWidth; H = window.innerHeight;

  if (compact) {
    // the screen moves into the frame; its panels wait deep inside it
    deckEl.hidden = true;
    var wrap = document.createElement("div");
    wrap.className = "cr-dock-screen";
    wrap.setAttribute("aria-hidden", "true");
    inner = document.createElement("div");
    inner.className = "cr-dock-inner";
    inner.appendChild(dash.root);
    wrap.appendChild(inner);
    dock.insertBefore(wrap, dock.firstChild);
    dock.classList.add("is-inline");
    fitInline();
    if ("ResizeObserver" in window) new ResizeObserver(fitInline).observe(dock);
    if (!reduced) dash.panels.forEach(function (p, i) { p.style.transform = tf(DEEP[i], 0.35); p.style.opacity = 0; });
    // tap any part of the screen to hear what it does
    var TAP = { top: "dates", "c-source": "c-source", "c-product": "c-source", "c-ratio": "c-source", "c-channel": "c-channel", "c-strength": "c-strength", "c-time": "c-time", "c-status": "c-status", "c-branch": "c-branch", filters: "filters", table: "table" };
    dash.panels.forEach(function (p) {
      p.addEventListener("click", function (e) {
        var key = TAP[p.getAttribute("data-region")];
        if (key === "filters" && e.offsetY > 74) key = "actions";
        items.forEach(function (it, j) { if (it.getAttribute("data-tour-item") === key) { hold = Date.now() + 12000; show(j); } });
      });
    });
    read();
    // phones and tablets: the hologram in the hero as well, carried by the
    // page (not fixed behind it, so nothing fights a touch scroll): tilted
    // in its own depth, its panels fly in from deep space, lock together
    // and the screen powers on; new leads keep landing while it is in view
    var flat = function (q, k, sc) { return "translate(" + (q.x * k).toFixed(0) + "px," + (q.y * k).toFixed(0) + "px) rotate(" + (q.rz * k * 1.2).toFixed(1) + "deg) scale(" + sc + ")"; };
    if (heroSec) (function () {
      var holo = document.createElement("div"), hin = document.createElement("div"), root = document.createElement("div");
      holo.className = "cr-hero-holo"; holo.setAttribute("aria-hidden", "true");
      hin.className = "cr-hero-holo-in"; root.className = "cr-deck-dash";
      var hdash = build(root);
      hin.appendChild(root); holo.appendChild(hin);
      heroSec.insertBefore(holo, heroSec.firstChild);
      var fit = function () { hin.style.setProperty("--k", Math.min(holo.clientWidth * 1.2 / DW, holo.clientHeight * 0.85 / DH).toFixed(4)); };
      fit();
      if ("ResizeObserver" in window) new ResizeObserver(fit).observe(holo);
      var lock = function () { hdash.panels.forEach(function (p) { p.style.transform = "none"; p.style.opacity = 1; }); };
      var seen = true;
      if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { seen = en[0].isIntersecting; }).observe(heroSec);
      if (reduced) { lock(); hdash.boot(); return; }
      hdash.panels.forEach(function (p, i) { p.style.transform = flat(SCATTER[i], 0.5, 0.7); p.style.opacity = 0; });
      setTimeout(function () { holo.classList.add("is-flying"); lock(); }, 500);
      setTimeout(function () { hdash.boot(); }, 2500);
      stream(hdash, function () { return seen && hdash.root.classList.contains("is-on"); });
    })();
    // phones and tablets: between the chapters, where on a desktop the
    // floating screen tells the story, three interludes tell it in the
    // page itself (each plays as it comes into view, and again on return):
    //   after the hero    THE BREAK: the live screen drifts apart, its
    //                     panels scattering and dimming red (the gap)
    //   after the gap     THE SYNC: the scattered panels fly back, lock
    //                     into one screen and pulse as they sync
    //   after connected   EVERY TEAM: the live screen, leads landing, the
    //                     panels each department works from lighting in turn
    var DEPT = $$(".cr-dept b").map(function (e) { return e.textContent; });
    var LIGHT = [["table", "c-status", "filters"], ["c-source", "c-ratio", "c-product"], ["c-channel", "c-time", "table"], ["filters", "top", "table"],
      ["c-source", "c-product", "c-channel", "c-branch", "c-ratio", "c-strength", "c-time", "c-status"], null];
    var inter = function (after, mode) {
      if (!after) return;
      var box = document.createElement("div"), hin = document.createElement("div"), root = document.createElement("div");
      box.className = "cr-inter cr-inter--" + mode; box.setAttribute("aria-hidden", "true");
      hin.className = "cr-inter-in"; root.className = "cr-deck-dash";
      var d = build(root);
      hin.appendChild(root); box.appendChild(hin);
      var tag = null;
      if (mode === "teams") { tag = document.createElement("span"); tag.className = "cr-inter-tag"; box.appendChild(tag); }
      after.parentNode.insertBefore(box, after.nextSibling);
      var fit = function () { hin.style.setProperty("--k", Math.min(box.clientWidth * 1.08 / DW, box.clientHeight * 1.0 / DH).toFixed(4)); };
      fit();
      if ("ResizeObserver" in window) new ResizeObserver(fit).observe(box);
      var lock = function () { d.panels.forEach(function (p) { p.style.transform = "none"; p.style.opacity = 1; }); };
      var scatter = function () { d.panels.forEach(function (p, i) { p.style.transform = flat(SCATTER[i], 0.32, 0.92); p.style.opacity = 0.85; }); };
      var seen = false, timers = [], cycle = null, k = 0;
      var later = function (fn, ms) { timers.push(setTimeout(fn, reduced ? 0 : ms)); };
      var rest = function () {                      // as it waits, out of view
        timers.forEach(clearTimeout); timers = []; clearInterval(cycle); cycle = null;
        box.classList.remove("is-moving", "is-sync");
        if (mode === "sync") { scatter(); box.classList.add("is-broken"); } else { lock(); box.classList.remove("is-broken"); }
        d.panels.forEach(function (p) { p.classList.remove("is-hot"); });
      };
      var play = function () {
        d.boot();
        if (mode === "break") { later(function () { box.classList.add("is-moving", "is-broken"); scatter(); }, 500); }
        else if (mode === "sync") { later(function () { box.classList.add("is-moving"); box.classList.remove("is-broken"); lock(); }, 300); later(function () { box.classList.add("is-sync"); }, 2300); }
        else {
          var light = function () {
            var on = LIGHT[k % LIGHT.length];
            d.panels.forEach(function (p) { p.classList.toggle("is-hot", !on || on.indexOf(p.getAttribute("data-region")) >= 0); });
            if (tag) tag.textContent = (DEPT[k % LIGHT.length] || "").toUpperCase();
            k++;
          };
          light(); cycle = setInterval(light, reduced ? 4000 : 2200);
        }
      };
      rest();
      // it plays once, when well in view, and then stays as it ended (no
      // snapping back while half on screen); only the teams' lights pause
      // out of view
      var played = false;
      if ("IntersectionObserver" in window) new IntersectionObserver(function (en) {
        seen = en[0].isIntersecting;
        if (seen && !played) { played = true; play(); }
        else if (mode === "teams" && played) { clearInterval(cycle); cycle = null; if (seen) play(); }
      }, { threshold: 0.5 }).observe(box);
      else play();
      if (mode === "teams") stream(d, function () { return seen; });
    };
    inter(heroSec, "break");
    inter($(".cr-gap"), "sync");
    inter($(".cr-orbit"), "teams");
  } else if (reduced) { apply("ignition", true); dash.boot(); read(); }
  else {
    // THE ARRIVAL: the panels are out in deep space when the page opens,
    // then fly in and lock together into the screen; it powers on as
    // the last ones land
    deckEl.classList.add("is-arriving");
    dash.panels.forEach(function (p, i) { p.style.transform = tf(DEEP[i], 1); p.style.opacity = 0; });
    apply("ignition", true);
    dash.panels.forEach(function (p, i) { p.style.transform = tf(DEEP[i], 1); p.style.opacity = 0; });
    void deckEl.offsetWidth;
    setTimeout(function () {
      deckEl.classList.add("is-flying");
      place("ignition", W < 760);
      read();
    }, 700);
    setTimeout(function () { dash.boot(); }, 2600);
    setTimeout(function () { deckEl.classList.remove("is-arriving", "is-flying"); }, 4200);
  }
  var ticking = false;
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; read(); }); } }, { passive: true });
  window.addEventListener("resize", size);

  // new leads keep landing, except while the deck is in pieces
  stream(dash, function () { return scene !== "gap" && dash.root.classList.contains("is-on"); });

  // the departments: each lights the panels its team works from
  var USES = [["table", "c-status", "filters"], ["c-source", "c-ratio", "c-product"], ["c-channel", "c-time", "table"], ["filters", "top", "table"],
    ["c-source", "c-product", "c-channel", "c-branch", "c-ratio", "c-strength", "c-time", "c-status"], null];
  $$(".cr-dept").forEach(function (c) {
    var i = +c.getAttribute("data-dept");
    var on = function () { dash.panels.forEach(function (p) { p.classList.toggle("is-hot", !USES[i] || USES[i].indexOf(p.getAttribute("data-region")) >= 0); }); };
    var off = function () { dash.panels.forEach(function (p) { p.classList.remove("is-hot"); }); };
    c.addEventListener("pointerenter", on); c.addEventListener("pointerleave", off);
    c.addEventListener("focus", on); c.addEventListener("blur", off);
  });

  // the lifecycle: one lead in the table is the one on the page's ticket
  var tStatus = $("[data-t-status]");
  if (tStatus) {
    var holder = document.createElement("div");
    holder.innerHTML = row({ at: "2026-07-08 17:31", src: "Instagram", status: tStatus.textContent, exec: "", name: "Tracked lead", mail: "t•••@mail.com", phone: "+971 50 ••• •07", ch: "WhatsApp", time: "Morning" }, "is-tracked");
    var tracked = holder.firstChild;
    dash.rows.insertBefore(tracked, dash.rows.firstChild);
    $$(".dk-tr", dash.rows).slice(9).forEach(function (r) { r.remove(); });
    var st = $(".dk-st", tracked);
    new MutationObserver(function () {
      st.textContent = tStatus.textContent;
      tracked.classList.remove("is-flash"); void tracked.offsetWidth; tracked.classList.add("is-flash");
    }).observe(tStatus, { childList: true, characterData: true, subtree: true });
  }
})();
