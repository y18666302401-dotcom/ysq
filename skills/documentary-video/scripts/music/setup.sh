#!/usr/bin/env bash
# 代码编曲环境：mido（写谱）、pedalboard（Surge XT 合成器 + 混音效果器）、sfizz_render（SFZ 采样乐器）、免费采样库。
# 用法: bash setup.sh [安装目录，默认 ~/music-kit]
# 装完会生成 <安装目录>/sfzmap.json，render.py 用它找每个声部的 SFZ 文件。
set -euo pipefail
K=${1:-$HOME/music-kit}; mkdir -p "$K"; cd "$K"
HERE=$(cd "$(dirname "$0")" && pwd)

pip install -q mido pedalboard soundfile numpy

# Surge XT 合成器（VST3，开源，3000 多个出厂音色）
if [ ! -e "/usr/lib/vst3/Surge XT.vst3" ]; then
  curl -sSL -o surge.deb https://github.com/surge-synthesizer/releases-xt/releases/download/1.3.4/surge-xt-linux-x64-1.3.4.deb
  sudo apt-get install -y -qq ./surge.deb || apt-get install -y -qq ./surge.deb
fi

# sfizz 命令行渲染器（从源码编译，几分钟）
if ! command -v sfizz_render >/dev/null; then
  (sudo apt-get install -y -qq cmake build-essential libsndfile1-dev || apt-get install -y -qq cmake build-essential libsndfile1-dev)
  curl -sSL https://github.com/sfztools/sfizz/releases/download/1.2.3/sfizz-1.2.3.tar.gz | tar xz
  cmake -S sfizz-1.2.3 -B sfizz-1.2.3/build -DCMAKE_BUILD_TYPE=Release -DSFIZZ_JACK=OFF -DSFIZZ_RENDER=ON -DSFIZZ_SHARED=OFF -DSFIZZ_LV2=OFF -DSFIZZ_VST=OFF >/dev/null
  make -C sfizz-1.2.3/build -j"$(nproc)" sfizz_render >/dev/null
  install -m755 "$(find sfizz-1.2.3/build -name sfizz_render -type f)" /usr/local/bin/ 2>/dev/null || sudo install -m755 "$(find sfizz-1.2.3/build -name sfizz_render -type f)" /usr/local/bin/
fi

# 采样库（只下需要的部分）
[ -d SalamanderGrandPiano ] || git clone -q --depth 1 https://github.com/sfzinstruments/SalamanderGrandPiano   # 三角钢琴，约 1.4 GB
[ -d SamsSonor ] || git clone -q --depth 1 https://github.com/sfzinstruments/SamsSonor                         # 鼓组，约 70 MB
if [ ! -d VSCO-2-CE ]; then                                                                                   # 管弦乐，只取用到的文件夹，约 1 GB
  git clone -q --depth 1 --filter=blob:none --no-checkout https://github.com/sgossner/VSCO-2-CE
  git -C VSCO-2-CE sparse-checkout init --no-cone
  git -C VSCO-2-CE sparse-checkout set "/Strings/Violin Section/Pizz/" "/Strings/Violin Section/susVib/" "/Strings/Viola Section/susvib/" \
    "/Strings/Cello Section/susvib/" "/Strings/Cello Section/pizzT/" "/Percussion/Xylo/" "/Percussion/Glock/" "/Percussion/Timpani/" \
    "/VSCO 1 Percussion/varMetal/Cymbals/"
  git -C VSCO-2-CE checkout -q HEAD
fi

python3 "$HERE/sfz_gen.py" VSCO-2-CE sfz
# 中国古代题材的乐器（VCSL，CC0，约 350 MB）：筝、陶笛（当埙）、管钟（当编钟）、框鼓（当建鼓）、锣、木鱼、拍板、梆子
if [ ! -d VCSL ]; then
  git clone -q --depth 1 --filter=blob:none --no-checkout https://github.com/sgossner/VCSL
  git -C VCSL sparse-checkout init --no-cone
  git -C VCSL sparse-checkout set "/Chordophones/Zithers/Dan Tranh/Normal/" "/Chordophones/Zithers/Dan Tranh/Gliss/" "/Chordophones/Zithers/Dan Tranh/Tremolo/" \
    "/Aerophones/Edge-blown Aerophones/Ocarina, Typical/Sustains/Sus/" "/Membranophones/Struck Membranophones/Frame Drum/" "/Idiophones/Struck Idiophones/Gong 1/" \
    "/Idiophones/Struck Idiophones/Woodblock/" "/Idiophones/Struck Idiophones/Tubular Bells 1/" "/Idiophones/Struck Idiophones/Claves/" "/Idiophones/Struck Idiophones/Slit Drum/"
  git -C VCSL checkout -q HEAD
fi
python3 "$HERE/sfz_vcsl.py" VCSL sfz
python3 - "$K" <<'PY'
import json, os, sys
k = sys.argv[1]; s = lambda n: os.path.join(k, 'sfz', n + '.sfz')
m = {'piano': os.path.join(k, 'SalamanderGrandPiano', 'Salamander Grand Piano V3.sfz'), 'drums': os.path.join(k, 'SamsSonor', 'SamsSonor.sfz')}
m.update({n: s(n) for n in ['violins_sus', 'violas_sus', 'cellos_sus', 'violins_pizz', 'cellos_pizz', 'xylophone', 'glockenspiel', 'orch_perc',
                            'guzheng', 'zheng_gliss', 'xun', 'bianzhong', 'han_perc']})
json.dump(m, open(os.path.join(k, 'sfzmap.json'), 'w'), indent=1, ensure_ascii=False); print('→', os.path.join(k, 'sfzmap.json'))
PY
echo "装好了。试一下：python3 $HERE/score_cat_example.py out && python3 $HERE/render.py out $K/sfzmap.json && python3 $HERE/mix.py out --duration 15"
