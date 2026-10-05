"""Ready for launch: the sound of hovering the ignition (the CTA).

Source: src/singularity-src.wav, the opening of "SINGULARITY | Cinematic
Sound Effects" (FILM CRUX, youtube.com/watch?v=ikEUqhOnqeQ), converted to
48 kHz stereo WAV; chosen for the site by the client. Gitignored.

Output: static/assets/home/launch-hover.m4a, its first 2 s exactly as
recorded: the impact and its rumble, which falls to its quietest at 2.0 s
(the recording's next hit lands at 2.2 s), so the cut sits in its own
trough. A 3 ms fade in, a 0.18 s fade out into the trough, nothing else
touched. Loudness is left to the page (home-audio.js, launchSynth).

Run: python3 tools/launch-hover/hover.py   (needs the imageio-ffmpeg wheel)
"""
import os, subprocess
import numpy as np
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SR = 48000

sr, x = wavfile.read(os.path.join(HERE, "src", "singularity-src.wav"))
assert sr == SR
x = x[:2 * SR].astype(float) / 32768
fi, fo = int(0.003 * SR), int(0.18 * SR)
x[:fi] *= np.linspace(0, 1, fi)[:, None]
x[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo))[:, None] ** 2
wav = os.path.join(HERE, "launch-hover.wav")
wavfile.write(wav, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))
import imageio_ffmpeg
dst = os.path.join(ROOT, "static", "assets", "home", "launch-hover.m4a")
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-v", "error", "-i", wav, "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", dst], check=True)
print("wrote", os.path.relpath(dst, ROOT), os.path.getsize(dst) // 1024, "KB")
