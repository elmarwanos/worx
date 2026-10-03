/* ============================================================
   Worx | worx-audio.js
   The mission's sound system: one master channel, and the pulsar
   control that switches it (worx-audio.css draws it, bottom left,
   mirroring the contact beacon).

     MASTER   level -> on/off fade -> aperture (a low-pass that opens as
              the system comes online) -> limiter -> meter -> speakers
       ├── BED         the page's continuous soundscape (bed()): one
       │               instance for the whole visit, never restarted by
       │               scrolling; an endless loop of overlapping takes,
       │               bass centred, width from an uncorrelated take in
       │               the sides only. Felt more than heard: it sits
       │               ~10 dB under the sections, and DUCKS (duck()) a
       │               few dB, smoothly, under anything that matters.
       ├── SECTIONS    scenes: a soundscape bound to a part of the page.
       │   ├── HERO        The director sets each scene's bus from how
       │   ├── SERVICES    much of its section is in view, so moving
       │   ├── FLIGHT      between sections is a crossfade; a scene
       │   ├── TELEMETRY   silent for a while is put to sleep (sources
       │   ├── PORTFOLIO   stopped) and woken when it returns. A scene
       │   └── CRAMS       may duck the bed while present (duckBed).
       └── SFX         one-shots (relays, T-minus confirmations, tuner
                       static, signal lock...), placed in the stereo
                       field where they happen on screen (panAt(el),
                       within +-0.45: space, never ping-pong), each a
                       short dip in the bed. play() is a no-op while
                       the master is off, so one switch mutes them all.

   Gain staging: every source loudness-matched to -18 LUFS, then the bed
   at 15% (about -34.5 LUFS), each section at 20% (about -32 LUFS), the
   bed dipping to 12% under a present section; SFX peaks well below the
   limiter, which only ever catches the sum of rare peaks.

   Nothing sounds until the visitor asks: the page loads with sound off
   and no AudioContext exists before their press. Every load starts
   off, a reload included: the browser would hold a remembered "on"
   silent until a tap anyway, and a lit speaker that plays nothing
   reads as broken.

   For later scenes:
     WorxAudio.scene("flight", { bus: "flight", level: 0.8,
       presence: WorxAudio.presence(el),           // 0..1, per frame
       start: function (ctx, out) { ... },          // sources into out
       stop:  function () { ... } });
     WorxAudio.sfx("t-minus", { url: "...", gain: 0.5, bus: "flight", duck: 0.7 });
     WorxAudio.play("t-minus", { rate: 1.02, pan: WorxAudio.panAt(el) });
     WorxAudio.duck("liftoff", 0.5, 0.3);  ...  WorxAudio.unduck("liftoff");
   ============================================================ */

