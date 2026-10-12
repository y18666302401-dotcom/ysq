#!/usr/bin/env python3
"""混音：每条分轨先按"有声部分"的响度对齐到各自的目标电平，再走各自的效果链（全部是 pedalboard 的效果器），
最后总线轻压缩 + 限幅输出 music.wav，再做两遍响度标准化输出 music_final.wav。

"有声部分"：把分轨切成 50 毫秒的小段，只统计比本轨最响处低不超过 30 dB 的小段。只出现几下的声部（比如落地的镲）
不会因为大部分时间静音而被误判成"太小声"、被拉得过响。

用法: python mix.py <工作目录> [--lufs -16] [--duration 15]   （读 stems/*.wav，写 music.wav 和 music_final.wav）
"""
import json, os, re, subprocess, sys
import numpy as np, soundfile as sf
from pedalboard import Pedalboard, Reverb, Compressor, HighpassFilter, LowpassFilter, Delay, Chorus, Limiter, Gain, NoiseGate

SR = 48000
# 声部 → (有声部分的目标电平 dBFS, 效果链)
BUS = {
    'piano':        (-21, [HighpassFilter(70), Compressor(-20, 2, 10, 120), Reverb(.35, .5, .16, .9)]),
    'violins_sus':  (-22, [HighpassFilter(160), Reverb(.6, .5, .28, .85)]),
    'violas_sus':   (-26, [HighpassFilter(120), Reverb(.6, .5, .28, .85)]),
    'cellos_sus':   (-25, [HighpassFilter(50), Reverb(.6, .5, .24, .88)]),
    'violins_pizz': (-25, [HighpassFilter(150), Reverb(.45, .5, .2, .9)]),
    'cellos_pizz':  (-24, [HighpassFilter(45), Reverb(.4, .5, .14, .92)]),
    'drums':        (-26, [Compressor(-22, 3, 5, 100), Reverb(.25, .5, .08, .95)]),
    'drums_cc0':    (-26, [Compressor(-22, 3, 5, 100), Reverb(.25, .5, .08, .95)]),
    'pad':          (-29, [HighpassFilter(200), LowpassFilter(6000), Chorus(.6, .2), Reverb(.8, .5, .35, .8)]),
    'arp':          (-28, [HighpassFilter(300), Delay(.25, .3, .2), Reverb(.5, .5, .22, .85)]),
    'xylophone':    (-24, [Reverb(.4, .5, .2, .9)]),
    'glockenspiel': (-27, [Reverb(.55, .5, .3, .85)]),
    'orch_perc':    (-23, [Reverb(.5, .5, .2, .9)]),
    # 中国古代题材（VCSL，sfz_vcsl.py 生成）
    'guzheng':      (-22, [HighpassFilter(60), Compressor(-22, 2, 5, 150), Reverb(.55, .5, .24, .88)]),
    'zheng_gliss':  (-24, [HighpassFilter(80), Reverb(.6, .5, .28, .85)]),
    'xun':          (-25, [HighpassFilter(120), LowpassFilter(5000), Reverb(.7, .5, .3, .82)]),
    'bianzhong':    (-23, [HighpassFilter(90), Reverb(.75, .5, .32, .8)]),
    'han_perc':     (-22, [Compressor(-20, 2.5, 5, 120), Reverb(.45, .5, .18, .9)]),
}

def active_db(a, rel=-30):
    """有声部分的平均电平：只统计比本轨最响的小段低不超过 30 dB 的小段（门限跟着本轨走，录得很轻的采样也不会被当成静音）。"""
    m = a.mean(1) if a.ndim == 2 else a; w = int(.05 * SR)
    fr = m[:len(m) // w * w].reshape(-1, w); db = 10 * np.log10((fr ** 2).mean(1) + 1e-12)
    act = db[db > max(db.max() + rel, -90)]
    return 10 * np.log10(np.mean(10 ** (act / 10))) if len(act) else None

def main(work, lufs=-16, dur=None):
    mix = None
    for name, (target, chain) in BUS.items():
        path = os.path.join(work, 'stems', name + '.wav')
        if not os.path.exists(path): continue
        a, sr = sf.read(path, always_2d=True); a = a.astype(np.float32)
        lvl = active_db(a)
        if lvl is None: print(f'{name:14s} 静音，跳过'); continue
        g = target - lvl
        # 先过噪声门：sfizz 渲染出的分轨在静音处有约 -90 dBFS 的残留音（实测约 675 Hz），
        # 录得轻的声部要加 40 dB 以上的增益，不先门掉就会变成一条听得见的持续音
        peak = 20 * np.log10(np.abs(a).max() + 1e-12)
        y = Pedalboard([HighpassFilter(30), NoiseGate(peak - 50, 10, 1, 250), Gain(g)] + chain)(a.T, SR).T   # 30 Hz 高通先去掉 sfizz 输出里的直流偏移
        print(f'{name:14s} 有声部分 {lvl:6.1f} → {target} dBFS（增益 {g:+.1f} dB）')
        mix = y if mix is None else mix + y
    master = Pedalboard([Compressor(-16, 1.8, 15, 200), Limiter(-1.0, 120)])
    out = master(mix.T, SR).T
    sf.write(os.path.join(work, 'music.wav'), out, SR, subtype='PCM_24')
    loudnorm(os.path.join(work, 'music.wav'), os.path.join(work, 'music_final.wav'), lufs, dur)

def loudnorm(src, dst, lufs, dur):
    """ffmpeg 两遍 loudnorm：先测量，再线性校正到目标响度，真峰值不超过 -1.5 dBTP。"""
    run = lambda *a: subprocess.run(['ffmpeg', '-hide_banner', '-y', *a], capture_output=True, text=True).stderr
    m = json.loads(re.findall(r'\{[^{}]*\}', run('-i', src, '-af', f'loudnorm=I={lufs}:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'))[-1])
    f = (f"loudnorm=I={lufs}:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
         f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample=48000")
    run('-i', src, '-af', f, *(['-t', str(dur)] if dur else []), '-c:a', 'pcm_s16le', dst)
    r = json.loads(re.findall(r'\{[^{}]*\}', run('-i', dst, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'))[-1])
    print(f"成品 {r['input_i']} LUFS，真峰值 {r['input_tp']} dBTP → {os.path.basename(dst)}")

if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(); ap.add_argument('work'); ap.add_argument('--lufs', type=float, default=-16,
        help='成品响度。纯配乐 -16；要垫在口播下面时先出 -16 的配乐，再用 ../mix_audio.py 和旁白一起混')
    ap.add_argument('--duration', type=float, help='截到画面的总时长（秒）')
    a = ap.parse_args(); main(a.work, a.lufs, a.duration)
