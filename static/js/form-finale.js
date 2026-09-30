/* ============================================================
   Worx | form-finale.js
   The send-off after a form goes through: a field of stars streams
   past, is pulled into an atom, the orbits fold into the Worx eye,
   the real mark resolves out of the stars, and WORX is born beneath
   it the way the homepage's title card ends. Styles in
   form-finale.css.

   THE SHOT (about 10.5 s, then it holds until closed)
     0.0s  STREAM   stars fly across at warp
     0.9s  CAPTURE  the nucleus gathers, the rest spiral into 3 orbits
     3.6s  LOCK     the electrons lock on with a flash
     4.6s  FOLD     the orbits fold into the eye: almond, tile, swash,
                    crescent, each star landing on a point sampled from
                    the real logo artwork
     7.0s  MARK     the stars dissolve into the real mark; its crescent
                    follows the pointer, as it does across the site
     8.0s  WORX     each letter streams out from the centre, blur to
                    sharp, and a light sweeps the word (home.css)
     9.3s  SIGN-OFF <like/magic>, the visitor's name, and a way back

   Use: WorxFinale.play({ name: "Jane" }). Returns false if it can't
   play (it is already open). Add ?finale to a page's URL to preview it
   without sending anything; ?finale=6.5 holds it at 6.5 s.

   Degrades: reduced motion or no WebGL = the settled lockup fades in,
   no stars. The loop runs only while the finale is open.
   ============================================================ */

