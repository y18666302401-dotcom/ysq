// 大气镜头动态样片（12 秒，无声）：参考片的运动语汇按纪录片的用法重排
//  0.0–3.2  特写（提灯的人）→ 拉远揭示大景（E.io 慢起慢停）
//  3.2–4.6  静止蓄势：镜头停住，只有环境在动（草、星、雾、云、灯火）+ 人慢慢走
//  4.6–7.6  一变多：远处村子的窗灯依次亮起，山下一队提灯的人沿小路汇聚上来
//  7.6–9.4  蓄势：天色从夜往黎明推移，地平线越来越亮，太阳从山后升起
//  9.4      太阳越过山脊：闪白 + 冲击波环 + 轻微震动
//  9.4–12   余波：天色到黎明，镜头缓慢推近人群，灯笼的光被天光盖过
// 运行：node motion_sample.js video out.mp4 | node motion_sample.js stills 0.5,4,7,9.45,11.5 out.png
'use strict';
const { createCanvas } = require('@napi-rs/canvas');
const { spawn } = require('child_process');
const fs = require('fs');
const W = 1080, H = 1920, FPS = 24, DUR = 12, S = { K: 0, Z: 1 };
const B = require('../fine-hand/brush')({ S, createCanvas });
const A = require('./atmos')({ S, createCanvas, W, H });
const M = require('./motion')({ W, H });
const { E, prog, clamp, lerp } = M;

// ---------- 世界几何（主体层坐标） ----------
const slopeY = x => 1720 - x * 0.52 - 40 * Math.sin(x / 180) - 18 * Math.sin(x / 61);
const pathY = x => slopeY(x) + 70 - (x - 120) * 0.06 + 10 * Math.sin(x / 90);
const PATH = []; for (let x = -160; x <= 800; x += 16) PATH.push([x, pathY(x)]);
const walkerX = t => 380 + t * 16;
const SUN = t => ({ x: 700, y: lerp(1180, 860, E.out(prog(t, 7.4, 12))) });
const T_FLASH = 9.4;
const CAM = [
  [0, { x: walkerX(0) + 30, y: slopeY(walkerX(0)) - 70, z: 3.0 }],
  [3.2, { x: 540, y: 980, z: 1 }, E.io],
  [9.4, { x: 540, y: 980, z: 1 }],
  [12, { x: 500, y: 1100, z: 1.14 }, E.io],
];

// ---------- 人：结实的斗篷剪影，走路时腿交替、身体上下颠 ----------
function person(ctx, x, y, s, phase, walking, pal, seed, lit) {
  const P = (dx, dy) => [x + dx * s, y + dy * s], sw = walking ? Math.sin(phase) : 0, bob = walking ? Math.abs(Math.cos(phase)) * 2 : 0;
  y -= bob * s;
  B.brush(ctx, [P(-3, -34), P(-4 - sw * 8, -16), P(-6 - sw * 12, 0)], { w: 5.5, seed: seed + 1, smooth: true });
  B.brush(ctx, [P(5, -34), P(6 + sw * 8, -16), P(8 + sw * 12, 0)], { w: 5.5, seed: seed + 2, smooth: true });
  const cloak = [P(-6, -76), P(8, -76), P(14, -60), P(16, -34), P(4, -30), P(-12, -30), P(-22 - sw * 2, -36), P(-17, -54)];
  B.wash(ctx, cloak, seed % 2 ? '#6e4230' : '#4d4a3a', { seed: seed + 3, gran: 0.25, blot: 0 });
  B.hatchForm(ctx, cloak, { depth: 10 * s, sp: 5, w: 1, alpha: 0.55, seed: seed + 4 });
  B.brush(ctx, cloak, { w: 3, closed: true, seed: seed + 5, smooth: true });
  const head = Array.from({ length: 14 }, (_, i) => P(2 + Math.cos(i / 14 * 6.28) * 7, -84 + Math.sin(i / 14 * 6.28) * 7.5));
  B.wash(ctx, head, '#d9a982', { seed: seed + 6, blot: 0 }); B.brush(ctx, head, { w: 2.4, closed: true, seed: seed + 7, smooth: true });
  const hood = [P(-9, -84), P(-4, -95), P(8, -95), P(12, -86), P(8, -80), P(4, -90), P(-4, -88), P(-6, -76)];
  B.wash(ctx, hood, '#5a3426', { seed: seed + 8, blot: 0 }); B.brush(ctx, hood, { w: 2.6, closed: true, seed: seed + 9, smooth: true });
  const swing = walking ? Math.sin(phase * 0.5) * 3 : 0;
  B.brush(ctx, [P(9, -64), P(18, -52), P(22 + swing, -44)], { w: 4, seed: seed + 10, smooth: true });
  B.brush(ctx, [P(14, -60), P(16, -34)], { w: 1.6, col: pal.accent, alpha: 0.8 * lit, seed: seed + 11 });
  const lx = x + (22 + swing) * s, ly = y - 34 * s;
  ctx.fillStyle = '#ffe2a6'; ctx.fillRect(lx - 6 * s, ly - 4 * s, 12 * s, 15 * s);
  B.brush(ctx, [[lx - 7 * s, ly - 5 * s], [lx + 7 * s, ly - 5 * s], [lx + 7 * s, ly + 11 * s], [lx - 7 * s, ly + 11 * s]], { w: 2, closed: true, seed: seed + 12 });
  return [lx, ly + 3 * s];
}

