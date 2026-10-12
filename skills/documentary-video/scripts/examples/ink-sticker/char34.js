// 墨线贴纸 · 人物 v2：3/4 侧身 + 整体轮廓（不再逐部件描边）
// 做法：所有部件先合成一个整体剪影描一圈外轮廓 → 再铺色（色块互相盖住内部接缝）→ 只在真正有前后遮挡的地方补细的、两头收尖的内线
// 四肢是沿骨骼中心线连续的一整条多边形，宽度按 肩/臀 → 肌肉 → 关节 → 肌肉 → 腕/踝 变化，关节处不断开
'use strict';
const { createCanvas } = require('@napi-rs/canvas');

const INK = '#232845', PAPER = '#EFE6D6', SHADOW = 'rgba(70,50,30,0.16)', LW = 5.5;
const G = { K: 3, tint: null };
const tc = c => (G.tint ? G.tint(c) : c);   // 细节颜色也跟着光照换色（夜景）
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sm = t => { t = clamp(t); return t * t * (3 - 2 * t); };
function vn(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), h = k => { const s = Math.sin((k + seed * 13.37) * 127.1) * 43758.5453; return s - Math.floor(s); }; return lerp(h(i), h(i + 1), u); }
function chaikin(p, closed, n = 3) { for (let k = 0; k < n; k++) { const o = [], m = closed ? p.length : p.length - 1; if (!closed) o.push(p[0]); for (let i = 0; i < m; i++) { const a = p[i], b = p[(i + 1) % p.length]; o.push([.75 * a[0] + .25 * b[0], .75 * a[1] + .25 * b[1]], [.25 * a[0] + .75 * b[0], .25 * a[1] + .75 * b[1]]); } if (!closed) o.push(p[p.length - 1]); p = o; } return p; }
function resample(pts, step, closed) { const P = closed ? pts.concat([pts[0]]) : pts, out = [P[0]]; let acc = 0; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]); let pos = step - acc; while (pos < d) { const u = pos / d; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); pos += step; } acc = d - (pos - step); } if (!closed) out.push(P[P.length - 1]); return out; }
const smooth = (p, closed = true, n = 3) => resample(chaikin(p, closed, n), 5, closed);
function jit(P, seed, amp = 1.2) { const K = G.K; return P.map((p, i) => [p[0] + (vn(i * 0.05 + seed * 7.1, K * 3.7 + seed) - .5) * 2 * amp, p[1] + (vn(i * 0.05 + seed * 3.3 + 50, K * 3.7 + seed + 9) - .5) * 2 * amp]); }
function path(ctx, Q, closed = true) { ctx.beginPath(); Q.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); if (closed) ctx.closePath(); }
const ell = (x, y, rx, ry, rot = 0, n = 36) => { const c = Math.cos(rot), s = Math.sin(rot); return Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry; return [x + ex * c - ey * s, y + ex * s + ey * c]; }); };
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];

function ik(p, q, a, b, pref) {
  const dx = q[0] - p[0], dy = q[1] - p[1], d = clamp(Math.hypot(dx, dy), Math.abs(a - b) + 0.01, a + b - 0.01), base = Math.atan2(dy, dx);
  const A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)), end = [p[0] + Math.cos(base) * d, p[1] + Math.sin(base) * d];
  const j1 = [p[0] + Math.cos(base + A) * a, p[1] + Math.sin(base + A) * a], j2 = [p[0] + Math.cos(base - A) * a, p[1] + Math.sin(base - A) * a];
  const m = [(p[0] + end[0]) / 2, (p[1] + end[1]) / 2], s = j => (j[0] - m[0]) * pref[0] + (j[1] - m[1]) * pref[1];
  return [s(j1) >= s(j2) ? j1 : j2, end];
}

