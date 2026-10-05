"""MOTHERSHIP: the Home page's master bed, rendered offline.

Something the size of a city hangs over the Earth and fills the sky. Two
parts, at one steady level:
  the hum            the ship's field: two deep hums on D (the ident's
                     key), a third on A (the bed's old hum, the key the
                     Services piano is tuned to), and a slow "wub" throb
  the megastructure  its body: hull groans and creaks (metal pitched down
                     one to two octaves into a huge space), distant clanks,
                     the sky rumbling and the air pressed down under it

Sources: Pixabay downloads in src/ (48 kHz WAV, gitignored).
Output: a seamless 72 s loop, loudness-matched to the old bed (-19.2 LUFS)
so the user's 15% bed level still holds.
  python3 bed.py   ->  mothership.wav  (+ preview mp3 via ffmpeg)
"""
import numpy as np, os
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve, lfilter

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src")
LOOP = 72.0
XF = 8.0                                   # the loop's own seam crossfade
N = int((LOOP + XF) * SR)
rng = np.random.default_rng(11)

D1 = 55.25 * 2 ** (-7 / 12) * 1.0          # 36.87 Hz (equal-tempered D under A = 442)
A1 = 55.25

def T(t): return int(round(t * SR))
def dbg(d): return 10 ** (d / 20)
def rms_db(x): return 10 * np.log10(np.mean(np.asarray(x) ** 2) + 1e-20)
def st(m): return np.stack([m, m], 1) if m.ndim == 1 else m
def mono(x): return x.mean(1) if x.ndim == 2 else x
def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, "band" if kind == "bp" else kind, fs=SR, output="sos"), x, axis=0)
def norm(x, target=-20.0): return x * dbg(target - rms_db(x))
def load(name):
    sr, x = wavfile.read(os.path.join(SRC, name + ".wav")); return x.astype(np.float64)
def pan(x, p):
    x = st(x).copy(); th = (np.clip(p, -1, 1) + 1) * np.pi / 4
    x[:, 0] *= np.cos(th) * np.sqrt(2); x[:, 1] *= np.sin(th) * np.sqrt(2); return x
def width(x, w):
    m = (x[:, 0] + x[:, 1]) / 2; s = (x[:, 0] - x[:, 1]) / 2 * w
    return np.stack([m + s, m - s], 1)
def fade(x, a, b):
    x = x.copy(); n = len(x)
    if a: x[:T(a)] *= np.sin(np.linspace(0, np.pi / 2, T(a)))[:, None] ** 2
    if b: x[n - T(b):] *= np.cos(np.linspace(0, np.pi / 2, T(b)))[:, None] ** 2
    return x

def pitch(x, semis):
    """varispeed: down is slower and bigger, as a real object would be"""
    x = st(x); r = 2 ** (semis / 12)
    if r > 1: x = filt(x, "low", 0.45 * SR / r, 4)
    pos = np.arange(0, len(x) - 1, r); idx = np.arange(len(x))
    return np.stack([np.interp(pos, idx, x[:, c]) for c in range(2)], 1)

def endless(x, n, xf=4.0, chunk=(9.0, 16.0)):
    """a steady source made as long as needed: chunks from different places
    in it, joined by long equal-power crossfades (no audible repeat)"""
    x = st(x); out = np.zeros((n + T(xf) * 2, 2)); o = 0
    while o < n:
        L = min(len(x) - T(xf) - 1, T(rng.uniform(*chunk)) + T(xf))
        a = rng.integers(0, max(1, len(x) - L))
        seg = x[a:a + L].copy()
        k = T(xf)
        seg[:k] *= np.sin(np.linspace(0, np.pi / 2, k))[:, None]
        seg[-k:] *= np.cos(np.linspace(0, np.pi / 2, k))[:, None]
        out[o:o + L] += seg[:len(out) - o]
        o += L - k
    return out[:n]

