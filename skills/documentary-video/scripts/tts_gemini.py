#!/usr/bin/env python3
"""用 Gemini TTS 逐个分镜生成配音，并记录每段真实时长。

用法:
  python tts_gemini.py beats.json audio/ --whole      # 默认用法：整段一次生成，不切分
  python tts_gemini.py beats.json audio/ [--voice Charon] [--model gemini-3.8-flash-tts]
                       [--only 03,07] [--style "..."]   # 备用：逐个分镜生成

beats.json 格式（由 Claude 根据 STORYBOARD.md 生成）:
  [
    {"id": "01", "text": "1871年，一位二十八岁的英国物理学家……"},
    {"id": "02", "text": "他叫约翰·威廉·斯特拉特。<short pause> 他想回答……"}
  ]
text 里可以使用停顿标签 <short pause>、<long pause>。

--whole 输出:
  audio/narration.wav       整段配音
  audio/narration_text.txt  实际发送的文字（分镜分界处在句末时自动加 <long pause>，句子中间不加）
  之后用 align_shots.py 对时。

逐段模式输出:
  audio/beat-01.wav、audio/beat-02.wav……
  audio/durations.json  每段的真实时长（秒）

API Key 读取顺序：环境变量 GEMINI_API_KEY → 用户主目录下的 .gemini_api_key 文件。
文件里可以放多个 Key（每行一个）：前一个 Key 当天额度用完时，自动换下一个继续。
Key 不要写进项目文件夹（项目可能会被分享或上传）。
默认不加语气指令（style），实测默认演绎更自然；只在用户要求时用 --style。
"""
import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
import wave

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions"


class QuotaExhausted(Exception):
    pass


