#!/usr/bin/env python3
"""整段配音对时 + 逐段检查。

用法:
  python align_shots.py audio/beats.json audio/narration.wav audio/ --lang zh [--model small]

--lang 填 PROJECT.md 里的旁白语言（Whisper 语言代码）：中文 zh，英文 en，其他语言如 ja、es。
英文等拼音文字按字母对齐（忽略大小写、空格和标点），chartimes 里是每个字母的时刻。

做什么:
  1. 用 Whisper 识别整段配音，得到每个字的发音时刻；
  2. 和 beats.json 的旁白原文逐字对齐，算出每个分镜的起止时间（分界取两段话之间静音的中点）；
  3. 逐项检查并打印报告：每个分镜的说话窗口有没有人声、超过 1.5 秒的静音、识别和原文对不上的地方。

输出:
  audio/shots.json  每个分镜：id、start、end、speech_start、speech_end、text、chartimes（每个字的时刻）
  audio/words.json  Whisper 词级时间戳
识别结果里的同音错字（如“落基”识别成“落鸡”）不影响对时；报告里列出的“对不上”要人工听一下确认。
"""
import argparse, json, re, wave, difflib, sys
import numpy as np


def load_wav(path):
    w = wave.open(path); sr = w.getframerate(); ch = w.getnchannels()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    if ch > 1: x = x.reshape(-1, ch).mean(1)
    return x, sr


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("beats"); ap.add_argument("wav"); ap.add_argument("outdir")
    ap.add_argument("--model", default="small")
    ap.add_argument("--lang", required=True, help="旁白语言的 Whisper 代码，如 zh、en")
    a = ap.parse_args()
    prompt = {"zh": "以下是普通话纪录片旁白。", "en": "The following is documentary narration."}.get(a.lang)
    from faster_whisper import WhisperModel
    import scipy.signal as ss
    beats = json.load(open(a.beats, encoding="utf-8"))
    x, sr = load_wav(a.wav); dur = len(x) / sr
    x16 = ss.resample_poly(x, 16000, sr).astype(np.float32)  # 传数组，避开部分 av 版本读文件的兼容问题
    m = WhisperModel(a.model, device="cpu", compute_type="int8")
    segs, _ = m.transcribe(x16, language=a.lang, word_timestamps=True, initial_prompt=prompt)
    # 只保留文字和数字，其余（空格、中英文标点、停顿标签）全部去掉；统一小写
    clean = lambda s: re.sub(r"[\W_]", "", re.sub(r"<[^>]+>", "", s)).lower()
    words, chars = [], []
    for s in segs:
        for wd in s.words:
            words.append([wd.start, wd.end, wd.word])
            t = clean(wd.word)
            for i, c in enumerate(t):
                chars.append((c, wd.start + (wd.end - wd.start) * i / len(t), wd.start + (wd.end - wd.start) * (i + 1) / len(t)))
    json.dump(words, open(f"{a.outdir}/words.json", "w", encoding="utf-8"), ensure_ascii=False)

    texts = [re.sub(r"<[^>]+>", "", b["text"]) for b in beats]
    full = "".join(clean(t) for t in texts); owner = []
    for i, t in enumerate(texts): owner += [i] * len(clean(t))
    hyp = "".join(c for c, _, _ in chars)
    T0 = [None] * len(full); T1 = [None] * len(full)
    sm = difflib.SequenceMatcher(None, full, hyp, autojunk=False)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size): T0[blk.a + k] = chars[blk.b + k][1]; T1[blk.a + k] = chars[blk.b + k][2]
    idx = [i for i, v in enumerate(T0) if v is not None]
    if not idx: sys.exit("识别结果和原文完全对不上，请人工检查音频。")
    for i in range(len(T0)):  # 补齐没对上的字
        if T0[i] is None:
            lo = max([j for j in idx if j < i], default=None); hi = min([j for j in idx if j > i], default=None)
            if lo is None: T0[i] = T1[i] = T0[hi]
            elif hi is None: T0[i] = T1[i] = T1[lo] + 0.2 * (i - lo)
            else: T0[i] = T1[i] = T1[lo] + (T0[hi] - T1[lo]) * (i - lo) / (hi - lo)
    first = {}; last = {}
    for i, o in enumerate(owner): first.setdefault(o, T0[i]); last[o] = T1[i]
    bounds = [0.0] + [round((last[i - 1] + first[i]) / 2, 3) for i in range(1, len(beats))] + [round(dur, 3)]
    shots, pos = [], 0
    for i, b in enumerate(beats):
        n = len(clean(texts[i]))
        shots.append({"id": b["id"], "start": bounds[i], "end": bounds[i + 1], "speech_start": round(first[i], 3),
                      "speech_end": round(last[i], 3), "text": texts[i], "chartimes": [round(t, 3) for t in T0[pos:pos + n]]})
        pos += n
    json.dump(shots, open(f"{a.outdir}/shots.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    print(f"总时长 {dur:.2f} 秒，{len(shots)} 个分镜\n")
    print("① 逐段人声检查（每个分镜说话窗口的音量）")
    bad = []
    for s in shots:
        seg = x[int(s["speech_start"] * sr):int(s["speech_end"] * sr)]
        db = 20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9) if len(seg) else -120
        flag = "" if db > -50 else "  ← 几乎静音，必须处理"
        if flag: bad.append(s["id"])
        print(f"  分镜 {s['id']}: {s['start']:7.2f}–{s['end']:7.2f}  {db:6.1f} dBFS{flag}")
    print("\n② 超过 1.5 秒的静音")
    f = int(sr * 0.02); n = len(x) // f
    e = 20 * np.log10(np.sqrt((x[:n * f].reshape(n, f) ** 2).mean(1)) + 1e-9) < -45
    i, found = 0, 0
    while i < n:
        if e[i]:
            j = i
            while j < n and e[j]: j += 1
            if (j - i) * 0.02 > 1.5 and i > 0 and j < n:
                t0 = i * 0.02; sid = next((s["id"] for s in shots if s["start"] <= t0 < s["end"]), "?")
                print(f"  {t0:7.2f} 秒起，静音 {(j - i) * 0.02:.2f} 秒（分镜 {sid} 附近）"); found += 1
            i = j
        else: i += 1
    if not found: print("  没有")
    print("\n③ 识别和原文对不上的地方（同音错字可忽略，漏读、多读要人工听）")
    k = 0
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal": continue
        a_, b_ = full[i1:i2], hyp[j1:j2]
        if op == "replace" and len(a_) == len(b_) and len(a_) <= 2: continue          # 同音错字
        if re.fullmatch(r"[0-9.]+", b_ or "x") and re.fullmatch(r"[零一二三四五六七八九十百千万亿两点]+", a_ or "x"): continue  # 数字写法不同
        if op == "replace" and abs(len(a_) - len(b_)) <= 1 and max(len(a_), len(b_)) <= 3: continue
        t = chars[j1][1] if j1 < len(chars) else dur
        print(f"  {t:7.2f} 秒  原文「{full[i1:i2]}」 识别「{hyp[j1:j2]}」"); k += 1
        if k >= 40: print("  ……"); break
    if bad: print(f"\n有分镜没有人声：{','.join(bad)}，必须重新生成。")
    print("\n下一步：把以上报告和整段音频交给用户试听，等用户确认。")


if __name__ == "__main__":
    main()
