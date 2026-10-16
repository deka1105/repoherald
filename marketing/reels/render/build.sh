#!/usr/bin/env bash
# Render reel 03 (the ranking-formula piece) to ../out/reel03.mp4
# Every number on screen is read out of src/lib by extract-facts.mjs, so the
# video cannot drift from the code the way a hand-typed script can.
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules ] || npm i --silent puppeteer-core
node extract-facts.mjs                       # src/lib/*.ts -> facts.json
node capture.mjs sample                      # 19 stills to eyeball first
node capture.mjs full                        # 960 frames @ 1080x1920
mkdir -p ../out
cp frames/00360.png /tmp/_poster.png         # strongest settled frame
cp frames/00000.png frames/.orig && cp /tmp/_poster.png frames/00000.png
ffmpeg -y -loglevel error -framerate 30 -i frames/%05d.png \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -movflags +faststart ../out/reel03.mp4
cp frames/.orig frames/00000.png
ffmpeg -y -loglevel error -i /tmp/_poster.png -q:v 2 ../out/reel03.jpg
echo "-> ../out/reel03.mp4"
