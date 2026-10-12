#!/usr/bin/env python3
"""代码编曲环境（Windows 版，对应 setup.sh）：不装系统软件、不需要管理员权限，全部放进一个目录。

- Python 包：mido、pedalboard、soundfile、numpy
- sfizz 1.2.3 官方 Windows 包里自带 sfizz_render.exe（只取 exe 和 dll）
- Surge XT 1.3.4 便携版（插件 + SurgeXTData 出厂音色），不运行安装程序
- 采样库：Salamander 钢琴、Sam's Sonor 鼓组、VSCO-2 CE 用到的目录（含 CC0 的鼓 drums/）
- 生成 <目录>/sfz/*.sfz、<目录>/sfzmap.json、<目录>/env.json（render.py 自动读取）

用法: python setup_windows.py [安装目录，默认 E:\\music-kit]
注意：在 Git Bash 里手动跑 git sparse-checkout 时，以 / 开头的路径会被改写成 C:/Program Files/Git/...，
要先 export MSYS_NO_PATHCONV=1；本脚本直接用 subprocess 调 git，不受影响。
"""
import json, os, subprocess, sys, urllib.request, zipfile

K = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else r'E:\music-kit')
HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(K, 'dl'), exist_ok=True)
run = lambda *a, **kw: subprocess.run(list(a), check=True, **kw)

def fetch(url, name):
    p = os.path.join(K, 'dl', name)
    if not os.path.exists(p):
        print('下载', url); urllib.request.urlretrieve(url, p)
    return p

run(sys.executable, '-m', 'pip', 'install', '-q', 'mido', 'pedalboard', 'soundfile', 'numpy')

# sfizz_render.exe
sfz_dir = os.path.join(K, 'sfizz')
if not os.path.exists(os.path.join(sfz_dir, 'sfizz_render.exe')):
    z = zipfile.ZipFile(fetch('https://github.com/sfztools/sfizz/releases/download/1.2.3/sfizz-1.2.3-win64.zip', 'sfizz-win64.zip'))
    os.makedirs(sfz_dir, exist_ok=True)
    for n in ('bin/Release/sfizz_render.exe', 'bin/Release/sfizz.dll'):
        open(os.path.join(sfz_dir, os.path.basename(n)), 'wb').write(z.read(n))

# Surge XT 便携版
surge_root = os.path.join(K, 'surge', 'Surge Synth Team')
if not os.path.exists(os.path.join(surge_root, 'Surge XT.vst3')):
    zipfile.ZipFile(fetch('https://github.com/surge-synthesizer/releases-xt/releases/download/1.3.4/surge-xt-win64-1.3.4-portable-install.zip', 'surge-portable.zip')).extractall(os.path.join(K, 'surge'))

# 采样库
def clone(url, d, sparse=None):
    if os.path.isdir(os.path.join(K, d)): return
    if sparse:
        run('git', 'clone', '-q', '--depth', '1', '--filter=blob:none', '--no-checkout', url, d, cwd=K)
        run('git', '-C', d, 'sparse-checkout', 'set', '--no-cone', *sparse, cwd=K)
        run('git', '-C', d, 'checkout', '-q', 'HEAD', cwd=K)
    else:
        run('git', 'clone', '-q', '--depth', '1', url, d, cwd=K)
clone('https://github.com/sfzinstruments/SalamanderGrandPiano', 'SalamanderGrandPiano')   # 约 1.4 GB，CC BY 3.0
clone('https://github.com/sfzinstruments/SamsSonor', 'SamsSonor')                         # 约 70 MB，CC BY-SA 4.0
clone('https://github.com/sgossner/VSCO-2-CE', 'VSCO-2-CE', [                              # 约 1 GB，CC0
    '/Strings/Violin Section/Pizz/', '/Strings/Violin Section/susVib/', '/Strings/Viola Section/susvib/',
    '/Strings/Cello Section/susvib/', '/Strings/Cello Section/pizzT/', '/Percussion/Xylo/', '/Percussion/Glock/',
    '/Percussion/Timpani/', '/VSCO 1 Percussion/varMetal/Cymbals/', '/VSCO 1 Percussion/drums/'])

run(sys.executable, os.path.join(HERE, 'sfz_gen.py'), os.path.join(K, 'VSCO-2-CE'), os.path.join(K, 'sfz'))
s = lambda n: os.path.join(K, 'sfz', n + '.sfz')
m = {'piano': os.path.join(K, 'SalamanderGrandPiano', 'Salamander Grand Piano V3.sfz'), 'drums': os.path.join(K, 'SamsSonor', 'SamsSonor.sfz')}
m.update({n: s(n) for n in ['violins_sus', 'violas_sus', 'cellos_sus', 'violins_pizz', 'cellos_pizz', 'xylophone', 'glockenspiel', 'orch_perc']})
if os.path.exists(s('drums_cc0')): m['drums_cc0'] = s('drums_cc0')
json.dump(m, open(os.path.join(K, 'sfzmap.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
# pedalboard 在 Windows 上要指向 .vst3 包里面的 DLL，直接给包目录会报"unsupported plugin format"
json.dump({'SURGE_VST3': os.path.join(surge_root, 'Surge XT.vst3', 'Contents', 'x86_64-win', 'Surge XT.vst3'), 'SURGE_PATCHES': os.path.join(surge_root, 'SurgeXTData', 'patches_factory'),
           'SFIZZ_RENDER': os.path.join(sfz_dir, 'sfizz_render.exe')}, open(os.path.join(K, 'env.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('装好了 →', K)
print(f'试一下：python "{HERE}\\score_cat_example.py" out && python "{HERE}\\render.py" out "{K}\\sfzmap.json" && python "{HERE}\\mix.py" out --duration 15')
