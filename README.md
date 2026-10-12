# ysq

不露脸纪录片 / 科普短视频的制作技能与工具。

## 目录

```
skills/documentary-video/      Claude 技能：从选题到发布的完整流程（默认竖屏、中英双语成片）
├── SKILL.md                   入口：流程总览、默认设定、画风菜单
├── references/
│   ├── 01-topics.md … 07-publish.md   各阶段说明（选题、脚本、分镜、配音、动画、导出、发布）
│   ├── rules.md               通用规则（所有画风、所有题材）
│   ├── audio.md               音效、背景音乐的技术选择与混音
│   ├── comment-hooks.md       引导观众评论的互动钩子
│   ├── style-menu.md          每期选画风的做法与推荐逻辑
│   ├── visual-decisions.md    本期视觉设定由 Claude 自主决定的规则
│   └── styles/                画风（每期由用户从菜单里选）
│       ├── previews/          画风菜单图与单张预览
│       ├── hand-drawn-cinematic.md   ① 手绘 + 电影化 2.5D
│       ├── hand-drawn.md      ② 纯逐帧手绘
│       ├── glow.md            ③ 柔光动画
│       ├── flat.md            ④ 扁平插画
│       └── ink-sticker.md     ⑤ 墨线贴纸
└── scripts/
    ├── tts_gemini.py          Gemini TTS 配音
    ├── align_shots.py         配音对时与检查
    ├── subtitles.js           字幕断行、标色与绘制
    ├── frame_check.py         画面自查（与参考帧对比）
    ├── flat_toolkit.js        扁平插画工具库（液体变形、链条物理、手臂）
    ├── render_canvas_page.js  HTML 动画页 → MP4 / 联系表
    ├── mix_audio.py           混音（侧链闪避 + -14 LUFS 响度标准化）
    ├── music/                 代码编曲：mido 写谱 → sfizz + Surge XT 发声 → pedalboard 混音
    └── examples/
        ├── molasses-15s/      手绘 + 电影化 2.5D 样片（主画风）
        ├── fine-hand/         手绘笔触画法
        ├── atmos/             大气景观镜头
        ├── glow/              柔光动画样片
        ├── ink-sticker/       墨线贴纸样片与人物
        ├── character-rig/     人物骨架与表演
        ├── carrington-10s/    扁平插画样片
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
- Node.js；HTML 动画页渲染需要 `playwright`，canvas 渲染需要 `@napi-rs/canvas`
- 代码编曲：`bash skills/documentary-video/scripts/music/setup.sh` 一次装好（Surge XT、sfizz、采样库约 3 GB）；Windows 用 `setup_windows.py`
