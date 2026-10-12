"""布景自查：抽帧指标 + 与参考帧并排的对比图。

用法：
  python frame_check.py <视频.mp4> --times 3.2,7.5,12 --out check/布景A [--night]
  python frame_check.py a.png b.png --out check/布景A [--night | --backlit]
  --style glow 柔光动画画风（可选）的门槛和参考帧
  --ref <目录> 换参考帧，例如大气景观布景用 references/styles/atmos-ref

每帧算四个指标并和门槛比较（门槛来自用户确认的样片参考帧实测值，见 styles/hand-drawn-cinematic.md 的"自查"）：
  mean   平均亮度           白天 0.25–0.45；夜景 >= 0.16
  std    整体对比度         >= 0.15
  topStd 上半屏对比度       >= 0.11（上半屏空、平会被拦下）
  p98    亮部（98% 分位）   >= 0.60（必须有看得见的光源或受光面）
输出 <out>_sheet.png：上排本期帧，下排参考帧，同尺寸并排；<out>_report.txt：逐帧指标和是否通过。
任何一帧不通过，退出码为 1。
"""
import argparse, glob, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REF_DIR = os.path.join(HERE, '..', 'references', 'styles', 'hand-drawn-cinematic-ref')
W = 540


def load(path):
    im = Image.open(path).convert('RGB')
    return im.resize((W, round(im.height * W / im.width)))


def metrics(im):
    a = np.asarray(im).astype(float) / 255
    L = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    top = L[: L.shape[0] // 2]
    return dict(mean=L.mean(), std=L.std(), topStd=top.std(), p98=np.percentile(L, 98))


# 柔光动画画风（styles/glow.md）的门槛：取自参考片实测（夜 mean 0.10–0.21、std 0.07–0.17、topStd 0.05–0.13、p98 0.24–0.79；
# 黎明 mean 0.48–0.57、std 0.19–0.25、p98 0.85–1.0），夜景略往亮放一点，照顾手机上看
def check_glow(m, night, backlit):
    f = []
    if night:
        if not 0.10 <= m['mean'] <= 0.30: f.append('mean 不在 0.10–0.30')
        if m['std'] < 0.08: f.append('std<0.08（主体和背景分不开）')
        if m['topStd'] < 0.045: f.append('topStd<0.045（上半屏空）')
        if m['p98'] < 0.25: f.append('p98<0.25（没有看得见的光源）')
    else:
        lo, hi = (0.40, 0.62) if backlit else (0.25, 0.50)
        if not lo <= m['mean'] <= hi: f.append(f'mean 不在 {lo}–{hi}')
        if m['std'] < 0.15: f.append('std<0.15')
        if m['topStd'] < 0.10: f.append('topStd<0.10')
        if m['p98'] < 0.70: f.append('p98<0.70')
    return f


def check(m, night, backlit=False, style='hand'):
    if style == 'glow': return check_glow(m, night, backlit)
    fails = []
    if night:
        if m['mean'] < 0.16: fails.append('mean<0.16（夜景太暗：加光源，不要整体压暗）')
    elif backlit:
        if not 0.25 <= m['mean'] <= 0.52: fails.append('mean 不在 0.25–0.52（逆光大景）')
    elif not 0.25 <= m['mean'] <= 0.45: fails.append('mean 不在 0.25–0.45')
    if m['std'] < 0.15: fails.append('std<0.15（明暗对比不足，主体和背景分不开）')
    if m['topStd'] < 0.11: fails.append('topStd<0.11（上半屏空或平）')
    if m['p98'] < 0.60: fails.append('p98<0.60（没有看得见的光源或受光面）')
    return fails


def grab(video, times, tmp):
    out = []
    for t in times:
        p = os.path.join(tmp, f'f_{t:.2f}.png')
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', str(t), '-i', video, '-frames:v', '1', p], check=True)
        out.append((f'{t:.2f}s', p))
    return out


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('inputs', nargs='+')
    ap.add_argument('--times', help='输入是视频时，抽帧的秒数，逗号分隔')
    ap.add_argument('--out', required=True, help='输出前缀，如 check/布景A')
    ap.add_argument('--night', action='store_true', help='夜景布景用夜景亮度门槛')
    ap.add_argument('--style', default='hand', choices=['hand', 'glow'], help='glow = 柔光动画画风：用它的门槛，参考帧默认换成 glow-ref')
    ap.add_argument('--backlit', action='store_true', help='太阳在画面里的日出/黄昏逆光大景：平均亮度上限放宽到 0.52')
    ap.add_argument('--ref', default=REF_DIR)
    a = ap.parse_args()

    if a.style == 'glow' and a.ref == REF_DIR: a.ref = os.path.join(HERE, '..', 'references', 'styles', 'glow-ref')
    tmp = tempfile.mkdtemp()
    if a.times:
        frames = grab(a.inputs[0], [float(x) for x in a.times.split(',')], tmp)
    else:
        frames = [(os.path.basename(p), p) for p in a.inputs]
    refs = sorted(glob.glob(os.path.join(a.ref, '*.png')))

    lines, bad = [], 0
    ims = []
    for name, p in frames:
        im = load(p); ims.append(im)
        m = metrics(im); f = check(m, a.night, a.backlit, a.style); bad += bool(f)
        lines.append(f"{name}  mean {m['mean']:.3f}  std {m['std']:.3f}  topStd {m['topStd']:.3f}  p98 {m['p98']:.3f}  "
                     + ('通过' if not f else '不通过：' + '；'.join(f)))
    lines.append('参考帧：')
    rims = []
    for p in refs:
        im = load(p); rims.append(im); m = metrics(im)
        lines.append(f"  {os.path.basename(p)}  mean {m['mean']:.3f}  std {m['std']:.3f}  topStd {m['topStd']:.3f}  p98 {m['p98']:.3f}")

    n = max(len(ims), len(rims)); h = max(i.height for i in ims + rims)
    sheet = Image.new('RGB', (n * W, 2 * h), (40, 40, 40))
    for i, im in enumerate(ims): sheet.paste(im, (i * W, 0))
    for i, im in enumerate(rims): sheet.paste(im, (i * W, h))
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    sheet.save(a.out + '_sheet.png')
    with open(a.out + '_report.txt', 'w', encoding='utf-8') as fh: fh.write('\n'.join(lines) + '\n')
    print('\n'.join(lines)); print(f'对比图：{a.out}_sheet.png')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