// 连续的锥形肢体：中心线 [根, 关节, 末端]，widths = [[位置 0..1, 宽度], ...]
function limbPoly(pts, widths) {
  const c = resample(chaikin(pts, false, 3), 4, false), L = [0];
  for (let i = 1; i < c.length; i++) L.push(L[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]));
  const tot = L[L.length - 1] || 1;
  const wAt = s => { for (let i = 1; i < widths.length; i++) if (s <= widths[i][0]) { const [s0, w0] = widths[i - 1], [s1, w1] = widths[i]; return lerp(w0, w1, sm((s - s0) / (s1 - s0))); } return widths[widths.length - 1][1]; };
  const left = [], right = [], nrm = [];
  for (let i = 0; i < c.length; i++) {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)], tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = [-(b[1] - a[1]) / tl, (b[0] - a[0]) / tl], w = wAt(L[i] / tot) / 2;
    nrm.push(n); left.push([c[i][0] + n[0] * w, c[i][1] + n[1] * w]); right.push([c[i][0] - n[0] * w, c[i][1] - n[1] * w]);
  }
  const arc = (ctr, a0, a1, r, n = 10) => Array.from({ length: n + 1 }, (_, k) => { const a = lerp(a0, a1, k / n); return [ctr[0] + Math.cos(a) * r, ctr[1] + Math.sin(a) * r]; });
  const ne = nrm[nrm.length - 1], ae = Math.atan2(ne[1], ne[0]), n0 = nrm[0], a0 = Math.atan2(n0[1], n0[0]);
  const endCap = arc(c[c.length - 1], ae, ae - Math.PI, wAt(1) / 2), startCap = arc(c[0], a0 + Math.PI, a0, wAt(0) / 2);
  return { poly: left.concat(endCap, right.slice().reverse(), startCap), open: left.concat(endCap, right.slice().reverse()), left, right, c, at: s => { const i = Math.round(clamp(s) * (c.length - 1)); return { p: c[i], l: left[i], r: right[i] }; } };
}

// 两头收尖的内线（线宽 0 → wmax → 0）
function taper(ctx, pts, wmax = 3.4, col = INK, { seed = 0, ends = [0, 0] } = {}) {
  const P = jit(resample(pts, 4, false), seed + 33, 0.9); if (P.length < 3) return;
  const n = P.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nn = [-(b[1] - a[1]) / tl, (b[0] - a[0]) / tl];
    const s = i / (n - 1), w = wmax * Math.max(Math.pow(Math.sin(Math.PI * s), 0.55), s < 0.5 ? ends[0] : ends[1]) / 2;
    L.push([P[i][0] + nn[0] * w, P[i][1] + nn[1] * w]); R.push([P[i][0] - nn[0] * w, P[i][1] - nn[1] * w]);
  }
  ctx.fillStyle = col; path(ctx, L.concat(R.reverse()), true); ctx.fill();
}

