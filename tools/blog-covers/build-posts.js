/* ============================================================
   Blog pages, builds the article pages and the blog index from
   posts.js, using blogs/performance-seo.html as the page template
   (header, share bar, reading layout, CTA, footer, scripts).

   - New posts (with a body in posts.js) are written as full pages.
   - Hand-written posts (existing: true) keep their content; only the
     cover image, author and related articles are refreshed.
   - blogs/index.html gets the category filter, the featured post
     (newest) and the card grid rebuilt.

   Usage (from this folder): node build-posts.js
   Covers: the photos in static/assets/blog/, named by post (COVERS
   below), as cut to the frames' shape by web-covers.js into
   static/assets/blog/web/ (16:9) and web/4x3/ (the home page's cards).
   ============================================================ */

const fs = require("fs");
const path = require("path");
const posts = require("./posts.js");

const ROOT = path.resolve(__dirname, "../..");
const BLOG = path.join(ROOT, "blogs");
const AUTHOR = "Worx";
const CATEGORIES = [
  ["engineering", "Engineering"],
  ["strategy", "Strategy"],
  ["experience", "Experience Design"],
  ["mobile", "Mobile Apps"],
  ["seo", "SEO &amp; Growth"]
];

const esc = (s) => s.replace(/&(?!amp;|lt;|gt;|quot;|#)/g, "&amp;").replace(/"/g, "&quot;");
const words = (html) => html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;

function readingTime(post) {
  if (post.body) return Math.max(3, Math.round(words(post.body) / 220));
  const html = fs.readFileSync(path.join(BLOG, post.slug + ".html"), "utf8");
  const m = html.match(/<span class="meta-label">Reading time<\/span>\s*<strong>(\d+) min read<\/strong>/);
  return m ? +m[1] : 4;
}
posts.forEach((p) => { p.minutes = readingTime(p); });

// each post's feature photo, by its file name in static/assets/blog/
const COVERS = {
  "generative-search": "Generative Search",
  "technical-seo-launch": "Technical SEO Launch",
  "app-launch-checklist": "App Launch Checklist",
  "native-vs-cross-platform": "Native vs Cross-Platform",
  "bilingual-websites": "Bilingual Websites",
  "website-timeline": "Website Timeline",
  "headless-commerce": "Headless Commerce",
  "performance-seo": "Performance SEO",
  "choosing-your-stack": "Choosing Your Stack",
  "ar-activations": "AR Activations"
};
const coverSrc = (slug) => "../static/assets/blog/web/" + encodeURIComponent(COVERS[slug] || slug) + ".jpg";

function picture(slug, alt, cls, eager) {
  return `<picture${cls ? ` class="${cls}"` : ""}>
            <img src="${coverSrc(slug)}" alt="${esc(alt)}" width="1920" height="1080"${eager ? "" : ' loading="lazy"'} decoding="async">
          </picture>`;
}

function featureBlock(p) {
  return `<div class="blog-feature-wrap">
        <div class="blog-feature-art blog-feature-art--image">
          ${picture(p.slug, "", "", true)}
        </div>
      </div>`;
}

function related(p) {
  const same = posts.filter((o) => o !== p && o.filter === p.filter);
  const rest = posts.filter((o) => o !== p && o.filter !== p.filter);
  return same.concat(rest).slice(0, 2).map((o) => `
          <a class="related-card" href="${o.slug}.html">
            <span class="related-category">${o.category.replace("&", "&amp;")}</span>
            <h3>${o.title}</h3>
            <span class="related-arrow">↗</span>
          </a>`).join("\n");
}

function replaceBetween(html, startRe, endStr, replacement) {
  const m = html.match(startRe);
  if (!m) throw new Error("template marker not found: " + startRe);
  const a = m.index;
  const b = html.indexOf(endStr, a);
  if (b < 0) throw new Error("template end not found: " + endStr);
  return html.slice(0, a) + replacement + html.slice(b + endStr.length);
}

function refreshCommon(html, p) {
  html = html.replace(/(<span class="meta-label">Written by<\/span>\s*<strong>)[^<]*(<\/strong>)/, "$1" + AUTHOR + "$2");
  html = replaceBetween(html, /<div class="blog-feature-wrap">/, "</div>\n      </div>", featureBlock(p));
  html = html.replace(/(<div class="related-grid">)[\s\S]*?(\n        <\/div>\n      <\/div>\n    <\/section>)/, "$1" + related(p) + "$2");
  return html;
}

// ---------- article pages ----------
const template = fs.readFileSync(path.join(BLOG, "performance-seo.html"), "utf8");

posts.forEach((p) => {
  const file = path.join(BLOG, p.slug + ".html");
  if (p.existing) {
    let html = fs.readFileSync(file, "utf8");
    html = refreshCommon(html, p);
    fs.writeFileSync(file, html);
    return;
  }
  let html = template;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${p.title} - Worx</title>`);
  html = html.replace(/(<meta name="description"\s+content=")[^"]*(")/, "$1" + esc(p.intro) + "$2");
  html = html.replace(/(<p class="blog-post-category">)[^<]*(<\/p>)/, "$1" + p.category.replace("&", "&amp;") + "$2");
  html = html.replace(/(<h1>)[^<]*(<\/h1>)/, "$1" + p.title + "$2");
  html = html.replace(/(<p class="blog-post-intro">)[\s\S]*?(<\/p>)/, "$1\n            " + p.intro + "\n          $2");
  html = html.replace(/(<span class="meta-label">Published<\/span>\s*<strong>)[^<]*(<\/strong>)/, "$1" + p.date + "$2");
  html = html.replace(/(<span class="meta-label">Reading time<\/span>\s*<strong>)[^<]*(<\/strong>)/, "$1" + p.minutes + " min read$2");
  html = html.replace(/(<nav class="blog-toc" aria-label="Article contents">\s*<span class="toc-title">In this article<\/span>)[\s\S]*?(\s*<\/nav>)/,
    "$1\n" + p.toc.map((t) => `            <a href="#${t[0]}">${t[1]}</a>`).join("\n") + "$2");
  const content = `<div class="blog-article-content">
${p.body}
            <div class="article-cta">
              <div>
                <span class="article-cta-kicker">${p.cta[0]}</span>
                <h3>${p.cta[1]}</h3>
              </div>
              <a class="bc-call" href="https://wa.me/971586190026" target="_blank" rel="noopener">
                <span class="bc-call-face" aria-hidden="true"><img src="../static/assets/home/marwan-face.webp" alt="" width="52" height="52" decoding="async"><i></i></span>
                <span class="bc-call-txt"><small aria-hidden="true"><span>Crew online</span><span>Marwan answers</span></small><b>Quick Enquiry</b></span>
                <span class="bc-call-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
                <span class="bc-call-vf" aria-hidden="true"></span>
              </a>
            </div>

            <div class="article-end">
              <a href="index.html" class="article-back">← All articles</a>
            </div>
          </div>
        </div>
      </div>
    </article>`;
  html = replaceBetween(html, /<div class="blog-article-content">/, "</article>", content);
  html = refreshCommon(html, p);
  fs.writeFileSync(file, html);
});

// ---------- index ----------
const byline = (p) => `<p class="blog-byline"><span>By ${AUTHOR}</span><span class="blog-byline-dot" aria-hidden="true"></span><span>${p.minutes} minutes read</span></p>`;
const [featured, ...rest] = posts;

// the category filter: channels on the title card, each with its count
const two = (n) => String(n).padStart(2, "0");
const count = (k) => posts.filter((p) => p.filter === k).length;
const cats = [`<button class="blog-cat is-active" type="button" data-filter="all" aria-pressed="true"><span class="blog-cat-name">All categories</span><span class="blog-cat-n" aria-hidden="true">${two(posts.length)}</span></button>`]
  .concat(CATEGORIES.map(([k, label]) => `<button class="blog-cat" type="button" data-filter="${k}" aria-pressed="false"><span class="blog-cat-name">${label}</span><span class="blog-cat-n" aria-hidden="true">${two(count(k))}</span></button>`))
  .map((b) => "            " + b).join("\n");

const cards = rest.map((p, i) => `        <article class="blog-card" data-category="${p.filter}">
          <a class="blog-card-media" href="${p.slug}.html" tabindex="-1" aria-hidden="true">
            ${picture(p.slug, "", "", false)}
          </a>
          <div class="blog-card-body">
            <span class="blog-card-log" aria-hidden="true">LOG ${two(i + 2)}</span>
            <span class="blog-pill">${p.category.replace("&", "&amp;")}</span>
            <h3 class="blog-card-title"><a href="${p.slug}.html">${p.title}</a></h3>
            ${byline(p)}
          </div>
        </article>`).join("\n");

const main = `  <main id="main" class="blog-page">

    <!-- Built by tools/blog-covers/build-posts.js from posts.js. The
         logbook: a HUD title card (the About page's panel, at its angle)
         holding the title and the category filter as log rows, the newest
         post beside it as the incoming transmission, then the logs.
         blog-cinema.js adds the frame, the comms rail and the tracker. -->
    <section class="blog-head bl-hero" aria-labelledby="bl-title">
      <div class="container bl-hero-grid">
        <div class="bl-card">
          <div class="bl-card-head" aria-hidden="true">
            <span class="bp-rec"></span>
            <span class="bl-card-call">WORX · FIELD NOTES</span>
            <span class="bl-card-count">${two(posts.length)} LOGS</span>
          </div>
          <p class="bl-status" aria-hidden="true">ARCHIVE · OPEN</p>
          <h1 id="bl-title" class="bl-title">Notes from the <span class="gradient-text">workbench</span></h1>
          <p class="bl-sub">Field notes from the crew that builds it: engineering, strategy, experience design, mobile and growth.</p>
          <div class="blog-cats" role="group" aria-label="Filter posts by category">
${cats}
          </div>
        </div>

        <article class="blog-featured" data-category="${featured.filter}">
          <div class="bl-tx-bar" aria-hidden="true"><span class="bp-rec"></span><span>LOG 01 · INCOMING TRANSMISSION</span><span class="bl-tx-new">NEW</span></div>
          <a class="blog-featured-media" href="${featured.slug}.html" tabindex="-1" aria-hidden="true">
            ${picture(featured.slug, "", "", true)}
          </a>
          <div class="blog-featured-body">
            <span class="blog-pill">${featured.category.replace("&", "&amp;")}</span>
            <h2 class="blog-featured-title"><a href="${featured.slug}.html">${featured.title}</a></h2>
            ${byline(featured)}
          </div>
        </article>
      </div>
    </section>

    <section class="blog-list container" aria-label="Posts">
      <div class="blog-grid">
${cards}
      </div>

      <p class="blog-empty" hidden>No posts in this category yet. Check back soon.</p>
    </section>

  </main>`;

const indexFile = path.join(BLOG, "index.html");
let index = fs.readFileSync(indexFile, "utf8");
index = replaceBetween(index, /  <main id="main"[^>]*>/, "</main>", main);
fs.writeFileSync(indexFile, index);

console.log("Built " + posts.filter((p) => !p.existing).length + " new posts, refreshed " + posts.filter((p) => p.existing).length + ", index with " + posts.length + " posts.");
posts.forEach((p) => console.log("  " + p.slug + "  (" + p.category + ", " + p.date + ", " + p.minutes + " min)"));
