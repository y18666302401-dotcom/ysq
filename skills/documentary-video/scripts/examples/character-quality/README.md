# 角色造型前后对比（6 秒，竖屏）

- `compare.html`：上排猫、下排人物；左边是原来的几何体拼接（每块各描一圈边、等粗四肢、正圆的头），右边是用 `../../character_kit.js` 画的同一个角色。浏览器直接打开即可循环播放。
- `compare.jpg`：第 3.2 秒的截图。

右边用到的做法（详见 `references/characters.md`）：

| 做法 | 位置 |
|---|---|
| 躯干、头用 `blob` 控制点画，耳朵和腮毛并进同一条轮廓 | `newCat` 里的 `TORSO`、`head` |
| 四肢、尾巴用 `tube`，粗细曲线写出肌肉和关节 | `legF`、`legR`、`tail` |
| 尾巴和躯干放在同一层，合并轮廓，没有接缝 | 第二个 `figure` |
| 近侧四肢、后脑、人物肩膀用 `joins`，边线在关节处淡出 | `joins: [...]` |
| 急弯的肘部拆成上臂、前臂两段，同一层合并 | `newMan` 里的 `upper`、`fore` |
| 内部结构线、眼皮、胡须用两头收尖的 `ink` | 各图层的 `after` |

渲染成视频或抽帧：
```bash
node ../../render_canvas_page.js compare.html out/compare.mp4
node ../../render_canvas_page.js compare.html out/sheet.png --stills 0.5,2,3.2,5
```
