# 音效与背景音乐

声音分四轨：**旁白、背景音乐（BGM）、环境声、动作音效**。旁白见 06-voice.md；本文件管其余三轨和最后的混音。通用要求（每集四轨都要有、高潮可用突然安静）见 rules.md 的"声音"一节。

## 用哪种技术：分轨选择

| 轨道 | 默认方案 | 可选升级 | 为什么 |
|---|---|---|---|
| 动作音效（滴答、撞击、盖章、液体、嗖的一声） | **程序合成**（numpy/scipy 或 Web Audio） | 用代码编曲时，直接用乐器演奏（木琴、定音鼓、镲） | 免费、零版权风险、和动画用同一组时间点，帧级对齐；短促的合成音效听起来就很好 |
| 环境声（风、海浪、雨、人群、机器） | **CC0 素材库** | ElevenLabs 文本生成音效（付费） | 写实的环境声程序合成很难做像；素材库质量高、免费 |
| 背景音乐 | **问用户**，推荐**代码编曲**（写谱 → 真乐器采样 + 合成器 → 混音） | Lyria 3、免版税曲库 | 编曲级可控：节奏、和弦、每个声部、每个强弱变化都能卡到画面和口播的具体时刻；免费、可商用 |
| 混音 | **`scripts/mix_audio.py`**：侧链闪避 + 两遍响度标准化 | — | 自动跟着旁白压低音乐，重录配音后不用重调；统一到平台推荐响度 |

### 动作音效：程序合成（保留，这是它的强项）

- 做法见 `scripts/examples/carrington-10s/sound.py`：衰减正弦做金属"叮"、低频扫频做"咚"、高通噪声做"滴答"、带通噪声加起伏做液体流动、带通噪声包络做铅笔沙沙。
- 时间点**从动画读取**，不手填：动画阶段每个分镜导出事件列表 `audio/sfx_events.json`，合成脚本照它放音效。
  ```json
  [{"t": 2.90, "type": "thud", "gain": -16}, {"t": 4.12, "type": "clink", "gain": -12}]
  ```
  物理模拟得到的时刻（如 `chainSim` 返回的 `tCatch`）、`words.json` 里的词时刻，都直接写进这个列表。
- Canvas 光影画风也可以在同一个 HTML 页里用 Web Audio 的 `OfflineAudioContext` 合成音效：和画面共用一份时间表，预览时直接有声，渲染时导出 wav。两种实现选一种，全片统一。

### 环境声：CC0 素材库

按顺序找，下载前确认许可，登记进 `assets/SOURCES.md`（类型写"音频"）：
1. **Freesound.org**：搜索时把许可筛选为 **Creative Commons 0**（CC BY 的也能用，但要署名；CC BY-NC 的**不能**用于有收益的频道）。
2. **Sonniss GDC 免费音效包**：每年发布的专业音效合集，免版税、可商用、不需署名。
3. **Pixabay 音效**：Pixabay 许可，可商用、不需署名。
- **不要用 BBC Sound Effects**：它的许可只允许个人、教育和研究用途，开了收益的频道不能用。
- 环境声铺满整个场景，首尾各做 0.5–1 秒淡入淡出；场景切换时两段环境声交叉过渡。

可选升级：**ElevenLabs Sound Effects**（输入文字描述生成音效，付费方案才能商用，价格以官网为准）。找不到合适素材、又需要很具体的声音时，提出这个方案由用户决定，算作"AI 生成素材"，同样要登记。

### 背景音乐：开工前问用户选哪种

推荐方案是 **D. 代码编曲**（下面单独一节）。AI 生成音乐贵，而且只能控制风格，节奏、配器、音高、强弱都没法精确对齐口播；代码编曲是先把曲子写成谱，再给每个声部挑真乐器采样或合成器音色，和画面用同一条时间轴。

