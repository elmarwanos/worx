"""Comms "Transmissions received": the voice actors' takes -> the radio script.

Source: src/*.WAV, the actors' recordings (24-bit/48 kHz mono, named by the
script's line numbers: tools/../the "Voice Actor Script" doc). Gitignored.
Copy them in from the delivery folder before running.

Output:
  static/assets/home/comms-cast.m4a   every line, in script order, 0.35 s apart
  tools/comms-voices/cues.json        CUES (start, length) and WORDS (each card
                                      word's [start, end] inside its message),
                                      pasted into home-audio.js

Per line:
  takes      where an ALT exists the stronger read is chosen (TAKES below):
             Simon's call-in = ALT (tighter, more animated: pauses 0.3-0.4 s
             vs 0.5-0.7 s, 5.4 vs 4.7 st of pitch movement); Monique's
             testimonial = main (the same delivery, 1.2 s tighter)
  split      a testimonial and its sign-off recorded together are split at
             the pause before the sign-off ("Simon, out.")
  trim       to the speech (soft onsets kept), 60 ms before the first sound, 150 ms after the
             last (a soft fade in the room tone either side)
  pauses     a silence longer than MAXGAP inside a line is shortened in its
             middle (30 ms crossfades in the room tone): radio turnarounds
             stay tight; a short comma pause is never touched
  level      a 70 Hz high-pass, each line matched to -20 LUFS (the level
             the page's K was set for) with a soft peak ceiling at -1 dBFS
  words      re-transcribed (faster-whisper medium.en, word timestamps) AFTER
             the edits, so the highlight follows the final audio; mapped onto
             the card's words (an extra spoken word, e.g. Simon's "and", holds
             the highlight on the word before it)

Run: <venv with faster-whisper>/bin/python tools/comms-voices/build.py
"""
import os, re, json, subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt, lfilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(HERE, "src")
SR = 48000

# line key -> (file, part): part = "all" | "head" (before the sign-off) | "tail" (the sign-off)
TAKES = {
    "a0": ("1- Simon ALT.WAV", "all"),
    "c0": ("2- Mission Control.WAV", "all"),
    "q0": ("3-4 Simon.WAV", "head"),
    "s0": ("3-4 Simon.WAV", "tail"),
    "a1": ("5- Monique.WAV", "all"),
    "c1": ("6- Mission Control.WAV", "all"),
    "q1": ("7-8 Monique.WAV", "head"),
    "s1": ("7-8 Monique.WAV", "tail"),
    "a2": ("9- Moh.WAV", "all"),
    "c2": ("10- Mission Control.WAV", "all"),
    "q2": ("11-12- Moh.WAV", "head"),
    "s2": ("11-12- Moh.WAV", "tail"),
    "end": ("13- Mission Control.WAV", "all"),
}
ORDER = ["a0", "c0", "q0", "s0", "a1", "c1", "q1", "s1", "a2", "c2", "q2", "s2", "end"]
# the cards' own words (index.html), which the highlight walks
CARDS = {
    "q0": "We've been working with the Worx team for over two years and their work is professional with impressive speed!",
    "q1": "The team understands the requirements of the UAE and GCC region which made the Chaumet e-commerce website a huge success! Kudos to everyone at Worx.",
    "q2": "I have worked with Glimpse on various real estate projects and they continue to exceed expectations. Worx is our trusted partner.",
}
MAXGAP = {"a": 0.42, "c": 0.42, "q": 0.55, "s": 0.4, "e": 0.45}   # longest silence kept inside a line, by line kind
GAP_OUT = 0.35                                                    # silence between lines in the file

def T(t): return int(round(t * SR))
def dbg(d): return 10 ** (d / 20)
def kw(x):
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]; a1 = [1, -1.69065929318241, 0.73248077421585]
    return lfilter([1, -2, 1], [1, -1.99004745483398, 0.99007225036621], lfilter(b1, a1, x))
def lufs(x):
    k = kw(x); h = T(0.4); st = T(0.1)
    bl = np.array([np.mean(k[i:i + h] ** 2) for i in range(0, max(1, len(k) - h), st)])
    bl = bl[-0.691 + 10 * np.log10(bl + 1e-20) > -70]
    m = -0.691 + 10 * np.log10(bl.mean())
    bl = bl[-0.691 + 10 * np.log10(bl) > m - 10]
    return -0.691 + 10 * np.log10(bl.mean())

def load(name):
    sr, raw = wavfile.read(os.path.join(SRC, name))     # 24-bit PCM reads as int32, left-justified
    assert sr == SR, name
    x = raw.astype(np.float64) / {np.dtype("int32"): 2 ** 31, np.dtype("int16"): 2 ** 15}.get(raw.dtype, 1)
    if x.ndim == 2: x = x.mean(1)
    return sosfiltfilt(butter(2, 70, "high", fs=SR, output="sos"), x)

def envdb(x, win=0.02):
    n = T(win)
    return 20 * np.log10(np.sqrt(np.convolve(x ** 2, np.ones(n) / n, "same")) + 1e-9)

def speech_mask(x, over=18):
    """speech = the level `over` dB above the room tone; 18 finds the clear
    pauses, 8-10 keeps the soft edges of words (an M, an H, a breathy onset)"""
    e = envdb(x)
    floor = np.percentile(e, 5)
    return e > floor + over, floor

