#!/usr/bin/env python3
"""混音：旁白 + 背景音乐 + 音效 → 自动闪避（ducking）+ 响度标准化，可选直接合进视频。

只依赖 ffmpeg，不需要 numpy/scipy。

用法:
  python mix_audio.py --voice audio/narration.wav --bgm audio/bgm.wav --sfx audio/sfx.wav --out audio/mix.wav
  python mix_audio.py --voice audio/narration.wav --bgm audio/bgm.mp3 --out audio/mix.wav --video out/video.mp4 --final out/final.mp4

做了什么:
  1. 背景音乐用旁白做侧链压缩：有人说话时音乐自动压低约 9–12 dB，停顿处缓慢回升（--duck 调深浅）。
     比手工画音量包络更稳，重录配音后不用重新调。
  2. 音效不参与闪避（它们本来就要和动作对齐、清楚可闻），按 --sfx-gain 混入。
  3. 整体做两遍 loudnorm，统一到 YouTube 推荐的 -14 LUFS、真峰值 -1.5 dBTP（--lufs 可改；抖音/B 站同样适用）。
  4. 打印混音前后的响度，方便写进检查报告。

可选参数:
  --bgm-gain -6     背景音乐进入闪避前的增益（dB）
  --sfx-gain 0      音效增益（dB）
  --duck 10         说话时音乐被压低的大致深度（dB）
  --lufs -14        目标综合响度
  --bgm-fade 2      音乐结尾淡出秒数（音乐比旁白长时自动在旁白结束后 1 秒处淡出）
"""
import argparse
import json
import os
import re
import subprocess
import sys


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode:
        sys.exit("ffmpeg 失败：\n" + p.stderr[-2000:])
    return p.stderr


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path],
                         capture_output=True, text=True).stdout
    return float(json.loads(out)["format"]["duration"])


def measure(path, lufs):
    err = run(["ffmpeg", "-hide_banner", "-i", path, "-af", f"loudnorm=I={lufs}:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"])
    return json.loads(re.findall(r"\{[^{}]*\}", err)[-1])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", required=True)
    ap.add_argument("--bgm")
    ap.add_argument("--sfx")
    ap.add_argument("--out", required=True)
    ap.add_argument("--video")
    ap.add_argument("--final")
    ap.add_argument("--bgm-gain", type=float, default=-6)
    ap.add_argument("--sfx-gain", type=float, default=0)
    ap.add_argument("--duck", type=float, default=10)
    ap.add_argument("--lufs", type=float, default=-14)
    ap.add_argument("--bgm-fade", type=float, default=2)
    a = ap.parse_args()

    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    total = duration(a.video) if a.video else duration(a.voice) + 1.0

    inputs = ["-i", a.voice]
    chains = [f"[0:a]aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur={total:.3f},asplit=2[v][key]"]   # 旁白补静音到全片长度：否则旁白一结束，侧链闪避会把后面的音乐一起切断
    mix = ["[v]"]
    idx = 1
    if a.bgm:
        inputs += ["-stream_loop", "-1", "-i", a.bgm]  # 音乐比片子短时循环
        fade_at = max(0.0, total - a.bgm_fade)
        # ratio 越大压得越深；threshold 约 -30 dBFS 时普通语音都能触发
        ratio = max(2.0, a.duck / 2)
        chains.append(f"[{idx}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:{total:.3f},"
                      f"volume={a.bgm_gain}dB,afade=t=out:st={fade_at:.3f}:d={a.bgm_fade}[b]")
        chains.append(f"[b][key]sidechaincompress=threshold=0.03:ratio={ratio}:attack=80:release=600:makeup=1[bd]")
        mix.append("[bd]")
        idx += 1
    else:
        chains[0] = "[0:a]aformat=sample_rates=48000:channel_layouts=stereo[v]"
    if a.sfx:
        inputs += ["-i", a.sfx]
        chains.append(f"[{idx}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={a.sfx_gain}dB[s]")
        mix.append("[s]")
    chains.append(f"{''.join(mix)}amix=inputs={len(mix)}:duration=longest:normalize=0,atrim=0:{total:.3f}[m]")

    raw = os.path.splitext(a.out)[0] + ".premix.wav"
    run(["ffmpeg", "-y", "-hide_banner", *inputs, "-filter_complex", ";".join(chains), "-map", "[m]", "-c:a", "pcm_s16le", raw])

    # 两遍 loudnorm：先测量，再按测量值线性校正
    m = measure(raw, a.lufs)
    ln = (f"loudnorm=I={a.lufs}:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    run(["ffmpeg", "-y", "-hide_banner", "-i", raw, "-af", ln + ",aresample=48000", "-c:a", "pcm_s16le", a.out])
    os.remove(raw)
    after = measure(a.out, a.lufs)
    print(f"混音前 {float(m['input_i']):.1f} LUFS / 峰值 {float(m['input_tp']):.1f} dBTP"
          f" → 混音后 {float(after['input_i']):.1f} LUFS / 峰值 {float(after['input_tp']):.1f} dBTP  → {a.out}")

    if a.video and a.final:
        run(["ffmpeg", "-y", "-hide_banner", "-i", a.video, "-i", a.out, "-map", "0:v", "-map", "1:a",
             "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", a.final])
        print(f"成片 → {a.final}")


if __name__ == "__main__":
    main()