| 方案 | 说明 | 成本与注意 |
|---|---|---|
| **A. Lyria 3（AI 作曲）** | Google 的音乐生成模型，走 Gemini API，**和配音用同一个 Gemini Key**。`lyria-3-clip-preview` 固定生成 30 秒片段（适合做循环底乐），`lyria-3.5` 生成几分钟的完整曲子，44.1 kHz 立体声 | 2026 年 9 月起公开预览，模型名和接口以官方文档为准，首次使用先查文档；生成的音乐带 SynthID 隐形水印；属于 AI 生成素材，**必须先征得用户同意**；按 09-publish.md 提醒用户上传时按平台规则勾选 AI 披露 |
| **B. 免版税曲库** | YouTube 音频库（YouTube Studio 里，筛选"无需署名"）、Pixabay Music | 免费；YouTube 音频库的曲子只能保证在 YouTube 上用，发到别的平台前确认条款 |
| **C. 程序合成垫音** | 现有 sound.py 的正弦和弦垫音 | 免费、无版权问题，但听感单薄；只用于样片或用户明确要求时 |
| **D. 代码编曲（推荐）** | mido 写谱 → sfizz 演奏 SFZ 采样乐器（钢琴、弦乐、木琴、鼓）+ pedalboard 加载 Surge XT 合成器 → pedalboard 混音 | 免费；采样库的许可见下（鼓组是 CC BY-SA）；第一次要装环境（`scripts/music/setup.sh`，约 3 GB） |

**Lyria 的提示词要点**（纯器乐，不要人声）：写清情绪走向、乐器、速度和时长，例如 "cinematic ambient, instrumental only, no vocals, soft piano and warm strings, slow 70 bpm, starts calm and mysterious, gradually builds hope, 90 seconds"。按本期色彩脚本分段的话，每个情绪段落生成一段，在段落交界处做 2 秒交叉淡化。

**音乐要服务旁白**：选或生成时避开人声、强烈鼓点和抢旋律的独奏乐器；高潮前可以留 1–2 秒空白（"突然安静"）。

## 代码编曲：`scripts/music/`

完整示例：`scripts/examples/cat-cartoon-15s/`（15 秒卡通样片，配乐和音效都用这套方法做，总谱是 `scripts/music/score_cat_example.py`）。

**四步流水线**

| 步骤 | 工具 | 做什么 |
|---|---|---|
| 1 写谱 | `score_*.py`（mido） | 把编曲写成音符事件，一个声部一个 MIDI 文件；合成器声部直接给出以秒为单位的音符 |
| 2 采样乐器发声 | `render.py` → `sfizz_render` | 每个声部一个 SFZ 乐器；SFZ 是纯文本，起音、释音、力度区、轮换都能直接改 |
| 3 合成器发声 | `render.py` → pedalboard + Surge XT | 装入 Surge XT 的出厂音色（3000 多个 .fxp），做铺底和琶音 |
| 4 混音 | `mix.py`（pedalboard） | 每轨按"有声部分"对齐到目标电平 → 各自的效果链 → 总线压缩限幅 → 两遍响度标准化 |

```bash
bash scripts/music/setup.sh ~/music-kit                       # 第一次：装 Surge XT、编译 sfizz、下采样库，生成 sfzmap.json
python3 scripts/music/score_cat_example.py out                 # 写谱（新的一期照这个文件写自己的总谱）
python3 scripts/music/render.py out ~/music-kit/sfzmap.json    # 渲染分轨 out/stems/*.wav
python3 scripts/music/mix.py out --duration 15                  # 混音 → out/music_final.wav（-16 LUFS）
```
有口播时，把 `music_final.wav` 当作 `--bgm` 交给下面的 `mix_audio.py`，和旁白一起做闪避和响度。

**写谱的规则**

- **先定速度和起点，让关键时刻落在拍点上**：从分镜和 `audio/shots.json` 里挑出最重要的 2–4 个时刻（转折、撞击、标题出现），选一个速度和起始偏移，使它们都落在拍上。差一点的，改动画的时间去对音乐（两边共用一条时间轴，改哪边都行）。
- **结构跟着故事走**：每个段落对应一段剧情，在 PROJECT.md 的色彩脚本旁边写下"这一段用什么声部、什么和弦、往哪推"。
- **层层叠出推进感**：铺底一小节一个和弦 → 钢琴一拍两个音 → 琶音一拍四个音；要安静时整组声部一起停。
- **去机器味**：每个音的力度随机 ±6，时间随机 ±0.02 拍；但卡画面的音不加时间抖动。
- **弦乐要渐强进入**：采样原本起音只有几毫秒，SFZ 里把 `ampeg_attack` 改到约 0.28 秒，再用 CC11 在每个和弦上做渐强。
- **音效也用乐器演奏**（卡通片的 Mickey-Mousing 手法，适合 2D 动画片和扁平插画）：松手"叮"用拨弦 + 木琴、翻身"嗖"用木琴上行三连音、落地用定音鼓 + 对镲、闪光用钢片琴。写在同一份总谱里，天然对齐。
- **垫在口播下面时**：避开旁白的频段和节奏，旋律乐器少用，铺底和琶音为主；说话密集的段落减声部。

