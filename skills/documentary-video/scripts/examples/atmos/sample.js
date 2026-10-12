// 大气景观示例：同一机位的夜景 / 黄昏两版（色彩剧本：冷→暖）
// 运行：node sample.js <输出目录>   （需要 @napi-rs/canvas；可用 NODE_PATH 指到项目的 node_modules）
'use strict';
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs'), path = require('path');
const W = 1080, H = 1920, S = { K: 0, Z: 1 };
const B = require('../fine-hand/brush')({ S, createCanvas });
const A = require('./atmos')({ S, createCanvas, W, H });

function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
// 主体层的山坡：左下到右上的斜坡（对角线构图），不是横贯底部的暗带
const slopeY = x => 1720 - x * 0.52 - 40 * Math.sin(x / 180) - 18 * Math.sin(x / 61);

function hill(ctx, pal, t, lit, lift) {
  const top = []; for (let x = -20; x <= W + 20; x += 10) top.push([x, slopeY(x)]);
  const pts = [...top, [W + 20, H + 20], [-20, H + 20]];
  const col = A.mix(pal.near, pal.far, lift);   // 斜坡比远山暗，形成剪影对比，但不是死黑
  B.wash(ctx, pts, col, { seed: 41, edge: pal.near, edgeA: 0.25, blot: 0, gran: 0.25 });
  B.hatchForm(ctx, pts, { ang: -0.55, sp: 14, w: 1.3, col: pal.near, depth: 60, alpha: 0.45, seed: 42 });
  // 地面笔触：顺坡向的短草线，越近越大
  const r = rng(43); ctx.strokeStyle = A.rgba(pal.near, 0.55); ctx.lineCap = 'round';
  for (let i = 0; i < 260; i++) { const x = r() * W, y0 = slopeY(x) + 30 + r() * (H - slopeY(x)); const L = 6 + (y0 - slopeY(x)) * 0.03; ctx.lineWidth = 1 + L * 0.08; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + L * 0.5, y0 - L); ctx.stroke(); }
  // 小路：一条踩出来的浅色曲线
  const pathPts = []; for (let x = 120; x <= 900; x += 20) pathPts.push([x, slopeY(x) + 70 - (x - 120) * 0.06 + 10 * Math.sin(x / 90)]);
  B.brush(ctx, pathPts, { w: 7, col: A.mix(col, pal.haze, 0.35), alpha: 0.55, seed: 44, smooth: true });
  A.grassEdge(ctx, top, { h: 30, col: A.mix(pal.near, col, 0.4), rim: pal.rim, rimA: lit, t, seed: 45 });
  return pts;
}

function cabin(ctx, pal, warm) {
  const x = 820, y = slopeY(860) + 8, w = 150, h = 96;
  const wall = [[x, y], [x, y - h], [x + w, y - h], [x + w, y]], roof = [[x - 18, y - h + 4], [x + w * 0.5, y - h - 70], [x + w + 18, y - h + 4]];
  B.wash(ctx, wall, A.mix(pal.near, '#5a4636', 0.45), { seed: 51, gran: 0.3 });
  for (let k = 1; k < 6; k++) B.brush(ctx, [[x + 4, y - h + k * 16], [x + w - 4, y - h + k * 16 + 1]], { w: 1.2, col: '#1B1511', alpha: 0.5, seed: 52 + k });   // 木板缝
  B.hatchForm(ctx, wall, { depth: 26, sp: 8, alpha: 0.55, seed: 53 });
  B.wash(ctx, roof, A.mix(pal.near, '#3b2a24', 0.4), { seed: 54, gran: 0.3 });
  B.brush(ctx, wall, { w: 3.5, closed: true, seed: 55 }); B.brush(ctx, roof, { w: 4, closed: true, seed: 56 });
  B.brush(ctx, [[x + w * 0.5, y - h - 70], [x + w + 18, y - h + 4]], { w: 1.6, col: pal.rim, alpha: 0.7, seed: 57 });   // 屋脊受光
  const win = [[x + 92, y - 70], [x + 124, y - 70], [x + 124, y - 36], [x + 92, y - 36]];
  ctx.fillStyle = A.mix('#ffd38a', pal.near, 1 - warm); ctx.beginPath(); win.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.fill();
  B.brush(ctx, win, { w: 2.4, closed: true, seed: 58 }); B.brush(ctx, [[x + 108, y - 70], [x + 108, y - 36]], { w: 1.6, seed: 59 });
  // 烟囱的烟：几团缓慢上升的软烟
  ctx.save(); ctx.filter = 'blur(6px)'; for (let i = 0; i < 7; i++) { ctx.fillStyle = A.rgba(pal.haze, 0.22 - i * 0.025); ctx.beginPath(); ctx.ellipse(x + 40 + i * 12 + Math.sin(i) * 8, y - h - 90 - i * 30, 12 + i * 6, 9 + i * 4, 0.3, 0, 7); ctx.fill(); } ctx.restore();
  B.wash(ctx, [[x + 30, y - h - 40], [x + 30, y - h - 92], [x + 52, y - h - 92], [x + 52, y - h - 28]], '#4a3a33', { seed: 50 }); B.brush(ctx, [[x + 30, y - h - 40], [x + 30, y - h - 92], [x + 52, y - h - 92], [x + 52, y - h - 28]], { w: 2.6, seed: 49 });
  return { wx: x + 108, wy: y - 53 };
}

