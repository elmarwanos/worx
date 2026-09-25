/* ============================================================
   Worx | tools/services/build.js
   Run:  node tools/services/build.js
   Reads catalogue.js and writes the generated blocks:
     1. The Services mega menu into the header of every page
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

function clientCell(slug, name, prefix) {
  const ext = ['svg', 'png', 'webp'].find((e) => fs.existsSync(path.join(LOGO_DIR, slug + '.' + e)));
  const inner = ext
    ? '<img src="' + prefix + 'static/assets/clients/' + slug + '.' + ext + '" alt="' + esc(name) + '" loading="lazy">'
    : '<span>' + esc(name) + '</span>';
  return '<li class="mega-client mega-client--' + slug + (ext ? ' has-logo' : '') + '">' + inner + '</li>';
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
                  <p class="mega-side-title">Trusted by brands<br>across the region</p>
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
              <a href="${prefix}contact/index.html" class="btn btn-primary mega-cta">Speak to an expert</a>
            </div>
          </div>
        </div>`;
}

function walk(dir, out) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "tools", "static"].includes(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (f.name.endsWith(".html")) out.push(p);
  }
  return out;
}

let menuCount = 0;
for (const file of walk(ROOT, [])) {
  let html = fs.readFileSync(file, "utf8");
  const depth = path.relative(ROOT, path.dirname(file)).split(path.sep).filter(Boolean).length;
  const prefix = "../".repeat(depth);
  const block = `<!--WORX:GEN mega-->${megaMenu(prefix)}\n        <!--/WORX:GEN mega-->`;

  if (html.includes("<!--WORX:GEN mega-->")) {
    html = html.replace(/<!--WORX:GEN mega-->[\s\S]*?<!--\/WORX:GEN mega-->/, block);
  } else {
    const link = /<a href="[^"]*services\/index\.html" data-nav="services">Services<\/a>/;
    if (!link.test(html)) continue;
    html = html.replace(link, block);
  }
  fs.writeFileSync(file, html);
  menuCount++;
}

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

// Star map: six constellations laid out on a 3 x 2 grid (desktop)
// and a 2 x 3 grid (mobile). Each service is a star; size follows
// how many capabilities it carries.
const SHAPES = {
  1: [[0, 0]],
  2: [[-0.6, -0.3], [0.6, 0.35]],
  3: [[-0.8, 0.4], [0, -0.6], [0.8, 0.3]],
  4: [[-0.9, 0.1], [-0.25, -0.7], [0.5, -0.2], [0.8, 0.7]],
  5: [[-0.9, 0.5], [-0.55, -0.45], [0.1, -0.8], [0.55, 0.05], [0.95, 0.75]]
};

function layout(cols, rows, spreadX, spreadY) {
  return catalogue.map((d, i) => {
    // A short last row is centred instead of left-aligned
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, catalogue.length - row * cols);
    const cx = ((i % cols) + 0.5 + (cols - inRow) / 2) / cols * 100;
    const cy = (Math.floor(i / cols) + 0.5) / rows * 100;
    const pts = SHAPES[d.services.length].map(([x, y]) => [cx + x * spreadX, cy + y * spreadY]);
    return { cx, cy, pts };
  });
}

const desk = layout(3, 2, 10, 15);
const mob = layout(2, Math.ceil(catalogue.length / 2), 14, 8);

function lines(lay) {
  return lay.map((g) => g.pts.slice(1).map((p, k) => {
    const a = g.pts[k];
    return `<line x1="${a[0].toFixed(2)}" y1="${a[1].toFixed(2)}" x2="${p[0].toFixed(2)}" y2="${p[1].toFixed(2)}"/>`;
  }).join("")).join("");
}

let starIndex = 0;
const stars = catalogue.map((d, i) => {
  const label = `<span class="cx-const-label" style="--x:${desk[i].cx.toFixed(2)}%;--y:${(desk[i].cy - 21).toFixed(2)}%;--mx:${mob[i].cx.toFixed(2)}%;--my:${(mob[i].cy - 13).toFixed(2)}%"><b>${pad(i + 1)}</b>${esc(d.name)}</span>`;
  const btns = d.services.map((s, k) => {
    const [x, y] = desk[i].pts[k];
    const [mx, my] = mob[i].pts[k];
    const size = (10 + Math.min(s.subs.length, 17) * 0.9).toFixed(1);
    return `<button class="cx-star" type="button" data-star="${starIndex++}" style="--x:${x.toFixed(2)}%;--y:${y.toFixed(2)}%;--mx:${mx.toFixed(2)}%;--my:${my.toFixed(2)}%;--s:${size}px;--d:${(Math.random() * 3).toFixed(2)}s" aria-label="${esc(s.name)}, ${esc(d.name)}"><i></i><span>${esc(s.name)}</span></button>`;
  }).join("");
  return label + btns;
}).join("");

page = replaceBlock(page, "starmap", `
          <svg class="cx-map-lines cx-map-lines--desk" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines(desk)}</svg>
          <svg class="cx-map-lines cx-map-lines--mob" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines(mob)}</svg>
          ${stars}
        `, pageFile);

// Marquee: service names on top, the technology underneath
const TECH = ["Shopify", "Flutter", "SAP", "Drupal", "Unity", "Metaverse", "NetSuite", "React Native", "Dynamics 365", "WordPress", "Odoo", "Magento", "Sitecore", "Laravel", "AWS", "Azure"];
const WORDS = ["Products", "Platforms", "Apps", "Interfaces", "Brands", "Animation", "Stories", "AI", "Realities", "Systems", "ERP", "Cloud"];
const marquee = (list) => list.map((w, i) => `<span${i % 2 ? ' class="is-outline"' : ""}>${esc(w)}</span><i>✦</i>`).join("");
page = replaceBlock(page, "marquee-1", marquee(WORDS), pageFile);
page = replaceBlock(page, "marquee-2", marquee(TECH), pageFile);

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

console.log(`mega menu written to ${menuCount} pages`);
console.log(`${catalogue.length} divisions, ${services.length} services, ${capCount} capabilities`);
