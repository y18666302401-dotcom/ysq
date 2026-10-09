#!/usr/bin/env python3
"""《猫为什么四脚着地》15 秒样片的配乐与音效总谱：用 mido 把谱写成音符事件，一个声部一个 MIDI 文件。

画面里的关键时刻都卡在拍点上（120 BPM，一拍 0.5 秒，第 0 拍在 0.3 秒）：
  第 8 拍  = 4.3 秒   马雷松手，猫开始下落
  第 18 拍 = 9.3 秒   猫落地
  第 23 拍 = 11.8 秒  "翻正反射"印章盖下
音效也用乐器演奏（卡通片的 Mickey-Mousing 手法），和配乐写在同一份谱里，天然对齐。

结构（D 小调 → D 大调）：
  A  第 0–8 拍    实验室：拨弦 + 钢琴断奏，蹑手蹑脚；马雷抬手时钢琴半音上行
  B  第 8–18 拍   慢放下落：鼓和拨弦全停，弦乐长音渐强，合成器铺底和琶音一层层往上推，定音鼓和吊镲滚奏推到落地
  C  第 18–23 拍  落地后得意：D 大调，钢片琴配合画面里的闪光
  D  第 23–29 拍  结尾：主题回到大调，收在 D 大三和弦

用法: python score_cat_example.py <输出目录>   → 输出目录/midi/*.mid 和 输出目录/score.json
新的一期照这个文件另写一份总谱（声部、和弦、关键时刻都按本期的分镜和口播来定）。
"""
import json, os, random, sys
import mido

BPM, T0, TPB = 120, 0.3, 480
SEC = 60 / BPM
def beat(t): return (t - T0) / SEC          # 秒 → 拍
def sec(b): return T0 + b * SEC              # 拍 → 秒

rng = random.Random(7)
tracks = {}                                  # 声部名 → [(开始拍, 时值拍, 音高, 力度)] 或 ('cc', 拍, 控制器, 值)
def N(tr, b, d, p, v, human=True):
    """记一个音。human=True 时力度随机 ±6、时间随机 ±0.02 拍，避免机器味；卡画面的音不加时间抖动。"""
    if human: v += rng.randint(-6, 6); b += rng.uniform(-.02, .02) if b > 0 else 0
    tracks.setdefault(tr, []).append((max(b, 0), d, p, max(1, min(127, v))))
def chord(tr, b, d, ps, v, human=True): [N(tr, b, d, p, v, human) for p in ps]
def ramp(tr, b0, b1, c0, c1, cc=11, steps=24):
    for i in range(steps + 1): tracks.setdefault(tr, []).append(('cc', b0 + (b1 - b0) * i / steps, cc, round(c0 + (c1 - c0) * i / steps)))

# 音名
D2, A1 = 38, 33
G2, A2, Bb2, C3, Cs3, D3, E3, F3, G3, A3, Bb3 = 43, 45, 46, 48, 49, 50, 52, 53, 55, 57, 58
C4, Cs4, D4, E4, F4, Fs4, G4, A4, Bb4, B4 = 60, 61, 62, 64, 65, 66, 67, 69, 70, 71
C5, Cs5, D5, E5, F5, Fs5, G5, Gs5, A5, Bb5 = 72, 73, 74, 76, 77, 78, 79, 80, 81, 82
D6, E6, F6, Fs6, G6, A6, Bb6, D7, Fs7 = 86, 88, 89, 90, 91, 93, 94, 98, 102
KICK, RIM, SN, HAT = 36, 37, 40, 42                        # Sam's Sonor 鼓组键位
TIMP_HIT, TIMP_ROLL, CRASH, SUSP_ROLL, SUSP = 38, 50, 49, 51, 52

# ---------- A：实验室（第 0–8 拍）----------
for b, p in [(0, A4), (.5, D5), (1, F5), (1.5, E5), (2, D5), (2.5, Cs5), (3, D5),
             (4, Bb4), (4.5, D5), (5, G5), (5.5, F5), (6, E5)]:
    N('piano', b, .35 if b != 3 else .8, p, 72)
for i, p in enumerate([E5, F5, Fs5, G5, Gs5, A5]):          # 马雷抬手（3.25 秒起）：半音上行，越来越紧张
    N('piano', 6.5 + i * .25, .2, p, 60 + i * 6)
