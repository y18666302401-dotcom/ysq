// glow.js：柔光动画画风的绘制函数（照参考片的画法）
// 前景主体：干净、等粗、偏粗的暗色描边（不抖、不排线）；平滑渐变上色 + 轻微的斑驳 / 拉丝纹理；朝光一侧一条亮的内边光；
//          简单的药丸形眼睛。背景：完全不描边，靠明度分层（配合 atmos.js 的 ridges / sky / sun / glow）。
// 用法：const G = require('./glow')({ createCanvas });
'use strict';
module.exports = function makeGlow({ createCanvas, INK = '#1a1420' }) {
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };
const mix = (a, b, t) => { const p = hex(a), q = hex(b); return '#' + p.map((v, i) => Math.round(lerp(v, q[i], t)).toString(16).padStart(2, '0')).join(''); };
const bbox = pts => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 }; };

// ---------- 路径 ----------
// smooth：用中点二次曲线把折线变圆润（有机物体）；直角物体传 smooth:false
function trace(ctx, pts, closed = true, smooth = true) {
  ctx.beginPath();
  if (!smooth || pts.length < 3) { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); if (closed) ctx.closePath(); return; }
  const n = pts.length, m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (closed) { const s = m(pts[n - 1], pts[0]); ctx.moveTo(s[0], s[1]); for (let i = 0; i < n; i++) { const q = m(pts[i], pts[(i + 1) % n]); ctx.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); } ctx.closePath(); }
  else { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n - 1; i++) { const q = m(pts[i], pts[i + 1]); ctx.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); } ctx.lineTo(pts[n - 1][0], pts[n - 1][1]); }
}
function outline(ctx, pts, { w = 5, col = INK, closed = true, smooth = true, alpha = 1 } = {}) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = w; ctx.strokeStyle = col; trace(ctx, pts, closed, smooth); ctx.stroke(); ctx.restore();
}
// 圆角矩形的点
function roundRect(x, y, w, h, r, n = 4) {
  const pts = [], c = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
  for (const [cx, cy, a0] of c) for (let k = 0; k <= n; k++) { const a = a0 + k / n * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return pts;
}
const circle = (x, y, r, n = 24, wob = 0, seed = 1) => { const R = rng(seed); return Array.from({ length: n }, (_, i) => { const a = i / n * 6.283, rr = r * (1 + (R() - 0.5) * wob); return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]; }); };

