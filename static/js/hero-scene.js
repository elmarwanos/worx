/* ============================================================
   Worx | hero-scene.js
   A small Three.js "gem" replaces the flat brand tile in the
   home hero, same tilted frame, same brand palette, now a live
   faceted object that drifts and tilts toward the pointer.

   Progressive enhancement only: static/assets/tile-orange.png
   stays underneath and visible until this script confirms WebGL
   is up, so a blocked CDN or unsupported browser never shows an
   empty frame (mirrors the GSAP CDN-fallback pattern site-wide).
   ============================================================ */

(async function () {
  "use strict";

  var wrapper = document.querySelector(".hero-art--3d");
  var canvas = document.getElementById("hero-canvas");
  if (!wrapper || !canvas) return;

  var reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (reducedMotion) return; // Keep the static tile, no motion to build here.

  var THREE;
  try {
    THREE = await import(
      "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
    );
  } catch (err) {
    return; // CDN unreachable, fallback tile stays visible.
  }

  // Brand palette (static/css/base.css :root)
  var COCOA = 0x421d0f;
  var EMBER = 0xc04527;
  var ORANGE = 0xe57d23;
  var AMBER = 0xfaa719;
  var CREAM = 0xfeeecf;

  var width = wrapper.clientWidth || 320;
  var height = wrapper.clientHeight || 320;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
  } catch (err) {
    return; // No WebGL context available, fallback tile stays visible.
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(0, 0, 6.2);

  // ---- Lighting: warm, matches the site's cocoa/ember/amber glow ----
  scene.add(new THREE.AmbientLight(COCOA, 1.4));

  var key = new THREE.DirectionalLight(CREAM, 1.4);
  key.position.set(3, 4, 5);
  scene.add(key);

  var rim = new THREE.PointLight(AMBER, 3, 14);
  rim.position.set(-3, -1.6, 3);
  scene.add(rim);

  var fill = new THREE.PointLight(EMBER, 1.8, 14);
  fill.position.set(2.5, -3, -2);
  scene.add(fill);

  // ---- Gradient vertex colors: ember (base) to amber (tip) ----
  function applyVertexGradient(geometry, colorLow, colorHigh) {
    var position = geometry.attributes.position;
    var colors = new Float32Array(position.count * 3);
    var tmp = new THREE.Color();
    var minY = Infinity;
    var maxY = -Infinity;
    var i;

    for (i = 0; i < position.count; i++) {
      var y = position.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    var span = maxY - minY || 1;

    for (i = 0; i < position.count; i++) {
      var t = (position.getY(i) - minY) / span;
      tmp.copy(colorLow).lerp(colorHigh, t);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }

  var group = new THREE.Group();
  scene.add(group);

  // ---- Main gem: faceted icosahedron with a sketched wireframe edge ----
  var gemGeometry = new THREE.IcosahedronGeometry(1.55, 0);
  applyVertexGradient(
    gemGeometry,
    new THREE.Color(EMBER),
    new THREE.Color(AMBER)
  );

  var gemMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.35,
    metalness: 0.2,
    emissive: new THREE.Color(ORANGE),
    emissiveIntensity: 0.1,
  });

  var gem = new THREE.Mesh(gemGeometry, gemMaterial);
  group.add(gem);

  var wireGeometry = new THREE.WireframeGeometry(gemGeometry);
  var wireMaterial = new THREE.LineBasicMaterial({
    color: CREAM,
    transparent: true,
    opacity: 0.22,
  });
  gem.add(new THREE.LineSegments(wireGeometry, wireMaterial));

  // ---- Two small satellite gems orbiting the main one ----
  var satellites = [
    {
      radius: 0.32,
      orbit: 2.35,
      speed: 0.6,
      offset: 0,
      color: AMBER,
    },
    {
      radius: 0.2,
      orbit: 2.9,
      speed: -0.45,
      offset: Math.PI * 0.6,
      color: EMBER,
    },
  ].map(function (config) {
    var geometry = new THREE.IcosahedronGeometry(config.radius, 0);
    var material = new THREE.MeshStandardMaterial({
      color: config.color,
      flatShading: true,
      roughness: 0.4,
      metalness: 0.15,
    });
    var mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    return { mesh: mesh, config: config };
  });

  // ---- Pointer parallax (smoothed) ----
  var targetX = 0;
  var targetY = 0;
  var curX = 0;
  var curY = 0;

  function onPointerMove(event) {
    targetX = (event.clientX / window.innerWidth) * 2 - 1;
    targetY = (event.clientY / window.innerHeight) * 2 - 1;
  }
  window.addEventListener("pointermove", onPointerMove, { passive: true });

  // ---- Pause rendering when off-screen or the tab is hidden ----
  var inView = true;
  var io = new IntersectionObserver(
    function (entries) {
      inView = entries[0].isIntersecting;
    },
    { threshold: 0 }
  );
  io.observe(wrapper);

  // ---- Keep the drawing buffer matched to the responsive frame ----
  var ro = new ResizeObserver(function (entries) {
    var entry = entries[0];
    var w = entry.contentRect.width;
    var h = entry.contentRect.height;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  ro.observe(wrapper);

  var clock = new THREE.Clock();
  var idle = 0;
  var ready = false;

  function animate() {
    requestAnimationFrame(animate);

    if (document.hidden || !inView) return;

    var delta = clock.getDelta();
    idle += delta;

    curX += (targetX - curX) * 0.06;
    curY += (targetY - curY) * 0.06;

    group.rotation.y = idle * 0.22 + curX * 0.35;
    group.rotation.x = Math.sin(idle * 0.4) * 0.15 + curY * 0.25;
    group.position.y = Math.sin(idle * 0.6) * 0.08;

    satellites.forEach(function (satellite) {
      var angle = idle * satellite.config.speed + satellite.config.offset;
      satellite.mesh.position.set(
        Math.cos(angle) * satellite.config.orbit,
        Math.sin(angle * 1.3) * 0.6,
        Math.sin(angle) * satellite.config.orbit
      );
      satellite.mesh.rotation.x += delta * 0.5;
      satellite.mesh.rotation.y += delta * 0.3;
    });

    renderer.render(scene, camera);

    if (!ready) {
      ready = true;
      wrapper.classList.add("is-ready");
    }
  }

  animate();
})();