function hill(ctx, pal, t) {
  const top = []; for (let x = -340; x <= W + 340; x += 10) top.push([x, slopeY(x)]);
  const pts = [...top, [W + 340, H * 1.4], [-340, H * 1.4]];
  const col = A.mix(pal.near, pal.far, 0.12);
  B.wash(ctx, pts, col, { seed: 41, edge: pal.near, edgeA: 0.25, blot: 0, gran: 0.25 });
  B.hatchForm(ctx, pts, { ang: -0.55, sp: 14, w: 1.3, col: pal.near, depth: 60, alpha: 0.4, seed: 42 });
  const r = M.rng(43); ctx.strokeStyle = A.rgba(pal.near, 0.55); ctx.lineCap = 'round';
  for (let i = 0; i < 320; i++) { const x = -200 + r() * (W + 400), y0 = slopeY(x) + 30 + r() * (H * 1.3 - slopeY(x)), L = 6 + (y0 - slopeY(x)) * 0.03; ctx.lineWidth = 1 + L * 0.08; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + L * 0.5, y0 - L); ctx.stroke(); }
  B.brush(ctx, PATH.filter(p => p[0] > 100), { w: 7, col: A.mix(col, pal.haze, 0.35), alpha: 0.55, seed: 44, smooth: true });
  A.grassEdge(ctx, top, { h: 30, col: A.mix(pal.near, col, 0.4), rim: pal.rim, rimA: 0.45, t, seed: 45 });
  return pts;
}

function cabin(ctx, pal, t, warm) {
  const x = 820, y = slopeY(860) + 8, w = 150, h = 96;
  const wall = [[x, y], [x, y - h], [x + w, y - h], [x + w, y]], roof = [[x - 18, y - h + 4], [x + w * 0.5, y - h - 70], [x + w + 18, y - h + 4]], chim = [[x + 30, y - h - 40], [x + 30, y - h - 92], [x + 52, y - h - 92], [x + 52, y - h - 28]];
  // 烟：一团团软烟随时间上升、变大、变淡（环境运动）
  ctx.save(); ctx.filter = 'blur(6px)';
  for (let i = 0; i < 8; i++) { const a = ((t * 0.18 + i / 8) % 1), sx = x + 41 + a * 60 + Math.sin(t * 0.8 + i) * 10, sy = y - h - 100 - a * 260; ctx.fillStyle = A.rgba(pal.haze, 0.26 * (1 - a)); ctx.beginPath(); ctx.ellipse(sx, sy, 12 + a * 40, 9 + a * 26, 0.3, 0, 7); ctx.fill(); }
  ctx.restore();
  B.wash(ctx, chim, '#4a3a33', { seed: 50 }); B.brush(ctx, chim, { w: 2.6, seed: 49 });
  B.wash(ctx, wall, A.mix(pal.near, '#5a4636', 0.45), { seed: 51, gran: 0.3, blot: 0 });
  for (let k = 1; k < 6; k++) B.brush(ctx, [[x + 4, y - h + k * 16], [x + w - 4, y - h + k * 16 + 1]], { w: 1.2, alpha: 0.5, seed: 52 + k });
  B.hatchForm(ctx, wall, { depth: 26, sp: 8, alpha: 0.55, seed: 53 });
  B.wash(ctx, roof, A.mix(pal.near, '#3b2a24', 0.4), { seed: 54, gran: 0.3, blot: 0 });
  B.brush(ctx, wall, { w: 3.5, closed: true, seed: 55 }); B.brush(ctx, roof, { w: 4, closed: true, seed: 56 });
  B.brush(ctx, [[x + w * 0.5, y - h - 70], [x + w + 18, y - h + 4]], { w: 1.6, col: pal.rim, alpha: 0.7, seed: 57 });
  const win = [[x + 92, y - 70], [x + 124, y - 70], [x + 124, y - 36], [x + 92, y - 36]];
  ctx.fillStyle = A.mix('#ffd38a', pal.near, 1 - warm); ctx.beginPath(); win.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.fill();
  B.brush(ctx, win, { w: 2.4, closed: true, seed: 58 }); B.brush(ctx, [[x + 108, y - 70], [x + 108, y - 36]], { w: 1.6, seed: 59 });
  return [x + 108, y - 53];
}

