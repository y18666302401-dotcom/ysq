// 扁平插画动画工具库：液体变形、链条物理、两段关节手臂、canvas → ffmpeg 渲染管线
// 依赖：npm install @napi-rs/canvas（渲染时才需要）；系统里有 ffmpeg。
// 完整用法见 examples/carrington-10s/test10.js，规则见 references/styles/flat.md。
'use strict';

// ---------- 基础数学 ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const wobble = (t, k = 18, d = 4) => t <= 0 ? 0 : Math.exp(-d * t) * Math.sin(k * t); // 阻尼振荡（回弹、摆动衰减）

// ---------- 液体变形 ----------
// 用法：A = norm(源形状点列), B = norm(目标形状点列)；每帧 pts = morph(A, B, p, t)；画 blobPath(ctx, pts, 颜色)
// p 从 0 到 1；p ≥ 1 之后用 settle(B, 到达后的秒数, t) 做过冲回弹。
function resample(pts, N) {
  const P = pts.concat([pts[0]]), seg = []; let L = 0;
  for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); seg.push(d); L += d; }
  const out = []; let k = 0, acc = 0;
  for (let n = 0; n < N; n++) {
    const target = L * n / N;
    while (k < seg.length - 1 && acc + seg[k] < target) { acc += seg[k]; k++; }
    const u = seg[k] ? (target - acc) / seg[k] : 0;
    out.push([lerp(P[k][0], P[k + 1][0], u), lerp(P[k][1], P[k + 1][1], u)]);
  }
  return out;
}
function centroid(p) { let x = 0, y = 0; p.forEach(q => { x += q[0]; y += q[1]; }); return [x / p.length, y / p.length]; }
// 统一点数、绕行方向和起点（最上方的点），两个形状才能逐点对应，否则变形会扭成一团
function norm(pts, N = 200) {
  let p = resample(pts, N); let A = 0;
  for (let i = 0; i < N; i++) { const a = p[i], b = p[(i + 1) % N]; A += a[0] * b[1] - b[0] * a[1]; }
  if (A < 0) p.reverse();
  const [cx, cy] = centroid(p); let best = 0, bd = 1e9;
  p.forEach((q, i) => { const d = Math.abs(Math.atan2(q[1] - cy, q[0] - cx) + Math.PI / 2); if (d < bd) { bd = d; best = i; } });
  return p.slice(best).concat(p.slice(0, best));
}
// stagger：错开出发的比例（离目标中心近的点先流）；amp：边缘波纹幅度；sag：受重力下坠的幅度；seed：区分多个同时变形的形状
function morph(A, B, p, t, { stagger = 0.4, amp = 26, sag = 70, seed = 0 } = {}) {
  const [bx, by] = centroid(B), [ax, ay] = centroid(A);
  const ds = A.map(q => Math.hypot(q[0] - bx, q[1] - by)), dmin = Math.min(...ds), dmax = Math.max(...ds) + 1e-6;
  return A.map((q, i) => {
    const d = stagger * (ds[i] - dmin) / (dmax - dmin), u = clamp((p - d) / (1 - stagger)), e = easeIO(u);
    let x = lerp(q[0], B[i][0], e), y = lerp(q[1], B[i][1], e);
    const env = Math.sin(Math.PI * u), cx = lerp(ax, bx, e), cy = lerp(ay, by, e);
    const nx = x - cx, ny = y - cy, nl = Math.hypot(nx, ny) + 1e-6;
    const n = Math.sin(i * 0.37 + t * 7 + seed) + 0.6 * Math.sin(i * 0.11 - t * 5 + 1.3 + seed);
    x += nx / nl * n * amp * env; y += ny / nl * n * amp * env;
    y += sag * env * Math.max(0, ny / nl);
    return [x, y];
  });
}
function settle(B, tAfter, t, amp = 14) {
  const w = wobble(tAfter, 11, 4); if (Math.abs(w) < 1e-3) return B;
  const [cx, cy] = centroid(B);
  return B.map((q, i) => { const nx = q[0] - cx, ny = q[1] - cy, nl = Math.hypot(nx, ny) + 1e-6, k = w * amp * (1 + 0.5 * Math.sin(i * 0.5 + t * 4)); return [q[0] + nx / nl * k, q[1] + ny / nl * k]; });
}
// 用二次曲线把点连成平滑的液体轮廓（不描边）
function blobPath(ctx, pts, fill) {
  const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  ctx.beginPath(); const m = mid(pts[n - 1], pts[0]); ctx.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) { const c = pts[i], m2 = mid(pts[i], pts[(i + 1) % n]); ctx.quadraticCurveTo(c[0], c[1], m2[0], m2[1]); }
  ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); }
}
const circlePts = (x, y, r, n = 120) => Array.from({ length: n }, (_, i) => [x + Math.cos(i / n * 6.283) * r, y + Math.sin(i / n * 6.283) * r]);
const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

