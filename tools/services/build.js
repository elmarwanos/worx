/* ============================================================
   Worx | tools/services/build.js
   Run:  node tools/services/build.js
   Reads catalogue.js and writes the generated blocks:
     1. The Services mega menu into the header of every page
     (and on contact/index.html, the same list for the planner's first
      question, so the two pages always offer the same services)
     2. On services/index.html: fleet panel copy, star map,
        marquee, mission builder, counts and a JSON copy of the
        catalogue for services.js
   Generated blocks live between <!--WORX:GEN name--> and
   <!--/WORX:GEN name--> so the script can re-run safely.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const catalogue = require("./catalogue.js");

const nl0 = (s) => (s.includes("\r\n") ? "\r\n" : "\n");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad = (n) => String(n).padStart(2, "0");

const services = [];
catalogue.forEach((d, di) => d.services.forEach((s) => services.push(Object.assign({ division: d, di }, s))));
const capCount = services.reduce((n, s) => n + s.subs.length, 0);
const capRounded = Math.floor(capCount / 10) * 10;

// Client grid in the mega menu. Drop a logo at static/assets/clients/<slug>.svg
// (or .png / .webp) and the next build uses it; until then each slot shows
// a typographic wordmark styled in layout.css (.mega-client--<slug>).
const CLIENTS = [
  ['chaumet', 'Chaumet'], ['hyundai', 'Hyundai'], ['modon', 'Modon'], ['genesis', 'Genesis'],
  ['kia', 'Kia'], ['uae-pavilion', 'UAE Pavilion'], ['hudayriyat', 'Hudayriyat'], ['wealthface', 'Wealthface'],
  ['hisense', 'Hisense'], ['unicef', 'UNICEF'], ['universal-pictures', 'Universal Pictures'], ['roxy-cinemas', 'Roxy Cinemas'],
  ['lg', 'LG'], ['tiara-dream', 'Tiara Dream'], ['duni', 'Duni'], ['glimpse', 'Glimpse']
];
const LOGO_DIR = path.join(ROOT, 'static/assets/clients');
// a line set under a logo that does not say the name itself
const CAPTIONS = { glimpse: 'Glimpse' };

function clientCell(slug, name, prefix) {
  const ext = ['svg', 'png', 'webp'].find((e) => fs.existsSync(path.join(LOGO_DIR, slug + '.' + e)));
  // a logo is drawn as a mask filled with the cell's own colour (layout.css
  // .mega-logo), so every brand sits in the menu's cream, lit on hover. The
  // url sits on the element itself so it resolves against the page (inside
  // a custom property it would resolve against the stylesheet).
  const src = "url(\x27" + prefix + "static/assets/clients/" + slug + "." + ext + "\x27)";
  const inner = ext
    ? '<span class="mega-logo" role="img" aria-label="' + esc(name) + '" style="-webkit-mask-image: ' + src + "; mask-image: " + src + '"></span>'
    : '<span>' + esc(name) + '</span>';
  const cap = CAPTIONS[slug] ? '<small class="mega-cap">' + esc(CAPTIONS[slug]) + '</small>' : '';
  return '<li class="mega-client mega-client--' + slug + (ext ? ' has-logo' : '') + (cap ? ' has-cap' : '') + '">' + inner + cap + '</li>';
}

// Where a service links: its own page if it has one, otherwise its
// division's panel on the services page.
function href(s, prefix, d) {
  return s.page ? `${prefix}services/${s.page}` : `${prefix}services/index.html#sys-${(d || s.division).id}`;
}

function replaceBlock(html, name, content, file) {
  // Global: a marker such as count-services can appear several times
  const re = new RegExp(`<!--WORX:GEN ${name}-->[\\s\\S]*?<!--/WORX:GEN ${name}-->`, "g");
  if (!html.match(re)) throw new Error(`marker "${name}" not found in ${file}`);
  return html.replace(re, () => `<!--WORX:GEN ${name}-->${content}<!--/WORX:GEN ${name}-->`);
}

/* ---- 1. Mega menu ------------------------------------------ */

const chevron = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