// ---------- 上色 ----------
// 沿光线方向的线性渐变：lit 是受光一侧的颜色，dark 是背光一侧（light = [lx, ly] 指向光源的单位向量）
function fillLit(ctx, pts, lit, dark, { light = [-0.6, -0.8], smooth = true, mid = 0.45 } = {}) {
  const b = bbox(pts), R = Math.max(b.w, b.h) / 2;
  const g = ctx.createLinearGradient(b.cx + light[0] * R, b.cy + light[1] * R, b.cx - light[0] * R, b.cy - light[1] * R);
  g.addColorStop(0, lit); g.addColorStop(mid, mix(lit, dark, 0.45)); g.addColorStop(1, dark);
  ctx.fillStyle = g; trace(ctx, pts, true, smooth); ctx.fill();
}
// 纹理：斑驳的软斑 + 细的拉丝（横向短线）+ 细颗粒，都裁在形状里，位置固定不随帧跳
function texture(ctx, pts, { seed = 1, spots = 10, streaks = 40, speck = 0.05, alpha = 1, smooth = true, dark = '#000000', lightCol = '#ffffff' } = {}) {
  const b = bbox(pts), r = rng(seed);
  ctx.save(); trace(ctx, pts, true, smooth); ctx.clip();
  for (let i = 0; i < spots; i++) { const x = lerp(b.x0, b.x1, r()), y = lerp(b.y0, b.y1, r()), rr = Math.max(b.w, b.h) * (0.08 + r() * 0.2), g = ctx.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, rgba(r() < 0.6 ? dark : lightCol, 0.07 * alpha)); g.addColorStop(1, rgba(dark, 0)); ctx.fillStyle = g; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  ctx.lineCap = 'round';
  for (let i = 0; i < streaks; i++) { const x = lerp(b.x0, b.x1, r()), y = lerp(b.y0, b.y1, r()), L = b.w * (0.05 + r() * 0.18); ctx.strokeStyle = rgba(r() < 0.5 ? dark : lightCol, (0.05 + r() * 0.06) * alpha); ctx.lineWidth = 0.8 + r() * 1.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + L, y + (r() - 0.5) * 2); ctx.stroke(); }
  const n = Math.round(b.w * b.h * speck * 0.01); ctx.fillStyle = rgba(dark, 0.12 * alpha);
  for (let i = 0; i < n; i++) ctx.fillRect(lerp(b.x0, b.x1, r()), lerp(b.y0, b.y1, r()), 1.5, 1.5);
  ctx.restore();
}
// 朝光一侧的内边光：形状和"往背光方向挪 w 的自己"之间的那条月牙形带子
function innerRim(ctx, pts, col, { w = 8, a = 0.8, light = [-0.6, -0.8], smooth = true } = {}) {
  ctx.save(); trace(ctx, pts, true, smooth); ctx.clip();
  const sx = -light[0] * w, sy = -light[1] * w, b = bbox(pts);
  ctx.beginPath(); ctx.rect(b.x0 - 50, b.y0 - 50, b.w + 100, b.h + 100);
  const shifted = pts.map(p => [p[0] + sx, p[1] + sy]);
  // 用 evenodd 抠掉挪过的形状（平滑路径用折线近似即可，带子本来就窄）
  ctx.moveTo(shifted[0][0], shifted[0][1]); for (const p of shifted) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.clip('evenodd');
  ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(b.x0 - 50, b.y0 - 50, b.w + 100, b.h + 100); ctx.restore();
}
// 立体盒子的顶面斜边（参考片里方块角色顶上那一条更亮的面）
function bevelTop(ctx, pts, col, { h = 10, a = 0.9, smooth = true } = {}) {
  const b = bbox(pts); ctx.save(); trace(ctx, pts, true, smooth); ctx.clip(); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(b.x0 - 5, b.y0 - 5, b.w + 10, h + 5);
  ctx.globalAlpha = 1; ctx.strokeStyle = rgba(INK, 0.5); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x0, b.y0 + h); ctx.lineTo(b.x1, b.y0 + h); ctx.stroke(); ctx.restore();
}

// ---------- 一个"有材质的主体"：渐变 + 纹理 + 内边光 + 描边，一次画完 ----------
function body(ctx, pts, { lit, dark, rim = null, rimA = 0.7, rimW = 8, light, w = 5, seed = 1, tex = 1, smooth = true, bevel = null } = {}) {
  fillLit(ctx, pts, lit, dark, { light, smooth });
  if (tex) texture(ctx, pts, { seed, alpha: tex, smooth });
  if (bevel) bevelTop(ctx, pts, bevel, { smooth });
  if (rim) innerRim(ctx, pts, rim, { w: rimW, a: rimA, light, smooth });
  outline(ctx, pts, { w, smooth });
}

// ---------- 眼睛：药丸形黑眼 + 高光；mood: open / happy(^ ^) / strain(> <) / closed(— —) ----------
function eyes(ctx, x, y, s = 1, mood = 'open', { gap = 22, look = [0, 0] } = {}) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 3.2 * s;
  for (const side of [-1, 1]) {
    const ex = x + side * gap * s / 2 + look[0] * s, ey = y + look[1] * s;
    if (mood === 'open') { ctx.beginPath(); ctx.ellipse(ex, ey, 3.6 * s, 6 * s, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 1 * s, ey - 2.2 * s, 1.3 * s, 0, 7); ctx.fill(); ctx.fillStyle = INK; }
    else if (mood === 'happy') { ctx.beginPath(); ctx.moveTo(ex - 5 * s, ey + 2 * s); ctx.quadraticCurveTo(ex, ey - 6 * s, ex + 5 * s, ey + 2 * s); ctx.stroke(); }
    else if (mood === 'strain') { ctx.beginPath(); ctx.moveTo(ex - side * 4 * s, ey - 4 * s); ctx.lineTo(ex + side * 3 * s, ey); ctx.lineTo(ex - side * 4 * s, ey + 4 * s); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(ex - 4 * s, ey); ctx.lineTo(ex + 4 * s, ey); ctx.stroke(); }
  }
  ctx.restore();
}