// ---------- 链条 / 绳子物理（Verlet，固定步长预积分，结果确定） ----------
// anchor：固定挂点；end：末端起始位置；length：总长；endInvMass 越小末端越重（0.08≈重物）
// 初始形状：在挂点和末端之间松垂，并按弧长等距取点（否则第一步会被猛拽、末端瞬移）
function chainSim({ anchor, end, length, links = 18, gravity = 2600, damping = 0.996, endInvMass = 0.08, t0 = 0, duration = 10, fps = 30, iterations = 24 }) {
  const dt = 1 / 240, A = anchor;
  let amp = 0;
  const curveAt = (s, a) => [lerp(A[0], end[0], s) + a * Math.sin(Math.PI * s * 2), lerp(A[1], end[1], s)];
  for (let it = 0; it < 60; it++) { let len = 0, prev = null; for (let k = 0; k <= 80; k++) { const p = curveAt(k / 80, amp); if (prev) len += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; } amp += (length - len) * 0.3; }
  const curve = []; for (let k = 0; k <= 400; k++) curve.push(curveAt(k / 400, amp));
  const cum = [0]; for (let k = 1; k < curve.length; k++) cum.push(cum[k - 1] + Math.hypot(curve[k][0] - curve[k - 1][0], curve[k][1] - curve[k - 1][1]));
  const Lc = cum[cum.length - 1], Lk = Lc / links, P = [], Q = [], im = [];
  for (let k = 0; k <= links; k++) {
    const target = Lc * k / links; let j = 1; while (j < cum.length - 1 && cum[j] < target) j++;
    const u = (target - cum[j - 1]) / (cum[j] - cum[j - 1] || 1), p = [lerp(curve[j - 1][0], curve[j][0], u), lerp(curve[j - 1][1], curve[j][1], u)];
    P.push(p.slice()); Q.push(p.slice()); im.push(k === 0 ? 0 : k === links ? endInvMass : 1);
  }
  const frames = []; let tCatch = null, t = t0;
  const steps = Math.round((duration + 0.1) / dt), every = Math.round(240 / fps);
  for (let s = 0; s <= steps; s++) {
    for (let k = 1; k <= links; k++) { const vx = (P[k][0] - Q[k][0]) * damping, vy = (P[k][1] - Q[k][1]) * damping; Q[k] = P[k].slice(); P[k][0] += vx; P[k][1] += vy + gravity * dt * dt; }
    for (let it = 0; it < iterations; it++) for (let k = 0; k < links; k++) {
      const a = P[k], b = P[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1e-6, diff = (d - Lk) / d, w = im[k] + im[k + 1]; if (!w) continue;
      a[0] += dx * diff * im[k] / w; a[1] += dy * diff * im[k] / w; b[0] -= dx * diff * im[k + 1] / w; b[1] -= dy * diff * im[k + 1] / w;
    }
    // “被拽住”的时刻：末端到挂点的距离接近链长。用来配音效、触发压扁回弹
    if (tCatch === null && Math.hypot(P[links][0] - A[0], P[links][1] - A[1]) > Lc * 0.93) tCatch = t;
    t += dt;
    if (s % every === 0) { const a = P[links - 1], b = P[links]; frames.push({ t, pts: P.map(p => p.slice()), angle: -Math.atan2(b[0] - a[0], b[1] - a[1]) }); }
  }
  const at = tt => frames[Math.max(0, Math.min(frames.length - 1, Math.round((tt - t0) * fps)))];
  return { frames, tCatch, at };
}
// 落地/被拽住后的压扁回弹量：ctx.scale(1 + sq, 1 - sq)
const squash = (t, tHit, amount = 0.14) => (tHit != null && t > tHit) ? wobble(t - tHit, 20, 5) * amount : 0;

// ---------- 两段关节手臂（肩—肘—手） ----------
// 给肩膀位置和手要到的位置，算出肘部。elbowDown=true 时肘部朝下。
function ik2(S, T, l1, l2, elbowDown = true) {
  const dx = T[0] - S[0], dy = T[1] - S[1], d = Math.min(Math.hypot(dx, dy), l1 + l2 - 1), a = Math.atan2(dy, dx);
  const b = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)) * (elbowDown ? 1 : -1);
  return [S[0] + Math.cos(a + b) * l1, S[1] + Math.sin(a + b) * l1];
}
// 画一节肢体（两端不同粗细的平涂四边形 + 关节圆）
function limb(ctx, A, B, wA, wB, col) {
  const a = Math.atan2(B[1] - A[1], B[0] - A[0]), nx = -Math.sin(a), ny = Math.cos(a);
  ctx.beginPath(); ctx.moveTo(A[0] + nx * wA, A[1] + ny * wA); ctx.lineTo(B[0] + nx * wB, B[1] + ny * wB); ctx.lineTo(B[0] - nx * wB, B[1] - ny * wB); ctx.lineTo(A[0] - nx * wA, A[1] - ny * wA); ctx.closePath();
  ctx.fillStyle = col; ctx.fill(); ctx.beginPath(); ctx.arc(B[0], B[1], wB, 0, 7); ctx.fill();
}
// 一整条手臂：shoulder → elbow → wrist；手臂总长要比肩到目标的距离长 10% 以上，否则会被拉直、显得僵硬
function arm(ctx, shoulder, wrist, { l1 = 270, l2 = 260, w = [46, 40, 30], col = '#1f1c36', col2 = null } = {}) {
  const E = ik2(shoulder, wrist, l1, l2);
  limb(ctx, shoulder, E, w[0], w[1], col); limb(ctx, E, wrist, w[1], w[2], col2 || col);
  return E;
}

