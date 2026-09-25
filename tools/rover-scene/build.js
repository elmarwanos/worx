/* ============================================================
   Portfolio hero "Summit" scene — asset build
   Resizes the full-size source PNGs (WORX_animation_assets, ~50 MB)
   to ~2x their on-screen size and writes a WebP + PNG pair for each
   frame into static/assets/portfolio/rover-scene/, the folder
   static/js/rover-scene.js loads from.

   Every asset shares one pixel scale, so every file is resized by
   the SAME factor (ASSET_SCALE). rover-scene.js knows this factor,
   which is why all positions in its CONFIG stay in source pixels.

   Usage (from this folder):
     npm install
     node build.js [path/to/WORX_animation_assets]

   Extra pose frames: drop PNGs (any names, sorted alphabetically)
   into WORX_animation_assets/04_poses/<pose>/ and run this script.
   It writes rover-scene/manifest.json with each pose's frame count,
   which rover-scene.js reads, so new frames are picked up with no
   code change.
   ============================================================ */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ASSET_SCALE = 0.25; // keep in sync with CONFIG.assetScale in rover-scene.js
const ROOT = path.resolve(__dirname, "../..");
const SRC = path.resolve(process.argv[2] || path.join(ROOT, "static/assets/portfolio/WORX_animation_assets"));
const OUT = path.join(ROOT, "static/assets/portfolio/rover-scene");
const POSES = ["kneel_down", "stand_up", "get_in", "get_out", "driving_seated"];
// Near-side tyres in rover_still.png: [name, centre x, centre y] and the
// disc radius (tyre ~155). Keep in sync with CONFIG.rover.wheels.
const WHEELS = [["wheel_rear", 160, 630], ["wheel_front", 1027, 640]];
const WHEEL_R = 152;

function pngsIn(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /\.png$/i.test(f)).sort().map((f) => path.join(dir, f));
}

async function convert(src, outBase) {
  fs.mkdirSync(path.dirname(outBase), { recursive: true });
  const meta = await sharp(src).metadata();
  const w = Math.max(1, Math.round(meta.width * ASSET_SCALE));
  const h = Math.max(1, Math.round(meta.height * ASSET_SCALE));
  const resized = sharp(src).ensureAlpha().resize(w, h, { kernel: "lanczos3" });
  await resized.clone().webp({ quality: 84, alphaQuality: 90, effort: 6 }).toFile(outBase + ".webp");
  await resized.clone().png({ compressionLevel: 9 }).toFile(outBase + ".png");
}

async function sequence(srcDir, outDir, prefix) {
  fs.rmSync(outDir, { recursive: true, force: true });
  const files = pngsIn(srcDir);
  for (let i = 0; i < files.length; i++) {
    await convert(files[i], path.join(outDir, prefix + "_" + String(i + 1).padStart(2, "0")));
  }
  return files.length;
}

(async () => {
  if (!fs.existsSync(SRC)) {
    console.error("Source folder not found: " + SRC);
    process.exit(1);
  }

  const walkR = await sequence(path.join(SRC, "01_astronaut/walk_right_9"), path.join(OUT, "astronaut/walk_right"), "walk_right");
  const walkL = await sequence(path.join(SRC, "01_astronaut/walk_left_9"), path.join(OUT, "astronaut/walk_left"), "walk_left");
  await convert(path.join(SRC, "01_astronaut/kneel/astronaut_kneel_hold.png"), path.join(OUT, "astronaut/kneel_hold"));
  console.log("astronaut: walk right " + walkR + ", walk left " + walkL + " frames, kneel hold");

  await convert(path.join(SRC, "02_rover/rover_still.png"), path.join(OUT, "rover/rover_still"));
  // The near tyres, cut out as discs so rover-scene.js can roll them by
  // distance travelled (the drive loop's spin is too small to read at
  // hero size). Centres fitted to the orange rim rings; the mask sits
  // just inside the tread so no chassis comes along.
  for (const [name, cx, cy] of WHEELS) {
    const size = WHEEL_R * 2;
    const mask = Buffer.from(
      '<svg width="' + size + '" height="' + size + '"><defs><radialGradient id="g">' +
      '<stop offset="' + ((WHEEL_R - 2) / WHEEL_R) + '" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>' +
      '</radialGradient></defs><circle cx="' + WHEEL_R + '" cy="' + WHEEL_R + '" r="' + WHEEL_R + '" fill="url(#g)"/></svg>'
    );
    const disc = await sharp(path.join(SRC, "02_rover/rover_still.png"))
      .extract({ left: cx - WHEEL_R, top: cy - WHEEL_R, width: size, height: size })
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();
    const tmp = path.join(OUT, "rover", "_" + name + ".png");
    fs.mkdirSync(path.dirname(tmp), { recursive: true });
    fs.writeFileSync(tmp, disc);
    await convert(tmp, path.join(OUT, "rover", name));
    fs.rmSync(tmp);
  }
  const drive = await sequence(path.join(SRC, "02_rover/drive_loop_24"), path.join(OUT, "rover/drive"), "rover_drive");
  console.log("rover: drive " + drive + " frames");

  for (const colour of ["orange", "black"]) {
    const plant = await sequence(path.join(SRC, "03_flag", colour, "plant_24"), path.join(OUT, "flag", colour, "plant"), "flag_plant");
    const wave = await sequence(path.join(SRC, "03_flag", colour, "wave_loop_24"), path.join(OUT, "flag", colour, "wave"), "flag_wave");
    console.log("flag " + colour + ": plant " + plant + ", wave " + wave + " frames");
  }

  console.log("\nPose frames (written to rover-scene/manifest.json):");
  const manifest = { assetScale: ASSET_SCALE, poses: {} };
  for (const pose of POSES) {
    const n = await sequence(path.join(SRC, "04_poses", pose), path.join(OUT, "poses", pose), pose);
    manifest.poses[pose] = n;
    console.log("  " + pose + ": " + n + (n ? " frames" : " (built-in technique)"));
  }
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
