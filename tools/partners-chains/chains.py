"""Mission Partners: the chains the logos are hauled on.

Source: src/chains-src.wav, an 8 s royalty-free "metal chains" cinematic
effect (VibeWave Royalty-Free, youtube.com/shorts/-dBsp67VP0Q), converted
to 48 kHz stereo WAV. Gitignored.

Output: static/assets/home/partners-chains.mp3, a sprite read by
home-audio.js (the Partners block):

  0 - 8 s    DRAG   the whole recording with its chain clanks taken out
                    of the top (a crossover at 700 Hz; above it, ducked
                    -20 dB around every hit), so what is left is the
                    heavy haul: the low rumble and the scrape
  then       HITS   every chain hit cut out on its own, silence between,
                    the BIG ones first (the chain snapping taut), then the
                    small LINKS (links running over the ground). The page
                    finds them by their silences, so no offset table, and
                    an encoder's padding can't shift them

Run: python3 tools/partners-chains/chains.py   (needs the imageio-ffmpeg wheel)
"""
import os, subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt, lfilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SR = 48000

def T(t): return int(round(t * SR))
def dbg(d): return 10 ** (d / 20)
def kw(x):
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]; a1 = [1, -1.69065929318241, 0.73248077421585]
    return lfilter([1, -2, 1], [1, -1.99004745483398, 0.99007225036621], lfilter(b1, a1, x, axis=0), axis=0)
def lufs(x): return -0.691 + 10 * np.log10(np.sum(np.mean(kw(x) ** 2, 0)) + 1e-20)

sr, x = wavfile.read(os.path.join(HERE, "src", "chains-src.wav"))
assert sr == SR
x = x.astype(float) / 32768
n = len(x)

# ---- the hits, found in the top of the recording -------------------------
BIG = [(0.700, 1.060), (1.955, 2.430), (2.870, 3.210), (4.490, 4.860), (5.800, 6.230), (7.400, 7.880)]
LINKS = [(0.565, 0.700), (3.240, 3.460), (3.540, 3.800), (3.885, 4.110), (4.915, 5.200), (5.265, 5.500)]

# ---- DRAG: the haul without its clanks ----------------------------------
sos = butter(4, 700, "low", fs=SR, output="sos")
low = sosfiltfilt(sos, x, axis=0)
high = x - low
duck = np.ones(n)
for a, b in BIG + LINKS:
    duck[T(a - 0.03):T(b + 0.05)] = dbg(-20)
k = T(0.025)
duck = np.convolve(duck, np.ones(k) / k, "same")      # 25 ms ramps, no clicks
drag = low + high * duck[:, None]
# ease the ends so a voice that starts at 0 or runs to the end never clicks
f = T(0.05)
drag[:f] *= np.linspace(0, 1, f)[:, None]; drag[-f:] *= np.linspace(1, 0, f)[:, None]
drag *= dbg(-20 - lufs(drag))

# ---- HITS: each on its own, the same loudness ----------------------------
def cut(a, b, target):
    h = x[T(a - 0.012):T(b)].copy()
    fi, fo = T(0.004), T(0.06)
    h[:fi] *= np.linspace(0, 1, fi)[:, None]; h[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2
    return h * dbg(target - lufs(h))

gap = np.zeros((T(0.4), 2))
parts = [drag, np.zeros((T(0.5), 2))]
for a, b in BIG: parts += [cut(a, b, -14), gap]
for a, b in LINKS: parts += [cut(a, b, -18), gap]
out = np.concatenate(parts)
pk = np.abs(out).max()
if pk > dbg(-1): out *= dbg(-1) / pk; print("peak-limited by %.1f dB" % (20 * np.log10(dbg(-1) / pk)))
print("drag %.1f LUFS, file peak %.1f dBFS, %.2f s" % (lufs(out[:len(drag)]), 20 * np.log10(np.abs(out).max()), len(out) / SR))

wav = os.path.join(HERE, "chains.wav")
wavfile.write(wav, SR, (np.clip(out, -1, 1) * 32767).astype(np.int16))
import imageio_ffmpeg
dst = os.path.join(ROOT, "static", "assets", "home", "partners-chains.mp3")
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-v", "error", "-i", wav, "-c:a", "libmp3lame", "-b:a", "192k", dst], check=True)
print("wrote", os.path.relpath(dst, ROOT), os.path.getsize(dst) // 1024, "KB")
