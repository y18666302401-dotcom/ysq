#!/usr/bin/env bash
# 全片画面渲染：按帧数切成 N 段并行（每段一个 node 进程），再无损拼接
# 用法: bash render.sh zh|en [段数，默认 4] [fps，默认 60]
set -euo pipefail
cd "$(dirname "$0")"
LANGV=${1:-zh}; N=${2:-4}; FPS=${3:-60}
END=$(LANG_V=$LANGV node film.js end); FR=$(python3 -c "import math;print(math.ceil($END*$FPS))")
mkdir -p out/parts_$LANGV; : > out/parts_$LANGV/list.txt
for i in $(seq 0 $((N-1))); do
  a=$((FR*i/N)); b=$((FR*(i+1)/N))
  t0=$(python3 -c "print($a/$FPS)"); t1=$(python3 -c "print($b/$FPS)")
  LANG_V=$LANGV node film.js video out/parts_$LANGV/p$i.mp4 $FPS $t0 $t1 > out/parts_$LANGV/p$i.log 2>&1 &
  echo "file 'p$i.mp4'" >> out/parts_$LANGV/list.txt
done
wait
ffmpeg -y -loglevel error -f concat -safe 0 -i out/parts_$LANGV/list.txt -c copy out/film_${LANGV}_raw.mp4
echo "done → out/film_${LANGV}_raw.mp4 ($(ffprobe -v error -show_entries format=duration -of csv=p=0 out/film_${LANGV}_raw.mp4)s)"
