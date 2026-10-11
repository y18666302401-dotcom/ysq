# 实验：3/4 侧身角色（测试中，确认后再并入 skill）

- `test.html`：浏览器打开即可循环播放 8 秒。上：学者 3/4 侧身抬手讲解；中：猫 3/4 侧身，头转向镜头；下：同一份造型在 0°/20°/35°/55°/80° 的转面图。
- `test.mp4`：渲染好的视频；`test.jpg`：第 3.5 秒截图。
- `kit3q.js`：实验工具。角色在轻量 3D 里用截面圈搭成，按转身角度和俯视角投影，光栅化后描出一条外轮廓，再交给 `character_kit.figure()` 画合并描边和暗部。

借鉴的开源做法：
- Pose Animator（yemount/pose-animator）、Stretchy Studio（MangoLion/stretchystudio）：整体造型绑定骨骼、按参数变形，而不是部件拼接
- perfect-freehand（steveruizok/perfect-freehand）：按弧长收尖、带缓动的笔触 → `brush()`
- 弹簧跟随（follow-through）：尾巴每一节、胡子、衣摆比驱动它的动作晚一拍 → `follow()`
