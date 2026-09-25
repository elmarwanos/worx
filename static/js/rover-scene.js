/* ============================================================
   PORTFOLIO HERO — "SUMMIT" (one seamless loop, ~40s)

   The rover crawls in from the left along the ridge at a real
   buggy's pace, easing off on the climbs, brakes (nose dips, dust
   rolls forward) and rocks to a stop just left of the summit. The
   astronaut climbs out, walks to the peak at a suited Mars walk,
   kneels, plants the WORX flag where his glove meets the ground,
   stands, takes a beat, walks back, climbs in; the lamps flare up,
   the rover squats and pulls away past the waving flag, down the
   ridge and off to the right, leaving a dust trail hanging in the
   air. The flag stands alone for a moment; when the rover comes
   back in from the left it sinks and fades, and a fresh one is
   planted.

   Three canvases inside .folio-camera (so the hero's slow push-in
   carries everything with the terrain):
     .rover-scene__flag   the flag, behind everything else
     .rover-scene__main   dust, rover, astronaut, motes (graded in CSS)
     .rover-scene__glow   lamps, strobe, beams, glints (screen blend)

   Ridge lock: the terrain plate is a 2400x1600 image laid out with
   background-size: cover at var(--terrain-pos). CONFIG.ridge is the
   plate's own skyline (first opaque pixel per column, lightly
   smoothed), in image fractions; running the same cover math on
   the live .folio-camera box lands every point on the ridge at any
   window size.

   Frames: static/assets/portfolio/rover-scene/, built by
   tools/rover-scene/build.js (WebP + PNG fallback, resized by
   CONFIG.assetScale, plus manifest.json with the extra-pose frame
   counts). All positions below are in SOURCE pixels, measured on
   the full-size PNGs in WORX_animation_assets.

   New pose frames (kneel_down, stand_up, get_in, get_out,
   driving_seated): drop them in WORX_animation_assets/04_poses/
   <pose>/ and run the build; they replace the built-in technique
   for that move automatically.

   Tuning aid: add ?roverDebug to the URL, then roverScene.seek(12)
   freezes the loop at 12s and roverScene.play() resumes.
   ============================================================ */