def ir(dur, rt_lo, rt_hi, pre=0.06):
    """a huge space: the sky under the ship (decorrelated L/R)"""
    n = T(dur); t = np.arange(n) / SR
    w = rng.standard_normal((n, 2))
    h = filt(w, "low", 600) * np.exp(-6.9 * t / rt_lo)[:, None] + filt(w, "high", 600) * np.exp(-6.9 * t / rt_hi)[:, None]
    h[:T(pre)] = 0
    h = fade(h, 0.0, dur * 0.15)
    return h / np.sqrt(np.sum(h ** 2) / 2)
def verb(x, h, wet, dry=1.0):
    x = st(x)
    y = np.stack([fftconvolve(x[:, c], h[:, c]) for c in range(2)], 1)
    out = y * wet; out[:len(x)] += x * dry; return out

def pink(n):
    w = rng.standard_normal((n, 2)); F = np.fft.rfft(w, axis=0); f = np.fft.rfftfreq(n, 1 / SR); f[0] = 1
    y = np.fft.irfft(F / np.sqrt(f)[:, None], n, axis=0); return y / np.std(y)

BUS = np.zeros((N + SR * 12, 2))
def put(t, x, g=0.0):
    a = T(t); x = st(x) * dbg(g); BUS[a:a + len(x)] += x[:len(BUS) - a]

t_all = np.arange(N) / SR
SKY = ir(9.0, 7.5, 3.0)

# ================================================================ THE HUM
# the ship's core: the inharmonic spaceship hum (39.6 Hz cluster -> D)
h1 = norm(endless(pitch(load("spaceship-hum-low-frequency"), 12 * np.log2(D1 / 39.62)), N, xf=5.0), -20)
put(0, h1, 0)
# the deep tone under it (44.1 Hz -> D): the weight
h2 = norm(endless(pitch(load("ambient-spacecraft-hum"), 12 * np.log2(D1 / 44.12)), N, xf=4.0), -20)
# the throb: the field breathing, a slow "wub" that drifts in rate
rate = 0.27 + 0.05 * np.sin(2 * np.pi * t_all / 23.0)
wub = 1 + 0.35 * np.sin(2 * np.pi * np.cumsum(rate) / SR)
put(0, h2 * wub[:, None], 3)
# the third hum on A (47.6 Hz -> A): the bed's old key, a fifth above D
ih = load("industrial-hum"); ih = st(mono(ih))      # its stereo is out of phase: fold first
h3 = norm(endless(pitch(ih, 12 * np.log2(A1 / 47.62)), N, xf=3.0, chunk=(5.0, 7.5)), -20)
put(0, width(verb(h3, SKY, 0.25)[:N], 1.0), -9)
# the field itself: A and its octave, each a slowly beating pair (the wub, in tune)
f = np.zeros(N)
for fr, a, beat in [(A1, 1.0, 0.31), (A1 * 2, 0.45, 0.19), (D1 * 2, 0.5, 0.23)]:
    f += a * (np.sin(2 * np.pi * fr * t_all) + np.sin(2 * np.pi * (fr + beat) * t_all + 1.0))
put(0, st(f) * dbg(rms_db(h1) - rms_db(f)), -7)

# ======================================================= THE MEGASTRUCTURE
# the sky: thunder rolls slowed into one endless pressure, the air under it
th = load("distant-thunder")
sky = endless(pitch(filt(th, "low", 900), -5), N, xf=6.0, chunk=(10, 18))
# even it out: the sky never stops (a slow leveller on the source alone)
e = np.sqrt(filt(mono(sky) ** 2, "low", 0.4, 1).clip(1e-12)); sky = sky / (e / np.median(e)).clip(0.35, 3)[:, None] ** 0.8
put(0, width(norm(sky, -20), 1.3), -7)
rum = endless(pitch(load("low-rumble"), -7), N, xf=2.5, chunk=(4.0, 6.0))
put(0, norm(filt(rum, "low", 500), -20), -12)
wind = endless(pitch(load("winter-wind"), -7), N, xf=4.0, chunk=(8, 12))
wind = filt(filt(wind, "high", 140), "low", 1800)
put(0, width(norm(wind, -20), 1.5), -15)
# the ship shifting: a spectral glide slowed an octave, far up in the sky
gl = pitch(load("cinematic-designed-sci-fi-whoosh-spectra"), -12)
gl = filt(filt(gl, "low", 1500), "high", 50)
for t0, p in [(4.0, -0.5), (40.0, 0.5)]:
    seg = fade(norm(gl[T(5):T(5) + T(30)], -20), 6, 8)
    put(t0, pan(verb(seg, SKY, 0.6)[:T(36)], p), -15)

