#!/usr/bin/env bash
# 音轨全流程（某一语言）：动画导出音效事件 → 总谱 → 渲染分轨 → 配乐混音 → 合成音效 → 旁白垫齐 → 闪避混音
# 用法: bash anim/make_audio.sh zh|en   （在项目根目录运行；需要 ~/music-kit/sfzmap.json）
set -euo pipefail
cd "$(dirname "$0")/.."; l=$1; M=$(cd ../../skills/documentary-video/scripts && pwd)
END=$(LANG_V=$l node anim/film.js end)
LANG_V=$l node anim/film.js events anim/out/events_$l.json
rm -rf anim/out/music_$l; python3 music/score_ep04.py . $l anim/out/music_$l
python3 $M/music/render.py anim/out/music_$l ~/music-kit/sfzmap.json >/dev/null
python3 $M/music/mix.py anim/out/music_$l --duration $END | tail -1
(cd anim && python3 sfx.py out/events_$l.json 0 $END out/sfx_$l.wav)
ffmpeg -hide_banner -loglevel error -y -i audio/$l/narration.wav -af "apad=whole_dur=$END" -ar 48000 anim/out/voice_$l.wav
(cd anim && python3 $M/mix_audio.py --voice out/voice_$l.wav --bgm out/music_$l/music_final.wav --sfx out/sfx_$l.wav --out out/mix_$l.wav --sfx-gain -4 | tail -1)
