/* ============================================================
   Worx | hero-planet.js
   The services hero: an orbital sunrise drawn live in WebGL.
   A rust planet fills the bottom of the frame, night side facing
   us; the sun rises from behind its limb (corona, rays, lens
   streak) and lights the atmosphere. The surface turns slowly,
   the planet leans with the pointer, and scrolling descends the
   camera toward it.

   services.js fires a "cx:reveal" event when the intro opens the
   letterbox; without it the sunrise starts on its own. If WebGL
   is missing the canvas is removed and the CSS glow stays.
   ============================================================ */

(function () {
  "use strict";

  var canvas = document.querySelector(".cx-planet");
  if (!canvas) return;
  var hero = canvas.closest(".cx-hero");
  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) {
    canvas.remove();
    return;
  }
  root.classList.add("cx-planet-on");

  var VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

  var FRAG = [
    "precision highp float;",
    "uniform vec2 uRes;",
    "uniform float uTime, uReveal, uScroll;",
    "uniform vec2 uMouse;",

    "float hash(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}",
    "float noise(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.0-2.0*f);",
    " return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),",
    "            mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}",
    "float fbm(vec3 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=0.5;}return v;}",

    "void main(){",
    "  vec2 p=(gl_FragCoord.xy-0.5*uRes)/uRes.y;",
    // Planet placement: the limb sits in the lower third; scrolling
    // grows it and lifts the horizon, like descending toward it.
    "  float R=mix(1.05,1.75,uScroll);",
    "  vec2 c=vec2(uMouse.x*0.035,mix(-1.24,-1.62,uScroll)+uMouse.y*0.02);",
    "  vec2 d=p-c; float r=length(d); float h=r-R;",
    "  vec2 sunDir=normalize(vec2(0.34,1.0));",
    "  float rise=uReveal;",
    // The sun starts hidden behind the limb and climbs just past it
    "  vec2 sunPos=c+sunDir*R*mix(0.93,1.018,rise);",
    "  float sunFacing=max(dot(d/max(r,1e-4),sunDir),0.0);",

    // ---- planet surface
    "  vec3 planet=vec3(0.0); float pa=0.0;",
    "  if(h<0.004){",
    "    float z=sqrt(max(R*R-r*r,0.0))/R;",
    "    vec3 n=vec3(d/R,z);",
    "    float t=uTime*0.01;",
    "    vec3 q=vec3(n.x*cos(t)-n.z*sin(t),n.y,n.x*sin(t)+n.z*cos(t));",
    "    float f=fbm(q*3.0);",
    "    float f2=fbm(q*8.0+f*2.0);",
    "    vec3 base=mix(vec3(0.16,0.055,0.025),vec3(0.52,0.2,0.08),f);",
    "    base=mix(base,vec3(0.78,0.38,0.17),smoothstep(0.55,0.82,f2)*0.55);",
    "    base*=0.75+0.5*smoothstep(0.3,0.7,fbm(q*22.0));",
    "    vec3 L=normalize(vec3(sunDir*0.95,-0.5));",
    "    float diff=max(dot(n,L),0.0);",
    "    float rim=pow(1.0-z,2.6);",
    "    planet=base*(0.035+1.9*diff*(0.35+0.65*rise));",
    // Scattering along the rim, strongest toward the sun
    "    planet+=vec3(1.0,0.46,0.16)*rim*(0.18+2.6*pow(sunFacing,3.0))*(0.35+0.65*rise);",
    "    pa=smoothstep(0.004,-0.002,h);",
    "  }",

    // ---- light that sits over space: atmosphere, sun, corona, streak
    "  vec3 glow=vec3(0.0);",
    "  float outside=smoothstep(-0.003,0.006,h);",
    "  float atmo=exp(-max(h,0.0)*16.0)*(0.18+1.5*pow(sunFacing,5.0));",
    "  glow+=vec3(0.95,0.4,0.13)*atmo*outside*(0.3+0.7*rise);",
    "  float ds=length(p-sunPos);",
    "  float core=smoothstep(0.03,0.0,ds)*2.4;",
    "  float corona=0.011/(ds+0.004);",
    "  float ang=atan(p.y-sunPos.y,p.x-sunPos.x);",
    "  float rays=pow(0.5+0.5*sin(ang*17.0+uTime*0.25)*sin(ang*6.0-uTime*0.15),3.0)*0.028/(ds+0.03);",
    "  vec3 sunCol=vec3(1.0,0.74,0.42);",
    "  glow+=sunCol*(core+corona+rays)*outside*rise;",
    // Anamorphic lens streak and a soft bloom: lens effects, so they
    // draw over the planet as well
    "  float streak=exp(-abs(p.y-sunPos.y)*110.0)*exp(-abs(p.x-sunPos.x)*1.1);",
    "  glow+=vec3(1.0,0.6,0.3)*streak*0.85*rise;",
    "  glow+=vec3(1.0,0.5,0.2)*0.05/(ds*ds*6.0+0.06)*rise*0.35;",
    // Faint drifting dust in space
    "  float dust=fbm(vec3(p*1.6+vec2(uTime*0.004,0.0),uTime*0.01));",
    "  glow+=vec3(0.55,0.2,0.08)*pow(dust,3.0)*0.18*outside;",

    "  vec3 col=planet*pa+glow;",
    "  col=1.0-exp(-col*1.25);",
    "  col+=(hash(vec3(gl_FragCoord.xy,uTime))-0.5)/255.0;",
    "  float alpha=clamp(max(pa,max(col.r,max(col.g,col.b))),0.0,1.0);",
    "  gl_FragColor=vec4(min(col,vec3(alpha)),alpha);",
    "}"
  ].join("\n");

  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("hero-planet shader:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  var vs = shader(gl.VERTEX_SHADER, VERT);
  var fs = shader(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.remove(); root.classList.remove("cx-planet-on"); return; }
  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  // One triangle that covers the screen
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var u = {};
  ["uRes", "uTime", "uReveal", "uScroll", "uMouse"].forEach(function (n) { u[n] = gl.getUniformLocation(prog, n); });

  // Render below native resolution; the glow hides it and it keeps
  // the fragment cost low on big screens
  var SCALE = 0.62;
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.max(1, Math.round(canvas.clientWidth * dpr * SCALE));
    var h = Math.max(1, Math.round(canvas.clientHeight * dpr * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  var reveal = reduced ? 1 : 0;
  var revealFrom = 0, revealStart = 0, revealDur = 0, revealing = false;
  function startReveal(dur) {
    if (revealing || reveal >= 1) return;
    revealing = true;
    revealFrom = reveal;
    revealStart = performance.now();
    revealDur = dur || 3200;
  }
  window.addEventListener("cx:reveal", function () { startReveal(3400); });
  // Fallback when the intro never runs (CDN down): rise on its own
  setTimeout(function () { startReveal(3400); }, typeof gsap === "undefined" ? 600 : 5000);

  var mx = 0, my = 0, sx = 0, sy = 0;
  window.addEventListener("pointermove", function (e) {
    mx = e.clientX / window.innerWidth - 0.5;
    my = -(e.clientY / window.innerHeight - 0.5);
  }, { passive: true });

  var visible = true;
  if ("IntersectionObserver" in window && hero) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) requestAnimationFrame(frame);
    }).observe(hero);
  }

  var t0 = performance.now();
  function draw(now) {
    resize();
    if (revealing) {
      var k = Math.min(1, (now - revealStart) / revealDur);
      // easeOutCubic: the sun bursts over the limb, then settles
      reveal = revealFrom + (1 - revealFrom) * (1 - Math.pow(1 - k, 3));
      if (k >= 1) revealing = false;
    }
    sx += (mx - sx) * 0.04;
    sy += (my - sy) * 0.04;
    var scroll = hero ? Math.min(1, Math.max(0, window.scrollY / hero.offsetHeight)) : 0;
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform1f(u.uTime, (now - t0) / 1000);
    gl.uniform1f(u.uReveal, reveal);
    gl.uniform1f(u.uScroll, scroll);
    gl.uniform2f(u.uMouse, sx, sy);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    if (!visible || document.hidden) return;
    draw(now);
    requestAnimationFrame(frame);
  }

  if (reduced) {
    // One still frame, redrawn only on resize
    draw(performance.now());
    window.addEventListener("resize", function () { draw(performance.now()); });
  } else {
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) requestAnimationFrame(frame);
    });
    requestAnimationFrame(frame);
  }
})();
