# ysq

不露脸纪录片 / 科普短视频的制作技能与工具。

## 目录

```
skills/documentary-video/      Claude 技能：从选题到发布的完整流程
├── SKILL.md                   入口：流程总览、开工时要问用户的设定
├── references/
│   ├── 01-topics.md … 09-publish.md   各阶段说明
│   ├── rules.md               通用规则（所有画风、所有题材）
│   ├── audio.md               音效、背景音乐的技术选择与混音
│   └── styles/                画风（开工时由用户选，不默认）
│       ├── canvas-light.md    Canvas 光影
│       ├── flat.md            扁平插画
│       └── hand-drawn.md      逐帧手绘
└── scripts/
    ├── tts_gemini.py          Gemini TTS 配音
    ├── align_shots.py         配音对时与检查
    ├── flat_toolkit.js        扁平插画工具库（液体变形、链条物理、手臂）
    ├── render_canvas_page.js  Canvas 光影渲染管线（HTML 动画页 → MP4 / 联系表）
    ├── mix_audio.py           混音（侧链闪避 + -14 LUFS 响度标准化）
    ├── music/                 代码编曲：mido 写谱 → sfizz + Surge XT 发声 → pedalboard 混音
    └── examples/
        ├── carrington-10s/    扁平插画样片
        ├── sky-blue-15s/      Canvas 光影样片
        └── cat-cartoon-15s/   2D 动画片样片（含代码编曲的配乐与音效）
```

## 安装技能

- **Claude Code**：把 `skills/documentary-video` 复制到 `~/.claude/skills/`（或项目的 `.claude/skills/`）。
- **claude.ai**：把 `skills/documentary-video` 文件夹压缩成 zip（zip 里第一层就是 `documentary-video/`），在 设置 → 功能 → 技能 里上传。

```bash
cd skills && zip -r ../documentary-video.zip documentary-video
```

## 依赖

- ffmpeg
- Python 3（配音对时需要 `faster-whisper scipy`；混音只需要 ffmpeg）
- Node.js；Canvas 光影渲染需要 `playwright`，扁平插画渲染需要 `@napi-rs/canvas`
- 代码编曲：`bash skills/documentary-video/scripts/music/setup.sh` 一次装好（Surge XT、sfizz、采样库约 3 GB）
