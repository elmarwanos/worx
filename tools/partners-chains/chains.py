"""Mission Partners: the chains the logos are hauled on.

Source: src/chains-src.wav, an 8 s royalty-free "metal chains" cinematic
effect (VibeWave Royalty-Free, youtube.com/shorts/-dBsp67VP0Q), converted
to 48 kHz stereo WAV. Gitignored.

Output: static/assets/home/partners-chains-loop.mp3: the whole recording,
rumble and chain clanks together, as one seamless loop, under the moving
logos without a break (home-audio.js, the Partners block). (Until
2026-10-05 this built a sprite of separate drag + hits for per-logo
passes; the user wanted the haul continuous instead.)

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

import imageio_ffmpeg

# ---- LOOP: the whole recording, rumble and chains, as one seamless loop ----
# (2026-10-05: the user wants the haul continuous, always there under the
# moving logos, never breaking up.) The opening impact is left out; the
# loop's last 1.2 s are crossfaded (equal power) into its head, so it runs
# forever without a seam. Output: static/assets/home/partners-chains-loop.mp3
# (twice over, see below)
a, b, xf = T(0.25), T(7.95), T(1.2)
body = x[a:b].copy()
head, tail = body[:xf], body[-xf:]
th = np.linspace(0, np.pi / 2, xf)[:, None]
loop = np.concatenate([tail * np.cos(th) + head * np.sin(th), body[xf:-xf]])
loop *= dbg(-20 - lufs(loop))
pk = np.abs(loop).max()
if pk > dbg(-1): loop *= dbg(-1) / pk
print("loop %.2f s, %.1f LUFS, peak %.1f dBFS" % (len(loop) / SR, lufs(loop), 20 * np.log10(np.abs(loop).max())))
lw = os.path.join(HERE, "chains-loop.wav")
# the file holds the loop TWICE: the page loops one exact period from inside
# it (loopStart 0.5 s), so an MP3 decoder's padding at either end of the
# file can never fall inside the loop and click
wavfile.write(lw, SR, (np.clip(np.concatenate([loop, loop]), -1, 1) * 32767).astype(np.int16))
print("loop period %.6f s (LOOP in home-audio.js)" % (len(loop) / SR))
ldst = os.path.join(ROOT, "static", "assets", "home", "partners-chains-loop.mp3")
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-v", "error", "-i", lw, "-c:a", "libmp3lame", "-b:a", "128k", ldst], check=True)
print("wrote", os.path.relpath(ldst, ROOT), os.path.getsize(ldst) // 1024, "KB")
