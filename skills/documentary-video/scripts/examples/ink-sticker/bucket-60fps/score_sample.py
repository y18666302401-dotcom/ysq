#!/usr/bin/env python3
"""第 04 期样片配乐（10 秒）：mido 写谱 → render.py（sfizz 采样乐器 + Surge XT 铺底）→ mix.py。
动作时刻全部读 sfx_events.json（动画导出），乐器按动作"演"出来（Mickey-Mousing）。调式 D 小调，结尾落在 D 大三和弦上（喜剧感）。

  0–1.4    画线开场：每画出一样东西，钢片琴往上走一个音；桶弹出来，木琴"叮"
  1.4–3.4  踮脚偷偷走：每一步一个低音拨弦（脚落地就是音），小提琴拨弦在步子中间"偷偷"点缀
  3.55–3.95 伸手够桶：木琴一串上行，弦乐长音渐强
  3.95     抓到：木琴"啵" + 钢片琴；4.3 得意："嗒哒"——钢琴 D 大和弦 + 镲轻扫
  4.15–5.2 守卫走进来：每一步低音拨弦（更重、更慢）
  5.36     发现：定音鼓 + 镲 + 弦乐减七和弦一记，跳起来木琴上滑，落地边击
  5.66–6.0 定住：全部骤停（真空）
  6.0–8.0  追逐：军鼓连击 + 低音八分音符 + 每一步木琴（小偷高音、守卫低音）
  8.0–10   空钩子还在晃：每摆到一端钢片琴轻轻一下，越来越弱；属和弦 → 主和弦收住
"""
import json, os, random, math
import mido

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'music')
EV = json.load(open(os.path.join(HERE, 'sfx_events.json'), encoding='utf-8'))
DUR = 10.0; BPM = 120; SEC = 60 / BPM; TPB = 480
def ev(tp): return [e['t'] for e in EV if e['type'] == tp]
rng = random.Random(4); tracks = {}
def N(tr, t, d, p, v, human=False):
    if human: v += rng.randint(-5, 5); t += rng.uniform(-.008, .008)
    tracks.setdefault(tr, []).append((max(0, t / SEC), d / SEC, p, max(1, min(127, v))))
def chs(tr, t, d, ps, v): [N(tr, t, d, p, v) for p in ps]
def ramp(tr, t0, t1, c0, c1, cc=11, steps=12):
    for i in range(steps + 1): tracks.setdefault(tr, []).append(('cc', (t0 + (t1 - t0) * i / steps) / SEC, cc, round(c0 + (c1 - c0) * i / steps)))
nm = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def P(s): acc = 1 if '#' in s else (-1 if 'b' in s[1:] else 0); return 12 * (int(s[-1]) + 1) + nm[s[0]] + acc
KICK, RIM, SN, TIMP, CRASH = 36, 37, 40, 38, 49
DM = ['D', 'E', 'F', 'G', 'A', 'Bb', 'C#']
def dm(i, o=5): q, k = divmod(i, 7); return P(DM[k] + str(o + q))
PAD = []; VAC = []

# 开场：画线
for i, t in enumerate(ev('pencil')): N('glockenspiel', t, .6, dm(i * 2, 5), 46 + i * 2)
tp = ev('pop')[0]; N('xylophone', tp, .1, P('A6'), 84); N('glockenspiel', tp + .04, .8, P('D7'), 60)
chs('cellos_pizz', 1.0, .3, [P('D2'), P('D3')], 58)

# 踮脚：每步一个低音拨弦 + 步子中间小提琴拨弦
steps = ev('tiptoe'); bass = ['D2', 'A2', 'D2', 'A2', 'Bb2', 'A2', 'G2']; hi = ['D5', 'F5', 'E5', 'C#5', 'D5', 'A4', 'Bb4']
for i, t in enumerate(steps):
    N('cellos_pizz', t, .25, P(bass[i % 7]), 70, True)
    N('violins_pizz', t + (steps[1] - steps[0]) / 2, .15, P(hi[i % 7]), 52, True)
    N('drums_cc0', t, .05, RIM, 30)
