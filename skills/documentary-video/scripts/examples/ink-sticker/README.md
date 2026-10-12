# 示例：墨线贴纸画风（用户确认过的样片）

规则见 `references/styles/ink-sticker.md`。纯 Canvas 2D（`@napi-rs/canvas`）逐帧绘制 → ffmpeg；声音全部程序合成。

| 文件 | 内容 |
|---|---|
| `char34.js` | **人物（2026-10-11 确认，人物一律用它）**：五官 v3（`eyeV2`、粗眉、3/4 透视的嘴、表情参数）；夜景光照参数（`recolor / litDir / rim / box`）；3/4 侧身；所有部件合成一个剪影只描一圈外轮廓；锥形连续四肢（`limbPoly`）；只在遮挡处补两头收尖的内线（`taper` + 部件的 `over`）；每个部件一档阴影；`buildMan(pose, spec)` → `renderFigure(ctx, x, gy, dir, fig, {scale, sx, sy})` |
| `night.js` | **夜景工具（通用）**：夜色调色板 `N(col, k)`、人物夜景参数 `nightOpts`（暖光受光面 + 月光轮廓）、阶梯式平涂光池 `pool`、火苗 `flame`、亮窗 `litWindow`、光晕 `halo`、夜空 `nightSky`、月亮 `moonDisc`、纸纹 `paperOverlay` |
| `night_example.js` | 夜景完整示例：广场夜里，火把旁打瞌睡的守卫 + 提灯笼踮脚走来的人（`node night_example.js out.png 2.3`） |
| `face_sheet.js` | 表情表：每个人物 × 7 种表情（平静、得意、吃惊、生气、发愁、鬼祟、睡着）的头部特写，新造型先跑它自查 |
| `bucket-60fps/` | 用 v2 做的 10 秒 **60fps** 样片：博洛尼亚广场，摩德纳士兵从井钩上偷走木桶 → 守卫跳起来发现 → 定住（音乐真空）→ 追出画面 → 空钩子还在晃。`sample.js`（画面 + 导出音效时间点）、`score_sample.py`（代码编曲总谱，动作全由乐器演）、`sfx_sample.py`（程序合成音效 + 合成 + -14 LUFS） |
| `pompeii.js` | 庞贝全景：线条画出火山、小城和海 → 地震、鸟飞走 → 火山先压扁再爆发（冲击短线、红色岩浆弹）→ 伞状烟柱、天色变暗、落灰、屋顶积灰 → 碎屑流吞没小城 → 灰白的新一页，逐字写出"庞贝" |
| `sound.py` | 上面那条的配乐与音效：A 小调拨弦 + 每次弹出一个"叮" + 铅笔声 → 地震时音乐跑调变慢 → 骤停 → 爆发 → 碎屑流轰鸣一刀切断 → 钢琴 + 写字声 |
| `street.js` | 面包房门口的人物和动物：面包师、孩子、狗、拉磨的驴、鸽子、猫。日常（举面包、扔球、狗跳起接球、拍手）→ 地震（动物先察觉、面包滑落弹到街上）→ 远处喷发（受惊弹起、狗狂吠、驴人立）→ 牵手逃离 → 空街、落灰，推镜头到地上的面包，写出结尾文字 |
| `street_sound.py` | 上面那条的声音：拨弦小调、鸟叫、烤炉噼啪；扔球、接球、拍手、狗叫、驴叫、扑翅、猫跳、面包弹跳；脚步按步态的每一步生成（人、狗爪、蹄子各一种）；远处爆炸偏右声道 |

`street.js` 里可直接复用的部分：`ik`、`gait`（不滑步的步态）、`skeleton` + `drawHuman`（人物造型 = 一组参数，见 `BAKER`、`KID`）、`drawDog`、`drawDonkey`、`drawPigeon`、`drawCat`、`blobs`（菜花状烟云）、`ink / fillP / shape / limb / eye`（抖线、错位上色、贴纸投影、面条肢体、眼睛）。

v2 样片运行（在 `bucket-60fps/` 里；`MK` = skill 的 `scripts/music`）：

```
node sample.js stills 1.3,3.9,4.7,5.45,6.15,8.4 sheet.png   # 关键帧联系表
node sample.js events                                       # → sfx_events.json
node sample.js video 60 raw60.mp4                           # 10 秒约 25 秒
python score_sample.py && python $MK/render.py music E:\music-kit\sfzmap.json && python $MK/mix.py music --duration 10
python sfx_sample.py                                        # → final.wav，并打印逐秒电平
ffmpeg -i raw60.mp4 -i final.wav -c:v copy -c:a aac -b:a 256k -shortest final.mp4
```

旧样片运行（需要 `npm install @napi-rs/canvas`、Python 的 numpy/scipy、ffmpeg；字体用的是 Windows 的楷体和微软雅黑）：

```
node street.js stills 1.7,2.42,3.8,4.5,5.6,6.6,7.3,9.5 sheet.png   # 关键帧联系表
node street.js strip 5.1 7.35 0.15 strip.png                        # 连续帧，看动作
node street.js events                                               # 写出 street_events.json（音效时间点）
node street.js video raw.mp4                                        # 渲染（10 秒约 1 分钟）
python street_sound.py                                              # → street_sound.wav，并打印逐秒电平
ffmpeg -i raw.mp4 -i street_sound.wav -c:v copy -c:a aac -b:a 256k -shortest final.mp4
```

示例没有旁白，时间写死在文件里；正式项目里分镜时长和跟词动作从 `audio/<语言>/shots.json`、`words.json` 读取（见 05-animation.md），配乐优先换成代码编曲（见 audio.md）。
