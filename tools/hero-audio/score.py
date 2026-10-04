"""REDSHIFT: the Worx hero score, rendered offline to the film's frames.

Film time t (s). The site cuts the film at CUT = 8.46 and the HTML card
(WORX) takes over on the same clock: card time c = t - CUT.
Pitch spine: A (A = 442), the Home bed's 55.25 Hz hum.
"""
import numpy as np, sys, os
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, lfilter, fftconvolve, resample_poly

SR = 48000
CUT = 8.46
L = 12.7
N = int(L * SR)
A1 = 55.25
rng = np.random.default_rng(7)
HERE = os.path.dirname(os.path.abspath(__file__))
# the licensed sources (Pixabay downloads), converted to 48 kHz WAV:
# ffmpeg -i <name>.mp3 -ar 48000 -ac 2 -c:a pcm_f32le src/<short-name>.wav
SRC = os.path.join(HERE, "src")

# ---------------------------------------------------------------- utilities
def load(name, t0=0.0, t1=None):
    sr, x = wavfile.read(os.path.join(SRC, name + ".wav"))
    x = x.astype(np.float64)
    a = int(t0 * SR); b = len(x) if t1 is None else int(t1 * SR)
    return x[a:b].copy()

def T(t): return int(round(t * SR))
def tt(n, t0=0.0): return t0 + np.arange(n) / SR
def dbg(d): return 10 ** (d / 20)
def rms_db(x): return 10 * np.log10(np.mean(x ** 2) + 1e-20)
def norm(x, target=-20.0):
    return x * dbg(target - rms_db(x))
def mono(x): return x.mean(1) if x.ndim == 2 else x
def st(m): return np.stack([m, m], 1) if m.ndim == 1 else m

def sos(kind, f, order=2):
    if kind == "bp": return butter(order, f, "band", fs=SR, output="sos")
    return butter(order, f, kind, fs=SR, output="sos")
def filt(x, kind, f, order=2): return sosfilt(sos(kind, f, order), x, axis=0)

def fade(x, fin=0.005, fout=0.005):
    x = x.copy(); n = len(x)
    a = min(n, T(fin)); b = min(n, T(fout))
    if a: x[:a] *= (np.linspace(0, 1, a) ** 2)[:, None] if x.ndim == 2 else np.linspace(0, 1, a) ** 2
    if b: x[n - b:] *= (np.linspace(1, 0, b) ** 2)[:, None] if x.ndim == 2 else np.linspace(1, 0, b) ** 2
    return x

def env(pts, n, t0=0.0, db=True):
    """piecewise-linear curve over absolute times; pts [(t, value)]"""
    ts = tt(n, t0); xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    v = np.interp(ts, xs, ys)
    return dbg(v) if db else v

def vari(x, rate, n_out, start=0.0):
    """varispeed read: rate scalar or per-output-sample array"""
    x = st(x)
    r = np.full(n_out, float(rate)) if np.isscalar(rate) else rate[:n_out]
    pos = start * SR + np.concatenate([[0], np.cumsum(r)[:-1]])
    idx = np.arange(len(x))
    out = np.zeros((n_out, 2))
    ok = pos < len(x) - 1
    for c in range(2): out[ok, c] = np.interp(pos[ok], idx, x[:, c])
    return out

def pitch(x, semis, n_out=None, start=0.0):
    r = 2 ** (semis / 12)
    if n_out is None: n_out = int((len(x) - start * SR) / r)
    if r > 1: x = filt(st(x), "low", min(20000, 0.45 * SR / r), 4)
    return vari(x, r, n_out, start)

def pan(x, p):
    """balance pan for a stereo/mono signal; p scalar or array in [-1, 1]"""
    x = st(x).copy()
    p = np.clip(p, -1, 1)
    th = (p + 1) * np.pi / 4
    gl = np.cos(th) * np.sqrt(2); gr = np.sin(th) * np.sqrt(2)
    x[:, 0] *= gl; x[:, 1] *= gr
    return x

def width(x, w):
    m = (x[:, 0] + x[:, 1]) / 2; s = (x[:, 0] - x[:, 1]) / 2 * w
    return np.stack([m + s, m - s], 1)

