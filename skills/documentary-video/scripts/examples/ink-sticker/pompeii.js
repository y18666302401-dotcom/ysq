// 庞贝 · 公元 79 年 —— "线条画出世界、贴纸色块、挤压拉伸"手法套在灾难题材上的 10 秒样片（纯 Canvas 2D）
// 用法：node pompeii.js stills 1,2.5,3.6,4.3,5.5,7,8.2,9.6 sheet.png | node pompeii.js events | node pompeii.js video raw.mp4
'use strict';
const path = require('path'), fs = require('fs');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { spawn } = require('child_process');
GlobalFonts.registerFromPath('C:/Windows/Fonts/simkai.ttf', 'Kai');
GlobalFonts.registerFromPath('C:/Windows/Fonts/msyhbd.ttc', 'YaHeiB');

const W = 1080, H = 1920, FPS = 30, DUR = 10;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sm = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const eo = t => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const backOut = k => { k = clamp(k); const c = 2.2; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function vn(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), h = k => { const s = Math.sin((k + seed * 13.37) * 127.1) * 43758.5453; return s - Math.floor(s); }; return lerp(h(i), h(i + 1), u); }

// ---------- 色板（米白纸 + 深墨线 + 柔和贴纸色；红色只给岩浆） ----------
const PAPER = '#EFE6D6', INK = '#232845', SHADOW = 'rgba(70,50,30,0.16)';
const C = { mtn: '#A7BE9F', mtnD: '#8EA98B', plain: '#B8D190', sea: '#AECADC', seaD: '#93B6CC', wall: '#F7F0E3', roof: '#D9734E', roofD: '#B95B3C',
  cyp: '#5E8A6A', pine: '#6E9A6E', sun: '#F4B942', ray: '#EE9A3A', cloud: '#FBF8F1', plume: '#BDB3A8', plumeL: '#D3CAC0', surge: '#8E847B', surgeL: '#A79D93', lava: '#E4573D', ash: '#5E5650' };

// ---------- 时间线 ----------
const T = { tremor: 3.2, birds: 3.4, squash: 4.0, boom: 4.25, umbrella: 4.9, ash: 5.0, surge: 6.6, wash: 7.95, title: 8.15 };
let K = 0, TIME = 0;    // K：手绘"抖线"的张数（每秒 12 张）

