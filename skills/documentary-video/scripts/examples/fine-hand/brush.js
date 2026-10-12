// brush.js：更细腻的手绘画法（方案 A 试验）
// - brush：有笔压的线条（起笔轻、中段重、收笔尖，背光一侧更粗），每张画（一拍二）重新"画"一遍：低频噪声让线条位置、粗细都有细微差别
// - wash：水彩式上色——颜料在边缘积色、色面深浅不匀、颗粒感
// - hatchForm：顺着形体的排线，只排在背光一侧，暗部再叠一层交叉排线；每根排线也是有笔压的笔触
'use strict';
// 独立版：不依赖项目代码。用法：const B = require('./brush')({ S, createCanvas });
//   S = { K: 当前第几张画（一拍二：floor(t*12)）, Z: 当前图层的缩放 } —— 由渲染循环每帧更新
//   createCanvas 来自 @napi-rs/canvas
module.exports = function makeBrush({ S, createCanvas, INK = '#1B1511' }) {
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

const LIGHT = [-0.6, -0.8];   // 主光从左上来
function vn(x, seed) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), h = k => { const s = Math.sin((k + seed * 13.37) * 127.1) * 43758.5453; return s - Math.floor(s); }; return lerp(h(i), h(i + 1), u); }
function resample(pts, step, closed) {
  const P = closed ? pts.concat([pts[0]]) : pts, out = [P[0]]; let acc = 0;
  for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]); let pos = step - acc; while (pos < d) { const u = pos / d; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); pos += step; } acc = d - (pos - step); }
  if (!closed) out.push(P[P.length - 1]);
  return out;
}
function chaikin(pts, closed, n = 2) { let p = pts; for (let k = 0; k < n; k++) { const o = []; const m = closed ? p.length : p.length - 1; if (!closed) o.push(p[0]); for (let i = 0; i < m; i++) { const a = p[i], b = p[(i + 1) % p.length]; o.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]); } if (!closed) o.push(p[p.length - 1]); p = o; } return p; }
const area = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

