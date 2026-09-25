/* ============================================================
   Worx | hero-background.js
   A layered-silhouette depth backdrop behind the whole hero,
   inspired by two references (see the approved plan): Firewatch's
   flat scenery layers scrolling at different speeds, and the
   Perseverance Mars Rover one-pager's warm, hazy horizon of
   layered ridgelines. Recreated in Worx's own dark/ember palette
   not a literal copy of either site's imagery.

   Three flat silhouette "ridges" sit low in the hero, nearest
   darkest and most detailed, farthest lightest and haziest
   (atmospheric perspective). As the visitor scrolls past the
   hero, each ridge shifts vertically by its own amount, the
   nearest moves most, the farthest barely at all, the same
   differential-speed trick both references use.

   Progressive enhancement only, same contract as hero-scene.js:
   the existing .hero-blob glows stay visible and do the parallax
   themselves (already GSAP-driven, see animations.js) until this
   script confirms WebGL is actually up, so a blocked CDN or
   unsupported browser never shows an empty hero.
   ============================================================ */

(async function () {
  "use strict";

  var wrapper = document.querySelector(".hero");
  var canvas = document.getElementById("hero-bg-canvas");
  if (!wrapper || !canvas) return;

  var reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (reducedMotion) return; // Keep the static CSS blobs, no motion to build here.

  var THREE;
  try {
    THREE = await import(
      "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
    );
  } catch (err) {
    return; // CDN unreachable, fallback blobs stay visible.
  }

  // Brand palette (static/css/base.css :root), same constants hero-scene.js uses.
  var COCOA = 0x421d0f;
  var EMBER = 0xc04527;
  var ORANGE = 0xe57d23;

  var width = wrapper.clientWidth || 1200;
  var height = wrapper.clientHeight || 700;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
  } catch (err) {
    return; // No WebGL context available, fallback blobs stay visible.
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  var scene = new THREE.Scene();
  // Orthographic, not perspective: these are meant to read as flat
  // silhouette layers (like the references), not foreshortened 3D
  // terrain, 1 scene unit ≈ 1 CSS pixel, which also makes the ridge
  // math below easy to reason about.
  var camera = new THREE.OrthographicCamera(
    -width / 2, width / 2, height / 2, -height / 2, 0.1, 100
  );
  camera.position.z = 10;

  // ---- Ridges: nearest darkest + most jagged + moves most on scroll;
  // farthest lightest/haziest + smoothest + barely moves at all. ----
  var RIDGE_CONFIG = [
    { baseYFrac: -0.04, jagFrac: 0.018, color: ORANGE, opacity: 0.18, parallax: 0.05, segments: 10 },
    { baseYFrac: -0.14, jagFrac: 0.032, color: EMBER,  opacity: 0.38, parallax: 0.14, segments: 16 },
    { baseYFrac: -0.28, jagFrac: 0.05,  color: COCOA,  opacity: 0.92, parallax: 0.30, segments: 24 },
  ];

  function buildRidgeGeometry(w, h, cfg, seed) {
    var shape = new THREE.Shape();
    var halfW = w / 2;
    var baseY = h * cfg.baseYFrac;
    var jag = h * cfg.jagFrac;
    var floor = -h; // extend well below the visible frame
    shape.moveTo(-halfW, floor);
    var i, x, y;
    for (i = 0; i <= cfg.segments; i++) {
      x = -halfW + (w * i) / cfg.segments;
      y = baseY +
        Math.sin(i * 0.6 + seed) * jag +
        Math.sin(i * 2.1 + seed * 1.6) * jag * 0.35;
      shape.lineTo(x, y);
    }
    shape.lineTo(halfW, floor);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }

  var layers = [];
  function buildLayers(w, h) {
    layers.forEach(function (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    layers = RIDGE_CONFIG.map(function (cfg, i) {
      var geometry = buildRidgeGeometry(w * 1.4, h, cfg, i * 3.7 + 1);
      var material = new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: cfg.opacity,
      });
      var mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = -1 - i;
      mesh.userData.parallax = cfg.parallax;
      scene.add(mesh);
      return mesh;
    });
  }
  buildLayers(width, height);

  // ---- Scroll parallax: reuse the exact hook static/js/animations.js
  // already sets up for .hero-blob (same trigger/start/end), so the
  // ridges and the fallback blobs are always in sync if either shows. ----
  var scrollProgress = 0;
  if (window.gsap && window.ScrollTrigger) {
    window.ScrollTrigger.create({
      trigger: wrapper,
      start: "top top",
      end: "bottom top",
      scrub: true,
      onUpdate: function (self) { scrollProgress = self.progress; },
    });
  }

  // ---- Pointer drift (smoothed), same technique as hero-scene.js,
  // a small extra sense of depth, desktop-only in feel. ----
  var targetX = 0;
  var curX = 0;
  function onPointerMove(event) {
    targetX = (event.clientX / window.innerWidth) * 2 - 1;
  }
  window.addEventListener("pointermove", onPointerMove, { passive: true });

  // ---- Pause when off-screen or the tab is hidden ----
  var inView = true;
  var io = new IntersectionObserver(
    function (entries) { inView = entries[0].isIntersecting; },
    { threshold: 0 }
  );
  io.observe(wrapper);

  // ---- Keep the scene matched to the hero's actual rendered size ----
  var ro = new ResizeObserver(function (entries) {
    var entry = entries[0];
    var w = entry.contentRect.width;
    var h = entry.contentRect.height;
    if (!w || !h) return;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    camera.left = -w / 2;
    camera.right = w / 2;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.updateProjectionMatrix();
    buildLayers(w, h);
  });
  ro.observe(wrapper);

  var ready = false;

  function animate() {
    requestAnimationFrame(animate);
    if (document.hidden || !inView) return;

    curX += (targetX - curX) * 0.05;

    layers.forEach(function (mesh, i) {
      var p = mesh.userData.parallax;
      mesh.position.y = -scrollProgress * height * p;
      // Nearer layers (later in the array) drift a little more with
      // the pointer, same "closer things move more" depth cue.
      mesh.position.x = curX * 14 * (i + 1);
    });

    renderer.render(scene, camera);

    if (!ready) {
      ready = true;
      wrapper.classList.add("hero-bg-ready");
    }
  }

  animate();
})();