// 远处村子：画在第 4 层山脊上，窗灯依次亮起（一变多）
const VILLAGE = [120, 175, 240, 300, 350, 420, 470, 980, 1040];
function village(ctx, pal, yAt, t, glows) {
  VILLAGE.forEach((vx, i) => {
    const y = yAt(vx) + 6, w = 26 + (i % 3) * 6, h = 18 + (i % 2) * 5, col = A.mix(pal.near, pal.far, 0.45);
    ctx.fillStyle = col; ctx.fillRect(vx - w / 2, y - h, w, h + 8);
    ctx.beginPath(); ctx.moveTo(vx - w / 2 - 4, y - h + 1); ctx.lineTo(vx, y - h - 14); ctx.lineTo(vx + w / 2 + 4, y - h + 1); ctx.fill();
    const k = M.lightUp(t, 4.6, i, 0.28);
    if (k > 0) { ctx.fillStyle = `rgba(255,214,140,${clamp(k)})`; ctx.fillRect(vx - 4, y - h * 0.65, 7, 7); glows.push([vx, y - h * 0.5, 14, k]); }
  });
}

// ---------- 合成一帧 ----------
const GRAINS = [0, 1, 2].map(i => { const cv = createCanvas(W, H), g = cv.getContext('2d'), img = g.createImageData(W, H), r = M.rng(9 + i); for (let j = 0; j < img.data.length; j += 4) { const v = 128 + (r() - 0.5) * 34; img.data[j] = img.data[j + 1] = img.data[j + 2] = v; img.data[j + 3] = 255; } g.putImageData(img, 0, 0); return cv; });
const VIG = (() => { const cv = createCanvas(W, H), g = cv.getContext('2d'), v = g.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.48, H * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = v; g.fillRect(0, 0, W, H); return cv; })();