**用到的音源**（许可已对照各仓库的 LICENSE 文件核实）

| 音源 | 用途 | 许可 |
|---|---|---|
| Salamander Grand Piano（SFZ 版） | 钢琴 | CC BY 3.0，需署名 |
| VSCO-2 Community Edition | 弦乐（长音、拨弦）、木琴、钢片琴、定音鼓、镲 | CC0，不需署名 |
| Sam's Sonor 鼓组 | 底鼓、军鼓、闭镲、边击 | **CC BY-SA 4.0**：要署名，而且"相同方式共享"可能要求整首配乐也用同样的许可发布。商用频道想避开这一点，就换成 VSCO-2 里的 CC0 鼓（`VSCO 1 Percussion/drums/`），先问用户 |
| Surge XT 出厂音色 | 铺底、琶音 | 合成器 GPL-3.0，用它渲染出来的声音不受限制 |

需要署名的登记进 assets/SOURCES.md，发布时写进简介。

**这次踩过的坑**

- **VSCO-2 只有 wav，没有 SFZ**：用 `sfz_gen.py` 按文件名生成。它的文件名用"C3 = 中央 C"的记法，实测每个采样都比文件名高一个八度，脚本已经统一加了 12 个半音。
- **pedalboard 不能直接读 Surge 的 .fxp**：Surge 的插件状态就是 .fxp 去掉前 60 字节的文件头，`surge_state.py` 负责替换；换音色后要先空跑一次，Surge 在下一次处理时才真正换上。
- **sfizz 输出有直流偏移**（约 -90 dBFS）：录得轻的声部要加 40 dB 以上的增益，不处理会变成持续的低噪。`mix.py` 在每轨最前面加了 30 Hz 高通和噪声门。
- **打击乐采样开头可能有静音**：有的录音在击打前空了 0.1 秒，"砰"会比画面晚两三帧。`sfz_gen.py` 会自动用 `offset` 跳过。
- **检查对齐不能靠听感**：用起音检测量出每个关键音的时刻，和画面事件的时间比，误差要小于一帧（24fps 时 42 毫秒）。

## 混音：`scripts/mix_audio.py`

```bash
python <skill目录>/scripts/mix_audio.py \
  --voice audio/narration.wav --bgm audio/bgm.wav --sfx audio/sfx.wav \
  --out audio/mix.wav --video out/video.mp4 --final out/final.mp4
```

- 音乐用旁白做**侧链压缩**：有人说话时自动压低约 10 dB，停顿处约 0.6 秒内回升。压得不够或太狠时调 `--duck`、`--bgm-gain`。
- 音效不参与闪避，用 `--sfx-gain` 整体调；个别音效的轻重在 `sfx_events.json` 的 `gain` 里调。
- 最后两遍 loudnorm，统一到 **-14 LUFS、真峰值 -1.5 dBTP**（YouTube、B 站、抖音都适用），脚本会打印混音前后的响度，写进检查报告。
- 只有 ffmpeg 就能跑，不需要 numpy。

## 检查（逐段，不能只看平均值）

- 每句旁白的时间窗里都有人声，且音乐没有盖过旁白（逐个分镜听，或用 volumedetect 量旁白窗口内外的音量差）。
- 每个"跟词走"的音效和画面动作对上（抽查联系表或成片对应帧）。
- 成片综合响度在目标值 ±1 LU 内，真峰值不超过 -1 dBTP。
- 所有音乐和环境声素材都在 SOURCES.md 里，需要署名的进 PUBLISH.md。