function walker(ctx, pal, x) {
  // 迈步中的人：后腿蹬地、前腿迈出，斗篷被风往后吹，手提灯笼；比例偏结实
  const y = slopeY(x) + 6, k = 1.5, P = (dx, dy) => [x + dx * k, y + dy * k];
  B.brush(ctx, [P(-3, -34), P(-10, -16), P(-16, 0)], { w: 6, seed: 61, smooth: true });                    // 后腿
  B.brush(ctx, [P(5, -34), P(12, -18), P(14, -2)], { w: 6, seed: 62, smooth: true });                      // 前腿
  B.brush(ctx, [P(-20, 0), P(-12, 0)], { w: 5, seed: 69 }); B.brush(ctx, [P(12, -1), P(20, -1)], { w: 5, seed: 70 });   // 靴子
  const cloak = [P(-6, -76), P(8, -76), P(14, -60), P(16, -34), P(4, -30), P(-12, -30), P(-24, -36), P(-18, -54)];
  B.wash(ctx, cloak, '#6e4230', { seed: 63, gran: 0.25, blot: 0 }); B.hatchForm(ctx, cloak, { depth: 10, sp: 5, w: 1, alpha: 0.6, seed: 71 });
  B.brush(ctx, cloak, { w: 3, closed: true, seed: 64, smooth: true });
  B.brush(ctx, [P(-2, -70), P(-6, -50), P(-10, -32)], { w: 1.4, alpha: 0.6, seed: 72 });                  // 斗篷褶
  const head = Array.from({ length: 14 }, (_, i) => P(2 + Math.cos(i / 14 * 6.28) * 7, -84 + Math.sin(i / 14 * 6.28) * 7.5));
  B.wash(ctx, head, '#d9a982', { seed: 73, blot: 0 }); B.brush(ctx, head, { w: 2.4, closed: true, seed: 65, smooth: true });
  const hood = [P(-9, -84), P(-4, -95), P(8, -95), P(12, -86), P(8, -80), P(4, -90), P(-4, -88), P(-6, -76)];
  B.wash(ctx, hood, '#5a3426', { seed: 74, blot: 0 }); B.brush(ctx, hood, { w: 2.6, closed: true, seed: 66, smooth: true });
  B.brush(ctx, [P(9, -64), P(18, -52), P(22, -44)], { w: 4, seed: 67, smooth: true });                    // 提灯的手臂
  B.brush(ctx, [P(22, -44), P(22, -36)], { w: 1.4, seed: 75 });                                            // 提手
  B.brush(ctx, [P(14, -60), P(16, -34)], { w: 1.6, col: pal.accent, alpha: 0.8, seed: 76 });              // 灯笼一侧的暖色边光
  return { lx: x + 22 * k, ly: y - 30 * k };
}

function render(mode) {
  const cv = createCanvas(W, H), ctx = cv.getContext('2d'), pal = A.PAL[mode], night = mode === 'night', t = 0;
  const L = night ? { x: 300, y: 380 } : { x: 600, y: 820 };
  A.sky(ctx, pal, { horizon: 1050, glowX: L.x, glow: night ? 0.25 : 0.45 });
  if (night) { A.stars(ctx, { n: 170, maxY: 1000 }); A.moon(ctx, L.x, L.y, 56, pal, { halo: 0.55 }); }
  else A.sun(ctx, L.x, L.y, 46, pal, { rays: 0.07, nRays: 14 });
  A.clouds(ctx, pal, { y: night ? 560 : 520, n: 3, seed: 12, light: L, a: 0.85, scale: 0.6, spread: W * 1.2 }); A.clouds(ctx, pal, { y: 200, n: 2, seed: 19, light: L, a: 0.7, scale: 0.42 });
  A.ridges(ctx, pal, { n: 6, top: 980, bottom: 1330, seed: 7, amp: [110, 190], maxDark: 0.62, light: { x: L.x, a: night ? 0.35 : 0.85 }, trees: [3, 4], haze: night ? 0.45 : 0.6, wash: B.wash });
  A.mistBand(ctx, 1240, 120, pal.haze, night ? 0.12 : 0.2, { t });
  const hillPts = hill(ctx, pal, t, night ? 0.35 : 0.8, night ? 0.12 : 0.1);
  const c = cabin(ctx, pal, 1);
  const w = walker(ctx, pal, 430);
  // 唯一的暖点：灯笼 + 照在山坡和人身上的溢光；窗光同理
  ctx.fillStyle = '#ffe2a6'; ctx.fillRect(w.lx - 6, w.ly - 4, 12, 16); B.brush(ctx, [[w.lx - 7, w.ly - 5], [w.lx + 7, w.ly - 5], [w.lx + 7, w.ly + 13], [w.lx - 7, w.ly + 13]], { w: 2, closed: true, seed: 68 });
  A.spill(ctx, hillPts, w.lx, w.ly, 260, pal.accent, night ? 0.45 : 0.18);
  A.glow(ctx, w.lx, w.ly + 4, 26, pal.accent, night ? 0.9 : 0.45);
  A.glow(ctx, c.wx, c.wy, 30, pal.accent, night ? 0.7 : 0.3);
  // 调色：对比度曲线 → 颗粒 → 暗角
  A.contrast(ctx, night ? { pivot: 0.2, k: 1.25 } : { pivot: 0.3, k: 1.12 });
  const gr = createCanvas(W, H), g = gr.getContext('2d'), img = g.createImageData(W, H), r = rng(9);
  for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (r() - 0.5) * 34; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.35; ctx.drawImage(gr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const v = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.48, H * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  return cv;
}

const out = process.argv[2] || '.'; fs.mkdirSync(out, { recursive: true });
for (const m of ['night', 'dusk']) fs.writeFileSync(path.join(out, `atmos_${m}.png`), render(m).toBuffer('image/png'));
console.log('ok', out);