// 有笔压的线条：画成一个宽度沿长度变化的多边形
function brush(ctx, pts, { w = 4, col = INK, seed = 1, closed = false, alpha = 1, taper = [0.18, 0.32], press = 0.7, wob = 1.3, shadeSide = true, smooth = false, step = 5 } = {}) {
  if (pts.length < 2) return;
  const z = S.Z, k = S.K, src = smooth ? chaikin(pts, closed, 2) : pts;
  const P = resample(src, step / z, closed); if (P.length < 2) return;
  const n = P.length, L = n * step, sd = seed * 1.7 + (k % 24) * 3.1;   // 每张画换一组噪声（重新画一遍）
  const ori = closed && area(src) < 0 ? -1 : 1, left = [], right = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const nx = -ty, ny = tx, u = i / (n - 1), s = i * step / 38;
    let prof = closed ? 1 : Math.min(1, u / taper[0], (1 - u) / taper[1]); prof = Math.pow(clamp(prof), 0.7);
    let ww = w * (0.35 + 0.65 * prof) * (1 + press * (vn(s * 1.3, sd + 5) - 0.5));
    if (shadeSide && closed) { const dot = (nx * ori) * LIGHT[0] + (ny * ori) * LIGHT[1]; ww *= 1 + 0.95 * clamp(-dot); }   // 背光一侧加粗
    else if (!closed) ww *= 0.85 + 0.3 * vn(s * 0.6, sd + 9);
    const d = (vn(s, sd) - 0.5) * 2 * wob, cx = P[i][0] + nx * d / z, cy = P[i][1] + ny * d / z, h = ww / 2 / z;
    left.push([cx + nx * h, cy + ny * h]); right.push([cx - nx * h, cy - ny * h]);
  }
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = col; ctx.beginPath();
  if (closed) { // 闭合线：外圈 + 内圈，奇偶填充
    ctx.moveTo(left[0][0], left[0][1]); for (const p of left) ctx.lineTo(p[0], p[1]); ctx.closePath();
    ctx.moveTo(right[0][0], right[0][1]); for (const p of right) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.fill('evenodd');
  } else { ctx.moveTo(left[0][0], left[0][1]); for (const p of left) ctx.lineTo(p[0], p[1]); for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
// 一笔画多次：偶尔在主线旁再补一笔细线（画家修线的痕迹）
function line(ctx, pts, o = {}) { brush(ctx, pts, o); const r = rng((o.seed || 1) * 31 + 7); if (!o.closed && r() < (o.redo ?? 0.35)) { const off = (r() - 0.5) * 3 / S.Z; brush(ctx, pts.map(p => [p[0] + off, p[1] + off * 0.6]), { ...o, w: (o.w || 4) * 0.45, alpha: 0.55, seed: (o.seed || 1) + 99, taper: [0.3, 0.4] }); } }

// 颗粒纹理（重复平铺，跟着物体走）
const GRAN = (() => { const cv = createCanvas(256, 256), g = cv.getContext('2d'), img = g.createImageData(256, 256), r = rng(4242); for (let i = 0; i < img.data.length; i += 4) { const v = 200 + r() * 55 - (r() < 0.06 ? 60 : 0); img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; } g.putImageData(img, 0, 0); return cv; })();
function pathOf(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
// 水彩式上色
function wash(ctx, pts, col, { seed = 1, edge = col, edgeA = 0.35, blot = 0.1, gran = 0.22, offset = true } = {}) {
  const r = rng(seed * 17 + (S.K % 24)), dx = offset ? (1.5 + r() * 1.5) / S.Z : 0, dy = offset ? (1 + r()) / S.Z : 0;
  ctx.save(); ctx.translate(dx, dy); pathOf(ctx, pts); ctx.fillStyle = col; ctx.fill(); ctx.clip();
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; pts.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
  const rb = rng(seed * 7 + 3);   // 色面深浅不匀：几块大的淡色斑（位置固定，不随帧跳）
  for (let i = 0; i < 4; i++) { const cx = lerp(x0, x1, rb()), cy = lerp(y0, y1, rb()), rr = Math.max(x1 - x0, y1 - y0) * (0.25 + rb() * 0.35); ctx.globalAlpha = blot; ctx.fillStyle = rb() < 0.5 ? '#ffffff' : '#000000'; ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 0.6, rb() * 3, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  // 边缘积色：沿边画几圈由深到浅的线
  for (let k = 0; k < 3; k++) { ctx.globalAlpha = edgeA * (1 - k * 0.32); ctx.strokeStyle = edge; ctx.lineWidth = (3 + k * 5) / S.Z; ctx.lineJoin = 'round'; pathOf(ctx, pts); ctx.stroke(); }
  if (gran > 0) { ctx.globalAlpha = gran; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = ctx.createPattern(GRAN, 'repeat'); ctx.fillRect(x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20); }
  ctx.restore();
}
// 顺着形体的排线：只排在背光的一侧（把形状向光源方向挪一点，挪不到的部分就是阴影），深的地方再交叉一层
function hatchForm(ctx, pts, { ang = -0.9, sp = 9, w = 1.6, col = INK, depth = 18, cross = 0, seed = 1, alpha = 0.8, curve = 0, all = false } = {}) {
  const z = S.Z, r = rng(seed * 11 + (S.K % 24) * 3);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; pts.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + 10;
  const pass = (a, dep, sp_, sd) => {
    ctx.save(); pathOf(ctx, pts); ctx.clip();
    if (!all) { ctx.beginPath(); ctx.rect(x0 - 2000, y0 - 2000, x1 - x0 + 4000, y1 - y0 + 4000); const sx = LIGHT[0] * dep, sy = LIGHT[1] * dep; ctx.moveTo(pts[0][0] + sx, pts[0][1] + sy); for (const p of pts) ctx.lineTo(p[0] + sx, p[1] + sy); ctx.closePath(); ctx.clip('evenodd'); }
    const c = Math.cos(a), s = Math.sin(a), step = sp_ / Math.max(z, 0.6);
    for (let d = -R; d < R; d += step * (0.8 + 0.4 * r())) {
      const ox = cx - s * d, oy = cy + c * d, len = R * (0.6 + 0.8 * r()), off = (r() - 0.5) * R * 0.6, seg = [];
      for (let k = 0; k <= 6; k++) { const u = (k / 6 - 0.5) * len + off; seg.push([ox + c * u + Math.sin(k / 6 * 3.1) * curve * -s, oy + s * u + Math.sin(k / 6 * 3.1) * curve * c]); }
      brush(ctx, seg, { w: w * (0.7 + 0.6 * r()), col, seed: sd + Math.round(d), alpha, taper: [0.3, 0.4], press: 0.5, wob: 0.6, step: 6 });
    }
    ctx.restore();
  };
  pass(ang, depth, sp, seed);
  if (cross > 0) pass(ang + 1.1, depth * 2.2, sp * 1.2, seed + 500);
}
return { brush, line, wash, hatchForm, chaikin, resample, vn, LIGHT };
};
