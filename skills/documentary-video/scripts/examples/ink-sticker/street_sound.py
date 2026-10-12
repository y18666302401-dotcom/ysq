# 面包房镜头的配乐与音效（程序合成，立体声），时间点读 street_events.json
import os, json, wave
import numpy as np, scipy.signal as ss
HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000; DUR = 10.0; N = int(SR * DUR); t = np.arange(N) / SR; rng = np.random.default_rng(33)
E = json.load(open(os.path.join(HERE, 'street_events.json')))
db = lambda d: 10 ** (d / 20)
def lp(x, f, o=2): b, a = ss.butter(o, f / (SR / 2)); return ss.lfilter(b, a, x)
def hp(x, f, o=2): b, a = ss.butter(o, f / (SR / 2), 'high'); return ss.lfilter(b, a, x)
def bp(x, f1, f2): b, a = ss.butter(2, [f1 / (SR / 2), f2 / (SR / 2)], 'band'); return ss.lfilter(b, a, x)
def ramp(a, b): return np.clip((t - a) / max(1e-6, b - a), 0, 1)
L = np.zeros(N); R = np.zeros(N)
def add(x, at, g, pan=0.0):
    i = int(at * SR); n = min(len(x), N - i)
    if n <= 0 or i < 0: return
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:i + n] += x[:n] * db(g) * gl * 1.414; R[i:i + n] += x[:n] * db(g) * gr * 1.414
def addst(x, g, pan=0.0):
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[:] += x * db(g) * gl * 1.414; R[:] += x * db(g) * gr * 1.414
def tt_(d): return np.arange(int(d * SR)) / SR
def pluck(f, d=0.8, bright=0.45):
    n = int(d * SR); p = max(2, int(SR / f)); buf = rng.uniform(-1, 1, p); out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]; buf[i % p] = (bright * buf[i % p] + (1 - bright) * 0.5 * (buf[i % p] + buf[(i + 1) % p])) * 0.996
    return out
def celesta(f, d=1.0):
    tt = tt_(d); return (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * f * 4 * tt) * np.exp(-tt * 9)) * np.exp(-tt * 3.5) * np.minimum(1, tt * 600)

