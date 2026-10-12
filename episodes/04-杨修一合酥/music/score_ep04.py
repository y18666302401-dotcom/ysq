#!/usr/bin/env python3
"""第 4 期《杨修一合酥》总谱：汉代五声，低音拨弦（筝当古琴）、编钟（管钟）、埙（陶笛）、建鼓（框鼓）、锣、木鱼、拍板、梆子。

和画面共用一条时间轴：所有时刻都从 audio/<语言>/shots.json 和动画导出的音效事件（events_<语言>.json）推出，
所以中英文两个版本各渲染一份，关键时刻都落在各自的画面上。音符直接写成"秒"（MIDI 速度固定 60 BPM，1 拍 = 1 秒）。

段落（PROJECT.md 的配乐设定）：
  1 鸡肋令（分镜 1–7）    D 宫，散板：建鼓慢拍 + 埙长音 + 筝低音散音；令签拍案 = 鼓 + 小锣
  2 悬念（分镜 8）          灯灭那一刻全停 0.35 秒，一声低音编钟
  3 猜谜（分镜 9–14）      C 宫，轻快：筝一拍两个音 + 木鱼点拍；每猜中一次编钟"叮"（第 11、13、14 镜）
  4 回汉中（分镜 15–16）   回到建鼓 + 埙；撤军时梆子一下下走远
  5 转折（分镜 17–21）     书合上：骤停 → 大锣；A 羽调式，筝变稀、往低走；箱子掀开 = 锣
  6 秋（分镜 22–23）       只剩埙和一下建鼓
  7 提问（分镜 24）        编钟单音，余音盖住提问卡停留的 3.5 秒
用法: python score_ep04.py <项目根目录> zh|en <输出目录>
"""
import json, os, random, sys
import mido

root, lang, out = sys.argv[1], sys.argv[2], sys.argv[3]
SH = {s['id']: s for s in json.load(open(os.path.join(root, 'audio', lang, 'shots.json')))}
EV = json.load(open(os.path.join(root, 'anim', 'out', f'events_{lang}.json')))
END = SH['24']['end'] + 3.5
def evt(kind, after=0.0, before=1e9):
    for e in EV:
        if e['type'] == kind and after <= e['t'] <= before: return e['t']
    return None

rng = random.Random(4)
tracks = {}
def N(tr, t, d, p, v, human=True):
    if human: v += rng.randint(-6, 6); t += rng.uniform(-0.015, 0.015) if t > 0.05 else 0
    tracks.setdefault(tr, []).append((max(0.0, t), d, p, max(1, min(127, v))))

# 音名（C4 = 60）
C3, D3, E3, G3, A3 = 48, 50, 52, 55, 57
C4, D4, E4, G4, A4 = 60, 62, 64, 67, 69
C5, D5, E5, G5, A5 = 72, 74, 76, 79, 81
DRUM, DRUM_L, DRUM_M, SLIT_L, SLIT_H, GONG, GONG_P, GONG_F, WOOD, WOOD_S, CLAVES = 36, 37, 38, 41, 43, 45, 46, 47, 60, 61, 62
GL_UP, GL_DN = 48, 50

def silent(t0, t1):  # 这一段里所有声部的音都截掉（骤停）
    for tr, notes in tracks.items():
        tracks[tr] = [(t, min(d, max(0.05, t0 - t)) if t < t0 else d, p, v) for t, d, p, v in notes if not (t0 <= t < t1)]

# ---------- 1 鸡肋令：D 宫散板 ----------
t1_end = evt('silence') or SH['08']['end'] - 1
t = 0.4
while t < t1_end - 0.6:
    N('han_perc', t, 0.5, DRUM if int(t / 1.6) % 4 == 0 else DRUM_L, 92); t += 1.6
XUN1 = [D4, A3, D4, E4, D4, A3]
for i in range(40):                       # 埙：每 4.5 秒一个长音，一直到灯灭
    t0 = 0.3 + i * 4.5
    if t0 > t1_end - 1: break
    N('xun', t0, min(3.6, t1_end - t0 - 0.4), XUN1[i % len(XUN1)], 70)
