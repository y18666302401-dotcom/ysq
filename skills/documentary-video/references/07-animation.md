# 阶段 7：用 HyperFrames 制作动画

> **没有 HyperFrames 的环境**（例如 claude.ai 网页对话）：扁平插画画风改用 `scripts/flat_toolkit.js` 的 canvas → ffmpeg 渲染管线，示例见 `scripts/examples/carrington-10s/`，用法见 styles/flat.md 的“实现工具”；Canvas 光影画风写成一个 HTML 动画页，用 `scripts/render_canvas_page.js` 渲染，示例见 `scripts/examples/sky-blue-15s/sky.html`，用法见 styles/canvas-light.md 的“实现要点”。逐帧手绘画风也可以照 Canvas 光影的 HTML 页 + 渲染管线来做。分镜时长、关键词时刻同样从 `audio/shots.json` 读取。

## 开始前

1. 读 `references/rules.md`、所选画风文件，以及 PROJECT.md 的"本期视觉设定"。
2. 调用 `/hyperframes` skill，按它的规范写 composition。命令行操作看 `/hyperframes-cli`，复杂动画看 `/gsap`。具体写法以 skill 为准，不要凭记忆写，版本更新后 API 可能变化。
3. 画布尺寸按 PROJECT.md 的画幅。帧率按画风文件（逐帧手绘输出 24fps 并一拍二，其余默认 30fps）。每个分镜的时长等于 STORYBOARD.md 里配音后的真实时长。
4. 不使用 3D，所有画面用 2D 绘制（Canvas、SVG、HTML），空间感用分层视差和镜头推拉表现。

## 确定性

渲染时会逐帧跳到指定时间截图，动画必须是时间的纯函数：

- 禁止用 `Math.random`、`Date.now`、`requestAnimationFrame` 控制动画。需要随机的形状、抖动，用固定种子的伪随机数。
- Canvas 自绘写成 `render(t)`，监听 HyperFrames 的 `hf-seek` 事件，用事件里的时间重画当前帧。具体接入方式先查 `/hyperframes` skill。
- 物理效果（摆动、滑动、坠落、碰撞）用固定步长预先积分，按时间查表取值。

## 音画同步

AI 配音的语速每次可能不同，所以动画的时间不要写死成固定秒数，而是从音频推导：

- **分镜时长**：从 `audio/shots.json`（整段配音对时后得到的每个分镜起止时间）读取，不要手填数字。
- **跟词走的动作**：盖章、标签弹出、红线连接、关键数字出现这类需要和某个词同步的动作，时间点从 `audio/words.json` 里那个词的开始时间读取，不要写"第 2.3 秒"。
- **其余动作**：入场和组装动作集中在分镜的前段，结尾的稳定段负责吸收时长变化。这样某段音频变长或变短时，只是稳定段长短不同，画面节奏不会乱。

做到这三点，重录某段配音后，只要重新读取时长和词级时间戳，动画就会自动对上。重录后仍要抽查该分镜，确认节奏正常。

## 动画规则

按 rules.md 的"动效"一节和所选画风文件的动效规则执行。另外：

- **一致性**：同一个人物、物品、地图在不同分镜里使用同一份设计或素材，大小比例和外观保持一致。
- **招牌镜头先行**：先把本期视觉设定里的第一个招牌镜头做出来给用户确认动画质感，确认后再逐个分镜铺开。

## 声音

画面做到哪里，对应的音效事件就记录到哪里：每个分镜把事件（时间、类型、强度）追加到 `audio/sfx_events.json`，供合成音效和混音使用，保证声音和画面动作严格对齐。格式、音效与 BGM 的技术选择和混音见 audio.md。

## 制作节奏

- 每完成 3–5 个分镜：运行 `npx hyperframes lint`（必须零错误），截取每个分镜的 2–3 张关键帧，对照 rules.md 和画风文件的禁止清单自查：排版是否拥挤、元素是否遮挡关键信息、文字是否可读、是否出现禁止的样式或没有含义的装饰、暂停测试是否通过。自己修好后，打开 `npx hyperframes preview` 请用户查看。
- 用户的风格反馈记进 PROJECT.md 的"风格补充"一节，后面的分镜都遵守。
- 在 TODO.md 里维护分镜完成情况。
