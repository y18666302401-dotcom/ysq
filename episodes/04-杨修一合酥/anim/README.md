# 第 4 期动画代码

- `lib.js`：纸纹、抖线、错位上色、缓动、读 `audio/<语言>/shots.json`、字幕、渲染输出（复用技能里的 `char34.js`、`night.js`、`subtitles.js`）
- `cast.js`：人物造型（曹操、杨修、传令兵；进贤冠）和竹简
- `setC.js`：布景 C 府中厅堂（夜）
- `shot19.js`：分镜 19（招牌镜头 3）
- `sfx.py`：程序合成音效（木鱼、编钟感单击、脚步、风声）

准备：`npm install`（在本目录）；字体 `assets/fonts/LXGWWenKai-Medium.ttf`（霞鹜文楷，OFL，从 github.com/lxgw/LxgwWenKai releases v1.520 下载，不进仓库）；字幕用系统的文泉驿正黑。

```
node shot19.js sheet 84.7,85.5,86.7,87.8 out/sheet19.png   # 关键帧联系表（全片时间）
node shot19.js events > out/ev19.json && python3 sfx.py out/ev19.json 84.675 3.28 out/sfx19.wav
node shot19.js video out/shot19_raw.mp4 60
LANG_V=en node shot19.js ...                                 # 英文版
```