function megaMenu(prefix) {
  // Spread divisions over three columns, balancing the number of links
  const buckets = [[], [], []];
  const load = [0, 0, 0];
  catalogue.forEach((d, i) => {
    const k = load.indexOf(Math.min(...load));
    buckets[k].push(i);
    load[k] += d.services.length + 1.5;
  });
  const cols = buckets.map((pair) => pair.map((i) => {
    const d = catalogue[i];
    const links = d.services.map((s) => `
                <li><a href="${href(s, prefix, d)}" data-mega-item data-division="${esc(d.name)}" data-short="${esc(s.short)}" data-subs="${esc(s.subs.slice(0, 9).join("|"))}" data-more="${Math.max(0, s.subs.length - 9)}"><i aria-hidden="true"></i><span>${esc(s.name)}</span>${chevron}</a></li>`).join("");
    return `
              <div class="mega-group">
                <p class="mega-group-title"><span>${pad(i + 1)}</span>${esc(d.name)}</p>
                <ul>${links}
                </ul>
              </div>`;
  }).join("")).map((c) => `
            <div class="mega-col">${c}
            </div>`).join("");

  return `
        <div class="nav-item nav-item--mega">
          <a href="${prefix}services/index.html" data-nav="services" class="nav-mega-trigger" aria-haspopup="true" aria-expanded="false">Services<svg class="nav-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></a>
          <button class="nav-sub-toggle" type="button" aria-label="Show all services" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
          <div class="mega" role="region" aria-label="All services">
            <div class="mega-panel">
              <div class="mega-cols">${cols}
              </div>
              <aside class="mega-side" aria-live="polite">
                <div class="mega-default">
                  <p class="mega-side-title">Trusted by brands<br>across the world</p>
                  <ul class="mega-clients">${CLIENTS.map(([slug, name]) => clientCell(slug, name, prefix)).join("")}</ul>
                </div>
                <div class="mega-preview" hidden>
                  <p class="mega-preview-div"></p>
                  <p class="mega-preview-name"></p>
                  <p class="mega-preview-short"></p>
                  <ul class="mega-preview-subs"></ul>
                  <span class="mega-preview-cta">Explore <span aria-hidden="true">→</span></span>
                </div>
              </aside>
            </div>
            <div class="mega-foot">
              <span><b>${services.length}</b> services · <b>${capRounded}+</b> capabilities · one crew</span>
              <a href="${prefix}services/index.html" class="mega-all">View all services <span aria-hidden="true">→</span></a>
              <a href="${prefix}contact/index.html" class="btn btn-primary mega-cta">Quick Enquiry</a>
            </div>
          </div>
        </div>`;
}

// The mega menu lives in the one site header (partials/header.html);
// tools/site/build.js stamps that header into every page (run below).
const headerFile = path.join(ROOT, "partials/header.html");
let header = fs.readFileSync(headerFile, "utf8");
if (!header.includes("<!--WORX:GEN mega-->")) throw new Error("partials/header.html has no <!--WORX:GEN mega--> block");
const megaBlock = `<!--WORX:GEN mega-->${megaMenu("{{root}}")}\n        <!--/WORX:GEN mega-->`.replace(/\r?\n/g, nl0(header));
header = header.replace(/<!--WORX:GEN mega-->[\s\S]*?<!--\/WORX:GEN mega-->/, () => megaBlock);
fs.writeFileSync(headerFile, header);
let menuCount = 1;

/* ---- 2. Services page --------------------------------------- */

const pageFile = path.join(ROOT, "services/index.html");
let page = fs.readFileSync(pageFile, "utf8");

// Fleet panel copy, one per division
catalogue.forEach((d, i) => {
  const rows = d.services.map((s) => {
    const shown = s.subs.slice(0, 4).join(" · ");
    const more = s.subs.length > 4 ? ` <em>+${s.subs.length - 4}</em>` : "";
    return `
                <li><a href="${href(s, "../", d)}" data-cursor="Explore"><b>${esc(s.name)}</b><span>${esc(shown)}${more}</span></a></li>`;
  }).join("");
  const content = `
              <p class="cx-panel-idx">DIV ${pad(i + 1)} / ${pad(catalogue.length)} · <b>${d.services.length} ${d.services.length === 1 ? "system" : "systems"} online</b></p>
              <h3>${esc(d.name)}</h3>
              <p>${esc(d.tagline)}</p>
              <ul class="cx-svc-list">${rows}
              </ul>
            `;
  page = replaceBlock(page, `panel:${d.id}`, content, pageFile);
});

