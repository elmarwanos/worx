#!/usr/bin/env python3
"""
Worx | tools/hero-video/build.py
Turns the raw hero film (tools/hero-video/source/bigbang.mp4) into the
web hero loop in static/assets/home/:

  1. Watermark removal, frame by frame. The Gemini sparkle is a static,
     semi-transparent light overlay (bottom-right). For every pixel under
     it, what is seen is regressed against what is behind it (an inpainted
     estimate) across the whole clip:  seen = (1 - a) * behind + a * c,
     so the slope gives its true opacity a and the intercept its true
     colour c (it is a light grey, not white). Every frame is then
     un-blended:  behind = (seen - a * c) / (1 - a), recovering the
     original picture; the box edge is feathered so no seam can show.
  2. Seamless loop: the last LOOP_XF seconds are cross-faded over the
     first ones, so the end flows straight back into the Big Bang.
  3. Finishing (ffmpeg): light temporal denoise for the source's
     compression artefacts, sharpening, a warm cinematic grade toward the
     Worx palette, and a soft vignette. Audio is dropped.
  4. Encodes: 1440p / 1080p / 720p H.264 (faststart; home.js picks one
     per screen) + a poster frame.

Usage:  python3 tools/hero-video/build.py
Needs:  pip install --user imageio-ffmpeg numpy pillow
"""
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "tools/hero-video/source/bigbang.mp4")   # the raw film (kept out of the public assets)
OUT = os.path.join(ROOT, "static/assets/home")
# working files stay off the (cloud-synced) project folder
TMP = os.environ.get("HERO_TMP", os.path.join(os.environ.get("TMPDIR", "/tmp"), "worx-hero-video"))

W, H, FPS = 1920, 1080, 30
# the watermark's measured box (static/assets/home/bigbang.mp4), with a margin
WX0, WY0, WX1, WY1 = 1692, 852, 1788, 948
LOOP_XF = 0.7          # seconds of end -> start cross-fade
N_XF = int(round(LOOP_XF * FPS))

GRADE = ",".join([
    "hqdn3d=1.4:1.2:5:5",                                   # compression artefacts out
    "unsharp=5:5:0.75:5:5:0.0",                             # crisp detail
    "colorbalance=rs=0.05:gs=0.0:bs=-0.05:rm=0.04:gm=0.01:bm=-0.04:rh=0.03:gh=0.0:bh=-0.04",
    "eq=contrast=1.08:saturation=1.06:gamma=0.97",
    "vignette=angle=PI/5:mode=forward",
])


def frames(start=None, count=None):
    """Yield raw RGB frames (H, W, 3) uint8."""
    cmd = [FF, "-hide_banner", "-loglevel", "error"]
    if start is not None:
        cmd += ["-ss", "%.4f" % start]
    cmd += ["-i", SRC, "-an", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    n = 0
    size = W * H * 3
    while count is None or n < count:
        buf = p.stdout.read(size)
        if len(buf) < size:
            break
        yield np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        n += 1
    p.stdout.close()
    p.wait()


def box_blur(a, r):
    """Mean filter of radius r (edge-normalised), via integral images."""
    pad = np.pad(a, ((r + 1, r), (r + 1, r)), mode="edge").astype(np.float64)
    c = pad.cumsum(0).cumsum(1)
    k = 2 * r + 1
    s = c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]
    return s / (k * k)


def box_blur_rgb(img, r):
    return np.stack([box_blur(img[..., ch], r) for ch in range(3)], -1)


def inpaint(crop, hole):
    """Fill `hole` (bool) in an (h, w, 3) float crop from its surroundings:
    normalised convolution, a radius wide enough to span the whole mark
    first, then finer radii only where they still see enough of the
    surrounding picture (so the centre never goes empty)."""
    known = (~hole).astype(np.float64)
    out = crop.copy()
    filled = np.zeros(hole.shape, bool)
    for r in (40, 22, 12, 6):
        wsum = box_blur(known, r)
        ok = hole & (wsum > (0.02 if r == 40 else 0.25))
        for ch in range(3):
            est = box_blur(crop[..., ch] * known, r) / (wsum + 1e-9)
            out[..., ch] = np.where(ok, est, out[..., ch])
        filled |= ok
    return out


def measure_alpha():
    """Per-pixel opacity a and colour c of the mark inside the box."""
    print("measuring the watermark ...")
    crops = []
    for i, f in enumerate(frames()):
        if i % 2 == 0:
            crops.append(f[WY0:WY1, WX0:WX1].astype(np.float64))
    stack = np.stack(crops)                         # (n, h, w, 3)
    lum = stack.mean(-1)
    p20 = np.percentile(lum, 20, axis=0)
    core = p20 > np.median(p20) + 18
    hole = box_blur(core.astype(np.float64), 2) > 0.02   # grow a little
    bgs = np.stack([inpaint(c, hole) for c in stack])      # what is behind, per frame
    # per pixel, per channel: seen = s * behind + b
    x = bgs.mean(-1)
    y = lum
    xm, ym = x.mean(0), y.mean(0)
    cov = ((x - xm) * (y - ym)).mean(0)
    var = ((x - xm) ** 2).mean(0) + 1e-6
    slope = np.clip(cov / var, 0.2, 1.0)
    a = np.clip(1.0 - slope, 0, 0.8)
    a = box_blur(a, 1)                                     # tame per-pixel noise
    a[~hole] = 0
    a = np.where(a < 0.02, 0, a)
    c = np.zeros(stack.shape[1:])
    for ch in range(3):
        b_ch = stack[..., ch].mean(0) - (1 - a) * bgs[..., ch].mean(0)
        c[..., ch] = np.where(a > 0.02, b_ch / np.maximum(a, 1e-3), 0)
    cc = np.median(c[core], axis=0)                        # one colour for the whole mark
    print("  mark opacity: max %.2f, mean over mark %.2f; colour %s" % (a.max(), a[core].mean(), np.round(cc).astype(int)))
    Image.fromarray((a / max(a.max(), 1e-6) * 255).astype(np.uint8)).resize((384, 384)).save(os.path.join(TMP, "alpha.png"))
    return (a, cc), hole