function frame(ctx, t) {
  S.K = Math.floor(t * 12); const tq = S.K / 12;                       // 画面内容一拍二，镜头按 24 帧平滑
  const cam = M.camAt(CAM, t), kick = Math.max(0, 1 - (t - T_FLASH) / 0.5) * (t >= T_FLASH ? 1 : 0);
  const hh = M.handheld(t, 1, kick * 0.6);
  const day = E.io(prog(tq, 6.8, 11.2)), pal = M.blendPal(A.PAL.night, A.PAL.dawn, day, A.mix), sun = SUN(tq);
  const lit = 1 - 0.65 * day;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // 天空（p=0）
  A.sky(ctx, pal, { horizon: 1050, glowX: lerp(300, sun.x, day), glow: lerp(0.25, 0.6, day) });
  ctx.globalAlpha = 1 - day; A.stars(ctx, { n: 170, maxY: 1000 }); ctx.globalAlpha = 1;
  S.Z = M.layerXf(ctx, cam, 0.05, hh);
  if (day < 0.98) { ctx.globalAlpha = 1 - day; A.moon(ctx, 300, 380, 56, A.PAL.night, { halo: 0.55 }); ctx.globalAlpha = 1; }
  S.Z = M.layerXf(ctx, cam, 0.1, hh);
  if (tq > 7.4) A.sun(ctx, sun.x, sun.y, 46, pal, { rays: 0.07 * day, nRays: 14, t: tq, bloom: 0.4 + 0.6 * day });
  S.Z = M.layerXf(ctx, cam, 0.08, hh);
  const L = { x: lerp(300, sun.x, day), y: lerp(380, sun.y, day) };
  A.clouds(ctx, pal, { y: 560, n: 3, seed: 12, light: L, a: 0.85, scale: 0.6, spread: W * 1.2, t: tq, speed: 6 });
  A.clouds(ctx, pal, { y: 200, n: 2, seed: 19, light: L, a: 0.7, scale: 0.42, t: tq, speed: 3 });
  // 远山（每层不同视差），第 4 层上放村子
  const glows = [];
  A.ridges(ctx, pal, { n: 6, top: 980, bottom: 1330, seed: 7, amp: [110, 190], maxDark: 0.62, light: { x: L.x, a: lerp(0.35, 0.9, day) }, trees: [3], haze: lerp(0.45, 0.6, day), wash: B.wash,
    before: (i, d) => { S.Z = M.layerXf(ctx, cam, lerp(0.15, 0.6, d), hh); },
    after: (i, yAt) => { if (i === 4) village(ctx, pal, yAt, tq, glows); } });
  for (const [x, y, r, k] of glows) A.glow(ctx, x, y, r, pal.accent, 0.7 * clamp(k) * lit);
  S.Z = M.layerXf(ctx, cam, 0.7, hh); A.mistBand(ctx, 1240, 120, pal.haze, lerp(0.12, 0.28, day), { t: tq });
  // 主体层（p=1）
  S.Z = M.layerXf(ctx, cam, 1, hh);
  const hillPts = hill(ctx, pal, tq);
  const win = cabin(ctx, pal, tq, 1);
  const wx = walkerX(tq), lights = [person(ctx, wx, slopeY(wx) + 6, 1.5, tq * 7, true, pal, 60, lit)];
  for (const c of M.convoy(PATH, tq, { n: 9, t0: 5.0, gap: 0.32, dur: 3.2, spacing: 0.06, end: 0.62 }))
    lights.push(person(ctx, c.x, c.y + 4, 1.15, c.phase, c.walking, pal, 200 + c.i * 20, lit));
  for (const [x, y] of lights) { A.spill(ctx, hillPts, x, y, 220, pal.accent, 0.4 * lit); A.glow(ctx, x, y, 22, pal.accent, 0.85 * lit); }
  A.glow(ctx, win[0], win[1], 30, pal.accent, 0.7 * lit);
  // 调色（屏幕空间）
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  A.contrast(ctx, { pivot: lerp(0.2, 0.3, day), k: lerp(1.25, 1.12, day) });
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.35; ctx.drawImage(GRAINS[S.K % 3], 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(VIG, 0, 0);
  // 高潮：太阳越过山脊 → 冲击波环 + 闪白（调色之后画，保持干净的白）
  S.Z = M.layerXf(ctx, cam, 0.1, hh); M.shockRing(ctx, sun.x, sun.y, t, T_FLASH, { dur: 1.0, w: 8 });
  M.flash(ctx, t, T_FLASH, { dur: 0.5, peak: 0.75 });
}

// ---------- 渲染 ----------
const [mode, a2, a3] = process.argv.slice(2);
const cv = createCanvas(W, H), ctx = cv.getContext('2d');
if (mode === 'stills') {
  const ts = a2.split(',').map(Number), sheet = createCanvas(360 * ts.length, 640), sg = sheet.getContext('2d');
  ts.forEach((t, i) => { frame(ctx, t); sg.drawImage(cv, i * 360, 0, 360, 640); sg.fillStyle = '#ff0'; sg.font = '22px sans-serif'; sg.fillText(t + 's', i * 360 + 8, 28); fs.writeFileSync(a3.replace(/\.png$/, `_${t}.png`), cv.toBuffer('image/png')); });
  fs.writeFileSync(a3, sheet.toBuffer('image/png')); console.log('stills ok');
} else {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', a2], { stdio: ['pipe', 'inherit', 'inherit'] });
  (async () => {
    const N = DUR * FPS, t0 = Date.now();
    for (let f = 0; f < N; f++) {
      frame(ctx, f / FPS);
      const buf = Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 48 === 0) console.log(`frame ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); ff.on('close', c => console.log('done', c));
  })();
}