def silences(mask, min_len):
    """[start, end) sample runs of non-speech at least min_len long, inside the speech"""
    idx = np.where(mask)[0]
    if not len(idx): return []
    a, z = idx[0], idx[-1]
    out, run = [], None
    for i in range(a, z):
        if not mask[i]:
            if run is None: run = i
        elif run is not None:
            if i - run >= min_len: out.append((run, i))
            run = None
    return out

def cut_part(x, part):
    if part == "all": return x
    mask, _ = speech_mask(x)
    gaps = silences(mask, T(0.3))
    late = [g for g in gaps if g[0] > len(x) * 0.5] or gaps
    a, b = max(late, key=lambda g: g[1] - g[0])   # the longest pause in the back half: the breath before the sign-off
    mid = (a + b) // 2
    return x[:mid] if part == "head" else x[mid:]

def trim(x):
    mask, _ = speech_mask(x, 8)
    idx = np.where(mask)[0]
    a = max(0, idx[0] - T(0.06)); z = min(len(x), idx[-1] + T(0.15))
    y = x[a:z].copy()
    fi, fo = T(0.02), T(0.06)
    y[:fi] *= np.linspace(0, 1, fi); y[-fo:] *= np.linspace(1, 0, fo)
    return y

def tighten(x, maxgap):
    mask, _ = speech_mask(x, 10)
    xf = T(0.03)
    for a, b in sorted(silences(mask, T(maxgap)), reverse=True):   # from the end, so earlier indices hold
        drop = (b - a) - T(maxgap)
        if drop < T(0.05): continue
        m = (a + b) // 2
        c0, c1 = m - drop // 2, m - drop // 2 + drop
        fade = np.linspace(1, 0, xf)
        seam = x[c0 - xf:c0] * fade + x[c1 - xf:c1] * fade[::-1]
        x = np.concatenate([x[:c0 - xf], seam, x[c1:]])
    return x

def ceiling(x, at=-1.0):
    """soft peak ceiling: tanh above the knee, untouched below"""
    c = dbg(at); knee = c * 0.7
    y = x.copy(); o = np.abs(y) > knee
    y[o] = np.sign(y[o]) * (knee + (c - knee) * np.tanh((np.abs(y[o]) - knee) / (c - knee)))
    return y

lines = {}
for k in ORDER:
    f, part = TAKES[k]
    y = trim(cut_part(load(f), part))
    y = tighten(y, MAXGAP[k[0]])
    y = trim(y)
    for _ in range(3):                                   # level, then ceiling, settle
        y = ceiling(y * dbg(-20 - lufs(y)))
    lines[k] = y
    print("%-4s %-26s %5.2f s  %5.1f LUFS  peak %5.1f" % (k, f, len(y) / SR, lufs(y), 20 * np.log10(np.abs(y).max())))

# assemble
CUES, parts, t = {}, [], 0.0
for k in ORDER:
    y = lines[k]
    CUES[k] = [round(t, 3), round(len(y) / SR, 3)]
    parts += [y, np.zeros(T(GAP_OUT))]
    t += len(y) / SR + GAP_OUT
out = np.concatenate(parts)
wav = os.path.join(HERE, "comms-cast.wav")
wavfile.write(wav, SR, (np.clip(out, -1, 1) * 32767).astype(np.int16))

# the words, from the final audio
from faster_whisper import WhisperModel
model = WhisperModel("medium.en", device="cpu", compute_type="int8")
norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower().replace("ecommerce", "ecommerce"))
WORDS = {}
for k, text in CARDS.items():
    seg = os.path.join(HERE, "_%s.wav" % k)
    wavfile.write(seg, SR, (lines[k] * 32767).astype(np.int16))
    said = []
    for s in model.transcribe(seg, word_timestamps=True, beam_size=5,
                              initial_prompt="Worx, Chaumet, Glimpse, UAE, GCC, e-commerce.")[0]:
        for w in s.words: said.append([w.start, w.end, w.word.strip()])
    os.remove(seg)
    # whisper may split "e-commerce" into "e" + "-commerce": join pieces that start with a hyphen
    j = []
    for w in said:
        if j and w[2].startswith("-"): j[-1] = [j[-1][0], w[1], j[-1][2] + w[2]]
        else: j.append(w)
    said = j
    card = text.split()
    # walk the card: each card word takes the next spoken word that matches;
    # a spoken word with no card word (an ad-lib) extends the previous card word
    res, si = [], 0
    for cw in card:
        n = norm(cw)
        look = si
        while look < len(said) and norm(said[look][2]) != n and look - si < 3: look += 1
        if look < len(said) and norm(said[look][2]) == n:
            if res and look > si: res[-1][1] = said[look - 1][1]   # ad-libbed words: the previous card word holds through them
            res.append([said[look][0], said[look][1]]); si = look + 1
        else:
            res.append([said[si][0], said[si][1]] if si < len(said) else [res[-1][1], res[-1][1] + 0.2]); si += 1
    WORDS[k] = [[round(a, 3), round(b, 3)] for a, b in res]
    print(k, len(card), "card words,", len(said), "spoken:", " ".join(w[2] for w in said))

json.dump({"CUES": CUES, "WORDS": WORDS}, open(os.path.join(HERE, "cues.json"), "w"), indent=1)
dst = os.path.join(ROOT, "static", "assets", "home", "comms-cast.m4a")
subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "96000", "-c", "1", wav, dst], check=True)
print("wrote", os.path.relpath(dst, ROOT), os.path.getsize(dst) // 1024, "KB,", round(t, 2), "s")
