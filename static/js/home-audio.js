/* ============================================================
   Worx | home-audio.js
   The home page's sound, on the master channel (worx-audio.js):

     BED    the home soundscape (static/assets/home/home-soundscape.mp3),
            continuous under everything, ducked while the film speaks
     HERO   the film's soundtrack (static/assets/home/hero-ambience.m4a),
            locked to the film's own clock, video.currentTime:
              - it sounds only while the film is rolling; switched on
                mid-film it joins at the frame on screen
              - every frame it checks its position against the picture
                (output latency allowed for); a slip is closed by easing
                the track's speed a few percent, a real jump (a stall, a
                seek) re-locks it with a short crossfade
              - the film pauses (scrolled away, buffering, another tab):
                it stops with it, and picks up at the same frame
              - the film reaches its cut: it fades to nothing on the
                cut itself. The title card is silent. No loop.
              - switched on over the title card (the film already over),
                the film rolls again from its first frame, with sound
     next   services, crams, flight (mission control), comms (the clients
            on the radio), telemetry, portfolio: their own
            scenes on their own buses, registered the same way.

   And where the SOUND control sits on this page: just above the
   flight recorder while the film plays (its channel on the same
   margin), settling to the corner level with the contact beacon as
   the recorder fades, riding above the footer's last line.
   ============================================================ */

