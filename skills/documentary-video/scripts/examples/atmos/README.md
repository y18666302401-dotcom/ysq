# 示例：大气景观镜头（画面 + 动画）

从一段参考片（小机器人推巨石上坡 → 一群同伴赶来 → 巨石裂开发光 → 闪白变成朝阳）提炼出来的画面和运动语汇，按纪录片的用法重写。规则见 `references/styles/hand-drawn-cinematic.md` 第 11 节。

| 文件 | 作用 |
|---|---|
| `atmos.js` | 画面：空气透视山脊叠层（`ridges`，带 `before/after` 钩子按层设视差、往山脊上放东西）、谷间雾、低空雾带、渐变天空、云、星、月、太阳光晕、暖光 `glow` 与溢光 `spill`、逆光草边、松树剪影、四套色板 `PAL`、对比度曲线 |
| `motion.js` | 动画：`camAt` 镜头关键帧、`layerXf` 按视差系数设图层变换、`handheld` 手持 + 冲击震动、`blendPal` 天色推移、`convoy` 一变多、`lightUp` 依次点亮、`fall` 重力、`crackTree/drawCracks` 裂纹蓄光、`embers` 火星、`flash` 闪白、`shockRing` 冲击波环、`debris` 碎块；全是 t 的纯函数，可随意 seek |
| `sample.js` | 同一机位夜景 / 黄昏两张静帧（`references/styles/atmos-ref/` 的来源） |
| `motion_sample.js` | 12 秒动态样片：特写拉远揭示 → 静止 → 村子灯火依次亮、提灯的人沿小路汇聚 → 天色推移 → 太阳越过山脊闪白 + 冲击波 → 缓慢推近 |

运行（需要 `@napi-rs/canvas` 和 ffmpeg；可用 `NODE_PATH` 指到项目的 node_modules）：

```
node sample.js out/                                  # 两张静帧
node motion_sample.js stills 0,1.6,3.5,6.2,9.45 s.png  # 抽帧检查
node motion_sample.js video sample.mp4               # 渲染 12 秒（约 1 秒/帧）
```

一帧的合成顺序：天空（p=0）→ 月 / 太阳 / 云（p≈0.05–0.1）→ 山脊每层（p 0.15→0.6，在 `before` 里设变换）→ 低空雾（p≈0.7）→ 主体层（p=1：地面、房子、人、暖光）→ 调色（对比度曲线、颗粒、暗角）→ 闪白 / 冲击波 → 字幕。