for b, p in [(0, D3), (1, A2), (2, D3), (3, A2), (4, G2), (5, D3), (6, A2)]:
    N('cellos_pizz', b, .5, p, 80)
for b in [.5, 1.5, 2.5, 3.5]: chord('violins_pizz', b, .3, [F4, A4, D5], 58)
for b in [4.5, 5.5]: chord('violins_pizz', b, .3, [G4, Bb4, D5], 58)
chord('violins_pizz', 6.5, .3, [G4, Cs5, E5], 64)
for i in range(12): N('drums', i * .5, .2, HAT, 42 if i % 2 else 50)   # 抬手前鼓就停，留出空白
for b in [1, 3, 5]: N('drums', b, .2, RIM, 60)
for b in [0, 2, 4]: N('drums', b, .3, KICK, 55)

# ---------- 松手（第 8 拍 = 4.3 秒）与"！"（4.4 秒）----------
N('violins_pizz', 8, .3, D6, 100, human=False)
N('xylophone', 8, .3, D7, 90, human=False)
N('xylophone', beat(4.42), .2, A6, 95, human=False)
N('xylophone', beat(4.52), .4, D7, 100, human=False)

# ---------- B：慢放下落（第 8–18 拍）----------
for tr, notes in {'violins_sus': [(8, 4, [A4, D5]), (12, 4, [Bb4, D5]), (16, 2.05, [Cs5, E5])],
                  'violas_sus': [(8, 4, [F4]), (12, 4, [G4]), (16, 2.05, [G4])],
                  'cellos_sus': [(8, 4, [D3]), (12, 4, [G2]), (16, 2.05, [A2])]}.items():
    for b, d, ps in notes: chord(tr, b, d + .1, ps, 60, human=False)
    ramp(tr, 8, 11, 35, 95); ramp(tr, 12, 15, 70, 100); ramp(tr, 16, 18, 85, 127)   # 每个和弦都渐强进入，最后推到落地
PAD = [(8, 4, [D4, F4, A4, E5]), (12, 4, [G3, Bb3, D4, A4]), (16, 1, [A3, D4, E4, G4]), (17, 1, [A3, Cs4, E4, G4])]
ARP = []                                                     # 十六分音符琶音，每小节高一个八度
for bar, (b0, tones) in enumerate([(9, [D5, F5, A5, D6]), (12, [G5, Bb5, D6, G6]), (16, [A5, Cs5 + 12, E6, G6])]):
    end = {0: 12, 1: 16, 2: 18}[bar]
    i = 0
    while b0 + i * .25 < end:
        ARP.append((b0 + i * .25, .2, tones[i % 4] + (12 if bar == 2 and i >= 4 else 0), 45 + int(40 * (b0 + i * .25 - 9) / 9)))
        i += 1
# 前半身翻转（5.3 秒）、后半身翻转（6.6 秒）：木琴一串上行"嗖"；伸腿（8.1 秒）："叮"
for b0, ps in [(beat(5.3), [D6, F6, A6]), (beat(6.6), [G6, Bb6, D7])]:
    for i, p in enumerate(ps): N('xylophone', b0 + i * .25, .2, p, 70 + i * 10, human=False)
N('xylophone', beat(8.1), .3, E6, 75, human=False)
N('orch_perc', 14, 4, TIMP_ROLL, 100, human=False); ramp('orch_perc', 14, 18, 15, 127)
N('orch_perc', beat(9.3 - 3.8), beat(9.3) - beat(5.5), SUSP_ROLL, 100, human=False)

# ---------- 落地（第 18 拍 = 9.3 秒）----------
N('orch_perc', 18, 3, CRASH, 110, human=False); N('orch_perc', 18, 3, TIMP_HIT, 120, human=False)
N('drums', 18, .4, KICK, 120, human=False); N('drums', 18, .4, SN, 100, human=False)
chord('piano', 18, .6, [D3, A3, D4, Fs4, A4, D5], 100, human=False)
chord('violins_pizz', 18, .4, [D5, Fs5, A5], 100, human=False); N('cellos_pizz', 18, .5, D2 + 12, 100, human=False)

# ---------- C：落地后得意（第 18–23 拍）----------
for b, p, d in [(19, Fs5, .3), (19.5, A5, .3), (20, D6, .9), (21, A5, .3), (21.5, Fs5, .3), (22, G5, .3), (22.5, E5, .4)]:
    N('piano', b, d, p, 68)
