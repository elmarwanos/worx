/* ============================================================
   Worx | cosmos.js
   The home page's generated visuals: one WebGL fragment shader that
   renders the solar system live, resolution-independent (sharp at 4K),
   nothing downloaded but this file.

   Two modes, one shader:
   - "journey": THE GRAND TOUR, a 14 s seamless loop that is a whole
     universe's life:
       0.0  SINGULARITY  darkness, one white-hot point
       0.7  BIG BANG     it erupts: flash, a shockwave sphere expanding
                         with a newborn, cooling universe inside it
       1.6  WARP         the ship punches through the new space
       2.4  THE TOUR     flown outward in physical order: the Sun's
                         surface and corona, Earth, Mars, the main belt,
                         Jupiter, Saturn's rings
      11.9  BIG CRUNCH   stars reverse and stream inward, space twists
                         into a spiral around a burning accretion ring
      13.8  SINGULARITY  everything is back in the point: the loop seam
     Stars streak with the ship's speed; extra thrust can be fed in (the
     hero adds it from scroll).
   - "portrait": one body, framed, turning slowly, leaning toward the
     pointer (the service modules and the launch section).

   Bodies: 0 Sun, 1 Earth, 2 Mars, 3 Jupiter, 4 Saturn (5 = main belt,
   journey only). Every surface is procedural noise: no textures.

     Cosmos.mount(canvas, { mode, body, scale, radius, offsetX (number or
       function), still (portrait: no lean, so overlays can pin to it),
       boost(), onTick(info) })
       -> { setBody(i), pause(), play(), destroy() }
   ============================================================ */

