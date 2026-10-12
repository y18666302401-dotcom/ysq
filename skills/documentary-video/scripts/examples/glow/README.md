# 示例：柔光动画（可选画风）

照参考片（推石头的小机器人，夜 → 黎明）的画法：前景主体干净的粗描边 + 沿光渐变 + 材质纹理 + 内边光；背景不描边、靠明度分层；暖光、泛光、散景。规则见 `references/styles/glow.md`，参考帧 `references/styles/glow-ref/`。

| 文件 | 作用 |
|---|---|
| `glow.js` | 画法：`outline` 干净描边、`fillLit` 沿光渐变、`texture` 斑驳 + 拉丝 + 颗粒、`innerRim` 内边光、`bevelTop` 顶面斜边、`body` 以上一次画完、`eyes` 药丸眼（open/happy/strain/closed）、`rock` 岩石、`zigzagNet` 锯齿发光裂纹、`pine/forest` 风格化松树、`rimDashes` 坡顶亮虚线、`bokeh` 散景、`skyStreaks` 天空光带 |
| `glow_motion.js` | 12 秒完整样片：分层视差合成（atmos.js + motion.js）、人物（豆形身体 + 圆头 + 药丸眼 + 带描边的肢体）、房子、村子灯火、提灯的人汇聚、天色推移、日出闪白、泛光 `bloom`、调色、canvas → ffmpeg 渲染 |

```
node glow_motion.js stills 0.4,4,11.6 s.png   # 抽帧
node glow_motion.js video sample.mp4          # 渲染（约 1 秒/帧）
python ../../frame_check.py sample.mp4 --times 4,11.6 --out check/x --style glow --night
```