// ---------- 岩石 / 巨石：不规则轮廓（带几处平的切面和缺口）、明暗交界、坑、细裂纹、月光内边光 ----------
function rockShape(cx, cy, R, seed = 1) {
  const r = rng(seed), n = 36, pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * 6.283; let rr = R * (1 + (r() - 0.5) * 0.05); if (i % 9 === 4) rr *= 0.95; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  const k = Math.floor(r() * n); pts.splice(k, 2, [lerp(pts[k][0], cx, 0.06), lerp(pts[k][1], cy, 0.06)]);   // 一个小缺口
  return pts;
}
function rock(ctx, cx, cy, R, { seed = 1, lit = '#6b5047', dark = '#1d1f33', rim = '#9aa3c8', light = [-0.7, -0.7], w = 5, craters = 9, cracks = 5 } = {}) {
  const pts = rockShape(cx, cy, R, seed), r = rng(seed + 9);
  fillLit(ctx, pts, lit, dark, { light, smooth: false, mid: 0.4 });
  texture(ctx, pts, { seed, spots: 16, streaks: 20, alpha: 1.3, smooth: false });
  ctx.save(); trace(ctx, pts, true, false); ctx.clip();
  for (let i = 0; i < craters; i++) {                          // 坑：暗的软圆 + 背光一侧下缘一道浅色
    const a = r() * 6.283, d = Math.sqrt(r()) * R * 0.8, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, cr = R * (0.03 + r() * 0.06);
    const g = ctx.createRadialGradient(x, y, 0, x, y, cr); g.addColorStop(0, 'rgba(10,8,20,0.35)'); g.addColorStop(1, 'rgba(10,8,20,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, cr, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, cr * 0.8, 0.2, 2.6); ctx.stroke();
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < cracks; i++) {                           // 细裂纹：弯弯曲曲的暗线
    let x = cx + (r() - 0.5) * R * 1.4, y = cy + (r() - 0.5) * R * 1.4, a = r() * 6.28; ctx.strokeStyle = 'rgba(10,8,20,0.45)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) { a += (r() - 0.5) * 1.2; x += Math.cos(a) * R * 0.09; y += Math.sin(a) * R * 0.09; ctx.lineTo(x, y); } ctx.stroke();
  }
  ctx.restore();
  innerRim(ctx, pts, rim, { w: R * 0.05, a: 0.55, light, smooth: false });
  outline(ctx, pts, { w, smooth: false });
  return pts;
}
// 发光裂纹网：锯齿状、把石头分成几块板（参考片的蓄光阶段），返回 motion.drawCracks 用的线段
function zigzagNet(cx, cy, R, seed = 1) {
  const r = rng(seed), nodes = [[cx + (r() - 0.5) * R * 0.2, cy + (r() - 0.5) * R * 0.2]], segs = [];
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + r() * 0.6, d = R * (0.4 + r() * 0.2); nodes.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]); }
  const zig = (p, q, born, w) => { const n = 7, dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L; let prev = p; for (let k = 1; k <= n; k++) { const t = k / n, j = k < n ? (r() - 0.5) * L * 0.18 : 0, pt = [p[0] + dx * t + nx * j, p[1] + dy * t + ny * j]; segs.push({ a: prev, b: pt, w, born: born + t * 0.25 }); prev = pt; } };
  for (let i = 1; i <= 6; i++) zig(nodes[0], nodes[i], 0, 3);                                    // 中心 → 内圈
  for (let i = 1; i <= 6; i++) zig(nodes[i], nodes[i % 6 + 1], 0.3, 2.4);                         // 内圈连成板
  for (let i = 1; i <= 6; i++) { const a = Math.atan2(nodes[i][1] - cy, nodes[i][0] - cx) + (r() - 0.5) * 0.5; zig(nodes[i], [cx + Math.cos(a) * R * 0.97, cy + Math.sin(a) * R * 0.97], 0.55, 2); }   // 外伸到边
  const maxB = Math.max(...segs.map(s => s.born)); segs.forEach(s => s.born /= maxB);
  return segs;
}

