/* ============================================================
   Import the designed blog covers
   Reads the PNGs in static/assets/blog-feature-images/png (named by
   post slug, e.g. generative-search.png, 1600x900) and writes the web
   copies the blog uses into static/assets/blog/:
     <slug>.webp  quality 70 (these covers' grain compresses better
                  this way; the result is smaller than the JPG)
     <slug>.jpg   fallback, quality 82

   Usage (from this folder): node import-covers.js [path/to/png-folder]
   Then run build-posts.js if you added a new post.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "../..");
const SRC = path.resolve(process.argv[2] || path.join(ROOT, "static/assets/blog-feature-images/png"));
const OUT = path.join(ROOT, "static/assets/blog");

(async () => {
  if (!fs.existsSync(SRC)) {
    console.error("Cover folder not found: " + SRC);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  for (const file of fs.readdirSync(SRC).filter((f) => /\.png$/i.test(f)).sort()) {
    const slug = file.replace(/\.png$/i, "");
    const src = path.join(SRC, file);
    await sharp(src).webp({ quality: 70, effort: 6, smartSubsample: true }).toFile(path.join(OUT, slug + ".webp"));
    await sharp(src).flatten({ background: "#140704" }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(OUT, slug + ".jpg"));
    console.log("  " + slug);
  }
})().catch((e) => { console.error(e); process.exit(1); });