# 伸手：木琴上行 + 弦乐渐强
tr0 = ev('cloth')[0]; tg = ev('grab')[0]
for j in range(8): N('xylophone', tr0 + j * (tg - tr0 - .04) / 8, .08, dm(7 + j, 4), 50 + j * 4)
chs('violins_sus', tr0, tg - tr0 + .1, [P('A4'), P('D5')], 64); ramp('violins_sus', tr0, tg, 30, 95)
# 抓到 + 得意
N('xylophone', tg, .1, P('D6'), 96); N('glockenspiel', tg + .02, .6, P('A6'), 64)
tt = ev('tada')[0]
chs('piano', tt - .12, .1, [P('A4'), P('C#5')], 70); chs('piano', tt, 1.0, [P('D3'), P('A3'), P('D4'), P('F#4'), P('A4'), P('D5')], 92)
N('orch_perc', tt, 1.0, CRASH, 38); N('glockenspiel', tt + .05, .8, P('F#6'), 58); N('glockenspiel', tt + .2, .8, P('A6'), 54); N('glockenspiel', tt + .35, .8, P('D7'), 50)
# 守卫走进来
for i, t in enumerate(ev('step')): N('cellos_pizz', t, .3, P(['G1', 'D2', 'G1', 'D2'][i % 4]) + 12, 76, True); N('drums_cc0', t, .05, KICK, 46)
# 发现
ts = ev('surprise')[0]; tl = ev('land')[0]; tj = ev('jolt')[0]; tf = ev('freeze')[0]; tz = ev('zip')[0]
N('orch_perc', ts, 1.2, TIMP, 104); N('orch_perc', ts, 1.0, CRASH, 70)
chs('violins_sus', ts, tf - ts + .02, [P('C#4'), P('E4'), P('G4'), P('Bb4')], 92); ramp('violins_sus', ts, ts + .1, 110, 100, steps=2)
chs('cellos_sus', ts, tf - ts + .02, [P('C#2'), P('G2')], 90)
for j in range(7): N('xylophone', ts + j * (tl - ts) / 9, .06, dm(7 + j * 2, 4), 70 + j * 3)
N('drums_cc0', tl, .05, RIM, 100); N('xylophone', tj, .06, P('A5'), 74); N('xylophone', tj + .07, .06, P('D5'), 70)
VAC.append((tf, tz - 0.02))
# 追逐
tb = ev('shout')[0]
N('orch_perc', tz, .6, TIMP, 96); N('drums_cc0', tz, .05, KICK, 100)
e8 = SEC / 2.5; k = 0; t = tz
while t < 8.05:
    N('cellos_pizz', t, .15, P(['D2', 'D3', 'A2', 'D3'][k % 4]), 78 if k % 2 == 0 else 64, True)
    N('drums_cc0', t, .05, SN, 58 if k % 2 == 0 else 36, True)
    if k % 4 == 0: N('drums_cc0', t, .05, KICK, 80)
    k += 1; t += e8
for i, t in enumerate(ev('run')): N('xylophone', t, .06, dm(14 - (i % 5), 4), 74, True)
for i, t in enumerate(ev('run2')): N('xylophone', t, .06, dm(3 + (i % 3), 4), 66, True)
mel = [('D5', .2), ('F5', .2), ('A5', .2), ('G5', .2), ('F5', .2), ('E5', .2), ('D5', .2), ('C#5', .2), ('D5', .4)]
t = tz + .05
for p, d in mel: N('violins_sus', t, d * .95, P(p), 82); t += d
ramp('violins_sus', tz, tz + .2, 70, 105, steps=3); ramp('violins_sus', 7.4, 8.0, 105, 50, steps=6)
N('orch_perc', 8.0, 1.0, CRASH, 34)
# 结尾：空钩子晃，钢片琴在摆到两端时轻敲；属 → 主
tG = tg; ext = []
for n in range(12):
    kk = (math.pi / 2 + n * math.pi - 0.4) * 1.25 / (2 * math.pi); tt_ = tG + kk
    if 8.05 < tt_ < 9.7: ext.append(tt_)
for i, t in enumerate(ext): N('glockenspiel', t, .7, [P('A6'), P('F6')][i % 2], int(56 * math.exp(-(t - 8) * 0.5)))
chs('piano', 8.25, .6, [P('A2'), P('E3'), P('G3'), P('C#4'), P('E4')], 58)
chs('piano', 8.9, 1.3, [P('D2'), P('A2'), P('D3'), P('F#3'), P('A3'), P('D4')], 72)
N('orch_perc', 8.9, 1.2, TIMP, 60); N('glockenspiel', 8.93, 1.0, P('D7'), 46)
chs('cellos_sus', 8.9, 1.1, [P('D2'), P('A2')], 60); ramp('cellos_sus', 8.9, 9.9, 70, 20, steps=8)
PAD.extend([(8.0, 9.95, P('D3'), 40), (8.0, 9.95, P('F#3'), 36), (8.0, 9.95, P('A3'), 36)])

os.makedirs(os.path.join(OUT, 'midi'), exist_ok=True)
for f in os.listdir(os.path.join(OUT, 'midi')): os.remove(os.path.join(OUT, 'midi', f))
for name, evs in tracks.items():
    mid = mido.MidiFile(ticks_per_beat=TPB); tr = mido.MidiTrack(); mid.tracks.append(tr)
    tr.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM), time=0))
    ab = []; tk = lambda b: max(0, round(b * TPB))
    for e in evs:
        if e[0] == 'cc': ab.append((tk(e[1]), 0, mido.Message('control_change', control=e[2], value=e[3])))
        else: b, d, p, v = e; ab.append((tk(b), 2, mido.Message('note_on', note=p, velocity=v))); ab.append((tk(b + d), 1, mido.Message('note_off', note=p, velocity=0)))
    ab.sort(key=lambda x: (x[0], x[1])); last = 0
    for t, _, m in ab: tr.append(m.copy(time=t - last)); last = t
    mid.save(os.path.join(OUT, 'midi', name + '.mid'))
json.dump({'bpm': BPM, 't0': 0, 'duration': DUR, 'surge': {'pad': PAD}, 'vacuum': VAC}, open(os.path.join(OUT, 'score.json'), 'w'), indent=1)
print('声部：', ', '.join(f'{k}({sum(1 for e in v if e[0] != "cc")})' for k, v in tracks.items()), '真空', VAC)
