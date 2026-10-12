// 第 4 期动画公共库：纸纹、抖线、错位上色、缓动、读配音时间、字幕、渲染输出
'use strict';
// 技能里的示例模块从它们自己的目录找依赖：把本目录的 node_modules 加进搜索路径
process.env.NODE_PATH = require('path').join(__dirname, 'node_modules'); require('module').Module._initPaths();
const fs = require('fs'), PATH = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { spawn } = require('child_process');
const SKILL = PATH.join(__dirname, '../../../skills/documentary-video');
const C = require(PATH.join(SKILL, 'scripts/examples/ink-sticker/char34'));
const NT = require(PATH.join(SKILL, 'scripts/examples/ink-sticker/night'));
const SUB = require(PATH.join(SKILL, 'scripts/subtitles'));
const ROOT = PATH.join(__dirname, '..');
const { INK, PAPER, LW, G, clamp, lerp, sm, jit, path, resample, chaikin, smooth, ell } = C;

GlobalFonts.registerFromPath(PATH.join(ROOT, 'assets/fonts/LXGWWenKai-Medium.ttf'), 'WenKai');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 'ZenHei');

const W = 1080, H = 1920;
const LANG = process.env.LANG_V || 'zh';
const STR = JSON.parse(fs.readFileSync(PATH.join(ROOT, 'strings.json'), 'utf8'));
const S_ = k => STR[k][LANG];

// ---------- 缓动 ----------
const eo = t => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const backOut = k => { k = clamp(k); const c = 2.2; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

// ---------- 线条 ----------
const prep = (p, closed) => resample(p, 6, closed);
const rectP = (x, y, w, h) => prep([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
function ink(ctx, P, prog = 1, { w = LW, col = INK, closed = false, seed = 0 } = {}) {
  if (prog <= 0) return; const Q = jit(P, seed); const n = Math.max(2, Math.floor(Q.length * clamp(prog)));
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; path(ctx, Q.slice(0, n), closed && prog >= 1); ctx.stroke();
}
function fillP(ctx, P, col, seed = 0, dx = 0, dy = 0) { const Q = jit(P, seed + 101, 1.5).map(p => [p[0] + dx, p[1] + dy]); ctx.fillStyle = col; path(ctx, Q, true); ctx.fill(); }
// 平涂 + 一档阴影 + 墨线 + 贴纸投影
function solid(ctx, P, col, { sh = null, seed = 0, ink: inkCol = INK, w = LW, lit = [12, -6], shadow = 'rgba(8,10,28,0.32)', noShadow = false } = {}) {
  if (!noShadow) fillP(ctx, P, shadow, seed + 7, 8, 10);
  fillP(ctx, P, col, seed);
  if (sh) { ctx.save(); path(ctx, P); ctx.clip(); fillP(ctx, P, sh, seed + 3); fillP(ctx, P, col, seed + 3, lit[0], lit[1]); ctx.restore(); }
  ink(ctx, P, 1, { closed: true, seed, col: inkCol, w });
}
// 冲击短线
function burst(ctx, x, y, t, t0, { n = 8, r0 = 60, len = 46, dur = 0.4, w = 6, col = INK, spread = 0.36, a0 = -Math.PI / 2 } = {}) {
  const k = (t - t0) / dur; if (k <= 0 || k >= 1) return;
  for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * spread, r = r0 + 60 * eo(k), l = len * (1 - k);
    ctx.strokeStyle = col; ctx.lineWidth = w * (1 - k * 0.5); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.lineTo(x + Math.cos(a) * (r + l), y + Math.sin(a) * (r + l)); ctx.stroke(); }
}

// ---------- 配音时间 ----------
const SHOTS = JSON.parse(fs.readFileSync(PATH.join(ROOT, 'audio', LANG, 'shots.json'), 'utf8'));
const shot = id => SHOTS.find(s => s.id === id);
const isCounted = ch => /[\p{L}\p{N}]/u.test(ch);
const charTime = (s, i) => { let k = 0; for (let j = 0; j < i; j++) if (isCounted(s.text[j])) k++; return s.chartimes[Math.min(k, s.chartimes.length - 1)] ?? s.start; };
// 某个分镜里某个词开始的时刻（找不到就返回 fallback 比例处）
function wordTime(id, word, fb = 0.5) { const s = shot(id), i = LANG === 'en' ? s.text.toLowerCase().indexOf(word.toLowerCase()) : s.text.indexOf(word);
  return i >= 0 ? charTime(s, i) : lerp(s.speech_start, s.speech_end, fb); }

// ---------- 字幕 ----------
const HL = SUB.loadHighlights(ROOT);
const SUBS = SUB.buildSubs(SHOTS, LANG, HL, charTime);
const drawSubs = (ctx, t) => SUB.drawSubs(ctx, t, SUBS, LANG, { W, y: 1395, font: 'ZenHei', size: { zh: 66, en: 56 }, stroke: '#14121c', strokeW: 13 });

// ---------- 纸纹 ----------
const PAPER_TEX = (() => { const c = createCanvas(W, H), x = c.getContext('2d'); x.fillStyle = PAPER; x.fillRect(0, 0, W, H); let s = 5; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 380; i++) { const px = r() * W, py = r() * H, rr = 30 + r() * 160; const g = x.createRadialGradient(px, py, 0, px, py, rr); const dk = r() < .5; g.addColorStop(0, dk ? 'rgba(150,120,90,0.035)' : 'rgba(255,252,240,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(110,90,70,${r() * 0.05})`; x.fillRect(r() * W, r() * H, 1.5, 1.5); } return c; })();

// ---------- 输出 ----------
// frameFn(ctx, t)：t 是全片时间（与配音同一条时间轴）
function still(frameFn, t, out) { const cv = createCanvas(W, H), ctx = cv.getContext('2d'); frameFn(ctx, t); fs.writeFileSync(out, cv.toBuffer('image/png')); }
function sheet(frameFn, ts, out, tw = 360) { const th = tw * 16 / 9, cols = Math.min(4, ts.length), rows = Math.ceil(ts.length / cols); const sh = createCanvas(tw * cols, th * rows), sx = sh.getContext('2d'), cv = createCanvas(W, H), ctx = cv.getContext('2d');
  ts.forEach((t, i) => { frameFn(ctx, t); sx.drawImage(cv, (i % cols) * tw, Math.floor(i / cols) * th, tw, th); sx.fillStyle = '#c00'; sx.font = '22px ZenHei'; sx.fillText(t.toFixed(2), (i % cols) * tw + 8, Math.floor(i / cols) * th + 26); });
  fs.writeFileSync(out, sh.toBuffer('image/png')); }
function video(frameFn, t0, t1, fps, out) { const cv = createCanvas(W, H), ctx = cv.getContext('2d');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  let n = 0; const N = Math.round((t1 - t0) * fps);
  return new Promise(res => { const write = () => { while (n < N) { frameFn(ctx, t0 + n / fps); const ok = ff.stdin.write(Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer)); n++; if (!ok) { ff.stdin.once('drain', write); return; } } ff.stdin.end(); };
    ff.on('close', c => res(c)); write(); }); }

module.exports = { C, NT, SUB, W, H, LANG, S_, eo, eio, backOut, prep, rectP, ink, fillP, solid, burst, SHOTS, shot, charTime, wordTime, drawSubs, PAPER_TEX, still, sheet, video, ROOT };
