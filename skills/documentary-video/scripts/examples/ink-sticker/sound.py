# 庞贝样片的配乐与音效（程序合成，立体声）：时间点读 events.json
# 前半段轻快的拨弦（像在画一幅童话插画）→ 地震时音乐跑调变慢 → 骤停 → 爆发 → 灰烬 → 碎屑流的轰鸣 → 安静，钢琴单音 + 写字声
import os, json, wave
import numpy as np, scipy.signal as ss
HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000; DUR = 10.0; N = int(SR * DUR); t = np.arange(N) / SR; rng = np.random.default_rng(21)
E = json.load(open(os.path.join(HERE, 'events.json')))
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

def pluck(f, d=0.9, bright=0.5):
    # Karplus-Strong 拨弦
    n = int(d * SR); p = max(2, int(SR / f)); buf = rng.uniform(-1, 1, p); out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]; buf[i % p] = (bright * buf[i % p] + (1 - bright) * 0.5 * (buf[i % p] + buf[(i + 1) % p])) * 0.996
    return out * np.minimum(1, np.arange(n) / 30)
def celesta(f, d=1.2):
    n = int(d * SR); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * f * 4 * tt) * np.exp(-tt * 9)) * np.exp(-tt * 3.2) * np.minimum(1, tt * 600)

# ---------- 音乐：A 小调五声的轻快拨弦，地震后"跑调" ----------
SC = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33]
mel = [0, 2, 4, 5, 4, 2, 3, 1, 0, 2, 4, 6, 5, 4, 7, 6]
beat = 0.27; k = 0; tm = 0.15
while tm < E['squash'] - 0.05:
    detune = 1.0 - 0.06 * max(0, (tm - E['tremor']) / (E['squash'] - E['tremor']))     # 地震：音高慢慢往下滑
    f = SC[mel[k % len(mel)]] * detune
    add(pluck(f, 0.8, 0.45), tm, -14 - 3 * (k % 2), -0.3 + 0.6 * ((k * 3) % 5) / 4)
    if k % 4 == 0: add(pluck(f / 2, 1.2, 0.3), tm, -16, 0)
    k += 1; tm += beat * (1 + 0.5 * max(0, (tm - E['tremor']) / (E['squash'] - E['tremor'])))  # 也越来越慢
# 东西"蹦"出来：每次一个上行的叮
for i, at in enumerate(E['pops']):
    add(celesta(SC[(i * 2) % len(SC)] * 2), at, -21, -0.5 + (i % 5) / 4)
    n = int(0.06 * SR); tt = np.arange(n) / SR; add(np.sin(2 * np.pi * (300 + 900 * tt / 0.06) * tt) * np.exp(-tt * 50), at, -20)   # "啵"
# 铅笔沙沙
for a, b in E['pencil']:
    n = int((b - a) * SR); tt = np.arange(n) / SR
    g = bp(rng.standard_normal(n), 2500, 7000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 7 * tt + rng.random() * 3))) * np.minimum(1, tt * 20) * np.minimum(1, (n / SR - tt) * 20)
    add(g, a, -26, rng.uniform(-0.3, 0.3))

# ---------- 地震、鸟 ----------
rum = lp(rng.standard_normal(N), 70, 4) * ramp(E['tremor'], E['squash']) * (1 - ramp(E['squash'], E['squash'] + 0.06))
addst(rum * 5, -12)
for i in range(3):   # 鸟扑翅
    n = int(0.6 * SR); tt = np.arange(n) / SR
    add(bp(rng.standard_normal(n), 800, 4000) * (np.sin(2 * np.pi * 14 * tt) > 0.2) * np.exp(-tt * 3), E['birds'] + i * 0.05, -24, 0.5 - i * 0.2)
    add(np.sin(2 * np.pi * (2400 + 600 * np.sin(2 * np.pi * 30 * tt[:int(0.12 * SR)])) * tt[:int(0.12 * SR)]) * np.exp(-tt[:int(0.12 * SR)] * 30), E['birds'] + 0.1 + i * 0.12, -30, 0.4)
# 压扁那一下：吸气声（反向噪声）
n = int(0.25 * SR); tt = np.arange(n) / SR
add(hp(rng.standard_normal(n), 800) * (tt / 0.25) ** 3, E['squash'], -22)