(function () {
  "use strict";

  var script = document.currentScript;
  var ASSETS = new URL("../assets/logo-eye/", script ? script.src : location.href).href;
  var LOGO = { base: ASSETS + "logo-light-base.png", crescent: ASSETS + "logo-light-crescent.png" };

  // the eye's outline and the crescent's travel, in logo-light.png's own
  // pixels (the same geometry as logo-eye.js)
  var EYE = {
    mx: 72, my: 20,
    path: "M51 350L63 339L75 329L87 319L99 309L111 298L123 289L135 281L147 273L159 267L171 261L183 256L195 251L207 247L219 244L231 241L243 239L255 237L267 236L279 235L291 235L303 235L315 236L327 237L339 239L351 242L363 245L375 248L387 252L399 257L411 262L423 269L435 275L447 283L459 292L471 301L483 312L495 322L507 332L519 342L528 350L519 358L507 368L495 378L483 389L471 399L459 409L447 417L435 425L423 432L411 438L399 443L387 448L375 452L363 456L351 459L339 461L327 463L315 464L303 465L291 466L279 465L267 465L255 464L243 462L231 460L219 457L207 453L195 449L183 445L171 440L159 434L147 427L135 420L123 411L111 402L99 392L87 382L75 371L63 361Z"
  };

  // the beats, in seconds (the star shader has its own copy of the first three)
  var CUT = {
    lock: 3.6, fold: 4.6, mark: 7.0,
    markIn: [6.9, 7.9], word: 8.0, sweep: 8.55,
    tag: [9.3, 10.0], note: [9.9, 10.5], close: [10.4, 11.0]
  };
  var MARK = { x: 0, y: 0.13, size: 0.3 };        // where the mark sits, in units of the short side
  var MIX = { nucleus: 350, ring: 650, background: 900 };

  var reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");

  function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
  function sm(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function inOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* ----------------------------------------------------------
     Shaders
     ---------------------------------------------------------- */

  // the backdrop: near black (the title card's black), a warm glow while
  // the atom holds, the lock flash and its shock ring
  var BACK_VS = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  var BACK_FS = [
    "precision mediump float;",
    "uniform vec2 uRes;uniform vec4 uA;",
    "void main(){",
    " vec2 uv=(gl_FragCoord.xy-.5*uRes)/min(uRes.x,uRes.y);float r=length(uv);",
    " vec3 col=vec3(.027,.02,.04)+vec3(.12,.05,.02)*smoothstep(1.2,0.,r)*(1.-uA.w*.7);",
    " col+=vec3(1.,.55,.2)*uA.x*.12*exp(-r*r*5.);",
    " col+=vec3(1.,.82,.58)*uA.y*exp(-r*r*40.)*.9;",
    " col+=vec3(1.,.7,.4)*exp(-pow((r-uA.z)/.025,2.))*uA.y*.7;",
    " gl_FragColor=vec4(col,1.);",
    "}"
  ].join("\n");

  // every star is a quad stretched from where it was a moment ago to where
  // it is now: fast stars streak, settled ones are round points
  var STAR_VS = [
    "precision highp float;",
    "attribute vec4 aSeed;attribute vec2 aCorner;attribute float aRole;attribute vec2 aT;",
    "uniform vec2 uRes;uniform float uTime;uniform vec2 uMouse;uniform vec3 uMark;",
    "varying vec2 vL;varying float vLen,vW;varying vec3 vCol;",
    "const float PI=3.14159265;",
    "const float LOCK=3.6,FOLD=4.6,MARK=7.0;",
    "float ss(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}",
    // distance flown: already at speed, a warp push, then the stream relaxes
    "float G(float T){return T<2.5?1.4*T+.25*T*T:5.0625+2.4*(1.-exp(-(T-2.5)))+.25*(T-2.5);}",
    "vec3 rx(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);}",
    "vec3 ry(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}",
    "vec3 rz(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z);}",
    "vec2 rot(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}",
    // roles: 0-2 orbit rings, 3 nucleus, 4-6 electrons, 7 stars that stay in the sky
    "vec3 atom(float T,vec4 sd,float role){",
    " vec3 q;float sz;",
    " if(role<2.5){float th=sd.x*2.*PI+T*(.55+.12*role);float R=.34*(1.+(sd.z-.5)*.05);",
    "  q=vec3(cos(th)*R,sin(th)*R,(sd.y-.5)*.014);q=rz(rx(q,1.2),role*PI/3.+.3);sz=.9;}",
    " else if(role<3.5){vec3 d=normalize(sd.xyz-.5+1e-4);float rr=.055*pow(sd.w,.33);",
    "  q=ry(rx(d*rr,T*.7+sd.x*6.),T*.9)*(1.+.06*sin(T*3.+sd.y*20.));sz=1.25;}",
    " else{float k=role-4.;float th=k*2.1+T*2.6;",
    "  q=vec3(cos(th)*.34,sin(th)*.34,0.);q=rz(rx(q,1.2),k*PI/3.+.3);sz=4.;}",
    " q=ry(q,sin(T*.25)*.5+uMouse.x*.3);",
    " q=rx(q,.25*sin(T*.18)-uMouse.y*.25);",
    " float per=2.4/(2.4-q.z);",
    " return vec3(q.xy*per,sz*per);}",
    "void capture(vec4 sd,float role,out float c0,out float ln){",
    " if(role<2.5){c0=1.2+sd.z*1.4;ln=1.3;}else if(role<3.5){c0=.9+sd.z*.7;ln=1.2;}",
    " else if(role<6.5){c0=3.;ln=.6;}else{c0=999.;ln=1.;}}",
    // where a star is at time T; kref keeps a captured star from wrapping mid-capture
    "vec4 place(float T,vec4 sd,float role,float kref,vec2 tg,out vec3 col){",
    " float S=min(uRes.x,uRes.y);float hw=.5*uRes.x/S+.35,hh=.5*uRes.y/S,span=2.*hw;",
    " float z=mix(.25,1.,sd.w*sd.w);float v=.25+z;",
    " vec3 F=vec3(sd.x*span+v*G(T)-kref*span-hw,(sd.y-.5)*hh*2.2+.02*sin(T*.7+sd.z*9.),.4+.9*z);",
    " vec3 fc=mix(vec3(1.,.9,.78),vec3(1.,.76,.46),sd.z)*(.7+.7*z);",
    " if(role>6.5){col=fc*mix(1.,.3,ss(4.5,8.,T));return vec4(F,0.);}",
    " float c0,ln;capture(sd,role,c0,ln);",
    " float e=ss(c0,c0+ln,T);",
    " if(e<=0.){col=fc;return vec4(F,0.);}",
    " vec3 A=atom(T,sd,role);",
    // pulled in along a curve: a blend plus a swirl that is zero at both ends
    " vec2 pp=rot(mix(F.xy,A.xy,1.-(1.-e)*(1.-e)),6.*e*(1.-e));",
    " vec3 tc=role<2.5?vec3(1.,.72,.36)*.8:(role<3.5?vec3(1.,.42,.14)*.5:vec3(1.,.95,.86)*2.6);",
    " if(role>3.5&&T>LOCK)tc*=1.+2.5*exp(-(T-LOCK)*2.5);",
    " col=mix(fc,tc,e);float sz=mix(F.z,A.z,e);",
    // the orbits fold into the eye: each star lands on its point of the mark
    " float t0=FOLD+sd.z*.8;float e2=ss(t0,t0+1.3,T);",
    " if(e2>0.){",
    "  vec2 c=uMark.xy;",
    "  pp=c+rot(mix(pp,c+tg*uMark.z,1.-(1.-e2)*(1.-e2))-c,-3.*e2*(1.-e2));",
    "  vec3 mc=role<.5?vec3(1.,.9,.74)*.85:(role<1.5?vec3(1.,.86,.66)*.5:(role<2.5?vec3(1.,.74,.16)*.9:(role<3.5?vec3(1.,.95,.85)*.7:vec3(1.,.95,.86)*2.)));",
    "  col=mix(col,mc,e2);sz=mix(sz,role>3.5?2.2:.8,e2);",
    // then dissolve as the real mark takes over
    "  float e3=ss(MARK+sd.w*.4,MARK+.7+sd.w*.5,T);",
    "  pp+=(pp-c)*e3*.12+vec2(0.,e3*.03*sd.y);col*=1.-e3;",
    " }",
    " return vec4(pp,sz,e);}",
    "void main(){",
    " float S=min(uRes.x,uRes.y);float span=2.*(.5*uRes.x/S+.35);",
    " float T=uTime,Tt=max(T-.045,0.);",
    " float c0,ln;capture(aSeed,aRole,c0,ln);",
    " float z=mix(.25,1.,aSeed.w*aSeed.w);",
    " float kref=floor((aSeed.x*span+(.25+z)*G(min(T,c0)))/span);",
    " vec3 ch,ct;",
    " vec4 H=place(T,aSeed,aRole,kref,aT,ch);vec4 Tl=place(Tt,aSeed,aRole,kref,aT,ct);",
    " vec2 Hs=H.xy*S+.5*uRes,Ts=Tl.xy*S+.5*uRes;",
    " if(length(Hs-Ts)>S*.2)Ts=Hs;",
    " vec2 d=Hs-Ts;float len=length(d);vec2 dir=len>1e-3?d/len:vec2(1.,0.);vec2 nrm=vec2(-dir.y,dir.x);",
    " float w=max(1.4,S*.0024*H.z);",
    " float along=mix(-w,len+w,aCorner.x);",
    " vec2 P=Ts+dir*along+nrm*w*aCorner.y;",
    " vL=vec2(along,w*aCorner.y);vLen=len;vW=w;",
    " float tw=.85+.15*sin(T*(1.5+aSeed.z*3.)+aSeed.x*40.);",
    " vCol=ch*mix(tw,1.,H.w);",
    " gl_Position=vec4(P/uRes*2.-1.,0.,1.);",
    "}"
  ].join("\n");
  var STAR_FS = [
    "precision mediump float;",
    "varying vec2 vL;varying float vLen,vW;varying vec3 vCol;",
    "void main(){",
    " float x=clamp(vL.x,0.,vLen);float d=length(vec2(vL.x-x,vL.y))/vW;",
    " float fade=vLen>.5?mix(.45,1.,clamp(vL.x/vLen,0.,1.)):1.;",
    // a solid core with a short soft edge: thick and opaque, not wispy
    " float a=(smoothstep(1.,.55,d)+exp(-d*d*2.)*.35)*fade;",
    " gl_FragColor=vec4(vCol*a,1.);",
    "}"
  ].join("\n");

  /* ----------------------------------------------------------
     Where each star lands: points sampled from the real logo
     (the almond's edge, the tile's edge, the swash, the crescent).
     If the artwork can't be read (a file:// page taints the canvas),
     the same parts are drawn from their geometry instead.
     ---------------------------------------------------------- */

  var markPts = null, markLoading = null;

  function loadImage(src) {
    return new Promise(function (ok, no) {
      var im = new Image();
      im.onload = function () { ok(im); };
      im.onerror = no;
      im.src = src;
    });
  }

  function sampleArtwork(ims) {
    var W0 = 582, H0 = 600, c = document.createElement("canvas");
    c.width = W0; c.height = H0;
    var x = c.getContext("2d", { willReadFrequently: true });
    function pixels(im) { x.clearRect(0, 0, W0, H0); x.drawImage(im, 0, 0); return x.getImageData(0, 0, W0, H0).data; }
    var b = pixels(ims[0]), cr = pixels(ims[1]);
    function at(d, px, py) {
      if (px < 0 || py < 0 || px >= W0 || py >= H0) return [0, 0, 0, 0];
      var i = (py * W0 + px) * 4;
      return [d[i], d[i + 1], d[i + 2], d[i + 3]];
    }
    function black(p) { return p[3] > 200 && p[0] < 60 && p[1] < 60 && p[2] < 60; }
    function solid(p) { return p[3] > 200; }
    function yellow(p) { return p[3] > 200 && p[0] > 190 && p[1] > 140 && p[1] < 215 && p[2] < 110; }
    var pts = { almond: [], tile: [], swash: [], crescent: [] };
    for (var py = 0; py < H0; py += 2) for (var px = 0; px < W0; px += 2) {
      var p = at(b, px, py), n = [at(b, px + 3, py), at(b, px - 3, py), at(b, px, py + 3), at(b, px, py - 3)];
      if (black(p) && n.some(function (q) { return !black(q); })) pts.almond.push([px, py]);
      else if (solid(p) && !black(p) && n.some(function (q) { return !solid(q); })) pts.tile.push([px, py]);
      if (yellow(p)) pts.swash.push([px, py]);
      if (at(cr, px, py)[3] > 150) pts.crescent.push([px, py]);
    }
    if (!pts.almond.length || !pts.tile.length || !pts.swash.length || !pts.crescent.length) throw new Error("artwork unreadable");
    return pts;
  }

  function drawnFromGeometry() {
    var pts = { almond: [], tile: [], swash: [], crescent: [] }, i, t;
    var poly = EYE.path.replace(/[MZ]/g, "").split("L").map(function (s) { return s.trim().split(/\s+/).map(Number); });
    for (i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      for (t = 0; t < 1; t += 0.2) pts.almond.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    // the tile: a rounded square, 582 wide, corner radius about 70
    var r = 70, s = 580;
    for (t = 0; t < 1; t += 0.004) {
      var u = t * 4, side = Math.floor(u), f = u - side, px, py;
      var run = r + f * (s - 2 * r);
      if (side === 0) { px = run; py = 1; } else if (side === 1) { px = s; py = run; } else if (side === 2) { px = s - run; py = s; } else { px = 1; py = s - run; }
      pts.tile.push([px, py]);
    }
    for (i = 0; i < 4; i++) {
      var cx = i % 3 === 0 ? r : s - r, cy = i < 2 ? r : s - r;
      for (t = 0; t < 1; t += 0.05) { var ang = (i * 0.5 + t * 0.5) * Math.PI + Math.PI; pts.tile.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]); }
    }
    // the crescent: a disc with an offset disc taken out
    for (i = 0; i < 900; i++) {
      var qx = 198 + Math.random() * 186, qy = 258 + Math.random() * 186;
      if (Math.hypot(qx - 291, qy - 350) < 92 && Math.hypot(qx - 318, qy - 322) > 74) pts.crescent.push([qx, qy]);
    }
    // the swash: a brush stroke dipping into a hook
    for (i = 0; i < 600; i++) {
      t = Math.random();
      var sx = 205 + t * 170, sy = 110 - Math.sin(t * Math.PI * 1.15) * 30 + (t > 0.55 ? (t - 0.55) * 60 : 0);
      pts.swash.push([sx + (Math.random() - 0.5) * 12, sy + (Math.random() - 0.5) * 14]);
    }
    return pts;
  }

  function prepareMark() {
    if (!markLoading) {
      markLoading = Promise.all([loadImage(LOGO.base), loadImage(LOGO.crescent)])
        .then(sampleArtwork)
        .catch(function () { return drawnFromGeometry(); })
        .then(function (pts) { markPts = pts; return pts; });
    }
    return markLoading;
  }

  /* ----------------------------------------------------------
     The overlay
     ---------------------------------------------------------- */

  var open = null;

  function build(name) {
    var el = document.createElement("div");
    el.className = "wf";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", "wf-title");
    el.setAttribute("aria-describedby", "wf-sub");
    el.tabIndex = -1;
    el.innerHTML =
      '<canvas class="wf-sky" aria-hidden="true"></canvas>' +
      '<div class="wf-mark" aria-hidden="true"><svg viewBox="0 0 582 582">' +
        '<defs><clipPath id="wf-eye"><path d="' + EYE.path + '"/></clipPath></defs>' +
        '<image width="582" height="800" href="' + LOGO.base + '"/>' +
        '<g clip-path="url(#wf-eye)"><image class="wf-crescent" width="582" height="800" href="' + LOGO.crescent + '"/></g>' +
      '</svg></div>' +
      '<p class="wf-word" aria-hidden="true">' +
        '<span style="--i:0"><b>W</b></span><span style="--i:1"><b>O</b></span><span style="--i:2"><b>R</b></span><span style="--i:3"><b>X</b></span>' +
        '<i class="wf-sweep-clip"><i class="wf-sweep"></i></i></p>' +
      '<p class="wf-tag" aria-hidden="true">&lt;like/magic&gt;</p>' +
      '<h2 class="wf-note" id="wf-title"></h2>' +
      '<p class="wf-sub" id="wf-sub">We\'ll be in touch within one working day.</p>' +
      '<button class="btn btn-primary wf-close" type="button">Back to the page</button>';
    var first = (name || "").trim().split(/\s+/)[0];
    el.querySelector(".wf-note").textContent = first ? "Signal received, " + first : "Signal received";
    return el;
  }

  function play(opts) {
    opts = opts || {};
    if (open) return false;
    var hold = typeof opts.hold === "number" ? opts.hold : null;
    var reduced = reducedMq.matches;

    var el = build(opts.name);
    document.body.appendChild(el);
    var prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    var returnFocus = document.activeElement;

    var canvas = el.querySelector(".wf-sky");
    var markEl = el.querySelector(".wf-mark"), crescent = el.querySelector(".wf-crescent");
    var letters = [].slice.call(el.querySelectorAll(".wf-word > span")), offs = [1.5, 0.5, -0.5, -1.5];
    var sweep = el.querySelector(".wf-sweep");
    var tag = el.querySelector(".wf-tag"), note = el.querySelector(".wf-note"), sub = el.querySelector(".wf-sub");
    var closeBtn = el.querySelector(".wf-close");

    var gl = reduced ? null : canvas.getContext("webgl", { antialias: false, alpha: false });
    var W = 1, H = 1, SZ = 1, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var mouse = { x: 0, y: 0 }, mouseT = { x: 0, y: 0 }, pupil = { x: 0, y: 0 };
    var raf = 0, t0 = 0, closing = false;
    var g = null, waiting = !!gl;   // GL state, once the mark's points are ready

    function resize() {
      W = el.clientWidth || window.innerWidth; H = el.clientHeight || window.innerHeight; SZ = Math.min(W, H);
      el.style.setProperty("--sz", SZ + "px");
      if (gl) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    }
    resize();
    window.addEventListener("resize", resize);

    function onMove(e) { mouseT.x = (e.clientX / W) * 2 - 1; mouseT.y = -((e.clientY / H) * 2 - 1); }
    el.addEventListener("pointermove", onMove);

    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "Tab") { e.preventDefault(); closeBtn.focus(); }   // one control: keep focus inside
    }
    el.addEventListener("keydown", onKey);
    closeBtn.addEventListener("click", close);

    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(sh)); return null; }
      return sh;
    }
    function link(vs, fs, attrs) {
      var v = compile(gl.VERTEX_SHADER, vs), f = compile(gl.FRAGMENT_SHADER, fs);
      if (!v || !f) return null;
      var p = gl.createProgram();
      gl.attachShader(p, v); gl.attachShader(p, f);
      attrs.forEach(function (n, i) { gl.bindAttribLocation(p, i, n); });
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(p)); return null; }
      return p;
    }

    function setupGL(pts) {
      var back = link(BACK_VS, BACK_FS, ["a"]), stars = link(STAR_VS, STAR_FS, ["aSeed", "aCorner", "aRole", "aT"]);
      if (!back || !stars) return null;
      var quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

      var roles = [], i, k;
      for (i = 0; i < MIX.nucleus; i++) roles.push(3);
      for (k = 0; k < 3; k++) for (i = 0; i < MIX.ring; i++) roles.push(k);
      roles.push(4, 5, 6);
      for (i = 0; i < MIX.background; i++) roles.push(7);
      var land = { 0: pts.almond, 1: pts.tile, 2: pts.swash, 3: pts.crescent, 4: pts.crescent, 5: pts.crescent, 6: pts.crescent };
      var seed = 7, rnd = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      var corners = [0, -1, 1, -1, 1, 1, 0, -1, 1, 1, 0, 1];
      var data = new Float32Array(roles.length * 6 * 9), o = 0;
      roles.forEach(function (r) {
        var s4 = [rnd(), rnd(), rnd(), rnd()], tu = 0, tv = 0, list = land[r];
        if (list) { var q = list[Math.floor(rnd() * list.length)]; tu = q[0] / 582 - 0.5; tv = 0.5 - q[1] / 582; }
        for (var v = 0; v < 6; v++) {
          data[o++] = s4[0]; data[o++] = s4[1]; data[o++] = s4[2]; data[o++] = s4[3];
          data[o++] = corners[v * 2]; data[o++] = corners[v * 2 + 1]; data[o++] = r;
          data[o++] = tu; data[o++] = tv;
        }
      });
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      function locs(p, names) { var l = {}; names.forEach(function (n) { l[n] = gl.getUniformLocation(p, n); }); return l; }
      return {
        back: back, stars: stars, quad: quad, buf: buf, count: roles.length * 6,
        bl: locs(back, ["uRes", "uA"]),
        sl: locs(stars, ["uRes", "uTime", "uMouse", "uMark"])
      };
    }

    function renderGL(T) {
      var cw = canvas.width, ch = canvas.height;
      gl.viewport(0, 0, cw, ch);
      var lock = T > CUT.lock ? Math.exp(-(T - CUT.lock) * 2.2) : 0;
      var born = T > CUT.mark ? Math.exp(-(T - CUT.mark) * 2.6) * 0.5 : 0;

      gl.useProgram(g.back);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.quad);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(g.bl.uRes, cw, ch);
      gl.uniform4f(g.bl.uA, sm(1.5, CUT.lock, T) * (1 - sm(CUT.fold, CUT.mark + 1, T)), lock + born, T > CUT.lock ? (T - CUT.lock) * 0.32 : 0, sm(CUT.fold, CUT.mark + 1.5, T));
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.useProgram(g.stars);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.buf);
      for (var a = 0; a < 4; a++) gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 36, 0);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 36, 16);
      gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 36, 24);
      gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 36, 28);
      gl.uniform2f(g.sl.uRes, cw, ch);
      gl.uniform1f(g.sl.uTime, T);
      gl.uniform2f(g.sl.uMouse, mouse.x, mouse.y);
      gl.uniform3f(g.sl.uMark, MARK.x, MARK.y, MARK.size);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.TRIANGLES, 0, g.count);
      gl.disable(gl.BLEND);
      for (a = 1; a < 4; a++) gl.disableVertexAttribArray(a);
    }

    // the lockup in the DOM, from the same clock
    function renderCard(T) {
      var m = sm(CUT.markIn[0], CUT.markIn[1], T);
      markEl.style.opacity = m.toFixed(3);
      markEl.style.transform = "translate(-50%,-50%) scale(" + (0.94 + 0.06 * m).toFixed(4) + ")";
      markEl.style.filter = "drop-shadow(0 0 " + Math.round(SZ * 0.05) + "px rgba(229,125,35," + (0.35 * m).toFixed(3) + "))";
      // the pupil eases toward the pointer on an ellipse that fits the almond
      var tx = mouse.x, ty = -mouse.y, l = Math.hypot(tx, ty);
      if (l > 1) { tx /= l; ty /= l; }
      pupil.x += (tx - pupil.x) * 0.08; pupil.y += (ty - pupil.y) * 0.08;
      crescent.setAttribute("transform", "translate(" + (pupil.x * EYE.mx).toFixed(2) + " " + (pupil.y * EYE.my).toFixed(2) + ")");
      letters.forEach(function (el, i) {
        var x = clamp((T - CUT.word - i * 0.05) / 1.05, 0, 1), e = 1 - Math.pow(1 - x, 4);
        el.style.opacity = Math.min(1, x / 0.35).toFixed(3);
        el.style.transform = "translateX(" + ((1 - e) * offs[i]).toFixed(3) + "em) scale(" + (0.06 + 0.94 * e).toFixed(4) + ")";
        el.style.filter = "blur(" + ((1 - e) * 24).toFixed(1) + "px) brightness(" + (1 + 2 * (1 - e)).toFixed(2) + ") drop-shadow(0 0 34px rgba(229,125,35," + (0.45 * e).toFixed(3) + "))";
      });
      sweep.style.transform = "translateX(" + (-120 + 240 * inOut(clamp((T - CUT.sweep) / 1.4, 0, 1))).toFixed(1) + "%)";
      tag.style.opacity = sm(CUT.tag[0], CUT.tag[1], T).toFixed(3);
      tag.style.letterSpacing = (0.9 - 0.4 * sm(CUT.tag[0], CUT.tag[1] + 0.2, T)).toFixed(3) + "em";
      var n = sm(CUT.note[0], CUT.note[1], T);
      note.style.opacity = sub.style.opacity = n.toFixed(3);
      closeBtn.style.opacity = sm(CUT.close[0], CUT.close[1], T).toFixed(3);
      el.classList.toggle("is-done", T >= CUT.close[0]);
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (waiting) { renderCard(0); return; }                    // the overlay is up; the stars start once the mark is read
      if (!t0) t0 = now;
      var T = hold !== null ? hold : (now - t0) / 1000;
      if (reduced) T = 99;                                        // reduced motion: the settled lockup
      else if (!g) T = hold !== null ? hold : T + CUT.markIn[0];  // no WebGL: skip the stars, keep the title card
      mouse.x += (mouseT.x - mouse.x) * 0.06; mouse.y += (mouseT.y - mouse.y) * 0.06;
      if (g) renderGL(T);
      renderCard(T);
    }

    function start() {
      el.classList.add("is-open");
      el.focus({ preventScroll: true });
      raf = requestAnimationFrame(frame);
    }

    function close() {
      if (closing) return;
      closing = true;
      el.classList.remove("is-open");
      el.classList.add("is-closing");
      setTimeout(function () {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        if (gl) { var lose = gl.getExtension("WEBGL_lose_context"); if (lose) lose.loseContext(); }
        el.remove();
        document.documentElement.style.overflow = prevOverflow;
        open = null;
        if (returnFocus && returnFocus.focus) returnFocus.focus({ preventScroll: true });
        if (typeof opts.onClose === "function") opts.onClose();
      }, 450);
    }

    open = { close: close };
    start();
    if (gl) {
      prepareMark().then(function (pts) {
        if (closing) return;
        g = setupGL(pts);
        if (!g) gl = null;
        waiting = false;
      });
    }
    return true;
  }

  // warm the artwork up so the first play starts at once
  if (!reducedMq.matches) prepareMark();

  window.WorxFinale = { play: play, close: function () { if (open) open.close(); } };

  // preview without sending anything: ?finale, or ?finale=6.5 to hold at 6.5 s
  var m = /[?&]finale(?:=([\d.]+))?(?:&|$)/.exec(location.search);
  if (m) {
    var go = function () { play({ name: "", hold: m[1] ? parseFloat(m[1]) : undefined }); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
  }
})();