# hull groans: real metal under stress, slowed into something enormous
hinge = load("groaning-metal-hinge"); creak = load("creaking")
bear = load("metal-bearing-rolling-spinning-start-to-")
def groan(src, a, b, semis, lp):
    g = src[T(a):T(b)]
    g = pitch(g, semis); g = filt(filt(g, "low", lp), "high", 45)
    return fade(norm(g, -20), 0.4, 0.8)
GROANS = [
    (hinge, 0.0, 3.5, -17, 1600), (hinge, 3.5, 7.5, -19, 1400), (hinge, 7.0, 11.0, -14, 1800),
    (creak, 0.0, 3.3, -15, 1500), (creak, 0.0, 3.3, -22, 1200),
    (bear, 4.0, 10.0, -19, 1500), (bear, 12.0, 18.0, -24, 1100), (bear, 20.0, 27.0, -17, 1700),
]
t0 = 2.5; k = 0
while t0 < LOOP + XF - 4:
    src, a, b, s, lp = GROANS[k % len(GROANS)]
    g = groan(src, a, b, s + rng.uniform(-1.5, 1.5), lp)
    put(t0, pan(verb(g, SKY, 0.9, dry=0.55)[:len(g) + T(8)], rng.uniform(-0.75, 0.75)), -8 + rng.uniform(-2.5, 1.5))
    t0 += rng.uniform(5.0, 8.5); k += 1
# distant clanks: something huge settling far inside the ship (reverb only)
for t0 in np.sort(rng.uniform(6, LOOP + XF - 10, 5)):
    c = creak[T(rng.uniform(0, 2.8)):][:T(0.35)]
    c = filt(pitch(fade(c, 0.003, 0.15), -24), "low", 900)
    put(t0, pan(verb(norm(c, -20), SKY, 1.0, dry=0.15)[:T(9)], rng.uniform(-0.6, 0.6)), -12)

# ================================================================ the mix
out = BUS[:N].copy()
out = filt(out, "high", 18, 2)
out = out + filt(out, "low", 60, 2) * (dbg(4) - 1)    # the floor: weight you feel on headphones and real speakers
# one steady level: a slow leveller (3 s window), the sky never swells
e = np.sqrt(filt(mono(out) ** 2, "low", 0.25, 1).clip(1e-12))
gain = (np.median(e) / e).clip(dbg(-4), dbg(4)) ** 0.7
out *= gain[:, None]
# the seam: the last XF seconds crossfade (equal power) into the first
k = T(XF)
head = out[:k].copy(); tail = out[T(LOOP):T(LOOP) + k]
c = np.sin(np.linspace(0, np.pi / 2, k))[:, None]
out = out[:T(LOOP)].copy()
out[:k] = head * c + tail * np.cos(np.linspace(0, np.pi / 2, k))[:, None]

# loudness-match to the old bed (-19.2 LUFS integrated, BS.1770)
def kw(x):
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]; a1 = [1, -1.69065929318241, 0.73248077421585]
    return lfilter([1, -2, 1], [1, -1.99004745483398, 0.99007225036621], lfilter(b1, a1, x, axis=0), axis=0)
def lufs(x): return -0.691 + 10 * np.log10(np.sum(np.mean(kw(x) ** 2, 0)) + 1e-20)
out *= dbg(-19.2 - lufs(out))
pk = np.abs(out).max()
if pk > dbg(-1.5): out *= dbg(-1.5) / pk; print("peak-limited by %.1f dB" % (20 * np.log10(dbg(-1.5) / pk)))
print("integrated %.1f LUFS, peak %.1f dBFS" % (lufs(out), 20 * np.log10(np.abs(out).max())))
wavfile.write(os.path.join(HERE, "mothership.wav"), SR, out.astype(np.float32))
print("wrote mothership.wav", len(out) / SR, "s")
