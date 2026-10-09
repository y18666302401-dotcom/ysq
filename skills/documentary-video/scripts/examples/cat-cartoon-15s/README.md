# 2D 动画片样片 + 代码编曲：猫为什么四脚着地（15 秒，竖屏）

- `cat.html`：画面（Canvas，`render(t)` 逐帧绘制，一拍二）+ 内嵌的配乐与音效（mp3）。浏览器打开点播放即可，播放时以音频时间为准驱动画面。
- 配乐总谱：`../../music/score_cat_example.py`；渲染与混音流程见 `references/audio.md` 的"代码编曲"。

画面和音乐共用一条时间轴（120 BPM，第 0 拍在 0.3 秒）：

| 时刻 | 拍 | 画面 | 声音 |
|---|---|---|---|
| 4.30 秒 | 8 | 马雷松手 | 拨弦 + 木琴"叮"，鼓和拨弦全停 |
| 4.42 秒 | — | 感叹号弹出 | 木琴两音 |
| 5.3 / 6.6 秒 | — | 前、后半身翻转 | 木琴上行三连音"嗖" |
| 9.30 秒 | 18 | 落地 | 定音鼓 + 对镲 + 全奏 D 大三和弦 |
| 11.80 秒 | 23 | 印章盖下 | 军鼓 + 钢琴和弦 + 木琴 |

实测起音与画面的误差都在一帧以内（落地 +30 毫秒，其余 0）。

渲染成片：
```bash
node ../../render_canvas_page.js cat.html out/video.mp4
ffmpeg -i out/video.mp4 -i <music_final.wav> -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest out/final.mp4
```
