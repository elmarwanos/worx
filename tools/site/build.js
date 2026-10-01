/* ============================================================
   Worx | tools/site/build.js
   Run:  node tools/site/build.js
   The site has one header and one footer: partials/header.html and
   partials/footer.html. This stamps them into every page, with each
   page's own path back to the root ({{root}}: "" at the root, "../"
   one folder down), so the pages stay plain static HTML (no flash of a
   missing header, nothing for search engines to miss) while there is
   only one copy to edit. The active nav link is not baked in: nav.js
   sets it from <body data-page>.
   Stamped blocks sit between <!--WORX:HEADER--> ... <!--/WORX:HEADER-->
   and <!--WORX:FOOTER--> ... <!--/WORX:FOOTER-->, so it can re-run.
   The Services mega menu inside the header comes from
   tools/services/build.js, which writes it into partials/header.html
   and then runs this.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
// the partials' own notes (the leading comment) stay out of the pages
const strip = (s) => s.replace(/^\s*<!--[\s\S]*?-->\s*/, "").trim();
const HEADER = strip(read("partials/header.html"));
const FOOTER = strip(read("partials/footer.html"));

function walk(dir, out) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "tools", "static", "partials"].includes(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (f.name.endsWith(".html")) out.push(p);
  }
  return out;
}

// swap a block for its partial: the marked block if the page has one,
// otherwise the bare element (the first run)
function stamp(html, name, bare, block, file) {
  const marked = new RegExp(`<!--WORX:${name}-->[\\s\\S]*?<!--/WORX:${name}-->`);
  const out = `<!--WORX:${name}-->\n${block}\n  <!--/WORX:${name}-->`;
  if (marked.test(html)) return html.replace(marked, () => out);
  if (bare.test(html)) return html.replace(bare, () => out);
  console.warn(`  ! ${path.relative(ROOT, file)}: no ${name.toLowerCase()} found, left as is`);
  return html;
}

let n = 0;
for (const file of walk(ROOT, [])) {
  const depth = path.relative(ROOT, path.dirname(file)).split(path.sep).filter(Boolean).length;
  const root = "../".repeat(depth);
  let html = fs.readFileSync(file, "utf8");
  const nl = html.includes("\r\n") ? "\r\n" : "\n";
  const put = (s) => s.split("{{root}}").join(root).replace(/\r?\n/g, nl);
  const before = html;
  html = stamp(html, "HEADER", /<header class="site-header"[\s\S]*?<\/header>/, put(HEADER), file);
  html = stamp(html, "FOOTER", /<footer[\s\S]*?<\/footer>/, put(FOOTER), file);
  if (html !== before) { fs.writeFileSync(file, html); n++; }
}
console.log(`header + footer stamped into ${n} page${n === 1 ? "" : "s"}`);
