// 柔光动画画风的 12 秒动态样片（无声）：画法照参考片（glow.js），运动语汇用 atmos/motion.js
//  0.0–3.2 特写 → 拉远揭示 | 3.2–4.6 静止 | 4.6–7.6 村子灯火依次亮、提灯的人沿小路汇聚 | 6.8–11.2 天色推移
//  9.4 太阳越过山脊：闪白 + 冲击波 | 9.4–12 缓慢推近
// 运行：node glow_motion.js stills 0.5,4,7,9.45,11.5 out.png | node glow_motion.js video out.mp4
'use strict';
const { createCanvas } = require('@napi-rs/canvas');
const { spawn } = require('child_process');
const fs = require('fs');
const W = 1080, H = 1920, FPS = 24, DUR = 12, S = { K: 0, Z: 1 };
const A = require('../atmos/atmos')({ S, createCanvas, W, H });
const M = require('../atmos/motion')({ W, H });
const G = require('./glow')({ createCanvas });
const { E, prog, clamp, lerp } = M;
const INK = G.INK;

// ---------- 世界几何 ----------
const slopeY = x => 1720 - x * 0.52 - 40 * Math.sin(x / 180) - 18 * Math.sin(x / 61);
const pathY = x => slopeY(x) + 70 - (x - 120) * 0.06 + 10 * Math.sin(x / 90);
const PATH = []; for (let x = -160; x <= 800; x += 16) PATH.push([x, pathY(x)]);
const walkerX = t => 400 + t * 16;
const SUN = t => ({ x: 700, y: lerp(1180, 860, E.out(prog(t, 7.4, 12))) });
const T_FLASH = 9.4;
const CAM = [
  [0, { x: walkerX(0) + 30, y: slopeY(walkerX(0)) - 80, z: 3.0 }],
  [3.2, { x: 540, y: 980, z: 1 }, E.io],
  [9.4, { x: 540, y: 980, z: 1 }],
  [12, { x: 500, y: 1100, z: 1.14 }, E.io],
];

// 带描边的肢体：先画粗的墨色，再画细一点的本色（参考片角色的手臂、轮子就是这样）
function limb(ctx, pts, col, w = 7) { G.outline(ctx, pts, { w: w + 5, closed: false }); G.outline(ctx, pts, { w, col, closed: false }); }

// ---------- 人：圆润的豆形斗篷 + 圆头 + 药丸眼，粗的干净描边 ----------
function person(ctx, x, y, s, phase, walking, pal, seed, lit, mood = 'open') {
  const sw = walking ? Math.sin(phase) : 0, bob = walking ? Math.abs(Math.cos(phase)) * 2.5 : 0, P = (dx, dy) => [x + dx * s, y + (dy - bob) * s];
  const coat = seed % 3 === 0 ? ['#d98a52', '#7a3d2a'] : seed % 3 === 1 ? ['#8fa36a', '#3f4a33'] : ['#c76b5b', '#6a2e2c'];
  limb(ctx, [P(-5, -26), P(-6 - sw * 9, 0)], '#3a2f3a', 6 * s); limb(ctx, [P(6, -26), P(7 + sw * 9, 0)], '#3a2f3a', 6 * s);
  const cloak = G.circle(x + 1 * s, y - (44 + bob) * s, 22 * s, 18).map(([px, py]) => [px, py < y - (44 + bob) * s ? py : py + (py - (y - (44 + bob) * s)) * 0.45]);
  G.body(ctx, cloak, { lit: coat[0], dark: coat[1], rim: pal.accent, rimA: 0.7 * lit, rimW: 5 * s, light: [0.8, -0.4], w: 4.5 * s, seed });
  const head = G.circle(x + 2 * s, y - (78 + bob) * s, 14 * s, 20);
  G.body(ctx, head, { lit: '#f2c7a0', dark: '#b07a5c', rim: pal.accent, rimA: 0.5 * lit, rimW: 3 * s, light: [0.8, -0.4], w: 4.5 * s, seed: seed + 1, tex: 0.5 });
  const hood = [P(-14, -80), P(-12, -94), P(2, -100), P(16, -92), P(17, -80), P(10, -88), P(-4, -90)];
  G.body(ctx, hood, { lit: coat[0], dark: coat[1], w: 4 * s, seed: seed + 2, tex: 0.6 });
  G.eyes(ctx, x + 5 * s, y - (77 + bob) * s, s * 0.8, mood, { gap: 14 });
  const swing = walking ? Math.sin(phase * 0.5) * 3 : 0, lx = x + (26 + swing) * s, ly = y - (34 + bob) * s;
  limb(ctx, [P(14, -52), P(22, -44), P(24 + swing, -40)], coat[1], 5 * s);
  const lan = G.roundRect(lx - 7 * s, ly, 14 * s, 17 * s, 3 * s, 2);
  ctx.fillStyle = '#ffe9b8'; G.trace(ctx, lan, true, false); ctx.fill(); G.outline(ctx, lan, { w: 3.5 * s, smooth: false });
  return [lx, ly + 9 * s];
}