// Star map: each division is named for a constellation that suits its
// work (Fornax the furnace, Pyxis the compass you carry, Pictor the
// painter's easel, Nova the new star, Norma the carpenter's square) and
// drawn in the shape of one of the best-known figures in the sky, from
// its stars' true positions (right ascension in degrees, declination),
// as you see them looking up: east on the left. Its services sit on the
// figure's main stars (in catalogue order, the first on the brightest);
// the rest of the figure is drawn in fainter stars. Laid out on a 3 x 2
// grid (desktop) and a 2 x 3 grid (mobile). A service star's size
// follows how many capabilities it carries.
const SKY = {
  // drawn as Leo
  development: {
    name: "Fornax",
    stars: {
      regulus: [152.09, 11.97], eta: [151.83, 16.76], algieba: [154.99, 19.84], adhafera: [154.17, 23.42],
      rasalas: [148.19, 26.01], epsilon: [146.46, 23.77], zosma: [168.53, 20.52], chertan: [168.56, 15.43], denebola: [177.26, 14.57]
    },
    services: ["regulus", "denebola", "algieba"],
    lines: [["regulus", "eta"], ["eta", "algieba"], ["algieba", "adhafera"], ["adhafera", "rasalas"], ["rasalas", "epsilon"],
      ["algieba", "zosma"], ["zosma", "denebola"], ["denebola", "chertan"], ["chertan", "regulus"], ["chertan", "zosma"]]
  },
  // drawn as Cassiopeia, the W
  mobile: {
    name: "Pyxis",
    stars: { caph: [2.29, 59.15], schedar: [10.13, 56.54], navi: [14.18, 60.72], ruchbah: [21.45, 60.24], segin: [28.6, 63.67] },
    services: ["navi"],
    lines: [["caph", "schedar"], ["schedar", "navi"], ["navi", "ruchbah"], ["ruchbah", "segin"]]
  },
  // drawn as Cygnus, the Northern Cross: a service on each arm
  creative: {
    name: "Pictor",
    stars: {
      deneb: [310.36, 45.28], sadr: [305.56, 40.26], albireo: [292.68, 27.96], eta: [299.08, 35.08],
      gienah: [311.55, 33.97], zeta: [318.23, 30.23], delta: [296.24, 45.13], kappa: [289.28, 53.37]
    },
    services: ["deneb", "delta", "gienah", "albireo"],
    // the two top stars sit close: their names go out to the sides
    side: { deneb: "left", delta: "right" },
    lines: [["deneb", "sadr"], ["sadr", "eta"], ["eta", "albireo"], ["kappa", "delta"], ["delta", "sadr"], ["sadr", "gienah"], ["gienah", "zeta"]]
  },
  // drawn as Orion
  emerging: {
    name: "Nova",
    stars: {
      betelgeuse: [88.79, 7.41], bellatrix: [81.28, 6.35], meissa: [83.78, 9.93], mintaka: [83.0, -0.3],
      alnilam: [84.05, -1.2], alnitak: [85.19, -1.94], saiph: [86.94, -9.67], rigel: [78.63, -8.2]
    },
    services: ["betelgeuse", "rigel"],
    lines: [["meissa", "betelgeuse"], ["meissa", "bellatrix"], ["betelgeuse", "alnitak"], ["bellatrix", "mintaka"],
      ["mintaka", "alnilam"], ["alnilam", "alnitak"], ["alnitak", "saiph"], ["mintaka", "rigel"]]
  },
  // drawn as Ursa Major, the Big Dipper
  it: {
    name: "Norma",
    stars: {
      dubhe: [165.93, 61.75], merak: [165.46, 56.38], phecda: [178.46, 53.69], megrez: [183.86, 57.03],
      alioth: [193.51, 55.96], mizar: [200.98, 54.93], alkaid: [206.89, 49.31]
    },
    services: ["dubhe", "alioth", "alkaid"],
    lines: [["dubhe", "merak"], ["merak", "phecda"], ["phecda", "megrez"], ["megrez", "dubhe"], ["megrez", "alioth"], ["alioth", "mizar"], ["mizar", "alkaid"]]
  }
};

// a constellation's stars on a -1..1 box, centred, true to its shape
function chart(sky) {
  const ids = Object.keys(sky.stars), dec0 = ids.reduce((t, k) => t + sky.stars[k][1], 0) / ids.length;
  const raw = ids.map((k) => { const [ra, dec] = sky.stars[k]; return [-ra * Math.cos(dec0 * Math.PI / 180), -dec]; });
  const xs = raw.map((p) => p[0]), ys = raw.map((p) => p[1]);
  const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
  const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2;
  const out = {};
  ids.forEach((k, i) => { out[k] = [(raw[i][0] - mx) / half, (raw[i][1] - my) / half]; });
  return out;
}

