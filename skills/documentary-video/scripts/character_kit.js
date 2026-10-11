// 角色造型工具库：让人物和动物看起来是"画出来的一整个"，而不是几何体拼起来的。
// 浏览器（<script src="character_kit.js">，全局 CharKit）和 Node（require）都能用。
// 规则和做法见 references/characters.md，前后对比样片见 examples/character-quality/。
//
// 拼装感的四个来源，以及这里对应的工具：
//   1. 每个部件各描一圈边，关节处全是接缝    → figure()：一组部件只描一次外轮廓；join 让四肢的边线在关节处淡出
//   2. 四肢、脖子、尾巴是等粗的管子         → tube()：沿一条骨线按粗细曲线生成轮廓（大腿粗、膝盖收、小腿鼓、脚踝细）
//   3. 头是正圆、身体是椭圆、耳朵是三角     → blob()：用几个控制点画平滑闭合曲线，耳朵、腮毛、胡子都并进同一条轮廓
//   4. 线条粗细一样、阴影是贴上去的色块      → figure() 的 weight（背光一侧线更粗）和 shade（沿轮廓偏移得到的月牙形暗部）、ink()（两头收尖的线）
//
// 画面只由时间决定：这里不用随机数，jitter() 用固定种子。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CharKit = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

  // ---------- 曲线 ----------
  // Catmull-Rom 样条：控制点 → 密集的平滑点列。closed=true 时首尾相接。
  function spline(pts, closed = true, per = 12) {
    const n = pts.length, out = [];
    if (n < 3) return pts.slice();
    const P = i => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(d => 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
      }
    }
    if (!closed) out.push(pts[n - 1].slice());
    return out;
  }
  // 按弧长等距重采样（开放折线）
  function resample(pts, N) {
    const seg = []; let L = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
    const out = []; let k = 0, acc = 0;
    for (let i = 0; i < N; i++) {
      const target = L * i / (N - 1);
      while (k < seg.length - 1 && acc + seg[k] < target) { acc += seg[k]; k++; }
      const u = seg[k] ? clamp((target - acc) / seg[k]) : 0;
      out.push([lerp(pts[k][0], pts[k + 1][0], u), lerp(pts[k][1], pts[k + 1][1], u)]);
    }
    return out;
  }
  // 粗细曲线：[[u, 半宽], ...] 或 [[u, 左半宽, 右半宽], ...]，u 从 0（根部）到 1（末端），中间平滑插值
  function profileFn(prof) {
    if (typeof prof === 'function') return prof;
    const P = prof.map(p => p.length === 2 ? [p[0], p[1], p[1]] : p);
    return u => {
      if (u <= P[0][0]) return [P[0][1], P[0][2]];
      for (let i = 1; i < P.length; i++) if (u <= P[i][0]) {
        const a = P[i - 1], b = P[i], k = (u - a[0]) / (b[0] - a[0]), s = k * k * (3 - 2 * k);
        return [lerp(a[1], b[1], s), lerp(a[2], b[2], s)];
      }
      const z = P[P.length - 1]; return [z[1], z[2]];
    };
  }

  // ---------- 形状 ----------
  // 平滑闭合形状：给 6–20 个控制点（顺时针、逆时针都行），返回密集点列。
  // 耳朵、腮毛、发梢这类尖角：把相邻两个控制点放得很近，曲线会在那里收成尖。
  const blob = (pts, per = 10) => spline(pts, true, per);

  // 管状肢体：骨线（2 个以上控制点，经过关节）+ 粗细曲线 → 闭合轮廓点列。
  // 骨线先平滑，所以膝盖、肘部是圆顺的弯，不是折角；末端默认是圆头（cap: 'round' | 'flat'）。
  // 例：前腿 tube([[0,0],[−4,60],[6,130]], [[0,30],[.35,22],[.75,13],[1,15]])
  function tube(bone, prof, { N = 40, cap0 = 'flat', cap1 = 'round' } = {}) {
    const c = resample(bone.length > 2 ? spline(bone, false, 10) : bone, N), w = profileFn(prof);
    const L = [], R = [];
    for (let i = 0; i < N; i++) {
      const a = c[Math.max(0, i - 1)], b = c[Math.min(N - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
      const [wl, wr] = w(i / (N - 1));
      L.push([c[i][0] + nx * wl, c[i][1] + ny * wl]); R.push([c[i][0] - nx * wr, c[i][1] - ny * wr]);
    }
    const capPts = (center, from, to, dirSign) => {
      const out = [], a0 = Math.atan2(from[1] - center[1], from[0] - center[0]), a1 = Math.atan2(to[1] - center[1], to[0] - center[0]);
      let da = a1 - a0; if (dirSign > 0 && da < 0) da += Math.PI * 2; if (dirSign < 0 && da > 0) da -= Math.PI * 2;
      const r0 = Math.hypot(from[0] - center[0], from[1] - center[1]), r1 = Math.hypot(to[0] - center[0], to[1] - center[1]);
      for (let k = 1; k < 8; k++) { const t = k / 8, a = a0 + da * t, r = lerp(r0, r1, t); out.push([center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r]); }
      return out;
    };
    // 末端圆头的绕向要和轮廓一致：L 在骨线前进方向的右手边（canvas 坐标 y 向下）
    const end = cap1 === 'round' ? capPts(c[N - 1], L[N - 1], R[N - 1], -1) : [];
    const start = cap0 === 'round' ? capPts(c[0], R[0], L[0], -1) : [];
    return L.concat(end, R.reverse(), start);
  }

  // 低频抖动（逐帧手绘画风的线条颤动）：沿轮廓叠加平滑的正弦噪声，seed 用张数
  function jitter(pts, amp, seed) {
    const n = pts.length, f = [1, 2, 3].map(k => [Math.sin(seed * 12.9898 * k) * 43758.5453 % 1, Math.sin(seed * 78.233 * k) * 12345.678 % 1]);
    return pts.map((p, i) => {
      const u = i / n * Math.PI * 2; let dx = 0, dy = 0;
      f.forEach(([a, b], k) => { dx += Math.sin(u * (k + 3) + a * 6.28) / (k + 1); dy += Math.cos(u * (k + 3) + b * 6.28) / (k + 1); });
      return [p[0] + dx * amp * 0.55, p[1] + dy * amp * 0.55];
    });
  }

  // 平移 / 旋转 / 缩放一组点（做姿势、呼吸）
  const move = (pts, dx, dy) => pts.map(p => [p[0] + dx, p[1] + dy]);
  function rotate(pts, a, c = [0, 0]) {
    const s = Math.sin(a), k = Math.cos(a);
    return pts.map(p => { const x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + x * k - y * s, c[1] + x * s + y * k]; });
  }
  const scale = (pts, sx, sy = sx, c = [0, 0]) => pts.map(p => [c[0] + (p[0] - c[0]) * sx, c[1] + (p[1] - c[1]) * sy]);
  // 两段关节（腿、手臂）：根部 a、末端 b、两段长度，bend=±1 决定关节朝哪边弯。返回关节点。
  function ik2(a, b, l1, l2, bend = 1) {
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.min(Math.hypot(dx, dy), l1 + l2 - 1e-3);
    const ang = Math.atan2(dy, dx), cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), A = Math.acos(cosA) * bend;
    return [a[0] + Math.cos(ang - A) * l1, a[1] + Math.sin(ang - A) * l1];
  }

  // ---------- 绘制 ----------
  function trace(g, pts, closed = true) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    if (closed) g.closePath();
  }
  // 两头收尖、中间粗的线：眼皮、皱褶、条纹、胡须、衣纹。w 是最粗处的宽度；taper=[根部比例, 末端比例]
  function ink(g, pts, w, color, { taper = [0.15, 0.15], smooth = true } = {}) {
    const c = smooth && pts.length > 2 ? spline(pts, false, 8) : pts;
    if (c.length < 2) return;
    const shape = tube(c, u => { const k = Math.sin(Math.PI * clamp(u)) ** 0.6, e = u < 0.5 ? taper[0] : taper[1]; const v = lerp(e, 1, k) * w / 2; return [v, v]; }, { N: Math.max(12, c.length), cap0: 'round', cap1: 'round' });
    trace(g, shape); g.fillStyle = color; g.fill();
  }

  // 离屏缓冲：每个图层在缓冲上先描边、再擦掉关节处的边线、再填色，最后整层贴回画面
  let makeCanvas = (w, h) => {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  };
  const buffers = [];
  function buffer(i, w, h) {
    if (!buffers[i] || buffers[i].width !== w || buffers[i].height !== h) buffers[i] = makeCanvas(w, h);
    return buffers[i];
  }
  // 世界坐标的方向 → 当前变换下的局部方向（角色旋转、翻转后，光仍从同一边来）
  function localDir(g, v) {
    const m = g.getTransform(), det = m.a * m.d - m.b * m.c || 1;
    return [(m.d * v[0] - m.c * v[1]) / det, (-m.b * v[0] + m.a * v[1]) / det];
  }

  // 画一个角色：layers 从后往前，每层是 { parts: [...], joins: [...] }。
  //   同一层里的部件只有一条合并后的外轮廓（内部没有接缝）；不同层之间有边线（远侧腿和身体、头和身体）。
  //   同一层按 parts 的顺序填色：插进去的部件（尾巴根、袖口里的手）排前面，主体排后面盖住接口。
  //   part = { pts, fill, detail?(g), shade?: 颜色 | false, rim?: 颜色 }
  //     detail：在部件里面画的花纹、肚皮、衣纹（已经裁剪在部件内，之后统一叠暗部）
  //   join = { at: [x, y], r, into: 点列 }：在 at 附近、into 形状里面，本层的边线淡出 —— 四肢从身体里"长"出来
  // opts：
  //   line: 描边色（null = 不描边，扁平插画用）、lw: 线宽
  //   light: 光的方向（世界坐标，指向光照过去的方向，默认 [0.55, 0.85] 从左上照向右下）
  //   shadeDepth: 暗部宽度（沿光的方向把形状平移这么多，没被覆盖的部分就是暗部）
  //   shadeMode: 'multiply'（暗部颜色和底色相乘，花纹一起变暗）| 'source-over'（硬边平涂色块，扁平插画用）
  //   weight: 背光一侧描边加粗的像素数（0 = 均匀线宽）
  //   rimDepth: 轮廓光宽度（Canvas 光影画风的受光边）
  function figure(g, layers, opts = {}) {
    const { line = '#2A1F33', lw = 6, light = [0.55, 0.85], shadeDepth = 18, shadeMode = 'multiply', weight = lw * 0.6, rimDepth = 5 } = opts;
    const W = g.canvas.width, H = g.canvas.height, M = g.getTransform();
    const L = localDir(g, light), Ln = Math.hypot(...L) || 1, lx = L[0] / Ln, ly = L[1] / Ln;
    const scaleK = Math.sqrt(Math.abs(M.a * M.d - M.b * M.c)) || 1; // 线宽按屏幕像素算，角色缩放时不变粗变细
    layers.forEach((layer, li) => {
      const B = buffer(li % 4, W, H), b = B.getContext('2d');
      b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, W, H); b.setTransform(M);
      b.lineJoin = 'round'; b.lineCap = 'round';
      if (line) {
        const lwL = lw / scaleK, wt = weight / scaleK;
        b.strokeStyle = line; b.fillStyle = line;
        layer.parts.forEach(p => {
          trace(b, p.pts); b.lineWidth = lwL * 2; b.stroke();
          if (wt > 0) { b.save(); b.translate(lx * wt, ly * wt); trace(b, p.pts); b.stroke(); b.restore(); }
        });
        (layer.joins || []).forEach(j => {
          b.save(); trace(b, j.into); b.clip();
          const gr = b.createRadialGradient(j.at[0], j.at[1], 0, j.at[0], j.at[1], j.r);
          gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.88, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); // 边缘只留很窄的过渡，宽了会剩一圈灰影
          b.globalCompositeOperation = 'destination-out'; b.fillStyle = gr;
          b.fillRect(j.at[0] - j.r, j.at[1] - j.r, j.r * 2, j.r * 2); b.restore();
        });
      }
      layer.parts.forEach(p => {
        trace(b, p.pts); b.fillStyle = p.fill; b.fill();
        b.save(); trace(b, p.pts); b.clip();
        if (p.detail) p.detail(b);
        if (p.shade !== false && (p.shade || opts.shade)) {
          // 暗部 = 形状 − 沿光的方向往回挪一段的形状：自动贴着轮廓，是一条月牙
          b.globalCompositeOperation = shadeMode; b.fillStyle = p.shade || opts.shade;
          b.beginPath(); b.rect(-1e5, -1e5, 2e5, 2e5);
          const d = (p.shadeDepth || shadeDepth);
          const q = move(p.pts, -lx * d, -ly * d);
          b.moveTo(q[0][0], q[0][1]); for (let i = q.length - 1; i > 0; i--) b.lineTo(q[i][0], q[i][1]); b.closePath();
          b.fill('evenodd'); b.globalCompositeOperation = 'source-over';
        }
        if (p.rim) {
          b.fillStyle = p.rim; b.beginPath(); b.rect(-1e5, -1e5, 2e5, 2e5);
          const q = move(p.pts, lx * rimDepth, ly * rimDepth);
          b.moveTo(q[0][0], q[0][1]); for (let i = q.length - 1; i > 0; i--) b.lineTo(q[i][0], q[i][1]); b.closePath();
          b.fill('evenodd');
        }
        b.restore();
      });
      if (layer.after) layer.after(b); // 本层上面、不受裁剪的线（眼睛、胡须、跨部件的衣纹）
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(B, 0, 0); g.restore();
    });
  }

  return { spline, resample, blob, tube, jitter, move, rotate, scale, ik2, trace, ink, figure, profileFn, lerp, clamp,
    useCanvas(fn) { makeCanvas = fn; } };
});