(function () {
  "use strict";

  var CONFIG = {
    basePath: "../static/assets/portfolio/rover-scene/",
    assetScale: 0.25, // tools/rover-scene/build.js ASSET_SCALE
    pxPerMeter: 350, // source px: he's ~664px / ~1.9m tall in his suit

    flagColour: "orange", // "orange" | "black"
    flagResetsEachLoop: true, // false: the first flag stays up for good

    // Terrain plate + its skyline (y as a fraction of the image height,
    // sampled every 0.5% of its width from x = 0 to x = 1).
    terrain: { width: 2400, height: 1600, peakX: 0.5112 },
    ridge: [0.5887, 0.5889, 0.5888, 0.5881, 0.5876, 0.5875, 0.5872, 0.5865, 0.5867, 0.5875, 0.5877, 0.5864, 0.5855, 0.5857, 0.5857, 0.5844, 0.5839, 0.5851, 0.5869, 0.5884, 0.5881, 0.5873, 0.5886, 0.5901, 0.5897, 0.5874, 0.5848, 0.5827, 0.5816, 0.5801, 0.5768, 0.5733, 0.5703, 0.5683, 0.5652, 0.5612, 0.5573, 0.5521, 0.5477, 0.5457, 0.5429, 0.5387, 0.533, 0.524, 0.5148, 0.5098, 0.5083, 0.505, 0.4984, 0.4932, 0.4903, 0.4862, 0.4811, 0.4773, 0.4732, 0.469, 0.4652, 0.4606, 0.4569, 0.4552, 0.4523, 0.4479, 0.4427, 0.4382, 0.4343, 0.4305, 0.4281, 0.4268, 0.4259, 0.4262, 0.4275, 0.4278, 0.4267, 0.4255, 0.4241, 0.4228, 0.4225, 0.422, 0.4208, 0.4192, 0.4175, 0.4156, 0.4139, 0.4122, 0.4107, 0.4091, 0.4076, 0.4057, 0.4039, 0.4022, 0.4, 0.3974, 0.392, 0.3845, 0.38, 0.3792, 0.3766, 0.371, 0.366, 0.3646, 0.3636, 0.3612, 0.3598, 0.36, 0.3615, 0.362, 0.3621, 0.3637, 0.3661, 0.3685, 0.3713, 0.374, 0.3774, 0.3811, 0.3838, 0.3863, 0.3888, 0.3912, 0.3935, 0.396, 0.3989, 0.4016, 0.4037, 0.4056, 0.4073, 0.4091, 0.4109, 0.4127, 0.4146, 0.4161, 0.4173, 0.4186, 0.4198, 0.4209, 0.4223, 0.4241, 0.4259, 0.4279, 0.4298, 0.4317, 0.4338, 0.4359, 0.4379, 0.44, 0.4414, 0.4424, 0.4434, 0.4451, 0.448, 0.4501, 0.4495, 0.4479, 0.4475, 0.4475, 0.4472, 0.4469, 0.4466, 0.4459, 0.4451, 0.4442, 0.4433, 0.4424, 0.4416, 0.4406, 0.4398, 0.439, 0.4382, 0.4372, 0.4358, 0.4352, 0.4351, 0.4343, 0.4333, 0.4323, 0.4314, 0.4305, 0.4295, 0.4285, 0.4275, 0.4265, 0.4257, 0.4249, 0.4243, 0.424, 0.4237, 0.4234, 0.4231, 0.4232, 0.4235, 0.4237, 0.4236, 0.4238, 0.4242, 0.4246, 0.4249, 0.425, 0.4253, 0.4259, 0.4262, 0.4262, 0.4262],

    // Astronaut frames: 759x975, ground line y=919. height = standing
    // height, the size reference (matched to the old site astronaut).
    astronaut: {
      height: 664,
      walkRight: { count: 9, anchor: [350, 919] },
      walkLeft: { count: 9, anchor: [409, 919] },
      kneel: { anchor: [350, 919], glove: [530, 905] },
      // walk: suited Mars pace (~1.1 m/s). Frames are tied to distance
      // (one frame per pxPerFrame walked) so the boots never slide.
      pxPerFrame: 75,
      fps: 5, // at cruise; ~1.8s per two-step cycle
      easeFrac: 0.16, // share of each walk spent getting going / stopping
      frameBlend: 0.6, // last share of each frame that dissolves into the next
      seatHip: [352, 590], // hip in walk_right_01, for the seated driver
      // lamps in frame px: pack status LED, visor centre, helmet lamp
      lamps: {
        right: { led: [228, 320], visor: [402, 306], lamp: [372, 280] },
        left: { led: [531, 320], visor: [357, 306], lamp: [387, 280] },
        kneel: { led: [306, 488], visor: [500, 560], lamp: [468, 522] }
      }
    },

    // Rover points, in rover_still.png pixels (drive frames are the same
    // art sitting 4px lower on a 1293x808 canvas).
    rover: {
      contacts: [[160, 785], [1027, 794]], // rear / front tyre ground points (wheel centre + r 155)
      // Tyres roll for real: the near tyres are separate discs (cut from
      // rover_still by the build) turned by distance / radius, so they
      // read as rolling at hero size and can never skid. "frames" uses
      // the 24-frame drive loop instead (its spin is too small to read).
      wheels: {
        mode: "roll", // "roll" | "frames"
        discs: [["wheel_rear", 160, 630], ["wheel_front", 1027, 640]], // name, centre (build.js WHEELS)
        discR: 152,
        tyreR: 155,
        bounce: 3 // source px of body bounce over the terrain while rolling
      },
      driveOffsetY: 4, // "frames" mode: drive art sits 4px lower
      rearX: 3,
      frontX: 1290,
      sillY: 448, // door sill: the seated driver shows only above this line
      seat: [560, 500], // where his hip sits
      exitX: 640, // ground spot beside the door he steps out onto
      cruise: 2.8, // m/s (~10 km/h, a crewed buggy's traverse pace)
      arriveBrake: 0.36, // share of the drive-in spent braking
      departAccel: 0.34, // share of the drive-out spent pulling away
      uphillSlow: 0.5, // speed lost on the steepest climb (0-1)
      downhillFast: 0.18,
      wheelPxPerFrame: 40, // "frames" mode: drive frame per source px travelled
      pitchPerAccel: 0.00011, // rad per source px/s^2: squat / nose dip
      pitchMax: 0.035,
      spring: { stiffness: 42, damping: 6.5 }, // body pitch + sink
      sway: 0.004, // rad, over bumps at cruise
      ghostAbove: 0.7, // speed (of cruise) above which motion ghosts show
      lamps: {
        beacon: [212, 164],
        dish: [440, 169],
        roof: [[425, 213], [590, 193], [690, 197]],
        head: [1150, 444],
        drl: [1068, 415],
        tail: [92, 436],
        strips: [[372, 428], [440, 545], [545, 652], [690, 648], [815, 448]]
      }
    },

    flag: {
      plant: { count: 24, fps: 24, groundFrame: 4 }, // pole bites the ground on frame 5
      wave: { count: 24, fps: 24 },
      anchor: [150, 1060], // pole base
      opacity: 0.94,
      retire: 1.4, // s: old flag sinks + fades as the rover re-enters
      retireSink: 0.07 // of the pole's height
    },

    // Extra pose frames (759x975, same anchors as the walk frames).
    // count is read from manifest.json; 0 = the built-in technique.
    poses: {
      kneel_down: { count: 0, fps: 10 },
      stand_up: { count: 0, fps: 10 },
      get_in: { count: 0, fps: 10 },
      get_out: { count: 0, fps: 10 },
      driving_seated: { count: 0, fps: 10 }
    },

    layout: {
      // source px from the parked rover's nose back to his kneeling spot
      // (he kneels in front of it). 25 makes the walk exactly one 9-frame
      // cycle at 75px/frame: he sets off and arrives on the standing frame.
      noseGap: 25
    },

    // Seconds (drive and walk lengths come from the speeds above).
    timing: {
      settle: 0.8, // rover rocks to rest, dust drifts past
      getOut: 1.2,
      kneelDown: 0.7,
      plantHold: 1.0, // stays down after the flag settles
      standUp: 0.7,
      beat: 1.0, // stands by the flag
      getIn: 1.2,
      ignition: 0.9, // lamps flare, engine rumble, then away
      empty: 2.2 // the flag alone on the summit
    },

    dust: {
      rgb: "210, 146, 102",
      perSrcPx: 0.017, // tyre puffs per wheel per source px
      sprayPerSrcPx: 0.022, // fine grit flung back off the treads
      spraySize: [10, 22],
      brakeBoost: 2,
      size: [28, 70], // source px
      life: [1.3, 2.8],
      grow: 2.6,
      alpha: 0.3,
      trailEvery: 60, // source px between hanging trail puffs
      trailLife: [6, 8.5],
      trailAlpha: 0.075,
      max: 260,
      maxLowPower: 110
    },
    pebbles: { count: 6, gravity: 1300 }, // Mars g in source px/s^2
    motes: { count: 28, countLowPower: 10 },

    lamps: {
      amber: "255, 168, 60",
      orange: "255, 140, 40",
      warm: "255, 214, 160",
      cool: "214, 230, 255",
      red: "255, 60, 36"
    },

    // Camera feel on .folio-camera (the hero text sits outside it).
    camera: { rumble: 0.55, plantDip: 1.1, kneelDip: 0.4 }
  };

  var hero = document.querySelector(".folio-hero");
  var camera = document.querySelector(".folio-camera");
  var media = document.querySelector(".folio-hero-media");
  var flagCanvas = document.querySelector(".rover-scene__flag");
  var mainCanvas = document.querySelector(".rover-scene__main");
  var glowCanvas = document.querySelector(".rover-scene__glow");
  if (!hero || !camera || !media || !flagCanvas || !mainCanvas || !glowCanvas) return;

  var fctx = flagCanvas.getContext("2d");
  var ctx = mainCanvas.getContext("2d");
  var gctx = glowCanvas.getContext("2d");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mqTablet = window.matchMedia("(max-width: 900px)");
  var mqMobile = window.matchMedia("(max-width: 600px)");
  var lowPower = mqMobile.matches ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    !!(navigator.connection && navigator.connection.saveData);
  var ASSET_K = 1 / CONFIG.assetScale; // loaded px -> source px
  var AST = CONFIG.astronaut;
  var RV = CONFIG.rover;
  var H = AST.height;

  // ---------- helpers ----------
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeIn(t) { return t * t; }
  function easeOutBack(t) { var c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function srcW(img) { return (img.naturalWidth || img.width) * ASSET_K; }
  function srcH(img) { return (img.naturalHeight || img.height) * ASSET_K; }

  // Trapezoid speed profile: accelerate over `a`, cruise, brake over `d`
  // (shares of u). Returns the distance fraction; vmax is the cruise
  // speed in distance-per-u, used to size the phase to a real speed.
  function trap(u, a, d) {
    var vmax = 1 / (1 - a / 2 - d / 2);
    if (a > 0 && u < a) return 0.5 * vmax * u * u / a;
    if (d > 0 && u > 1 - d) return 1 - 0.5 * vmax * (1 - u) * (1 - u) / d;
    return vmax * (a / 2 + (u - a));
  }
  function trapVmax(a, d) { return 1 / (1 - a / 2 - d / 2); }

  // ---------- assets ----------
  function webpSupported() {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img.width === 1); };
      img.onerror = function () { resolve(false); };
      img.src = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
    });
  }

  function loadUrl(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var decoded = img.decode ? img.decode().catch(function () {}) : Promise.resolve();
        decoded.then(function () { resolve(img); });
      };
      img.onerror = function () { reject(new Error("rover-scene: failed to load " + url)); };
      img.src = url;
    });
  }

  var EXT = "png";
  function loadAsset(path) {
    var url = CONFIG.basePath + path;
    if (EXT === "png") return loadUrl(url + ".png");
    return loadUrl(url + ".webp").catch(function () { return loadUrl(url + ".png"); });
  }

  function loadSequence(dir, prefix, count) {
    var list = [];
    for (var i = 1; i <= count; i++) list.push(loadAsset(dir + "/" + prefix + "_" + pad(i)));
    return Promise.all(list);
  }

  // manifest.json (written by the build) carries the extra-pose counts.
  function loadManifest() {
    if (!window.fetch) return Promise.resolve();
    return fetch(CONFIG.basePath + "manifest.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (m) {
        if (!m || !m.poses) return;
        Object.keys(m.poses).forEach(function (k) { if (CONFIG.poses[k]) CONFIG.poses[k].count = m.poses[k]; });
      })
      .catch(function () {});
  }

  var IMG = { poses: {} };

  function preload() {
    var colour = CONFIG.flagColour;
    var jobs = [
      loadSequence("astronaut/walk_right", "walk_right", AST.walkRight.count).then(function (a) { IMG.walkRight = a; }),
      loadSequence("astronaut/walk_left", "walk_left", AST.walkLeft.count).then(function (a) { IMG.walkLeft = a; }),
      loadAsset("astronaut/kneel_hold").then(function (i) { IMG.kneel = i; }),
      loadAsset("rover/rover_still").then(function (i) { IMG.roverStill = i; }),
      RV.wheels.mode === "frames"
        ? loadSequence("rover/drive", "rover_drive", 24).then(function (a) { IMG.drive = a; })
        : Promise.all(RV.wheels.discs.map(function (d) { return loadAsset("rover/" + d[0]); })).then(function (a) { IMG.wheels = a; }),
      loadSequence("flag/" + colour + "/plant", "flag_plant", CONFIG.flag.plant.count).then(function (a) { IMG.flagPlant = a; }),
      loadSequence("flag/" + colour + "/wave", "flag_wave", CONFIG.flag.wave.count).then(function (a) { IMG.flagWave = a; })
    ];
    Object.keys(CONFIG.poses).forEach(function (name) {
      jobs.push(loadSequence("poses/" + name, name, CONFIG.poses[name].count).then(function (a) { IMG.poses[name] = a; }));
    });
    return Promise.all(jobs);
  }

  // ---------- layout: cover math on the live camera box ----------
  var L = {};

  function terrainPos() {
    var parts = getComputedStyle(media).getPropertyValue("--terrain-pos").trim().split(/\s+/);
    function frac(v, dflt) {
      if (!v || v === "center") return 0.5;
      if (v === "left" || v === "top") return 0;
      if (v === "right" || v === "bottom") return 1;
      var n = parseFloat(v);
      return isNaN(n) ? dflt : n / 100;
    }
    return [frac(parts[0], 0.5), frac(parts[1], 0.54)];
  }

  // On-screen height of the old CSS astronaut: his box clamps
  // (portfolio.css history), the 700x900 frame contained in it, the
  // figure's 608px of that frame, and his ~0.95 depth scale.
  function astronautScreenHeight(w) {
    var bw, bh;
    if (mqMobile.matches) { bw = 58; bh = 78; }
    else if (mqTablet.matches) { bw = clamp(0.07 * w, 64, 82); bh = clamp(0.09 * w, 86, 108); }
    else { bw = clamp(0.05 * w, 72, 98); bh = clamp(0.068 * w, 94, 128); }
    return Math.min(bh, bw * 900 / 700) * (608 / 900) * 0.95;
  }

  function groundY(x) {
    var r = CONFIG.ridge;
    var f = clamp((x - L.offX) / L.imgW, 0, 1) * (r.length - 1);
    var i = Math.min(Math.floor(f), r.length - 2);
    return L.offY + lerp(r[i], r[i + 1], f - i) * L.imgH;
  }

  function groundAngle(x) {
    var d = 48 * L.S;
    return Math.atan2(groundY(x + d) - groundY(x - d), 2 * d);
  }

  // Time cost per screen px along the ridge: more on climbs, less on
  // descents. Integrated and normalised, so the arrive/depart profile
  // is applied in "effort" space and the rover visibly labours uphill.
  function driveProfile(x0, x1) {
    var n = 240, xs = [], cum = [0], steep = 0.45;
    for (var i = 0; i <= n; i++) {
      var x = lerp(x0, x1, i / n);
      xs.push(x);
      if (!i) continue;
      var climb = -Math.tan(groundAngle(x));
      var speed = climb > 0
        ? 1 - RV.uphillSlow * clamp(climb / steep, 0, 1)
        : 1 + RV.downhillFast * clamp(-climb / steep, 0, 1);
      var seg = Math.abs(x1 - x0) / n;
      cum.push(cum[i - 1] + seg / speed);
    }
    var total = cum[n];
    for (var j = 0; j <= n; j++) cum[j] /= total;
    return { xs: xs, cum: cum, effort: total }; // effort in screen px at cruise
  }

  function profileX(prof, p) {
    var lo = 0, hi = prof.cum.length - 1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (prof.cum[mid] < p) lo = mid; else hi = mid;
    }
    var span = prof.cum[hi] - prof.cum[lo] || 1;
    return lerp(prof.xs[lo], prof.xs[hi], (p - prof.cum[lo]) / span);
  }

  // ---------- timeline ----------
  var TM = CONFIG.timing;
  var PHASES = [], START = {}, DUR = {}, LOOP = 1;

  function poseDur(name, fallback) {
    var p = CONFIG.poses[name];
    return p.count ? p.count / p.fps : fallback;
  }

  function buildTimeline() {
    var cruiseSrc = RV.cruise * CONFIG.pxPerMeter; // source px/s
    var cruiseScr = cruiseSrc * L.S; // screen px/s
    var walkSrc = AST.pxPerFrame * AST.fps;
    var walkVmax = trapVmax(AST.easeFrac, AST.easeFrac);
    var plantDur = CONFIG.flag.plant.count / CONFIG.flag.plant.fps;
    var list = [
      ["driveIn", L.inProfile.effort * trapVmax(0, RV.arriveBrake) / cruiseScr],
      ["settle", TM.settle],
      ["getOut", poseDur(CONFIG.poses.get_out.count ? "get_out" : "get_in", TM.getOut)],
      ["walkOut", L.walkSrc * walkVmax / walkSrc],
      ["kneelDown", poseDur("kneel_down", TM.kneelDown)],
      ["plant", plantDur + TM.plantHold],
      ["standUp", poseDur(CONFIG.poses.stand_up.count ? "stand_up" : "kneel_down", TM.standUp)],
      ["beat", TM.beat],
      ["walkBack", L.walkSrc * walkVmax / walkSrc],
      ["getIn", poseDur("get_in", TM.getIn)],
      ["ignition", TM.ignition],
      ["driveOut", L.outProfile.effort * trapVmax(RV.departAccel, 0) / cruiseScr],
      ["empty", TM.empty]
    ];
    PHASES = [];
    START = {};
    DUR = {};
    LOOP = 0;
    list.forEach(function (p) {
      PHASES.push({ name: p[0], dur: p[1] });
      START[p[0]] = LOOP;
      DUR[p[0]] = p[1];
      LOOP += p[1];
    });
  }

  function phaseAt(t) {
    for (var i = 0; i < PHASES.length; i++) {
      var p = PHASES[i];
      if (t < START[p.name] + p.dur) return { name: p.name, u: (t - START[p.name]) / p.dur, t: t - START[p.name] };
    }
    return { name: "empty", u: 1, t: 0 };
  }

  function layout() {
    var w = camera.clientWidth;
    var h = camera.clientHeight;
    if (!w || !h) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2);
    [flagCanvas, mainCanvas, glowCanvas].forEach(function (c) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    });
    var pos = terrainPos();
    var cover = Math.max(w / CONFIG.terrain.width, h / CONFIG.terrain.height);
    L.w = w;
    L.h = h;
    L.dpr = dpr;
    L.imgW = CONFIG.terrain.width * cover;
    L.imgH = CONFIG.terrain.height * cover;
    L.offX = pos[0] * (w - L.imgW);
    L.offY = pos[1] * (h - L.imgH);
    L.S = astronautScreenHeight(w) / H; // CSS px per source px

    var mid = (RV.contacts[0][0] + RV.contacts[1][0]) / 2; // rover's bottom centre x
    var kneelOffset = AST.kneel.glove[0] - AST.kneel.anchor[0];
    var nose = RV.frontX - mid;
    L.peakX = L.offX + CONFIG.terrain.peakX * L.imgW;
    L.kneelX = L.peakX - kneelOffset * L.S;
    L.parkX = L.kneelX - (CONFIG.layout.noseGap + nose) * L.S;
    L.exitX = L.parkX + (RV.exitX - mid) * L.S;
    L.walkSrc = (L.kneelX - L.exitX) / L.S;
    // whole frames per walk, so he sets off and arrives on the same frame
    L.walkFrames = Math.max(AST.walkRight.count, Math.round(L.walkSrc / AST.pxPerFrame / AST.walkRight.count) * AST.walkRight.count);
    L.startX = -(RV.frontX - mid) * L.S - 30;
    L.endX = w + (mid - RV.rearX) * L.S + 30;
    L.inProfile = driveProfile(L.startX, L.parkX);
    L.outProfile = driveProfile(L.parkX, L.endX);
    buildTimeline();
    return true;
  }

  // Rover on the ridge by its two tyre contacts, bottom-centre halfway
  // between them, tilted along the chord (minus the art's own 0.6deg).
  var ART_TILT = Math.atan2(RV.contacts[1][1] - RV.contacts[0][1], RV.contacts[1][0] - RV.contacts[0][0]);
  var ROVER_MID = [(RV.contacts[0][0] + RV.contacts[1][0]) / 2, (RV.contacts[0][1] + RV.contacts[1][1]) / 2];

  function roverPose(x) {
    var xr = x + (RV.contacts[0][0] - ROVER_MID[0]) * L.S;
    var xf = x + (RV.contacts[1][0] - ROVER_MID[0]) * L.S;
    var yr = groundY(xr);
    var yf = groundY(xf);
    return { x: x, y: (yr + yf) / 2, angle: Math.atan2(yf - yr, xf - xr) - ART_TILT, rear: [xr, yr], front: [xf, yf] };
  }

  // ---------- particles: tyre dust, hanging trail, pebbles, motes ----------
  var dust = [];
  var pebbles = [];
  var motes = [];
  var DUST_MAX = lowPower ? CONFIG.dust.maxLowPower : CONFIG.dust.max;

  var puffSprite = (function () {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(" + CONFIG.dust.rgb + ", 1)");
    grad.addColorStop(0.45, "rgba(" + CONFIG.dust.rgb + ", 0.5)");
    grad.addColorStop(1, "rgba(" + CONFIG.dust.rgb + ", 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return c;
  })();

  // x, y screen; vx, vy source px/s; size source px.
  function puff(x, y, vx, vy, size, o) {
    o = o || {};
    if (dust.length >= DUST_MAX) dust.shift();
    dust.push({
      x: x, y: y, vx: vx, vy: vy, r: size, age: 0,
      life: o.life || rand(CONFIG.dust.life[0], CONFIG.dust.life[1]),
      alpha: o.alpha || CONFIG.dust.alpha,
      grow: o.grow || CONFIG.dust.grow,
      front: !!o.front, squash: rand(0.72, 0.9)
    });
  }

  function burst(x, y, n, spread, size, lift) {
    if (lowPower) n = Math.ceil(n * 0.6);
    for (var i = 0; i < n; i++) {
      puff(x + rand(-spread, spread) * L.S, y - rand(0, 12) * L.S,
        rand(-140, 140), -rand(40, 130) * (lift || 1), size * rand(0.7, 1.3),
        { front: Math.random() < 0.45, life: rand(1, 2) });
    }
  }

  function kickPebbles(x, y) {
    for (var i = 0; i < CONFIG.pebbles.count; i++) {
      pebbles.push({ x: x, y: y - 6 * L.S, vx: rand(-260, 260), vy: -rand(260, 520), r: rand(0.8, 1.6), age: 0, rest: 0 });
    }
  }

  function initMotes() {
    motes = [];
    var n = lowPower ? CONFIG.motes.countLowPower : CONFIG.motes.count;
    for (var i = 0; i < n; i++) {
      motes.push({ x: Math.random(), y: rand(0.08, 0.7), vx: rand(-0.012, -0.004), vy: rand(-0.002, 0.002), r: rand(0.6, 1.5), tw: rand(0, 6.3) });
    }
  }

  function updateParticles(dt) {
    var drag = Math.exp(-1.5 * dt);
    for (var i = dust.length - 1; i >= 0; i--) {
      var p = dust[i];
      p.age += dt;
      if (p.age >= p.life) { dust.splice(i, 1); continue; }
      p.vx = p.vx * drag - 36 * dt; // light breeze drifting left
      p.vy = p.vy * drag + 16 * dt; // low gravity: hangs, then settles
      p.x += p.vx * L.S * dt;
      p.y += p.vy * L.S * dt;
    }
    for (var j = pebbles.length - 1; j >= 0; j--) {
      var b = pebbles[j];
      b.age += dt;
      if (b.rest) { b.rest += dt; if (b.rest > 0.8) pebbles.splice(j, 1); continue; }
      b.vy += CONFIG.pebbles.gravity * dt;
      b.x += b.vx * L.S * dt;
      b.y += b.vy * L.S * dt;
      var gy = groundY(b.x) + 2 * L.S;
      if (b.vy > 0 && b.y >= gy) { b.y = gy; b.rest = 0.001; }
    }
    for (var k = 0; k < motes.length; k++) {
      var m = motes[k];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.x < -0.02) { m.x = 1.02; m.y = rand(0.08, 0.7); }
    }
  }

  function drawDust(front) {
    for (var i = 0; i < dust.length; i++) {
      var p = dust[i];
      if (p.front !== front) continue;
      var k = p.age / p.life;
      var a = p.alpha * smooth(0, 0.12, k) * (1 - smooth(0.35, 1, k));
      if (a <= 0.003) continue;
      var r = p.r * (1 + p.grow * easeOut(k)) * L.S;
      ctx.globalAlpha = a;
      ctx.drawImage(puffSprite, p.x - r, p.y - r * p.squash, r * 2, r * 2 * p.squash);
    }
    ctx.globalAlpha = 1;
  }

  function drawPebbles() {
    ctx.fillStyle = "rgb(62, 30, 16)";
    for (var i = 0; i < pebbles.length; i++) {
      var b = pebbles[i];
      ctx.globalAlpha = b.rest ? 1 - b.rest / 0.8 : 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawMotes(t) {
    ctx.fillStyle = "rgb(255, 226, 190)";
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      ctx.globalAlpha = 0.12 + 0.2 * (0.5 + 0.5 * Math.sin(t * 1.3 + m.tw));
      ctx.beginPath();
      ctx.arc(m.x * L.w, m.y * L.h, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- glow (additive lamps on the screen-blended canvas) ----------
  var glowSprites = {};
  function glowSprite(rgb) {
    if (glowSprites[rgb]) return glowSprites[rgb];
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255, 250, 240, 1)");
    grad.addColorStop(0.1, "rgba(" + rgb + ", 0.95)");
    grad.addColorStop(0.38, "rgba(" + rgb + ", 0.26)");
    grad.addColorStop(1, "rgba(" + rgb + ", 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return (glowSprites[rgb] = c);
  }

  var lights = [];
  // Queue a lamp at (sx, sy) in the main context's current transform.
  // sx/sy stretch the sprite (streaks, ground blooms).
  function lamp(x, y, radiusSrc, rgb, a, stretchX, stretchY) {
    if (a <= 0.01) return;
    var pt = ctx.getTransform().transformPoint(new DOMPoint(x, y));
    var m = ctx.getTransform();
    var scale = Math.hypot(m.a, m.b) / L.dpr; // current units -> CSS px
    lights.push({ x: pt.x, y: pt.y, r: radiusSrc * scale, rgb: rgb, a: Math.min(1, a), sx: stretchX || 1, sy: stretchY || 1 });
  }

  function drawLights() {
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < lights.length; i++) {
      var l = lights[i];
      var rx = l.r * L.dpr * l.sx, ry = l.r * L.dpr * l.sy;
      gctx.globalAlpha = l.a;
      gctx.drawImage(glowSprite(l.rgb), l.x - rx, l.y - ry, rx * 2, ry * 2);
    }
    gctx.globalAlpha = 1;
    gctx.globalCompositeOperation = "source-over";
  }

  // ---------- rover state (suspension springs, wheels, speed) ----------
  var R = { dist: 0, last: null, vel: 0, accel: 0, pitch: 0, pitchV: 0, sink: 0, sinkV: 0, trailAcc: 0, emit: 0 };

  function kickSink(amountSrc) { R.sinkV += amountSrc; }

  function updateRover(p, dt, driving) {
    if (!dt) return;
    var v = 0;
    if (p && R.last && Math.abs(p.x - R.last.x) < L.w * 0.25) {
      var d = Math.hypot(p.x - R.last.x, p.y - R.last.y) / L.S;
      if (driving) R.dist += d;
      v = d / dt;
    }
    var a = (v - R.vel) / dt;
    R.accel = lerp(R.accel, clamp(a, -900, 900), 1 - Math.exp(-8 * dt)); // smoothed
    R.vel = v;
    R.last = p;
    var target = clamp(-R.accel * RV.pitchPerAccel, -RV.pitchMax, RV.pitchMax);
    R.pitchV += (RV.spring.stiffness * (target - R.pitch) - RV.spring.damping * R.pitchV) * dt;
    R.pitch += R.pitchV * dt;
    R.sinkV += (-RV.spring.stiffness * R.sink - RV.spring.damping * R.sinkV) * dt;
    R.sink += R.sinkV * dt;
  }

  // ---------- drawing ----------
  function toRoverSpace(c, p, extraAngle, sink) {
    c.translate(p.x, p.y);
    c.rotate(p.angle + (extraAngle || 0));
    c.scale(L.S, L.S);
    c.translate(-ROVER_MID[0], -ROVER_MID[1] + (sink || 0));
  }

  function shadowEllipse(x, y, halfW, angle, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.translate(x, y + halfW * 0.06);
    ctx.rotate(angle);
    ctx.scale(1, 0.16);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, halfW);
    g.addColorStop(0, "rgba(20, 6, 2," + alpha + ")");
    g.addColorStop(1, "rgba(20, 6, 2, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, halfW, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // s: { driving, frame, t, head, roof, brake, speedK, ignition }
  function drawRover(p, s) {
    var body = R.pitch + (s.driving ? RV.sway * s.speedK * (Math.sin(R.dist * 0.011) + 0.6 * Math.sin(R.dist * 0.027 + 1.3)) : 0);
    shadowEllipse(p.x, p.y, (RV.contacts[1][0] - RV.contacts[0][0]) * 0.64 * L.S, p.angle + ART_TILT, 0.4);
    var rolling = RV.wheels.mode !== "frames";
    var img = s.driving && !rolling ? IMG.drive[s.frame] : IMG.roverStill;
    var dy = s.driving && !rolling ? RV.driveOffsetY : 0;
    // body bounce over the terrain (the discs stay on the ground)
    if (s.driving && rolling) dy = -RV.wheels.bounce * s.speedK * (0.6 * Math.sin(R.dist * 0.035) + 0.4 * Math.sin(R.dist * 0.083 + 0.7));

    // motion ghosts: a whisper of blur at speed
    if (s.driving && !lowPower && s.speedK > RV.ghostAbove) {
      var gk = smooth(RV.ghostAbove, 1, s.speedK);
      [[-34, 0.07], [-68, 0.035]].forEach(function (gh) {
        ctx.save();
        toRoverSpace(ctx, p, body, R.sink);
        ctx.globalAlpha = gh[1] * gk;
        ctx.drawImage(img, gh[0], -dy, srcW(img), srcH(img));
        ctx.restore();
      });
    }

    ctx.save();
    toRoverSpace(ctx, p, body, R.sink);
    ctx.drawImage(img, 0, -dy, srcW(img), srcH(img));
    if (rolling) {
      var spinA = R.dist / RV.wheels.tyreR; // rolling without slip
      for (var w = 0; w < RV.wheels.discs.length; w++) {
        var d = RV.wheels.discs[w], disc = IMG.wheels[w];
        ctx.save();
        ctx.translate(d[1], d[2]);
        ctx.rotate(spinA + w * 1.1);
        ctx.drawImage(disc, -srcW(disc) / 2, -srcH(disc) / 2, srcW(disc), srcH(disc));
        ctx.restore();
      }
    }

    // lamps ride with the body
    var lp = RV.lamps, C = CONFIG.lamps, t = s.t;
    var spin = Math.pow(Math.max(0, Math.cos(t * Math.PI * 2 / 1.7)), 10); // rotating beacon sweep
    lamp(lp.beacon[0], lp.beacon[1], 70, C.amber, 0.2 + 0.25 * Math.sin(t * 3) * 0.2);
    lamp(lp.beacon[0], lp.beacon[1], 120, C.amber, spin * 0.95);
    lamp(lp.beacon[0], lp.beacon[1], 90, C.amber, spin * 0.6, 3.4, 0.22);
    var dishOn = ((t % 3.3) < 0.09 || ((t - 0.2) % 3.3 + 3.3) % 3.3 < 0.09) ? 1 : 0;
    lamp(lp.dish[0], lp.dish[1], 38, C.red, 0.08 + 0.9 * dishOn);
    for (var i = 0; i < lp.roof.length; i++) lamp(lp.roof[i][0], lp.roof[i][1], 60, C.orange, s.roof);
    lamp(lp.head[0], lp.head[1], 70, C.cool, s.head);
    lamp(lp.head[0], lp.head[1], 200, C.warm, s.head * 0.28);
    lamp(lp.drl[0], lp.drl[1], 50, C.orange, 0.3 + 0.5 * s.head);
    lamp(lp.tail[0], lp.tail[1], 70, C.red, s.brake);
    var breathe = 0.22 + 0.14 * Math.sin(t * Math.PI * 2 / 3.6);
    for (var j = 0; j < lp.strips.length; j++) lamp(lp.strips[j][0], lp.strips[j][1], 46, C.orange, breathe + 0.2 * s.ignition);
    if (s.head > 0.05) L.beam = { m: ctx.getTransform(), a: s.head };
    ctx.restore();

    // bloom where the beam meets the ridge ahead (on the real ground,
    // not in the tilted rover space, so it never floats over a crest)
    if (s.head > 0.05) {
      var ax = p.x + (lp.head[0] + 380 - ROVER_MID[0]) * L.S;
      lights.push({ x: ax * L.dpr, y: (groundY(ax) + 4 * L.S) * L.dpr, r: 230 * L.S, rgb: C.warm, a: s.head * 0.2, sx: 1.7, sy: 0.16 });
    }
  }

  // Headlight cone, in rover space on the glow canvas.
  function drawBeam() {
    if (!L.beam) return;
    var h = RV.lamps.head;
    gctx.save();
    gctx.setTransform(L.beam.m);
    gctx.globalCompositeOperation = "lighter";
    var g = gctx.createLinearGradient(h[0], 0, h[0] + 1100, 0);
    g.addColorStop(0, "rgba(255, 228, 190, " + 0.18 * L.beam.a + ")");
    g.addColorStop(0.5, "rgba(255, 210, 160, " + 0.06 * L.beam.a + ")");
    g.addColorStop(1, "rgba(255, 200, 150, 0)");
    gctx.fillStyle = g;
    gctx.beginPath();
    gctx.moveTo(h[0], h[1] - 14);
    gctx.lineTo(h[0] + 1100, h[1] - 60);
    gctx.lineTo(h[0] + 1100, h[1] + 380);
    gctx.lineTo(h[0], h[1] + 16);
    gctx.closePath();
    gctx.fill();
    gctx.restore();
  }

  // Astronaut lamps for a frame, in that frame's px (current transform).
  function astronautLamps(set, anchor, t, alpha) {
    if (alpha <= 0.05) return;
    var C = CONFIG.lamps;
    var led = 0.25 + 0.75 * smooth(0.55, 1, 0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 2.2));
    lamp(set.led[0] - anchor[0], set.led[1] - anchor[1], 30, C.red, led * alpha);
    lamp(set.lamp[0] - anchor[0], set.lamp[1] - anchor[1], 28, C.warm, 0.35 * alpha);
    var g = (t % 6.5) / 0.45; // visor glint sweeps across every 6.5s
    if (g < 1) {
      var gx = lerp(-34, 34, easeInOut(g)), gy = lerp(-16, 12, easeInOut(g));
      lamp(set.visor[0] - anchor[0] + gx, set.visor[1] - anchor[1] + gy, 34, C.warm, Math.sin(g * Math.PI) * 0.85 * alpha, 1.8, 0.35);
    }
  }

  // A frame drawn standing on the ridge at x.
  // o: img, anchor, lamps, alpha, drop (source px, down), squash (scaleY),
  //    lean (deg), tilt (rad), clip (hide below ground), shadow
  function drawFigure(x, o, t) {
    var y = groundY(x);
    var alpha = o.alpha == null ? 1 : o.alpha;
    if (alpha <= 0) return;
    if (o.shadow !== false) shadowEllipse(x, y, 150 * L.S, groundAngle(x), 0.32 * alpha);
    ctx.save();
    ctx.translate(x, y);
    if (o.tilt) ctx.rotate(o.tilt);
    ctx.scale(L.S, L.S * (o.squash || 1));
    if (o.clip) {
      ctx.beginPath();
      ctx.rect(-4000, -4000, 8000, 4000);
      ctx.clip();
    }
    ctx.translate(0, o.drop || 0);
    if (o.lean) ctx.rotate(o.lean * Math.PI / 180);
    ctx.globalAlpha = alpha;
    ctx.drawImage(o.img, -o.anchor[0], -o.anchor[1], srcW(o.img), srcH(o.img));
    ctx.globalAlpha = 1;
    if (o.lamps) astronautLamps(o.lamps, o.anchor, t, alpha);
    ctx.restore();
  }

  function standing(facing) {
    return facing < 0
      ? { img: IMG.walkLeft[0], anchor: AST.walkLeft.anchor, lamps: AST.lamps.left }
      : { img: IMG.walkRight[0], anchor: AST.walkRight.anchor, lamps: AST.lamps.right };
  }

  // Opacity-preserving dissolve between two frames: A at (1-t), then B
  // added at t. Where the bodies overlap the pixels stay fully opaque
  // (no see-through dip), and only the swinging limbs cross-fade.
  var mixCanvas = document.createElement("canvas");
  var mixCtx = mixCanvas.getContext("2d");
  function mixFrames(a, b, t) {
    if (mixCanvas.width !== a.naturalWidth || mixCanvas.height !== a.naturalHeight) {
      mixCanvas.width = a.naturalWidth;
      mixCanvas.height = a.naturalHeight;
    }
    mixCtx.globalCompositeOperation = "source-over";
    mixCtx.globalAlpha = 1;
    mixCtx.clearRect(0, 0, mixCanvas.width, mixCanvas.height);
    mixCtx.globalAlpha = 1 - t;
    mixCtx.drawImage(a, 0, 0);
    mixCtx.globalCompositeOperation = "lighter";
    mixCtx.globalAlpha = t;
    mixCtx.drawImage(b, 0, 0);
    mixCtx.globalCompositeOperation = "source-over";
    mixCtx.globalAlpha = 1;
    return mixCanvas;
  }

  // Walk: distance-driven frames (no sliding), eased start/stop, and each
  // frame dissolving into the next so ~5fps art moves without strobing.
  var lastStepFrame = -1;
  function drawWalk(u, fromX, toX, facing, t, live) {
    var p = trap(u, AST.easeFrac, AST.easeFrac);
    var x = lerp(fromX, toX, p);
    var framesF = p * L.walkFrames;
    var n = AST.walkRight.count;
    var idx = Math.floor(framesF) % n;
    var frac = framesF - Math.floor(framesF);
    if (u >= 1) { idx = 0; frac = 0; }
    var set = facing < 0 ? IMG.walkLeft : IMG.walkRight;
    var anchor = facing < 0 ? AST.walkLeft.anchor : AST.walkRight.anchor;
    var blendA = smooth(1 - AST.frameBlend, 1, frac);
    // heel strikes: frames 3 and 8 (index 2, 7) plant a boot
    if (live && idx !== lastStepFrame && (idx === 2 || idx === 7)) {
      burst(x + facing * 70 * L.S, groundY(x), 3, 26, 16, 0.45);
    }
    lastStepFrame = idx;
    drawFigure(x, {
      img: blendA > 0.002 ? mixFrames(set[idx], set[(idx + 1) % n], blendA) : set[idx],
      anchor: anchor, lamps: facing < 0 ? AST.lamps.left : AST.lamps.right,
      tilt: groundAngle(x) * 0.4
    }, t);
  }

  // Kneel down / stand up. k: 0 standing -> 1 knelt.
  function drawKneel(k, standingUp, t) {
    var posesDown = IMG.poses.kneel_down, posesUp = IMG.poses.stand_up;
    var frames = standingUp ? (posesUp.length ? posesUp : posesDown) : posesDown;
    if (frames.length) {
      var f = standingUp && posesUp.length ? 1 - k : k;
      var img = frames[Math.min(frames.length - 1, Math.floor(f * frames.length))];
      drawFigure(L.kneelX, { img: img, anchor: AST.kneel.anchor, lamps: AST.lamps.kneel }, t);
      return;
    }
    var st = standing(1);
    var kn = { img: IMG.kneel, anchor: AST.kneel.anchor, lamps: AST.lamps.kneel };
    if (!standingUp) {
      // anticipation dip -> dust puff covers the cut -> kneel lands a
      // touch high and settles onto the knee
      var dip = easeInOut(clamp(k / 0.42, 0, 1));
      var swap = smooth(0.38, 0.5, k);
      var land = easeOutBack(clamp((k - 0.44) / 0.56, 0, 1));
      drawFigure(L.kneelX, { img: st.img, anchor: st.anchor, lamps: st.lamps, alpha: 1 - swap, drop: dip * 0.045 * H, squash: 1 - dip * 0.035, lean: dip * 4, clip: true, shadow: swap < 0.5 }, t);
      drawFigure(L.kneelX, { img: kn.img, anchor: kn.anchor, lamps: kn.lamps, alpha: swap, drop: -(1 - land) * 0.035 * H, squash: 1 + (1 - land) * 0.02, shadow: swap >= 0.5 }, t);
    } else {
      // push off (kneel compresses) -> puff -> he rises from low and
      // settles with a slight overshoot
      var push = easeInOut(clamp(k < 1 ? (1 - k) / 0.36 : 0, 0, 1));
      var swapU = smooth(0.36, 0.48, 1 - k);
      var rise = easeOutBack(clamp((1 - k - 0.42) / 0.58, 0, 1));
      drawFigure(L.kneelX, { img: kn.img, anchor: kn.anchor, lamps: kn.lamps, alpha: 1 - swapU, drop: push * 0.02 * H, squash: 1 - push * 0.025, shadow: swapU < 0.5 }, t);
      drawFigure(L.kneelX, { img: st.img, anchor: st.anchor, lamps: st.lamps, alpha: swapU, drop: (1 - rise) * 0.06 * H, clip: true, shadow: swapU >= 0.5 }, t);
    }
  }

  // The seated driver: walk_right_01 (or driving_seated frames) in rover
  // space, clipped at the door sill so the body hides his legs.
  function drawSeated(p, body, lift, alpha, t) {
    if (alpha <= 0 || !p) return;
    ctx.save();
    toRoverSpace(ctx, p, body, R.sink);
    ctx.beginPath();
    ctx.rect(-4000, -4000, 9000, 4000 + RV.sillY);
    ctx.clip();
    ctx.translate(RV.seat[0], RV.seat[1] - lift);
    ctx.globalAlpha = alpha;
    var frames = IMG.poses.driving_seated;
    if (frames.length) {
      var img = frames[Math.floor(t * CONFIG.poses.driving_seated.fps) % frames.length];
      ctx.drawImage(img, -AST.seatHip[0], -AST.seatHip[1], srcW(img), srcH(img));
    } else {
      ctx.drawImage(IMG.walkRight[0], -AST.seatHip[0], -AST.seatHip[1], srcW(IMG.walkRight[0]), srcH(IMG.walkRight[0]));
    }
    ctx.globalAlpha = 1;
    astronautLamps(AST.lamps.right, AST.seatHip, t, alpha);
    ctx.restore();
  }

  // Climbing out (u 0 -> 1) or in (the same move run backwards).
  function drawClimb(p, body, u, t, out) {
    var name = out ? "get_out" : "get_in";
    var own = IMG.poses[name], other = IMG.poses[out ? "get_in" : "get_out"];
    var frames = own.length ? own : other;
    if (frames.length) {
      // real frames: seated -> standing for get_out, reverse for get_in,
      // drawn in rover space on the ground under the door
      var forward = own.length ? u : 1 - u;
      var img = frames[Math.min(frames.length - 1, Math.floor(forward * frames.length))];
      ctx.save();
      toRoverSpace(ctx, p, body, R.sink);
      ctx.translate(RV.exitX, ROVER_MID[1]);
      ctx.drawImage(img, -AST.walkRight.anchor[0], -AST.walkRight.anchor[1], srcW(img), srcH(img));
      ctx.restore();
      return;
    }
    // Built-in: he rises out of the seat, a dust puff at the door covers
    // the swap, and he hops down beside the rover (and the reverse).
    var k = out ? u : 1 - u; // 0 seated -> 1 on the ground
    var rise = easeInOut(clamp(k / 0.36, 0, 1));
    drawSeated(p, body, rise * 0.17 * H, 1 - smooth(0.3, 0.44, k), t);
    var fall = clamp((k - 0.36) / 0.4, 0, 1);
    var hop = 1 - easeIn(fall); // height above ground while dropping
    var recoil = k > 0.76 ? Math.sin(clamp((k - 0.76) / 0.24, 0, 1) * Math.PI) : 0;
    var st = standing(1);
    drawFigure(L.exitX, {
      img: st.img, anchor: st.anchor, lamps: st.lamps,
      alpha: smooth(0.34, 0.46, k),
      drop: -hop * 0.1 * H, squash: 1 - recoil * 0.04
    }, t);
  }

  function drawFlag(img, alpha, sink) {
    if (!img || alpha <= 0) return;
    fctx.save();
    fctx.globalAlpha = alpha * CONFIG.flag.opacity;
    fctx.translate(L.peakX, groundY(L.peakX));
    fctx.scale(L.S, L.S);
    if (sink) {
      fctx.beginPath();
      fctx.rect(-4000, -4000, 8000, 4000);
      fctx.clip();
      fctx.translate(0, sink);
    }
    fctx.drawImage(img, -CONFIG.flag.anchor[0], -CONFIG.flag.anchor[1], srcW(img), srcH(img));
    fctx.restore();
  }

  // ---------- camera feel (on .folio-camera; the copy sits outside it) ----------
  var cam = { dip: 0, dipV: 0, x: 0, y: 0 };
  function updateCamera(dt, t, rumbleK) {
    cam.dipV += (-60 * cam.dip - 9 * cam.dipV) * dt;
    cam.dip += cam.dipV * dt;
    var r = CONFIG.camera.rumble * rumbleK;
    var x = r * (Math.sin(t * 37) * 0.6 + Math.sin(t * 53 + 1.7) * 0.4);
    var y = r * (Math.sin(t * 41 + 0.6) * 0.6 + Math.sin(t * 29 + 2.2) * 0.4) + cam.dip;
    if (Math.abs(x - cam.x) + Math.abs(y - cam.y) > 0.02) {
      cam.x = x;
      cam.y = y;
      camera.style.translate = x.toFixed(2) + "px " + y.toFixed(2) + "px";
    }
  }
  function camKick(px) { cam.dipV += px * 14; }
  function resetCamera() { cam.x = cam.y = cam.dip = cam.dipV = 0; camera.style.translate = ""; }

  // ---------- flag ----------
  var sceneTime = 0;
  var prevLoopT = -1;

  function flagAt(t, loop) {
    var F = CONFIG.flag;
    var plantAt = START.plant;
    var plantEnd = plantAt + F.plant.count / F.plant.fps;
    function wave(since) { return IMG.flagWave[Math.floor(since * F.wave.fps) % IMG.flagWave.length]; }
    if (!CONFIG.flagResetsEachLoop && loop > 0) return { img: wave(sceneTime - plantEnd), alpha: 1, sink: 0 };
    if (t < plantAt) {
      // last loop's flag: stands through the empty beat, then sinks
      // into the dust and fades as the rover comes back in
      if (loop > 0 && t < F.retire) {
        var k = easeInOut(t / F.retire);
        return { img: wave(t + LOOP - plantEnd), alpha: 1 - k, sink: k * F.retireSink * 1100 };
      }
      return null;
    }
    if (t < plantEnd) return { img: IMG.flagPlant[Math.min(IMG.flagPlant.length - 1, Math.floor((t - plantAt) * F.plant.fps))], alpha: 1, sink: 0 };
    return { img: wave(t - plantEnd), alpha: 1, sink: 0 };
  }

  // ---------- frame ----------
  function clearAll() {
    [[fctx, flagCanvas], [ctx, mainCanvas], [gctx, glowCanvas]].forEach(function (pair) {
      pair[0].setTransform(1, 0, 0, 1, 0, 0);
      pair[0].clearRect(0, 0, pair[1].width, pair[1].height);
      pair[0].setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    });
    lights.length = 0;
    L.beam = null;
  }

  // dt = 0 re-draws the current moment without advancing anything.
  function render(dt) {
    if (!IMG.kneel) return;
    var loop = Math.floor(sceneTime / LOOP);
    var t = sceneTime - loop * LOOP;
    var ph = phaseAt(t);
    var n = ph.name;
    var live = dt > 0;
    function at(te) { return live && prevLoopT >= 0 && (prevLoopT <= t ? prevLoopT < te && te <= t : te <= t || te > prevLoopT); }

    clearAll();

    var f = flagAt(t, loop);
    if (f) drawFlag(f.img, f.alpha, f.sink);
    if (live && loop > 0 && CONFIG.flagResetsEachLoop && at(0.35)) burst(L.peakX, groundY(L.peakX), 4, 30, 18, 0.5);

    // ---- rover path ----
    var driving = n === "driveIn" || n === "driveOut";
    var roverX = null;
    if (n === "driveIn") roverX = profileX(L.inProfile, trap(ph.u, 0, RV.arriveBrake));
    else if (n === "driveOut") roverX = profileX(L.outProfile, trap(ph.u, RV.departAccel, 0));
    else if (n !== "empty") roverX = L.parkX;
    var p = roverX == null ? null : roverPose(roverX);
    updateRover(p, dt, driving);
    var cruiseSrc = RV.cruise * CONFIG.pxPerMeter;
    var speedK = clamp(R.vel / cruiseSrc, 0, 1.3);
    var braking = n === "driveIn" && ph.u > 1 - RV.arriveBrake;
    var wheelFrame = Math.floor(R.dist / RV.wheelPxPerFrame) % 24;

    // ---- events ----
    if (live) {
      if (at(START.settle) && p) { burst(p.front[0], p.front[1], 8, 50, 40, 0.8); burst(p.rear[0], p.rear[1], 5, 40, 34, 0.6); }
      if (at(START.getOut + DUR.getOut * 0.36)) { burst(L.exitX, groundY(L.exitX) - 30 * L.S, 7, 60, 30, 0.6); kickSink(18); }
      if (at(START.getOut + DUR.getOut * 0.76)) burst(L.exitX, groundY(L.exitX), 4, 40, 20, 0.5);
      if (at(START.kneelDown + DUR.kneelDown * 0.42)) { burst(L.kneelX + 60 * L.S, groundY(L.kneelX), 10, 70, 30, 0.7); camKick(CONFIG.camera.kneelDip); }
      var hit = START.plant + CONFIG.flag.plant.groundFrame / CONFIG.flag.plant.fps;
      if (at(hit)) { burst(L.peakX, groundY(L.peakX), 12, 30, 26, 1); kickPebbles(L.peakX, groundY(L.peakX)); camKick(CONFIG.camera.plantDip); }
      if (at(START.standUp + DUR.standUp * 0.4)) burst(L.kneelX + 40 * L.S, groundY(L.kneelX), 6, 60, 22, 0.6);
      if (at(START.getIn + DUR.getIn * 0.36)) { burst(L.exitX, groundY(L.exitX) - 30 * L.S, 7, 60, 30, 0.6); }
      if (at(START.getIn + DUR.getIn * 0.8)) kickSink(22);
      if (at(START.driveOut + 0.15) && p) { burst(p.rear[0], p.rear[1], 14, 60, 46, 1.1); burst(p.front[0], p.front[1], 6, 40, 36, 0.8); }

      // tyre dust, thrown back; rolls forward past the wheels while braking
      if (p && driving && R.vel > 1) {
        R.emit += R.vel * dt * CONFIG.dust.perSrcPx * (braking ? CONFIG.dust.brakeBoost : 1) * (lowPower ? 0.55 : 1);
        while (R.emit >= 1) {
          R.emit -= 1;
          [p.rear, p.front].forEach(function (w, wi) {
            puff(w[0] + rand(-30, 30) * L.S, w[1] - rand(0, 20) * L.S,
              -rand(0.08, 0.2) * R.vel + (braking ? rand(40, 160) : 0), -rand(60, 170),
              rand(CONFIG.dust.size[0], CONFIG.dust.size[1]) * (wi ? 0.9 : 1.15), { front: Math.random() < 0.22 });
          });
        }
        // fine grit thrown back and up off each tread, short-lived: it's
        // what sells the tyres biting and turning at hero size
        R.spray = (R.spray || 0) + R.vel * dt * CONFIG.dust.sprayPerSrcPx * (lowPower ? 0.5 : 1);
        while (R.spray >= 1) {
          R.spray -= 1;
          [p.rear, p.front].forEach(function (w) {
            puff(w[0] - rand(20, 60) * L.S, w[1] - rand(10, 60) * L.S,
              -rand(0.35, 0.6) * R.vel, -rand(120, 300),
              rand(CONFIG.dust.spraySize[0], CONFIG.dust.spraySize[1]), { life: rand(0.45, 0.9), alpha: 0.42, grow: 1.6, front: Math.random() < 0.5 });
          });
        }
        // a thin trail left hanging along the ridge
        R.trailAcc += R.vel * dt;
        while (R.trailAcc >= CONFIG.dust.trailEvery) {
          R.trailAcc -= CONFIG.dust.trailEvery;
          puff(p.rear[0], p.rear[1] - rand(10, 40) * L.S, rand(-20, 10), -rand(8, 26), rand(120, 200),
            { life: rand(CONFIG.dust.trailLife[0], CONFIG.dust.trailLife[1]), alpha: CONFIG.dust.trailAlpha, grow: 1.4 });
        }
      }
      updateParticles(dt);
      // camera: rumble when the rover passes close to frame centre, plus kicks
      var near = p ? Math.max(0, 1 - Math.abs(p.x - L.w * 0.55) / (L.w * 0.5)) : 0;
      updateCamera(dt, sceneTime, (driving ? speedK : n === "ignition" ? 0.35 : 0) * near * near);
    }
    prevLoopT = t;

    drawMotes(sceneTime);
    drawDust(false);

    // ---- rover ----
    var body = 0;
    if (p) {
      body = R.pitch;
      var ign = n === "ignition" ? smooth(0, 0.5, ph.u) : 0;
      drawRover(p, {
        driving: driving, frame: wheelFrame, t: sceneTime, speedK: speedK,
        head: driving ? 0.95 : n === "ignition" ? 0.3 + 0.7 * ign : n === "settle" ? lerp(0.95, 0.3, smooth(0, 1, ph.u)) : 0.3,
        roof: driving ? 0.75 : n === "ignition" ? 0.25 + 0.5 * ign : 0.22,
        brake: braking ? 1 : driving ? 0.16 : n === "ignition" ? 0.8 : 0.35,
        ignition: ign
      });
    }

    // ---- astronaut ----
    switch (n) {
      case "driveIn":
      case "settle":
      case "ignition":
      case "driveOut":
        drawSeated(p, body, 0, 1, sceneTime);
        break;
      case "getOut":
        drawClimb(p, body, ph.u, sceneTime, true);
        break;
      case "walkOut":
        drawWalk(ph.u, L.exitX, L.kneelX, 1, sceneTime, live);
        break;
      case "kneelDown":
        drawKneel(ph.u, false, sceneTime);
        break;
      case "plant":
        drawFigure(L.kneelX, { img: IMG.kneel, anchor: AST.kneel.anchor, lamps: AST.lamps.kneel, drop: 0.6 * Math.sin(sceneTime * 2.4) }, sceneTime);
        break;
      case "standUp":
        drawKneel(1 - ph.u, true, sceneTime);
        break;
      case "beat":
        var st = standing(1);
        drawFigure(L.kneelX, { img: st.img, anchor: st.anchor, lamps: st.lamps }, sceneTime);
        break;
      case "walkBack":
        drawWalk(ph.u, L.kneelX, L.exitX, -1, sceneTime, live);
        break;
      case "getIn":
        drawClimb(p, body, ph.u, sceneTime, false);
        break;
    }

    drawDust(true);
    drawPebbles();
    drawBeam();
    drawLights();
  }

  // Reduced motion: one composed frame -- rover parked at the summit,
  // flag planted, astronaut beside it, lamps lit, no particles.
  function renderStatic() {
    if (!IMG.kneel) return;
    clearAll();
    drawFlag(IMG.flagWave[6], 1, 0);
    var p = roverPose(L.parkX);
    drawRover(p, { driving: false, frame: 0, t: 0.9, speedK: 0, head: 0.3, roof: 0.22, brake: 0.35, ignition: 0 });
    var st = standing(1);
    drawFigure(L.kneelX, { img: st.img, anchor: st.anchor, lamps: st.lamps }, 3);
    drawBeam();
    drawLights();
  }

  // ---------- loop: runs only while the hero is on screen and the tab is visible ----------
  var running = false;
  var frozen = false; // debug seek
  var inView = true;
  var rafId = 0;
  var last = 0;

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    var dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    sceneTime += dt;
    render(dt);
  }

  function updateRunning() {
    var should = !reduceMotion && !frozen && inView && !document.hidden && !!IMG.kneel;
    if (should && !running) {
      running = true;
      last = 0;
      R.last = null;
      rafId = requestAnimationFrame(tick);
    } else if (!should && running) {
      running = false;
      cancelAnimationFrame(rafId);
      resetCamera();
    }
  }

  if (/[?&]roverDebug\b/.test(location.search)) {
    window.roverScene = {
      config: CONFIG,
      get loopLength() { return LOOP; },
      get phases() { return START; },
      seek: function (t) { frozen = true; updateRunning(); sceneTime = t; R.last = null; prevLoopT = -1; render(0); },
      // simulate `seconds` of playback from t at 60fps (dust, springs), then hold
      run: function (t, seconds) {
        frozen = true; updateRunning(); sceneTime = t; R.last = null; prevLoopT = -1;
        for (var i = 0; i < seconds * 60; i++) { sceneTime += 1 / 60; render(1 / 60); }
      },
      play: function () { frozen = false; updateRunning(); }
    };
  }

  function relayout() {
    if (!layout()) return;
    R.last = null;
    if (reduceMotion) renderStatic();
    else render(0);
  }

  webpSupported()
    .then(function (ok) { EXT = ok ? "webp" : "png"; return loadManifest(); })
    .then(preload)
    .then(function () {
      initMotes();
      relayout();
      if ("ResizeObserver" in window) new ResizeObserver(relayout).observe(camera);
      else window.addEventListener("resize", relayout);
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          inView = entries[0].isIntersecting;
          updateRunning();
        }).observe(hero);
      }
      document.addEventListener("visibilitychange", updateRunning);
      updateRunning();
    })
    .catch(function (err) { console.error(err); });
})();