TR, BOOM = E['tremor'], E['boom']
# ---------- 音乐：清晨小街的拨弦小调（D 多利亚，轻快） → 地震跑调 → 骤停 ----------
SC = [146.83, 164.81, 174.61, 196.0, 220.0, 246.94, 261.63, 293.66, 329.63]
mel = [4, 6, 7, 6, 4, 3, 4, 2, 0, 2, 3, 4, 6, 4, 8, 7]
tm, k = 0.3, 0
while tm < TR + 0.5:
    bend = 1 - 0.07 * max(0, (tm - TR) / 0.5)
    add(pluck(SC[mel[k % 16]] * 2 * bend, 0.7), tm, -15 - 2 * (k % 2), -0.3 + 0.6 * ((k * 3) % 5) / 4)
    if k % 2 == 0: add(pluck(SC[[0, 3, 4, 3][(k // 4) % 4]] * bend, 1.0, 0.3), tm, -17, 0)
    k += 1; tm += 0.24 * (1 + 0.8 * max(0, (tm - TR) / 0.5))
for i, at in enumerate(E['pops']): add(celesta(SC[(i * 2) % 9] * 4), at, -24, -0.5 + (i % 5) / 4)
# 环境：街上的鸟叫、烤炉的噼啪
for at in [0.6, 1.4, 2.2, 2.9]:
    tt = tt_(0.18); add(np.sin(2 * np.pi * (3000 + 900 * np.sin(2 * np.pi * 22 * tt)) * tt) * np.sin(np.pi * tt / 0.18), at, -32, -0.6)
fire = hp(rng.standard_normal(N), 2000) * (rng.random(N) < 0.0012) * 6
addst(fire * (1 - ramp(7.5, 8.5)), -34, -0.4)
# ---------- 动作音效 ----------
def whoosh(d=0.25, f0=600, f1=2000): tt = tt_(d); return bp(rng.standard_normal(len(tt)), f0, f1) * np.sin(np.pi * tt / d) ** 2
def boing(f=220, d=0.3): tt = tt_(d); return np.sin(2 * np.pi * np.cumsum(f * (1 + 0.6 * np.exp(-tt * 12) * np.sin(2 * np.pi * 14 * tt))) / SR) * np.exp(-tt * 9)
def bark(f=420):
    tt = tt_(0.2); src = ss.sawtooth(2 * np.pi * np.cumsum(f * (1 + 0.5 * np.exp(-tt * 20)) * (1 - 0.3 * tt / 0.2)) / SR)
    x = bp(src, 500, 1800) + 0.6 * bp(src, 2200, 3500) + 0.3 * bp(rng.standard_normal(len(tt)), 1000, 4000)
    return x * np.sin(np.pi * np.minimum(1, tt / 0.16)) ** 0.5 * np.exp(-tt * 6)
def heehaw():
    out = []
    for f, d in [(520, 0.28), (260, 0.34), (520, 0.26), (250, 0.36)]:
        tt = tt_(d); src = ss.sawtooth(2 * np.pi * f * tt * (1 + 0.02 * np.sin(2 * np.pi * 7 * tt))); out.append(bp(src, 400, 2600) * np.sin(np.pi * tt / d) ** 0.6)
    return np.concatenate(out)
add(whoosh(0.2, 800, 3000), E['throw'], -20, 0.2)
add(boing(330, 0.25), E['throw'] + 0.05, -26, 0.3)
add(celesta(880, 0.6), E['catch'], -18, 0.5)
tt = tt_(0.12); add(np.sin(2 * np.pi * 120 * tt) * np.exp(-tt * 30), E['land'], -16, 0.5)
for at in E['claps']:
    for j in range(2):
        tt = tt_(0.06); add(bp(rng.standard_normal(len(tt)), 1200, 5000) * np.exp(-tt * 70), at + j * 0.125, -20, 0.25)
for at in E['barks']: add(bark(400 + rng.uniform(-30, 40)), at, -12, 0.55)
for at in E['heehaw']: add(heehaw(), at, -17, -0.6)
for i in range(4):   # 鸽子扑翅
    tt = tt_(0.5); add(bp(rng.standard_normal(len(tt)), 700, 4000) * (np.sin(2 * np.pi * 16 * tt + i) > 0.1) * np.exp(-tt * 3.5), E['pigeons'] + i * 0.07, -24, -0.6 + i * 0.1)
tt = tt_(0.3); add(np.sin(2 * np.pi * np.cumsum(700 + 500 * tt / 0.3) / SR) * np.exp(-tt * 6) * 0.4 + whoosh(0.3, 1000, 4000), E['cat'], -24, 0.8)   # 猫一跃
for at in E['loafHits']: add(boing(150 + rng.uniform(0, 40), 0.22), at, -16, 0.15)
# 脚步：人（草鞋拍地）、狗（小爪子）、驴（蹄子）
for s in E['steps']:
    if s['who'] in ('baker', 'kid'):
        tt = tt_(0.08); x = lp(rng.standard_normal(len(tt)), 1500) * np.exp(-tt * 55) + np.sin(2 * np.pi * (90 if s['who'] == 'baker' else 140) * tt) * np.exp(-tt * 40) * 0.8
        add(x, s['t'], -19 if s['who'] == 'baker' else -22, s['pan'])
    elif s['who'] == 'dog':
        tt = tt_(0.04); add(hp(rng.standard_normal(len(tt)), 2500) * np.exp(-tt * 120), s['t'], -26, s['pan'])
    else:
        tt = tt_(0.12); add((np.sin(2 * np.pi * 380 * tt) + 0.6 * np.sin(2 * np.pi * 760 * tt)) * np.exp(-tt * 45) + bp(rng.standard_normal(len(tt)), 800, 3000) * np.exp(-tt * 60), s['t'], -18, s['pan'])
# ---------- 地震、远处的喷发 ----------
rum = lp(rng.standard_normal(N), 70, 4) * (ramp(TR, TR + 0.4) * (1 - ramp(BOOM - 0.12, BOOM - 0.05)) + 0.5 * ramp(BOOM + 0.6, BOOM + 1.5) * (1 - ramp(8.2, 9.2)))
addst(rum * 5, -12)
tt = tt_(4.0)
boom = (np.sin(2 * np.pi * np.cumsum(55 * np.exp(-tt * 0.7) + 24) / SR) * np.exp(-tt * 1.3) * 1.3 + lp(rng.standard_normal(len(tt)), 160, 4) * np.exp(-tt * 1.0) * 3.0 + bp(rng.standard_normal(len(tt)), 300, 1800) * np.exp(-tt * 5) * 0.9)
add(np.tanh(boom * 1.4), BOOM, -3, 0.35)   # 远一些：高频少，声像偏右（火山在右边）
tt = tt_(1.2); add(pluck(73.4, 1.2, 0.2), BOOM, -10, 0.2)
# 落灰、天暗：细碎沙沙 + 低音长音
ash = hp(rng.standard_normal(N), 4500) * (rng.random(N) < 0.0025) * 5 + bp(rng.standard_normal(N), 2500, 9000) * 0.12
addst(ash * ramp(E['ash'], E['ash'] + 1.2), -27, 0.2)
pad = sum(np.sin(2 * np.pi * f * t + f) for f in [73.42, 110.0, 146.83, 174.61])
addst(lp(pad, 700) * ramp(BOOM + 0.8, BOOM + 2.5) * (1 - ramp(9.5, 10)), -25)
# 结尾：人都走了，只剩一个钢琴音 + 写字声
def piano(f, d=3.0):
    tt = tt_(d); return sum(a * np.sin(2 * np.pi * f * h * tt) * np.exp(-tt * (1.2 + h * 0.8)) for h, a in [(1, 1), (2, 0.45), (3, 0.25), (4, 0.12)]) * np.minimum(1, tt * 800)
add(piano(293.66), E['zoom'] + 0.1, -13, 0.1); add(piano(220.0) * 0.8, E['text'] + 0.9, -15, -0.1)
for j in range(2):
    tt = tt_(0.6); add(bp(rng.standard_normal(len(tt)), 1800, 6000) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 9 * tt))) * np.sin(np.pi * tt / 0.6), E['text'] + j * 0.5, -24)

st = np.stack([L, R], 1); st = st / (np.max(np.abs(st)) + 1e-9) * 1.5; st = np.tanh(st) * 0.89
st[:int(0.2 * SR)] *= np.linspace(0, 1, int(0.2 * SR))[:, None]; st[-int(0.3 * SR):] *= np.linspace(1, 0, int(0.3 * SR))[:, None]
with wave.open(os.path.join(HERE, 'street_sound.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype(np.int16).tobytes())
for s in range(10):
    seg = st[s * SR:(s + 1) * SR]; print(f'{s}-{s+1}s  peak {20*np.log10(np.max(np.abs(seg))+1e-9):6.1f} dB  rms {20*np.log10(np.sqrt(np.mean(seg**2))+1e-9):6.1f} dB')
