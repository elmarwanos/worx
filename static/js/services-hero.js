/* ============================================================
   Worx | services-hero.js
   The services hero backdrop: a desert planet seen from orbit,
   back-lit by a sun rising over its limb. One fullscreen WebGL
   fragment shader: surface noise, layered atmosphere, faint
   night-side city lights and a filmic tone map.
   The planet turns on its axis and the sun drifts along the horizon
   with it; the sun rises on load and climbs further as you scroll.
   Falls back to the CSS eclipse when WebGL is unavailable.
   ============================================================ */

(function () {
  var hero = document.querySelector(".cx-hero");
  if (!hero) return;

  var canvas = document.createElement("canvas");
  canvas.className = "cx-hero-gl";
  canvas.setAttribute("aria-hidden", "true");
  var gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return;

  var VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

  var FRAG = [
    "precision highp float;",
    "uniform vec2 uRes;uniform float uTime;uniform float uSun;uniform float uRise;uniform vec2 uMouse;",

    "float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}",
    "float noise(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.-2.*f);",
    " return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),",
    "  mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}",
    "float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<6;i++){v+=a*noise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return v;}",

    "void main(){",
    " vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;",
    " vec2 pp=p+uMouse*.012;",
    " float R=1.65;",
    " float limb=-.335+uRise*.22;",
    " vec2 C=vec2(0.,limb-R);",
    " vec2 q=pp-C;float d=length(q);",
    // One spin phase drives both the surface rotation and the sun's
    // drift along the horizon, so the sun tracks the planet's axis.
    " float spin=uTime*.045;",
    " float sa=sin(spin*2.2)*.22;",
    " vec2 up=vec2(sin(sa),cos(sa));",
    " vec2 S=C+up*(R+mix(-.03,.022,uSun));",
    " vec3 sunCol=vec3(1.,.74,.42);",
    " vec3 ember=vec3(.85,.24,.08);",
    " vec3 amber=vec3(1.,.62,.24);",
    " float vis=clamp((length(S-C)-R+.012)/.034,0.,1.);",
    " float mask=smoothstep(R+.0012,R-.0012,d);",
    " vec3 col=vec3(0.);",

    // Sky: a small white-hot sun, soft bloom and forward scattering.
    // The atmosphere is layered like orbital sunrise photography: a
    // thin deep-orange band hugging the limb, a gold layer above it
    // and a faint cool haze on top, all brightest nearest the sun.
    " vec2 ds2=pp-S;float ds=length(ds2);",
    " float glow=exp(-ds*320.)*7.*vis+exp(-ds*45.)*.55*vis+exp(-ds*7.)*(.05+.16*vis)+exp(-ds*1.8)*.015;",
    " col+=mix(sunCol,vec3(1.,.97,.92),exp(-ds*120.))*glow;",
    " float h=max(d-R,0.);",
    " float cu=max(dot(normalize(q),up),0.);",
    " float light=.3+.7*vis;",
    " col+=vec3(1.,.36,.1)*exp(-h*300.)*(.06+2.6*pow(cu,60.))*light;",
    " col+=vec3(1.,.66,.32)*exp(-h*75.)*(.02+.9*pow(cu,40.))*light;",
    " col+=vec3(.5,.52,.62)*exp(-h*16.)*.1*pow(cu,20.)*light;",
    " col*=1.-mask;",

    // Planet surface: back-lit, so only a thin crescent catches the sun
    " if(d<R+.002){",
    "  vec3 n=vec3(q/R,sqrt(max(1.-dot(q,q)/(R*R),0.)));",
    "  vec3 L=normalize(vec3(up*.14,-1.));",
    "  float t=spin;",
    "  vec3 nr=vec3(n.x*cos(t)-n.z*sin(t),n.y,n.x*sin(t)+n.z*cos(t));",
    "  float land=fbm(nr*3.2);",
    "  float dune=fbm(nr*16.+land*2.);",
    "  vec3 alb=mix(vec3(.22,.1,.05),vec3(.62,.36,.18),smoothstep(.35,.72,land));",
    "  alb*=.8+.4*dune;",
    "  float ndl=dot(n,L);",
    "  float day=smoothstep(.01,.13,ndl);",
    "  float term=smoothstep(-.05,.02,ndl)*(1.-smoothstep(.02,.12,ndl));",
    "  vec3 surf=alb*day*sunCol*2.2+vec3(.8,.25,.08)*alb*term*.9;",
    "  float cityMask=smoothstep(.5,.62,land)*(1.-smoothstep(-.1,-.02,ndl));",
    "  float city=pow(noise(nr*220.),14.)*8.*smoothstep(.45,.7,noise(nr*22.));",
    "  surf+=vec3(1.,.62,.3)*city*cityMask*.22;",
    "  surf+=alb*.012;",
    "  float rim=pow(1.-n.z,7.);",
    "  surf+=vec3(1.,.42,.14)*rim*(.04+1.6*pow(cu,50.))*light;",
    "  col=mix(col,surf,mask);",
    " }",

    // Lens: one faint horizontal streak through the sun, nothing more
    " vec2 ls=p-S;",
    " col+=vec3(1.,.86,.66)*exp(-abs(ls.y)*520.)*exp(-abs(ls.x)*4.5)*.14*vis;",

    // Filmic tone map (ACES fit), gamma, dither against banding
    " col=(col*(2.51*col+.03))/(col*(2.43*col+.59)+.14);",
    " col=pow(clamp(col,0.,1.),vec3(.4545));",
    " col+=(hash(vec3(gl_FragCoord.xy,uTime))-.5)/180.;",
    " float a=max(mask,clamp(max(col.r,max(col.g,col.b))*1.15,0.,1.));",
    " gl_FragColor=vec4(col,a);",
    "}"
  ].join("\n");

  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("[services-hero]", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  var vs = shader(gl.VERTEX_SHADER, VERT);
  var fs = shader(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, "uRes");
  var uTime = gl.getUniformLocation(prog, "uTime");
  var uSun = gl.getUniformLocation(prog, "uSun");
  var uRise = gl.getUniformLocation(prog, "uRise");
  var uMouse = gl.getUniformLocation(prog, "uMouse");

  hero.insertBefore(canvas, hero.firstChild);
  hero.classList.add("cx-gl-on");

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var scale = Math.min(window.devicePixelRatio || 1, 1.5) * (window.innerWidth < 720 ? 0.8 : 0.7);

  function resize() {
    var w = Math.max(1, Math.round(hero.clientWidth * scale));
    var h = Math.max(1, Math.round(hero.clientHeight * scale));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  resize();
  window.addEventListener("resize", resize);

  // Sunrise: hidden behind the limb, easing up over the first seconds
  var start = performance.now();
  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("pointermove", function (e) {
    mouse.tx = e.clientX / window.innerWidth - 0.5;
    mouse.ty = 0.5 - e.clientY / window.innerHeight;
  }, { passive: true });

  var visible = true;
  var running = false;
  function kick() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) kick();
    }).observe(hero);
  }

  function ease(t) { return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3); }

  function frame(now) {
    var t = (now - start) / 1000;
    var scroll = Math.min(Math.max(window.scrollY / hero.offsetHeight, 0), 1);
    var sun = reduced ? 0.75 : ease((t - 1.4) / 4.5) * 0.7 + scroll * 0.5;
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, reduced ? 0 : t);
    gl.uniform1f(uSun, Math.min(sun, 1.2));
    gl.uniform1f(uRise, scroll);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!reduced && visible && !document.hidden) requestAnimationFrame(frame);
    else running = false;
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && visible) kick();
  });
  window.addEventListener("resize", function () { if (reduced) kick(); });
  if (reduced) window.addEventListener("scroll", kick, { passive: true });
  kick();
})();
