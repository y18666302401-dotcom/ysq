#!/usr/bin/env python3
"""第 4 期《杨修一合酥》总谱：汉代五声，箜篌（民间竖琴）、埙（陶笛）、编钟（管钟）、建鼓（框鼓）、锣、木鱼、梆子。
用户 2026-10-12：筝的音色难听、旧旋律不好听 → 改成箜篌 + 埙混搭，并写了一个有问句 / 答句的主题。

和画面共用一条时间轴：所有时刻都从 audio/<语言>/shots.json 和动画导出的音效事件（events_<语言>.json）推出，
所以中英文两个版本各渲染一份，关键时刻都落在各自的画面上。音符直接写成"秒"（MIDI 速度固定 60 BPM，1 拍 = 1 秒）。

段落：
  1 鸡肋令（分镜 1–7）    D 宫：埙慢慢吹主题，箜篌分解和弦垫底，建鼓慢拍；令签拍案 = 鼓 + 小锣
  2 悬念（分镜 8）          灯灭那一刻全停 0.35 秒，一声低音编钟；之后心跳鼓 + 埙长音
  3 猜谜（分镜 9–14）      D 宫：箜篌轻快地奏主题 + 木鱼；每猜中一次编钟"叮"（第 11、13、14 镜）
  4 回汉中（分镜 15–16）   埙接问句、箜篌接答句；撤军时梆子一下下走远
  5 转折（分镜 17–21）     书合上：骤停 → 大锣；主题转 A 羽（偏悲），埙吹，箜篌只留低音；箱子掀开 = 锣
  6 秋（分镜 22–23）       埙独奏答句，一下建鼓
  7 提问（分镜 24）        编钟单音 + 箜篌一串上行，余音盖住提问卡停留的 3.5 秒
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

# ---------- 主题（用户 2026-10-12 选定：箜篌 + 埙混搭，不用筝） ----------
# 五声音阶的级数（0 = 宫/主音，5 = 高八度的宫）；问句落在 2 级，答句回到 0 级。宫调式听着明亮，羽调式偏悲
THEME = [(3, 1), (4, .5), (3, .5), (2, 1), (1, 1), (0, 1.5), (1, .5), (2, 2),
         (3, 1), (4, .5), (5, .5), (4, 1), (3, 1), (2, 1.5), (1, .5), (0, 2)]
GONG_D = [62, 64, 66, 69, 71]          # D 宫：D E F# A B
YU_A = [57, 60, 62, 64, 67]            # A 羽：A C D E G
def deg(scale, k, shift=0): return scale[k % 5] + 12 * (k // 5) + shift
def theme(tr, t0, t_end, bpm, scale, shift=0, v=74, half=None, legato=0.95):
    """从 t0 起按 bpm 演奏主题，到 t_end 前截止；half='A' 只奏问句，'B' 只奏答句。返回结束时刻。"""
    b = 60 / bpm; seq = THEME[:8] if half == 'A' else THEME[8:] if half == 'B' else THEME; t = t0
    for k, d in seq:
        if t + d * b * 0.5 > t_end: break
        N(tr, t, min(d * b * legato, t_end - t), deg(scale, k, shift), v); t += d * b
    return t
def harp_bed(t0, t_end, bpm, scale, shift=-12, v=56, arp=True):
    """箜篌垫底：每两拍一个低音，可带上行分解"""
    b = 60 / bpm; roots = [0, 3, 4, 3, 0, 4, 3, 0]; t, i = t0, 0
    while t < t_end - 0.3:
        r = deg(scale, roots[i % 8], shift); N('harp', t, 2 * b * 0.9, r, v)
        if arp: N('harp', t + b * 0.5, b * 1.2, r + 7, v - 10); N('harp', t + b, b, r + 12, v - 12)
        t += 2 * b; i += 1
def harp_gliss(t, up=True, v=80, scale=GONG_D):
    ks = list(range(0, 11)) if up else list(range(10, -1, -1))
    for i, k in enumerate(ks): N('harp', t + i * 0.035, 0.8, deg(scale, k, -12), v - i, human=False)

# ---------- 1 鸡肋令：埙吹主题（慢），箜篌垫底，建鼓慢拍 ----------
t1_end = evt('silence') or SH['08']['end'] - 1
harp_gliss(0.05, True, 76)
harp_bed(0.6, t1_end - 0.4, 60, GONG_D, -12, 54)
t = theme('xun', 1.2, t1_end - 0.5, 56, GONG_D, -12 + 12, 70)
if t < t1_end - 4: theme('xun', t + 0.8, t1_end - 0.5, 56, GONG_D, 0, 66, half='B')
t = 0.6
while t < t1_end - 0.6:
    N('han_perc', t, 0.5, DRUM if int(t / 2) % 4 == 0 else DRUM_L, 86); t += 2.0
slam = evt('slap', SH['03']['start'], SH['03']['end'])
if slam: N('han_perc', slam, 0.6, DRUM, 118, human=False); N('han_perc', slam, 2.0, GONG_P, 80, human=False)
N('han_perc', SH['04']['start'] + 0.6, 0.3, SLIT_H, 80); N('han_perc', SH['04']['start'] + 0.85, 0.3, SLIT_L, 80)
N('bianzhong', SH['06']['start'] + 0.6, 2.0, A4, 70)

# ---------- 2 悬念：灯灭——全停，一声低音编钟；然后低低的心跳鼓 + 埙长音 ----------
if evt('silence'): silent(t1_end, t1_end + 0.35); N('bianzhong', t1_end + 0.35, 4.0, D4, 96, human=False); N('han_perc', t1_end + 0.35, 3.0, GONG_P, 70, human=False)
t, r0_ = t1_end + 1.6, SH['09']['start'] - 0.3
while t < r0_: N('han_perc', t, 0.4, DRUM_L, 80); N('han_perc', t + 0.28, 0.4, DRUM_L, 62); t += 1.4
if r0_ - t1_end > 2: N('xun', t1_end + 1.2, r0_ - t1_end - 1.4, A3 + 5, 60)

# ---------- 3 猜谜：箜篌奏主题（轻快，宫调式），分解和弦垫底，木鱼点拍 ----------
r0, r1 = SH['09']['start'], SH['14']['end']
harp_gliss(r0 - 0.1, True, 84)
t = r0 + 0.4
while t < r1 - 1.0:
    t = theme('harp', t, r1 - 0.3, 92, GONG_D, 0, 76, legato=0.9) + 0.0
harp_bed(r0 + 0.4, r1 - 0.3, 92, GONG_D, -12, 50)
t = r0 + 0.4
while t < r1 - 0.3: N('han_perc', t, 0.2, WOOD_S, 48); t += 60 / 92 * 2
for kind, lo, hi, p in [('ding', SH['11']['start'], SH['11']['end'], E5), ('ding', SH['13']['start'], SH['13']['end'], G5), ('squish', SH['14']['start'], SH['14']['end'], C5 + 2)]:
    tt = evt(kind, lo, hi)
    if tt: N('bianzhong', tt, 2.5, p, 100, human=False)
for lo, hi in [(SH['10']['start'], SH['10']['end']), (SH['12']['start'], SH['12']['end'])]:
    tt = evt('brush', lo, hi)
    if tt: N('han_perc', tt, 0.2, WOOD, 90, human=False)

# ---------- 4 回汉中：埙接问句、箜篌接答句；撤军时梆子越走越远 ----------
h0 = SH['15']['start']; h1 = (evt('book_slam') or SH['17']['end'] - 1) - 0.3
t = theme('xun', h0 + 0.2, h1, 64, GONG_D, 0, 70, half='A')
theme('harp', t + 0.2, h1, 64, GONG_D, 0, 70, half='B')
harp_bed(h0 + 0.2, h1, 64, GONG_D, -12, 50, arp=False)
t = h0 + 0.2
while t < h1 - 0.4: N('han_perc', t, 0.5, DRUM_L, 80); t += 1.875
for i, tt in enumerate(e['t'] for e in EV if e['type'] == 'block' and h0 <= e['t'] <= h1): N('han_perc', tt, 0.3, SLIT_L if i % 2 else SLIT_H, 90 - i * 14, human=False)
rib = evt('thud', SH['16']['start'], SH['16']['end'])
if rib: N('han_perc', rib, 0.4, DRUM_M, 100, human=False)

# ---------- 5 转折：书合上 → 骤停 → 大锣；主题转 A 羽，埙吹、箜篌稀疏低音 ----------
bk = evt('book_slam') or SH['17']['end'] - 1
silent(bk - 0.3, bk); N('han_perc', bk, 4.0, GONG, 112, human=False); N('han_perc', bk, 0.6, DRUM, 120, human=False)
t5 = SH['21']['end']
t = theme('xun', bk + 1.0, t5 - 0.3, 58, YU_A, -12 + 12, 66)
harp_bed(bk + 1.0, t5 - 0.3, 58, YU_A, -24 + 12, 50, arp=False)
land = evt('slap', SH['19']['start'], SH['19']['end'])
if land:
    for i in range(3): N('han_perc', land + 0.02 + i * 0.09, 0.2, WOOD, 96 + i * 6, human=False)
    N('bianzhong', land + 0.3, 2.5, E4, 88, human=False)
crash = evt('crash_wood')
if crash: N('han_perc', crash, 3.0, GONG_F, 100, human=False); N('han_perc', crash, 0.5, DRUM, 112, human=False)
heir = evt('ding_low')
if heir: N('bianzhong', heir, 2.5, A3 + 12, 84, human=False)

# ---------- 6 秋：埙独奏答句（羽调式），一下建鼓；箜篌两个低音 ----------
a0 = SH['22']['start']
theme('xun', a0 + 0.3, SH['23']['end'] - 0.2, 50, YU_A, 0, 64, half='B')
die = evt('gong')
if die: N('han_perc', die, 0.8, DRUM, 96, human=False)
N('harp', SH['23']['start'] + 0.4, 2.5, A3 - 12, 52); N('harp', SH['23']['start'] + 2.0, 2.5, E3, 48)

# ---------- 7 提问：编钟单音 + 箜篌一串上行，余音盖住停留 ----------
nail = evt('nail')
if nail: N('han_perc', nail, 0.5, DRUM_M, 108, human=False); N('bianzhong', nail + 0.5, 6.0, A4, 92, human=False); harp_gliss(nail + 0.8, True, 70, YU_A)
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