def clean(frame, mark, hole):
    a, cc = mark
    f = frame.astype(np.float64)
    crop = f[WY0:WY1, WX0:WX1]
    A = a[..., None]
    unblend = (crop - A * cc[None, None, :]) / np.maximum(1.0 - A, 0.2)
    # The whole mark (grown 3 px) is rebuilt from the picture around it; the
    # un-blend only lends back a little fine texture where the mark is thin,
    # and matching grain keeps the patch from reading smoother than the film.
    grown = box_blur(hole.astype(np.float64), 3) > 0.01
    fill = inpaint(crop, grown)
    detail = (unblend - box_blur_rgb(unblend, 2)) * np.clip(1 - A / 0.5, 0, 1) * 0.3
    rng = np.random.default_rng(int(crop.sum()) % 2**32)
    grain = rng.normal(0, 2.2, crop.shape[:2])[..., None]
    soft = np.clip(box_blur(grown.astype(np.float64), 3) * 1.6, 0, 1)[..., None]
    fixed = crop * (1 - soft) + (fill + detail + grain) * soft
    # feather the box edge so no seam can show
    yy, xx = np.mgrid[0:crop.shape[0], 0:crop.shape[1]]
    edge = np.minimum.reduce([yy, xx, crop.shape[0] - 1 - yy, crop.shape[1] - 1 - xx]).astype(np.float64)
    feather = np.clip(edge / 6.0, 0, 1)[..., None]
    out = f.copy()
    out[WY0:WY1, WX0:WX1] = crop * (1 - feather) + np.clip(fixed, 0, 255) * feather
    return np.clip(out, 0, 255).astype(np.uint8)


def main():
    os.makedirs(TMP, exist_ok=True)
    a, hole = measure_alpha()

    total = sum(1 for _ in frames())
    keep = total - N_XF
    print("frames: %d -> loop of %d (%.2fs), %d-frame cross-fade" % (total, keep, keep / FPS, N_XF))

    tail = [clean(f, a, hole) for f in frames(start=(total - N_XF) / FPS, count=N_XF)]
    if len(tail) < N_XF:
        sys.exit("could not read the tail")

    master = os.path.join(TMP, "master.mkv")
    enc = subprocess.Popen([FF, "-hide_banner", "-loglevel", "error", "-y",
                            "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "%dx%d" % (W, H), "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "slow", "-crf", "10", "-pix_fmt", "yuv444p", master],
                           stdin=subprocess.PIPE)
    print("cleaning + looping ...")
    for i, f in enumerate(frames()):
        if i >= keep:
            break
        g = clean(f, a, hole)
        if i < N_XF:
            k = (i + 0.5) / N_XF
            k = k * k * (3 - 2 * k)
            g = (tail[i].astype(np.float32) * (1 - k) + g.astype(np.float32) * k).astype(np.uint8)
        enc.stdin.write(g.tobytes())
        if i % 60 == 0:
            print("  frame", i)
    enc.stdin.close()
    enc.wait()

    Image.fromarray(clean(next(frames(start=4.2, count=1)), a, hole)).save(os.path.join(TMP, "check-4.2.png"))

    def encode(name, args):
        # encode locally, then copy in (the project folder is cloud-synced)
        tmp = os.path.join(TMP, name)
        subprocess.check_call([FF, "-hide_banner", "-loglevel", "error", "-y", "-i", master] + args + [tmp])
        shutil.copyfile(tmp, os.path.join(OUT, name))
        print("  %-22s %6.2f MB" % (name, os.path.getsize(tmp) / 1e6))

    print("encoding ...")
    x264 = ["-an", "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-g", "60"]
    encode("hero-1440.mp4", ["-vf", GRADE + ",scale=2560:1440:flags=lanczos,unsharp=3:3:0.35"] + x264 + ["-crf", "22"])
    encode("hero-1080-hq.mp4", ["-vf", GRADE] + x264 + ["-crf", "21"])
    encode("hero-720.mp4", ["-vf", GRADE + ",scale=1280:720:flags=lanczos"] + x264 + ["-crf", "23"])
    encode("hero-poster.jpg", ["-ss", "2.4", "-frames:v", "1", "-vf", GRADE + ",scale=1920:1080", "-q:v", "3"])
    print("done")


if __name__ == "__main__":
    main()