def synth(text, voice, model, style, key, retries=4):
    item = {"type": "text", "text": text}
    if style:
        item["annotations"] = [{"type": "speech_metadata", "style": style}]
    body = json.dumps({
        "model": model,
        "input": [{"type": "user_input", "content": [item]}],
        "response_format": {"type": "audio"},
        "generation_config": {"speech_config": [{"voice": voice}]},
    }, ensure_ascii=False).encode("utf-8")
    last = None
    for attempt in range(retries):
        req = urllib.request.Request(ENDPOINT, data=body, method="POST", headers={
            "x-goog-api-key": key, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.load(r)
            audio = [c["data"] for s in data.get("steps", []) if s.get("type") == "model_output"
                     for c in s.get("content", []) if c.get("type") == "audio"]
            if audio:
                return base64.b64decode(audio[-1])
            last = "响应里没有音频数据"
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}: {e.read().decode('utf-8', 'ignore')[:300]}"
            if e.code in (400, 401):
                break  # 请求格式或 Key 有问题，重试没有意义
            if e.code == 429 and "per day" in last:
                raise QuotaExhausted(last)  # 当天额度用完，重试没有意义
        except Exception as e:  # 网络波动等
            last = str(e)
        wait = 15 * (attempt + 1)
        print(f"  第 {attempt + 1} 次失败（{last[:120]}），{wait} 秒后重试……", file=sys.stderr)
        time.sleep(wait)
    raise RuntimeError(last)


def build_whole_text(beats, pause="long"):
    """分镜分界在句末才加停顿（pause: long / short / none）；在句子中间不加，避免把一句话读成两截。
    long 的实际长度不稳定（实测 1.6–2.6 秒，整条片子会被拖慢）；用户嫌停顿长时用 short。beats 里手写的停顿标签照原样保留。"""
    parts = []
    for i, b in enumerate(beats):
        t = b["text"].strip()
        parts.append(t)
        if i < len(beats) - 1:
            bare = t.replace("<long pause>", "").replace("<short pause>", "").rstrip()
            if bare and bare[-1] in "。？！.?!…" and not t.endswith("pause>"):
                if pause != "none": parts.append(f" <{pause} pause> ")
    return "".join(parts)


class Keys:
    """多个 Key 轮换：当前 Key 当天额度用完就换下一个；全部用完才抛出 QuotaExhausted。"""
    def __init__(self, keys): self.keys, self.i = keys, 0
    def synth(self, *args):
        while True:
            try:
                return synth(*args, self.keys[self.i])
            except QuotaExhausted:
                if self.i + 1 >= len(self.keys): raise
                self.i += 1
                print(f"第 {self.i} 个 Key 今天的额度用完了，换第 {self.i + 1} 个继续……")


def whole(beats, a, key):
    os.makedirs(a.outdir, exist_ok=True)
    text = build_whole_text(beats, a.pause)
    open(os.path.join(a.outdir, "narration_text.txt"), "w", encoding="utf-8").write(text)
    print(f"整段生成中（{len(beats)} 个分镜，{len(text)} 字符，1 次调用）……")
    try:
        audio = key.synth(text, a.voice, a.model, a.style)
    except QuotaExhausted:
        sys.exit("今天所有 Key 的调用额度都已用完。请明天再试，或在 Google AI Studio 开通付费层。")
    out = os.path.join(a.outdir, "narration.wav")
    open(out, "wb").write(audio)
    with wave.open(out) as w:
        dur = w.getnframes() / w.getframerate()
    print(f"已保存 {out}，时长 {dur:.2f} 秒。下一步：用 align_shots.py 对时并逐段检查。")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("beats")
    ap.add_argument("outdir")
    ap.add_argument("--voice", default="Charon")
    ap.add_argument("--pause", default="long", choices=["long", "short", "none"], help="整段模式下句末分镜分界处的停顿")
    ap.add_argument("--model", default="gemini-3.8-flash-tts")
    ap.add_argument("--style", default="", help="语气指令，默认留空")
    ap.add_argument("--only", default="", help="只重录指定分镜，逗号分隔，如 03,07")
    ap.add_argument("--whole", action="store_true", help="整段一次生成，不切分（默认推荐）")
    a = ap.parse_args()

    keys = [k for k in [os.environ.get("GEMINI_API_KEY", "").strip()] if k]
    key_file = os.path.join(os.path.expanduser("~"), ".gemini_api_key")
    if os.path.exists(key_file):
        keys += [k.strip() for k in open(key_file, encoding="utf-8").read().splitlines() if k.strip() and k.strip() not in keys]
    if not keys:
        sys.exit(f"没有找到 API Key。请把 Key 保存到 {key_file}（每行一个 Key，不放其他内容）。")
    key = Keys(keys)
    beats = json.load(open(a.beats, encoding="utf-8"))
    if a.whole:
        return whole(beats, a, key)
    only = {x.strip() for x in a.only.split(",") if x.strip()}
    os.makedirs(a.outdir, exist_ok=True)
    dpath = os.path.join(a.outdir, "durations.json")
    durations = json.load(open(dpath, encoding="utf-8")) if os.path.exists(dpath) else {}

    failed = []
    for b in beats:
        bid = str(b["id"])
        if only and bid not in only:
            continue
        out = os.path.join(a.outdir, f"beat-{bid}.wav")
        print(f"分镜 {bid} 生成中……")
        try:
            audio = key.synth(b["text"], a.voice, a.model, a.style)
        except QuotaExhausted:
            rest = [str(x["id"]) for x in beats if (not only or str(x["id"]) in only) and str(x["id"]) not in durations]
            sys.exit(f"今天的调用额度已用完（免费层每天只有少量次数）。已完成的分镜已保存。\n"
                     f"未完成：{','.join(rest)}。请明天再用 --only 参数继续，或在 Google AI Studio 开通付费层。\n"
                     f"不要换用其他模型补齐，否则前后音色会不一致。")
        except RuntimeError as e:
            print(f"  分镜 {bid} 失败：{e}", file=sys.stderr)
            failed.append(bid)
            continue
        open(out, "wb").write(audio)
        with wave.open(out) as w:
            durations[bid] = round(w.getnframes() / w.getframerate(), 3)
            raw = w.readframes(w.getnframes()); sw = w.getsampwidth()
        import array, math
        samples = array.array('h', raw) if sw == 2 else array.array('b', raw)
        rms = math.sqrt(sum(x * x for x in samples) / max(1, len(samples))) / (32768 if sw == 2 else 128)
        db = 20 * math.log10(max(rms, 1e-9))
        print(f"  已保存 {out}，时长 {durations[bid]} 秒，音量 {db:.1f} dBFS")
        if db < -50:
            print(f"  警告：分镜 {bid} 几乎是静音，请重新生成", file=sys.stderr)
            failed.append(bid)
        json.dump(durations, open(dpath, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        time.sleep(1)

    print(f"总时长 {round(sum(durations.values()), 2)} 秒，时长记录在 {dpath}")
    if failed:
        sys.exit(f"以下分镜生成失败，请稍后用 --only {','.join(failed)} 重试")


if __name__ == "__main__":
    main()