ZH1 = [(1.2, D3), (2.0, A3), (5.6, G3), (6.2, A3), (9.8, D3), (10.4, E3), (14.8, A3), (15.3, G3), (16.0, D3), (20.2, A3), (21.0, D4), (24.6, A3)]
for rep in range(4):                      # 筝的散板句子每 26 秒重复一遍
    for t0, p in ZH1:
        t0 += rep * 26
        if t0 < t1_end - 0.5: N('guzheng', t0, 1.4, p + 12, 74)
N('zheng_gliss', 0.05, 2.5, GL_UP, 90, human=False)
slam = evt('slap', SH['03']['start'], SH['03']['end'])
if slam: N('han_perc', slam, 0.6, DRUM, 118, human=False); N('han_perc', slam, 2.0, GONG_P, 80, human=False)
# 将官面面相觑：梆子两下"笃笃"
N('han_perc', SH['04']['start'] + 0.6, 0.3, SLIT_H, 80); N('han_perc', SH['04']['start'] + 0.85, 0.3, SLIT_L, 80)
# 杨修转身（名牌）：编钟一声
N('bianzhong', SH['06']['start'] + 0.6, 2.0, A4, 70)

# ---------- 2 悬念 ----------
if evt('silence'): silent(t1_end, t1_end + 0.35); N('bianzhong', t1_end + 0.35, 4.0, D4, 96, human=False); N('han_perc', t1_end + 0.35, 3.0, GONG_P, 70, human=False)
# 灯灭之后到下一段之前：低低的"心跳"鼓 + 埙一个长音，不让画面空着
t, r0_ = t1_end + 1.6, SH['09']['start'] - 0.3
while t < r0_: N('han_perc', t, 0.4, DRUM_L, 84); N('han_perc', t + 0.28, 0.4, DRUM_L, 66); t += 1.4
if r0_ - t1_end > 2: N('xun', t1_end + 1.2, r0_ - t1_end - 1.4, A3 + 12 - 12 + 5, 62)

