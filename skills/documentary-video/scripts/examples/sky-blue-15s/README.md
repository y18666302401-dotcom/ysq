# Canvas 光影样片：天空为什么是蓝的（15 秒，竖屏 1080×1920）

用户确认过效果的 Canvas 光影画风样片。画风规则见 `references/styles/canvas-light.md`。

- `sky.html`：整个样片就是这一个文件。用浏览器打开可以播放、拖时间轴；页面导出了 `window.VIDEO` 和 `window.renderFrame`，可以直接渲染成视频。
- 字体从 Google Fonts 加载，渲染时需要联网；离线时会退回系统字体。

```bash
# 抽 6 帧拼成联系表，自查画面
node ../../render_canvas_page.js sky.html out/sheet.png --stills 0.5,2,5,7,10,13.5
# 渲染全片（约 2–3 分钟）
node ../../render_canvas_page.js sky.html out/sky.mp4
```

结构：`sceneA`（黎明远山与标题）→ 推进太阳 → `sceneB`（光束穿过空气分子，蓝光被散射）→ `sceneC`（白天蓝天、剪影人物、散射光汇入眼睛、公式）。`render(t)` 负责按时间调度三个场景的交叠，最后统一叠字幕、暗角和胶片颗粒。
