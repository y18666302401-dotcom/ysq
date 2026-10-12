"""程序合成音效（第 4 期，汉代：木鱼、拍板、编钟感的金属单击；脚步、风声）。
python sfx.py events.json t0 dur out.wav  —— 事件时间是全片时间，t0 是片段起点。"""
import json, sys, numpy as np, wave
SR = 48000
rng = np.random.default_rng(4)
def env(n, a=0.002, d=0.1):
    t = np.arange(n) / SR; return np.minimum(1, t / a) * np.exp(-t / d)
def tone(f, dur, d, h=(1,), amp=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    return amp * env(n, 0.001, d) * sum(np.sin(2 * np.pi * f * k * t) / (i + 1) for i, k in enumerate(h))
def noise(dur, d, lp=0.5):
    n = int(dur * SR); x = rng.standard_normal(n); y = np.zeros(n); a = 0
    for i in range(n): a += lp * (x[i] - a); y[i] = a
    return y * env(n, 0.003, d)
def woodblock(f=820): return tone(f, 0.18, 0.035, (1, 2.72), 0.9)
def step(): return 0.5 * noise(0.09, 0.025, 0.15)
def whoosh(dur=0.45):
    n = int(dur * SR); x = rng.standard_normal(n); y = np.zeros(n); a = 0
    for i in range(n): c = 0.03 + 0.25 * np.sin(np.pi * i / n); a += c * (x[i] - a); y[i] = a
    return 0.9 * y * np.sin(np.pi * np.arange(n) / n) ** 2
def mix(*xs):
    n = max(len(x) for x in xs); return sum(np.pad(x, (0, n - len(x))) for x in xs)
def slap(): return mix(1.2 * noise(0.16, 0.03, 0.6), tone(180, 0.2, 0.05, (1, 1.5), 0.6))
def bell(): return tone(523.25, 1.6, 0.6, (1, 2.76, 5.4), 0.35)     # 编钟感：C5 + 非谐泛音
def skid(): n = int(0.3 * SR); return 0.5 * noise(0.3, 0.12, 0.35) * (1 + 0.5 * np.sin(2 * np.pi * 40 * np.arange(n) / SR))
def gap(s): return np.zeros(int(s * SR))
def chirp(f0, f1, dur, amp=0.5):
    n = int(dur * SR); t = np.arange(n) / SR; ph = 2 * np.pi * np.cumsum(np.linspace(f0, f1, n)) / SR
    return amp * np.sin(ph) * env(n, 0.003, dur / 2.5)
def crumple(dur=0.4, dens=60):
    n = int(dur * SR); y = np.zeros(n)
    for _ in range(int(dens * dur)): i = rng.integers(0, max(1, n - 800)); y[i:i + 800] += rng.standard_normal(800) * np.exp(-np.arange(800) / 120) * rng.uniform(0.2, 1)
    return 0.5 * y
NONE = lambda: np.zeros(1)
# 乐音类（叮、钟、锣、木鱼三连、静音、梆子）写在总谱里，这里不合成
SFX = { 'slip_hand': lambda: woodblock(1100) * 0.6, 'grab': lambda: woodblock(950) * 0.7, 'whoosh_small': lambda: whoosh(0.25) * 0.6,
  'step': step, 'whoosh': whoosh, 'skid': skid, 'slap': slap, 'thud': lambda: mix(slap() * 0.7, tone(90, 0.3, 0.08, (1,), 0.8)),
  'thud_soft': lambda: 0.5 * slap(), 'nail': lambda: mix(slap(), tone(1400, 0.1, 0.02, (1, 2.3), 0.4)), 'book_slam': lambda: mix(1.4 * noise(0.25, 0.05, 0.7), tone(110, 0.4, 0.1, (1, 1.5), 0.9)),
  'crash_wood': lambda: mix(1.3 * noise(0.35, 0.08, 0.6), crumple(0.6, 90)), 'slips_scatter': lambda: crumple(1.0, 70), 'slip_land': lambda: 0.5 * slap(), 'slip_tick': lambda: woodblock(1600) * 0.25,
  'brush': lambda: 0.35 * noise(0.3, 0.12, 0.08), 'cloth': lambda: whoosh(0.5) * 0.7, 'page': lambda: crumple(0.35, 40), 'pop': lambda: chirp(400, 900, 0.12, 0.45),
  'sip': lambda: chirp(700, 300, 0.25, 0.25), 'gulp': lambda: chirp(300, 120, 0.2, 0.6), 'squish': lambda: mix(chirp(200, 500, 0.3, 0.5), 0.3 * noise(0.3, 0.1, 0.3)),
  'creak': lambda: 0.4 * np.sin(2 * np.pi * np.cumsum(180 + 60 * np.sin(np.arange(int(0.5 * SR)) / SR * 30)) / SR) * env(int(0.5 * SR), 0.05, 0.25) * (1 + 0.6 * np.sign(np.sin(np.arange(int(0.5 * SR)) / SR * 2 * np.pi * 28))),
  'hammer': lambda: mix(woodblock(700) * 0.5, 0.4 * noise(0.08, 0.02, 0.5)), 'hmm': lambda: tone(140, 0.4, 0.2, (1, 2, 3), 0.25), 'bubble': lambda: chirp(500, 1100, 0.15, 0.35),
  'woodblock3': NONE, 'ding': NONE, 'ding_low': NONE, 'bell': NONE, 'bell_low': NONE, 'bell_end': NONE, 'gong': NONE, 'silence': NONE, 'block': NONE }
ev, t0, dur, out = json.load(open(sys.argv[1])), float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
L = np.zeros(int(dur * SR) + SR); R = L.copy()
for e in ev:
    s = SFX.get(e['type'], NONE)(); i = int((e['t'] - t0) * SR)
    if i < 0 or i >= len(L): continue
    s = s[:len(L) - i]; p = (e.get('pan', 0) + 1) / 2
    L[i:i + len(s)] += s * np.cos(p * np.pi / 2); R[i:i + len(s)] += s * np.sin(p * np.pi / 2)
x = np.stack([L, R], 1)[:int(dur * SR)]; x = x / max(1e-9, np.abs(x).max()) * 0.5
w = wave.open(out, 'w'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype(np.int16).tobytes()); w.close()
print('sfx', len(ev), 'events')