# ---------- 3 猜谜：C 宫，轻快（一拍 0.5 秒） ----------
r0, r1 = SH['09']['start'], SH['14']['end']
N('zheng_gliss', r0 - 0.1, 2.0, GL_UP, 96, human=False)
PHRASE = [C5, D5, E5, G5, E5, D5, C5, A4, G4, A4, C5, D5, E5, D5, C5, G4]
BASS = [C3, G3, A3, G3, C3, G3, E3, G3]
k, t = 0, r0 + 0.3
while t < r1 - 0.25:
    N('guzheng', t, 0.45, PHRASE[k % len(PHRASE)], 62 if k % 2 else 72)
    if k % 2 == 0: N('guzheng', t, 0.9, BASS[(k // 2) % len(BASS)] + 12, 64)
    if k % 4 == 0: N('han_perc', t, 0.2, WOOD_S, 52)
    t += 0.5; k += 1
for kind, lo, hi, p in [('ding', SH['11']['start'], SH['11']['end'], E5), ('ding', SH['13']['start'], SH['13']['end'], G5), ('squish', SH['14']['start'], SH['14']['end'], C5)]:
    tt = evt(kind, lo, hi)
    if tt: N('bianzhong', tt, 2.5, p, 100, human=False)
# 曹操写"活"、写"合"：木鱼点一下
for lo, hi in [(SH['10']['start'], SH['10']['end']), (SH['12']['start'], SH['12']['end'])]:
    tt = evt('brush', lo, hi)
    if tt: N('han_perc', tt, 0.2, WOOD, 90, human=False)

# ---------- 4 回汉中：建鼓 + 埙；撤军时梆子越走越远 ----------
h0 = SH['15']['start']; h1 = (evt('book_slam') or SH['17']['end'] - 1) - 0.3   # 一直走到书合上前的骤停
t = h0 + 0.2
while t < h1 - 0.4: N('han_perc', t, 0.5, DRUM_L, 84); t += 1.6
t = h0 + 0.1
for i in range(8):
    if t > h1 - 0.8: break
    N('xun', t, min(3.0, h1 - t - 0.2), [D4, A3, E4 - 12 + 12, D4][i % 4], 70); t += 3.2
N('guzheng', h0 + 0.2, 1.4, D4, 70); N('guzheng', h0 + 1.6, 1.4, A3, 66)
for i, tt in enumerate(e['t'] for e in EV if e['type'] == 'block' and h0 <= e['t'] <= h1): N('han_perc', tt, 0.3, SLIT_L if i % 2 else SLIT_H, 90 - i * 14, human=False)
rib = evt('thud', SH['16']['start'], SH['16']['end'])
if rib: N('han_perc', rib, 0.4, DRUM_M, 100, human=False)

# ---------- 5 转折：书合上 → 骤停 → 大锣；A 羽，往低处走 ----------
bk = evt('book_slam') or SH['17']['end'] - 1
silent(bk - 0.3, bk); N('han_perc', bk, 4.0, GONG, 112, human=False); N('han_perc', bk, 0.6, DRUM, 120, human=False)
t5 = SH['21']['end']
LOW = [A3, E3, G3, D3, E3, C3, D3, A3 - 12]
t, k = bk + 1.2, 0
while t < t5 - 0.4:
    N('guzheng', t, 1.8, LOW[k % len(LOW)] + 12, 66); t += 1.5 if k % 3 != 2 else 1.0; k += 1
N('xun', bk + 1.0, 3.5, A3, 60); N('xun', bk + 5.0, 3.0, E4 - 12 + 12, 58)
land = evt('slap', SH['19']['start'], SH['19']['end'])
if land:
    for i in range(3): N('han_perc', land + 0.02 + i * 0.09, 0.2, WOOD, 96 + i * 6, human=False)
    N('bianzhong', land + 0.3, 2.5, E4, 88, human=False)
crash = evt('crash_wood')
if crash: N('han_perc', crash, 3.0, GONG_F, 100, human=False); N('han_perc', crash, 0.5, DRUM, 112, human=False)
heir = evt('ding_low')
if heir: N('bianzhong', heir, 2.5, A3 + 12, 84, human=False)

# ---------- 6 秋 ----------
a0 = SH['22']['start']
N('xun', a0 + 0.2, 4.0, A3, 64); N('xun', a0 + 4.4, 4.2, E4 - 12, 60)
die = evt('gong')
if die: N('han_perc', die, 0.8, DRUM, 96, human=False)
N('guzheng', SH['23']['start'] + 0.4, 2.0, A3, 58); N('guzheng', SH['23']['start'] + 1.8, 2.4, E3 + 12, 54)

# ---------- 7 提问 ----------
nail = evt('nail')
if nail: N('han_perc', nail, 0.5, DRUM_M, 108, human=False); N('bianzhong', nail + 0.5, 6.0, A4, 92, human=False); N('xun', nail + 0.8, 3.0, A3, 52)
N('bianzhong', END - 3.0, 3.0, A3 + 12, 70, human=False)

# ---------- 写出 ----------
os.makedirs(os.path.join(out, 'midi'), exist_ok=True)
TPB = 960
for name, notes in tracks.items():
    mid = mido.MidiFile(ticks_per_beat=TPB); tr = mido.MidiTrack(); mid.tracks.append(tr)
    tr.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(60), time=0))
    ab = []
    for t, d, p, v in notes:
        ab.append((round(t * TPB), 2, mido.Message('note_on', note=p, velocity=v))); ab.append((round((t + d) * TPB), 1, mido.Message('note_off', note=p, velocity=0)))
    ab.sort(key=lambda x: (x[0], x[1])); last = 0
    for tk, _, m in ab: tr.append(m.copy(time=tk - last)); last = tk
    mid.save(os.path.join(out, 'midi', name + '.mid'))
json.dump({'bpm': 60, 'duration': END, 'surge': {}}, open(os.path.join(out, 'score.json'), 'w'))
print('声部：', ', '.join(f'{k}({len(v)})' for k, v in tracks.items()), f' 全长 {END:.2f}s')