// ---------- 渲染：剪影外轮廓 → 铺色 + 一档阴影 → 遮挡内线 → 贴纸投影 ----------
// part: { name, P(闭合多边形), col, sh(阴影色), lit:[dx,dy](受光偏移，越大阴影越宽), seed, edge(内线用的开放线，默认 P 闭合), over:[被它挡住的部件名] }
// 夜景等光照：recolor(col, 'lit'|'shade', part) 换色；litDir = 局部坐标里指向光源的单位向量（暖光照亮那一侧）；rim = { dir, col, w } 月光轮廓光；part.glow = 自发光不换色
function renderFigure(ctx, x, gy, dir, fig, { scale = 1, sx = 1, sy = 1, ground = true, groundW = 95, recolor = null, litDir = null, rim = null, inkCol = INK, shadowCol = SHADOW, groundCol = 'rgba(70,50,30,0.17)', box = null } = {}) {
  const [BW, BH, OX, OY] = box || [1200, 1200, 600, 1080];
  const off = createCanvas(BW, BH), g = off.getContext('2d');
  g.translate(OX, OY); g.scale(dir * scale * sx, scale * sy); G.tint = recolor ? (c => recolor(c, 'lit', {})) : null; g.lineJoin = 'round'; g.lineCap = 'round';
  const parts = fig.parts, byName = {}; parts.forEach(p => byName[p.name] = p);
  // 1 外轮廓：所有部件加粗描边 + 填墨 → 并集；再错位一次让右下方的线略粗（线条有轻重）
  for (const [dx, dy, w] of [[0, 0, LW * 2], [1.6, 2.2, LW * 1.7]]) for (const p of parts) { if (p.noOutline) continue; const Q = jit(p.P, p.seed || 0).map(q => [q[0] + dx, q[1] + dy]); g.fillStyle = inkCol; g.strokeStyle = inkCol; g.lineWidth = w; path(g, Q); g.fill(); g.stroke(); }
  // 2 铺色（和墨线错位 1 px 左右，保留手工上色感）+ 一档阴影：受光方向平移后的自身形状 ∩ 自身 = 亮面，其余是暗面
  for (const p of parts) {
    const Q = jit(p.P, (p.seed || 0) + 101, 1.1), rc = recolor && !p.glow, base = rc ? recolor(p.col, 'lit', p) : p.col, shc = rc ? recolor(p.col, 'shade', p) : p.sh;
    g.fillStyle = base; path(g, Q); g.fill();
    if (shc && !p.glow) { g.save(); path(g, Q); g.clip(); g.fillStyle = shc; g.fill(); let [lx, ly] = p.lit || [7, -6]; if (litDir) { const m = Math.hypot(lx, ly) * 1.3; lx = litDir[0] * m; ly = litDir[1] * m; } g.fillStyle = base; path(g, Q.map(q => [q[0] + lx, q[1] + ly])); g.fill(); g.restore(); }
    if (rim && !p.glow && !p.noRim) { g.save(); path(g, Q); g.clip(); g.beginPath(); g.rect(-OX, -OY, BW * 2, BH * 2); const sh_ = Q.map(q => [q[0] - rim.dir[0] * rim.w, q[1] - rim.dir[1] * rim.w]); sh_.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fillStyle = rim.col; g.fill('evenodd'); g.restore(); }
    if (p.after) p.after(g);
    // 3 内线：只画"挡住了别的部件"的那一段，两头收尖；紧跟在自己的颜色后面画，所以前面的部件会把它盖住
    if (p.over) for (const nm of p.over) { const b = byName[nm]; if (!b) continue; g.save(); path(g, jit(b.P, (b.seed || 0) + 101, 1.1)); g.clip(); taper(g, p.edge || p.P.concat([p.P[0]]), p.ew || 3.6, inkCol, { seed: p.seed || 0, ends: p.edgeEnds || [0, 0] }); g.restore(); }
  }
  if (fig.details) fig.details(g); G.tint = null;
  // 4 贴纸投影 + 地面影子
  const tint = createCanvas(BW, BH), tg = tint.getContext('2d'); tg.drawImage(off, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = shadowCol; tg.fillRect(0, 0, BW, BH);
  if (ground) { ctx.fillStyle = groundCol; ctx.beginPath(); ctx.ellipse(fig.groundX ?? x, fig.groundY ?? gy + 6, groundW * scale * (fig.groundK ?? 1), 13 * scale * (fig.groundK ?? 1), 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.drawImage(tint, x - OX + 9, gy - OY + 11); ctx.drawImage(off, x - OX, gy - OY);
}

// ---------- 3/4 侧身的中世纪人物（局部坐标：脚底中心为原点，面朝右；dir 在渲染时翻转） ----------
const SKIN = '#E9B48C', SKIN_SH = '#CF916C';
function eye34(g, x, y, r, sx, look, { lid = 0 } = {}) {
  g.save(); g.translate(x, y); g.scale(sx, 1);
  g.fillStyle = INK; g.beginPath(); g.ellipse(0, 0, r + 2, r * 1.18 + 2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#FFFDF6'; g.beginPath(); g.ellipse(0, 0, r, r * 1.18, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = INK; g.beginPath(); g.arc(look[0] * r * 0.4, look[1] * r * 0.4, r * 0.52, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(look[0] * r * 0.4 + r * 0.18, look[1] * r * 0.4 - r * 0.2, r * 0.14, 0, Math.PI * 2); g.fill();
  if (lid > 0) { g.fillStyle = tc(SKIN); g.beginPath(); g.ellipse(0, -r * 1.18 * (1 - lid), r + 2, r * 1.18 * lid + 1, 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
}
// 眼睛 v2：杏仁形眼白 + 细轮廓；上眼皮一道粗的收尖线（外眼角带一点上挑）；大虹膜 + 瞳孔 + 两个高光；眼皮高低做表情；闭眼是一道下弯的弧
function eyeV2(g, c, r, sx, look, { lid = 0.2, squint = 0, closed = false } = {}) {
  g.save(); g.translate(c[0], c[1]); g.scale(sx, 1);
  const rx = r * 0.86, ry = r * 1.12;
  if (closed) { taper(g, [[-rx * 1.05, -ry * 0.1], [0, ry * 0.32], [rx * 1.1, -ry * 0.12]], r * 0.34, INK, { seed: 17, ends: [0.2, 0.2] }); g.restore(); return; }
  const E = []; for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, s = Math.sin(a); E.push([Math.cos(a) * rx, s * ry * (s < 0 ? 1 : 0.9)]); }
  g.fillStyle = tc('#FFFDF6'); path(g, E); g.fill();
  g.save(); path(g, E); g.clip();
  const ix = look[0] * rx * 0.36, iy = look[1] * ry * 0.28 + ry * 0.06;
  g.fillStyle = '#3A2E4E'; g.beginPath(); g.ellipse(ix, iy, rx * 0.64, ry * 0.68, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#120E1E'; g.beginPath(); g.ellipse(ix, iy, rx * 0.34, ry * 0.38, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(ix + rx * 0.24, iy - ry * 0.28, r * 0.18, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(ix - rx * 0.22, iy + ry * 0.24, r * 0.07, 0, Math.PI * 2); g.fill();
  const lidY = -ry + 2 * ry * lid; g.fillStyle = tc(SKIN); g.beginPath(); g.ellipse(0, lidY - ry * 1.2, rx * 1.7, ry * 1.2, 0, 0, Math.PI * 2); g.fill();
  if (squint > 0) { const ly = ry - 1.6 * ry * squint; g.beginPath(); g.ellipse(0, ly + ry * 1.3, rx * 1.7, ry * 1.3, 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
  g.strokeStyle = INK; g.lineWidth = 2.2; path(g, E); g.stroke();
  const top = []; for (let k = 0; k <= 14; k++) { const x = lerp(-rx * 1.02, rx * 1.02, k / 14), eT = -ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)), lE = lidY - ry * 1.2 + ry * 1.2 * Math.sqrt(Math.max(0, 1 - (x / (rx * 1.7)) ** 2)); top.push([x, Math.max(eT, lE)]); }
  top.push([rx * 1.28, top[top.length - 1][1] - ry * 0.22]);
  taper(g, top, r * 0.4, INK, { seed: 18, ends: [0.35, 0] });
  if (squint > 0.15) { const ly = ry - 1.6 * ry * squint; taper(g, [[-rx * 0.9, ly + ry * 0.12], [0, ly], [rx * 0.9, ly + ry * 0.1]], r * 0.16, INK, { seed: 19 }); }
  g.restore();
}
function buildMan(P, S) {
  const parts = [], lean = P.lean || 0, tw = S.tw, T = S.torso;
  const hipY = -(S.thigh + S.shin) * 0.97 + (P.drop || 0), hipC = [0, hipY], R = v => add(hipC, rot(v, lean));
  const ns = R([-0.27 * tw, -T + 14]), fs = R([0.25 * tw, -T + 10]);            // 近肩、远肩（3/4：两肩都看得到，远肩窄一些）
  const nh = [-0.13 * tw, hipY + 4], fh = [0.12 * tw, hipY];
  const neckB = R([0.05 * tw, -T + 2]), hr = S.head * 0.8, hc = add(neckB, rot([0.1 * hr, -hr * 1.05], lean * 1.2));
  const H = v => add(hc, v);

  // 腿（连续锥形：大腿 → 膝 → 小腿肚 → 踝），远腿暗一档
  const leg = (hip, foot, near) => { const [kn, f] = ik(hip, add(foot, [0, -8]), S.thigh, S.shin, [1, -0.25]);
    const t = S.thigh; return limbPoly([hip, kn, f], [[0, t * 0.5], [0.22, t * 0.46], [0.48, t * 0.3], [0.64, t * 0.34], [0.86, t * 0.22], [1, t * 0.2]]); };
  const shoe = (foot, len, near, heel = 0) => { const pts = [[-0.24, -0.06], [-0.2, -0.36], [0.1, -0.4], [0.5, -0.22], [0.98, -0.04 - heel * 0.2], [0.62, 0.05], [-0.12, 0.06]].map(([a, b]) => [foot[0] + a * len, foot[1] + b * len + (a < 0.3 ? -heel * len * (0.3 - a) : 0)]); return smooth(pts, true, 2); };
  const legF = leg(fh, P.fF, false), legN = leg(nh, P.fN, true);
  parts.push({ name: 'legF', P: legF.poly, col: S.hoseF || S.hoseSh, sh: S.hoseSh2, lit: [5, -4], seed: 21 });
  parts.push({ name: 'shoeF', P: shoe(P.fF, S.foot * 0.86, false, P.heelF || 0), col: '#4A3A35', sh: '#352826', lit: [4, -4], seed: 22, over: ['legF'] });

  // 远手臂（在躯干后面）
  const arm = (sh, hand, near) => { const [el, h] = ik(sh, hand, S.upper, S.fore, P.elbowPref || [-0.4, 1]); const u = S.upper;
    return { L: limbPoly([sh, el, h], [[0, u * 0.5], [0.2, u * 0.46], [0.5, u * 0.36], [0.62, u * 0.38], [0.9, u * 0.3], [1, u * 0.3]]), el, h }; };
  // 手：哆啦A梦式的圆手掌，不画手指和拇指
  const handPoly = (A, r) => { const tip = A.L.c[A.L.c.length - 1], prev = A.L.c[Math.max(0, A.L.c.length - 6)], a = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]);
    const ctr = add(tip, rot([r * 0.7, 0], a)); return { ctr, a, P: smooth([...ell(ctr[0], ctr[1], r, r, a, 14)], true, 1) }; };
  const armF = arm(fs, P.hF, false), hF = handPoly(armF, S.head * 0.24);
  parts.push({ name: 'handF', P: hF.P, col: SKIN_SH, seed: 31 });
  parts.push({ name: 'armF', P: armF.L.poly, col: S.tunicSh, sh: S.tunicSh2, lit: [5, -4], seed: 32, after: g => cuff(g, armF.L) });

  // 近腿
  parts.push({ name: 'legN', P: legN.poly, col: S.hose, sh: S.hoseSh, lit: [6, -4], seed: 23, edge: legN.open, over: ['legF', 'shoeF'] });
  parts.push({ name: 'shoeN', P: shoe(P.fN, S.foot, true, P.heelN || 0), col: '#5A4740', sh: '#3E302B', lit: [4, -4], seed: 24, over: ['legN', 'legF', 'shoeF'] });

  // 躯干 + 下摆（3/4：胸口朝前凸、近侧有一窄条侧面在暗部）
  const sk = S.skirt;
  const torso = smooth([[-0.12 * tw, -T - 4], [-0.37 * tw, -T + 14], [-0.42 * tw, -T * 0.58], [-0.35 * tw, -T * 0.36], [-0.52 * tw, sk], [-0.1 * tw, sk + 8], [0.2 * tw, sk + 12], [0.5 * tw, sk + 2], [0.33 * tw, -T * 0.36], [0.43 * tw, -T * 0.66], [0.31 * tw, -T + 10], [0.12 * tw, -T - 6]].map(R), true, 3);
  parts.push({ name: 'torso', P: torso, col: S.tunic, sh: S.tunicSh, lit: [16, -5], seed: 41, over: ['armF', 'handF', 'legF', 'legN'],
    after: g => { // 前襟 + 绗缝线（顺着身体的弧度）
      const front = 0.16; taper(g, [R([front * tw, -T]), R([(front + 0.02) * tw, -T * 0.6]), R([(front + 0.01) * tw, -T * 0.4])], 3.4, INK, { seed: 3 });
      if (S.quilt) for (const q of [-0.2, -0.04, 0.32]) { const k = q < front ? 1 : 0.8; taper(g, [R([q * tw, -T + 22]), R([(q + 0.03 * k) * tw, -T * 0.65]), R([q * tw, -T * 0.42])], 2.2, tc(S.tunicSh2), { seed: 7 + q * 10 });
        taper(g, [R([q * tw, -T * 0.32]), R([(q * 1.15) * tw, sk * 0.5]), R([(q * 1.3) * tw, sk - 4])], 2.2, tc(S.tunicSh2), { seed: 9 + q * 10 }); }
      if (S.emblem) S.emblem(g, R, tw, T);
    } });
  // 腰带：中间往下弯（圆柱体的透视）
  const belt = smooth([R([-0.37 * tw, -T * 0.43]), R([0.05 * tw, -T * 0.36]), R([0.36 * tw, -T * 0.42]), R([0.37 * tw, -T * 0.34]), R([0.05 * tw, -T * 0.27]), R([-0.36 * tw, -T * 0.33])], true, 2);
  parts.push({ name: 'belt', P: belt, col: '#6B4A36', seed: 42, over: ['torso'], ew: 3, after: g => { const b = R([0.12 * tw, -T * 0.31]); g.fillStyle = tc('#C9A14A'); g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.rect(b[0] - 9, b[1] - 9, 18, 16); g.fill(); g.stroke(); } });

  // 脖子 + 头
  parts.push({ name: 'neck', P: limbPoly([R([0.02 * tw, -T + 8]), H([-0.05 * hr, hr * 0.55])], [[0, hr * 0.62], [1, hr * 0.56]]).poly, col: SKIN_SH, seed: 51 });
  const head = smooth([[-0.5, -0.88], [0.12, -1.02], [0.72, -0.7], [0.9, -0.22], [0.86, 0.32], [0.6, 0.84], [0.1, 0.98], [-0.5, 0.66], [-0.95, 0.05], [-0.85, -0.52]].map(([a, b]) => H([a * hr, b * hr])), true, 3);
  parts.push({ name: 'head', P: head, col: SKIN, sh: SKIN_SH, lit: [7, -5], seed: 52, over: ['neck', 'torso'], edge: head.concat([head[0]]) });
  const F = (a, b) => H([a * hr, b * hr]), FP = pts => pts.map(([a, b]) => F(a, b));
  // 耳朵：侧面看是"C"形——前缘贴着脸颊几乎是直的，后缘向后鼓出，上宽下窄收成耳垂；里面一块 C 形耳窝暗面 + 耳轮内沿一道线 + 耳孔前的小耳屏
  const ear = smooth(FP([[-0.26, -0.16], [-0.38, -0.25], [-0.54, -0.18], [-0.61, 0.0], [-0.56, 0.17], [-0.47, 0.3], [-0.37, 0.37], [-0.29, 0.32], [-0.3, 0.2], [-0.25, 0.02]]), true, 3);
  const concha = smooth(FP([[-0.32, -0.1], [-0.45, -0.13], [-0.53, 0.0], [-0.5, 0.14], [-0.41, 0.22], [-0.33, 0.2], [-0.38, 0.12], [-0.42, 0.03], [-0.37, -0.03]]), true, 3);
  const earPart = { name: 'ear', P: ear, col: SKIN, sh: SKIN_SH, lit: [3, -2], seed: 53, over: ['head', 'hair'], ew: 3, after: g => {
    g.fillStyle = tc(SKIN_SH); path(g, concha); g.fill(); // 耳窝：一块 C 形暗面
    taper(g, FP([[-0.31, -0.11], [-0.45, -0.14], [-0.53, 0.0], [-0.5, 0.14], [-0.4, 0.23]]), 2.6, INK, { seed: 4 }); // 耳轮内沿
    taper(g, FP([[-0.29, 0.03], [-0.36, 0.06], [-0.35, 0.13]]), 2.2, INK, { seed: 6 }); } }; // 耳屏
  // 头发：戴帽子时只留帽檐下的鬓角和后脑一撮（不再有一条发际线横穿额头）；不戴帽子时是完整的发型
  const hairPts = S.hat ? [[-0.98, 0.34], [-1.02, -0.3], [-0.72, -0.52], [-0.3, -0.5], [-0.4, -0.16], [-0.52, 0.18], [-0.64, 0.46]]
    : [[-0.97, 0.3], [-0.98, -0.4], [-0.5, -0.95], [0.2, -1.04], [0.7, -0.8], [0.62, -0.56], [0.28, -0.66], [-0.05, -0.5], [-0.3, -0.3], [-0.5, 0.05], [-0.62, 0.42]];
  if (S.hair) parts.push({ name: 'hair', P: smooth(FP(hairPts), true, 3), col: S.hair, sh: S.hairSh, lit: [6, -4], seed: 54, over: ['head'] });
  parts.push(earPart);
  // 胡子：上沿在嘴下面，嘴和八字胡单独画在上面
  if (S.beard) parts.push({ name: 'beard', P: smooth(FP([[-0.55, 0.28], [-0.36, 0.6], [0.04, 0.74], [0.42, 0.78], [0.8, 0.62], [0.88, 0.46], [0.8, 0.86], [0.42, 1.2], [0.0, 1.12], [-0.4, 0.82]]), true, 3), col: S.hair, sh: S.hairSh, lit: [5, -4], seed: 55, over: ['head', 'neck'] });
  // 鼻子：在两眼之间偏远侧、眼睛下方，鼻尖伸出远侧脸颊的轮廓；内线只画鼻底和鼻孔
  const nose = smooth(FP([[0.57, 0.02], [0.9, 0.15], [0.98, 0.25], [0.9, 0.33], [0.62, 0.32]]), true, 2);
  parts.push({ name: 'nose', P: nose, col: SKIN, sh: SKIN_SH, lit: [3, -3], seed: 56, over: ['head', 'beard'], ew: 3.2, edge: FP([[0.62, 0.3], [0.8, 0.35], [0.92, 0.32], [0.97, 0.25]]), edgeEnds: [0, 0.3] });
  // 头饰
  if (S.hat === 'kettle') { // 铁盔（chapel de fer）：圆顶 + 宽檐，3/4 下檐是斜椭圆
    parts.push({ name: 'dome', P: smooth([[-0.98, -0.56], [-0.85, -1.1], [-0.2, -1.48], [0.5, -1.4], [0.98, -0.9], [1.02, -0.56]].map(([a, b]) => H([a * hr, b * hr])), true, 3), col: '#A3ACB0', sh: '#7A8489', lit: [9, -6], seed: 57, over: ['head', 'hair', 'ear'] });
    parts.push({ name: 'brim', P: ell(...H([0.06 * hr, -0.62 * hr]), hr * 1.42, hr * 0.3, -0.1, 40), col: '#B6BEC2', sh: '#80898E', lit: [8, -5], seed: 58, over: ['dome', 'head', 'hair', 'ear', 'nose'],
      after: g => { taper(g, [H([-0.5 * hr, -1.3 * hr]), H([0.1 * hr, -1.46 * hr]), H([0.6 * hr, -1.3 * hr])], 2.4, tc('#E6ECEE'), { seed: 5 }); } });
  } else if (S.hat === 'coif') { // 头巾式软帽，露出脸
    parts.push({ name: 'coif', P: smooth([[-1.08, 0.75], [-1.12, -0.5], [-0.6, -1.12], [0.25, -1.16], [0.84, -0.78], [0.66, -0.52], [0.2, -0.66], [-0.2, -0.4], [-0.32, 0.25], [-0.2, 0.92], [-0.6, 1.05]].map(([a, b]) => H([a * hr, b * hr])), true, 3), col: S.coif, sh: S.coifSh, lit: [7, -5], seed: 57, over: ['head', 'ear', 'neck', 'torso'] });
  } else if (S.hat === 'cap') {
    parts.push({ name: 'cap', P: smooth([[-0.98, -0.4], [-0.9, -0.95], [-0.2, -1.32], [0.75, -1.15], [1.05, -0.72], [0.62, -0.5], [-0.3, -0.5]].map(([a, b]) => H([a * hr, b * hr])), true, 3), col: S.capCol, sh: S.capSh, lit: [7, -5], seed: 57, over: ['head', 'hair', 'ear'] });
  }

  // 近手臂（在躯干前面，内线只在它压住躯干的那一段）
  const armN = arm(ns, P.hN, true), hN = handPoly(armN, S.head * 0.27);
  parts.push({ name: 'armN', P: armN.L.poly, col: S.tunic, sh: S.tunicSh, lit: [6, -6], seed: 61, edge: armN.L.open, over: ['torso', 'belt', 'legN', 'legF'], after: g => cuff(g, armN.L) });
  parts.push({ name: 'handN', P: hN.P, col: SKIN, sh: SKIN_SH, lit: [4, -4], seed: 62, over: ['armN', 'torso', 'belt'], ew: 3 });

  const look = P.look || [1, 0];
  // 表情参数：lid 上眼皮（0 瞪大 … 1 闭上）、squint 下眼皮上推（笑、怒）、brow 眉毛高低、browAng 眉头（+ 皱眉/怒，- 发愁）、smile（-1 撇嘴 … 1 笑）、mouth 张嘴
  const br = P.brow || 0, closed = (P.blink || 0) > 0.9;
  const lid = P.lid ?? (br > 1 ? 0.04 : br < -0.4 ? 0.42 : 0.2), squint = P.squint ?? (br < -1 ? 0.25 : (P.smile || 0) > 0.6 ? 0.4 : 0);
  const ang = P.browAng ?? (br < -0.4 ? 0.7 : br > 1.4 ? -0.3 : 0), smile = P.smile ?? (P.mouth > 0.2 ? 0.2 : 0.3), m = P.mouth || 0;
  const details = g => {
    eyeV2(g, F(0.12, -0.1), hr * 0.2, 1, look, { lid, squint, closed });            // 近眼
    eyeV2(g, F(0.74, -0.13), hr * 0.185, 0.68, look, { lid, squint, closed });       // 远眼：横向压扁，在鼻梁另一侧
    // 眉毛：粗、两头收尖；高低随 brow，眉头随 browAng
    const by = -br * 0.08;
    taper(g, FP([[-0.12, -0.44 + by - ang * 0.04], [0.1, -0.52 + by], [0.3, -0.43 + by + ang * 0.11]]), hr * 0.15, INK, { seed: 6, ends: [0.2, 0.5] });
    taper(g, FP([[0.56, -0.45 + by + ang * 0.1], [0.7, -0.52 + by], [0.86, -0.46 + by - ang * 0.03]]), hr * 0.12, INK, { seed: 8, ends: [0.5, 0.2] });
    g.fillStyle = G.tint ? 'rgba(224,120,110,0.12)' : 'rgba(224,120,110,0.3)'; g.beginPath(); g.ellipse(...F(0.06, 0.32), hr * 0.19, hr * 0.11, 0, 0, Math.PI * 2); g.fill();
    // 嘴：3/4 透视——近侧半边长、远侧半边短
    const lift = smile * 0.06;
    if (m > 0.15) {
      const top = FP([[0.2, 0.49 - lift], [0.42, 0.51], [0.62, 0.48 - lift]]), bot = FP([[0.59, 0.53 + 0.2 * m - lift * 0.5], [0.41, 0.55 + 0.28 * m], [0.23, 0.53 + 0.22 * m - lift * 0.5]]);
      const M = smooth(top.concat(bot), true, 2); g.fillStyle = tc('#4A2430'); path(g, M); g.fill();
      g.save(); path(g, M); g.clip();
      g.fillStyle = tc('#D9776C'); g.beginPath(); g.ellipse(...F(0.41, 0.56 + 0.28 * m), hr * 0.15, hr * 0.1 * (0.6 + m), 0, 0, Math.PI * 2); g.fill();
      if (m > 0.35) { g.fillStyle = tc('#FBF6EC'); path(g, smooth(FP([[0.18, 0.44], [0.64, 0.44], [0.62, 0.53], [0.42, 0.56], [0.22, 0.54]]), true, 1)); g.fill(); }
      g.restore(); g.strokeStyle = INK; g.lineWidth = 3.2; g.lineJoin = 'round'; path(g, jit(M, 19, 0.8)); g.stroke();
    } else {
      taper(g, FP([[0.22, 0.51 - lift], [0.42, 0.53 + smile * 0.07], [0.62, 0.5 - lift]]), hr * 0.1, INK, { seed: 2, ends: [0.3, 0.2] });
      if (smile > 0.35) taper(g, FP([[0.17, 0.46], [0.21, 0.52]]), hr * 0.06, INK, { seed: 3 });      // 近侧嘴角的小酒窝
      if (smile < -0.2) taper(g, FP([[0.34, 0.62], [0.48, 0.63]]), hr * 0.05, tc(SKIN_SH), { seed: 3 }); // 撇嘴时下唇一道
    }
    // 八字胡（单独的形状，盖在嘴上沿）
    if (S.mustache || S.beard) { const MS = smooth(FP([[0.18, 0.46], [0.34, 0.39], [0.46, 0.41], [0.58, 0.38], [0.78, 0.44], [0.68, 0.5], [0.47, 0.46], [0.28, 0.51]]), true, 2);
      g.fillStyle = tc(S.hair); path(g, jit(MS, 21, 0.8)); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; path(g, jit(MS, 21, 0.8)); g.stroke(); }
    if (P.prop) P.prop(g, { hN: hN.ctr, hF: hF.ctr });
  };
  // 手里的道具在近手之前画：把手指画回道具前面
  return { parts, details, joints: { ns, fs, el: armN.el, hc, hN: hN.ctr, hF: hF.ctr } };
}
// 袖口：在肢体 86% 处横一条收尖的线
function cuff(g, L) { const a = L.at(0.84), b = L.at(0.8); taper(g, [a.l, add(b.p, [(a.p[0] - b.p[0]) * 2, (a.p[1] - b.p[1]) * 2]), a.r], 3.2, INK, { seed: 15, ends: [0.35, 0.35] }); }

module.exports = { tc, INK, PAPER, SHADOW, LW, G, clamp, lerp, sm, vn, chaikin, resample, smooth, jit, path, ell, add, rot, ik, limbPoly, taper, renderFigure, buildMan, SKIN, SKIN_SH };
