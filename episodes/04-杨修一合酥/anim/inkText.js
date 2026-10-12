// 写在道具上的字（用户 2026-10-12：字要"写在物件上"，不能像一层贴纸浮在画面上）
//   1 笔触质感：楷体 + 晕边（几层抖动的淡墨）+ 飞白（顺笔势的细划痕）+ 浓淡不匀
//   2 透视贴合：把字按道具表面的四个角（四边形）网格变形贴上去，超出表面的部分裁掉
//   3 吃进材质：正片叠底（multiply），木纹、漆面的明暗透过墨色；再薄薄盖一层原色保住颜色
//   4 一笔一笔写出来：progress 0..1，按字的顺序、每个字从左上往右下扫开；返回笔尖此刻的位置（让手里的笔跟着走）
'use strict';
const { createCanvas } = require('@napi-rs/canvas');

const CACHE = new Map();
function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const hex = c => [1, 3, 5].map(i => parseInt(c.substr(i, 2), 16));

// 整串字的墨迹（不随时间变化，缓存）：竖排时一字一格
function inkSource(text, { vertical = true, px = 220, col = '#C8372D', seed = 1, font = 'WenKai' } = {}) {
  const key = [text, vertical, px, col, seed, font].join('|'); if (CACHE.has(key)) return CACHE.get(key);
  const chars = [...text], n = chars.length, cw = px * 1.1, chh = px * 1.12;
  const W = Math.ceil(vertical ? cw : cw * n), H = Math.ceil(vertical ? chh * n : chh);
  const cv = createCanvas(W, H), g = cv.getContext('2d'), r = rng(seed);
  const cells = chars.map((c, i) => ({ c, x: vertical ? 0 : i * cw, y: vertical ? i * chh : 0, w: cw, h: chh }));
  g.font = `${px}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const [R, G, B] = hex(col);
  for (const cell of cells) {
    const cx = cell.x + cell.w / 2, cy = cell.y + cell.h / 2;
    // 晕边：几层抖动的淡墨
    for (let k = 0; k < 7; k++) { g.fillStyle = `rgba(${R},${G},${B},0.14)`; g.fillText(cell.c, cx + (r() - 0.5) * px * 0.035, cy + (r() - 0.5) * px * 0.035); }
    // 主体：加粗一圈，像毛笔压下去
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = px * 0.03; g.lineJoin = 'round'; g.fillText(cell.c, cx, cy); g.strokeText(cell.c, cx, cy);
  }
  // 浓淡不匀：在墨上叠深一点 / 浅一点的大团
  g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 26 * n; i++) { const x = r() * W, y = r() * H, rr = px * (0.15 + r() * 0.4), gr = g.createRadialGradient(x, y, 0, x, y, rr), dk = r() < 0.55;
    gr.addColorStop(0, dk ? 'rgba(20,10,10,0.22)' : 'rgba(255,240,220,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  // 飞白：顺着笔势（略斜）的细划痕把墨擦掉一点
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 160 * n; i++) { const x = r() * W, y = r() * H, a = -0.35 + (r() - 0.5) * 0.5, L = px * (0.08 + r() * 0.28);
    g.strokeStyle = `rgba(0,0,0,${0.25 + r() * 0.45})`; g.lineWidth = 0.8 + r() * 2.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
  for (let i = 0; i < 500 * n; i++) { g.fillStyle = `rgba(0,0,0,${0.2 + r() * 0.5})`; g.beginPath(); g.arc(r() * W, r() * H, 0.6 + r() * 1.6, 0, 7); g.fill(); }
  const src = { cv, W, H, cells }; CACHE.set(key, src); return src;
}

// 写到 progress 为止：前面的字完整，当前的字从左上往右下扫开。返回 { cv, tip:[x,y]（源坐标） }
const TMP = new Map();
function reveal(src, progress) {
  if (progress >= 1) return { cv: src.cv, tip: null };
  const k = `${src.W}x${src.H}`; if (!TMP.has(k)) TMP.set(k, createCanvas(src.W, src.H));
  const cv = TMP.get(k), g = cv.getContext('2d'); g.clearRect(0, 0, src.W, src.H);
  const n = src.cells.length, p = Math.max(0, progress) * n, i = Math.min(n - 1, Math.floor(p)), f = p - i;
  g.save(); g.beginPath();
  for (let j = 0; j < i; j++) { const c = src.cells[j]; g.rect(c.x, c.y, c.w, c.h); }
  const c = src.cells[i], d = [0.5, 1], len = c.w * d[0] + c.h * d[1], s = f * len * 1.05;
  // 扫开的半平面：x*0.5 + y*1 <= s（相对字格左上角）
  g.moveTo(c.x, c.y); g.lineTo(c.x + Math.min(c.w, s / d[0]), c.y); g.lineTo(c.x + Math.max(0, Math.min(c.w, (s - c.h) / d[0])), c.y + Math.min(c.h, s));
  g.lineTo(c.x, c.y + Math.min(c.h, s)); g.closePath(); g.clip(); g.drawImage(src.cv, 0, 0); g.restore();
  // 笔尖：沿字格对角线（左上 → 右下）走，加一点左右摆动
  const tip = [c.x + c.w * (0.25 + 0.5 * f) + c.w * 0.12 * Math.sin(f * 19), c.y + c.h * (0.18 + 0.66 * f)];
  return { cv, tip };
}

// 把源图网格变形贴到四边形 quad = [左上, 右上, 右下, 左下]（双线性插值，每格两个三角形各用一次仿射）
function drawQuad(ctx, img, sw, sh, quad, nx = 6, ny = 6) {
  const P = (u, v) => { const [a, b, c, d] = quad; const top = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], bot = [d[0] + (c[0] - d[0]) * u, d[1] + (c[1] - d[1]) * u]; return [top[0] + (bot[0] - top[0]) * v, top[1] + (bot[1] - top[1]) * v]; };
  const tri = (s0, s1, s2, d0, d1, d2) => {
    const [x0, y0] = s0, [x1, y1] = s1, [x2, y2] = s2, det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (Math.abs(det) < 1e-6) return;
    const a = ((d1[0] - d0[0]) * (y2 - y0) - (d2[0] - d0[0]) * (y1 - y0)) / det, c = ((d2[0] - d0[0]) * (x1 - x0) - (d1[0] - d0[0]) * (x2 - x0)) / det;
    const b = ((d1[1] - d0[1]) * (y2 - y0) - (d2[1] - d0[1]) * (y1 - y0)) / det, d = ((d2[1] - d0[1]) * (x1 - x0) - (d1[1] - d0[1]) * (x2 - x0)) / det;
    const e = d0[0] - a * x0 - c * y0, f = d0[1] - b * x0 - d * y0;
    const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3, grow = q => [q[0] + (q[0] - cx) * 0.04, q[1] + (q[1] - cy) * 0.04];
    ctx.save(); ctx.beginPath(); const [g0, g1, g2] = [grow(d0), grow(d1), grow(d2)]; ctx.moveTo(...g0); ctx.lineTo(...g1); ctx.lineTo(...g2); ctx.closePath(); ctx.clip();
    ctx.transform(a, b, c, d, e, f); ctx.drawImage(img, 0, 0); ctx.restore();
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const u0 = i / nx, u1 = (i + 1) / nx, v0 = j / ny, v1 = (j + 1) / ny, S = (u, v) => [u * sw, v * sh];
    tri(S(u0, v0), S(u1, v0), S(u1, v1), P(u0, v0), P(u1, v0), P(u1, v1)); tri(S(u0, v0), S(u1, v1), S(u0, v1), P(u0, v0), P(u1, v1), P(u0, v1));
  }
  return P;
}

// 在道具表面写字。quad：字占的区域（四个角）；clip：表面的轮廓（可选）。返回笔尖在画面里的位置（写完后返回 null）
function writeOn(ctx, text, quad, { col = '#C8372D', progress = 1, vertical = true, clip = null, seed = 1, px = 220, absorb = 0.75, cover = 0.72 } = {}) {
  if (progress <= 0) return null;
  const src = inkSource(text, { vertical, px, col, seed }), { cv, tip } = reveal(src, progress);
  ctx.save(); if (clip) { ctx.beginPath(); clip.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.clip(); }
  let P = null;
  if (absorb > 0) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = absorb; P = drawQuad(ctx, cv, src.W, src.H, quad); }   // 墨吃进材质
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = cover; P = drawQuad(ctx, cv, src.W, src.H, quad);                     // 保住墨色（深色底上写浅色字时 absorb = 0、cover = 1）
  ctx.restore();
  return tip ? P(tip[0] / src.W, tip[1] / src.H) : null;
}
// 旋转矩形（中心 c、宽 w、高 h、角度 ang）→ 四边形
const rectQuad = (c, w, h, ang = 0) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [c[0] + x * Math.cos(ang) - y * Math.sin(ang), c[1] + x * Math.sin(ang) + y * Math.cos(ang)]);

module.exports = { inkSource, reveal, drawQuad, writeOn, rectQuad };
