// motion.js：大气镜头的动画语汇（配合 atmos.js / brush.js）
// 从参考片逐帧量出来的几种运动：特写拉远揭示、静止蓄势、重力加速、一变多的汇聚、裂纹蓄光、闪白 + 冲击波 + 碎块、
// 天色随时间推移（冷→暖）、按层视差的镜头。全部是 t 的纯函数，可随意 seek，结果确定。
'use strict';
module.exports = function makeMotion({ W, H }) {
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const E = {
  io: x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,      // 拉远、推近：慢起慢停
  out: x => 1 - Math.pow(1 - x, 3),                                            // 被推进来、落定
  in: x => x * x * x,                                                          // 重力：越滚越快
  expo: x => x === 1 ? 1 : 1 - Math.pow(2, -10 * x),                           // 冲击波、闪白衰减
  back: x => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },   // 带一点过冲
};

// ---------- 镜头：关键帧 + 视差 ----------
// keys: [[t, {x, y, z}, ease], ...]  x,y 是画面中心对准的世界坐标，z 是缩放（1 = 全景）
function camAt(keys, t) {
  if (t <= keys[0][0]) return { ...keys[0][1] };
  for (let i = 1; i < keys.length; i++) {
    const [t1, c1, ease = E.io] = keys[i], [t0, c0] = keys[i - 1];
    if (t <= t1) { const k = ease(prog(t, t0, t1)); return { x: lerp(c0.x, c1.x, k), y: lerp(c0.y, c1.y, k), z: lerp(c0.z, c1.z, k) }; }
  }
  return { ...keys[keys.length - 1][1] };
}
// 手持晃动（±5px、±0.004 弧度，低频），冲击时 shake 额外加震动
function handheld(t, amp = 1, shake = 0) {
  const n = (f, p) => Math.sin(t * f + p) * 0.6 + Math.sin(t * f * 2.31 + p * 1.7) * 0.4;
  return { dx: (n(0.9, 1) * 5 + n(23, 2) * shake * 18) * amp, dy: (n(0.7, 4) * 5 + n(19, 5) * shake * 18) * amp, rot: n(0.5, 7) * 0.004 * amp };
}
// 按视差系数 p 设置图层变换：p=0 不动（天空），p=1 跟镜头完全一致（主体），p>1 前景
function layerXf(ctx, cam, p, hh = { dx: 0, dy: 0, rot: 0 }) {
  const s = 1 + (cam.z - 1) * p, cx = W / 2 + (cam.x - W / 2) * p, cy = H / 2 + (cam.y - H / 2) * p;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(W / 2 + hh.dx * p, H / 2 + hh.dy * p); ctx.rotate(hh.rot * p); ctx.scale(s, s); ctx.translate(-cx, -cy);
  return s;
}

// ---------- 天色随时间推移：两套色板插值 ----------
function blendPal(a, b, k, mix) {
  const o = {}; for (const key of Object.keys(a)) o[key] = Array.isArray(a[key]) ? a[key].map((c, i) => mix(c, b[key][i], k)) : mix(a[key], b[key], k);
  return o;
}

// ---------- 一变多：沿路径汇聚的队伍 ----------
// 第 i 个在 t0 + i*gap 从起点出发，用 E.out 走到自己的停留位置（队尾越来越靠后），走路时上下颠
function convoy(path, t, { n = 12, t0 = 0, gap = 0.25, dur = 2.2, spacing = 0.045, end = 1 } = {}) {
  const len = []; let L = 0; for (let i = 1; i < path.length; i++) { L += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); len.push(L); }
  const at = u => { const d = clamp(u) * L; let i = len.findIndex(x => x >= d); if (i < 0) i = len.length - 1; const d0 = i ? len[i - 1] : 0, k = (d - d0) / (len[i] - d0 || 1); return [lerp(path[i][0], path[i + 1][0], k), lerp(path[i][1], path[i + 1][1], k)]; };
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = prog(t, t0 + i * gap, t0 + i * gap + dur); if (k <= 0) continue;
    const u = E.out(k) * (end - i * spacing), [x, y] = at(u), walking = k < 1;
    out.push({ i, x, y: y - (walking ? Math.abs(Math.sin(t * 9 + i)) * 4 : 0), k, walking, phase: t * 9 + i });
  }
  return out;
}

// ---------- 依次点亮：窗灯、灯笼、信号（每盏亮起时先过冲再稳定，然后轻微闪烁） ----------
function lightUp(t, t0, i, gap = 0.3, ramp = 0.35) { const k = prog(t, t0 + i * gap, t0 + i * gap + ramp); return k <= 0 ? 0 : clamp(E.back(k), 0, 1.25) * (0.94 + 0.06 * Math.sin(t * 7 + i * 3)); }

// ---------- 重力：从静止开始越滚越快（下坡、坠落）；roll 返回已走过的比例 ----------
function fall(t, t0, dur) { return E.in(prog(t, t0, t0 + dur)); }

