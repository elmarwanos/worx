"""The Redshift masters. score.py hands over the mix; this renders two:

  hero-score.wav         desktop, laptop, headphones: full range, mono-safe
                         width, the sub told again as harmonics for laptops
  hero-score-mobile.wav  phones: folded to mono (most phone speakers are),
                         the weight moved up to where a phone speaker can
                         play it (250 Hz - 2 kHz), tighter dynamics

Re-run alone (no re-render of the score):  python3 master.py
"""
import numpy as np, os
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, resample_poly
from scipy.ndimage import minimum_filter1d

SR = 48000
CUT, VOID0 = 8.46, 7.92
HERE = os.path.dirname(os.path.abspath(__file__))

def T(t): return int(round(t * SR))
def dbg(d): return 10 ** (d / 20)
def filt(x, kind, f, order=2):
    s = butter(order, f, "band" if kind == "bp" else kind, fs=SR, output="sos")
    return sosfilt(s, x, axis=0)
def mono(x): return x.mean(1)
def st(m): return np.stack([m, m], 1)
def width(x, w):
    m = (x[:, 0] + x[:, 1]) / 2; s = (x[:, 0] - x[:, 1]) / 2 * w
    return np.stack([m + s, m - s], 1)

def follow(x, att, rel):
    """peak envelope (one channel), attack/release in seconds"""
    a, r = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    e = np.empty_like(x); cur = 0.0
    for i, v in enumerate(np.abs(x)):
        cur = v + (cur - v) * (a if v > cur else r); e[i] = cur
    return e

def bass_harmonics(x, split, band, ratio_db):
    """psychoacoustic bass: the weight below `split` rebuilt as its own upper
    harmonics in `band` (the ear hears the missing fundamental), held at
    ratio_db against the low band's envelope so it rises and falls with it"""
    lo = filt(mono(x), "low", split, 4)
    el = follow(lo, 0.004, 0.12)
    drive = lo / (el + 1e-4)                       # level-free: every hit distorts alike
    h = np.tanh(drive * 2.5) + 0.6 * (np.abs(drive) - np.mean(np.abs(drive)))   # odd + even
    h = filt(filt(h, "bp", band, 2), "bp", band, 2)
    eh = follow(h, 0.004, 0.12)
    return st(h * el / (eh + 1e-6) * dbg(ratio_db))

def air(x, db):
    hi = filt(x, "bp", [2500, 7000], 2)
    return x + filt(np.tanh(hi * 4) / 4, "high", 5000, 2) * dbg(db - 6) + filt(x, "high", 7000, 1) * dbg(db)

def glue(x, thr_db, ratio, par_db):
    """parallel compression: lifts the quiet stretches, keeps the hits"""
    e = follow(mono(x), 0.008, 0.18); thr = dbg(thr_db)
    g = np.where(e > thr, (e / thr) ** (1 / ratio - 1), 1.0)
    return x + x * g[:, None] * dbg(par_db)

def limit(out, ceil=-1.2):
    """look-ahead peak limiter (4x oversampled peaks)"""
    la = T(0.003)
    pk = np.abs(resample_poly(out, 4, 1, axis=0)).max(1)[:4 * len(out)].reshape(-1, 4).max(1)
    need = np.minimum(1, dbg(ceil) / np.maximum(pk, 1e-9))
    gmin = minimum_filter1d(need, size=2 * la + 1)
    gr = np.empty_like(gmin); a_rel = np.exp(-1 / (0.06 * SR)); cur = 1.0
    for i in range(len(gmin)):
        cur = gmin[i] if gmin[i] < cur else gmin[i] + (cur - gmin[i]) * a_rel
        gr[i] = cur
    print("  limiter max reduction %.1f dB" % (20 * np.log10(gr.min())))
    return out * gr[:, None]

def finish(out, voidpart, name):
    out = filt(out, "high", 22, 2)
    out[T(VOID0):T(CUT)] = filt(voidpart, "high", 18, 2)[T(VOID0):T(CUT)]   # the void: only the door's pressure
    out = limit(out)
    n = len(out); f = np.ones(n); f[:T(0.015)] = np.linspace(0, 1, T(0.015)) ** 2; f[n - T(0.4):] = np.linspace(1, 0, T(0.4)) ** 2
    out = out * f[:, None]
    wavfile.write(os.path.join(HERE, name), SR, out.astype(np.float32))
    print("  wrote", name)

def desktop(pre, voidpart):
    out = pre + bass_harmonics(pre, 110, [120, 420], -5)       # an octave up: laptops
    out = out + bass_harmonics(pre, 160, [220, 1200], -9)     # higher still, faint
    out = air(out, -7)
    lo = filt(out, "low", 140, 4); hi = out - lo
    out = st(mono(lo)) + width(hi, 1.2)                        # one centre of weight; wider, mono-safe
    out = glue(out, -30, 4, -5)
    vp = voidpart.copy(); return out, vp

def phone(pre, voidpart):
    m = st(mono(pre))
    body = filt(m, "high", 180, 2)                             # a phone can't move air below this
    out = body + bass_harmonics(pre, 140, [260, 1800], -1)     # the sub, as a phone hears it
    out = out + bass_harmonics(pre, 90, [180, 700], -6)
    out = out + filt(body, "bp", [900, 3500], 1) * dbg(-6)     # presence
    out = air(out, -9)
    out = glue(out, -34, 5, -2)
    vp = st(mono(voidpart)); vp = vp + bass_harmonics(voidpart, 140, [260, 1800], -3)
    return out, vp

def render(pre, voidpart):
    print("desktop master"); finish(*desktop(pre, voidpart), "hero-score.wav")
    print("phone master"); finish(*phone(pre, voidpart), "hero-score-mobile.wav")

if __name__ == "__main__":
    pre, voidpart = np.load(os.path.join(HERE, "premix.npy"))
    render(pre, voidpart)