(function () {
  "use strict";

  var AC = window.AudioContext || window.webkitAudioContext;
  var SECTIONS = ["hero", "services", "flight", "telemetry", "portfolio", "crams"];
  var BUSES = SECTIONS.concat("sfx");
  var MASTER = 0.9;            // the site's overall level (scenes set their own under it)
  // Levels (set by Worx), the same on every device. Every source is first
  // loudness-matched to one reference (-18 LUFS = 100%, measured from the
  // file itself), so these percentages are honest whatever the recording:
  var BED_LEVEL = 0.15;        // the page's soundscape: 15%  (about -34.5 LUFS)
  var SECTION_LEVEL = 0.2;     // a section's sound: 20%      (about -32 LUFS)
  var FADE_IN = 0.9;           // seconds: comes alive (short: the hero film is 8.5s and its beats land on picture)
  var FADE_OUT = 1.1;          // seconds: and settles back to silence
  var SLEEP_AFTER = 3000;      // ms a scene must stay silent before its sources stop
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // off | on | standby (on, waiting for a gesture) | nosignal (it failed)
  var state = "off";
  var ctx = null, nodes = null, buses = {};
  var scenes = [], sfxDefs = {};
  var raw = {}, decoded = {};
  var listeners = [];
  var parkT = null, hideT = null;

  /* ---- the graph, built on the first press ---------------------- */
  function build() {
    if (ctx || !AC) return ctx;
    try { ctx = new AC({ latencyHint: "playback" }); } catch (e) { try { ctx = new AC(); } catch (e2) { return null; } }
    // iOS: sound the mission even with the ringer switch down, once asked
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    setTimeout(function () { watchState(); }, 0);
    var level = ctx.createGain(); level.gain.value = MASTER;
    var fade = ctx.createGain(); fade.gain.value = 0;
    var aperture = ctx.createBiquadFilter();
    aperture.type = "lowpass"; aperture.frequency.value = 320; aperture.Q.value = 0.5;
    var limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -14; limit.knee.value = 10; limit.ratio.value = 3.5;
    limit.attack.value = 0.008; limit.release.value = 0.35;
    var meter = ctx.createAnalyser();
    meter.fftSize = 512; meter.smoothingTimeConstant = 0.72;
    meter.minDecibels = -92; meter.maxDecibels = -22;
    level.connect(fade); fade.connect(aperture); aperture.connect(limit); limit.connect(meter); meter.connect(ctx.destination);
    // the three groups under the master: the bed (through its duck),
    // the sections, the effects
    var bedDuck = ctx.createGain(), sections = ctx.createGain();
    bedDuck.connect(level); sections.connect(level);
    nodes = { level: level, fade: fade, aperture: aperture, meter: meter, bedDuck: bedDuck, sections: sections };
    BUSES.forEach(function (n) { bus(n); });
    return ctx;
  }

  function bus(name) {
    if (!ctx) return null;
    if (!buses[name]) {
      var g = ctx.createGain();
      g.gain.value = 1;                        // a section's level is set by its scene; presence lives in its chain
      g.connect(name === "sfx" ? nodes.level : nodes.sections);
      buses[name] = g;
    }
    return buses[name];
  }

  // move an AudioParam from wherever it is now, along a shaped curve
  function glide(param, to, dur, shape) {
    var now = ctx.currentTime, from = param.value;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else { param.cancelScheduledValues(now); param.setValueAtTime(from, now); }
    if (dur <= 0.02 || Math.abs(to - from) < 1e-4) { param.setValueAtTime(to, now + 0.01); return; }
    var n = 48, c = new Float32Array(n);
    for (var i = 0; i < n; i++) c[i] = from + (to - from) * shape(i / (n - 1));
    try { param.setValueCurveAtTime(c, now + 0.01, dur); }
    catch (e) { param.linearRampToValueAtTime(to, now + dur); }
  }
  // the fade-in: almost nothing for the first second, then the
  // atmosphere arrives and settles (an ease-in power curve, eased out)
  var SWELL = function (x) { var s = x * x * (3 - 2 * x); return Math.pow(s, 1.7); };
  var SINK = function (x) { return 1 - Math.pow(1 - x, 1.6); };
  function sweep(param, to, dur) {   // exponential, for frequencies
    var now = ctx.currentTime, from = Math.max(20, param.value);
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else { param.cancelScheduledValues(now); param.setValueAtTime(from, now); }
    param.exponentialRampToValueAtTime(to, now + dur);
  }

  /* ---- sound files: fetched early, decoded once ------------------- */
  function fetchRaw(url) {
    if (!raw[url]) {
      raw[url] = fetch(url).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.arrayBuffer();
      });
      raw[url].catch(function () { delete raw[url]; });   // a later press may try again
    }
    return raw[url];
  }
  // decoding needs no running context: before the first press an
  // offline one does it, so a press plays at once (buffers are portable)
  var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, offline = null;
  function decoder() {
    if (ctx) return ctx;
    if (!offline && OAC) { try { offline = new OAC(2, 1, 48000); } catch (e) {} }
    return offline;
  }
  function load(url) {
    if (decoded[url]) return decoded[url];
    var p = fetchRaw(url).then(function (ab) {
      var d = decoder();
      if (!d) throw new Error("no decoder");
      return new Promise(function (res, rej) { d.decodeAudioData(ab.slice(0), res, rej); });
    });
    decoded[url] = p;
    p.catch(function () { delete decoded[url]; });
    return p;
  }
  // nothing is downloaded until the visitor asks for sound (most never
  // do: on a phone that would be megabytes for nothing). The first switch
  // on fetches the rest, one after another, in page order; a section the
  // visitor reaches first is loaded by its own scene, ahead of the queue
  var pending = [], flushed = false;
  function prefetch(url, fetchOnly) {
    if (flushed) { fetchRaw(url).catch(function () {}); return; }
    pending.push([url, fetchOnly]);
  }
  function flushPrefetch() {
    if (flushed) return;
    flushed = true;
    var c = navigator.connection, slow = c && (c.saveData || /2g/.test(c.effectiveType || ""));
    if (slow) return;                                  // precious data: each scene loads its own, when reached
    var next = function () {
      var it = pending.shift();
      if (!it) return;
      (it[1] ? fetchRaw(it[0]) : load(it[0])).then(next, next);
    };
    setTimeout(next, 1500);                            // after the first sounds have what they need
  }
  // a phone or a modest device: the scenes keep their rooms shorter and
  // their textures sparser (the same on its speakers, half the work)
  var lowPower = (window.innerWidth || 1024) < 700 || (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  /* ---- the director: one continuous film, not a set of switches --------
     Every section scene is mixed by PROXIMITY: a continuous function of
     where the visitor's eye (the middle of the viewport) is relative to
     the section. Full while the eye is well inside it; beyond its edges
     the sound carries on for `reach` viewports, so a section is heard
     approaching and heard receding. No thresholds, nothing to flicker:
     the same position always gives the same mix, up or down the page.

       distance   proximity does more than set a level. Through each
                  scene's own chain a receding section loses its top end
                  (a low-pass closing, as air absorbs it), its stereo
                  detail (width narrowing toward the centre) and its
                  body (`weight`, a low shelf only the near have), then
                  its level, on a soft curve: far away it is the faintest
                  suggestion, near it is physical
       overlap    where two sounding sections meet, their proximities
                  share one whole: the incoming gains exactly what the
                  outgoing gives up, never two sections at full presence
                  (a scene can say it is silent: `sounding`)
       lead       the eye is led a little in the direction of travel, by
                  the scroll's own velocity: the next section emerges a
                  touch earlier when you are moving toward it
       glide      every value travels on the audio clock (setTarget, a
                  few frames' time constant): slow scrolling transforms
                  the sound with you, a fling resolves straight to where
                  you land, nothing queues, nothing is left running
                  (a scene silent for SLEEP_AFTER is stopped)
       the bed    a present section dips it (`duckBed` at full presence)
                  and gives it back as it leaves: the glue underneath    */
  var view = { y: 0, v: 0, t: 0, lead: 0 };
  function readView() {
    var y = window.scrollY || window.pageYOffset || 0, t = performance.now();
    var dt = view.t ? Math.max(1, t - view.t) : 16;
    var inst = (y - view.y) / dt * 1000;                       // px/s
    view.v += (inst - view.v) * Math.min(1, dt / 120);
    if (dt > 400) view.v = 0;                                   // a pause: no stale momentum
    view.y = y; view.t = t;
    var vh = window.innerHeight || 1;
    view.lead = Math.max(-0.35 * vh, Math.min(0.35 * vh, view.v * 0.18));
  }

  // page geometry of zoned scenes: read on layout changes, not per frame
  function measureZones() {
    var y = window.scrollY || 0;
    scenes.forEach(function (s) {
      if (!s.zone) return;
      var r = s.zone.getBoundingClientRect();
      s.top = r.top + y; s.bottom = r.bottom + y;
    });
  }
  var zoneT = null;
  function remeasure() { clearTimeout(zoneT); zoneT = setTimeout(function () { measureZones(); request(); }, 120); }
  window.addEventListener("resize", remeasure);
  window.addEventListener("load", remeasure);
  if (window.ResizeObserver) new ResizeObserver(remeasure).observe(document.documentElement);

  function proximity(s) {
    if (!s.zone) { try { return Math.max(0, Math.min(1, s.presence ? s.presence() : 0)); } catch (e) { return 0; } }
    var vh = window.innerHeight || 1;
    var eye = view.y + vh * 0.5 + view.lead;
    // the section's heart: its body less a margin; short sections a point
    var inset = Math.min(vh * 0.3, (s.bottom - s.top) / 2);
    var a = s.top + inset, b = s.bottom - inset;
    var d = eye < a ? a - eye : eye > b ? eye - b : 0;
    var x = Math.min(1, d / (vh * s.reach));
    return 1 - x * x * (3 - 2 * x);
  }

  function chainOf(s) {
    if (s.chain) return s.chain;
    var c = ctx;
    var input = c.createGain();
    var shelf = c.createBiquadFilter(); shelf.type = "lowshelf"; shelf.frequency.value = 160; shelf.gain.value = 0;
    var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 400; lp.Q.value = 0.5;
    // width: mid/side, the side scaled (1 = as recorded)
    var split = c.createChannelSplitter(2), merge = c.createChannelMerger(2);
    var mL = c.createGain(), mR = c.createGain(), sL = c.createGain(), sR = c.createGain();
    mL.gain.value = mR.gain.value = 0.5; sL.gain.value = 0.5; sR.gain.value = -0.5;
    var mid = c.createGain(), side = c.createGain(), inv = c.createGain();
    side.gain.value = 0.3; inv.gain.value = -1;
    var out = c.createGain(); out.gain.value = 0;
    input.channelCount = 2; input.channelCountMode = "explicit";   // a mono source is spread to both before the matrix
    input.connect(shelf); shelf.connect(lp); lp.connect(split);
    split.connect(mL, 0); split.connect(mR, 1); split.connect(sL, 0); split.connect(sR, 1);
    mL.connect(mid); mR.connect(mid); sL.connect(side); sR.connect(side);
    mid.connect(merge, 0, 0); mid.connect(merge, 0, 1);
    side.connect(merge, 0, 0); side.connect(inv); inv.connect(merge, 0, 1);
    merge.connect(out); out.connect(bus(s.bus));
    s.chain = { input: input, shelf: shelf, lp: lp, side: side, out: out };
    return s.chain;
  }

  // ONE SECTION AT A TIME (Worx): sections never sound together at
  // strength. The section the visitor is with OWNS the sound; the others
  // are silent. When the visitor moves on, the owner begins to give way
  // (HANDOFF_OUT) and, a beat later (XF_LAG), the next begins to arrive
  // (HANDOFF_IN): a short crossfade, the outgoing ~70% -> 30% -> 0 while
  // the incoming ~20% -> 60% -> 100%, never both near full, never a
  // silent hole, the bed underneath throughout. Ownership changes only
  // when the challenger is clearly ahead (MARGIN), so lingering on a
  // boundary never flips it back and forth. A scene can decline to
  // compete while it has nothing to say (claim: the Hero, resting on its
  // silent title card).
  var handers = [];                 // onHandover listeners: a scene can compose its passage to the next
  var handIn = false, handEnd = 0, owner = null, ownerFrom = 0, HANDOFF_OUT = 1.1, HANDOFF_IN = 1.0, XF_LAG = 0.22, MARGIN = 0.15, readyT = null;
  function direct() {
    if (state !== "on" || !ctx || ctx.state !== "running") return;
    readView();
    var raw = [], i, now = ctx.currentTime;
    for (i = 0; i < scenes.length; i++) raw[i] = proximity(scenes[i]);
    var score = function (k) {
      var sc = scenes[k], c = true;
      try { c = sc.claim ? !!sc.claim() : true; } catch (e) {}
      return c ? raw[k] : 0;
    };
    // the strongest claim, and whether it takes the sound from the owner
    var best = -1, bs = 0;
    for (i = 0; i < scenes.length; i++) { var v = score(i); if (v > bs) { bs = v; best = i; } }
    var cur = owner ? scenes.indexOf(owner) : -1, cs = cur >= 0 ? score(cur) : 0;
    var handing = handIn; handIn = false;
    if (best >= 0 && bs > 0.02 && best !== cur && (cur < 0 || cs < 0.03 || bs > cs + MARGIN)) {
      var wasSounding = cur >= 0 && owner.p > 0.02, prev = owner;
      owner = scenes[best];
      // whoever composes the passage between two sections hears of it
      if (prev && wasSounding) handers.forEach(function (fn) { try { fn({ from: prev.name, to: owner.name, at: now, down: view.v >= 0 }); } catch (e) {} });
      ownerFrom = now + (wasSounding ? XF_LAG : 0);        // the last one begins to give way first
      handEnd = ownerFrom + HANDOFF_IN;                     // the slow curves hold until the handover is done
      handing = true;
      clearTimeout(readyT);
      if (wasSounding) readyT = setTimeout(function () { handIn = true; request(); }, XF_LAG * 1000 + 20);
    } else if (cur >= 0 && cs <= 0.002 && bs <= 0.02) owner = null;
    for (i = 0; i < scenes.length; i++) {
      var s = scenes[i];
      var p = s === owner && now >= ownerFrom ? raw[i] : 0;
      if (Math.abs(p - s.p) > 0.002 || handing) {
        var rising = p > s.p;
        s.p = p;
        // a handover moves slowly and softly; following the scroll, quickly
        var tau = handing || now < handEnd || (rising && s.p < 0.05) ? (rising ? HANDOFF_IN : HANDOFF_OUT) / 3 : 0.09;
        var ch = chainOf(s);
        ch.out.gain.setTargetAtTime(s.level * Math.sin(p * Math.PI / 2), now, tau);
        if (s.distance) {
          ch.lp.frequency.setTargetAtTime(500 * Math.pow(20000 / 500, Math.pow(p, 0.55)), now, tau);
          ch.side.gain.setTargetAtTime(0.5 * (0.3 + 0.7 * p), now, tau);
          ch.shelf.gain.setTargetAtTime(s.weight * p * p, now, tau);
        } else {
          ch.lp.frequency.setTargetAtTime(20000, now, tau);
          ch.side.gain.setTargetAtTime(0.5, now, tau);
        }
        if (s.duckBed < 1) {
          if (p > 0.01) duck("scene:" + s.name, 1 - (1 - s.duckBed) * p, 0.5, 1.2);
          else unduck("scene:" + s.name);
        }
      }
      // sources wake with the section's nearness (ready before it is
      // heard) and sleep once it is far and silent
      var near = raw[i];
      if (near > 0.004 && !s.awake) {
        s.awake = true;
        clearTimeout(s.sleepT); s.sleepT = null;
        try { s.start(ctx, chainOf(s).input); } catch (e) { s.awake = false; }
      } else if (near > 0.004 && s.sleepT) {
        clearTimeout(s.sleepT); s.sleepT = null;
      } else if (near <= 0.002 && s.p <= 0.002 && s.awake && !s.sleepT) {
        s.sleepT = setTimeout(function (sc) { return function () { sc.sleepT = null; rest(sc); }; }(s), SLEEP_AFTER);
      }
    }
    // keep following while the page glides to rest (momentum, smooth scroll)
    if (Math.abs(view.v) > 5) request();
  }
  function rest(s) {
    if (!s.awake) return;
    s.awake = false;
    try { s.stop(); } catch (e) {}
  }
  function restAll() {
    scenes.forEach(function (s) {
      clearTimeout(s.sleepT); s.sleepT = null; s.p = -1; rest(s);
      if (s.chain) s.chain.out.gain.setValueAtTime(0, ctx.currentTime);
      unduck("scene:" + s.name);
    });
    view.v = 0; view.t = 0;
    owner = null; clearTimeout(readyT);
  }
  var queued = false;
  function request() { if (!queued && state === "on") { queued = true; requestAnimationFrame(function () { queued = false; direct(); }); } }
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);

  // presence of a section, for scenes that want their own curve (the
  // zone model above is the default): rises as it comes on screen
  function presence(el, edge) {
    edge = edge == null ? 0.35 : edge;
    return function () {
      var r = el.getBoundingClientRect(), vh = window.innerHeight || 1;
      var inTop = (vh - r.top) / (vh * edge), inBot = r.bottom / (vh * edge);
      var v = Math.min(inTop, inBot, 1);
      return v <= 0 ? 0 : v * v * (3 - 2 * v);
    };
  }

  /* ---- switching ---------------------------------------------------- */
  function set(st) {
    if (st === state) return;
    state = st;
    listeners.forEach(function (fn) { try { fn(state); } catch (e) {} });
  }

  function on() {
    clearTimeout(parkT); parkT = null;
    lostBed = lostScene = false;
    if (!build()) { noSignal(); return; }
    var resumed = ctx.state === "running" ? Promise.resolve() : ctx.resume();
    set("on");
    flushPrefetch();
    var wake = function () {
      if (state !== "on") return;
      glide(nodes.fade.gain, 1, FADE_IN, SWELL);
      sweep(nodes.aperture.frequency, 19000, FADE_IN * 1.1);
      bedWake();
      direct();
    };
    // a browser that still says no gets its gesture next time, not a fight
    Promise.resolve(resumed).then(function () {
      if (ctx.state === "running") wake();
      else if (state === "on") set("standby");
    }, function () { if (state === "on") set("standby"); });
  }

  function off() {
    set("off");
    if (!ctx) return;
    glide(nodes.fade.gain, 0, FADE_OUT, SINK);
    sweep(nodes.aperture.frequency, 520, FADE_OUT);
    if (bedRun) glide(bedRun.fade.gain, 0, FADE_OUT, SINK);
    clearTimeout(parkT);
    parkT = setTimeout(function () {
      parkT = null;
      if (state === "on") return;
      restAll();
      ctx.suspend().catch(function () {});
    }, FADE_OUT * 1000 + 120);
  }

  function noSignal() {
    set("nosignal");
    setTimeout(function () { if (state === "nosignal") set("off"); }, 2400);
  }

  // a sound that cannot load reports here. A lost section just stays
  // quiet over the bed, a lost bed under the sections; only when both
  // are gone does the master go quiet and say so. The page carries on.
  var lostBed = false, lostScene = false;
  function fail(fromBed) {
    if (fromBed) lostBed = true; else lostScene = true;
    if (state !== "on") return;
    // something can still play: the bed under a lost section, a section over a lost bed
    if (fromBed ? (!lostScene && scenes.length) : (!bedDef || !lostBed)) return;
    off();
    noSignal();
  }

  function toggle() { if (state === "on") off(); else on(); }

  // iOS interrupts audio for a call, Siri or an alarm (the context goes
  // "interrupted" while the page stays visible); and a page restored from
  // the back/forward cache comes back with its audio frozen. Either way,
  // while the sound is on: resume now, or at the visitor's next touch
  var revive = function () {
    if (!ctx || state !== "on" || document.hidden || ctx.state === "running") return;
    ctx.resume().then(function () {
      if (state !== "on") return;
      nodes.fade.gain.setValueAtTime(0, ctx.currentTime);
      glide(nodes.fade.gain, 1, 1.0, SWELL);
      direct();
    }, function () {});
  };
  ["pointerdown", "touchend", "keydown"].forEach(function (ev) { document.addEventListener(ev, revive, { passive: true }); });
  window.addEventListener("pageshow", function (e) { if (e.persisted) setTimeout(revive, 60); });
  var watchState = function () { if (ctx) ctx.onstatechange = function () { if (ctx.state !== "running") setTimeout(revive, 400); }; };

  // another tab: fade out and rest; back: pick up where the page is
  document.addEventListener("visibilitychange", function () {
    if (!ctx || state !== "on") return;
    clearTimeout(hideT);
    if (document.hidden) {
      glide(nodes.fade.gain, 0, 0.3, SINK);
      hideT = setTimeout(function () { if (document.hidden) { restAll(); ctx.suspend().catch(function () {}); } }, 380);
    } else {
      ctx.resume().then(function () {
        if (state !== "on" || document.hidden) return;
        nodes.fade.gain.setValueAtTime(0, ctx.currentTime);
        glide(nodes.fade.gain, 1, 1.4, SWELL);
        direct();
      }, function () { set("standby"); });
    }
  });

  function subscribe(fn) { listeners.push(fn); }

  /* ---- scenes and effects ------------------------------------------- */
  function scene(name, def) {
    def.name = name;
    def.bus = def.bus || name;
    def.level = def.level == null ? SECTION_LEVEL : def.level;
    def.duckBed = def.duckBed == null ? 0.8 : def.duckBed;   // -2 dB under a section's own ambience
    def.reach = def.reach == null ? 0.9 : def.reach;          // viewports its sound carries past its edges
    def.weight = def.weight == null ? 0 : def.weight;         // dB of low body it gains up close
    def.distance = def.distance !== false;
    def.p = -1; def.awake = false; def.sleepT = null;
    scenes.push(def);
    if (def.zone) measureZones();
    request();
    return def;
  }

  function sfx(name, def) {
    sfxDefs[name] = def;
    if (def.url) prefetch(def.url);
  }

  // one-shot: { url } plays the file, { make: fn(ctx, out, opts) } synthesises
  function play(name, opts) {
    var d = sfxDefs[name];
    if (!d || state !== "on" || !ctx || ctx.state !== "running") return;
    opts = opts || {};
    var out = ctx.createGain(), tail = out;
    out.gain.value = (d.gain == null ? 1 : d.gain) * (opts.gain == null ? 1 : opts.gain);
    // where it happens on screen, gently: never past +-0.6
    var pan = opts.pan == null ? d.pan : opts.pan;
    if (pan && ctx.createStereoPanner) {
      var pn = ctx.createStereoPanner();
      pn.pan.value = Math.max(-0.6, Math.min(0.6, pan));
      out.connect(pn); tail = pn;
    }
    tail.connect(bus(d.bus || "sfx"));
    var key = "sfx:" + name + ":" + (++sfxN), depth = d.duck == null ? 0.82 : d.duck;   // about -1.7 dB
    var dip = function (sec) {
      if (depth >= 1) return;
      duck(key, depth, 0.04, 0.9);
      setTimeout(function () { unduck(key); }, Math.max(80, sec * 1000 * 0.6));
    };
    if (d.make) { try { d.make(ctx, out, opts); } catch (e) {} dip(opts.dur || d.dur || 0.6); return; }
    load(d.url).then(function (buf) {
      if (state !== "on") return;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = opts.rate || 1;
      src.connect(out);
      src.onended = function () { out.disconnect(); if (tail !== out) tail.disconnect(); };
      src.start();
      dip(buf.duration / (opts.rate || 1));
    }, function () {});
  }

  /* ---- ducking: the bed steps aside ----------------------------------
     Anyone may ask the bed to dip (key -> gain multiplier); the deepest
     request wins, reached with its attack, and the bed comes back with
     the release of the last one let go. Exponential approaches only: no
     jumps, no zipper noise. */
  var ducks = {}, duckRel = 1.6, sfxN = 0;
  function applyDuck(attack) {
    if (!ctx || !nodes) return;
    var g = 1;
    for (var k in ducks) if (ducks[k] < g) g = ducks[k];
    var p = nodes.bedDuck.gain, now = ctx.currentTime;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.setTargetAtTime(g, now, (g < p.value ? attack : duckRel) / 3);   // ~95% in the given seconds
  }
  function duck(key, depth, attack, release) {
    ducks[key] = Math.max(0, Math.min(1, depth));
    if (release) duckRel = release;
    applyDuck(attack == null ? 0.4 : attack);
  }
  function unduck(key, release) {
    if (!(key in ducks)) return;
    delete ducks[key];
    if (release) duckRel = release;
    applyDuck(0.4);
  }

  // the time between scheduling a sound and hearing it: measured (the
  // audio clock against what is reaching the speakers) where the browser
  // can say, else its declared latencies
  function latency() {
    if (!ctx) return 0;
    if (ctx.getOutputTimestamp) {
      var ts = ctx.getOutputTimestamp();
      if (ts && ts.performanceTime > 0 && ts.contextTime > 0) {
        var d = ctx.currentTime - ts.contextTime;
        if (d >= 0 && d < 0.5) return d;
      }
    }
    return (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
  }

  // an element's place in the stereo field: its centre across the
  // viewport, mapped gently into +-0.45
  function panAt(el) {
    var r = el.getBoundingClientRect(), w = window.innerWidth || 1;
    var x = ((r.left + r.width / 2) / w) * 2 - 1;
    return Math.max(-1, Math.min(1, x)) * 0.45;
  }

  /* ---- the bed: the page's continuous soundscape ------------------------
     bed({ url, level }) registers it; it starts with the master and then
     simply continues: scrolling never restarts it, the off switch and a
     hidden tab only fade it and freeze the clock (it resumes on the same
     sample), there is never a second instance.

       take A (mid)  the material, folded to mono and centred: its low
                     end the same in both ears, as in a film mix
       take B (side) the same material at a different moment, above
                     90 Hz, fed + left / - right: width that is real
                     (uncorrelated) yet cancels in a mono sum, so laptop
                     speakers stay balanced and headphones open up
       presence      faint upper harmonics derived from A's fundamentals,
                     so speakers that cannot reproduce the rumble still
                     convey it (the "virtual bass" of broadcast mixing)
       loop          each take plays a stretch of the file from a varying
                     point and hands over in a slow equal-power crossfade
                     (uncorrelated material: constant power): no restart,
                     no gap, no loop point to find
       motion        scrolling widens the space a little, settling back as
                     the page comes to rest; its level never moves (15%) */
  var bedDef = null, bedRun = null, bedWaiting = false;
  var BED_IN = 4.2;            // seconds: the soundscape arrives, after the switch
  function bed(def) {
    bedDef = def;
    prefetch(def.url, true);
    if (state === "on") bedWake();
    return def;
  }
  function bedWake() {
    if (!bedDef || !ctx) return;
    if (bedRun) {
      bedRun.fade.gain.setValueAtTime(bedRun.fade.gain.value, ctx.currentTime);
      glide(bedRun.fade.gain, 1, BED_IN * 0.6, SWELL);
      return;
    }
    if (bedWaiting) return;
    bedWaiting = true;
    load(bedDef.url).then(function (buf) {
      bedWaiting = false;
      if (bedRun || !ctx) return;
      bedRun = makeBed(ctx, buf, nodes.bedDuck, bedDef);
      if (state === "on") glide(bedRun.fade.gain, 1, BED_IN, SWELL);
    }, function () { bedWaiting = false; fail(true); });
  }

  // the graph, on any context (an OfflineAudioContext renders it the same)
  function makeBed(c, buf, dest, def) {
    var level = c.createGain(); level.gain.value = def.level == null ? BED_LEVEL : def.level;
    var fade = c.createGain(); fade.gain.value = 0;
    var swell = c.createGain(); swell.gain.value = 1;
    swell.connect(fade); fade.connect(level); level.connect(dest);

    var mono = function () {
      var g = c.createGain();
      g.channelCount = 1; g.channelCountMode = "explicit"; g.channelInterpretation = "speakers";
      return g;
    };
    // A: the mid
    var midIn = mono();
    midIn.connect(swell);
    // B: the side (+L / -R), above the bass
    var sideIn = mono(), hp = c.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = def.sideFrom == null ? 90 : def.sideFrom; hp.Q.value = 0.6;
    // measured on the home drone: below 80 Hz L/R stay 0.93 correlated
    // (centred, comfortable in headphones), 80 Hz-1 kHz open to ~0.67
    var width = c.createGain(); width.gain.value = def.width == null ? 0.5 : def.width;
    var inv = c.createGain(); inv.gain.value = -1;
    var merge = c.createChannelMerger(2);
    sideIn.connect(hp); hp.connect(width);
    width.connect(merge, 0, 0); width.connect(inv); inv.connect(merge, 0, 1);
    merge.connect(swell);
    // presence: harmonics of the fundamentals, an octave and more up
    var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 95; bp.Q.value = 0.7;
    var shape = c.createWaveShaper(), n = 1024, curve = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(2.2 * x) + 0.35 * x * x; }   // odd + a warm even
    shape.curve = curve; shape.oversample = "2x";
    var hp2 = c.createBiquadFilter(); hp2.type = "highpass"; hp2.frequency.value = 170; hp2.Q.value = 0.7;
    var lp2 = c.createBiquadFilter(); lp2.type = "lowpass"; lp2.frequency.value = 900; lp2.Q.value = 0.5;
    var pres = c.createGain(); pres.gain.value = def.presence == null ? 0.16 : def.presence;
    var drive = c.createGain(); drive.gain.value = 3;
    midIn.connect(bp); bp.connect(drive); drive.connect(shape); shape.connect(hp2); hp2.connect(lp2); lp2.connect(pres); pres.connect(swell);

    var lo = 0.45, hi = buf.duration - 0.3;          // clear of the MP3's padding at both ends
    var loopA = looper(c, buf, midIn, lo, hi), loopB = looper(c, buf, sideIn, lo, hi);
    loopA.other = loopB; loopB.other = loopA;
    var start = c.currentTime + 0.05;
    loopA.prime(start); loopB.prime(start);
    var pumpT = null;
    var pump = function () {
      loopA.fill(); loopB.fill();
      if (!c.startRendering) pumpT = setTimeout(pump, 1500);
    };
    pump();

    return {
      fade: fade,
      swell: swell,
      width: width,
      baseWidth: width.gain.value,
      fill: function (until) { loopA.fill(until); loopB.fill(until); },
      takes: function () { return loopA.live.length + loopB.live.length; },
      stop: function () { clearTimeout(pumpT); loopA.stop(); loopB.stop(); level.disconnect(); }
    };
  }

  // an endless voice from one buffer: stretches of it in turn, each
  // fading in under the last one's fade-out (sin/cos: constant power)
  function looper(c, buf, dest, lo, hi) {
    var N = 64, IN = new Float32Array(N), OUT = new Float32Array(N);
    for (var i = 0; i < N; i++) { IN[i] = Math.sin(i / (N - 1) * Math.PI / 2); OUT[i] = Math.cos(i / (N - 1) * Math.PI / 2); }
    var me = { other: null, off: -99, next: 0, live: [] };
    var take = function (T, open) {
      var D = 15 + Math.random() * 9;                 // seconds heard
      var X = 5 + Math.random() * 2;                  // crossfade
      D = Math.min(D, hi - lo - 0.1);
      X = Math.min(X, D / 2 - 0.05);                  // a short file: the fades must not meet
      var off = lo, k = 0;
      // somewhere else than the last take and than the other voice
      do { off = lo + Math.random() * (hi - lo - D); k++; }
      while (k < 8 && (Math.abs(off - me.off) < 6 || (me.other && Math.abs(off - me.other.off) < 6)));
      me.off = off;
      var src = c.createBufferSource(), env = c.createGain();
      src.buffer = buf;
      env.gain.value = 0;
      if (open) env.gain.setValueAtTime(1, T);       // the first enters already open: the bed's own fade brings it in
      else env.gain.setValueCurveAtTime(IN, T, X);
      env.gain.setValueCurveAtTime(OUT, T + D - X, X);
      src.connect(env); env.connect(dest);
      src.start(T, off, D + 0.05);
      src.stop(T + D + 0.06);
      var t = { src: src, env: env };
      me.live.push(t);
      src.onended = function () { env.disconnect(); var j = me.live.indexOf(t); if (j >= 0) me.live.splice(j, 1); };
      me.next = T + D - X;
    };
    me.prime = function (T) { take(T, true); };
    me.fill = function (until) {
      var horizon = until == null ? c.currentTime + 8 : until;
      while (me.next < horizon) take(Math.max(me.next, c.currentTime + 0.02));
    };
    me.stop = function () { me.live.slice().forEach(function (t) { try { t.src.stop(); } catch (e) {} t.env.disconnect(); }); me.live = []; };
    return me;
  }

  // a seamless endless voice from one buffer, for any scene: overlapping
  // takes from varying points, equal-power crossfades, no loop point
  function loop(c, buf, dest, lo, hi) {
    var l = looper(c, buf, dest, lo == null ? 0.2 : lo, hi == null ? buf.duration - 0.2 : hi);
    l.prime(c.currentTime + 0.02);
    l.fill();
    var t = setInterval(function () { l.fill(); }, 1500);
    return { stop: function () { clearInterval(t); l.stop(); } };
  }

  // motion: the page moving lifts the soundscape a breath and opens it
  var motionT = null;
  window.addEventListener("scroll", function () {
    if (!bedRun || state !== "on" || !ctx || reduced) return;
    var now = ctx.currentTime;
    if (!motionT) {
      bedRun.width.gain.setTargetAtTime(bedRun.baseWidth * 1.45, now, 0.6);
    }
    clearTimeout(motionT);
    motionT = setTimeout(function () {
      motionT = null;
      if (!bedRun) return;
      var t = ctx.currentTime;
      bedRun.width.gain.setTargetAtTime(bedRun.baseWidth, t, 1.8);
    }, 260);
  }, { passive: true });

  /* ---- the control: the pulsar (worx-audio.css draws it) -------------
     A glass puck mirroring the contact beacon: a speaker whose sound
     waves are orbits, a satellite riding the outer one. Off, a comet
     streak strikes it through; on, the streak withdraws, the orbits
     light and swell with the real output, the satellite flies. */
  var GLYPH =
    '<svg class="wx-sound-glyph" viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
      '<defs><linearGradient id="wx-sound-grad" x1="0" y1="1" x2="1" y2="0">' +
        '<stop offset="0" stop-color="#c04527"/><stop offset="0.55" stop-color="#e57d23"/><stop offset="1" stop-color="#faa719"/>' +
      '</linearGradient></defs>' +
      '<path class="wx-g-spk" d="M4.6 12.6h4.1l5.7-4.7c.5-.4 1.1 0 1.1.6v15c0 .6-.6 1-1.1.6l-5.7-4.7H4.6c-.6 0-1-.4-1-1v-4.8c0-.6.4-1 1-1z"/>' +
      '<path class="wx-g-w wx-g-w1" pathLength="1" d="M18.35 12.29A5 5 0 0 1 18.35 19.71"/>' +
      '<path class="wx-g-w wx-g-w2" pathLength="1" d="M21.02 9.31A9 9 0 0 1 21.02 22.69"/>' +
      '<path class="wx-g-w wx-g-w3" pathLength="1" d="M23.7 6.34A13 13 0 0 1 23.7 25.66"/>' +
      '<path class="wx-g-cut" pathLength="1" d="M6 5.5L26.5 26"/>' +
      '<path class="wx-g-slash" pathLength="1" d="M6 5.5L26.5 26"/>' +
    '</svg>';

  function mount() {
    if (!AC) return null;
    var dock = document.createElement("div");
    dock.className = "wx-sound-dock";
    dock.innerHTML =
      '<button class="wx-sound" type="button" aria-pressed="false" aria-keyshortcuts="M" data-state="off">' +
        '<span class="wx-sound-lock" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' +
        '<span class="wx-sound-shell" aria-hidden="true">' +
          '<span class="wx-sound-txt"><b>Sound</b>' +
            '<small><span class="wx-sound-flap"><b class="wx-sound-off">Off</b><b class="wx-sound-on">On</b><b class="wx-sound-nos">No signal</b></span>' +
            '<span class="wx-sound-meter"><i></i><i></i><i></i><i></i></span><kbd class="wx-sound-key">M</kbd></small>' +
          '</span>' +
        '</span>' +
        '<span class="wx-sound-orb" aria-hidden="true">' +
          '<span class="wx-sound-ping"></span><span class="wx-sound-ping"></span>' +
          '<span class="wx-sound-ring"></span>' +
          '<span class="wx-sound-halo"></span>' +
          '<span class="wx-sound-core">' + GLYPH + '<span class="wx-sound-sat"><b></b></span></span>' +
        '</span>' +
        '<span class="visually-hidden" data-sound-sr>Sound</span>' +
      '</button>';
    document.body.appendChild(dock);
    var btn = dock.firstChild, sr = btn.querySelector("[data-sound-sr]");
    var bars = Array.prototype.slice.call(btn.querySelectorAll(".wx-sound-meter i"));
    var waves = Array.prototype.slice.call(btn.querySelectorAll(".wx-g-w"));
    var core = btn.querySelector(".wx-sound-core");

    // magnetic: under the pointer the core leans toward it, the glyph a
    // little further (worx-audio.css reads --mx/--my); one write a frame
    var mx = 0, my = 0, magT = 0;
    var magWrite = function () { magT = 0; core.style.setProperty("--mx", mx.toFixed(2)); core.style.setProperty("--my", my.toFixed(2)); };
    if (!reduced && window.matchMedia("(hover: hover)").matches) {
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        mx = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1));
        my = Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height * 2 - 1));
        if (!magT) magT = requestAnimationFrame(magWrite);
      });
      btn.addEventListener("pointerleave", function () { mx = my = 0; if (!magT) magT = requestAnimationFrame(magWrite); });
    }

    // M toggles the sound from anywhere (not while typing)
    document.addEventListener("keydown", function (e) {
      if ((e.key !== "m" && e.key !== "M") || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
      if (getComputedStyle(dock).visibility === "hidden") return;
      btn.click();
    });

    var paint = function (st) {
      var live = st === "on" || st === "standby";
      btn.setAttribute("data-state", st);
      btn.setAttribute("aria-pressed", live ? "true" : "false");
      sr.textContent = st === "standby" ? "Sound, on: press to resume"
        : st === "nosignal" ? "Sound unavailable" : "Sound";
      // the cursor reticle reads this ("LOCK · SOUND ON") instead of the plate's text
      btn.setAttribute("data-cursor", st === "on" ? "Sound on" : st === "standby" ? "Sound standby" : st === "nosignal" ? "No signal" : "Sound off");
      if (st === "on") meterRun();
    };
    // the press: a click of the switch, the lamp warms up (worx-audio.css)
    btn.addEventListener("click", function () {
      if (state === "standby") { on(); }
      else if (state === "nosignal") { return; }
      else toggle();
      if (state === "on" && !reduced) {
        btn.classList.remove("is-waking");
        void btn.offsetWidth;
        btn.classList.add("is-waking");
      }
    });
    btn.addEventListener("animationend", function (e) {
      if (e.animationName === "wx-sound-warm") btn.classList.remove("is-waking");
    });
    subscribe(paint);
    paint(state);

    // the meter reads the real output: four bands, low to high. It runs
    // only while sound is on, the page is visible and the control shown.
    var bins = null, lv = [0, 0, 0, 0], BANDS = [[1, 4], [4, 11], [11, 34], [34, 120]], meterOn = false;
    function meterRun() {
      if (meterOn || reduced) return;
      meterOn = true;
      requestAnimationFrame(meterTick);
    }
    // ~30 times a second, and only what moved: four bars (transform) and
    // three orbits (opacity, set on the path itself, nothing inherited)
    var shown = [-1, -1, -1, -1], odd = false;
    function meterTick() {
      if (state !== "on" || document.hidden || !nodes) {
        meterOn = false;
        bars.forEach(function (b, i) { lv[i] = 0; shown[i] = -1; b.style.transform = ""; });
        waves.forEach(function (w) { w.style.opacity = ""; });
        return;
      }
      odd = !odd;
      if (odd) {
        if (!bins) bins = new Uint8Array(nodes.meter.frequencyBinCount);
        nodes.meter.getByteFrequencyData(bins);
        for (var k = 0; k < 4; k++) {
          var a = BANDS[k][0], z = BANDS[k][1], sum = 0;
          for (var j = a; j < z; j++) sum += bins[j];
          var v = sum / ((z - a) * 255);
          v = Math.min(1, Math.pow(v, 1.4) * 1.5);
          lv[k] += (v - lv[k]) * (v > lv[k] ? 0.6 : 0.2);   // quick up, slow fall: a needle, not a flicker
          if (Math.abs(lv[k] - shown[k]) < 0.02) continue;
          shown[k] = lv[k];
          bars[k].style.transform = "scaleY(" + (0.2 + lv[k] * 0.8).toFixed(2) + ")";
          if (k < 3) waves[k].style.opacity = (0.4 + lv[k] * 0.6).toFixed(2);   // the glyph's orbits swell with it
        }
      }
      requestAnimationFrame(meterTick);
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden && state === "on") meterRun(); });
    return dock;
  }

  window.WorxAudio = {
    on: on,
    off: off,
    toggle: toggle,
    isOn: function () { return state === "on"; },
    state: function () { return state; },
    subscribe: subscribe,
    context: function () { return ctx; },
    bus: bus,
    // fn({ from, to, at, down }) when the sound passes from one section to another
    onHandover: function (fn) { handers.push(fn); },
    load: load,
    prefetch: prefetch,
    fail: fail,
    scene: scene,
    presence: presence,
    sfx: sfx,
    play: play,
    bed: bed,
    duck: duck,
    unduck: unduck,
    panAt: panAt,
    loop: loop,
    latency: latency,
    _makeBed: makeBed,
    // read-only, for checking the mix from the console
    _mix: function () { return nodes ? { master: nodes.fade.gain.value, duck: nodes.bedDuck.gain.value, bed: bedRun ? bedRun.fade.gain.value : null, ducks: Object.keys(ducks), takes: bedRun ? bedRun.takes() : 0, scenes: scenes.map(function (s) { return [s.name, +Math.max(0, s.p).toFixed(3), s.awake, s.chain ? [+s.chain.out.gain.value.toFixed(3), Math.round(s.chain.lp.frequency.value), +s.chain.shelf.gain.value.toFixed(1)] : null]; }) } : null; },
    refresh: request,
    mount: mount,
    reduced: reduced,
    lowPower: lowPower
  };
})();
