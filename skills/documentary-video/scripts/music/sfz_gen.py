#!/usr/bin/env python3
"""给 VSCO-2 CE 的原始采样写 SFZ 乐器定义（VSCO-2 只提供 wav，不带 sfz）。

SFZ 是纯文本：每个采样一个 <region>，写明它覆盖的音高范围、力度范围、轮换次序，
起音（ampeg_attack）、释音（ampeg_release）都能直接改。

用法: python sfz_gen.py <VSCO-2-CE 目录> <输出目录>
"""
import os, re, sys
from collections import defaultdict

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def midi(name):  # "A#3" → 58（C4 = 60）
    m = re.match(r'([A-G])(#|b)?(-?\d)', name)
    n = NAMES[m.group(1)] + (1 if m.group(2) == '#' else -1 if m.group(2) == 'b' else 0)
    return n + (int(m.group(3)) + 1) * 12

def pitched(src, out, name, folder, attack=0.005, release=0.3, transpose=12, extra=''):
    """按文件名里的音名、力度层（v1 最轻）、轮换号（rr）自动排好键位和力度区。
    VSCO-2 的文件名用"C3 = 中央 C"的记法，实测每个采样都比文件名高一个八度，所以默认 transpose=12。"""
    d = os.path.join(src, folder)
    rows = []
    for f in sorted(os.listdir(d)):
        if not f.lower().endswith('.wav'): continue
        m = re.search(r'_([A-G][#b]?-?\d)(?:_|\.)', f)
        if not m: continue
        v = re.search(r'_v(\d)', f); rr = re.search(r'_(?:rr|RR)?(\d)(?:_Sum)?\.wav$', f, re.I) if re.search(r'rr\d|RR\d|_v\d_\d', f) else None
        rows.append((midi(m.group(1)) + transpose, int(v.group(1)) if v else 1, int(rr.group(1)) if rr else 1, f))
    notes = sorted({r[0] for r in rows}); vels = sorted({r[1] for r in rows})
    # 用到 CC11（表情踏板）控制音量时，默认值设为满，否则不发 CC11 就没有声音
    lines = [f'// {name}：由 sfz_gen.py 从 VSCO-2 CE「{folder}」生成', '<control>', f'default_path={os.path.relpath(d, out)}/'] + (['set_cc11=127'] if 'oncc11' in extra else []) + [
             f'<global> ampeg_attack={attack} ampeg_release={release} {extra}'.rstrip()]
    for r in sorted(rows):
        key, v, rr, f = r
        i = notes.index(key)
        lo = 0 if i == 0 else (notes[i - 1] + key) // 2 + 1
        hi = 127 if i == len(notes) - 1 else (key + notes[i + 1]) // 2
        vi = vels.index(v); vlo = 1 + vi * 127 // len(vels); vhi = (vi + 1) * 127 // len(vels)
        rrs = sorted({x[2] for x in rows if x[0] == key and x[1] == v})
        seq = f' seq_length={len(rrs)} seq_position={rrs.index(rr) + 1}' if len(rrs) > 1 else ''
        lines.append(f'<region> sample={f} pitch_keycenter={key} lokey={lo} hikey={hi} lovel={vlo} hivel={vhi}{seq}')
    open(os.path.join(out, name + '.sfz'), 'w').write('\n'.join(lines) + '\n')
    print(f'{name}.sfz  {len(rows)} 个采样  音域 {notes[0]}–{notes[-1]}  力度层 {len(vels)}')

def hits(src, out, name, mapping, release=1.5):
    """打击乐：一个键对应一个采样。mapping = {键: (相对路径, 采样本身的音高或 None)}"""
    lines = [f'// {name}：由 sfz_gen.py 生成，键位见下', '<control>', f'default_path={os.path.relpath(src, out)}/', 'set_cc11=127', f'<global> ampeg_release={release}']
    import numpy as np, soundfile as sf
    for key, (path, opc) in mapping.items():
        # 打击乐要卡画面：跳过采样开头的静音（有的录音在击打前空了 0.1 秒，会让"砰"晚一拍）
        a, sr = sf.read(os.path.join(src, path), always_2d=True); m = np.abs(a).max(1)
        start = max(0, int(np.argmax(m > m.max() * 10 ** (-40 / 20))) - int(.002 * sr))
        off = f' offset={start}' if start > int(.005 * sr) else ''
        lines.append(f'<region> sample={path} key={key} pitch_keytrack=0{off} {opc}'.rstrip())
    open(os.path.join(out, name + '.sfz'), 'w').write('\n'.join(lines) + '\n')
    print(f'{name}.sfz  {len(mapping)} 个键')

if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
    # 持续音弦乐：原始采样起音只有几毫秒，太硬，拉长到 0.28 秒让弦乐渐强进入
    pitched(src, out, 'violins_sus', 'Strings/Violin Section/susVib', attack=0.28, release=0.6, extra='amplitude_oncc11=100')
    pitched(src, out, 'violas_sus', 'Strings/Viola Section/susvib', attack=0.28, release=0.6, extra='amplitude_oncc11=100')
    pitched(src, out, 'cellos_sus', 'Strings/Cello Section/susvib', attack=0.28, release=0.6, extra='amplitude_oncc11=100')
    pitched(src, out, 'violins_pizz', 'Strings/Violin Section/Pizz', release=0.25)
    pitched(src, out, 'cellos_pizz', 'Strings/Cello Section/pizzT', release=0.3)
    pitched(src, out, 'xylophone', 'Percussion/Xylo', release=0.8)
    pitched(src, out, 'glockenspiel', 'Percussion/Glock', release=1.5)
    P = 'Percussion/Timpani/'; C = 'VSCO 1 Percussion/varMetal/Cymbals/'
    hits(src, out, 'orch_perc', {
        38: (P + 'Timpani2_Hit_v4_rr1_Sum.wav', 'transpose=-4'),  # 定音鼓重击（实测约 F#，降 4 个半音到 D）
        50: (P + 'Rolls/Timpani3_Roll_v5_rr1_Sum.wav', 'amplitude_oncc11=100 ampeg_release=0.15'),  # 定音鼓滚奏（实测约 D3），用 CC11 做渐强
        49: (C + 'clash/crash_hit_ff_loose.wav', ''),              # 对镲
        51: (C + 'susp/susp_hit_softmall_roll2_cresc.wav', 'ampeg_release=0.2'),  # 吊镲渐强滚奏：采样在 3.8 秒处最响
        52: (C + 'susp/susp_hit_softmall_mp.wav', ''),
    }, release=2.5)
    # CC0 鼓组（VSCO-2 的 drums/），键位和 Sam's Sonor 一致，商用时把声部名 drums 换成 drums_cc0 即可；没有踩镲，用吊镲的金属轻击代替
    D = 'VSCO 1 Percussion/drums/'
    if os.path.isdir(os.path.join(src, D)):
        hits(src, out, 'drums_cc0', {
            36: (D + 'bass/bdrum_f_1.wav', ''),                          # 底鼓
            37: (D + 'snare/drum1/snare1_click.wav', ''),               # 边击
            38: (D + 'snare/drum1/snare1_f_1.wav', ''),
            40: (D + 'snare/drum1/snare1_ff_1.wav', ''),                # 军鼓
            42: (C + 'susp/susp_hit_metal_1.wav', 'ampeg_release=0.06 volume=-8'),   # 代替闭镲
        }, release=0.8)
