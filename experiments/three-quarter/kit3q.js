// 实验：3/4 侧身角色的构造工具（测试用，确认后再并入 skill）
// 思路：角色在一个轻量的 3D 空间里搭（截面圈、骨骼点），按转身角度 yaw 和俯视角 pitch 投影到画面，
// 再把投影后的剪影描成一条轮廓，交给 character_kit.figure() 画合并描边和暗部。
// 借鉴：Pose Animator / Stretchy Studio（整体轮廓绑骨骼、按参数变形）、perfect-freehand（按距离收尖的笔触）、
//       弹簧跟随（尾巴、胡子、衣摆的 follow-through）。
(function (root) {
  'use strict';
  const D = Math.PI / 180;
  const lerp = (a, b, k) => a + (b - a) * k, clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

  // ---------- 相机 ----------
  // 世界坐标：y 向下，角色面朝 +z。yaw>0 时角色的正面转向画面右边（-x 一侧离观众近）。
  function camera({ yaw = 30, pitch = 8, s = 1, ox = 0, oy = 0 } = {}) {
    const cy = Math.cos(yaw * D), sy = Math.sin(yaw * D), cp = Math.cos(pitch * D), sp = Math.sin(pitch * D);
    const P = p => { const x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy; return [ox + s * x, oy + s * (p[1] * cp + z * sp), z * cp - p[1] * sp]; };
    P.yaw = yaw; P.s = s;
    P.facing = n => -n[0] * sy + n[2] * cy; // 法线朝向观众的程度（>0 可见）
    return P;
  }
  const rotY = (p, a, c = [0, 0, 0]) => { const k = Math.cos(a * D), s = Math.sin(a * D), x = p[0] - c[0], z = p[2] - c[2]; return [c[0] + x * k + z * s, p[1], c[2] - x * s + z * k]; };
  const rotX = (p, a, c = [0, 0, 0]) => { const k = Math.cos(a * D), s = Math.sin(a * D), y = p[1] - c[1], z = p[2] - c[2]; return [p[0], c[1] + y * k - z * s, c[2] + y * s + z * k]; };

  // ---------- 截面放样 ----------
  // 竖直放样（躯干、头、胡子）：截面是水平的椭圆圈 {y, cx, cz, rx, rz}，相邻截面之间平滑插值
  function sliceAt(sl, y) {
    if (y <= sl[0].y) return sl[0];
    for (let i = 1; i < sl.length; i++) if (y <= sl[i].y) {
      const a = sl[i - 1], b = sl[i], k = (y - a.y) / (b.y - a.y), s = k * k * (3 - 2 * k);
      return { y, cx: lerp(a.cx || 0, b.cx || 0, s), cz: lerp(a.cz || 0, b.cz || 0, s), rx: lerp(a.rx, b.rx, s), rz: lerp(a.rz, b.rz, s) };
    }
    return sl[sl.length - 1];
  }
  // 截面上 φ 角的表面点（φ=0 正前方，φ=-90 是角色的 -x 侧）。k>1 往外鼓（头发、毛）
  function surf(sl, y, phi, k = 1) {
    const c = sliceAt(sl, y), a = phi * D;
    return [(c.cx || 0) + c.rx * k * Math.sin(a), y, (c.cz || 0) + c.rz * k * Math.cos(a)];
  }
  const surfNormal = (sl, y, phi) => { const c = sliceAt(sl, y), a = phi * D; return [Math.sin(a) / c.rx, 0, Math.cos(a) / c.rz]; };
  // 一圈截面的 3D 点：竖直放样用水平圈；ringZ 是沿 z 轴的竖直圈（猫的身体）
  function ringY(c, n = 24, xf = p => p) { const o = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; o.push(xf([(c.cx || 0) + c.rx * Math.sin(a), c.y, (c.cz || 0) + c.rz * Math.cos(a)])); } return o; }
  function ringZ(c, n = 24, xf = p => p) { const o = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; o.push(xf([(c.cx || 0) + c.rx * Math.cos(a), c.cy + c.ry * Math.sin(a), c.z])); } return o; }
  function sliceAtZ(sl, z) {
    if (z <= sl[0].z) return sl[0];
    for (let i = 1; i < sl.length; i++) if (z <= sl[i].z) {
      const a = sl[i - 1], b = sl[i], k = (z - a.z) / (b.z - a.z), s = k * k * (3 - 2 * k);
      return { z, cx: lerp(a.cx || 0, b.cx || 0, s), cy: lerp(a.cy, b.cy, s), rx: lerp(a.rx, b.rx, s), ry: lerp(a.ry, b.ry, s) };
    }
    return sl[sl.length - 1];
  }

  // ---------- 投影后的剪影 → 一条轮廓 ----------
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  // 放样体：相邻两圈的凸包拼起来就是整个体积的剪影
  function sweepPolys(rings2d) { const o = []; for (let i = 1; i < rings2d.length; i++) o.push(hull(rings2d[i - 1].concat(rings2d[i]))); return o; }
  let mk = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
  let maskC = null;
  // 把一组多边形光栅化成遮罩，沿边界走一圈得到外轮廓（Moore 邻域追踪），再平滑
  function silhouette(polys, res = 0.5) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    polys.forEach(P => P.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }));
    const pad = 3, w = Math.ceil((x1 - x0) * res) + pad * 2, h = Math.ceil((y1 - y0) * res) + pad * 2;
    if (!maskC || maskC.width < w || maskC.height < h) maskC = mk(Math.max(w, maskC ? maskC.width : 0), Math.max(h, maskC ? maskC.height : 0));
    const g = maskC.getContext('2d', { willReadFrequently: true });
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, maskC.width, maskC.height);
    g.setTransform(res, 0, 0, res, (pad - x0 * res), (pad - y0 * res)); g.fillStyle = '#000';
    polys.forEach(P => { g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); });
    const d = g.getImageData(0, 0, w, h).data, ins = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 127;
    let sx = -1, sy = -1;
    outer: for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ins(x, y)) { sx = x; sy = y; break outer; }
    if (sx < 0) return [];
    const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], out = [[sx, sy]];
    let cx = sx, cy = sy, back = 4;
    for (let step = 0; step < 40000; step++) {
      let found = false;
      for (let k = 1; k <= 8; k++) {
        const dI = (back + k) % 8, nx = cx + N8[dI][0], ny = cy + N8[dI][1];
        if (ins(nx, ny)) { back = (dI + 5) % 8; cx = nx; cy = ny; found = true; break; }
      }
      if (!found || (cx === sx && cy === sy)) break;
      out.push([cx, cy]);
    }
    const inv = 1 / res, raw = out.filter((_, i) => i % 2 === 0).map(([x, y]) => [(x - pad + .5) * inv + x0, (y - pad + .5) * inv + y0]);
    return smooth(smooth(raw, 3), 3);
  }
  function smooth(p, r) { const n = p.length; return p.map((_, i) => { let x = 0, y = 0; for (let k = -r; k <= r; k++) { const q = p[(i + k + n) % n]; x += q[0]; y += q[1]; } return [x / (2 * r + 1), y / (2 * r + 1)]; }); }

  // ---------- 3D 两段关节（手臂、腿）：pole 决定肘/膝朝哪边 ----------
  function ik3(S, H, l1, l2, pole) {
    const v = [H[0] - S[0], H[1] - S[1], H[2] - S[2]], dd = Math.hypot(...v), d = Math.min(dd, l1 + l2 - 0.01), u = v.map(c => c / dd);
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const pd = pole[0] * u[0] + pole[1] * u[1] + pole[2] * u[2], q = [pole[0] - u[0] * pd, pole[1] - u[1] * pd, pole[2] - u[2] * pd], ql = Math.hypot(...q) || 1;
    const E = [S[0] + u[0] * a + q[0] / ql * h, S[1] + u[1] * a + q[1] / ql * h, S[2] + u[2] * a + q[2] / ql * h];
    return { E, H: [S[0] + u[0] * d, S[1] + u[1] * d, S[2] + u[2] * d] };
  }

  // ---------- 弹簧跟随：让尾巴、胡子、衣摆比驱动它的动作晚一拍、带一点过冲 ----------
  // drive: t → 数值；预先按固定步长积分，之后按时间查表（确定性）
  function follow(drive, { k = 40, c = 7, T = 10, dt = 1 / 240 } = {}) {
    const n = Math.ceil(T / dt) + 2, X = new Float32Array(n); let x = drive(0), v = 0;
    for (let i = 0; i < n; i++) { X[i] = x; const a = k * (drive(i * dt) - x) - c * v; v += a * dt; x += v * dt; }
    return t => { const f = clamp(t / dt, 0, n - 2), i = Math.floor(f); return lerp(X[i], X[i + 1], f - i); };
  }

  // ---------- 收尖笔触（参考 perfect-freehand：收尖按弧长、带缓动） ----------
  function brush(g, pts, size, color, { start = 0.35, end = 0.5, ease = t => 1 - (1 - t) * (1 - t) } = {}) {
    if (pts.length < 2) return;
    const c = CharKit.spline(pts, false, 8), L = [0];
    for (let i = 1; i < c.length; i++) L.push(L[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]));
    const tot = L[L.length - 1] || 1, ts = start * tot, te = end * tot;
    const shape = CharKit.tube(c, u => { const d = u * tot; let w = 1; if (ts > 0 && d < ts) w = ease(d / ts); if (te > 0 && d > tot - te) w = Math.min(w, ease((tot - d) / te)); const r = Math.max(0.3, w * size / 2); return [r, r]; }, { N: Math.max(16, c.length), cap0: 'round', cap1: 'round' });
    CharKit.trace(g, shape); g.fillStyle = color; g.fill();
  }

  root.K3 = { camera, rotY, rotX, sliceAt, sliceAtZ, surf, surfNormal, ringY, ringZ, hull, sweepPolys, silhouette, smooth, ik3, follow, brush, D, lerp, clamp,
    useCanvas(fn) { mk = fn; } };
})(typeof self !== 'undefined' ? self : this);