(function (global) {
  "use strict";

  var LOOP = 14;
  var BANG = [0.7, 2.0];       // eruption -> the bubble fills the frame
  var CRUNCH = [11.9, 13.8];   // implosion back into the point
  // [start, end] in loop seconds; the body flies out of the vanishing
  // point, grows and slides off-frame past the camera.
  var PASSES = [
    { body: 0, t0: 2.35, t1: 4.45, from: [0.06, 0.02], to: [1.5, 0.18], r0: 0.05, r1: 1.9, label: "SOL", au: 0 },
    { body: 1, t0: 4.1, t1: 5.75, from: [-0.05, 0.03], to: [-1.3, -0.25], r0: 0.02, r1: 1.05, label: "EARTH", au: 1.0 },
    { body: 2, t0: 5.45, t1: 7.15, from: [0.05, -0.02], to: [1.2, -0.5], r0: 0.02, r1: 0.95, label: "MARS", au: 1.52 },
    { body: 5, t0: 6.9, t1: 8.1, from: [0, 0], to: [0, 0], r0: 0, r1: 0, label: "MAIN BELT", au: 2.7 },
    { body: 3, t0: 7.85, t1: 9.95, from: [-0.07, 0.04], to: [-1.55, 0.3], r0: 0.03, r1: 1.35, label: "JUPITER", au: 5.2 },
    { body: 4, t0: 9.6, t1: 11.95, from: [0.08, 0.05], to: [1.05, -0.62], r0: 0.02, r1: 0.62, label: "SATURN", au: 9.58 }
  ];

  var VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

  var FRAG = [
    "precision highp float;",
    "uniform vec2 uRes;uniform float uTime;uniform float uTravel;uniform float uSpeed;uniform vec2 uMouse;",
    "uniform float uMode;uniform float uFlash;",
    // up to two bodies on screen at once in the journey (crossovers);
    // xyz = centre.x, centre.y, radius; w = body id (-1 = none)
    "uniform vec4 uA;uniform vec4 uB;uniform float uBelt;uniform float uSpin;uniform float uWash;",
    // the universe's life: uPoint = the singularity's light, uBang = the
    // creation bubble's radius (0 -> fills the frame), uCrunch = implosion
    "uniform float uPoint;uniform float uBang;uniform float uCrunch;",
    "#define PI 3.14159265",

    "float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}",
    "vec2 h22(vec2 p){float n=h21(p);return vec2(n,h21(p+n+17.3));}",
    "float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}",
    "float n3(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.-2.*f);",
    " return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),",
    "  mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}",
    "float fbm3(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n3(p);p=p*2.02+vec3(1.7,9.2,3.1);a*=.5;}return v;}",
    "float n2(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.-2.*f);",
    " return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}",
    // each octave turned (~37deg) so the value-noise grid never lines up
    // into visible squares
    "float fbm2(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n2(p);p=mat2(1.656,1.242,-1.242,1.656)*p+vec2(3.1,1.7);a*=.5;}return v;}",
    "mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}",
    "vec3 rotY(vec3 n,float t){return vec3(n.x*cos(t)-n.z*sin(t),n.y,n.x*sin(t)+n.z*cos(t));}",

    // ---- sky: distant stars, warp streaks, a warm nebula -----------
    "vec3 sky(vec2 p){",
    " vec3 col=vec3(0.);",
    " for(int i=0;i<3;i++){float fi=float(i);",
    "  float sc=70.+fi*55.;vec2 g=(p+vec2(uTravel*.002*(fi+1.),0.))*sc+fi*13.1;",
    "  vec2 id=floor(g);vec2 f=fract(g)-.5;vec2 o=h22(id)-.5;float s=h21(id+7.1);",
    "  float d=length(f-o*.7);float tw=.55+.45*sin(uTime*(.7+s*2.3)+s*50.);",
    "  col+=mix(vec3(1.,.86,.72),vec3(.8,.86,1.),step(.6,h21(id+3.)))*step(.9,s)*exp(-d*d*(420.-fi*90.))*tw*(.9-fi*.22);",
    " }",
    " float r=length(p);float a=atan(p.y,p.x);float lr=log(r+.0015);",
    " float spd=clamp(uSpeed,0.,1.6);",
    " for(int i=0;i<3;i++){float fi=float(i);",
    "  float na=110.+fi*70.;",
    "  vec2 u=vec2(a/(2.*PI)*na,lr*5.5-uTravel*(1.+fi*.35));",
    "  vec2 id=floor(u);vec2 f=fract(u);vec2 o=h22(id+fi*3.7);",
    "  float on=step(.86-spd*.1,h21(id*.73+fi));",
    "  float s2=clamp(spd,0.,1.4);float st=mix(.025,.75,s2*s2*.6);",
    "  float dx=(f.x-o.x);float dy=(f.y-o.y);",
    "  float w=exp(-dx*dx*220.)*exp(-dy*dy/(st*st)*1.6);",
    "  vec3 sc=mix(vec3(1.,.92,.82),vec3(1.,.5,.18),h21(id+2.3));",
    "  float depth=pow(smoothstep(.02,.9,r),1.3);",
    "  col+=sc*w*on*depth*(.25+s2*1.6)*(.5+fi*.3);",
    " }",
    " vec2 q=p*1.15;float nb=fbm2(q*1.4+vec2(uTravel*.03,-uTravel*.012));",
    " float m=fbm2(q*2.6+nb*1.7-vec2(uTravel*.02,0.));",
    " col+=mix(vec3(.04,.012,.01),vec3(.42,.12,.04),smoothstep(.45,.95,m))*.32;",
    " col+=vec3(.22,.05,.11)*pow(nb,5.)*.55;",
    " return col;",
    "}",

    // ---- asteroid belt: rocks tumbling out of the vanishing point --
    "vec4 belt(vec2 p,float k){",
    " vec3 col=vec3(0.);float cov=0.;float r=length(p);float a=atan(p.y,p.x);float lr=log(r+.002);",
    " for(int i=0;i<2;i++){float fi=float(i);",
    "  float na=26.+fi*18.;vec2 u=vec2(a/(2.*PI)*na,lr*3.2-uTravel*(.9+fi*.3));",
    "  vec2 id=floor(u);vec2 f=fract(u)-.5;vec2 o=(h22(id+fi*9.)-.5)*.55;",
    "  float on=step(.45,h21(id+fi*1.7));",
    "  vec2 d=(f-o);d.x*=1.;float ro=.16+.18*h21(id+4.);",
    "  float lump=ro*(1.+.35*(n2(vec2(atan(d.y,d.x)*1.6+id.x,id.y))-.5));",
    "  float m=smoothstep(lump,lump*.8,length(d))*on*smoothstep(.02,.25,r);",
    "  float lit=.35+.65*clamp(dot(normalize(d+1e-4),normalize(vec2(-.6,.8)))*.5+.5,0.,1.);",
    "  vec3 rc=mix(vec3(.16,.1,.07),vec3(.5,.34,.22),n2(u*9.))*lit;",
    "  col=mix(col,rc,m);cov=max(cov,m);",
    " }",
    " float env=smoothstep(0.,.2,k)*smoothstep(1.,.75,k);",
    " return vec4(col,cov*env);",
    "}",

    // ---- one sphere: returns rgb + coverage --------------------------
    "vec4 body(vec2 p,vec4 B){",
    " if(B.w<-.5||B.z<=0.)return vec4(0.);",
    " vec2 q=(p-B.xy)/B.z;float d2=dot(q,q);int id=int(B.w+.5);",
    " vec3 col=vec3(0.);float cov=0.;",
    " vec3 L=normalize(vec3(.82,.3,.48));",
    " float dist=sqrt(d2);",

    // the Sun: emissive, granulated, limb-darkened; corona and prominences outside
    " if(id==0){",
    "  float ang=atan(q.y,q.x);",
    "  float streamer=pow(fbm2(vec2(ang*6.,dist*2.-uTime*.2)),2.2);",
    "  float halo=exp(-(dist-1.)*4.)*.55*(.55+streamer)+exp(-(dist-1.)*18.)*1.1;",
    "  float prom=pow(fbm2(vec2(ang*5.,uTime*.4)),4.)*9.*exp(-(dist-1.)*11.);",
    "  if(dist>1.){col=vec3(1.,.34,.07)*max(halo,0.)+vec3(1.,.5,.16)*prom;cov=clamp(max(halo,prom)*.55,0.,1.);}",
    "  else{vec3 n=vec3(q,sqrt(1.-d2));",
    "   vec3 nr=rotY(n,uSpin*.4+uTime*.03);",
    "   float g=fbm3(nr*7.+vec3(0.,uTime*.22,0.));float g2=fbm3(nr*26.-vec3(uTime*.35));",
    "   float cell=smoothstep(.3,.8,g*.65+g2*.45);",
    "   float spots=smoothstep(.68,.74,fbm3(nr*3.1+11.));",
    "   float limb=pow(n.z,.55);",
    "   vec3 base=mix(vec3(.9,.22,.03),vec3(1.,.72,.3),cell);",
    "   base=mix(base,vec3(.35,.06,.01),spots*.85);",
    "   col=base*limb*1.3+vec3(1.,.74,.4)*pow(limb,5.)*.35;",
    "   cov=1.;}",
    "  return vec4(col,cov);",
    " }",

    " if(d2>1.){",
    // atmospheres: thin lit rims just outside the limb
    "  float h=dist-1.;vec2 qn=q/dist;float lit=clamp(dot(qn,L.xy)*1.4+.35,0.,1.);",
    "  vec3 ac=id==1?vec3(.35,.6,1.):id==2?vec3(1.,.48,.22):id==3?vec3(1.,.8,.6):vec3(1.,.85,.62);",
    "  float st=id==1?1.:id==2?.7:.35;",
    "  col=ac*exp(-h*38.)*st*lit;cov=clamp(exp(-h*38.)*st*lit,0.,1.)*.8;",
    "  if(id==4){",
    // Saturn's rings, the far side (behind the ball is covered below)
    "   vec2 rq=rot(-.42)*q;float rr=length(vec2(rq.x,rq.y/.27));",
    "   if(rr>1.28&&rr<2.35){",
    "    float band=.55+.45*sin(rr*38.)*sin(rr*11.+1.3);float gap=smoothstep(.02,.0,abs(rr-1.78))*.85;",
    "    float dens=smoothstep(1.28,1.4,rr)*smoothstep(2.35,2.2,rr)*(.35+.65*band)*(1.-gap);",
    "    vec3 rc=mix(vec3(.62,.5,.36),vec3(.95,.84,.64),band)*(.55+.45*clamp(rq.x*.5+.6,0.,1.));",
    "    col=mix(col,rc,dens*.92);cov=max(cov,dens*.92);",
    "   }",
    "  }",
    "  return vec4(col,cov);",
    " }",

    " vec3 n=vec3(q,sqrt(1.-d2));",
    " vec3 nr=rotY(n,uSpin+uTime*.05);",
    " float ndl=dot(n,L);float day=smoothstep(-.02,.28,ndl);day*=day*(3.-2.*day);",
    " vec3 alb=vec3(.5);vec3 night=vec3(0.);",

    " if(id==1){",
    "  float land=fbm3(nr*2.4)+.18*fbm3(nr*11.)-.09;float ocean=smoothstep(.525,.505,land);",
    "  vec3 soil=mix(vec3(.11,.16,.07),vec3(.36,.29,.17),smoothstep(.45,.75,fbm3(nr*7.)));",
    "  alb=mix(soil,vec3(.008,.035,.1),ocean);",
    "  alb=mix(alb,vec3(.9,.93,.97),smoothstep(.8,.88,abs(nr.y)));",
    "  float cl=smoothstep(.55,.85,fbm3(nr*5.2+vec3(uTime*.03,0.,0.))*.75+fbm3(nr*14.)*.35);",
    "  alb=mix(alb,vec3(.96,.97,1.),cl*.8);",
    "  float city=pow(n3(nr*180.),10.)*6.*(1.-ocean)*(1.-cl);",
    "  night=vec3(1.,.66,.3)*city*(1.-smoothstep(-.12,.05,ndl));",
    " } else if(id==2){",
    "  float t=fbm3(nr*2.3);float t2=fbm3(nr*8.+t);",
    "  alb=mix(vec3(.36,.12,.05),vec3(.8,.42,.2),smoothstep(.3,.72,t));alb*=.8+.35*t2;",
    "  alb=mix(alb,vec3(.18,.08,.05),smoothstep(.55,.62,fbm3(nr*4.1+3.))*.6);",
    "  alb=mix(alb,vec3(.95,.9,.86),smoothstep(.9,.94,nr.y));",
    " } else if(id==3){",
    "  float lat=nr.y;float turb=fbm3(nr*vec3(2.5,9.,2.5)+vec3(uTime*.02,0.,0.));",
    "  float b=sin(lat*19.+turb*3.2)*.5+.5;float b2=sin(lat*41.+turb*5.)*.5+.5;",
    "  alb=mix(vec3(.3,.15,.08),vec3(.9,.78,.6),b);alb=mix(alb,vec3(.66,.34,.18),b2*.5);alb*=.8+.35*turb;",
    "  vec2 sp=vec2(atan(nr.x,nr.z)-.6,lat+.33);float spot=smoothstep(.2,.1,length(sp*vec2(.7,2.3)));",
    "  alb=mix(alb,vec3(.72,.28,.14),spot*.85);",
    " } else if(id==4){",
    "  float lat=nr.y;float turb=fbm3(nr*vec3(2.,7.,2.));",
    "  float b=sin(lat*16.+turb*2.)*.5+.5;",
    "  alb=mix(vec3(.66,.52,.34),vec3(.93,.83,.62),b);",
    " }",

    " vec3 surf=alb*day*vec3(1.,.9,.8)*1.55+night;",
    " vec3 H=normalize(L+vec3(0.,0.,1.));",
    " if(id==1)surf+=vec3(1.,.85,.65)*pow(max(dot(n,H),0.),60.)*.55*day*(1.-smoothstep(.49,.52,fbm3(nr*2.6)));",
    " surf+=alb*vec3(.8,.3,.1)*smoothstep(-.1,.02,ndl)*(1.-smoothstep(.02,.16,ndl))*.35;",
    " vec3 ac=id==1?vec3(.35,.6,1.):id==2?vec3(1.,.5,.25):vec3(1.,.85,.62);",
    " surf+=ac*pow(1.-n.z,3.)*(.05+1.1*clamp(ndl+.25,0.,1.))*(id==1?1.:.6);",
    " surf+=alb*.01;",
    " col=surf;cov=smoothstep(1.,.985,dist);",

    // Saturn's rings, the near side, over the ball, with the ball's shadow
    " if(id==4){",
    "  vec2 rq=rot(-.42)*q;float rr=length(vec2(rq.x,rq.y/.27));",
    "  if(rq.y<0.&&rr>1.28&&rr<2.35){",
    "   float band=.55+.45*sin(rr*38.)*sin(rr*11.+1.3);float gap=smoothstep(.02,.0,abs(rr-1.78))*.85;",
    "   float dens=smoothstep(1.28,1.4,rr)*smoothstep(2.35,2.2,rr)*(.35+.65*band)*(1.-gap);",
    "   vec3 rc=mix(vec3(.62,.5,.36),vec3(.95,.84,.64),band);",
    "   col=mix(col,rc,dens*.92);",
    "  }",
    " }",
    " return vec4(col,cov);",
    "}",

    // near side of Saturn's rings in front of the empty sky (below the ball)
    "vec4 rings(vec2 p,vec4 B){",
    " if(B.w<3.5||B.w>4.5||B.z<=0.)return vec4(0.);",
    " vec2 q=(p-B.xy)/B.z;if(dot(q,q)<1.)return vec4(0.);",
    " vec2 rq=rot(-.42)*q;if(rq.y>=0.)return vec4(0.);",
    " float rr=length(vec2(rq.x,rq.y/.27));if(rr<1.28||rr>2.35)return vec4(0.);",
    " float band=.55+.45*sin(rr*38.)*sin(rr*11.+1.3);float gap=smoothstep(.02,.0,abs(rr-1.78))*.85;",
    " float dens=smoothstep(1.28,1.4,rr)*smoothstep(2.35,2.2,rr)*(.35+.65*band)*(1.-gap);",
    " return vec4(mix(vec3(.62,.5,.36),vec3(.95,.84,.64),band)*(.6+.4*clamp(rq.x*.5+.6,0.,1.)),dens*.92);",
    "}",

    "void main(){",
    " vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;",
    // a little handheld shake at speed, and a lean toward the pointer
    " float sh=clamp(uSpeed-.6,0.,1.);",
    " p+=vec2(n2(vec2(uTime*9.,1.)),n2(vec2(1.,uTime*9.)))*.004*sh;",
    " p+=uMouse*.02;",
    " vec2 p0=p;float r0=length(p0);",
    // BIG CRUNCH: space twists into a tightening spiral and is drawn into
    // the centre (sampling farther out = everything shrinks inward)
    " float cr=uCrunch;",
    " if(cr>0.){float c2=cr*cr;p=rot(c2*7./(r0+.12))*p;p*=1.+c2*c2*14.;}",
    " vec3 col=sky(p);",
    " if(uBelt>0.){vec4 bl=belt(p,uBelt);col=mix(col,bl.rgb,bl.a);}",
    // painter's order: the farther (smaller) body first
    " vec4 A=uA.z<=uB.z?uA:uB;vec4 Bb=uA.z<=uB.z?uB:uA;",
    " vec4 a1=body(p,A);col=mix(col,a1.rgb,a1.a);if(A.w>3.5&&A.w<4.5&&a1.a<.99){vec4 r1=rings(p,A);col=mix(col,r1.rgb,r1.a);}",
    " vec4 b1=body(p,Bb);col=mix(col,b1.rgb,b1.a);if(Bb.w>3.5&&Bb.w<4.5&&b1.a<.99){vec4 r2=rings(p,Bb);col=mix(col,r2.rgb,r2.a);}",
    // the Sun's light washing the frame as we pass it, and warp flashes
    " col+=vec3(1.,.38,.08)*uWash*.55*smoothstep(1.6,.2,length(p-uA.xy));",
    " col+=vec3(1.,.8,.6)*uFlash;",
    // anamorphic streak through a bright sun
    " if(uA.w<.5&&uA.w>-.5){vec2 ls=p-uA.xy;col+=vec3(1.,.7,.4)*exp(-abs(ls.y)*90.)*exp(-abs(ls.x)*1.3)*.35*smoothstep(.0,.2,uA.z);}",
    // BIG CRUNCH: an accretion ring burning around the drain, then dark
    " if(cr>0.){",
    "  float ringR=mix(.55,.0,pow(cr,1.4));",
    "  float ang=atan(p0.y,p0.x);float fil=.6+.4*fbm2(vec2(ang*3.+uTime*4.*cr,r0*9.));",
    "  col+=vec3(1.,.5,.16)*exp(-abs(r0-ringR)*(26.+cr*60.))*cr*2.4*fil;",
    "  float arms=pow(.5+.5*sin(ang*3.-log(r0+.02)*9.+uTime*6.),6.);",
    "  col+=vec3(1.,.42,.12)*arms*exp(-r0*2.5)*smoothstep(ringR,ringR+.4,r0)*cr*1.1;",
    "  col*=1.-smoothstep(.72,.97,cr)*smoothstep(.0,.25,r0);",
    " }",
    // BIG BANG: the creation bubble. Outside it: nothing yet. Its edge: a
    // white-hot shockwave; inside: space, still hot, cooling as it grows
    " if(uBang<1.){",
    "  float R=uBang*2.2;float edge=r0-R;",
    "  float inside=smoothstep(.02,-.02,edge);",
    "  float heat=1.-smoothstep(.0,.75,uBang);",
    "  float ang=atan(p0.y,p0.x);",
    "  float pl=fbm2(p0/max(R,.02)*3.+vec2(uTime*.9,-uTime*.6));float pl2=fbm2(p0/max(R,.02)*8.-uTime*1.3);",
    "  float fil=smoothstep(.42,.9,pl*.7+pl2*.45);fil*=fil;",
    "  vec3 plasma=mix(vec3(.12,.015,.005),vec3(.95,.32,.06),fil)+vec3(1.,.78,.45)*pow(fil,5.)*1.1;",
    "  plasma*=(.25+.75*smoothstep(R,0.,r0));",
    "  col=mix(col,col*(.2+.8*uBang)+plasma*heat,inside);",
    "  col*=inside;",
    "  float jag=.7+.3*fbm2(vec2(ang*7.,uTime*4.));",
    "  col+=vec3(1.,.5,.18)*exp(-abs(edge)*(30.-uBang*12.))*(1.-uBang*.55)*1.6*step(.001,uBang)*jag;",
    "  col+=vec3(1.,.93,.8)*exp(-abs(edge)*170.)*(1.-uBang)*1.9*step(.001,uBang);",
    " }",
    // the singularity: a pinpoint, a halo, a thin anamorphic line
    " if(uPoint>0.){",
    "  col+=vec3(1.,.97,.92)*exp(-r0*r0*9000.)*uPoint*3.;",
    "  col+=vec3(1.,.55,.2)*exp(-r0*38.)*uPoint*.55;",
    "  col+=vec3(1.,.7,.45)*exp(-abs(p0.y)*420.)*exp(-abs(p0.x)*6.)*uPoint*.6;",
    " }",
    // filmic tone map, vignette, grain
    " col=(col*(2.51*col+.03))/(col*(2.43*col+.59)+.14);",
    " col=pow(clamp(col,0.,1.),vec3(.4545));",
    " col*=1.-.42*pow(length((gl_FragCoord.xy/uRes-.5)*vec2(1.1,1.25)),2.2);",
    " col+=(h21(gl_FragCoord.xy+fract(uTime)*91.)-.5)/70.;",
    " gl_FragColor=vec4(col,1.);",
    "}"
  ].join("\n");

  // a portrait body's drawn radius, as a share of opts.radius
  function bodyScale(b) { return b === 4 ? 0.62 : b === 0 ? 0.8 : 1; }

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smooth(e0, e1, x) { var t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }

  // Ship speed through the loop: still in the point, a punch of warp out
  // of the Big Bang, cruise past the bodies, then pulled backward (a
  // negative speed: the streaks reverse) into the Big Crunch.
  function speedAt(t) {
    if (t < BANG[0]) return 0;
    if (t > CRUNCH[0]) return -1.5 * smooth(CRUNCH[0], CRUNCH[0] + 0.9, t);
    var warp = smooth(1.3, 1.8, t) * (1 - smooth(2.4, 3.1, t));
    var cruise = smooth(1.2, 2.2, t) * (0.32 + 0.18 * Math.sin(t * 1.3));
    return Math.max(warp * 1.45, cruise);
  }

  // The universe's life, as uniforms.
  function cycleAt(t) {
    var point = t < BANG[0] + 0.12 ? 0.55 + 0.45 * Math.sin(t * 22) * Math.sin(t * 7) : 0;
    if (t < BANG[0]) point = Math.max(point, smooth(0, 0.25, t));
    if (t > CRUNCH[1] - 0.25) point = Math.max(point, smooth(CRUNCH[1] - 0.25, CRUNCH[1], t) * 0.9);
    var b = t < BANG[0] ? 0 : t > BANG[1] ? 1 : 1 - Math.pow(1 - (t - BANG[0]) / (BANG[1] - BANG[0]), 3);
    var c = t < CRUNCH[0] ? 0 : Math.min(1, Math.pow((t - CRUNCH[0]) / (CRUNCH[1] - CRUNCH[0]), 1.6));
    if (t > CRUNCH[1]) { c = 0; b = 0; }                  // the seam: only the point
    var flash = Math.max(0, 1 - Math.abs(t - BANG[0] - 0.06) / 0.22) * 1.1;
    return { point: point, bang: b, crunch: c, flash: flash };
  }

  function passState(ps, t) {
    var k = (t - ps.t0) / (ps.t1 - ps.t0);
    if (k < 0 || k > 1) return null;
    var g = Math.pow(k, 1.7);
    return {
      k: k,
      x: ps.from[0] + (ps.to[0] - ps.from[0]) * g,
      y: ps.from[1] + (ps.to[1] - ps.from[1]) * g,
      r: ps.r0 ? ps.r0 * Math.pow(ps.r1 / ps.r0, Math.pow(k, 1.25)) : 0,
    };
  }

  function mount(canvas, opts) {
    opts = opts || {};
    var gl = canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: "high-performance" });
    if (!gl) return null;
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn("[cosmos]", gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn("[cosmos] link failed"); return null; }
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ["uRes", "uTime", "uTravel", "uSpeed", "uMouse", "uMode", "uFlash", "uA", "uB", "uBelt", "uSpin", "uWash", "uPoint", "uBang", "uCrunch"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var journey = opts.mode !== "portrait";
    var body = opts.body || 0;
    var scaleBase = opts.scale || 0.7;
    var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    var travel = 0, last = 0, t0 = performance.now(), running = false, visible = true, paused = false;
    var frozen = opts.freezeAt != null ? opts.freezeAt : null;   // debug / screenshots: ?cosmos=5.2

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var scale = dpr * scaleBase * (canvas.clientWidth < 720 ? 0.85 : 1);
      var w = Math.max(1, Math.round(canvas.clientWidth * scale));
      var h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    }
    var ro = "ResizeObserver" in window ? new ResizeObserver(function () { resize(); if (!running) draw(performance.now()); }) : null;
    if (ro) ro.observe(canvas); else window.addEventListener("resize", resize);
    resize();

    function onMove(e) {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = (0.5 - e.clientY / window.innerHeight) * 2;
    }
    window.addEventListener("pointermove", onMove, { passive: true });

    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible) kick();
    }, { rootMargin: "120px" }) : null;
    if (io) io.observe(canvas);

    function set4(u, s, id) { if (s) gl.uniform4f(u, s.x, s.y, s.r, id); else gl.uniform4f(u, 0, 0, 0, -1); }

    function draw(now) {
      var t = (now - t0) / 1000;
      if (frozen != null) t = frozen;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      var still = reduced || (!journey && opts.still);
      gl.uniform2f(U.uMouse, still ? 0 : mouse.x, still ? 0 : mouse.y);
      gl.uniform1f(U.uTime, (reduced ? 4 : t) % 600);
      var info = null;

      if (journey) {
        var lt = reduced ? 10.8 : t % LOOP;
        var boost = opts.boost ? opts.boost() : 0;
        var spd = (reduced ? 0.05 : speedAt(lt));
        if (spd >= 0 && lt > BANG[1]) spd += boost;
        travel += spd * dt * 2.4;
        var cyc = reduced ? { point: 0, bang: 1, crunch: 0, flash: 0 } : cycleAt(lt);
        var flash = cyc.flash;
        gl.uniform1f(U.uPoint, cyc.point);
        gl.uniform1f(U.uBang, cyc.bang);
        gl.uniform1f(U.uCrunch, cyc.crunch);
        var active = [];
        var beltK = 0, wash = 0, label = "DEEP SPACE", au = 0;
        for (var i = 0; i < PASSES.length; i++) {
          var ps = PASSES[i], s = passState(ps, lt);
          if (!s) continue;
          if (ps.body === 5) { beltK = s.k; } else active.push({ s: s, id: ps.body });
          if (s.k < 0.92) { label = ps.label; au = ps.au; }
          if (ps.body === 0) wash = smooth(0.45, 0.85, s.k) * (1 - smooth(0.88, 1, s.k)) * 0.8;
        }
        if (lt < BANG[0]) label = "SINGULARITY";
        else if (lt < 1.6) label = "BIG BANG";
        else if (lt < 2.35) label = "WARP";
        else if (lt > CRUNCH[0]) label = lt > CRUNCH[1] ? "SINGULARITY" : "BIG CRUNCH";
        set4(U.uA, active[0] && active[0].s, active[0] ? active[0].id : -1);
        set4(U.uB, active[1] && active[1].s, active[1] ? active[1].id : -1);
        gl.uniform1f(U.uBelt, beltK);
        gl.uniform1f(U.uWash, wash);
        gl.uniform1f(U.uFlash, flash);
        gl.uniform1f(U.uSpeed, spd);
        gl.uniform1f(U.uTravel, travel % 2000);
        gl.uniform1f(U.uSpin, t * 0.08);
        info = { t: lt, label: label, au: au, speed: spd, phase: lt < BANG[1] ? "bang" : lt > CRUNCH[0] ? "crunch" : "tour" };
      } else {
        travel += dt * 0.12;
        var R = opts.radius || 0.36;
        var cx = typeof opts.offsetX === "function" ? opts.offsetX() : opts.offsetX || 0;
        var lean = reduced || opts.still ? 0 : 1;
        gl.uniform4f(U.uA, cx + mouse.x * 0.01 * lean, mouse.y * 0.01 * lean, R * bodyScale(body), body);
        gl.uniform4f(U.uB, 0, 0, 0, -1);
        gl.uniform1f(U.uBelt, 0);
        gl.uniform1f(U.uWash, body === 0 ? 0.12 : 0);
        gl.uniform1f(U.uFlash, 0);
        gl.uniform1f(U.uSpeed, 0.05);
        gl.uniform1f(U.uTravel, travel % 2000);
        gl.uniform1f(U.uSpin, t * 0.12);
        gl.uniform1f(U.uPoint, 0);
        gl.uniform1f(U.uBang, 1);
        gl.uniform1f(U.uCrunch, 0);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (opts.onTick && info) opts.onTick(info);
    }

    function frame(now) {
      if (!visible || paused || document.hidden || reduced) { running = false; return; }
      draw(now);
      requestAnimationFrame(frame);
    }
    function kick() {
      if (running || paused) return;
      if (reduced) { draw(performance.now()); return; }
      running = true; last = 0;
      requestAnimationFrame(frame);
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden) kick(); });
    draw(performance.now());
    kick();

    return {
      setBody: function (i) { body = i; if (!running) draw(performance.now()); },
      pause: function () { paused = true; },
      play: function () { paused = false; kick(); },
      destroy: function () { paused = true; if (ro) ro.disconnect(); if (io) io.disconnect(); window.removeEventListener("pointermove", onMove); },
    };
  }

  global.Cosmos = { mount: mount, bodyScale: bodyScale, LOOP: LOOP, PASSES: PASSES, BANG: BANG, CRUNCH: CRUNCH };
})(window);