// ---------- 风格化松树剪影：下垂的分层枝、尖顶（参考片的样子），不描边 ----------
function pine(ctx, x, y, h, col, { seed = 1, tiers = 6 } = {}) {
  const r = rng(seed), w = h * 0.36; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - h);
  const L = [], R = [];
  for (let k = 0; k < tiers; k++) { const t = (k + 1) / tiers, ty = y - h + h * t * 0.92, tw = w * (0.25 + t * 0.75) * (0.85 + r() * 0.3), up = h / tiers * 0.45; R.push([x + tw * 0.35, ty - up], [x + tw, ty + h * 0.02]); L.push([x - tw, ty + h * 0.02], [x - tw * 0.35, ty - up]); }
  for (let k = 0; k < R.length; k += 2) { ctx.quadraticCurveTo(R[k][0], R[k][1] + h * 0.03, R[k + 1][0], R[k + 1][1]); ctx.lineTo(x + (R[k + 1][0] - x) * 0.3, R[k + 1][1] - h * 0.01); }
  ctx.lineTo(x + w * 0.08, y); ctx.lineTo(x - w * 0.08, y);
  for (let k = L.length - 2; k >= 0; k -= 2) { ctx.lineTo(x + (L[k][0] - x) * 0.3, L[k][1] - h * 0.01); ctx.lineTo(L[k][0], L[k][1]); ctx.quadraticCurveTo(L[k + 1][0], L[k + 1][1] + h * 0.03, x, L[k + 1][1] - h * 0.02); }
  ctx.closePath(); ctx.fill();
}
function forest(ctx, yAt, col, { x0 = 0, x1 = 1080, size = 120, dens = 1, seed = 3, gaps = 0.35 } = {}) {
  const r = rng(seed);
  for (let x = x0; x < x1; x += size * (0.18 + r() * 0.3) / dens) { if (r() < gaps) continue; const h = size * (0.55 + r() * 0.7); pine(ctx, x, yAt(x) + h * 0.05, h, col, { seed: Math.floor(x) }); }
}

// ---------- 坡顶的受光虚线（参考片山坡上沿那一串亮短线） ----------
function rimDashes(ctx, pts, col, { a = 0.6, dash = [10, 9], w = 2.2, dy = 3 } = {}) {
  ctx.save(); ctx.setLineDash(dash); ctx.lineCap = 'round'; ctx.strokeStyle = rgba(col, a); ctx.lineWidth = w;
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1] + dy) : ctx.moveTo(p[0], p[1] + dy)); ctx.stroke(); ctx.restore();
}

// ---------- 散景光点：柔的圆 + 亮一点的边（火星、灯光、灰尘离焦） ----------
function bokeh(ctx, x, y, r, col, a = 0.6) {
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col, a * 0.55)); g.addColorStop(0.8, rgba(col, a * 0.35)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore();
}

// ---------- 天空的横向光带：参考片天空里一两条很淡的水平亮带 ----------
function skyStreaks(ctx, W, y0, y1, col, { n = 4, a = 0.08, seed = 5 } = {}) {
  const r = rng(seed); ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) { const y = lerp(y0, y1, r()), h = 8 + r() * 26, g = ctx.createLinearGradient(0, y - h, 0, y + h); g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.5, rgba(col, a * (0.5 + r()))); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(0, y - h, W, h * 2); }
  ctx.restore();
}

return { INK, trace, outline, roundRect, circle, fillLit, texture, innerRim, bevelTop, body, eyes, rock, rockShape, zigzagNet, pine, forest, rimDashes, bokeh, skyStreaks, mix, rgba, bbox };
};
