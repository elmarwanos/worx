#!/bin/sh
# Mission Archive films for the HOME page, sized to its cards (560x267 at
# most on desktop, 320x153 on phones): the portfolio originals are ~1900 px
# wide and 4.5-14 MB each. Two sizes per film, no audio track (the cards
# play muted), H.264 high, faststart so playback starts before the download
# ends. The Portfolio page keeps the originals.
#   static/assets/home/archive/<name>-1120.mp4   desktop, retina sharp
#   static/assets/home/archive/<name>-640.mp4    phones
# Run from the repo root: sh tools/home-archive/build.sh
set -e
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
OUT=static/assets/home/archive
mkdir -p "$OUT"
for name in Hyundai Glimpse Genesis LG Hisense "Sail Naxos" chaumet Modon; do
  src="static/assets/portfolio/videos/$name.mp4"
  slug=$(echo "$name" | tr 'A-Z ' 'a-z-')
  for w in 1120 640; do
    crf=$([ $w = 1120 ] && echo 27 || echo 28)
    "$FF" -y -v error -i "$src" -an -vf "scale=$w:-2:flags=lanczos" -c:v libx264 -preset slow -crf $crf \
      -profile:v high -pix_fmt yuv420p -movflags +faststart "$OUT/$slug-$w.mp4"
  done
  echo "$slug: $(($(stat -f%z "$OUT/$slug-1120.mp4")/1024)) KB / $(($(stat -f%z "$OUT/$slug-640.mp4")/1024)) KB"
done
