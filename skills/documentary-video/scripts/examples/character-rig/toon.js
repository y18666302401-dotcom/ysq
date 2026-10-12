// toon.js：科幻情景喜剧卡通画法的 2D 引擎（只借画法）
// 做法改写自 lemomo-ai/lemo-opuscar 的 styles/scifi-toon/demo/toon.js（MIT License, Copyright (c) 2026 LemoLab）：
//   1) 自己维护仿射矩阵，形状先变换到屏幕坐标再描边 → 任何景别线宽恒定（特写不会把线放粗）
//   2) line boil：屏幕空间按 ~7px 重采样，沿法向做低频噪声位移；3 张 boil 画 12fps 循环，静止画面也在"呼吸"
//   3) 平涂：fill → clip 内画硬边阴影块 → 最后描边；光晕是 1–2 圈平涂半透明环，不用渐变
'use strict';
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };

const INK = '#1b1422';
let g = null, M = [1, 0, 0, 1, 0, 0];
const ST = [];
const T = { boil: 0, amp: 1.7, sid: 0, lw: 7 };
function begin(ctx, t, cam, W, H) {   // cam: 世界坐标 → 屏幕（cx, cy, z, rot）
  g = ctx; T.boil = Math.floor(t * 12 + 1e-6) % 3; T.sid = 0; ST.length = 0;
  const c = Math.cos(cam.rot || 0), s = Math.sin(cam.rot || 0), z = cam.z;
  M = [c * z, s * z, -s * z, c * z, W / 2 - (c * cam.cx - s * cam.cy) * z, H / 2 - (s * cam.cx + c * cam.cy) * z];
  g.setTransform(1, 0, 0, 1, 0, 0);
}
const push = () => ST.push(M.slice()), pop = () => { M = ST.pop(); };
function translate(x, y) { M = [M[0], M[1], M[2], M[3], M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]]; }
function rotate(a) { const c = Math.cos(a), s = Math.sin(a); M = [M[0] * c + M[2] * s, M[1] * c + M[3] * s, -M[0] * s + M[2] * c, -M[1] * s + M[3] * c, M[4], M[5]]; }
function scale(sx, sy = sx) { M = [M[0] * sx, M[1] * sx, M[2] * sy, M[3] * sy, M[4], M[5]]; }
const tx = (x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
const zoom = () => Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2]));

// ---------- 形状点 ----------
function ell(cx, cy, rx, ry, n = 0, a0 = 0) { if (!n) n = Math.max(16, Math.min(90, Math.round((rx + ry) * zoom() * 0.25))); const p = []; for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p; }
function arc(cx, cy, rx, ry, a0, a1, n = 24) { const p = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p; }
function spline(c, closed = true, k = 8) {
  const n = c.length, out = [], P = i => closed ? c[(i + n) % n] : c[clamp(i, 0, n - 1)], m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) { const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2); for (let j = 0; j < k; j++) { const t = j / k, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(d => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3))); } }
  if (!closed) out.push(c[n - 1]); return out;
}
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); const p = [], c = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]]; for (const [cx, cy, a] of c) for (let i = 0; i <= 6; i++) { const b = a + i / 6 * Math.PI / 2; p.push([cx + Math.cos(b) * r, cy + Math.sin(b) * r]); } return p; }
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
function quad(a, c, b, n = 16) { const p = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; p.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); } return p; }
// 面条肢体：a→b 二次曲线，bend 为垂直偏移，w0→w1 渐细，两端圆头
function noodle(a, b, bend, w0, w1 = w0) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, c = [(a[0] + b[0]) / 2 + nx * bend, (a[1] + b[1]) / 2 + ny * bend];
  const mid = quad(a, c, b, 14), L1 = [], R1 = [];
  for (let i = 0; i < mid.length; i++) { const p = mid[i], q = mid[Math.min(mid.length - 1, i + 1)], o = mid[Math.max(0, i - 1)]; let ux = q[0] - o[0], uy = q[1] - o[1]; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l; const w = lerp(w0, w1, i / (mid.length - 1)) / 2; L1.push([p[0] - uy * w, p[1] + ux * w]); R1.push([p[0] + uy * w, p[1] - ux * w]); }
  const endA = Math.atan2(mid[mid.length - 1][1] - mid[mid.length - 2][1], mid[mid.length - 1][0] - mid[mid.length - 2][0]), begA = Math.atan2(mid[1][1] - mid[0][1], mid[1][0] - mid[0][0]);
  return [...L1, ...arc(b[0], b[1], w1 / 2, w1 / 2, endA + Math.PI / 2, endA - Math.PI / 2, 8), ...R1.reverse(), ...arc(a[0], a[1], w0 / 2, w0 / 2, begA - Math.PI / 2, begA - Math.PI * 1.5, 8)];
}

