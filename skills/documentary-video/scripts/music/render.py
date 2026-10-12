#!/usr/bin/env python3
"""把总谱渲染成一条条分轨 wav（48 kHz 立体声，全部从 0 秒对齐）。

- 采样乐器：sfizz_render 命令行，一个声部一个 SFZ + 一个 MIDI 文件
- 合成器：pedalboard 加载 Surge XT（VST3），装入出厂音色 .fxp 后直接弹 MIDI 音符

用法: python render.py <score.py 的输出目录> <SFZ 对照表 json>
SFZ 对照表示例：{"piano": "/path/Salamander Grand Piano V3.sfz", "drums": "/path/SamsSonor.sfz", ...}
"""
import json, os, subprocess, sys
import numpy as np, soundfile as sf, mido, pedalboard
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import surge_state

SR = 48000
# Surge XT 的位置：Linux 默认装在 /usr；Windows 安装包装在 Common Files\VST3 和 ProgramData。可用环境变量 SURGE_VST3 / SURGE_PATCHES 覆盖
_WIN = os.name == 'nt'
SURGE = os.environ.get('SURGE_VST3') or (r'C:\Program Files\Common Files\VST3\Surge Synth Team\Surge XT.vst3\Contents\x86_64-win\Surge XT.vst3' if _WIN else '/usr/lib/vst3/Surge XT.vst3')
PATCHES = os.environ.get('SURGE_PATCHES') or (r'C:\ProgramData\Surge XT\patches_factory' if _WIN else '/usr/share/surge-xt/patches_factory/')
SFIZZ = os.environ.get('SFIZZ_RENDER', 'sfizz_render')   # sfizz 命令行渲染器（Windows 上指向 sfizz_render.exe）
SURGE_PRESETS = {'pad': 'Pads/MKS-70 Warm Pad.fxp', 'arp': 'Plucks/Diamonds.fxp'}

def fit(a, n):  # 补齐或截断到 n 个采样点，保证所有分轨一样长
    a = a if a.ndim == 2 else np.stack([a, a], 1)
    return np.pad(a, ((0, max(0, n - len(a))), (0, 0)))[:n]

def surge_render(preset, notes, dur):
    p = pedalboard.load_plugin(SURGE)
    p.raw_state = surge_state.with_component(p.raw_state, open(os.path.join(PATCHES, preset), 'rb').read()[60:])
    p([], duration=.1, sample_rate=SR, num_channels=2)            # Surge 在下一次处理时才真正换上新音色，先空跑一次
    msgs = []
    for t0, t1, n, v in notes:
        msgs += [mido.Message('note_on', note=n, velocity=v, time=t0), mido.Message('note_off', note=n, time=t1)]
    msgs.sort(key=lambda m: m.time)
    return p(msgs, duration=dur, sample_rate=SR, num_channels=2, reset=True).T

def main(work, sfzmap):
    score = json.load(open(os.path.join(work, 'score.json'))); dur = score['duration'] + 1.0; n = int(dur * SR)
    os.makedirs(os.path.join(work, 'stems'), exist_ok=True)
    for f in sorted(os.listdir(os.path.join(work, 'midi'))):
        name = f[:-4]; out = os.path.join(work, 'stems', name + '.wav')
        subprocess.run([SFIZZ, '--sfz', sfzmap[name], '--midi', os.path.join(work, 'midi', f), '--wav', out, '-s', str(SR)], check=True, capture_output=True)
        a, sr = sf.read(out); assert sr == SR; sf.write(out, fit(a, n), SR)
        print(f'{name:14s} sfizz   峰值 {20*np.log10(np.abs(a).max()+1e-9):6.1f} dBFS')
    for name, notes in score['surge'].items():
        a = surge_render(SURGE_PRESETS[name], notes, dur)
        sf.write(os.path.join(work, 'stems', name + '.wav'), fit(a, n), SR)
        print(f'{name:14s} Surge XT「{SURGE_PRESETS[name]}」 峰值 {20*np.log10(np.abs(a).max()+1e-9):6.1f} dBFS')

if __name__ == '__main__':
    # setup_windows.py 会在 sfzmap.json 旁边写 env.json（Surge、sfizz_render 的位置），有就自动读
    envf = os.path.join(os.path.dirname(os.path.abspath(sys.argv[2])), 'env.json')
    if os.path.exists(envf):
        env = json.load(open(envf, encoding='utf-8'))
        SURGE, PATCHES, SFIZZ = env.get('SURGE_VST3', SURGE), env.get('SURGE_PATCHES', PATCHES), env.get('SFIZZ_RENDER', SFIZZ)
    main(sys.argv[1], json.load(open(sys.argv[2], encoding='utf-8')))