# ---------- 爆发 ----------
B = E['boom']; n = int(4.0 * SR); tt = np.arange(n) / SR
boom = (np.sin(2 * np.pi * np.cumsum(70 * np.exp(-tt * 0.8) + 26) / SR) * np.exp(-tt * 1.2) * 1.4
        + lp(rng.standard_normal(n), 200, 4) * np.exp(-tt * 1.0) * 3.2
        + bp(rng.standard_normal(n), 400, 3000) * np.exp(-tt * 7) * 1.4)
boom = np.tanh(boom * 1.5)
add(boom, B, -2, -0.05); add(lp(boom, 300), B + 0.03, -7, 0.1)
# 卡通式的"砰"（和画风呼应）：短促的低音拨弦
add(pluck(55, 1.0, 0.2), B, -8)
for at in E['launches']:   # 岩浆弹：嗖
    n = int(0.35 * SR); tt = np.arange(n) / SR; add(np.sin(2 * np.pi * np.cumsum(500 + 1400 * tt / 0.35) / SR) * np.exp(-tt * 5) * 0.6, at, -24, rng.uniform(-0.6, 0.6))
for at in E['lands']:      # 落地：噗
    n = int(0.2 * SR); tt = np.arange(n) / SR; add(np.sin(2 * np.pi * 110 * tt * (1 + np.exp(-tt * 30))) * np.exp(-tt * 18) + lp(rng.standard_normal(n), 900) * np.exp(-tt * 25) * 0.6, at, -16, rng.uniform(-0.6, 0.6))
# 喷发持续的低吼 + 灰烬落下的细碎声
erupt = lp(rng.standard_normal(N), 160, 4) * ramp(B, B + 0.3) * (1 - 0.6 * ramp(B + 1, B + 3)) * (1 - ramp(E['wash'], E['wash'] + 0.15))
addst(erupt * 3, -14)
ash = hp(rng.standard_normal(N), 4000) * (rng.random(N) < 0.003) * 5 + bp(rng.standard_normal(N), 2000, 8000) * 0.15
addst(ash * ramp(E['ash'], E['ash'] + 1) * (1 - ramp(E['wash'], E['wash'] + 0.3)), -26, 0.2)
# 低音铺底（悲）：D 小调长音，从爆发后长起来
pad = sum(np.sin(2 * np.pi * f * t + f) for f in [73.42, 110.0, 146.83, 174.61])
addst(lp(pad, 600) * ramp(B + 0.6, B + 2.5) * (1 - ramp(E['wash'], E['wash'] + 0.4)), -26)
# 碎屑流：越来越近的轰鸣，到"新的一页"时一刀切断
S = E['surge']; roar = lp(rng.standard_normal(N), 400, 2) * ramp(S, E['wash']) ** 1.5 + lp(rng.standard_normal(N), 80, 4) * 3 * ramp(S, E['wash'])
addst(roar * (1 - ramp(E['wash'], E['wash'] + 0.04)) * 2.5, -10)

# ---------- 结尾：安静 + 钢琴单音 + 写字声 ----------
def piano(f, d=3.0):
    n = int(d * SR); tt = np.arange(n) / SR
    return sum(a * np.sin(2 * np.pi * f * h * tt) * np.exp(-tt * (1.2 + h * 0.8)) for h, a in [(1, 1), (2, 0.45), (3, 0.25), (4, 0.12), (5.02, 0.06)]) * np.minimum(1, tt * 800)
add(piano(220.0), E['wash'] + 0.15, -12)
add(piano(329.63) * 0.8 + piano(261.63) * 0.6, E['title'] + 1.0, -16, 0.1)
for at in E['chars']:
    n = int(0.36 * SR); tt = np.arange(n) / SR
    add(bp(rng.standard_normal(n), 1800, 6000) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 9 * tt))) * np.sin(np.pi * tt / 0.36), at, -22)
air = lp(rng.standard_normal(N), 300) * ramp(E['wash'], E['wash'] + 0.5)
addst(air, -36)

# ---------- 母带 ----------
st = np.stack([L, R], 1); st = st / (np.max(np.abs(st)) + 1e-9) * 1.5; st = np.tanh(st) * 0.89
st[-int(0.3 * SR):] *= np.linspace(1, 0, int(0.3 * SR))[:, None]
with wave.open(os.path.join(HERE, 'sound.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype(np.int16).tobytes())
for s in range(10):
    seg = st[s * SR:(s + 1) * SR]; print(f'{s}-{s+1}s  peak {20*np.log10(np.max(np.abs(seg))+1e-9):6.1f} dB  rms {20*np.log10(np.sqrt(np.mean(seg**2))+1e-9):6.1f} dB')