for t, p in [(9.95, A6), (10.35, D7), (10.75, Fs7)]: N('glockenspiel', beat(t), .5, p, 60, human=False)   # 跟画面里的闪光
for b, p in [(19, D3), (20, A2), (21, D3), (22, A2), (22.5, Cs3)]: N('cellos_pizz', b, .5, p, 78)
for b in [19.5, 20.5, 21.5]: chord('violins_pizz', b, .3, [Fs4, A4, D5], 55)
chord('violins_pizz', 22.5, .3, [G4, Cs5, E5], 60)
for i in range(8): N('drums', 19 + i * .5, .2, HAT, 40 if i % 2 else 48)
for b in [19, 21]: N('drums', b, .3, KICK, 60)
for b in [20, 22]: N('drums', b, .2, RIM, 58)

# ---------- 印章（第 23 拍 = 11.8 秒）----------
N('drums', 23, .4, SN, 115, human=False); N('drums', 23, .4, KICK, 110, human=False); N('orch_perc', 23, 2, SUSP, 90, human=False)
chord('piano', 23, .5, [D4, Fs4, A4, D5], 95, human=False); N('xylophone', 23, .4, D7, 95, human=False)

# ---------- D：结尾（第 23–29 拍）----------
for b, p in [(24, A4), (24.5, D5), (25, Fs5), (25.5, E5), (26, D5), (26.5, E5), (27, Fs5), (27.5, E5)]:
    N('piano', b, .35, p, 70)
chord('piano', 28, 1.6, [D3, A3, Fs4, A4, D5], 78)
for b, p in [(24, D3), (25, A2), (26, G2), (27, A2), (28, D2 + 12)]: N('cellos_pizz', b, .5, p, 78)
for b, ps in [(24.5, [Fs4, A4, D5]), (25.5, [Fs4, A4, D5]), (26.5, [G4, B4, D5]), (27.5, [A4, Cs5, E5])]: chord('violins_pizz', b, .3, ps, 55)
for tr, ps in [('violins_sus', [D5, Fs5]), ('violas_sus', [A4]), ('cellos_sus', [D3])]:
    chord(tr, 28, 1.4, ps, 60, human=False); ramp(tr, 27.9, 28.2, 60, 90, steps=6)
N('glockenspiel', 28, 1, D7, 65, human=False)
for i in range(10): N('drums', 23.5 + i * .5, .2, HAT, 40 if i % 2 else 48)
for b in [24, 26, 28]: N('drums', b, .3, KICK, 58)
for b in [25, 27]: N('drums', b, .2, RIM, 56)

def write(out):
    os.makedirs(os.path.join(out, 'midi'), exist_ok=True)
    for name, evs in tracks.items():
        mid = mido.MidiFile(ticks_per_beat=TPB); tr = mido.MidiTrack(); mid.tracks.append(tr)
        tr.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM), time=0))
        ab = []                                    # (绝对 tick, 次序, 消息)
        tk = lambda b: round((T0 / SEC + b) * TPB)
        for e in evs:
            if e[0] == 'cc': ab.append((tk(e[1]), 0, mido.Message('control_change', control=e[2], value=e[3])))
            else:
                b, d, p, v = e; ab.append((tk(b), 2, mido.Message('note_on', note=p, velocity=v))); ab.append((tk(b + d), 1, mido.Message('note_off', note=p, velocity=0)))
        ab.sort(key=lambda x: (x[0], x[1])); last = 0
        for t, _, m in ab: tr.append(m.copy(time=t - last)); last = t
        mid.save(os.path.join(out, 'midi', name + '.mid'))
    # 合成器声部（Surge XT）不走 MIDI 文件，直接给出以秒为单位的音符
    surge = {'pad': [(sec(b), sec(b + d) - .02, p, 70) for b, d, ps in PAD for p in ps],
             'arp': [(sec(b), sec(b + d), p, v) for b, d, p, v in ARP]}
    json.dump({'bpm': BPM, 't0': T0, 'duration': 15.0, 'surge': surge,
               'cues': {'drop': sec(8), 'land': sec(18), 'stamp': sec(23)}}, open(os.path.join(out, 'score.json'), 'w'), indent=1)
    print('声部：', ', '.join(f'{k}({sum(1 for e in v if e[0] != "cc")})' for k, v in tracks.items()), '+ pad, arp（Surge XT）')

if __name__ == '__main__':
    write(sys.argv[1] if len(sys.argv) > 1 else '.')