// ---------- 线条工具 ----------
function chaikin(p, closed, n = 3) { for (let k = 0; k < n; k++) { const o = [], m = closed ? p.length : p.length - 1; if (!closed) o.push(p[0]); for (let i = 0; i < m; i++) { const a = p[i], b = p[(i + 1) % p.length]; o.push([.75 * a[0] + .25 * b[0], .75 * a[1] + .25 * b[1]], [.25 * a[0] + .75 * b[0], .25 * a[1] + .75 * b[1]]); } if (!closed) o.push(p[p.length - 1]); p = o; } return p; }
function resample(pts, step, closed) { const P = closed ? pts.concat([pts[0]]) : pts, out = [P[0]]; let acc = 0; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]); let pos = step - acc; while (pos < d) { const u = pos / d; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); pos += step; } acc = d - (pos - step); } if (!closed) out.push(P[P.length - 1]); return out; }
const prep = (pts, closed = false, smooth = 3) => resample(smooth ? chaikin(pts, closed, smooth) : pts, 4, closed);
function jit(P, seed, amp = 1.4) { return P.map((p, i) => [p[0] + (vn(i * 0.045 + seed * 7.1, K * 3.7 + seed) - .5) * 2 * amp, p[1] + (vn(i * 0.045 + seed * 3.3 + 50, K * 3.7 + seed + 9) - .5) * 2 * amp]); }
function ink(ctx, P, prog = 1, { w = 5.5, col = INK, closed = false, seed = 0, pen = true, alpha = 1 } = {}) {
  if (prog <= 0) return; const Q = jit(P, seed); const n = Math.max(2, Math.floor(Q.length * clamp(prog)));
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(Q[0][0], Q[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(Q[i][0], Q[i][1]); if (closed && prog >= 1) ctx.closePath(); ctx.stroke();
  if (pen && prog < 1) { const e = Q[n - 1]; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(e[0], e[1], w * 0.95, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function fillP(ctx, P, col, seed = 0, dx = 0, dy = 0) { const Q = jit(P, seed + 101, 1.8); ctx.fillStyle = col; ctx.beginPath(); Q.forEach((p, i) => i ? ctx.lineTo(p[0] + dx, p[1] + dy) : ctx.moveTo(p[0] + dx, p[1] + dy)); ctx.closePath(); ctx.fill(); }
function sticker(ctx, P, col, seed) { fillP(ctx, P, SHADOW, seed, 9, 11); fillP(ctx, P, col, seed); }
// 弹出：挤压拉伸（体积守恒），返回 null 表示还没出现
function popS(t, t0, d = 0.42) { const k = (t - t0) / d; if (k <= 0) return null; const sy = backOut(k); return [1 + (1 - sy) * 0.6, sy]; }
function withScale(ctx, s, ax, ay, fn) { ctx.save(); ctx.translate(ax, ay); ctx.scale(s[0], s[1]); ctx.translate(-ax, -ay); fn(); ctx.restore(); }
const circ = (x, y, r, n = 28) => Array.from({ length: n }, (_, i) => [x + Math.cos(i / n * Math.PI * 2) * r, y + Math.sin(i / n * Math.PI * 2) * r]);

// ---------- 场景几何 ----------
const GY = 1290, CX = 570, CY = 834;
const MTN_RAW = [[-30, 1290], [140, 1190], [290, 1050], [420, 905], [505, 832], [540, 846], [600, 846], [640, 830], [730, 905], [850, 1045], [970, 1180], [1110, 1290]];
const MTN = prep(MTN_RAW, false, 2);
function mtnY(x) { for (let i = 0; i < MTN.length - 1; i++) { const a = MTN[i], b = MTN[i + 1]; if (x >= a[0] && x <= b[0]) return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0] || 1)); } return GY; }
const MTN_FILL = prep(MTN_RAW.concat([[1110, 1300], [-30, 1300]]), true, 2);
const MTN_SHADE = prep([[640, 830], [730, 905], [850, 1045], [970, 1180], [1110, 1290], [1110, 1300], [700, 1300], [660, 1100], [610, 900]], true, 2);
const GROUND = prep([[-20, GY], [1100, GY]], false, 0);
const SHORE_RAW = []; for (let x = -20; x <= 1100; x += 60) SHORE_RAW.push([x, 1452 + 10 * Math.sin(x / 70)]);
const SHORE = prep(SHORE_RAW, false, 2);
const SEA = prep(SHORE_RAW.concat([[1160, 1452], [1160, 1990], [-80, 1990], [-80, 1452]]), true, 0);
const PLAIN = prep([[-80, GY], [1160, GY], [1160, 1480], [-80, 1480]], true, 0);
const R0 = rng(3);
const HOUSES = [];
[[70, 1405, 95, 70], [175, 1395, 80, 92], [262, 1412, 110, 62], [395, 1400, 84, 80], [722, 1408, 96, 66], [828, 1398, 82, 86], [938, 1410, 104, 64], [120, 1440, 90, 50], [325, 1446, 96, 46], [790, 1448, 88, 48], [990, 1446, 70, 44]].forEach(([x, y, w, h], i) => HOUSES.push({ x: x * 0.97 - 10, y, w: w * 1.3, h: h * 1.3, gable: i % 3 !== 1, t0: 1.75 + i * 0.1 + R0() * 0.05, seed: 20 + i }));
const TEMPLE = { x: 560, y: 1420, w: 240, h: 140, t0: 2.35 };
const CYPRESS = [[22, 1400, 150], [480, 1404, 130], [655, 1404, 150], [1050, 1400, 120]].map(([x, y, h], i) => ({ x, y, h, t0: 2.0 + i * 0.12, seed: 60 + i }));
const PINE = { x: 900, y: 1396, t0: 2.55 };
const SUN = { x: 850, y: 430, r: 66 };
const CLOUDS = [{ x: 230, y: 560, s: 1, t0: 1.85 }, { x: 690, y: 655, s: 0.75, t0: 2.1 }];
const TUFTS = Array.from({ length: 22 }, (_, i) => ({ x: 30 + i * 49 + R0() * 20, y: 1300 + R0() * 40, t0: 1.45 + i * 0.03 }));
const SLOPE_MARKS = Array.from({ length: 16 }, (_, i) => { const x = 120 + R0() * 860; const y = mtnY(x) + 40 + R0() * Math.max(10, (GY - mtnY(x) - 70)); return { x, y, t0: 1.7 + i * 0.03, a: (x < CX ? -0.6 : 0.6) }; });
const WAVES = Array.from({ length: 12 }, (_, i) => ({ x: 60 + (i % 6) * 180 + (i > 5 ? 90 : 0), y: 1520 + (i > 5 ? 90 : 0) + R0() * 20, t0: 1.4 + i * 0.05 }));

// 烟柱：先长"柱子"，再在顶上摊开成伞状（小普林尼形容它像一棵伞松）
const R1 = rng(9), PLUME = [];
for (let i = 0; i < 70; i++) { const f = i / 70; PLUME.push({ tb: T.boom + f * 0.9, tx: CX + (R1() - .5) * 60 * (0.4 + f), ty: lerp(CY - 30, 430, Math.pow(f, 0.8)), r: 48 + 46 * f + R1() * 18, dur: 0.7 + R1() * 0.3, s: R1() }); }
for (let i = 0; i < 60; i++) { const s = R1() < .5 ? -1 : 1, d = Math.pow(R1(), 0.7) * 430; PLUME.push({ tb: T.umbrella + (d / 430) * 1.3 + R1() * 0.15, tx: CX + s * d, ty: 330 + R1() * 90 + (d / 430) * 50, r: 70 + R1() * 50 - d * 0.04, dur: 0.9 + R1() * 0.4, s: R1(), from: [CX + s * 40, 400] }); }
// 火山碎屑流：烟柱崩塌，沿山坡滚下、吞没小城
const SURGE = [];
for (let i = 0; i < 150; i++) { const s = R1() < .5 ? -1 : 1, d = R1(); const tx = CX + s * (40 + d * 640) + (R1() - .5) * 120, ty = lerp(900, 1720, Math.pow(R1(), 0.8) * 0.4 + d * 0.6); const dist = Math.hypot(tx - CX, ty - CY);
  SURGE.push({ tb: T.surge + dist / 1100 * 1.2 + R1() * 0.08, tx, ty, from: [CX + s * 60 + (R1() - .5) * 60, CY + 60 + R1() * 80], r: 90 + R1() * 80, dur: 0.55 + R1() * 0.2, s: R1() }); }
SURGE.sort((a, b) => a.tb - b.tb);
// 岩浆弹：红色小球，抛物线、落地压扁（呼应参考片的红球）
const BOMBS = []; for (let i = 0; i < 6; i++) { const t0 = T.boom + 0.04 + i * 0.07, vx = (i % 2 ? 1 : -1) * (220 + R1() * 300), vy = -(900 + R1() * 500); let x = CX, y = CY - 10, tt = 0; const path = [];
  while (tt < 3) { tt += 1 / 120; x += vx / 120; const vyy = vy + 1800 * tt; y = CY - 10 + vy * tt + 900 * tt * tt; path.push([x, y]); if (vyy > 0 && y >= mtnY(x) - 12) break; } BOMBS.push({ t0, path, land: t0 + tt, r: 15 + R1() * 6 }); }
const ASH = Array.from({ length: 320 }, () => ({ x: R1() * 1300 - 110, y0: R1() * 2000, sp: 260 + R1() * 260, st: T.ash + R1() * 1.6, len: 8 + R1() * 16, dot: R1() < 0.3 }));
const BIRDS = [0, 1, 2].map(i => ({ x: PINE.x - 60 + i * 55, y: 1222 - (i % 2) * 14, vx: -260 - i * 60, vy: -330 + i * 50, ph: i * 1.7 }));

// ---------- 抖动（地震 / 爆炸 / 碎屑流） ----------
function shake(t) { const a = 6 * sm((t - T.tremor) / 0.8) * (t < T.boom ? 1 : 0) + (t > T.boom ? 18 * Math.exp(-(t - T.boom) * 3) : 0) + (t > T.surge && t < T.wash + 0.2 ? 6 * sm((t - T.surge) / 0.6) : 0);
  return [(vn(t * 26, 1) - .5) * 2 * a, (vn(t * 29, 2) - .5) * 2 * a]; }

// ---------- 绘制 ----------
const PAPER_TEX = (() => { const c = createCanvas(W, H), x = c.getContext('2d'); x.fillStyle = PAPER; x.fillRect(0, 0, W, H); const r = rng(5); for (let i = 0; i < 420; i++) { const px = r() * W, py = r() * H, rr = 30 + r() * 160; const g = x.createRadialGradient(px, py, 0, px, py, rr); const d = r() < .5; g.addColorStop(0, d ? 'rgba(150,120,90,0.035)' : 'rgba(255,252,240,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); } for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(110,90,70,${r() * 0.05})`; x.fillRect(r() * W, r() * H, 1.5, 1.5); } return c; })();
function reveal(ctx, t0, d, fn, dir = 'left') {   // 色块用不规则的边"铺"开
  const p = eio((TIME - t0) / d); if (p <= 0) return; if (p >= 1) { fn(); return; }
  ctx.save(); ctx.beginPath();
  if (dir === 'left') { const X = -60 + 1300 * p; ctx.moveTo(-50, -50); for (let y = -50; y <= H + 50; y += 40) ctx.lineTo(X + 26 * Math.sin(y / 55 + p * 7), y); ctx.lineTo(-50, H + 50); }
  else { const Y = 1320 - 560 * p; ctx.moveTo(-50, H + 50); for (let x = -50; x <= W + 50; x += 40) ctx.lineTo(x, Y + 22 * Math.sin(x / 50 + p * 6)); ctx.lineTo(W + 50, H + 50); }
  ctx.closePath(); ctx.clip(); fn(); ctx.restore();
}
function blobs(ctx, list, t, col, colL, lw = 5.5) {
  // 一组圆：先画加粗的墨圈，再把所有圆填上 → 只剩外轮廓一圈墨线（菜花状烟云）
  const live = []; for (const b of list) { const a = t - b.tb; if (a < 0) continue; const k = eo(a / b.dur); const fx = b.from ? b.from[0] : CX, fy = b.from ? b.from[1] : CY - 10;
    const boil = 1 + 0.04 * Math.sin(K * 1.3 + b.s * 20); live.push([lerp(fx, b.tx, k), lerp(fy, b.ty, k), Math.max(4, lerp(18, b.r, k) * boil), b.s]); }
  if (!live.length) return;
  ctx.fillStyle = SHADOW; for (const [x, y, r] of live) { ctx.beginPath(); ctx.arc(x + 10, y + 12, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = INK; for (const [x, y, r] of live) { ctx.beginPath(); ctx.arc(x, y, r + lw, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = col; for (const [x, y, r] of live) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = colL; for (const [x, y, r] of live) { ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.24, r * 0.62, 0, Math.PI * 2); ctx.fill(); }
}
function drawHouse(ctx, h, t) {
  const s = popS(t, h.t0); if (!s) return;
  withScale(ctx, s, h.x + h.w / 2, h.y, () => {
    const wall = prep([[h.x, h.y], [h.x, h.y - h.h], [h.x + h.w, h.y - h.h], [h.x + h.w, h.y]], true, 0);
    const rh = h.gable ? h.h * 0.42 : h.h * 0.16;
    const roof = h.gable ? prep([[h.x - 10, h.y - h.h], [h.x + h.w / 2, h.y - h.h - rh], [h.x + h.w + 10, h.y - h.h]], true, 0) : prep([[h.x - 8, h.y - h.h], [h.x - 8, h.y - h.h - rh], [h.x + h.w + 8, h.y - h.h - rh], [h.x + h.w + 8, h.y - h.h]], true, 0);
    sticker(ctx, wall, C.wall, h.seed); sticker(ctx, roof, C.roof, h.seed + 1);
    // 屋顶落灰：越积越厚
    const ash = clamp((t - T.ash - 0.3) / 2.4);
    if (ash > 0) { ctx.save(); ctx.beginPath(); const Q = jit(roof, h.seed + 102, 1.8); Q.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.clip(); ctx.fillStyle = '#9C948C'; ctx.fillRect(h.x - 20, h.y - h.h - rh - 10, h.w + 40, (rh + 10) * ash * 0.9 + 6); ctx.restore(); }
    ink(ctx, wall, 1, { closed: true, seed: h.seed, w: 5 }); ink(ctx, roof, 1, { closed: true, seed: h.seed + 1, w: 5 });
    ctx.fillStyle = INK; const dw = Math.min(22, h.w * 0.22); ctx.fillRect(h.x + h.w * 0.5 - dw / 2, h.y - h.h * 0.46, dw, h.h * 0.46);
    if (h.w > 85) { ctx.fillRect(h.x + h.w * 0.16, h.y - h.h * 0.72, 12, 12); ctx.fillRect(h.x + h.w * 0.76, h.y - h.h * 0.72, 12, 12); }
  });
}
function drawTemple(ctx, t) {
  const s = popS(t, TEMPLE.t0, 0.5); if (!s) return; const { x, y, w, h } = TEMPLE, L = x - w / 2;
  withScale(ctx, s, x, y, () => {
    const base = prep([[L - 12, y], [L - 12, y - 16], [L + w + 12, y - 16], [L + w + 12, y]], true, 0);
    const ped = prep([[L - 14, y - h], [x, y - h - 46], [L + w + 14, y - h]], true, 0);
    const beam = prep([[L - 8, y - h + 14], [L - 8, y - h], [L + w + 8, y - h], [L + w + 8, y - h + 14]], true, 0);
    sticker(ctx, base, C.wall, 80); for (let i = 0; i < 6; i++) { const cx = L + 14 + i * (w - 28) / 5; const col = prep([[cx - 8, y - 16], [cx - 8, y - h + 14], [cx + 8, y - h + 14], [cx + 8, y - 16]], true, 0); sticker(ctx, col, C.wall, 81 + i); ink(ctx, col, 1, { closed: true, seed: 81 + i, w: 4 }); }
    sticker(ctx, beam, C.wall, 88); sticker(ctx, ped, '#E8C9A0', 89);
    ink(ctx, base, 1, { closed: true, seed: 80, w: 4.5 }); ink(ctx, beam, 1, { closed: true, seed: 88, w: 4.5 }); ink(ctx, ped, 1, { closed: true, seed: 89, w: 4.5 });
  });
}
function drawCypress(ctx, c, t) {
  const s = popS(t, c.t0, 0.5); if (!s) return;
  withScale(ctx, s, c.x, c.y, () => { const P = prep([[c.x, c.y - c.h], [c.x + 22, c.y - c.h * 0.55], [c.x + 18, c.y - 14], [c.x - 18, c.y - 14], [c.x - 22, c.y - c.h * 0.55]], true, 3);
    ink(ctx, prep([[c.x, c.y], [c.x, c.y - 18]], false, 0), 1, { seed: c.seed + 5, w: 5 }); sticker(ctx, P, C.cyp, c.seed); ink(ctx, P, 1, { closed: true, seed: c.seed, w: 5 }); });
}
function drawPine(ctx, t) {
  const s = popS(t, PINE.t0, 0.55); if (!s) return; const { x, y } = PINE;
  withScale(ctx, s, x, y, () => { ink(ctx, prep([[x, y], [x - 6, y - 80], [x + 8, y - 150]], false, 2), 1, { seed: 70, w: 7 });
    const can = prep([[x - 110, y - 150], [x - 70, y - 196], [x, y - 210], [x + 80, y - 196], [x + 115, y - 152], [x + 40, y - 140], [x - 40, y - 140]], true, 3);
    sticker(ctx, can, C.pine, 71); ink(ctx, can, 1, { closed: true, seed: 71, w: 5 }); });
}
function drawSun(ctx, t) {
  const p = (t - 1.2) / 0.45; if (p <= 0) return; const dim = clamp((t - 4.7) / 1.4);
  const P = prep(circ(SUN.x, SUN.y, SUN.r, 24), true, 1);
  const s = popS(t, 1.55, 0.4); if (s) withScale(ctx, s, SUN.x, SUN.y, () => sticker(ctx, P, dim > 0 ? lerpCol(C.sun, '#9C948C', dim) : C.sun, 40));
  ink(ctx, P, p, { closed: true, seed: 40 });
  for (let i = 0; i < 11; i++) { const k = (t - 1.7 - i * 0.04) / 0.25; if (k <= 0) continue; const a = i / 11 * Math.PI * 2 + t * 0.15, r0 = SUN.r + 22, r1 = r0 + 34 * backOut(k) * (1 - dim * 0.7);
    ink(ctx, [[SUN.x + Math.cos(a) * r0, SUN.y + Math.sin(a) * r0], [SUN.x + Math.cos(a) * r1, SUN.y + Math.sin(a) * r1]], 1, { col: dim > 0.5 ? '#8A8078' : C.ray, w: 6, seed: 41 + i, pen: false }); }
}
function lerpCol(a, b, t) { const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16)); return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',')})`; }
function drawCloud(ctx, c, t) {
  const s = popS(t, c.t0, 0.45); if (!s) return; const x = c.x + (t - c.t0) * 8, y = c.y, k = c.s;
  const list = [[-70, 10, 42], [-20, -18, 58], [45, -5, 50], [90, 14, 34], [10, 20, 40]].map(([dx, dy, r]) => ({ tb: -9, tx: x + dx * k, ty: y + dy * k, r: r * k, dur: 1, s: 0, from: [x + dx * k, y + dy * k] }));
  withScale(ctx, s, x, y + 30 * k, () => blobs(ctx, list, t, C.cloud, '#FFFFFF', 5));
}
function drawBirds(ctx, t) {
  if (t < 2.45) return; const s = popS(t, 2.45, 0.3);
  for (const b of BIRDS) { const a = Math.max(0, t - T.birds - b.ph * 0.05); const x = b.x + b.vx * a, y = b.y + b.vy * a + 80 * a * a * -0.3; if (y < -50) continue;
    const flap = a > 0 ? Math.sin(t * 22 + b.ph) * 0.6 : 0.25, sz = 18 * (s ? s[1] : 1);
    ink(ctx, [[x - sz, y - sz * flap], [x, y + 3], [x + sz, y - sz * flap]], 1, { w: 4.5, seed: 90 + b.ph, pen: false }); }
}
function drawBombs(ctx, t) {
  for (const b of BOMBS) { if (t < b.t0) continue; const i = Math.min(b.path.length - 1, Math.floor((t - b.t0) * 120)); const [x, y] = b.path[i]; const landed = t >= b.land;
    // 拖尾小点
    if (!landed) for (let k = 1; k < 6; k++) { const j = Math.max(0, i - k * 5); ctx.fillStyle = `rgba(228,87,61,${0.5 - k * 0.08})`; ctx.beginPath(); ctx.arc(b.path[j][0], b.path[j][1], b.r * (0.5 - k * 0.06), 0, Math.PI * 2); ctx.fill(); }
    let sx = 1, sy = 1; if (landed) { const k = (t - b.land) / 0.3; if (k < 1) { sy = 1 - 0.45 * Math.sin(Math.PI * clamp(k)) ; sx = 1 / Math.sqrt(sy); } } else { const v = i > 0 ? Math.hypot(b.path[i][0] - b.path[i - 1][0], b.path[i][1] - b.path[i - 1][1]) : 0; sy = 1 + Math.min(0.35, v * 0.02); sx = 1 / sy; }
    const cool = landed ? clamp((t - b.land) / 2.5) : 0;
    ctx.save(); ctx.translate(x, y + (landed ? b.r * (1 - sy) : 0)); ctx.scale(sx, sy);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, b.r + 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = lerpCol(C.lava, '#6A4A42', cool); ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,240,220,${0.8 - cool * 0.6})`; ctx.beginPath(); ctx.arc(-b.r * 0.35, -b.r * 0.35, b.r * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (landed && t - b.land < 0.35) { const k = (t - b.land) / 0.35; for (let j = 0; j < 5; j++) { const a = -Math.PI * (0.15 + j * 0.175), r0 = b.r + 8 + 14 * k, r1 = r0 + 16 * (1 - k); ink(ctx, [[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * r1, y + Math.sin(a) * r1]], 1, { w: 4, pen: false, seed: j }); } }
  }
}
function drawAsh(ctx, t) {
  if (t < T.ash) return; ctx.strokeStyle = C.ash; ctx.fillStyle = C.ash; ctx.lineCap = 'round';
  for (const a of ASH) { if (t < a.st) continue; const y = (a.y0 + (t - a.st) * a.sp) % 2000 - 60, x = a.x + (y + 60) * 0.18; const al = clamp((t - a.st) / 0.4) * 0.75;
    ctx.globalAlpha = al; if (a.dot) { ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill(); } else { ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + a.len * 0.18, y + a.len); ctx.stroke(); } }
  ctx.globalAlpha = 1;
}
function writeText(ctx, txt, x, y, font, t0, per, col) {
  // 逐字"写出"：每个字用一支笔从上往下扫出来，笔尖是一个墨点
  ctx.font = font; const ws = [...txt].map(c => ctx.measureText(c).width), tot = ws.reduce((a, b) => a + b, 0); let cx = x - tot / 2; const fs = parseInt(font);
  [...txt].forEach((ch, i) => { const k = (TIME - t0 - i * per) / per; if (k > 0) { ctx.save(); ctx.beginPath(); const yy = y - fs * 0.92 + fs * 1.15 * eio(k); ctx.rect(cx - 10, y - fs - 10, ws[i] + 20, yy - (y - fs - 10)); ctx.clip(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeText(ch, cx, y); ctx.fillText(ch, cx, y); ctx.restore();
      if (k < 1) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx + ws[i] * (0.3 + 0.4 * vn(k * 6, i)), yy, 7, 0, Math.PI * 2); ctx.fill(); } } cx += ws[i]; });
}

function frame(ctx, t) {
  TIME = t; K = Math.floor(t * 12);
  ctx.drawImage(PAPER_TEX, 0, 0);
  const [sx, sy] = shake(t); ctx.save(); ctx.translate(sx, sy);
  // 天空里的东西
  drawSun(ctx, t); for (const c of CLOUDS) drawCloud(ctx, c, t);
  // 山：先勾线，再从下往上铺色；爆发前一刻先压扁再弹起（预备动作）
  let ms = [1, 1]; if (t > T.squash) { const k1 = (t - T.squash) / (T.boom - T.squash); ms = k1 < 1 ? [1 + 0.03 * sm(k1), 1 - 0.045 * sm(k1)] : (() => { const k2 = (t - T.boom) / 0.5; const o = Math.exp(-k2 * 3) * Math.cos(k2 * 9); return [1 - 0.02 * o, 1 + 0.045 * o]; })(); }
  // 烟柱在山后面
  blobs(ctx, PLUME, t, C.plume, C.plumeL);
  withScale(ctx, ms, CX, GY, () => {
    reveal(ctx, 1.0, 0.9, () => { fillP(ctx, MTN_FILL, C.mtn, 1); fillP(ctx, MTN_SHADE, C.mtnD, 2); }, 'up');
    for (const m of SLOPE_MARKS) { const k = (t - m.t0) / 0.2; if (k > 0) ink(ctx, [[m.x, m.y], [m.x + 16 * m.a, m.y + 10]], clamp(k), { w: 3.5, pen: false, seed: m.x }); }
    // 火山口：爆发时变红发光
    if (t > T.boom - 0.05) { const g = clamp((t - T.boom + 0.05) / 0.1) * (1 - 0.6 * clamp((t - T.boom - 1.5) / 2)); ctx.fillStyle = `rgba(228,87,61,${g})`; ctx.beginPath(); ctx.ellipse(CX, CY + 6, 58, 14, 0, 0, Math.PI * 2); ctx.fill(); }
    ink(ctx, MTN, (t - 0.35) / 1.2, { seed: 3, w: 6 });
  });
  // 爆发瞬间的冲击短线（参考片里落地的"啪"）
  if (t > T.boom && t < T.boom + 0.45) { const k = (t - T.boom) / 0.45; for (let j = 0; j < 9; j++) { const a = -Math.PI * (0.08 + j * 0.105), r0 = 70 + 120 * eo(k), r1 = r0 + 60 * (1 - k); ink(ctx, [[CX + Math.cos(a) * r0, CY + Math.sin(a) * r0], [CX + Math.cos(a) * r1, CY + Math.sin(a) * r1]], 1, { w: 7, pen: false, seed: j + 30 }); } }
  // 火山口冒的小烟（地震前的征兆）
  if (t > 2.6 && t < T.boom + 0.3) for (let j = 0; j < 4; j++) { const a = ((t - 2.6) * 0.5 + j / 4) % 1, r = 10 + a * 26; const x = CX + 10 + a * 60 + Math.sin(a * 6 + j) * 8, y = CY - 20 - a * 150; ctx.globalAlpha = (1 - a) * clamp((t - 2.6) / 0.5) * (t > T.boom ? 0 : 1); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = C.plumeL; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  // 地面、海
  reveal(ctx, 0.5, 0.8, () => fillP(ctx, PLAIN, C.plain, 4), 'left');
  ink(ctx, GROUND, (t - 0.1) / 0.6, { seed: 5, w: 6 });
  reveal(ctx, 0.9, 0.7, () => fillP(ctx, SEA, C.sea, 6), 'left');
  ink(ctx, SHORE, (t - 0.8) / 0.6, { seed: 7, w: 5.5 });
  for (const w of WAVES) { const k = (t - w.t0) / 0.25; if (k <= 0) continue; const bob = Math.sin(t * 2 + w.x) * 4; ink(ctx, prep([[w.x - 26, w.y + bob], [w.x - 13, w.y - 8 + bob], [w.x, w.y + bob], [w.x + 13, w.y - 8 + bob], [w.x + 26, w.y + bob]], false, 2), clamp(k), { w: 4.5, col: '#5B7F99', pen: false, seed: w.x }); }
  for (const g of TUFTS) { const s = popS(t, g.t0, 0.3); if (!s) continue; withScale(ctx, s, g.x, g.y, () => ink(ctx, [[g.x - 9, g.y - 14], [g.x - 2, g.y], [g.x + 3, g.y - 18], [g.x + 6, g.y], [g.x + 13, g.y - 12]], 1, { w: 3.5, pen: false, seed: g.x })); }
  // 小城：一个个"蹦"出来；地震时左右晃
  const wob = t > T.tremor && t < T.surge + 0.6 ? 0.02 * sm((t - T.tremor) / 0.8) : 0;
  const items = [...CYPRESS.map(c => ['c', c, c.y]), ...HOUSES.map(h => ['h', h, h.y]), ['t', TEMPLE, TEMPLE.y], ['p', PINE, PINE.y]].sort((a, b) => a[2] - b[2]);
  for (const [k, o, y] of items) { const ax = k === 'h' ? o.x + o.w / 2 : o.x; ctx.save(); ctx.translate(ax, y); ctx.rotate(Math.sin(t * 31 + ax) * wob); ctx.translate(-ax, -y);
    if (k === 'c') drawCypress(ctx, o, t); else if (k === 'h') drawHouse(ctx, o, t); else if (k === 't') drawTemple(ctx, t); else drawPine(ctx, t); ctx.restore(); }
  drawBirds(ctx, t);
  drawBombs(ctx, t);
  // 碎屑流盖过一切
  blobs(ctx, SURGE, t, C.surge, C.surgeL, 6);
  ctx.restore();
  // 天色变暗（纸被灰"染"了）
  const dark = 0.5 * sm((t - 4.6) / 1.9);
  if (dark > 0) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(150,132,120,${dark})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  drawAsh(ctx, t);
  // 一切归于灰白：新的一页
  const wash = sm((t - T.wash) / 0.5);
  if (wash > 0) { ctx.globalAlpha = wash * 0.86; ctx.fillStyle = '#D2CABF'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = wash * 0.5; ctx.drawImage(PAPER_TEX, 0, 0); ctx.globalAlpha = 1; }
  if (t > T.title) {
    writeText(ctx, '庞贝', W / 2, 860, '220px Kai', T.title, 0.36, INK);
    const ul = (t - T.title - 0.75) / 0.4; if (ul > 0) ink(ctx, prep([[300, 920], [540, 912], [780, 922]], false, 2), ul, { w: 6, seed: 120 });
    const a = sm((t - T.title - 0.95) / 0.35); if (a > 0) { ctx.globalAlpha = a; ctx.font = '50px YaHeiB'; ctx.fillStyle = INK; const s = '公元 79 年 · 维苏威火山', w = ctx.measureText(s).width; ctx.fillText(s, W / 2 - w / 2, 1000);
      ctx.globalAlpha = 1; }
  }
  // 纸纹始终在最上面一点点
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.1; ctx.drawImage(PAPER_TEX, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const fade = Math.max(1 - t / 0.25, sm((t - 9.7) / 0.3)); if (fade > 0) { ctx.fillStyle = `rgba(239,230,214,${fade})`; ctx.fillRect(0, 0, W, H); }
}

function events() {
  const pops = [...HOUSES.map(h => h.t0), TEMPLE.t0, PINE.t0, ...CYPRESS.map(c => c.t0), ...CLOUDS.map(c => c.t0), 1.55, 2.45].sort((a, b) => a - b);
  const pencil = [[0.1, 0.7], [0.35, 1.55], [0.8, 1.4], [1.2, 1.65], [1.7, 2.05], [T.title, T.title + 0.72], [T.title + 0.75, T.title + 1.15]];
  fs.writeFileSync(path.join(__dirname, 'events.json'), JSON.stringify({ ...T, pops, pencil, launches: BOMBS.map(b => b.t0), lands: BOMBS.map(b => +b.land.toFixed(3)), chars: [T.title, T.title + 0.36] }, null, 1));
}
const [mode, a1, a2] = process.argv.slice(2);
if (mode === 'events') events();
else if (mode === 'stills') {
  const times = a1.split(',').map(Number), cols = Math.min(4, times.length), tw = 360, th = 640, sheet = createCanvas(tw * cols, th * Math.ceil(times.length / cols)), sx = sheet.getContext('2d'), cv = createCanvas(W, H), ctx = cv.getContext('2d');
  times.forEach((t, i) => { ctx.setTransform(1, 0, 0, 1, 0, 0); frame(ctx, t); sx.drawImage(cv, (i % cols) * tw, Math.floor(i / cols) * th, tw, th); sx.fillStyle = '#c00'; sx.font = '22px sans-serif'; sx.fillText(t.toFixed(2), (i % cols) * tw + 8, Math.floor(i / cols) * th + 26); });
  fs.writeFileSync(a2, sheet.toBuffer('image/png'));
} else if (mode === 'still') { const cv = createCanvas(W, H); frame(cv.getContext('2d'), +a1); fs.writeFileSync(a2, cv.toBuffer('image/png')); }
else if (mode === 'video') {
  const cv = createCanvas(W, H), ctx = cv.getContext('2d');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', a1], { stdio: ['pipe', 'inherit', 'inherit'] });
  let n = 0; const N = DUR * FPS;
  const write = () => { while (n < N) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; frame(ctx, n / FPS); const ok = ff.stdin.write(Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer)); n++; if (!ok) { ff.stdin.once('drain', write); return; } } ff.stdin.end(); };
  ff.on('close', c => console.log('done', c)); write();
}
