# 两版样片共用的音乐与音效（程序合成），时间点取自 story.js 写出的 events.json
import os, json, wave
import numpy as np, scipy.signal as ss
HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000; DUR = 15.0; N = int(SR * DUR); t = np.arange(N) / SR; rng = np.random.default_rng(5)
E = json.load(open(os.path.join(HERE, 'events.json')))
db = lambda d: 10 ** (d / 20)
def lp(x, f): b, a = ss.butter(2, f / (SR / 2)); return ss.lfilter(b, a, x)
def hp(x, f): b, a = ss.butter(2, f / (SR / 2), 'high'); return ss.lfilter(b, a, x)
def bp(x, f1, f2): b, a = ss.butter(2, [f1 / (SR / 2), f2 / (SR / 2)], 'band'); return ss.lfilter(b, a, x)
def env(a, b, fi, fo): return np.clip((t - a) / fi, 0, 1) * np.clip((b - t) / fo, 0, 1)
out = np.zeros(N)
def add(x, at, g):
    i = int(at * SR); n = min(len(x), N - i)
    if n > 0: out[i:i + n] += x[:n] * db(g)

# 音乐：低沉的 D 小调铺底，越来越紧；罐裂开前 0.15 秒突然安静
crack = E['crack']
pad = sum(np.sin(2 * np.pi * f * t + k) + 0.25 * np.sin(4 * np.pi * f * t) for k, f in enumerate([73.4, 110, 146.8, 174.6]))
pulse = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * (1.2 + 1.8 * np.clip((t - 3) / 4, 0, 1)) * t))     # 越来越快的心跳式脉冲
out += pad * env(0, crack - 0.15, 1.5, 0.02) * db(-26) * (0.7 + 0.3 * pulse)
out += lp(rng.standard_normal(N), 300) * env(0, crack - 0.15, 1.0, 0.02) * db(-30)             # 城市低频底噪
low = sum(np.sin(2 * np.pi * f * t + k) for k, f in enumerate([55, 82.4, 110, 130.8]))          # 浪：低音弦乐式的长音
out += low * env(crack + 0.6, DUR, 1.5, 1.2) * db(-24)

def thud(dur=0.4, f=90, g=1): n = int(dur * SR); tt = np.arange(n) / SR; return np.sin(2 * np.pi * f * tt * (1 + np.exp(-tt * 10))) * np.exp(-tt * 9) * g
def tap(): n = int(0.08 * SR); tt = np.arange(n) / SR; return hp(rng.standard_normal(n), 1500) * np.exp(-tt * 70) + np.sin(2 * np.pi * 900 * tt) * np.exp(-tt * 60)
def creak(d):
    n = int(d * SR); tt = np.arange(n) / SR; f = 70 + 30 * np.sin(2 * np.pi * 0.7 * tt)
    saw = ss.sawtooth(2 * np.pi * np.cumsum(f) / SR) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * tt) ** 2)
    return bp(saw + 0.3 * rng.standard_normal(n), 120, 900) * np.sin(np.linspace(0, np.pi, n))
def pop(): n = int(0.12 * SR); tt = np.arange(n) / SR; return hp(rng.standard_normal(n), 1800) * np.exp(-tt * 55) + np.sin(2 * np.pi * 1400 * tt) * np.exp(-tt * 40) * 0.6
def boom():
    n = int(2.5 * SR); tt = np.arange(n) / SR
    return lp(rng.standard_normal(n), 220) * np.exp(-tt * 2.2) * 1.4 + np.sin(2 * np.pi * 48 * tt) * np.exp(-tt * 3) + hp(rng.standard_normal(n), 2000) * np.exp(-tt * 25) * 0.6
def clang(k):
    n = int(1.4 * SR); tt = np.arange(n) / SR
    return sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt * d) for f, d in [(320, 3), (517, 4), (883, 6), (1240, 8)]) / 3 * (0.5 + k * 2) + np.pad(thud(0.5, 70), (0, n - int(0.5 * SR))) * 0.8
def whoosh(d=0.4): n = int(d * SR); return bp(rng.standard_normal(n), 600, 3000) * np.sin(np.linspace(0, np.pi, n)) ** 2
def flutter(d=0.8):
    n = int(d * SR); tt = np.arange(n) / SR; return bp(rng.standard_normal(n), 800, 3000) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 14 * tt))) * np.exp(-tt * 2)

add(thud(), E['card'], -14)                                              # 日期卡落下
for k, a in enumerate(np.arange(3.6, crack - 0.2, 0.9)): add(creak(0.8), a, -22 + k * 2.2)   # 罐体越来越响的呻吟
add(tap(), E['tag'], -16)                                                # 钉标签
add(boom(), crack, -6)                                                   # 罐裂开
for r in E['rivets']: add(pop(), r, -17)                                 # 铆钉像子弹一样崩飞
add(flutter(), crack + 0.08, -22)                                        # 鸽子惊飞
for p in E['plates']: add(thud(0.6, 60, 1.3), p, -9)                     # 钢板砸地
roar = lp(rng.standard_normal(N), 380) + 0.4 * bp(rng.standard_normal(N), 300, 1200)
out += roar * env(crack + 0.4, DUR, 0.5, 1.6) * db(-15) * (1 - 0.35 * np.clip((t - 11) / 4, 0, 1))   # 糖蜜奔涌的轰鸣
for c in E['cols']: add(clang(c['k']), c['t'], -12 + 10 * c['k'])       # 立柱被撞弯
add(whoosh(), E['ruler'], -20); add(whoosh(), E['speed'], -20)

# 简单的总线处理：软限幅，峰值 -1 dBFS
out = np.tanh(out * 1.6) / np.tanh(1.6)
out *= db(-1) / max(1e-9, np.abs(out).max())
o = (out * 32767).astype(np.int16)
w = wave.open(os.path.join(HERE, 'sound.wav'), 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(np.stack([o, o], 1).tobytes()); w.close()
print('ok, peak dBFS', round(20 * np.log10(np.abs(out).max()), 1))
