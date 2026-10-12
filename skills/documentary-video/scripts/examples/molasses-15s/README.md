# 示例：波士顿糖蜜洪灾 15 秒（用户确认的主画风）

用户确认过的"手绘 + 电影化 2.5D"样片源码。做动画前先读 `hand25d.js`，分层合成、景深、对焦、调色按它改，不要从零写。**画线、上色、排线已升级为 `../fine-hand/brush.js`**，不要再用这里的 ink / fill / hatch；调色还要补一条对比度曲线（见 styles/hand-drawn-cinematic.md）。

| 文件 | 作用 |
|---|---|
| `story.js` | 故事时间线与几何：镜头、浪的形状、铆钉和立柱的物理、行人、字幕时间。两种画风共用，换题材时整个重写 |
| `common.js` | 字体注册、字幕（关键词按时刻变色弹跳）、纸纹 / 颗粒 / 暗角、canvas → ffmpeg 渲染管线 |
| `hand25d.js` | **主画风**：手绘绘制函数（墨线颤动、错位上色、排线、手绘特效）+ 四层 2.5D 合成（景深、对焦转移、光束、空气透视、调色） |
| `hand.js` | 不加电影化处理的纯逐帧手绘版（对照用） |
| `sound.py` | 程序合成的配乐与音效，时间点读 `events.json`（`node story.js` 生成） |

运行（需要 `npm install @napi-rs/canvas`、Python 的 numpy/scipy、ffmpeg）：

```
node story.js                                  # 写出 events.json
node hand25d.js stills 0.3,2.6,7.05,10.5 s.png # 抽帧检查
node hand25d.js video raw.mp4                  # 渲染（15 秒约 2.5 分钟）
python sound.py                                # → sound.wav
ffmpeg -i raw.mp4 -i sound.wav -c:v copy -c:a aac -shortest final.mp4
```

注意：`common.js` 里的字体路径是 Windows 的（`C:/Windows/Fonts/msyhbd.ttc`、`simkai.ttf`），其他系统要换成本机字体。示例没有旁白，字幕时间写死在 `story.js`；正式项目里时间从 `audio/<语言>/shots.json` 和 `words.json` 读取。