function hill(ctx, pal, t) {
  const top = []; for (let x = -340; x <= W + 340; x += 10) top.push([x, slopeY(x)]);
  const pts = [...top, [W + 340, H * 1.4], [-340, H * 1.4]];
  const g = ctx.createLinearGradient(0, 1000, 0, 1900); g.addColorStop(0, G.mix(pal.near, pal.far, 0.22)); g.addColorStop(1, G.mix(pal.near, '#000000', 0.25));
  ctx.fillStyle = g; G.trace(ctx, pts, true, false); ctx.fill();
  G.texture(ctx, pts, { seed: 41, spots: 30, streaks: 160, alpha: 0.9, smooth: false });
  const path = PATH.filter(p => p[0] > 100); ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = G.rgba(pal.haze, 0.22); ctx.lineWidth = 12; ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.restore();
  A.grassEdge(ctx, top, { h: 34, dens: 0.5, col: G.mix(pal.near, '#000000', 0.1), rim: pal.rim, rimA: 0.55, t, seed: 45 });
  G.rimDashes(ctx, top, pal.rim, { a: 0.45 });
  return pts;
}

function cabin(ctx, pal, t, lit) {
  const x = 820, y = slopeY(860) + 8, w = 150, h = 96;
  ctx.save(); ctx.filter = 'blur(8px)';
  for (let i = 0; i < 8; i++) { const a = ((t * 0.18 + i / 8) % 1), sx = x + 41 + a * 60 + Math.sin(t * 0.8 + i) * 10, sy = y - h - 100 - a * 260; ctx.fillStyle = G.rgba(pal.haze, 0.3 * (1 - a)); ctx.beginPath(); ctx.ellipse(sx, sy, 12 + a * 40, 9 + a * 26, 0.3, 0, 7); ctx.fill(); }
  ctx.restore();
  const chim = [[x + 30, y - h - 30], [x + 30, y - h - 92], [x + 54, y - h - 92], [x + 54, y - h - 18]];
  G.body(ctx, chim, { lit: '#7a6058', dark: '#3a2c30', smooth: false, w: 4.5, seed: 50 });
  const wall = [[x, y], [x, y - h], [x + w, y - h], [x + w, y]];
  G.body(ctx, wall, { lit: '#8a6a55', dark: '#3d2e34', smooth: false, w: 5, seed: 51, rim: pal.rim, rimA: 0.35, rimW: 6, light: [0.7, -0.7] });
  ctx.save(); ctx.strokeStyle = G.rgba(INK, 0.35); ctx.lineWidth = 2; for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.moveTo(x + 6, y - h + k * 16); ctx.lineTo(x + w - 6, y - h + k * 16); ctx.stroke(); } ctx.restore();
  const roof = [[x - 20, y - h + 6], [x + w * 0.5, y - h - 72], [x + w + 20, y - h + 6]];
  G.body(ctx, roof, { lit: '#6d4b4b', dark: '#2b1f2c', smooth: false, w: 5, seed: 54, rim: pal.rim, rimA: 0.5, rimW: 7, light: [0.7, -0.7] });
  const win = G.roundRect(x + 90, y - 72, 36, 36, 4, 2);
  ctx.fillStyle = G.mix('#ffd38a', '#3d2e34', 1 - lit * 0.9); G.trace(ctx, win, true, false); ctx.fill(); G.outline(ctx, win, { w: 4, smooth: false });
  G.outline(ctx, [[x + 108, y - 72], [x + 108, y - 36]], { w: 3, closed: false });
  return [x + 108, y - 54];
}