// inset: a margin (in %) the columns keep from the frame's sides, so the
// names on a figure's outer stars stay inside it
function layout(cols, rows, spreadX, spreadY, inset = 0) {
  return catalogue.map((d, i) => {
    // A short last row is centred instead of left-aligned
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, catalogue.length - row * cols);
    const cx = inset + ((i % cols) + 0.5 + (cols - inRow) / 2) / cols * (100 - 2 * inset);
    const cy = (Math.floor(i / cols) + 0.5) / rows * 100;
    const sky = SKY[d.id], box = chart(sky), at = {};
    Object.keys(box).forEach((k) => { at[k] = [cx + box[k][0] * spreadX, cy + box[k][1] * spreadY]; });
    return { cx, cy, sky, at, pts: sky.services.map((k) => at[k]) };
  });
}

const desk = layout(3, 2, 10, 15, 5);
const mob = layout(2, Math.ceil(catalogue.length / 2), 14, 8);

function lines(lay) {
  return lay.map((g) => g.sky.lines.map(([p, q]) => {
    const a = g.at[p], b = g.at[q];
    return `<line x1="${a[0].toFixed(2)}" y1="${a[1].toFixed(2)}" x2="${b[0].toFixed(2)}" y2="${b[1].toFixed(2)}"/>`;
  }).join("")).join("");
}

let starIndex = 0;
const stars = catalogue.map((d, i) => {
  const sky = desk[i].sky;
  const label = `<span class="cx-const-label" style="--x:${desk[i].cx.toFixed(2)}%;--y:${(desk[i].cy - 21).toFixed(2)}%;--mx:${mob[i].cx.toFixed(2)}%;--my:${(mob[i].cy - 13).toFixed(2)}%"><b>${esc(sky.name)}</b><i aria-hidden="true">·</i>${esc(d.name)}</span>`;
  // the figure's other stars: faint, not interactive
  const dim = Object.keys(desk[i].at).filter((k) => !sky.services.includes(k)).map((k) => {
    const [x, y] = desk[i].at[k], [mx, my] = mob[i].at[k];
    return `<i class="cx-dim" style="--x:${x.toFixed(2)}%;--y:${y.toFixed(2)}%;--mx:${mx.toFixed(2)}%;--my:${my.toFixed(2)}%;--d:${(Math.random() * 3).toFixed(2)}s"></i>`;
  }).join("");
  const btns = d.services.map((s, k) => {
    const [x, y] = desk[i].pts[k];
    const [mx, my] = mob[i].pts[k];
    const size = (10 + Math.min(s.subs.length, 17) * 0.9).toFixed(1);
    const side = sky.side && sky.side[sky.services[k]] ? " cx-star--" + sky.side[sky.services[k]] : "";
    return `<button class="cx-star${side}" type="button" data-star="${starIndex++}" style="--x:${x.toFixed(2)}%;--y:${y.toFixed(2)}%;--mx:${mx.toFixed(2)}%;--my:${my.toFixed(2)}%;--s:${size}px;--d:${(Math.random() * 3).toFixed(2)}s" aria-label="${esc(s.name)}, ${esc(d.name)}"><i></i><span>${esc(s.name)}</span></button>`;
  }).join("");
  return label + dim + btns;
}).join("");

page = replaceBlock(page, "starmap", `
          <svg class="cx-map-lines cx-map-lines--desk" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines(desk)}</svg>
          <svg class="cx-map-lines cx-map-lines--mob" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines(mob)}</svg>
          ${stars}
        `, pageFile);