def tv(x, kind, freq, q=0.707, block=64):
    """time-varying RBJ biquad (lowpass/highpass/bandpass), freq per sample"""
    x = st(x); n = len(x); out = np.zeros_like(x)
    zi = np.zeros((2, 2))
    for i in range(0, n, block):
        f = float(np.clip(freq[min(n - 1, i + block // 2)], 20, 0.45 * SR))
        w0 = 2 * np.pi * f / SR; al = np.sin(w0) / (2 * q); c = np.cos(w0)
        if kind == "low": b = [(1 - c) / 2, 1 - c, (1 - c) / 2]
        elif kind == "high": b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]
        else: b = [al, 0, -al]
        a = [1 + al, -2 * c, 1 - al]
        b = np.array(b) / a[0]; a = np.array(a) / a[0]
        for ch in range(2):
            out[i:i + block, ch], zi[ch] = lfilter(b, a, x[i:i + block, ch], zi=zi[ch])
    return out

def noise(n, color="pink"):
    w = rng.standard_normal((n, 2))
    if color == "white": return w
    F = np.fft.rfft(w, axis=0); f = np.fft.rfftfreq(n, 1 / SR); f[0] = 1
    F /= np.sqrt(f)[:, None] if color == "pink" else f[:, None]
    y = np.fft.irfft(F, n, axis=0)
    return y / np.std(y)

def ir(dur, rt_lo, rt_hi, pre=0.02, er=6):
    n = T(dur); t = tt(n)
    lo = filt(noise(n, "white"), "low", 700) * np.exp(-6.9 * t / rt_lo)[:, None]
    hi = filt(noise(n, "white"), "high", 700) * np.exp(-6.9 * t / rt_hi)[:, None]
    h = lo + hi
    h[:T(pre)] = 0
    for k in range(er):   # a few early reflections
        d = T(pre * (0.4 + 0.25 * k)); h[d] += rng.uniform(-0.6, 0.6, 2)
    h = fade(h, 0.002, dur * 0.1)
    return h / np.sqrt(np.sum(h ** 2) / 2)

def verb(x, h, wet=0.3, dry=1.0):
    x = st(x)
    y = np.stack([fftconvolve(x[:, 0], h[:, 0]), fftconvolve(x[:, 1], h[:, 1])], 1)
    out = np.zeros((len(y), 2)); out[:len(x)] += x * dry
    return out + y * wet

def stretch(x, factor, n_out, grain=0.09, rate=1.0, jit=0.015):
    """granular time-stretch (freeze-like), rate scalar or callable(t_out)"""
    x = st(x); g = T(grain); hop = g // 4; win = np.hanning(g)[:, None]
    out = np.zeros((n_out + g, 2)); idx = np.arange(len(x))
    for k in range(0, n_out, hop):
        r = rate(k / SR) if callable(rate) else rate
        p0 = k / factor + rng.uniform(-jit, jit) * SR
        p0 = np.clip(p0, 0, len(x) - g * r - 2)
        pos = p0 + np.arange(g) * r
        gr = np.stack([np.interp(pos, idx, x[:, c]) for c in range(2)], 1)
        out[k:k + g] += gr * win
    return out[:n_out] / 1.5

def sine_glide(f, amp, phase0=0.0):
    ph = phase0 + 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * amp

def sub(t0, dur, f0, f1, a_ms=8, tau=0.5, gain=-12):
    n = T(dur); t = tt(n)
    f = f0 * (f1 / f0) ** (t / dur)
    e = np.minimum(1, t / (a_ms / 1000)) * np.exp(-t / tau)
    return t0, st(sine_glide(f, e) * dbg(gain))

def shepard(n, f_c, rate_oct, oct_n=7, spread=1.1, t0=0.0):
    t = tt(n)
    out = np.zeros(n)
    for k in range(oct_n):
        o = ((k + rate_oct * t) % oct_n) - oct_n / 2
        f = f_c * 2 ** o
        a = np.exp(-0.5 * (o / spread) ** 2)
        out += sine_glide(f, a, phase0=k * 1.3)
    return out / oct_n

def onset_slice(x, t, pre=0.004, post=0.25):
    s = x[max(0, T(t - pre)):T(t + post)]
    return fade(s, 0.002, post * 0.6)

# ------------------------------------------------------------- the buses
BUS = {k: np.zeros((N + SR * 6, 2)) for k in ["amb", "tone", "cosmic", "matter", "impact", "bh", "void", "worx", "fx"]}
def put(bus, t, x, g=0.0):
    x = st(x) * dbg(g); a = T(t)
    if a < 0: x = x[-a:]; a = 0
    BUS[bus][a:a + len(x)] += x[:len(BUS[bus]) - a]

# ------------------------------------------------------------- sources
fire = norm(load("blazing-fire", 20.0, 40.0))
boom = norm(load("explosion-boom-with-rumble", 0.0, 4.2), -14)
rock = norm(load("falling-rock", 1.2, 4.4))
stones = norm(load("stones-falling", 0.0, 2.95))
ice_boom = norm(load("studio-glacier-ice-breaking", 0.15, 2.2))
ice_groan = norm(load("studio-glacier-ice-breaking", 4.9, 9.0))
plane = norm(st(load("airplane-passing-by-ambience", 8.0, 15.5)))
sparks = norm(load("electric-sparks", 0.0, 11.8))
# the opening: the first seconds of a cinematic sci-fi ident (chrysalyn,
# Pixabay); a deep D (36.8 Hz, the fifth under the bed's A) with a hit at
# 0.020, a thump at 0.880, a riser from 2.2 and the reveal at 3.155
ident = load("scifi-ident", 0.0, 4.7)
ident = ident * dbg(-20 - rms_db(ident[:T(3.8)]))
# the collision: a real far implosion (freesound community). Its pressure
# builds from 0.045, the full weight is there by 0.12; an 8 s roll after
imp = load("implosion-far", 0.0, 8.3)
imp = imp * dbg(-14 - rms_db(imp[T(0.1):T(1.1)]))
# WORX: a sci-fi door (vadim_makes_sound, Pixabay): pressure hiss 0.02-1.0,
# the unlock at 1.00 (clunks 1.00 / 1.075 / 1.15), the hydraulic open 1.2-3.6
door = load("door-unlock-open", 0.0, 4.6)
door = door * dbg(-16 - rms_db(door[T(0.95):T(1.3)]))
DOOR_UNLOCK = 1.00

ROCK_ON = [1.34, 1.53, 2.05, 2.94, 3.15, 3.52, 3.81, 4.08]
STONE_ON = [0.37, 1.03, 1.59, 1.78, 2.40, 2.73]
rock_hits = [onset_slice(rock, t - 1.2, post=0.22) for t in ROCK_ON]
stone_hits = [onset_slice(stones, t, post=0.2) for t in STONE_ON]
ice_cracks = [onset_slice(ice_boom, t - 0.15, post=0.18) for t in [0.20, 0.29, 0.48, 0.56, 0.96, 1.12, 1.48]]
SPARK_ON = [0.11, 0.40, 0.69, 2.49, 3.07, 5.35, 8.93, 10.57]

H_BIG = ir(4.5, 4.0, 1.6, pre=0.04)
H_MED = ir(2.6, 2.2, 1.0, pre=0.025)
H_ROOM = ir(0.9, 0.7, 0.35, pre=0.008)

# ============================================================ 0.00 - 1.00
# SOLAR SYSTEM. The ident's hit lands on the first frame with the site's
# flash; its deep D carries the push-in; its thump IS the ignition (1.00);
# its riser climbs with the streaks and the shock ring; its reveal breaks
# with the white-out (1.77); then it breathes out into the nebula. It is
# re-cut (two inaudible splices where the waveform agrees with itself) so
# every one of its beats lands on a frame. Over it: a crystalline tail, the
# sun (slowed fire, an octave down) humming on A, far, growing.
def splice_at(x, lo, hi, jump, win=0.03):
    """the source time in lo..hi where x[t] and x[t + jump] agree best"""
    m = mono(x); w = T(win) // 2; best = (-2.0, lo)
    for t in np.arange(lo, hi, 0.0005):
        a = m[T(t) - w:T(t) + w]; b = m[T(t + jump) - w:T(t + jump) + w]
        c = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12)
        if c > best[0]: best = (c, t)
    return best[1], best[0]
def recut(x, pieces, xf):
    """pieces [(src_from, src_to)] played back to back; xf[k]: the linear
    crossfade into piece k (a cut that agrees less gets a longer one)"""
    total = sum(b - a for a, b in pieces)
    out = np.zeros((T(total + 0.2), 2)); o = 0.0
    for k, (a, b) in enumerate(pieces):
        fi = xf[k] if k else 0; fo = xf[k + 1] if k < len(pieces) - 1 else 0
        seg = x[T(a - fi / 2):T(b + fo / 2)].copy(); n = len(seg)
        if fi: seg[:T(fi)] *= np.linspace(0, 1, T(fi))[:, None]
        if fo: seg[n - T(fo):] *= np.linspace(1, 0, T(fo))[:, None]
        at = T(o - fi / 2)
        out[at:at + n] += seg
        o += b - a
    return out
HIT, THUMP, REVEAL = 0.020, 0.880, 3.155        # in the ident
ID0 = HIT - 0.005                                # the hit 5 ms after the first frame
J1 = -(1.00 - (THUMP - ID0))                     # repeat a breath: the thump on 1.00
J2 = (REVEAL - 1.77) - (THUMP - 1.00)            # skip ahead: the reveal on 1.77
s1, c1 = splice_at(ident, 0.50, 0.62, J1)
s2, c2 = splice_at(ident, 0.93, 1.16, J2, win=0.05)   # under the streaks
print("ident splices %.4f (r %.3f), %.4f (r %.3f)" % (s1, c1, s2, c2))
idn = recut(ident, [(ID0, s1), (s1 + J1, s2), (s2 + J2, 4.65)], [0, 0.03, 0.07])
n = len(idn)
idn = idn + filt(idn, "high", 170, 2) * 1.0             # its own upper partials forward (110/147/220/367 Hz)
idn = tv(idn, "high", np.interp(tt(n), [0, 2.05, 3.0], [18, 18, 300]), q=0.6)   # the breath out: the sub leaves first
idn *= env([(0, 0), (2.05, 0), (2.6, -7), (3.0, -18), (3.2, -70)], n)[:, None]   # it carries the nebula into the dive
put("amb", 0.0, idn, 4)
# its weight told again in harmonics, for laptops and phones
pres = filt(np.tanh(filt(idn, "bp", [55, 320]) * 4) / 4, "bp", [150, 2400])
put("amb", 0.0, width(pres, 0.8), 1)

n = T(1.25)
sun = pitch(fire, -12, n, start=3.0)
sun = tv(sun, "low", np.geomspace(700, 3200, n), q=0.6)
sun = width(sun, 0.7) * env([(0, -18), (0.6, -13), (0.93, -9), (0.95, -16), (1.0, -34), (1.25, -60)], n)[:, None]
put("amb", 0.0, fade(sun, 0.04, 0.05))
# a far planet drifts by on the left
n = T(1.3)
sat = pitch(plane, -7, n, start=3.2)
sat = filt(sat, "low", 650) * env([(0, -60), (0.45, -24), (0.85, -28), (1.3, -60)], n)[:, None]
put("matter", 0.0, pan(mono(sat), np.linspace(-0.35, -0.6, n)))
# foreshadow: the sun's core gathering (the boom reversed), cut before the flare
n = T(0.6)
gath = boom[::-1][-T(0.62):-T(0.02)]
gath = gath * env([(0, -40), (0.45, -16), (0.6, -9)], len(gath))[:, None]
put("impact", 0.95 - len(gath) / SR, fade(filt(gath, "high", 35), 0.1, 0.012), -13)
sp = filt(sparks[T(4.0):T(4.6)][::-1], "bp", [3000, 9000])
put("cosmic", 0.95 - len(sp) / SR, fade(filt(sp, "low", 7000) * env([(0, -50), (0.6, -20)], len(sp))[:, None], 0.1, 0.02), -15)

# ============================================================ 1.00 - 2.10
# COSMIC EXPANSION: a bloom, not an explosion. A soft deep swell, a burst
# of light, streaks tearing outward, the shock ring travelling at us and
# through us; the whole field widens; white holds bright and weightless.
t0, s = sub(1.0, 1.6, 48, 34, a_ms=60, tau=0.5, gain=-23); put("impact", t0, s)   # under the ident's thump
for k, so in enumerate([0.11, 0.40]):
    sh = onset_slice(sparks, so, post=0.15)
    put("cosmic", 1.0 + 0.012 * k, pan(filt(sh, "high", 2500), [-0.3, 0.3][k]), -10)
# streaks: fast bright tears flying outward, pairs diverging
for k, (ts, d) in enumerate([(1.04, 0.22), (1.10, 0.20), (1.17, 0.18), (1.22, 0.16)]):
    n = T(d); nz = noise(n, "pink")
    c = np.geomspace(2500, 9000, n) if k % 2 == 0 else np.geomspace(3500, 7000, n)
    w = tv(nz, "bp", c, q=1.6) * env([(0, -40), (d * 0.3, -18), (d, -50)], n)[:, None]
    side = 1 if k % 2 else -1
    put("cosmic", ts, pan(mono(w), np.linspace(0, 0.75 * side, n)), -13)
# the shock ring: a wideband wave opening as it nears, passing through at 1.75
n = T(1.0); nz = noise(n, "pink")
wave = tv(nz + 0.6 * pitch(fire, 7, n, start=8.0), "low", np.geomspace(400, 14000, n) , q=0.6)
wave = width(wave, 1.6) * env([(1.30, -60), (1.55, -30), (1.72, -18), (1.86, -15), (1.98, -17), (2.12, -45), (2.3, -70)], n, 1.30)[:, None]
put("cosmic", 1.30, tv(wave, "high", np.interp(tt(n, 1.3), [1.3, 1.8, 2.0], [40, 60, 380]), q=0.6))
# two planets thrown past
for ts, p0, p1 in [(1.38, -0.2, -0.85), (1.50, 0.2, 0.85)]:
    n = T(0.45)
    pb = vari(plane, np.linspace(1.6, 0.9, n), n, start=4.0)
    pb = filt(pb, "bp", [120, 2500]) * env([(0, -50), (0.18, -20), (0.45, -55)], n)[:, None]
    put("matter", ts, pan(mono(pb), np.linspace(p0, p1, n)), -2)
# dissolving: the wash breaks into particles
n = T(0.5); gr = np.zeros((n, 2))
for k in range(55):
    g = sparks[rng.integers(0, len(sparks) - T(0.04)):][:T(0.03)]
    a = rng.integers(0, n - len(g)); gr[a:a + len(g)] += fade(g, 0.004, 0.02) * (1 - a / n) ** 1.5 * rng.uniform(0.3, 1)
put("cosmic", 1.98, pan(filt(gr, "high", 3000), np.linspace(0, 0.2, n)), -8)

# ============================================================ 2.10 - 2.79
# PRIMORDIAL NEBULA: the breath. Fine particles, electromagnetic whistles,
# a glint for the newborn star. Almost no low end. Drifting right.
n = T(0.9)
dust = stretch(filt(sparks[T(2.0):T(4.0)], "bp", [2500, 9000]), 3.0, n, grain=0.05, rate=0.75)
dust = verb(dust, H_MED, wet=0.6)[:n] * env([(2.0, -60), (2.2, -30), (2.6, -29), (2.85, -40), (3.0, -70)], n, 2.0)[:, None]
put("cosmic", 2.0, pan(dust, np.linspace(0.0, 0.25, n)), -2)
# the dive into the disk: gravity returns
n = T(0.6)
dive = tv(noise(n, "pink"), "low", np.geomspace(900, 180, n), q=0.8) * env([(0, -50), (0.15, -24), (0.6, -45)], n)[:, None]
put("matter", 2.72, width(dive, 0.8))
put("matter", 2.74, filt(pitch(plane, -12, T(0.6), start=5.0), "low", 400) * env([(0, -50), (0.2, -22), (0.6, -50)], T(0.6))[:, None])

# ============================================================ 2.83 - 4.60
# PROTOPLANETARY DISK: rotation. A low body that swells and circles,
# rocks knocking where rocks are, two near misses past the camera.
n = T(2.25); t = tt(n, 2.75)
rot = pitch(fire, -12, n, start=6.0) * 0.8 + pitch(rock, -10, n, start=0.2) * 0.6
rot = filt(rot, "low", 1100)
ph = 2 * np.pi * 0.62 * (t - 2.75)
rot = pan(rot * (1 + 0.45 * np.sin(ph))[:, None], 0.32 * np.cos(ph))
rot *= env([(2.75, -50), (3.0, -10), (4.0, -10), (4.6, -10), (5.0, -16)], n, 2.75)[:, None]
put("matter", 2.75, rot)
# knocks: sparse, then denser (rocks around the disk), pitched heavy
times = list(np.sort(rng.uniform(2.95, 4.55, 14)))
for k, ts in enumerate(times):
    h = (stone_hits + rock_hits)[k % 14]
    put("matter", ts, pan(pitch(h, rng.uniform(-9, -4)), rng.uniform(-0.6, 0.6)), -14 + 4 * (ts - 2.9) / 1.6)
# near misses: 3.29 (a short graze), 3.50-3.88 (the big rock, out bottom-left)
for ts, d, r0, r1, p0, p1, g in [(3.18, 0.32, 1.25, 0.8, 0.35, -0.3, -9), (3.46, 0.55, 1.15, 0.62, -0.1, -0.75, -4)]:
    n = T(d)
    pb = vari(plane, np.linspace(r0, r1, n), n, start=4.5)
    pb = tv(pb, "low", np.interp(np.linspace(0, 1, n), [0, .6, 1], [500, 2600, 700]), q=0.7)
    pb = pb * env([(0, -45), (d * 0.68, -14), (d, -50)], n)[:, None]
    put("matter", ts, pan(mono(pb), np.linspace(p0, p1, n)), g)
    put("matter", ts + d * 0.68, pan(pitch(rock_hits[5], -7), p1 * 0.7), g - 6)
t0, s = sub(3.80, 0.9, 52, 40, a_ms=25, tau=0.25, gain=-20); put("impact", t0, s)

# ============================================================ 4.00 - 5.00
# ACCRETION: two masses, two tones beating; the beat quickens as they
# close; they fuse into one A at contact. The blue planet slides in right.
n = T(1.22); t = tt(n, 4.0)
d = np.interp(t, [4.0, 4.6, 4.95, 5.05, 5.22], [2.0, 4.0, 8.0, 0.0, 0.0])
f1 = A1 - d / 2; f2 = A1 + d / 2
e = env([(4.0, -60), (4.4, -22), (4.95, -15), (5.05, -14), (5.22, -40)], n, 4.0)
t1 = sine_glide(f1, e) + 0.35 * sine_glide(2 * f1, e); t2 = sine_glide(f2, e) + 0.35 * sine_glide(2 * f2, e)
pp = np.interp(t, [4.0, 5.0], [0.3, 0.0])
put("tone", 4.0, pan(t1, -pp) + pan(t2, pp), -7)
n = T(1.2)
blue = filt(pitch(plane, -10, n, start=6.0), "low", 520) * env([(0, -60), (0.55, -21), (1.0, -30), (1.2, -60)], n)[:, None]
put("matter", 3.95, pan(mono(blue), np.linspace(0.85, 0.45, n)))
n = T(1.0)
grind = filt(pitch(rock, -6, n, start=0.4), "bp", [90, 1400]) * env([(0, -50), (0.6, -22), (0.95, -15), (1.0, -30)], n)[:, None]
put("matter", 4.0, width(grind, 1.2), -3)
for k, ts in enumerate(np.sort(rng.uniform(4.3, 4.88, 9))):
    put("matter", ts, pan(pitch(rock_hits[k % 8], -5), rng.uniform(-0.5, 0.5)), -12)

# ============================================================ 5.00 - 6.40
# CONTACT (5.00): two planets meet. The real implosion: its pressure
# swells over the last frames of the approach, its full weight on contact,
# and its roll carries the whole breakup until the black hole bends it
# (it sits on the impact bus: redshifted and swallowed with the rest).
# Then the planet groans, the first lava cracks (5.38), the breakup:
# debris, quake, molten roar, faster cracking, and a held breath (6.33).
IMP_AT = 0.12                                    # the implosion's weight, in the file
# its roll steps back through the breakup to the held breath (6.33)
roll = imp * env([(0, 0), (5.45, 0), (6.0, -5), (6.36, -9), (6.42, -11), (9, -11)], len(imp), 5.0 - IMP_AT)[:, None]
put("impact", 5.0 - IMP_AT, filt(roll, "high", 24), 0)
# its weight told again in harmonics (laptop and phone speakers)
put("matter", 5.0 - IMP_AT, filt(np.tanh(filt(roll, "bp", [40, 260]) * 5) / 5, "bp", [180, 3000]), -9)
put("impact", 5.0 - IMP_AT, filt(pitch(roll, -5), "low", 170), -5)   # the mass under it
ib = filt(pitch(ice_boom, -5, start=0.75), "low", 900); ib = ib * env([(0, 0), (1.2, -8), (2.0, -30), (9, -90)], len(ib))[:, None]
put("impact", 5.0, ib, -5)
put("matter", 5.0, width(filt(pitch(rock, -8, T(1.0), start=0.05), "low", 1200) * env([(0, -4), (1.0, -26)], T(1.0))[:, None], 1.3), 3)
put("impact", 5.0, pan(filt(pitch(rock_hits[3], -12), "low", 900), 0), 2)
n = T(1.1)
groan = pitch(ice_groan, -7, n, start=0.3)
groan = filt(groan, "low", 1500) * env([(5.0, -40), (5.12, -14), (5.6, -14), (6.1, -20)], n, 5.0)[:, None]
put("matter", 5.02, width(groan, 1.1), -2)
crack_t = [5.38, 5.46, 5.55, 5.62, 5.71, 5.79, 5.86, 5.93, 5.99, 6.05, 6.10, 6.15, 6.20, 6.24, 6.28]
for k, ts in enumerate(crack_t):
    c = ice_cracks[k % len(ice_cracks)]
    put("impact", ts, pan(filt(pitch(c, rng.uniform(-1, 3)), "high", 160), rng.uniform(-0.45, 0.45)), -6 + 5 * k / len(crack_t))
    if k % 2 == 0:
        put("matter", ts + 0.005, pan(filt(rock_hits[k % 8], "high", 400), rng.uniform(-0.6, 0.6)), -12)
n = T(1.05)
hiss = pitch(sparks, -12, n, start=6.0)
put("cosmic", 5.36, filt(hiss, "bp", [700, 6000]) * env([(5.36, -50), (5.6, -24), (6.3, -13), (6.41, -20)], n, 5.36)[:, None])
n = T(1.0)
deb = width(pitch(stones, -3, n), 1.5) + width(pitch(rock, -4, n, start=0.5), 1.5)
put("matter", 5.42, deb * env([(5.42, -45), (5.8, -15), (6.3, -5), (6.42, -16)], n, 5.42)[:, None])
n = T(1.0)
quake = filt(pitch(boom, -7, n, start=0.6), "low", 220) + 0.6 * filt(pitch(fire, -12, n, start=10.0), "low", 300)
put("impact", 5.42, quake * env([(5.42, -40), (6.0, -19), (6.33, -14), (6.40, -22)], n, 5.42)[:, None], -4)
n = T(0.95)
molt = filt(pitch(fire, -5, n, start=12.0), "bp", [180, 2600])
put("matter", 5.45, width(molt, 1.3) * env([(5.45, -50), (5.9, -16), (6.30, -6), (6.40, -18)], n, 5.45)[:, None])
# the held breath: an inward pull for 90 ms, from both sides to the centre
n = T(0.18)
inh = (boom[:T(0.18)][::-1] * 0.5 + filt(fire[:T(0.18)], "high", 600)[::-1])
inh = width(inh, 0.6) * env([(0, -40), (0.17, -12)], n)[:, None]
put("impact", 6.40 - 0.18, fade(inh, 0.03, 0.006))

# ============================================================ 6.40 - 6.96
# THE ERUPTION. transient / body / sub / molten / debris / tail.
put("impact", 6.40, filt(rock_hits[3], "high", 1800), 3)
put("impact", 6.402, filt(ice_cracks[2], "high", 1500), 1)
nz = filt(noise(T(0.012), "white"), "high", 3000) * np.linspace(1, 0, T(0.012))[:, None]
put("impact", 6.40, nz, -14)
put("impact", 6.40, filt(boom, "high", 28), -12)
# the planets give way: the implosion strikes again, harder, a tone lower
strike = fade(pitch(imp, -2, start=0.125), 0.003, 1.0)
put("impact", 6.40, filt(strike, "high", 24), 2)
put("matter", 6.40, filt(np.tanh(filt(strike, "bp", [40, 260]) * 5) / 5, "bp", [180, 3000]), -8)
put("impact", 6.40, filt(ice_boom[T(0.8):], "low", 1200), -3)
put("matter", 6.40, width(filt(pitch(rock, -3, start=0.05), "bp", [70, 3000]), 1.5), -2)
t0, s = sub(6.40, 2.4, 44, 27, a_ms=6, tau=0.8, gain=-12); put("impact", t0, s)
n = T(1.0)
roar = filt(fire[T(2.0):T(2.0) + n], "bp", [150, 3200]) * env([(0, -40), (0.05, -8), (0.25, -10), (1.0, -26)], n)[:, None]
put("matter", 6.40, width(roar, 1.4), 1)
put("cosmic", 6.42, filt(pitch(sparks, -12, T(0.9), start=3.0), "bp", [600, 5000]) * env([(0, -40), (0.08, -16), (0.9, -40)], T(0.9))[:, None])
n = T(1.0)
rain = width(pitch(stones, -1, n), 1.7) * env([(0, -40), (0.1, -14), (0.5, -18), (1.0, -40)], n)[:, None]
put("matter", 6.45, rain)
# the tail: the size of it, a long rolling rumble in a huge space
tail = verb(filt(boom[T(0.2):], "low", 700), H_BIG, wet=0.9, dry=0.2)
put("impact", 6.42, tail, -14)

# ============================================================ 6.62 - 7.92
# BLACK HOLE. The collision's energy is captured and pulled backward into
# the gulp (6.96); then everything is redshifted (an octave down), narrowed
# to the centre, its highs and then mids taken; a fall that never ends.
n = T(0.36)
back = (filt(fire[T(5.0):T(5.0) + n], "bp", [150, 3000]) + 0.7 * filt(boom[:n], "low", 400))[::-1]
back = width(back, 1.2) * env([(0, -40), (0.3, -12), (0.35, -9)], n)[:, None]
put("bh", 6.96 - 0.36, fade(back, 0.05, 0.004))
gulp = filt(pitch(boom, -7, T(0.4)), "low", 160) * env([(0, -2), (0.4, -30)], T(0.4))[:, None]
put("bh", 6.96, fade(filt(gulp, "high", 30), 0.003, 0.15), -8)
# the frozen disk: the eruption's debris held, circling, redshifting
n = T(1.0); src = filt(fire[T(14.0):T(16.0)], "bp", [200, 4000]) * 0.6 + filt(stones, "high", 300)[:T(2.0)] * 0.4
frozen = stretch(src, 4.0, n, grain=0.11, rate=lambda tq: 2 ** (-tq / 0.95))
tq = tt(n)
frozen = pan(frozen, 0.25 * np.sin(2 * np.pi * 1.1 * tq))
put("bh", 6.92, frozen * env([(6.92, -50), (7.05, -16), (7.5, -21), (7.88, -27)], n, 6.92)[:, None])
# the endless fall: a descending tone on A
n = T(1.0)
sh = shepard(n, A1 * 4, -0.9, oct_n=7, spread=1.0)
put("tone", 6.92, st(sh) * env([(6.92, -60), (7.1, -25), (7.6, -23), (7.88, -28)], n, 6.92)[:, None])
# the pull: air streaming into the centre
n = T(1.0)
pull = pitch(plane, -12, n, start=2.0)[::-1] * 0.7 + tv(noise(n, "pink"), "bp", np.geomspace(1800, 250, n), q=0.9)
put("bh", 6.92, pull * env([(6.92, -50), (7.2, -22), (7.7, -20), (7.88, -24)], n, 6.92)[:, None])
# ear pressure as the camera falls in
n = T(0.7); t = tt(n)
pres = sine_glide(np.geomspace(64, 58, n), 1) + 0.4 * sine_glide(np.geomspace(128, 116, n), 1)
put("bh", 7.2, st(pres) * env([(0, -60), (0.45, -22), (0.68, -24)], n)[:, None])
# the redshift of the collision itself (its bus is bent after the mix)

# ============================================================ 7.92 - 8.46
# THE VOID: only a remnant felt, not heard, then true silence.
n = T(0.32)
put("void", 7.90, fade(st(sine_glide(np.full(n, 25.0), 1)) * env([(0, -48), (0.3, -70)], n)[:, None], 0.02, 0.08))

# ============================================================ WORX (8.46 +)
# IGNITION LOCK. One point, mono: a tight weight, the spark, the whole
# collision squeezed into 120 ms. Four letters snap into place, out from
# the centre; the lock; the tone on A acquires its signal and locks pure
# as the light sweeps across; then it lets the world back in.
c0 = CUT
t0, s = sub(c0, 0.5, 46, 38, a_ms=2, tau=0.12, gain=-9); put("worx", t0, s)
# THE DOOR. Out of the black hole's silence the pressure builds (its hiss
# rises from 7.95), the unlock lands on the cut with the card, and the
# hydraulics open as the letters stream out and the light sweeps.
d0 = c0 - DOOR_UNLOCK
dr = door * env([(d0, -90), (7.95, -60), (8.2, -14), (c0 - 0.02, -4), (c0, 0)], len(door), d0)[:, None]
dr[:T(7.94 - d0)] = 0
put("worx", d0, verb(dr, H_ROOM, wet=0.15)[:len(dr)], 0)
n = T(0.32)
stream = filt(sparks[T(7.0):T(7.0) + n], "high", 4000)
stream = width(stream, 1.0) * env([(0, -45), (0.12, -26), (0.32, -50)], n)[:, None]
put("worx", c0 + 0.02, pan(filt(stream, "low", 9000), 0), -11)
# the tone on A: acquiring, then locked (at the light sweep, +0.55)
n = T(3.9); t = tt(n)
lock = np.clip((t - 0.10) / 0.45, 0, 1)
wob = (1 - lock) * (0.018 * np.sin(2 * np.pi * 9 * t) + 0.01 * np.sin(2 * np.pi * 23 * t))
amp = env([(0, -60), (0.12, -14), (0.55, -11), (1.25, -12), (2.4, -20), (3.9, -60)], n)
PART = [(2, 0.35), (3, 0.2), (4, 0.5), (6, 0.45), (8, 0.6), (12, 0.3), (16, 0.18)]
tone = np.zeros(n)
for h, a in PART:
    tone += sine_glide(A1 * h * (1 + wob * (h / 4)), a, phase0=h)
flick = 1 - 0.35 * (1 - lock) * (np.sin(2 * np.pi * 31 * t) > 0.6)
tone *= amp * flick
tone2 = np.stack([tone, np.roll(tone, 37)], 1)
put("worx", c0 + 0.08, verb(width(tone2, 0.45), H_MED, wet=0.22), -7)
# the shimmer riding the sweep (0.55 -> 1.95, its ease), left to right
n = T(1.6); t = tt(n)
def ease(x):  # cubic-bezier(0.135, 0.9, 0.15, 1), approximated
    return 1 - (1 - np.clip(x, 0, 1)) ** 4
sx = ease(t / 1.4)
# (no chimes: air rides the sweep instead, in the sweeteners below)


# ============================================================ SWEETENERS
# The trailer layer: every camera move gets its air, every hit its
# reverse swell, its sub and its tail; braams on the two reveals; a
# heartbeat that quickens into the collision; a logo hit on WORX.
# All synthesised or cut from the licensed files above. No chimes.
def whoosh(dur, peak=0.6, f0=250, f1=4500, p0=-0.7, p1=0.7, q=1.1, body=0.5, w=1.3):
    """a pass-by: brighter and louder as it nears (peak), its air panned across"""
    n = T(dur); u = np.linspace(0, 1, n)
    near = np.where(u < peak, (u / peak) ** 2.0, ((1 - u) / (1 - peak + 1e-9)) ** 1.5)
    fc = f0 + (f1 - f0) * near
    y = tv(noise(n, "pink"), "bp", fc, q=q) + body * tv(noise(n, "pink"), "low", fc * 0.6, q=0.7)
    y = width(y, w) * (near ** 1.2)[:, None]
    y = pan(y, p0 + (p1 - p0) * (0.5 - 0.5 * np.cos(np.pi * u)))
    return fade(y / (np.abs(y).max() + 1e-9) * 0.5, 0.003, 0.02)
def rev_swell(hit, dur, h=H_BIG):
    """the hit's own reverb, reversed: it swells and stops dead on the hit"""
    tail = verb(hit, h, wet=1.0, dry=0.0)[::-1]
    tail = tail[-T(dur):]
    tail = tail * (np.linspace(0, 1, len(tail)) ** 2.2)[:, None]
    return fade(tail / (np.abs(tail).max() + 1e-9) * 0.5, 0.05, 0.003)
def put_before(bus, t_hit, x, g=0.0): put(bus, t_hit - len(x) / SR, x, g)
def saw(f, n, kmax_hz=6000):
    t = tt(n); y = np.zeros(n); k = 1
    while f * k < kmax_hz:
        y += np.sin(2 * np.pi * f * k * t + k * 0.7) / k; k += 1
    return y
def braam(dur, root, lp_peak=2400, open_t=0.06, decay=0.9):
    """the trailer brass: a detuned power chord through an opening filter"""
    n = T(dur); L = np.zeros(n); R = np.zeros(n)
    for ratio, a in [(1, 1.0), (1.5, 0.7), (2, 0.55), (0.5, 0.6)]:
        for det, side in [(-0.11, 0), (0.0, 2), (0.12, 1)]:
            v = saw(root * ratio * 2 ** (det / 12), n) * a
            if side in (0, 2): L += v
            if side in (1, 2): R += v
    y = np.stack([L, R], 1)
    tq = tt(n)
    fc = np.interp(tq, [0, open_t, open_t + 0.35, dur], [140, lp_peak, lp_peak * 0.45, 260])
    y = tv(tv(y, "low", fc, q=0.9), "low", fc * 1.2, q=0.6)
    y = np.tanh(y / (np.abs(y).max() + 1e-9) * 2.2)
    e = np.minimum(1, tq / 0.012) * np.exp(-tq / decay)
    y = y * e[:, None]
    return fade(y / (np.abs(y).max() + 1e-9) * 0.5, 0.002, 0.15)
def riser(dur, f0=400, f1=9000, curve=2.6):
    n = T(dur); u = np.linspace(0, 1, n)
    y = tv(noise(n, "white"), "bp", f0 * (f1 / f0) ** u, q=1.4) + 0.5 * tv(noise(n, "pink"), "high", f0 * (f1 / f0) ** u * 0.5, q=0.7)
    y = width(y, 1.4) * (u ** curve)[:, None]
    return fade(y / (np.abs(y).max() + 1e-9) * 0.5, 0.05, 0.004)
def hit_body(dur=1.6, lp=320):
    """the implosion's attack as a short, heavy hit"""
    x = fade(imp[T(0.11):T(0.11 + dur)], 0.002, dur * 0.6)
    return filt(x, "low", lp, 2)
def crack(k=2, hp=1400):
    a = filt(ice_cracks[k], "high", hp); r = filt(rock_hits[3], "high", hp * 0.6) * 0.7
    y = np.zeros((max(len(a), len(r)), 2)); y[:len(a)] += a; y[:len(r)] += r
    return y

D2 = A1 * 4 / 3            # 73.67 Hz: the ident's D, an octave up

# 0.00 THE OPEN: the first frame hits like a trailer card
t0, s = sub(0.0, 1.4, 62, 28, a_ms=3, tau=0.55, gain=-13); put("fx", t0, s)
put("fx", 0.0, verb(hit_body(1.4, 260), H_BIG, wet=0.35), -11)
put("fx", 0.0, verb(whoosh(0.7, peak=0.04, f0=200, f1=2200, p0=0, p1=0, w=1.8), H_BIG, wet=0.5)[:T(1.6)], -16)
# 0.05-0.98 the push-in: air gathering at the camera, the sun's heat growing
put("fx", 0.04, whoosh(0.96, peak=0.97, f0=180, f1=3200, p0=0, p1=0, q=0.9, w=1.5), -17)
# 1.00 IGNITION: reverse swell into it, then crack / sub / body / tail
ign = hit_body(1.2, 500); cr = crack(2); ign[:len(cr)] += cr * 0.6
put_before("fx", 0.998, rev_swell(ign, 0.55), -13)
put("fx", 1.0, filt(crack(2), "high", 1600), -6)
t0, s = sub(1.0, 1.3, 55, 26, a_ms=2, tau=0.45, gain=-13); put("fx", t0, s)
put("fx", 1.0, verb(hit_body(1.2, 420), H_BIG, wet=0.6)[:T(2.4)], -12)
# 1.04-1.29 the streaks: four fast pass-bys tearing outward
for k, (ts, d) in enumerate([(1.02, 0.34), (1.08, 0.32), (1.15, 0.30), (1.21, 0.28)]):
    side = 1 if k % 2 else -1
    put("fx", ts, whoosh(d, peak=0.35, f0=900, f1=7500, p0=0.1 * side, p1=0.95 * side, q=1.5, body=0.2), -15 - k)
# 1.30-1.77 the shock ring coming at us: riser + reverse swell, stop dead
put_before("fx", 1.765, riser(0.5, 500, 10000), -15)
REVEAL_HIT = braam(1.6, D2 / 2, lp_peak=2600)
put_before("fx", 1.77, rev_swell(REVEAL_HIT[:T(0.6)], 0.45), -14)
# 1.77 THE REVEAL: braam, sub, the wave blowing through us left to right
put("fx", 1.77, verb(REVEAL_HIT, H_BIG, wet=0.35)[:T(3.0)], -11)
t0, s = sub(1.77, 1.6, 48, 24, a_ms=4, tau=0.6, gain=-11); put("fx", t0, s)
put("fx", 1.72, whoosh(0.6, peak=0.18, f0=400, f1=8000, p0=-0.9, p1=0.9, q=0.8, w=1.7), -12)
# 2.06 dissolving into the nebula: a long soft breath through
put("fx", 2.0, verb(whoosh(0.8, peak=0.35, f0=300, f1=2600, p0=0.2, p1=-0.3, q=0.8), H_BIG, wet=0.7)[:T(2.2)], -21)
# 2.72 THE DIVE: falling into the disk, a down-sweep and a landing at 3.0
dv = whoosh(0.7, peak=0.4, f0=180, f1=3800, p0=0, p1=0, q=1.0, w=1.6)
dv = tv(dv, "low", np.geomspace(9000, 500, len(dv)), q=0.7)
put("fx", 2.68, dv, -11)
t0, s = sub(2.98, 0.9, 50, 32, a_ms=10, tau=0.3, gain=-15); put("fx", t0, s)
# 3.18 and 3.46 the rocks past the lens: real air with weight
put("fx", 3.12, whoosh(0.42, peak=0.62, f0=160, f1=2600, p0=0.6, p1=-0.4, q=0.9, body=0.9), -10)
put("fx", 3.40, whoosh(0.62, peak=0.66, f0=120, f1=2200, p0=-0.05, p1=-0.95, q=0.9, body=1.0), -7)
t0, s = sub(3.81, 0.5, 70, 40, a_ms=3, tau=0.12, gain=-15); put("fx", t0, s)
# 4.00-4.97 CONVERGENCE: a heartbeat that quickens, a riser, then nothing
for k, tb in enumerate([4.02, 4.30, 4.52, 4.68, 4.79, 4.87, 4.93]):
    t0, s = sub(tb, 0.35, 58, 40, a_ms=4, tau=0.09, gain=-17 + 1.2 * k); put("fx", t0, s)
    put("fx", tb, filt(hit_body(0.25, 180), "low", 180), -22 + 1.2 * k)
put_before("fx", 4.955, riser(0.95, 300, 8000, curve=3.2), -15)
n = T(0.95)
gr = stretch(filt(fire[T(4.0):T(7.0)], "bp", [300, 5000]), 3.0, n, grain=0.06, rate=lambda tq: 0.7 * 2 ** (tq / 0.55))
put_before("fx", 4.955, fade(gr * (np.linspace(0, 1, n) ** 2.5)[:, None], 0.1, 0.004), -12)
# 5.00 CONTACT sweeteners (the implosion stays the star)
put("fx", 5.0, crack(1, 1200), -7)
nz = filt(noise(T(0.02), "white"), "high", 2500) * np.linspace(1, 0, T(0.02))[:, None]
put("fx", 5.0, nz, -16)
# 5.40-6.30 breakup: debris flying past
for ts, p0, p1 in [(5.45, -0.3, -0.9), (5.72, 0.3, 0.9), (5.98, -0.1, 0.8)]:
    put("fx", ts, whoosh(0.4, peak=0.5, f0=300, f1=4500, p0=p0, p1=p1, q=1.2, body=0.4), -17)
# 6.40 ERUPTION: the suck back, then a lower braam that the black hole will bend
erupt = braam(1.4, A1, lp_peak=2000, decay=0.7)
put_before("fx", 6.395, rev_swell(erupt[:T(0.5)] + 0.5 * hit_body(0.5, 400)[:T(0.5)], 0.4), -13)
put("impact", 6.40, verb(erupt, H_BIG, wet=0.3)[:T(2.0)], -12)
put("matter", 6.40, whoosh(0.9, peak=0.08, f0=300, f1=6000, p0=0, p1=0, q=0.7, w=1.9), -12)
# 6.96 THE BLACK HOLE: a gravity drop, and a heartbeat slowing as we fall
t0, s = sub(6.96, 1.0, 44, 18, a_ms=8, tau=0.7, gain=-12); put("bh", t0, s)
for k, tb in enumerate([7.12, 7.40, 7.74]):
    t0, s = sub(tb, 0.4, 50 - 5 * k, 30, a_ms=6, tau=0.14, gain=-16 - 3 * k); put("bh", tb, s)
put("bh", 6.94, whoosh(0.96, peak=0.9, f0=2500, f1=200, p0=0.3, p1=0.0, q=0.9)[::-1], -17)
# WORX: the logo hit on the unlock, the letters thrown out, air on the sweep
t0, s = sub(c0, 1.6, 52, 27, a_ms=3, tau=0.5, gain=-11); put("worx", t0, s)
dh = door[T(DOOR_UNLOCK):T(DOOR_UNLOCK + 0.25)]
put("worx", c0, verb(fade(dh, 0.002, 0.1), H_BIG, wet=1.0, dry=0.0)[:T(3.0)], -12)
for side in (-1, 1):
    put("worx", c0 + 0.02, whoosh(0.55, peak=0.3, f0=600, f1=6000, p0=0.05 * side, p1=0.6 * side, q=1.3, body=0.2), -19)
sw = whoosh(1.5, peak=0.3, f0=500, f1=5500, p0=-0.6, p1=0.6, q=1.0, body=0.3)
put("worx", c0 + 0.55, verb(sw, H_MED, wet=0.4)[:T(2.2)], -22)

# ================================================================ the mix
def bus(k): return BUS[k][:N].copy()
mixed = {k: bus(k) for k in BUS}
# REDSHIFT: the physical world is bent down and inward from 6.62: the
# collision's buses are re-read slower and slower (an octave by 7.9)
def bend(x, t_from, t_to, oct_total):
    a, b = T(t_from), T(t_to)
    seg = x[a:b + T(0.5)]
    nn = b - a
    r = 2 ** (-oct_total * (np.arange(nn) / nn) ** 1.3)
    y = vari(seg, r, nn)
    out = x.copy(); out[a:b] = y; out[b:] = 0
    return out
cons = env([(0, 0), (6.62, 0), (7.0, -3), (7.5, -9), (7.92, -16)], N)[:, None]
for k in ["impact", "matter", "cosmic"]:
    mixed[k] = bend(mixed[k], 6.62, 7.92, 1.0) * cons
phys = mixed["amb"] + mixed["tone"] + mixed["cosmic"] + mixed["matter"] + mixed["impact"] + mixed["bh"] + mixed["fx"]
t_all = tt(N)
# black hole: narrow to the centre, take the highs then the mids
w = np.interp(t_all, [0, 6.9, 7.4, 7.75, 7.88, 7.92], [1, 1, 0.5, 0.15, 0.0, 0.0])
lp = np.interp(t_all, [0, 6.85, 7.4, 7.7, 7.86, 7.92], [20000, 18000, 4000, 1400, 600, 300])
lp_part = tv(phys, "low", lp, q=0.6)
mix_bh = np.where((t_all > 6.8)[:, None], lp_part, phys)
xf = np.clip((t_all - 6.78) / 0.15, 0, 1)[:, None]
phys = phys * (1 - xf) + mix_bh * xf
phys = width(phys, w)
# the last light slides bottom-right: the remainder follows it
phys = pan(phys, np.interp(t_all, [7.70, 7.88], [0, 0.25]))
# the swallow: a fast inward suck to nothing, ending on silence at 7.92
g = np.interp(t_all, [7.80, 7.88, 7.915, 7.92], [1.0, 1.25, 0.05, 0.0])
g[t_all >= 7.92] = 0
phys *= g[:, None]
suck = filt(noise(T(0.09), "pink"), "bp", [300, 3000])[::-1] * np.linspace(0, 1, T(0.09))[:, None] ** 3
suck[-T(0.006):] *= np.linspace(1, 0, T(0.006))[:, None]
phys[T(7.92) - len(suck):T(7.92)] += mono(suck)[:, None] * dbg(-20)

out = phys + mixed["void"] + mixed["worx"]
# phones: the low end is told again an octave up, as harmonics
low = filt(out, "low", 110, 4)
harm = filt(np.tanh(low * 6) / 6, "bp", [120, 420], 2)
out = out + harm * dbg(float(sys.argv[2]) if len(sys.argv) > 2 else -2.0)
out = filt(out, "high", 22, 2)
out[T(7.92):T(CUT)] = filt(mixed["void"] + mixed["worx"], "high", 18, 2)[T(7.92):T(CUT)]   # the void: only the door's pressure

# headroom: a look-ahead peak limiter at -1.2 dBTP (4x oversampled peaks)
TRIM = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
out *= dbg(TRIM)
from scipy.ndimage import minimum_filter1d
la = T(0.003)
pk = np.abs(resample_poly(out, 4, 1, axis=0)).max(1)[:4 * len(out)].reshape(-1, 4).max(1)
need = np.minimum(1, dbg(-1.2) / np.maximum(pk, 1e-9))
gmin = minimum_filter1d(need, size=2 * la + 1)
gr = np.empty_like(gmin); a_rel = np.exp(-1 / (0.06 * SR)); cur = 1.0
for i in range(len(gmin)):
    cur = gmin[i] if gmin[i] < cur else gmin[i] + (cur - gmin[i]) * a_rel
    gr[i] = cur
out = out * gr[:, None]
print("limiter max reduction %.1f dB" % (20 * np.log10(gr.min())))
grd = 20 * np.log10(gr); ev = []
i = 0
while i < len(grd):
    if grd[i] < -2:
        j = i
        while j < len(grd) and grd[j] < -0.5: j += 1
        ev.append((i / SR, (j - i) / SR, grd[i:j].min())); i = j
    else: i += 1
print("GR events:", ", ".join("%.3f(%dms,%.1fdB)" % (a, b * 1000, c) for a, b, c in ev))
out = fade(out, 0.015, 0.4)
wavfile.write(os.path.join(HERE, "hero-score.wav"), SR, out.astype(np.float32))
np.save(os.path.join(HERE, "stems.npy"), np.stack([mixed[k][:N].mean(1) for k in ["amb", "tone", "cosmic", "matter", "impact", "bh", "worx"]]))
print("rendered", out.shape[0] / SR, "s")