const VILLAGE = [120, 175, 240, 300, 350, 420, 470, 980, 1040];
function village(ctx, pal, yAt, t, glows) {
  VILLAGE.forEach((vx, i) => {
    const y = yAt(vx) + 6, w = 26 + (i % 3) * 6, h = 18 + (i % 2) * 5; ctx.fillStyle = G.mix(pal.near, pal.far, 0.45);
    ctx.fillRect(vx - w / 2, y - h, w, h + 8); ctx.beginPath(); ctx.moveTo(vx - w / 2 - 4, y - h + 1); ctx.lineTo(vx, y - h - 14); ctx.lineTo(vx + w / 2 + 4, y - h + 1); ctx.fill();
    const k = M.lightUp(t, 4.6, i, 0.28); if (k > 0) { ctx.fillStyle = `rgba(255,214,140,${clamp(k)})`; ctx.fillRect(vx - 4, y - h * 0.65, 7, 7); glows.push([vx, y - h * 0.5, 14, k]); }
  });
}

// ---------- 合成 ----------
const GRAINS = [0, 1, 2].map(i => { const cv = createCanvas(W, H), g = cv.getContext('2d'), img = g.createImageData(W, H), r = M.rng(9 + i); for (let j = 0; j < img.data.length; j += 4) { const v = 128 + (r() - 0.5) * 26; img.data[j] = img.data[j + 1] = img.data[j + 2] = v; img.data[j + 3] = 255; } g.putImageData(img, 0, 0); return cv; });
const VIG = (() => { const cv = createCanvas(W, H), g = cv.getContext('2d'), v = g.createRadialGradient(W / 2, H * 0.45, H * 0.28, W / 2, H * 0.48, H * 0.78); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.4)'); g.fillStyle = v; g.fillRect(0, 0, W, H); return cv; })();
const SMALL = createCanvas(W / 4, H / 4), SG = SMALL.getContext('2d');
// 泛光：把画面缩小、模糊，只留亮的部分，screen 叠回去（参考片里光源周围那种柔和的晕）
function bloom(ctx, cv, a = 0.45) {
  SG.globalCompositeOperation = 'source-over'; SG.filter = 'none'; SG.drawImage(cv, 0, 0, W / 4, H / 4);
  const img = SG.getImageData(0, 0, W / 4, H / 4), d = img.data; for (let i = 0; i < d.length; i += 4) { const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255, k = clamp((l - 0.55) / 0.35); d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; } SG.putImageData(img, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = a; ctx.filter = 'blur(10px)'; ctx.drawImage(SMALL, 0, 0, W, H); ctx.filter = 'none'; ctx.restore();
}

function frame(ctx, cv, t) {
  S.K = Math.floor(t * 12); const tq = t;   // 柔光动画：画面内容和镜头都按 24fps 平滑（不一拍二）；S.K 只用于星星闪烁、颗粒这类每张换一次的东西
  const cam = M.camAt(CAM, t), kick = t >= T_FLASH ? Math.max(0, 1 - (t - T_FLASH) / 0.5) : 0, hh = M.handheld(t, 1, kick * 0.6);
  const day = E.io(prog(tq, 6.8, 11.2)), pal = M.blendPal(A.PAL.night, A.PAL.dusk, day, A.mix), sun = SUN(tq), lit = 1 - 0.65 * day;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  A.sky(ctx, pal, { horizon: 1050, glowX: lerp(300, sun.x, day), glow: lerp(0.25, 0.6, day) });
  G.skyStreaks(ctx, W, 300, 950, pal.rim, { n: 5, a: lerp(0.06, 0.12, day) });
  ctx.globalAlpha = 1 - day; A.stars(ctx, { n: 260, maxY: 1050 }); ctx.globalAlpha = 1;
  S.Z = M.layerXf(ctx, cam, 0.05, hh);
  if (day < 0.98) { ctx.globalAlpha = 1 - day; A.moon(ctx, 300, 380, 40, A.PAL.night, { halo: 0.22 }); ctx.globalAlpha = 1; }
  S.Z = M.layerXf(ctx, cam, 0.1, hh);
  if (tq > 7.4) A.sun(ctx, sun.x, sun.y, 52, pal, { rays: 0.06 * day, nRays: 14, t: tq, bloom: 0.5 + 0.6 * day });
  const L = { x: lerp(300, sun.x, day), y: lerp(380, sun.y, day) }, glows = [];
  A.ridges(ctx, pal, { n: 6, top: 980, bottom: 1330, seed: 7, amp: [110, 190], maxDark: 0.62, light: { x: L.x, a: lerp(0.3, 0.8, day) }, haze: lerp(0.45, 0.6, day),
    before: (i, d) => { S.Z = M.layerXf(ctx, cam, lerp(0.15, 0.6, d), hh); },
    after: (i, yAt, d) => { if (i === 2 || i === 3) G.forest(ctx, yAt, G.mix(pal.far, pal.near, 0.62 * Math.pow(d, 0.85)), { x0: -300, x1: W + 300, size: lerp(40, 80, d), seed: 30 + i, gaps: 0.5 }); if (i === 4) village(ctx, pal, yAt, tq, glows); } });
  for (const [x, y, r, k] of glows) A.glow(ctx, x, y, r, pal.accent, 0.7 * clamp(k) * lit);
  S.Z = M.layerXf(ctx, cam, 0.7, hh); A.mistBand(ctx, 1240, 120, pal.haze, lerp(0.12, 0.26, day), { t: tq });
  S.Z = M.layerXf(ctx, cam, 1, hh);
  const hillPts = hill(ctx, pal, tq);
  ctx.fillStyle = 'rgba(5,5,15,0.45)'; ctx.beginPath(); ctx.ellipse(650, pathY(640) + 360, 150, 26, -0.45, 0, 7); ctx.fill();   // 石头压在坡上的影子
  G.rock(ctx, 640, pathY(640) + 250, 120, { seed: 4, lit: G.mix('#6b5047', '#a07060', day), dark: '#1d1f33', rim: pal.rim, light: [-0.7 + day * 1.2, -0.7] });
  const win = cabin(ctx, pal, tq, lit);
  const wx = walkerX(tq), lights = [person(ctx, wx, slopeY(wx) + 6, 1.5, tq * 7, true, pal, 60, lit)];
  for (const c of M.convoy(PATH, tq, { n: 9, t0: 5.0, gap: 0.32, dur: 3.2, spacing: 0.06, end: 0.62 }))
    lights.push(person(ctx, c.x, c.y + 4, 1.1, c.phase, c.walking, pal, 200 + c.i * 7, lit, tq > 10 ? 'happy' : 'open'));
  for (const [x, y] of lights) { A.spill(ctx, hillPts, x, y, 160, pal.accent, 0.35 * lit); A.glow(ctx, x, y, 22, pal.accent, 0.9 * lit); }
  A.glow(ctx, win[0], win[1], 30, pal.accent, 0.7 * lit);
  for (const e of M.embers(wx + 40, slopeY(wx) - 40, tq, { n: 8, spread: 140, rise: 90, seed: 8 })) G.bokeh(ctx, e.x, e.y, e.s * 3, pal.accent, e.a * 0.5 * lit);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  bloom(ctx, cv, 0.5);
  A.contrast(ctx, { pivot: lerp(0.2, 0.3, day), k: lerp(1.15, 1.06, day) });
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.25; ctx.drawImage(GRAINS[S.K % 3], 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(VIG, 0, 0);
  S.Z = M.layerXf(ctx, cam, 0.1, hh); M.shockRing(ctx, sun.x, sun.y, t, T_FLASH, { dur: 1.0, w: 8 });
  M.flash(ctx, t, T_FLASH, { dur: 0.5, peak: 0.8 });
}

const [mode, a2, a3] = process.argv.slice(2);
const cv = createCanvas(W, H), ctx = cv.getContext('2d');
if (mode === 'stills') {
  const ts = a2.split(',').map(Number), sheet = createCanvas(360 * ts.length, 640), sg = sheet.getContext('2d');
  ts.forEach((t, i) => { frame(ctx, cv, t); sg.drawImage(cv, i * 360, 0, 360, 640); fs.writeFileSync(a3.replace(/\.png$/, `_${t}.png`), cv.toBuffer('image/png')); });
  fs.writeFileSync(a3, sheet.toBuffer('image/png')); console.log('stills ok');
} else {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', a2], { stdio: ['pipe', 'inherit', 'inherit'] });
  (async () => {
    const N = DUR * FPS, t0 = Date.now();
    for (let f = 0; f < N; f++) { frame(ctx, cv, f / FPS); const buf = Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); if (f % 48 === 0) console.log(`frame ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
    ff.stdin.end(); ff.on('close', c => console.log('done', c));
  })();
}