// The belt (services/index.html .cx-belt): the tools we build with, one
// or two per service. The near row is the belt's front arc, the far row
// its back arc (it drifts the other way, as the far side of a ring does).
// Between the names, small asteroids tumbling in 3D (services.js draws
// the shapes): each names its shape (data-km), and gets its own size,
// pace, direction and drift from its place in the row.
const BELT_NEAR = [
  "JavaScript", "TypeScript",        // the languages we write in
  "React", "Next.js",                // Web Development
  "Shopify", "Magento",              // E-commerce Development
  "Laravel", "Node.js",              // Custom Platforms
  { home: "CRAMS" },                 // ours: built in-house (its own look)
  "Flutter", "React Native",         // Mobile App Development
  "TensorFlow",                      // Artificial Intelligence
  "Unity", "Unreal Engine"           // AR / VR & Mixed Reality
];
const BELT_FAR = [
  "Python", "PHP",                   // more of the languages
  "Figma",                           // UI/UX Design
  "After Effects", "Blender",        // 2D/3D Video Animation
  "SAP", "Odoo",                     // ERP & CRM
  "Jira", "GitHub",                  // IT Resource Outsourcing
  "AWS", "Azure"                     // Cloud Transformation
];
const KBO_SHAPES = ["48% 52% 44% 56% / 55% 45% 55% 45%", "60% 40% 52% 48% / 42% 58% 46% 54%", "44% 56% 62% 38% / 50% 44% 56% 50%", "52% 48% 40% 60% / 60% 50% 50% 40%"];
// CRAMS, the software we build ourselves, is the belt's home world: the
// brand's gradient, a small moon on a tilted orbit, a line of its own
// (services.css .cx-home). The rest keep the belt's plain lettering.
// it links to its own page (crams/index.html)
const homeWorld = (name) => `<a class="cx-home" href="../crams/index.html" data-cursor="Explore"><small aria-hidden="true">Built in-house · Worx</small><b>${esc(name)}</b><i class="cx-home-orbit" aria-hidden="true"><i class="cx-home-moon"><i></i></i></i></a>`;
const belt = (list, seed) => list.map((w, i) => {
  const n = i + seed;
  const kbo = `<i class="cx-kbo" aria-hidden="true" data-km="${(n * 5) % 8}" style="--kr:${KBO_SHAPES[n % 4]};--ks:${(0.75 + ((n * 37) % 50) / 100).toFixed(2)};--kt:${7 + ((n * 53) % 9)}s;--kd:${n % 3 ? "normal" : "reverse"};--ka:${(n * 67) % 360}deg;--kf:${(4 + ((n * 29) % 5)).toFixed(0)}s"></i>`;
  if (w.home) return homeWorld(w.home) + kbo;
  return `<span${i % 2 ? ' class="is-outline"' : ""}>${esc(w)}</span>${kbo}`;
}).join("");
page = replaceBlock(page, "marquee-1", belt(BELT_NEAR, 0), pageFile);
page = replaceBlock(page, "marquee-2", belt(BELT_FAR, 5), pageFile);
page = replaceBlock(page, "count-tools", String(BELT_NEAR.length + BELT_FAR.length), pageFile);

// Mission builder chips, grouped by division
page = replaceBlock(page, "mission", catalogue.map((d) => `
          <div class="cx-mission-group">
            <p>${esc(d.name)}</p>
            ${d.services.map((s) => `<button type="button" class="cx-chip" aria-pressed="false" data-mission="${esc(s.name)}">${esc(s.name)}</button>`).join("\n            ")}
          </div>`).join("") + "\n        ", pageFile);

// Counts used in copy
page = replaceBlock(page, "count-services", String(services.length), pageFile);
page = replaceBlock(page, "count-divisions", String(catalogue.length), pageFile);
page = replaceBlock(page, "count-caps", String(capRounded), pageFile);

// Slim catalogue for services.js (star cards, flight crews)
const json = services.map((s) => ({
  slug: s.slug, name: s.name, division: s.division.name, divIndex: s.di,
  short: s.short, subs: s.subs, href: href(s, "../")
}));
page = replaceBlock(page, "catalogue-json", `\n  <script type="application/json" id="cx-catalogue">${JSON.stringify(json)}</script>\n  `, pageFile);

fs.writeFileSync(pageFile, page);

/* ---- 3. Contact page: the same services for the planner ------ */
const contactFile = path.join(ROOT, "contact/index.html");
let contact = fs.readFileSync(contactFile, "utf8");
// ...and, last, what Worx sells: CRAMS (crams/index.html), so "Book a demo" arrives ticked
const contactList = catalogue.map((d) => ({ division: d.name, services: d.services.map((s) => s.name) }))
  .concat([{ division: "Products", services: ["CRAMS"] }]);
contact = replaceBlock(contact, "contact-services", `<script type="application/json" id="cw-services">${JSON.stringify(contactList)}</script>`, contactFile);
fs.writeFileSync(contactFile, contact);

console.log("mega menu written to partials/header.html");
require("../site/build.js");
console.log(`${catalogue.length} divisions, ${services.length} services, ${capCount} capabilities`);