(function () {
  "use strict";

  var A = window.WorxAudio;
  if (!A) return;
  var q = function (sel, root) { return (root || document).querySelector(sel); };
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var smooth = function (x) { x = clamp01(x); return x * x * (3 - 2 * x); };

  var dock = A.mount();
  var hx = q(".hx");

  /* ---- THE HOME SOUNDSCAPE: the bed under the whole visit ----------
     One continuous instance from the switch on: the engine loops it
     endlessly, centres its bass, gives it real width, and ducks it
     under everything that matters (worx-audio.js, bed()).
     Levels (set by Worx): the bed at 15%, every section at 20%, on every
     device; each source loudness-matched first (worx-audio.js). This
     drone (energy below 400 Hz, -19.2 LUFS, true peak -3.5 dBFS) sits at
     about -34.5 LUFS: felt more than heard, under sections at about -32. */
  A.bed({ url: "static/assets/home/home-soundscape.mp3", level: 0.15 });

  /* ---- HERO ------------------------------------------------------- */
  var SRC = "static/assets/home/hero-ambience.m4a";
  var FILM_END = 8.5;               // home.js cuts the film here...
  var CUT = FILM_END - 0.04;        // ...on the frame before it (its t >= d - 0.04)
  var TAIL = 0.32;                  // seconds: the soundtrack's fade into the cut
  // 20% like every section, after loudness-matching: the track measures
  // -13.4 LUFS, so 0.59 brings it to the -18 LUFS reference first
  var LEVEL = 0.2 * 0.59;
  var NUDGE = 0.04;                 // the most the track's speed is eased to follow the film
  var NUDGE_HARD = 0.07;            // ...and when it is well behind or ahead (> 60ms)
  var JUMP = 0.15;                  // seconds apart: a real jump, re-lock with a crossfade
  var video = hx && q(".hx-video", hx);

  if (hx && video) {
    A.prefetch(SRC);

    var ctx = null, out = null, buf = null, live = false;
    var take = null;                 // { src, g, t0, off }: the one take on the film's clock
    var drift = 0, raf = 0, lastT = null;

    // where the film is while it rolls (null: not rolling)
    var filmAt = function () {
      if (video.paused || video.seeking || video.readyState < 3 || hx.classList.contains("is-card")) return null;
      var t = video.currentTime;
      return t < CUT - 0.02 ? t : null;
    };
    // the delay between scheduling a sample and hearing it
    var latency = A.latency;

    // a take starting at film time t: buffer position (t + latency) now,
    // so what reaches the ear lands on the frame on screen
    var startTake = function (t, fade) {
      var now = ctx.currentTime, off = Math.min(buf.duration - 0.01, t + latency());
      var src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buf;
      src.connect(g); g.connect(out);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(1, now + fade);
      src.start(now, off);
      // pos: where in the track it is (integrated: the rate is nudged)
      var tk = { src: src, g: g, pos: off, last: now, rate: 1, tail: false };
      src.onended = function () { g.disconnect(); if (take === tk) take = null; };
      if (take) dropTake(fade);
      take = tk;
      drift = 0;
      // the film speaks: the bed steps back 6 dB beneath it
      A.duck("hero", 0.5, 0.35, 2.4);
    };
    var dropTake = function (fade) {
      if (!take) return;
      var tk = take, now = ctx.currentTime;
      take = null;
      A.unduck("hero");
      tk.g.gain.cancelScheduledValues(now);
      tk.g.gain.setValueAtTime(tk.g.gain.value, now);
      tk.g.gain.linearRampToValueAtTime(0, now + fade);
      try { tk.src.stop(now + fade + 0.02); } catch (e) {}
    };

    // every frame while live: follow the picture. Small drift (the film's
    // clock slips under load) is closed by nudging the track's speed, a
    // few percent at most, never heard as a jump; a real jump (a stall,
    // a seek) re-locks with a short crossfade.
    var follow = function () {
      raf = 0;
      if (!live) return;
      if (buf) {
        var t = filmAt(), moving = t != null && t !== lastT;
        lastT = t;
        if (t == null) { if (take) dropTake(0.12); }
        // enter only once the film's clock is actually running (just after
        // "playing" it can still be held on the resumed frame)
        else if (!take) { if (moving && t + latency() < CUT - TAIL) startTake(t, 0.06); }
        else if (!take.tail) {
          var now = ctx.currentTime;
          take.pos += (now - take.last) * take.rate;
          take.last = now;
          var lat = latency();
          // heard now = track position minus what is still in flight
          drift += (take.pos - lat - t - drift) * 0.25;   // both clocks tick coarsely: smooth first
          if (Math.abs(drift) > JUMP) startTake(t, 0.06);
          else if (t + lat >= CUT - TAIL) {
            // into the cut: fade so the silence lands on the cut's frame
            var left = Math.max(0.04, CUT - t - lat);
            take.tail = true;
            A.unduck("hero", 2.4);   // the bed rises as the film fades into the cut: it carries the title card
            take.g.gain.cancelScheduledValues(now);
            take.g.gain.setValueAtTime(take.g.gain.value, now);
            take.g.gain.linearRampToValueAtTime(0, now + left);
            take.src.stop(now + left + 0.03);
          } else {
            // gentle for a slip; firmer after a stutter (the film froze a few frames)
            var lim = Math.abs(drift) > 0.06 ? NUDGE_HARD : NUDGE;
            var rate = Math.abs(drift) < 0.008 ? 1 : 1 - Math.max(-lim, Math.min(lim, drift * 2.5));
            if (Math.abs(rate - take.rate) > 0.002) { take.rate = rate; take.src.playbackRate.setValueAtTime(rate, now); }
          }
        }
      }
      raf = requestAnimationFrame(follow);
    };

    A.scene("hero", {
      level: LEVEL,
      duckBed: 1,                    // it ducks the bed itself, only while the film speaks
      // it only claims its share of a crossfade while the film speaks
      sounding: function () { return !!take || filmAt() != null; },
      // and only competes for the sound while the film is speaking
      claim: function () { return !!take || filmAt() != null; },
      // the bus is open while the hero is on screen; the take itself
      // only exists while the film rolls
      presence: function () {
        var r = hx.getBoundingClientRect(), vh = window.innerHeight || 1;
        var span = Math.max(1, r.height - vh);
        return 1 - smooth(clamp01((-r.top - span) / (vh * 0.85)));
      },
      start: function (c, o) {
        ctx = c; out = o; live = true;
        A.load(SRC).then(function (b) {
          if (!live) return;
          buf = b;
          if (!raf) raf = requestAnimationFrame(follow);
        }, function () { if (live) A.fail(); });
        if (!raf) raf = requestAnimationFrame(follow);
      },
      stop: function () {
        A.unduck("hero");
        live = false;
        cancelAnimationFrame(raf); raf = 0;
        if (take) { try { take.src.stop(); } catch (e) {} take.g.disconnect(); take = null; }
      }
    });

    // the film stops: so does its sound, at once (follow() also sees it,
    // a frame later; these make it immediate)
    // the control's cue: it pings while the film rolls (worx-audio.css
    // shows it only with the sound off)
    var cue = function () { if (dock) dock.classList.toggle("is-cue", !video.paused && !hx.classList.contains("is-card")); };
    ["pause", "waiting", "seeking", "ended"].forEach(function (ev) {
      video.addEventListener(ev, function () { if (take) dropTake(ev === "ended" ? 0.05 : 0.1); cue(); });
    });
    video.addEventListener("playing", function () { A.refresh(); cue(); });
    if ("MutationObserver" in window) new MutationObserver(function () {
      if (take && hx.classList.contains("is-card")) dropTake(0.05);
      cue();
    }).observe(hx, { attributes: true, attributeFilter: ["class"] });

    // switched on by the visitor over the title card: roll the film again
    var was = A.state();
    A.subscribe(function (st) {
      if (st === "on" && was === "off" && hx.classList.contains("is-card") && hx.worxReplay) hx.worxReplay();
      was = st;
    });
  }

  /* ---- MISSION PARTNERS: passing monoliths ----------------------------
     The logos glide on, smooth and endless (home.js; its real motion is
     published on marquee.worxMotion). The sound does not grind under
     them: each logo is a monolith with a moment of its own. As a logo
     glides toward the middle of the band, a heavy stone slide swells
     with it, travelling across the stereo field with the logo's real
     position on screen; as it reaches the middle a low settling mass
     lands on the very frame; then it slides on and away. Two rows, two
     directions, two slightly different stones: a slow cadence of
     monoliths passing, call and answer, with stillness between.
     The sound (static/assets/home/partners-stone.mp3, untouched):

       slide    the recording's strongest unbroken passage, swelling as
                the logo approaches (its pitch sinking as the mass draws
                near), easing away after it passes; panned with the logo
       settle   the same recording an octave down and darkened: the mass
                at the centre
     Timing is predicted from the logo's true position and the marquee's
     true speed every frame, and scheduled on the audio clock (output
     latency allowed for), so the settle lands as the logo crosses.

     Only with the band of logos fully on screen: nothing on the way in.
     A pass still sounding as the visitor leaves recedes with the section
     (darker, narrower, quieter). The pointer changes nothing: the logos
     keep their pace and the stones keep sounding. Reduced motion: no
     motion, no stones.
     Level: the recording is quiet (-32.8 LUFS, peak -10.7 dBFS); staged
     so a pass peaks near -16 dBFS pre-master: above the bed, below the
     Hero, physical but never shrill. */
  var partners = q("#partners"), marqueeEl = q(".hm-marquee");
  var motion = marqueeEl && marqueeEl.worxMotion;
  if (partners && motion && !A.reduced) (function () {   // its own scope: names here are reused by the Hero and the control
    var STONE = "static/assets/home/partners-stone.mp3";
    // loudness-matched to the reference (the recording is quiet, -32.8
    // LUFS, and plays in short passes): a pass then sits at the section's 20%
    var TRIM = 4;
    var PRE = 1.15;                 // seconds of slide before a logo reaches the middle
    var POST = 0.75;                // ...and after
    A.prefetch(STONE, true);

    var sc = null, sBuf = null, sLive = false, sOut = null, live = [], sRaf = 0;
    var frames = null;              // per 20 ms of the recording: its level in dB
    var K = 64;
    var curve = function (fn) { var c = new Float32Array(K); for (var i = 0; i < K; i++) c[i] = fn(i / (K - 1)); return c; };

    var analyse = function (b) {
      var d = b.getChannelData(0), hop = Math.round(b.sampleRate * 0.02), out = [];
      for (var i = 0; i + hop <= d.length; i += hop) {
        var e = 0;
        for (var j = i; j < i + hop; j += 2) e += d[j] * d[j];
        out.push(10 * Math.log10(e / (hop / 2) + 1e-12));
      }
      return out;
    };
    // a strong stretch of `len` seconds that never drops out, not `avoid`
    var best = function (len, avoid) {
      var need = Math.max(1, Math.round(len / 0.02)), top = [], i, j;
      for (i = 0; i + need <= frames.length; i += 2) {
        var sum = 0, ok = true;
        for (j = i; j < i + need; j++) { if (frames[j] < -50) { ok = false; break; } sum += frames[j]; }
        if (ok) top.push([sum / need, i]);
      }
      if (!top.length) return 0.3;
      top.sort(function (a, b) { return b[0] - a[0]; });
      var pool = top.slice(0, Math.max(1, Math.ceil(top.length * 0.35)));
      for (var tries = 0; tries < 6; tries++) {
        var c = pool[Math.floor(Math.random() * pool.length)][1] * 0.02;
        if (avoid == null || Math.abs(c - avoid) > 0.8) return c;
      }
      return pool[0][1] * 0.02;
    };

    // every pass the same loudness: a passage's mean level (dB, from the
    // analysis) against the recording's typical one, compensated within
    // +-6 dB, so no stone arrives louder than the last
    var REF = null;
    var match = function (off, len) {
      var a = Math.floor(off / 0.02), z = Math.min(frames.length, a + Math.max(1, Math.round(len / 0.02))), e = 0, n = 0;
      for (var i = a; i < z; i++) { e += Math.pow(10, frames[i] / 10); n++; }
      var db = 10 * Math.log10(e / Math.max(1, n) + 1e-12);
      if (REF == null) {
        var all = frames.filter(function (f) { return f > -50; }).sort(function (x, y) { return x - y; });
        REF = all.length ? all[Math.floor(all.length / 2)] : db;
      }
      return Math.pow(10, Math.max(-6, Math.min(6, REF - db)) / 20);
    };
    var voice = function (T, dur, off, rate, gain, pan, dest) {
      var mg = match(off, dur * 0.8);
      gain = gain.map(function (g) { return g * mg; });
      var src = sc.createBufferSource(), env = sc.createGain();
      src.buffer = sBuf;
      src.playbackRate.setValueCurveAtTime(rate, T, dur);
      env.gain.value = 0;
      env.gain.setValueCurveAtTime(gain, T, dur);
      src.connect(env);
      var tail = env;
      if (sc.createStereoPanner) {
        var pn = sc.createStereoPanner();
        pn.pan.setValueCurveAtTime(pan, T, dur);
        env.connect(pn); tail = pn;
      }
      tail.connect(dest);
      src.start(T, off);
      src.stop(T + dur + 0.05);
      var v = { src: src, env: env, tail: tail };
      live.push(v);
      src.onended = function () {
        env.disconnect(); if (tail !== env) tail.disconnect();
        var k = live.indexOf(v); if (k >= 0) live.splice(k, 1);
      };
    };

    // one monolith passing: `at` = audio time it crosses the middle;
    // p0 -> p1 its pan from the start of the slide to its end
    var lastOff = null;
    var pass = function (at, row, p0, p1, speedN) {
      var heavy = row ? 0.88 : 1;                                // the second stone, lower
      var T = at - PRE, dur = PRE + POST, k = PRE / dur;
      var off = best(dur * 0.8 * heavy, lastOff); lastOff = off;
      var lift = Math.min(1, Math.max(0.35, speedN));            // slower stones, softer
      if (narrow) lift *= 0.7;                                   // phones: the logos sit closer, the passes overlap more: -3 dB
      // the slide: swells to the middle, eases away after
      voice(T, dur, off,
        curve(function (x) { var near = x < k ? x / k : 1 - (x - k) / (1 - k); return heavy * (0.7 + 0.12 * (1 - near)); }),
        curve(function (x) { return lift * (x < k ? Math.pow(x / k, 1.8) : Math.pow(1 - (x - k) / (1 - k), 1.4)); }),
        curve(function (x) { return p0 + (p1 - p0) * x; }),
        sOut.slide);
      return { heavy: heavy, lift: lift, off: off, pan: p0 + (p1 - p0) * k };
    };
    // the settle: the mass at the middle, scheduled moments before the
    // crossing from a fresh prediction, so it lands on the frame
    var settle = function (at, s) {
      voice(at - 0.03, 0.6, best(0.32, s.off),
        curve(function () { return 0.5 * s.heavy; }),
        curve(function (x) { return s.lift * (x < 0.07 ? x / 0.07 : Math.pow(1 - (x - 0.07) / 0.93, 2.4)); }),
        curve(function () { return s.pan; }),
        sOut.settle);
    };

    // where each logo is: measured when the scene wakes and on resize;
    // per frame it is the marquee's own position, nothing read from the page
    var geo = null, fired = {}, pending = {}, narrow = false;
    // the section's second act (ground-station.js): its focus and owner
    var stage = function () { var g = q("[data-gs]"); return g && g.worxTelemetry; };
    var owned = true;
    var measure = function () {
      var mr = marqueeEl.getBoundingClientRect();
      narrow = mr.width < 700;
      geo = motion.rows.map(function (row, i) {
        var dir = +row.dataset.dir || 1, half = motion.halves[i] || row.scrollWidth / 2;
        var o = ((motion.pos % half) + half) % half, x = dir > 0 ? -o : o - half;
        var base = Array.prototype.map.call(row.children, function (el) {
          var r = el.getBoundingClientRect();
          return r.left + r.width / 2 - x - mr.left;   // untranslated, in the band
        });
        return { dir: dir, half: half, base: base, w: mr.width };
      });
    };
    var mT = null;
    window.addEventListener("resize", function () { clearTimeout(mT); mT = setTimeout(function () { if (sLive) measure(); }, 200); });

    // gate: the band of logos fully on screen
    var bandIn = function () {
      var r = marqueeEl.getBoundingClientRect(), vh = window.innerHeight || 1;
      return r.top >= -2 && r.bottom <= vh + 2;
    };
    var bandOk = false, bandT = 0;

    // seconds until the logos travel `d` px: the cruise/hover speed plus
    // the scroll's surge, which decays at 2.5/s once the page is at rest
    var trail = [], vEff = 0;      // the logos' measured speed over the last second (frames drop under load)
    var timeTo = function (d) {
      var vs = vEff > 1 && (motion.surge || 0) < 1 ? vEff : (motion.speed || motion.cruise), su = motion.scrolling ? 0 : (motion.surge || 0);
      var t = d / Math.max(1, vs + su);
      for (var i = 0; i < 5; i++) {
        var e = Math.exp(-2.5 * t), f = vs * t + su * (1 - e) / 2.5 - d, df = vs + su * e;
        t -= f / Math.max(1, df);
      }
      return Math.max(0, t);
    };
    var watch = function (nowMs) {
      sRaf = 0;
      if (!sLive) return;
      if (nowMs - bandT > 150) { bandT = nowMs; bandOk = bandIn(); }   // a rect read a few times a second, not every frame
      trail.push([nowMs, motion.pos]);
      while (trail.length > 2 && nowMs - trail[0][0] > 1000) trail.shift();
      if (trail.length > 10 && nowMs - trail[0][0] > 500) vEff = (motion.pos - trail[0][1]) / ((nowMs - trail[0][0]) / 1000);
      // the console has taken the stage: any stone in flight is released
      // at once, no new one starts; given back, the stones return
      var st = stage(), mine = !st || st.owner !== "console";
      if (mine !== owned && sOut) {
        owned = mine;
        sOut.trim.gain.cancelScheduledValues(sc.currentTime);
        sOut.trim.gain.setTargetAtTime(mine ? TRIM : 0, sc.currentTime, mine ? 0.25 : 0.09);
        if (!mine) pending = {};
      }
      if (mine && geo && sBuf && motion.on && bandOk && A.isOn() && !motion.scrolling && motion.v > 20) {
        var lat = A.latency(), now = sc.currentTime;
        var speedN = motion.v / motion.cruise;
        for (var r = 0; r < geo.length && r < 2; r++) {
          var g = geo[r], o = ((motion.pos % g.half) + g.half) % g.half, x = g.dir > 0 ? -o : o - g.half;
          // the row is doubled, its twins one half apart: each logo is
          // taken at the copy nearest the middle
          for (var j = 0, n = g.base.length / 2; j < n; j++) {
            var rel = g.base[j] + x - g.w / 2;
            rel = ((rel % g.half) + g.half * 1.5) % g.half - g.half / 2;   // px from the middle
            var ahead = g.dir > 0 ? rel : -rel;                   // > 0: still coming
            if (ahead <= 0) continue;
            var tc = timeTo(ahead);                               // seconds to the middle
            var id = r + ":" + j, cycle = Math.floor(motion.pos / g.half);
            // phase two: the settle, from a fresh prediction
            var pend = pending[id];
            if (pend && pend.cycle === cycle && tc < 0.22) { delete pending[id]; settle(now + tc - lat, pend.s); continue; }
            if (tc > PRE + 0.12 || tc < PRE - 0.25) continue;
            if (fired[id] === cycle) continue;
            fired[id] = cycle;
            // pan: where the logo is now, to where it will be after
            var span = g.w / 2 * (narrow ? 1.5 : 1);                // phones: a narrower travel, kept controlled
            var p0 = Math.max(-0.3, Math.min(0.3, rel / span * 0.3));
            var p1 = Math.max(-0.3, Math.min(0.3, (rel - (g.dir > 0 ? 1 : -1) * motion.v * (tc + POST)) / span * 0.3));
            pending[id] = { cycle: cycle, s: pass(now + tc - lat, r, p0, p1, speedN) };
          }
        }
      }
      sRaf = requestAnimationFrame(watch);
    };

    A.scene("partners", {
      // present while the band of logos is on screen: full when it is
      // entirely in view, receding as it leaves (darker, narrower, lower)
      presence: function () {
        var r = marqueeEl.getBoundingClientRect(), vh = window.innerHeight || 1;
        var seen = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) / Math.max(1, r.height);
        var x = Math.max(0, Math.min(1, (seen - 0.35) / 0.65));
        var st = stage();
        return x * x * (3 - 2 * x) * (1 - (st ? st.focus : 0));   // giving way as the console becomes the subject
      },
      weight: 3,                   // dB of body as it is fully present
      duckBed: 0.8,                // the bed to 12% while the stones hold the scene
      // it claims a share of a crossfade only while a stone is passing
      sounding: function () { return live.length > 0; },
      start: function (c, input) {
        sc = c; sLive = true;
        if (!sOut) {
          var trim = c.createGain(); trim.gain.value = TRIM;
          var slide = c.createGain(), settle = c.createGain();
          // the slide: mass under it, the recording's brittle top tamed
          var mass = c.createBiquadFilter(); mass.type = "lowshelf"; mass.frequency.value = 150; mass.gain.value = 4;
          var tame = c.createBiquadFilter(); tame.type = "highshelf"; tame.frequency.value = 6500; tame.gain.value = -6;
          slide.connect(mass); mass.connect(tame); tame.connect(trim);
          // the settle: dark and heavy
          var dark = c.createBiquadFilter(); dark.type = "lowpass"; dark.frequency.value = 700; dark.Q.value = 0.6;
          var thump = c.createBiquadFilter(); thump.type = "lowshelf"; thump.frequency.value = 120; thump.gain.value = 6;
          settle.gain.value = 1.2;
          settle.connect(dark); dark.connect(thump); thump.connect(trim);
          sOut = { slide: slide, settle: settle, trim: trim };
        }
        sOut.trim.disconnect();
        sOut.trim.connect(input);
        var st0 = stage();
        owned = !st0 || st0.owner !== "console";
        sOut.trim.gain.value = owned ? TRIM : 0;
        A.load(STONE).then(function (b) {
          if (!sLive) return;
          if (!sBuf) { sBuf = b; frames = analyse(b); }
          measure();
          if (!sRaf) sRaf = requestAnimationFrame(watch);
        }, function () { if (sLive) A.fail(); });
      },
      stop: function () {
        sLive = false;
        cancelAnimationFrame(sRaf); sRaf = 0;
        live.slice().forEach(function (v) { try { v.src.stop(); } catch (e) {} v.env.disconnect(); if (v.tail !== v.env) v.tail.disconnect(); });
        live = [];
      }
    });
  })();

  /* ---- TELEMETRY: four receivers acquiring their signals ---------------
     The four tuners (ground-station.js) publish every move as a phase on
     gs.worxTelemetry, from the very calls that turn their knobs: the
     sound follows those, so it cannot drift from the picture, and it can
     join a search already under way (sound switched on mid-sequence, a
     return visit, the tab coming back). No timeline of its own.

     A receiver is one continuous voice per acquisition, made from the
     recording (static/assets/home/telemetry-tuning.mp3, untouched: 11 s
     of a real dial, its static between stations bright and quiet, its
     stations darker and louder):
       tuning   the knob's angle IS the receiver's frequency: a band-
                pass on the static sweeps 320 Hz - 7.8 kHz exactly as the
                knob turns, on the knob's own ease (gs-ease, a hair past
                and back)
       station  a very narrow band at the tuner's true figure turns the
                same static into a whistling carrier: it sounds only as
                the knob nears the figure. The knob crosses it twice
                before it lands (sweeping up past it, slipping back
                across it): the signal almost appears and slips away;
                then the approach, the static narrowing and thinning, the
                carrier wavering through the overshoot, centring
       lock     the static collapses in an instant; the clean carrier
                rings and fades to nothing. The silence is the reward
       hold     (a retune) the band narrows and listens
     The console: the tuner nearest its lock leads at full presence; one
     waking behind it sits ~9 dB under, a third and fourth fainter still;
     as the leader locks the next rises into its place. Each receiver is
     placed where it sits on screen (within +-0.35; phones, one tuner at
     a time, nearly centred).
     The station's environment: the same recording, looped seamlessly,
     darkened and distant: faintly heard before the console arrives
     (the section's proximity), lifting as it powers on, quieter again
     once all four are locked; it recedes as the visitor moves on.
     Levels: the recording is loud (-10.4 LUFS), loudness-matched first;
     a search near 25-30%, a lock's carrier a touch above, the
     environment far below; never the full static, never for long.
     Reduced motion: every tuner is already locked, so there is nothing
     to hear. */
  if (q("[data-gs]") && q("[data-gs]").worxTelemetry && !A.reduced) (function () {   // its own scope: "tele" and others are taken further down
    var gsEl = q("[data-gs]"), gsBus = gsEl.worxTelemetry, board = gsEl.querySelector(".gs-board") || gsEl;
    var RADIO = "static/assets/home/telemetry-tuning.mp3";
    var NORM = 0.42;                // -10.4 LUFS to the -18 reference
    var NK = 3.4 * NORM;            // the search (band-passed static loses energy)
    var CK = 12 * NORM;             // the carrier (a very narrow band holds very little)
    var EK = 0.5 * NORM;            // the environment, far below
    A.prefetch(RADIO, true);

    var sc = null, sIn = null, buf = null, live = false, env = null, envG = null, envLoop = null;
    var voices = {};                // per tuner: the one live receiver voice
    var N = 48;

    // the knob's ease: gs-ease, cubic-bezier(0.22, 1.2, 0.36, 1)
    var bez = function (x1, y1, x2, y2) {
      var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
      var cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
      return function (x) {
        if (x <= 0) return 0; if (x >= 1) return 1;
        var t = x;
        for (var i = 0; i < 6; i++) {
          var e = ((ax * t + bx) * t + cx) * t - x, d = (3 * ax * t + 2 * bx) * t + cx;
          if (Math.abs(e) < 1e-5 || !d) break; t -= e / d;
        }
        return ((ay * t + by) * t + cy) * t;
      };
    };
    var EASE = bez(0.22, 1.2, 0.36, 1);
    var knob = function (ph, t) { return ph.dur ? ph.from + (ph.to - ph.from) * EASE(t / ph.dur) : ph.to; };
    var freq = function (p) { return 320 * Math.pow(2, Math.max(0, Math.min(1.05, p)) * 4.6); };

    // where a tuner sits: a gentle place in the field
    var panOf = function (u) {
      var r = u.el.getBoundingClientRect(), w = window.innerWidth || 1;
      var x = ((r.left + r.width / 2) / w) * 2 - 1, k = w < 700 ? 0.12 : 0.4;
      return Math.max(-0.35, Math.min(0.35, x * k));
    };

    // the console: the tuner nearest its lock leads
    var RANK = [1, 0.36, 0.2, 0.12];
    var rerank = function () {
      if (!sc) return;
      var act = Object.keys(voices).map(function (k) { return voices[k]; })
        .filter(function (v) { return !v.locked; })
        .sort(function (a, b) { return a.born - b.born; });
      act.forEach(function (v, i) { v.rank.gain.setTargetAtTime(RANK[Math.min(i, RANK.length - 1)], sc.currentTime, 0.18); });
    };

    var make = function (u, born) {
      var old = voices[u.index];
      if (old) kill(old, 0.08);
      var c = sc, now = c.currentTime;
      var src = c.createBufferSource();
      src.buffer = buf;
      var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.8;
      var gN = c.createGain(); gN.gain.value = 0;
      var cb = c.createBiquadFilter(); cb.type = "bandpass"; cb.Q.value = 26;
      cb.frequency.value = freq(u.to / u.max);
      var cb2 = c.createBiquadFilter(); cb2.type = "bandpass"; cb2.Q.value = 26;   // two in series: a purer carrier
      cb2.frequency.value = cb.frequency.value;
      var gC = c.createGain(); gC.gain.value = 0;
      var rank = c.createGain(); rank.gain.value = 1;
      var pan = c.createStereoPanner ? c.createStereoPanner() : null;
      src.connect(bp); bp.connect(gN); gN.connect(rank);
      src.connect(cb); cb.connect(cb2); cb2.connect(gC); gC.connect(rank);
      if (pan) { pan.pan.value = panOf(u); rank.connect(pan); pan.connect(sIn); } else rank.connect(sIn);
      src.start(now, 0.3 + Math.random() * 4.2);
      var v = { u: u, src: src, bp: bp, gN: gN, cb: cb, cb2: cb2, gC: gC, rank: rank, pan: pan, born: born, locked: false, gone: false };
      src.onended = function () { drop(v); };
      voices[u.index] = v;
      return v;
    };
    var drop = function (v) {
      if (v.gone) return;
      v.gone = true;
      [v.bp, v.gN, v.cb, v.cb2, v.gC, v.rank, v.pan].forEach(function (n) { if (n) n.disconnect(); });
      if (voices[v.u.index] === v) delete voices[v.u.index];
    };
    var kill = function (v, fade) {
      if (v.gone) return;
      var now = sc.currentTime;
      [v.gN.gain, v.gC.gain].forEach(function (g) { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + fade); });
      try { v.src.stop(now + fade + 0.02); } catch (e) {}
      if (voices[v.u.index] === v) delete voices[v.u.index];
    };
    var setCurve = function (param, arr, T, dur) {
      param.cancelScheduledValues(T);
      param.setValueAtTime(param.value, T);
      if (dur > 0.03) param.setValueCurveAtTime(arr, T + 0.005, dur);
      else param.setValueAtTime(arr[arr.length - 1], T);
    };

    // one phase, from `e` seconds into it (late joins and latency skip ahead)
    var play = function (v, ph, e) {
      var u = v.u, target = u.to / u.max, now = sc.currentTime;
      var dur = ph.dur / 1000, rem = Math.max(0, dur - e);
      if (ph.name === "lock") return lock(v);
      var f = new Float32Array(N), n = new Float32Array(N), cg = new Float32Array(N), q = new Float32Array(N);
      for (var i = 0; i < N; i++) {
        var t = e + (rem * i) / (N - 1), p = knob(ph, t * 1000);
        var close = Math.max(0, 1 - Math.abs(p - target) / 0.12);  // the station, as the knob nears it
        var k = dur ? t / dur : 1;
        f[i] = freq(p);
        cg[i] = CK * close * close * (ph.name === "approach" ? 0.55 + 0.45 * k : 0.55);
        if (ph.name === "search") { n[i] = NK * Math.min(1, (t + 0.001) / 0.14) * (1 - 0.45 * close); q[i] = 0.8; }
        else if (ph.name === "slip" || ph.name === "release") { n[i] = NK * 0.85 * (1 - 0.45 * close); q[i] = 1.0; }
        else if (ph.name === "hold") { n[i] = NK * 0.32; q[i] = 2.6; cg[i] *= 0.6; }   // the band narrows and listens
        else { n[i] = NK * (0.9 - 0.68 * Math.pow(k, 1.3)) * (1 - 0.3 * close); q[i] = 1.3 + 7 * Math.pow(k, 1.6); }   // approach: focusing
      }
      setCurve(v.bp.frequency, f, now, rem);
      setCurve(v.bp.Q, q, now, rem);
      setCurve(v.gN.gain, n, now, rem);
      setCurve(v.gC.gain, cg, now, rem);
      v.src.playbackRate.setTargetAtTime(0.94 + 0.12 * knob(ph, (e + rem) * 1000), now, rem / 3 + 0.02);   // the dial's drag
    };
    // the lock: the static collapses, the carrier rings clean and fades
    var lock = function (v) {
      if (v.locked) return;
      v.locked = true;
      var now = sc.currentTime;
      var gN = v.gN.gain, gC = v.gC.gain;
      [gN, gC, v.cb.Q, v.cb2.Q, v.bp.frequency, v.bp.Q].forEach(function (p) { p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); });
      gN.setTargetAtTime(0, now, 0.02);                       // static gone, at once
      v.cb.Q.setTargetAtTime(34, now, 0.05); v.cb2.Q.setTargetAtTime(34, now, 0.05);   // cleaner still
      gC.linearRampToValueAtTime(CK * 1.05, now + 0.08);     // the signal, clear
      gC.setValueAtTime(CK * 1.05, now + 0.38);
      gC.setTargetAtTime(0, now + 0.38, 0.55);               // and settles into silence
      try { v.src.stop(now + 3.4); } catch (e) {}
      // the console falls quiet around the receiver that locks, for a
      // breath, so the lock is heard even mid-cascade; then it goes on
      Object.keys(voices).forEach(function (k) {
        var o = voices[k];
        if (o === v || o.locked) return;
        o.rank.gain.cancelScheduledValues(now);
        o.rank.gain.setTargetAtTime(o.rank.gain.value * 0.3, now, 0.03);
      });
      setTimeout(rerank, 520);
    };

    var onPhase = function (u, ph) {
      if (!live || !buf || !A.isOn()) return;
      var e = A.latency();                                    // heard on the frame it is seen
      var v = voices[u.index];
      if (ph.name === "lock") { if (v) lock(v); calm(); return; }
      if (!v || v.locked || ph.name === "search" || ph.name === "release") v = make(u, ph.t0);
      play(v, ph, e);
      rerank();
      calm();
    };
    gsBus.onPhase = onPhase;

    // the environment: before the console powers it is distant static;
    // powered and searching it is present; all locked, it calms
    var calm = function () {
      if (!envG) return;
      var busy = gsBus.units.some(function (u) { return u.phase && u.phase.name !== "lock"; });
      var target = !gsBus.live ? 0.55 : busy ? 1 : 0.4;
      envG.gain.setTargetAtTime(EK * target, sc.currentTime, 1.2);
    };
    // THE RELAY: mass hands over to signal. The stones' last settle lands
    // as the pulse leaves the logos; a thread of static rides down the
    // feed with it, rising as it travels; on arrival the console takes
    // power (onPower, below)
    var STONE = "static/assets/home/partners-stone.mp3";
    gsBus.onRelay = function () {
      if (!live || !buf || !A.isOn()) return;
      A.load(STONE).then(function (stone) {
        if (!live) return;
        var c = sc, now = c.currentTime + 0.02, fx = A.bus("sfx");
        // the relay is the bridge between the two acts, so it plays on the
        // effects bus: heard while the stones fade out and before the
        // console fades in (sections hand over one at a time)
        // the settle: an octave down, dark
        var s1 = c.createBufferSource(), lp = c.createBiquadFilter(), g1 = c.createGain();
        s1.buffer = stone; s1.playbackRate.value = 0.5;
        lp.type = "lowpass"; lp.frequency.value = 650; lp.Q.value = 0.6;
        g1.gain.setValueAtTime(0, now); g1.gain.linearRampToValueAtTime(0.45, now + 0.04); g1.gain.setTargetAtTime(0, now + 0.06, 0.22);
        s1.connect(lp); lp.connect(g1); g1.connect(fx);
        s1.start(now, 1.4); s1.stop(now + 1.2);
        s1.onended = function () { lp.disconnect(); g1.disconnect(); };
        // the thread of static down the feed
        var s2 = c.createBufferSource(), bp = c.createBiquadFilter(), g2 = c.createGain();
        s2.buffer = buf;
        bp.type = "bandpass"; bp.Q.value = 3.5;
        bp.frequency.setValueAtTime(240, now + 0.05);
        bp.frequency.exponentialRampToValueAtTime(2600, now + 0.62);
        g2.gain.setValueAtTime(0, now + 0.05);
        g2.gain.linearRampToValueAtTime(NK * 0.18, now + 0.5);
        g2.gain.linearRampToValueAtTime(0, now + 0.66);
        s2.connect(bp); bp.connect(g2); g2.connect(fx);
        s2.start(now + 0.05, 9.3); s2.stop(now + 0.72);
        s2.onended = function () { bp.disconnect(); g2.disconnect(); };
      }, function () {});
    };

    gsBus.onPower = function () {
      if (!envG || !live) return;
      var now = sc.currentTime;
      envG.gain.cancelScheduledValues(now);
      envG.gain.setValueAtTime(envG.gain.value, now);
      envG.gain.linearRampToValueAtTime(EK * 1.35, now + 0.9);   // the console takes power
      envG.gain.setTargetAtTime(EK, now + 0.9, 0.8);
    };

    // a search already under way when the sound arrives: join it where it is
    var join = function () {
      var now = performance.now();
      gsBus.units.forEach(function (u) {
        var ph = u.phase;
        if (!ph || ph.name === "lock") return;
        var e = (now - ph.t0) / 1000;
        if (e > ph.dur / 1000 + 0.6) return;                  // stale: the next phase is about to arrive
        var v = make(u, ph.t0);
        play(v, ph, Math.min(e, ph.dur / 1000) + A.latency());
      });
      rerank();
      calm();
    };

    A.scene("telemetry", {
      // the second act: present as the console becomes the subject (the
      // focus ground-station.js reads), and as long as its panel is in view
      presence: function () {
        var r = board.getBoundingClientRect(), vh = window.innerHeight || 1;
        var seen = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) / Math.max(1, r.height);
        var k = Math.max(0, Math.min(1, (seen - 0.2) / 0.55));
        return (gsBus.focus || 0) * k * k * (3 - 2 * k);
      },
      weight: 0,
      duckBed: 0.85,
      start: function (c, input) {
        sc = c; sIn = input; live = true;
        A.load(RADIO).then(function (b) {
          if (!live) return;
          buf = b;
          if (!envG) {
            env = c.createBiquadFilter(); env.type = "bandpass"; env.frequency.value = 1500; env.Q.value = 0.55;
            var envLp = c.createBiquadFilter(); envLp.type = "lowpass"; envLp.frequency.value = 3200; envLp.Q.value = 0.5;
            envG = c.createGain(); envG.gain.value = 0;
            env.connect(envLp); envLp.connect(envG);
          }
          envG.disconnect(); envG.connect(input);
          envLoop = A.loop(c, b, env);
          calm();
          join();
        }, function () { if (live) A.fail(); });
      },
      stop: function () {
        live = false;
        Object.keys(voices).forEach(function (k) { var v = voices[k]; try { v.src.stop(); } catch (e) {} drop(v); });
        voices = {};
        if (envLoop) { envLoop.stop(); envLoop = null; }
        if (envG) envG.gain.setValueAtTime(0, sc.currentTime);
      }
    });
  })();

  /* ---- MISSION ARCHIVE: the channel to missions still flying -----------
     The archive is a receiving station. Its missions were launched from
     here and are still transmitting back: each one its own call sign,
     in real Morse, spelt from the recording (static/assets/home/archive-
     morse.mp3, untouched: the whole alphabet keyed at 400 Hz over a
     faint hiss, one character every ~1.2 s; each letter's place in it
     is mapped below). Nothing here is a distress call.

       its own sound only: the Morse recording, its letters and the
                    faint hiss between them. Nothing of the console's
                    radio carries over (the sections never overlap); the
                    bed holds the space between contacts
       a contact    when a mission settles in the middle of the archive
                    (home.js setProgress, the call that moves the track:
                    archive.worxArchive), it comes in: the hiss of
                    acquisition swells, its call sign keys through,
                    the signal decays into hiss and is gone. Not while
                    the track is being scrubbed; each mission at most
                    every 14 s; never two within 2.8 s
       strength     directed, not random: some missions come in clear and
                    close (open, a touch nearer, the bed dipping ~1.7 dB
                    under them), some distant (darker, quieter, fading in
                    and out), one barely at all
       silence      and when the visitor rests on a mission, after a
                    while a neighbour, out to one side and far off,
                    sends a letter or two. Then silence again
       the beacon   underneath it all, the station's own beacon keys one
                    message on a loop, in real Morse: WORX LIKE MAGIC.
                    Generated, not spliced: a soft-edged tone (E5, in the
                    bed's key, A = 442; well above the contacts' 400 Hz so
                    the ear keeps them apart) keyed at 18 words a minute to
                    the international timing (dot 1 unit, dash 3, 1 inside
                    a letter, 3 between letters, 7 between words; 1 unit =
                    67 ms): 9.3 s of code, then 2.5 s of quiet, again. It
                    starts from the top each time the archive takes the
                    sound, and steps aside (to a whisper) whenever a
                    mission's call sign comes in
     Only while the archive owns the sound (the director): nothing beeps
     on the way in or out.
     Reduced motion: the same contacts, all from the middle. */
  var arEl = q("#archive");
  if (arEl && arEl.worxArchive) (function () {   // its own scope
    var ar = arEl.worxArchive;
    var MORSE = "static/assets/home/archive-morse.mp3";
    // where each letter is keyed in the recording: [start s, length s]
    var KEY = {
      A: [0.14, 0.31], B: [1.04, 0.56], C: [2.20, 0.68], D: [3.48, 0.44], E: [4.51, 0.08], F: [5.17, 0.57],
      G: [6.34, 0.56], H: [7.50, 0.44], I: [8.53, 0.20], J: [9.32, 0.80], K: [10.72, 0.56], L: [11.87, 0.57],
      M: [13.03, 0.44], N: [14.06, 0.32], O: [14.98, 0.68], P: [16.25, 0.68], Q: [17.54, 0.79], R: [18.93, 0.45],
      S: [19.96, 0.32], T: [20.86, 0.21], U: [21.66, 0.45], V: [22.70, 0.56], W: [23.86, 0.56], X: [25.02, 0.68],
      Y: [26.29, 0.81], Z: [27.68, 0.69]
    };
    // the missions in archive order: their call signs, how clearly they come in
    var CALL = [["HY", 1], ["GP", 0.55], ["GN", 0.9], ["LG", 0.3], ["HS", 0.85], ["SN", 0.5], ["CH", 1], ["MD", 0.7], ["WX", 0.9]];
    var NORM = 0.74;                // -15.4 LUFS to the -18 reference
    var TK = 0.62 * NORM;           // Morse cuts through a mix: well under its share
    A.prefetch(MORSE, true);

    var sc = null, sIn = null, mBuf = null, live = false, timer = null;
    var nodes = [];                 // everything a contact made, so a stop leaves nothing behind
    var heard = {}, lastTx = 0, busyUntil = 0, idleN = 0;
    var IDLE = [9.5, 12, 10.5, 13.5];
    var phone = function () { return (window.innerWidth || 1) < 700; };

    var track = function (n) { nodes.push(n); return n; };

    /* the beacon: WORX LIKE MAGIC, keyed in real Morse */
    var CODE = { W: ".--", O: "---", R: ".-.", X: "-..-", L: ".-..", I: "..", K: "-.-", E: ".", M: "--", A: ".-", G: "--.", C: "-.-." };
    var MSG = "WORX LIKE MAGIC", UNIT = 1.2 / 18, REST = 2.5;
    // the message as [on, then off] in units, element by element
    var KEYS = (function () {
      var out = [], words = MSG.split(" ");
      words.forEach(function (w, wi) {
        w.split("").forEach(function (ch, ci) {
          var els = CODE[ch].split("");
          els.forEach(function (e, ei) {
            var last = ei === els.length - 1, gap = !last ? 1 : ci < w.length - 1 ? 3 : wi < words.length - 1 ? 7 : 0;
            out.push([e === "." ? 1 : 3, gap]);
          });
        });
      });
      return out;
    })();
    var BEACON = 0.07;              // underneath: ~8 dB under a clear contact
    var bOsc = null, bKey = null, bDuck = null, bOut = null, bOn = false, bAt = 0, bIdx = 0;
    var beaconBuild = function (c) {
      bOsc = c.createOscillator(); bOsc.frequency.value = 442 * Math.pow(2, 7 / 12);   // E5
      bKey = c.createGain(); bKey.gain.value = 0;
      var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400; lp.Q.value = 0.5;
      bDuck = c.createGain(); bDuck.gain.value = 1;
      bOut = c.createGain(); bOut.gain.value = BEACON;
      bOsc.connect(bKey); bKey.connect(lp); lp.connect(bDuck); bDuck.connect(bOut); bOut.connect(sIn);
      bOsc.start();
      bOut.__parts = [lp];
    };
    var beaconDrop = function () {
      if (!bOsc) return;
      try { bOsc.stop(); } catch (e) {}
      [bOsc, bKey, bDuck, bOut].concat(bOut.__parts).forEach(function (n) { try { n.disconnect(); } catch (e) {} });
      bOsc = bKey = bDuck = bOut = null; bOn = false;
    };
    // keep the key scheduled a second ahead; from the top whenever it (re)starts
    var beaconPump = function (want) {
      if (!bOsc) return;
      var now = sc.currentTime;
      if (!want) {
        if (bOn) { bOn = false; bKey.gain.cancelScheduledValues(now); bKey.gain.setTargetAtTime(0, now, 0.01); }
        return;
      }
      if (!bOn) { bOn = true; bIdx = 0; bAt = now + 0.6; }
      if (bAt < now) { bIdx = 0; bAt = now + 0.3; }            // fell behind (a stall): start the message again
      while (bAt < now + 1.0) {
        var k = KEYS[bIdx], on = k[0] * UNIT;
        bKey.gain.setValueAtTime(0, bAt);
        bKey.gain.linearRampToValueAtTime(1, bAt + 0.005);     // soft edges: no clicks
        bKey.gain.setValueAtTime(1, bAt + on - 0.005);
        bKey.gain.linearRampToValueAtTime(0, bAt + on);
        bAt += on + k[1] * UNIT;
        bIdx++;
        if (bIdx >= KEYS.length) { bIdx = 0; bAt += REST; }
      }
    };
    // for offline renders (to decode it back)
    A._beaconProbe = function (c, o) { sc = c; sIn = o; beaconBuild(c); return { pump: function () { beaconPump(true); } }; };
    // a mission's call sign coming in: the beacon steps aside to a whisper
    var beaconAside = function (from, to) {
      if (!bDuck) return;
      bDuck.gain.setTargetAtTime(0.18, from, 0.08);
      bDuck.gain.setTargetAtTime(1, to, 0.4);
    };
    var sweep = function () { var t = sc.currentTime; nodes = nodes.filter(function (n) { return !(n.__end && n.__end < t - 0.2 && (n.disconnect(), true)); }); };

    // one contact: acquisition hiss, the call sign keyed letter by letter,
    // decay. `clarity` 0..1 sets nearness; `pan` its place
    var contact = function (call, clarity, pan, letters) {
      var c = sc, now = c.currentTime + 0.05, near = clarity >= 0.75;
      var bp = track(c.createBiquadFilter()); bp.type = "bandpass"; bp.frequency.value = 400; bp.Q.value = 0.9;
      var lp = track(c.createBiquadFilter()); lp.type = "lowpass"; lp.frequency.value = 900 + 2600 * clarity; lp.Q.value = 0.5;
      var g = track(c.createGain()); g.gain.value = TK * (0.25 + 0.75 * clarity);
      // the link fading in and out: slow and deep far off, a shimmer up close
      var fade = track(c.createGain()); fade.gain.value = 1 - (near ? 0.06 : 0.28);
      var lfo = track(c.createOscillator()), lfoG = track(c.createGain());
      lfo.frequency.value = near ? 5.3 : 0.7 + Math.random() * 0.5; lfoG.gain.value = near ? 0.06 : 0.28;
      lfo.connect(lfoG); lfoG.connect(fade.gain);
      var pn = c.createStereoPanner ? track(c.createStereoPanner()) : null;
      bp.connect(lp); lp.connect(fade); fade.connect(g);
      if (pn) { pn.pan.value = pan; g.connect(pn); pn.connect(sIn); } else g.connect(sIn);
      // acquisition: the hiss between letters, swelling, then the letters
      var t = now;
      var hiss = track(c.createBufferSource()), hg = track(c.createGain());
      hiss.buffer = mBuf; hiss.playbackRate.value = 0.85;
      hg.gain.setValueAtTime(0, t);
      hg.gain.linearRampToValueAtTime(1.6, t + 0.4);
      hg.gain.linearRampToValueAtTime(0, t + 0.56);          // gone before the gap it comes from ends (B is keyed at 1.04 s)
      hiss.connect(hg); hg.connect(bp);
      hiss.start(t, 0.48); hiss.stop(t + 0.58);
      t += 0.42;
      var chars = call.slice(0, letters).split("");
      chars.forEach(function (ch, i) {
        var k = KEY[ch];
        if (!k) return;
        var src = track(c.createBufferSource()), sg = track(c.createGain());
        src.buffer = mBuf;
        sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(1, t + 0.012);
        sg.gain.setValueAtTime(1, t + k[1] + 0.03); sg.gain.linearRampToValueAtTime(0, t + k[1] + 0.06);
        src.connect(sg); sg.connect(bp);
        src.start(t, Math.max(0, k[0] - 0.02), k[1] + 0.08);
        src.__end = sg.__end = t + k[1] + 0.1;
        t += k[1] + (i < chars.length - 1 ? 0.34 : 0);
      });
      // decay: a breath of hiss after the last letter, then gone
      var tail = track(c.createBufferSource()), tg = track(c.createGain());
      tail.buffer = mBuf; tail.playbackRate.value = 0.85;
      tg.gain.setValueAtTime(1.3, t + 0.04);
      tg.gain.setTargetAtTime(0, t + 0.08, 0.18);
      tail.connect(tg); tg.connect(bp);
      tail.start(t + 0.04, 12.5); tail.stop(t + 0.5);       // the gap after L, ended before M (13.03 s)
      lfo.start(now); lfo.stop(t + 1);
      var end = t + 1;
      [bp, lp, g, fade, lfo, lfoG, pn, hiss, hg, tail, tg].forEach(function (n) { if (n) n.__end = end; });
      if (near) {
        A.duck("archive", 0.89, 0.35, 1.4);
        setTimeout(function () { A.unduck("archive"); }, (end - c.currentTime) * 1000);
      }
      beaconAside(now - 0.05, end);
      busyUntil = end;
      lastTx = c.currentTime;
      return end;
    };

    var look = function () {
      if (!live || !mBuf) return;
      sweep();
      beaconPump(scene.p >= 0.3 && A.isOn());
      var now = sc.currentTime, s = scene.p;
      if (s < 0.6 || !A.isOn() || now < busyUntil + 0.2) return;   // the archive must be the subject; one contact at a time
      var held = (performance.now() - ar.changed) / 1000, i = ar.index;
      var red = A.reduced, pn = red ? 0 : phone() ? 0.1 : 0.28;
      // the mission in the middle comes in, once it has settled there
      // (arriving: at most every 14 s; lingered on, it repeats only every 24 s)
      var again = held > 20 ? 24 : 14;
      if (held > 0.45 && now - lastTx > 2.8 && (!heard[i] || now - heard[i] > again)) {
        heard[i] = now;
        var cs = CALL[Math.min(i, CALL.length - 1)];
        contact(cs[0], cs[1], 0, cs[1] < 0.4 ? 1 : 2);
        return;
      }
      // resting: a neighbour, far off to one side, sends a letter or two
      if (held > 4 && now - lastTx > IDLE[idleN % IDLE.length]) {
        var side = idleN % 2 ? 1 : -1, j = Math.max(0, Math.min(CALL.length - 1, i + side));
        if (j === i) side = -side, j = Math.max(0, Math.min(CALL.length - 1, i + side));
        idleN++;
        contact(CALL[j][0], 0.32, side * pn, idleN % 3 ? 1 : 2);
      }
    };

    var scene = A.scene("archive", {
      zone: arEl,
      reach: 0.9,                  // its channel is heard a little before, and after
      weight: 0,
      duckBed: 0.9,
      start: function (c, input) {
        sc = c; sIn = input; live = true;
        A.load(MORSE).then(function (b) {
          if (!live) return;
          mBuf = b;
          beaconDrop(); beaconBuild(c);
          // joining mid-archive: no entrance replay; the next contact comes in its own time
          lastTx = c.currentTime - 1.2;
          clearInterval(timer); timer = setInterval(look, 150);
        }, function () { if (live) A.fail(); });
      },
      stop: function () {
        live = false;
        clearInterval(timer); timer = null;
        A.unduck("archive");
        beaconDrop();
        nodes.forEach(function (n) { try { if (n.stop) n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} });
        nodes = [];
        busyUntil = 0;
      }
    });
  })();

  /* ---- SERVICES · MISSION MODULES: the worlds play the piano -----------
     No recording and nothing underneath: one soft piano, synthesised live
     in the browser, played by the worlds themselves. Every world on the
     plate (code-worlds.js) is drawn from its own clock; its sound reads
     that same clock (mod.worxModules.clock) and strikes each note on the
     moment its event is drawn (output latency allowed for):
       0 SRC / CORE       each line of source rising into the city, a
                          climbing figure; "compiled 13 modules": the
                          chord lands; the city sinks: one low note
       1 APP / VIEW TREE  the layers arriving; the stack collapsing into
                          the screen, "Build succeeded": the chord lands;
                          the layers drifting apart again
       2 UI / GRID        the 12 columns drawn: a whispered run; each
                          block landing in its area (placed where it is);
                          the pen setting the mark's anchors, high
       3 AI / LATENT      the forward pass reaching each layer, input
                          (left) to output (right); the closing brace of
                          the generated answer
       4 INFRA / TOPOLOGY the racks coming up; the probe dropped at the
                          perimeter, a ping into the echo; now and then
                          the core answers, low
     Hovering a service: its port pings, and the traffic it speeds up is
     heard arriving, softer the longer it is held.
     The piano: two strings per note (a slow shimmer between them), a few
     stretched partials whose brightness follows the touch, the quick
     drop and long ring of a struck string. Tuned to the bed's own hum
     (55.3 Hz: A = 442), with a long dark room so every tail dissolves
     into the bed, which steps back only a little beneath it.
     A switch (home.js select()) is a short run toward the new world,
     landing as it swaps in (420 ms later); switches in quick succession
     (phones fly through the modules on scroll) only land. Lingering in
     one world, it thins to its key moments. Loudness-matched to the
     -18 LUFS reference (K, from an offline tour of the worlds), then the
     section's 20%. Reduced motion: no world events, all from the middle. */
  var modulesSynth = function (c, out, opts) {
    opts = opts || {};
    var K = 1.18;                          // to the -18 LUFS reference (a full tour measures -19.5 at 1)
    var still = opts.reduced || A.reduced;
    var clock = opts.clock || function () { return null; };
    var lat = opts.latency || A.latency;
    var hushUntil = 0;
    var mtof = function (m) { return 442 * Math.pow(2, (m - 69) / 12); };   // on the bed's hum
    var rnd = Math.random;
    var W = [
      { root: 45, mel: [57, 60, 64, 67, 69, 71, 72, 76, 79] },   // A minor (9)
      { root: 41, mel: [53, 57, 60, 64, 65, 67, 69, 72, 76] },   // F major (9)
      { root: 48, mel: [60, 62, 64, 67, 71, 72, 74, 76, 79] },   // C major (9)
      { root: 50, mel: [62, 65, 69, 72, 74, 76, 77, 81, 84] },   // D minor (9)
      { root: 40, mel: [52, 57, 59, 62, 64, 69, 71, 74, 76] },   // E (sus4)
    ];

    /* the room: a warm bus, a long dark space, an echo */
    var bus = c.createGain(), warm = c.createBiquadFilter(), soft = c.createBiquadFilter();
    var comp = c.createDynamicsCompressor(), outG = c.createGain();
    warm.type = "peaking"; warm.frequency.value = 240; warm.Q.value = 0.8; warm.gain.value = 2;
    soft.type = "highshelf"; soft.frequency.value = 4500; soft.gain.value = -4;
    comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 3;
    comp.attack.value = 0.01; comp.release.value = 0.25;
    outG.gain.value = K * (opts.level || 1);
    bus.connect(warm); warm.connect(soft); soft.connect(comp); comp.connect(outG); outG.connect(out);
    var room = c.createConvolver(), roomIn = c.createGain(), roomDark = c.createBiquadFilter(), roomOut = c.createGain();
    room.buffer = (function () {
      var len = Math.round(c.sampleRate * 3.8 * (A.lowPower ? 0.55 : 1)), b = c.createBuffer(2, len, c.sampleRate);   // phones: a shorter room, half the work
      for (var ch = 0; ch < 2; ch++) {
        var d = b.getChannelData(ch), lp = 0;
        for (var i = 0; i < len; i++) {
          var x = i / len, k = 0.42 - 0.38 * x;           // darkens as it decays
          lp += k * ((rnd() * 2 - 1) - lp);
          d[i] = lp * Math.pow(1 - x, 2.2) * (i < 400 ? i / 400 : 1);
        }
      }
      return b;
    })();
    roomDark.type = "lowpass"; roomDark.frequency.value = 2600; roomDark.Q.value = 0.5;
    roomOut.gain.value = 0.62;
    roomIn.connect(room); room.connect(roomDark); roomDark.connect(roomOut); roomOut.connect(comp);
    // the echo: a dotted beat on the left, a touch later on the right,
    // darker with every repeat (and into the room)
    var echoIn = c.createGain(), echoes = [];
    [[-0.4, 0.656], [0.4, 0.687]].forEach(function (s) {
      var d = c.createDelay(2), lp = c.createBiquadFilter(), fb = c.createGain(), o = c.createGain();
      d.delayTime.value = s[1];
      lp.type = "lowpass"; lp.frequency.value = 2200;
      fb.gain.value = 0.38; o.gain.value = 0.45;
      echoIn.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d);
      var tail = o;
      lp.connect(o);
      if (!still && c.createStereoPanner) { var pn = c.createStereoPanner(); pn.pan.value = s[0]; o.connect(pn); tail = pn; }
      tail.connect(comp); tail.connect(roomIn);
      echoes.push(d, lp, fb, o, tail);
    });

    // a voice: its mix placed in the field, sent to the room and echo,
    // everything let go once it has rung out
    var voice = function (mix, srcs, end, pan, room, echo, parts) {
      var nodes = [mix].concat(parts || []), tail = mix;
      if (pan && !still && c.createStereoPanner) {
        var p = c.createStereoPanner(); p.pan.value = Math.max(-0.6, Math.min(0.6, pan));
        mix.connect(p); tail = p; nodes.push(p);
      }
      tail.connect(bus);
      if (room) { var r = c.createGain(); r.gain.value = room; tail.connect(r); r.connect(roomIn); nodes.push(r); }
      if (echo) { var e = c.createGain(); e.gain.value = echo; tail.connect(e); e.connect(echoIn); nodes.push(e); }
      srcs.forEach(function (s) { s.stop(end); });
      srcs[0].onended = function () { srcs.concat(nodes).forEach(function (n) { try { n.disconnect(); } catch (err) {} }); };
    };
    var osc = function (f, det) { var o = c.createOscillator(); o.frequency.value = f; if (det) o.detune.value = det; return o; };
    var gain = function (v) { var g = c.createGain(); g.gain.value = v; return g; };

    /* the piano: a hammer on a pair of strings. The strike, a quick drop
       as the hammer leaves, then the long ring; the upper partials (a
       hair sharp, as strings are) die first, and a firmer touch brings
       more of them; low notes ring longer than high ones */
    var PARTIALS = [[2.0016, 0.36], [3.0054, 0.13], [4.013, 0.05]];
    var piano = function (t, m, v, pan, room, echo) {
      if (v < 0.004) return;
      t = Math.max(t, c.currentTime + 0.005);
      var f = mtof(m), ring = 0.35 + 110 / f, bright = Math.min(1.4, Math.sqrt(v / 0.12));
      var mix = gain(1), srcs = [], parts = [];
      var strike = function (o, peak, tc) {
        var g = gain(0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.004);
        g.gain.setTargetAtTime(peak * 0.45, t + 0.004, 0.07);   // the hammer leaves
        g.gain.setTargetAtTime(0, t + 0.2, tc);                 // the string rings on
        o.connect(g); g.connect(mix);
        srcs.push(o); parts.push(g);
      };
      // two strings, a little apart: the slow shimmer of a real unison
      strike(osc(f, -1.1), v * 0.5, ring);
      strike(osc(f, 1.1), v * 0.5, ring);
      PARTIALS.forEach(function (p, k) { strike(osc(f * p[0]), v * p[1] * bright, ring / Math.pow(k + 2, 0.85)); });
      // the felt: a faint, very short knock
      var h = osc(f * 6.1), hg = gain(0);
      hg.gain.setValueAtTime(0, t); hg.gain.linearRampToValueAtTime(v * 0.025 * bright, t + 0.001); hg.gain.setTargetAtTime(0, t + 0.001, 0.01);
      h.connect(hg); hg.connect(mix); srcs.push(h); parts.push(hg);
      srcs.forEach(function (s) { s.start(t); });
      voice(mix, srcs, t + 0.2 + ring * 6, pan, room == null ? 0.42 : room, echo || 0, parts);
    };
    // a few notes rolled, low to high, like a hand placing a chord
    var roll = function (t, ms, v, pan, gap) {
      ms.forEach(function (m, i) { piano(t + i * (gap || 0.035), m, v * (1 - i * 0.08), pan, 0.55, i === ms.length - 1 ? 0.2 : 0); });
    };

    /* the worlds' events, read from their own timelines (code-worlds.js):
       each pushes [t, play(when, n)] for every event in [ta, tb) of the
       world's time; n counts the cycles. opt: may be thinned */
    // an event at phase p of a timeline that runs once to `first`, then
    // cycles from `base` with `period`
    var each = function (ta, tb, p, first, base, period, fn, ev, opt) {
      if (p < first && p >= ta && p < tb) ev.push([p, fn, 0, opt]);
      if (p < base) return;
      var off = first + (p - base), n = Math.max(0, Math.ceil((ta - off) / period));
      for (var t = off + n * period; t < tb; t += period, n++) if (t >= ta) ev.push([t, fn, n + 1, opt]);
    };
    var EVENTS = [
      // 0 SRC / CORE (a 12 s cycle)
      function (ta, tb, ev) {
        var mel = W[0].mel, FIG = [0, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6];
        FIG.forEach(function (k, li) {
          // each line rises once the compile front has passed it
          each(ta, tb, 0.434 + li * 0.333 + 0.12, 0, 0, 12, function (t, n) {
            if (n > 1 && li % 2) return;
            piano(t, mel[k], 0.09 + li * 0.005, -0.25 + li * 0.04);
          }, ev, li > 0);
        });
        each(ta, tb, 5.4, 0, 0, 12, function (t) { roll(t, [W[0].root + 12, 64, 69, 76], 0.15, 0.05); }, ev);
        each(ta, tb, 10.75, 0, 0, 12, function (t) { piano(t, 52, 0.1, 0, 0.6, 0.15); }, ev, true);
      },
      // 1 APP / VIEW TREE (once to 10 s, then 8.4 s cycles from 1.6)
      function (ta, tb, ev) {
        var mel = W[1].mel;
        [0, 2, 4, 6, 8].forEach(function (k, li) {
          each(ta, tb, li * 0.22 + 0.32, 1.6, 99, 1, function (t) { piano(t, mel[k], 0.08 + li * 0.008, -0.3 + li * 0.15); }, ev);
        });
        [8, 6, 4, 2].forEach(function (k, i) {
          each(ta, tb, 5.75 + i * 0.24, 10, 1.6, 8.4, function (t) { piano(t, mel[k], 0.07 + i * 0.01, 0.3 - i * 0.2); }, ev, i > 0);
        });
        each(ta, tb, 6.8, 10, 1.6, 8.4, function (t) { roll(t, [W[1].root + 12, 60, 65, 69], 0.15, 0); }, ev);
        [2, 4, 6].forEach(function (k, i) {
          each(ta, tb, 8.75 + i * 0.3, 10, 1.6, 8.4, function (t) { piano(t, mel[k] + 12, 0.04, -0.2 + i * 0.2, 0.5, 0.3); }, ev, true);
        });
      },
      // 2 UI / GRID (once to 11 s, then 9.8 s cycles from 1.2)
      function (ta, tb, ev) {
        var mel = W[2].mel;
        for (var cI = 0; cI < 12; cI++) (function (cI) {
          each(ta, tb, 0.12 + cI * 0.05, 1.2, 99, 1, function (t) { piano(t, mel[cI % 9] + (cI > 8 ? 12 : 0), 0.035, -0.45 + cI * 0.08, 0.5); }, ev);
        })(cI);
        // the areas land (their column centre is where they sound)
        var AREA = [[79, 0], [67, -0.2], [76, 0.4], [60, -0.4], [64, 0], [71, 0.4]];
        AREA.forEach(function (a, i) {
          each(ta, tb, 1.1 + i * 0.32 + 0.38, 11, 1.2, 9.8, function (t) { piano(t, a[0], i === 1 ? 0.13 : 0.1, a[1]); }, ev, i > 2);
        });
        // the pen sets the mark's anchors (high, where the mark is)
        [[3.2, 79], [3.346, 72], [3.53, 76], [3.79, 72], [4.8, 79]].forEach(function (a, j) {
          each(ta, tb, a[0], 11, 1.2, 9.8, function (t) { piano(t, a[1] + 12, 0.035, 0.4, 0.5, j === 4 ? 0.3 : 0); }, ev, true);
        });
        each(ta, tb, 9.45, 11, 1.2, 9.8, function (t) { piano(t, 55, 0.08, 0, 0.6, 0.15); }, ev, true);
      },
      // 3 AI / LATENT (passes every 2.67 s; an answer every 5.9 s)
      function (ta, tb, ev) {
        var mel = W[3].mel, P = 2.4 / 0.9;
        var V = [[0, 2, 4, 6, 8], [1, 3, 4, 6, 7], [0, 2, 3, 5, 8], [1, 2, 4, 5, 7]];
        for (var li = 0; li < 5; li++) (function (li) {
          each(ta, tb, (li + 0.5) / 5.5 * P, 0, 0, P, function (t, n) {
            if (n > 1 && li % 2) return;                     // after the first: input, middle, output
            piano(t, mel[V[(n - 1) % 4][li]], 0.11 + (li === 4 ? 0.03 : 0), -0.45 + li * 0.225, 0.45, li === 4 ? 0.2 : 0);
          }, ev, li !== 4);
        })(li);
        each(ta, tb, 7 / 2.2, 0, 0, 13 / 2.2, function (t) { piano(t, mel[7] + 12, 0.055, 0.2, 0.5, 0.35); piano(t + 0.09, mel[8] + 12, 0.045, 0.25, 0.5, 0.35); }, ev, true);
      },
      // 4 INFRA / TOPOLOGY (the probe every 3.03 s)
      function (ta, tb, ev) {
        var mel = W[4].mel, P = 1 / 0.33;
        for (var r = 0; r < 7; r++) (function (r) {
          each(ta, tb, 0.15 + r * 0.05 + 0.3, 1.6, 99, 1, function (t) { piano(t, mel[r], 0.08, -0.4 + r * 0.06, 0.4); }, ev);
        })(r);
        each(ta, tb, 0.85, 1.6, 99, 1, function (t) { piano(t, W[4].root + 12, 0.16, -0.2, 0.6); }, ev);
        each(ta, tb, 0.6 * P, 0, 0, P, function (t, n) {
          piano(t, mel[n % 2 ? 7 : 8], 0.13, -0.35, 0.4, 0.75);
          if (n % 4 === 0) piano(t + 0.45, W[4].root + 12, 0.13, 0, 0.6);     // the core answers
        }, ev);
      },
    ];
    // the hovered service's traffic, arriving at its port (each world's
    // wires run their packets at 0.9 a second when hot)
    var WIRE = [[3, 0.37], [3, 0.3], [3, 0.33], [4, 0], [3, 0.4]];
    var traffic = function (w, hot, ta, tb, ev) {
      var n = WIRE[w][0], off = hot * WIRE[w][1];
      if (w === 3) { if (hot === 1) { n = 2; off = 0.5; } else if (hot > 1) return; }
      var P = 1 / (0.9 * n), first = -off - Math.floor(-off / P) * P;
      var k = Math.max(0, Math.ceil((ta - first) / P));
      for (var t = first + k * P; t < tb; t += P, k++) if (t >= ta) (function (k) {
        ev.push([t, function (tt) {
          var held = c.currentTime - hotSince, v = 0.045 * Math.exp(-held / 2.5);
          var mel = W[w].mel, m = mel[(hot * 2) % mel.length] + 12 + (k % 2 ? 7 : 0);
          piano(tt, m, v, 0.4, 0.4, 0.2);
        }, 0, true]);
      })(k);
    };

    /* the clock: the world's own time, read every pump, so the notes
       never drift from the picture */
    var LOOK = 0.2, cursor = null, lastIdx = -1, lastT = 0, since = c.currentTime;
    var hotSince = 0, hotIdx = -1, lastHot = 0, lastChange = -9, world = opts.world || 0;
    return {
      pump: function () {
        var ck = clock();
        if (!ck || ck.still) return;
        var now = c.currentTime, L = lat();
        // a new world (or its clock restarted): begin from what is now heard
        if (ck.idx !== lastIdx || cursor == null || ck.t < lastT - 0.5) { cursor = ck.t + L; lastIdx = ck.idx; world = ck.idx; }
        lastT = ck.t;
        if (ck.hot !== hotIdx) { hotIdx = ck.hot; hotSince = now; }
        var tb = ck.t + L + LOOK;
        if (tb <= cursor) return;
        if (now < hushUntil) { cursor = tb; return; }             // giving the sound away: nothing new
        var ev = [];
        if (cursor < ck.t - 1) cursor = ck.t + L;               // fell behind (a stall): rejoin, never catch up
        try { EVENTS[ck.idx](cursor, tb, ev); } catch (e) {}
        if (ck.hot >= 0) try { traffic(ck.idx, ck.hot, cursor, tb, ev); } catch (e) {}
        // lingering in one world, it thins to its key moments
        var stay = now - since, keep = stay < 18 ? 1 : Math.max(0.3, 1 - (stay - 18) / 24);
        ev.forEach(function (e) {
          if (e[3] && rnd() > keep) return;
          try { e[1](now + (e[0] - ck.t) - L, e[2]); } catch (err) {}
        });
        cursor = tb;
      },
      // a switch: a short run toward the new world, landing as it swaps in
      change: function (e, crest) {
        var now = c.currentTime + 0.02, s = e.auto ? 0.6 : 1, quick = now - lastChange < 0.9;
        lastChange = now; since = crest;
        var dir = e.to > e.from || (e.from === W.length - 1 && e.to === 0) ? 1 : -1;
        if (e.from === 0 && e.to === W.length - 1) dir = -1;
        var mel = W[e.to].mel;
        if (!quick) {
          var N = 4, gap = Math.min(0.06, (crest - now) / (N + 1));
          for (var i = 0; i < N; i++) {
            var k = dir > 0 ? i + 2 : 6 - i;
            piano(crest - (N - i) * gap, mel[k], (0.05 + 0.012 * i) * s, dir * (-0.3 + 0.15 * i), 0.4);
          }
        }
        piano(crest, W[e.to].root + 24, (quick ? 0.08 : 0.13) * s, 0, 0.6, 0.25);
      },
      note: piano,
      hush: function (until) { hushUntil = until; },
      // a service's port, pinged
      hot: function (i) {
        var now = c.currentTime;
        if (i < 0 || now - lastHot < 0.09) return;
        lastHot = now;
        var mel = W[world].mel;
        piano(now + 0.01, mel[(i * 2) % mel.length] + 12, 0.08, 0.35, 0.45, 0.25);
      },
      stop: function (at) {
        at = at || c.currentTime;
        outG.gain.setValueAtTime(0, at + 0.02);
        setTimeout(function () {
          [bus, warm, soft, comp, outG, room, roomIn, roomDark, roomOut, echoIn].concat(echoes).forEach(function (x) { try { x.disconnect(); } catch (e) {} });
        }, Math.max(0, (at - c.currentTime) * 1000) + 200);
      },
    };
  };
  A._modulesSynth = modulesSynth;          // for offline renders (loudness)

  // the live engines, for the passage between them (below)
  var passage = { services: null, crams: null };

  var modRoot = q("[data-mod]"), modSec = q("#modules");
  if (modRoot && modSec && modRoot.worxModules) (function () {   // its own scope
    var ms = modRoot.worxModules;
    var sc = null, eng = null, live = false, timer = null;

    ms.onSelect = function (e) {
      if (!live || !eng || !A.isOn() || scene.p < 0.3) return;
      var crest = sc.currentTime + Math.max(0.2, (e.swapMs || 420) / 1000 - A.latency());
      try { eng.change(e, crest); } catch (err) {}
    };
    ms.onHot = function (i) {
      if (!live || !eng || !A.isOn() || scene.p < 0.3) return;
      try { eng.hot(i); } catch (err) {}
    };

    var scene = A.scene("services", {
      zone: modSec,
      reach: 0.6,                  // recedes as CRAMS arrives (it takes the sound)
      weight: 2,                   // dB of body up close
      duckBed: 0.92,               // the bed stays: the piano floats on it
      start: function (c, input) {
        sc = c; live = true;
        if (eng) eng.stop();
        eng = passage.services = modulesSynth(c, input, { world: ms.current, clock: ms.clock });
        clearInterval(timer);
        timer = setInterval(function () { if (eng) eng.pump(); }, 60);
        eng.pump();
      },
      stop: function () {
        live = false;
        clearInterval(timer); timer = null;
        if (eng) { eng.stop(); eng = null; }
        passage.services = null;
      }
    });
  })();

  /* ---- CRAMS: every lead, connected ------------------------------------
     No recording: glass, synthesised live. The plate is a pulsar (home.
     css .hm-crams-*): leads stream into its core from three sides, and a
     pulse rings out from it every 3 s. The sound reads those very CSS
     animations (the Web Animations API: where each one is, to the ms)
     and plays them as they are drawn:
       a lead    each lead reaching the core: a small clean glass note,
                 from the side it came in on
       a pulse   each wave ringing out: a crystal bowl, the star's
                 heartbeat, two voices a breath apart so it slowly sways;
                 and the leads that arrived since the last pulse ring
                 again inside it, softly: they join the core. One
                 platform, every lead, connected.
     A major, tuned to the bed's hum (A = 442), in a long dark room. No
     drums, nothing underneath. Lingering, the leads thin; the heartbeat
     stays. Loudness-matched (K), then the section's 20%. Reduced motion
     (nothing moves): only the heartbeat, slow, from the middle. */
  var cramsSynth = function (c, out, opts) {
    opts = opts || {};
    var K = 1.85;                          // to the -18 LUFS reference (30 s measures -23.4 at 1)
    var still = opts.reduced || A.reduced;
    var lat = opts.latency || A.latency;
    var anims = opts.anims || function () { return []; };
    var base = opts.pan || 0, hushUntil = 0;
    var mtof = function (m) { return 442 * Math.pow(2, (m - 69) / 12); };
    var rnd = Math.random;
    var STREAM = [[88, 90], [85, 83], [93, 92]];   // the three streams' signals (E F#, C# B, A G#, high)
    var LANE = [24, 151, 278].map(function (a) { return Math.cos(a * Math.PI / 180); });   // where each stream enters

    var bus = c.createGain(), soft = c.createBiquadFilter(), comp = c.createDynamicsCompressor(), outG = c.createGain();
    soft.type = "highshelf"; soft.frequency.value = 5000; soft.gain.value = -5;
    comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 3;
    comp.attack.value = 0.01; comp.release.value = 0.3;
    outG.gain.value = K * (opts.level || 1);
    bus.connect(soft); soft.connect(comp); comp.connect(outG); outG.connect(out);
    var room = c.createConvolver(), roomIn = c.createGain(), roomDark = c.createBiquadFilter(), roomOut = c.createGain();
    room.buffer = (function () {
      var len = Math.round(c.sampleRate * 4.2 * (A.lowPower ? 0.55 : 1)), b = c.createBuffer(2, len, c.sampleRate);   // phones: a shorter room, half the work
      for (var ch = 0; ch < 2; ch++) {
        var d = b.getChannelData(ch), lp = 0;
        for (var i = 0; i < len; i++) {
          var x = i / len, k = 0.4 - 0.36 * x;
          lp += k * ((rnd() * 2 - 1) - lp);
          d[i] = lp * Math.pow(1 - x, 2) * (i < 600 ? i / 600 : 1);
        }
      }
      return b;
    })();
    roomDark.type = "lowpass"; roomDark.frequency.value = 3000; roomDark.Q.value = 0.5;
    roomOut.gain.value = 0.7;
    roomIn.connect(room); room.connect(roomDark); roomDark.connect(roomOut); roomOut.connect(comp);

    var voice = function (mix, srcs, end, pan, wet, parts) {
      var nodes = [mix].concat(parts || []), tail = mix;
      pan = Math.max(-0.6, Math.min(0.6, pan || 0));
      if (pan && !still && c.createStereoPanner) {
        var p = c.createStereoPanner(); p.pan.value = pan;
        mix.connect(p); tail = p; nodes.push(p);
      }
      tail.connect(bus);
      if (wet) { var r = c.createGain(); r.gain.value = wet; tail.connect(r); r.connect(roomIn); nodes.push(r); }
      srcs.forEach(function (s) { s.stop(end); });
      srcs[0].onended = function () { srcs.concat(nodes).forEach(function (n) { try { n.disconnect(); } catch (err) {} }); };
    };
    var tone = function (f, det) { var o = c.createOscillator(); o.frequency.value = f; if (det) o.detune.value = det; return o; };
    var gain = function (v) { var g = c.createGain(); g.gain.value = v; return g; };

    var noise = (function () {
      var b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
      return b;
    })();

    // a lead: a signal, not a note. A short chirp rising into its pitch
    // (the lead accelerating into the core), a glint on top, sliding from
    // the side it came in on toward the middle
    var lead = function (t, m, v, pan) {
      t = Math.max(t, c.currentTime + 0.005);
      var f = mtof(m), mix = gain(1), srcs = [], parts = [];
      var o = tone(f * 0.5), g = gain(0);
      o.frequency.setValueAtTime(f * 0.5, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + 0.02);
      g.gain.setTargetAtTime(0, t + 0.06, 0.07);
      o.connect(g); g.connect(mix); srcs.push(o); parts.push(g);
      var o2 = tone(f * 2), g2 = gain(0);                       // the glint
      g2.gain.setValueAtTime(0, t + 0.055);
      g2.gain.linearRampToValueAtTime(v * 0.35, t + 0.06);
      g2.gain.setTargetAtTime(0, t + 0.06, 0.09);
      o2.connect(g2); g2.connect(mix); srcs.push(o2); parts.push(g2);
      var tail = mix;
      if (!still && c.createStereoPanner) {
        var pn = c.createStereoPanner();
        pn.pan.setValueAtTime(Math.max(-0.6, Math.min(0.6, pan)), t);
        pn.pan.linearRampToValueAtTime(base * 0.4, t + 0.25);   // into the core
        mix.connect(pn); tail = pn; parts.push(pn);
      }
      srcs.forEach(function (s) { s.start(t); });
      voice(tail, srcs, t + 1.2, 0, 0.6, parts.concat(tail === mix ? [] : [mix]));
    };
    // the beam: as it crosses the line of sight, a resonant sweep passes
    // across the field, a breath of the star's light (filtered noise) and
    // its hum (a soft triangle on A) opening and closing together.
    // len: how long the crossing takes (a pulse ~0.6 s; first light ~2 s)
    var beam = function (t, v, len, from, to, hi) {
      t = Math.max(t, c.currentTime + 0.005);
      len = len || 0.6; hi = hi || 1900;
      var peak = t + len * 0.4, srcs = [], parts = [], mix = gain(1);
      var n = c.createBufferSource(), bp = c.createBiquadFilter(), ng = gain(0);
      n.buffer = noise; n.loop = true;
      bp.type = "bandpass"; bp.Q.value = 5;
      bp.frequency.setValueAtTime(380, t);
      bp.frequency.exponentialRampToValueAtTime(hi, peak);
      bp.frequency.exponentialRampToValueAtTime(520, t + len * 1.6);
      ng.gain.setValueAtTime(0, t);
      ng.gain.linearRampToValueAtTime(v * 0.9, peak);
      ng.gain.setTargetAtTime(0, peak, len * 0.35);
      n.connect(bp); bp.connect(ng); ng.connect(mix); srcs.push(n); parts.push(bp, ng);
      var h = tone(mtof(57) * 0.985), lp = c.createBiquadFilter(), hg = gain(0);
      h.type = "triangle";
      h.frequency.setValueAtTime(mtof(57) * 0.985, t);
      h.frequency.setTargetAtTime(mtof(57), t, len * 0.3);         // it settles onto A as it faces you
      lp.type = "lowpass"; lp.Q.value = 2;
      lp.frequency.setValueAtTime(300, t);
      lp.frequency.exponentialRampToValueAtTime(hi * 1.1, peak);
      lp.frequency.exponentialRampToValueAtTime(400, t + len * 1.6);
      hg.gain.setValueAtTime(0, t);
      hg.gain.linearRampToValueAtTime(v * 0.6, peak);
      hg.gain.setTargetAtTime(0, peak, len * 0.4);
      h.connect(lp); lp.connect(hg); hg.connect(mix); srcs.push(h); parts.push(lp, hg);
      var tail = mix;
      if (!still && c.createStereoPanner) {
        var pn = c.createStereoPanner();
        pn.pan.setValueAtTime(from, t);
        pn.pan.linearRampToValueAtTime(to, t + len * 1.2);
        mix.connect(pn); tail = pn; parts.push(pn);
      }
      srcs.forEach(function (s) { s.start(t); });
      voice(tail, srcs, t + len * 3 + 0.5, 0, 0.7, parts.concat(tail === mix ? [] : [mix]));
      return peak;
    };
    // the core rings: a crystal bowl on A4, two voices a breath apart (it
    // sways), glassy overtones; the leads it gathered ring inside it
    var ring = function (t, v, joined, attack) {
      t = Math.max(t, c.currentTime + 0.005);
      var f = mtof(69), mix = gain(1), srcs = [], parts = [];
      var part = function (fr, amp, a, tc, det) {
        var o = tone(fr, det), g = gain(0);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + a);
        g.gain.setTargetAtTime(0, t + a, tc);
        o.connect(g); g.connect(mix); srcs.push(o); parts.push(g);
      };
      var a = attack || 0.02;
      part(f, v * 0.5, a, 1.3, -3);
      part(f, v * 0.5, a, 1.3, 3);
      part(f * 2.76, v * 0.14, Math.max(0.01, a * 0.6), 0.45);    // glass, not string: inharmonic
      part(f * 5.4, v * 0.05, Math.max(0.01, a * 0.4), 0.2);
      joined.forEach(function (m, i) { part(mtof(m), v * 0.14, 0.25 + i * 0.06, 0.9); });
      srcs.forEach(function (s) { s.start(t); });
      voice(mix, srcs, t + 8, base * 0.5, 0.75, parts);
    };
    // a pulse: the beam crosses, the core rings at its brightest
    var pulse = function (t, v, joined, attack) {
      var dir = rnd() < 0.5 ? 1 : -1;
      var peak = beam(t, v * 0.55, 0.6, base - 0.4 * dir, base + 0.4 * dir);
      ring(peak - 0.04, v * 0.75, joined, attack);
    };
    // first light: one long, slow crossing (the star arriving), the core
    // catching at its height
    var firstLight = function (t, from) {
      var peak = beam(t, 0.11, 2.1, from, base, 2400);
      ring(peak - 0.1, 0.13, [76, 81, 85], 0.5);
      return peak;
    };
    // its last light, going: the beam falls away
    var lastLight = function (t, to) { beam(t, 0.08, 1.4, base, to, 1500); };

    /* the clock: the plate's own CSS animations, read every pump */
    var LOOK = 0.2, seen = {}, joined = [], since = c.currentTime, lastStill = -9;
    return {
      firstLight: firstLight,
      lastLight: lastLight,
      hush: function (until) { hushUntil = until; },
      pump: function () {
        var now = c.currentTime, L = lat(), list = [];
        try { list = anims(); } catch (e) {}
        if (!list.length) {
          // nothing moves (reduced motion): only a slow heartbeat
          if (now - lastStill > 6 && now >= hushUntil) { lastStill = now; pulse(now + 0.05, 0.12, []); }
          return;
        }
        var stay = now - since, keep = stay < 20 ? 1 : Math.max(0.35, 1 - (stay - 20) / 25);
        list.forEach(function (a) {
          var ct = a.anim.currentTime;
          if (ct == null || a.anim.playState !== "running") return;
          var d = a.delay, D = a.dur;
          // its events: a lead lands at the end of each run, a wave is born at its start
          var at = a.kind === "lead" ? d + D : d;
          var horizon = ct + (L + LOOK) * 1000;
          var k = Math.max(0, Math.ceil((ct - at) / D));
          var last = seen[a.id];
          if (last != null && last >= k) k = last + 1;            // each event once
          else if (last == null && at + k * D < ct + L * 1000 - 30) k++;   // joining: from what is still to be heard
          for (var ev = at + k * D; ev < horizon; ev += D, k++) {
            var when = now + (ev - ct) / 1000 - L;
            if (when < hushUntil) { seen[a.id] = k; continue; }   // a passage is playing: let it speak
            if (a.kind === "lead") {
              var m = STREAM[a.s][k % 2];
              joined.push(m - 12);
              if (rnd() <= keep) lead(when, m, 0.07, base * 0.6 + LANE[a.s] * 0.4);
            } else {
              pulse(when, 0.16, joined.slice(-3));
              joined = [];
            }
            seen[a.id] = k;
          }
        });
      },
      stop: function (at) {
        at = at || c.currentTime;
        outG.gain.setValueAtTime(0, at + 0.02);
        setTimeout(function () {
          [bus, soft, comp, outG, room, roomIn, roomDark, roomOut].forEach(function (x) { try { x.disconnect(); } catch (e) {} });
        }, 200);
      },
    };
  };
  A._cramsSynth = cramsSynth;              // for offline renders (loudness)

  var cramsSec = q("#crams"), cramsOrbit = cramsSec && q(".hm-crams-orbit", cramsSec);
  if (cramsSec && cramsOrbit) (function () {
    var eng = null, timer = null;
    // the plate's animations: the leads (::after of each .hm-crams-signal)
    // and the waves, with their delays and lengths
    var anims = function () {
      if (!cramsOrbit.getAnimations) return [];
      var out = [];
      cramsOrbit.getAnimations({ subtree: true }).forEach(function (an) {
        var name = an.animationName, el = an.effect && an.effect.target;
        if (!el || (name !== "hm-crams-lead" && name !== "hm-crams-wave")) return;
        var tm = an.effect.getTiming(), lead = name === "hm-crams-lead";
        var n = parseFloat(getComputedStyle(el).getPropertyValue(lead ? "--s" : "--w")) || 0;
        out.push({ anim: an, kind: lead ? "lead" : "wave", s: n, id: name + n, delay: +tm.delay || 0, dur: +tm.duration || 1 });
      });
      return out;
    };
    var cached = null, cachedAt = 0;
    var current = function () {
      var t = performance.now();
      if (!cached || t - cachedAt > 2000) { cached = anims(); cachedAt = t; }   // re-read now and then (a resize can restart them)
      return cached;
    };
    A.scene("crams", {
      zone: cramsSec,
      reach: 0.7,
      weight: 2,
      duckBed: 0.92,               // the bed stays: the glass floats on it
      start: function (c, input) {
        if (eng) eng.stop();
        cached = null;
        eng = passage.crams = cramsSynth(c, input, { anims: current, pan: A.panAt(cramsOrbit) });
        clearInterval(timer);
        timer = setInterval(function () { if (eng) eng.pump(); }, 60);
        eng.pump();
      },
      stop: function () {
        clearInterval(timer); timer = null;
        if (eng) { eng.stop(); eng = null; }
        passage.crams = null;
      }
    });
  })();

  /* ---- THE PASSAGE: Services -> CRAMS, first light -------------------
     The two sections do not simply crossfade. When the sound passes from
     the modules to CRAMS (the director's onHandover), the worlds stop
     playing at once (no new notes; the ones ringing fade away with the
     section), and the pulsar arrives as FIRST LIGHT: one long, slow beam
     crossing toward the star, its hum settling onto A, the core ringing
     at its height. The pulsar's own heartbeat and leads wait for it,
     then take over. Back up the page: the star's last light falls away
     and the piano's worlds resume, nothing laid over them.
     On the effects bus at the sections' level (20%), so it is heard
     across the handover whatever each section's fade is doing; at most
     once every 2.5 s. */
  var bridge = null, lastBridge = -9;
  var bridgeOf = function (c) {
    if (bridge && bridge.c === c) return bridge;
    bridge = { c: c, star: cramsSynth(c, A.bus("sfx"), { level: 0.2, pan: cramsOrbit ? A.panAt(cramsOrbit) : 0 }) };
    return bridge;
  };
  if (modSec && cramsSec) A.onHandover(function (h) {
    var pair = h.from + ">" + h.to;
    if (pair !== "services>crams" && pair !== "crams>services") return;
    var c = A.context();
    if (!c || !A.isOn() || c.currentTime - lastBridge < 2.5) return;
    lastBridge = c.currentTime;
    var b = bridgeOf(c), T = c.currentTime + 0.04;
    if (pair === "services>crams") {
      if (passage.services) passage.services.hush(T + 4);
      var peak = b.star.firstLight(T, -0.45);
      if (passage.crams) passage.crams.hush(peak + 1.6);      // its heartbeat begins once first light has rung
    } else {
      if (passage.crams) passage.crams.hush(T + 4);
      b.star.lastLight(T, -0.45);
      if (passage.services) passage.services.hush(T + 0.9);   // the worlds resume as the light goes
    }
  });

  /* ---- FLIGHT PLAN: mission control ------------------------------------
     The launch deck (home.js, fp.worxFlight) is a countdown, so it gets
     one: the real voice of NASA launch control, over the radio, synced to
     the cards, and a launch at T-00. Every layer follows the deck's own
     moments, whoever moves it (the countdown itself, a click, a key, a
     swipe, the replay):
       the channel   radio static behind the whole section: a narrow comms
                     band, hiss and crackle, a slow flutter; it opens with
                     a squelch and the Quindar tone (the Apollo "beep") as
                     the countdown begins, and steps back under every call
       the calls     each card arriving is called by launch control,
                     "T-minus six", "five" ... "one", through the radio:
                     the real voice of NASA launch control (the IMAP
                     launch, Sept 2025, public domain: NASA KSC broadcast
                     on Wikimedia Commons), cut word by word into
                     static/assets/home/flight-countdown.m4a
       the burn      a card's fuel burning (3.2 s) is the vehicle
                     pressurising: venting hiss and a turbopump whine
                     rising to the next call, stage by stage more intense
       the board     every flip of the split-flap T-minus board clacks (a
                     jump of several stages rattles through every number)
       the deck      a cleared card leaves on a breath of air, to the left
       LIFTOFF       T-00: "engines full power", the ignition's crack and
                     a body building with the screen's shake; under it the
                     REAL Falcon 9, from the pad microphone of the same
                     launch, ignition to peak to climbing away (it darkens
                     as it goes); "and liftoff" cuts through the radio over
                     it; the static returns, and a Quindar tone closes the
                     transmission
     Synthesised except the voice and the roar; loudness-matched (K), then the
     section's 20% (the roar is allowed its peak). Reduced motion: the
     calls, the clacks and the channel; a soft launch. */
  var flightSynth = function (c, out, opts) {
    opts = opts || {};
    var K = 0.6;                           // the countdown to the -18 LUFS reference (a run measures -13.6 at 1); liftoff peaks ~4 dB over it
    var still = opts.reduced || A.reduced;
    var voiceBuf = opts.voice || null;     // the countdown voice (cue sheet below)
    var rnd = Math.random;
    var boardPan = opts.boardPan || 0;
    // the countdown voice, cut into one file: [start, length] per call
    var CUE = opts.cues || {};
    var REAL = 1;                          // the real roar against the rest

    var bus = c.createGain(), comp = c.createDynamicsCompressor(), outG = c.createGain();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4;
    comp.attack.value = 0.005; comp.release.value = 0.2;
    outG.gain.value = K;
    bus.connect(comp); comp.connect(outG); outG.connect(out);
    var room = c.createConvolver(), roomIn = c.createGain(), roomOut = c.createGain();
    room.buffer = (function () {
      var len = Math.round(c.sampleRate * 2.6 * (A.lowPower ? 0.55 : 1)), b = c.createBuffer(2, len, c.sampleRate);   // phones: a shorter room, half the work
      for (var ch = 0; ch < 2; ch++) {
        var d = b.getChannelData(ch), lp = 0;
        for (var i = 0; i < len; i++) { var x = i / len; lp += (0.5 - 0.4 * x) * ((rnd() * 2 - 1) - lp); d[i] = lp * Math.pow(1 - x, 2.4); }
      }
      return b;
    })();
    roomOut.gain.value = 0.5;
    roomIn.connect(room); room.connect(roomOut); roomOut.connect(comp);
    var noise = (function () {
      var b = c.createBuffer(2, c.sampleRate * 3, c.sampleRate);
      for (var ch = 0; ch < 2; ch++) { var d = b.getChannelData(ch); for (var i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }
      return b;
    })();
    // brown noise: the weight of an engine
    var brown = (function () {
      var b = c.createBuffer(2, c.sampleRate * 4, c.sampleRate);
      for (var ch = 0; ch < 2; ch++) { var d = b.getChannelData(ch), v = 0; for (var i = 0; i < d.length; i++) { v = (v + 0.02 * (rnd() * 2 - 1)) / 1.02; d[i] = v * 3.5; } }
      return b;
    })();
    var gain = function (v) { var g = c.createGain(); g.gain.value = v; return g; };
    var bq = function (type, f, Q) { var b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; if (Q != null) b.Q.value = Q; return b; };
    var panner = function (p) { if (!c.createStereoPanner || still) return gain(1); var n = c.createStereoPanner(); n.pan.value = p; return n; };
    var src = function (buf, loop) { var s = c.createBufferSource(); s.buffer = buf; s.loop = !!loop; return s; };
    var chain = function (nodes) { for (var i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes; };
    var later = function (sources, nodes, end) {
      sources.forEach(function (s) { s.stop(end); });
      sources[0].onended = function () { sources.concat(nodes).forEach(function (n) { try { n.disconnect(); } catch (e) {} }); };
    };

    /* the radio: everything said over it shares one channel */
    var radioIn = gain(1), radioHP = bq("highpass", 320, 0.7), radioLP = bq("lowpass", 3200, 0.9), radioDrive = c.createWaveShaper(), radioOut = gain(1);
    radioDrive.curve = (function () { var n = 1024, cv = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; cv[i] = Math.tanh(2.2 * x) / Math.tanh(2.2); } return cv; })();
    chain([radioIn, radioHP, radioLP, radioDrive, radioOut]);
    radioOut.connect(bus);
    var rr = gain(0.18); radioOut.connect(rr); rr.connect(roomIn);
    // the channel's static, always under it (lifted when the channel opens)
    var hiss = src(noise, true), hissBP = bq("bandpass", 1900, 0.45), hissG = gain(0), flutter = c.createOscillator(), flutterG = gain(0);
    flutter.frequency.value = 0.37; flutterG.gain.value = 0;
    flutter.connect(flutterG); flutterG.connect(hissG.gain);
    chain([hiss, hissBP, hissG, radioIn]);
    hiss.start(); flutter.start();
    var STATIC = 0.055, staticLvl = STATIC * 0.35;
    var setStatic = function (v, t, tc) { staticLvl = v; hissG.gain.setTargetAtTime(v, t, tc || 0.25); flutterG.gain.setTargetAtTime(v * 0.35, t, tc || 0.25); };
    setStatic(STATIC * 0.35, c.currentTime, 0.6);
    // a crackle on the line
    var crackle = function (t, v) {
      var s = src(noise), hp = bq("highpass", 2200), g = gain(0), p = panner((rnd() - 0.5) * 0.3);
      g.gain.setValueAtTime(v, t); g.gain.setTargetAtTime(0, t, 0.004 + rnd() * 0.01);
      chain([s, hp, g, p]); p.connect(radioIn);
      s.start(t, rnd() * 2.5); later([s], [hp, g, p], t + 0.08);
    };
    // squelch: the channel keyed open or released
    var squelch = function (t, v) {
      var s = src(noise), bp = bq("bandpass", 2400, 0.8), g = gain(0);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.setTargetAtTime(0, t + 0.03, 0.03);
      chain([s, bp, g, radioIn]); s.start(t, rnd() * 2); later([s], [bp, g], t + 0.3);
    };
    // the Quindar tones: 2525 Hz keys the channel, 2475 Hz releases it
    var quindar = function (t, f, v) {
      var o = c.createOscillator(), g = gain(0);
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.008);
      g.gain.setValueAtTime(v, t + 0.242); g.gain.linearRampToValueAtTime(0, t + 0.25);
      o.connect(g); g.connect(radioIn); o.start(t); later([o], [g], t + 0.3);
    };
    // a call: the voice of launch control, through the radio; the static
    // steps back beneath it
    var call = function (key, t, v) {
      var cue = CUE[key];
      if (!voiceBuf || !cue) return 0;
      var s = src(voiceBuf), g = gain(0);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.012);
      g.gain.setValueAtTime(v, t + cue[1] - 0.04); g.gain.linearRampToValueAtTime(0, t + cue[1]);
      s.connect(g); g.connect(radioIn);
      s.start(t, cue[0], cue[1] + 0.02); later([s], [g], t + cue[1] + 0.1);
      var back = staticLvl;
      hissG.gain.setTargetAtTime(back * 0.45, t - 0.02, 0.05);
      hissG.gain.setTargetAtTime(back, t + cue[1], 0.25);
      return cue[1];
    };

    /* the burn: venting hiss and a turbopump whine, rising to the call */
    var burnV = null;
    var burnStop = function (t, rel) {
      if (!burnV) return;
      var b = burnV; burnV = null;
      b.g.gain.cancelScheduledValues(t); b.g.gain.setValueAtTime(b.g.gain.value, t);
      b.g.gain.setTargetAtTime(0, t, rel || 0.08);
      b.srcs.forEach(function (s) { try { s.stop(t + (rel || 0.08) * 8); } catch (e) {} });
    };
    var burn = function (t, i, ms) {
      burnStop(t, 0.05);
      var dur = ms / 1000, s = (i + 1) / 6, end = t + dur;
      var g = gain(0), mix = gain(1);
      // the vent: hiss through a band that climbs
      var v = src(noise, true), vbp = bq("bandpass", 900, 1.2), vg = gain(0);
      vbp.frequency.setValueAtTime(700 + 300 * s, t); vbp.frequency.exponentialRampToValueAtTime(2600 + 2600 * s, end);
      vg.gain.setValueAtTime(0.0001, t); vg.gain.exponentialRampToValueAtTime(0.5, end);
      chain([v, vbp, vg, mix]);
      // the turbopump: a whine spinning up
      var w = c.createOscillator(), wlp = bq("lowpass", 1800, 1), wg = gain(0);
      w.type = "sawtooth";
      w.frequency.setValueAtTime(110 * (1 + s * 0.5), t); w.frequency.exponentialRampToValueAtTime(330 * (1 + s * 0.8), end);
      wg.gain.setValueAtTime(0.0001, t); wg.gain.exponentialRampToValueAtTime(0.08, end);
      chain([w, wlp, wg, mix]);
      // under it, the weight of the vehicle (felt more each stage)
      var r = src(brown, true), rlp = bq("lowpass", 160, 0.7), rg = gain(0);
      rg.gain.setValueAtTime(0.0001, t); rg.gain.exponentialRampToValueAtTime(0.25 * s, end);
      chain([r, rlp, rg, mix]);
      mix.connect(g); g.connect(bus);
      var send = gain(0.3); g.connect(send); send.connect(roomIn);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35 + 0.65 * s, t + 0.4);
      [v, w, r].forEach(function (x) { x.start(t, x.buffer ? rnd() * 2 : undefined); });
      var srcs = [v, w, r];
      later(srcs, [vbp, vg, wlp, wg, rlp, rg, mix, g, send], end + 1.5);
      burnV = { g: g, srcs: srcs };
    };

    /* the board: a flap falls and lands */
    var clack = function (t, v) {
      [[0, 3600, 1], [0.022, 1900, 0.55]].forEach(function (k) {
        var s = src(noise), bp = bq("bandpass", k[1] * (0.9 + rnd() * 0.2), 4), g = gain(0), p = panner(boardPan);
        g.gain.setValueAtTime(v * k[2], t + k[0]); g.gain.setTargetAtTime(0, t + k[0], 0.006);
        chain([s, bp, g, p]); p.connect(bus);
        s.start(t + k[0], rnd() * 2.5); later([s], [bp, g, p], t + k[0] + 0.1);
      });
    };
    /* a cleared card leaves on a breath of air */
    var whoosh = function (t, dir, v) {
      var s = src(noise), bp = bq("bandpass", 1800, 0.9), g = gain(0), p = c.createStereoPanner && !still ? c.createStereoPanner() : gain(1);
      bp.frequency.setValueAtTime(2400, t); bp.frequency.exponentialRampToValueAtTime(500, t + 0.7);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.18); g.gain.setTargetAtTime(0, t + 0.2, 0.18);
      if (p.pan) { p.pan.setValueAtTime(0.1 * dir, t); p.pan.linearRampToValueAtTime(-0.55 * dir, t + 0.8); }
      chain([s, bp, g, p]); p.connect(bus);
      s.start(t, rnd() * 2); later([s], [bp, g, p], t + 1.4);
    };

    /* LIFTOFF: ignition, the roar, the climb */
    var roar = null;
    var roarStop = function (t, rel) {
      if (!roar) return;
      var r = roar; roar = null;
      r.g.gain.cancelScheduledValues(t); r.g.gain.setValueAtTime(r.g.gain.value, t);
      r.g.gain.setTargetAtTime(0, t, rel || 0.4);
      r.srcs.forEach(function (s) { try { s.stop(t + (rel || 0.4) * 8); } catch (e) {} });
      clearTimeout(r.closeT);
    };
    var liftoff = function (t) {
      roarStop(t, 0.2);
      var g = gain(0), srcs = [], parts = [g];
      // the real thing: the pad microphone, ignition to the climb away,
      // spread wide, darkening as the vehicle goes
      var cue = CUE.roar;
      if (voiceBuf && cue) {
        var rs = src(voiceBuf), rlp = bq("lowpass", 14000, 0.5), rg = gain(0);
        var dl = c.createDelay(0.05), pl = panner(-0.4), pr = panner(0.4), rdel = gain(1);
        dl.delayTime.value = 0.017;
        rlp.frequency.setValueAtTime(14000, t + 6.5);
        rlp.frequency.exponentialRampToValueAtTime(700, t + cue[1]);
        rg.gain.setValueAtTime(0, t); rg.gain.linearRampToValueAtTime(REAL, t + 0.03);
        rg.gain.setValueAtTime(REAL, t + cue[1] - 2); rg.gain.linearRampToValueAtTime(0, t + cue[1] - 0.2);
        rs.connect(rlp); rlp.connect(rg);
        rg.connect(pl); rg.connect(dl); dl.connect(rdel); rdel.connect(pr);
        pl.connect(g); pr.connect(g);
        rs.start(t, cue[0] + 0.22, cue[1] - 0.25);
        srcs.push(rs); parts.push(rlp, rg, dl, pl, pr, rdel);
      }
      var syn = gain(1); parts.push(syn);
      // the body: brown noise, deep and wide, its own slow surge
      var b = src(brown, true), blp = bq("lowpass", 120, 0.6), bg = gain(1);
      blp.frequency.setValueAtTime(90, t); blp.frequency.exponentialRampToValueAtTime(420, t + 0.9);
      blp.frequency.setValueAtTime(420, t + 3.2); blp.frequency.exponentialRampToValueAtTime(110, t + 11);
      chain([b, blp, bg, syn]); srcs.push(b); parts.push(blp, bg);
      // the roar: noise through a driven band, the tear of the exhaust
      var n = src(noise, true), nbp = bq("bandpass", 500, 0.5), drive = c.createWaveShaper(), ng = gain(0.55);
      drive.curve = (function () { var k = 1024, cv = new Float32Array(k); for (var i = 0; i < k; i++) { var x = i / (k - 1) * 2 - 1; cv[i] = Math.tanh(3 * x); } return cv; })();
      nbp.frequency.setValueAtTime(300, t); nbp.frequency.exponentialRampToValueAtTime(900, t + 0.9);
      nbp.frequency.setValueAtTime(900, t + 3.2); nbp.frequency.exponentialRampToValueAtTime(240, t + 11);
      chain([n, nbp, drive, ng, syn]); srcs.push(n); parts.push(nbp, drive, ng);
      // the rumble the shake is drawn from: a slow, uneven tremor
      var trem = c.createOscillator(), tg = gain(0.18);
      trem.frequency.value = 7.5; trem.connect(tg); tg.connect(bg.gain); srcs.push(trem); parts.push(tg);
      g.connect(bus);
      var send = gain(0.45); g.connect(send); send.connect(roomIn); parts.push(send);
      g.gain.setValueAtTime(1, t);
      // the synthesised body: the build with the shake (0.9 s), full at
      // the flash, handing the weight to the real roar as it peaks
      syn.connect(g);
      var SYN = voiceBuf && cue ? 0.45 : 1;
      syn.gain.setValueAtTime(0, t);
      syn.gain.linearRampToValueAtTime(0.25 * SYN, t + 0.12);           // ignition
      syn.gain.exponentialRampToValueAtTime(SYN, t + 0.9);              // building with the shake
      syn.gain.setValueAtTime(SYN, t + 3.2);
      syn.gain.exponentialRampToValueAtTime(0.03 * SYN, t + 11);        // climbing away
      syn.gain.linearRampToValueAtTime(0, t + 12);
      srcs.forEach(function (s) { if (!s.__started) { s.__started = true; if (s.buffer === voiceBuf) return; s.start(t, s.buffer ? rnd() * 2 : undefined); } });
      later(srcs, parts, t + 20.5);
      // the crackle of the plume (the Shuttle's SRBs, the Saturn's F-1s)
      for (var k = 0, nK = A.lowPower ? 45 : 90; k < nK; k++) {   // phones: a sparser crackle
        var at = t + 0.5 + Math.pow(rnd(), 1.4) * 8;
        var life = Math.max(0, 1 - (at - t - 3) / 6);
        (function (at, v) {
          var s = src(noise), hp = bq("highpass", 1400 + rnd() * 2500), cg = gain(0), p = panner((rnd() - 0.5) * 0.9);
          cg.gain.setValueAtTime(v, at); cg.gain.setTargetAtTime(0, at, 0.006 + rnd() * 0.014);
          chain([s, hp, cg, p]); p.connect(syn);
          s.start(at, rnd() * 2.5); later([s], [hp, cg, p], at + 0.15);
        })(at, (0.25 + rnd() * 0.5) * (at - t < 3.2 ? 1 : life));
      }
      // the ignition itself: a low concussion
      var o = c.createOscillator(), og = gain(0);
      o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.6);
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.9, t + 0.015); og.gain.setTargetAtTime(0, t + 0.02, 0.22);
      o.connect(og); og.connect(bus); o.start(t); later([o], [og], t + 2);
      roar = { g: g, srcs: srcs };
      // the static steps away from the roar, and comes back as it fades
      setStatic(STATIC * 0.25, t, 0.2);
      return t + 20;
    };

    return {
      // the countdown begins: the channel keyed open
      open: function (t) {
        squelch(t, 0.5);
        quindar(t + 0.04, 2525, 0.08);
        setStatic(STATIC, t + 0.05, 0.15);
      },
      // the transmission ends
      close: function (t) {
        quindar(t, 2475, 0.08);
        squelch(t + 0.27, 0.35);
        setStatic(STATIC * 0.35, t + 0.3, 0.8);
      },
      call: call,
      setVoice: function (b) { voiceBuf = b; },
      burn: burn,
      burnStop: burnStop,
      clack: clack,
      whoosh: whoosh,
      liftoff: liftoff,
      roarStop: roarStop,
      crackle: crackle,
      staticLevel: function () { return staticLvl; },
      setStatic: setStatic,
      STATIC: STATIC,
      // a repeat run (phones loop the countdown): the whole a step back
      trim: function (v) { outG.gain.setTargetAtTime(K * v, c.currentTime, 0.4); },
      stop: function () {
        var t = c.currentTime;
        burnStop(t, 0.05); roarStop(t, 0.1);
        outG.gain.setValueAtTime(0, t + 0.02);
        try { hiss.stop(t + 0.1); flutter.stop(t + 0.1); } catch (e) {}
        setTimeout(function () {
          [bus, comp, outG, room, roomIn, roomOut, radioIn, radioHP, radioLP, radioDrive, radioOut, rr, hissBP, hissG, flutterG].forEach(function (x) { try { x.disconnect(); } catch (e) {} });
        }, 300);
      },
    };
  };
  A._flightSynth = flightSynth;            // for offline renders (loudness)

  var fpRoot = q("[data-fp]"), flightSec = q("#flight");
  if (fpRoot && flightSec && fpRoot.worxFlight) (function () {
    var fs = fpRoot.worxFlight, LAST = fs.last;
    var VOICE = "static/assets/home/flight-countdown.m4a";
    var CUES = { tminus: [3.775, 0.59], six: [4.615, 0.565], five: [5.43, 0.48], four: [6.16, 0.49], three: [6.9, 0.85], two: [8.0, 0.505], one: [8.755, 0.595], full: [9.6, 1.085], liftoff: [10.935, 1.345], roar: [12.53, 19.8] }   // [start, length] s in the file;
    var NUM = ["six", "five", "four", "three", "two", "one"];
    A.prefetch(VOICE, true);
    var board = q("[data-fclock]");
    var sc = null, eng = null, live = false, voice = null, opened = false;
    var lastClack = 0, closeT = null, crackT = null, liftT = [], pend = null, watchT = null, runs = 0;
    var ready = function () { return live && eng && A.isOn() && scene.p > 0.2; };
    var clearLift = function () { clearTimeout(closeT); closeT = null; liftT.forEach(clearTimeout); liftT = []; A.unduck("flight-roar"); };
    // the channel opens and launch control calls the count where it stands
    var announce = function (i, t) {
      eng.open(t); opened = true;
      if (i === 0) { var d = eng.call("tminus", t + 0.42, 1); eng.call("six", t + 0.42 + d + 0.06, 1); }
      else if (i < LAST) eng.call(NUM[i], t + 0.42, 1);
    };

    fs.onGo = function (e) {
      pend = null;                                      // a new card: whatever was waiting is past
      if (!ready()) return;
      var t = sc.currentTime + 0.02;
      eng.burnStop(t, 0.06);
      // leaving liftoff: the roar lets go
      if (e.from === LAST && e.to !== LAST) { clearLift(); eng.roarStop(t, 0.7); eng.setStatic(eng.STATIC, t + 0.3, 0.6); }
      // phones run the countdown again and again while it is on screen:
      // the first launch is the show, the repeats breathe (6 dB down)
      if (e.auto && e.from === LAST && e.to === 0) { runs++; eng.trim(0.5); }
      // the deck moves: the cleared card leaves on a breath of air
      if (e.from >= 0 && e.to !== e.from) eng.whoosh(t, e.to > e.from ? 1 : -1, (e.to > e.from ? 0.13 : 0.08) * (e.auto ? 0.85 : 1));
      // the countdown begins (or begins again): the channel keyed open
      if (e.to < LAST) {
        if (e.to === 0 || !opened) announce(e.to, t);         // the count (re)begins: "T-minus six"
        else eng.call(NUM[e.to], t + 0.24, 1);
        return;
      }
      // T-00
      clearLift();
      var T = t + 0.02;
      eng.liftoff(T);                                   // the ignition, the roar
      eng.call("full", T + 0.06, 1);                    // "engines full power"
      eng.call("liftoff", T + 1.3, 1.1);                // "and liftoff"
      A.duck("flight-roar", 0.55, 0.25, 3.5);           // the page steps back for the launch
      liftT.push(setTimeout(function () { A.unduck("flight-roar"); }, 11000));
      closeT = setTimeout(function () { if (eng && live) eng.close(sc.currentTime + 0.05); }, 17500);
    };
    fs.onBurn = function (e) {
      // the deck starts counting as soon as it is seen, often a moment
      // before this section has the sound: the opening waits for it
      // (below) instead of being lost
      if (!ready()) { pend = { i: e.i, ms: e.ms, at: performance.now() }; return; }
      pend = null;
      var t = sc.currentTime + 0.02;
      // the countdown starting by itself (the deck seen): the channel opens on its count
      if (!opened) announce(e.i, t);
      eng.burn(t, e.i, e.ms);
    };
    fs.onHalt = function () { if (eng && live) eng.burnStop(sc.currentTime, 0.25); };
    fs.onFlip = function (e) {
      if (!ready()) return;
      var now = sc.currentTime;
      if (now - lastClack < 0.03) return;
      lastClack = now;
      eng.clack(now + 0.01, e.fast ? 0.07 : 0.1);
    };

    var scene = A.scene("flight", {
      zone: flightSec,
      reach: 0.7,
      weight: 3,
      duckBed: 0.85,
      start: function (c, input) {
        sc = c; live = true;
        if (eng) eng.stop();
        eng = flightSynth(c, input, { voice: voice, cues: CUES, boardPan: board ? A.panAt(board) : 0 });
        if (!voice) A.load(VOICE).then(function (b) { voice = b; if (live && eng) eng.setVoice(b); }, function () {});
        // the opening, if the count began before the sound was ours: as
        // soon as it is, still on that card, the channel opens on its
        // count and the burn joins for the time it has left
        clearInterval(watchT);
        watchT = setInterval(function () {
          if (!pend || !ready()) return;
          var p = pend, left = p.ms - (performance.now() - p.at);
          pend = null;
          if (left < 700) return;
          var t = sc.currentTime + 0.02;
          if (!opened) announce(p.i, t);
          eng.burn(t, p.i, left);
        }, 100);
        // now and then, a crackle on the line
        clearInterval(crackT);
        crackT = setInterval(function () { if (eng && Math.random() < 0.16) eng.crackle(sc.currentTime + 0.02, 0.05 + Math.random() * 0.12); }, 140);
      },
      stop: function () {
        live = false; opened = false; pend = null;
        clearInterval(crackT); crackT = null;
        clearInterval(watchT); watchT = null;
        clearLift();
        if (eng) { eng.stop(); eng = null; }
      }
    });
  })();

  /* ---- COMMS · TRANSMISSIONS RECEIVED: the clients on the radio ---------
     Every testimonial is a transmission from the field to Worx Mission
     Control, read out by its client's own voice (a man's for Simon and
     Mohammed, a woman's for Monique) and answered by Mission Control:
       the call     the client keys the mic (squelch) and calls in, "Worx
                    Mission Control, this is Hyundai. Do you copy?",
                    through a narrow space-to-ground channel: band-limited,
                    driven, a flutter on the carrier, hiss beneath
       the answer   Mission Control, framed by the Quindar tones (2525 Hz
                    in, 2475 Hz out, as the Apollo ground's transmissions
                    were): "Hyundai, Worx Mission Control. Loud and clear.
                    Go ahead.", cleaner, in the room
       the message  the client reads the testimonial and every word lights
                    on the card as it is said; then signs off, "Simon,
                    out", the squelch tail closing the channel
     The card's waveform is the voice itself (an analyser on the channel);
     its header says who has the channel. The transmission ends, the deck
     turns to the next client (home.js worxTx.advance), who calls in;
     after the last, Mission Control closes: "All transmissions received.
     Worx Mission Control, standing by." A turn by the visitor cuts the
     channel and switches to that client.
     The voices: synthesised offline with Kokoro (open model, Apache 2.0;
     voices puck for Simon, heart for Monique, fenrir for Mohammed, michael
     for Mission Control) into static/assets/home/comms-voices.m4a, the
     names and acronyms given their pronunciation, each word's timing
     (WORDS) from the model itself. The radio, the static and the tones are
     made here: the voices stay whole (nothing chops or wobbles them), the
     static and the crackle live around them and in the gaps.
     Loudness-matched (K), then the section's 20%; the bed steps back
     further under a voice. Reduced motion: the same, the bars still. */
  var commsSynth = function (c, out, opts) {
    opts = opts || {};
    var K = 0.55;                          // to the -18 LUFS reference (a full round measures -12.8 at 1)
    var still = opts.reduced || A.reduced;
    var buf = opts.voice || null, CUE = opts.cues || {};
    var rnd = Math.random;
    var bus = c.createGain(), comp = c.createDynamicsCompressor(), outG = c.createGain();
    comp.threshold.value = -18; comp.knee.value = 8; comp.ratio.value = 3.5;
    comp.attack.value = 0.004; comp.release.value = 0.18;
    outG.gain.value = K;
    bus.connect(comp); comp.connect(outG); outG.connect(out);
    // what the waveform reads: the channel as heard
    var meter = c.createAnalyser(); meter.fftSize = 512; meter.smoothingTimeConstant = 0.55;
    outG.connect(meter);
    var gain = function (v) { var g = c.createGain(); g.gain.value = v; return g; };
    var bq = function (type, f, Q) { var b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; if (Q != null) b.Q.value = Q; return b; };
    var chain = function (n) { for (var i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n; };
    var noise = (function () {
      var b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
      return b;
    })();
    var shaper = function (k) { var w = c.createWaveShaper(), n = 1024, cv = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; cv[i] = Math.tanh(k * x) / Math.tanh(k); } w.curve = cv; return w; };

    /* the two channels */
    // space to ground: narrow, driven, the carrier fluttering
    var spIn = gain(1), spHP = bq("highpass", 380, 0.75), spLP = bq("lowpass", 3000, 0.9), spPk = bq("peaking", 1600, 1.0);
    spPk.gain.value = 3;
    var spDrive = shaper(1.7), spOut = gain(1.05);
    chain([spIn, spHP, spPk, spLP, spDrive, spOut, bus]);
    // the ground: the room at Mission Control, clean but on the loop
    var gdIn = gain(1), gdHP = bq("highpass", 280, 0.7), gdLP = bq("lowpass", 3600, 0.8), gdDrive = shaper(1.5), gdOut = gain(0.95);
    chain([gdIn, gdHP, gdLP, gdDrive, gdOut, bus]);
    var room = c.createConvolver(), roomG = gain(0.16);
    room.buffer = (function () {
      var len = Math.round(c.sampleRate * 0.9), b = c.createBuffer(2, len, c.sampleRate);
      for (var ch = 0; ch < 2; ch++) { var d = b.getChannelData(ch); for (var i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / len, 3); }
      return b;
    })();
    gdOut.connect(room); room.connect(roomG); roomG.connect(bus);
    // the channel's hiss: always faintly there, up while a mic is keyed
    var hiss = c.createBufferSource(), hBP = bq("bandpass", 1700, 0.5), hG = gain(0);
    hiss.buffer = noise; hiss.loop = true;
    chain([hiss, hBP, hG, bus]); hiss.start();
    var IDLE = 0.012, KEYED = 0.04;
    hG.gain.setTargetAtTime(IDLE, c.currentTime, 0.5);
    // the cabin around the client while their mic is open: the hum of the
    // electrics and the air handling, heard only through their channel
    var cab = c.createBufferSource(), cabLP = bq("lowpass", 900, 0.6), cabG = gain(0);
    cab.buffer = noise; cab.loop = true;
    var hum = c.createOscillator(), humG = gain(0.18);
    hum.type = "sawtooth"; hum.frequency.value = 120;
    chain([cab, cabLP, cabG, spIn]); hum.connect(humG); humG.connect(cabG);
    cab.start(); hum.start();

    /* everything a transmission schedules, so a cut can silence it */
    var live = [];
    var keep = function (srcs, nodes, end) {
      var v = { srcs: srcs, nodes: nodes };
      live.push(v);
      srcs.forEach(function (s) { s.stop(end); });
      srcs[0].onended = function () { srcs.concat(nodes).forEach(function (n) { try { n.disconnect(); } catch (e) {} }); var k = live.indexOf(v); if (k >= 0) live.splice(k, 1); };
    };
    var squelch = function (t, v, len) {
      var s = c.createBufferSource(), bp = bq("bandpass", 2600, 0.7), g = gain(0);
      s.buffer = noise;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.setTargetAtTime(0, t + (len || 0.05), 0.035);
      chain([s, bp, g, bus]); s.start(t, rnd() * 2);
      keep([s], [bp, g], t + (len || 0.05) + 0.3);
    };
    var quindar = function (t, f) {
      var o = c.createOscillator(), g = gain(0);
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.008);
      g.gain.setValueAtTime(0.09, t + 0.242); g.gain.linearRampToValueAtTime(0, t + 0.25);
      o.connect(g); g.connect(gdIn); o.start(t);
      keep([o], [g], t + 0.3);
      return t + 0.25;
    };
    // the push-to-talk switch, the channel opening (or closing) with it
    var key = function (t, on) {
      hG.gain.setTargetAtTime(on ? KEYED : IDLE, t, on ? 0.02 : 0.12);
      cabG.gain.setTargetAtTime(on ? 0.035 : 0, t, on ? 0.03 : 0.06);
      var s = c.createBufferSource(), hp = bq("highpass", 1400, 0.7), g = gain(0);
      s.buffer = noise;
      g.gain.setValueAtTime(on ? 0.5 : 0.35, t); g.gain.setTargetAtTime(0, t, 0.0025);
      chain([s, hp, g, spIn]); s.start(t, rnd() * 2);
      keep([s], [hp, g], t + 0.05);
    };
    // Mission Control keys its console: the same static on the line
    var gkey = function (t, on) { hG.gain.setTargetAtTime(on ? KEYED * 0.8 : IDLE, t, on ? 0.02 : 0.12); };
    // the crackle of the link, only ever between the words
    var crackle = function (t0, t1, n) {
      for (var k = 0; k < n; k++) {
        var t = t0 + rnd() * Math.max(0.02, t1 - t0);
        var s = c.createBufferSource(), hp = bq("highpass", 1800 + rnd() * 2400), g = gain(0);
        s.buffer = noise;
        g.gain.setValueAtTime(0.06 + rnd() * 0.1, t); g.gain.setTargetAtTime(0, t, 0.003 + rnd() * 0.008);
        chain([s, hp, g, bus]); s.start(t, rnd() * 2);
        keep([s], [hp, g], t + 0.08);
      }
    };
    // a line of the script, on its channel
    var line = function (k, t, ch) {
      var cue = CUE[k];
      if (!buf || !cue) return t;
      var s = c.createBufferSource(), g = gain(1);
      s.buffer = buf;
      s.connect(g); g.connect(ch === "space" ? spIn : gdIn);
      s.start(t, cue[0], cue[1]);
      keep([s], [g], t + cue[1] + 0.05);
      return t + cue[1];
    };

    return {
      meter: meter,
      setVoice: function (b) { buf = b; },
      ready: function () { return !!buf; },
      // one transmission: the call, the answer, the message, the sign-off.
      // Returns its timeline: when the message (q) starts and ends, and
      // when the whole is done
      transmit: function (i, t) {
        var T = {};
        // the client keys the mic and calls in
        squelch(t, 0.22, 0.06); key(t, true);
        crackle(t + 0.05, t + 0.16, 2);
        T.a = t + 0.2; var e = line("a" + i, T.a, "space"); T.aEnd = e;
        squelch(e + 0.05, 0.16, 0.1); key(e + 0.05, false);
        // Mission Control answers, framed by the Quindar tones
        T.c0 = e + 0.3; gkey(T.c0, true); var q1 = quindar(T.c0, 2525);
        crackle(T.c0 + 0.26, T.c0 + 0.32, 1);
        T.c = q1 + 0.08; e = line("c" + i, T.c, "ground");
        T.cEnd = e; quindar(e + 0.06, 2475); gkey(e + 0.32, false);
        // the client again: the message, then the sign-off
        var t2 = e + 0.55;
        squelch(t2, 0.22, 0.06); key(t2, true);
        crackle(t2 + 0.05, t2 + 0.14, 2);
        T.q = t2 + 0.18; e = line("q" + i, T.q, "space");
        T.qEnd = e;
        crackle(e + 0.04, e + 0.2, 1);
        T.s = e + 0.28; e = line("s" + i, T.s, "space");
        squelch(e + 0.06, 0.18, 0.14); key(e + 0.06, false);
        T.end = e + 0.3;
        return T;
      },
      // the close, after the last client
      close: function (t) {
        gkey(t, true);
        var q1 = quindar(t, 2525), T = { c: q1 + 0.08 };
        var e = line("end", T.c, "ground");
        quindar(e + 0.06, 2475); gkey(e + 0.32, false);
        T.end = e + 0.5;
        return T;
      },
      // the visitor turned the deck: the channel is cut, mid-word if need be
      cut: function (t) {
        live.slice().forEach(function (v) { v.srcs.forEach(function (s) { try { s.stop(t + 0.04); } catch (e) {} }); });
        squelch(t, 0.3, 0.09); key(t, false);
      },
      stop: function () {
        var t = c.currentTime;
        live.slice().forEach(function (v) { v.srcs.forEach(function (s) { try { s.stop(t + 0.02); } catch (e) {} }); });
        outG.gain.setValueAtTime(0, t + 0.03);
        try { hiss.stop(t + 0.1); cab.stop(t + 0.1); hum.stop(t + 0.1); } catch (e) {}
        setTimeout(function () {
          [bus, comp, outG, meter, spIn, spHP, spLP, spPk, spDrive, spOut, gdIn, gdHP, gdLP, gdDrive, gdOut, room, roomG, hBP, hG, cabLP, cabG, humG].forEach(function (x) { try { x.disconnect(); } catch (e) {} });
        }, 300);
      },
    };
  };
  A._commsSynth = commsSynth;              // for offline renders (loudness)

  var txDeck = q("[data-tx]"), commsSec = q("#comms");
  if (txDeck && commsSec && txDeck.worxTx) (function () {
    var ts = txDeck.worxTx, cards = Array.prototype.slice.call(txDeck.querySelectorAll(".hm-tx-card"));
    var VOICE = "static/assets/home/comms-voices.m4a";
    var CUES = { a0: [0.0, 2.868], c0: [3.168, 4.398], q0: [7.866, 5.417], s0: [13.583, 0.744], a1: [14.627, 3.65], c1: [18.577, 4.086], q1: [22.963, 9.859], s1: [33.122, 0.823], a2: [34.245, 3.987], c2: [38.532, 4.197], q2: [43.029, 8.391], s2: [51.72, 0.909], end: [52.929, 5.152] };
    var WORDS = {
      q0: [[-0.031,0.119],[0.119,0.319],[0.319,0.657],[0.657,0.782],[0.782,0.869],[0.869,1.194],[1.194,1.494],[1.494,1.619],[1.619,1.881],[1.881,2.094],[2.094,2.519],[2.594,2.707],[2.707,2.869],[2.869,3.169],[3.169,3.319],[3.319,4.044],[4.094,4.294],[4.294,4.831],[4.831,5.869]],
      q1: [[-0.027,0.086],[0.086,0.448],[0.448,1.061],[1.061,1.148],[1.148,1.873],[1.873,1.961],[1.961,2.098],[2.098,2.935],[2.935,3.111],[3.111,3.773],[3.773,4.523],[4.623,4.823],[4.823,5.01],[5.01,5.11],[5.11,5.573],[5.573,6.235],[6.235,6.661],[6.661,6.735],[6.735,7.073],[7.073,7.973],[8.161,8.648],[8.648,8.786],[8.786,9.248],[9.248,9.348],[9.348,9.998]],
      q2: [[-0.006,0.131],[0.131,0.319],[0.319,0.644],[0.644,0.831],[0.831,1.244],[1.244,1.457],[1.457,2.044],[2.044,2.444],[2.444,2.894],[2.894,3.519],[3.569,3.682],[3.682,3.819],[3.819,4.394],[4.394,4.556],[4.556,5.069],[5.069,6.344],[6.482,6.969],[6.969,7.119],[7.119,7.331],[7.331,7.794],[7.794,8.669]]
    };   // each word on the card: [start, end] s into its message
    var WHO = [["SIMON", "HYUNDAI"], ["MONIQUE", "CHAUMET"], ["MOHAMMED", "MODON"]];
    A.prefetch(VOICE, true);

    // the message's words, each in its own span (the text stays the text)
    var spans = cards.map(function (card) {
      var bq = card.querySelector("blockquote");
      if (!bq) return [];
      var parts = bq.textContent.trim().split(/\s+/);
      bq.textContent = "";
      return parts.map(function (w, j) {
        if (j) bq.appendChild(document.createTextNode(" "));
        var s = document.createElement("span");
        s.className = "hm-tx-w";
        s.textContent = w;
        bq.appendChild(s);
        return s;
      });
    });
    var metas = cards.map(function (card) { var m = card.querySelector(".hm-tx-meta span"); return m ? { el: m, text: m.textContent } : null; });
    var bars = cards.map(function (card) { return Array.prototype.slice.call(card.querySelectorAll(".hm-tx-wave i")); });

    var sc = null, eng = null, voice = null, on = false, cur = -1, plan = null, raf = 0, nextT = null, played = 0, closed = false, awayT = 0;
    var lat = function () { return A.latency(); };
    var ready = function () { return eng && voice && A.isOn() && scene.p > 0.25; };

    var setMeta = function (i, who) {
      var m = metas[i];
      if (!m) return;
      m.el.textContent = who === "space" ? "RECEIVING · " + WHO[i][0] + ", " + WHO[i][1] : who === "ground" ? "WORX MISSION CONTROL · TRANSMITTING" : m.text;
    };
    var clearCard = function (i) {
      if (i < 0 || !cards[i]) return;
      cards[i].classList.remove("is-voiced", "is-rx", "is-tx");
      spans[i].forEach(function (s) { s.classList.remove("is-said", "is-now"); });
      bars[i].forEach(function (b) { b.style.height = ""; });
      setMeta(i, null);
    };

    // every frame while a transmission runs: who has the channel, which
    // word is being said, and the waveform from the voice itself
    var bins = null;
    var frame = function () {
      raf = 0;
      if (!plan || !eng) return;
      var i = plan.i, P = plan.T, now = sc.currentTime - lat(), card = cards[i];
      var space = (now >= P.a - 0.1 && now < P.aEnd + 0.1) || (now >= P.q - 0.16 && now < P.end - 0.25);
      var ground = now >= P.c0 && now < P.cEnd + 0.35;
      card.classList.toggle("is-rx", space && !ground);
      card.classList.toggle("is-tx", ground);
      setMeta(i, ground ? "ground" : space ? "space" : null);
      // the words
      var w = WORDS["q" + i] || [], t = now - P.q, list = spans[i];
      for (var k = 0; k < list.length && k < w.length; k++) {
        list[k].classList.toggle("is-said", t >= w[k][1] - 0.02);
        list[k].classList.toggle("is-now", t >= w[k][0] - 0.03 && t < w[k][1] - 0.02);
      }
      if (now >= P.qEnd) list.forEach(function (s) { s.classList.add("is-said"); s.classList.remove("is-now"); });
      // the waveform: the voice band, bar by bar
      if (!A.reduced) {
        if (!bins) bins = new Uint8Array(eng.meter.frequencyBinCount);
        eng.meter.getByteFrequencyData(bins);
        var bs = bars[i], hz = sc.sampleRate / 2 / bins.length;
        for (var b = 0; b < bs.length; b++) {
          var f0 = 300 * Math.pow(3400 / 300, b / bs.length), f1 = 300 * Math.pow(3400 / 300, (b + 1) / bs.length);
          var lo = Math.floor(f0 / hz), hi = Math.max(lo + 1, Math.floor(f1 / hz)), m = 0;
          for (var x = lo; x < hi; x++) m = Math.max(m, bins[x]);
          bs[b].style.height = Math.max(12, Math.min(100, (m - 90) / 1.3)) + "%";
        }
      }
      raf = requestAnimationFrame(frame);
    };

    var finish = function () {
      if (!plan) return;
      var i = plan.i;
      plan = null;
      clearCard(i);
    };
    // a client's transmission, on card i
    var transmit = function (i, t) {
      clearTimeout(nextT);
      if (plan) finish();
      cur = i;
      var T = eng.transmit(i, t);
      plan = { i: i, T: T };
      cards[i].classList.add("is-voiced");
      A.duck("comms-voice", 0.62, 0.25, 1.2);
      if (!raf) raf = requestAnimationFrame(frame);
      // when it is over: the next client calls in; after the last, the close
      var wait = (T.end - sc.currentTime) * 1000;
      nextT = setTimeout(function () {
        finish();
        played++;
        if (!ready()) { A.unduck("comms-voice"); return; }
        if (played >= ts.count && !closed) {
          closed = true;
          var C = eng.close(sc.currentTime + 0.5);
          setMeta(i, "ground");
          nextT = setTimeout(function () { setMeta(i, null); A.unduck("comms-voice"); ts.setVoiced(false); }, (C.end - sc.currentTime) * 1000);
          return;
        }
        if (closed) { A.unduck("comms-voice"); ts.setVoiced(false); return; }
        nextT = setTimeout(function () { if (ready() && on) ts.advance(); }, 1400);
      }, wait);
    };
    // the deck turned: by us (the next client), or by the visitor (cut to them)
    ts.onShow = function (e) {
      if (!ready()) return;
      if (!on && !e.user) return;                        // turning by itself, not ours to voice
      on = true;
      var t = sc.currentTime + 0.05;
      if (plan || e.user) { eng.cut(t); t += 0.28; }
      if (e.user) { closed = false; played = 0; }     // the visitor takes the controls: a fresh round from their pick
      if (plan) finish();
      ts.setVoiced(true);
      transmit(e.i, t + 0.25);
    };
    // the section holds the sound: begin with the client on screen; it
    // lets go: the channel is cut and the deck turns by itself again
    var watch = function () {
      if (!eng) return;
      if (ready()) {
        awayT = 0;
        if (!on && !closed) { on = true; played = 0; ts.setVoiced(true); transmit(ts.current, sc.currentTime + 0.4); }
      } else if (on) {
        awayT = awayT || performance.now();
        if (performance.now() - awayT > 900) {
          on = false;
          clearTimeout(nextT); nextT = null;
          if (plan) { eng.cut(sc.currentTime + 0.02); finish(); }
          A.unduck("comms-voice");
          ts.setVoiced(false);
        }
      }
    };
    var watchT = null;
    var scene = A.scene("comms", {
      zone: commsSec,
      reach: 0.7,
      weight: 2,
      duckBed: 0.85,
      start: function (c, input) {
        sc = c;
        if (eng) eng.stop();
        eng = commsSynth(c, input, { voice: voice, cues: CUES });
        if (!voice) A.load(VOICE).then(function (b) { voice = b; if (eng) eng.setVoice(b); }, function () {});
        clearInterval(watchT); watchT = setInterval(watch, 150);
      },
      stop: function () {
        clearInterval(watchT); watchT = null;
        clearTimeout(nextT); nextT = null;
        if (plan) finish();
        if (on) { on = false; ts.setVoiced(false); }
        closed = false; played = 0;
        A.unduck("comms-voice");
        cancelAnimationFrame(raf); raf = 0;
        if (eng) { eng.stop(); eng = null; }
      }
    });
  })();

  /* ---- FIELD NOTES: the workbench, quiet ------------------------------
     After the transmissions, a breather: this section adds no sound of
     its own and lets the bed come back up to full (no duck), the radio's
     static fading away with the comms. The quiet is the effect: it makes
     the finale land. Sound lives only where the visitor touches:
       hover/focus  a note pulled from the logbook: a soft slide and the
                    card seating on its own pitch (A, C#, E: the bed's key,
                    along the shelf, so moving across the three is a
                    finger running along it)
       open         "log opened": a click and two soft notes rising; the
                    article waits 170 ms for it (only with the sound on,
                    never for a click that opens a new tab)
       first view   the three cards ticking into place, left to right,
                    where each sits
     All synthesised, on the section's own channel at its 20%. */
  var notesSec = q("#notes"), notes = notesSec ? Array.prototype.slice.call(notesSec.querySelectorAll(".hm-note")) : [];
  if (notesSec && notes.length) (function () {
    var sc = null, out = null, live = false, seen = false, last = { i: -1, t: 0 }, noise = null;
    var NOTE = [57, 61, 64];   // A3, C#4, E4
    var mtof = function (m) { return 442 * Math.pow(2, (m - 69) / 12); };
    var ready = function () { return live && out && A.isOn() && scene.p > 0.3; };
    var panOf = function (el) { return A.reduced ? 0 : A.panAt(el); };
    var noiseBuf = function () {
      if (noise && noise.sampleRate === sc.sampleRate) return noise;
      noise = sc.createBuffer(1, sc.sampleRate, sc.sampleRate);
      var d = noise.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return noise;
    };
    // a small voice: nodes into a panned gain on the section's channel
    var LEVEL = 2.5;           // measured offline: a pull or an open peaks ~3 dB under a Services piano note
    var voice = function (t, pan, end, build) {
      var c = sc, mix = c.createGain(), tail = mix, made = [mix];
      mix.gain.value = LEVEL;
      if (pan && c.createStereoPanner) { var p = c.createStereoPanner(); p.pan.value = pan; mix.connect(p); tail = p; made.push(p); }
      tail.connect(out);
      var srcs = build(c, mix, made);
      srcs.forEach(function (s) { s.stop(end); });
      srcs[0].onended = function () { srcs.concat(made).forEach(function (n) { try { n.disconnect(); } catch (e) {} }); };
    };
    var hiss = function (c, into, made, t, f0, f1, len, v) {
      var s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
      s.buffer = noiseBuf(); bp.type = "bandpass"; bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + len);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + len * 0.45); g.gain.linearRampToValueAtTime(0, t + len);
      s.connect(bp); bp.connect(g); g.connect(into); s.start(t, Math.random() * 0.8);
      made.push(bp, g); return s;
    };
    var tone = function (c, into, made, t, f, v, d, type) {
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.setTargetAtTime(0, t + 0.004, d);
      o.connect(g); g.connect(into); o.start(t);
      made.push(g); return o;
    };
    var click = function (c, into, made, t, v) {
      var s = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
      s.buffer = noiseBuf(); hp.type = "highpass"; hp.frequency.value = 2600;
      g.gain.setValueAtTime(v, t); g.gain.setTargetAtTime(0, t, 0.003);
      s.connect(hp); hp.connect(g); g.connect(into); s.start(t, Math.random() * 0.8);
      made.push(hp, g); return s;
    };
    // a note pulled from the logbook: the slide, then it seats on its pitch
    var pull = function (i, el) {
      var t = sc.currentTime + 0.01, f = mtof(NOTE[i % 3] + 12);
      voice(t, panOf(el), t + 1.2, function (c, mix, made) {
        return [
          hiss(c, mix, made, t, 700, 2400, 0.13, 0.05),
          tone(c, mix, made, t + 0.1, f, 0.12, 0.11),
          tone(c, mix, made, t + 0.1, f * 2, 0.025, 0.05, "triangle"),
          click(c, mix, made, t + 0.1, 0.06),
        ];
      });
    };
    // "log opened": a click and two soft notes rising
    var open = function (i, el) {
      var t = sc.currentTime + 0.005, f = mtof(NOTE[i % 3] + 12);
      voice(t, panOf(el), t + 1.6, function (c, mix, made) {
        return [
          click(c, mix, made, t, 0.09),
          tone(c, mix, made, t + 0.012, f, 0.11, 0.16),
          tone(c, mix, made, t + 0.085, f * 1.5, 0.1, 0.24),
          tone(c, mix, made, t + 0.085, f * 3, 0.018, 0.08, "triangle"),
        ];
      });
    };
    // the cards ticking into place, where each sits
    var settle = function () {
      var t = sc.currentTime + 0.05;
      notes.forEach(function (el, i) {
        var at = t + i * 0.13, f = mtof(NOTE[i % 3] + 24);
        voice(at, panOf(el), at + 0.5, function (c, mix, made) {
          return [click(c, mix, made, at, 0.06), tone(c, mix, made, at, f, 0.028, 0.03)];   // ~10 dB under a piano note: tiny
        });
      });
    };

    notes.forEach(function (el, i) {
      var hover = function () {
        if (!ready()) return;
        var now = performance.now();
        if (last.i === i && now - last.t < 350) return;      // the same card, a jitter of the pointer
        if (now - last.t < 60) return;                       // sweeping across: not a rattle
        last = { i: i, t: now };
        pull(i, el);
      };
      el.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") hover(); });
      el.addEventListener("focus", hover);
      el.addEventListener("click", function (e) {
        if (!ready() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || el.target === "_blank") return;
        e.preventDefault();
        open(i, el);
        var href = el.href;
        setTimeout(function () { window.location.href = href; }, 170);
      });
    });
    // for offline renders (levels): the voices on a given context and channel
    A._notesProbe = function (c, o) { sc = c; out = o; live = true; return { pull: pull, open: open, settle: settle, notes: notes }; };
    // first view: once the section has the sound and the cards are in sight
    var inView = false;
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { inView = en[0].isIntersecting; }, { threshold: 0.45 }).observe(notes[0].parentNode);
    var watchT = null;
    var scene = A.scene("notes", {
      zone: notesSec,
      reach: 0.6,
      weight: 0,
      duckBed: 1,                  // the bed comes back up to full: the quiet is the effect
      start: function (c, input) {
        sc = c; out = input; live = true;
        clearInterval(watchT);
        watchT = setInterval(function () { if (!seen && inView && ready()) { seen = true; settle(); } }, 150);
      },
      stop: function () { live = false; clearInterval(watchT); watchT = null; }
    });
  })();

  /* ---- BRIEFING: the decoder ------------------------------------------
     The briefing is a secure terminal: pick a question and its answer
     decrypts onto the screen. Its sound is the decoder the visitor
     operates, on the terminal's own clock (home.js worxBrief: the times
     the screen uses), still quiet, the bed at full:
       pick         the query typed in: soft keystrokes for as long as the
                    question scrambles onto the screen (520 ms)
       decrypting   the decoder at work: a rapid chatter of small pitched
                    blips over a breath of data hiss, for exactly as long
                    as DECRYPTING shows (640 ms)
       the writing  every line of the answer's code printing onto the
                    screen (home.css brf-line: 0, .08, .2 ... .68 s) is
                    heard as it lands: a short teletype burst per line
       DECRYPTED    a clean two-tone confirmation on the frame the status
                    flips; each briefing resolves on its own pitch (the
                    bed's key), a different file unlocked each time
       the index    a tiny console tick for each question hovered or
                    arrowed onto
       the crew     "Ask the crew directly": a channel opening, the radio's
                    chirp (the page waits 170 ms for it, sound on only,
                    never for a new-tab click)
     Synthesised; levels set offline against a Services piano note (the
     confirmation ~3 dB under it, the rest well under). Reduced motion:
     the decrypt is instant, so only the confirmation. */
  var brfRoot = q("[data-brf]"), brfSec = q("#briefing");
  if (brfRoot && brfSec && brfRoot.worxBrief) (function () {
    var bs = brfRoot.worxBrief, items = brfRoot.querySelectorAll(".brf-item");
    var sc = null, out = null, live = false, noise = null, lastTick = 0;
    var LEVEL = 2;             // measured offline: decoder sounds well present over the full bed, confirmation ~ a piano note
    var CONF = [[69, 76], [71, 78], [73, 80], [74, 81], [76, 83], [78, 85]];   // each briefing's two tones (A major)
    var mtof = function (m) { return 442 * Math.pow(2, (m - 69) / 12); };
    var rnd = Math.random;
    var ready = function () { return live && out && A.isOn() && scene.p > 0.3; };
    var noiseBuf = function () {
      if (noise && noise.sampleRate === sc.sampleRate) return noise;
      noise = sc.createBuffer(1, sc.sampleRate, sc.sampleRate);
      var d = noise.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
      return noise;
    };
    var voice = function (t, pan, end, build) {
      var c = sc, mix = c.createGain(), tail = mix, made = [mix];
      mix.gain.value = LEVEL;
      if (pan && !A.reduced && c.createStereoPanner) { var p = c.createStereoPanner(); p.pan.value = pan; mix.connect(p); tail = p; made.push(p); }
      tail.connect(out);
      var srcs = build(c, mix, made);
      srcs.forEach(function (s) { s.stop(end); });
      srcs[0].onended = function () { srcs.concat(made).forEach(function (n) { try { n.disconnect(); } catch (e) {} }); };
    };
    var burst = function (c, into, made, t, type, f, Q, v, d) {
      var s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
      s.buffer = noiseBuf(); bp.type = type; bp.frequency.value = f; if (Q) bp.Q.value = Q;
      g.gain.setValueAtTime(v, t); g.gain.setTargetAtTime(0, t, d);
      s.connect(bp); bp.connect(g); g.connect(into); s.start(t, rnd() * 0.8);
      made.push(bp, g); return s;
    };
    var blip = function (c, into, made, t, f, v, d, type) {
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.002); g.gain.setTargetAtTime(0, t + 0.002, d);
      o.connect(g); g.connect(into); o.start(t);
      made.push(g); return o;
    };
    var pan = function () { return A.reduced ? 0 : A.panAt(brfRoot) * 0.8; };

    // the query typed in: keystrokes, unevenly, as fingers do
    var type = function (t, ms) {
      var end = t + ms / 1000, P = pan();
      voice(t, P, end + 0.4, function (c, mix, made) {
        var srcs = [], k = t;
        while (k < end) {
          var v = 0.5 + rnd() * 0.5;
          srcs.push(burst(c, mix, made, k, "bandpass", 2200 + rnd() * 1800, 1.4, 0.32 * v, 0.006));
          srcs.push(blip(c, mix, made, k, 170 + rnd() * 90, 0.1 * v, 0.012));
          k += 0.045 + rnd() * 0.05;
        }
        return srcs;
      });
    };
    // the decoder at work: blips over a breath of data hiss
    var decrypt = function (t, ms) {
      var len = ms / 1000, P = pan();
      voice(t, P, t + len + 0.3, function (c, mix, made) {
        var srcs = [];
        var s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
        s.buffer = noiseBuf(); bp.type = "bandpass"; bp.Q.value = 0.8;
        bp.frequency.setValueAtTime(1400, t); bp.frequency.linearRampToValueAtTime(3200, t + len);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.1, t + len * 0.3); g.gain.linearRampToValueAtTime(0, t + len);
        s.connect(bp); bp.connect(g); g.connect(mix); s.start(t, rnd() * 0.5); made.push(bp, g); srcs.push(s);
        var k = t + 0.01;
        while (k < t + len - 0.03) {
          var x = (k - t) / len;                                   // busiest in the middle
          srcs.push(blip(c, mix, made, k, 1100 + Math.floor(rnd() * 9) * 260, 0.12 * Math.sin(Math.PI * Math.min(1, x + 0.15)), 0.009, rnd() < 0.3 ? "square" : "sine"));
          k += 0.018 + rnd() * 0.022;
        }
        return srcs;
      });
    };
    // the writing: each line of code printing onto the screen, a short
    // teletype burst (a few strikes and the carriage) as it lands
    var LINE_AT = [0, 0.08, 0.2, 0.32, 0.44, 0.56, 0.68];   // home.css .brf-a.is-in .brf-code .ln delays
    var write = function (t, n) {
      var P = pan();
      voice(t, P, t + LINE_AT[Math.min(n, LINE_AT.length) - 1] + 0.5, function (c, mix, made) {
        var srcs = [];
        for (var l = 0; l < Math.min(n, LINE_AT.length); l++) {
          var at = t + LINE_AT[l] + 0.06, strikes = 3 + Math.floor(rnd() * 3);
          for (var k = 0; k < strikes; k++) {
            var st = at + k * (0.014 + rnd() * 0.01);
            srcs.push(burst(c, mix, made, st, "bandpass", 1500 + rnd() * 1500, 2, 0.16 + rnd() * 0.08, 0.005));
          }
          srcs.push(blip(c, mix, made, at + strikes * 0.02, 520 + l * 30, 0.03, 0.02, "triangle"));   // the carriage
        }
        return srcs;
      });
    };
    // DECRYPTED: two clean tones, this briefing's own
    var confirm = function (t, i) {
      var pr = CONF[i % CONF.length];
      voice(t, pan(), t + 1.4, function (c, mix, made) {
        return [
          burst(c, mix, made, t, "highpass", 3000, 0, 0.08, 0.003),
          blip(c, mix, made, t, mtof(pr[0]), 0.11, 0.09),
          blip(c, mix, made, t + 0.075, mtof(pr[1]), 0.11, 0.22),
          blip(c, mix, made, t + 0.075, mtof(pr[1]) * 2, 0.018, 0.07, "triangle"),
        ];
      });
    };
    // the index: a cursor moving down the list
    var tick = function (el) {
      var t = sc.currentTime + 0.005;
      voice(t, A.reduced ? 0 : A.panAt(el) * 0.8, t + 0.2, function (c, mix, made) {
        return [burst(c, mix, made, t, "highpass", 3200, 0, 0.14, 0.002), blip(c, mix, made, t, 2900, 0.05, 0.01)];
      });
    };
    // the crew: the channel opening
    var chirp = function (el) {
      var t = sc.currentTime + 0.005;
      voice(t, A.reduced ? 0 : A.panAt(el) * 0.8, t + 0.6, function (c, mix, made) {
        var o = c.createOscillator(), g = c.createGain();
        o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(1800, t + 0.08);
        g.gain.setValueAtTime(0, t); g.gain.setValueAtTime(0, t + 0.03); g.gain.linearRampToValueAtTime(0.13, t + 0.04); g.gain.setTargetAtTime(0, t + 0.09, 0.03);
        o.connect(g); g.connect(mix); o.start(t); made.push(g);
        return [burst(c, mix, made, t, "bandpass", 2400, 0.8, 0.18, 0.02), o];
      });
    };

    bs.onOpen = function (e) {
      if (!ready()) return;
      var L = A.latency(), now = sc.currentTime + 0.005;
      if (e.typeMs) type(now, e.typeMs);
      if (e.decryptMs) decrypt(now + 0.02, e.decryptMs - 40);
      // the answer's code writing itself in, line by line (not under reduced motion: it appears at once)
      var item = items[e.i], lines = item && !A.reduced ? item.querySelectorAll(".brf-code .ln").length : 0;
      if (lines) write(now - L, lines);
      confirm(Math.max(now, now + e.decryptMs / 1000 - L), e.i);   // lands on the frame the status flips
    };
    Array.prototype.forEach.call(brfRoot.querySelectorAll(".brf-q"), function (b) {
      var t = function () { if (!ready()) return; var n = performance.now(); if (n - lastTick < 45) return; lastTick = n; tick(b); };
      b.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") t(); });
      b.addEventListener("focus", t);
    });
    Array.prototype.forEach.call(brfRoot.querySelectorAll(".brf-a-link"), function (a) {
      a.addEventListener("click", function (e) {
        if (!ready() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank") return;
        e.preventDefault();
        chirp(a);
        var href = a.href;
        setTimeout(function () { window.location.href = href; }, 170);
      });
    });
    // for offline renders (levels)
    A._briefProbe = function (c, o) { sc = c; out = o; live = true; return { type: type, decrypt: decrypt, confirm: confirm, tick: tick, chirp: chirp, write: write, el: brfRoot }; };
    var scene = A.scene("briefing", {
      zone: brfSec,
      reach: 0.6,
      weight: 0,
      duckBed: 1,                  // still the quiet stretch before the finale
      start: function (c, input) { sc = c; out = input; live = true; },
      stop: function () { live = false; }
    });
  })();

  /* ---- LIFTOFF: the final poll ------------------------------------------
     The finale. The whole site has been a mission; its last moment hands
     the final GO to the visitor:
       the poll     as the section arrives, the Flight Director polls the
                    stations over the loop, as before a real launch: "All
                    stations, final go, no-go poll for launch. Strategy?"
                    "Go." "Design?" "Go, Flight." ... each GO lighting on
                    the board as it is answered (home.css is-polling), then
                    "And, your project?" ... and the board waits: AWAITING
       the answer   the visitor arms the ignition (home.js worxLaunch): the
                    button charges with a rising whine, the line flips to
                    GO, and the Flight Director: "We are go for launch."
       liftoff      the click: the ignition's crack and the REAL Falcon 9
                    (the pad microphone of the Flight Plan's launch, static/
                    assets/home/flight-countdown.m4a) surging through the
                    lift, cut hard as Contact opens (760 ms)
       the pad      under it all, faint: the vehicle venting and the hum of
                    the pad; and the craft crossing the sky (its SMIL
                    motion, read from the SVG's own clock) passes, distant,
                    from one side to the other
     The poll's voices: Kokoro (the Flight Director is Mission Control's
     michael; the stations bella, george, onyx, nicole), in static/assets/
     home/launch-poll.m4a; the loop, the static and the rest are made
     here. Loudness-matched (K), then the section's 20%. Reduced motion:
     the poll and the answer; no pass (the craft is not drawn). */
  var launchSynth = function (c, out, opts) {
    opts = opts || {};
    var K = 0.58;                          // to the -18 LUFS reference (the poll and its answer measure -13.3 at 1)
    var buf = opts.voice || null, roarBuf = opts.roar || null, CUE = opts.cues || {}, ROAR = opts.roarCue || null;
    var rnd = Math.random, still = opts.reduced || A.reduced;
    var bus = c.createGain(), comp = c.createDynamicsCompressor(), outG = c.createGain();
    comp.threshold.value = -18; comp.knee.value = 8; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
    outG.gain.value = K;
    bus.connect(comp); comp.connect(outG); outG.connect(out);
    var gain = function (v) { var g = c.createGain(); g.gain.value = v; return g; };
    var bq = function (type, f, Q) { var b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; if (Q != null) b.Q.value = Q; return b; };
    var chain = function (n) { for (var i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n; };
    var shaper = function (k) { var w = c.createWaveShaper(), n = 1024, cv = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; cv[i] = Math.tanh(k * x) / Math.tanh(k); } w.curve = cv; return w; };
    var noise = (function () { var b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), d = b.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; return b; })();
    var pn = function (p) { if (still || !c.createStereoPanner) return gain(1); var n = c.createStereoPanner(); n.pan.value = p; return n; };
    var live = [];
    var keep = function (srcs, nodes, end) {
      var v = { srcs: srcs }; live.push(v);
      srcs.forEach(function (s) { s.stop(end); });
      srcs[0].onended = function () { srcs.concat(nodes).forEach(function (n) { try { n.disconnect(); } catch (e) {} }); var k = live.indexOf(v); if (k >= 0) live.splice(k, 1); };
    };

    /* the loop: the Flight Director's console and the stations' */
    var fdIn = gain(1), fdHP = bq("highpass", 300, 0.7), fdLP = bq("lowpass", 3400, 0.8), fdDr = shaper(1.5), fdOut = gain(1);
    chain([fdIn, fdHP, fdLP, fdDr, fdOut, bus]);
    var stIn = gain(1), stHP = bq("highpass", 420, 0.75), stLP = bq("lowpass", 2900, 0.9), stDr = shaper(1.8), stOut = gain(1);
    chain([stIn, stHP, stLP, stDr, stOut, bus]);
    var room = c.createConvolver(), roomG = gain(0.14);
    room.buffer = (function () { var len = Math.round(c.sampleRate * 0.8), b = c.createBuffer(2, len, c.sampleRate); for (var ch = 0; ch < 2; ch++) { var d = b.getChannelData(ch); for (var i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / len, 3); } return b; })();
    fdOut.connect(room); stOut.connect(room); room.connect(roomG); roomG.connect(bus);
    // the loop's hiss, up while the poll runs
    var hiss = c.createBufferSource(), hBP = bq("bandpass", 1700, 0.5), hG = gain(0);
    hiss.buffer = noise; hiss.loop = true; chain([hiss, hBP, hG, bus]); hiss.start();
    var loopOn = function (t, on) { hG.gain.setTargetAtTime(on ? 0.028 : 0, t, on ? 0.05 : 0.4); };
    var crackle = function (t0, t1, n) {
      for (var k = 0; k < n; k++) {
        var t = t0 + rnd() * Math.max(0.02, t1 - t0), s = c.createBufferSource(), hp = bq("highpass", 1800 + rnd() * 2400), g = gain(0);
        s.buffer = noise; g.gain.setValueAtTime(0.05 + rnd() * 0.08, t); g.gain.setTargetAtTime(0, t, 0.003 + rnd() * 0.008);
        chain([s, hp, g, bus]); s.start(t, rnd() * 2); keep([s], [hp, g], t + 0.08);
      }
    };
    var line = function (k, t, station) {
      var cue = CUE[k];
      if (!buf || !cue) return t;
      var s = c.createBufferSource(), g = gain(1);
      s.buffer = buf; s.connect(g); g.connect(station ? stIn : fdIn);
      s.start(t, cue[0], cue[1]); keep([s], [g], t + cue[1] + 0.05);
      return t + cue[1];
    };

    /* the pad: venting and hum, faint, always */
    var vent = c.createBufferSource(), vBP = bq("bandpass", 1100, 0.6), vG = gain(0), vL = c.createOscillator(), vLG = gain(0.006);
    vent.buffer = noise; vent.loop = true; vL.frequency.value = 0.07;
    vL.connect(vLG); vLG.connect(vG.gain);
    var hum = c.createBufferSource(), hLP = bq("lowpass", 110, 0.7), humG = gain(0);
    hum.buffer = noise; hum.loop = true;
    chain([vent, vBP, vG, bus]); chain([hum, hLP, humG, bus]);
    vent.start(0, 1); hum.start(0, 2); vL.start();
    vG.gain.setTargetAtTime(0.012, c.currentTime, 1.5); humG.gain.setTargetAtTime(0.09, c.currentTime, 1.5);

    /* the charge: the ignition armed */
    var charge = null;
    var arm = function (t, on) {
      if (on) {
        if (charge) return;
        var o = c.createOscillator(), lp = bq("lowpass", 400, 4), g = gain(0);
        o.type = "sawtooth";
        o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(330, t + 0.7);
        lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(2200, t + 0.7);
        lp.frequency.setTargetAtTime(900, t + 0.75, 0.3);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.65); g.gain.setTargetAtTime(0.022, t + 0.75, 0.25);
        chain([o, lp, g, bus]); o.start(t);
        charge = { o: o, g: g, nodes: [lp, g] };
      } else if (charge) {
        var ch = charge; charge = null;
        ch.g.gain.cancelScheduledValues(t); ch.g.gain.setValueAtTime(ch.g.gain.value, t); ch.g.gain.setTargetAtTime(0, t, 0.08);
        ch.o.frequency.setTargetAtTime(60, t, 0.15);
        keep([ch.o], ch.nodes, t + 0.8);
      }
    };

    /* liftoff: the crack and the real roar, surging */
    var lift = function (t) {
      // the ignition: a low concussion and a crack
      var o = c.createOscillator(), og = gain(0);
      o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(1.1, t + 0.01); og.gain.setTargetAtTime(0, t + 0.02, 0.2);
      chain([o, og, bus]); o.start(t); keep([o], [og], t + 1.5);
      var s = c.createBufferSource(), hp = bq("highpass", 900, 0.6), sg = gain(0);
      s.buffer = noise; sg.gain.setValueAtTime(0.5, t); sg.gain.setTargetAtTime(0, t, 0.05);
      chain([s, hp, sg, bus]); s.start(t); keep([s], [hp, sg], t + 0.5);
      // the real thing: the pad microphone, the moment of full thrust
      if (roarBuf && ROAR) {
        var r = c.createBufferSource(), rg = gain(0), dl = c.createDelay(0.05), pl = pn(-0.45), pr = pn(0.45), rd = gain(1);
        dl.delayTime.value = 0.017;
        r.buffer = roarBuf;
        rg.gain.setValueAtTime(0, t); rg.gain.linearRampToValueAtTime(1.4, t + 0.5);
        r.connect(rg); rg.connect(pl); rg.connect(dl); dl.connect(rd); rd.connect(pr); pl.connect(bus); pr.connect(bus);
        r.start(t, ROAR[0] + 4.6, 6); keep([r], [rg, dl, pl, pr, rd], t + 6);
      }
      // the air torn upward
      var w = c.createBufferSource(), wb = bq("bandpass", 400, 0.8), wg = gain(0);
      w.buffer = noise; wb.frequency.setValueAtTime(300, t); wb.frequency.exponentialRampToValueAtTime(3500, t + 0.75);
      wg.gain.setValueAtTime(0, t); wg.gain.linearRampToValueAtTime(0.4, t + 0.7);
      chain([w, wb, wg, bus]); w.start(t, rnd()); keep([w], [wb, wg], t + 3);
    };

    /* the craft crossing the sky: distant, one side to the other */
    var pass = function (t, len) {
      var n = c.createBufferSource(), bp = bq("bandpass", 380, 1.1), lp = bq("lowpass", 900, 0.6), g = gain(0), p = still || !c.createStereoPanner ? gain(1) : c.createStereoPanner();
      n.buffer = noise; n.loop = true;
      bp.frequency.setValueAtTime(330, t); bp.frequency.linearRampToValueAtTime(620, t + len * 0.45); bp.frequency.linearRampToValueAtTime(260, t + len);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + len * 0.45); g.gain.linearRampToValueAtTime(0, t + len);
      if (p.pan) { p.pan.setValueAtTime(-0.7, t); p.pan.linearRampToValueAtTime(0.7, t + len); }
      chain([n, bp, lp, g, p, bus]); n.start(t, rnd() * 2); keep([n], [bp, lp, g, p], t + len + 0.1);
    };

    return {
      setVoice: function (b) { buf = b; },
      setRoar: function (b) { roarBuf = b; },
      ready: function () { return !!buf; },
      // the poll: returns when each station is called and answers, and the end
      poll: function (t) {
        var T = { calls: [], gos: [] };
        loopOn(t, true); crackle(t, t + 0.15, 2);
        var e = line("intro", t + 0.2, false);
        [["q_strat", "a_strat"], ["q_design", "a_design"], ["q_eng", "a_eng"], ["q_supp", "a_supp"]].forEach(function (p) {
          var q0 = e + 0.32; var qe = line(p[0], q0, false);
          var a0 = qe + 0.22; e = line(p[1], a0, true);
          crackle(qe + 0.02, a0 - 0.02, 1);
          T.calls.push(q0); T.gos.push(a0);
        });
        T.you = e + 0.45; T.youEnd = line("q_you", T.you, false);
        loopOn(T.youEnd + 0.4, false);
        T.end = T.youEnd + 0.3;
        return T;
      },
      go: function (t) { loopOn(t, true); var e = line("go", t + 0.08, false); loopOn(e + 0.3, false); return e; },
      arm: arm,
      lift: lift,
      pass: pass,
      cut: function (t) { live.slice().forEach(function (v) { v.srcs.forEach(function (s) { try { s.stop(t + 0.03); } catch (e) {} }); }); loopOn(t, false); },
      stop: function () {
        var t = c.currentTime;
        live.slice().forEach(function (v) { v.srcs.forEach(function (s) { try { s.stop(t + 0.02); } catch (e) {} }); });
        if (charge) { try { charge.o.stop(t + 0.02); } catch (e) {} charge = null; }
        outG.gain.setValueAtTime(0, t + 0.03);
        try { hiss.stop(t + 0.1); vent.stop(t + 0.1); hum.stop(t + 0.1); vL.stop(t + 0.1); } catch (e) {}
        setTimeout(function () { [bus, comp, outG, fdIn, fdHP, fdLP, fdDr, fdOut, stIn, stHP, stLP, stDr, stOut, room, roomG, hBP, hG, vBP, vG, vLG, hLP, humG].forEach(function (x) { try { x.disconnect(); } catch (e) {} }); }, 300);
      },
    };
  };
  A._launchSynth = launchSynth;            // for offline renders (loudness)

  var liftSec = q("#liftoff"), liftRoot = q("[data-launch]");
  if (liftSec && liftRoot && liftRoot.worxLaunch) (function () {
    var ls = liftRoot.worxLaunch;
    var VOICE = "static/assets/home/launch-poll.m4a", ROARF = "static/assets/home/flight-countdown.m4a";
    var CUES = { intro: [0.0, 3.185], q_strat: [3.435, 0.82], a_strat: [4.504, 0.442], q_design: [5.196, 0.748], a_design: [6.194, 1.083], q_eng: [7.527, 0.915], a_eng: [8.692, 0.462], q_supp: [9.404, 0.788], a_supp: [10.443, 0.986], q_you: [11.679, 1.334], go: [13.263, 1.403] };
    var ROAR = [12.53, 19.8];      // the roar in the countdown file (FLIGHT PLAN's CUES.roar)
    A.prefetch(VOICE, true);
    var rows = Array.prototype.slice.call(liftRoot.querySelectorAll(".hm-poll li"));
    var arcSvg = liftRoot.querySelector(".hm-launch-arc");
    var sc = null, eng = null, voice = null, roar = null, polled = false, pollT = null, plan = null, timers = [], wantGo = false, lastGo = 0, watchT = null, lastPass = -1;
    var ready = function () { return eng && voice && A.isOn() && scene.p > 0.3; };
    var at = function (t, fn) { timers.push(setTimeout(fn, Math.max(0, (t - sc.currentTime + A.latency()) * 1000))); };
    var reset = function () {
      timers.forEach(clearTimeout); timers = [];
      liftRoot.classList.remove("is-polling");
      rows.forEach(function (r) { r.classList.remove("is-go", "is-called"); });
      plan = null;
    };
    var sayGo = function () {
      var now = sc.currentTime;
      if (now - lastGo < 8) return;
      lastGo = now;
      eng.go(now + 0.25);
    };
    var startPoll = function () {
      polled = true;
      var T = eng.poll(sc.currentTime + 0.3);
      plan = T;
      liftRoot.classList.add("is-polling");
      rows.forEach(function (r) { r.classList.remove("is-go", "is-called"); });
      T.calls.forEach(function (tc, i) {
        at(tc, function () { rows.forEach(function (r) { r.classList.remove("is-called"); }); if (rows[i]) rows[i].classList.add("is-called"); });
        at(T.gos[i], function () { if (rows[i]) rows[i].classList.add("is-go"); });
      });
      at(T.you, function () { rows.forEach(function (r) { r.classList.remove("is-called"); }); var y = rows[rows.length - 1]; if (y) y.classList.add("is-called"); });
      at(T.end, function () {
        plan = null;
        var y = rows[rows.length - 1]; if (y) y.classList.remove("is-called");
        if (wantGo && liftRoot.classList.contains("is-armed")) sayGo();   // armed while the poll ran: the answer comes now
      });
    };
    ls.onArm = function (on) {
      if (!ready()) return;
      eng.arm(sc.currentTime + 0.01, on);
      if (!on) { wantGo = false; return; }
      if (plan) { wantGo = true; return; }      // the poll is still running: answer at its end
      sayGo();
    };
    ls.onLift = function () {
      if (!eng || !A.isOn()) return;
      var t = sc.currentTime + 0.005;
      eng.cut(t); eng.arm(t, false);
      eng.lift(t);
      A.duck("launch-lift", 0.4, 0.05, 2);
    };
    // the craft's pass, on the SVG's own clock (11 s: across in the first 8.8)
    var passTick = function () {
      if (!arcSvg || !arcSvg.getCurrentTime || A.reduced || !ready()) return;
      var st = arcSvg.getCurrentTime(), k = Math.floor(st / 11), ph = st - k * 11;
      if (k === lastPass) return;
      if (ph < 0.6) { lastPass = k; eng.pass(sc.currentTime + 0.05 - ph, 8.8); }
      else if (ph > 10.4) { lastPass = k; eng.pass(sc.currentTime + (11 - ph) + 0.05, 8.8); }
    };
    var watch = function () {
      if (!eng) return;
      passTick();
      if (!polled && ready() && liftRoot.classList.contains("is-inview")) startPoll();
    };
    var scene = A.scene("launch", {
      zone: liftSec,
      reach: 0.7,
      weight: 2,
      duckBed: 0.85,
      start: function (c, input) {
        sc = c;
        if (eng) eng.stop();
        eng = launchSynth(c, input, { voice: voice, roar: roar, cues: CUES, roarCue: ROAR });
        if (!voice) A.load(VOICE).then(function (b) { voice = b; if (eng) eng.setVoice(b); }, function () {});
        if (!roar) A.load(ROARF).then(function (b) { roar = b; if (eng) eng.setRoar(b); }, function () {});
        clearInterval(watchT); watchT = setInterval(watch, 200);
      },
      stop: function () {
        clearInterval(watchT); watchT = null;
        reset(); polled = false; wantGo = false; lastPass = -1;
        A.unduck("launch-lift");
        if (eng) { eng.stop(); eng = null; }
      }
    });
    // back from Contact (the browser's back button): the console as it was
    window.addEventListener("pageshow", function () { A.unduck("launch-lift"); });
  })();

  /* ---- where the control sits ----------------------------------------- */
  if (!dock) return;
  var tele = hx && q(".hx-telemetry", hx);
  var cta = hx && q(".hx-cta", hx);
  var foot = q(".footer-bottom");
  var base = 0, lastLift = -1;
  var measure = function () {
    base = parseFloat(getComputedStyle(dock).bottom) || 0;
    lastLift = -1;
    place();
  };
  var place = function () {
    var vh = window.innerHeight, lift = 0;
    // over the flight recorder while it shows; down as it fades
    if (tele && hx) {
      var r = hx.getBoundingClientRect();
      var span = Math.max(1, r.height - vh);
      var p = clamp01(-r.top / span);
      var shown = A.reduced ? 1 : clamp01(1 - 3 * smooth(p));
      shown *= 1 - clamp01((-r.top - span) / (vh * 0.25));
      if (shown > 0) {
        var t = tele.getBoundingClientRect();
        lift = Math.max(0, vh - t.top + 14 - base) * smooth(shown);
        // phones: never onto the CTA row; centred in the slot between
        // the buttons and the recorder when they share a column
        var d = dock.getBoundingClientRect(), low = -1;
        if (cta) Array.prototype.forEach.call(cta.children, function (b) {
          var c = b.getBoundingClientRect();
          if (c.height && c.left < d.right && c.right > d.left) low = Math.max(low, c.bottom);
        });
        if (low > 0) {
          var stack = parseFloat(getComputedStyle(dock).getPropertyValue("--sx-stack")) || 0;
          var top = low + Math.max(0, (t.top - low - d.height) / 2);
          lift = Math.min(lift, Math.max(0, vh - base - stack - d.height - top));
        }
      }
    }
    // above the footer's last line, pushed up by it like a sticky
    if (foot) {
      var f = foot.getBoundingClientRect();
      if (f.top < vh) lift = Math.max(lift, vh - f.top + 12 - base);
    }
    lift = Math.round(lift);
    if (lift !== lastLift) { lastLift = lift; dock.style.setProperty("--sx-lift", lift + "px"); }
  };
  var ticking = false;
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; place(); }); }
  }, { passive: true });
  window.addEventListener("resize", measure);
  // the CTA row slides in with the copy: place again once it has landed
  if (cta) ["transitionend", "animationend"].forEach(function (ev) { cta.addEventListener(ev, function () { place(); }); });
  measure();
  // the control is there from the first frame, ready before the film rolls
  requestAnimationFrame(function () { dock.classList.add("is-ready"); });
})();