// ---------- 渲染管线：逐帧画到 canvas，原始像素直接送进 ffmpeg ----------
// frame(ctx, t, frameIndex)：画第 t 秒的画面。所有动画都只由 t 决定（不要用随机数和真实时间），保证可重复渲染。
function stills(frame, times, out, { W = 1080, H = 1920, cols = 6, thumbW = 270 } = {}) {
  const { createCanvas } = require('@napi-rs/canvas'); const fs = require('fs');
  const cv = createCanvas(W, H), ctx = cv.getContext('2d'), th = Math.round(thumbW * H / W), rows = Math.ceil(times.length / cols);
  const sheet = createCanvas(thumbW * cols, th * rows), sx = sheet.getContext('2d');
  times.forEach((t, k) => { ctx.setTransform(1, 0, 0, 1, 0, 0); frame(ctx, t, k); sx.drawImage(cv, (k % cols) * thumbW, Math.floor(k / cols) * th, thumbW, th); sx.fillStyle = '#ff0'; sx.font = '22px sans-serif'; sx.fillText(t.toFixed(1), (k % cols) * thumbW + 6, Math.floor(k / cols) * th + 24); });
  fs.writeFileSync(out, sheet.toBuffer('image/png'));
}
function renderVideo(frame, out, { W = 1080, H = 1920, fps = 30, from = 0, to, crf = 18 } = {}) {
  const { createCanvas } = require('@napi-rs/canvas'); const { spawn } = require('child_process');
  const cv = createCanvas(W, H), ctx = cv.getContext('2d');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  let n = Math.round(from * fps); const N = Math.round(to * fps);
  return new Promise(res => {
    const write = () => { while (n < N) { ctx.setTransform(1, 0, 0, 1, 0, 0); frame(ctx, n / fps, n); const ok = ff.stdin.write(Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer)); n++; if (!ok) { ff.stdin.once('drain', write); return; } } ff.stdin.end(); };
    ff.on('close', c => res(c)); write();
  });
}

module.exports = { clamp, lerp, prog, easeIO, easeOut, easeIn, wobble, resample, centroid, norm, morph, settle, blobPath, circlePts, rectPts, chainSim, squash, ik2, limb, arm, stills, renderVideo };
