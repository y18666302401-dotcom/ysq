# 乐器做不出来的声音（程序合成，48k 立体声）：铅笔、脚步、衣服、木桶、绳钩吱呀、风声、尘土。时间点读 sfx_events.json
# 然后和配乐合成：配乐真空区间切静音 → 叠音效 → 统一到 -14 LUFS → final.wav
import os, json, subprocess
import numpy as np, scipy.signal as ss, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__)); SR = 48000; DUR = 10.0; N = int(SR * DUR)
E = json.load(open(os.path.join(HERE, 'sfx_events.json'), encoding='utf-8')); rng = np.random.default_rng(11); L = np.zeros((N, 2))
db = lambda d: 10 ** (d / 20); tt = lambda d: np.arange(int(d * SR)) / SR
def bp(x, f1, f2): b, a = ss.butter(2, [f1 / (SR / 2), f2 / (SR / 2)], 'band'); return ss.lfilter(b, a, x)
def lp(x, f): b, a = ss.butter(2, f / (SR / 2)); return ss.lfilter(b, a, x)
def noise(n): return rng.standard_normal(n)
def pencil(d=0.6): t = tt(d); return bp(noise(len(t)), 2500, 8000) * (0.5 + 0.5 * np.abs(np.sin(t * 38))) * np.sin(np.pi * t / d) * 0.12
def thud(f0=140, d=0.16): t = tt(d); return np.sin(2 * np.pi * np.cumsum(f0 * np.exp(-t * 25) + 55) / SR) * np.exp(-t * 30) + lp(noise(len(t)), 900) * np.exp(-t * 70) * 0.5
def tiptoe(): t = tt(0.07); return bp(noise(len(t)), 800, 3000) * np.exp(-t * 90) * 0.5
def step(): t = tt(0.1); return lp(noise(len(t)), 700) * np.exp(-t * 55) * 0.8 + thud(110, .1) * 0.3
def run(): t = tt(0.07); return lp(noise(len(t)), 1100) * np.exp(-t * 70) * 0.7
def cloth(d=0.3): t = tt(d); return bp(noise(len(t)), 300, 2500) * np.sin(np.pi * t / d) * 0.4
def creak(d=0.45, f0=520, f1=380, amp=0.35):
    t = tt(d); f = np.linspace(f0, f1, len(t)) * (1 + 0.04 * np.sin(t * 60)); ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sign(np.sin(ph)) * 0.4 + np.sin(ph * 2) * 0.3) * (0.6 + 0.4 * (np.sin(t * 90) > 0)); return bp(x, 300, 3500) * np.sin(np.pi * t / d) ** 0.7 * amp
def wood(): t = tt(0.12); return np.sin(2 * np.pi * 620 * t) * np.exp(-t * 45) * 0.6 + bp(noise(len(t)), 600, 2400) * np.exp(-t * 60) * 0.3
def whoosh(d=0.5): t = tt(d); return bp(noise(len(t)), 400, 2600) * np.sin(np.pi * t / d) ** 2 * 0.7
def puff(): t = tt(0.5); return bp(noise(len(t)), 200, 1600) * np.exp(-t * 7) * 0.6
REC = {'pencil': (pencil, -10), 'tiptoe': (tiptoe, -14), 'step': (step, -9), 'run': (run, -11), 'run2': (run, -12), 'cloth': (cloth, -12),
       'grab': (wood, -8), 'creak': (lambda: creak(0.5), -10), 'land': (lambda: thud(120, .2), -6), 'jolt': (cloth, -14), 'zip': (whoosh, -5),
       'puff': (puff, -9), 'creak_small': (lambda: creak(0.35, 600, 520, 0.2), -16)}
for e in E:
    if e['type'] not in REC: continue
    fn, g = REC[e['type']]; x = fn() * db(g + 6) * e.get('amp', 1); i = int(e['t'] * SR); n = min(len(x), N - i); p = e.get('pan', 0)
    L[i:i + n, 0] += x[:n] * np.cos((p + 1) * np.pi / 4) * 1.414; L[i:i + n, 1] += x[:n] * np.sin((p + 1) * np.pi / 4) * 1.414
# 钩子摆到两端的轻吱呀（和动画同一条阻尼摆公式）
tg = [e['t'] for e in E if e['type'] == 'grab'][0]
for n in range(14):
    k = (np.pi / 2 + n * np.pi - 0.4) * 1.25 / (2 * np.pi); t = tg + k
    if t < DUR - 0.3: a = np.exp(-k * 0.5); x = creak(0.3, 640 - 30 * (n % 2), 560, 0.25) * a * db(-10); i = int(t * SR); m = min(len(x), N - i); L[i:i + m] += x[:m, None] * [0.8, 1.0]
sf.write(os.path.join(HERE, 'sfx.wav'), L, SR, subtype='PCM_16')

# ---- 合成 ----
M = os.path.join(HERE, 'music'); mus, sr = sf.read(os.path.join(M, 'music_final.wav'), always_2d=True); mus = np.pad(mus, ((0, max(0, N - len(mus))), (0, 0)))[:N]
sc = json.load(open(os.path.join(M, 'score.json'))); t = np.arange(N) / SR; env = np.ones(N)
for a, b in sc['vacuum']:
    env[(t >= a) & (t < b)] = 0; k = (t >= a - 0.05) & (t < a); env[k] = np.minimum(env[k], 1 - (t[k] - (a - 0.05)) / 0.05)
mix = mus * env[:, None] + L * db(-2)
fade = np.ones(N); fade[-int(0.25 * SR):] = np.linspace(1, 0, int(0.25 * SR)) ** 0.5   # 最后 0.25 秒收尾，防止截断爆音
mix *= fade[:, None]; mix /= max(1e-9, np.abs(mix).max()) / db(-3)
sf.write(os.path.join(HERE, 'premix.wav'), mix, SR, subtype='PCM_24')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(HERE, 'premix.wav'), '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', os.path.join(HERE, 'final.wav')], check=True)
# 逐秒电平（检查每一段都有声音）
y, _ = sf.read(os.path.join(HERE, 'final.wav'), always_2d=True)
print('逐秒 RMS dBFS：', ' '.join(f'{20 * np.log10(np.sqrt(np.mean(y[int(s * SR):int((s + 1) * SR)] ** 2)) + 1e-9):.0f}' for s in range(int(DUR))))
