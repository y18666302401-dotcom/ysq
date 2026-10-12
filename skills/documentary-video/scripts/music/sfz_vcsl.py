#!/usr/bin/env python3
"""给 VCSL（CC0）里的中国古代题材可用乐器写 SFZ（VCSL 只提供 wav，不带 sfz）。

先秦—汉 / 唐 / 宋—明清 题材的配器（audio.md 的时代配乐表）靠这些采样：
  guzheng   越南筝 Dan Tranh（当古琴 / 古筝 / 琵琶的拨弦）     xun        陶笛 Ocarina（当埙，低音区）
  bianzhong 管钟 Tubular Bells（当编钟）                      jiangu     框鼓 Frame Drum（当建鼓）
  gong      锣（大锣"匡"）                                     muyu       木鱼 Woodblock / 拍板 Claves / 梆子 Slit Drum
VCSL 的文件名里的音名不一定可靠（不同乐器的八度记法不同），所以默认每个采样都实测基频，用实测音高做 pitch_keycenter。
管钟的泛音不和谐，实测基频会乱跳，改用文件名里的音名 + 12（实测：筝、陶笛、管钟的文件名都比实际低一个八度）。

用法: python sfz_vcsl.py <VCSL 目录> <输出目录>
"""
import os, re, sys
import numpy as np, soundfile as sf

def f0(path, fmin=60, fmax=1600):
    a, sr = sf.read(path, always_2d=True); x = a.mean(1)
    i = int(np.argmax(np.abs(x) > np.abs(x).max() * 0.3)); x = x[i + int(0.05 * sr): i + int(0.05 * sr) + int(0.25 * sr)]
    x = x - x.mean(); c = np.correlate(x, x, 'full')[len(x) - 1:]
    lo, hi = int(sr / fmax), int(sr / fmin); k = lo + int(np.argmax(c[lo:hi]))
    return sr / k

def lead_offset(path):
    a, sr = sf.read(path, always_2d=True); m = np.abs(a).max(1)
    s = max(0, int(np.argmax(m > m.max() * 10 ** (-40 / 20))) - int(.002 * sr))
    return f' offset={s}' if s > int(.005 * sr) else ''

NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def from_name(f, shift=12):
    m = re.search(r'([A-G])(#|b)?(-?\d)', f); return NOTE[m.group(1)] + (1 if m.group(2) == '#' else -1 if m.group(2) == 'b' else 0) + (int(m.group(3)) + 1) * 12 + shift

def pitched(src, out, name, folder, match=r'.*\.wav$', vel=None, attack=0.003, release=0.6, extra='', fmin=60, fmax=1600, keyfn=None):
    d = os.path.join(src, folder); rows = []
    for f in sorted(os.listdir(d)):
        if not re.search(match, f): continue
        key = keyfn(f) if keyfn else int(round(69 + 12 * np.log2(f0(os.path.join(d, f), fmin, fmax) / 440)))
        v = vel(f) if vel else 1
        rows.append((key, v, f))
    keys = sorted({r[0] for r in rows}); vels = sorted({r[1] for r in rows})
    lines = [f'// {name}：由 sfz_vcsl.py 从 VCSL「{folder}」生成', '<control>', f'default_path={os.path.relpath(d, out)}/',
             f'<global> ampeg_attack={attack} ampeg_release={release} {extra}'.rstrip()]
    for key, v, f in sorted(rows):
        i = keys.index(key); lo = 0 if i == 0 else (keys[i - 1] + key) // 2 + 1; hi = 127 if i == len(keys) - 1 else (key + keys[i + 1]) // 2
        vi = vels.index(v); vlo = 1 + vi * 127 // len(vels); vhi = (vi + 1) * 127 // len(vels)
        same = [r for r in rows if r[0] == key and r[1] == v]; seq = f' seq_length={len(same)} seq_position={same.index((key, v, f)) + 1}' if len(same) > 1 else ''
        lines.append(f'<region> sample={f} pitch_keycenter={key} lokey={lo} hikey={hi} lovel={vlo} hivel={vhi}{seq}{lead_offset(os.path.join(d, f))}')
    open(os.path.join(out, name + '.sfz'), 'w').write('\n'.join(lines) + '\n')
    print(f'{name}.sfz  {len(rows)} 个采样  实测音域 {keys[0]}–{keys[-1]}  力度层 {len(vels)}')

def hits(src, out, name, mapping, release=1.5):
    """一个键一个采样（打击乐、滑音）。mapping = {键: (相对路径, 额外 opcode)}"""
    lines = [f'// {name}：由 sfz_vcsl.py 生成，键位见下', '<control>', f'default_path={os.path.relpath(src, out)}/', f'<global> ampeg_release={release}']
    for key, (p, opc) in mapping.items():
        lines.append(f'<region> sample={p} key={key} pitch_keytrack=0{lead_offset(os.path.join(src, p))} {opc}'.rstrip())
    open(os.path.join(out, name + '.sfz'), 'w').write('\n'.join(lines) + '\n'); print(f'{name}.sfz  {len(mapping)} 个键')

DYN = {'pp': 1, 'p': 2, 'mp': 3, 'mf': 4, 'f': 5, 'ff': 6, 'fff': 7}
if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
    pitched(src, out, 'guzheng', 'Chordophones/Zithers/Dan Tranh/Normal', vel=lambda f: DYN.get(f.split('_')[1], 4), release=1.2)
    pitched(src, out, 'xun', 'Aerophones/Edge-blown Aerophones/Ocarina, Typical/Sustains/Sus', attack=0.12, release=0.5, fmin=150)
    pitched(src, out, 'bianzhong', 'Idiophones/Struck Idiophones/Tubular Bells 1', vel=lambda f: DYN.get(f.split('_')[2], 4), release=3.0, keyfn=from_name)
    G = 'Chordophones/Zithers/Dan Tranh/Gliss/'; FD = 'Membranophones/Struck Membranophones/Frame Drum/'; I = 'Idiophones/Struck Idiophones/'
    hits(src, out, 'zheng_gliss', {48: (G + 'Gliss_Up_Med_ff_1.wav', ''), 50: (G + 'Gliss_Dwn_Med_ff_1.wav', ''), 52: (G + 'Gliss_Dwn_Slw_ff_1.wav', '')}, release=1.0)
    hits(src, out, 'han_perc', {
        36: (FD + 'HDrumL_Hit_v3_rr1_Sum.wav', ''),        # 建鼓重击
        37: (FD + 'HDrumL_Hit_v2_rr1_Sum.wav', ''),        # 建鼓轻击
        38: (FD + 'HDrumL_HitMuted_v2_rr1_Sum.wav', ''),   # 闷击
        41: (I + 'Slit Drum/LogDrumLo_MedM_v2_rr1_Sum.wav', ''),  # 梆子（低）
        43: (I + 'Slit Drum/LogDrumHi_MedM_v2_rr1_Sum.wav', ''),  # 梆子（高）
        45: (I + 'Gong 1/gong_mf.wav', 'ampeg_release=4'),        # 大锣"匡"
        46: (I + 'Gong 1/gong_p.wav', 'ampeg_release=4'),
        47: (I + 'Gong 1/gong_fff.wav', 'ampeg_release=5'),
        60: (I + 'Woodblock/wood_click_f_rr1.wav', ''),           # 木鱼
        61: (I + 'Woodblock/wood_click_mp.wav', ''),
        62: (I + 'Claves/Claves1_Hit_v2_rr1_Mid.wav', ''),        # 拍板
    }, release=1.5)