// ---------- 变换 + 重采样 + boil ----------
function toScreen(pts, closed) {
  const s = pts.map(p => tx(p[0], p[1])), out = [s[0]], step = 7, n = closed ? s.length : s.length - 1; let acc = 0;
  for (let i = 0; i < n; i++) { const a = s[i], b = s[(i + 1) % s.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]); let pos = step - acc; while (pos < d) { const u = pos / d; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); pos += step; } acc = d - (pos - step); }
  if (!closed) out.push(s[s.length - 1]); return out;
}
function boilPts(s, closed, amp, seed) {
  if (amp <= 0 || s.length < 3) return s;
  const n = s.length, L = n * 7, out = new Array(n);
  for (let i = 0; i < n; i++) {
    const ia = closed ? s[(i - 1 + n) % n] : s[Math.max(0, i - 1)], ib = closed ? s[(i + 1) % n] : s[Math.min(n - 1, i + 1)];
    let nx = -(ib[1] - ia[1]), ny = ib[0] - ia[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const x = i * 7 / 38; let v = vnoise(x + seed) * 2 - 1;
    if (closed) v = lerp(v, vnoise(x - L / 38 + seed) * 2 - 1, i / n);
    const d = (v * 0.8 + (vnoise(x * 2.3 + seed * 1.7 + 50) * 2 - 1) * 0.35) * amp;
    out[i] = [s[i][0] + nx * d, s[i][1] + ny * d];
  }
  return out;
}
function pathOf(s, closed) { const P = new (require('@napi-rs/canvas').Path2D)(); P.moveTo(s[0][0], s[0][1]); for (let i = 1; i < s.length; i++) P.lineTo(s[i][0], s[i][1]); if (closed) P.closePath(); return P; }
// 主绘制：fill → shade（clip 内的硬边阴影）→ 描边
function shape(pts, o = {}) {
  const closed = o.closed !== false, id = T.sid++, seed = hash(id * 1.37 + 3) * 90 + T.boil * 23.7;
  const s = boilPts(toScreen(pts, closed), closed, (o.boil ?? 1) * T.amp, seed), P = pathOf(s, closed);
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (o.alpha != null) g.globalAlpha = o.alpha;
  if (o.fill && closed) { g.fillStyle = o.fill; g.fill(P); }
  if (o.shade) { g.save(); g.clip(P); o.shade(); g.restore(); g.setTransform(1, 0, 0, 1, 0, 0); }
  if (o.stroke !== false && o.line !== null) { g.lineWidth = o.lw ?? T.lw; g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = o.line ?? INK; g.stroke(P); }
  if (o.alpha != null) g.globalAlpha = 1;
  return P;
}
const fillOnly = (pts, fill, o = {}) => shape(pts, { ...o, fill, stroke: false });
const stroke = (pts, lw = T.lw, o = {}) => shape(pts, { ...o, closed: false, lw });
function dot(x, y, r, col = INK) { const [a, b] = tx(x, y); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = col; g.beginPath(); g.arc(a, b, Math.max(1.5, r * zoom()), 0, TAU); g.fill(); }
// 平涂色带（卡通天空：硬边色带，不用渐变）
function bands(cols, y0, y1, x0 = -4000, x1 = 6000) { const n = cols.length; for (let i = 0; i < n; i++) fillOnly(rect(x0, lerp(y0, y1, i / n), x1 - x0, (y1 - y0) / n + 2), cols[i], { boil: 0 }); }
// 光晕：1–2 圈平涂半透明环
function glow(x, y, r, col, a = 0.18) { fillOnly(ell(x, y, r, r, 40), col, { alpha: a, boil: 0.5 }); fillOnly(ell(x, y, r * 0.62, r * 0.62, 40), col, { alpha: a, boil: 0.5 }); }

module.exports = { INK, T, TAU, clamp, lerp, hash, vnoise, begin, push, pop, translate, rotate, scale, tx, zoom, ell, arc, spline, rr, rect, quad, noodle, shape, fillOnly, stroke, dot, bands, glow };
