# 音效与背景音乐

声音分四轨：**旁白、背景音乐（BGM）、环境声、动作音效**。旁白见 06-voice.md；本文件管其余三轨和最后的混音。通用要求（每集四轨都要有、高潮可用突然安静）见 rules.md 的"声音"一节。

## 用哪种技术：分轨选择

| 轨道 | 默认方案 | 可选升级 | 为什么 |
|---|---|---|---|
| 动作音效（滴答、撞击、盖章、液体、嗖的一声） | **程序合成**（numpy/scipy 或 Web Audio） | — | 免费、零版权风险、和动画用同一组时间点，帧级对齐；短促的合成音效听起来就很好 |
| 环境声（风、海浪、雨、人群、机器） | **CC0 素材库** | ElevenLabs 文本生成音效（付费） | 写实的环境声程序合成很难做像；素材库质量高、免费 |
| 背景音乐 | **问用户**：Lyria 3（AI 生成）或免版税曲库 | 程序合成垫音只作保底 | 程序合成的和弦垫音单薄、像合成器测试音，撑不起几分钟的片子 |
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

| 方案 | 说明 | 成本与注意 |
|---|---|---|
| **A. Lyria 3（AI 作曲）** | Google 的音乐生成模型，走 Gemini API，**和配音用同一个 Gemini Key**。`lyria-3-clip-preview` 固定生成 30 秒片段（适合做循环底乐），`lyria-3.5` 生成几分钟的完整曲子，44.1 kHz 立体声 | 2026 年 9 月起公开预览，模型名和接口以官方文档为准，首次使用先查文档；生成的音乐带 SynthID 隐形水印；属于 AI 生成素材，**必须先征得用户同意**；按 09-publish.md 提醒用户上传时按平台规则勾选 AI 披露 |
| **B. 免版税曲库** | YouTube 音频库（YouTube Studio 里，筛选"无需署名"）、Pixabay Music | 免费；YouTube 音频库的曲子只能保证在 YouTube 上用，发到别的平台前确认条款 |
| **C. 程序合成垫音** | 现有 sound.py 的正弦和弦垫音 | 免费、无版权问题，但听感单薄；只用于样片或用户明确要求时 |

**Lyria 的提示词要点**（纯器乐，不要人声）：写清情绪走向、乐器、速度和时长，例如 "cinematic ambient, instrumental only, no vocals, soft piano and warm strings, slow 70 bpm, starts calm and mysterious, gradually builds hope, 90 seconds"。按本期色彩脚本分段的话，每个情绪段落生成一段，在段落交界处做 2 秒交叉淡化。

**音乐要服务旁白**：选或生成时避开人声、强烈鼓点和抢旋律的独奏乐器；高潮前可以留 1–2 秒空白（"突然安静"）。

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
