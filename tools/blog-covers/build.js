/* ============================================================
   Blog feature images, orange Mars covers
   Renders one 1600x1200 cover per post into tools/blog-covers/out/
   (WebP + JPG fallback): a Mars plain graded to the site's ember
   palette under a dusk sky, one or two of the site's own Mars
   renders (the WORX dome, rover, ship, crew, build site, astronaut)
   as the subject, and a glowing orange "hologram" that illustrates
   the article's topic.

   Usage (from this folder):  npm install  then  node build.js [slug]
   Add a cover: add an entry to COVERS (slug, background crop,
   subjects, holo) and run the build.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "../..");
const A = (p) => path.join(ROOT, "static/assets", p);
const ANIM = (p) => path.join(ROOT, "static/assets/portfolio/WORX_animation_assets", p);
// Writes to ./out, not the site: the live covers are the designed ones
// in static/assets/blog-feature-images (see import-covers.js).
const OUT = path.join(__dirname, "out");
const W = 1600;
const H = 1200;

// ---------- palette + SVG helpers ----------
const C = { amber: "#ffb347", orange: "#e77d11", cream: "#ffe3b8", ember: "#c04527", deep: "#140704" };

const DEFS = `
  <defs>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="7" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff9a3c" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#ff7a1a" stop-opacity="0.04"/>
    </linearGradient>
    <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffb347" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#ffb347" stop-opacity="0"/>
    </linearGradient>
  </defs>`;

const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${DEFS}${body}</svg>`);
const FONT = `font-family="Segoe UI, Helvetica Neue, Arial, sans-serif"`;

function panel(x, y, w, h, r = 18) {
  return `<g filter="url(#glow)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#panel)" stroke="${C.amber}" stroke-opacity="0.75" stroke-width="2.5"/>
    <line x1="${x + 18}" y1="${y + 34}" x2="${x + w - 18}" y2="${y + 34}" stroke="${C.amber}" stroke-opacity="0.35" stroke-width="2"/>
    <circle cx="${x + 26}" cy="${y + 18}" r="4" fill="${C.amber}"/><circle cx="${x + 42}" cy="${y + 18}" r="4" fill="${C.amber}" fill-opacity="0.6"/>
  </g>`;
}
function text(x, y, s, size, o = {}) {
  return `<text x="${x}" y="${y}" ${FONT} font-size="${size}" font-weight="${o.weight || 600}" fill="${o.fill || C.cream}" fill-opacity="${o.op || 1}" text-anchor="${o.anchor || "start"}" letter-spacing="${o.ls || 0}" ${o.dir ? `direction="${o.dir}"` : ""} filter="url(#glow)">${s}</text>`;
}
function lines(x, y, w, n, gap = 22, op = 0.55) {
  let out = "";
  for (let i = 0; i < n; i++) {
    const lw = w * (0.55 + ((i * 37) % 45) / 100);
    out += `<rect x="${x}" y="${y + i * gap}" width="${lw}" height="7" rx="3.5" fill="${C.amber}" fill-opacity="${op}"/>`;
  }
  return `<g filter="url(#glow)">${out}</g>`;
}
function beam(x1, x2, top, bottom) {
  return `<polygon points="${x1},${bottom} ${x2},${bottom} ${(x1 + x2) / 2 + 60},${top} ${(x1 + x2) / 2 - 60},${top}" fill="url(#beam)" opacity="0.9"/>`;
}
function check(x, y, s = 1) {
  return `<path d="M${x} ${y} l${9 * s} ${9 * s} l${18 * s} ${-20 * s}" fill="none" stroke="${C.amber}" stroke-width="${5 * s}" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>`;
}
function ring(cx, cy, r, pct, label, value) {
  const c = 2 * Math.PI * r;
  return `<g filter="url(#glow)">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,140,40,0.06)" stroke="${C.amber}" stroke-opacity="0.2" stroke-width="${r * 0.12}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.amber}" stroke-width="${r * 0.12}" stroke-linecap="round"
      stroke-dasharray="${c * pct} ${c}" transform="rotate(-90 ${cx} ${cy})"/>
  </g>
  ${text(cx, cy + r * 0.2, value, r * 0.62, { anchor: "middle", weight: 700 })}
  ${text(cx, cy + r * 0.62, label, r * 0.16, { anchor: "middle", ls: 4, op: 0.8 })}`;
}
function phone(x, y, w, h, inner = "") {
  return `<g filter="url(#glow)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.16}" fill="url(#panel)" stroke="${C.amber}" stroke-width="3"/>
    <rect x="${x + w * 0.36}" y="${y + 14}" width="${w * 0.28}" height="9" rx="4.5" fill="${C.amber}" fill-opacity="0.6"/>
  </g>${inner}`;
}

// ---------- the covers ----------
// bg: crop of mars-story-bg.jpg (7000x3500) as [left fraction, width fraction]
// subjects: { file, x, y (bottom-centre), h, flip }
const COVERS = [
  {
    slug: "performance-seo",
    bg: [0.05, 0.42], sun: [1250, 330],
    subjects: [{ file: A("about/glimpse-ship-open-037.png"), x: 560, y: 1080, h: 760 }],
    holo: () => `${beam(1050, 1420, 700, 1000)}
      ${ring(1220, 420, 190, 1, "PERFORMANCE", "100")}
      ${ring(1030, 760, 88, 0.97, "SEO", "100")}
      ${ring(1400, 760, 88, 0.95, "BEST PRACTICE", "100")}
      <g stroke="${C.amber}" stroke-width="3" stroke-linecap="round" filter="url(#glow)" opacity="0.7">
        <line x1="80" y1="210" x2="360" y2="210"/><line x1="140" y1="250" x2="460" y2="250"/><line x1="60" y1="290" x2="300" y2="290"/>
      </g>`
  },
  {
    slug: "choosing-your-stack",
    bg: [0.3, 0.42], sun: [300, 300],
    subjects: [{ file: A("about/glimpse-habitat-039.png"), x: 820, y: 1110, h: 640 }],
    holo: () => {
      const slab = (y, label, op) => `<g filter="url(#glow)">
        <polygon points="560,${y} 800,${y - 90} 1040,${y} 800,${y + 90}" fill="rgba(255,150,50,${op})" stroke="${C.amber}" stroke-width="3"/>
        <polyline points="560,${y} 560,${y + 22} 800,${y + 112} 1040,${y + 22} 1040,${y}" fill="none" stroke="${C.amber}" stroke-opacity="0.6" stroke-width="2.5"/>
      </g>${text(1090, y + 12, label, 34, { ls: 5 })}`;
      return `${beam(640, 960, 160, 520)}${slab(430, "CMS", 0.12)}${slab(300, "HEADLESS", 0.16)}${slab(170, "CUSTOM", 0.22)}`;
    }
  },
  {
    slug: "ar-activations",
    bg: [0.5, 0.42], sun: [800, 250],
    subjects: [{ file: A("about/glimpse-crew-salute-038.png"), x: 800, y: 1170, h: 620 }],
    holo: () => `<g filter="url(#glow)" fill="none" stroke="${C.amber}">
        <ellipse cx="800" cy="340" rx="420" ry="110" stroke-width="3" stroke-opacity="0.9"/>
        <ellipse cx="800" cy="340" rx="310" ry="80" stroke-width="2.5" stroke-opacity="0.7"/>
        <ellipse cx="800" cy="340" rx="200" ry="52" stroke-width="2" stroke-opacity="0.55"/>
        <path d="M800 150 l110 64 v128 l-110 64 l-110 -64 v-128 z" stroke-width="3" fill="rgba(255,150,50,0.1)"/>
        <path d="M800 150 v128 m0 0 l110 64 m-110 -64 l-110 64" stroke-width="2" stroke-opacity="0.7"/>
      </g>
      <ellipse cx="800" cy="600" rx="330" ry="40" fill="#ffb347" opacity="0.18" filter="url(#soft)"/>
      ${beam(560, 1040, 400, 680)}
      ${text(800, 110, "AR · LIVE", 34, { anchor: "middle", ls: 10, op: 0.85 })}`
  },
  {
    slug: "headless-commerce",
    bg: [0.18, 0.42], sun: [1300, 260],
    subjects: [{ file: A("about/glimpse-rover-035.png"), x: 430, y: 1120, h: 470 }],
    holo: () => {
      const node = (x, y, label) => `${panel(x - 110, y - 50, 220, 100, 16)}${text(x, y + 22, label, 30, { anchor: "middle", ls: 4 })}`;
      return `<g stroke="${C.amber}" stroke-width="3" stroke-dasharray="10 10" filter="url(#glow)" opacity="0.85">
          <line x1="1180" y1="470" x2="930" y2="230"/><line x1="1180" y1="470" x2="1430" y2="230"/>
          <line x1="1180" y1="470" x2="930" y2="720"/><line x1="1180" y1="470" x2="1430" y2="720"/>
        </g>
        <g filter="url(#glow)"><circle cx="1180" cy="470" r="92" fill="rgba(255,150,50,0.16)" stroke="${C.amber}" stroke-width="4"/></g>
        ${text(1180, 486, "API", 46, { anchor: "middle", weight: 700, ls: 4 })}
        ${node(930, 230, "WEB")}${node(1430, 230, "APP")}${node(930, 720, "STORE")}${node(1430, 720, "KIOSK")}`;
    }
  },
  {
    slug: "website-timeline",
    bg: [0.42, 0.42], sun: [260, 280],
    subjects: [{ file: A("about/glimpse_landing_frames_001-032/glimpse-rover-036.png"), x: 800, y: 1150, h: 560 }],
    holo: () => {
      const bar = (y, x, w, label, op) => `<g filter="url(#glow)"><rect x="${x}" y="${y}" width="${w}" height="44" rx="22" fill="rgba(255,150,50,${op})" stroke="${C.amber}" stroke-width="2.5"/></g>${text(x + 22, y + 31, label, 24, { ls: 3 })}`;
      let wk = "";
      for (let i = 0; i < 9; i++) wk += `<line x1="${260 + i * 135}" y1="120" x2="${260 + i * 135}" y2="520" stroke="${C.amber}" stroke-opacity="0.18" stroke-width="2"/>`;
      return `${panel(200, 70, 1200, 490, 22)}${wk}
        ${bar(150, 260, 300, "DISCOVER", 0.18)}${bar(240, 470, 380, "DESIGN", 0.2)}${bar(330, 720, 480, "BUILD", 0.24)}${bar(420, 1110, 230, "LAUNCH", 0.3)}
        <g filter="url(#glow)"><polygon points="1350,430 1374,454 1350,478 1326,454" fill="${C.amber}"/></g>`;
    }
  },
  {
    slug: "bilingual-websites",
    bg: [0.62, 0.38], sun: [800, 230],
    subjects: [{ file: A("about/glimpse-landing-034-level.png"), x: 800, y: 1150, h: 600 }],
    holo: () => `${panel(170, 120, 470, 330)}${panel(960, 120, 470, 330)}
      ${text(210, 230, "Hello", 72, { weight: 700 })}${lines(210, 280, 360, 5, 28)}
      ${text(1390, 230, "مرحبا", 76, { weight: 700, anchor: "end" })}
      <g transform="translate(1390 280) scale(-1 1)">${lines(0, 0, 360, 5, 28)}</g>
      <g fill="none" stroke="${C.amber}" stroke-width="4" stroke-linecap="round" filter="url(#glow)">
        <path d="M690 250 h210 m-26 -22 l26 22 l-26 22"/><path d="M910 330 h-210 m26 -22 l-26 22 l26 22"/>
      </g>
      ${text(800, 410, "EN · ع", 30, { anchor: "middle", ls: 6, op: 0.85 })}`
  },
  {
    slug: "native-vs-cross-platform",
    bg: [0.1, 0.42], sun: [800, 240],
    subjects: [{ file: ANIM("01_astronaut/walk_right_9/astronaut_walk_01.png"), x: 800, y: 1200, h: 500 }],
    holo: () => {
      const p = (x, label, inner) => phone(x, 150, 230, 440, inner) + text(x + 115, 640, label, 26, { anchor: "middle", ls: 4 });
      return `${beam(560, 1040, 580, 900)}
        ${p(300, "NATIVE", lines(335, 230, 150, 8, 30))}
        ${p(685, "CROSS-PLATFORM", `<g filter="url(#glow)"><rect x="720" y="220" width="160" height="110" rx="14" fill="rgba(255,150,50,0.2)" stroke="${C.amber}" stroke-width="2"/></g>${lines(720, 360, 150, 6, 30)}`)}
        ${p(1070, "PWA", `<g filter="url(#glow)" fill="none" stroke="${C.amber}" stroke-width="3"><circle cx="1185" cy="300" r="60"/><path d="M1125 300 h120 M1185 240 c-40 40 -40 80 0 120 M1185 240 c40 40 40 80 0 120"/></g>${lines(1105, 400, 150, 4, 30)}`)}`;
    }
  },
  {
    slug: "app-launch-checklist",
    bg: [0.34, 0.42], sun: [1260, 300],
    subjects: [
      { file: ANIM("02_rover/rover_still.png"), x: 520, y: 1120, h: 420 },
      { file: ANIM("01_astronaut/walk_right_9/astronaut_walk_05.png"), x: 950, y: 1150, h: 500 }
    ],
    holo: () => {
      let rows = "";
      ["Store listing", "Crash reporting", "Analytics events", "Deep links", "Review build"].forEach((s, i) => {
        const y = 250 + i * 78;
        rows += check(1110, y, 1.1) + text(1170, y + 8, s, 30, { weight: 500 });
      });
      return `${phone(1060, 110, 400, 640)}${text(1260, 200, "LAUNCH", 34, { anchor: "middle", ls: 8 })}${rows}
        <g fill="none" stroke="${C.amber}" stroke-width="3" stroke-dasharray="4 14" stroke-linecap="round" filter="url(#glow)" opacity="0.8">
          <path d="M200 520 C 380 180, 700 120, 980 170"/>
        </g>
        <g filter="url(#glow)"><path d="M990 150 l40 10 l-30 30 z" fill="${C.amber}"/></g>`;
    }
  },
  {
    slug: "technical-seo-launch",
    bg: [0.56, 0.42], sun: [300, 240],
    subjects: [
      { file: ANIM("03_flag/orange/wave_loop_24/flag_wave_06.png"), x: 900, y: 1140, h: 560, anchorX: 150 / 760 },
      { file: ANIM("01_astronaut/walk_right_9/astronaut_walk_01.png"), x: 760, y: 1150, h: 460 }
    ],
    holo: () => {
      let res = "";
      for (let i = 0; i < 3; i++) {
        const y = 320 + i * 110;
        res += `<g filter="url(#glow)"><rect x="170" y="${y}" width="560" height="86" rx="14" fill="rgba(255,150,50,${i ? 0.06 : 0.2})" stroke="${C.amber}" stroke-opacity="${i ? 0.4 : 0.9}" stroke-width="2.5"/></g>
          ${text(200, y + 36, i ? "Result" : "#1  Your page", 28, { weight: i ? 500 : 700, op: i ? 0.6 : 1 })}${lines(200, y + 54, 380, 1, 0, i ? 0.3 : 0.6)}`;
      }
      return `${panel(140, 150, 620, 520, 22)}
        <g filter="url(#glow)"><rect x="170" y="200" width="560" height="74" rx="37" fill="rgba(255,150,50,0.1)" stroke="${C.amber}" stroke-width="3"/>
          <circle cx="215" cy="237" r="16" fill="none" stroke="${C.amber}" stroke-width="4"/><line x1="227" y1="249" x2="242" y2="264" stroke="${C.amber}" stroke-width="4" stroke-linecap="round"/></g>
        ${lines(270, 233, 300, 1, 0, 0.6)}${res}`;
    }
  },
  {
    slug: "generative-search",
    bg: [0.74, 0.26], sun: [1180, 260],
    subjects: [
      { file: A("about/glimpse-habitat-039.png"), x: 470, y: 1080, h: 470 },
      { file: ANIM("01_astronaut/walk_right_9/astronaut_walk_03.png"), x: 1080, y: 1160, h: 470 }
    ],
    holo: () => `${panel(780, 120, 640, 470, 26)}
      <g filter="url(#glow)"><path d="M860 230 l14 -38 l14 38 l38 14 l-38 14 l-14 38 l-14 -38 l-38 -14 z" fill="${C.amber}"/></g>
      ${text(930, 262, "Answer", 40, { weight: 700 })}
      ${lines(830, 320, 520, 5, 34)}
      <g filter="url(#glow)" fill="rgba(255,150,50,0.18)" stroke="${C.amber}" stroke-width="2">
        <rect x="830" y="500" width="150" height="44" rx="22"/><rect x="1000" y="500" width="150" height="44" rx="22"/><rect x="1170" y="500" width="150" height="44" rx="22"/>
      </g>
      ${text(905, 530, "source", 22, { anchor: "middle", op: 0.85 })}${text(1075, 530, "source", 22, { anchor: "middle", op: 0.85 })}${text(1245, 530, "source", 22, { anchor: "middle", op: 0.85 })}`
  }
];

// ---------- scene ----------
function starfield(seed) {
  let s = seed, out = "";
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 140; i++) {
    const y = r() * 520;
    out += `<circle cx="${(r() * W).toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.6 + r() * 1.6).toFixed(2)}" fill="#ffe7c4" fill-opacity="${(0.25 + r() * 0.6) * (1 - y / 620)}"/>`;
  }
  return out;
}

async function render(cover, i) {
  const bgMeta = await sharp(A("about/mars-story-bg.jpg")).metadata();
  const left = Math.round(bgMeta.width * cover.bg[0]);
  const width = Math.round(bgMeta.width * cover.bg[1]);
  const height = Math.round(width * H / W);
  const top = Math.max(0, bgMeta.height - height);

  // Mars plain, darkened and pushed to ember
  const base = await sharp(A("about/mars-story-bg.jpg"))
    .extract({ left, top, width, height: Math.min(height, bgMeta.height) })
    .resize(W, H, { fit: "cover", position: "bottom" })
    .modulate({ brightness: 0.66, saturation: 1.2 })
    .composite([{ input: svg('<rect width="' + W + '" height="' + H + '" fill="#ff8a40" opacity="0.35"/>'), blend: "multiply" }])
    .toBuffer();

  const [sx, sy] = cover.sun;
  const sky = svg(`
    <rect width="${W}" height="${H}" fill="url(#skyfade)"/>
    <defs>
      <linearGradient id="skyfade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0d0403" stop-opacity="1"/>
        <stop offset="0.28" stop-color="#1c0905" stop-opacity="0.95"/>
        <stop offset="0.5" stop-color="#3a1307" stop-opacity="0.55"/>
        <stop offset="0.66" stop-color="#5c1c07" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="sun" cx="${sx / W}" cy="${sy / H}" r="0.45">
        <stop offset="0" stop-color="#ffb35c" stop-opacity="0.5"/>
        <stop offset="0.35" stop-color="#e2641c" stop-opacity="0.18"/>
        <stop offset="1" stop-color="#e2641c" stop-opacity="0"/>
      </radialGradient>
    </defs>
    ${starfield(1000 + i * 77)}
    <rect width="${W}" height="${H}" fill="url(#sun)"/>`);

  const layers = [{ input: sky, blend: "over" }];

  // subjects, graded to the scene, with a contact shadow
  for (const s of cover.subjects) {
    const img = sharp(s.file).trim({ threshold: 1 });
    // keep the render's own colours; just seat it in the warm light
    const sized = await img.resize({ height: s.h }).modulate({ brightness: 0.9, saturation: 1.05 }).png().toBuffer();
    const sm = await sharp(sized).metadata();
    const warm = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="' + sm.width + '" height="' + sm.height + '"><rect width="100%" height="100%" fill="#ffb070" opacity="0.22"/></svg>');
    const buf = await sharp(sized).composite([{ input: warm, blend: "multiply" }, { input: sized, blend: "dest-in" }]).png().toBuffer();
    const m = await sharp(buf).metadata();
    const ax = s.anchorX != null ? s.anchorX : 0.5;
    const lx = Math.round(s.x - m.width * ax);
    const ty = Math.round(s.y - m.height);
    layers.push({
      input: svg(`<ellipse cx="${s.x}" cy="${s.y - 6}" rx="${m.width * 0.42}" ry="${Math.max(14, m.width * 0.05)}" fill="#0a0302" opacity="0.55" filter="url(#soft)"/>`),
      blend: "over"
    });
    layers.push({ input: buf, left: Math.max(-m.width, lx), top: ty });
  }

  // hologram, screened on
  layers.push({ input: svg(cover.holo()), blend: "screen" });

  // haze, rim light and vignette
  layers.push({
    input: svg(`
      <defs>
        <radialGradient id="vig" cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
          <stop offset="1" stop-color="#050101" stop-opacity="0.75"/>
        </radialGradient>
        <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.6" stop-color="#e2641c" stop-opacity="0"/>
          <stop offset="0.85" stop-color="#e2641c" stop-opacity="0.12"/>
          <stop offset="1" stop-color="#140704" stop-opacity="0.55"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#haze)"/>
      <rect width="${W}" height="${H}" fill="url(#vig)"/>`),
    blend: "over"
  });

  const out = sharp(base).composite(layers);
  const flat = await out.png().toBuffer();
  fs.mkdirSync(OUT, { recursive: true });
  await sharp(flat).webp({ quality: 80, effort: 6 }).toFile(path.join(OUT, cover.slug + ".webp"));
  await sharp(flat).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(OUT, cover.slug + ".jpg"));
  console.log("  " + cover.slug);
}

(async () => {
  const only = process.argv[2];
  console.log("Rendering covers to tools/blog-covers/out/");
  for (let i = 0; i < COVERS.length; i++) {
    if (only && COVERS[i].slug !== only) continue;
    await render(COVERS[i], i);
  }
})().catch((e) => { console.error(e); process.exit(1); });