// ---------- 裂纹蓄光：从中心向外长出分叉裂纹，越长越亮 ----------
// 返回线段数组 {a:[x,y], b:[x,y], w, glow}，画法由调用方决定（先画暗色裂缝，再 screen 叠暖光）
function crackTree(cx, cy, R, seed = 1) {
  const r = rng(seed), segs = [];
  const grow = (x, y, ang, len, depth, born) => {
    if (depth > 4 || len < R * 0.05) return;
    const n = 3 + Math.floor(r() * 3); let px = x, py = y;
    for (let k = 0; k < n; k++) { const a = ang + (r() - 0.5) * 0.8, l = len / n, nx = px + Math.cos(a) * l, ny = py + Math.sin(a) * l; if (Math.hypot(nx - cx, ny - cy) > R * 0.97) return; segs.push({ a: [px, py], b: [nx, ny], w: Math.max(1, 5 - depth), born: born + k / n * 0.25 + depth * 0.12 }); px = nx; py = ny;
      if (r() < 0.45) grow(px, py, a + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.6), len * 0.6, depth + 1, born + k / n * 0.25 + 0.1); }
  };
  const m = 5 + Math.floor(r() * 3); for (let i = 0; i < m; i++) grow(cx, cy, i / m * 6.283 + r() * 0.5, R * (0.7 + r() * 0.4), 0, 0);
  const maxB = Math.max(...segs.map(s => s.born)); segs.forEach(s => s.born /= maxB);
  return segs;
}
function drawCracks(ctx, segs, k, { dark = '#1B1511', hot = '255,190,110', core = '255,240,200' } = {}) {
  ctx.lineCap = 'round';
  for (const s of segs) { const v = clamp((k - s.born) / 0.15); if (v <= 0) continue; const bx = lerp(s.a[0], s.b[0], v), by = lerp(s.a[1], s.b[1], v);
    ctx.strokeStyle = dark; ctx.lineWidth = s.w + 1.5; ctx.beginPath(); ctx.moveTo(s.a[0], s.a[1]); ctx.lineTo(bx, by); ctx.stroke(); }
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (const pass of [[6, 0.25 * k, hot], [2.5, 0.6 * k, hot], [1, 0.9 * k, core]]) {
    ctx.strokeStyle = `rgba(${pass[2]},${pass[1]})`;
    for (const s of segs) { const v = clamp((k - s.born) / 0.15); if (v <= 0) continue; ctx.lineWidth = s.w * pass[0]; ctx.beginPath(); ctx.moveTo(s.a[0], s.a[1]); ctx.lineTo(lerp(s.a[0], s.b[0], v), lerp(s.a[1], s.b[1], v)); ctx.stroke(); }
  }
  ctx.restore();
}

// ---------- 闪白 + 冲击波环 + 碎块 ----------
// flash：t0 时刻画面几乎全白，按 expo 在 dur 内退去（屏幕空间，在调色之后、字幕之前画）
function flash(ctx, t, t0, { dur = 0.45, peak = 0.92, col = '255,248,230' } = {}) {
  const k = t < t0 ? 0 : 1 - E.expo(prog(t, t0, t0 + dur)); if (k <= 0.001) return 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(${col},${peak * k})`; ctx.fillRect(0, 0, W, H); return k;
}
function shockRing(ctx, x, y, t, t0, { dur = 0.9, R = W * 1.1, col = '255,240,210', w = 10 } = {}) {
  const k = prog(t, t0, t0 + dur); if (k <= 0 || k >= 1) return;
  const r = E.expo(k) * R, a = (1 - k) * 0.8;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = w * (1 - k * 0.6); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
  ctx.strokeStyle = `rgba(${col},${a * 0.35})`; ctx.lineWidth = w * 4; ctx.beginPath(); ctx.arc(x, y, r * 0.96, 0, 7); ctx.stroke();
  ctx.restore();
}
// 碎块：t0 时从中心炸开，抛物线 + 自转 + 空气阻力；返回 {x,y,rot,s,alpha}，形状由调用方用 brush 画
function debris(x0, y0, t, t0, { n = 18, speed = 900, g = 1400, seed = 3, life = 1.6, size = [10, 34] } = {}) {
  const dt = t - t0; if (dt < 0) return [];
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    const a = r() * 6.283, v = speed * (0.4 + r() * 0.8), vx = Math.cos(a) * v, vy = Math.sin(a) * v - speed * 0.3, drag = 1.6, s = lerp(size[0], size[1], r()), spin = (r() - 0.5) * 12, sh = Math.floor(r() * 1000);
    const f = (1 - Math.exp(-drag * dt)) / drag;
    out.push({ i, x: x0 + vx * f, y: y0 + vy * f + 0.5 * g * dt * dt * 0.6, rot: spin * dt, s, alpha: clamp(1 - dt / life), shape: sh });
  }
  return out;
}
// 火星 / 光尘：从某处缓慢上升、左右飘、闪烁（蓄势阶段的次级运动）
function embers(x0, y0, t, { n = 30, spread = 120, rise = 60, seed = 4, life = 2.5 } = {}) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) { const ph = r() * life, age = ((t + ph) % life) / life, x = x0 + (r() - 0.5) * spread + Math.sin(t * 2 + i) * 10 * age, y = y0 - age * rise * (1 + r()); out.push({ x, y, a: Math.sin(age * Math.PI) * (0.6 + 0.4 * Math.sin(t * 13 + i)), s: 1.5 + r() * 2.5 }); }
  return out;
}

return { E, prog, clamp, lerp, rng, camAt, handheld, layerXf, blendPal, convoy, lightUp, fall, crackTree, drawCracks, flash, shockRing, debris, embers };
};
