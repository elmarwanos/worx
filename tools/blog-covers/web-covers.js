/* ============================================================
   Web copies of the blog feature photos
   The photos in static/assets/blog/ are named by post title
   ("Generative Search.jpg") and come at camera size. This makes the
   copies the pages load, cut to the exact shape of the frames they
   sit in, so a frame shows the whole of its copy (nothing cropped by
   the browser, no gaps, no bleed):
     web/<Title>.jpg      1920x1080, 16:9: the blog page (featured
                          post, grid cards), the post pages' monitor,
                          and the link previews (og:image)
     web/4x3/<Title>.jpg  1200x900, 4:3: the home page's blog cards
   The crop keeps the busiest part of each photo in frame (sharp's
   "attention" strategy), so the subject survives the change of shape.
   The originals are left as they are.

   Usage (from this folder): node web-covers.js
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ROOT, "static/assets/blog");
const SIZES = [
  { dir: "web", w: 1920, h: 1080, q: 80 },
  { dir: "web/4x3", w: 1200, h: 900, q: 80 }
];

(async () => {
  const files = fs.readdirSync(SRC).filter((f) => /\.jpe?g$/i.test(f)).sort();
  for (const s of SIZES) fs.mkdirSync(path.join(SRC, s.dir), { recursive: true });
  for (const file of files) {
    const src = path.join(SRC, file);
    const name = file.replace(/\.jpe?g$/i, ".jpg");
    for (const s of SIZES) {
      const out = path.join(SRC, s.dir, name);
      await sharp(src)
        .rotate()                                     // honour the camera's orientation
        .resize(s.w, s.h, { fit: "cover", position: sharp.strategy.attention })
        .jpeg({ quality: s.q, mozjpeg: true, progressive: true })
        .toFile(out);
      console.log(s.dir + "/" + name + "  " + Math.round(fs.statSync(out).size / 1024) + " KB");
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
